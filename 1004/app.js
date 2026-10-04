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
  rotationY: 0,
  variant: 'black'
});

const ROOM_ANGLE_SNAP_STEP = THREE.MathUtils.degToRad(90);
const ROOM_ANGLE_MAGNET_THRESHOLD = THREE.MathUtils.degToRad(8);
const ROOM_ANGLE_RELEASE_THRESHOLD = THREE.MathUtils.degToRad(15);

const MATERIAL_STORAGE_KEY = 'b2-11f-1004.material-library.v1';

const COMPONENT_LIBRARY = Object.freeze({
  appliances: [
    {
      id: 'panasonic-na-v170rph',
      brand: 'Panasonic',
      model: 'NA-V170RPH',
      label: 'Panasonic NA-V170RPH',
      variants: ['black', 'white']
    },
    {
      id: 'panasonic-nr-f601wx',
      brand: 'Panasonic',
      model: 'NR-F601WX',
      label: 'Panasonic NR-F601WX',
      variants: ['x1-diamond-black', 's1-mist-gray', 'w1-jade-white']
    }
  ],
  kitchens: [
    {
      id: 'cleanup-centro-207',
      brand: 'Cleanup',
      model: 'CENTRO',
      label: 'Cleanup CENTRO 一字型 207 cm',
      variants: ['ar8-raster-silver', 'cpb-wood', 'ak6-stainless']
    }
  ],
  furniture: []
});

const WASHER_VARIANTS = Object.freeze({
  black: {
    label: '夜幕黑',
    body: 0x171819,
    fascia: 0x131516,
    control: 0x0b0d0e,
    darkDetail: 0x111314,
    trim: 0x555b60
  },
  white: {
    label: '冰鑽白',
    body: 0xe9e9e5,
    fascia: 0xe4e4df,
    control: 0x25282a,
    darkDetail: 0x222426,
    trim: 0x9da2a4
  }
});

const MATERIAL_PRESETS = Object.freeze({
  floor: {
    'light-oak': {
      label: '淺橡木', color: 0xf5e3c3, roughness: 0.80, useTexture: true,
      wood: ['#efd9b3','#e5c897','#c9a56f','#a77e4d']
    },
    'natural-oak': {
      label: '自然橡木', color: 0xe2c28e, roughness: 0.78, useTexture: true,
      wood: ['#d8b77f','#cda66e','#ae8150','#825b36']
    },
    'warm-oak': {
      label: '暖橡木', color: 0xc8945e, roughness: 0.78, useTexture: true,
      wood: ['#bd8550','#a96d3d','#8a542f','#673a22']
    },
    'walnut': {
      label: '胡桃木', color: 0x77533d, roughness: 0.76, useTexture: true,
      wood: ['#79533d','#65422f','#4c3023','#2f1d17']
    }
  },
  roomDoor: {
    'matte-white': { label: '霧白', color: 0xe8e3db, roughness: 0.82, useTexture: false },
    'light-oak': {
      label: '淺橡木', color: 0xe0c393, roughness: 0.78, useTexture: true,
      wood: ['#ddbf8e','#cfaa72','#b78954','#8d633b']
    },
    'natural-wood': {
      label: '自然木', color: 0xb78353, roughness: 0.78, useTexture: true,
      wood: ['#bf8b57','#a96f41','#88502e','#60351f']
    },
    'walnut': {
      label: '胡桃木', color: 0x6d4937, roughness: 0.76, useTexture: true,
      wood: ['#78513a','#603e2d','#452b20','#2d1a15']
    },
    'warm-gray': { label: '暖灰', color: 0x91897f, roughness: 0.84, useTexture: false }
  }
});

const MATERIAL_DEFAULT_STATE = Object.freeze({
  floor: 'natural-oak',
  roomDoor: 'natural-wood'
});

const KITCHEN_STORAGE_KEY = 'b2-11f-1004.cleanup-centro.v1';
const FRIDGE_STORAGE_KEY = 'b2-11f-1004.panasonic-nr-f601wx.v1';
const LEGACY_FRIDGE_STORAGE_KEY = 'b2-11f-1004.panasonic-nr-f601wx.v1';

const KITCHEN_DEFAULT_STATE = Object.freeze({
  exists: true,
  x: 5.755,
  y: 0,
  z: -5.845,
  rotationY: 0,
  variant: 'ar8-raster-silver',
  countertop: 'e-coat-stainless'
});

const FRIDGE_DEFAULT_STATE = Object.freeze({
  exists: true,
  x: 7.20,
  y: 0,
  z: -5.83,
  rotationY: 0,
  variant: 'w1-jade-white'
});

const CENTRO_VARIANTS = Object.freeze({
  'ar8-raster-silver': {
    label: 'AR8 光柵銀',
    color: 0xaeb2b4,
    metalness: 0.42,
    roughness: 0.40,
    texture: null
  },
  'cpb-wood': {
    label: 'CPB 木紋',
    color: 0xffffff,
    metalness: 0.02,
    roughness: 0.72,
    texture: 'natural-wood'
  },
  'ak6-stainless': {
    label: 'AK6 銀白不鏽鋼',
    color: 0xc4c7c7,
    metalness: 0.68,
    roughness: 0.32,
    texture: null
  }
});

const CENTRO_COUNTERTOP_VARIANTS = Object.freeze({
  'e-coat-stainless': {
    label: 'e-coat 不鏽鋼',
    color: 0xb6bbbd,
    metalness: 0.72,
    roughness: 0.30,
    stone: null
  },
  'white-stone': {
    label: '白色石紋',
    color: 0xe7e4de,
    metalness: 0.02,
    roughness: 0.38,
    stone: ['#ebe8e2','#d8d3cb','#c5bfb6']
  },
  'greige-stone': {
    label: '暖灰石紋',
    color: 0xb8afa4,
    metalness: 0.02,
    roughness: 0.40,
    stone: ['#c7beb2','#aaa095','#8f857b']
  },
  'charcoal-stone': {
    label: '深灰石紋',
    color: 0x555653,
    metalness: 0.02,
    roughness: 0.42,
    stone: ['#62635f','#4b4c49','#343532']
  }
});

