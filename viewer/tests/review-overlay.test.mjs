import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const json = p => JSON.parse(read(p));

test('review overlay is copied with case data and exposed by viewer API',()=>{
  const link=read('../scripts/link-case.mjs');
  const app=read('../src/app.js');
  const main=read('../src/main.js');
  assert.match(link,/plan-overlay\.svg/);
  assert.ok(fs.existsSync(new URL('../src/review-overlay.js', import.meta.url)));
  assert.match(app,/setReviewOverlay/);
  assert.match(app,/getReviewOverlay/);
  assert.match(main,/id="reviewOverlay"/);
  assert.match(main,/reviewOverlayUrl/);
});

test('review overlay sits above the finished floor and uses the exact shell bounds',()=>{
  const shell=read('../src/shell.js');
  const overlay=read('../src/review-overlay.js');
  assert.match(shell,/export const FLOOR_SURFACE_Y\s*=\s*FLOOR_Y\s*\+\s*SLAB/);
  assert.match(overlay,/FLOOR_SURFACE_Y/);
  assert.match(overlay,/FLOOR_SURFACE_Y\s*\+\s*REVIEW_OFFSET/);

  const plan=json('../../case/plan.json');
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  const eat=(x,z)=>{minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);};
  for(const room of plan.rooms||[])for(const [x,z] of room.boundary||[])eat(x,z);
  for(const wall of plan.walls||[]){
    const half=(wall.thickness||0.1)/2;
    for(const [x,z] of [wall.a,wall.b]){
      eat(x-half,z-half); eat(x+half,z+half);
    }
  }
  const svg=read('../../case/output/plan-overlay.svg');
  const match=svg.match(/viewBox="([^"]+)"/);
  assert.ok(match,'overlay SVG has a viewBox');
  const [vx,vz,vw,vd]=match[1].trim().split(/\s+/).map(Number);
  assert.ok(Math.abs(vx-minX)<0.001,{vx,minX});
  assert.ok(Math.abs(vz-minZ)<0.001,{vz,minZ});
  assert.ok(Math.abs(vw-(maxX-minX))<0.001,{vw,width:maxX-minX});
  assert.ok(Math.abs(vd-(maxZ-minZ))<0.001,{vd,depth:maxZ-minZ});
});
