import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const KEY = '500signatures.mandats.v1';
const sectors = ['health','housing','transport','energy','education','administration'];
async function setup(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // pauseAt installs the clock itself: one call avoids a running-clock gap
  // between install(now) and pauseAt(now), which becomes a past time under load.
  await page.clock.pauseAt(Date.now());
  await page.goto('/mandats/');
}
async function start(page) {
  await setup(page); await page.getByRole('button', { name: /^Commencer/ }).click();
  await expect(page.locator('[data-presidency]')).toHaveAttribute('data-version','17'); await page.clock.runFor(32);
}
async function load(page, choices, seed = 0) {
  await setup(page); await page.getByRole('button',{name:'Ma partie',exact:true}).click();
  await page.locator('input[type="file"]').setInputFiles({ name:'inputs.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify({version:17,mode:'national',seed,ambition:'equilibre',choices})) });
  await expect(page.locator('[data-presidency]')).toBeVisible(); await page.clock.runFor(4501);
}
async function hit(locator) {
  await expect(locator).toBeInViewport({ratio:1});
  expect(await locator.evaluate(el => { const r=el.getBoundingClientRect(), h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return h===el||el.contains(h); })).toBe(true);
}
test('setup fige l’horloge avant navigation et avance seulement sur commande',async({page})=>{
  await setup(page);
  const before=await page.evaluate(()=>({date:Date.now(),ticks:performance.now()}));
  await page.evaluate(()=>{window.setupTimerFired=false;setTimeout(()=>window.setupTimerFired=true,1);});
  expect(await page.evaluate(()=>({date:Date.now(),ticks:performance.now()}))).toEqual(before);
  expect(await page.evaluate(()=>window.setupTimerFired)).toBe(false);
  await page.clock.runFor(32);
  expect(await page.evaluate(()=>({date:Date.now(),ticks:performance.now()}))).toEqual({date:before.date+32,ticks:before.ticks+32});
  expect(await page.evaluate(()=>window.setupTimerFired)).toBe(true);
});
test('entrée v17 explique périodes autonomes et durée active',async({page})=>{
  await setup(page); await expect(page.getByRole('heading',{name:'Cinq ans pour transformer le pays.'})).toBeVisible();
  await expect(page.locator('[data-vdef-time-explanation]')).toContainText('30 périodes de deux mois');
  await expect(page.locator('[data-vdef-time-explanation]')).toContainText('15 minutes');
  await expect(page.locator('[data-vdef-time-explanation]')).toContainText('pauses');
});
test('six pins réels et objectifs restent accessibles pendant un arbitrage',async({page},info)=>{
  await start(page); await expect(page.locator('[data-live-pin]')).toHaveCount(6); await page.screenshot({path:info.outputPath('board.png')});
  for(const id of sectors){await page.clock.runFor(32);const pin=page.locator(`[data-live-pin="${id}"]`);await expect(pin.locator(".pr-pin__label")).toBeVisible();await hit(pin);await pin.click();await expect(page.locator(`[data-strategy-sector="${id}"]`)).toBeVisible();await page.getByRole('button',{name:'Fermer les commandes',exact:true}).click();}
  await page.locator('[data-presidency-front="health"]').click(); await page.clock.runFor(32);
  await hit(page.locator('.pr-strategy-cap'));
  for (const selector of ['.pr-pressure-legend','.pr-calendar strong','.pr-calendar>span']) {
    expect(await page.locator(selector).evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
  }
  if (page.viewportSize().width > 650) {
    const boxes=[];
    for (const id of sectors) { const pin=page.locator(`[data-live-pin="${id}"]`); await hit(pin); const box=await pin.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);boxes.push(box); }
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];expect(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y).toBe(true);}
  }
  await expect(page.locator('.pr-strategy-cap')).toContainText('objectifs actuellement atteints');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const cards=page.locator('[data-strategy-primary] button');
  const a=await cards.nth(0).boundingBox(),b=await cards.nth(1).boundingBox();expect(b.y).toBeGreaterThanOrEqual(a.y+a.height-1);
  await page.screenshot({path:info.outputPath('health-panel.png')});
  await page.locator('[data-presidency-priority="health"]').scrollIntoViewIfNeeded(); await hit(page.locator('[data-presidency-priority="health"]'));
  if (info.project.name.endsWith('landscape')) await page.screenshot({path:info.outputPath('priority-reachable.png')});
});
test('arbitrage nommé affiche engagement charges délai effet et valide une fois',async({page},info)=>{
  await start(page);await page.locator('[data-presidency-front="health"]').click(); await page.clock.runFor(32);
  const card=page.locator('[data-order="s17-health-capacity"]');
  await expect(card.locator('strong').first()).toHaveText('Former et installer des équipes de soins');
  await expect(card.locator('[data-order-cost]')).toContainText('Md€ engagés');
  await expect(card.locator('[data-order-annual]')).toContainText('Md€/an');
  await expect(card.locator('[data-order-delay]')).toContainText('minimum');
  await expect(card.locator('[data-order-effect]')).not.toBeEmpty();
  await expect(card.locator('.pr-command__cta')).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  if(page.viewportSize().height>=740) await hit(card);
  else for(const part of await card.locator('strong, [data-order-cost], [data-order-annual], [data-order-delay], .pr-command__terms, [data-order-effect], .pr-command__cta').all()){await part.scrollIntoViewIfNeeded();await hit(part);}
  for(const text of await card.locator('strong, small, [data-order-cost], [data-order-delay], [data-order-effect]').all()) expect(await text.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
  await page.screenshot({path:info.outputPath('full-order-readable.png')});
  if(page.viewportSize().height>=740) await card.click({position:{x:18,y:18}}); else await card.locator('.pr-command__cta').click();
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).choices,KEY)).toEqual(['s17-health-capacity']);
  await expect(page.locator('[data-presidency]')).toHaveAttribute('data-turn','0');
  await page.screenshot({path:info.outputPath('order-recorded.png')});
});
test('danger critique reste rouge avec chantier en préparation',async({page})=>{
  await load(page,[...Array(15).fill('live-tick'),'s17-health-capacity']);
  for (const id of sectors) await hit(page.locator(`[data-live-pin="${id}"]`));
  const pin=page.locator('[data-live-pin="health"]');await expect(pin).toHaveAttribute('data-severity','critical');await expect(pin).toHaveAttribute('data-working','true');
  const svg=page.locator('[data-strategy-map-sector="health"]');await expect(svg).toHaveAttribute('data-map-severity','critical');await expect(svg).toHaveAttribute('data-map-work','true');
  expect(await svg.evaluate(el=>getComputedStyle(el).getPropertyValue('--state-color').trim())).toBe('#c13d35');
});
test('bilan causal garde les indices du journal et les charges annuelles',async({page},info)=>{
  const input=JSON.parse(await readFile(new URL('../../docs/mandats-strategy-v17/organisation-hybrid-inputs.json',import.meta.url),'utf8'));
  await load(page,input.choices,input.seed);
  await expect(page.locator('[data-strategy-financial-comparison]')).toContainText('Md€');
  const replay=page.locator('[data-causal-receipt] [data-action="branch-replay"]'); expect(await replay.count()).toBeGreaterThan(0);
  for(const button of await replay.all()){const index=Number(await button.getAttribute('data-turn'));expect(input.choices[index]).not.toBe('live-tick');expect(input.choices[index]).toBe(await button.getAttribute('data-source-choice'));}
  await expect(page.locator('[data-causal-receipt]').first()).toContainText('Md€/an');
  await page.screenshot({path:info.outputPath('causal-ending.png')});
  await page.locator('[data-causal-receipt]').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('causal-receipts.png')});
  await page.locator('[data-presidency-panel="ending"] [data-action="export"]').scrollIntoViewIfNeeded();
  await hit(page.locator('[data-presidency-panel="ending"] [data-action="export"]'));
  await page.screenshot({path:info.outputPath('ending-actions.png')});
});

