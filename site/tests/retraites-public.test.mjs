import {test,expect} from '@playwright/test';

const dossier='/analyses/financement-retraites-publiques/';
async function noOverflow(page) {
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
}
async function verifieTableauCompact(scope) {
 const comparison=scope.locator('.budget-comparison');
 const table=comparison.locator('.budget-comparison__table');
 await expect(comparison).toHaveCount(1);
 await expect(scope.locator('table')).toHaveCount(1);
 await expect(scope.locator('.budget-flow, .budget-comparison__legend')).toHaveCount(0);
 await expect(scope).not.toContainText('Les 19 ministères');
 await expect(comparison).not.toContainText('≈');
 await expect(table).toBeVisible();
 await expect(table.locator('thead th')).toHaveCount(4);
 await expect(table.locator('thead th').first()).toHaveCSS('position','static');
 await expect(table.locator('thead th').nth(1)).toContainText('Budget affiché');
 await expect(table.locator('thead th').nth(2)).toContainText('Ponctionné pour financer les retraites');
 await expect(table.locator('thead th').nth(3)).toContainText('Budget restant');
 await expect(table.locator('thead .budget-comparison__unit')).toHaveText(['Md€','Md€','Md€']);
 const rows=table.locator('.budget-comparison__row');
 await expect(rows).toHaveCount(19);
 await expect(rows.first().locator('td').nth(1)).toHaveAccessibleName(/financement des retraites comprenant des cotisations salariales estimées/);
 await expect(rows.first().locator('td').nth(2)).toHaveAccessibleName(/budget restant après déduction des cotisations salariales estimées/);
 await expect(rows.locator('td')).toHaveCount(57);
 await expect(comparison).toContainText('Défense');
 await expect(comparison).toContainText('60,6');
 for(const row of await rows.evaluateAll(es=>es.map(e=>e.dataset))) {
  if(row.retirementEur!==undefined) expect(Number(row.retirementEur)+Number(row.remainingEur)).toBe(Number(row.budgetEur));
 }
 for(const name of [/^Santé/,/^Transports$/]) {
  const row=rows.filter({has:table.page().getByRole('rowheader',{name})});
  await expect(row.locator('td').nth(1).locator('.budget-comparison__value')).toHaveText('0');
  await expect(row.locator('.budget-comparison__spark-fill--retirement')).toHaveCount(0);
 }
 const unknown=rows.filter({has:table.page().getByRole('rowheader',{name:'Enseignement supérieur et recherche',exact:true})});
 await expect(unknown.locator('td').nth(1).locator('.budget-comparison__value')).toHaveText('—');
 await expect(unknown.locator('td').nth(2).locator('.budget-comparison__value')).toHaveText('—');
 await expect(unknown.locator('.budget-comparison__spark-fill--retirement, .budget-comparison__spark-fill--remaining')).toHaveCount(0);
 await table.page().evaluate(()=>document.fonts.ready);
 // Test the rendered geometry: common tracks and proportional fills must survive
 // the surrounding France, Salaires and dossier styles on every viewport.
 const geometry=await comparison.evaluate(el=>{
  const maximum=Number(el.dataset.scaleMaximumEur);
  const rows=[...el.querySelectorAll('.budget-comparison__row')];
  const issues=[];
  const widths=[];
  const font=getComputedStyle(el.querySelector('.budget-comparison__value'));
  for(const row of rows) {
   const label=row.querySelector('th').textContent.trim();
   for(const [index,key] of ['budget','retirement','remaining'].entries()) {
    const cell=row.querySelectorAll('td')[index];
    const amount=cell.querySelector('.budget-comparison__value');
    const tracks=cell.querySelectorAll('.budget-comparison__spark');
    if(!amount||tracks.length!==1) {issues.push(`${label}: montant ou piste manquant en colonne ${key}`);continue;}
    const track=tracks[0];
    const trackWidth=track.getBoundingClientRect().width;
    widths.push(trackWidth);
    const value=row.dataset[`${key}Eur`];
    const fill=track.querySelector(`.budget-comparison__spark-fill--${key}`);
    if(value!==undefined&&Number(value)>0) {
     const expected=Number(value)/maximum;
     // Chromium serializes percentage styles to six significant digits.
     if(!fill||Math.abs(parseFloat(fill.style.width)/100-expected)>1e-6
      ||Math.abs(fill.getBoundingClientRect().width-trackWidth*expected)>1) {
      issues.push(`${label}: longueur incorrecte en colonne ${key}`);
     }
    } else if(fill) issues.push(`${label}: remplissage pour zéro ou donnée inconnue`);
   }
  }
  // Text ranges include wrapped ministry names and headers, not just numbers.
  for(const cell of el.querySelectorAll('th, td')) {
   const bounds=cell.getBoundingClientRect();
   const walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);
   while(walker.nextNode()) {
    if(!walker.currentNode.textContent.trim())continue;
    const range=document.createRange();
    range.selectNodeContents(walker.currentNode);
    for(const rect of range.getClientRects()) {
     if(rect.left<bounds.left-1||rect.right>bounds.right+1||rect.top<bounds.top-1||rect.bottom>bounds.bottom+1) {
      issues.push(`Texte hors cellule : ${walker.currentNode.textContent.trim()}`);
     }
    }
   }
  }
  return {maximum,maxBudget:Math.max(...rows.map(row=>Number(row.dataset.budgetEur))),issues,
   minTrack:Math.min(...widths),maxTrack:Math.max(...widths),font:font.fontFamily,weight:font.fontWeight,
   height:el.getBoundingClientRect().height,viewport:innerWidth};
 });
 expect(geometry.maximum).toBe(geometry.maxBudget);
 expect(geometry.font).toContain('Budget Flux Sans');
 expect(geometry.weight).toBe('700');
 expect(geometry.issues).toEqual([]);
 expect(geometry.minTrack).toBeGreaterThan(0);
 expect(geometry.maxTrack-geometry.minTrack).toBeLessThanOrEqual(1);
 expect(geometry.height).toBeLessThan(geometry.viewport<=320?1750:geometry.viewport<=390?1500:900);
}
test('Retraites : périmètres explicites et financement public accessible depuis France',async({page},info)=>{
 await page.goto('/bilan/#arbitrages-generation');
 const refus=page.getByRole('button',{name:'Refuser',exact:true});
 if(await refus.isVisible())await refus.click();
 await expect(page.locator('#france-sorties')).toContainText('Retraites');
 await verifieTableauCompact(page.locator('#reclassement-bercy'));
 await page.locator('#reclassement-bercy .budget-comparison').screenshot({path:info.outputPath('bercy-tableau.png'),animations:'disabled',scale:'css'});
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
 await verifieTableauCompact(page.locator('#figure-ministeres-reclasses'));
 await page.locator('#figure-ministeres-reclasses .budget-comparison').screenshot({path:info.outputPath('dossier-tableau.png'),animations:'disabled',scale:'css'});
 await page.locator('#figure-ministeres-reclasses').screenshot({path:info.outputPath('dossier-reclassement.png'),animations:'disabled',scale:'css'});
 await expect(page.locator('main')).toContainText('41,5');
 await expect(page.locator('main')).toContainText('43,9');
 await expect(page.locator('#sources time[datetime="2026-10-19"]')).toBeVisible();
 await expect(page.locator('#sources time[datetime="2026-10-20"]')).toBeVisible();
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
 await verifieTableauCompact(page.locator('#reclassement-bercy'));
 await page.locator('#reclassement-bercy .budget-comparison').screenshot({path:info.outputPath('salaires-tableau.png'),animations:'disabled',scale:'css'});
 await page.locator('#reclassement-bercy').screenshot({path:info.outputPath('salaires-reclassement.png'),animations:'disabled',scale:'css'});
 await expect(page.locator('.salary-missions h3').filter({hasText:/^Retraites$/})).toHaveCount(1);
 await expect(page.locator('.salary-missions h3').filter({hasText:/Pensions de réversion|Vieillesse/})).toHaveCount(0);
 const shares=await page.locator('[data-allocation-share]').evaluateAll(els=>els.reduce((s,e)=>s+Number(e.dataset.allocationShare),0));
 expect(Math.abs(shares-1)).toBeLessThan(1e-10);
 await page.screenshot({path:info.outputPath('salaires-retraites.png'),fullPage:true,animations:'disabled',scale:'css'});
 await noOverflow(page);
 });
