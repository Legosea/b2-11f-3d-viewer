import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const OPENSKP_ESM = 'https://esm.sh/openskp@1.3.0?bundle';
const OPENSKP_WASM_JS = './vendor/openskp.js';
const OPENSKP_WASM_BASE = 'https://cdn.jsdelivr.net/gh/iamahsanmehmood/openskp@python-v1.3.0/examples/web-viewer/wasm/';
const LARGE_FILE_BYTES = 50 * 1024 * 1024;

const BUILDING_FACING_AZIMUTH_DEG = 315; // 坐東南、向西北
const SHOWCASE_SUN_AZIMUTH_DEG = 245;   // 午後西南偏西日照
const SHOWCASE_SUN_ELEVATION_DEG = 30;  // 秋季午後約 30 度仰角
const SHOWCASE_TIME_LABEL = '午後 15:30';

const WASHER_STORAGE_KEY = 'b2-11f-1004.panasonic-na-v170rph-k.v2';
const WASHER_DEFAULT_STATE = Object.freeze({
  exists: true,
  x: 7.47,
  y: 0,
  z: -1.47,
  rotationY: 0
});

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
const addWasherBtn = document.getElementById('addWasherBtn');
const objectToolbar = document.getElementById('objectToolbar');
const moveObjectBtn = document.getElementById('moveObjectBtn');
const rotateObjectBtn = document.getElementById('rotateObjectBtn');
const deleteObjectBtn = document.getElementById('deleteObjectBtn');

let scene, camera, renderer, controls, modelRoot, stagingRoot, sunLight, interiorLightRoot, editableRoot, transformControls;
let nordicWoodTexture = null;
let currentSceneData = null;
let currentGlbBytes = null;
let currentFilename = '1004.skp';
let threeTextureCache = new Map();
let textureObjectUrls = [];
let openSkpModulePromise = null;
let wasmModulePromise = null;
let selectedEditable = null;
let editableMode = 'translate';
const editRaycaster = new THREE.Raycaster();
const editPointer = new THREE.Vector2();
let washerSerial = 0;
let washerSaveTimer = null;

