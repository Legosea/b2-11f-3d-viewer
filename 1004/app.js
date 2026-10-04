import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const OPENSKP_ESM = 'https://esm.sh/openskp@1.3.0?bundle';
const OPENSKP_WASM_JS = './vendor/openskp.js';
const OPENSKP_WASM_BASE = 'https://cdn.jsdelivr.net/gh/iamahsanmehmood/openskp@python-v1.3.0/examples/web-viewer/wasm/';
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

let scene, camera, renderer, controls, modelRoot, stagingRoot, sunLight, composer, ssaoPass;
let orthoSize = 12;
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
  scene.background = new THREE.Color(0xd9d3c9);

  camera = new THREE.OrthographicCamera(-6, 6, 6, -6, 0.01, 500);
  camera.position.set(10, 9, 10);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.72;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xd9d3c9, 1);
  viewport.appendChild(renderer.domElement);

  scene.environment = null;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.85;
  controls.minZoom = 0.55;
  controls.maxZoom = 4.0;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(5, 1, -3);

  scene.add(new THREE.HemisphereLight(0xfff7e8, 0xa79f94, 0.46));
  scene.add(new THREE.AmbientLight(0xffffff, 0.035));

  sunLight = new THREE.DirectionalLight(0xffedcc, 1.22);
  sunLight.position.set(10, 16, 9);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.radius = 3;
  sunLight.shadow.bias = -0.00015;
  sunLight.target.position.set(5, 0, -3);
  scene.add(sunLight);
  scene.add(sunLight.target);

  const fill = new THREE.DirectionalLight(0xdbe4ee, 0.10);
  fill.position.set(-8, 7, -10);
  scene.add(fill);

  stagingRoot = new THREE.Group();
  scene.add(stagingRoot);

  modelRoot = new THREE.Group();
  scene.add(modelRoot);

  nordicWoodTexture = createWoodTexture();

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  ssaoPass = new SSAOPass(scene, camera, 1, 1);
  ssaoPass.kernelRadius = 0.18;
  ssaoPass.minDistance = 0.001;
  ssaoPass.maxDistance = 0.055;
  ssaoPass.output = SSAOPass.OUTPUT.Default;
  composer.addPass(ssaoPass);
  composer.addPass(new OutputPass());

  window.addEventListener('resize', resize);
  resize();
  renderer.setAnimationLoop(() => {
    controls.update();
    composer.render();
  });
}

function resize() {
  const w = Math.max(1, viewport.clientWidth);
  const h = Math.max(1, viewport.clientHeight);
  const aspect = w / h;

  camera.left = -orthoSize * aspect * 0.5;
  camera.right = orthoSize * aspect * 0.5;
  camera.top = orthoSize * 0.5;
  camera.bottom = -orthoSize * 0.5;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h, false);
  composer?.setSize(w, h);
  ssaoPass?.setSize(w, h);
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

function classifyArchitectureMesh(mesh) {
  mesh.geometry?.computeBoundingBox();
  const local = mesh.geometry?.boundingBox;
  if (!local) return 'other';

  mesh.updateWorldMatrix(true, false);
  const box = local.clone().applyMatrix4(mesh.matrixWorld);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const footprint = Math.max(size.x * size.z, 0);

  // Large thin horizontal surfaces close to the lowest architectural level
  // are treated as floor slabs. This avoids relying on inconsistent SKP
  // material names after conversion.
  if (
    size.y < 0.22 &&
    footprint > 1.0 &&
    center.y < 0.65
  ) {
    return 'floor';
  }

  // Tall broad surfaces are primarily walls.
  if (size.y > 1.4 && Math.max(size.x, size.z) > 0.7) {
    return 'wall';
  }

  return 'other';
}

function styleNordicMaterial(material, mesh, architectureClass = 'other') {
  if (!material) return;

  const name = (material.name || '').toLowerCase();
  const setColor = hex => material.color?.setHex(hex);

  material.metalness = 0.02;
  material.roughness = 0.82;

  if (architectureClass === 'floor') {
    setColor(0xc49b68);
    material.metalness = 0;
    material.roughness = 0.88;
    ensurePlanarUV(mesh.geometry, 0.78);
    material.map = nordicWoodTexture;
    nordicWoodTexture.repeat.set(1.25, 1.25);
  } else if (architectureClass === 'wall') {
    setColor(0xcfc8be);
    material.metalness = 0;
    material.roughness = 0.94;
    material.map = null;
  } else if (name.includes('railing glass') || name.includes('玻璃 窗戶') || name.includes('translucent')) {
    setColor(0xc9d6d3);
    material.transparent = true;
    material.opacity = name.includes('railing') ? 0.36 : 0.30;
    material.roughness = 0.18;
    material.metalness = 0;
    material.depthWrite = false;
  } else if (name.includes('glass railing color')) {
    setColor(0x8b9693);
    material.roughness = 0.42;
    material.metalness = 0.34;
  } else if (
    name.includes('metal') ||
    name.includes('金屬') ||
    name.includes('aluminium') ||
    name.includes('steel') ||
    name.includes('shower')
  ) {
    setColor(0x4f5452);
    material.metalness = 0.52;
    material.roughness = 0.36;
  } else if (
    name.includes('wood') ||
    name.includes('木纹') ||
    name.includes('cherry') ||
    name.includes('1014065') ||
    name.includes('1620856')
  ) {
    setColor(0xc79d69);
    material.metalness = 0;
    material.roughness = 0.78;

    if (name.includes('000__wood__matte')) {
      ensurePlanarUV(mesh.geometry, 0.66);
      material.map = nordicWoodTexture;
      material.color.setHex(0xdfc7a0);
    }
  } else if (name.includes('瓷砖 47')) {
    setColor(0xcfc8be);
    material.roughness = 0.92;
  } else if (name.includes('瓷砖')) {
    setColor(0xddd7cf);
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
    setColor(0xe1dbd2);
    material.roughness = 0.78;
  } else {
    setColor(0xd6cec3);
    material.metalness = 0;
    material.roughness = 0.9;
  }

  material.side = THREE.DoubleSide;
  material.needsUpdate = true;
}

