import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const shell=fs.readFileSync(new URL('../src/shell.js',import.meta.url),'utf8');

test('空屋版窗戶只保留框架，不渲染會像長板的玻璃面',()=>{
  assert.doesNotMatch(shell,/new T\.BoxGeometry\(w - jamb \* 2, h - jamb \* 2, 0\.012\)/);
  assert.doesNotMatch(shell,/new T\.BoxGeometry\(paneWidth - 0\.02, h - jamb \* 2, 0\.012\)/);
  assert.doesNotMatch(shell,/role: 'glazing'/);
});
