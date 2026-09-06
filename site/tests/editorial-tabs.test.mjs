import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const fixture=JSON.parse(await readFile(new URL('./fixtures/editorial-publication.json',import.meta.url),'utf8'));
const numeric=text=>Number(text.replace(/[^0-9]/g,''));
async function activate(locator,info){if(info.project.use.hasTouch)await locator.tap();else await locator.click();}
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);}
async function publication(page){
 await page.route('https://pub-fc39d357004540a182a907aed4875ef5.r2.dev/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  let body;
  if(path==='/data/derniere.json') body={version:fixture.publication};
  else if(path==='/geo/derniere.json') body={cle:'geo/test.pmtiles',version:'test'};
  else if(path.endsWith('/manifeste.json')) body={version:fixture.publication,jeux:fixture.jeux};
  else if(path.endsWith('/indicateurs.json')) body=fixture.indicateurs;
  else if(path.endsWith('/recherche.json')) body=fixture.recherche;
  else if(path.endsWith('/territoires/pays/tous.json')) body=fixture.pays;
  else if(path.endsWith('/territoires/region/tous.json')) body=fixture.regions;
  else if(path.endsWith('/territoires/departement/tous.json')) body=fixture.departements;
  else if(/\/territoires\/commune\/(33|75)\.json$/.test(path)) body=fixture.communes;
  else if(/\/territoires\/(commune|region|departement)\/index\.json$/.test(path)) body=fixture['index_'+path.split('/').at(-2)];
  else if(path.endsWith('/comparaisons.json')) body={criteres:[],groupes:{}};
  if(body) await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  else await route.fulfill({status:404,contentType:'application/json',body:'{}'});
 });
}

test('Salaires: direct calculation, four statuses, validation and native navigation',async({page},info)=>{
 const remote=[];page.on('request',r=>{if(r.url().includes('.r2.dev'))remote.push(r.url());});
 await page.goto('/salaires/');await expect(page.locator('#salaires-net')).toBeVisible();
 await expect(page.locator('.salaires__statut')).toHaveCount(4);await expect(page.getByRole('heading',{level:1})).toHaveText('Votre revenu, décomposé.');
 await page.locator('#salaires-net').fill('3000');
 for(const [statut,total] of [['salarié',5684],['fonctionnaire',4923],['indépendant',5220],['retraité',3396]]){
  await activate(page.locator(`[data-statut="${statut}"]`),info);expect(numeric(await page.locator('#salaires-resultat-titre').innerText())).toBe(total);
  await expect(page.locator('[data-salaires-statut]')).toHaveAttribute('data-salaires-statut',statut);await noOverflow(page);
 }
 await page.locator('#salaires-net').fill('abc');await expect(page.locator('#salaires-net')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#salaires-erreur')).toBeVisible();expect(numeric(await page.locator('#salaires-resultat-titre').innerText())).toBe(3396);
 await page.locator('#salaires-net').fill('0');expect(numeric(await page.locator('#salaires-resultat-titre').innerText())).toBe(0);await expect(page.locator('#salaires-erreur')).toBeHidden();
 await activate(page.locator('.salaires__detail > summary'),info);await expect(page.locator('[data-coefficients]')).toBeVisible();await noOverflow(page);
 expect(remote).toEqual([]);await expect(page.locator('canvas')).toHaveCount(0);
 await activate(page.locator('#navigation-principale').getByRole('link',{name:'France',exact:true}),info);await expect(page).toHaveURL(/\/bilan\/?$/);
});

test('France: published accounts survive a network failure and chapters stay on the page',async({page},info)=>{
 await page.route('https://pub-fc39d357004540a182a907aed4875ef5.r2.dev/**',r=>r.abort());
 await page.goto('/bilan/');await expect(page.getByRole('heading',{level:1})).toHaveText('Les comptes de la France.');
 await expect(page.locator('.bilan-flux__ligne')).toHaveCount(2);await expect(page.locator('.bilan-verdict__totem')).toContainText('Solde public');
 await expect(page.locator('.bilan-erreur [role="alert"]')).toBeVisible();await expect(page.locator('#national')).toBeVisible();
 for(const [name,id] of [['Recettes','france-entrees'],['Dépenses','france-sorties'],['Dette','france-dette'],['Europe','bloc-europe']]){
  await activate(page.getByRole('navigation',{name:'Chapitres des comptes publics'}).getByRole('link',{name,exact:true}),info);await expect(page).toHaveURL(new RegExp('#'+id+'$'));await expect(page.locator('#'+id)).toBeVisible();await noOverflow(page);
 }
});

test('Territoires: search and financial detail work without WebGL',async({page},info)=>{
 await publication(page);
 await page.addInitScript(()=>{const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(String(type).includes('webgl'))return null;return getContext.call(this,type,...args);};});
 await page.goto('/territoire');await expect(page.locator('#territoire-carte-toggle')).toHaveText('Carte indisponible sur cet appareil');
 await page.getByRole('combobox',{name:'Rechercher un territoire'}).fill('Bordeaux');await activate(page.locator('#suggestions button[data-code="33063"]'),info);
 await expect(page.locator('.fiche__titre')).toHaveText('Bordeaux');await expect(page.locator('#fiche .reperes .repere')).toHaveCount(4);await noOverflow(page);
 await expect(page.locator('.territoire-diagnostic')).not.toHaveAttribute('open','');await activate(page.locator('.territoire-diagnostic > summary'),info);await expect(page.locator('#fiche .note')).toBeVisible();await noOverflow(page);
 await page.getByRole('combobox',{name:'Rechercher un territoire'}).fill('Paris');await page.getByRole('combobox').press('ArrowDown');await page.locator('#suggestions button[data-code="75056"]').press('Enter');await expect(page.locator('.fiche__titre')).toHaveText('Paris');await noOverflow(page);
 await activate(page.locator('#navigation-principale').getByRole('link',{name:'France',exact:true}),info);await expect(page.getByRole('heading',{level:1})).toHaveText('Les comptes de la France.');await noOverflow(page);
});

