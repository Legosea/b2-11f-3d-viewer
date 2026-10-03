import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

test('review overlay is copied with case data and exposed by viewer API',()=>{
  const link=read('../scripts/link-case.mjs');
  const app=read('../src/app.js');
  const main=read('../src/main.js');
  assert.match(link,/plan-overlay\.svg/);
  assert.ok(fs.existsSync(new URL('../src/review-overlay.js', import.meta.url)));
  assert.match(app,/setReviewOverlay/);
  assert.match(app,/getReviewOverlay/);
  assert.match(main,/id="reviewOverlay"/);
  assert.match(main,/reviewOverlayUrl/);
});
