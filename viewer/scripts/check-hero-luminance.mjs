#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from '@playwright/test';

const file = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!file || !fs.existsSync(file)) {
  console.error('usage: node scripts/check-hero-luminance.mjs <png>');
  process.exit(2);
}

const dataUrl = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
const browser = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let stats;
try {
  const page = await browser.newPage({viewport:{width:1400,height:900}});
  await page.setContent('<canvas id="c"></canvas><img id="i" hidden>');
  stats = await page.evaluate(async src => {
    const img = document.querySelector('#i');
    img.src = src;
    await img.decode();
    const canvas = document.querySelector('#c');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    ctx.drawImage(img,0,0);
    const rgba = ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const linear = byte => {
      const c = byte / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    let sum=0, hi=0, pixels=0;
    for(let i=0;i+3<rgba.length;i+=4){
      if(rgba[i+3]===0) continue;
      const y=.2126*linear(rgba[i])+.7152*linear(rgba[i+1])+.0722*linear(rgba[i+2]);
      sum+=y; if(y>.95) hi++; pixels++;
    }
    return {mean:pixels?sum/pixels:0,highlightRatio:pixels?hi/pixels:0,pixels,width:canvas.width,height:canvas.height};
  }, dataUrl);
} finally {
  await browser.close();
}

console.log(JSON.stringify(stats,null,2));
if (stats.mean > 0.88 || stats.highlightRatio > 0.45) {
  console.error(`OVEREXPOSED: mean=${stats.mean.toFixed(4)}, highlightRatio=${stats.highlightRatio.toFixed(4)}`);
  process.exit(1);
}
console.log(`PASS luminance: mean=${stats.mean.toFixed(4)}, highlightRatio=${stats.highlightRatio.toFixed(4)}`);