test('Salaires: dark mode, reduced motion and all five navigation links remain usable',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/salaires/');
 await activate(page.getByRole('button',{name:'Basculer le thème'}),info);await expect(page.locator('html')).toHaveAttribute('data-theme','sombre');await noOverflow(page);
 const boxes=await page.locator('#navigation-principale a').evaluateAll(links=>links.map(a=>{const b=a.getBoundingClientRect();return {height:b.height,left:b.left,right:b.right,visible:!!a.getClientRects().length};}));
 expect(boxes).toHaveLength(5);for(const box of boxes){expect(box.visible).toBe(true);expect(box.height).toBeGreaterThanOrEqual(44);expect(box.left).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(info.project.use.viewport.width+1);}
 await page.locator('#salaires-net').fill('1000000');await noOverflow(page);await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','sombre');
});

test('France and Territoires: charts are the content, touch and keyboard change the actual figures',async({page},info)=>{
 await publication(page);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/bilan/');
 await expect(page.locator('.bilan-lecture')).toHaveCount(0);
 const chart=page.locator('#bloc-ouverture .chart-time');
 await expect(chart).toBeVisible();
 const control=chart.getByRole('slider');
 const last=await chart.locator('output').textContent();
 await control.press('Home');
 await expect(chart.locator('output')).not.toHaveText(last);
 await expect(control).toHaveAttribute('aria-valuetext',await chart.locator('.chart-scrub__year').innerText());
 await control.press('End');await expect(chart.locator('output')).toHaveText(last);
 await activate(chart.locator('svg:visible'),info);
 await expect(chart.locator('output')).not.toHaveText(last);
 await control.press('End');await expect(chart.locator('output')).toHaveText(last);
 await noOverflow(page);
 await page.screenshot({path:info.outputPath('accounts-'+info.project.name+'.png'),fullPage:true});
 const key=page.locator('[data-waffle-key]').first();
 await activate(key,info);await expect(key).toHaveAttribute('aria-pressed','true');
 await activate(key,info);await expect(key).toHaveAttribute('aria-pressed','false');
 await page.getByRole('link',{name:'Territoires',exact:true}).click();
 await page.getByRole('combobox',{name:'Rechercher un territoire'}).fill('Bordeaux');
 await activate(page.locator('#suggestions button[data-code="33063"]'),info);
 await expect(page.locator('.territory-charts')).toBeVisible();
 await activate(page.locator('[data-chart-tab="dette"]'),info);
 await expect(page.locator('[data-chart-panel="dette"]')).toBeVisible();
 await expect(page.locator('[data-chart-panel="budget"]')).toBeHidden();
 await page.screenshot({path:info.outputPath('territory-'+info.project.name+'.png'),fullPage:true});
 await activate(page.locator('[data-chart-tab="budget"]'),info);await noOverflow(page);
 const before=await page.locator('[data-chart-panel="budget"] output').textContent();
 await page.getByRole('combobox',{name:'Rechercher un territoire'}).fill('Paris');
 await activate(page.locator('#suggestions button[data-code="75056"]'),info);
 await expect(page.locator('[data-chart-panel="budget"] output')).not.toHaveText(before);
 await page.getByRole('button',{name:'Basculer le thème'}).click();await noOverflow(page);
 await page.screenshot({path:info.outputPath('territory-dark-'+info.project.name+'.png'),fullPage:true});
});
