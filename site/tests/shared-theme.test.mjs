import {test,expect} from '@playwright/test';

test('the compact theme control persists through every primary destination and a saved mandate',async({page},info)=>{
 await page.goto('/salaires/');
 await expect(page.locator('html')).toHaveAttribute('data-theme','sombre');
 await page.getByRole('button',{name:'Activer le mode clair',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','clair');
 await page.getByRole('navigation',{name:'Navigation principale',exact:true}).getByRole('link',{name:'Mandats',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','clair');
 await page.goto('/mandats/?mode=national');
 await expect(page.locator('.campaign-position')).toContainText('Décision 1/45');
 await page.locator('[data-action="choose"]').first().click();
 await expect(page.locator('.campaign-position')).toContainText('Décision 2/45');
 await page.getByRole('button',{name:'Activer le mode sombre',exact:true}).click();
 await page.reload();
 await page.getByRole('button',{name:/Reprendre/}).click();
 await expect(page.locator('.campaign-position')).toContainText('Décision 2/45');
 await expect(page.locator('html')).toHaveAttribute('data-theme','sombre');
 await expect(page.getByRole('region',{name:'Le contexte en détail',exact:true})).toHaveCount(0);
 for(const name of ['Territoires','France','Salaires']){
   await page.getByRole('navigation',{name:'Navigation principale',exact:true}).getByRole('link',{name,exact:true}).click();
   await expect(page.locator('html')).toHaveAttribute('data-theme','sombre');
   await expect(page.locator('h1:visible').first()).toHaveCSS('color','rgb(245, 240, 223)');
   await expect(page.getByRole('navigation',{name:'Navigation principale',exact:true}).getByRole('link')).toHaveCount(4);
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
 await expect(page.locator('.europe-unifiee #bloc-europe')).toHaveCount(1);
 await expect(page.locator('.europe-unifiee #bloc-fonctions')).toHaveCount(1);
 await expect(page.getByText('La France comparée à ses voisins',{exact:true})).toHaveCount(0);
 const expand=page.locator('[data-expand-analysis]').first();await expand.click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('dialog').locator('.chart-time')).toHaveCount(1);
 await page.getByRole('dialog').getByRole('button',{name:'Fermer',exact:true}).click();
 await expect(expand).toBeFocused();
 await page.goto('/salaires/');
 const select=page.locator('#salary-history-choice');await expect(select).toBeVisible();
 await select.selectOption({index:1});
 await expect(page.locator('[data-salary-history-chart] figcaption')).toContainText(await select.locator('option:checked').textContent());
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});
