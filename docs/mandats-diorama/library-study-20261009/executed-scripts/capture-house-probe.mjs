import { chromium } from '/workspace/500SIGNATURESV2/site/node_modules/playwright/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const origin = process.argv[2];
const captureFolder = process.argv[3];
if (!origin || !captureFolder) throw Error('Usage: node capture-native.mjs <actual-origin> <capture-folder>');
const folder = join('/workspace/mandats-verification/authored-3d', captureFolder);
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const browserVersion=browser.version();
try {
 const context=await browser.newContext({viewport:{width:1672,height:941},deviceScaleFactor:1,locale:'fr-FR',reducedMotion:'reduce'});
 try {
  const candidate=await readFile('/workspace/mandats-verification/authored-3d/library-adaptation38/architecture-house-probe.glb');
  const overrides=[];
  await context.route('**/mandats/models/architecture.glb?*',async route=>{
   overrides.push({url:route.request().url(),bytes:candidate.length,sha256:createHash('sha256').update(candidate).digest('hex'),method:'Experimental model response override; no production asset changed'});
   await route.fulfill({status:200,contentType:'model/gltf-binary',body:candidate});
  });
  const page=await context.newPage(); page.setDefaultTimeout(45000);
  const errors=[],failedRequests=[],failedResponses=[],consoleMessages=[],actions=[];
  const servedBundleResponses=[],responseBodyErrors=[],responseTasks=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('requestfailed',request=>failedRequests.push({url:request.url(),error:request.failure(),at:new Date().toISOString()}));
  page.on('console',message=>consoleMessages.push({type:message.type(),text:message.text(),location:message.location(),at:new Date().toISOString()}));
  page.on('response',response=>{
   const url=response.url(),status=response.status();
   if(status>=400)failedResponses.push({url,status,at:new Date().toISOString()});
   const path=new URL(url).pathname;
   if(status<200||status>=300||!path.startsWith('/assets/')||!/\.(?:js|css)$/.test(path))return;
   const task=(async()=>{
    const failure=await response.finished();
    if(failure)throw failure;
    const body=await response.body();
    servedBundleResponses.push({url,path:path.slice(1),status,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')});
   })().catch(error=>responseBodyErrors.push({url,error:String(error)}));
   responseTasks.push(task);
  });
  const nav=await page.goto(origin+'/mandats/?mode=national&v=12&seed=0&ambition=equilibre',{waitUntil:'domcontentloaded'});
  const start=page.locator('[data-action="new-run"]');
  if(await start.isVisible().catch(()=>false)){await start.click();actions.push('Click Commencer un mandat');}
  const map=page.locator('[data-mandate-map][data-renderer="babylon"]');
  await map.waitFor({timeout:120000});
  await page.evaluate(()=>document.fonts.ready);
  const inputs=()=>page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('500signatures.mandats.v1')??'null');return saved?Object.fromEntries(['version','mode','seed','ambition','choices','focus'].filter(k=>saved[k]!==undefined).map(k=>[k,saved[k]])):{version:12,mode:'national',seed:0,ambition:'equilibre',choices:[]};});
  async function capture(stage,description){
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.waitForFunction(()=>document.querySelector('[data-mandate-map][data-renderer="babylon"]')?.dataset.renderPending==='false',null,{timeout:45000});
   const saved=await inputs();
   if(saved.choices.length!==0)throw Error('A map manipulation spent a decision');
   const data=await map.evaluate(node=>({...node.dataset}));
   const layout=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,viewportHeight:innerHeight,devicePixelRatio,scrollY,canvas:document.querySelector('[data-map-canvas]')?.getBoundingClientRect().toJSON()}));
   const raster=await page.locator('[data-map-canvas]').evaluate(canvas=>({width:canvas.width,height:canvas.height}));
   const servedResources=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>({url:e.name,initiator:e.initiatorType,transfer:e.transferSize,duration:Math.round(e.duration)})));
   await page.screenshot({path:join(folder,stage+'.png'),fullPage:false});
   await map.screenshot({path:join(folder,stage+'-carte.png')});
   await page.locator('[data-map-canvas]').screenshot({path:join(folder,stage+'-canvas.png')});
   await Promise.all([...responseTasks]);
   await writeFile(join(folder,stage+'.json'),JSON.stringify({experimentalModelOverride:overrides,productionBuild:'37 unchanged',browserVersion,servedBundleResponses:[...servedBundleResponses],responseBodyErrors:[...responseBodyErrors],failedResponses:[...failedResponses],consoleMessages:[...consoleMessages],capturedAt:new Date().toISOString(),origin,description,actions:[...actions],inputs:saved,data,layout,raster,servedResources,errors:[...errors],failedRequests:[...failedRequests],navigation:{status:nav.status()},method:'EXPERIMENTAL maison_alsace_01 and distant response override over actual build37. This is not production or an original timing gate. Fresh Chromium context at1672x941 with fonts loaded/reduced motion. Each capture waits for data-render-pending=false after two animation frames, using the existing45000ms native timeout. Browser version comes from browser.version(); HTTP failures and every console level come from page events; served JS/CSS hashes come from the actual response bodies. Native DOM controls, pointer panning and camera buttons only. No camera API, no game state injection. Sector labels are visual review candidates, not geographic assertions from UI.'},null,2));
   await writeFile(join(folder,stage+'-inputs.json'),JSON.stringify(saved,null,2));
   if(errors.length)throw Error(errors.join('\n'));
   if(layout.scrollWidth>layout.viewportWidth+1)throw Error('Horizontal overflow');
   console.log(JSON.stringify({stage,description,data,errors,failedRequests}));
  }
  await capture('01-national','Actual initial v12 seed0 national view');
  const assembly=page.locator('[data-map-marker^="institutional:"]');
  if(await assembly.isVisible().catch(()=>false)){
   await assembly.click();actions.push('Click the actual Assembly marker');
   const paris=page.locator('[data-action="map-inspect"][data-place="paris"]');
   if(await paris.isVisible().catch(()=>false)){
    await paris.click();actions.push('Click Voir le lieu for Paris');
    await capture('02-paris-detail','Native Paris inspection from the Assembly subject, no decision');
    await page.locator('[data-action="map-camera"][data-camera="out"]').click();actions.push('Click Réduire la carte to include the Paris and river basin surroundings');
    await capture('03-paris-seine','Native Paris inspection zoomed out once, including the surrounding river basin');
   }
   await page.locator('[data-action="map-camera"][data-camera="reset"]').click();actions.push('Click Recentrer after Paris inspection');
   await capture('03b-paris-recentree','After native Recentrer, before closing the institutional subject');
   const close=page.locator('[data-action="map-close"]');
   const closeState=await close.evaluate(node=>({bounds:node.getBoundingClientRect().toJSON(),disabled:node.disabled,style:{display:getComputedStyle(node).display,visibility:getComputedStyle(node).visibility,opacity:getComputedStyle(node).opacity,pointerEvents:getComputedStyle(node).pointerEvents},scrollY,ancestors:[...function*(){let n=node.parentElement;while(n){yield n;n=n.parentElement;}}()].slice(0,6).map(n=>({tag:n.tagName,className:n.className,bounds:n.getBoundingClientRect().toJSON(),scrollTop:n.scrollTop,clientHeight:n.clientHeight,scrollHeight:n.scrollHeight,overflow:getComputedStyle(n).overflow,display:getComputedStyle(n).display}))}));
   await writeFile(join(folder,'03b-close-state.json'),JSON.stringify(closeState,null,2));
   try{await close.click({timeout:10000});actions.push('Click Fermer le sujet after Paris inspection');}
   catch(error){
    await writeFile(join(folder,'03b-close-error.json'),JSON.stringify({error:String(error),inputs:await inputs(),state:closeState},null,2));
    await capture('03c-fermeture-echouee','The native institutional close click timed out; the actual state is retained. The next real marker can replace the subject without adopting a decision.');
   }
  }
  await page.locator('[data-action="map-camera"][data-camera="reset"]').click();actions.push('Click Recentrer');
  await page.locator('[data-map-marker="education-lycees"]').click();actions.push('Click the real education-lycees marker');
  await page.locator('[data-action="map-inspect"]').click();actions.push('Click Voir le lieu for Lyon');
  await capture('04-lyon-detail','Native Lyon inspection, no decision');
  await page.locator('[data-action="map-camera"][data-camera="out"]').click();actions.push('Click Réduire la carte to include Alpine surroundings');
  await capture('05-lyon-alpes','Native Lyon inspection zoomed out once, including nearby Alpine relief');
  await page.locator('[data-action="map-camera"][data-camera="reset"]').click();actions.push('Click Recentrer');
  await page.locator('[data-action="map-close"]').click();actions.push('Click Fermer le sujet');
  await capture('06-national-retour','Return to the national view after native map manipulations, with zero decisions');
 }finally{await context.close();}
}finally{await browser.close();}
