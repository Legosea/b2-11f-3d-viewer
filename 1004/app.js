import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

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
    },
    {
      id: 'bosch-smv6zax00x',
      brand: 'Bosch',
      model: 'SMV6ZAX00X',
      label: 'Bosch SMV6ZAX00X',
      builtIn: true,
      sizeMm: [598, 550, 815]
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
  furniture: [
    {
      id: 'ija-reims-3seat',
      brand: 'IJA 愛加',
      model: 'Reims 蘭斯',
      label: 'IJA 蘭斯 Reims 三人沙發',
      depthMm: 970,
      heightMm: 1040,
      widthRangeMm: [2100, 2520]
    },
    {
      id: 'w3-window-daybed',
      brand: 'Built-in',
      model: 'W3 Window Daybed',
      label: 'W3 窗邊木作臥榻板',
      widthMm: 2868,
      depthMm: 620,
      heightMm: 45
    },
    {
      id: 'living-tv-slat-wall',
      brand: 'Built-in',
      model: '90s Acoustic Slat TV Wall',
      label: '客廳木格柵電視牆 + 75 吋電視',
      tvModel: '75-inch 16:9 TV',
      tvSizeMm: [1668, 942, 25],
      variants: ['light-oak','walnut','caramel-walnut','shadow-black']
    }
  ]
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
  countertop: 'e-coat-stainless',
  dishwasherInstalled: true
});

const FRIDGE_DEFAULT_STATE = Object.freeze({
  exists: true,
  x: 7.20,
  y: 0,
  z: -5.83,
  rotationY: 0,
  variant: 'w1-jade-white'
});

const SOFA_STORAGE_KEY = 'b2-11f-1004.ija-reims-3seat.v1';

const SOFA_WIDTH_PRESETS = Object.freeze({
  '210': { label: '210 cm', width: 2.10 },
  '231': { label: '231 cm', width: 2.31 },
  '252': { label: '252 cm', width: 2.52 }
});

const SOFA_DEFAULT_STATE = Object.freeze({
  exists: true,
  x: 4.62,
  y: 0,
  z: -3.30,
  rotationY: 0,
  widthPreset: '210'
});

const DAYBED_STORAGE_KEY = 'b2-11f-1004.w3-window-daybed.v1';

const DAYBED_DEFAULT_STATE = Object.freeze({
  exists: true,
  x: 4.5524,
  y: 0,
  z: -0.945,
  rotationY: 0,
  lidsOpen: false
});

const TV_WALL_STORAGE_KEY = 'b2-11f-1004.living-tv-slat-wall.v2';
const LEGACY_TV_WALL_STORAGE_KEY = 'b2-11f-1004.living-tv-slat-wall.v1';

const TV_WALL_VARIANTS = Object.freeze({
  'light-oak': {
    label: '淺橡木',
    color: 0xe1c89d,
    texture: 'light-oak'
  },
  'walnut': {
    label: '胡桃棕',
    color: 0x8a715a,
    texture: 'walnut'
  },
  'caramel-walnut': {
    label: '焦糖胡桃棕',
    color: 0xa87743,
    texture: 'natural-wood'
  },
  'shadow-black': {
    label: '曜影黑',
    color: 0x343536,
    texture: null
  }
});

// Safety-first placement policy:
// newly introduced components start at the centre of the floor plan.
// These fallback values are the centre of the converted 1004 GLB bounds;
// runtime placement recalculates the live model centre whenever possible.
const TV_WALL_DEFAULT_STATE = Object.freeze({
  exists: true,
  x: 5.5724,
  y: 0,
  z: -3.2091,
  rotationY: 0,
  variant: 'light-oak'
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
const dishwasherToggleBtn = document.getElementById('dishwasherToggleBtn');
const addSofaBtn = document.getElementById('addSofaBtn');
const sofaWidthButtons = [...document.querySelectorAll('[data-sofa-width]')];
const addDaybedBtn = document.getElementById('addDaybedBtn');
const daybedLidToggleBtn = document.getElementById('daybedLidToggleBtn');
const addTvWallBtn = document.getElementById('addTvWallBtn');
const tvWallVariantButtons = [...document.querySelectorAll('[data-tvwall-variant]')];

let scene, camera, renderer, controls, modelRoot, stagingRoot, sunLight, interiorLightRoot, editableRoot, transformControls;
let nordicWoodTexture = null;
const woodTextureCache = new Map();
const surfaceTextureCache = new Map();
let sofaFabricBumpTexture = null;
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
const WALL_SWEEP_STEP = 0.01;           // 10 mm swept-movement sampling
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

function getPlanCenterXZ() {
  if (modelRoot) {
    const box = new THREE.Box3().setFromObject(modelRoot);
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3());
      return { x: center.x, z: center.z };
    }
  }

  return { x: 5.5724, z: -3.2091 };
}

