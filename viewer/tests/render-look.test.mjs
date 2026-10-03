import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');

test('v5 warm dollhouse render defaults avoid white-model overexposure',()=>{
  const render=read('../src/render.js');
  const lighting=read('../src/lighting.js');
  const shell=read('../src/shell.js');
  const materials=read('../src/materials.js');
  const app=read('../src/app.js');
  assert.match(render,/toneMappingExposure\s*=\s*0\.82/);
  assert.match(render,/scene\.background\s*=\s*new T\.Color\('#e7e3de'\)/);
  assert.match(lighting,/HemisphereLight\(0xfff7e6, 0x8e9684, 0\.65\)/);
  assert.match(lighting,/DirectionalLight\(0xffeed4, 1\.35\)/);
  assert.match(lighting,/DirectionalLight\(0xe4eeff, 0\.38\)/);
  assert.match(materials,/frame:\s*std\('#46484b'/i);
  assert.match(shell,/woodFloor/);
  assert.match(app,/setView\('axon'\)/);
});
