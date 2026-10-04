import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const OPENSKP_ESM = 'https://esm.sh/openskp@1.3.0?bundle';
const OPENSKP_WASM_JS = './vendor/openskp.js';
const OPENSKP_WASM_BASE = 'https://cdn.jsdelivr.net/gh/iamahsanmehmood/openskp@python-v1.3.0/examples/web-viewer/wasm/';
const LARGE_FILE_BYTES = 50 * 1024 * 1024;

const BUILDING_FACING_AZIMUTH_DEG = 315; // 坐東南、向西北
const SHOWCASE_SUN_AZIMUTH_DEG = 245;   // 午後西南偏西日照
const SHOWCASE_SUN_ELEVATION_DEG = 30;  // 秋季午後約 30 度仰角
const SHOWCASE_TIME_LABEL = '午後 15:30';

const viewport = document.getElementById('viewport');
const fileInput = document.getElementById('fileInput');
const welcomeFileInput = document.getElementById('welcomeFileInput');
const welcome = document.getElementById('welcome');
const dropCard = document.querySelector('.drop-card');
const loading = document.getElementById('loading');
const loadingTitle = document.getElementById('loadingTitle');
const loadingDetail = document.getElementById('loadingDetail');
const statusEl = document.getElementById('status');
const modeBadge = document.getElementById('modeBadge');
const modelInfo = document.getElementById('modelInfo');
const fitBtn = document.getElementById('fitBtn');
const exportBtn = document.getElementById('exportBtn');

let scene, camera, renderer, controls, modelRoot, stagingRoot, sunLight, interiorLightRoot;
let nordicWoodTexture = null;
let currentSceneData = null;
let currentGlbBytes = null;
let currentFilename = '1004.skp';
let threeTextureCache = new Map();
let textureObjectUrls = [];
let openSkpModulePromise = null;
let wasmModulePromise = null;

initThree();
bindUI();
tryAutoLoadRepoModel();

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe2ddd4);

  // Perspective projection reads more like a real architectural photograph
  // than the previous orthographic / dollhouse view.
  camera = new THREE.PerspectiveCamera(40, 1, 0.05, 500);
  camera.position.set(12, 9, 12);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xe2ddd4, 1);
  viewport.appendChild(renderer.domElement);

  // No SSAO / post-processing and no bright HDR room environment:
  // this is intentionally the stable iPhone/Safari path.
  scene.environment = null;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.85;
  controls.minPolarAngle = Math.PI * 0.15;
  controls.maxPolarAngle = Math.PI * 0.49;

  // Soft sky light. Kept deliberately low so wall/floor corners retain depth.
  scene.add(new THREE.HemisphereLight(0xf8fbff, 0x9e9589, 0.42));
  scene.add(new THREE.AmbientLight(0xffffff, 0.035));

  // Direct sun; its actual position is set after the model bounds are known.
  sunLight = new THREE.DirectionalLight(0xffdfae, 1.85);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.radius = 3;
  sunLight.shadow.bias = -0.00005;
  sunLight.shadow.normalBias = 0.018;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Weak cool sky bounce from the opposite side.
  const skyBounce = new THREE.DirectionalLight(0xd9e4f0, 0.14);
  skyBounce.position.set(7, 6, -9);
  scene.add(skyBounce);

  stagingRoot = new THREE.Group();
  scene.add(stagingRoot);

  modelRoot = new THREE.Group();
  scene.add(modelRoot);

  interiorLightRoot = new THREE.Group();
  interiorLightRoot.name = 'Interior_Lighting';
  scene.add(interiorLightRoot);

  nordicWoodTexture = createWoodTexture();

  window.addEventListener('resize', resize);
  resize();

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
}

