import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('production viewer uses the stable CAD/PDF shell runtime, not the broken raw SKP triangle runtime',()=>{
  assert.match(html,/src\/main\.js/);
  assert.doesNotMatch(html,/src\/v6-main\.js/);
});
