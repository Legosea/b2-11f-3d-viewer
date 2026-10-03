#!/usr/bin/env node
// Browser smoke test. Builds are not proof: this loads the real page, waits for the first
// composited frame, checks the console, exercises a view preset, places a product proxy and
// round-trips the share hash through getState().
//
//   node scripts/smoke.mjs [--port 5181] [--keep] [--no-build]
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const portAt = process.argv.indexOf('--port');
const PORT = portAt >= 0 ? Number(process.argv[portAt + 1]) : 5181;
const BASE = `http://127.0.0.1:${PORT}/`;
const OUT = path.join(root, 'output', 'smoke');
fs.mkdirSync(OUT, {recursive: true});

// Smoke serves dist/ via vite preview, so dist must exist and be fresh. Build it here unless
// the caller explicitly skips with --no-build (e.g. when a build already just ran).
const skipBuild = process.argv.includes('--no-build');
if (skipBuild) {
  console.log('SKIP  build (--no-build passed, using existing dist/)');
} else {
  const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  const build = spawnSync(process.execPath, [viteBin, 'build'], {cwd: root, stdio: 'inherit'});
  if (build.status !== 0) {
    console.error(`SMOKE ERROR: vite build failed with exit code ${build.status}`);
    process.exit(1);
  }
  console.log('BUILT dist/ (vite build)');
}

const results = [];
const record = (name, ok, detail) => {
  results.push({check: name, ok, detail});
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
};

const server = spawn(process.execPath, [
  path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
  'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'
], {cwd: root, stdio: ['ignore', 'pipe', 'pipe']});

let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk; });
server.stderr.on('data', chunk => { serverLog += chunk; });

async function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE, {signal: AbortSignal.timeout(2000)});
      if (response.ok) return true;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}

// Waits for the render loop to report a composited frame (render.js sets data-first-frame).
async function waitForFirstFrame(page, timeout = 90000) {
  await page.waitForFunction(() => document.querySelector('#viewport')?.dataset.firstFrame === '1', null, {timeout});
}