initThree();
bindUI();
tryAutoLoadRepoModel();

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e5de);

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
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xe9e5de, 1);
  viewport.appendChild(renderer.domElement);

  // No SSAO / post-processing and no bright HDR room environment:
  // this is intentionally the stable iPhone/Safari path.
  scene.environment = null;
  RectAreaLightUniformsLib.init();

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
  scene.add(new THREE.HemisphereLight(0xf8fbff, 0xb7afa4, 0.78));
  scene.add(new THREE.AmbientLight(0xffffff, 0.10));

  // Direct sun; its actual position is set after the model bounds are known.
  sunLight = new THREE.DirectionalLight(0xffe4bb, 2.05);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.radius = 3;
  sunLight.shadow.bias = -0.00005;
  sunLight.shadow.normalBias = 0.018;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Weak cool sky bounce from the opposite side.
  const skyBounce = new THREE.DirectionalLight(0xd9e4f0, 0.26);
  skyBounce.position.set(7, 6, -9);
  scene.add(skyBounce);

  stagingRoot = new THREE.Group();
  scene.add(stagingRoot);

  modelRoot = new THREE.Group();
  scene.add(modelRoot);

  editableRoot = new THREE.Group();
  editableRoot.name = 'Editable_Objects';
  scene.add(editableRoot);

  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setSize(0.78);
  transformControls.setTranslationSnap(0.01);
  transformControls.setRotationSnap(THREE.MathUtils.degToRad(1));
  transformControls.addEventListener('dragging-changed', event => {
    controls.enabled = !event.value;
  });
  transformControls.addEventListener('objectChange', () => {
    if (!selectedEditable) return;
    selectedEditable.position.y = selectedEditable.userData.floorY ?? 0;
    if (editableMode === 'rotate') {
      selectedEditable.rotation.x = 0;
      selectedEditable.rotation.z = 0;
    }

    clearTimeout(washerSaveTimer);
    washerSaveTimer = setTimeout(() => {
      saveWasherState(selectedEditable);
    }, 160);
  });

  transformControls.addEventListener('mouseUp', () => {
    if (selectedEditable) saveWasherState(selectedEditable);
  });
  scene.add(transformControls.getHelper());

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
  addWasherBtn?.addEventListener('click', () => {
    const existing = getCurrentWasher();
    if (existing) {
      selectEditable(existing);
      setStatus('Panasonic NA-V170RPH-K 已存在 · 已選取');
      return;
    }

    const washer = restoreOrCreateWasher();
    saveWasherState(washer);
    selectEditable(washer);
  });
  moveObjectBtn?.addEventListener('click', () => setEditableMode('translate'));
  rotateObjectBtn?.addEventListener('click', () => setEditableMode('rotate'));
  deleteObjectBtn?.addEventListener('click', deleteSelectedEditable);
  renderer.domElement.addEventListener('pointerdown', handleEditablePick);
  window.addEventListener('keydown', event => {
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedEditable) {
      event.preventDefault();
      deleteSelectedEditable();
    }
    if (event.key.toLowerCase() === 'g') setEditableMode('translate');
    if (event.key.toLowerCase() === 'r') setEditableMode('rotate');
    if (event.key === 'Escape') selectEditable(null);
  });

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
      material.color.setHex(0xd1ae7b);
    }
  } else if (name.includes('瓷砖 47')) {
    setColor(0xd6d0c8);
    material.roughness = 0.92;
  } else if (name.includes('瓷砖')) {
    setColor(0xe0dad2);
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
    setColor(0xddd7cf);
    material.roughness = 0.78;
  } else {
    setColor(0xe5dfd7);
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

function readSavedWasherState() {
  try {
    const raw = localStorage.getItem(WASHER_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      exists: parsed.exists !== false,
      x: Number.isFinite(Number(parsed.x)) ? Number(parsed.x) : WASHER_DEFAULT_STATE.x,
      y: 0,
      z: Number.isFinite(Number(parsed.z)) ? Number(parsed.z) : WASHER_DEFAULT_STATE.z,
      rotationY: Number.isFinite(Number(parsed.rotationY))
        ? Number(parsed.rotationY)
        : WASHER_DEFAULT_STATE.rotationY
    };
  } catch (error) {
    console.warn('Unable to read saved washer state.', error);
    return null;
  }
}

function writeWasherState(state) {
  try {
    localStorage.setItem(WASHER_STORAGE_KEY, JSON.stringify({
      exists: state.exists !== false,
      x: Number(state.x),
      y: 0,
      z: Number(state.z),
      rotationY: Number(state.rotationY)
    }));
    return true;
  } catch (error) {
    console.warn('Unable to persist washer state.', error);
    return false;
  }
}

function saveWasherState(washer) {
  if (!washer) return false;

  const saved = writeWasherState({
    exists: true,
    x: washer.position.x,
    y: 0,
    z: washer.position.z,
    rotationY: washer.rotation.y
  });

  if (saved) {
    washer.userData.hasSavedPlacement = true;
  }
  return saved;
}

function saveWasherDeletedState() {
  const current = readSavedWasherState() || WASHER_DEFAULT_STATE;
  return writeWasherState({
    ...current,
    exists: false
  });
}

function getCurrentWasher() {
  return editableRoot?.children.find(
    child => child.userData?.label === 'Panasonic NA-V170RPH-K'
  ) || null;
}

function applyWasherState(washer, state) {
  const next = state || WASHER_DEFAULT_STATE;
  washer.position.set(next.x, 0, next.z);
  washer.rotation.set(0, next.rotationY, 0);
  washer.userData.floorY = 0;
  washer.userData.hasSavedPlacement = Boolean(state);
}

function restoreOrCreateWasher() {
  const saved = readSavedWasherState();

  if (saved?.exists === false) {
    return null;
  }

  const washer = createPanasonicWasher();
  applyWasherState(washer, saved || WASHER_DEFAULT_STATE);
  editableRoot.add(washer);

  // Store the default once so the first reload is deterministic.
  if (!saved) saveWasherState(washer);

  return washer;
}

function createPanasonicWasher() {
  // Panasonic NA-V170RPH-K / 夜幕黑
  // Official dimensions: W640 x D773 x H1035 mm.
  const width = 0.640;
  const depth = 0.773;
  const height = 1.035;

  const group = new THREE.Group();
  group.name = 'Panasonic_NA-V170RPH-K_' + (++washerSerial);
  group.userData.editable = true;
  group.userData.label = 'Panasonic NA-V170RPH-K';
  group.userData.productSize = { width, depth, height };
  group.userData.floorY = 0;

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x171819,
    metalness: 0.30,
    roughness: 0.52,
    clearcoat: 0.22,
    clearcoatRoughness: 0.38
  });
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x0d0f10,
    metalness: 0.22,
    roughness: 0.30
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x555b60,
    metalness: 0.76,
    roughness: 0.24
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x35464d,
    transparent: true,
    opacity: 0.74,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.28,
    thickness: 0.018
  });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    bodyMat
  );
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Slightly recessed front fascia.
  const fascia = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.94, height * 0.90, 0.018),
    panelMat
  );
  fascia.position.set(0, height * 0.50, depth / 2 + 0.010);
  fascia.castShadow = true;
  fascia.receiveShadow = true;
  group.add(fascia);

  // Touch-control band.
  const controlBand = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.88, 0.125, 0.024),
    panelMat
  );
  controlBand.position.set(0, height * 0.885, depth / 2 + 0.022);
  group.add(controlBand);

  const displayMat = new THREE.MeshStandardMaterial({
    color: 0x071015,
    emissive: 0x173341,
    emissiveIntensity: 0.34,
    roughness: 0.26
  });
  const display = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.26, 0.048, 0.008),
    displayMat
  );
  display.position.set(width * 0.17, height * 0.89, depth / 2 + 0.038);
  group.add(display);

  // Front loading door.
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.238, 0.238, 0.050, 64),
    trimMat
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, height * 0.47, depth / 2 + 0.034);
  ring.castShadow = true;
  ring.receiveShadow = true;
  group.add(ring);

  const doorInset = new THREE.Mesh(
    new THREE.CylinderGeometry(0.196, 0.196, 0.036, 64),
    panelMat
  );
  doorInset.rotation.x = Math.PI / 2;
  doorInset.position.set(0, height * 0.47, depth / 2 + 0.043);
  group.add(doorInset);

  const doorGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.170, 0.170, 0.018, 64),
    glassMat
  );
  doorGlass.rotation.x = Math.PI / 2;
  doorGlass.position.set(0, height * 0.47, depth / 2 + 0.052);
  doorGlass.receiveShadow = true;
  group.add(doorGlass);

  // Bottom plinth / feet.
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.92, 0.055, depth * 0.86),
    panelMat
  );
  plinth.position.set(0, 0.028, -0.015);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // Invisible hit target makes mobile selection easier.
  const pickProxy = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.03, height * 1.03, depth * 1.03),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
  );
  pickProxy.position.y = height / 2;
  pickProxy.userData.pickProxy = true;
  group.add(pickProxy);

  return group;
}

