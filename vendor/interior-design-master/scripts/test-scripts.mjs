#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
let failures = 0;
function check(label, cond) { if (cond) console.log(`ok - ${label}`); else { console.log(`FAIL - ${label}`); failures++; } }
function includesAll(text, substrings) { return substrings.every(s => text.includes(s)); }

function run(script, args) {
  try {
    const out = execFileSync(process.execPath, [path.join(scriptsDir, script), ...args], {encoding: 'utf8'});
    return {code: 0, out};
  } catch (e) {
    return {code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '')};
  }
}

function mkCaseDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `idm-test-${name}-`));
}

function baseFiles(caseId) {
  return {
    'case.json': {version: 1, caseId, displayName: caseId, locale: 'en', region: null, productResearch: {required: true, currency: null}, stage: 'intake', inputs: {plan: [], style: [], products: [], measurements: []}, notes: []},
    'plan.json': {version: 1, units: 'm', source: {files: ['a.png'], coordinateSystem: 'x-right-z-down', scaleStatus: 'confirmed', metresPerPixel: 0.01, northDeg: null}, levels: [], rooms: [], walls: [], openings: [], fixedElements: [], routes: [], assumptions: []},
    'style.json': {version: 1, styles: []},
    'concept-renders.json': {version: 1, renders: []},
    'furniture-products.json': [],
    'state.json': {version: 1, caseId, stage: 'intake', inputs: [], planVersion: null, styleVersion: null, conceptVersion: null, conceptRenderIds: [], productVersion: null, userConfirmation: null, assumptions: [], unknowns: [], lastReceipt: null}
  };
}

function write(dir, files) {
  for (const [name, value] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2));
}

// --- fresh init via init-case.mjs, then validate ---
{
  const dir = mkCaseDir('init');
  run('init-case.mjs', [dir, '--name', 'Fresh Case']);
  const r = run('validate-case.mjs', [dir]);
  check('fresh init: validate-case exits 0', r.code === 0);
  check('fresh init: schemaVersion 2 in output', includesAll(r.out, ['"schemaVersion": 2']));
}

// --- positive product case ---
{
  const dir = mkCaseDir('positive');
  const files = baseFiles('positive-case');
  files['plan.json'].rooms = [{id: 'r1', name: 'Living Room', boundary: [[0, 0], [4, 0], [4, 4], [0, 4]], connects: []}];
  files['style.json'].styles = [{
    id: 's1', name: 'Modern', summary: 'Clean modern look', palette: [{name: 'White', hex: '#FFFFFF', role: 'wall'}],
    materials: [{surface: 'floor', description: 'oak'}], lighting: {description: 'natural daylight'}, rules: ['no clutter'],
    furnitureRoles: [{id: 'fr1', role: 'sofa', room: 'r1', required: true}]
  }];
  files['furniture-products.json'] = [{
    id: 'p1', role: 'sofa', name: 'Test Sofa', market: 'US',
    research: {queries: ['modern sofa'], selectedReason: 'best fit', candidateUrls: ['https://example.com/candidate']},
    dimensionsMm: {width: 2000, depth: 900, height: 800, widthStatus: 'confirmed', depthStatus: 'confirmed', heightStatus: 'confirmed'},
    dimensionSourceUrl: 'https://example.com/product',
    evidence: [{sourceUrl: 'https://example.com/product', sourceType: 'official', retrievedAt: '2026-01-01T00:00:00Z'}],
    purchaseUrl: 'https://example.com/buy',
    price: {amount: 999.5, currency: 'USD', asOf: '2026-01-01T00:00:00Z'},
    geometry: {source: 'procedural-proxy', assetPath: null, scaleStatus: 'estimated'},
    fit: {status: 'pass', reasons: ['fits room'], unknowns: []}
  }];
  files['state.json'].stage = 'products';
  write(dir, files);
  const r = run('validate-case.mjs', [dir, '--strict']);
  check('positive case: validate-case --strict exits 0', r.code === 0, r.out);
  if (r.code !== 0) console.log(r.out);
}

