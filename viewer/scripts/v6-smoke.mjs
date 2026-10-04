#!/usr/bin/env node
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=5186, base=`http://127.0.0.1:${port}/b2-11f-3d-viewer/`;
const out=path.join(root,'output','v6-smoke'); fs.mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,[path.join(root,'node_modules','vite','bin','vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){for(let i=0;i<80;i++){try{if((await fetch(base)).ok)return}catch{}await sleep(250)}throw new Error('preview not ready')}
let browser;
try{
 await ready();
 browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const [label,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
   const ctx=await browser.newContext({viewport}); const page=await ctx.newPage(); const errors=[];
   page.on('console',m=>{if(m.type()==='error')errors.push(m.text())}); page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.v6?.architecture?.root && window.v6.renderer.info.render.calls>0,null,{timeout:60000});
   const stats=await page.evaluate(()=>{const v=window.v6;return {children:v.architecture.root.children.map(x=>x.name),calls:v.renderer.info.render.calls};});
   if(stats.calls<1||!stats.children.includes('skp-shell'))throw new Error(label+' first frame invalid '+JSON.stringify(stats));
   if(errors.length)throw new Error(label+' console errors '+errors.join(' | '));
   await page.locator('#viewport').screenshot({path:path.join(out,label+'-axon.png')});
   if(label==='desktop'){
     for(const view of ['top','inside','axon']){await page.click(`[data-view="${view}"]`);await sleep(350);}
     const w3=await page.evaluate(()=>{const o=window.v6.architecture.windows.getObjectByName('W3');return {exists:!!o,children:o?.children.length||0};});
     if(!w3.exists||w3.children<5)throw new Error('W3 group missing/incomplete '+JSON.stringify(w3));
     await page.click('[data-view="top"]');await sleep(350);await page.locator('#viewport').screenshot({path:path.join(out,'desktop-top.png')});
   }
   await ctx.close();
 }
 console.log('v6 browser smoke PASS');
}finally{if(browser)await browser.close();server.kill('SIGTERM')}