let browser;
let exitCode = 0;
try {
  if (!await waitForServer()) throw new Error(`preview server did not start on ${PORT}\n${serverLog}`);
  record('preview server up', true, BASE);

  browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});

  // ---------- desktop ----------
  const desktop = await browser.newContext({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1});
  const page = await desktop.newPage();
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', error => consoleErrors.push(`pageerror: ${error.message}`));

  await page.goto(BASE, {waitUntil: 'domcontentloaded', timeout: 90000});
  await waitForFirstFrame(page);
  record('desktop first frame', true);

  const meta = await page.evaluate(() => {
    const el = document.querySelector('#viewport');
    return {
      hdri: el.dataset.hdri,
      quality: el.dataset.quality,
      surfaces: el.dataset.surfaces,
      render: JSON.parse(el.dataset.render || '{}')
    };
  });
  record('render stack reports draw calls', meta.render.calls > 0, meta);

  const desktopShot = path.join(OUT, 'desktop-orbit.png');
  await page.screenshot({path: desktopShot, timeout: 90000});
  record('desktop screenshot', fs.existsSync(desktopShot), desktopShot);

  // ---------- view preset ----------
  await page.click('[data-view="top"]');
  await page.waitForTimeout(900);
  const topView = await page.evaluate(() => window.idm.viewer.getView());
  record('view preset switches to top', topView.view === 'top', topView);
  const topShot = path.join(OUT, 'desktop-top.png');
  await page.screenshot({path: topShot, timeout: 90000});

  await page.click('[data-view="inside"]');
  await page.waitForTimeout(900);
  const insideShot = path.join(OUT, 'desktop-inside.png');
  await page.screenshot({path: insideShot, timeout: 90000});
  record('inside view screenshot', fs.existsSync(insideShot), insideShot);

  await page.click('[data-view="orbit"]');
  await page.waitForTimeout(600);

  // ---------- place a product proxy ----------
  // No coordinates are passed here on purpose: this exercises placeProduct's default target
  // resolution (style.json furnitureRoles[] room, else the largest indoor non-wet room), not the
  // explicit-coordinate path.
  const placement = await page.evaluate(() => {
    const viewer = window.idm.viewer;
    const product = viewer.getProducts()[0];
    if (!product) return {error: 'no products in case'};
    const before = viewer.getLayout().length;
    const placed = viewer.placeProduct(product.id);
    const layout = viewer.getLayout();
    return {
      productId: product.id,
      placed: !!placed,
      before,
      after: layout.length,
      keepsProductId: layout.every(item => typeof item.productId === 'string' && item.productId.length > 0),
      sample: layout[0] || null,
      room: placed?.defaultRoom || null,
      roomSource: placed?.defaultRoomSource || null
    };
  });
  record('places a product proxy', placement.placed && placement.after === placement.before + 1, placement);
  record('placed item keeps productId', placement.keepsProductId === true, placement.sample);

  await page.waitForTimeout(700);
  const placedShot = path.join(OUT, 'desktop-placed.png');
  await page.screenshot({path: placedShot, timeout: 90000});

  // ---------- focus + product panel ----------
  const focused = await page.evaluate(() => window.idm.viewer.focusItem(window.idm.viewer.getProducts()[0].id));
  record('focusItem on a placed product', focused === true);

  // ---------- share hash round trip ----------
  const share = await page.evaluate(() => {
    const viewer = window.idm.viewer;
    const hash = viewer.encodeShare();
    const before = viewer.getState();
    viewer.setLayout([]);                       // wipe
    const cleared = viewer.getLayout().length;
    const decoded = viewer.applyShare(hash);    // restore from the hash alone
    const after = viewer.getState();
    return {
      hash,
      cleared,
      decodedItems: decoded?.layout?.length ?? -1,
      beforeLayout: before.layout,
      afterLayout: after.layout,
      styleMatches: before.style === after.style,
      qualityMatches: before.quality === after.quality
    };
  });
  const roundTripOk = share.cleared === 0
    && JSON.stringify(share.beforeLayout.map(i => i.productId)) === JSON.stringify(share.afterLayout.map(i => i.productId))
    && share.beforeLayout.every((item, i) => Math.abs(item.x - share.afterLayout[i].x) < 0.02 && Math.abs(item.z - share.afterLayout[i].z) < 0.02);
  record('share hash round trip preserves layout + productId', roundTripOk, {
    hashLength: share.hash.length,
    before: share.beforeLayout,
    after: share.afterLayout,
    styleMatches: share.styleMatches,
    qualityMatches: share.qualityMatches
  });

  // ---------- quality tiers ----------
  const quality = await page.evaluate(async () => {
    const viewer = window.idm.viewer;
    const seen = [];
    for (const level of ['low', 'medium', 'high']) seen.push(viewer.setQuality(level));
    return {seen, stored: localStorage.getItem('idm-render-quality')};
  });
  record('quality tiers apply', quality.seen.join(',') === 'low,medium,high' && quality.stored === 'high', quality);

  // ---------- exports ----------
  const exported = await page.evaluate(() => {
    const data = window.idm.viewer.exportProducts();
    return {items: data.items.length, placed: data.placed.length, hasEvidence: data.items.every(i => Array.isArray(i.evidence) && i.evidence.length > 0)};
  });
  record('exportProducts carries evidence', exported.items > 0 && exported.hasEvidence, exported);

  // ---------- walkthrough ----------
  await page.click('[data-view="walk"]');
  await page.waitForTimeout(800);
  const walkStart = await page.evaluate(() => window.idm.viewer.walkState());
  await page.evaluate(() => window.idm.viewer.walkAnalog(0, 1));
  await page.waitForTimeout(1200);
  const walkAfter = await page.evaluate(() => {
    const state = window.idm.viewer.walkState();
    window.idm.viewer.walkAnalog(0, 0);
    return state;
  });
  const walkShot = path.join(OUT, 'desktop-walk.png');
  await page.screenshot({path: walkShot, timeout: 90000});
  const moved = Math.hypot(walkAfter.position[0] - walkStart.position[0], walkAfter.position[2] - walkStart.position[2]);
  record('walkthrough moves with collision on', walkStart.active && !walkStart.blocked && walkStart.colliders > 0 && moved > 0.1, {
    colliders: walkStart.colliders, movedMetres: +moved.toFixed(2), blocked: walkAfter.blocked
  });
  await page.click('[data-view="orbit"]');
  await page.waitForTimeout(500);

  record('no console errors (desktop)', consoleErrors.length === 0, consoleErrors.slice(0, 6));

  // ---------- mobile ----------
  // Close the desktop context first: two live WebGL pages under SwiftShader starve each other.
  await desktop.close();
  const mobile = await browser.newContext({
    viewport: {width: 390, height: 844},
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  const mobilePage = await mobile.newPage();
  const mobileErrors = [];
  mobilePage.on('console', msg => { if (msg.type() === 'error') mobileErrors.push(msg.text()); });
  mobilePage.on('pageerror', error => mobileErrors.push(`pageerror: ${error.message}`));
  await mobilePage.goto(BASE, {waitUntil: 'domcontentloaded', timeout: 90000});
  await waitForFirstFrame(mobilePage);
  const mobileShot = path.join(OUT, 'mobile-orbit.png');
  await mobilePage.screenshot({path: mobileShot, timeout: 90000});
  record('mobile first frame + screenshot', fs.existsSync(mobileShot), mobileShot);
  const mobileQuality = await mobilePage.evaluate(() => document.querySelector('#viewport').dataset.quality);
  record('mobile defaults to a lighter tier', mobileQuality !== 'high', {quality: mobileQuality});
  record('no console errors (mobile)', mobileErrors.length === 0, mobileErrors.slice(0, 6));

  const receipt = {
    ranAt: new Date().toISOString(),
    base: BASE,
    outputDir: OUT,
    checks: results,
    passed: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length
  };
  fs.writeFileSync(path.join(OUT, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(`\n${receipt.passed} passed, ${receipt.failed} failed. Receipt: ${path.join(OUT, 'receipt.json')}`);
  exitCode = receipt.failed ? 1 : 0;
} catch (error) {
  console.error(`SMOKE ERROR: ${error.stack || error.message}`);
  exitCode = 1;
} finally {
  await browser?.close();
  if (!process.argv.includes('--keep')) server.kill();
}
process.exit(exitCode);
