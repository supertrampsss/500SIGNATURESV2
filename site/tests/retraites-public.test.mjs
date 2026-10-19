import {test,expect} from '@playwright/test';

const dossier='/analyses/financement-retraites-publiques/';
async function noOverflow(page) {
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
}
test('Retraites : périmètres explicites et financement public accessible depuis France',async({page},info)=>{
 await page.goto('/bilan/#arbitrages-generation');
 await expect(page.locator('#france-sorties')).toContainText('Vieillesse (hors réversion)');
 await expect(page.locator('#france-sorties')).toContainText('cotisations sociales');
 const theme=page.locator('#arbitrages-generation');
 await expect(theme).toHaveAttribute('open','');
 await expect(theme.getByRole('link',{name:'Comprendre le financement des retraites publiques'})).toBeVisible();
 await expect(theme).toContainText('2016');
 await noOverflow(page);
 await page.screenshot({path:info.outputPath('france-retraites.png'),fullPage:true,animations:'disabled',scale:'css'});
 await theme.getByRole('link',{name:'Comprendre le financement des retraites publiques'}).click();
 await expect(page).toHaveURL(new RegExp(dossier));
 await expect(page.locator('main')).toContainText('41,5');
 await expect(page.locator('main')).toContainText('43,9');
 await expect(page.locator('#sources time[datetime="2026-10-19"]')).toBeVisible();
 await expect(page.locator('#sources a[href*="budget.gouv.fr"]')).not.toHaveCount(0);
 expect(await page.locator('#sources').evaluate(el=>el.compareDocumentPosition(document.querySelector('h1'))&Node.DOCUMENT_POSITION_PRECEDING)).toBeTruthy();
 await noOverflow(page);
 await page.screenshot({path:info.outputPath('financement-retraites-publiques.png'),fullPage:true,animations:'disabled',scale:'css'});
});
test('Les dossiers retraites et Défense conservent leurs sources en fin de lecture',async({page},info)=>{
 for(const slug of ['retraites-premier-poste-2024','defense-credits-votes-consommes-2025']) {
  await page.goto('/analyses/'+slug+'/');
  await expect(page.locator('#sources a')).not.toHaveCount(0);
  await expect(page.locator('#sources time[datetime="2026-10-19"]')).toBeVisible();
  await expect(page.locator('a[href="'+dossier+'"]')).not.toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({path:info.outputPath(slug+'.png'),fullPage:true,animations:'disabled',scale:'css'});
 }
});