const FRIDGE_VARIANTS = Object.freeze({
  'x1-diamond-black': {
    label: '鑽石黑 X1',
    color: 0x17191a,
    seam: 0x4b4d4e,
    metalness: 0.30,
    roughness: 0.20
  },
  's1-mist-gray': {
    label: '雲霧灰 S1',
    color: 0xa9abad,
    seam: 0x777a7c,
    metalness: 0.24,
    roughness: 0.24
  },
  'w1-jade-white': {
    label: '翡翠白 W1',
    color: 0xf0efeb,
    seam: 0xbebdb8,
    metalness: 0.10,
    roughness: 0.22
  }
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
const libraryBtn = document.getElementById('libraryBtn');
const topViewBtn = document.getElementById('topViewBtn');
const frontViewBtn = document.getElementById('frontViewBtn');
const sideViewBtn = document.getElementById('sideViewBtn');
const componentLibraryEl = document.getElementById('componentLibrary');
const libraryBackdrop = document.getElementById('libraryBackdrop');
const closeLibraryBtn = document.getElementById('closeLibraryBtn');
const libraryTabButtons = [...document.querySelectorAll('[data-library-tab]')];
const librarySections = [...document.querySelectorAll('[data-library-section]')];
const washerVariantButtons = [...document.querySelectorAll('[data-washer-variant]')];
const materialPresetButtons = [...document.querySelectorAll('[data-material-scope][data-material-preset]')];
const addFridgeBtn = document.getElementById('addFridgeBtn');
const fridgeVariantButtons = [...document.querySelectorAll('[data-fridge-variant]')];
const addKitchenBtn = document.getElementById('addKitchenBtn');
const kitchenVariantButtons = [...document.querySelectorAll('[data-kitchen-variant]')];
const kitchenCountertopButtons = [...document.querySelectorAll('[data-kitchen-countertop]')];

let scene, camera, renderer, controls, modelRoot, stagingRoot, sunLight, interiorLightRoot, editableRoot, transformControls;
let nordicWoodTexture = null;
const woodTextureCache = new Map();
const surfaceTextureCache = new Map();
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
const materialTargets = {
  floor: new Set(),
  roomDoor: new Set()
};

const WALL_COLLISION_CLEARANCE = 0.012; // 12 mm furniture-to-wall safety gap
const WALL_SWEEP_STEP = 0.02;           // 20 mm swept-movement sampling
let wallColliders = [];
const collisionBoxA = new THREE.Box3();
const collisionBoxB = new THREE.Box3();
const collisionSize = new THREE.Vector3();

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
  transformControls.setRotationSnap(null);
  transformControls.addEventListener('dragging-changed', event => {
    controls.enabled = !event.value;

    if (event.value && selectedEditable) {
      // Snapshot the last legal transform before a drag begins.
      selectedEditable.userData.lastCollisionSafePosition =
        selectedEditable.position.clone();
      selectedEditable.userData.lastCollisionSafeRotationY =
        selectedEditable.rotation.y;
    }
  });
  transformControls.addEventListener('objectChange', () => {
    if (!selectedEditable) return;

    selectedEditable.position.y = selectedEditable.userData.floorY ?? 0;

    if (editableMode === 'translate') {
      resolveEditableWallCollision(selectedEditable);
    } else if (editableMode === 'rotate') {
      selectedEditable.rotation.x = 0;
      selectedEditable.rotation.z = 0;
      applyRoomAngleMagnet(selectedEditable, false);
      resolveEditableRotationCollision(selectedEditable);
    }

    clearTimeout(washerSaveTimer);
    washerSaveTimer = setTimeout(() => {
      saveEditableState(selectedEditable);
    }, 160);
  });

  transformControls.addEventListener('mouseUp', () => {
    if (!selectedEditable) return;

    if (editableMode === 'rotate') {
      applyRoomAngleMagnet(selectedEditable, true);
      resolveEditableRotationCollision(selectedEditable);
    } else {
      resolveEditableWallCollision(selectedEditable);
    }

    rememberEditableCollisionSafeState(selectedEditable);
    saveEditableState(selectedEditable);
  });
  scene.add(transformControls.getHelper());

  interiorLightRoot = new THREE.Group();
  interiorLightRoot.name = 'Interior_Lighting';
  scene.add(interiorLightRoot);

  nordicWoodTexture = getWoodTexture('natural-oak', 'floor');

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
  fileInput?.addEventListener('change', e => pickFile(e.target.files?.[0]));
  welcomeFileInput?.addEventListener('change', e => pickFile(e.target.files?.[0]));
  fitBtn.addEventListener('click', fitCamera);
  exportBtn?.addEventListener('click', downloadGlb);
  topViewBtn?.addEventListener('click', () => setStandardView('top'));
  frontViewBtn?.addEventListener('click', () => setStandardView('front'));
  sideViewBtn?.addEventListener('click', () => setStandardView('side'));
  addWasherBtn?.addEventListener('click', () => {
    const existing = getCurrentWasher();
    if (existing) {
      selectEditable(existing);
      setStatus('Panasonic NA-V170RPH-K 已存在 · 已選取');
      return;
    }

    const saved = readSavedWasherState();
    const washer = createPanasonicWasher();

    // If the object had previously been deleted, explicitly adding it again
    // restores its last remembered transform instead of losing that placement.
    if (saved) {
      applyWasherState(washer, {
        ...saved,
        exists: true
      });
    } else {
      placeWasherAtBalcony(washer);
    }

    editableRoot.add(washer);
    saveWasherState(washer);
    selectEditable(washer);
  });
  moveObjectBtn?.addEventListener('click', () => setEditableMode('translate'));
  rotateObjectBtn?.addEventListener('click', () => setEditableMode('rotate'));
  deleteObjectBtn?.addEventListener('click', deleteSelectedEditable);

  libraryBtn?.addEventListener('click', () => setLibraryOpen(true));
  closeLibraryBtn?.addEventListener('click', () => setLibraryOpen(false));
  libraryBackdrop?.addEventListener('click', () => setLibraryOpen(false));

  libraryTabButtons.forEach(button => {
    button.addEventListener('click', () => setLibraryTab(button.dataset.libraryTab));
  });

  washerVariantButtons.forEach(button => {
    button.addEventListener('click', () => {
      setWasherVariantFromLibrary(button.dataset.washerVariant);
    });
  });

  fridgeVariantButtons.forEach(button => {
    button.addEventListener('click', () => {
      setFridgeVariantFromLibrary(button.dataset.fridgeVariant);
    });
  });

  kitchenVariantButtons.forEach(button => {
    button.addEventListener('click', () => {
      setKitchenVariantFromLibrary(button.dataset.kitchenVariant);
    });
  });

  kitchenCountertopButtons.forEach(button => {
    button.addEventListener('click', () => {
      setKitchenCountertopFromLibrary(button.dataset.kitchenCountertop);
    });
  });

  addFridgeBtn?.addEventListener('click', () => {
    const existing = getCurrentFridge();
    if (existing) {
      selectEditable(existing);
      setStatus('Panasonic NR-F601WX 已存在 · 已選取');
      return;
    }

    const saved = readSavedFridgeState();
    const fridge = createPanasonicFridge();

    if (saved) {
      applyFridgeState(fridge, { ...saved, exists: true });
    } else {
      applyFridgeState(fridge, FRIDGE_DEFAULT_STATE);
    }

    editableRoot.add(fridge);
    saveFridgeState(fridge);
    selectEditable(fridge);
    syncLibraryUI();
  });

  addKitchenBtn?.addEventListener('click', () => {
    const existing = getCurrentKitchen();
    if (existing) {
      selectEditable(existing);
      setStatus('Cleanup CENTRO 已存在 · 已選取，可移動 / 旋轉 / 刪除');
      return;
    }

    const saved = readKitchenState();
    const kitchen = createCentroKitchen();
    applyKitchenState(kitchen, saved ? { ...saved, exists: true } : KITCHEN_DEFAULT_STATE);
    editableRoot.add(kitchen);
    saveKitchenState(kitchen);
    selectEditable(kitchen);
    syncLibraryUI();
    setStatus('Cleanup CENTRO 已放回並選取 · 可移動 / 旋轉 / 刪除');
  });

  materialPresetButtons.forEach(button => {
    button.addEventListener('click', () => {
      applyMaterialPreset(
        button.dataset.materialScope,
        button.dataset.materialPreset,
        true
      );
    });
  });

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
    if (exportBtn) exportBtn.disabled = !currentGlbBytes && !currentSceneData;
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

  rebuildWallColliders();

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
  rebuildWallColliders();

  const elapsed = Math.round(performance.now() - t0);
  modeBadge.textContent = 'WASM 快速模式';
  const componentCount = result.componentCount ?? '?';
  const faceCount = result.faceCount ?? '?';
  modelInfo.textContent = componentCount + ' components · ' + faceCount + ' faces';
  setStatus('完成 · ' + filename + ' · WASM ' + elapsed + ' ms');
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createWoodTexture(presetId = 'natural-oak', scope = 'floor') {
  const preset =
    MATERIAL_PRESETS[scope]?.[presetId] ||
    MATERIAL_PRESETS.floor['natural-oak'];

  const palette = preset.wood || ['#d8b77f','#cda66e','#ae8150','#825b36'];
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const random = seededRandom(hashString(scope + ':' + presetId));

  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, 512, 512);

  if (scope === 'floor') {
    const plankH = 64;

    for (let y = 0; y < 512; y += plankH) {
      const plankIndex = Math.floor(y / plankH);
      const baseIndex = plankIndex % 2;
      ctx.fillStyle = baseIndex ? palette[1] : palette[0];
      ctx.fillRect(0, y, 512, plankH);

      // Board joints: staggered like real engineered wood flooring.
      const jointOffset = plankIndex % 2 === 0 ? 152 : 374;
      ctx.strokeStyle = 'rgba(48,31,18,.22)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(jointOffset, y);
      ctx.lineTo(jointOffset, y + plankH);
      ctx.stroke();

      // Plank seam.
      ctx.strokeStyle = 'rgba(54,36,20,.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.7);
      ctx.lineTo(512, y + 0.7);
      ctx.stroke();

      // Long, irregular timber grain.
      for (let g = 0; g < 14; g++) {
        const yy = y + 5 + random() * (plankH - 10);
        const amp = 2 + random() * 5;
        const phase = random() * Math.PI * 2;
        ctx.strokeStyle = g % 4 === 0
          ? 'rgba(70,43,23,.15)'
          : 'rgba(86,55,29,.075)';
        ctx.lineWidth = g % 5 === 0 ? 1.3 : 0.8;
        ctx.beginPath();
        ctx.moveTo(0, yy);
        for (let x = 0; x <= 512; x += 32) {
          const gy = yy +
            Math.sin(x * 0.020 + phase) * amp +
            Math.sin(x * 0.057 + phase * 0.7) * amp * 0.35;
          ctx.lineTo(x, gy);
        }
        ctx.stroke();
      }

      // A few knots per board.
      if (random() > 0.35) {
        const knotX = 60 + random() * 390;
        const knotY = y + 15 + random() * 34;
        const knotR = 4 + random() * 6;

        ctx.strokeStyle = 'rgba(67,39,21,.22)';
        ctx.lineWidth = 1.2;
        for (let ring = 1; ring <= 3; ring++) {
          ctx.beginPath();
          ctx.ellipse(
            knotX,
            knotY,
            knotR * ring,
            knotR * 0.45 * ring,
            random() * 0.25,
            0,
            Math.PI * 2
          );
          ctx.stroke();
        }
      }
    }
  } else {
    // Door veneer: long vertical grain, no flooring plank joints.
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, 512, 512);

    for (let g = 0; g < 44; g++) {
      const xx = 4 + random() * 504;
      const amp = 1.5 + random() * 5;
      const phase = random() * Math.PI * 2;
      ctx.strokeStyle = g % 6 === 0
        ? 'rgba(63,38,21,.18)'
        : 'rgba(78,48,25,.075)';
      ctx.lineWidth = g % 7 === 0 ? 1.4 : 0.8;
      ctx.beginPath();
      ctx.moveTo(xx, 0);
      for (let y = 0; y <= 512; y += 28) {
        ctx.lineTo(xx + Math.sin(y * 0.023 + phase) * amp, y);
      }
      ctx.stroke();
    }
  }

  // Gentle translucent glaze keeps the palette coherent.
  const glaze = ctx.createLinearGradient(0, 0, 512, 512);
  glaze.addColorStop(0, 'rgba(255,255,255,.10)');
  glaze.addColorStop(0.55, 'rgba(255,255,255,0)');
  glaze.addColorStop(1, 'rgba(55,30,15,.06)');
  ctx.fillStyle = glaze;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.repeat.set(scope === 'floor' ? 1.15 : 1.0, scope === 'floor' ? 1.15 : 1.0);
  texture.needsUpdate = true;
  return texture;
}

