import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const plan=JSON.parse(fs.readFileSync(new URL('../../case/plan.json',import.meta.url),'utf8'));

test('B2 topology contains exactly the intended named spaces',()=>{
  const ids=new Set(plan.rooms.map(r=>r.id));
  for(const id of ['rm-left-bath','rm-left-bedroom','rm-open-living','rm-right-bedroom','rm-right-bath','rm-balcony']) assert.ok(ids.has(id),id);
  for(const banned of ['study','corridor','third-bedroom','bedroom-3']) assert.equal([...ids].some(id=>id.includes(banned)),false,banned);
  assert.equal(plan.levels[0].ceilingHeight,3.3);
});

test('room connectivity and fixed wet/structural elements are present',()=>{
  const byId=Object.fromEntries(plan.rooms.map(r=>[r.id,r]));
  for(const id of ['rm-left-bath','rm-left-bedroom','rm-right-bedroom','rm-balcony']) assert.ok(byId['rm-open-living'].connects.includes(id),id);
  assert.ok(byId['rm-right-bedroom'].connects.includes('rm-right-bath'));
  const kinds=plan.fixedElements.map(x=>x.kind);
  assert.ok(kinds.includes('shower'));
  assert.ok(kinds.includes('wc'));
  assert.ok(kinds.includes('basin'));
  assert.ok(kinds.includes('column'));
  assert.ok(kinds.includes('shaft'));
});