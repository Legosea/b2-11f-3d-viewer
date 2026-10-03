#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const root = path.resolve(args.find(a => !a.startsWith('--')) || '.');
const strict = args.includes('--strict');
const errors = [], warnings = [], checked = [];
const urlRe = /^https?:\/\/[^\s]+$/i;
const statuses = new Set(['confirmed', 'estimated', 'inferred', 'unknown']);
const evidenceTypes = new Set(['official', 'specification', 'authorized-retailer', 'retailer', 'marketplace', 'user-provided', 'inspiration']);
const wallKinds = new Set(['solid', 'parapet', 'partition', 'unknown']);
const openingTypes = new Set(['door', 'sliding', 'window', 'opening']);
const dimStatuses = new Set(['confirmed', 'estimated', 'unknown']);
const geometrySources = new Set(['provided-model', 'licensed-asset', 'procedural-proxy', 'conceptual-proxy']);
const geometryScaleStatuses = new Set(['confirmed', 'estimated', 'unknown']);
const fitStatuses = new Set(['pass', 'warn', 'fail', 'unknown']);
const caseStages = new Set(['intake', 'concept', 'white-model', 'style', 'products', 'viewer', 'verified', 'blocked']);

function read(name, fallback) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) { errors.push(`missing ${name}`); return fallback; }
  try { const value = JSON.parse(fs.readFileSync(file, 'utf8')); checked.push(name); return value; }
  catch (e) { errors.push(`${name}: invalid JSON (${e.message})`); return fallback; }
}
function readOptional(name, fallback) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) return fallback;
  try { const value = JSON.parse(fs.readFileSync(file, 'utf8')); checked.push(name); return value; }
  catch (e) { errors.push(`${name}: invalid JSON (${e.message})`); return fallback; }
}
function need(value, label) { if (value === undefined || value === null || value === '') errors.push(`${label} is required`); }
function unique(items, label) {
  const seen = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.id) { errors.push(`${label}: missing id`); continue; }
    if (seen.has(item.id)) errors.push(`${label}: duplicate id ${item.id}`);
    seen.add(item.id);
  }
}
function point(p, label) { if (!Array.isArray(p) || p.length !== 2 || p.some(v => typeof v !== 'number' || !Number.isFinite(v))) errors.push(`${label}: expected [x,z] number pair`); }
function positive(v, label) { if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) errors.push(`${label}: expected positive number`); }

const caseInfo = read('case.json', {});
const plan = read('plan.json', {});
const style = read('style.json', {});
const concepts = readOptional('concept-renders.json', {renders: []});
const products = read('furniture-products.json', []);
const state = read('state.json', {});

need(caseInfo.caseId, 'case.json.caseId');
if (caseInfo.productResearch?.required !== false && caseInfo.productResearch?.required !== true) warnings.push('case.json.productResearch.required is not explicit');
if (plan.units !== 'm') errors.push('plan.json.units must be m');
if (!plan.source || !Array.isArray(plan.source.files) || !plan.source.scaleStatus) errors.push('plan.json.source must include files and scaleStatus');
if (plan.source && !statuses.has(plan.source.scaleStatus)) errors.push('plan.json.source.scaleStatus is invalid');
for (const [key, value] of [['rooms', plan.rooms], ['walls', plan.walls], ['openings', plan.openings], ['fixedElements', plan.fixedElements], ['routes', plan.routes], ['assumptions', plan.assumptions]]) if (!Array.isArray(value)) errors.push(`plan.json.${key} must be an array`);
unique(plan.rooms, 'rooms'); unique(plan.walls, 'walls'); unique(plan.openings, 'openings'); unique(plan.fixedElements, 'fixedElements'); unique(plan.routes, 'routes'); unique(plan.assumptions, 'assumptions');
const roomIds = new Set((plan.rooms || []).map(r => r?.id).filter(Boolean));
for (const room of plan.rooms || []) {
  need(room.name, `room ${room.id}.name`);
  if (!Array.isArray(room.boundary) || room.boundary.length < 3) errors.push(`room ${room.id}.boundary must have at least 3 points`); else room.boundary.forEach((p, i) => point(p, `room ${room.id}.boundary[${i}]`));
  if (!Array.isArray(room.connects)) errors.push(`room ${room.id}.connects must be an array`);
  else for (const target of room.connects) if (!roomIds.has(target)) warnings.push(`room ${room.id}.connects references unknown room ${target}`);
  if (room.status !== undefined && !statuses.has(room.status)) errors.push(`room ${room.id}.status invalid`);
}
for (const wall of plan.walls || []) {
  point(wall.a, `wall ${wall.id}.a`); point(wall.b, `wall ${wall.id}.b`); positive(wall.thickness, `wall ${wall.id}.thickness`); positive(wall.height, `wall ${wall.id}.height`);
  if (wall.kind !== undefined && !wallKinds.has(wall.kind)) errors.push(`wall ${wall.id}.kind invalid`);
  if (wall.status !== undefined && !statuses.has(wall.status)) errors.push(`wall ${wall.id}.status invalid`);
}
for (const opening of plan.openings || []) {
  point(opening.a, `opening ${opening.id}.a`); point(opening.b, `opening ${opening.id}.b`); if (typeof opening.sill !== 'number' || opening.sill < 0) errors.push(`opening ${opening.id}.sill invalid`); positive(opening.head, `opening ${opening.id}.head`);
  if (!openingTypes.has(opening.type)) errors.push(`opening ${opening.id}.type invalid`);
}
for (const fixed of plan.fixedElements || []) {
  need(fixed.kind, `fixed ${fixed.id}.kind`);
  for (const key of ['width', 'depth', 'height']) positive(fixed.bounds?.[key], `fixed ${fixed.id}.bounds.${key}`);
  need(fixed.room, `fixed ${fixed.id}.room`);
  if (fixed.room && !roomIds.has(fixed.room)) errors.push(`fixed ${fixed.id}.room references unknown room ${fixed.room}`);
  if (fixed.status !== undefined && !statuses.has(fixed.status)) errors.push(`fixed ${fixed.id}.status invalid`);
}
for (const assumption of plan.assumptions || []) { need(assumption.statement, `assumption ${assumption.id}.statement`); if (!statuses.has(assumption.status)) errors.push(`assumption ${assumption.id}.status invalid`); }
if (plan.levels !== undefined) {
  if (!Array.isArray(plan.levels)) errors.push('plan.json.levels must be an array');
  else { const seen = new Set(); for (const level of plan.levels) { if (level?.id === undefined) continue; if (seen.has(level.id)) errors.push(`levels: duplicate id ${level.id}`); seen.add(level.id); } }
}