function placeNewEditableAtPlanCenter(object, preferredRotationY = 0) {
  if (!object) return false;

  const center = getPlanCenterXZ();
  const floor = object.userData?.floorY ?? 0;

  object.position.set(center.x, floor, center.z);
  object.rotation.set(0, preferredRotationY, 0);
  object.updateMatrixWorld(true);

  // The exact geometric centre can occasionally coincide with an internal wall.
  // Search outward from the centre only when necessary, keeping the object as
  // close to the plan centre as possible.
  if (wallColliders.length && editableIntersectsWall(object)) {
    const radii = [0.30, 0.60, 0.90, 1.20, 1.50, 1.80, 2.10];
    let placed = false;

    for (const radius of radii) {
      for (let step = 0; step < 16; step++) {
        const angle = (Math.PI * 2 * step) / 16;
        object.position.set(
          center.x + Math.cos(angle) * radius,
          floor,
          center.z + Math.sin(angle) * radius
        );
        object.updateMatrixWorld(true);

        if (!editableIntersectsWall(object)) {
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    // If no legal point was found, return to the literal plan centre rather
    // than using a component-specific wall/balcony default.
    if (!placed) {
      object.position.set(center.x, floor, center.z);
      object.updateMatrixWorld(true);
    }
  }

  rememberEditableCollisionSafeState(object);
  object.userData.defaultPlacementPolicy = 'plan-center';
  return true;
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

    // Preserve product options, but every manual add starts from plan centre.
    applyWasherState(washer, {
      ...(saved || WASHER_DEFAULT_STATE),
      exists: true,
      x: 0,
      z: 0,
      rotationY: 0
    });

    editableRoot.add(washer);
    placeNewEditableAtPlanCenter(washer, 0);
    saveWasherState(washer);
    selectEditable(washer);
    setStatus('Panasonic NA-V170RPH · 已放在圖面中央');
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

  dishwasherToggleBtn?.addEventListener('click', () => {
    let kitchen = getCurrentKitchen();

    if (!kitchen) {
      const saved = readKitchenState();
      kitchen = createCentroKitchen();
      applyKitchenState(kitchen, {
        ...(saved || KITCHEN_DEFAULT_STATE),
        exists: true,
        x: 0,
        z: 0,
        rotationY: 0
      });
      editableRoot.add(kitchen);
      placeNewEditableAtPlanCenter(kitchen, 0);
    }

    const nextInstalled = !kitchen.userData.dishwasherInstalled;
    applyKitchenDishwasher(kitchen, nextInstalled, true);
    selectEditable(kitchen);

    setStatus(
      nextInstalled
        ? 'Bosch SMV6ZAX00X 已嵌入 CENTRO 中央模組'
        : 'Bosch SMV6ZAX00X 已從 CENTRO 移除'
    );
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

    applyFridgeState(fridge, {
      ...(saved || FRIDGE_DEFAULT_STATE),
      exists: true,
      x: 0,
      z: 0,
      rotationY: 0
    });

    editableRoot.add(fridge);
    placeNewEditableAtPlanCenter(fridge, 0);
    saveFridgeState(fridge);
    selectEditable(fridge);
    syncLibraryUI();
    setStatus('Panasonic NR-F601WX · 已放在圖面中央');
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
    applyKitchenState(kitchen, {
      ...(saved || KITCHEN_DEFAULT_STATE),
      exists: true,
      x: 0,
      z: 0,
      rotationY: 0
    });
    editableRoot.add(kitchen);
    placeNewEditableAtPlanCenter(kitchen, 0);
    saveKitchenState(kitchen);
    selectEditable(kitchen);
    syncLibraryUI();
    setStatus('Cleanup CENTRO · 已放在圖面中央');
  });

  sofaWidthButtons.forEach(button => {
    button.addEventListener('click', () => {
      setSofaWidthFromLibrary(button.dataset.sofaWidth);
    });
  });

  addSofaBtn?.addEventListener('click', () => {
    const existing = getCurrentSofa();
    if (existing) {
      selectEditable(existing);
      setStatus('IJA 蘭斯 Reims 三人沙發已存在 · 已選取');
      return;
    }

    const saved = readSofaState();
    const state = {
      ...(saved || SOFA_DEFAULT_STATE),
      exists: true,
      x: 0,
      z: 0,
      rotationY: 0
    };
    const sofa = createIjaReimsSofa(state.widthPreset);
    applySofaState(sofa, state);
    editableRoot.add(sofa);
    placeNewEditableAtPlanCenter(sofa, 0);
    saveSofaState(sofa);
    selectEditable(sofa);
    syncLibraryUI();
    setStatus('IJA 蘭斯 Reims 三人沙發 · 已放在圖面中央');
  });

  addDaybedBtn?.addEventListener('click', () => {
    const existing = getCurrentDaybed();
    if (existing) {
      selectEditable(existing);
      setStatus('W3 窗邊臥榻已存在 · 已選取');
      return;
    }

    const saved = readDaybedState();
    const state = {
      ...(saved || DAYBED_DEFAULT_STATE),
      exists: true,
      x: 0,
      z: 0,
      rotationY: 0
    };
    const daybed = createW3WindowDaybed();
    applyDaybedState(daybed, state);
    editableRoot.add(daybed);
    placeNewEditableAtPlanCenter(daybed, 0);
    saveDaybedState(daybed);
    selectEditable(daybed);
    syncLibraryUI();
    setStatus('W3 三片上掀收納臥榻 · 已放在圖面中央');
  });

  daybedLidToggleBtn?.addEventListener('click', () => {
    let daybed = getCurrentDaybed();

    if (!daybed) {
      const saved = readDaybedState();
      const state = {
        ...(saved || DAYBED_DEFAULT_STATE),
        exists: true,
        x: 0,
        z: 0,
        rotationY: 0
      };
      daybed = createW3WindowDaybed();
      applyDaybedState(daybed, state);
      editableRoot.add(daybed);
      placeNewEditableAtPlanCenter(daybed, 0);
    }

    const nextOpen = !daybed.userData.lidsOpen;
    applyDaybedLidState(daybed, nextOpen, true);
    selectEditable(daybed);

    setStatus(
      nextOpen
        ? 'W3 臥榻 · 三片上掀已開啟，可查看收納空間'
        : 'W3 臥榻 · 三片上蓋已關閉'
    );
  });

  tvWallVariantButtons.forEach(button => {
    button.addEventListener('click', () => {
      setTvWallVariantFromLibrary(button.dataset.tvwallVariant);
    });
  });

  addTvWallBtn?.addEventListener('click', () => {
    const existing = getCurrentTvWall();
    if (existing) {
      selectEditable(existing);
      setStatus('木格柵電視牆 + 75 吋電視 已存在 · 已選取');
      return;
    }

    const saved = readTvWallState();
    const state = {
      ...(saved || TV_WALL_DEFAULT_STATE),
      exists: true,
      x: 0,
      z: 0,
      rotationY: 0
    };
    const tvWall = createLivingTvWall();
    applyTvWallState(tvWall, state);
    editableRoot.add(tvWall);
    placeNewEditableAtPlanCenter(tvWall, 0);
    saveTvWallState(tvWall);
    selectEditable(tvWall);
    syncLibraryUI();
    setStatus('木格柵電視牆 + 75 吋電視 · 已放在圖面中央');
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

  const dishwasherInstalled =
    kitchen?.userData?.dishwasherInstalled ??
    savedKitchen?.dishwasherInstalled ??
    KITCHEN_DEFAULT_STATE.dishwasherInstalled;

  if (dishwasherToggleBtn) {
    dishwasherToggleBtn.classList.toggle('selected', dishwasherInstalled);
    dishwasherToggleBtn.textContent = dishwasherInstalled
      ? '已安裝於 CENTRO · 點此移除'
      : '安裝到 CENTRO 中央模組';
  }

  const sofa = getCurrentSofa();
  const savedSofa = readSofaState();
  const sofaWidthPreset =
    sofa?.userData?.widthPreset ||
    savedSofa?.widthPreset ||
    SOFA_DEFAULT_STATE.widthPreset;

  sofaWidthButtons.forEach(button => {
    button.classList.toggle(
      'selected',
      button.dataset.sofaWidth === sofaWidthPreset
    );
  });

  const daybed = getCurrentDaybed();
  const savedDaybed = readDaybedState();
  const lidsOpen =
    daybed?.userData?.lidsOpen ??
    savedDaybed?.lidsOpen ??
    DAYBED_DEFAULT_STATE.lidsOpen;

  if (daybedLidToggleBtn) {
    daybedLidToggleBtn.classList.toggle('selected', lidsOpen);
    daybedLidToggleBtn.textContent = lidsOpen
      ? '關閉三片上蓋'
      : '上掀展示';
  }

  const tvWall = getCurrentTvWall();
  const savedTvWall = readTvWallState();
  const tvWallVariant =
    tvWall?.userData?.variant ||
    savedTvWall?.variant ||
    TV_WALL_DEFAULT_STATE.variant;

  tvWallVariantButtons.forEach(button => {
    button.classList.toggle(
      'selected',
      button.dataset.tvwallVariant === tvWallVariant
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

    applyWasherState(washer, {
      ...(saved || WASHER_DEFAULT_STATE),
      exists: true,
      x: 0,
      z: 0,
      rotationY: 0,
      variant: variantId
    });

    editableRoot.add(washer);
    placeNewEditableAtPlanCenter(washer, 0);
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
        : KITCHEN_DEFAULT_STATE.countertop,
      dishwasherInstalled: parsed.dishwasherInstalled !== false
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
        : KITCHEN_DEFAULT_STATE.countertop,
      dishwasherInstalled: state.dishwasherInstalled !== false
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
    countertop: kitchen.userData.countertop || KITCHEN_DEFAULT_STATE.countertop,
    dishwasherInstalled: kitchen.userData.dishwasherInstalled !== false
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
  applyKitchenDishwasher(
    kitchen,
    next.dishwasherInstalled !== false,
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

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const normal = new THREE.Vector3();

  const structuralMaterial = name => {
    const value = String(name || '').toLowerCase().trim();

    // These are the actual structural wall finishes in the converted 1004 GLB.
    // Important: several walls live inside large merged ROOT meshes, so mesh
    // bounding boxes cannot be used to identify them reliably.
    return (
      value === 'default face' ||
      value === '09 - default' ||
      value.startsWith('瓷砖')
    );
  };

  modelRoot.traverse(object => {
    if (!object.isMesh || !object.visible || !object.geometry) return;
    if (object.userData?.ignoreWallCollision) return;

    const material = Array.isArray(object.material)
      ? object.material[0]
      : object.material;

    if (!structuralMaterial(material?.name)) return;

    const geometry = object.geometry;
    const position = geometry.attributes?.position;
    if (!position) return;

    const index = geometry.index;
    const triangleCount = index
      ? Math.floor(index.count / 3)
      : Math.floor(position.count / 3);

    for (let triIndex = 0; triIndex < triangleCount; triIndex++) {
      const ia = index ? index.getX(triIndex * 3) : triIndex * 3;
      const ib = index ? index.getX(triIndex * 3 + 1) : triIndex * 3 + 1;
      const ic = index ? index.getX(triIndex * 3 + 2) : triIndex * 3 + 2;

      a.fromBufferAttribute(position, ia).applyMatrix4(object.matrixWorld);
      b.fromBufferAttribute(position, ib).applyMatrix4(object.matrixWorld);
      c.fromBufferAttribute(position, ic).applyMatrix4(object.matrixWorld);

      THREE.Triangle.getNormal(a, b, c, normal);

      // Wall surfaces are near-vertical: their normal points horizontally.
      if (Math.abs(normal.y) > 0.28) continue;

      const minY = Math.min(a.y, b.y, c.y);
      const maxY = Math.max(a.y, b.y, c.y);
      const heightSpan = maxY - minY;

      const minX = Math.min(a.x, b.x, c.x);
      const maxX = Math.max(a.x, b.x, c.x);
      const minZ = Math.min(a.z, b.z, c.z);
      const maxZ = Math.max(a.z, b.z, c.z);
      const horizontalSpan = Math.max(maxX - minX, maxZ - minZ);

      // Reject floor edges, tiny trim pieces, etc.
      if (heightSpan < 0.38 || horizontalSpan < 0.10) continue;

      const triangle = new THREE.Triangle(
        a.clone(),
        b.clone(),
        c.clone()
      );

      const box = new THREE.Box3().setFromPoints([
        triangle.a,
        triangle.b,
        triangle.c
      ]);

      wallColliders.push({
        triangle,
        box,
        name: object.name || 'wall',
        material: material?.name || ''
      });
    }
  });

  console.info(
    '[collision] structural wall triangles:',
    wallColliders.length
  );
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

  // Clearance is horizontal only. Keeping Y exact prevents an object from
  // colliding with unrelated wall geometry above/below it.
  // Built-in millwork may intentionally sit visually flush to walls.
  const wallClearance = Number.isFinite(object.userData?.wallClearance)
    ? object.userData.wallClearance
    : WALL_COLLISION_CLEARANCE;

  const collisionTestBox = objectBox.clone();
  collisionTestBox.min.x -= wallClearance;
  collisionTestBox.max.x += wallClearance;
  collisionTestBox.min.z -= wallClearance;
  collisionTestBox.max.z += wallClearance;

  for (const collider of wallColliders) {
    // Cheap broad-phase first.
    if (!collisionTestBox.intersectsBox(collider.box)) continue;

    // Exact narrow-phase against the actual wall triangle.
    // This preserves genuine door/window openings instead of treating the
    // entire merged wall mesh as one solid rectangular obstacle.
    if (collisionTestBox.intersectsTriangle(collider.triangle)) {
      return true;
    }
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

  // Built-in wall panels should never finish at a crooked angle.
  if (onRelease && object.userData?.forceRoomAngleSnap) {
    object.rotation.y = nearest;
    object.userData.angleSnapped = true;
    return true;
  }

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

  if (object.userData?.componentId === 'ija-reims-3seat') {
    return saveSofaState(object);
  }

  if (object.userData?.componentId === 'w3-window-daybed') {
    return saveDaybedState(object);
  }

  if (object.userData?.componentId === 'living-tv-slat-wall') {
    return saveTvWallState(object);
  }

  return false;
}

function readTvWallState() {
  try {
    let raw = localStorage.getItem(TV_WALL_STORAGE_KEY);
    let migratedFromLegacy = false;

    if (!raw) {
      raw = localStorage.getItem(LEGACY_TV_WALL_STORAGE_KEY);
      migratedFromLegacy = Boolean(raw);
    }

    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const center = getPlanCenterXZ();

    const state = {
      exists: parsed.exists !== false,
      x: migratedFromLegacy
        ? center.x
        : (Number.isFinite(Number(parsed.x)) ? Number(parsed.x) : center.x),
      y: 0,
      z: migratedFromLegacy
        ? center.z
        : (Number.isFinite(Number(parsed.z)) ? Number(parsed.z) : center.z),
      rotationY: migratedFromLegacy
        ? 0
        : (Number.isFinite(Number(parsed.rotationY)) ? Number(parsed.rotationY) : 0),
      variant: TV_WALL_VARIANTS[parsed.variant]
        ? parsed.variant
        : TV_WALL_DEFAULT_STATE.variant
    };

    if (migratedFromLegacy) {
      localStorage.setItem(TV_WALL_STORAGE_KEY, JSON.stringify(state));
    }

    return state;
  } catch (error) {
    console.warn('Unable to read TV wall state.', error);
    return null;
  }
}

function writeTvWallState(state) {
  try {
    localStorage.setItem(TV_WALL_STORAGE_KEY, JSON.stringify({
      exists: state.exists !== false,
      x: Number(state.x),
      y: 0,
      z: Number(state.z),
      rotationY: Number(state.rotationY),
      variant: TV_WALL_VARIANTS[state.variant]
        ? state.variant
        : TV_WALL_DEFAULT_STATE.variant
    }));
    return true;
  } catch (error) {
    console.warn('Unable to persist TV wall state.', error);
    return false;
  }
}

function saveTvWallState(tvWall) {
  if (!tvWall) return false;

  const saved = writeTvWallState({
    exists: true,
    x: tvWall.position.x,
    y: 0,
    z: tvWall.position.z,
    rotationY: tvWall.rotation.y,
    variant: tvWall.userData.variant || TV_WALL_DEFAULT_STATE.variant
  });

  if (saved) tvWall.userData.hasSavedPlacement = true;
  return saved;
}

function saveTvWallDeletedState() {
  const current = readTvWallState() || TV_WALL_DEFAULT_STATE;
  return writeTvWallState({ ...current, exists: false });
}

function getCurrentTvWall() {
  return editableRoot?.children.find(
    child => child.userData?.componentId === 'living-tv-slat-wall'
  ) || null;
}

function applyTvWallState(tvWall, state) {
  const next = state || TV_WALL_DEFAULT_STATE;
  tvWall.position.set(next.x, 0, next.z);
  tvWall.rotation.set(0, next.rotationY, 0);
  tvWall.userData.floorY = 0;
  tvWall.userData.hasSavedPlacement = Boolean(state);
  applyTvWallVariant(
    tvWall,
    TV_WALL_VARIANTS[next.variant] ? next.variant : TV_WALL_DEFAULT_STATE.variant,
    false
  );
}

function restoreOrCreateTvWall() {
  const saved = readTvWallState();
  if (saved?.exists === false) return null;

  const tvWall = createLivingTvWall();

  if (saved) {
    applyTvWallState(tvWall, saved);
    editableRoot.add(tvWall);
    tvWall.updateMatrixWorld(true);

    // Any stale or illegal saved transform is moved to the plan centre.
    if (editableIntersectsWall(tvWall)) {
      placeNewEditableAtPlanCenter(tvWall, 0);
    } else {
      rememberEditableCollisionSafeState(tvWall);
    }
  } else {
    applyTvWallState(tvWall, TV_WALL_DEFAULT_STATE);
    editableRoot.add(tvWall);
    placeNewEditableAtPlanCenter(tvWall, 0);
  }

  saveTvWallState(tvWall);
  return tvWall;
}

function readDaybedState() {
  try {
    const raw = localStorage.getItem(DAYBED_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      exists: parsed.exists !== false,
      x: Number.isFinite(Number(parsed.x)) ? Number(parsed.x) : DAYBED_DEFAULT_STATE.x,
      y: 0,
      z: Number.isFinite(Number(parsed.z)) ? Number(parsed.z) : DAYBED_DEFAULT_STATE.z,
      rotationY: Number.isFinite(Number(parsed.rotationY))
        ? Number(parsed.rotationY)
        : DAYBED_DEFAULT_STATE.rotationY,
      lidsOpen: parsed.lidsOpen === true
    };
  } catch (error) {
    console.warn('Unable to read W3 daybed state.', error);
    return null;
  }
}

function writeDaybedState(state) {
  try {
    localStorage.setItem(DAYBED_STORAGE_KEY, JSON.stringify({
      exists: state.exists !== false,
      x: Number(state.x),
      y: 0,
      z: Number(state.z),
      rotationY: Number(state.rotationY),
      lidsOpen: state.lidsOpen === true
    }));
    return true;
  } catch (error) {
    console.warn('Unable to persist W3 daybed state.', error);
    return false;
  }
}

function saveDaybedState(daybed) {
  if (!daybed) return false;

  const saved = writeDaybedState({
    exists: true,
    x: daybed.position.x,
    y: 0,
    z: daybed.position.z,
    rotationY: daybed.rotation.y,
    lidsOpen: daybed.userData.lidsOpen === true
  });

  if (saved) daybed.userData.hasSavedPlacement = true;
  return saved;
}

function saveDaybedDeletedState() {
  const current = readDaybedState() || DAYBED_DEFAULT_STATE;
  return writeDaybedState({ ...current, exists: false });
}

function getCurrentDaybed() {
  return editableRoot?.children.find(
    child => child.userData?.componentId === 'w3-window-daybed'
  ) || null;
}

function applyDaybedState(daybed, state) {
  const next = state || DAYBED_DEFAULT_STATE;
  daybed.position.set(next.x, 0, next.z);
  daybed.rotation.set(0, next.rotationY, 0);
  daybed.userData.floorY = 0;
  daybed.userData.hasSavedPlacement = Boolean(state);
  applyDaybedLidState(daybed, next.lidsOpen === true, false);
}

function restoreOrCreateDaybed() {
  const saved = readDaybedState();
  if (saved?.exists === false) return null;

  const daybed = createW3WindowDaybed();
  applyDaybedState(daybed, saved || DAYBED_DEFAULT_STATE);
  editableRoot.add(daybed);

  if (!saved) saveDaybedState(daybed);
  return daybed;
}

function readSofaState() {
  try {
    const raw = localStorage.getItem(SOFA_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      exists: parsed.exists !== false,
      x: Number.isFinite(Number(parsed.x)) ? Number(parsed.x) : SOFA_DEFAULT_STATE.x,
      y: 0,
      z: Number.isFinite(Number(parsed.z)) ? Number(parsed.z) : SOFA_DEFAULT_STATE.z,
      rotationY: Number.isFinite(Number(parsed.rotationY))
        ? Number(parsed.rotationY)
        : SOFA_DEFAULT_STATE.rotationY,
      widthPreset: SOFA_WIDTH_PRESETS[parsed.widthPreset]
        ? parsed.widthPreset
        : SOFA_DEFAULT_STATE.widthPreset
    };
  } catch (error) {
    console.warn('Unable to read IJA Reims sofa state.', error);
    return null;
  }
}

function writeSofaState(state) {
  try {
    localStorage.setItem(SOFA_STORAGE_KEY, JSON.stringify({
      exists: state.exists !== false,
      x: Number(state.x),
      y: 0,
      z: Number(state.z),
      rotationY: Number(state.rotationY),
      widthPreset: SOFA_WIDTH_PRESETS[state.widthPreset]
        ? state.widthPreset
        : SOFA_DEFAULT_STATE.widthPreset
    }));
    return true;
  } catch (error) {
    console.warn('Unable to persist IJA Reims sofa state.', error);
    return false;
  }
}

function saveSofaState(sofa) {
  if (!sofa) return false;

  const saved = writeSofaState({
    exists: true,
    x: sofa.position.x,
    y: 0,
    z: sofa.position.z,
    rotationY: sofa.rotation.y,
    widthPreset: sofa.userData.widthPreset || SOFA_DEFAULT_STATE.widthPreset
  });

  if (saved) sofa.userData.hasSavedPlacement = true;
  return saved;
}

function saveSofaDeletedState() {
  const current = readSofaState() || SOFA_DEFAULT_STATE;
  return writeSofaState({ ...current, exists: false });
}

function getCurrentSofa() {
  return editableRoot?.children.find(
    child => child.userData?.componentId === 'ija-reims-3seat'
  ) || null;
}

function applySofaState(sofa, state) {
  const next = state || SOFA_DEFAULT_STATE;
  sofa.position.set(next.x, 0, next.z);
  sofa.rotation.set(0, next.rotationY, 0);
  sofa.userData.floorY = 0;
  sofa.userData.widthPreset = SOFA_WIDTH_PRESETS[next.widthPreset]
    ? next.widthPreset
    : SOFA_DEFAULT_STATE.widthPreset;
  sofa.userData.hasSavedPlacement = Boolean(state);
}

function restoreOrCreateSofa() {
  const saved = readSofaState();
  if (saved?.exists === false) return null;

  const state = saved || SOFA_DEFAULT_STATE;
  const sofa = createIjaReimsSofa(state.widthPreset);
  applySofaState(sofa, state);
  editableRoot.add(sofa);

  if (!saved) saveSofaState(sofa);
  return sofa;
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
  group.userData.label = 'Cleanup CENTRO 一字型 207 cm · 流レール不鏽鋼水槽';
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

  function addBox(w, h, d, x, y, z, material, name='', parent=assembly) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    parent.add(mesh);
    return mesh;
  }

  // Base cabinet and toe kick.
  // Keep the internal carcass lower than the sink bottom so the sink is a real
  // visible recess. Drawer fronts / appliances still extend to normal height.
  const carcassHeight = 0.635;
  addBox(
    width,
    carcassHeight,
    depth,
    width/2,
    carcassHeight/2,
    depth/2,
    cabinetMat,
    'CENTRO_base'
  );

  // Side/rear structural rails preserve cabinet mass without closing the
  // sink cavity at countertop height.
  addBox(
    width,
    0.055,
    0.045,
    width/2,
    baseHeight - 0.055/2,
    0.030,
    cabinetMat,
    'CENTRO_rear_top_rail'
  );
  addBox(
    0.030,
    baseHeight - carcassHeight,
    depth,
    0.015,
    carcassHeight + (baseHeight-carcassHeight)/2,
    depth/2,
    cabinetMat,
    'CENTRO_left_upper_side'
  );
  addBox(
    0.030,
    baseHeight - carcassHeight,
    depth,
    width - 0.015,
    carcassHeight + (baseHeight-carcassHeight)/2,
    depth/2,
    cabinetMat,
    'CENTRO_right_upper_side'
  );

  addBox(width - 0.04, 0.08, 0.05, width/2, 0.04, depth + 0.005, darkMat, 'CENTRO_toekick');

  const moduleW = width / 3;

  // Drawer fronts / hidden handle detail.
  // Left and right remain normal CENTRO cabinet modules.
  // The centre is reserved for the 60 cm Bosch full-integrated dishwasher.
  const centerDrawerGroup = new THREE.Group();
  centerDrawerGroup.name = 'CENTRO_Center_Drawers';
  assembly.add(centerDrawerGroup);

  for (let i = 0; i < 3; i++) {
    const cx = moduleW * i + moduleW / 2;
    const targetParent = i === 1 ? centerDrawerGroup : assembly;

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
        'CENTRO_drawer',
        targetParent
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
      'CENTRO_handle',
      targetParent
    );
  }

  // Bosch SMV6ZAX00X — full-integrated 60 cm dishwasher.
  // Official machine size: H815 x W598 x D550 mm.
  const dishwasherGroup = new THREE.Group();
  dishwasherGroup.name = 'Bosch_SMV6ZAX00X';
  dishwasherGroup.userData.componentId = 'bosch-smv6zax00x';
  dishwasherGroup.userData.label = 'Bosch SMV6ZAX00X';
  assembly.add(dishwasherGroup);

  const dishwasherW = 0.598;
  const dishwasherD = 0.550;
  const dishwasherH = 0.815;
  const dishwasherX = moduleW * 1.5;
  const dishwasherBottom = 0.018;
  const dishwasherFrontZ = depth + 0.014;

  const dishwasherBodyMat = new THREE.MeshStandardMaterial({
    color: 0x4f5355,
    metalness: 0.50,
    roughness: 0.42
  });

  const dishwasherControlMat = new THREE.MeshStandardMaterial({
    color: 0x5b5a57,
    metalness: 0.32,
    roughness: 0.46
  });

  // The actual machine body is mostly hidden behind the cabinet door.
  addBox(
    dishwasherW,
    dishwasherH,
    dishwasherD,
    dishwasherX,
    dishwasherBottom + dishwasherH / 2,
    depth - dishwasherD / 2 - 0.018,
    dishwasherBodyMat,
    'Bosch_SMV6ZAX00X_body',
    dishwasherGroup
  );

  // Full-integrated furniture front:
  // the appliance itself is 598 mm wide, but the furniture panel must fill
  // the complete CENTRO centre module so it visually aligns with adjacent fronts.
  const dishwasherPanelW = moduleW - 0.018;
  const dishwasherPanelBottom = 0.082;
  const dishwasherPanelTop = 0.775;
  const dishwasherPanelH = dishwasherPanelTop - dishwasherPanelBottom;

  addBox(
    dishwasherPanelW,
    dishwasherPanelH,
    0.022,
    dishwasherX,
    dishwasherPanelBottom + dishwasherPanelH / 2,
    dishwasherFrontZ,
    cabinetMat,
    'Bosch_SMV6ZAX00X_integrated_front',
    dishwasherGroup
  );

  // Full-integrated controls are hidden when closed. Only a very small shadow
  // reveal remains under the worktop, matching the CENTRO handle line.
  const dishwasherRevealH = 0.006;
  addBox(
    dishwasherPanelW - 0.016,
    dishwasherRevealH,
    0.008,
    dishwasherX,
    0.786,
    dishwasherFrontZ + 0.008,
    dishwasherControlMat,
    'Bosch_SMV6ZAX00X_control_reveal',
    dishwasherGroup
  );

  // Fine side shadow gaps make the door read as a cabinet panel instead of a
  // separate appliance with exposed black borders.
  const dishwasherGapMat = new THREE.MeshStandardMaterial({
    color: 0x5f5b56,
    metalness: 0.08,
    roughness: 0.62
  });

  const sideGapW = 0.0035;
  [dishwasherX - dishwasherPanelW/2 - sideGapW/2,
   dishwasherX + dishwasherPanelW/2 + sideGapW/2].forEach(gapX => {
    addBox(
      sideGapW,
      dishwasherPanelH,
      0.006,
      gapX,
      dishwasherPanelBottom + dishwasherPanelH / 2,
      dishwasherFrontZ + 0.007,
      dishwasherGapMat,
      'Bosch_SMV6ZAX00X_side_gap',
      dishwasherGroup
    );
  });

  // Cleanup CENTRO realistic sink layout.
  // SH-class Naga-rail stainless sink proportions:
  // approx. W600 x D520 x H185 mm.
  const sinkW = 0.600;
  const sinkD = 0.520;
  const sinkH = 0.185;
  const sinkX = moduleW * 0.5;
  const sinkZ = depth * 0.50;
  const sinkLeft = sinkX - sinkW / 2;
  const sinkRight = sinkX + sinkW / 2;
  const sinkBack = sinkZ - sinkD / 2;
  const sinkFront = sinkZ + sinkD / 2;
  const counterY = baseHeight + counterThickness / 2;
  const counterOverhang = 0.0175;

  // Countertop is built around the opening rather than as one solid slab.
  if (sinkLeft > 0.004) {
    addBox(
      sinkLeft + counterOverhang,
      counterThickness,
      depth + 0.035,
      (sinkLeft - counterOverhang) / 2,
      counterY,
      depth / 2 + 0.012,
      counterMat,
      'CENTRO_countertop_left'
    );
  }

  addBox(
    width - sinkRight + counterOverhang,
    counterThickness,
    depth + 0.035,
    sinkRight + (width - sinkRight + counterOverhang) / 2,
    counterY,
    depth / 2 + 0.012,
    counterMat,
    'CENTRO_countertop_right'
  );

  if (sinkBack > 0.004) {
    addBox(
      sinkW,
      counterThickness,
      sinkBack + counterOverhang,
      sinkX,
      counterY,
      (sinkBack - counterOverhang) / 2,
      counterMat,
      'CENTRO_countertop_sink_back'
    );
  }

  if (depth - sinkFront > 0.004) {
    addBox(
      sinkW,
      counterThickness,
      depth - sinkFront + counterOverhang,
      sinkX,
      counterY,
      sinkFront + (depth - sinkFront + counterOverhang) / 2,
      counterMat,
      'CENTRO_countertop_sink_front'
    );
  }

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

  // IH cooktop on the RIGHT module, matching the user's reference layout.
  const cookX = moduleW * 2.5;
  addBox(
    moduleW * 0.72,
    0.018,
    0.46,
    cookX,
    baseHeight + counterThickness + 0.012,
    depth * 0.52,
    darkMat,
    'CENTRO_induction'
  );

  [cookX - moduleW*0.14, cookX + moduleW*0.14].forEach(px => {
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

  // -----------------------------------------------------------------------
  // Cleanup-style photoreal stainless Naga-rail sink.
  // -----------------------------------------------------------------------
  const sinkSteel = new THREE.MeshPhysicalMaterial({
    color: 0xb7bec0,
    metalness: 0.86,
    roughness: 0.32,
    clearcoat: 0.06,
    clearcoatRoughness: 0.44
  });

  const sinkInteriorSteel = new THREE.MeshPhysicalMaterial({
    color: 0x8f989a,
    metalness: 0.82,
    roughness: 0.40,
    clearcoat: 0.03,
    clearcoatRoughness: 0.52
  });

  const sinkDarkSteel = new THREE.MeshStandardMaterial({
    color: 0x5f6769,
    metalness: 0.74,
    roughness: 0.42
  });

  // Fine horizontal brushed-steel bump texture.
  const brushedCanvas = document.createElement('canvas');
  brushedCanvas.width = 256;
  brushedCanvas.height = 256;
  const brushedCtx = brushedCanvas.getContext('2d');
  brushedCtx.fillStyle = '#808080';
  brushedCtx.fillRect(0, 0, 256, 256);

  const brushedRandom = seededRandom(hashString('cleanup-centro-sh-sink'));
  for (let i = 0; i < 1800; i++) {
    const shade = 102 + Math.floor(brushedRandom() * 60);
    brushedCtx.strokeStyle = `rgba(${shade},${shade},${shade},0.13)`;
    brushedCtx.lineWidth = 0.45 + brushedRandom() * 0.60;
    const y = brushedRandom() * 256;
    const x = brushedRandom() * 256;
    const length = 10 + brushedRandom() * 42;
    brushedCtx.beginPath();
    brushedCtx.moveTo(x, y);
    brushedCtx.lineTo(
      Math.min(256, x + length),
      y + (brushedRandom() - 0.5) * 0.8
    );
    brushedCtx.stroke();
  }

  const brushedTexture = new THREE.CanvasTexture(brushedCanvas);
  brushedTexture.wrapS = THREE.RepeatWrapping;
  brushedTexture.wrapT = THREE.RepeatWrapping;
  brushedTexture.repeat.set(2.0, 2.0);
  brushedTexture.anisotropy = Math.min(
    8,
    renderer.capabilities.getMaxAnisotropy()
  );
  brushedTexture.needsUpdate = true;
  sinkSteel.bumpMap = brushedTexture;
  sinkSteel.bumpScale = 0.0018;
  sinkInteriorSteel.bumpMap = brushedTexture;
  sinkInteriorSteel.bumpScale = 0.0026;

  function roundedRectPath(path, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    path.moveTo(x + radius, y);
    path.lineTo(x + w - radius, y);
    path.quadraticCurveTo(x + w, y, x + w, y + radius);
    path.lineTo(x + w, y + h - radius);
    path.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    path.lineTo(x + radius, y + h);
    path.quadraticCurveTo(x, y + h, x, y + h - radius);
    path.lineTo(x, y + radius);
    path.quadraticCurveTo(x, y, x + radius, y);
  }

  // Rounded stainless rim.
  const outerW = sinkW + 0.018;
  const outerD = sinkD + 0.018;
  const innerW = sinkW - 0.026;
  const innerD = sinkD - 0.026;

  const rimShape = new THREE.Shape();
  roundedRectPath(
    rimShape,
    -outerW / 2,
    -outerD / 2,
    outerW,
    outerD,
    0.040
  );

  const rimHole = new THREE.Path();
  roundedRectPath(
    rimHole,
    -innerW / 2,
    -innerD / 2,
    innerW,
    innerD,
    0.032
  );
  rimShape.holes.push(rimHole);

  const rimGeometry = new THREE.ExtrudeGeometry(rimShape, {
    depth: 0.006,
    bevelEnabled: true,
    bevelSize: 0.0035,
    bevelThickness: 0.0025,
    bevelSegments: 3,
    curveSegments: 16
  });
  rimGeometry.rotateX(Math.PI / 2);

  const sinkRim = new THREE.Mesh(rimGeometry, sinkSteel);
  sinkRim.position.set(
    sinkX,
    baseHeight + counterThickness + 0.004,
    sinkZ
  );
  sinkRim.castShadow = true;
  sinkRim.receiveShadow = true;
  sinkRim.name = 'CENTRO_sink_rim';
  assembly.add(sinkRim);

  // Recessed basin floor.
  const basinBottom = new THREE.Mesh(
    new THREE.BoxGeometry(
      innerW - 0.032,
      0.010,
      innerD - 0.032
    ),
    sinkInteriorSteel
  );
  basinBottom.position.set(
    sinkX,
    baseHeight + counterThickness - sinkH + 0.004,
    sinkZ
  );
  basinBottom.castShadow = true;
  basinBottom.receiveShadow = true;
  basinBottom.name = 'CENTRO_sink_basin_bottom';
  assembly.add(basinBottom);

  // Four basin walls, slightly leaning inward like pressed stainless.
  const basinTopY = baseHeight + counterThickness - 0.010;
  const basinBottomY = baseHeight + counterThickness - sinkH + 0.020;
  const basinWallH = basinTopY - basinBottomY;
  const wallT = 0.012;

  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(innerW - 0.020, basinWallH, wallT),
    sinkInteriorSteel
  );
  backWall.position.set(
    sinkX,
    (basinTopY + basinBottomY) / 2,
    sinkZ - innerD / 2 + wallT / 2
  );
  backWall.rotation.x = THREE.MathUtils.degToRad(-3.0);
  assembly.add(backWall);

  const frontWall = backWall.clone();
  frontWall.position.z = sinkZ + innerD / 2 - wallT / 2;
  frontWall.rotation.x = THREE.MathUtils.degToRad(3.0);
  assembly.add(frontWall);

  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallT, basinWallH, innerD - 0.020),
    sinkInteriorSteel
  );
  leftWall.position.set(
    sinkX - innerW / 2 + wallT / 2,
    (basinTopY + basinBottomY) / 2,
    sinkZ
  );
  leftWall.rotation.z = THREE.MathUtils.degToRad(3.0);
  assembly.add(leftWall);

  const rightWall = leftWall.clone();
  rightWall.position.x = sinkX + innerW / 2 - wallT / 2;
  rightWall.rotation.z = THREE.MathUtils.degToRad(-3.0);
  assembly.add(rightWall);

  [backWall, frontWall, leftWall, rightWall].forEach(wall => {
    wall.castShadow = true;
    wall.receiveShadow = true;
    wall.name = 'CENTRO_sink_basin_wall';
  });

  // Cleanup Naga-rail-style front drainage channel.
  const flowRail = new THREE.Mesh(
    new THREE.BoxGeometry(innerW - 0.060, 0.010, 0.034),
    sinkDarkSteel
  );
  flowRail.position.set(
    sinkX,
    baseHeight + counterThickness - sinkH + 0.023,
    sinkZ + innerD / 2 - 0.050
  );
  flowRail.rotation.x = THREE.MathUtils.degToRad(-4);
  flowRail.castShadow = true;
  flowRail.receiveShadow = true;
  flowRail.name = 'CENTRO_sink_flow_rail';
  assembly.add(flowRail);

  // Drain / strainer at end of rail.
  const drainX = sinkX + innerW * 0.31;
  const drainZ = sinkZ + innerD / 2 - 0.062;

  const drainOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.052, 0.010, 48),
    sinkDarkSteel
  );
  drainOuter.position.set(
    drainX,
    baseHeight + counterThickness - sinkH + 0.030,
    drainZ
  );
  drainOuter.name = 'CENTRO_sink_drain';
  assembly.add(drainOuter);

  const drainInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, 0.012, 48),
    new THREE.MeshStandardMaterial({
      color: 0x41484a,
      metalness: 0.68,
      roughness: 0.46
    })
  );
  drainInner.position.set(
    drainX,
    baseHeight + counterThickness - sinkH + 0.036,
    drainZ
  );
  assembly.add(drainInner);

  // Modern high-arc pull-out faucet on the rear deck.
  // Built as a true 3D curve instead of a rotated Torus, so the spout arcs
  // naturally from the rear deck forward over the bowl.
  const faucetMat = new THREE.MeshPhysicalMaterial({
    color: 0xaeb6b8,
    metalness: 0.90,
    roughness: 0.25,
    clearcoat: 0.05,
    clearcoatRoughness: 0.30
  });

  const faucetX = sinkX + sinkW * 0.28;
  const faucetZ = Math.max(0.030, sinkBack * 0.48);
  const faucetBaseY = baseHeight + counterThickness;

  const faucetBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.029, 0.034, 0.070, 32),
    faucetMat
  );
  faucetBase.position.set(
    faucetX,
    faucetBaseY + 0.035,
    faucetZ
  );
  faucetBase.castShadow = true;
  faucetBase.receiveShadow = true;
  assembly.add(faucetBase);

  // Slightly thicker lower stem.
  const lowerStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0175, 0.0205, 0.145, 32),
    faucetMat
  );
  lowerStem.position.set(
    faucetX,
    faucetBaseY + 0.132,
    faucetZ
  );
  lowerStem.castShadow = true;
  assembly.add(lowerStem);

  const spoutCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(faucetX, faucetBaseY + 0.195, faucetZ),
    new THREE.Vector3(faucetX, faucetBaseY + 0.300, faucetZ + 0.002),
    new THREE.Vector3(faucetX, faucetBaseY + 0.380, faucetZ + 0.045),
    new THREE.Vector3(faucetX, faucetBaseY + 0.405, faucetZ + 0.125),
    new THREE.Vector3(faucetX, faucetBaseY + 0.378, faucetZ + 0.205),
    new THREE.Vector3(faucetX, faucetBaseY + 0.330, faucetZ + 0.245)
  ]);

  const spout = new THREE.Mesh(
    new THREE.TubeGeometry(
      spoutCurve,
      48,
      0.0155,
      14,
      false
    ),
    faucetMat
  );
  spout.castShadow = true;
  spout.receiveShadow = true;
  spout.name = 'CENTRO_faucet_high_arc';
  assembly.add(spout);

  // Pull-out spray head points downward at the end of the arc.
  const sprayHead = new THREE.Mesh(
    new THREE.CylinderGeometry(0.021, 0.023, 0.090, 28),
    faucetMat
  );
  sprayHead.position.set(
    faucetX,
    faucetBaseY + 0.288,
    faucetZ + 0.245
  );
  sprayHead.castShadow = true;
  assembly.add(sprayHead);

  // Dark nozzle face underneath.
  const nozzleFace = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.017, 0.006, 28),
    new THREE.MeshStandardMaterial({
      color: 0x555b5d,
      metalness: 0.46,
      roughness: 0.48
    })
  );
  nozzleFace.position.set(
    faucetX,
    faucetBaseY + 0.241,
    faucetZ + 0.245
  );
  assembly.add(nozzleFace);

  // Slim single-lever mixer on the side of the base.
  const leverPivot = new THREE.Group();
  leverPivot.position.set(
    faucetX + 0.035,
    faucetBaseY + 0.145,
    faucetZ
  );
  leverPivot.rotation.z = THREE.MathUtils.degToRad(-28);

  const faucetLever = new THREE.Mesh(
    new THREE.BoxGeometry(0.011, 0.095, 0.014),
    faucetMat
  );
  faucetLever.position.y = 0.040;
  faucetLever.castShadow = true;
  leverPivot.add(faucetLever);
  assembly.add(leverPivot);

  // Upper cabinets and range hood.
  const upperY = 1.88;
  addBox(
    moduleW - 0.015,
    wallCabinetHeight,
    wallCabinetDepth,
    moduleW * 0.5,
    upperY,
    wallCabinetDepth/2,
    cabinetMat,
    'CENTRO_upper'
  );
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

  // Range hood aligned above the RIGHT-side cooktop.
  addBox(
    moduleW * 0.82,
    0.16,
    0.45,
    moduleW * 2.5,
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
  group._dishwasherGroup = dishwasherGroup;
  group._centerDrawerGroup = centerDrawerGroup;
  group.userData.dishwasherInstalled = KITCHEN_DEFAULT_STATE.dishwasherInstalled;

  applyKitchenVariant(group, KITCHEN_DEFAULT_STATE.variant, false);
  applyKitchenCountertop(group, KITCHEN_DEFAULT_STATE.countertop, false);
  applyKitchenDishwasher(group, KITCHEN_DEFAULT_STATE.dishwasherInstalled, false);
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

function applyKitchenDishwasher(kitchen, installed, save = true) {
  if (!kitchen) return false;

  const enabled = installed !== false;
  kitchen.userData.dishwasherInstalled = enabled;

  if (kitchen._dishwasherGroup) {
    kitchen._dishwasherGroup.visible = enabled;
  }

  if (kitchen._centerDrawerGroup) {
    kitchen._centerDrawerGroup.visible = !enabled;
  }

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
    applyKitchenState(kitchen, {
      ...(saved || KITCHEN_DEFAULT_STATE),
      exists: true,
      x: 0,
      z: 0,
      rotationY: 0
    });
    editableRoot.add(kitchen);
    placeNewEditableAtPlanCenter(kitchen, 0);
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
    applyKitchenState(kitchen, {
      ...(saved || KITCHEN_DEFAULT_STATE),
      exists: true,
      x: 0,
      z: 0,
      rotationY: 0
    });
    editableRoot.add(kitchen);
    placeNewEditableAtPlanCenter(kitchen, 0);
  }

  applyKitchenCountertop(kitchen, countertopId, true);
  selectEditable(kitchen);
  setStatus(
    'Cleanup CENTRO 檯面 · ' +
    CENTRO_COUNTERTOP_VARIANTS[countertopId].label +
    ' · 已套用並記憶'
  );
}