function resize() {
  const w = Math.max(1, viewport.clientWidth);
  const h = Math.max(1, viewport.clientHeight);

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

function bindUI() {
  fileInput.addEventListener('change', e => pickFile(e.target.files?.[0]));
  welcomeFileInput.addEventListener('change', e => pickFile(e.target.files?.[0]));
  fitBtn.addEventListener('click', fitCamera);
  exportBtn.addEventListener('click', downloadGlb);

  ['dragenter','dragover'].forEach(type => {
    window.addEventListener(type, e => {
      e.preventDefault();
      dropCard?.classList.add('drag');
    });
  });
  ['dragleave','drop'].forEach(type => {
    window.addEventListener(type, e => {
      e.preventDefault();
      dropCard?.classList.remove('drag');
    });
  });
  window.addEventListener('drop', e => {
    const file = e.dataTransfer?.files?.[0];
    if (file) pickFile(file);
  });
}

function pickFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.skp')) {
    setStatus('請選擇 .skp 檔案');
    return;
  }
  loadFile(file);
}

async function loadFile(file) {
  currentFilename = file.name;
  const buffer = await file.arrayBuffer();
  const preferWasm = file.size >= LARGE_FILE_BYTES;
  await loadBuffer(buffer, file.name, preferWasm);
}

async function loadBuffer(buffer, filename, preferWasm) {
  clearModel();
  showLoading(true,
    preferWasm ? 'WASM 快速解析大型 SKP…' : '解析 SketchUp 模型…',
    preferWasm
      ? '大型檔使用原生 WASM 轉為 GLB，再交給 Three.js。'
      : '正在建立材質、幾何與 Three.js Mesh。'
  );

  const mb = (buffer.byteLength / 1048576).toFixed(1);
  setStatus('開始解析 ' + filename + ' · ' + mb + ' MB');

  try {
    if (preferWasm) {
      try {
        await loadViaWasm(buffer, filename);
      } catch (wasmError) {
        console.warn('WASM fast path failed; falling back to full JS parser.', wasmError);
        setStatus('WASM 載入失敗，改用完整 JavaScript 解析…');
        await loadViaJs(buffer, filename);
      }
    } else {
      await loadViaJs(buffer, filename);
    }

    welcome.classList.add('hidden');
    fitBtn.disabled = false;
    exportBtn.disabled = !currentGlbBytes && !currentSceneData;
    fitCamera();
  } catch (error) {
    console.error(error);
    modeBadge.textContent = '載入失敗';
    modelInfo.textContent = '';
    setStatus('錯誤：' + (error?.message || error));
    alert('模型載入失敗：\n' + (error?.message || error));
  } finally {
    showLoading(false);
  }
}

async function getOpenSkpModule() {
  if (!openSkpModulePromise) {
    openSkpModulePromise = import(OPENSKP_ESM);
  }
  return openSkpModulePromise;
}

