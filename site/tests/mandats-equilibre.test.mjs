import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const route=JSON.parse(readFileSync(new URL('./fixtures/mandats-equilibre.json',import.meta.url)));
const saveKey='500signatures.mandats.v1';

test('budget equilibrium is reached by thirty real decisions and survives navigation',async({page},info)=>{
 test.setTimeout(180_000);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(`/mandats/?mode=national&v=10&seed=${route.seed}&ambition=equilibre`);
 await expect(page.locator('.site-header')).toBeVisible();
 await expect(page.locator('.site-header a[href="/bilan/"]')).toBeVisible();
 const recaps=[];
 for(let index=0;index<route.choices.length;index++){
  const choice=page.locator(`[data-choice="${route.choices[index]}"]`);
  await expect(choice).toBeVisible();
  if(index===1)await page.screenshot({path:info.outputPath('pensions.png'),fullPage:true});
  await choice.click();
  await expect.poll(async()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).choices.length,saveKey)).toBe(index+1);
  if((index+1)%6===0 && index<29){
   const recap=page.locator('.living-recap--year');
   await expect(recap).toBeVisible();
   recaps.push(await recap.locator('h1').innerText());
   expect(await recap.innerText()).not.toMatch(/→|Une année de décisions/);
   await page.screenshot({path:info.outputPath(`year-${(index+1)/6}.png`),fullPage:true});
   if(index<29){await page.locator('[data-action="next-year"]').click();await page.locator('[data-action="start-year"]').click();}
  }
  expect(await page.locator('#mandats').innerText()).not.toContain('Détails de l’arbitrage');
 }
 expect(new Set(recaps).size).toBe(4);
 await expect(page.locator('.living-result')).toContainText('Excédent');
 const exported=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),saveKey);
 expect(exported.choices).toEqual(route.choices);
 await info.attach('replayable-mandate.json',{body:JSON.stringify(exported,null,2),contentType:'application/json'});
 await page.screenshot({path:info.outputPath('balanced-result.png'),fullPage:true});
 await page.locator('.site-header a[href="/bilan/"]').click();
 await expect(page).toHaveURL(/\/bilan\/?$/);
 await page.goto('/mandats/');
 await page.getByRole('button',{name:'Reprendre',exact:true}).click();
 await expect(page.locator('.living-result')).toContainText('Excédent');
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).choices,saveKey)).toEqual(route.choices);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await info.attach('reproduction.json',{body:JSON.stringify({seed:route.seed,viewport:page.viewportSize(),project:info.project.name,annualTitles:recaps}),contentType:'application/json'});
});