function placeWasherAtBalcony(washer) {
  // User-confirmed default placement shown in the balcony screenshot.
  // It is centred on the solid-wall bay between the two balcony windows.
  applyWasherState(washer, WASHER_DEFAULT_STATE);
}

function getEditableAncestor(object) {
  let node = object;
  while (node) {
    if (node.userData?.editable) return node;
    node = node.parent;
  }
  return null;
}

function setEditableMode(mode) {
  editableMode = mode;
  transformControls.setMode(mode);

  if (mode === 'translate') {
    transformControls.showX = true;
    transformControls.showY = false;
    transformControls.showZ = true;
  } else {
    transformControls.showX = false;
    transformControls.showY = true;
    transformControls.showZ = false;
  }

  moveObjectBtn?.classList.toggle('active', mode === 'translate');
  rotateObjectBtn?.classList.toggle('active', mode === 'rotate');
}

function selectEditable(object) {
  selectedEditable = object;

  if (object) {
    transformControls.attach(object);
    setEditableMode(editableMode);
    objectToolbar?.classList.remove('hidden');
    setStatus('已選取 Panasonic NA-V170RPH-K · 可移動 / 旋轉 / 刪除');
  } else {
    transformControls.detach();
    objectToolbar?.classList.add('hidden');
  }
}

function deleteSelectedEditable() {
  if (!selectedEditable) return;

  const doomed = selectedEditable;
  transformControls.detach();
  selectedEditable = null;
  doomed.removeFromParent();
  saveWasherDeletedState();

  objectToolbar?.classList.add('hidden');
  setStatus('Panasonic NA-V170RPH-K 已刪除並記憶 · 可按「洗衣機」重新加入');
}

function handleEditablePick(event) {
  if (transformControls.dragging) return;

  const rect = renderer.domElement.getBoundingClientRect();
  editPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  editPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  editRaycaster.setFromCamera(editPointer, camera);
  const hits = editRaycaster.intersectObjects(editableRoot.children, true);

  if (hits.length) {
    const picked = getEditableAncestor(hits[0].object);
    if (picked) {
      selectEditable(picked);
      return;
    }
  }

  selectEditable(null);
}