function getWoodTexture(presetId, scope = 'floor') {
  const key = scope + ':' + presetId;
  if (!woodTextureCache.has(key)) {
    woodTextureCache.set(key, createWoodTexture(presetId, scope));
  }
  return woodTextureCache.get(key);
}

function createStoneTexture(presetId) {
  const preset = CENTRO_COUNTERTOP_VARIANTS[presetId];
  if (!preset?.stone) return null;

  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');
  const random = seededRandom(hashString('countertop:' + presetId));

  ctx.fillStyle = '#' + preset.color.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const colors = preset.stone;

  // Fine mineral variation.
  for (let i = 0; i < 1800; i++) {
    const alpha = 0.015 + random() * 0.055;
    ctx.fillStyle = colors[Math.floor(random() * colors.length)];
    ctx.globalAlpha = alpha;
    const r = 0.4 + random() * 1.8;
    ctx.beginPath();
    ctx.arc(random() * 384, random() * 384, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // A few soft veins — deliberately restrained so it still reads as a
  // premium architectural countertop rather than marble wallpaper.
  ctx.globalAlpha = 1;
  for (let v = 0; v < 6; v++) {
    const y0 = 30 + random() * 320;
    const phase = random() * Math.PI * 2;
    ctx.strokeStyle = presetId === 'charcoal-stone'
      ? 'rgba(220,220,215,.10)'
      : 'rgba(92,86,78,.10)';
    ctx.lineWidth = 0.8 + random() * 1.4;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    for (let x = 0; x <= 384; x += 24) {
      ctx.lineTo(
        x,
        y0 + Math.sin(x * 0.020 + phase) * (5 + random() * 4)
      );
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.8, 1.0);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
}

function getCountertopTexture(presetId) {
  if (!surfaceTextureCache.has(presetId)) {
    surfaceTextureCache.set(presetId, createStoneTexture(presetId));
  }
  return surfaceTextureCache.get(presetId);
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

  materialTargets.floor.clear();
  materialTargets.roomDoor.clear();

  root.traverse(obj => {
    if (!obj.isMesh) return;

    obj.castShadow = true;
    obj.receiveShadow = true;

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.filter(Boolean).forEach(mat => {
      const materialName = (mat.name || '').toLowerCase();

      if (materialName === '000__wood__matte') {
        registerMaterialTarget('floor', mat);
      }
      if (materialName.includes('木纹1')) {
        registerMaterialTarget('roomDoor', mat);
      }

      if (!styled.has(mat.uuid)) {
        stylePhotorealMaterial(mat, obj);
        styled.add(mat.uuid);
      } else if ((mat.name || '').toLowerCase().includes('000__wood__matte')) {
        ensurePlanarUV(obj.geometry, 0.66);
      }
    });
  });

  applySavedMaterialSelections();
}

function setLibraryOpen(open) {
  componentLibraryEl?.classList.toggle('hidden', !open);
  libraryBackdrop?.classList.toggle('hidden', !open);
  if (open) syncLibraryUI();
}

function setLibraryTab(tab) {
  libraryTabButtons.forEach(button => {
    button.classList.toggle('active', button.dataset.libraryTab === tab);
  });
  librarySections.forEach(section => {
    section.classList.toggle('hidden', section.dataset.librarySection !== tab);
  });
}

function syncLibraryUI() {
  const washer = getCurrentWasher();
  const savedWasher = readSavedWasherState();
  const variant = washer?.userData?.variant || savedWasher?.variant || 'black';

  washerVariantButtons.forEach(button => {
    button.classList.toggle('selected', button.dataset.washerVariant === variant);
  });

  const fridge = getCurrentFridge();
  const savedFridge = readSavedFridgeState();
  const fridgeVariant = fridge?.userData?.variant || savedFridge?.variant || FRIDGE_DEFAULT_STATE.variant;

  fridgeVariantButtons.forEach(button => {
    button.classList.toggle('selected', button.dataset.fridgeVariant === fridgeVariant);
  });

  const kitchen = getCurrentKitchen();
  const savedKitchen = readKitchenState();
  const kitchenVariant = kitchen?.userData?.variant || savedKitchen?.variant || KITCHEN_DEFAULT_STATE.variant;

  kitchenVariantButtons.forEach(button => {
    button.classList.toggle('selected', button.dataset.kitchenVariant === kitchenVariant);
  });

  const kitchenCountertop =
    kitchen?.userData?.countertop ||
    savedKitchen?.countertop ||
    KITCHEN_DEFAULT_STATE.countertop;

  kitchenCountertopButtons.forEach(button => {
    button.classList.toggle(
      'selected',
      button.dataset.kitchenCountertop === kitchenCountertop
    );
  });

  const materialState = readMaterialState();
  materialPresetButtons.forEach(button => {
    const scope = button.dataset.materialScope;
    const preset = button.dataset.materialPreset;
    button.classList.toggle('selected', materialState[scope] === preset);
  });
}

function readMaterialState() {
  try {
    const raw = localStorage.getItem(MATERIAL_STORAGE_KEY);
    if (!raw) return { ...MATERIAL_DEFAULT_STATE };
    const parsed = JSON.parse(raw) || {};
    return {
      floor: MATERIAL_PRESETS.floor[parsed.floor]
        ? parsed.floor
        : MATERIAL_DEFAULT_STATE.floor,
      roomDoor: MATERIAL_PRESETS.roomDoor[parsed.roomDoor]
        ? parsed.roomDoor
        : MATERIAL_DEFAULT_STATE.roomDoor
    };
  } catch (error) {
    console.warn('Unable to read material library state.', error);
    return { ...MATERIAL_DEFAULT_STATE };
  }
}

function writeMaterialState(state) {
  try {
    localStorage.setItem(MATERIAL_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn('Unable to persist material library state.', error);
    return false;
  }
}

function registerMaterialTarget(scope, material) {
  if (!materialTargets[scope] || !material) return;

  if (material.userData.libraryOriginalMap === undefined) {
    material.userData.libraryOriginalMap = material.map || null;
  }
  materialTargets[scope].add(material);
}

function applyMaterialPreset(scope, presetId, save = true) {
  const preset = MATERIAL_PRESETS[scope]?.[presetId];
  if (!preset) return false;

  materialTargets[scope]?.forEach(material => {
    material.roughness = preset.roughness;
    material.metalness = 0;

    if (preset.useTexture) {
      material.map = getWoodTexture(presetId, scope);
      material.color?.setHex(0xffffff);
    } else {
      material.map = null;
      material.color?.setHex(preset.color);
    }

    material.needsUpdate = true;
  });

  if (save) {
    const state = readMaterialState();
    state[scope] = presetId;
    writeMaterialState(state);
  }

  syncLibraryUI();

  const scopeLabel = scope === 'floor' ? '木地板' : '房間門片';
  setStatus(scopeLabel + '已切換：' + preset.label + ' · 已自動記憶');
  return true;
}

function applySavedMaterialSelections() {
  const state = readMaterialState();
  applyMaterialPreset('floor', state.floor, false);
  applyMaterialPreset('roomDoor', state.roomDoor, false);
}

function applyWasherVariant(washer, variantId, save = true) {
  if (!washer) return false;

  const variant = WASHER_VARIANTS[variantId] || WASHER_VARIANTS.black;
  const mats = washer._variantMaterials;
  if (!mats) return false;

  mats.body.color.setHex(variant.body);
  mats.fascia.color.setHex(variant.fascia);
  mats.control.color.setHex(variant.control);
  mats.darkDetail.color.setHex(variant.darkDetail);
  mats.trim.color.setHex(variant.trim);

  Object.values(mats).forEach(material => {
    material.needsUpdate = true;
  });

  washer.userData.variant = WASHER_VARIANTS[variantId] ? variantId : 'black';

  if (save) saveWasherState(washer);
  syncLibraryUI();
  return true;
}

function setWasherVariantFromLibrary(variantId) {
  let washer = getCurrentWasher();

  if (!washer) {
    const saved = readSavedWasherState();
    washer = createPanasonicWasher();

    if (saved) {
      applyWasherState(washer, { ...saved, exists: true, variant: variantId });
    } else {
      placeWasherAtBalcony(washer);
    }

    editableRoot.add(washer);
  }

  applyWasherVariant(washer, variantId, true);
  selectEditable(washer);

  setStatus(
    'Panasonic NA-V170RPH · ' +
    WASHER_VARIANTS[variantId].label +
    ' · 已套用並記憶'
  );
}

function readKitchenState() {
  try {
    const raw = localStorage.getItem(KITCHEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      exists: parsed.exists !== false,
      x: Number.isFinite(Number(parsed.x)) ? Number(parsed.x) : KITCHEN_DEFAULT_STATE.x,
      y: 0,
      z: Number.isFinite(Number(parsed.z)) ? Number(parsed.z) : KITCHEN_DEFAULT_STATE.z,
      rotationY: Number.isFinite(Number(parsed.rotationY))
        ? Number(parsed.rotationY)
        : KITCHEN_DEFAULT_STATE.rotationY,
      variant: CENTRO_VARIANTS[parsed.variant]
        ? parsed.variant
        : KITCHEN_DEFAULT_STATE.variant,
      countertop: CENTRO_COUNTERTOP_VARIANTS[parsed.countertop]
        ? parsed.countertop
        : KITCHEN_DEFAULT_STATE.countertop
    };
  } catch (error) {
    console.warn('Unable to read CENTRO state.', error);
    return null;
  }
}

function writeKitchenState(state) {
  try {
    localStorage.setItem(KITCHEN_STORAGE_KEY, JSON.stringify({
      exists: state.exists !== false,
      x: Number(state.x),
      y: 0,
      z: Number(state.z),
      rotationY: Number(state.rotationY),
      variant: CENTRO_VARIANTS[state.variant]
        ? state.variant
        : KITCHEN_DEFAULT_STATE.variant,
      countertop: CENTRO_COUNTERTOP_VARIANTS[state.countertop]
        ? state.countertop
        : KITCHEN_DEFAULT_STATE.countertop
    }));
    return true;
  } catch (error) {
    console.warn('Unable to persist CENTRO state.', error);
    return false;
  }
}

function saveKitchenState(kitchen) {
  if (!kitchen) return false;

  const saved = writeKitchenState({
    exists: true,
    x: kitchen.position.x,
    y: 0,
    z: kitchen.position.z,
    rotationY: kitchen.rotation.y,
    variant: kitchen.userData.variant || KITCHEN_DEFAULT_STATE.variant,
    countertop: kitchen.userData.countertop || KITCHEN_DEFAULT_STATE.countertop
  });

  if (saved) kitchen.userData.hasSavedPlacement = true;
  return saved;
}

function saveKitchenDeletedState() {
  const current = readKitchenState() || KITCHEN_DEFAULT_STATE;
  return writeKitchenState({ ...current, exists: false });
}

function getCurrentKitchen() {
  return editableRoot?.children.find(
    child => child.userData?.componentId === 'cleanup-centro-207'
  ) || null;
}

function applyKitchenState(kitchen, state) {
  const next = state || KITCHEN_DEFAULT_STATE;

  kitchen.position.set(next.x, 0, next.z);
  kitchen.rotation.set(0, next.rotationY, 0);
  kitchen.userData.floorY = 0;
  kitchen.userData.hasSavedPlacement = Boolean(state);

  applyKitchenVariant(
    kitchen,
    next.variant || KITCHEN_DEFAULT_STATE.variant,
    false
  );
  applyKitchenCountertop(
    kitchen,
    next.countertop || KITCHEN_DEFAULT_STATE.countertop,
    false
  );
}

function restoreOrCreateKitchen() {
  const saved = readKitchenState();
  if (saved?.exists === false) return null;

  const kitchen = createCentroKitchen();
  applyKitchenState(kitchen, saved || KITCHEN_DEFAULT_STATE);
  editableRoot.add(kitchen);

  if (!saved) saveKitchenState(kitchen);
  return kitchen;
}

function readSavedFridgeState() {
  try {
    let raw = localStorage.getItem(FRIDGE_STORAGE_KEY);

    // One-time migration from the previous NR-F601WX component so the user's
    // carefully adjusted position and rotation do not disappear.
    let migratedFromLegacy = false;
    if (!raw) {
      raw = localStorage.getItem(LEGACY_FRIDGE_STORAGE_KEY);
      migratedFromLegacy = Boolean(raw);
    }

    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const legacyVariantMap = {
      's1-silver': 's1-mist-gray',
      'c1-beige-gray': 's1-mist-gray',
      'w1-frost-white': 'w1-jade-white'
    };

    const variant =
      FRIDGE_VARIANTS[parsed.variant]
        ? parsed.variant
        : legacyVariantMap[parsed.variant] || FRIDGE_DEFAULT_STATE.variant;

    const state = {
      exists: parsed.exists !== false,
      x: Number.isFinite(Number(parsed.x)) ? Number(parsed.x) : FRIDGE_DEFAULT_STATE.x,
      y: 0,
      z: Number.isFinite(Number(parsed.z)) ? Number(parsed.z) : FRIDGE_DEFAULT_STATE.z,
      rotationY: Number.isFinite(Number(parsed.rotationY))
        ? Number(parsed.rotationY)
        : FRIDGE_DEFAULT_STATE.rotationY,
      variant
    };

    if (migratedFromLegacy) {
      localStorage.setItem(FRIDGE_STORAGE_KEY, JSON.stringify(state));
    }

    return state;
  } catch (error) {
    console.warn('Unable to read fridge state.', error);
    return null;
  }
}

function writeFridgeState(state) {
  try {
    localStorage.setItem(FRIDGE_STORAGE_KEY, JSON.stringify({
      exists: state.exists !== false,
      x: Number(state.x),
      y: 0,
      z: Number(state.z),
      rotationY: Number(state.rotationY),
      variant: FRIDGE_VARIANTS[state.variant]
        ? state.variant
        : FRIDGE_DEFAULT_STATE.variant
    }));
    return true;
  } catch (error) {
    console.warn('Unable to persist fridge state.', error);
    return false;
  }
}

function saveFridgeState(fridge) {
  if (!fridge) return false;
  return writeFridgeState({
    exists: true,
    x: fridge.position.x,
    y: 0,
    z: fridge.position.z,
    rotationY: fridge.rotation.y,
    variant: fridge.userData.variant || FRIDGE_DEFAULT_STATE.variant
  });
}

function saveFridgeDeletedState() {
  const current = readSavedFridgeState() || FRIDGE_DEFAULT_STATE;
  return writeFridgeState({ ...current, exists: false });
}

function getCurrentFridge() {
  return editableRoot?.children.find(
    child => child.userData?.componentId === 'panasonic-nr-f601wx'
  ) || null;
}

function applyFridgeState(fridge, state) {
  const next = state || FRIDGE_DEFAULT_STATE;
  fridge.position.set(next.x, 0, next.z);
  fridge.rotation.set(0, next.rotationY, 0);
  fridge.userData.floorY = 0;
  fridge.userData.hasSavedPlacement = Boolean(state);
  applyFridgeVariant(fridge, next.variant || FRIDGE_DEFAULT_STATE.variant, false);
}

function restoreOrCreateFridge() {
  const saved = readSavedFridgeState();
  if (saved?.exists === false) return null;

  const fridge = createPanasonicFridge();
  applyFridgeState(fridge, saved || FRIDGE_DEFAULT_STATE);
  editableRoot.add(fridge);

  if (!saved) saveFridgeState(fridge);
  return fridge;
}

function rebuildWallColliders() {
  wallColliders = [];

  modelRoot.updateWorldMatrix(true, true);

  modelRoot.traverse(object => {
    if (!object.isMesh || !object.visible || !object.geometry) return;

    // Generated architectural corrections can stay collidable, but anything
    // explicitly marked non-collidable is ignored.
    if (object.userData?.ignoreWallCollision) return;

    collisionBoxA.setFromObject(object);
    if (collisionBoxA.isEmpty()) return;

    collisionBoxA.getSize(collisionSize);

    const height = collisionSize.y;
    const width = collisionSize.x;
    const depth = collisionSize.z;

    // Wall heuristic:
    // - residential full-height element
    // - thin in X or Z
    // - meaningful run length in the other horizontal axis
    //
    // This excludes flooring, countertops, sanitary fixtures, etc., while
    // keeping the apartment partitions / exterior wall planes.
    const tallEnough = height >= 1.35;
    const xWall = width <= 0.42 && depth >= 0.38;
    const zWall = depth <= 0.42 && width >= 0.38;

    if (!tallEnough || !(xWall || zWall)) return;

    wallColliders.push({
      box: collisionBoxA.clone(),
      name: object.name || 'wall'
    });
  });

  console.info('[collision] wall colliders:', wallColliders.length);
}

function getEditableCollisionBox(object, target = new THREE.Box3()) {
  target.makeEmpty();
  if (!object) return target;

  object.updateWorldMatrix(true, true);

  object.traverse(child => {
    if (
      !child.isMesh ||
      !child.visible ||
      child.userData?.pickProxy ||
      !child.geometry
    ) return;

    if (!child.geometry.boundingBox) {
      child.geometry.computeBoundingBox();
    }

    if (!child.geometry.boundingBox) return;

    collisionBoxB
      .copy(child.geometry.boundingBox)
      .applyMatrix4(child.matrixWorld);

    target.union(collisionBoxB);
  });

  return target;
}

function editableIntersectsWall(object) {
  if (!object || !wallColliders.length) return false;

  const objectBox = getEditableCollisionBox(object, collisionBoxA);
  if (objectBox.isEmpty()) return false;

  for (const collider of wallColliders) {
    const wall = collider.box;

    // Vertical overlap is required so furniture on one floor cannot collide
    // with unrelated geometry above/below.
    const overlapsY =
      objectBox.max.y > wall.min.y + 0.02 &&
      objectBox.min.y < wall.max.y - 0.02;

    if (!overlapsY) continue;

    // Inflate only the wall footprint by a small real-world clearance.
    const overlapsX =
      objectBox.max.x > wall.min.x - WALL_COLLISION_CLEARANCE &&
      objectBox.min.x < wall.max.x + WALL_COLLISION_CLEARANCE;

    const overlapsZ =
      objectBox.max.z > wall.min.z - WALL_COLLISION_CLEARANCE &&
      objectBox.min.z < wall.max.z + WALL_COLLISION_CLEARANCE;

    if (overlapsX && overlapsZ) return true;
  }

  return false;
}

function rememberEditableCollisionSafeState(object) {
  if (!object) return;

  object.userData.lastCollisionSafePosition = object.position.clone();
  object.userData.lastCollisionSafeRotationY = object.rotation.y;
}

function sweepEditableAxis(object, axis, startValue, endValue) {
  const delta = endValue - startValue;
  if (Math.abs(delta) < 1e-7) return startValue;

  const steps = Math.max(
    1,
    Math.ceil(Math.abs(delta) / WALL_SWEEP_STEP)
  );

  let accepted = startValue;

  for (let i = 1; i <= steps; i++) {
    const candidate = THREE.MathUtils.lerp(
      startValue,
      endValue,
      i / steps
    );

    object.position[axis] = candidate;
    object.updateMatrixWorld(true);

    if (editableIntersectsWall(object)) {
      object.position[axis] = accepted;
      object.updateMatrixWorld(true);
      return accepted;
    }

    accepted = candidate;
  }

  return accepted;
}

function resolveEditableWallCollision(object) {
  if (!object || !wallColliders.length) return false;

  const proposedX = object.position.x;
  const proposedZ = object.position.z;

  const safe =
    object.userData.lastCollisionSafePosition?.clone() ||
    object.position.clone();

  // If a legacy saved position was already illegal, keep the current state
  // rather than violently jumping the object. The next legal movement will
  // establish a fresh safe point.
  object.position.set(
    safe.x,
    object.userData.floorY ?? safe.y,
    safe.z
  );
  object.updateMatrixWorld(true);

  const safeWasColliding = editableIntersectsWall(object);
  if (safeWasColliding) {
    object.position.set(
      proposedX,
      object.userData.floorY ?? 0,
      proposedZ
    );
    object.updateMatrixWorld(true);

    if (!editableIntersectsWall(object)) {
      rememberEditableCollisionSafeState(object);
      return false;
    }

    return true;
  }

  // Resolve X then Z independently. This intentionally allows the object to
  // slide along a wall when the user drags diagonally into it.
  const resolvedX = sweepEditableAxis(
    object,
    'x',
    safe.x,
    proposedX
  );
  object.position.x = resolvedX;

  const resolvedZ = sweepEditableAxis(
    object,
    'z',
    safe.z,
    proposedZ
  );
  object.position.z = resolvedZ;

  object.position.y = object.userData.floorY ?? 0;
  object.updateMatrixWorld(true);

  const blocked =
    Math.abs(resolvedX - proposedX) > 0.0005 ||
    Math.abs(resolvedZ - proposedZ) > 0.0005;

  rememberEditableCollisionSafeState(object);

  if (blocked) {
    setStatus(
      (object.userData?.label || '元件') +
      ' · 已碰到牆面，停止於牆前'
    );
  }

  return blocked;
}

function resolveEditableRotationCollision(object) {
  if (!object || !wallColliders.length) return false;

  object.updateMatrixWorld(true);

  if (!editableIntersectsWall(object)) {
    object.userData.lastCollisionSafeRotationY = object.rotation.y;
    return false;
  }

  const safeRotation =
    Number.isFinite(object.userData.lastCollisionSafeRotationY)
      ? object.userData.lastCollisionSafeRotationY
      : 0;

  object.rotation.y = safeRotation;
  object.updateMatrixWorld(true);

  setStatus(
    (object.userData?.label || '元件') +
    ' · 旋轉會碰到牆面，已退回安全角度'
  );

  return true;
}

function normalizeRadians(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function getNearestRoomAngle(angle, offset = 0) {
  const local = normalizeRadians(angle - offset);
  const snappedLocal = Math.round(local / ROOM_ANGLE_SNAP_STEP) * ROOM_ANGLE_SNAP_STEP;
  return normalizeRadians(snappedLocal + offset);
}

function getAngularDistance(a, b) {
  return Math.abs(normalizeRadians(a - b));
}

function applyRoomAngleMagnet(object, onRelease = false) {
  if (!object) return false;

  // Objects can override their modelling-axis offset later if imported assets
  // do not use +Z as their visual front.
  const offset = Number(object.userData?.snapAngleOffset) || 0;
  const current = normalizeRadians(object.rotation.y);
  const nearest = getNearestRoomAngle(current, offset);
  const threshold = onRelease
    ? ROOM_ANGLE_RELEASE_THRESHOLD
    : ROOM_ANGLE_MAGNET_THRESHOLD;

  if (getAngularDistance(current, nearest) <= threshold) {
    object.rotation.y = nearest;
    object.userData.angleSnapped = true;
    return true;
  }

  object.userData.angleSnapped = false;
  return false;
}

function saveEditableState(object) {
  if (!object) return false;

  if (object.userData?.componentId === 'panasonic-na-v170rph') {
    return saveWasherState(object);
  }

  if (object.userData?.componentId === 'panasonic-nr-f601wx') {
    return saveFridgeState(object);
  }

  if (object.userData?.componentId === 'cleanup-centro-207') {
    return saveKitchenState(object);
  }

  return false;
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
        : WASHER_DEFAULT_STATE.rotationY,
      variant: WASHER_VARIANTS[parsed.variant]
        ? parsed.variant
        : WASHER_DEFAULT_STATE.variant
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
      rotationY: Number(state.rotationY),
      variant: WASHER_VARIANTS[state.variant] ? state.variant : 'black'
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
    rotationY: washer.rotation.y,
    variant: washer.userData.variant || 'black'
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
  applyWasherVariant(washer, next.variant || 'black', false);
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

function createCentroKitchen() {
  // 207 cm straight Cleanup CENTRO run.
  // Geometry is centred on the group origin so move/rotation controls feel natural.
  const width = 2.07;
  const depth = 0.65;
  const baseHeight = 0.86;
  const counterThickness = 0.035;
  const wallCabinetDepth = 0.35;
  const wallCabinetHeight = 0.62;

  const group = new THREE.Group();
  group.name = 'Cleanup_CENTRO_207';
  group.userData.editable = true;
  group.userData.componentId = 'cleanup-centro-207';
  group.userData.label = 'Cleanup CENTRO 一字型 207 cm';
  group.userData.variant = KITCHEN_DEFAULT_STATE.variant;
  group.userData.countertop = KITCHEN_DEFAULT_STATE.countertop;
  group.userData.floorY = 0;
  group.userData.snapAngleOffset = 0;

  const assembly = new THREE.Group();
  assembly.name = 'CENTRO_Assembly';
  assembly.position.set(-width / 2, 0, -depth / 2);
  group.add(assembly);

  const cabinetMat = new THREE.MeshStandardMaterial({
    color: 0xaeb2b4,
    metalness: 0.42,
    roughness: 0.40
  });

  const counterMat = new THREE.MeshStandardMaterial({
    color: 0xb6bbbd,
    metalness: 0.72,
    roughness: 0.30
  });

  const stainlessMat = new THREE.MeshStandardMaterial({
    color: 0xa8afb2,
    metalness: 0.78,
    roughness: 0.28
  });

  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x2a2b2b,
    metalness: 0.20,
    roughness: 0.38
  });

  const backsplashMat = new THREE.MeshStandardMaterial({
    color: 0xdedbd5,
    metalness: 0.02,
    roughness: 0.58
  });

  function addBox(w, h, d, x, y, z, material, name='') {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    assembly.add(mesh);
    return mesh;
  }

  // Base cabinet and toe kick.
  addBox(width, baseHeight, depth, width/2, baseHeight/2, depth/2, cabinetMat, 'CENTRO_base');
  addBox(width - 0.04, 0.08, 0.05, width/2, 0.04, depth + 0.005, darkMat, 'CENTRO_toekick');

  const moduleW = width / 3;

  // Drawer fronts / hidden handle detail.
  for (let i = 0; i < 3; i++) {
    const cx = moduleW * i + moduleW / 2;

    [0.18, 0.42, 0.68].forEach((cy, row) => {
      const h = row === 0 ? 0.16 : 0.22;
      addBox(
        moduleW - 0.018,
        h,
        0.018,
        cx,
        cy,
        depth + 0.012,
        cabinetMat,
        'CENTRO_drawer'
      );
    });

    addBox(
      moduleW - 0.035,
      0.010,
      0.010,
      cx,
      0.785,
      depth + 0.026,
      darkMat,
      'CENTRO_handle'
    );
  }

  // Countertop: material can be selected independently from cabinet fronts.
  addBox(
    width + 0.035,
    counterThickness,
    depth + 0.035,
    width/2,
    baseHeight + counterThickness/2,
    depth/2 + 0.012,
    counterMat,
    'CENTRO_countertop'
  );

  // Backsplash.
  addBox(
    width,
    0.58,
    0.018,
    width/2,
    1.18,
    0.012,
    backsplashMat,
    'CENTRO_backsplash'
  );

  // IH cooktop.
  addBox(
    moduleW * 0.72,
    0.018,
    0.46,
    moduleW * 0.50,
    baseHeight + counterThickness + 0.012,
    depth * 0.52,
    darkMat,
    'CENTRO_induction'
  );

  [moduleW*0.36, moduleW*0.64].forEach(px => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.095, 0.006, 10, 40),
      new THREE.MeshStandardMaterial({
        color: 0x686b6b,
        metalness: 0.35,
        roughness: 0.42
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(px, baseHeight + counterThickness + 0.024, depth * 0.52);
    assembly.add(ring);
  });

  // Sink.
  const sinkX = moduleW * 2.5;
  addBox(
    moduleW * 0.68,
    0.025,
    0.42,
    sinkX,
    baseHeight + counterThickness + 0.008,
    depth * 0.52,
    stainlessMat,
    'CENTRO_sink'
  );

  addBox(
    moduleW * 0.55,
    0.035,
    0.31,
    sinkX,
    baseHeight + counterThickness + 0.018,
    depth * 0.52,
    new THREE.MeshStandardMaterial({
      color: 0x777e80,
      metalness: 0.72,
      roughness: 0.34
    }),
    'CENTRO_sink_bowl'
  );

  // Faucet.
  const faucetStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.30, 20),
    stainlessMat
  );
  faucetStem.position.set(
    sinkX + moduleW * 0.22,
    baseHeight + 0.18,
    depth * 0.30
  );
  assembly.add(faucetStem);

  const faucetSpout = new THREE.Mesh(
    new THREE.TorusGeometry(0.10, 0.014, 10, 32, Math.PI),
    stainlessMat
  );
  faucetSpout.rotation.z = Math.PI / 2;
  faucetSpout.position.set(
    sinkX + moduleW * 0.22,
    baseHeight + 0.32,
    depth * 0.36
  );
  assembly.add(faucetSpout);

  // Upper cabinets and range hood.
  const upperY = 1.88;
  addBox(
    moduleW - 0.015,
    wallCabinetHeight,
    wallCabinetDepth,
    moduleW * 1.5,
    upperY,
    wallCabinetDepth/2,
    cabinetMat,
    'CENTRO_upper'
  );
  addBox(
    moduleW - 0.015,
    wallCabinetHeight,
    wallCabinetDepth,
    moduleW * 2.5,
    upperY,
    wallCabinetDepth/2,
    cabinetMat,
    'CENTRO_upper'
  );

  addBox(
    moduleW * 0.82,
    0.16,
    0.45,
    moduleW * 0.5,
    1.73,
    0.25,
    darkMat,
    'CENTRO_hood'
  );

  // Under-cabinet task light.
  const stripMat = new THREE.MeshStandardMaterial({
    color: 0xfff4df,
    emissive: 0xffe3b8,
    emissiveIntensity: 0.72,
    roughness: 0.45
  });
  addBox(
    width * 0.62,
    0.016,
    0.03,
    width * 0.69,
    1.57,
    0.35,
    stripMat,
    'CENTRO_underlight'
  );

  // Large invisible pick target for mobile selection.
  const pickProxy = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.02, 2.25, depth * 1.10),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );
  pickProxy.position.set(0, 1.12, 0);
  pickProxy.userData.pickProxy = true;
  group.add(pickProxy);

  group._variantMaterials = {
    cabinet: cabinetMat,
    countertop: counterMat
  };

  applyKitchenVariant(group, KITCHEN_DEFAULT_STATE.variant, false);
  applyKitchenCountertop(group, KITCHEN_DEFAULT_STATE.countertop, false);
  return group;
}

