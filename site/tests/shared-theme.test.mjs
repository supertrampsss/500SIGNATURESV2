import {test,expect} from '@playwright/test';

test('Mandats : accueil éditorial lisible dans les deux thèmes',async({page},info)=>{
 await page.goto('/mandats/');
 const hero=page.locator('.mandate-home-hero');
 const primary=page.getByRole('button',{name:'Gouverner la France'});
 for(const [theme,toggle] of [['clair','Activer le mode sombre'],['sombre','Activer le mode clair']]) {
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  await expect(hero).toBeVisible();
  await expect(page.getByRole('heading',{name:'Prenez les rênes du pays.',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Prenez des décisions',exact:true})).toBeVisible();
  await expect(primary).toBeVisible();
  await expect(page.locator('.mandate-home-primary')).toHaveCount(1);
  await expect(page.getByText('Gouverner,', {exact:false})).toHaveCount(0);
  await page.screenshot({path:info.outputPath('mandats-selection-'+theme+'.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  await page.getByRole('button',{name:toggle,exact:true}).click();
 }
 await primary.click();
 await expect(page.locator('.campaign-position')).toContainText('Décision 1/45');
});
test('Mandats expose Accueil et le lien revient à la page d’accueil',async({page})=>{
 for(const path of ['/mandats/','/mandats/methode/','/mandats/comprendre/','/bilan/']){
  await page.goto(path);
  const accueil=page.getByRole('navigation',{name:'Navigation principale',exact:true}).getByRole('link',{name:'Accueil',exact:true});
  await expect(accueil).toHaveAttribute('href','/accueil/');
  await accueil.click();
  await expect(page).toHaveURL(/https?:\/\/[^/]+\/accueil\/$/);
  await expect(page.locator('h1.accueil__message:visible')).toHaveText('Les chiffres publics expliqués.');
 }
 await page.goto('/mandats/methode/');
 await page.getByRole('link',{name:'500 Signatures, accueil',exact:true}).click();
 await expect(page).toHaveURL(/https?:\/\/[^/]+\/accueil\/$/);
});

test('Accueil presents the editorial path before the secondary simulation',async({page},info)=>{
 await page.goto('/accueil/');
 const navigation=page.getByRole('navigation',{name:'Navigation principale',exact:true});
 const navigationLabels=['Accueil','France','Ville','Dossiers','Mandats'];
 await expect(navigation.getByRole('link')).toHaveText(navigationLabels);
 await expect(navigation.getByRole('link',{name:'Salaires',exact:true})).toHaveCount(0);
 await expect(page.locator('h1.accueil__message:visible')).toHaveText('Les chiffres publics expliqués.');
 await expect(page.getByRole('link',{name:'Découvrir les dossiers',exact:true})).toBeVisible();
 const order=await page.locator('body').innerText();
 const sections=['France','Et chez vous ?','Derniers dossiers','À vous de décider.'];
 let previous=-1;
 for(const section of sections){
  const position=order.indexOf(section);
  expect(position,section).toBeGreaterThan(previous);
  previous=position;
 }
 expect(order).not.toContain('prévision');
 expect(order).not.toContain('↗');
  if(info.project.name==='desktop-chromium'){
   const layout=await page.evaluate(()=>{
   const hero=getComputedStyle(document.querySelector('.accueil__hero'));
   const dossiers=getComputedStyle(document.querySelector('.accueil__dossiers'));
   const cartes=getComputedStyle(document.querySelector('.accueil__analyses'));
   return {hero:hero.display,dossiers:dossiers.display,columns:cartes.gridTemplateColumns};
  });
  expect(layout.hero).toBe('grid');
  expect(layout.dossiers).toBe('block');
  expect(layout.columns.split(' ').length).toBeGreaterThanOrEqual(2);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath('accueil-editorial-path.png'),fullPage:true});
});

test('Accueil uses exactly the same outer width as its header and has no duplicate navigation cards',async({page})=>{
 await page.goto('/accueil/');
 await expect(page.locator('.story-hero')).toBeVisible();
 await expect(page.locator('.story-questions')).toHaveCount(0);
 await expect(page.locator('.story-door')).toHaveCount(3);
 const geometry=await page.evaluate(()=>{
  const header=document.querySelector('.entete').getBoundingClientRect();
  const home=document.querySelector('.accueil-story').getBoundingClientRect();
  return {
   left:Math.abs(header.left-home.left),
   right:Math.abs(header.right-home.right),
   width:Math.abs(header.width-home.width),
  };
 });
 expect(geometry.left).toBeLessThanOrEqual(1);
 expect(geometry.right).toBeLessThanOrEqual(1);
 expect(geometry.width).toBeLessThanOrEqual(1);
});

test('the shared header is identical across primary destinations',async({page})=>{
  for(const path of ['/accueil/','/bilan/','/territoire','/analyses/','/sources/']){
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-theme','clair');
    await expect(page.locator('.entete__wordmark')).toHaveText('500 Signatures');
    await expect(page.locator('.brand-e')).toHaveCount(0);
    await expect(page.locator('#theme-bascule')).toHaveCount(0);
    const navigation=page.getByRole('navigation',{name:'Navigation principale',exact:true});
    await expect(navigation.getByRole('link')).toHaveText(['Accueil','France','Ville','Dossiers','Mandats']);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  }
});
test('retired simulator URLs lead to Mandats while old browser data is preserved',async({page},info)=>{
 test.skip(info.project.name!=='desktop-chromium','One redirect compatibility check.');
 await page.addInitScript(()=>localStorage.setItem('simulator-legacy-preservation','old-save'));
 await page.goto('/simulateur/comparer?version=2&budget=france');
 await expect(page).toHaveURL(/\/mandats\/$/);
 await expect(page.getByRole('heading',{name:'Prenez les rênes du pays.',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('simulator-legacy-preservation'))).toBe('old-save');
});

test('editorial histories expand, redistribution stays visible and Europe is grouped',async({page},info)=>{
 test.skip(!['android-chromium','iphone-webkit','desktop-chromium'].includes(info.project.name),'Representative touch and desktop layouts.');
 await page.goto('/bilan/');
 await expect(page.getByText(/^Chapitre \d+/)).toHaveCount(0);
 await expect(page.getByText('Un pays. Des choix.',{exact:true})).toHaveCount(0);
 await expect(page.locator('#france-complements')).toBeVisible();
 await expect(page.locator('#bloc-redistribution')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Ce que la redistribution change',exact:true})).toBeVisible();
 await expect(page.getByText('Données et historique des dépenses',{exact:true})).toHaveCount(0);
 expect(await page.locator('#france-complements').evaluate(el=>parseFloat(getComputedStyle(el).paddingLeft))).toBeGreaterThanOrEqual(20);
 await expect(page.locator('.europe-unifiee #bloc-europe')).toHaveCount(1);
 await expect(page.locator('.europe-unifiee #bloc-fonctions')).toHaveCount(1);
 await expect(page.getByText('La France comparée à ses voisins',{exact:true})).toHaveCount(0);
 const expand=page.locator('[data-expand-analysis]').first();await expand.click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('dialog').locator('.chart-time')).toHaveCount(1);
 await page.getByRole('dialog').getByRole('button',{name:'Fermer',exact:true}).click();
 await expect(expand).toBeFocused();
 await page.goto('/salaires/');
 expect(await page.locator('.salaires__detail').evaluate(el=>el.previousElementSibling.classList.contains('salary-history'))).toBe(true);
 const select=page.locator('#salary-history-choice');await expect(select).toBeVisible();
 await select.selectOption({index:1});
 await expect(page.locator('[data-salary-history-chart] figcaption')).toContainText(await select.locator('option:checked').textContent());
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});

test('France keeps the approved background and shared header',async({page},info)=>{
 await page.goto('/bilan/');
 await expect(page.locator('#bloc-recettes-etat')).toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('data-theme','clair');
 await expect(page.locator('.entete__wordmark')).toHaveText('500 Signatures');
 await expect(page.locator('.brand-e')).toHaveCount(0);
 await expect(page.locator('#theme-bascule')).toHaveCount(0);
 await expect(page.locator('body')).toHaveCSS('background-color','rgb(245, 244, 237)');
 await expect(page.locator('.entete')).toHaveCSS('background-color','rgb(255, 254, 250)');
 const margins=await page.locator('#national').evaluate(panel=>{
  const p=panel.getBoundingClientRect();
  return Array.from(panel.querySelectorAll('#bloc-ouverture,#bloc-recettes-etat,#france-dette,#insights-france')).map(el=>{
   const r=el.getBoundingClientRect();return {left:r.left-p.left,right:p.right-r.right};
  });
 });
 expect(margins.length).toBe(4);
 const minimumMargin=['android-chromium','iphone-webkit','compact-chromium'].includes(info.project.name)?11:19;
 for(const margin of margins){expect(margin.left).toBeGreaterThanOrEqual(minimumMargin);expect(margin.right).toBeGreaterThanOrEqual(minimumMargin);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});
