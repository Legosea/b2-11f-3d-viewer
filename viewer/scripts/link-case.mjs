#!/usr/bin/env node
// Copies a case directory's JSON contract into public/case/ so the dev server can fetch it.
// A copy rather than a symlink: Vite serves public/ literally, and symlinks behave differently
// across Windows / WSL / CI.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.argv[2] || '.');
const target = path.join(root, 'public', 'case');

const REQUIRED = ['case.json', 'plan.json', 'style.json', 'furniture-products.json', 'state.json'];
const OPTIONAL = ['concept-renders.json'];

if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
  console.error(JSON.stringify({ok: false, error: `not a directory: ${source}`}, null, 2));
  process.exit(1);
}

const missing = REQUIRED.filter(name => !fs.existsSync(path.join(source, name)));
if (missing.length) {
  console.error(JSON.stringify({ok: false, source, error: 'missing required case files', missing}, null, 2));
  process.exit(1);
}

fs.mkdirSync(target, {recursive: true});
const copied = [];
for (const name of [...REQUIRED, ...OPTIONAL]) {
  const from = path.join(source, name);
  if (!fs.existsSync(from)) continue;
  const raw = fs.readFileSync(from, 'utf8');
  try {
    JSON.parse(raw);
  } catch (error) {
    console.error(JSON.stringify({ok: false, source, error: `${name} is not valid JSON: ${error.message}`}, null, 2));
    process.exit(1);
  }
  fs.writeFileSync(path.join(target, name), raw);
  copied.push({file: name, bytes: Buffer.byteLength(raw)});
}

// concept-renders.json is optional in the contract but the viewer expects the file to exist.
if (!fs.existsSync(path.join(target, 'concept-renders.json'))) {
  fs.writeFileSync(path.join(target, 'concept-renders.json'), JSON.stringify({version: 1, renders: []}, null, 2) + '\n');
  copied.push({file: 'concept-renders.json', bytes: 0, note: 'created empty (absent in source case)'});
}

const overlayFrom = path.join(source, 'output', 'plan-overlay.svg');
if (fs.existsSync(overlayFrom)) {
  const overlayTarget = path.join(target, 'output');
  fs.mkdirSync(overlayTarget, {recursive: true});
  const raw = fs.readFileSync(overlayFrom);
  fs.writeFileSync(path.join(overlayTarget, 'plan-overlay.svg'), raw);
  copied.push({file: 'output/plan-overlay.svg', bytes: raw.length});
}

console.log(JSON.stringify({ok: true, source, target, copied}, null, 2));