// Failure-first runtime journeys: real import, native storage boundary, and durable
// canonical journal. Expected states are reconstructed by the ordinary engine.
const ARCHIVE='500signatures.mandats.branch-reference.v1';
const rawSave=page=>page.evaluate(key=>localStorage.getItem(key),KEY);
function state(raw, project=false){
  const storage=new URL('../src/mandats/storage.ts',import.meta.url).href;
  const projection=new URL('../src/mandats/presidency-projection.ts',import.meta.url).href;
  return JSON.parse(execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',`import{decode}from${JSON.stringify(storage)};import{projectToNextStop}from${JSON.stringify(projection)};let raw='';for await(const p of process.stdin)raw+=p;const game=decode(raw);process.stdout.write(JSON.stringify(${project?'projectToNextStop(game)':'game'}));`],{input:raw,encoding:'utf8'}));
}
async function bulletin(page){await page.getByRole('button',{name:'Lire le bulletin complet',exact:true}).click();await expect(page.locator('[data-presidency-bulletin]')).toBeVisible();}
const projectButton=page=>page.locator('[data-presidency-panel="bulletin"] [data-action="presidency-project"]');
async function failCanonical(page){await page.evaluate(key=>{const original=Storage.prototype.setItem;window.restoreStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Quota plein','QuotaExceededError');return original.call(this,k,v);};},KEY);}

test('bulletin complet date les nouvelles, garde la pause et rend le focus sans rattrapage',async({page},info)=>{
  await start(page);await page.clock.runFor(5001);const before=await rawSave(page);
  await bulletin(page);await expect(page.getByRole('dialog')).toContainText('Janvier–février');
  await expect(page.getByRole('dialog')).toContainText('simule les périodes, ne donne aucun ordre');
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused','true');
  await page.clock.runFor(120001);expect(await rawSave(page)).toBe(before);
  await page.screenshot({path:info.outputPath('bulletin.png')});
  await page.keyboard.press('Tab');expect(await page.getByRole('dialog').evaluate(el=>el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Lire le bulletin complet',exact:true})).toBeFocused();
  await page.clock.runFor(60001);expect(await rawSave(page)).toBe(before);await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused','true');
});
test('bulletin conserve tous les détails enregistrés sur petit écran',async({page},info)=>{
  await load(page,['s17-health-capacity']);await bulletin(page);
  const details=page.locator('[data-presidency-bulletin] .pr-feed__detail');expect(await details.count()).toBeGreaterThan(0);
  for(const detail of await details.all()){await expect(detail).toBeVisible();await detail.scrollIntoViewIfNeeded();expect(await detail.evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);}
  await page.screenshot({path:info.outputPath('bulletin-details.png')});
});
test('projection atomique équivaut aux périodes ordinaires et ne double pas un geste',async({page},info)=>{
  await load(page,['s17-health-capacity']);const before=await rawSave(page),expected=state(before,true);
  await bulletin(page);await page.evaluate(key=>{window.canonicalWrites=0;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)window.canonicalWrites++;return original.call(this,k,v);};},KEY);
  await projectButton(page).dblclick();expect(state(await rawSave(page))).toEqual(expected.game);expect(await page.evaluate(()=>window.canonicalWrites)).toBe(1);
  await expect(page.locator('[data-live-feedback]')).toContainText(`${expected.periods} période`);
  await expect(page.getByRole('dialog').locator('[data-projection-feedback]')).toBeVisible();
  await expect(page.getByRole('dialog').locator('[data-projection-feedback]')).toContainText(`${expected.periods} période`);
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused','true');
  await page.clock.runFor(60001);expect(state(await rawSave(page))).toEqual(expected.game);
  await page.screenshot({path:info.outputPath('projection-durable.png')});
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Ma partie',exact:true}).click();
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Exporter la sauvegarde',exact:true}).click();
  const exported=await readFile(await(await downloading).path(),'utf8');expect(state(exported)).toEqual(expected.game);
  await page.locator('input[type="file"]').setInputFiles({name:'projected.json',mimeType:'application/json',buffer:Buffer.from(exported)});
  expect(state(await rawSave(page))).toEqual(expected.game);
});
test('commande Avancer directe arrête une horloge active et ignore la répétition clavier et un onglet masqué',async({page},info)=>{
  await start(page);await page.clock.runFor(10001);const before=await rawSave(page),expected=state(before,true);
  const button=page.locator('.pr-strategy-controls [data-action="presidency-project"]');await hit(button);
  expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await button.focus();await page.keyboard.press('Enter');await page.keyboard.press('Enter');
  expect(state(await rawSave(page))).toEqual(expected.game);await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused','true');
  await expect(page.locator('.pr-strategy-controls [data-action="presidency-project"]')).toBeFocused();
  await page.clock.runFor(601);const durable=await rawSave(page);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));document.querySelector('.pr-strategy-controls [data-action="presidency-project"]').click();});
  expect(await rawSave(page)).toBe(durable);await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await expect(button).toBeEnabled();
  await page.screenshot({path:info.outputPath('observation-directe.png')});
});
// A held key can repeat after the pointer gesture hold has elapsed. These are
// real native keydowns: no keyup between the initial Enter and its repetition.
for (const key of ['Enter', 'Space']) for (const surface of ['directe', 'bulletin']) {
  test(`maintien ${key==='Enter' ? 'Entrée' : 'Espace'} sur Avancer ${surface} ne rejoue pas après le verrou puis accepte une nouvelle frappe`,async({page})=>{
    await load(page,['s17-health-capacity']);
    if(surface==='bulletin') await bulletin(page);
    const button=surface==='bulletin' ? projectButton(page) : page.locator('.pr-strategy-controls [data-action="presidency-project"]');
    const expected=state(await rawSave(page),true);
    await button.focus();await page.keyboard.down(key);
    await page.clock.runFor(650);
    await page.keyboard.down(key); // event.repeat=true; the same key is held.
    await page.keyboard.up(key);
    expect(state(await rawSave(page))).toEqual(expected.game);
    if(surface==='directe') await expect(button).toBeFocused();
    else await expect(page.locator('[data-presidency-panel="bulletin"] h2')).toBeFocused();
    // Space activates on keyup, so its original pointer hold begins only now.
    if(key==='Space') await page.clock.runFor(650);
    const next=state(await rawSave(page),true);
    // Focus is returned by the player after reading the bulletin's new result.
    await button.focus();await page.keyboard.press(key);
    expect(state(await rawSave(page))).toEqual(next.game);
  });
}
test('doubleclic Avancer reste unique même après expiration du verrou et permet le clic suivant',async({page})=>{
  await load(page,['s17-health-capacity']);const button=page.locator('.pr-strategy-controls [data-action="presidency-project"]');
  const expected=state(await rawSave(page),true);await button.click();await page.clock.runFor(650);
  const box=await button.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  // mouse.down/up carry the browser's second-click detail directly. Locator
  // click({clickCount:2}) would generate a fresh complete pair of clicks.
  await page.mouse.down({clickCount:2});await page.mouse.up({clickCount:2});
  expect(state(await rawSave(page))).toEqual(expected.game);
  const next=state(await rawSave(page),true);await button.click();expect(state(await rawSave(page))).toEqual(next.game);
});
test('ordre ordinaire libère les contrôles du temps et de projection après sauvegarde',async({page})=>{
  await start(page);await page.locator('[data-presidency-front="health"]').click();await page.clock.runFor(32);
  const command=page.locator('[data-order="s17-health-capacity"]');await command.scrollIntoViewIfNeeded();await command.click();
  await expect(page.locator('[data-action="presidency-pause"]')).toBeEnabled();
  await expect(page.locator('.pr-strategy-controls [data-action="presidency-project"]')).toBeEnabled();
});
test('projection atteint la livraison présidentielle puis la clôture annuelle sans ordre ajouté',async({page})=>{
  await load(page,['s17-health-capacity']);let before=state(await rawSave(page));
  await bulletin(page);
  for(let i=0;i<8;i++){
    const expected=state(await rawSave(page),true);await projectButton(page).click();
    const after=state(await rawSave(page));expect(after).toEqual(expected.game);expect(after.choices.filter(id=>id!=='live-tick')).toEqual(before.choices.filter(id=>id!=='live-tick'));
    if(expected.stop==='annual-close'){expect(after.turn).toBe(6);break;}
    await page.clock.runFor(601);
  }
  const after=state(await rawSave(page));expect(after.turn).toBe(6);expect(after.pressure.programmes.some(p=>p.sourceChoice==='s17-health-capacity'&&p.deliveredTurn!==undefined)).toBe(true);
});
test('projection finale montre le bilan et son reçu puis retire la commande',async({page},info)=>{
  await load(page,Array(29).fill('live-tick'));
  await page.locator('.pr-strategy-controls [data-action="presidency-project"]').click();
  await expect(page.locator('[data-presidency]')).toHaveAttribute('data-turn','30');
  const ending=page.locator('[data-presidency-panel="ending"]');await expect(ending).toBeVisible();
  await page.screenshot({path:info.outputPath('projection-ending.png')});
  await expect(ending.locator('[data-projection-feedback]')).toBeVisible();await expect(ending.locator('[data-projection-feedback]')).toContainText('fin du mandat');
  await expect(page.getByRole('button',{name:'Avancer jusqu’au prochain changement',exact:true})).toHaveCount(0);
});
test('quota de projection conserve pays durable, progrès et pause',async({page})=>{
  await start(page);await page.clock.runFor(10001);await bulletin(page);const before=await rawSave(page),progress=await page.locator('[data-live-progress]').getAttribute('style');
  await failCanonical(page);await projectButton(page).click();expect(await rawSave(page)).toBe(before);await expect(page.locator('[data-presidency]')).toHaveAttribute('data-turn','0');
  expect(await page.locator('[data-live-progress]').getAttribute('style')).toBe(progress);await expect(page.locator('[data-live-feedback]')).toHaveAttribute('data-failure','true');
  await expect(page.getByRole('dialog').locator('[data-projection-feedback]')).toBeVisible();
  await page.clock.runFor(60001);expect(await rawSave(page)).toBe(before);await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused','true');
});
test('aperçu partagé refuse la projection avant adoption sans changer la partie privée',async({page})=>{
  await load(page,['s17-health-capacity']);const before=await rawSave(page);
  await page.goto('/mandats/?mode=national&v=17&seed=7&ambition=equilibre');await page.clock.runFor(32);await bulletin(page);
  await expect(projectButton(page)).toHaveCount(0);await page.clock.runFor(120001);expect(await rawSave(page)).toBe(before);
});
test('rejeu causal direct archive le mandat et revient au véritable indice du journal',async({page},info)=>{
  const input=JSON.parse(await readFile(new URL('../../docs/mandats-strategy-v17/organisation-hybrid-inputs.json',import.meta.url),'utf8'));
  await load(page,input.choices,input.seed);const before=await rawSave(page),original=state(before);
  const button=page.locator('[data-causal-receipt] [data-action="branch-replay"]').first();const index=Number(await button.getAttribute('data-turn'));expect(original.choices[index]).not.toBe('live-tick');await button.scrollIntoViewIfNeeded();await button.click();
  expect(state(await rawSave(page)).choices).toEqual(original.choices.slice(0,index));expect(state(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),ARCHIVE)).game)).toEqual(original);
  await page.screenshot({path:info.outputPath('replay-archive.png')});
});
test('échec du rejeu causal direct restaure archive et pays visibles',async({page})=>{
  const input=JSON.parse(await readFile(new URL('../../docs/mandats-strategy-v17/organisation-hybrid-inputs.json',import.meta.url),'utf8'));
  await load(page,input.choices,input.seed);const before=await rawSave(page),archive=await page.evaluate(k=>localStorage.getItem(k),ARCHIVE);
  await failCanonical(page);const button=page.locator('[data-causal-receipt] [data-action="branch-replay"]').first();await button.scrollIntoViewIfNeeded();await button.click();
  expect(await rawSave(page)).toBe(before);expect(await page.evaluate(k=>localStorage.getItem(k),ARCHIVE)).toBe(archive);await expect(page.locator('[data-presidency-panel="ending"]')).toBeVisible();
});

