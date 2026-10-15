import {chromium,webkit} from '../../site/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out=new URL('./screens',import.meta.url).pathname;await mkdir(out,{recursive:true});
for(const engine of ['chromium','webkit']) {
const browser=await (engine==='chromium'?chromium:webkit).launch(engine==='chromium'?{executablePath:process.env.MANDATS_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']}:{executablePath:process.env.MANDATS_WEBKIT_EXECUTABLE});
try{for(const [name,width,height] of (engine==='chromium'?[['desktop',1672,941],['mobile',390,844],['compact',320,740]]:[['webkit',390,844]])){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:engine==='webkit'?2:1,isMobile:name!=='desktop',hasTouch:name!=='desktop',locale:'fr-FR',reducedMotion:'reduce'}),page=await context.newPage(),errors=[],requests=[],responses=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 page.on('response',async r=>{if(new URL(r.url()).pathname.startsWith('/assets/')&&r.ok()){try{const b=await r.body();responses.push({path:new URL(r.url()).pathname,sha256:createHash('sha256').update(b).digest('hex'),bytes:b.length});}catch{}}});
 await page.goto((process.env.MANDATS_PREVIEW_URL??'http://127.0.0.1:4194')+'/mandats/?mode=national&v=12&seed=0&ambition=equilibre');
 await page.locator('[data-mandate-map][data-renderer="illustrated"]').waitFor();await page.evaluate(()=>document.fonts.ready);
 const capture=async stage=>{await page.screenshot({path:`${out}/${name}-${stage}.png`,fullPage:false});await writeFile(`${out}/${name}-${stage}.json`,JSON.stringify({browser:browser.version(),engine,url:page.url(),viewport:{width,height},errors,requests,assets:responses,game:await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')??'null')),map:await page.locator('[data-mandate-map]').evaluate(e=>({...e.dataset})),image:await page.locator('[data-map-illustration]').evaluate(e=>({src:e.currentSrc,naturalWidth:e.naturalWidth,naturalHeight:e.naturalHeight,rect:e.getBoundingClientRect().toJSON()})),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)},null,2));};
 await capture('national'); if(name!=='desktop') await page.screenshot({path:`${out}/${name}-full.png`,fullPage:true});
 await page.locator('[data-action="story-select"][data-story-id="education-lycees"]').first().click();await capture('subject');
 await page.locator('[data-action="choose"][data-choice="regrouper"], [data-action="choose"][data-choice$="-regrouper"]').click();await page.keyboard.press('Escape');await page.locator('[data-map-marker^="mvt-lyceens"]').waitFor();await capture('movement');
 await context.close();
}}finally{await browser.close();}

}
