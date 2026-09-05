import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { start, choicesFor, preview, calendarFor, startingGame, replayGame } from './engine.ts';
import { gameShell, finance, mandateSetup, selection, territory, trajectory } from './render.ts';
import { planner, projectPlan } from './planner.ts';
import { world } from './world.ts';
import { loadCity } from './cities.ts';
import { challengeFromURL, challengeURL, escape } from './sharing.ts';
import type { Game, Mode } from './types.ts';
function advance(game: Game): Game {
  const candidates = choicesFor(game).map(c => preview(game,c.id).game).filter((g):g is Game=>!!g);
  assert.ok(candidates.length, `Recovery at dossier ${game.turn+1}`);
  const burden=(g:Game)=>g.finance.operating+g.finance.investment+g.finance.repayment-g.finance.revenue-g.finance.grants;
  return candidates.sort((a,b)=>burden(a)-burden(b))[0];
}
const count=(html:string, pattern:RegExp)=>[...html.matchAll(pattern)].length;
for(const mode of ['municipal','national'] as Mode[]) test(`v3 ${mode}: 45 positions, annual timeline, direct choices, grouped journal and plan`,()=>{
  let game=start(mode,42,'equilibre',3); const years=mode==='municipal'?6:5;
  for(let dossier=1;dossier<=45;dossier++){
    const calendar=calendarFor(game),html=gameShell(game,'play','decision');
    const timeline=html.match(/<ol class="mandate-timeline"[^>]*>(.*?)<\/ol>/s)?.[1]; assert.ok(timeline);
    assert.equal(count(timeline,/<li\b/g),years,'No 45-dot timeline');
    assert.match(html,new RegExp(`Dossier ${calendar.slot}/${calendar.slots} de l’année · ${dossier}/45 du mandat`));
    assert.equal(count(html,/data-action="choose"/g),3); assert.doesNotMatch(html,/data-action="confirm-choice"/);
    if(game.turn)assert.match(html,new RegExp(game.history.at(-1)!.closed?`Année ${game.history.at(-1)!.year} terminée`:`Décision ${game.turn} prise`));
    game=advance(game);
  }
  const complete=gameShell(game,'result','decision');
  assert.equal(count(complete,/data-action="choose"/g),0);assert.match(complete,/Partager mon héritage/);assert.match(complete,/45\/45/);
  const journal=gameShell(game,'play','journal');
  assert.equal(count(journal,/class="journal-year"/g),years);assert.equal(count(journal,/class="journal-year" open/g),1);
  for(const entry of game.history)assert.ok(journal.includes(escape(entry.title)),entry.title);
  const plan=planner(game,game.choices);
  assert.equal(count(plan,/class="plan-year"/g),years);assert.equal(count(plan,/data-plan-year=/g),45);
  assert.equal(count(plan,/class="plan-year" open/g),1,'Only the current planning year opens');
  assert.deepEqual(projectPlan(game,game.choices).game,game);
});
test('v3 accounts distinguish in-year forecasts from annual settlements',()=>{
  let game=advance(start('municipal',42,'equilibre',3));
  assert.match(finance(game),/Prévision de l’année 1/);assert.match(finance(game),/comptes seront arrêtés/);
  assert.equal(count(trajectory(game).match(/points="([^"]+)"/)![1],/,/g),1,'No forecast debt plotted as settled');
  for(let i=1;i<8;i++)game=advance(game);
  assert.doesNotMatch(finance(game),/class="finance-status"/);
  assert.equal(count(trajectory(game).match(/points="([^"]+)"/)![1],/,/g),2,'Initial debt and one settled year');
  assert.equal(count(gameShell(game,'play','journal'),/class="journal-year"/g),1);
  game=advance(game);assert.match(finance(game),/Prévision de l’année 2/);
  assert.equal(count(gameShell(game,'play','journal'),/class="journal-year"/g),2);
});
test('v3 observed city, actual-map hosts and snapshot challenges work without network replay',async t=>{
  const fixture=JSON.parse(readFileSync(new URL('../../tests/fixtures/editorial-publication.json',import.meta.url),'utf8'));
  const original=globalThis.fetch;
  globalThis.fetch=(async(input:string|URL|Request)=>{
    const url=String(input);
    if(url.includes('geo.api.gouv.fr'))return Response.json({centre:{type:'Point',coordinates:[-0.58,44.84]}});
    if(url.endsWith('/derniere.json'))return Response.json({version:fixture.publication});
    if(url.endsWith('/index.json'))return Response.json(fixture.index_commune);
    if(url.endsWith('/manifeste.json'))return Response.json({jeux:fixture.jeux});
    if(url.endsWith('/territoires/commune/33.json'))return Response.json(fixture.communes);
    throw new Error(`Unexpected request ${url}`);
  }) as typeof fetch;
  t.after(()=>{globalThis.fetch=original;});
  const city=await loadCity('33063'),initial=start('municipal',61,'services',3,city),setup=mandateSetup(initial);
  assert.match(setup,/Bordeaux/);assert.match(setup,/Recettes de fonctionnement observées/);assert.match(setup,/COMPTES 2025/);
  for(const id of ['city-query','city-results'])assert.match(setup,new RegExp(`id="${id}"`));
  assert.match(setup,/data-action="fictional-city"/);assert.doesNotMatch(setup,/Val-sur-Rive|city-inherited|campaign-city-model/);
  const scenery=world(initial);
  assert.equal(count(scenery,/data-city-map="33063"/g),1);assert.match(scenery,/COMPTES OBSERVÉS · 2025/);assert.match(scenery,/<progress/);
  assert.doesNotMatch(scenery,/city-model|building-height|world-pin|<img|<picture/);
  const area=territory(initial);assert.equal(count(area,/data-city-map="33063"/g),1);assert.doesNotMatch(area,/id="city-map-host"/);
  assert.match(area,/pas un diagnostic observé des quartiers réels/);
  const noCenter=structuredClone(initial);noCenter.city={...city,center:null};
  assert.doesNotMatch(world(noCenter),/data-city-map=/);assert.match(world(noCenter),/Coordonnées cartographiques indisponibles/);
  globalThis.fetch=(async()=>{throw new Error('Offline: no network allowed');}) as typeof fetch;
  let played=initial;for(let i=0;i<10;i++)played=advance(played);
  const link=new URL(challengeURL(played,'https://example.org'));
  assert.equal(link.search,'','Snapshot remains in fragment');assert.match(link.hash,/^#challenge=/);
  assert.deepEqual(challengeFromURL(link),initial,'Challenge preserves observed baseline but drops previous choices');
  assert.deepEqual(startingGame(played),initial);assert.deepEqual(replayGame(played,played.choices),played);
  assert.deepEqual(projectPlan(played,played.choices).game,played);assert.match(selection(played),/Bordeaux/);
  assert.doesNotMatch(readFileSync(new URL('./campaign.css',import.meta.url),'utf8'),/city-model-grid|city-model-block|building-height|rotateX/);
});