function applyKitchenVariant(kitchen, variantId, save = true) {
  if (!kitchen) return false;

  const variant = CENTRO_VARIANTS[variantId] || CENTRO_VARIANTS[KITCHEN_DEFAULT_STATE.variant];
  const mat = kitchen._variantMaterials?.cabinet;
  if (!mat) return false;

  mat.metalness = variant.metalness;
  mat.roughness = variant.roughness;

  if (variant.texture) {
    mat.map = getWoodTexture(variant.texture, 'roomDoor');
    mat.color.setHex(0xffffff);
  } else {
    mat.map = null;
    mat.color.setHex(variant.color);
  }

  mat.needsUpdate = true;
  kitchen.userData.variant = CENTRO_VARIANTS[variantId]
    ? variantId
    : KITCHEN_DEFAULT_STATE.variant;

  if (save) {
    saveKitchenState(kitchen);
  }

  syncLibraryUI();
  return true;
}

function applyKitchenCountertop(kitchen, countertopId, save = true) {
  if (!kitchen) return false;

  const preset =
    CENTRO_COUNTERTOP_VARIANTS[countertopId] ||
    CENTRO_COUNTERTOP_VARIANTS[KITCHEN_DEFAULT_STATE.countertop];

  const mat = kitchen._variantMaterials?.countertop;
  if (!mat) return false;

  mat.metalness = preset.metalness;
  mat.roughness = preset.roughness;

  if (preset.stone) {
    mat.map = getCountertopTexture(countertopId);
    mat.color.setHex(0xffffff);
  } else {
    mat.map = null;
    mat.color.setHex(preset.color);
  }

  mat.needsUpdate = true;
  kitchen.userData.countertop = CENTRO_COUNTERTOP_VARIANTS[countertopId]
    ? countertopId
    : KITCHEN_DEFAULT_STATE.countertop;

  if (save) {
    saveKitchenState(kitchen);
  }

  syncLibraryUI();
  return true;
}

