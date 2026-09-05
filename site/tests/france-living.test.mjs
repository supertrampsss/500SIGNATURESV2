import {test,expect} from '@playwright/test';
const HOME='/mandats/';
const FRANCE=HOME+'?mode=national';
const KEY='500signatures.mandats.v1';
const stage=page=>page.locator('[data-national-scene]:visible .winter-stage');
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);}
async function ready(page){
 await expect(page.locator('[data-national-scene]:visible')).toHaveAttribute('data-state','ready');
 await expect.poll(()=>stage(page).locator('.winter-stage-image').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
}
async function choose(page){await page.locator('[data-action="choose"]:not([disabled])').first().click();await expect(page.locator('.dossier,.result').first()).toBeVisible();}

test('the living France is the national mandate, with its budget and saved decisions',async({page},info)=>{
 await page.goto(FRANCE);await ready(page);
 await expect(page.locator('.campaign-position')).toContainText('Décision 1/45');
 await expect(page.locator('.mobile-mandate-context')).toContainText('Année 1/5');
 await expect(page.locator('.dossier h1')).toHaveText('Faut-il changer les impôts ?');
 await expect(page.locator('[data-action="choose"]')).toHaveCount(3);
 await expect(page.locator('.initial-cap-card,.winter-pilot-link,.winter-reserve')).toHaveCount(0);
 await noOverflow(page);
 await page.screenshot({path:info.outputPath('france-first-'+info.project.name+'.png'),fullPage:true});
 await choose(page);await choose(page);
 // After the annual wear, the second decision cuts services by two points in the national model.
 await expect(stage(page)).toHaveAttribute('data-warmth','0.540');
 await choose(page);await expect(stage(page)).toHaveAttribute('data-warmth','0.560');
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
 expect(saved.mode).toBe('national');expect(saved.version).toBe(4);expect(saved.choices).toHaveLength(3);
 expect(await page.evaluate(()=>localStorage.getItem('mandats.winter.v1'))).toBeNull();
 await page.getByRole('button',{name:'Finances',exact:true}).click();
 await expect(page.locator('.finance-panel')).toContainText('Md€');
 await expect(page.locator('.finance-panel')).toContainText('Dette');await noOverflow(page);
 await page.goto(HOME);await page.getByRole('button',{name:'Reprendre',exact:true}).click();
 await expect(page.locator('.campaign-position')).toContainText('Décision 4/45');await ready(page);
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY)).toEqual(saved);
 await choose(page);await expect(page.locator('.campaign-position')).toContainText('Décision 5/45');
 await noOverflow(page);
});

test('France animation pauses without changing the mandate and respects reduced motion',async({page},info)=>{
 test.skip(info.project.name!=='android-chromium'&&info.project.name!=='desktop-chromium','Animation is checked at both layouts; all projects cover national gameplay.');
 await page.goto(FRANCE);await ready(page);
 const person=()=>stage(page).locator('[data-person="0"]');
 const first=await person().getAttribute('transform');
 await expect.poll(()=>person().getAttribute('transform')).not.toBe(first);
 const light=page.locator('.header-actions [data-action="light-mode"]');
 await light.click();await expect(light).toHaveText('Vue illustrée');
 await expect(stage(page)).toHaveAttribute('data-animation-paused','true');
 const paused=await person().getAttribute('transform');
 await page.getByRole('button',{name:'Ma partie',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('button',{name:'Fermer',exact:true}).click();
 expect(await person().getAttribute('transform')).toBe(paused);
 await choose(page);await expect(page.locator('.campaign-position')).toContainText('Décision 2/45');
 await expect(stage(page)).toHaveAttribute('data-animation-paused','true');
 await light.click();await expect(light).toHaveText('Vue légère');
 const resumed=await person().getAttribute('transform');await expect.poll(()=>person().getAttribute('transform')).not.toBe(resumed);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(stage(page)).toHaveAttribute('data-animation-paused','true');
 await choose(page);await expect(page.locator('.campaign-position')).toContainText('Décision 3/45');
 await expect(stage(page)).toHaveAttribute('data-animation-paused','true');await noOverflow(page);
});

test('the national mandate and living art resume offline after explicit preparation',async({page,context},info)=>{
 test.skip(info.project.name!=='android-chromium','One national service-worker lifecycle test.');
 await page.goto(FRANCE);await ready(page);await choose(page);
 await page.getByRole('button',{name:'Ma partie',exact:true}).click();
 await page.getByRole('button',{name:'Préparer le jeu hors connexion',exact:true}).click();
 await expect(page.getByRole('dialog').getByRole('status')).toContainText('prêt hors connexion',{timeout:45000});
 await context.setOffline(true);await page.goto(HOME);await page.getByRole('button',{name:'Reprendre',exact:true}).click();
 await expect(page.locator('.campaign-position')).toContainText('Décision 2/45');await ready(page);
 await choose(page);await expect(page.locator('.campaign-position')).toContainText('Décision 3/45');
 expect((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY)).choices).toHaveLength(2);
 await context.setOffline(false);
});

test('the former winter link opens the complete France game',async({page},info)=>{
 test.skip(info.project.name!=='android-chromium','Legacy route redirect is shared by all browsers.');
 await page.goto('/mandats/france/hiver/');
 await expect(page.locator('.campaign-position')).toContainText('Décision 1/45');
 expect(new URL(page.url()).pathname).toBe(HOME);
 await expect(page.locator('.winter-reserve,.winter-decision-top')).toHaveCount(0);
 await choose(page);
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
 expect(saved.mode).toBe('national');expect(saved.choices).toHaveLength(1);
 expect(await page.evaluate(()=>localStorage.getItem('mandats.winter.v1'))).toBeNull();
});
