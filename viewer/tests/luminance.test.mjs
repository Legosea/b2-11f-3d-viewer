import test from 'node:test';
import assert from 'node:assert/strict';
import {luminanceStats} from '../scripts/luminance.mjs';

test('luminance guard distinguishes balanced and clipped frames',()=>{
  const balanced=new Uint8ClampedArray([
    180,160,140,255, 210,200,190,255,
    120,110,100,255, 235,225,215,255
  ]);
  const a=luminanceStats(balanced);
  assert.ok(a.mean<0.88,a.mean);
  assert.ok(a.highlightRatio<0.45,a.highlightRatio);

  const clipped=new Uint8ClampedArray([
    255,255,255,255, 255,255,255,255,
    250,250,250,255, 250,250,250,255
  ]);
  const b=luminanceStats(clipped);
  assert.ok(b.mean>0.88,b.mean);
  assert.ok(b.highlightRatio>0.45,b.highlightRatio);
});
