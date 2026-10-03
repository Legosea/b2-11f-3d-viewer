import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('GitHub Pages base path and case URL are project-relative',()=>{
  const vite=fs.readFileSync(new URL('../vite.config.js',import.meta.url),'utf8');
  const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(vite,/base:\s*['"]\/b2-11f-3d-viewer\/['"]/);
  assert.match(main,/import\.meta\.env\.BASE_URL/);
  assert.doesNotMatch(main,/CASE_BASE\s*=\s*['"]\/case['"]/);
});