function create75InchTv() {
  // 75-inch 16:9 planning model.
  // Active image area is ~1660 x 934 mm; chassis is modelled at 1668 x 942 x 25 mm.
  const width = 1.668;
  const height = 0.942;
  const depth = 0.025;

  const group = new THREE.Group();
  group.name = 'TV_75_INCH';
  group.userData.label = '75 吋電視';

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x101112,
    metalness: 0.16,
    roughness: 0.24,
    clearcoat: 0.32,
    clearcoatRoughness: 0.10
  });

  const screenMat = new THREE.MeshPhysicalMaterial({
    color: 0x090b0d,
    metalness: 0.02,
    roughness: 0.045,
    clearcoat: 0.92,
    clearcoatRoughness: 0.035
  });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    bodyMat
  );
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Near edge-to-edge OLED screen.
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.014, height - 0.014, 0.004),
    screenMat
  );
  screen.position.z = depth / 2 + 0.0025;
  screen.castShadow = false;
  screen.receiveShadow = true;
  group.add(screen);

  // Very thin wall mount plate; hidden from normal front view.
  const mount = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.30, 0.010),
    new THREE.MeshStandardMaterial({
      color: 0x2b2d2f,
      metalness: 0.52,
      roughness: 0.42
    })
  );
  mount.position.z = -depth / 2 - 0.004;
  group.add(mount);

  return group;
}