test('reprise distingue une période autonome et un ordre présidentiel',async({page})=>{
  await load(page,['live-tick','s17-health-capacity']); await page.goto('/mandats/');
  await expect(page.locator('.map-entry__saved')).toContainText('1 période écoulée · 1 ordre · règles v17');
});

// Original human-selected journal, replayed only for reproducible regressions.
async function playerInput(before, occurrence=0) {
 const input=JSON.parse(await readFile(new URL('../../docs/mandats/essai-joueur-2026-10-20/partie-jouee-v17.json',import.meta.url),'utf8'));
 let seen=0; const index=input.choices.findIndex(id=>id===before&&seen++===occurrence);
 return input.choices.slice(0,index);
}
async function noBoardCollisions(page) {
 const boxes=await page.locator('.pr-sector-pin:visible,.pr-board-pin:visible,[data-live-fan]:not([hidden])').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {name:el.getAttribute('aria-label')||el.dataset.pinKey||'panneau',x:r.x,y:r.y,width:r.width,height:r.height};}));
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++) { const a=boxes[i],b=boxes[j]; expect(a.x+a.width<=b.x+1||b.x+b.width<=a.x+1||a.y+a.height<=b.y+1||b.y+b.height<=a.y+1,`${page.viewportSize().width}×${page.viewportSize().height} : ${a.name} recouvre ${b.name}`).toBe(true); }
 for(const pin of await page.locator('.pr-sector-pin:visible,.pr-board-pin:visible').all()) await hit(pin);
}
test('régression joueur612 rectangles réels séparés avec événements et panneau',async({page})=>{
 await load(page,await playerInput('live-credits',1),612);
 for(const [width,height] of [[1280,720],[1024,768],[844,390],[390,844],[320,568]]) {
  await page.setViewportSize({width,height});
  // WebKit can deliver the resize after the clock’s first queued frame. Wait
  // for a measured layout of this viewport, then assert the actual rectangles.
  await expect.poll(async()=>{await page.clock.runFor(32);return page.evaluate(()=>{const host=document.querySelector('[data-presidency]'),r=host.querySelector('.pr-country').getBoundingClientRect();return host.dataset.pinLayoutViewport===`${Math.round(r.width)}x${Math.round(r.height)}`;});}).toBe(true);
  await expect(page.locator('.pr-sector-pin:visible')).toHaveCount(6); await noBoardCollisions(page);
  await expect(page.locator('.pr-strategy-cap>strong')).toBeVisible(); await expect(page.locator('.pr-strategy-cap>strong')).toContainText('39,93');
  await page.locator('[data-live-pin="health"]').click(); await page.clock.runFor(64); await noBoardCollisions(page);
  await page.locator('[data-live-pin="housing"]').click(); await page.clock.runFor(64); await expect(page.locator('[data-strategy-sector="housing"]')).toBeVisible(); await noBoardCollisions(page);
  await page.getByRole('button',{name:'Fermer les commandes',exact:true}).click(); await page.clock.runFor(64);
  await expect(page.locator('.pr-sectors')).toBeVisible(); await noBoardCollisions(page);
 }
});
test('régression joueur612 risque objectif et vote dans leur contexte rendu',async({page})=>{
 await load(page,await playerInput('s17-housing-network'),612);
 await page.locator('[data-live-pin="housing"]').click();
 await expect(page.locator('[data-strategy-sector="housing"]')).toContainText('limite opérationnelle');
 await expect(page.locator('[data-strategy-sector="housing"]')).not.toContainText('dispose d’une marge');
 await page.getByRole('button',{name:'Fermer les commandes',exact:true}).click();
});
test('régression joueur612 vote immédiatement dans les réformes',async({page})=>{
 await load(page,await playerInput('r21a'),612);
 await page.locator('[data-panel="reforms"]').click();
 await page.locator('[data-live-reform]').filter({has:page.locator('[data-order="r21a"]')}).locator(':scope > summary').click();
 await page.locator('[data-order="r21a"]').click();
 await expect(page.locator('[data-presidency-panel="reforms"] [data-live-vote]')).toContainText('249 pour');
 await expect(page.locator('[data-presidency-panel="reforms"] [data-live-vote]')).toContainText('286 contre');
 await expect(page.locator('[data-presidency-panel="reforms"] [data-live-vote]')).toBeInViewport();
});
