import {test,expect} from '@playwright/test';
import {readFile, readdir} from 'node:fs/promises';

const dossiers = await Promise.all((await readdir(new URL('../analyses/', import.meta.url)))
 .filter(name => name.endsWith('.json'))
 .map(async name => JSON.parse(await readFile(new URL('../analyses/' + name, import.meta.url), 'utf8'))));

// Défauts de lancement constatés en production : métadonnées d'accueil
// conservées sur France/Ville et requêtes AdSense sans choix préalable.
test('Lancement : métadonnées propres à chaque vue et aucune publicité automatique', async ({page}, info) => {
 const advertising=[];
 page.on('request', request => {if(/googlesyndication|doubleclick/.test(request.url())) advertising.push(request.url());});
 await page.goto('/');
 await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://500signatures.fr/');
 if(!await page.locator('#navigation-principale a[href="/bilan/"]').isVisible()) await page.getByRole('button',{name:'Ouvrir le menu'}).click();
 await page.locator('#navigation-principale a[href="/bilan/"]').click();
 await expect(page).toHaveTitle('Budget et dette publique en France | 500 signatures');
 await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://500signatures.fr/bilan/');
 if(!await page.locator('#navigation-principale a[href="/territoire"]').isVisible()) await page.getByRole('button',{name:'Ouvrir le menu'}).click();
 await page.locator('#navigation-principale a[href="/territoire"]').click();
 await expect(page).toHaveTitle('Les comptes de votre ville | 500 Signatures');
 await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://500signatures.fr/territoire/');
 await expect(page.locator('script[src*="adsbygoogle"]')).toHaveCount(0);
 expect(advertising).toEqual([]);
 await page.screenshot({path:info.outputPath('lancement-ville.png')});
});

test('Lancement : la page Ville est lisible sans JavaScript', async ({browser}, info) => {
 const context=await browser.newContext({javaScriptEnabled:false, viewport:info.project.use.viewport});
 const page=await context.newPage();
 try {
  await page.goto('http://127.0.0.1:4180/territoire/');
  await expect(page.getByRole('heading',{name:'Les comptes de votre ville, en clair.'})).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://500signatures.fr/territoire/');
  await page.screenshot({path:info.outputPath('lancement-ville-sans-js.png')});
 } finally {await context.close();}
});

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
 await expect(page.locator('[data-dossier-card]')).toHaveCount(dossiers.length);
 const search=page.getByRole('searchbox',{name:'Rechercher un dossier'});
 await search.fill('groenland');
 await expect(page.locator('[data-dossier-card]:visible')).toHaveCount(1);
 await search.fill('motintrouvablexyz');
 await expect(page.locator('#analyses-etat-vide')).toBeVisible();
 await page.locator('[data-effacer-filtres]').click();
 await expect(page.locator('[data-dossier-card]:visible')).toHaveCount(dossiers.length);
 await expect(search).toBeFocused();
 await page.locator('[data-analyse-theme="energie"]').click();
 await expect(page.locator('[data-dossier-card]:visible')).toHaveCount(dossiers.filter(d=>d.themes.includes('energie')).length);
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
 await expect(page.locator('.bascule-theme')).toBeHidden();
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
 await expect(page.locator('[data-dossier-card]')).toHaveCount(dossiers.length);
 await expect(page.locator('.dossiers-v2__filtres')).toBeHidden();
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

test('Confiance : Salaires affiche un profil sourcé et conserve la lecture des dépenses', async({page},info)=>{
 const remote=[];page.on('request',r=>{if(/r2.dev|urssaf.fr|oecd.org/.test(r.url()))remote.push(r.url());});
 await page.goto('/salaires/');
 await expect(page.locator('h1')).toHaveText('Du coût du travail au revenu reçu.');
 const icon=await page.locator('.site-x-link svg').boundingBox();expect(icon.width).toBeLessThanOrEqual(24);expect(icon.height).toBeLessThanOrEqual(24);
 const header=await page.locator('.entete').boundingBox();expect(header.height).toBeLessThan(160);
 await expect(page.locator('#salaires-contenu')).toContainText('Célibataire sans enfant au salaire moyen français');
 await expect(page.locator('#salaires-contenu')).toContainText('2025');
 await expect(page.locator('#salaires-net')).toHaveCount(0);
 await expect(page.locator('[data-statut]')).toHaveCount(0);
 for(const amount of ['52,80 €','26,70 €','8,30 €','12,20 €']) await expect(page.locator('.salaires__ventilation')).toContainText(amount);
 await expect(page.locator('.salaires__allocation')).toContainText('100 € de dépenses publiques');
 const amounts=await page.locator('[data-allocation-share]').allTextContents();
 expect(amounts.length).toBeGreaterThanOrEqual(10);
 const sum=amounts.reduce((total,t)=>total+Number(t.replace(/[^0-9,]/g,'').replace(',','.')),0);
 expect(Math.abs(sum-100)).toBeLessThan(.15);
 await expect(page.getByRole('link',{name:'Calculer avec l’Urssaf',exact:true})).toHaveAttribute('href','https://mon-entreprise.urssaf.fr/simulateurs/salaire-brut-net');
 const select=page.locator('#salary-history-choice');await expect(select).toBeVisible();await select.selectOption({index:1});
 await expect(page.locator('[data-salary-history-chart] figcaption')).toContainText(await select.locator('option:checked').textContent());
 await noOverflow(page);expect(remote).toEqual([]);
 await page.locator('.salaires__entree').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('confiance-salaires-profil.png')});
 await page.locator('.salaires__allocation').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('confiance-salaires-depenses.png')});
});

