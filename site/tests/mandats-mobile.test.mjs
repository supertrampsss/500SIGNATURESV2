import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const HOME='/mandats/';
async function activate(locator,info){if(info.project.use.hasTouch)await locator.tap();else await locator.click();}
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);}
async function begin(page,info){await page.goto(HOME);await activate(page.getByRole('button',{name:/Gouverner la France/}),info);await expect(page.locator('.mandate-board[data-mandate-board]')).toBeVisible();await expect(page.locator('.mandate-board [data-board-decision] .choice[data-action="choose"]:not([disabled])').first()).toBeVisible();await expect(page.locator('.campaign-position')).toContainText('Année 1 · décision 1/6');const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')));expect(saved.version).toBe(9);expect(saved.choices).toEqual([]);}
async function choose(page,info){const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')).choices.length);await activate(page.locator('[data-action="choose"]:not([disabled])').first(),info);const count=before+1;await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')).choices.length)).toBe(count);if(count%6===0){await expect(page.locator('.year-recap')).toBeVisible();await activate(page.locator(count===30?'.year-recap [data-action="show-result"]':'.year-recap [data-action="next-year"]'),info);if(count===30){await expect(page.locator('.living-result')).toBeVisible();}else{await expect(page.locator('.mandate-board[data-mandate-board]')).toHaveAttribute('data-year',String(count/6+1));await expect(page.locator('.mandate-board [data-board-decision] .choice[data-action="choose"]:not([disabled])').first()).toBeVisible();}}else{await expect(page.locator('.mandate-board[data-mandate-board]')).toHaveAttribute('data-turn',String(count));await expect(page.locator('.mandate-board [data-board-decision] .choice[data-action="choose"]:not([disabled])').first()).toBeVisible();}await expect(page.locator('.game-content > .resolution')).toHaveCount(0);await noOverflow(page);}
test('national: complete touch campaign, sharing and replay',async({page},info)=>{
 test.setTimeout(120000);
 await begin(page,info);
 for(let decision=0;decision<30;decision++){
  await expect(page.locator('h1')).toBeFocused();
  if(info.project.use.viewport?.height>600&&info.project.name!=='desktop-chromium'){const box=await page.locator('h1').boundingBox();expect(box.y+box.height).toBeLessThan(info.project.use.viewport.height);}
  await choose(page,info);
 }
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')).choices.length)).toBe(30);
 await expect(page.locator('.living-result')).toBeVisible();await expect(page.locator('.living-result__comparison')).toBeVisible();await expect(page.locator('[data-action="replay-ambition"]')).toHaveCount(0);await expect(page.locator('.score-number')).toHaveCount(0);
 await activate(page.getByRole('button',{name:'Partager mon héritage',exact:true}),info);await expect(page.getByRole('dialog')).toHaveAccessibleName('Partager votre mandat');
 const downloadEvent=page.waitForEvent('download');await activate(page.getByRole('button',{name:'1200 × 630',exact:true}),info);const download=await downloadEvent;const bytes=await readFile(await download.path());expect(bytes.subarray(1,4).toString()).toBe('PNG');expect(bytes.readUInt32BE(16)).toBe(1200);expect(bytes.readUInt32BE(20)).toBe(630);
 await activate(page.getByRole('button',{name:'Défi',exact:true}),info);await expect(page.locator('.share-preview')).toContainText('SANS VOS CHOIX');await noOverflow(page);await activate(page.getByRole('button',{name:'Fermer',exact:true}),info);
 await activate(page.getByRole('button',{name:'Rejouer exactement ce défi',exact:true}),info);await expect(page.locator('.dossier')).toBeVisible();
});
test('fresh-device national import, invalid files, export and resume',async({page,browser},info)=>{
 await begin(page,info);await choose(page,info);await activate(page.getByRole('button',{name:'Ma partie',exact:true}),info);
 const downloaded=page.waitForEvent('download');await activate(page.getByRole('button',{name:'Exporter la sauvegarde',exact:true}),info);const file=await downloaded;const buffer=await readFile(await file.path());
 const {viewport,isMobile,hasTouch,deviceScaleFactor,userAgent}=info.project.use;const context=await browser.newContext({viewport,isMobile,hasTouch,deviceScaleFactor,userAgent,baseURL:new URL(page.url()).origin});const fresh=await context.newPage();await fresh.goto(HOME);await activate(fresh.getByRole('button',{name:'Ma partie',exact:true}),info);
 await fresh.locator('#save-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await expect(fresh.getByRole('dialog').getByRole('status')).not.toBeEmpty();
 await fresh.locator('#save-file').setInputFiles({name:'large.json',mimeType:'application/json',buffer:Buffer.from('x'.repeat(65537))});await expect(fresh.getByRole('dialog').getByRole('status')).toContainText('volumineux');await noOverflow(fresh);
 await fresh.locator('#save-file').setInputFiles({name:'save.json',mimeType:'application/json',buffer});await expect(fresh.getByRole('dialog')).not.toBeVisible();await expect(fresh.locator('.dossier h1')).toBeVisible();await fresh.reload();await activate(fresh.getByRole('button',{name:/Reprendre/}),info);await expect(fresh.locator('.dossier h1')).toBeVisible();await context.close();
});
test('territory, sandbox and reduced motion keep the saved mandate intact',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await begin(page,info);await choose(page,info);
 await activate(page.getByRole('button',{name:'Bilan',exact:true}),info);const review=page.locator('.cinema-review__summary');await expect(review).toContainText('Confiance');await expect(review.locator('details').filter({hasText:'Comptes et indicateurs'}).locator('summary')).toBeVisible();await review.locator('details').filter({hasText:'Comptes et indicateurs'}).locator('summary').click();await expect(review).toContainText('Patrimoine');await noOverflow(page);
 const saved=await page.evaluate(()=>localStorage.getItem('500signatures.mandats.v1'));
 await activate(page.getByRole('button',{name:'Ma partie',exact:true}),info);await activate(page.getByRole('button',{name:'Comparer une autre stratégie',exact:true}),info);await page.locator('[data-plan-year="0"]').selectOption('r01b');await expect(page.locator('.planner')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('500signatures.mandats.v1'))).toBe(saved);await noOverflow(page);
 await activate(page.getByRole('button',{name:'Décider',exact:true}),info);const motion=await page.locator('.choice').first().evaluate(el=>getComputedStyle(el).transitionDuration);expect(motion).toBe('0s');
});
test('municipal mandate stays unavailable and keeps an existing save',async({page},info)=>{
 const municipalSave={version:2,mode:'municipal',seed:42,choices:[],ambition:'equilibre'};
 await page.addInitScript(save=>localStorage.setItem('500signatures.mandats.v1',JSON.stringify(save)),municipalSave);
 await page.goto(HOME+'?mode=municipal&v=4&ambition=equilibre&seed=42');await expect(page.locator('[role="status"]')).toContainText('mandat communal est temporairement indisponible');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')))).toEqual(municipalSave);
 await page.reload();await expect(page.locator('[role="status"]')).toContainText('mandat communal est temporairement indisponible');
 await expect(page.locator('[role="status"]')).toContainText('mandat communal est temporairement indisponible');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')))).toEqual(municipalSave);
});
test('opt-in offline preparation survives network loss with the cinematic game art',async({page,context},info)=>{
 test.skip(info.project.name!=='android-chromium','One service-worker lifecycle check is sufficient; other projects cover the game.');
 await begin(page,info);await choose(page,info);await activate(page.getByRole('button',{name:'Ma partie',exact:true}),info);await activate(page.getByRole('button',{name:'Préparer le jeu hors connexion',exact:true}),info);await expect(page.getByRole('dialog').getByRole('status')).toContainText('prêt hors connexion',{timeout:45000});
 await context.setOffline(true);await page.goto(HOME);await activate(page.getByRole('button',{name:/Reprendre/}),info);await expect(page.locator('.dossier h1')).toBeVisible();await choose(page,info);await expect.poll(()=>page.locator('[data-cinema-art]').evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);await activate(page.getByRole('button',{name:'Bilan',exact:true}),info);await expect.poll(()=>page.locator('.mobile-territory-world img').evaluateAll(images=>images.length>0&&images.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);await context.setOffline(false);
});

test('source-backed guides are readable and lead to the matching mode',async({page},info)=>{
 await page.goto('/mandats/comprendre/');await expect(page.locator('.guide-list article')).toHaveCount(4);await noOverflow(page);
 await page.locator('.guide-list article').filter({hasText:'FINANCES NATIONALES'}).first().locator('a').click();await expect(page.getByRole('heading',{name:'Sources et périmètre',exact:true})).toBeVisible();await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,follow');await noOverflow(page);
 await activate(page.getByRole('link',{name:'Tester ce type d’arbitrage',exact:true}),info);await expect(page.locator('.dossier')).toBeVisible();
});

test('municipal entry announces its unavailability without creating a save',async({page},info)=>{
 await page.goto(HOME+'?mode=municipal&v=4&ambition=equilibre&seed=42');
 await expect(page.locator('[role="status"]')).toContainText('mandat communal est temporairement indisponible');
 expect(await page.evaluate(()=>localStorage.getItem('500signatures.mandats.v1'))).toBeNull();
 await expect(page.getByRole('button',{name:/Gouverner la France/})).toBeVisible();await noOverflow(page);
});
test('national scene keeps one living SVG across decisions and offers an accessible territory', async ({page}, info) => {
 test.skip(info.project.name !== 'desktop-chromium' && info.project.name !== 'android-chromium', 'Persistent scene integration at both layout sizes');
 await begin(page,info);
 const host=page.locator('[data-national-scene]:visible').first();
 await expect(host).toHaveAttribute('data-state','ready');
 await expect(page.locator('[data-national-scene] .winter-scene-layers')).toHaveCount(1);
 await page.locator('[data-national-scene] .winter-scene-layers').evaluate(svg=>svg.dataset.instance='original');
 await info.attach('france-start', {body:await page.screenshot(),contentType:'image/png'});
 for(let i=0;i<5;i++) await choose(page,info);
 await expect(page.locator('[data-national-scene] .winter-scene-layers')).toHaveAttribute('data-instance','original');
 await choose(page,info);
 const secondYearScene=page.locator('[data-national-scene]:visible .winter-scene-layers').first();
 await secondYearScene.evaluate(svg=>svg.dataset.instance='year-two');
 for(let i=0;i<4;i++) await choose(page,info);
 await expect(page.locator('[data-national-scene] .winter-scene-layers')).toHaveAttribute('data-instance','year-two');
 await info.attach('france-year-two', {body:await page.screenshot(),contentType:'image/png'});
 await activate(page.getByRole('button',{name:'Bilan',exact:true}),info);
 await expect(page.locator('[data-national-scene]:visible .winter-scene-layers')).toHaveAttribute('data-instance','year-two');
 await expect(page.getByRole('button',{name:'Espaces ruraux',exact:true})).toBeVisible();
 await activate(page.getByRole('button',{name:'Espaces ruraux',exact:true}),info);
 await expect(page.getByRole('dialog')).toBeVisible();
 await noOverflow(page);
});

test('national living scene and all 30 v9 decisions work without WebGL',async({page},info)=>{
 test.skip(info.project.name!=='android-chromium','The national living scene does not require a GPU renderer');
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(String(type).includes('webgl'))return null;return original.call(this,type,...args);};});
 await begin(page,info);
 await expect(page.locator('[data-national-scene]:visible')).toHaveAttribute('data-state','ready');
 await expect(page.locator('[data-national-scene]:visible img')).toBeVisible();
 for(let i=0;i<30;i++) await choose(page,info);
 await expect(page.locator('.result')).toBeVisible();
});
