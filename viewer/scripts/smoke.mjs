#!/usr/bin/env node
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const portAt = process.argv.indexOf('--port');
const PORT = portAt >= 0 ? Number(process.argv[portAt + 1]) : 5181;
const BASE_PATH = '/b2-11f-3d-viewer/';
const BASE = `http://127.0.0.1:${PORT}${BASE_PATH}`;
const OUT = path.join(root, 'output', 'smoke');
fs.mkdirSync(OUT, {recursive: true});

if (!process.argv.includes('--no-build')) {
  const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  const build = spawnSync(process.execPath, [viteBin, 'build'], {cwd: root, stdio: 'inherit'});
  if (build.status !== 0) process.exit(build.status || 1);
}

const results=[];
const record=(check,ok,detail)=>{results.push({check,ok,detail});console.log(`${ok?'PASS':'FAIL'}  ${check}${detail?' — '+(typeof detail==='string'?detail:JSON.stringify(detail)):''}`);};

const server=spawn(process.execPath,[path.join(root,'node_modules','vite','bin','vite.js'),'preview','--host','127.0.0.1','--port',String(PORT),'--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});
let serverLog='';
server.stdout.on('data',c=>serverLog+=c);
server.stderr.on('data',c=>serverLog+=c);

async function waitForServer(timeout=20000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    try{const r=await fetch(BASE,{signal:AbortSignal.timeout(2000)});if(r.ok)return true;}catch{}
    await new Promise(r=>setTimeout(r,250));
  }
  return false;
}
async function waitForFirstFrame(page,timeout=90000){
  await page.waitForFunction(()=>document.querySelector('#viewport')?.dataset.firstFrame==='1',null,{timeout});
}
async function viewportShot(page,name){
  const file=path.join(OUT,name);
  await page.locator('#viewport').screenshot({path:file,timeout:90000});
  return file;
}

let browser;
let exitCode=0;
try{
  if(!await waitForServer()) throw new Error(`preview server did not start\n${serverLog}`);
  record('preview server up',true,BASE);
  browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});

  const desktop=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const page=await desktop.newPage();
  const errors=[];
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:90000});
  await waitForFirstFrame(page);

  const initial=await page.evaluate(()=>({
    view:window.idm.viewer.getView(),
    layout:window.idm.viewer.getLayout().length,
    quality:window.idm.viewer.getQuality(),
    render:JSON.parse(document.querySelector('#viewport').dataset.render||'{}')
  }));
  record('desktop first frame is seeded axonometric v5',initial.view.view==='axon'&&initial.layout>0&&initial.render.calls>0,initial);
  const axonShot=await viewportShot(page,'desktop-axon.png');
  record('desktop axon screenshot',fs.existsSync(axonShot),axonShot);

  const w3=await page.evaluate(()=>{
    const viewer=window.idm.viewer;
    const opening=viewer.three.root.getObjectByName('opening-op-w3-living');
    const spec=viewer.plan.openings.find(o=>o.id==='op-w3-living');
    return {
      exists:!!opening,
      parent:opening?.parent?.name||null,
      glassCount:opening?.children?.filter(o=>o.name?.startsWith('glass-op-w3-living')).length||0,
      gridV:opening?.children?.filter(o=>o.name?.startsWith('grid-v-op-w3-living')).length||0,
      gridH:opening?.children?.filter(o=>o.name?.startsWith('grid-h-op-w3-living')).length||0,
      width:spec?Math.hypot(spec.b[0]-spec.a[0],spec.b[1]-spec.a[1]):null,
      sill:spec?.sill,head:spec?.head
    };
  });
  record('W3 is embedded and renders the supplied 3-column / 2-row grid',w3.exists&&w3.parent==='wall-w-ext-living-south'&&w3.glassCount>0&&w3.gridV===2&&w3.gridH===1&&Math.abs(w3.width-2.68)<0.005&&w3.sill===0.5&&w3.head===2.4,w3);

  await page.click('#reviewOverlay');
  await page.waitForTimeout(500);
  const overlay=await page.evaluate(()=>({visible:window.idm.viewer.getReviewOverlay(),view:window.idm.viewer.getView().view,object:!!window.idm.viewer.three.root.getObjectByName('review-plan-overlay')}));
  record('plan review overlay toggles in top view',overlay.visible&&overlay.view==='top'&&overlay.object,overlay);
  await viewportShot(page,'desktop-top-overlay.png');
  await page.click('#reviewOverlay');
  await page.waitForTimeout(250);

  await page.click('[data-view="inside"]');
  await page.waitForTimeout(850);
  const inside=await page.evaluate(()=>window.idm.viewer.getView());
  record('inside view switches',inside.view==='inside',inside);
  await viewportShot(page,'desktop-inside.png');
  // Functional interaction checks run in low tier so SwiftShader CI is not frame-starved.
  // Visual screenshots above remain high quality.
  await page.evaluate(()=>window.idm.viewer.setQuality('low'));
  await page.click('[data-view="axon"]');
  await page.waitForTimeout(1200);

  const editFixture=await page.evaluate(()=>{
    const v=window.idm.viewer;
    const placed=v.placeProduct('prd-nordkisa-bedside',4.0,0.9,{ry:0});
    if(!placed)return {placed:false};
    const idx=v.getLayout().length-1;
    v.selectItem(idx);
    const before=v.getLayout()[idx]?.ry;
    const rotated=v.rotateSelected(15);
    const after=v.getLayout()[idx]?.ry;
    const undone=v.undo();
    const restored=v.getLayout()[idx]?.ry;
    return {placed:true,idx,before,rotated,after,undone,restored};
  });
  record('selection, rotation and undo work in a clear edit area',editFixture.placed&&editFixture.rotated&&editFixture.undone&&Math.abs(editFixture.after-editFixture.before)>0.1&&Math.abs(editFixture.restored-editFixture.before)<0.01,editFixture);

  await page.evaluate(()=>window.idm.viewer.setView('top'));
  await page.waitForTimeout(2200);
  const moveStart=await page.evaluate(idx=>{
    const v=window.idm.viewer;
    v.selectItem(idx);
    const group=v.three.root.getObjectByName('placed-items');
    const obj=group.children[idx];
    const box=new v.three.T.Box3().setFromObject(obj);
    const p=box.getCenter(new v.three.T.Vector3()).project(v.three.camera);
    const rect=v.three.renderer.domElement.getBoundingClientRect();
    return {idx,x:(p.x*.5+.5)*rect.width+rect.left,y:(-p.y*.5+.5)*rect.height+rect.top,before:v.getLayout()[idx]};
  },editFixture.idx);
  await page.mouse.move(moveStart.x,moveStart.y);
  await page.mouse.down();
  await page.mouse.move(moveStart.x+80,moveStart.y,{steps:12});
  await page.mouse.up();
  await page.waitForTimeout(250);
  const moveEnd=await page.evaluate(idx=>window.idm.viewer.getLayout()[idx],moveStart.idx);
  const moved=Math.hypot((moveEnd?.x||0)-moveStart.before.x,(moveEnd?.z||0)-moveStart.before.z);
  record('pointer drag moves selected furniture on snap grid',moved>=0.049,{before:moveStart.before,after:moveEnd,moved});
  await page.evaluate(idx=>{
    const v=window.idm.viewer;
    v.undo();
    v.selectItem(idx);
    v.removeSelected();
    v.setView('axon');
  },editFixture.idx);
  await page.waitForTimeout(450);

  const blocked=await page.evaluate(()=>{
    const v=window.idm.viewer;
    const before=v.getLayout().length;
    const placed=v.placeProduct('prd-kivik-sofa',10.45,4.95,{ry:0});
    const after=v.getLayout().length;
    if(placed) v.undo();
    return {placed:!!placed,before,after};
  });
  record('invalid bathroom-area furniture placement is blocked',!blocked.placed&&blocked.after===blocked.before,blocked);

  const share=await page.evaluate(()=>{
    const v=window.idm.viewer;
    const hash=v.encodeShare();
    const before=v.getLayout();
    v.setLayout([]);
    const decoded=v.applyShare(hash);
    const after=v.getLayout();
    return {hashLength:hash.length,before,after,decoded:decoded?.layout?.length??-1};
  });
  const roundTrip=share.before.length===share.after.length&&share.before.every((it,i)=>it.productId===share.after[i].productId&&Math.abs(it.x-share.after[i].x)<.02&&Math.abs(it.z-share.after[i].z)<.02);
  record('share hash round trip preserves layout/productId',roundTrip,{hashLength:share.hashLength,count:share.after.length});

  const exported=await page.evaluate(()=>{const d=window.idm.viewer.exportProducts();return{items:d.items.length,placed:d.placed.length,evidence:d.items.every(i=>Array.isArray(i.evidence)&&i.evidence.length>0)};});
  record('product export carries evidence',exported.items>0&&exported.evidence,exported);

  const walkCheck=await page.evaluate(async()=>{
    const v=window.idm.viewer;
    const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    v.focusRoom('rm-open-living');
    v.setView('walk');
    await delay(1200);
    const start=v.walkState();
    let best=0;
    let bestDirection=null;
    for(const direction of [[0,1],[1,0],[0,-1],[-1,0]]){
      const before=v.walkState().position;
      v.walkAnalog(direction[0],direction[1]);
      await delay(1200);
      v.walkAnalog(0,0);
      await delay(120);
      const after=v.walkState().position;
      const distance=Math.hypot(after[0]-before[0],after[2]-before[2]);
      if(distance>best){best=distance;bestDirection=direction;}
      if(best>.08)break;
    }
    const end=v.walkState();
    v.setView('axon');
    return {start,end,moved:best,direction:bestDirection};
  });
  record('walkthrough has colliders and can move in a legal direction',walkCheck.start.active&&walkCheck.start.colliders>0&&walkCheck.moved>.08,{colliders:walkCheck.start.colliders,moved:+walkCheck.moved.toFixed(2),direction:walkCheck.direction,blocked:walkCheck.end.blocked});
  await page.waitForTimeout(400);

  record('no console errors (desktop)',errors.length===0,errors.slice(0,8));
  await desktop.close();

  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
  const mp=await mobile.newPage();
  const mobileErrors=[];
  mp.on('console',m=>{if(m.type()==='error')mobileErrors.push(m.text());});
  mp.on('pageerror',e=>mobileErrors.push('pageerror: '+e.message));
  await mp.goto(BASE,{waitUntil:'domcontentloaded',timeout:90000});
  await waitForFirstFrame(mp);
  const mobileState=await mp.evaluate(()=>({quality:window.idm.viewer.getQuality(),view:window.idm.viewer.getView(),calls:JSON.parse(document.querySelector('#viewport').dataset.render||'{}').calls||0}));
  record('mobile first frame uses medium-or-lower quality',mobileState.calls>0&&mobileState.quality!=='high',mobileState);
  const mobileShot=path.join(OUT,'mobile-orbit.png');
  await mp.screenshot({path:mobileShot,timeout:90000});
  record('mobile screenshot',fs.existsSync(mobileShot),mobileShot);
  record('no console errors (mobile)',mobileErrors.length===0,mobileErrors.slice(0,8));
  await mobile.close();

  const receipt={ranAt:new Date().toISOString(),base:BASE,checks:results,passed:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length};
  fs.writeFileSync(path.join(OUT,'receipt.json'),JSON.stringify(receipt,null,2));
  console.log(`\n${receipt.passed} passed, ${receipt.failed} failed`);
  exitCode=receipt.failed?1:0;
}catch(error){
  console.error('SMOKE ERROR: '+(error.stack||error.message));
  exitCode=1;
}finally{
  await browser?.close();
  if(!process.argv.includes('--keep'))server.kill();
}
process.exit(exitCode);
