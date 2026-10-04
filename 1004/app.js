import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const OPENSKP_ESM = 'https://esm.sh/openskp@1.3.0?bundle';
const OPENSKP_WASM_JS = 'https://iamahsanmehmood.github.io/openskp/wasm/openskp.js';
const OPENSKP_WASM_BASE = 'https://iamahsanmehmood.github.io/openskp/wasm/';
const LARGE_FILE_BYTES = 50 * 1024 * 1024;

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

let scene, camera, renderer, controls, modelRoot;
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
  scene.background = new THREE.Color(0x0f1116);

  camera = new THREE.PerspectiveCamera(48, 1, 0.01, 5000);
  camera.position.set(8, 6, 8);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  viewport.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 1, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x303844, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(12, 20, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  const grid = new THREE.GridHelper(30, 30, 0x394150, 0x222833);
  grid.position.y = -0.002;
  scene.add(grid);

  modelRoot = new THREE.Group();
  scene.add(modelRoot);

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
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.1);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.55;

  camera.near = Math.max(0.001, maxDim / 10000);
  camera.far = Math.max(1000, distance * 30);
  camera.updateProjectionMatrix();

  camera.position.set(center.x + distance * 0.75, center.y + distance * 0.55, center.z + distance * 0.75);
  controls.target.copy(center);
  controls.minDistance = camera.near * 5;
  controls.maxDistance = distance * 20;
  controls.update();
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
  // 若之後把 1004.skp 放進同一個 GitHub 目錄，頁面會自動抓取並載入。
  try {
    const head = await fetch('./1004.skp', { method: 'HEAD', cache: 'no-store' });
    if (!head.ok) return;
    const response = await fetch('./1004.skp', { cache: 'no-store' });
    if (!response.ok) return;
    const buffer = await response.arrayBuffer();
    currentFilename = '1004.skp';
    await loadBuffer(buffer, currentFilename, buffer.byteLength >= LARGE_FILE_BYTES);
  } catch {
    // 目前 repository 沒有模型檔時保持手動選檔介面。
  }
}
