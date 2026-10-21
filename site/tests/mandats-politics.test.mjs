import {test,expect} from '@playwright/test';

async function activate(locator,info){if(info.project.use.hasTouch) await locator.tap(); else await locator.click();}

async function start(page, reducedMotion=false){
 if(reducedMotion) await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/mandats/?mode=national&v=10&seed=42&ambition=equilibre');
 await expect(page.locator('.political-hud')).toBeVisible();
 await expect(page.locator('.mandate-board [data-action="choose"]:not([disabled])').first()).toBeVisible();
}

async function castFirstVote(page,info,{clockPaused=false}={}){
 await activate(page.locator('.mandate-board [data-action="choose"]:not([disabled])').first(),info);
 if(clockPaused) await page.clock.runFor(111);
 const vote=page.locator('[data-political-vote]');
 await expect(vote).toBeVisible();
 const storedRaw=await page.evaluate(()=>localStorage.getItem('500signatures.mandats.v1'));
 const stored=JSON.parse(storedRaw);
 expect(stored.version).toBe(10);
 expect(stored.choices).toHaveLength(1);
 const record={id:await vote.getAttribute('data-vote-id'),title:await vote.locator('h2').innerText()};
 expect(await vote.locator('.vote-seat').count()).toBe(577);
 if(clockPaused){
  await expect(vote.locator('[data-political-action="continue"]')).toBeDisabled();
  expect(await vote.locator('.vote-seat[data-revealed="true"]').count()).toBeLessThan(577);
 }
 const reveal=vote.locator('[data-political-action="show-result"]');
 const proceed=vote.locator('[data-political-action="continue"]');
 // A real-time vote may already have finished while its saved record is read.
 await expect.poll(async()=>await proceed.isEnabled()||await reveal.isVisible()).toBe(true);
 if(!await proceed.isEnabled()) await activate(reveal,info);
 await expect(proceed).toBeEnabled();
 await expect(reveal).toBeHidden();
 await expect(vote).toHaveAttribute('data-vote-id',record.id);
 await expect(vote.locator('.vote-seat[data-revealed="true"]')).toHaveCount(577);
 const statuses=['for','against','abstain'];
 const tally=await Promise.all(statuses.map(async key=>await vote.locator(`[data-tally="${key}"]`).innerText()));
 const seats=await Promise.all(statuses.map(async key=>await vote.locator(`.vote-seat[data-vote="${key}"]`).count()));
 expect(tally.map(value=>Number(value.replaceAll(/\D/g,'')))).toEqual(seats);
 expect(tally.reduce((total,value)=>total+Number(value.replaceAll(/\D/g,'')),0)).toBe(577);
 expect(await page.evaluate(()=>localStorage.getItem('500signatures.mandats.v1'))).toBe(storedRaw);
 record.verdict=await vote.locator('[data-vote-verdict]').innerText();
 record.tally=tally;
 await expect(vote.locator('[data-political-action="continue"]')).toBeEnabled();
 await activate(vote.locator('[data-political-action="continue"]'),info);
 await expect(page.locator('.mandate-board')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('500signatures.mandats.v1'))).toBe(storedRaw);
 return record;
}

test('a fresh national game defaults to the strategic v17 presidency',async({page},info)=>{
 await page.goto('/mandats/');
 await activate(page.getByRole('button',{name:/Commencer un mandat/}),info);
 await expect(page.locator('section[data-presidency]')).toBeVisible();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')));
 expect(saved.version).toBe(17);
 expect(saved.choices).toEqual([]);
});

test('v10 saves the actual 577-seat tally before animation and reload never counts it twice',async({page},info)=>{
 await start(page);
 const savedVote=await castFirstVote(page,info);
 const beforeRaw=await page.evaluate(()=>localStorage.getItem('500signatures.mandats.v1'));
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')));
 await page.reload();
 await page.getByRole('button',{name:'Reprendre',exact:true}).click();
 await expect(page.locator('.political-hud')).toBeVisible();
 await expect(page.locator('[data-political-vote]')).toHaveCount(0);
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')));
 expect(after.choices).toEqual(before.choices);
 expect(after.choices).toHaveLength(1);
 expect(await page.evaluate(()=>localStorage.getItem('500signatures.mandats.v1'))).toBe(beforeRaw);
 await page.locator('.political-hud__details > summary').click();
 await expect(page.locator('.political-hud__last-vote')).toBeVisible();
 expect(await page.locator('.political-hud__last-vote').innerText()).toContain('Adopté');
 await expect(page.locator('.political-hud__last-vote')).toContainText(savedVote.title);
 for(const [index,label] of ['pour','contre','abstentions'].entries()){
  await expect(page.locator('.political-hud__last-vote')).toContainText(`${savedVote.tally[index]} ${label}`);
 }
 expect(savedVote.id).toBeTruthy();
});

