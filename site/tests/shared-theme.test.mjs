import {test,expect} from '@playwright/test';

test('Mandats : carte de départ lisible et texte centré dans les deux thèmes',async({page},info)=>{
 await page.goto('/mandats/');
 const card=page.locator('.mode-card.national');
 const copy=card.locator('.mode-copy');
 for(const [theme,toggle] of [['clair','Activer le mode sombre'],['sombre','Activer le mode clair']]) {
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('mandats-selection-'+theme+'.png'),fullPage:true});
  const appearance=await copy.evaluate(el=>{
   const luminance=color=>{
    const values=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
    return values[0]*.2126+values[1]*.7152+values[2]*.0722;
   };
   const bg=getComputedStyle(el).backgroundColor;
   const parent=el.getBoundingClientRect();
   return {
    bg,
    texts:Array.from(el.querySelectorAll('.eyebrow,h2,p,.mode-meta span,.mode-cta')).map(child=>{
     const css=getComputedStyle(child),r=child.getBoundingClientRect();
     const fg=luminance(css.color),background=luminance(child.classList.contains('mode-cta')?css.backgroundColor:bg);
     return {text:child.textContent,color:css.color,contrast:(Math.max(fg,background)+.05)/(Math.min(fg,background)+.05),visible:r.width>0&&r.height>0};
    }),
    aligned:getComputedStyle(el).textAlign,
    ctaCenter:Math.abs((el.querySelector('.mode-cta').getBoundingClientRect().left+el.querySelector('.mode-cta').getBoundingClientRect().right)/2-(parent.left+parent.right)/2),
   };
  });
  expect(appearance.bg).not.toMatch(/rgba\([^)]*,\s*0\)|transparent/);
  for(const text of appearance.texts){expect(text.visible,text.text).toBe(true);expect(text.contrast,JSON.stringify({theme,bg:appearance.bg,...text})).toBeGreaterThanOrEqual(4.5);}
  expect(appearance.aligned).toBe('center');
  expect(appearance.ctaCenter).toBeLessThanOrEqual(2);
  const layout=await card.evaluate(el=>{
   const image=el.querySelector('.mode-art').getBoundingClientRect(),copy=el.querySelector('.mode-copy').getBoundingClientRect();
   return {stacked:innerWidth<=700,image:{x:image.x,y:image.y,width:image.width,bottom:image.bottom},copy:{x:copy.x,y:copy.y,width:copy.width,bottom:copy.bottom}};
  });
  expect(Math.abs(layout.image.width-layout.copy.width)).toBeLessThanOrEqual(2);
  if(layout.stacked) expect(Math.abs(layout.copy.y-layout.image.bottom)).toBeLessThanOrEqual(2);
  else {expect(Math.abs(layout.image.y-layout.copy.y)).toBeLessThanOrEqual(2);expect(Math.abs(layout.image.bottom-layout.copy.bottom)).toBeLessThanOrEqual(2);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  await page.getByRole('button',{name:toggle,exact:true}).click();
 }
 await card.click();
 await expect(page.locator('.campaign-position')).toContainText('Décision 1/45');
});

test('Mandats expose Accueil et le lien revient à la page d’accueil',async({page})=>{
 for(const path of ['/mandats/','/mandats/methode/']){
  await page.goto(path);
  const accueil=page.getByRole('navigation',{name:'Navigation principale',exact:true}).getByRole('link',{name:'Accueil',exact:true});
  await expect(accueil).toHaveAttribute('href','/');
  await accueil.click();
  await expect(page).toHaveURL(/https?:\/\/[^/]+\/$/);
  await expect(page.getByRole('heading',{name:'Comprendre les comptes publics. Décider en connaissance de cause.',exact:true})).toBeVisible();
 }
});

test('the compact theme control persists through every primary destination and a saved mandate',async({page},info)=>{
 await page.goto('/salaires/');
 await expect(page.locator('html')).toHaveAttribute('data-theme','clair');
 await page.getByRole('navigation',{name:'Navigation principale',exact:true}).getByRole('link',{name:'Mandats',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','clair');
 await page.goto('/mandats/?mode=national');
 await expect(page.locator('.campaign-position')).toContainText('Décision 1/45');
 expect(await page.locator('.game-tabs').evaluate(el=>getComputedStyle(el).backgroundColor===getComputedStyle(document.body).backgroundColor)).toBe(true);
 await page.locator('[data-action="choose"]').first().click();
 await expect(page.locator('.campaign-position')).toContainText('Décision 2/45');
 await page.getByRole('button',{name:'Activer le mode sombre',exact:true}).click();
 await page.reload();
 await page.getByRole('button',{name:/Reprendre/}).click();
 await expect(page.locator('.campaign-position')).toContainText('Décision 2/45');
 await expect(page.locator('html')).toHaveAttribute('data-theme','sombre');
 await expect(page.getByRole('region',{name:'Le contexte en détail',exact:true})).toHaveCount(0);
 for(const name of ['Villes','France','Salaires','Dossiers']){
   await page.getByRole('navigation',{name:'Navigation principale',exact:true}).getByRole('link',{name,exact:true}).click();
   await expect(page.locator('html')).toHaveAttribute('data-theme','sombre');
   await expect(page.locator('h1:visible').first()).toHaveCSS('color','rgb(245, 240, 223)');
   await expect(page.getByRole('navigation',{name:'Navigation principale',exact:true}).getByRole('link')).toHaveCount(7);
   if(name==='Salaires') await expect(page.locator('.salary-history')).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
 }
 await page.screenshot({path:info.outputPath('shared-theme-'+info.project.name+'.png'),fullPage:true});
});

test('retired simulator URLs lead to Mandats while old browser data is preserved',async({page},info)=>{
 test.skip(info.project.name!=='desktop-chromium','One redirect compatibility check.');
 await page.addInitScript(()=>localStorage.setItem('simulator-legacy-preservation','old-save'));
 await page.goto('/simulateur/comparer?version=2&budget=france');
 await expect(page).toHaveURL(/\/mandats\/$/);
 await expect(page.getByRole('heading',{name:'Choisissez votre mandat.',exact:true})).toBeVisible();
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

test('France keeps the approved backgrounds and readable inner margins in both themes',async({page},info)=>{
 await page.goto('/bilan/');
 await expect(page.locator('#bloc-recettes-etat')).toBeVisible();
 for(const [theme,background,toggle] of [
  ['clair','rgb(245, 242, 234)','Activer le mode sombre'],
  ['sombre','rgb(12, 32, 41)','Activer le mode clair']
 ]){
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  await expect(page.getByRole('img',{name:'500 SIGNATURES',exact:true})).toBeVisible();
  const logo=page.locator('.brand-e img:visible');
  await expect(logo).toHaveCount(1);
  expect(await logo.evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
  await expect(page.locator('body')).toHaveCSS('background-color',background);
  await expect(page.locator('.entete')).toHaveCSS('background-color',background);
  const margins=await page.locator('#national').evaluate(panel=>{
   const p=panel.getBoundingClientRect();
   return Array.from(panel.querySelectorAll('#bloc-ouverture,#bloc-recettes-etat,#france-dette,#insights-france')).map(el=>{
    const r=el.getBoundingClientRect();return {left:r.left-p.left,right:p.right-r.right};
   });
  });
  expect(margins.length).toBe(4);
  for(const margin of margins){expect(margin.left).toBeGreaterThanOrEqual(19);expect(margin.right).toBeGreaterThanOrEqual(19);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  await page.locator('#bloc-recettes-etat').scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('france-margins-'+theme+'.png')});
  await page.getByRole('button',{name:toggle,exact:true}).click();
 }
});