test('France: published accounts survive a network failure and chapters stay on the page',async({page},info)=>{
 await page.route('https://pub-fc39d357004540a182a907aed4875ef5.r2.dev/**',r=>r.abort());
 await page.goto('/bilan/');await expect(page.getByRole('heading',{level:1})).toHaveText('Les comptes de la France.',{useInnerText:true});
 await expect(page.locator('.fr-keygrid > article')).toHaveCount(4);await expect(page.locator('.fr-keygrid')).toContainText('Solde public');
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
 await page.goto('/territoire');await expect(page.locator('#carte, #cadre-carte, .maplibregl-map')).toHaveCount(0);await expect(page.getByRole('heading',{level:1})).toHaveText('Les comptes de votre ville, en clair.');
 await page.getByRole('region',{name:'Mesure d’audience'}).getByRole('button',{name:'Refuser',exact:true}).click();
 await expect(page.locator(".territoire-depart")).toHaveCount(0);
 await page.getByRole("combobox",{name:"Rechercher une ville"}).fill("Bordeaux");
 await page.locator('#suggestions button[data-code="33063"]').click();
 await expect(page.locator('.fiche__titre')).toHaveText('Bordeaux');await expect(page.locator('#fiche .reperes .repere')).toHaveCount(4);await noOverflow(page);
 await expect(page.locator('.ville-fonctionnement .chart-time')).toBeVisible();
 const donnees=page.locator('.territoire-donnees-completes__contenu');
 await expect(donnees.locator('#detail')).toBeVisible();
 const population=page.locator('#detail #davantage-population');
 await expect(population.locator('.davantage__chapitre > summary')).toBeVisible();
 await activate(population.locator('.davantage__chapitre > summary'),info);
 await expect(population).toContainText(/267\s991/);
 await expect(population.locator('.davantage__cartes')).toBeVisible();
 await expect(page.locator('#fiche .ville-source a[href="/sources/"]').first()).toBeVisible();await noOverflow(page);
 await page.getByRole('combobox',{name:'Rechercher une ville'}).fill('Paris');await page.getByRole('combobox').press('ArrowDown');await page.locator('#suggestions button[data-code="75056"]').press('Enter');await expect(page.locator('.fiche__titre')).toHaveText('Paris');await noOverflow(page);
 const franceLink=page.locator('#navigation-principale').getByRole('link',{name:'France',exact:true});
 if(!await franceLink.isVisible()) await page.getByRole('button',{name:'Ouvrir le menu',exact:true}).click();
 await activate(franceLink,info);await expect(page.getByRole('heading',{level:1})).toHaveText('Les comptes de la France.',{useInnerText:true});await noOverflow(page);
});

test('Confiance : Salaires garde la navigation accessible avec mouvement réduit', async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/salaires/');
 await expect(page.locator('.bascule-theme')).toBeHidden();
 const nav=page.locator('#navigation-principale');
 if(!await nav.getByRole('link',{name:'France',exact:true}).isVisible()) await page.getByRole('button',{name:'Ouvrir le menu'}).click();
 await nav.getByRole('link',{name:'France',exact:true}).click();
 await expect(page.getByRole('heading',{level:1})).toHaveText('Les comptes de la France.',{useInnerText:true});
 await page.getByRole('region',{name:'Mesure d’audience'}).getByRole('button',{name:'Refuser',exact:true}).click();
 await page.locator('.fr-footer a[href="/a-propos/"]').click();
 await expect(page.locator('h1')).toHaveText('Le projet et ses corrections.');await noOverflow(page);
});

