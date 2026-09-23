import {test,expect} from '@playwright/test';
const KEY='500signatures.mandats.v1';

async function continueAfterAnnualRecap(page){
 if(await page.locator('.year-recap').count()){
  await expect(page.locator('.year-recap')).toBeVisible();
  await page.getByRole('button',{name:/Passer à l’année/}).click();
 }
}

test('ten v9 national decisions cross the first annual chapter and preserve the mobile navigation',async({page},info)=>{
 await page.goto('/mandats/?mode=national');
 await expect(page.locator('.campaign-position')).toContainText('Année 1 · décision 1/6');
 await expect(page.locator('[data-national-scene]:visible')).toHaveAttribute('data-state','ready');
 const portrait=page.viewportSize().width<=820&&page.viewportSize().height>500;
 if(portrait){
  expect((await page.locator('.national-stage:visible').boundingBox()).height).toBeLessThanOrEqual(110);
  expect((await page.locator('.choices button').first().boundingBox()).y).toBeLessThan(page.viewportSize().height-100);
 }
 await page.screenshot({path:info.outputPath('agenda-v9-before-'+info.project.name+'.png'),fullPage:true});
 const titles=[];
 for(let i=0;i<10;i++){
  titles.push(await page.locator('.dossier h1').innerText());
  await page.locator('.choices button').nth(i%3).click();
  const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
  expect(saved.version).toBe(9);expect(saved.choices).toHaveLength(i+1);
  if(i===0)await expect(page.locator('.dossier h1')).toHaveText('Faut-il réduire les effectifs administratifs ?');
  if((i+1)%6===0){
   await expect(page.locator('.year-recap')).toContainText('FIN DE L’ANNÉE 1');
   await continueAfterAnnualRecap(page);
  }
  const played=i+1;
  const year=Math.floor(played/6)+1;
  const slot=played%6+1;
  await expect(page.locator('.campaign-position')).toContainText(`Année ${year} · décision ${slot}/6`);
  if(portrait){
   const box=await page.locator('.dossier h1').boundingBox();expect(box.y).toBeGreaterThanOrEqual(0);
   expect(box.y+box.height).toBeLessThan(page.viewportSize().height-60);
   await expect(page.locator('.mobile-decision-feedback')).toBeVisible();
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
 }
 expect(new Set(titles).size).toBe(10);
 const saved=await page.evaluate(k=>localStorage.getItem(k),KEY);
 await page.getByRole('button',{name:'Bilan',exact:true}).click();await expect(page.locator('.finance-panel')).toBeVisible();
 await page.getByRole('button',{name:'Décider',exact:true}).click();
 expect(await page.evaluate(k=>localStorage.getItem(k),KEY)).toBe(saved);
 await expect(page.locator('.campaign-position')).toContainText('Année 2 · décision 5/6');
 await page.screenshot({path:info.outputPath('agenda-v9-after-ten-'+info.project.name+'.png'),fullPage:true});
});
