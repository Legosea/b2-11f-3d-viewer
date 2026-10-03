import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const shell=fs.readFileSync(new URL('../src/shell.js',import.meta.url),'utf8');

test('窗戶外側不建立額外遮簾或遮陽板',()=>{
  assert.doesNotMatch(shell,/exterior-window-shade/);
});
