import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const HOME='/mandats/';
const publicationFixture=JSON.parse(await readFile(new URL('./fixtures/editorial-publication.json',import.meta.url),'utf8'));
const CITY_SECOND='Faut-il ouvrir la mairie un soir ?';
async function activate(locator,info){if(info.project.use.hasTouch)await locator.tap();else await locator.click();}
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);}
async function begin(page,mode,info){await page.goto(HOME);await activate(page.getByRole('button',{name:mode==='municipal'?/Gouverner une ville/:/Gouverner la France/}),info);await expect(page.locator('.initial-cap-card')).toHaveCount(0);if(mode==='municipal')await activate(page.getByRole('button',{name:'Jouer avec la ville fictive',exact:true}),info);await expect(page.locator('.dossier')).toBeVisible();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')).version)).toBe(4);}
async function choose(page,info){await activate(page.locator('[data-action="choose"]:not([disabled])').first(),info);await expect(page.locator('.dossier,.result').first()).toBeVisible();await expect(page.locator('.game-content > .resolution')).toHaveCount(0);await noOverflow(page);}
for(const mode of ['municipal','national'])test(`${mode}: complete touch campaign, sharing and replay`,async({page},info)=>{
 test.setTimeout(120000);
 await begin(page,mode,info);
 for(let decision=0;decision<45;decision++){
  await expect(page.locator('h1')).toBeFocused();
  if(info.project.use.viewport?.height>600&&info.project.name!=='desktop-chromium'){const box=await page.locator('h1').boundingBox();expect(box.y+box.height).toBeLessThan(info.project.use.viewport.height);}
  await choose(page,info);
 }
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')).choices.length)).toBe(45);
 await expect(page.locator('.result')).toBeVisible();await expect(page.locator('[data-action="replay-ambition"]')).toHaveCount(0);await expect(page.locator('.score-number')).toContainText('/100');
 await activate(page.getByRole('button',{name:'Partager mon héritage',exact:true}),info);await expect(page.getByRole('dialog')).toHaveAccessibleName('Partager votre mandat');
 const downloadEvent=page.waitForEvent('download');await activate(page.getByRole('button',{name:'1200 × 630',exact:true}),info);const download=await downloadEvent;const bytes=await readFile(await download.path());expect(bytes.subarray(1,4).toString()).toBe('PNG');expect(bytes.readUInt32BE(16)).toBe(1200);expect(bytes.readUInt32BE(20)).toBe(630);
 await activate(page.getByRole('button',{name:'Défi',exact:true}),info);await expect(page.locator('.share-preview')).toContainText('SANS VOS CHOIX');await noOverflow(page);await activate(page.getByRole('button',{name:'Fermer',exact:true}),info);
 await activate(page.getByRole('button',{name:'Rejouer le même défi',exact:true}),info);await expect(page.locator('.dossier')).toBeVisible();
});
test('fresh-device import, invalid files, export and resume',async({page,browser},info)=>{
 await begin(page,'municipal',info);await choose(page,info);await activate(page.getByRole('button',{name:'Ma partie',exact:true}),info);
 const downloaded=page.waitForEvent('download');await activate(page.getByRole('button',{name:'Exporter la sauvegarde',exact:true}),info);const file=await downloaded;const buffer=await readFile(await file.path());
 const {viewport,isMobile,hasTouch,deviceScaleFactor,userAgent}=info.project.use;const context=await browser.newContext({viewport,isMobile,hasTouch,deviceScaleFactor,userAgent,baseURL:'http://127.0.0.1:4180'});const fresh=await context.newPage();await fresh.goto(HOME);await activate(fresh.getByRole('button',{name:'Ma partie',exact:true}),info);
 await fresh.locator('#save-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await expect(fresh.getByRole('dialog').getByRole('status')).not.toBeEmpty();
 await fresh.locator('#save-file').setInputFiles({name:'large.json',mimeType:'application/json',buffer:Buffer.from('x'.repeat(65537))});await expect(fresh.getByRole('dialog').getByRole('status')).toContainText('volumineux');await noOverflow(fresh);
 await fresh.locator('#save-file').setInputFiles({name:'save.json',mimeType:'application/json',buffer});await expect(fresh.getByRole('dialog')).not.toBeVisible();await expect(fresh.locator('.dossier h1')).toContainText(CITY_SECOND);await fresh.reload();await activate(fresh.getByRole('button',{name:/Reprendre/}),info);await expect(fresh.locator('.dossier h1')).toContainText(CITY_SECOND);await context.close();
});
test('territory, sandbox and reduced motion keep the saved mandate intact',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await begin(page,'national',info);await choose(page,info);
 await activate(page.getByRole('button',{name:'Territoire',exact:true}),info);await expect(page.locator('.governance-indicators')).toContainText('Confiance');await expect(page.locator('.governance-indicators')).toContainText('Patrimoine');await noOverflow(page);
 const saved=await page.evaluate(()=>localStorage.getItem('500signatures.mandats.v1'));
 await activate(page.getByRole('button',{name:'Atelier',exact:true}),info);await page.locator('[data-plan-year="0"]').selectOption('n01b');await expect(page.locator('.planner')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('500signatures.mandats.v1'))).toBe(saved);await noOverflow(page);
 await activate(page.getByRole('button',{name:'Décider',exact:true}),info);const motion=await page.locator('.choice').first().evaluate(el=>getComputedStyle(el).transitionDuration);expect(motion).toBe('0s');
});
test('challenge URL is consumed and clipboard failure has an accessible fallback',async({page},info)=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('test denial'))}});});
 await page.goto(HOME+'?mode=municipal&v=2&ambition=services&seed=42');await choose(page,info);expect(new URL(page.url()).search).toBe('');
 await page.getByRole('button',{name:'Voir les effets',exact:true}).click();await activate(page.getByRole('button',{name:'Partager cette décision',exact:true}),info);await activate(page.getByRole('button',{name:'Copier le lien',exact:true}),info);await expect(page.getByRole('textbox',{name:'Lien à copier'})).toBeFocused();await expect(page.getByRole('textbox')).toHaveValue(/#dilemma=/);await noOverflow(page);
 await page.reload();await activate(page.getByRole('button',{name:/Reprendre/}),info);await expect(page.locator('.dossier h1')).toContainText('Qui finance');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')).version)).toBe(2);
});
test('opt-in offline preparation survives network loss',async({page,context},info)=>{
 test.skip(info.project.name!=='android-chromium','One service-worker lifecycle check is sufficient; other projects cover the game.');
 await begin(page,'municipal',info);await choose(page,info);await activate(page.getByRole('button',{name:'Ma partie',exact:true}),info);await activate(page.getByRole('button',{name:'Préparer le jeu hors connexion',exact:true}),info);await expect(page.getByRole('dialog').getByRole('status')).toContainText('prêt hors connexion',{timeout:45000});
 await context.setOffline(true);await page.goto(HOME);await activate(page.getByRole('button',{name:/Reprendre/}),info);await expect(page.locator('.dossier h1')).toContainText(CITY_SECOND);await choose(page,info);await activate(page.getByRole('button',{name:'Territoire',exact:true}),info);await expect.poll(()=>page.locator('.mobile-territory-world img').evaluateAll(images=>images.length>0&&images.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);await context.setOffline(false);
});

test('source-backed guides are readable and lead to the matching mode',async({page},info)=>{
 await page.goto('/mandats/comprendre/');await expect(page.locator('.guide-list article')).toHaveCount(4);await noOverflow(page);
 await page.locator('.guide-list article a').first().click();await expect(page.getByRole('heading',{name:'Sources et périmètre',exact:true})).toBeVisible();await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,follow');await noOverflow(page);
 await activate(page.getByRole('link',{name:'Tester ce type d’arbitrage',exact:true}),info);await expect(page.locator('.dossier')).toBeVisible();
});

test('choose a city and start directly without a priority selector',async({page},info)=>{
 await page.goto(HOME);await activate(page.getByRole('button',{name:/Gouverner une ville/}),info);
 await expect(page.locator('.initial-cap-card')).toHaveCount(0);await expect(page.locator('#city-query')).toBeVisible();await expect(page.locator('.dossier')).toHaveCount(0);await noOverflow(page);
 await activate(page.getByRole('button',{name:'Jouer avec la ville fictive',exact:true}),info);await expect(page.locator('.dossier h1')).toBeFocused();await expect(page.locator('.initial-cap-card')).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')).ambition)).toBe('equilibre');
 await page.reload();await activate(page.getByRole('button',{name:/Reprendre/}),info);await expect(page.locator('[data-action="ambition"],[data-action="choose-cap"]')).toHaveCount(0);
 await choose(page,info);await expect(page.locator('.dossier h1')).toContainText(CITY_SECOND);await expect(page.locator('.dossier details')).toHaveCount(0);await expect(page.locator('.page-notes')).toContainText('Le contexte en détail');
 await expect(page.locator('.pulse')).toHaveCount(0);await expect(page.locator('.mobile-mandate-context')).toBeVisible();await expect(page.locator('.choice').first()).toHaveCSS('display','flex');await expect(page.locator('.choice-outcome').first()).toHaveCSS('display','block');
 await page.getByRole('button',{name:'Voir les effets',exact:true}).click();await expect(page.getByRole('button',{name:'Partager cette décision',exact:true})).toBeVisible();await activate(page.getByRole('button',{name:'Décider',exact:true}),info);await expect(page.locator('.dossier h1')).toContainText(CITY_SECOND);
});


async function cityPublication(page){
 await page.route('https://pub-fc39d357004540a182a907aed4875ef5.r2.dev/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  let body;
  if(path==='/data/derniere.json')body={version:publicationFixture.publication};
  else if(path.endsWith('/territoires/commune/index.json'))body=publicationFixture.index_commune;
  else if(path.endsWith('/territoires/commune/33.json'))body=publicationFixture.communes;
  else if(path.endsWith('/manifeste.json'))body={version:publicationFixture.publication,jeux:publicationFixture.jeux};
  await route.fulfill({status:body?200:404,contentType:'application/json',body:JSON.stringify(body??{})});
 });
 // API Découpage administratif centroid fixture. No location is invented by the application.
 await page.route('https://geo.api.gouv.fr/communes/33063?fields=centre',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({code:'33063',centre:{type:'Point',coordinates:[-.57918,44.837789]}})}));
}