function setKitchenVariantFromLibrary(variantId) {
  let kitchen = getCurrentKitchen();

  if (!kitchen) {
    const saved = readKitchenState();
    kitchen = createCentroKitchen();
    applyKitchenState(kitchen, saved || KITCHEN_DEFAULT_STATE);
    editableRoot.add(kitchen);
  }

  applyKitchenVariant(kitchen, variantId, true);
  selectEditable(kitchen);
  setStatus('Cleanup CENTRO 門板 · ' + CENTRO_VARIANTS[variantId].label + ' · 已套用並記憶');
}

function setKitchenCountertopFromLibrary(countertopId) {
  let kitchen = getCurrentKitchen();

  if (!kitchen) {
    const saved = readKitchenState();
    kitchen = createCentroKitchen();
    applyKitchenState(kitchen, saved || KITCHEN_DEFAULT_STATE);
    editableRoot.add(kitchen);
  }

  applyKitchenCountertop(kitchen, countertopId, true);
  selectEditable(kitchen);
  setStatus(
    'Cleanup CENTRO 檯面 · ' +
    CENTRO_COUNTERTOP_VARIANTS[countertopId].label +
    ' · 已套用並記憶'
  );
}

function createPanasonicFridge() {
  // Panasonic NR-F601WX official overall size:
  // W685 x D745 x H1828 mm, effective volume 600 L.
  // Frameless glass / mirror six-door proportions:
  // 2 upper doors + 2 shallow middle drawers + 2 full-width lower drawers.
  const width = 0.685;
  const depth = 0.745;
  const height = 1.828;

  const group = new THREE.Group();
  group.name = 'Panasonic_NR-F601WX';
  group.userData.editable = true;
  group.userData.componentId = 'panasonic-nr-f601wx';
  group.userData.label = 'Panasonic NR-F601WX';
  group.userData.variant = FRIDGE_DEFAULT_STATE.variant;
  group.userData.floorY = 0;
  group.userData.snapAngleOffset = 0;

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xf0efeb,
    metalness: 0.10,
    roughness: 0.22,
    clearcoat: 0.34,
    clearcoatRoughness: 0.16
  });

  // Light, subtle seams — no heavy black framework.
  const seamMat = new THREE.MeshStandardMaterial({
    color: 0x777b7d,
    metalness: 0.18,
    roughness: 0.52
  });

  const displayMat = new THREE.MeshStandardMaterial({
    color: 0x5e6669,
    emissive: 0x25363c,
    emissiveIntensity: 0.10,
    roughness: 0.36
  });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    bodyMat
  );
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const frontZ = depth / 2 + 0.010;
  const edge = 0.010;
  const seam = 0.0025;

  function addPanel(w, h, x, y, name) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.012),
      bodyMat
    );
    panel.position.set(x, y, frontZ);
    panel.castShadow = true;
    panel.receiveShadow = true;
    panel.name = name;
    group.add(panel);
    return panel;
  }

  function addHSeam(y) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(width - edge*2, seam, 0.010),
      seamMat
    );
    line.position.set(0, y, frontZ + 0.009);
    group.add(line);
  }

  function addVSeam(x, y, h) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(seam, h, 0.010),
      seamMat
    );
    line.position.set(x, y, frontZ + 0.009);
    group.add(line);
  }

  // Vertical zoning from bottom to top.
  const bottomH = 0.43;
  const lowerH = 0.36;
  const shallowH = 0.18;
  const gapTotal = 0.04;
  const upperH = height - bottomH - lowerH - shallowH - gapTotal;

  const bottomY = bottomH / 2 + edge;
  const lowerY = bottomH + lowerH / 2 + edge + 0.010;
  const shallowY = bottomH + lowerH + shallowH / 2 + edge + 0.020;
  const upperY = height - upperH / 2 - edge;

  // Upper doors are asymmetrical like the reference photo.
  const leftRatio = 0.36;
  const leftW = width * leftRatio - seam/2 - edge;
  const rightW = width - leftW - seam - edge*2;

  const leftX = -width/2 + edge + leftW/2;
  const rightX = width/2 - edge - rightW/2;
  const upperSplitX = -width/2 + edge + leftW + seam/2;

  addPanel(leftW, upperH, leftX, upperY, 'Fridge_upper_left');
  addPanel(rightW, upperH, rightX, upperY, 'Fridge_upper_right');
  addVSeam(upperSplitX, upperY, upperH - edge);

  // Two shallow middle drawers.
  const halfW = (width - edge*2 - seam) / 2;
  addPanel(halfW, shallowH, -halfW/2 - seam/2, shallowY, 'Fridge_shallow_left');
  addPanel(halfW, shallowH,  halfW/2 + seam/2, shallowY, 'Fridge_shallow_right');
  addVSeam(0, shallowY, shallowH - edge);

  // Lower two drawers are each full-width.
  addPanel(width - edge*2, lowerH, 0, lowerY, 'Fridge_lower_full');
  addPanel(width - edge*2, bottomH - edge, 0, bottomY, 'Fridge_bottom_full');

  const y1 = bottomH + 0.015;
  const y2 = bottomH + lowerH + 0.020;
  const y3 = bottomH + lowerH + shallowH + 0.025;
  addHSeam(y1);
  addHSeam(y2);
  addHSeam(y3);

  // Small, restrained touch indicator on upper-right door.
  const display = new THREE.Mesh(
    new THREE.BoxGeometry(0.020, 0.055, 0.006),
    displayMat
  );
  display.position.set(width*0.18, upperY - upperH*0.18, frontZ + 0.015);
  group.add(display);

  // Subtle brand mark near top right, represented as a light metallic dash.
  const brandMark = new THREE.Mesh(
    new THREE.BoxGeometry(0.070, 0.008, 0.004),
    new THREE.MeshStandardMaterial({
      color: 0x9fa2a1,
      metalness: 0.40,
      roughness: 0.38
    })
  );
  brandMark.position.set(width*0.29, height - 0.070, frontZ + 0.014);
  group.add(brandMark);

  const pickProxy = new THREE.Mesh(
    new THREE.BoxGeometry(width*1.03, height*1.02, depth*1.03),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );
  pickProxy.position.y = height/2;
  pickProxy.userData.pickProxy = true;
  group.add(pickProxy);

  group._variantMaterials = {
    body: bodyMat,
    seam: seamMat
  };

  applyFridgeVariant(group, FRIDGE_DEFAULT_STATE.variant, false);
  return group;
}