async function loadViaJs(buffer, filename) {
  const { parseSkp, buildScene } = await getOpenSkpModule();
  const t0 = performance.now();

  const model = parseSkp(buffer);
  const built = buildScene(buffer);
  currentSceneData = built;
  currentGlbBytes = null;

  const textureLoader = new THREE.TextureLoader();
  const getSceneTexture = index => {
    if (threeTextureCache.has(index)) return threeTextureCache.get(index);
    const source = built.textures?.[index];
    if (!source) return null;
    const blob = new Blob([source.data], { type: source.mimeType || 'image/png' });
    const url = URL.createObjectURL(blob);
    textureObjectUrls.push(url);
    const tex = textureLoader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    threeTextureCache.set(index, tex);
    return tex;
  };

  const prims = built.glbPrimitives || [];
  for (const prim of prims) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(prim.positions, 3));
    if (prim.normals?.length) geo.setAttribute('normal', new THREE.BufferAttribute(prim.normals, 3));
    if (prim.uvs?.length) geo.setAttribute('uv', new THREE.BufferAttribute(prim.uvs, 2));
    if (prim.indices?.length) geo.setIndex(new THREE.BufferAttribute(prim.indices, 1));

    let factor = [0.72, 0.74, 0.78, 1];
    let textureIndex = null;
    const gltfMat = built.gltfMaterials?.[prim.materialIndex];
    const pbr = gltfMat?.pbrMetallicRoughness;
    if (pbr?.baseColorFactor) factor = pbr.baseColorFactor;
    if (pbr?.baseColorTexture) textureIndex = pbr.baseColorTexture.index;

    const opts = {
      color: new THREE.Color(factor[0], factor[1], factor[2]),
      opacity: factor[3] ?? 1,
      transparent: (factor[3] ?? 1) < 0.999,
      metalness: pbr?.metallicFactor ?? 0.05,
      roughness: pbr?.roughnessFactor ?? 0.72,
      side: THREE.DoubleSide
    };

    if (textureIndex !== null) {
      const tex = getSceneTexture(textureIndex);
      if (tex) {
        opts.map = tex;
        opts.transparent = true;
        opts.alphaTest = 0.4;
      }
    }

    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial(opts));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.skp = built.meshIndex?.[prim.geomName] || null;
    modelRoot.add(mesh);
  }

  const elapsed = Math.round(performance.now() - t0);
  modeBadge.textContent = '完整解析';
  modelInfo.textContent = 'SKP ' + (model.version || '') + ' · ' + prims.length + ' meshes';
  setStatus('完成 · ' + filename + ' · ' + elapsed + ' ms');
}

async function getWasmModule() {
  if (!wasmModulePromise) {
    wasmModulePromise = import(OPENSKP_WASM_JS).then(async mod => {
      const factory = mod.default;
      return factory({
        locateFile: path => OPENSKP_WASM_BASE + path
      });
    });
  }
  return wasmModulePromise;
}

async function loadViaWasm(buffer, filename) {
  const t0 = performance.now();
  const Module = await getWasmModule();
  const result = Module.parseSkpToGLB(new Uint8Array(buffer));
  if (result?.error) throw new Error(result.error);
  if (!result?.glbBytes) throw new Error('WASM parser did not return GLB bytes.');

  currentSceneData = null;
  currentGlbBytes = new Uint8Array(result.glbBytes);

  const glbBuffer = currentGlbBytes.slice().buffer;
  const gltf = await new Promise((resolve, reject) => {
    new GLTFLoader().parse(glbBuffer, '', resolve, reject);
  });
  gltf.scene.traverse(obj => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => {
          if ('side' in m) m.side = THREE.DoubleSide;
        });
      }
    }
  });
  modelRoot.add(gltf.scene);

  const elapsed = Math.round(performance.now() - t0);
  modeBadge.textContent = 'WASM 快速模式';
  const componentCount = result.componentCount ?? '?';
  const faceCount = result.faceCount ?? '?';
  modelInfo.textContent = componentCount + ' components · ' + faceCount + ' faces';
  setStatus('完成 · ' + filename + ' · WASM ' + elapsed + ' ms');
}

function createWoodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#caa876';
  ctx.fillRect(0, 0, 512, 512);

  const plankH = 64;
  for (let y = 0; y < 512; y += plankH) {
    ctx.fillStyle = y % (plankH * 2) === 0 ? '#d2b181' : '#c7a373';
    ctx.fillRect(0, y, 512, plankH);

    ctx.strokeStyle = 'rgba(118, 91, 58, 0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y + 1);
    ctx.lineTo(512, y + 1);
    ctx.stroke();

    const offset = (y / plankH) % 2 === 0 ? 140 : 390;
    ctx.strokeStyle = 'rgba(130, 102, 68, 0.12)';
    ctx.beginPath();
    ctx.moveTo(offset, y);
    ctx.lineTo(offset, y + plankH);
    ctx.stroke();

    for (let i = 0; i < 7; i++) {
      const yy = y + 8 + i * 7;
      ctx.strokeStyle = 'rgba(132, 101, 63, 0.035)';
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.bezierCurveTo(140, yy - 4, 330, yy + 5, 512, yy - 2);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
}

function ensurePlanarUV(geometry, scale = 0.7) {
  if (!geometry?.attributes?.position) return;
  const pos = geometry.attributes.position;
  const uv = new Float32Array(pos.count * 2);

  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) * scale;
    uv[i * 2 + 1] = pos.getZ(i) * scale;
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function stylePhotorealMaterial(material, mesh) {
  if (!material) return;

  const name = (material.name || '').toLowerCase();
  const setColor = hex => material.color?.setHex(hex);

  material.metalness = 0.02;
  material.roughness = 0.82;

  if (name.includes('railing glass') || name.includes('玻璃 窗戶') || name.includes('translucent')) {
    setColor(0xc7d2d1);
    material.transparent = true;
    material.opacity = name.includes('railing') ? 0.32 : 0.24;
    material.roughness = 0.18;
    material.metalness = 0;
    material.depthWrite = false;
  } else if (name.includes('glass railing color')) {
    setColor(0x596361);
    material.roughness = 0.42;
    material.metalness = 0.34;
  } else if (
    name.includes('metal') ||
    name.includes('金屬') ||
    name.includes('aluminium') ||
    name.includes('steel') ||
    name.includes('shower')
  ) {
    setColor(0x4a4f4e);
    material.metalness = 0.52;
    material.roughness = 0.36;
  } else if (
    name.includes('wood') ||
    name.includes('木纹') ||
    name.includes('cherry') ||
    name.includes('1014065') ||
    name.includes('1620856')
  ) {
    setColor(0xb58b5d);
    material.metalness = 0;
    material.roughness = 0.78;

    if (name.includes('000__wood__matte')) {
      ensurePlanarUV(mesh.geometry, 0.66);
      material.map = nordicWoodTexture;
      material.color.setHex(0xc9a879);
    }
  } else if (name.includes('瓷砖 47')) {
    setColor(0xbdb7af);
    material.roughness = 0.92;
  } else if (name.includes('瓷砖')) {
    setColor(0xcec8bf);
    material.roughness = 0.88;
  } else if (
    name.includes('color m07') ||
    name.includes('color_008') ||
    name.includes('亮黑') ||
    name.includes('hua-0001')
  ) {
    setColor(0x404442);
    material.roughness = 0.62;
  } else if (name.includes('plastic') || name.includes('塑料')) {
    setColor(0xd1cbc2);
    material.roughness = 0.78;
  } else {
    setColor(0xd2ccc4);
    material.metalness = 0;
    material.roughness = 0.9;
  }

  if ('envMapIntensity' in material) material.envMapIntensity = 0.0;
  material.side = THREE.DoubleSide;
  material.needsUpdate = true;
}

function applyPhotorealStyle(root) {
  const styled = new Set();

  root.traverse(obj => {
    if (!obj.isMesh) return;

    obj.castShadow = true;
    obj.receiveShadow = true;

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.filter(Boolean).forEach(mat => {
      if (!styled.has(mat.uuid)) {
        stylePhotorealMaterial(mat, obj);
        styled.add(mat.uuid);
      } else if ((mat.name || '').toLowerCase().includes('000__wood__matte')) {
        ensurePlanarUV(obj.geometry, 0.66);
      }
    });
  });
}

function kelvinToColor(kelvin) {
  const temp = kelvin / 100;
  let r, g, b;

  if (temp <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
    b = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
    b = 255;
  }

  const clamp = value => Math.min(255, Math.max(0, value)) / 255;
  return new THREE.Color(clamp(r), clamp(g), clamp(b));
}

function addDownlight({
  x,
  z,
  ceilingY,
  targetY,
  kelvin = 3000,
  intensity = 20,
  distance = 4.4,
  angleDeg = 60,
  penumbra = 0.88,
  tiltX = 0,
  tiltZ = 0
}) {
  const light = new THREE.SpotLight(
    kelvinToColor(kelvin),
    intensity,
    distance,
    THREE.MathUtils.degToRad(angleDeg),
    penumbra,
    2
  );

  // The fixture is conceptually recessed into the hidden ceiling plane.
  // No ceiling mesh and no visible fixture geometry are drawn.
  light.position.set(x, ceilingY, z);
  light.castShadow = false;

  const target = new THREE.Object3D();
  target.position.set(x + tiltX, targetY, z + tiltZ);
  interiorLightRoot.add(target);

  light.target = target;
  interiorLightRoot.add(light);
  return light;
}

function addLinearDownlights({
  x1,
  z1,
  x2,
  z2,
  count = 3,
  ceilingY,
  targetY,
  kelvin = 3000,
  intensity = 16,
  distance = 4.2,
  angleDeg = 58,
  penumbra = 0.90
}) {
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    addDownlight({
      x: THREE.MathUtils.lerp(x1, x2, t),
      z: THREE.MathUtils.lerp(z1, z2, t),
      ceilingY,
      targetY,
      kelvin,
      intensity,
      distance,
      angleDeg,
      penumbra
    });
  }
}