function createLivingTvWall() {
  // Actual wall plane: x≈6.1346 m, z≈0 to -1.99 m.
  // Panel covers nearly the full clear wall width while leaving a discreet
  // architectural reveal at both vertical edges.
  const wallWidth = 1.95;
  const wallHeight = 2.48;
  const backerDepth = 0.018;
  const slatWidth = 0.030;
  const slatGap = 0.014;
  const slatDepth = 0.035;

  const group = new THREE.Group();
  group.name = 'Living_TV_Slat_Wall_TV_75_INCH';
  group.userData.editable = true;
  group.userData.componentId = 'living-tv-slat-wall';
  group.userData.label = '木格柵電視牆 + 75 吋電視';
  group.userData.floorY = 0;
  group.userData.snapAngleOffset = 0;
  // Wall-mounted components must remain square to the room.
  // While dragging they magnetise near 90-degree axes; on release they always
  // finish exactly at 0 / 90 / 180 / 270 degrees.
  group.userData.forceRoomAngleSnap = true;

  // Keep only a hairline tolerance so the backer can sit flush to a wall
  // without allowing the complete panel to pass through wall geometry.
  group.userData.wallClearance = 0.00025;
  group.userData.variant = TV_WALL_DEFAULT_STATE.variant;
  group.userData.productSize = {
    wallWidth,
    wallHeight,
    tvWidth: 1.668,
    tvHeight: 0.942,
    tvDepth: 0.025
  };

  const backerMat = new THREE.MeshStandardMaterial({
    color: 0x242321,
    roughness: 0.94,
    metalness: 0
  });

  const slatMat = new THREE.MeshStandardMaterial({
    color: TV_WALL_VARIANTS['light-oak'].color,
    roughness: 0.72,
    metalness: 0.01,
    map: getWoodTexture('light-oak', 'roomDoor')
  });

  const backer = new THREE.Mesh(
    new THREE.BoxGeometry(wallWidth, wallHeight, backerDepth),
    backerMat
  );
  backer.position.set(0, wallHeight / 2, 0);
  backer.castShadow = true;
  backer.receiveShadow = true;
  backer.name = 'TVWall_acoustic_backer';
  group.add(backer);

  const step = slatWidth + slatGap;
  const slatCount = Math.floor((wallWidth + slatGap) / step);
  const usedWidth = slatCount * slatWidth + (slatCount - 1) * slatGap;
  const startX = -usedWidth / 2 + slatWidth / 2;
  const slatGeo = new THREE.BoxGeometry(slatWidth, wallHeight, slatDepth);

  for (let i = 0; i < slatCount; i++) {
    const slat = new THREE.Mesh(slatGeo, slatMat);
    slat.position.set(
      startX + i * step,
      wallHeight / 2,
      backerDepth / 2 + slatDepth / 2
    );
    slat.castShadow = true;
    slat.receiveShadow = true;
    slat.name = 'TVWall_slat_' + i;
    group.add(slat);
  }

  // LG G6 Gallery Series: zero-gap visual treatment, centered on wall.
  const tv = create75InchTv();
  tv.position.set(
    0,
    1.26,
    backerDepth / 2 + slatDepth + 0.018
  );
  group.add(tv);

  group._slatMaterial = slatMat;
  group._tv = tv;

  const pickProxy = new THREE.Mesh(
    new THREE.BoxGeometry(wallWidth, wallHeight, 0.22),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );
  pickProxy.position.set(0, wallHeight / 2, 0.06);
  pickProxy.userData.pickProxy = true;
  group.add(pickProxy);

  applyTvWallVariant(group, TV_WALL_DEFAULT_STATE.variant, false);
  return group;
}

