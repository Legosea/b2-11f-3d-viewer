import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const shell=fs.readFileSync(new URL('../src/shell.js',import.meta.url),'utf8');

test('空屋版不渲染任何門片，只保留門洞與門框',()=>{
  assert.doesNotMatch(shell,/door-leaf-/);
  assert.doesNotMatch(shell,/opening\.swing/);
});
