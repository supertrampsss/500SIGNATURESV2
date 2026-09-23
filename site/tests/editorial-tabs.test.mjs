import {test,expect} from '@playwright/test';
import {readFile, readdir} from 'node:fs/promises';

const dossiers = await Promise.all((await readdir(new URL('../analyses/', import.meta.url)))
 .filter(name => name.endsWith('.json'))
 .map(async name => JSON.parse(await readFile(new URL('../analyses/' + name, import.meta.url), 'utf8'))));

test('Dossiers : les tableaux restent entièrement lisibles sans défilement horizontal', async ({page}, info) => {
 for(const dossier of dossiers.filter(d => d.dossier.visualisations.some(v => v.type === 'snapshot_table'))) {
  await page.goto('/analyses/'+dossier.slug+'/');
  const tables=page.locator('.analyse-longue__tableau');
  expect(await tables.count()).toBeGreaterThan(0);
  for(const [tableIndex,table] of (await tables.all()).entries()) {
   await table.scrollIntoViewIfNeeded();
   if(dossier.slug==='defense-europe-depenses-2024') await page.screenshot({path:info.outputPath('table-defense-'+tableIndex+'.png')});
   const dimensions=await table.evaluate(el=>({
    container:el.parentElement.clientWidth,table:el.getBoundingClientRect().width,
    overflow:el.parentElement.scrollWidth-el.parentElement.clientWidth,
    overflowingCells:Array.from(el.querySelectorAll('th,td')).filter(cell=>cell.scrollWidth>cell.clientWidth+1).map(cell=>cell.textContent),
    splitHeaders:Array.from(el.querySelectorAll('thead th')).filter(cell=>{const range=document.createRange();range.selectNodeContents(cell);return range.getClientRects().length>1;}).map(cell=>{const css=getComputedStyle(cell);return {text:cell.textContent,width:cell.getBoundingClientRect().width,padding:css.padding,font:css.font};}),
   }));
   expect(dimensions, dossier.slug).toMatchObject({overflow:0,overflowingCells:[],splitHeaders:[]});
   expect(dimensions.table, dossier.slug).toBeLessThanOrEqual(dimensions.container+1);
  }
  await noOverflow(page);
 }
});

test('Fournitures : récit, prix en euros et graphiques lisibles', async ({page}, info) => {
 await page.goto('/analyses/fournitures-scolaires-prix-1990-2025/');
 await expect(page.locator('h1')).toHaveText('Fournitures scolaires : pourquoi la rentrée reste chère');
 await expect(page.locator('.analyse-rendu')).not.toContainText(/base 100|sous-panier|provisoire|92 %/i);
 await expect(page.locator('#sources a[href^="http"]')).toHaveCount(11);
 await noOverflow(page);
 await page.screenshot({path:info.outputPath('fournitures-introduction.png')});
 await page.locator('#figure-evolution-indices').scrollIntoViewIfNeeded();
 await expect(page.locator('#figure-evolution-indices')).toContainText('79 %');
 await page.screenshot({path:info.outputPath('fournitures-historique.png')});
 await page.locator('#figure-table-prix').scrollIntoViewIfNeeded();
 await expect(page.locator('#figure-table-prix .analyse-bars > li')).toHaveCount(4);
 await expect(page.locator('#figure-table-prix .analyse-bars strong')).toHaveText([
  '208,12 €', '226,33 €', '223,46 €', '211,10 €',
 ]);
 await expect(page.locator('#figure-table-prix')).not.toContainText('M€');
 await noOverflow(page);
 await page.screenshot({path:info.outputPath('fournitures-euros.png')});
});