function applyNordicStyle(root) {
  root.updateMatrixWorld(true);

  root.traverse(obj => {
    if (!obj.isMesh) return;

    obj.castShadow = true;
    obj.receiveShadow = true;

    const architectureClass = classifyArchitectureMesh(obj);
    const originals = Array.isArray(obj.material) ? obj.material : [obj.material];
    const cloned = originals.map(mat => {
      if (!mat) return mat;
      const copy = mat.clone();
      styleNordicMaterial(copy, obj, architectureClass);
      return copy;
    });

    obj.material = Array.isArray(obj.material) ? cloned : cloned[0];
  });
}

function roundedBox(w, h, d, material, x, y, z, rotY = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addBed(parent, x, z, rotation = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotation;

  const wood = new THREE.MeshStandardMaterial({ color: 0xbf9260, roughness: 0.82 });
  const fabric = new THREE.MeshStandardMaterial({ color: 0xe8dfd2, roughness: 0.96 });
  const sheet = new THREE.MeshStandardMaterial({ color: 0xd8cdbc, roughness: 0.98 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x758464, roughness: 0.94 });

  g.add(roundedBox(1.7, 0.20, 2.05, wood, 0, 0.12, 0));
  g.add(roundedBox(1.62, 0.23, 1.92, fabric, 0, 0.31, 0.02));
  g.add(roundedBox(1.58, 0.12, 1.25, sheet, 0, 0.49, 0.28));
  g.add(roundedBox(1.72, 0.78, 0.10, wood, 0, 0.55, -1.00));
  g.add(roundedBox(0.58, 0.13, 0.38, fabric, -0.36, 0.54, -0.62));
  g.add(roundedBox(0.58, 0.13, 0.38, fabric, 0.36, 0.54, -0.62));
  g.add(roundedBox(0.38, 0.12, 0.34, accent, 0.10, 0.58, -0.36));

  parent.add(g);
}

function addSofa(parent, x, z, rotation = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotation;

  const fabric = new THREE.MeshStandardMaterial({ color: 0xd8d0c5, roughness: 0.96 });
  const light = new THREE.MeshStandardMaterial({ color: 0xeee8df, roughness: 0.98 });
  const green = new THREE.MeshStandardMaterial({ color: 0x6f7f63, roughness: 0.94 });

  g.add(roundedBox(2.20, 0.34, 0.88, fabric, 0, 0.28, 0));
  g.add(roundedBox(2.18, 0.68, 0.18, fabric, 0, 0.68, -0.36));
  g.add(roundedBox(0.18, 0.54, 0.88, fabric, -1.02, 0.52, 0));
  g.add(roundedBox(0.18, 0.54, 0.88, fabric, 1.02, 0.52, 0));
  g.add(roundedBox(0.58, 0.16, 0.60, light, -0.67, 0.52, 0.02));
  g.add(roundedBox(0.58, 0.16, 0.60, light, 0, 0.52, 0.02));
  g.add(roundedBox(0.58, 0.16, 0.60, light, 0.67, 0.52, 0.02));
  g.add(roundedBox(0.38, 0.13, 0.38, green, 0.52, 0.78, -0.20));

  parent.add(g);
}

function addCoffeeTable(parent, x, z) {
  const wood = new THREE.MeshStandardMaterial({ color: 0xba8d5d, roughness: 0.78 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.055, 40), wood);
  top.position.set(x, 0.40, z);
  top.castShadow = true;
  top.receiveShadow = true;
  parent.add(top);

  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.38, 16), wood);
  leg.position.set(x, 0.19, z);
  leg.castShadow = true;
  parent.add(leg);
}

