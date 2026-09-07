import { projects } from './world.ts';
import { cardModel } from './cards.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { start, choicesFor, decide, domainFor, score } from './engine.ts';
import { NATIONAL_CATALOGUE } from './national-branches.ts';
import { annualDeficit } from './national-deficit.ts';
import { encode, decode } from './storage.ts';
import { challengeURL, challengeFromURL, resultURL, sharedResult } from './sharing.ts';
import { projectPlan, planner } from './planner.ts';
import { societyPanel } from './render.ts';

const begin=(seed=42)=>start('national',seed,'equilibre',7);
const next=(g:ReturnType<typeof begin>,rank=0)=>decide(g,choicesFor(g)[rank].id);
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('70 unique dossiers have unique choice IDs and a forty-five decision route',()=>{
 assert.equal(NATIONAL_CATALOGUE.length,70);
 assert.equal(new Set(NATIONAL_CATALOGUE.map(d=>d.title)).size,70);
 const ids=NATIONAL_CATALOGUE.flatMap(d=>d.choices.map(c=>c.id));
 assert.equal(new Set(ids).size,210);
 assert.equal(domainFor(begin()).dossiers.length,45);
});
test('a committed reform changes the next dossier and illegal branches cannot be imported',()=>{
 const g=begin(), cut=next(g), tax=next(g,1);
 assert.notEqual(domainFor(cut).dossiers[1].title,domainFor(tax).dossiers[1].title);
 assert.match(domainFor(cut).dossiers[1].story,/Réduire les pensions/);
 assert.throws(()=>decide(tax,choicesFor(cut)[0].id),/dossier/);
 const forged=JSON.parse(encode(tax));forged.choices.push(choicesFor(cut)[0].id);
 assert.throws(()=>decode(JSON.stringify(forged)),/dossier/);
 assert.notDeepEqual(cut.society,tax.society);
 assert.match(societyPanel(cut),/Retraités/);
});
test('withdrawal restores the inflated saving exactly across an annual boundary',()=>{
 let g=begin();while(g.turn<8)g=next(g,2);
 const cut=next(g), undo=next(cut,2);
 close(undo.finance.operating,g.finance.operating*1.018);
 assert.equal(undo.history.at(-1)!.year,2);
});
test('a proposal on residence yields no saving before its conditional implementation',()=>{
 let g=begin();while(g.turn<12)g=next(g,2);
 const before=g.finance.operating;
 g=next(g);close(g.finance.operating,before);
 assert.equal(g.pending.length,0);
 assert.equal(projects(g).length,0);
 g=next(g);close(g.finance.operating,before+.5);
 assert.ok(g.pending.some(p=>p.effect.operating===-2));
 assert.match(JSON.stringify(cardModel(g,'decision')),/Mise en œuvre/);
 assert.doesNotMatch(JSON.stringify(cardModel(g,'decision')),/Livraison/);
 const saved=encode(g); assert.deepEqual(decode(saved),g);
 while(g.turn<18)g=next(g,2);
 const closing=g.finance.operating;g=next(g,2);
 close(g.finance.operating,closing*1.018-2+2);
 assert.equal(g.society!.newcomers,52);
});
test('three distinct strict strategies reach balance for every annual crisis seed',()=>{
 for(let seed=0;seed<12;seed++){
  const outcomes=[];
  for(const strategy of ['cuts','tax','mixed'] as const){
   let g=begin(seed);
   while(g.turn<45){
    const rank=strategy==='cuts'?0:strategy==='tax'?1:g.turn%4<2?0:1;
    g=next(g,rank);
    if(g.turn%9===0)assert.deepEqual(decode(encode(g)),g);
   }
   assert.ok(annualDeficit(g)<=0,`${strategy} seed ${seed}: ${annualDeficit(g)}`);
   assert.equal(g.history.filter(h=>h.closed).length,5);
   assert.equal(new Set(g.choices.map(id=>NATIONAL_CATALOGUE.findIndex(d=>d.choices.some(c=>c.id===id)))).size,45);
   assert.ok(Number.isFinite(score(g).total));
   outcomes.push(g);
  }
  assert.notDeepEqual(outcomes[0].choices,outcomes[1].choices);
  assert.notDeepEqual(outcomes[0].society,outcomes[1].society);
 }
});
test('support paths retain different final dossiers, budgets and material conditions',()=>{
 let strict=begin(),support=begin();
 while(strict.turn<45){strict=next(strict);support=next(support,2);}
 assert.notDeepEqual(strict.choices.slice(40).map(id=>id.slice(0,-1)),support.choices.slice(40).map(id=>id.slice(0,-1)));
 assert.ok(annualDeficit(support)>153);
 assert.ok(strict.history.some(t=>t.messages.some(m=>m.startsWith('Précarité :'))));
 assert.ok(strict.society!.vulnerable<support.society!.vulnerable);
 assert.deepEqual(sharedResult(new URL(resultURL(strict,'https://example.org')).hash),strict);
 assert.equal(challengeFromURL(new URL(challengeURL(strict,'https://example.org')))!.version,7);
 const alternative=projectPlan(strict,support.choices);
 assert.deepEqual(alternative.game,support);
 assert.match(planner(strict,support.choices),/s0ca/);
 assert.doesNotMatch(planner(strict,[]),/Dossier 2 · Retraites/);
});
test('all seventy dossiers are reachable and replay remains deterministic across interleaved games',()=>{
 const visited=new Set<string>();
 for(const rank of [0,1,2]){
  let g=begin();
  while(g.turn<45){visited.add(domainFor(g).dossiers[g.turn].title);g=next(g,rank);}
  assert.deepEqual(decode(encode(g)),g);
 }
 assert.equal(visited.size,70);
});