test('Analyses : recherche, filtres, lecture et sources en fin de dossier', async ({page}, info) => {
 await page.goto('/analyses/');
 await expect(page.locator('#navigation-principale a[href="/analyses/"]')).toHaveAttribute('aria-current','page');
 await expect(page.locator('#analyses-index > li')).toHaveCount(12);
 const toggle=page.locator('#analyses-filtres-bouton');
 if(await toggle.isVisible()) await activate(toggle,info);
 await page.locator('#analyses-recherche').fill('groenland');
 await expect(page.locator('#analyses-index > li:visible')).toHaveCount(1);
 await page.locator('#analyses-recherche').fill('motintrouvablexyz');
 await expect(page.locator('#analyses-etat-vide')).toBeVisible();
 await page.locator('[data-effacer-filtres]').click();
 await expect(page.locator('#analyses-index > li:visible')).toHaveCount(12);
 await page.locator('#analyses-theme').selectOption('energie');
 await expect(page.locator('#analyses-index > li:visible')).toHaveCount(2);
 await noOverflow(page);
 await page.getByRole('link',{name:'Le gaz des ménages a-t-il encore augmenté ?',exact:true}).click();
 await expect(page.locator('.analyse-chart svg:visible')).toBeVisible();
 await expect(page.locator('#navigation-principale a[href="/analyses/"]')).toHaveAttribute('aria-current','page');
 await expect(page.locator('.analyse-rendu a[href^="http"]:not(#sources a):not(.partage a)')).toHaveCount(0);
 const gaz = dossiers.find(dossier => dossier.slug === 'prix-gaz-menages-2022-2025');
 await expect(page.locator('#sources a[href^="http"]')).toHaveCount(new Set(gaz.sources.map(source => source.url)).size);
 await expect(page.locator('.analyse-rendu details')).toHaveCount(0);
 await expect(page.locator('.dossier-date')).toBeVisible();
 await noOverflow(page);
 await page.getByRole('button',{name:'Activer le mode sombre'}).click();
 await noOverflow(page);
 await page.screenshot({path:info.outputPath('analyses-dark-'+info.project.name+'.png')});
});

test('Analyses : tous les dossiers et leurs sources sans débordement', async({page},info)=>{
 for(const dossier of dossiers) {
  await page.goto('/analyses/'+dossier.slug+'/');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText(dossier.titre);
  await expect(page.locator('#sources')).toHaveCount(1);
  await expect(page.locator('#sources a[href^="http"]')).toHaveCount(new Set(dossier.sources.map(source => source.url)).size);
  await expect(page.locator('.analyse-rendu details')).toHaveCount(0);
  await expect(page.locator('.analyse-rendu a[href^="http"]:not(#sources a):not(.partage a)')).toHaveCount(0);
  await noOverflow(page);
 }
 await page.screenshot({path:info.outputPath('analyse-courte-'+info.project.name+'.png')});
});

