import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const plan=JSON.parse(fs.readFileSync(new URL('../../case/plan.json',import.meta.url),'utf8'));

test('空屋版不包含冰箱與系統櫃固定物件',()=>{
  const forbidden=new Set(['appliance-fridge','wardrobe']);
  const remaining=(plan.fixedElements||[]).filter(x=>forbidden.has(x.kind));
  assert.deepEqual(remaining,[]);
});