test('France et Villes : graphiques sourcés, comparaison européenne et lecture au clavier',async({page},info)=>{
 await publication(page);await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/bilan/');
 await page.getByRole('region',{name:'Mesure d’audience'}).getByRole('button',{name:'Refuser',exact:true}).click();
 const chart=page.locator('#bloc-ouverture .fr-chart');
 await expect(chart.getByRole('img')).toHaveAccessibleName('Recettes et dépenses publiques, en milliards d’euros');
 expect(await chart.locator('svg path').count()).toBeGreaterThanOrEqual(2);
 await expect(page.locator('#bloc-ouverture .fr-source')).toContainText('Eurostat');
 const europe=page.locator('[data-fr-europe-tab="eurostat_prelevements_obligatoires_pib"]');
 if(page.viewportSize().width<=700){
  await expect(europe).toBeVisible();await europe.focus();await europe.press('Enter');await expect(europe).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-fr-europe-chart="eurostat_prelevements_obligatoires_pib"]')).toHaveAttribute('data-fr-active','true');
 }else{
  await expect(page.locator('[data-fr-europe-chart="eurostat_depenses_publiques_pib"]')).toBeVisible();
  await expect(page.locator('[data-fr-europe-chart="eurostat_prelevements_obligatoires_pib"]')).toBeVisible();
 }
 const topic=page.locator('.fr-topic').first();await topic.locator('summary').focus();await topic.locator('summary').press('Enter');
 await expect(topic).toHaveAttribute('open','');await expect(topic.locator('.fr-topic-content')).toBeVisible();
 await noOverflow(page);await chart.screenshot({path:info.outputPath('accounts-'+info.project.name+'.png')});
 const ville=page.locator('#navigation-principale').getByRole('link',{name:'Ville',exact:true});
 if(!await ville.isVisible()) await page.getByRole('button',{name:'Ouvrir le menu',exact:true}).click();
 await ville.click();await page.getByRole('combobox',{name:'Rechercher une ville'}).fill('Bordeaux');
 await activate(page.locator('#suggestions button[data-code="33063"]'),info);
 await expect(page.locator('#territoire-comptes')).toBeVisible();
 const budget=page.locator('#territoire-comptes');
 await expect(budget.getByRole('img')).toBeVisible();
 await expect(page.locator('#territoire-dette').getByRole('img')).toBeVisible();
 await expect(page.locator('#territoire-chiffres-cles .ville-source')).toContainText('OFGL');
 const control=budget.getByRole('slider').first();
 const last=await budget.locator('output').textContent();
 await control.press('Home');await expect(budget.locator('output')).not.toHaveText(last);
 await control.press('End');await expect(budget.locator('output')).toHaveText(last);
 await budget.screenshot({path:info.outputPath('territory-'+info.project.name+'.png')});
 await page.getByRole('combobox',{name:'Rechercher une ville'}).fill('Paris');
 await activate(page.locator('#suggestions button[data-code="75056"]'),info);
 await expect(page.locator('#territoire-comptes output')).not.toHaveText(last);await noOverflow(page);
});

test('Dossiers : qualité, lecture du coût du travail et actualité du Groenland', async ({page}, info) => {
 await page.goto('/analyses/');
 const refus=page.getByRole('button',{name:'Refuser',exact:true});
 if(await refus.isVisible()) await refus.click();
 const titre='Coût du travail : sur 100 € payés par l’employeur, que reste-t-il ?';
 await expect(page.locator('.dossiers-v2__vedette h2')).toHaveText(titre);
 await page.locator('.dossiers-v2__vedette h2 a').click();
 await expect(page.locator('h1')).toHaveText(titre);
 await expect(page.locator('#figure-france-decomposition .analyse-bars strong')).toHaveText(['26,7 %','8,3 %','12,2 %','52,8 %']);
 await expect(page.locator('#figure-comparaison-net .analyse-bars strong')).toHaveText(['52,8 %','50,7 %','54,2 %','58,6 %']);
 await expect(page.locator('#deux-mille')).toContainText('ne permet pas d’affirmer');
 await expect(page.locator('#sources')).toContainText('Les pourcentages du graphique sont rapportés au coût employeur');
 await expect(page.locator('#sources a[href*="overview_d93131c3"]')).toBeVisible();
 await noOverflow(page);
 await page.locator('#figure-france-decomposition').scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath('qualite-cout-travail-'+info.project.name+'.png')});
 await page.locator('.editorial-footer a[href="/analyses/"]').click();
 await page.getByRole('searchbox').fill('Groenland');
 await page.getByRole('link',{name:'Groenland : pourquoi l’accord de sécurité compte pour l’Europe',exact:true}).click();
 await expect(page.locator('#ce-qui-est-annonce')).toContainText('signature le 22 septembre 2026');
 await expect(page.locator('#texte-signe')).toContainText('Narsarsuaq et Mestersvig');
 await expect(page.locator('.analyse-rendu')).not.toContainText(/semaine prochaine|texte complet.*pas encore publié|texte doit encore être signé/);
 await expect(page.locator('.dossier-date')).toContainText('Mis à jour le 3 octobre 2026');
 await page.locator('.editorial-footer a[href="/confidentialite/"]').click();
 await expect(page.locator('h1')).toHaveText('Vos données, simplement.');
});