function applyTvWallVariant(tvWall, variantId, save = true) {
  const variant = TV_WALL_VARIANTS[variantId];
  if (!tvWall || !variant) return false;

  tvWall.userData.variant = variantId;

  const material = tvWall._slatMaterial;
  if (material) {
    material.color.setHex(variant.color);
    material.map = variant.texture
      ? getWoodTexture(variant.texture, 'roomDoor')
      : null;
    material.roughness = variantId === 'shadow-black' ? 0.78 : 0.72;
    material.needsUpdate = true;
  }

  if (save) saveTvWallState(tvWall);
  syncLibraryUI();
  return true;
}

function setTvWallVariantFromLibrary(variantId) {
  if (!TV_WALL_VARIANTS[variantId]) return;

  let tvWall = getCurrentTvWall();

  if (!tvWall) {
    const saved = readTvWallState();
    const state = {
      ...(saved || TV_WALL_DEFAULT_STATE),
      exists: true,
      variant: variantId
    };
    tvWall = createLivingTvWall();
    applyTvWallState(tvWall, state);
    editableRoot.add(tvWall);
    placeNewEditableAtPlanCenter(tvWall, 0);
  }

  applyTvWallVariant(tvWall, variantId, true);
  selectEditable(tvWall);
  setStatus(
    '木格柵電視牆 · ' +
    TV_WALL_VARIANTS[variantId].label +
    ' · 75 吋電視'
  );
}