function replaceLivingRoomW3(root) {
  // W3 construction drawing:
  // overall 268 x 190 cm, sill 50 cm above FL
  // columns 79 / 110 / 79 cm
  // rows 80 cm lower / 110 cm upper
  //
  // The converted GLB currently contains a 270.18 cm wide W3 with incorrect
  // mullion proportions. Hide only those original W3 meshes and rebuild the
  // frame in Three.js at the same architectural opening.

  const oldW3MeshNames = new Set([
    'n113__24_g0',
    'n114__25_g0',
    'n115__23_g0',
    'n117__24_g0',
    'n118__25_g0',
    'n119__23_g0',
    'n120__28_g0',
    'n121__22_g0',
    'n122__21_g0',
    'n123__27_g0'
  ]);

  root.traverse(obj => {
    if (obj.isMesh && oldW3MeshNames.has(obj.name)) {
      obj.visible = false;
    }
  });

  const group = new THREE.Group();
  group.name = 'W3_LivingRoom_268x190';
  group.userData.windowSchedule = {
    id: 'W3',
    overallWidthM: 2.68,
    overallHeightM: 1.90,
    sillHeightM: 0.50,
    columnsM: [0.79, 1.10, 0.79],
    rowsM: [0.80, 1.10]
  };

  // Existing opening centre measured from the converted model.
  const centerX = 4.553215;
  const centerZ = -0.5722;
  const sillY = 0.50;
  const width = 2.68;
  const height = 1.90;
  const leftX = centerX - width / 2;
  const rightX = centerX + width / 2;
  const bottomY = sillY;
  const topY = sillY + height;

  const splitX1 = leftX + 0.79;
  const splitX2 = splitX1 + 1.10;
  const splitY = bottomY + 0.80;

  const outerBar = 0.052;
  const mullionBar = 0.046;
  const frameDepth = 0.10;
  const glassDepth = 0.006;

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1f2322,
    metalness: 0.68,
    roughness: 0.28
  });

  const sashMat = new THREE.MeshStandardMaterial({
    color: 0x121515,
    metalness: 0.72,
    roughness: 0.24
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xaebfc2,
    transparent: true,
    opacity: 0.34,
    roughness: 0.08,
    metalness: 0,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  function addFrameBar(w, h, x, y, depth = frameDepth, barWidthMaterial = frameMat) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, depth),
      barWidthMaterial
    );
    mesh.position.set(x, y, centerZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function addGlass(x0, x1, y0, y1) {
    const pad = 0.012;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(0.01, x1 - x0 - pad * 2),
        Math.max(0.01, y1 - y0 - pad * 2),
        glassDepth
      ),
      glassMat
    );
    mesh.position.set(
      (x0 + x1) / 2,
      (y0 + y1) / 2,
      centerZ + 0.006
    );
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    group.add(mesh);
    return mesh;
  }

  // Outer perimeter: dimensions remain exactly 268 x 190 cm.
  addFrameBar(width, outerBar, centerX, bottomY + outerBar / 2);
  addFrameBar(width, outerBar, centerX, topY - outerBar / 2);
  addFrameBar(outerBar, height - outerBar * 2, leftX + outerBar / 2, (bottomY + topY) / 2);
  addFrameBar(outerBar, height - outerBar * 2, rightX - outerBar / 2, (bottomY + topY) / 2);

  // 79 / 110 / 79 cm vertical divisions.
  addFrameBar(mullionBar, height - outerBar * 2, splitX1, (bottomY + topY) / 2);
  addFrameBar(mullionBar, height - outerBar * 2, splitX2, (bottomY + topY) / 2);

  // 80 / 110 cm horizontal division.
  addFrameBar(width - outerBar * 2, mullionBar, centerX, splitY);

  // Fixed glazing: lower row all FIX; upper centre FIX.
  const colBounds = [
    [leftX + outerBar, splitX1 - mullionBar / 2],
    [splitX1 + mullionBar / 2, splitX2 - mullionBar / 2],
    [splitX2 + mullionBar / 2, rightX - outerBar]
  ];

  const lowerY0 = bottomY + outerBar;
  const lowerY1 = splitY - mullionBar / 2;
  const upperY0 = splitY + mullionBar / 2;
  const upperY1 = topY - outerBar;

  colBounds.forEach(([x0, x1]) => addGlass(x0, x1, lowerY0, lowerY1));
  addGlass(colBounds[1][0], colBounds[1][1], upperY0, upperY1);

  // Upper left and right are operable black-aluminum sashes.
  // The previous version left too much transparent reveal around the sash,
  // which made the window look like an empty opening. Here the sash nearly
  // fills its framed cell and the glass sits clearly inside the black profile.
  function addOperableSash(x0, x1) {
    // No visible reveal. The sash overlaps the cell perimeter slightly so the
    // facade reads as one continuous black aluminum assembly.
    const overlap = 0.012;
    const sashBar = 0.070;
    const glazingBead = 0.018;
    const sashDepth = 0.128;
    const sashZ = centerZ + 0.028;

    const sx0 = x0 - overlap;
    const sx1 = x1 + overlap;
    const sy0 = upperY0 - overlap;
    const sy1 = upperY1 + overlap;

    function addSashBar(w, h, x, y, depth = sashDepth) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, depth),
        sashMat
      );
      mesh.position.set(x, y, sashZ);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    }

    // Full black sash perimeter. These bars deliberately cover the previous
    // white/translucent installation gap.
    addSashBar(sx1 - sx0, sashBar, (sx0 + sx1) / 2, sy0 + sashBar / 2);
    addSashBar(sx1 - sx0, sashBar, (sx0 + sx1) / 2, sy1 - sashBar / 2);
    addSashBar(sashBar, sy1 - sy0 - sashBar * 2, sx0 + sashBar / 2, (sy0 + sy1) / 2);
    addSashBar(sashBar, sy1 - sy0 - sashBar * 2, sx1 - sashBar / 2, (sy0 + sy1) / 2);

    // Glass exists only inside the black sash.
    const gx0 = sx0 + sashBar;
    const gx1 = sx1 - sashBar;
    const gy0 = sy0 + sashBar;
    const gy1 = sy1 - sashBar;

    const glassPad = 0.006;
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(0.01, gx1 - gx0 - glassPad * 2),
        Math.max(0.01, gy1 - gy0 - glassPad * 2),
        glassDepth
      ),
      glassMat
    );
    glass.position.set(
      (gx0 + gx1) / 2,
      (gy0 + gy1) / 2,
      sashZ + 0.010
    );
    glass.castShadow = false;
    glass.receiveShadow = true;
    glass.renderOrder = 2;
    group.add(glass);

    // Inner black glazing bead, also placed forward with the sash.
    addSashBar(gx1 - gx0, glazingBead, (gx0 + gx1) / 2, gy0 + glazingBead / 2, 0.098);
    addSashBar(gx1 - gx0, glazingBead, (gx0 + gx1) / 2, gy1 - glazingBead / 2, 0.098);
    addSashBar(glazingBead, gy1 - gy0 - glazingBead * 2, gx0 + glazingBead / 2, (gy0 + gy1) / 2, 0.098);
    addSashBar(glazingBead, gy1 - gy0 - glazingBead * 2, gx1 - glazingBead / 2, (gy0 + gy1) / 2, 0.098);
  }

  addOperableSash(colBounds[0][0], colBounds[0][1]);
  addOperableSash(colBounds[2][0], colBounds[2][1]);

  return group;
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