test('v10 reveals the saved vote before the natural animation finishes',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 // One public call installs and pauses the clock before any application timer.
 await page.clock.pauseAt(Date.now());
 await start(page);
 await castFirstVote(page,info,{clockPaused:true});
});

test('reduced motion presents the same saved vote outcome and changes no game state',async({page,browser},info)=>{
 await start(page,true);
 const reduced=await castFirstVote(page,info);
 const savedReduced=await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')));
 const context=await browser.newContext({baseURL:new URL(page.url()).origin,viewport:{width:390,height:844},hasTouch:!!info.project.use.hasTouch,isMobile:!!info.project.use.isMobile,reducedMotion:'no-preference'});
 const other=await context.newPage();
 await start(other,false);
 const regular=await castFirstVote(other,info);
 expect(regular).toEqual(reduced);
 const savedRegular=await other.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')));
 expect(savedRegular.choices).toEqual(savedReduced.choices);
 expect(regular).toEqual(reduced);
 await context.close();
});

test('an explicit v9 challenge remains on the frozen legacy journey',async({page})=>{
 await page.goto('/mandats/?mode=national&v=9&seed=42&ambition=equilibre');
 await expect(page.locator('.mandate-board')).toBeVisible();
 await expect(page.locator('.political-hud')).toHaveCount(0);
 await expect(page.locator('.campaign-position')).toContainText('Année 1 · décision 1/6');
});

test('an early destitution save opens the full result and restores the same ended mandate',async({page})=>{
 const choices=['pol-wealth-hospital-package','pol-coalition-compromise','r01c','r02c','r03c','r04c','u01c','r05c','r06c','r07c','r08c','u00c',
  'pol-scandal-cover-up','pol-scandal-cover-up','pol-scandal-cover-up','pol-scandal-cover-up','pol-scandal-publish','pol-censure-vote','pol-destitution-vote'];
 const save={version:10,mode:'national',seed:27,ambition:'equilibre',choices};
 await page.addInitScript(value=>localStorage.setItem('500signatures.mandats.v1',JSON.stringify(value)),save);
 await page.goto('/mandats/');
 const resume=page.getByRole('button',{name:'Reprendre',exact:true});
 await expect(resume).toBeVisible();
 await resume.click();
 const ending=page.locator('.political-ending');
 await expect(ending).toBeVisible();
 await expect(ending).toContainText('Destitution');
 await expect(ending).toContainText('La Haute Cour');
 await expect(page.locator('.mandate-board [data-action="choose"]')).toHaveCount(0);
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')));
 expect(stored.choices).toEqual(choices);
 await ending.locator('[data-action="open-replay-selection"]').click();
 await expect(page.locator('.replay-selection')).toBeVisible();
 const branch=page.locator('.replay-card[data-action="branch-replay"][data-turn="18"]');
 await expect(branch).toBeVisible();
 await branch.click();
 await expect(page.locator('.mandate-board')).toBeVisible();
 await expect(page.locator('[data-action="choose"][data-choice="pol-destitution-transition"]')).toBeVisible();
 await page.locator('[data-action="choose"][data-choice="pol-destitution-transition"]').click();
 await expect(page.locator('.political-ending')).toContainText('Transition');
 const restore=page.locator('.trajectory-comparison [data-action="restore-origin"]');
 await expect(restore).toBeVisible();
 await restore.click();
 await expect(page.locator('.political-ending')).toContainText('Destitution');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')))).toEqual(stored);
 await page.reload();
 await page.getByRole('button',{name:'Reprendre',exact:true}).click();
 await expect(page.locator('.political-ending')).toContainText('Destitution');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('500signatures.mandats.v1')).choices)).toEqual(choices);
});

