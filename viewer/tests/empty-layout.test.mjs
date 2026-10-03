import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const state=JSON.parse(fs.readFileSync(new URL('../../case/state.json',import.meta.url),'utf8'));

test('B2 v5 預設場景不放置任何可移動家具',()=>{
  assert.deepEqual(state.layout,[]);
});