function createW3WindowDaybed() {
  // Actual W3 niche side-wall faces measured from the GLB:
  // left interior face  x ~= 3.1195 m
  // right interior face x ~= 5.9853 m
  // clear wall-to-wall span ~= 2.8658 m.
  // Use 2.868 m so the custom millwork scribes a fraction into both walls
  // and leaves no visible light gap.
  const width = 2.868;
  const depth = 0.62;
  const topHeight = 0.44;
  const lidThickness = 0.040;
  const carcassHeight = topHeight - lidThickness;
  const panelThickness = 0.018;
  const lidGap = 0.004;

  const group = new THREE.Group();
  group.name = 'W3_Window_3Lift_Storage_Daybed';
  group.userData.editable = true;
  group.userData.componentId = 'w3-window-daybed';
  group.userData.label = 'W3 窗邊三片上掀收納臥榻';
  group.userData.floorY = 0;
  group.userData.snapAngleOffset = 0;
  group.userData.wallClearance = -0.018;
  group.userData.lidsOpen = false;
  group.userData.productSize = {
    width,
    depth,
    topHeight,
    lidThickness,
    lidCount: 3
  };

  const oakMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.70,
    metalness: 0,
    map: getWoodTexture('light-oak', 'roomDoor')
  });

  const carcassMat = new THREE.MeshStandardMaterial({
    color: 0xf0efeb,
    roughness: 0.80,
    metalness: 0
  });

  const interiorMat = new THREE.MeshStandardMaterial({
    color: 0xd8d4cc,
    roughness: 0.84,
    metalness: 0
  });

  const seamMat = new THREE.MeshStandardMaterial({
    color: 0x9d866c,
    roughness: 0.78,
    metalness: 0
  });

  const hingeMat = new THREE.MeshStandardMaterial({
    color: 0x7a7d7d,
    metalness: 0.65,
    roughness: 0.38
  });

  function addBox(w, h, d, x, y, z, material, name='') {
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 4, Math.min(0.008, h * 0.18)),
      material
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    group.add(mesh);
    return mesh;
  }

  // Storage box shell. The room-facing front is one clean uninterrupted panel:
  // no drawers and no exposed cabinet doors.
  addBox(
    width,
    panelThickness,
    depth - 0.035,
    0,
    panelThickness / 2,
    0.012,
    interiorMat,
    'Daybed_storage_bottom'
  );

  addBox(
    width,
    carcassHeight - panelThickness,
    panelThickness,
    0,
    panelThickness + (carcassHeight - panelThickness) / 2,
    -depth / 2 + panelThickness / 2,
    carcassMat,
    'Daybed_storage_front'
  );

  addBox(
    width,
    carcassHeight - panelThickness,
    panelThickness,
    0,
    panelThickness + (carcassHeight - panelThickness) / 2,
    depth / 2 - panelThickness / 2,
    carcassMat,
    'Daybed_storage_back'
  );

  [-width/2 + panelThickness/2, width/2 - panelThickness/2].forEach((x, idx) => {
    addBox(
      panelThickness,
      carcassHeight - panelThickness,
      depth - panelThickness*2,
      x,
      panelThickness + (carcassHeight - panelThickness) / 2,
      0,
      carcassMat,
      'Daybed_storage_side_' + idx
    );
  });

  // Two internal dividers produce three actual storage compartments.
  const compartmentW = width / 3;
  [-compartmentW / 2, compartmentW / 2].forEach((x, idx) => {
    addBox(
      panelThickness,
      carcassHeight - 0.035,
      depth - panelThickness*2,
      x,
      panelThickness + (carcassHeight - 0.035) / 2,
      0,
      interiorMat,
      'Daybed_storage_divider_' + idx
    );
  });

  // Slight recessed toe shadow so the built-in reads as millwork, not a block.
  addBox(
    width - 0.06,
    0.055,
    0.035,
    0,
    0.035,
    -depth / 2 - 0.002,
    seamMat,
    'Daybed_toe_shadow'
  );

  // Three independent timber lids. Each hinge pivot sits at the rear edge;
  // positive X rotation raises the room-facing/front edge.
  const lidPivots = [];
  const lidW = (width - lidGap * 4) / 3;
  const rearZ = depth / 2;

  for (let i = 0; i < 3; i++) {
    const x =
      -width / 2 +
      lidGap +
      lidW / 2 +
      i * (lidW + lidGap);

    const pivot = new THREE.Group();
    pivot.name = 'Daybed_lid_pivot_' + i;
    pivot.position.set(
      x,
      topHeight - lidThickness / 2,
      rearZ
    );

    const lid = new THREE.Mesh(
      new RoundedBoxGeometry(
        lidW,
        lidThickness,
        depth - 0.010,
        5,
        0.010
      ),
      oakMat
    );
    lid.position.set(
      0,
      0,
      -(depth - 0.010) / 2
    );
    lid.castShadow = true;
    lid.receiveShadow = true;
    lid.name = 'Daybed_lift_lid_' + i;
    pivot.add(lid);

    // Discreet finger recess on the front edge.
    const fingerPull = new THREE.Mesh(
      new RoundedBoxGeometry(
        0.090,
        0.010,
        0.012,
        3,
        0.004
      ),
      seamMat
    );
    fingerPull.position.set(
      0,
      -lidThickness / 2 + 0.004,
      -(depth - 0.010) + 0.010
    );
    fingerPull.name = 'Daybed_finger_pull_' + i;
    pivot.add(fingerPull);

    // Hidden rear hinge cylinders, only clearly visible when the lid is open.
    [-lidW*0.28, lidW*0.28].forEach((hx, hIdx) => {
      const hinge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.010, 0.010, 0.060, 18),
        hingeMat
      );
      hinge.rotation.z = Math.PI / 2;
      hinge.position.set(
        hx,
        -lidThickness / 2 - 0.008,
        -0.018
      );
      hinge.name = 'Daybed_hidden_hinge_' + i + '_' + hIdx;
      pivot.add(hinge);
    });

    group.add(pivot);
    lidPivots.push(pivot);
  }

  group._lidPivots = lidPivots;

  // Hidden pick proxy. It stays low so opened lids don't make mobile selection
  // awkward and is excluded from collision bounds.
  const pickProxy = new THREE.Mesh(
    new THREE.BoxGeometry(width, topHeight, depth),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );
  pickProxy.position.y = topHeight / 2;
  pickProxy.userData.pickProxy = true;
  group.add(pickProxy);

  applyDaybedLidState(group, false, false);
  return group;
}

