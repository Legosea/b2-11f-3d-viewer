#!/usr/bin/env node
// Downloads the CC0 Poly Haven HDRI + PBR textures listed in assets-manifest.json.
// The binaries are deliberately not committed: the skill has to stay small enough to copy around.
// The app renders without them (RoomEnvironment + procedural canvas textures), so a failure here
// degrades quality rather than breaking the viewer.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets-manifest.json'), 'utf8'));
const force = process.argv.includes('--force');
const only = (() => {
  const at = process.argv.indexOf('--only');
  return at >= 0 ? process.argv[at + 1] : null;
})();

const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex');

async function download(url) {
  const response = await fetch(url, {redirect: 'follow', headers: {'user-agent': 'idm-runtime-starter/1.0'}});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

const receipt = {manifest: 'assets-manifest.json', startedAt: new Date().toISOString(), files: []};
let failures = 0;

for (const entry of manifest.files) {
  if (only && entry.asset !== only) continue;
  const target = path.join(root, entry.path);
  const record = {id: entry.id, path: entry.path, url: entry.url, license: entry.license};

  // An existing file with the expected hash is already correct; re-downloading it wastes bandwidth.
  if (!force && fs.existsSync(target)) {
    const have = sha256(fs.readFileSync(target));
    if (have === entry.sha256) {
      receipt.files.push({...record, status: 'skipped', reason: 'hash matches', sha256: have});
      continue;
    }
    record.previousSha256 = have;
  }

  try {
    const buffer = await download(entry.url);
    const digest = sha256(buffer);
    if (digest !== entry.sha256) {
      failures++;
      receipt.files.push({...record, status: 'hash-mismatch', expected: entry.sha256, actual: digest, bytes: buffer.length});
      continue;
    }
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, buffer);
    receipt.files.push({...record, status: 'downloaded', sha256: digest, bytes: buffer.length});
  } catch (error) {
    failures++;
    receipt.files.push({...record, status: 'failed', error: String(error.message || error)});
  }
}

receipt.finishedAt = new Date().toISOString();
receipt.counts = receipt.files.reduce((acc, f) => ({...acc, [f.status]: (acc[f.status] || 0) + 1}), {});
receipt.ok = failures === 0;
console.log(JSON.stringify(receipt, null, 2));
process.exitCode = failures ? 1 : 0;