function setupInteriorLighting(box) {
  while (interiorLightRoot.children.length) {
    interiorLightRoot.remove(interiorLightRoot.children[0]);
  }

  // Use the actual top of the architectural model as the hidden ceiling plane.
  // Keep the source slightly below it to avoid z-fighting with any residual top edges.
  const ceilingY = box.max.y - 0.08;
  const floorY = box.min.y;
  const targetY = floorY + 0.78;

  // ------------------------------------------------------------
  // Residential ceiling lighting plan
  // ------------------------------------------------------------

  // Living room:
  // 4 broad-beam downlights arranged around the seating zone rather than
  // one bright source in the centre. 3000K gives a warm but not yellow room.
  [
    [3.95, -4.95],
    [5.35, -4.95],
    [3.95, -3.55],
    [5.35, -3.55]
  ].forEach(([x, z]) => addDownlight({
    x, z, ceilingY, targetY,
    kelvin: 3000,
    intensity: 18,
    distance: 4.5,
    angleDeg: 62,
    penumbra: 0.92
  }));

  // Dining zone:
  // two focused but soft downlights aligned with the dining-table axis.
  addLinearDownlights({
    x1: 6.15, z1: -4.45,
    x2: 7.10, z2: -4.45,
    count: 2,
    ceilingY,
    targetY: floorY + 0.76,
    kelvin: 3000,
    intensity: 19,
    distance: 4.0,
    angleDeg: 50,
    penumbra: 0.88
  });

  // Kitchen / work surface:
  // slightly cooler light for visual accuracy on the worktop.
  addLinearDownlights({
    x1: 6.60, z1: -2.95,
    x2: 7.55, z2: -2.95,
    count: 2,
    ceilingY,
    targetY: floorY + 0.90,
    kelvin: 3500,
    intensity: 20,
    distance: 3.8,
    angleDeg: 48,
    penumbra: 0.86
  });

  // Left bedroom:
  // two low-glare warm downlights, kept away from a single harsh centre point.
  addLinearDownlights({
    x1: 1.10, z1: -3.15,
    x2: 2.20, z2: -3.15,
    count: 2,
    ceilingY,
    targetY,
    kelvin: 2800,
    intensity: 13,
    distance: 3.7,
    angleDeg: 58,
    penumbra: 0.93
  });

  // Right bedroom.
  addLinearDownlights({
    x1: 8.95, z1: -4.45,
    x2: 10.05, z2: -4.45,
    count: 2,
    ceilingY,
    targetY,
    kelvin: 2800,
    intensity: 13,
    distance: 3.7,
    angleDeg: 58,
    penumbra: 0.93
  });

  // Corridor / entrance:
  // two smaller beams create a continuous circulation path.
  addLinearDownlights({
    x1: 5.55, z1: -1.75,
    x2: 6.45, z2: -1.75,
    count: 2,
    ceilingY,
    targetY,
    kelvin: 3000,
    intensity: 10,
    distance: 3.0,
    angleDeg: 44,
    penumbra: 0.90
  });

  // Bathroom / utility:
  // 3500K for neutral skin/material rendering without going cold-blue.
  addLinearDownlights({
    x1: 8.80, z1: -1.55,
    x2: 9.55, z2: -1.55,
    count: 2,
    ceilingY,
    targetY: floorY + 1.00,
    kelvin: 3500,
    intensity: 14,
    distance: 3.0,
    angleDeg: 44,
    penumbra: 0.88
  });

  // Minimal warm bounce only. It prevents dead-black corners while preserving
  // both the NW afternoon daylight direction and the ceiling-light modelling.
  interiorLightRoot.add(
    new THREE.HemisphereLight(0xffedd8, 0x716960, 0.10)
  );
}

