import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {planBounds} from '../src/shell.js';

const plan=JSON.parse(fs.readFileSync(new URL('../../case/plan.json',import.meta.url),'utf8'));

test('viewer plan bounds include fixed structural elements outside room polygons',()=>{
  const bounds=planBounds(plan);
  const maxFixedZ=Math.max(...plan.fixedElements.map(f=>f.bounds.z+f.bounds.depth/2));
  const minFixedX=Math.min(...plan.fixedElements.map(f=>f.bounds.x-f.bounds.width/2));
  const maxFixedX=Math.max(...plan.fixedElements.map(f=>f.bounds.x+f.bounds.width/2));
  assert.ok(bounds.maxZ>=maxFixedZ-1e-6,{bounds:bounds.maxZ,maxFixedZ});
  assert.ok(bounds.minX<=minFixedX+1e-6,{bounds:bounds.minX,minFixedX});
  assert.ok(bounds.maxX>=maxFixedX-1e-6,{bounds:bounds.maxX,maxFixedX});
});
