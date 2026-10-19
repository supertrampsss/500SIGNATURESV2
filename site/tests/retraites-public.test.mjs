import {test,expect} from '@playwright/test';

const dossier='/analyses/financement-retraites-publiques/';
async function noOverflow(page) {
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
}
test('Retraites : périmètres explicites et financement public accessible depuis France',async({page},info)=>{
 await page.goto('/bilan/#arbitrages-generation');
 const refus=page.getByRole('button',{name:'Refuser',exact:true});
 if(await refus.isVisible())await refus.click();
 await expect(page.locator('#france-sorties')).toContainText('Retraites');
 await expect(page.locator('#reclassement-bercy .budget-comparison__row')).toHaveCount(19);
 await expect(page.locator('#reclassement-bercy')).toContainText('Défense');
 await expect(page.locator('#reclassement-bercy')).toContainText('Md€');
 await expect(page.locator('#reclassement-bercy thead th').first()).toHaveCSS('position','static');
 await expect(page.locator('#reclassement-bercy')).toContainText('60,6');
 for(const row of await page.locator('#reclassement-bercy [data-retirement-eur]').evaluateAll(es=>es.map(e=>e.dataset))) expect(Number(row.retirementEur)+Number(row.remainingEur)).toBe(Number(row.budgetEur));
 await page.locator('#reclassement-bercy').screenshot({path:info.outputPath('bercy-reclassement.png'),animations:'disabled',scale:'css'});
 await page.locator('#france-sorties').screenshot({path:info.outputPath('france-repartition.png'),animations:'disabled',scale:'css'});
 await expect(page.locator('#france-sorties')).not.toContainText('réversion figurent dans les autres dépenses');
 const theme=page.locator('#arbitrages-generation');
 await expect(theme).toHaveAttribute('open','');
 await expect(theme.getByRole('link',{name:'Comprendre le financement des retraites publiques'})).toBeVisible();
 await expect(theme).toContainText('2016');
 await noOverflow(page);
 await page.screenshot({path:info.outputPath('france-retraites.png'),fullPage:true,animations:'disabled',scale:'css'});
 await theme.getByRole('link',{name:'Comprendre le financement des retraites publiques'}).click();
 await expect(page).toHaveURL(new RegExp(dossier));
 await expect(page.locator('#figure-ministeres-reclasses .budget-comparison__row')).toHaveCount(19);
 await page.locator('#figure-ministeres-reclasses').screenshot({path:info.outputPath('dossier-reclassement.png'),animations:'disabled',scale:'css'});
 await expect(page.locator('main')).toContainText('41,5');
 await expect(page.locator('main')).toContainText('43,9');
 await expect(page.locator('#sources time[datetime="2026-10-19"]')).toBeVisible();
 await expect(page.locator('#sources a[href*="budget.gouv.fr"]')).not.toHaveCount(0);
 await expect(page.locator('#sources')).toContainText('tableau 2.2 du COR');
 await expect(page.locator('#sources')).toContainText('opérateurs');
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

 test('Salaires : une seule ligne Retraites et reclassement ministériel sans double compte', async ({page},info)=>{
 await page.goto('/salaires/');
 await expect(page.locator('#reclassement-bercy .budget-comparison__row')).toHaveCount(19);
 await expect(page.locator('#reclassement-bercy')).toContainText('Défense');
 await expect(page.locator('#reclassement-bercy')).toContainText('Md€');
 await expect(page.locator('#reclassement-bercy thead th').first()).toHaveCSS('position','static');
 await expect(page.locator('#reclassement-bercy')).toContainText('60,6');
 for(const row of await page.locator('#reclassement-bercy [data-retirement-eur]').evaluateAll(es=>es.map(e=>e.dataset))) expect(Number(row.retirementEur)+Number(row.remainingEur)).toBe(Number(row.budgetEur));
 await expect(page.locator('.salary-missions h3').filter({hasText:/^Retraites$/})).toHaveCount(1);
 await expect(page.locator('.salary-missions h3').filter({hasText:/Pensions de réversion|Vieillesse/})).toHaveCount(0);
 const shares=await page.locator('[data-allocation-share]').evaluateAll(els=>els.reduce((s,e)=>s+Number(e.dataset.allocationShare),0));
 expect(Math.abs(shares-1)).toBeLessThan(1e-10);
 await page.screenshot({path:info.outputPath('salaires-retraites.png'),fullPage:true,animations:'disabled',scale:'css'});
 await noOverflow(page);
 });