function updatePresentationGround(box) {
  while (stagingRoot.children.length) {
    const child = stagingRoot.children.pop();
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const extent = Math.max(size.x, size.z) * 2.2;

  // Neutral studio ground which only carries the building shadow.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(extent, extent),
    new THREE.ShadowMaterial({
      color: 0x5f574e,
      transparent: true,
      opacity: 0.20
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(center.x, box.min.y - 0.012, center.z);
  shadow.receiveShadow = true;
  stagingRoot.add(shadow);

  // Main facade (+Z in this model) is defined as geographic NW, azimuth 315 deg.
  // For the default presentation use an autumn-afternoon sun at azimuth 245 deg.
  // That means the sunlight reaches the NW facade obliquely from its left side,
  // which is consistent with a SE-sitting / NW-facing apartment.
  const relativeAzimuth = THREE.MathUtils.degToRad(
    SHOWCASE_SUN_AZIMUTH_DEG - BUILDING_FACING_AZIMUTH_DEG
  );
  const elevation = THREE.MathUtils.degToRad(SHOWCASE_SUN_ELEVATION_DEG);
  const sunDistance = maxDim * 2.8;
  const horizontal = Math.cos(elevation) * sunDistance;

  sunLight.position.set(
    center.x + Math.sin(relativeAzimuth) * horizontal,
    center.y + Math.sin(elevation) * sunDistance,
    center.z + Math.cos(relativeAzimuth) * horizontal
  );
  sunLight.target.position.set(center.x, center.y * 0.55, center.z);

  const shadowRange = maxDim * 0.9;
  sunLight.shadow.camera.left = -shadowRange;
  sunLight.shadow.camera.right = shadowRange;
  sunLight.shadow.camera.top = shadowRange;
  sunLight.shadow.camera.bottom = -shadowRange;
  sunLight.shadow.camera.near = 0.1;
  sunLight.shadow.camera.far = sunDistance * 2.2;
  sunLight.shadow.camera.updateProjectionMatrix();
}

function clearModel() {
  modelRoot.traverse(obj => {
    if (obj.isMesh) {
      obj.geometry?.dispose?.();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.filter(Boolean).forEach(mat => {
        mat.map?.dispose?.();
        mat.dispose?.();
      });
    }
  });
  while (modelRoot.children.length) modelRoot.remove(modelRoot.children[0]);
  textureObjectUrls.forEach(URL.revokeObjectURL);
  textureObjectUrls = [];
  threeTextureCache.clear();
  currentSceneData = null;
  currentGlbBytes = null;
  exportBtn.disabled = true;
  fitBtn.disabled = true;
}

function fitCamera() {
  const box = new THREE.Box3().setFromObject(modelRoot);
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = (sphere.radius / Math.sin(fov * 0.5)) * 1.08;

  // Elevated three-quarter architectural view, but with perspective depth.
  const viewDir = new THREE.Vector3(1.0, 0.78, 1.08).normalize();
  camera.position.copy(center).addScaledVector(viewDir, distance);
  camera.near = Math.max(0.02, distance / 1000);
  camera.far = distance * 10;
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.minDistance = distance * 0.35;
  controls.maxDistance = distance * 4.0;
  controls.update();

  updatePresentationGround(box);
  setupInteriorLighting(box);
}

async function downloadGlb() {
  showLoading(true, '產生 GLB…', '將目前解析結果封裝成 glTF 2.0 Binary。');
  try {
    let bytes = currentGlbBytes;
    if (!bytes && currentSceneData) {
      const { toGLB } = await getOpenSkpModule();
      bytes = toGLB(currentSceneData);
    }
    if (!bytes) throw new Error('目前沒有可匯出的 GLB。');

    const stem = currentFilename.replace(/\.skp$/i, '') || 'model';
    const blob = new Blob([bytes], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = stem + '.glb';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('GLB 已產生：' + stem + '.glb');
  } catch (error) {
    console.error(error);
    alert('GLB 匯出失敗：\n' + (error?.message || error));
  } finally {
    showLoading(false);
  }
}

function showLoading(show, title = '', detail = '') {
  loading.classList.toggle('hidden', !show);
  if (title) loadingTitle.textContent = title;
  if (detail) loadingDetail.textContent = detail;
}

function setStatus(text) {
  statusEl.textContent = text;
}

async function tryAutoLoadRepoModel() {
  showLoading(true, '載入 1004 模型…', '正在從 GitHub Pages 讀取已轉換的 Three.js 模型。');

  try {
    clearModel();

    const partCount = 15;
    const partUrls = Array.from({ length: partCount }, (_, i) =>
      './model/part-' + String(i).padStart(2, '0') + '.txt?v=20261004-ceiling-lighting-v2'
    );

    const parts = await Promise.all(partUrls.map(async (url, i) => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('模型分段 ' + i + ' 載入失敗：HTTP ' + response.status);
      }
      return (await response.text()).trim();
    }));

    const base64 = parts.join('');
    const gzipBytes = Uint8Array.from(atob(base64), ch => ch.charCodeAt(0));

    let glbBuffer;
    if ('DecompressionStream' in window) {
      const stream = new Blob([gzipBytes])
        .stream()
        .pipeThrough(new DecompressionStream('gzip'));
      glbBuffer = await new Response(stream).arrayBuffer();
    } else {
      const { gunzipSync } = await import('https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm');
      const unzipped = gunzipSync(gzipBytes);
      glbBuffer = unzipped.buffer.slice(
        unzipped.byteOffset,
        unzipped.byteOffset + unzipped.byteLength
      );
    }

    currentGlbBytes = new Uint8Array(glbBuffer);
    currentSceneData = null;
    currentFilename = '1004.skp';

    const gltf = await new Promise((resolve, reject) => {
      new GLTFLoader().parse(glbBuffer, './', resolve, reject);
    });

    let meshCount = 0;
    gltf.scene.traverse(obj => {
      if (obj.isMesh) meshCount += 1;
    });

    applyPhotorealStyle(gltf.scene);
    modelRoot.add(gltf.scene);
    welcome.classList.add('hidden');
    fitBtn.disabled = false;
    exportBtn.disabled = false;

    modeBadge.textContent = '空屋擬真 · 西北向';
    modelInfo.textContent =
      meshCount + ' meshes · ' +
      (glbBuffer.byteLength / 1048576).toFixed(2) + ' MB';
    setStatus('1004 · 空屋擬真 · 西北向午後日照 + 隱藏天花板燈光配置');
    fitCamera();
  } catch (error) {
    console.error(error);
    welcome.classList.remove('hidden');
    modeBadge.textContent = '載入失敗';
    modelInfo.textContent = '';
    setStatus('模型自動載入失敗：' + (error?.message || error));
  } finally {
    showLoading(false);
  }
}
