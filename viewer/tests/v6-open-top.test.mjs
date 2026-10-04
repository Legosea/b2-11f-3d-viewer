import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import shell from '../src/v6-data-shell.js';

const manifest=JSON.parse(fs.readFileSync(new URL('../../case-v6/evidence/skp-manifest.json',import.meta.url),'utf8'));

test('v6 dollhouse excludes the SketchUp global top-cap face',()=>{
  assert.deepEqual(manifest.presentationFilter?.excludedRootFaceIds,[2953]);
  let largestHighSpan=0;
  for(let i=0;i<shell.indices.length;i+=3){
    const ids=[shell.indices[i],shell.indices[i+1],shell.indices[i+2]];
    const pts=ids.map(id=>[
      shell.positions[id*3],
      shell.positions[id*3+1],
      shell.positions[id*3+2]
    ]);
    if(!pts.every(p=>p[1]>2.55)) continue;
    const xs=pts.map(p=>p[0]), zs=pts.map(p=>p[2]);
    largestHighSpan=Math.max(
      largestHighSpan,
      Math.max(...xs)-Math.min(...xs),
      Math.max(...zs)-Math.min(...zs)
    );
  }
  assert.ok(largestHighSpan<1.0,`global top-cap span remains: ${largestHighSpan}m`);
});