function applyFridgeVariant(fridge, variantId, save = true) {
  if (!fridge) return false;

  const variant = FRIDGE_VARIANTS[variantId] || FRIDGE_VARIANTS[FRIDGE_DEFAULT_STATE.variant];
  const bodyMat = fridge._variantMaterials?.body;
  const seamMat = fridge._variantMaterials?.seam;
  if (!bodyMat) return false;

  bodyMat.color.setHex(variant.color);
  bodyMat.metalness = variant.metalness;
  bodyMat.roughness = variant.roughness;
  if ('clearcoat' in bodyMat) {
    bodyMat.clearcoat = 0.34;
    bodyMat.clearcoatRoughness = 0.16;
  }
  bodyMat.needsUpdate = true;

  if (seamMat) {
    seamMat.color.setHex(variant.seam);
    seamMat.metalness = 0.16;
    seamMat.roughness = 0.52;
    seamMat.needsUpdate = true;
  }

  fridge.userData.variant = FRIDGE_VARIANTS[variantId]
    ? variantId
    : FRIDGE_DEFAULT_STATE.variant;

  if (save) saveFridgeState(fridge);
  syncLibraryUI();
  return true;
}

function setFridgeVariantFromLibrary(variantId) {
  let fridge = getCurrentFridge();

  if (!fridge) {
    const saved = readSavedFridgeState();
    fridge = createPanasonicFridge();

    if (saved) {
      applyFridgeState(fridge, { ...saved, exists: true, variant: variantId });
    } else {
      applyFridgeState(fridge, { ...FRIDGE_DEFAULT_STATE, variant: variantId });
    }

    editableRoot.add(fridge);
  }

  applyFridgeVariant(fridge, variantId, true);
  selectEditable(fridge);
  setStatus('Panasonic NR-F601WX · ' + FRIDGE_VARIANTS[variantId].label + ' · 已套用並記憶');
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
  group.userData.snapAngleOffset = 0;

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x171819,
    metalness: 0.30,
    roughness: 0.52,
    clearcoat: 0.22,
    clearcoatRoughness: 0.38
  });
  const fasciaMat = new THREE.MeshStandardMaterial({
    color: 0x131516,
    metalness: 0.18,
    roughness: 0.36
  });
  const controlMat = new THREE.MeshStandardMaterial({
    color: 0x0b0d0e,
    metalness: 0.22,
    roughness: 0.30
  });
  const darkDetailMat = new THREE.MeshStandardMaterial({
    color: 0x111314,
    metalness: 0.18,
    roughness: 0.34
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
    fasciaMat
  );
  fascia.position.set(0, height * 0.50, depth / 2 + 0.010);
  fascia.castShadow = true;
  fascia.receiveShadow = true;
  group.add(fascia);

  // Touch-control band.
  const controlBand = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.88, 0.125, 0.024),
    controlMat
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
    darkDetailMat
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
    darkDetailMat
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

  group._variantMaterials = {
    body: bodyMat,
    fascia: fasciaMat,
    control: controlMat,
    darkDetail: darkDetailMat,
    trim: trimMat
  };
  group.userData.componentId = 'panasonic-na-v170rph';
  group.userData.variant = 'black';

  applyWasherVariant(group, 'black', false);

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
    setStatus('旋轉模式 · 接近空間正角度時會自動磁吸');
  }

  moveObjectBtn?.classList.toggle('active', mode === 'translate');
  rotateObjectBtn?.classList.toggle('active', mode === 'rotate');
}

