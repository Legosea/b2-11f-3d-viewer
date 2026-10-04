import * as THREE from 'three';
import shellData from './v6-data-shell.js';
import railingData from './v6-data-railing.js';
import bathroomBoxes from './v6-data-bathroom.js';

function geometryFrom(data){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
  g.setIndex(data.indices);
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
function box(parent,size,pos,material,name){
  const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
  m.position.set(...pos); m.name=name; m.castShadow=true; m.receiveShadow=true; parent.add(m); return m;
}
function windowFrame(parent,def,material){
  const g=new THREE.Group(); g.name=def.id; parent.add(g);
  const [minX,minY,minZ]=def.min, [maxX,maxY,maxZ]=def.max;
  const w=maxX-minX,h=maxY-minY,d=Math.max(0.055,maxZ-minZ);
  const cx=(minX+maxX)/2, cy=(minY+maxY)/2, cz=(minZ+maxZ)/2;
  const t=0.045;
  box(g,[w,t,d],[cx,minY+t/2,cz],material,def.id+'-bottom');
  box(g,[w,t,d],[cx,maxY-t/2,cz],material,def.id+'-top');
  box(g,[t,h,d],[minX+t/2,cy,cz],material,def.id+'-left');
  box(g,[t,h,d],[maxX-t/2,cy,cz],material,def.id+'-right');
  if(def.id==='W3'){
    let x=minX+0.79;
    for(const seg of [0,1.10]){
      if(seg) x+=seg;
      box(g,[t,h,d],[x,cy,cz],material,'W3-mullion');
    }
    box(g,[w,t,d],[cx,minY+0.80,cz],material,'W3-rail');
  }else{
    box(g,[t,h,d],[cx,cy,cz],material,def.id+'-mullion');
  }
  return g;
}

export const V6_WINDOWS=[
  {id:'W-left',sourceInstance:6,min:[0.79606,0.50,-1.34335],max:[2.47029,2.40,-1.19408]},
  {id:'W-right-bed',sourceInstance:7,min:[7.90583,1.20,-1.99014],max:[9.05017,2.40,-1.84088]},
  {id:'W-right-bath',sourceInstance:8,min:[9.55268,1.20,-0.99507],max:[10.34873,2.40,-0.84581]},
  {id:'W3',sourceInstance:13,min:[3.213216,0.50,-0.64680],max:[5.893216,2.40,-0.49754]}
];

export function loadV6Architecture(scene){
  const root=new THREE.Group(); root.name='B2-11F-v6-SKP-calibrated'; scene.add(root);
  const mats={
    shell:new THREE.MeshStandardMaterial({color:0xeee9df,roughness:0.92,side:THREE.DoubleSide,flatShading:true}),
    frame:new THREE.MeshStandardMaterial({color:0x3d4143,roughness:0.48,metalness:0.35}),
    railing:new THREE.MeshStandardMaterial({color:0x555b5e,roughness:0.42,metalness:0.45,side:THREE.DoubleSide}),
    fixture:new THREE.MeshStandardMaterial({color:0xf2f0ea,roughness:0.72})
  };
  const shell=new THREE.Mesh(geometryFrom(shellData),mats.shell); shell.name='skp-shell'; shell.castShadow=true; shell.receiveShadow=true; root.add(shell);
  const railing=new THREE.Mesh(geometryFrom(railingData),mats.railing); railing.name='skp-balcony-railing'; railing.castShadow=true; root.add(railing);
  const windows=new THREE.Group(); windows.name='skp-window-frames'; root.add(windows);
  V6_WINDOWS.forEach(w=>windowFrame(windows,w,mats.frame));
  const fixtures=new THREE.Group(); fixtures.name='fixed-bathroom-fixtures'; root.add(fixtures);
  for(const b of bathroomBoxes){
    const size=b.max.map((v,i)=>Math.max(0.02,v-b.min[i]));
    const pos=b.max.map((v,i)=>(v+b.min[i])/2);
    box(fixtures,size,pos,mats.fixture,b.id);
  }
  const bounds=new THREE.Box3().setFromObject(root);
  return {root,bounds,windows,fixtures,source:'1004.skp',units:'m'};
}
