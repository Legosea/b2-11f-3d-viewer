#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const caseDir = path.resolve(args.find(a => !a.startsWith('--')) || '.');
const nameAt = args.indexOf('--name');
const displayName = nameAt >= 0 ? (args[nameAt + 1] || 'New residential project') : 'New residential project';
const caseId = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'new-home';

const dirs = ['inputs/plan', 'inputs/style', 'inputs/products', 'evidence', 'output'];
for (const dir of dirs) fs.mkdirSync(path.join(caseDir, dir), {recursive: true});

const files = {
  'case.json': {
    version: 1, caseId, displayName, locale: 'en', region: null,
    productResearch: {required: true, currency: null}, stage: 'intake',
    inputs: {plan: [], style: [], products: [], measurements: []}, notes: []
  },
  'plan.json': {
    version: 1, units: 'm',
    source: {files: [], coordinateSystem: 'x-right-z-down', scaleStatus: 'unknown', metresPerPixel: null, northDeg: null},
    levels: [], rooms: [], walls: [], openings: [], fixedElements: [], routes: [], assumptions: []
  },
  'style.json': {version: 1, styles: []},
  'concept-renders.json': {version: 1, renders: []},
  'furniture-products.json': [],
  'state.json': {
    version: 1, caseId, stage: 'intake', inputs: [], planVersion: null, styleVersion: null,
    conceptVersion: null, conceptRenderIds: [], productVersion: null, userConfirmation: null,
    assumptions: [], unknowns: [], lastReceipt: null
  }
};

const created = [];
for (const [relative, value] of Object.entries(files)) {
  const target = path.join(caseDir, relative);
  if (fs.existsSync(target)) continue;
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n', 'utf8');
  created.push(relative);
}

console.log(JSON.stringify({caseDir, caseId, created, preserved: Object.keys(files).filter(f => !created.includes(f))}, null, 2));
