import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const plan=JSON.parse(fs.readFileSync(new URL('../../case/plan.json',import.meta.url),'utf8'));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const pointLineDistance=(p,a,b)=>{
 const dx=b[0]-a[0], dz=b[1]-a[1], l2=dx*dx+dz*dz;
 const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/l2));
 return Math.hypot(p[0]-(a[0]+t*dx),p[1]-(a[1]+t*dz));
};
test('W3 is a 2680 x 1900 opening with 500 sill embedded in its wall',()=>{
 const op=plan.openings.find(x=>x.id==='op-w3-living');
 assert.ok(op);
 assert.ok(['window','sliding'].includes(op.type));
 assert.ok(Math.abs(dist(op.a,op.b)-2.68)<=0.005,dist(op.a,op.b));
 assert.equal(op.sill,0.5);
 assert.equal(op.head,2.4);
 const wall=plan.walls.find(w=>w.id===op.wall);
 assert.ok(wall,'referenced wall exists');
 for(const p of [op.a,op.b]) assert.ok(pointLineDistance(p,wall.a,wall.b)<0.002,'opening endpoint lies on wall centreline');
 const wallLen=dist(wall.a,wall.b);
 assert.ok(dist(wall.a,op.a)<=wallLen && dist(wall.a,op.b)<=wallLen,'opening span is inside wall');
});