function applyDaybedLidState(daybed, open, save = true) {
  if (!daybed) return false;

  const isOpen = open === true;
  const angle = isOpen
    ? THREE.MathUtils.degToRad(67)
    : 0;

  (daybed._lidPivots || []).forEach(pivot => {
    pivot.rotation.x = angle;
  });

  daybed.userData.lidsOpen = isOpen;
  daybed.updateMatrixWorld(true);

  if (save) {
    saveDaybedState(daybed);
  }

  syncLibraryUI();
  return true;
}

function getSofaFabricBumpTexture() {
  if (sofaFabricBumpTexture) return sofaFabricBumpTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  const random = seededRandom(hashString('ija-reims-light-gray-fabric'));

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 4200; i++) {
    const value = 108 + Math.floor(random() * 40);
    ctx.fillStyle = `rgba(${value},${value},${value},0.16)`;
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const r = 0.25 + random() * 0.55;
    ctx.fillRect(x, y, r, r);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5.5, 3.5);
  texture.needsUpdate = true;
  sofaFabricBumpTexture = texture;
  return texture;
}

function createIjaReimsSofa(widthPreset = SOFA_DEFAULT_STATE.widthPreset) {
  const preset = SOFA_WIDTH_PRESETS[widthPreset] || SOFA_WIDTH_PRESETS[SOFA_DEFAULT_STATE.widthPreset];
  const width = preset.width;
  const depth = 0.97;
  const height = 1.04;

  const group = new THREE.Group();
  group.name = 'IJA_Reims_3Seat_' + widthPreset;
  group.userData.editable = true;
  group.userData.componentId = 'ija-reims-3seat';
  group.userData.label = 'IJA 蘭斯 Reims 三人沙發';
  group.userData.widthPreset = widthPreset;
  group.userData.floorY = 0;
  group.userData.snapAngleOffset = 0;
  group.userData.productSize = { width, depth, height };

  const bump = getSofaFabricBumpTexture();

  const fabricMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8d8d5,
    roughness: 0.88,
    metalness: 0,
    sheen: 0.16,
    sheenColor: new THREE.Color(0xffffff),
    sheenRoughness: 0.92,
    bumpMap: bump,
    bumpScale: 0.006
  });

  const sideFabricMat = new THREE.MeshPhysicalMaterial({
    color: 0xc7c8c6,
    roughness: 0.90,
    metalness: 0,
    sheen: 0.10,
    sheenColor: new THREE.Color(0xffffff),
    sheenRoughness: 0.95,
    bumpMap: bump,
    bumpScale: 0.005
  });

  const seamMat = new THREE.MeshStandardMaterial({
    color: 0xb5b6b3,
    roughness: 0.94,
    metalness: 0
  });

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x8f6d4e,
    roughness: 0.68,
    metalness: 0
  });

  const darkWoodMat = new THREE.MeshStandardMaterial({
    color: 0x71533b,
    roughness: 0.72,
    metalness: 0
  });

  function roundedBox(w, h, d, radius, material, name='') {
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 4, radius),
      material
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    group.add(mesh);
    return mesh;
  }

  // Imported solid-wood platform and slim legs.
  const baseW = width - 0.12;
  const base = roundedBox(baseW, 0.075, 0.80, 0.018, woodMat, 'Reims_wood_base');
  base.position.set(0, 0.205, 0.005);

  const legW = 0.055;
  const legH = 0.185;
  const legD = 0.055;
  [
    [-baseW/2 + 0.13, -0.31],
    [ baseW/2 - 0.13, -0.31],
    [-baseW/2 + 0.13,  0.31],
    [ baseW/2 - 0.13,  0.31]
  ].forEach(([x,z], idx) => {
    const leg = roundedBox(legW, legH, legD, 0.008, darkWoodMat, 'Reims_leg_' + idx);
    leg.position.set(x, legH/2, z);
  });

  // Two independent spring-seat cushions.
  const armW = 0.205;
  const innerW = width - armW * 2 - 0.08;
  const seatGap = 0.025;
  const seatW = (innerW - seatGap) / 2;
  const seatY = 0.405;
  const seatZ = 0.075;

  [-1, 1].forEach((side, idx) => {
    const seat = roundedBox(
      seatW,
      0.195,
      0.70,
      0.075,
      fabricMat,
      'Reims_seat_' + idx
    );
    seat.position.set(
      side * (seatW + seatGap) / 2,
      seatY,
      seatZ
    );
  });

  // Broad upholstered arm rests with darker triangular-looking outer mass.
  [-1, 1].forEach((side, idx) => {
    const arm = roundedBox(
      armW,
      0.50,
      0.82,
      0.075,
      sideFabricMat,
      'Reims_arm_' + idx
    );
    arm.position.set(
      side * (width/2 - armW/2),
      0.455,
      0.015
    );

    const cap = roundedBox(
      armW * 0.80,
      0.11,
      0.58,
      0.050,
      fabricMat,
      'Reims_arm_cap_' + idx
    );
    cap.position.set(
      side * (width/2 - armW/2),
      0.690,
      0.055
    );
  });

  // Back support frame, kept visually light like the reference sofa.
  const backRail = roundedBox(
    width - 0.30,
    0.33,
    0.11,
    0.028,
    sideFabricMat,
    'Reims_back_support'
  );
  backRail.position.set(0, 0.655, -0.345);

  // Two large loose back cushions, slightly reclined.
  const backGap = 0.025;
  const backW = (innerW - backGap) / 2;

  [-1, 1].forEach((side, idx) => {
    const back = roundedBox(
      backW,
      0.43,
      0.19,
      0.065,
      fabricMat,
      'Reims_back_cushion_' + idx
    );
    back.position.set(
      side * (backW + backGap) / 2,
      0.735,
      -0.285
    );
    back.rotation.x = THREE.MathUtils.degToRad(-7);
  });

  // Subtle piping / seam between the two seat cushions and back cushions.
  const seatSeam = roundedBox(
    0.010,
    0.120,
    0.57,
    0.004,
    seamMat,
    'Reims_seat_center_seam'
  );
  seatSeam.position.set(0, 0.445, seatZ + 0.015);

  // One adjustable headrest, as shown in the supplied Reims reference.
  // It is intentionally offset to the RIGHT seat, not centred on the sofa.
  const headrestX = Math.min(width * 0.18, 0.43);
  const headrest = roundedBox(
    Math.min(0.46, width * 0.21),
    0.18,
    0.145,
    0.045,
    fabricMat,
    'Reims_headrest'
  );
  headrest.position.set(headrestX, 0.965, -0.345);
  headrest.rotation.x = THREE.MathUtils.degToRad(-5);

  [-0.12, 0.12].forEach((offset, idx) => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.010, 0.010, 0.115, 16),
      new THREE.MeshStandardMaterial({
        color: 0x777b7c,
        metalness: 0.68,
        roughness: 0.35
      })
    );
    post.position.set(headrestX + offset, 0.875, -0.345);
    post.castShadow = true;
    post.name = 'Reims_headrest_post_' + idx;
    group.add(post);
  });

  // Invisible pick proxy for easy mobile selection.
  const pickProxy = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.02, height * 1.02, depth * 1.02),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );
  pickProxy.position.y = height / 2;
  pickProxy.userData.pickProxy = true;
  group.add(pickProxy);

  return group;
}