function selectEditable(object) {
  selectedEditable = object;

  if (object) {
    rememberEditableCollisionSafeState(object);
    transformControls.attach(object);
    setEditableMode(editableMode);
    objectToolbar?.classList.remove('hidden');
    setStatus((object.userData.label || '元件') + ' · 可移動 / 旋轉磁吸 / 刪除');
  } else {
    transformControls.detach();
    objectToolbar?.classList.add('hidden');
  }
}

function deleteSelectedEditable() {
  if (!selectedEditable) return;

  const doomed = selectedEditable;
  const label = doomed.userData?.label || '元件';
  const componentId = doomed.userData?.componentId;

  transformControls.detach();
  selectedEditable = null;
  doomed.removeFromParent();

  if (componentId === 'panasonic-na-v170rph') {
    saveWasherDeletedState();
  } else if (componentId === 'panasonic-nr-f601wx') {
    saveFridgeDeletedState();
  } else if (componentId === 'cleanup-centro-207') {
    saveKitchenDeletedState();
  }

  objectToolbar?.classList.add('hidden');
  syncLibraryUI();
  setStatus(label + ' 已刪除並記憶 · 可從元件庫重新加入');
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
  wallColliders = [];
  materialTargets.floor.clear();
  materialTargets.roomDoor.clear();

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
  if (exportBtn) exportBtn.disabled = true;
  fitBtn.disabled = true;
}