test('real commune: observed baseline, optional map fallback and offline snapshot continuity',async({page,context},info)=>{
 test.setTimeout(120000);
 await cityPublication(page);
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(String(type).includes('webgl'))return null;return original.call(this,type,...args);};});
 const tiles=[];page.on('request',request=>{if(request.url().includes('tiles.openfreemap.org'))tiles.push(request.url());});
 await page.goto(HOME);
 await activate(page.getByRole('button',{name:/Gouverner une ville/}),info);
 await page.getByRole('searchbox',{name:'Nom de commune ou code INSEE'}).fill('Bordeaux');
 const cityButton=page.locator('#city-results [data-code="33063"]');
 await expect(cityButton).toBeVisible();
 await page.locator('#city-query').press('ArrowDown');await expect(cityButton).toBeFocused();await cityButton.press('Enter');
 await expect(page.locator('.mandate-setup')).toHaveCount(0);
 await expect(page.locator('.initial-cap-card')).toHaveCount(0);
 await expect(page.locator('.dossier')).toBeVisible();
 const initial=await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')));
 expect(initial.version).toBe(4);expect(initial.city.code).toBe('33063');expect(initial.city.name).toBe('Bordeaux');
 expect(initial.city.publication).toBe(publicationFixture.publication);expect(initial.city.year).toBe(2025);
 const observedFields={revenue:'ofgl_recettes_fonctionnement',operating:'ofgl_depenses_fonctionnement',debt:'ofgl_encours_dette',investment:'ofgl_depenses_d_investissement_hors_remb',savings:'ofgl_epargne_brute',financialCharges:'ofgl_charges_financieres',repayment:'ofgl_remboursements_d_emprunts_hors_gad',grants:'ofgl_subventions_recues_et_participations'};
 for(const [key,id] of Object.entries(observedFields))expect(initial.city.observed[key]).toBe(publicationFixture.communes['33063'].series[id]['2025']);
 expect(initial.city.center).toEqual({longitude:-.57918,latitude:44.837789,source:'https://geo.api.gouv.fr/communes/33063?fields=centre'});
 expect(tiles).toEqual([]);await expect(page.locator('.dossier h1')).toContainText('Comment dégager de l’argent dans le budget');await expect(page.locator('.campaign-position')).toContainText('1/45');await expect(page.locator('.page-notes')).toContainText('Source locale');await noOverflow(page);
 await activate(page.getByRole('button',{name:'Territoire',exact:true}),info);
 await activate(page.getByRole('button',{name:'Explorer la ville en 3D',exact:true}).first(),info);
 await expect(page.locator('.mandat-city-map__status').filter({hasText:'La carte est indisponible'}).first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Décider',exact:true})).toBeEnabled();await noOverflow(page);
 await activate(page.getByRole('button',{name:'Décider',exact:true}),info);await choose(page,info);
 expect((await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')))).city).toEqual(initial.city);
 if(info.project.name==='android-chromium'){
  await activate(page.getByRole('button',{name:'Ma partie',exact:true}),info);
  await activate(page.getByRole('button',{name:'Préparer le jeu hors connexion',exact:true}),info);
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('prêt hors connexion',{timeout:45000});
  await context.setOffline(true);
 }
 await page.goto(HOME);await activate(page.getByRole('button',{name:/Reprendre/}),info);
 await expect(page.locator('.dossier h1')).toContainText(CITY_SECOND);
 const resumed=await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')));
 expect(resumed.city).toEqual(initial.city);expect(resumed.choices).toHaveLength(1);
 await choose(page,info);await noOverflow(page);await context.setOffline(false);
 for(let decision=2;decision<45;decision++)await choose(page,info);
 await expect(page.locator('.result')).toBeVisible();
 expect((await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')))).choices).toHaveLength(45);
});


test('failed city loading keeps the search and fictional fallback usable',async({page},info)=>{
 await cityPublication(page);
 await page.route('**/territoires/commune/33.json',route=>route.fulfill({status:503,body:'Unavailable'}));
 await page.goto(HOME);await activate(page.getByRole('button',{name:/Gouverner une ville/}),info);
 await page.getByRole('searchbox',{name:'Nom de commune ou code INSEE'}).fill('Bordeaux');
 const cityButton=page.locator('#city-results [data-code="33063"]');
 await expect(cityButton).toBeVisible();await activate(cityButton,info);
 await expect(page.locator('#city-status')).not.toContainText('Chargement');
 await expect(cityButton).toBeEnabled();await expect(page.locator('#city-query')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('500signatures.mandats.v1'))).toBeNull();
 await activate(page.getByRole('button',{name:'Jouer avec la ville fictive',exact:true}),info);
 await expect(page.locator('.dossier h1')).toBeFocused();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')));
 expect(saved.turn).toBe(0);expect(saved.city).toBeUndefined();expect(saved.ambition).toBe('equilibre');
});
