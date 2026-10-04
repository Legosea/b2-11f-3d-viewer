#!/usr/bin/env node
import {spawn} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=5187;
const base=`http://127.0.0.1:${port}/b2-11f-3d-viewer/`;
const out=path.join(root,'output','stable-smoke');
fs.mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,[path.join(root,'node_modules','vite','bin','vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){for(let i=0;i<100;i++){try{if((await fetch(base)).ok)return;}catch{} await sleep(200);} throw new Error('preview not ready');}
let browser;
try{
  await ready();
  browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const [label,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
    const ctx=await browser.newContext({viewport}); const page=await ctx.newPage(); const errors=[];
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>document.querySelector('#viewport')?.dataset.firstFrame==='1',null,{timeout:90000});
    const state=await page.evaluate(()=>{
      const v=window.idm.viewer;
      const w3=v.three.root.getObjectByName('opening-op-w3-living');
      return {
        view:v.getView(),
        layout:v.getLayout(),
        calls:JSON.parse(document.querySelector('#viewport').dataset.render||'{}').calls||0,
        w3:!!w3,
        gridV:w3?.children.filter(x=>x.name?.startsWith('grid-v-')).length||0,
        gridH:w3?.children.filter(x=>x.name?.startsWith('grid-h-')).length||0,
        glass:w3?.children.filter(x=>x.userData?.role==='glazing').length||0
      };
    });
    if(state.calls<1||state.layout.length!==0||!state.w3||state.gridV!==2||state.gridH!==1||state.glass!==0) throw new Error(label+' invalid '+JSON.stringify(state));
    if(errors.length) throw new Error(label+' console '+errors.join(' | '));
    await page.locator('#viewport').screenshot({path:path.join(out,label+'-axon.png')});
    if(label==='desktop'){
      await page.evaluate(()=>window.idm.viewer.setView('top'));
      await page.waitForTimeout(800);
      await page.locator('#viewport').screenshot({path:path.join(out,'desktop-top.png')});
    }
    await ctx.close();
  }
  console.log('stable empty-shell smoke PASS');
}finally{if(browser)await browser.close();server.kill('SIGTERM');}