test('Analyses : les dossiers et leurs sources sont lisibles sans JavaScript',async({browser},info)=>{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:info.project.use.viewport});
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:4180/analyses/');
 await expect(page.locator('#analyses-index > li')).toHaveCount(12);
 await expect(page.locator('#analyses-filtres')).toBeHidden();
 await page.getByRole('link',{name:'Défense : l’accélération des dépenses européennes',exact:true}).click();
 await expect(page.locator('.analyse-chart svg:visible')).toBeVisible();
 await expect(page.locator('#sources')).toContainText('Eurostat');
 await noOverflow(page);
 await context.close();
});
const fixture=JSON.parse(await readFile(new URL('./fixtures/editorial-publication.json',import.meta.url),'utf8'));
const numeric=text=>Number(text.replace(/[^0-9]/g,''));
async function activate(locator,info){if(info.project.use.hasTouch)await locator.tap();else await locator.click();}
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);}
async function publication(page,{demographie=false}={}){
 const indicateurs=demographie?[...fixture.indicateurs,{id:'insee_population_municipale',libelle:'Population municipale',unite:'count',theme:'population',niveaux:['commune'],sommable:true,jeu:'insee-population',periodes:['2023']}]:fixture.indicateurs;
 const communes=structuredClone(fixture.communes);
 if(demographie)communes['33063'].series.insee_population_municipale={'2023':267991};
 await page.route('https://pub-fc39d357004540a182a907aed4875ef5.r2.dev/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  let body;
  if(path==='/data/derniere.json') body={version:fixture.publication};
  else if(path==='/geo/derniere.json') body={cle:'geo/test.pmtiles',version:'test'};
  else if(path.endsWith('/manifeste.json')) body={version:fixture.publication,jeux:fixture.jeux};
  else if(path.endsWith('/indicateurs.json')) body=indicateurs;
  else if(path.endsWith('/recherche.json')) body=fixture.recherche;
  else if(path.endsWith('/territoires/pays/tous.json')) body=fixture.pays;
  else if(path.endsWith('/territoires/region/tous.json')) body=fixture.regions;
  else if(path.endsWith('/territoires/departement/tous.json')) body=fixture.departements;
  else if(/\/territoires\/commune\/(33|75)\.json$/.test(path)) body=communes;
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
 expect(await page.locator('[data-allocation-share]').count()).toBeGreaterThanOrEqual(10);await page.locator('#salaires-net').fill('0');expect(numeric(await page.locator('#salaires-resultat-titre').innerText())).toBe(0);await expect(page.locator('#salaires-erreur')).toBeHidden();for(const amount of await page.locator('[data-allocation-share]').allTextContents())expect(numeric(amount)).toBe(0);
 await activate(page.locator('.salaires__detail > summary'),info);await expect(page.locator('[data-coefficients]')).toBeVisible();await noOverflow(page);
 expect(remote).toEqual([]);await expect(page.locator('canvas')).toHaveCount(0);
 await activate(page.locator('#navigation-principale').getByRole('link',{name:'France',exact:true}),info);await expect(page).toHaveURL(/\/bilan\/?$/);
});

test('France: published accounts survive a network failure and chapters stay on the page',async({page},info)=>{
 await page.route('https://pub-fc39d357004540a182a907aed4875ef5.r2.dev/**',r=>r.abort());
 await page.goto('/bilan/');await expect(page.getByRole('heading',{level:1})).toHaveText('Les comptes de la France.');
 await expect(page.locator('.bilan-flux__ligne')).toHaveCount(2);await expect(page.locator('.bilan-verdict__totem')).toContainText('Solde public');
 await expect(page.locator('.bilan-erreur [role="alert"]')).toBeVisible();await expect(page.locator('#national')).toBeVisible();
 const chapitres=page.getByRole('navigation',{name:'Chapitres des comptes publics'});
 // Sur mobile, le raccourci des chapitres est masqué pour laisser la page
 // respirer. Le parcours reste vérifié sur desktop, où il est affiché.
 if(await chapitres.isVisible()){
  for(const [name,id] of [['Recettes','france-entrees'],['Dépenses','france-sorties'],['Dette','france-dette'],['Europe','bloc-europe']]){
   await activate(chapitres.getByRole('link',{name,exact:true}),info);await expect(page).toHaveURL(new RegExp('#'+id+'$'));await expect(page.locator('#'+id)).toBeVisible();await noOverflow(page);
  }
 }
});

test('Ville: search and financial detail work without a map',async({page},info)=>{
 await publication(page,{demographie:true});
 await page.goto('/territoire');await expect(page.locator('#carte, #cadre-carte, .maplibregl-map')).toHaveCount(0);await expect(page.getByRole('heading',{level:1})).toHaveText('Explorez les comptes de votre ville.');
 await expect(page.locator(".territoire-depart")).toHaveCount(0);
 await page.getByRole("combobox",{name:"Rechercher une ville"}).fill("Bordeaux");
 await page.locator('#suggestions button[data-code="33063"]').click();
 await expect(page.locator('#detail #davantage-population')).toBeVisible();
 await expect(page.locator('#detail #davantage-population')).toContainText(/267\s991/);
 await expect(page.locator('.fiche__titre')).toHaveText('Bordeaux');await expect(page.locator('#fiche .reperes .repere')).toHaveCount(4);await noOverflow(page);
 await expect(page.locator('.territory-charts')).toBeVisible();await expect(page.locator('#detail')).toContainText('Population');await expect(page.locator('#fiche').getByRole('link',{name:'Sources',exact:true})).toBeVisible();await noOverflow(page);
 await page.getByRole('combobox',{name:'Rechercher une ville'}).fill('Paris');await page.getByRole('combobox').press('ArrowDown');await page.locator('#suggestions button[data-code="75056"]').press('Enter');await expect(page.locator('.fiche__titre')).toHaveText('Paris');await noOverflow(page);
 await activate(page.locator('#navigation-principale').getByRole('link',{name:'France',exact:true}),info);await expect(page.getByRole('heading',{level:1})).toHaveText('Les comptes de la France.');await noOverflow(page);
});