test('Dossiers : qualité, tous les articles et précautions accessibles sans JavaScript', async ({browser}, info) => {
 test.setTimeout(120000);
 const context=await browser.newContext({javaScriptEnabled:false,viewport:info.project.use.viewport});
 const page=await context.newPage();
 try {
  for(const dossier of dossiers) {
   await page.goto('http://127.0.0.1:4180/analyses/'+dossier.slug+'/');
   await expect(page.locator('h1')).toHaveText(dossier.titre);
   await expect(page.locator('.analyse-longue__section')).toHaveCount(dossier.dossier.sections.length);
   for(const limite of dossier.dossier.limitations) await expect(page.locator('#sources')).toContainText(limite);
   await expect(page.locator('.editorial-footer a[href="/sources/"]')).toBeVisible();
   await expect(page.locator('.editorial-footer a[href="/confidentialite/"]')).toBeVisible();
   await expect(page.locator('script[src*="adsbygoogle"]')).toHaveCount(0);
   await noOverflow(page);
  }
  await page.locator('.editorial-footer').scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('qualite-sources-sans-js-'+info.project.name+'.png')});
 } finally {await context.close();}
});

// Risques relevés dans l'avis indépendant : promesse d'exactitude excessive,
// éditeur peu visible, ratio personnel fictif, répétition sans nouveau calcul.
test('Confiance : méthode, éditeur et démonstration des dépenses sont accessibles', async({page},info)=>{
 await page.goto('/analyses/la-depense-publique-baisse-2024/');
 await page.getByRole('region',{name:'Mesure d’audience'}).getByRole('button',{name:'Refuser',exact:true}).click();
 await expect(page.locator('#montant')).toContainText('1 714,2');
 await expect(page.locator('#montant')).toContainText('2,5 %');
 await expect(page.locator('#ratio')).toContainText('0,3 point');
 await expect(page.locator('#ratio')).toContainText('2025');
 await expect(page.locator('#sources')).toContainText('3 octobre 2026');
 await page.locator('.editorial-footer a[href="/a-propos/"]').click();
 await expect(page.locator('h1')).toHaveText('Le projet et ses corrections.');
 await expect(page.locator('#projet-contenu')).toContainText('Responsabilité éditoriale');
 await expect(page.getByRole('link',{name:'Signaler une correction sur GitHub',exact:true})).toHaveAttribute('href','https://github.com/supertrampsss/500SIGNATURESV2/issues');
 await page.locator('.editorial-footer a[href="/sources/"]').click();
 await page.locator('.methode__pli:has(.methode-methode__d11) > summary').click();
 await expect(page.locator('.methode-methode__d11')).toBeVisible();
 await expect(page.locator('.methode-methode__d11')).toContainText('contrôles automatiques');
 await expect(page.locator('.methode-methode__fusion')).toContainText('raisonnement');
 await expect(page.locator('.methode-methode__reseau')).toContainText('Google Analytics');
 await expect(page.locator('.methode-methode__reseau')).toContainText('après acceptation');
 await expect(page.locator('.methode-methode__reseau')).not.toContainText("aucune mesure d'audience");
 await expect(page.locator('#contenu')).not.toContainText('garantie par une machine');
 await noOverflow(page);await page.locator('.methode-methode__d11').scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath('confiance-methode.png')});
});

test('Confiance : Salaires et présentation du projet restent lisibles sans JavaScript', async({browser},info)=>{
 const context=await browser.newContext({javaScriptEnabled:false,viewport:info.project.use.viewport});
 const page=await context.newPage();
 try {
  await page.goto('http://127.0.0.1:4180/salaires/');
  await expect(page.locator('.salaires__ventilation')).toContainText('52,80 €');
  await expect(page.locator('#salaires-contenu')).toContainText('profil statistique');await noOverflow(page);
  await page.locator('.editorial-footer a[href="/a-propos/"]').click();
  await expect(page.locator('#projet-contenu')).toContainText('outils d’intelligence artificielle');
  await expect(page.getByRole('link',{name:'Signaler une correction sur GitHub',exact:true})).toBeVisible();
  await noOverflow(page);await page.screenshot({path:info.outputPath('confiance-projet-sans-js.png')});
 }finally{await context.close();}
});