function setSofaWidthFromLibrary(widthPreset) {
  const preset = SOFA_WIDTH_PRESETS[widthPreset];
  if (!preset) return;

  const current = getCurrentSofa();
  const saved = current
    ? {
        exists: true,
        x: current.position.x,
        y: 0,
        z: current.position.z,
        rotationY: current.rotation.y,
        widthPreset
      }
    : {
        ...(readSofaState() || SOFA_DEFAULT_STATE),
        exists: true,
        widthPreset
      };

  if (current) {
    if (selectedEditable === current) {
      transformControls.detach();
      selectedEditable = null;
    }
    current.removeFromParent();
  }

  const sofa = createIjaReimsSofa(widthPreset);
  applySofaState(sofa, saved);
  editableRoot.add(sofa);

  if (!current) {
    placeNewEditableAtPlanCenter(sofa, 0);
  }

  saveSofaState(sofa);
  selectEditable(sofa);
  syncLibraryUI();

  setStatus(
    'IJA 蘭斯 Reims 三人沙發 · 規劃寬度 ' +
    SOFA_WIDTH_PRESETS[widthPreset].label +
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

    applyFridgeState(fridge, {
      ...(saved || FRIDGE_DEFAULT_STATE),
      exists: true,
      x: 0,
      z: 0,
      rotationY: 0,
      variant: variantId
    });

    editableRoot.add(fridge);
    placeNewEditableAtPlanCenter(fridge, 0);
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
    const behaviorText =
      object.userData?.componentId === 'living-tv-slat-wall'
        ? ' · 位置記憶 / 90° 旋轉磁吸 / 牆面碰撞停止 / 刪除'
        : ' · 可移動 / 旋轉磁吸 / 刪除';
    setStatus((object.userData.label || '元件') + behaviorText);
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
  } else if (componentId === 'ija-reims-3seat') {
    saveSofaDeletedState();
  } else if (componentId === 'w3-window-daybed') {
    saveDaybedDeletedState();
  } else if (componentId === 'living-tv-slat-wall') {
    saveTvWallDeletedState();
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
      './model/part-' + String(i).padStart(2, '0') + '.txt?v=20261005-tv-75inch-v4'
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
    const sofa = restoreOrCreateSofa();
    const daybed = restoreOrCreateDaybed();
    const tvWall = restoreOrCreateTvWall();
    syncLibraryUI();

    welcome.classList.add('hidden');
    fitBtn.disabled = false;
    if (exportBtn) exportBtn.disabled = false;

    modeBadge.textContent = '空屋擬真 · 西北向';
    modelInfo.textContent =
      meshCount + ' meshes · ' +
      (glbBuffer.byteLength / 1048576).toFixed(2) + ' MB';
    setStatus(
      '1004 · CENTRO + Reims + W3 臥榻 + 木格柵電視牆 + 75 吋電視 已配置'
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