test('Salaires: dark mode, reduced motion and navigation and social links remain usable',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/salaires/');
 await expect(page.locator('html')).toHaveAttribute('data-theme','clair');await activate(page.getByRole('button',{name:'Activer le mode sombre'}),info);await activate(page.getByRole('button',{name:'Activer le mode clair'}),info);await noOverflow(page);
 const boxes=await page.locator('#navigation-principale a').evaluateAll(links=>links.map(a=>{const b=a.getBoundingClientRect();return {height:b.height,left:b.left,right:b.right,visible:!!a.getClientRects().length};}));
 expect(boxes).toHaveLength(6);for(const box of boxes){expect(box.visible).toBe(true);expect(box.height).toBeGreaterThanOrEqual(44);expect(box.left).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(info.project.use.viewport.width+1);}
 await page.locator('#salaires-net').fill('1000000');await noOverflow(page);await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','clair');
});

test('France and Ville: charts are the content, touch and keyboard change the actual figures',async({page},info)=>{
 await publication(page);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/bilan/');
 await expect(page.locator('.bilan-lecture')).toHaveCount(0);
 await expect(page.locator('.accounts-reading')).not.toHaveAttribute('open','');
 await expect(page.locator('#insights-france')).toBeVisible();
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
 await chart.screenshot({path:info.outputPath('accounts-'+info.project.name+'.png')});
 const key=page.locator('[data-waffle-key]').first();
 await activate(key,info);await expect(key).toHaveAttribute('aria-pressed','true');
 await activate(key,info);await expect(key).toHaveAttribute('aria-pressed','false');
 await page.getByRole('link',{name:'Ville',exact:true}).click();
 await page.getByRole('combobox',{name:'Rechercher une ville'}).fill('Bordeaux');
 await activate(page.locator('#suggestions button[data-code="33063"]'),info);
 await expect(page.locator('.territory-charts')).toBeVisible();
 await activate(page.locator('[data-chart-tab="dette"]'),info);
 await expect(page.locator('[data-chart-panel="dette"]')).toBeVisible();
 await expect(page.locator('[data-chart-panel="budget"]')).toBeHidden();
 await page.locator('.territory-charts').screenshot({path:info.outputPath('territory-'+info.project.name+'.png')});
 await activate(page.locator('[data-chart-tab="budget"]'),info);await noOverflow(page);
 const before=await page.locator('[data-chart-panel="budget"] output').textContent();
 await page.getByRole('combobox',{name:'Rechercher une ville'}).fill('Paris');
 await activate(page.locator('#suggestions button[data-code="75056"]'),info);
 await expect(page.locator('[data-chart-panel="budget"] output')).not.toHaveText(before);
 if(await page.locator('html').getAttribute('data-theme')==='sombre')await page.getByRole('button',{name:'Activer le mode clair'}).click();await page.getByRole('button',{name:'Activer le mode sombre'}).click();await noOverflow(page);
 await expect(page.locator('.fiche__titre')).toHaveCSS('color','rgb(245, 240, 223)');
 await expect(page.locator('[data-chart-panel="budget"] .chart-key--0')).toHaveCSS('color','rgb(133, 207, 175)');
 await expect(page.locator('[data-chart-panel="budget"] .chart-series--0').first()).toHaveCSS('color','rgb(133, 207, 175)');
 await page.screenshot({path:info.outputPath('territory-dark-'+info.project.name+'.png')});
});