function addDiningSet(parent, x, z) {
  const wood = new THREE.MeshStandardMaterial({ color: 0xb98956, roughness: 0.82 });
  parent.add(roundedBox(1.34, 0.075, 0.78, wood, x, 0.74, z));

  const legPositions = [
    [-0.53, -0.25], [0.53, -0.25], [-0.53, 0.25], [0.53, 0.25]
  ];
  legPositions.forEach(([dx, dz]) => {
    parent.add(roundedBox(0.07, 0.72, 0.07, wood, x + dx, 0.36, z + dz));
  });

  const chairPositions = [
    [x - 0.48, z - 0.72, 0],
    [x + 0.48, z - 0.72, 0],
    [x - 0.48, z + 0.72, Math.PI],
    [x + 0.48, z + 0.72, Math.PI]
  ];

  chairPositions.forEach(([cx, cz, r]) => {
    const c = new THREE.Group();
    c.position.set(cx, 0, cz);
    c.rotation.y = r;
    c.add(roundedBox(0.42, 0.06, 0.42, wood, 0, 0.46, 0));
    c.add(roundedBox(0.42, 0.58, 0.06, wood, 0, 0.72, 0.18));
    c.add(roundedBox(0.05, 0.46, 0.05, wood, -0.15, 0.23, -0.14));
    c.add(roundedBox(0.05, 0.46, 0.05, wood, 0.15, 0.23, -0.14));
    parent.add(c);
  });
}

function addPlant(parent, x, z, scale = 1) {
  const potMat = new THREE.MeshStandardMaterial({ color: 0xbeb4a7, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x5f7256, roughness: 0.86 });

  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.14 * scale, 0.28 * scale, 24), potMat);
  pot.position.set(x, 0.14 * scale, z);
  pot.castShadow = true;
  pot.receiveShadow = true;
  parent.add(pot);

  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.14 * scale, 18, 12), leafMat);
    const angle = (i / 7) * Math.PI * 2;
    leaf.scale.set(0.62, 1.8, 0.42);
    leaf.rotation.z = (i % 2 ? 1 : -1) * 0.48;
    leaf.position.set(
      x + Math.cos(angle) * 0.16 * scale,
      0.46 * scale + (i % 3) * 0.08 * scale,
      z + Math.sin(angle) * 0.16 * scale
    );
    leaf.castShadow = true;
    parent.add(leaf);
  }
}

function addNordicFurniture(parent) {
  const decor = new THREE.Group();
  decor.name = 'Nordic_Staging';

  const rugMat = new THREE.MeshStandardMaterial({
    color: 0xdcd3c6,
    roughness: 1,
    side: THREE.DoubleSide
  });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.25), rugMat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(4.75, 0.022, -3.85);
  rug.receiveShadow = true;
  decor.add(rug);

  addSofa(decor, 4.65, -4.55, 0);
  addCoffeeTable(decor, 4.70, -3.48);
  addDiningSet(decor, 6.62, -4.60);
  addBed(decor, 1.55, -3.03, 0);
  addBed(decor, 9.50, -4.55, 0);
  addPlant(decor, 3.58, -5.62, 0.95);
  addPlant(decor, 7.28, -3.00, 0.78);

  decor.traverse(obj => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  parent.add(decor);
}

function updatePresentationGround(box) {
  while (stagingRoot.children.length) {
    const child = stagingRoot.children.pop();
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const extent = Math.max(size.x, size.z) * 2.15;

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(extent, extent),
    new THREE.ShadowMaterial({
      color: 0x8f887d,
      transparent: true,
      opacity: 0.34
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(center.x, box.min.y - 0.018, center.z);
  shadow.receiveShadow = true;
  stagingRoot.add(shadow);

  const maxDim = Math.max(size.x, size.y, size.z);
  sunLight.position.set(
    center.x + maxDim * 0.8,
    center.y + maxDim * 1.35,
    center.z + maxDim * 0.65
  );
  sunLight.target.position.copy(center);
  sunLight.shadow.camera.left = -maxDim;
  sunLight.shadow.camera.right = maxDim;
  sunLight.shadow.camera.top = maxDim;
  sunLight.shadow.camera.bottom = -maxDim;
  sunLight.shadow.camera.near = 0.1;
  sunLight.shadow.camera.far = maxDim * 4;
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
  const size = box.getSize(new THREE.Vector3());
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const aspect = Math.max(0.35, viewport.clientWidth / Math.max(1, viewport.clientHeight));

  orthoSize = Math.max(
    sphere.radius * 2.45,
    size.y * 3.0,
    size.x * 1.18 / Math.min(aspect, 1)
  );

  const distance = Math.max(18, sphere.radius * 3.1);
  const viewDir = new THREE.Vector3(1, 0.82, 1).normalize();
  camera.position.copy(center).addScaledVector(viewDir, distance);
  camera.near = 0.01;
  camera.far = distance * 8;
  camera.zoom = 1;
  controls.target.copy(center);
  resize();
  camera.updateProjectionMatrix();
  controls.update();

  updatePresentationGround(box);
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
      './model/part-' + String(i).padStart(2, '0') + '.txt'
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

    applyNordicStyle(gltf.scene);
    modelRoot.add(gltf.scene);
    addNordicFurniture(modelRoot);
    welcome.classList.add('hidden');
    fitBtn.disabled = false;
    exportBtn.disabled = false;

    modeBadge.textContent = '北歐等角 3D';
    modelInfo.textContent =
      meshCount + ' meshes · ' +
      (glbBuffer.byteLength / 1048576).toFixed(2) + ' MB';
    setStatus('1004 · 北歐 / Japandi 即時 3D 已載入');
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
