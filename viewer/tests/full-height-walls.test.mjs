import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');

test('空屋預設所有牆面保持完整等高，不使用 dollhouse 矮牆模式',()=>{
  assert.match(app,/let wallMode = 'full';/);
});