// --- strict-blocked case: passes non-strict, fails strict (no purchaseUrl) ---
{
  const dir = mkCaseDir('strict-blocked');
  const files = baseFiles('strict-case');
  files['plan.json'].rooms = [{id: 'r1', name: 'Bedroom', boundary: [[0, 0], [3, 0], [3, 3], [0, 3]], connects: []}];
  files['style.json'].styles = [{
    id: 's1', name: 'Minimal', summary: 'Minimal look', palette: [{name: 'Grey', hex: '#888888', role: 'wall'}],
    materials: [{surface: 'floor', description: 'concrete'}], lighting: {description: 'soft ambient'}, rules: ['keep it sparse']
  }];
  files['furniture-products.json'] = [{
    id: 'p1', role: 'bed', name: 'Test Bed', market: 'US',
    research: {queries: ['queen bed'], selectedReason: 'closest match'},
    dimensionsMm: {width: 1500, depth: 2000, height: 500, widthStatus: 'estimated', depthStatus: 'estimated', heightStatus: 'unknown'},
    dimensionSourceUrl: 'https://example.com/product',
    evidence: [{sourceUrl: 'https://example.com/product', sourceType: 'inspiration', retrievedAt: '2026-01-01T00:00:00Z'}],
    purchaseUrl: null,
    geometry: {source: 'conceptual-proxy', assetPath: null, scaleStatus: 'unknown'},
    fit: {status: 'unknown', reasons: [], unknowns: ['exact dimensions']}
  }];
  files['state.json'].stage = 'products';
  write(dir, files);
  const nonStrict = run('validate-case.mjs', [dir]);
  check('strict-blocked case: non-strict exits 0', nonStrict.code === 0, nonStrict.out);
  const strict = run('validate-case.mjs', [dir, '--strict']);
  check('strict-blocked case: --strict exits 1', strict.code === 1);
  check('strict-blocked case: reports missing purchaseUrl', strict.out.includes('has no purchaseUrl'));
  check('strict-blocked case: reports inspiration-only evidence', strict.out.includes('supported only by inspiration evidence'));
}

