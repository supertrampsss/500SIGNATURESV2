import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const HOME='/mandats/';
async function activate(locator,info){if(info.project.use.hasTouch)await locator.tap();else await locator.click();}
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);}
async function begin(page,mode,info){await page.goto(HOME);await activate(page.getByRole('button',{name:mode==='municipal'?/Gouverner une ville/:/Gouverner la France/}),info);await expect(page.locator('.dossier')).toBeVisible();}
async function choose(page,info){await activate(page.locator('[data-action="choose"]:not([disabled])').first(),info);await expect(page.locator('.dossier,.result').first()).toBeVisible();await expect(page.locator('.game-content > .resolution')).toHaveCount(0);await noOverflow(page);}
for(const mode of ['municipal','national'])test(`${mode}: complete touch campaign, sharing and replay`,async({page},info)=>{
 await begin(page,mode,info);
 for(let year=0;year<(mode==='municipal'?6:5);year++){
  await expect(page.locator('h1')).toBeFocused();
  if(info.project.use.viewport?.height>600&&info.project.name!=='desktop-chromium'){const box=await page.locator('h1').boundingBox();expect(box.y+box.height).toBeLessThan(info.project.use.viewport.height);}
  await choose(page,info);
 }
 await expect(page.locator('.result')).toBeVisible();await expect(page.locator('.score-number')).toContainText('/100');
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
 await fresh.locator('#save-file').setInputFiles({name:'large.json',mimeType:'application/json',buffer:Buffer.from('x'.repeat(2100))});await expect(fresh.getByRole('dialog').getByRole('status')).toContainText('volumineux');await noOverflow(fresh);
 await fresh.locator('#save-file').setInputFiles({name:'save.json',mimeType:'application/json',buffer});await expect(fresh.getByRole('dialog')).not.toBeVisible();await expect(fresh.locator('.dossier h1')).toContainText('Qui finance');await fresh.reload();await activate(fresh.getByRole('button',{name:/Reprendre/}),info);await expect(fresh.locator('.dossier h1')).toContainText('Qui finance');await context.close();
});
test('territory, sandbox and reduced motion keep the saved mandate intact',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await begin(page,'national',info);await choose(page,info);
 await activate(page.getByRole('button',{name:'Territoire',exact:true}),info);await expect(page.locator('.governance-indicators')).toContainText('Confiance');await expect(page.locator('.governance-indicators')).toContainText('Patrimoine');await noOverflow(page);
 const saved=await page.evaluate(()=>localStorage.getItem('500signatures.mandats.v1'));
 await activate(page.getByRole('button',{name:'Atelier',exact:true}),info);await page.locator('[data-plan-year="0"]').selectOption('neutre');await expect(page.locator('.planner')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('500signatures.mandats.v1'))).toBe(saved);await noOverflow(page);
 await activate(page.getByRole('button',{name:'Décider',exact:true}),info);const motion=await page.locator('.choice').first().evaluate(el=>getComputedStyle(el).transitionDuration);expect(motion).toBe('0s');
});
test('challenge URL is consumed and clipboard failure has an accessible fallback',async({page},info)=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('test denial'))}});});
 await page.goto(HOME+'?mode=municipal&v=2&ambition=services&seed=42');await choose(page,info);expect(new URL(page.url()).search).toBe('');
 await page.locator('.turn-feedback > summary').click();await activate(page.getByRole('button',{name:'Partager cette décision',exact:true}),info);await activate(page.getByRole('button',{name:'Copier le lien',exact:true}),info);await expect(page.getByRole('textbox',{name:'Lien à copier'})).toBeFocused();await expect(page.getByRole('textbox')).toHaveValue(/#dilemma=/);await noOverflow(page);
 await page.reload();await activate(page.getByRole('button',{name:/Reprendre/}),info);await expect(page.locator('.dossier h1')).toContainText('Qui finance');
});
test('opt-in offline preparation survives network loss',async({page,context},info)=>{
 test.skip(info.project.name!=='android-chromium','One service-worker lifecycle check is sufficient; other projects cover the game.');
 await begin(page,'municipal',info);await choose(page,info);await activate(page.getByRole('button',{name:'Ma partie',exact:true}),info);await page.getByText('Installer et jouer hors connexion',{exact:true}).click();await activate(page.getByRole('button',{name:'Préparer le jeu hors connexion',exact:true}),info);await expect(page.getByRole('dialog').getByRole('status')).toContainText('prêt hors connexion',{timeout:45000});
 await context.setOffline(true);await page.goto(HOME);await activate(page.getByRole('button',{name:/Reprendre/}),info);await expect(page.locator('.dossier h1')).toContainText('Qui finance');await choose(page,info);await activate(page.getByRole('button',{name:'Territoire',exact:true}),info);await expect.poll(()=>page.locator('.mobile-territory-world img').evaluateAll(images=>images.length>0&&images.every(image=>image.complete&&image.naturalWidth>0))).toBe(true);await context.setOffline(false);
});

test('source-backed guides are readable and lead to the matching mode',async({page},info)=>{
 await page.goto('/mandats/comprendre/');await expect(page.locator('.guide-list article')).toHaveCount(4);await noOverflow(page);
 await page.locator('.guide-list article a').first().click();await expect(page.getByRole('heading',{name:'Sources et périmètre',exact:true})).toBeVisible();await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,follow');await noOverflow(page);
 await activate(page.getByRole('link',{name:'Tester ce type d’arbitrage',exact:true}),info);await expect(page.locator('.dossier')).toBeVisible();
});

test('optional priorities persist and turn details never block the next choice',async({page},info)=>{
 await begin(page,'municipal',info);await page.getByText('Cap : Équilibre',{exact:true}).click();await activate(page.locator('[data-action="ambition"][data-ambition="services"]'),info);
 await page.reload();await activate(page.getByRole('button',{name:/Reprendre/}),info);await expect(page.getByText('Cap : Services',{exact:true})).toBeVisible();
 await choose(page,info);await expect(page.locator('.dossier h1')).toContainText('Qui finance');await expect(page.locator('.turn-feedback')).not.toHaveAttribute('open','');
 await page.locator('.turn-feedback > summary').click();await expect(page.getByRole('button',{name:'Partager cette décision',exact:true})).toBeVisible();await page.locator('.turn-feedback > summary').click();await expect(page.locator('.dossier h1')).toContainText('Qui finance');
});
