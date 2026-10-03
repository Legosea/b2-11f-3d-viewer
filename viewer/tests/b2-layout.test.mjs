import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const products=JSON.parse(fs.readFileSync(new URL('../../case/furniture-products.json',import.meta.url),'utf8'));
const state=JSON.parse(fs.readFileSync(new URL('../../case/state.json',import.meta.url),'utf8'));
const plan=JSON.parse(fs.readFileSync(new URL('../../case/plan.json',import.meta.url),'utf8'));
const pointIn=(x,z,pts)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,zi]=pts[i],[xj,zj]=pts[j];if((zi>z)!=(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)c=!c;}return c;};
test('seeded layout is traceable to evidence-backed dimensions and avoids wet rooms',()=>{
 const byId=Object.fromEntries(products.map(p=>[p.id,p]));
 const wet=plan.rooms.filter(r=>['bath','bathroom','wc','wetroom'].includes(String(r.kind).toLowerCase()));
 for(const item of state.layout){
   const p=byId[item.productId]; assert.ok(p,item.productId);
   for(const k of ['width','depth','height']) assert.ok(p.dimensionsMm[k]>0,item.productId+' '+k);
   assert.ok(p.evidence.some(e=>e.sourceUrl===p.dimensionSourceUrl),item.productId+' dimension source');
   assert.ok(['provided-model','licensed-asset','procedural-proxy','conceptual-proxy'].includes(p.geometry.source));
   assert.equal(wet.some(r=>pointIn(item.x,item.z,r.boundary)),false,item.productId+' wet room');
 }
});