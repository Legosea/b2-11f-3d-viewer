import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import shell from '../src/v6-data-shell.js';

const manifest=JSON.parse(fs.readFileSync(new URL('../../case-v6/evidence/skp-manifest.json',import.meta.url),'utf8'));

test('v6 dollhouse excludes the SketchUp global top-cap face',()=>{
  assert.deepEqual(manifest.presentationFilter?.excludedRootFaceIds,[2953]);
  let horizontalHighTriangles=0;
  for(let i=0;i<shell.indices.length;i+=3){
    const ids=[shell.indices[i],shell.indices[i+1],shell.indices[i+2]];
    const ys=ids.map(id=>shell.positions[id*3+1]);
    if(ys.every(y=>y>2.55)) horizontalHighTriangles++;
  }
  assert.equal(horizontalHighTriangles,0,'2.6m global top-cap triangles must not remain');
});
