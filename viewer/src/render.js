import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

export const QUALITY_KEY = 'idm-render-quality';
export const QUALITY_LEVELS = ['high', 'medium', 'low'];

export function defaultQuality() {
  try {
    const saved = localStorage.getItem(QUALITY_KEY);
    if (QUALITY_LEVELS.includes(saved)) return saved;
  } catch { /* private mode: fall through to the size heuristic */ }
  return window.innerWidth <= 800 ? 'medium' : 'high';
}

/**
 * The render stack. Everything that decides how the picture looks lives here so the rest of the
 * app only ever calls invalidate().
 *
 * Render-on-demand: the frame loop draws only when something asked it to. An interior scene is
 * static most of the time, and a 4K shadow map plus GTAO is far too expensive to redraw at 60fps
 * for no reason. shadowMap.autoUpdate is off for the same reason; callers set needsUpdate when
 * geometry or the sun actually moved.
 */
export function createRenderer(container, {onFirstFrame, onProgress} = {}) {
  const scene = new T.Scene();
  const renderer = new T.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  // PCFSoftShadowMap is deprecated in r18x; softness now comes from shadow.radius / blurSamples
  // on each light (see lighting.js), which is both cheaper and controllable per light.
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const camera = new T.PerspectiveCamera(38, 1, 0.035, 500);

  // RoomEnvironment is the offline fallback so the viewer never looks flat without assets;
  // the scanned HDRI replaces it in place once (and if) it downloads.
  const pmrem = new T.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.55;
  room.dispose();
  container.dataset.hdri = 'room-environment-fallback';

  let renderRequested = true;
  const invalidate = () => { renderRequested = true; };

  // HDRLoader is three r18x's replacement for RGBELoader; it reads the same .hdr files.
  //
  // Before an asset fetch, a static-file dev/preview server answers a missing .hdr with a 200 +
  // the SPA fallback index.html rather than a 404. HDRLoader's underlying DataTextureLoader does
  // not treat that defensively: its RGBE parser throws on the HTML body, and the loader's own
  // catch block calls onError but falls through into using the (never assigned) parsed result
  // anyway, throwing "Cannot read properties of undefined (reading 'image')" as an uncaught page
  // error. So the real HDR magic bytes ("#?", RADIANCE/RGBE) are checked before ever handing the
  // response to HDRLoader, which keeps that broken code path from running at all.
  const HDRI_URL = '/hdri/small_empty_room_1_1k.hdr';
  async function looksLikeHdr(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) return false;
      const buffer = await response.arrayBuffer();
      return new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength))) === '#?';
    } catch {
      return false;
    }
  }
  looksLikeHdr(HDRI_URL).then(ok => {
    if (!ok) {
      // Missing/placeholder HDRI is expected before `npm run fetch-assets`; RoomEnvironment
      // carries the scene.
      container.dataset.hdri = 'room-environment-fallback';
      return;
    }
    new HDRLoader().load(HDRI_URL, hdr => {
      hdr.mapping = T.EquirectangularReflectionMapping;
      const previous = scene.environment;
      scene.environment = pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose();
      previous?.dispose();
      container.dataset.hdri = 'small_empty_room_1';
      renderer.shadowMap.needsUpdate = true;
      invalidate();
    }, undefined, () => {
      container.dataset.hdri = 'room-environment-fallback';
    });
  });

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, 512, 512);
  ao.blendIntensity = 0.62;
  ao.updateGtaoMaterial({radius: 0.34, distanceExponent: 1.2, thickness: 0.9, scale: 1.05, samples: 16});
  composer.addPass(ao);
  // Lamps and LED channels glow slightly. SMAA works in linear space, so it precedes OutputPass.
  const bloom = new UnrealBloomPass(new T.Vector2(1, 1), 0.18, 0.3, 6);
  composer.addPass(bloom);
  const smaa = new SMAAPass();
  composer.addPass(smaa);
  composer.addPass(new OutputPass());

  // Transparent glazing and voile pollute the AO normal buffer; hide them for that pass only.
  const transparentObjects = [];
  const baseAoRender = ao.render.bind(ao);
  ao.render = (...args) => {
    const previous = transparentObjects.map(o => o.visible);
    transparentObjects.forEach(o => { o.visible = false; });
    try { baseAoRender(...args); } finally { transparentObjects.forEach((o, i) => { o.visible = previous[i]; }); }
  };
  const registerTransparent = root => {
    transparentObjects.length = 0;
    root.traverse(o => {
      if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.transparent && o.material.opacity < 0.5) {
        transparentObjects.push(o);
      }
    });
  };

  let level = defaultQuality();
  let glassMaterials = [];
  let shadowLight = null;

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    // A zero-sized container yields aspect 0, which sends framing maths to Infinity.
    if (!width || !height) return false;
    renderer.setSize(width, height);
    composer.setSize(width, height);
    ao.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    invalidate();
    return true;
  }

  function applyQuality(next) {
    if (!QUALITY_LEVELS.includes(next)) return level;
    level = next;
    const low = next === 'low';
    const high = next === 'high';
    bloom.enabled = !low;
    smaa.enabled = !low;
    ao.enabled = !low;
    renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, high ? 2 : 1.5));
    if (shadowLight) {
      const size = high ? (window.innerWidth > 800 ? 4096 : 2048) : low ? 1024 : 2048;
      if (shadowLight.shadow.mapSize.x !== size) {
        shadowLight.shadow.mapSize.setScalar(size);
        shadowLight.shadow.map?.dispose();
        shadowLight.shadow.map = null;
      }
    }
    // Transmission is the single most expensive material feature here; only the high tier pays for it.
    for (const {material, amount} of glassMaterials) {
      const value = high ? amount : 0;
      if (material.transmission !== value) {
        material.transmission = value;
        material.needsUpdate = true;
      }
    }
    container.dataset.quality = next;
    try { localStorage.setItem(QUALITY_KEY, next); } catch { /* private mode */ }
    renderer.shadowMap.needsUpdate = true;
    invalidate();
    resize();
    return level;
  }

  new ResizeObserver(resize).observe(container);

  let compiled = false;
  let firstFrame = false;
  const listeners = [];

  function markCompiled() {
    compiled = true;
    container.dataset.compiled = '1';
    invalidate();
  }

  // Linking ~40 shader programs is the single biggest cold start stall. compileAsync moves it off
  // the main thread where KHR_parallel_shader_compile exists; the timer keeps the old blocking
  // behaviour as a floor for drivers that never resolve.
  function compile(root) {
    onProgress?.('compile', 0.25);
    const children = root.children;
    const step = Math.max(1, Math.ceil(children.length / 8));
    const batches = [];
    for (let i = 0; i < children.length; i += step) {
      const slice = children.slice(i, i + step);
      batches.push({traverse(cb) { for (const o of slice) o.traverse(cb); }, traverseVisible() {}});
    }
    batches.push(scene);
    let done = 0;
    const tick = () => {
      done++;
      if (!compiled) onProgress?.('compile', 0.25 + 0.65 * done / batches.length);
    };
    Promise.all(batches.map(o => renderer.compileAsync(o, camera, scene).then(tick, tick)))
      .then(markCompiled, markCompiled);
    setTimeout(markCompiled, 20000);
  }

  let last = performance.now();
  function frame(now) {
    // The first rAF timestamp predates `last` (building the scene takes seconds); an unclamped
    // negative dt once sent the camera to 1e11.
    const dt = Math.min(Math.max(now - last, 0) / 1000, 0.1);
    last = now;
    for (const fn of listeners) { if (fn(dt) === true) invalidate(); }
    if (renderRequested && compiled) {
      renderer.info.autoReset = false;
      renderer.info.reset();
      composer.render();
      container.dataset.render = JSON.stringify({
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        frame: renderer.info.render.frame,
        quality: level
      });
      renderRequested = false;
      if (!firstFrame) {
        firstFrame = true;
        container.dataset.firstFrame = '1';
        onProgress?.('done', 1);
        onFirstFrame?.();
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    scene, renderer, camera, composer, ao, bloom, smaa, pmrem,
    canvas: renderer.domElement,
    invalidate,
    resize,
    onFrame(fn) { listeners.push(fn); },
    registerTransparent,
    registerGlass(list) { glassMaterials = list; applyQuality(level); },
    setShadowLight(light) { shadowLight = light; applyQuality(level); },
    markShadowsDirty() { renderer.shadowMap.needsUpdate = true; invalidate(); },
    compile,
    get quality() { return level; },
    setQuality: applyQuality,
    isCompiled: () => compiled,
    hasFirstFrame: () => firstFrame
  };
}
