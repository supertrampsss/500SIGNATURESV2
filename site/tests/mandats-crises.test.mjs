import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const KEY='500signatures.mandats.v1';
async function load(page, seed=0, choices=['live-autonomy']) {
  await page.clock.install(); await page.clock.pauseAt(Date.now()+1000);
  await page.goto('/mandats/');
  await page.getByRole('button',{name:'Ma partie',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'crises.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:16,mode:'national',seed,ambition:'equilibre',choices}))});
  await expect(page.locator('[data-presidency]')).toBeVisible();
  await page.clock.runFor(4600);
}
async function tick(page,n=1) {
  if(await page.locator('[data-presidency-clock]').getAttribute('data-paused')==='true') await page.locator('[data-action=presidency-pause]').click();
  await page.clock.runFor(n*15000+100);
}
async function capture(page,info,label) {
  await page.screenshot({path:info.outputPath(label+'.png'),fullPage:true,animations:'disabled'});
  await writeFile(info.outputPath(label+'.json'),JSON.stringify({viewport:page.viewportSize(),browser:info.project.name,inputs:JSON.parse(await page.evaluate(key=>localStorage.getItem(key),KEY))},null,2));
  await info.attach(label,{path:info.outputPath(label+'.png'),contentType:'image/png'});
}

test('crisis response is specific, paid once and animated only through actual delivery',async({page},info)=>{
  await load(page);
  const art=page.locator('[data-presidency-art]'); await expect(art).toBeVisible();
  await expect(page.locator('[data-crisis-id="cyber-0"]')).toBeVisible();
  await capture(page,info,'01-apparition');
  await page.locator('[data-crisis-id="cyber-0"]').click(); await page.clock.runFor(50);
  const response=page.locator('[data-order="live-crisis-cyber-0-restaurer"]');
  await expect(response).toContainText('Restaurer les systèmes isolés');
  if(page.viewportSize().width<=650) await expect(page.locator('[data-action=presidency-sound]')).toBeHidden();
  await response.click();
  expect(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),KEY)).choices.at(-1)).toBe('live-crisis-cyber-0-restaurer');
  await expect(page.locator('[data-crisis-effect="cyber-0"]')).toHaveAttribute('data-phase','intervention');
  await expect(page.locator('.pr-response-vehicle')).toHaveCount(1);
  await capture(page,info,'02-intervention');
  await tick(page,2);
  await expect(page.locator('[data-crisis-id="cyber-0"]')).toHaveCount(0);
  await expect(page.locator('[data-crisis-effect="cyber-0"]')).toHaveAttribute('data-phase','recovery');
  await capture(page,info,'03-retablissement');
  await expect(art).toBeVisible();
});

test('ignored problems propagate with visible urgency; pause freezes deadlines and motion',async({page},info)=>{
  await load(page);
  await tick(page,3);
  await expect(page.locator('[data-crisis-id]')).toHaveCount(3);
  await expect(page.locator('[data-crisis-route]')).not.toHaveCount(0);
  await capture(page,info,'04-propagation');
  await page.locator('[data-action=presidency-pause]').click();
  const countdown=await page.locator('[data-crisis-due]').first().textContent();
  await page.clock.runFor(30000);
  expect(await page.locator('[data-crisis-due]').first().textContent()).toBe(countdown);
  expect(await page.locator('.pr-life-wave').first().evaluate(e=>getComputedStyle(e).animationPlayState)).toBe('paused');
  for(const alert of await page.locator('[data-crisis-id]').all()) await expect(alert).toBeInViewport();
  await page.locator('[data-crisis-id]').first().focus(); await page.keyboard.press('Enter'); await page.clock.runFor(50);
  await expect(page.locator('[data-presidency-commands]')).toBeVisible();
  await capture(page,info,'05-arbitrage');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('reduced motion keeps alert and command information without flashing',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await load(page,2);
  expect(await page.locator('.pr-life-wave').first().evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
  await page.locator('[data-crisis-id="port-0"]').click(); await page.clock.runFor(50);
  await expect(page.locator('[data-order="live-crisis-port-0-detourner"]')).toContainText('Détourner les livraisons');
  await expect(page.locator('[data-order="live-crisis-port-0-accord"]')).toContainText('Négocier un accord');
  await capture(page,info,'06-motion-reduite');
});

test('a second incident in the same sector gets ministerial means and keeps its own origin',async({page},info)=>{
  await load(page,0,Array(12).fill('live-tick'));
  await page.locator('[data-action="presidency-panel"][data-panel="government"]').click();
  await expect(page.locator('[data-live-programme]').filter({hasText:'Mobiliser les réserves sanitaires'})).toHaveCount(1);
  await capture(page,info,'07-deux-incidents-meme-secteur');
});

test('a crisis order returns keyboard focus to its own sector',async({page})=>{
  await load(page,2);
  await page.locator('[data-crisis-id="port-0"]').focus();await page.keyboard.press('Enter');await page.clock.runFor(50);
  await page.locator('[data-order="live-crisis-port-0-detourner"]').click();
  await expect(page.locator('[data-live-pin="transport"]')).toBeFocused();
});

test('live updates preserve an open development section and its reading position',async({page})=>{
  await load(page);
  await page.locator('[data-crisis-id="cyber-0"]').click();await page.clock.runFor(50);
  await page.locator('.pr-sector-development summary').click();
  const fan=page.locator('.pr-fan');
  await fan.evaluate(e=>{e.scrollTop=100;});
  const scroll=await fan.evaluate(e=>e.scrollTop);
  await tick(page);
  await expect(page.locator('.pr-sector-development')).toHaveAttribute('open','');
  expect(Math.abs(await fan.evaluate(e=>e.scrollTop)-scroll)).toBeLessThan(3);
});
