#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const file = path.join(root, 'furniture-products.json');
if (!fs.existsSync(file)) { console.error(`Missing ${file}`); process.exit(1); }
let products;
try { products = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error(`Invalid furniture-products.json: ${e.message}`); process.exit(1); }

const urls = new Set();
for (const product of Array.isArray(products) ? products : []) {
  if (product.dimensionSourceUrl) urls.add(product.dimensionSourceUrl);
  if (product.purchaseUrl) urls.add(product.purchaseUrl);
  for (const evidence of product.evidence || []) if (evidence.sourceUrl) urls.add(evidence.sourceUrl);
}

const HEADERS = {'user-agent': 'Mozilla/5.0 (compatible; Interior-Design-Master-link-check/1.0)', 'accept-language': '*'};
const BLOCK_STATUS = new Set([403, 429, 503]);

async function check(url) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    let response;
    try {
      response = await fetch(url, {method: 'HEAD', redirect: 'follow', signal: controller.signal, headers: HEADERS});
      if (response.status >= 400) response = await fetch(url, {method: 'GET', redirect: 'follow', signal: controller.signal, headers: HEADERS});
    } catch (error) {
      return {url, status: 'blocked', error: error.name === 'AbortError' ? 'timeout' : error.message, ms: Date.now() - started};
    }
    const finalUrl = response.url || url;
    if (response.ok) return {url, status: finalUrl !== url ? 'redirected-ok' : 'ok', httpStatus: response.status, finalUrl, ms: Date.now() - started};
    return {url, status: BLOCK_STATUS.has(response.status) ? 'blocked' : 'http-error', httpStatus: response.status, finalUrl, ms: Date.now() - started};
  } finally { clearTimeout(timer); }
}

const results = [];
for (const url of urls) results.push(await check(url));
const ok = results.filter(r => r.status === 'ok').length;
const redirected = results.filter(r => r.status === 'redirected-ok').length;
const blocked = results.filter(r => r.status === 'blocked').length;
const failed = results.filter(r => r.status === 'http-error').length;
console.log(JSON.stringify({checked: results.length, ok, redirected, blocked, failed, results}, null, 2));
process.exitCode = failed ? 1 : 0;
