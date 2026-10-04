import {test,expect} from '@playwright/test';

test('Mandats : accueil illustré, lancement v11 et navigation accessibles',async({page},info)=>{
 await page.goto('/mandats/');
 await expect(page.locator('.cinema-entry')).toBeVisible();
 await expect(page.getByRole('heading',{name:'À vous de gouverner.',exact:true})).toBeVisible();
 await expect(page.locator('.cinema-entry__chapters > li')).toHaveCount(5);
 const primary=page.getByRole('button',{name:'Gouverner la France',exact:true});await expect(primary).toBeVisible();
 await page.screenshot({path:info.outputPath('mandats-selection.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
 await primary.click();await expect(page.locator('.story-agenda')).toBeVisible();
 expect((await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')))).version).toBe(11);
});
test('Mandats expose Accueil et le lien revient à la page d’accueil',async({page})=>{
 for(const path of ['/mandats/','/mandats/methode/','/mandats/comprendre/','/bilan/']){
  await page.goto(path);
  const accueil=page.getByRole('navigation',{name:'Navigation principale',exact:true}).getByRole('link',{name:'Accueil',exact:true});
  if(!await accueil.isVisible()) await page.getByRole('button',{name:'Ouvrir le menu',exact:true}).click();
  await expect(accueil).toHaveAttribute('href','/');
  await accueil.click();
  await expect(page).toHaveURL(/https?:\/\/[^/]+\/$/);
  await expect(page.locator('#story-titre')).toHaveText('Comprendre aujourd’hui pour mieux agir demain.',{useInnerText:true});
 }
 await page.goto('/mandats/methode/');
 await page.getByRole('link',{name:'500 Signatures, accueil',exact:true}).click();
 await expect(page).toHaveURL(/https?:\/\/[^/]+\/$/);
});

test('Accueil : les données, villes et dossiers précèdent le jeu',async({page},info)=>{
 await page.goto('/accueil/');
 if(!await page.locator('#navigation-principale').isVisible()) await page.getByRole('button',{name:'Ouvrir le menu',exact:true}).click();
 const navigation=page.getByRole('navigation',{name:'Navigation principale',exact:true});
 await expect(navigation.getByRole('link')).toHaveText(['Accueil','France','Ville','Dossiers','Mandats']);
 await expect(page.locator('#story-titre')).toHaveText('Comprendre aujourd’hui pour mieux agir demain.',{useInnerText:true});
 await expect(page.locator('.story-door')).toHaveCount(3);
 const content=page.locator('.accueil-story');
 const geometry=await content.evaluate(root=>({doors:root.querySelector('.story-door').getBoundingClientRect().top,game:root.querySelector('.story-mandats').getBoundingClientRect().top}));
 expect(geometry.doors).toBeLessThan(geometry.game);
 for(const link of ['/bilan/','/territoire','/analyses/']) await expect(content.locator('.story-door[href="'+link+'"]')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath('accueil-editorial-path.png'),fullPage:true});
});

test('Accueil garde son contenu publié et sa géométrie quand les données sont indisponibles',async({page})=>{
 await page.route('**/data/derniere.json',route=>route.abort());
 await page.goto('/accueil/');
 await expect(page.getByRole('alert')).toContainText('Les chiffres déjà affichés restent consultables.');
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
    await expect(page.locator('html')).not.toHaveAttribute('data-theme','sombre');
    await expect(page.locator('.entete__wordmark')).toHaveText('500 Signatures');
    await expect(page.locator('.brand-e')).toHaveCount(0);
    await expect(page.locator('#theme-bascule')).toHaveCount(0);
    if(!await page.locator('#navigation-principale').isVisible()) await page.getByRole('button',{name:'Ouvrir le menu',exact:true}).click();
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
 await expect(page.getByRole('heading',{name:'À vous de gouverner.',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('simulator-legacy-preservation'))).toBe('old-save');
});

test('editorial histories expand, redistribution stays visible and Europe is grouped',async({page},info)=>{
 test.skip(!['android-chromium','iphone-webkit','desktop-chromium'].includes(info.project.name),'Representative touch and desktop layouts.');
 await page.goto('/bilan/');
 await expect(page.getByText(/^Chapitre \d+/)).toHaveCount(0);
 await expect(page.getByText('Un pays. Des choix.',{exact:true})).toHaveCount(0);
 await expect(page.locator('#france-complements')).toBeVisible();
 await expect(page.locator('#bloc-redistribution')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Redistribution : des revenus plus égalitaires',exact:true})).toBeVisible();
 await expect(page.getByText('Données et historique des dépenses',{exact:true})).toHaveCount(0);
 await expect(page.locator('#bloc-europe #bloc-fonctions')).toHaveCount(1);
 const expand=page.locator('.fr-topic > summary').first();await expand.focus();await expand.press('Enter');
 await expect(page.locator('.fr-topic[open] .fr-topic-content')).toBeVisible();
 await expand.press('Enter');await expect(expand).toBeFocused();
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
 await expect(page.locator('html')).not.toHaveAttribute('data-theme','sombre');
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


test('X est accessible depuis le header partagé et les footers principaux',async({page})=>{
 for(const path of ['/accueil/','/bilan/','/territoire']){
  await page.goto(path);
  const headerX=page.locator('header .site-x-link').first();
  await expect(headerX).toHaveAttribute('href','https://x.com/500signaturesfr');
  await expect(headerX).toHaveAttribute('aria-label','500 Signatures sur X');
 }
 await page.goto('/mandats/');
 await expect(page.locator('header .site-x-link')).toHaveAttribute('href','https://x.com/500signaturesfr');
 await expect(page.locator('footer .site-x-link')).toHaveAttribute('href','https://x.com/500signaturesfr');
});
