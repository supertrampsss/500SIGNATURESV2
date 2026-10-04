import {test,expect} from '@playwright/test';
const HOME='/mandats/';
const FRANCE=HOME+'?mode=national&v=7';
const KEY='500signatures.mandats.v1';
const stage=page=>page.locator('[data-national-scene]:visible');
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);}
async function ready(page){
 await expect(page.locator('[data-national-scene]:visible')).toHaveAttribute('data-state','ready');
 await expect.poll(()=>page.locator('[data-cinema-art]').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
}
async function choose(page){await page.locator('[data-action="choose"]:not([disabled])').first().click();await expect(page.locator('.dossier,.result').first()).toBeVisible();}

test('the living France is the national mandate, with its budget and saved decisions',async({page},info)=>{
 await page.goto(FRANCE);await ready(page);
 await expect(page.locator('.campaign-position')).toContainText('Décision 1/45');
 await expect(page.locator('.mobile-mandate-context')).toContainText('Année 1/5');
 await expect(page.locator('.dossier h1')).toHaveText('Faut-il réduire les pensions pour diminuer le déficit ?');
 await expect(page.locator('[data-action="choose"]')).toHaveCount(3);
 await expect(page.getByRole('button',{name:/Réduire de 20 % les pensions, y compris les petites retraites/})).toContainText('Économie : ≈35 Md€/an');
 await expect(page.locator('.initial-cap-card,.winter-pilot-link,.winter-reserve')).toHaveCount(0);
 await expect(page.getByText('Règles et sources',{exact:true})).toHaveCount(0);
 await noOverflow(page);
 await page.screenshot({path:info.outputPath('france-first-'+info.project.name+'.png'),fullPage:true});
 await expect(page.locator('.national-deficit')).toContainText('153');
 await choose(page);
 await expect(page.locator('.national-deficit')).toContainText('118');
 await expect(page.locator('.national-decision-impact')).toContainText('Déficit −35 Md€');
 await expect(page.locator('.dossier h1')).toHaveText('Faut-il compenser les retraités touchés par la baisse ?');
 await choose(page);
 // The pension reform opens its own consequence dossier, then staffing is a distinct reform.
 await expect(stage(page)).toHaveAttribute('data-turn','2');
 await expect(page.locator('.national-decision-impact')).toContainText('Retraités −2');
 await choose(page);await expect(stage(page)).toHaveAttribute('data-turn','3');
 await expect(stage(page)).toHaveAttribute('data-focus','national');
 await expect(page.locator('.national-model-label')).toHaveText('Décision 3 appliquée');
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
 expect(saved.mode).toBe('national');expect(saved.version).toBe(7);expect(saved.choices).toHaveLength(3);
 expect(await page.evaluate(()=>localStorage.getItem('mandats.winter.v1'))).toBeNull();
 await page.getByRole('button',{name:'Bilan',exact:true}).click();
 await expect(page.locator('.finance-panel')).toContainText('Md€');
 await expect(page.locator('.finance-panel')).toContainText('Dette');await noOverflow(page);
 await page.goto(HOME);await page.getByRole('button',{name:'Reprendre',exact:true}).click();
 await expect(page.locator('.campaign-position')).toContainText('Décision 4/45');await ready(page);
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY)).toEqual(saved);
 await choose(page);await expect(page.locator('.campaign-position')).toContainText('Décision 5/45');
 await noOverflow(page);
});

test('choosing a measure keeps the question in place instead of jumping to the top',async({page},info)=>{
 test.skip(info.project.name!=='android-chromium','The reported regression is a portrait phone interaction.');
 await page.goto(FRANCE);await ready(page);
  const choice=page.locator('[data-action="choose"]').first();
 await page.evaluate(()=>scrollTo(0,350));
 const before=await page.evaluate(()=>scrollY);
 expect(before).toBeGreaterThan(100);
 await choice.click();
 await expect(page.locator('.campaign-position')).toContainText('Décision 2/45');
 const after=await page.evaluate(()=>scrollY);
 expect(after).toBeGreaterThan(100);
 expect(Math.abs(after-before)).toBeLessThan(80);
});

test('France : la vue légère conserve la partie et le mouvement réduit reste utilisable',async({page},info)=>{
 test.skip(!['android-chromium','desktop-chromium'].includes(info.project.name),'Portrait et desktop.');
 await page.goto(FRANCE);await ready(page);
 const before=await page.evaluate(key=>localStorage.getItem(key),KEY);
 await page.getByRole('button',{name:'Ma partie',exact:true}).click();
 await page.locator('#details [data-action="light-mode"]').click();
 await expect(page.getByRole('dialog')).not.toBeVisible();
 await expect(page.locator('[data-national-scene]:visible')).toHaveAttribute('data-light','true');
 expect(await page.evaluate(key=>localStorage.getItem(key),KEY)).toBe(before);
 await page.emulateMedia({reducedMotion:'reduce'});await choose(page);
 await expect(page.locator('.campaign-position')).toContainText('Décision 2/45');
 await expect(page.locator('[data-national-scene]:visible')).toHaveAttribute('data-light','true');
 expect((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY)).choices).toHaveLength(1);await noOverflow(page);
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

test('an alternative pension choice changes the available continuation without changing the saved mandate',async({page})=>{
 await page.goto(FRANCE);await ready(page);
 await choose(page);
 await expect(page.locator('.dossier h1')).toHaveText('Faut-il compenser les retraités touchés par la baisse ?');
 await choose(page);
 const saved=await page.evaluate(key=>localStorage.getItem(key),KEY);
 await page.getByRole('button',{name:'Ma partie',exact:true}).click();await page.getByRole('button',{name:'Comparer une autre stratégie',exact:true}).click();
 await page.locator('[data-plan-year="0"]').selectOption('r01b');
 await expect(page.locator('[data-plan-year="1"] option[value="r01-othera"]')).toHaveCount(1);
 await expect(page.locator('[data-plan-year="1"] option[value="r01-cuta"]')).toHaveCount(0);
 await page.locator('[data-plan-year="1"]').selectOption('r01-otherb');
 expect(await page.evaluate(key=>localStorage.getItem(key),KEY)).toBe(saved);
 await page.getByRole('button',{name:'Bilan',exact:true}).click();
 await expect(page.locator('.society-panel')).toContainText('Retraités');
 await expect(page.locator('.society-panel')).toContainText('48');
 await noOverflow(page);
});