function addCeilingAreaLight({
  x,
  z,
  ceilingY,
  targetY,
  width,
  depth,
  kelvin = 3000,
  intensity = 5
}) {
  const light = new THREE.RectAreaLight(
    kelvinToColor(kelvin),
    intensity,
    width,
    depth
  );

  light.position.set(x, ceilingY, z);
  light.lookAt(x, targetY, z);
  interiorLightRoot.add(light);
  return light;
}

function addSoftDownlight({
  x,
  z,
  ceilingY,
  targetY,
  kelvin = 3000,
  intensity = 4.5,
  distance = 3.6,
  angleDeg = 72
}) {
  const light = new THREE.SpotLight(
    kelvinToColor(kelvin),
    intensity,
    distance,
    THREE.MathUtils.degToRad(angleDeg),
    1.0,
    2
  );

  light.position.set(x, ceilingY, z);
  light.castShadow = false;

  const target = new THREE.Object3D();
  target.position.set(x, targetY, z);
  interiorLightRoot.add(target);
  light.target = target;
  interiorLightRoot.add(light);

  return light;
}

function setupInteriorLighting(box) {
  while (interiorLightRoot.children.length) {
    interiorLightRoot.remove(interiorLightRoot.children[0]);
  }

  const ceilingY = box.max.y - 0.10;
  const floorY = box.min.y;
  const targetY = floorY + 0.85;

  // ------------------------------------------------------------
  // Hidden ceiling lighting concept
  // ------------------------------------------------------------
  // The ceiling itself is intentionally not rendered. Instead, broad
  // RectAreaLights occupy the room centres and behave like reflected
  // ceiling light / diffuse recessed lighting. This avoids the theatrical
  // scallops that narrow SpotLights produced on the walls.

  // Living room: broad warm ceiling field.
  addCeilingAreaLight({
    x: 4.65, z: -4.25,
    ceilingY, targetY,
    width: 2.85, depth: 2.35,
    kelvin: 3000,
    intensity: 6.2
  });

  // Dining zone.
  addCeilingAreaLight({
    x: 6.62, z: -4.42,
    ceilingY, targetY: floorY + 0.82,
    width: 1.55, depth: 1.25,
    kelvin: 3000,
    intensity: 5.3
  });

  // Kitchen / work zone: a little more neutral and brighter.
  addCeilingAreaLight({
    x: 7.05, z: -2.92,
    ceilingY, targetY: floorY + 0.95,
    width: 1.55, depth: 1.05,
    kelvin: 3500,
    intensity: 6.2
  });

  // Left bedroom.
  addCeilingAreaLight({
    x: 1.63, z: -3.10,
    ceilingY, targetY,
    width: 1.85, depth: 1.65,
    kelvin: 2900,
    intensity: 4.4
  });

  // Right bedroom.
  addCeilingAreaLight({
    x: 9.45, z: -4.38,
    ceilingY, targetY,
    width: 1.85, depth: 1.65,
    kelvin: 2900,
    intensity: 4.4
  });

  // Corridor / entrance.
  addCeilingAreaLight({
    x: 5.95, z: -1.78,
    ceilingY, targetY,
    width: 1.35, depth: 0.72,
    kelvin: 3000,
    intensity: 3.5
  });

  // Bathroom / utility.
  addCeilingAreaLight({
    x: 9.12, z: -1.52,
    ceilingY, targetY: floorY + 1.00,
    width: 1.20, depth: 0.95,
    kelvin: 3500,
    intensity: 4.7
  });

  // A very small number of broad, weak downlights are used only to add
  // vertical modelling. They are deliberately kept away from walls so
  // there are no isolated bright circles.
  addSoftDownlight({
    x: 4.65, z: -4.18,
    ceilingY, targetY,
    kelvin: 3000,
    intensity: 3.6,
    distance: 3.8,
    angleDeg: 76
  });

  addSoftDownlight({
    x: 6.75, z: -3.72,
    ceilingY, targetY,
    kelvin: 3200,
    intensity: 3.0,
    distance: 3.5,
    angleDeg: 78
  });

  // Soft warm interreflection so the room does not collapse into dark corners.
  interiorLightRoot.add(
    new THREE.HemisphereLight(0xfff0df, 0x9a9287, 0.24)
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
  if (transformControls) transformControls.detach();
  selectedEditable = null;
  if (objectToolbar) objectToolbar.classList.add('hidden');
  if (editableRoot) {
    editableRoot.traverse(obj => {
      if (obj.isMesh) {
        obj.geometry?.dispose?.();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.filter(Boolean).forEach(mat => mat.dispose?.());
      }
    });
    while (editableRoot.children.length) editableRoot.remove(editableRoot.children[0]);
  }

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
      './model/part-' + String(i).padStart(2, '0') + '.txt?v=20261004-panasonic-washer-persist-v2'
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
    const correctedW3 = replaceLivingRoomW3(gltf.scene);
    modelRoot.add(gltf.scene);
    modelRoot.add(correctedW3);

    const washer = createPanasonicWasher();
    placeWasherAtBalcony(washer);
    editableRoot.add(washer);

    welcome.classList.add('hidden');
    fitBtn.disabled = false;
    exportBtn.disabled = false;

    modeBadge.textContent = '空屋擬真 · 西北向';
    modelInfo.textContent =
      meshCount + ' meshes · ' +
      (glbBuffer.byteLength / 1048576).toFixed(2) + ' MB';
    if (washer) {
      setStatus(
        washer.userData.hasSavedPlacement
          ? '1004 · Panasonic 洗衣機已還原上次位置 · 可移動 / 旋轉 / 刪除'
          : '1004 · Panasonic 洗衣機已放置預設位置 · 可移動 / 旋轉 / 刪除'
      );
    } else {
      setStatus('1004 · 洗衣機目前為已刪除狀態 · 按「洗衣機」可重新加入');
    }
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
