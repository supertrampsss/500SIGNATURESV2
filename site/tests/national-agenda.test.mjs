import {test,expect} from '@playwright/test';
const KEY='500signatures.mandats.v1';
test('ten national decisions apply once, keep the next question readable and preserve the mobile navigation',async({page},info)=>{
 await page.goto('/mandats/?mode=national');
 await expect(page.locator('.campaign-position')).toContainText('1/45');
 await expect(page.locator('[data-national-scene]:visible')).toHaveAttribute('data-state','ready');
 const portrait=page.viewportSize().width<=820&&page.viewportSize().height>500;
 if(portrait){
  expect((await page.locator('.national-stage:visible').boundingBox()).height).toBeLessThanOrEqual(110);
  expect((await page.locator('.choices button').first().boundingBox()).y).toBeLessThan(page.viewportSize().height-100);
 }
 await page.screenshot({path:info.outputPath('agenda-before-'+info.project.name+'.png'),fullPage:true});
 const titles=[];
 for(let i=0;i<10;i++){
  titles.push(await page.locator('.dossier h1').innerText());
  await page.locator('.choices button').nth(i%3).click();
  await expect(page.locator('.campaign-position')).toContainText(`${i+2}/45`);
  const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
  expect(saved.version).toBe(8);expect(saved.choices).toHaveLength(i+1);
  if(i===0)await expect(page.locator('.dossier h1')).toHaveText('Faut-il réduire les effectifs administratifs ?');
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
 await expect(page.locator('.campaign-position')).toContainText('11/45');
 await page.screenshot({path:info.outputPath('agenda-after-ten-'+info.project.name+'.png'),fullPage:true});
});