function setStandardView(view) {
  const box = new THREE.Box3().setFromObject(modelRoot);
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const maxDim = Math.max(size.x, size.y, size.z);
  const distance = Math.max(sphere.radius * 3.2, maxDim * 1.8);

  camera.fov = 28;
  camera.near = Math.max(0.02, distance / 2000);
  camera.far = distance * 10;

  if (view === 'top') {
    camera.up.set(0, 0, -1);
    camera.position.set(center.x, center.y + distance, center.z);
    setStatus('三視圖 · 俯視');
  } else if (view === 'front') {
    camera.up.set(0, 1, 0);
    camera.position.set(center.x, center.y + size.y * 0.10, center.z + distance);
    setStatus('三視圖 · 正視');
  } else {
    camera.up.set(0, 1, 0);
    camera.position.set(center.x + distance, center.y + size.y * 0.10, center.z);
    setStatus('三視圖 · 側視');
  }

  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

function fitCamera() {
  camera.fov = 40;
  camera.up.set(0, 1, 0);
  camera.updateProjectionMatrix();

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
      './model/part-' + String(i).padStart(2, '0') + '.txt?v=20261004-wall-collision-v1'
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

    rebuildWallColliders();

    const kitchen = restoreOrCreateKitchen();
    const fridge = restoreOrCreateFridge();
    const washer = restoreOrCreateWasher();
    syncLibraryUI();

    welcome.classList.add('hidden');
    fitBtn.disabled = false;
    if (exportBtn) exportBtn.disabled = false;

    modeBadge.textContent = '空屋擬真 · 西北向';
    modelInfo.textContent =
      meshCount + ' meshes · ' +
      (glbBuffer.byteLength / 1048576).toFixed(2) + ' MB';
    setStatus(
      '1004 · Cleanup CENTRO + Panasonic NR-F601WX 已配置 · 元件庫可切換配色'
    );
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
