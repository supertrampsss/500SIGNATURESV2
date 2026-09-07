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