if (!style || !Array.isArray(style.styles)) errors.push('style.json.styles must be an array');
unique(style.styles, 'styles');
for (const item of style.styles || []) {
  need(item.name, `style ${item.id}.name`);
  need(item.summary, `style ${item.id}.summary`);
  need(item.lighting?.description, `style ${item.id}.lighting.description`);
  if (!Array.isArray(item.materials)) errors.push(`style ${item.id}.materials must be an array`);
  if (!Array.isArray(item.rules)) errors.push(`style ${item.id}.rules must be an array`);
  if (!Array.isArray(item.palette)) errors.push(`style ${item.id}.palette must be an array`);
  else for (const swatch of item.palette) {
    for (const key of ['name', 'hex', 'role']) need(swatch[key], `style ${item.id}.palette.${key}`);
    if (swatch.hex && !/^#[0-9a-fA-F]{6}$/.test(swatch.hex)) errors.push(`style ${item.id}.palette: invalid hex ${swatch.hex}`);
  }
  if (item.furnitureRoles !== undefined) {
    if (!Array.isArray(item.furnitureRoles)) errors.push(`style ${item.id}.furnitureRoles must be an array`);
    else for (const role of item.furnitureRoles) {
      for (const key of ['id', 'role', 'room']) need(role[key], `style ${item.id}.furnitureRoles.${key}`);
      if (role.required === undefined) errors.push(`style ${item.id}.furnitureRoles.required is required`);
      if (role.room && !roomIds.has(role.room)) warnings.push(`style ${item.id}.furnitureRoles references unknown room ${role.room}`);
    }
  }
}

if (!concepts || !Array.isArray(concepts.renders)) errors.push('concept-renders.json.renders must be an array');
unique(concepts.renders, 'concept renders');
for (const render of concepts.renders || []) {
  if (!['candidate', 'selected', 'rejected', 'blocked'].includes(render.status)) errors.push(`concept ${render.id}.status invalid`);
  need(render.prompt, `concept ${render.id}.prompt`);
  if (!Array.isArray(render.sourceInputs) || render.sourceInputs.length === 0) errors.push(`concept ${render.id}.sourceInputs must contain at least one input`);
  if (render.status !== 'blocked' && !render.outputPath) errors.push(`concept ${render.id}.outputPath is required unless blocked`);
  if (render.generatedAt && Number.isNaN(Date.parse(render.generatedAt))) errors.push(`concept ${render.id}.generatedAt invalid`);
}

if (!Array.isArray(products)) errors.push('furniture-products.json must be an array');
unique(products, 'products');
for (const product of products || []) {
  for (const key of ['role', 'name']) need(product[key], `product ${product.id}.${key}`);
  need(product.market, `product ${product.id}.market`);
  if (!product.research || !Array.isArray(product.research.queries) || product.research.queries.length === 0) errors.push(`product ${product.id}: research.queries must contain at least one query`);
  need(product.research?.selectedReason, `product ${product.id}.research.selectedReason`);
  for (const key of ['width', 'depth', 'height']) positive(product.dimensionsMm?.[key], `product ${product.id}.dimensionsMm.${key}`);
  for (const key of ['widthStatus', 'depthStatus', 'heightStatus']) if (!dimStatuses.has(product.dimensionsMm?.[key])) errors.push(`product ${product.id}.dimensionsMm.${key} invalid`);
  if (!Array.isArray(product.evidence) || product.evidence.length === 0) errors.push(`product ${product.id}: at least one evidence entry required`);
  if (!urlRe.test(product.dimensionSourceUrl || '')) errors.push(`product ${product.id}: invalid dimensionSourceUrl`);
  else if (!(product.evidence || []).some(e => e.sourceUrl === product.dimensionSourceUrl)) errors.push(`product ${product.id}: dimensionSourceUrl must match an evidence sourceUrl`);
  for (const evidence of product.evidence || []) {
    if (!urlRe.test(evidence.sourceUrl || '')) errors.push(`product ${product.id}: invalid sourceUrl`);
    if (!evidenceTypes.has(evidence.sourceType)) errors.push(`product ${product.id}: invalid sourceType`);
    if (!evidence.retrievedAt || Number.isNaN(Date.parse(evidence.retrievedAt))) errors.push(`product ${product.id}: invalid retrievedAt`);
  }
  if (product.purchaseUrl !== null && !urlRe.test(product.purchaseUrl || '')) errors.push(`product ${product.id}: purchaseUrl must be a direct http(s) URL or null`);
  if (!product.geometry || !geometrySources.has(product.geometry.source)) errors.push(`product ${product.id}: geometry.source invalid`);
  if (!product.geometry || !geometryScaleStatuses.has(product.geometry.scaleStatus)) errors.push(`product ${product.id}: geometry.scaleStatus invalid`);
  if (!product.fit || !fitStatuses.has(product.fit.status)) errors.push(`product ${product.id}: fit.status invalid`);
  if (!Array.isArray(product.fit?.reasons)) errors.push(`product ${product.id}: fit.reasons must be an array`);
  if (!Array.isArray(product.fit?.unknowns)) errors.push(`product ${product.id}: fit.unknowns must be an array`);
  if (product.research?.candidateUrls !== undefined) {
    if (!Array.isArray(product.research.candidateUrls)) errors.push(`product ${product.id}: research.candidateUrls must be an array`);
    else for (const candidate of product.research.candidateUrls) if (!urlRe.test(candidate || '')) errors.push(`product ${product.id}: invalid candidateUrl ${candidate}`);
  }
  if (product.price !== undefined && product.price !== null) {
    if (typeof product.price.amount !== 'number' || product.price.amount < 0) errors.push(`product ${product.id}: price.amount invalid`);
    need(product.price.currency, `product ${product.id}.price.currency`);
    if (!product.price.asOf || Number.isNaN(Date.parse(product.price.asOf))) errors.push(`product ${product.id}: price.asOf invalid`);
  }
  if (product.dimensionsMm && ['width', 'depth', 'height'].some(k => product.dimensionsMm[`${k}Status`] === 'unknown')) warnings.push(`product ${product.id}: at least one dimension is unknown`);
  if (product.purchaseUrl === null) warnings.push(`product ${product.id}: no purchase URL`);
}

if (state.caseId && caseInfo.caseId && state.caseId !== caseInfo.caseId) errors.push('state.json.caseId does not match case.json.caseId');
if (state.stage === 'concept' && !concepts.renders.length) errors.push('state.json.stage is concept but concept-renders.json is empty');
if (state.stage !== undefined && !caseStages.has(state.stage)) errors.push('state.json.stage is invalid');
if (state.inputs !== undefined) {
  if (!Array.isArray(state.inputs)) errors.push('state.json.inputs must be an array');
  else state.inputs.forEach((input, i) => { for (const key of ['path', 'sha256', 'role']) need(input?.[key], `state.json.inputs[${i}].${key}`); });
}
if (strict && caseInfo.productResearch?.required !== false) {
  if (!products.length) errors.push('strict: product research is required but no product records exist');
  for (const product of products || []) {
    if (!product.purchaseUrl) errors.push(`strict: product ${product.id} has no purchaseUrl`);
    if ((product.evidence || []).every(e => e.sourceType === 'inspiration')) errors.push(`strict: product ${product.id} is supported only by inspiration evidence`);
    if (product.geometry?.source === 'conceptual-proxy') warnings.push(`strict: product ${product.id} is only a conceptual proxy`);
  }
}

const result = {schemaVersion: 2, valid: errors.length === 0, strict, root, checked, counts: {rooms: plan.rooms?.length || 0, styles: style.styles?.length || 0, conceptRenders: concepts.renders?.length || 0, products: products.length || 0}, errors, warnings};
console.log(JSON.stringify(result, null, 2));
process.exitCode = errors.length ? 1 : 0;
