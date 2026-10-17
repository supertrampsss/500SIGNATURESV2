import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
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
  // The minister's finite relief can already have expired at period 12.
  // Reconstruct the saved legal inputs to inspect its actual delivered origin.
  const raw=await page.evaluate(k=>localStorage.getItem(k),KEY);
  const storage=new URL('../src/mandats/storage.ts',import.meta.url).href;
  const g=JSON.parse(execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',`import{decode}from${JSON.stringify(storage)};let raw='';for await(const p of process.stdin)raw+=p;process.stdout.write(JSON.stringify(decode(raw)));`],{input:raw,encoding:'utf8'}));
  const incident=g.presidency.crises.find(c=>c.spec==='medicaments');
  expect(incident.parentId).toBe('port-2');
  expect(g.pressure.programmes.some(p=>p.crisisId===incident.id && p.label==='Mobiliser les réserves sanitaires' && p.deliveredTurn!==undefined)).toBe(true);
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

test('reforms arrive on the map and one choice saves its vote without opening the reform tab',async({page},info)=>{
  await load(page,2);
  const brand=await page.locator('.pr-brand').boundingBox(), calendar=await page.locator('.pr-calendar').boundingBox();
  expect(brand.x+brand.width).toBeLessThanOrEqual(calendar.x+1);
  const lastResource=await page.locator('.pr-resource--seats').boundingBox();
  expect(lastResource.x+lastResource.width).toBeLessThanOrEqual(page.viewportSize().width);
  const pin=page.locator('[data-live-event-pin]').first();
  const id=await pin.getAttribute('data-live-event-pin');
  await pin.focus();await page.keyboard.press('Enter');await page.clock.runFor(80);
  const fan=page.locator('[data-presidency-event]');
  await expect(fan).toBeVisible();
  await expect(page.locator('[data-presidency-panel]')).toHaveCount(0);
  const action=fan.locator('[data-order]:not(:disabled)').first();
  const choice=await action.getAttribute('data-order');await action.click();
  expect(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),KEY)).choices.at(-1)).toBe(choice);
  await expect(page.locator(`[data-live-event-pin="${id}"]`)).toHaveCount(0);
  await expect(page.locator('[data-presidency]')).toHaveAttribute('data-turn','0');
  await expect(page.locator('[data-presidency-art]')).toHaveAttribute('src','/mandats/art/presidency-france-v2.webp');
  await capture(page,info,'08-reforme-sur-carte');
});

test('major civil stages are visible and neglect ends the mandate with a persisted defeat',async({page},info)=>{
  await load(page,2);
  for(const stage of ['Grève interprofessionnelle','Blocages dans le pays','Révolte sociale','Crise révolutionnaire']) {
    for(let p=0;p<9 && !await page.locator('[data-crisis-id="civil-0"] strong').filter({hasText:stage}).count();p++) await tick(page);
    await expect(page.locator('[data-crisis-id="civil-0"]')).toContainText(stage);
    await expect(page.locator('[data-live-event-pin="civil-0"]')).toBeVisible();
    await capture(page,info,'09-'+stage.split(' ')[0]);
  }
  await page.locator('[data-live-event-pin="civil-0"]').click();await page.clock.runFor(80);
  await expect(page.locator('[data-presidency-event="civil-0"] [data-order="live-resign"]')).toBeVisible();
  await page.locator('[data-action=presidency-deselect]').click();
  for(let p=0;p<6 && !await page.locator('[data-presidency-panel=ending]').count();p++) await tick(page);
  await expect(page.locator('[data-presidency-panel=ending]')).toContainText('Le mandat s’interrompt');
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused','true');
  const save=await page.evaluate(k=>localStorage.getItem(k),KEY);await page.clock.runFor(60000);
  expect(await page.evaluate(k=>localStorage.getItem(k),KEY)).toBe(save);
  await capture(page,info,'10-defaite');
});

test('a civil agreement uses the map, waits for delivery and lifts the blockade',async({page},info)=>{
  await load(page,2);
  for(let p=0;p<9 && !await page.locator('[data-live-event-pin="civil-0"]').count();p++) await tick(page);
  await page.locator('[data-live-event-pin="civil-0"]').click();await page.clock.runFor(80);
  const action=page.locator('[data-presidency-event="civil-0"] [data-order$="-accord-social"]');
  await action.scrollIntoViewIfNeeded();await action.click();
  await expect(page.locator('[data-crisis-effect="civil-0"]')).toHaveAttribute('data-phase','intervention');
  await tick(page,2);
  await expect(page.locator('[data-crisis-id="civil-0"]')).toHaveCount(0);
  await expect(page.locator('[data-live-event-pin="civil-0"]')).toHaveCount(0);
  await expect(page.locator('[data-presidency-panel=ending]')).toHaveCount(0);
  await capture(page,info,'11-accord-social-livre');
});
