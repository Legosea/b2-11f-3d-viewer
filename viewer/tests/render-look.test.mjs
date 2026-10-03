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

test('dollhouse materials stay light and room labels start hidden',()=>{
  const materials=read('../src/materials.js');
  const app=read('../src/app.js');
  const main=read('../src/main.js');
  const style=JSON.parse(read('../../case/style.json')).styles[0];
  assert.match(materials,/kind === 'wood' \? '#e[0-9a-f]{5}'/i,'procedural wood uses a light neutral base');
  assert.match(materials,/set\(m\.plank, pick\('floor'\)\)/,'floor palette tints the plank material');
  assert.match(app,/let labelsVisible = false/);
  assert.match(main,/id="labelToggle" aria-pressed="false"/);
  const palette=Object.fromEntries(style.palette.map(p=>[p.role,p.hex.toUpperCase()]));
  assert.ok(parseInt(palette.floor.slice(1,3),16)>=0xD0,palette.floor);
  assert.ok(parseInt(palette.wood.slice(1,3),16)>=0xA8,palette.wood);
});

test('axon hero uses northwest directional dollhouse cutaway',()=>{
  const views=read('../src/views.js');
  const shell=read('../src/shell.js');
  assert.match(views,/new T\.Vector3\(-distance \* 0\.68, distance \* 0\.62, -distance \* 0\.68\)/);
  assert.match(shell,/nearCutWallIds/);
  assert.match(shell,/bounds\.minX/);
  assert.match(shell,/bounds\.minZ/);
  assert.match(shell,/const CUT_HEIGHT = 0\.95/);
  assert.match(shell,/part\.visible = full \|\| !nearCutWallIds\.has\(part\.userData\.wall\)/);
});
