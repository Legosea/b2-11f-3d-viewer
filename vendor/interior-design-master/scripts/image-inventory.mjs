#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(process.argv[2] || '.');
const imageExt = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.bmp', '.svg', '.pdf']);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (imageExt.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
}
function pngSize(buf) {
  if (buf.length >= 24 && buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return {width: buf.readUInt32BE(16), height: buf.readUInt32BE(20)};
  return null;
}
function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    const length = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3 && i + 8 < buf.length) return {width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5)};
    if (!length) break;
    i += 2 + length;
  }
  return null;
}
// WebP: a RIFF container. The payload chunk right after the 12-byte RIFF/WEBP header names the
// sub-format (VP8 lossy, VP8L lossless, VP8X extended), each with its own bit-packed dimensions.
function webpSize(buf) {
  if (buf.length < 16 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const fourcc = buf.toString('ascii', 12, 16);
  if (fourcc === 'VP8 ' && buf.length >= 30) {
    // Lossy: 3-byte frame tag, 3-byte start code (0x9d 0x01 0x2a), then 14-bit width/height.
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return {width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff};
  }
  if (fourcc === 'VP8L' && buf.length >= 25) {
    // Lossless: 1-byte signature (0x2f), then a 32-bit little-endian field packing width-1/height-1.
    if (buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    return {width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1};
  }
  if (fourcc === 'VP8X' && buf.length >= 30) {
    // Extended: 1 flags byte + 3 reserved, then 24-bit little-endian width-1/height-1.
    const width = (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1;
    const height = (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1;
    return {width, height};
  }
  return null;
}
function gifSize(buf) {
  const header = buf.toString('ascii', 0, 6);
  if (buf.length < 10 || (header !== 'GIF87a' && header !== 'GIF89a')) return null;
  return {width: buf.readUInt16LE(6), height: buf.readUInt16LE(8)};
}
// Formats whose dimensions this script does not parse: reported explicitly rather than left
// silently null, so a missing value never reads as "no dimensions found".
const UNPROBED_NOTE = 'not probed for this format';

if (!fs.existsSync(root)) { console.error(`Input directory does not exist: ${root}`); process.exit(1); }
walk(root);
const PROBED = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
function dimensionsOf(ext, data) {
  if (ext === '.png') return pngSize(data);
  if (ext === '.jpg' || ext === '.jpeg') return jpegSize(data);
  if (ext === '.webp') return webpSize(data);
  if (ext === '.gif') return gifSize(data);
  return null;
}
const result = files.sort().map(full => {
  const data = fs.readFileSync(full);
  const ext = path.extname(full).toLowerCase();
  const entry = {
    path: path.relative(root, full).replaceAll(path.sep, '/'),
    type: ext.slice(1), bytes: data.length,
    sha256: crypto.createHash('sha256').update(data).digest('hex'),
    dimensions: dimensionsOf(ext, data)
  };
  if (!PROBED.has(ext)) entry.dimensionsNote = UNPROBED_NOTE;
  return entry;
});
console.log(JSON.stringify({root, count: result.length, files: result}, null, 2));
