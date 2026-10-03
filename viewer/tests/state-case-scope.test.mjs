import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  constructor(){this.map=new Map();}
  getItem(k){return this.map.has(k)?this.map.get(k):null;}
  setItem(k,v){this.map.set(k,String(v));}
  removeItem(k){this.map.delete(k);}
}
globalThis.localStorage=new MemoryStorage();
const state=await import('../src/state.js');

test('current and saved records are scoped by case id and ignore legacy global keys',()=>{
  localStorage.setItem('idm-current',JSON.stringify({layout:[{productId:'legacy'}]}));
  state.saveCurrent('b2-11f',{layout:[{productId:'b2'}]});
  assert.equal(state.loadCurrent('other-case'),null);
  assert.deepEqual(state.loadCurrent('b2-11f').layout,[{productId:'b2'}]);
  state.pushSaved('b2-11f',{layout:[{productId:'saved'}]});
  assert.equal(state.loadSaved('other-case').length,0);
  assert.equal(state.loadSaved('b2-11f').length,1);
});

test('initial state precedence is share, scoped current, case layout, empty',()=>{
  const caseState={layout:[{productId:'seed',x:1,z:2,ry:0,y:0}]};
  const noShare=state.resolveInitialState({hash:'',caseId:'fresh-case',caseState});
  assert.deepEqual(noShare.layout,caseState.layout);
  state.saveCurrent('fresh-case',{layout:[{productId:'current'}]});
  assert.deepEqual(state.resolveInitialState({hash:'',caseId:'fresh-case',caseState}).layout,[{productId:'current'}]);
  const hash='#'+state.encodeState({layout:[{productId:'share',x:3,z:4,ry:0,y:0}]});
  assert.deepEqual(state.resolveInitialState({hash,caseId:'fresh-case',caseState}).layout[0].productId,'share');
  assert.deepEqual(state.resolveInitialState({hash:'',caseId:'empty-case',caseState:{}}).layout,[]);
});