// --- invalid-status case: exercises new enum/reference checks ---
{
  const dir = mkCaseDir('invalid-status');
  const files = baseFiles('invalid-case');
  files['plan.json'].rooms = [{id: 'r1', name: 'Kitchen', boundary: [[0, 0], [3, 0], [3, 3], [0, 3]], connects: ['missing-room'], status: 'bogus'}];
  files['plan.json'].walls = [{id: 'w1', a: [0, 0], b: [3, 0], thickness: 0.1, height: 2.7, kind: 'bogus-kind'}];
  files['plan.json'].openings = [{id: 'o1', type: 'bogus-type', a: [0, 0], b: [1, 0], sill: 0, head: 2}];
  files['plan.json'].fixedElements = [{id: 'f1', kind: 'sink', room: 'missing-room', bounds: {x: 0, z: 0, width: 1, depth: 1, height: 1}}];
  files['style.json'].styles = [{id: 's1', name: 'Broken', palette: [{name: 'Bad', hex: 'not-a-hex', role: 'wall'}]}];
  files['furniture-products.json'] = [{
    id: 'p1', role: 'chair', name: 'Test Chair', market: 'US',
    research: {queries: ['chair'], selectedReason: 'ok', candidateUrls: ['not-a-url']},
    dimensionsMm: {width: 500, depth: 500, height: 800, widthStatus: 'confirmed', depthStatus: 'confirmed', heightStatus: 'confirmed'},
    dimensionSourceUrl: 'https://example.com/product',
    evidence: [{sourceUrl: 'https://example.com/product', sourceType: 'official', retrievedAt: '2026-01-01T00:00:00Z'}],
    purchaseUrl: 'https://example.com/buy',
    price: {amount: -5, currency: 'USD', asOf: 'not-a-date'},
    geometry: {source: 'procedural-proxy', scaleStatus: 'bogus-status'},
    fit: {status: 'pass', reasons: 'not-an-array', unknowns: []}
  }];
  files['state.json'].stage = 'bogus-stage';
  files['state.json'].inputs = [{path: 'x.png'}];
  write(dir, files);
  const r = run('validate-case.mjs', [dir]);
  check('invalid-status case: exits 1', r.code === 1);
  check('invalid-status case: room.connects unknown room is a warning', r.out.includes('connects references unknown room missing-room'));
  check('invalid-status case: room.status invalid error', r.out.includes('room r1.status invalid'));
  check('invalid-status case: wall.kind invalid error', r.out.includes('wall w1.kind invalid'));
  check('invalid-status case: opening.type invalid error', r.out.includes('opening o1.type invalid'));
  check('invalid-status case: fixed.room unknown room error', r.out.includes('fixed f1.room references unknown room missing-room'));
  check('invalid-status case: palette hex invalid error', r.out.includes('invalid hex not-a-hex'));
  check('invalid-status case: geometry.scaleStatus invalid error', r.out.includes('geometry.scaleStatus invalid'));
  check('invalid-status case: fit.reasons must be array error', r.out.includes('fit.reasons must be an array'));
  check('invalid-status case: price.amount invalid error', r.out.includes('price.amount invalid'));
  check('invalid-status case: price.asOf invalid error', r.out.includes('price.asOf invalid'));
  check('invalid-status case: candidateUrl invalid error', r.out.includes('invalid candidateUrl not-a-url'));
  check('invalid-status case: state.stage invalid error', r.out.includes('state.json.stage is invalid'));
  check('invalid-status case: state.inputs missing fields error', r.out.includes('state.json.inputs[0].sha256 is required'));
}

// --- image-inventory on a temp dir with one generated PNG (no network) ---
{
  const dir = mkCaseDir('images');
  // minimal valid 1x1 PNG (transparent pixel)
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753' +
    'de0000000c4944415478da6360000002000155bf0a2a0000000049454e44ae426082',
    'hex'
  );
  fs.writeFileSync(path.join(dir, 'sample.png'), png);

  // Minimal VP8L (lossless) WebP: RIFF/WEBP/VP8L header only, no compressed pixel data, encoding a
  // 20x10 canvas so the parsed dimensions can be checked exactly.
  const width = 20, height = 10;
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  const vp8lPayload = Buffer.alloc(5);
  vp8lPayload[0] = 0x2f;
  vp8lPayload.writeUInt32LE(bits, 1);
  const vp8lChunkSize = Buffer.alloc(4);
  vp8lChunkSize.writeUInt32LE(vp8lPayload.length, 0);
  const webpBody = Buffer.concat([Buffer.from('WEBP'), Buffer.from('VP8L'), vp8lChunkSize, vp8lPayload]);
  const riffSize = Buffer.alloc(4);
  riffSize.writeUInt32LE(webpBody.length, 0);
  const webp = Buffer.concat([Buffer.from('RIFF'), riffSize, webpBody]);
  fs.writeFileSync(path.join(dir, 'sample.webp'), webp);

  const r = run('image-inventory.mjs', [dir]);
  check('image-inventory: exits 0', r.code === 0, r.out);
  check('image-inventory: finds sample.png', r.out.includes('"sample.png"'));
  check('image-inventory: reports sha256', r.out.includes('"sha256"'));
  const parsed = JSON.parse(r.out);
  const webpEntry = parsed.files.find(f => f.path === 'sample.webp');
  check('image-inventory: parses VP8L webp dimensions', webpEntry?.dimensions?.width === 20 && webpEntry?.dimensions?.height === 10, webpEntry);
}

console.log(failures ? `\n${failures} failure(s)` : '\nall tests passed');
process.exit(failures ? 1 : 0);
