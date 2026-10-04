import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import './v6-style.css';
import {loadV6Architecture} from './v6-architecture.js';

const app=document.querySelector('#app');
app.innerHTML=`
<header><div><b>B2-11F · v6</b><span>SketchUp 幾何 × CAD/PDF 尺寸校正</span></div><div class="badge">空屋白模</div></header>
<main><div id="viewport"></div><div class="toolbar">
<button data-view="axon" class="active">鳥瞰</button><button data-view="top">平面</button><button data-view="orbit">自由</button><button data-view="inside">室內</button>
</div><aside><b>幾何基準</b><br>1004.skp：形狀/拓撲<br>CAD/PDF：可確認尺寸<br><br>W3：2680 × 1900 mm<br>窗台：500 mm<br>樓高：3300 mm</aside></main>`;

const viewport=document.querySelector('#viewport');
const scene=new THREE.Scene(); scene.background=new THREE.Color(0xe6e1d9);
const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=0.92; viewport.appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(42,1,0.05,100);
const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.dampingFactor=.07;
scene.add(new THREE.HemisphereLight(0xfffbf2,0x8a8a86,2.0));
const sun=new THREE.DirectionalLight(0xfff3df,3.2); sun.position.set(-4,10,7); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); scene.add(sun);
const architecture=loadV6Architecture(scene);
const size=new THREE.Vector3(),center=new THREE.Vector3(); architecture.bounds.getSize(size); architecture.bounds.getCenter(center);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(size.x+4,size.z+4),new THREE.ShadowMaterial({opacity:.12})); floor.rotation.x=-Math.PI/2; floor.position.set(center.x,-.035,center.z); floor.receiveShadow=true; scene.add(floor);
controls.target.copy(center).setY(1.05);

function setView(name){
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  if(name==='top') camera.position.set(center.x,Math.max(size.x,size.z)*1.55+5,center.z+.001);
  else if(name==='inside') camera.position.set(center.x,1.55,center.z+1.45);
  else if(name==='orbit') camera.position.set(center.x+8,6.8,center.z+8);
  else camera.position.set(center.x+8.6,7.4,center.z+8.8);
  controls.target.set(center.x,name==='inside'?1.45:1.0,name==='inside'?center.z-2.5:center.z);
  camera.lookAt(controls.target); controls.update();
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
function resize(){const w=viewport.clientWidth,h=viewport.clientHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(viewport); resize(); setView('axon');
function loop(){requestAnimationFrame(loop);controls.update();renderer.render(scene,camera);} loop();
window.v6={scene,camera,controls,architecture,setView};
