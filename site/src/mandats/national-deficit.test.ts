import test from 'node:test';
import assert from 'node:assert/strict';
import { start, decide, choicesFor, domainFor } from './engine.ts';
import { annualDeficit } from './national-deficit.ts';
import { nationalBudget } from './national.ts';
import { nationalCommandPulse, nationalDecisionImpact } from './national-command.ts';
import { finance, result, pulse } from './render.ts';
import { encode, decode } from './storage.ts';
import { challengeURL, challengeFromURL, resultURL, sharedResult } from './sharing.ts';
const close = (a:number,b:number) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
const initial = () => start('national',42,'equilibre',6);
const cut = (g: ReturnType<typeof initial>) => decide(g, choicesFor(g).find(c=>(c.effect.operating??0)<0 && (c.effect.revenue??0)>=0)!.id);
test('v6 starts at 153 and immediately accounts for tax and spending decisions',()=>{
 const g=initial();
 close(annualDeficit(g),153); close(domainFor(g).sustainability(g),50);
 close(annualDeficit(cut(g)),152); close(annualDeficit(cut(cut(g))),150);
 close(annualDeficit(decide(g,'n01a')),149); close(annualDeficit(decide(g,'n01b')),156);
 assert.match(nationalCommandPulse(g),/153 <small>Md€/);
 assert.doesNotMatch(nationalCommandPulse(g),/Dette/);
 assert.match(finance(g),/Insee, publication du 29 mai 2026/);
 assert.deepEqual(nationalDecisionImpact(cut(g))[0],{label:'Déficit −1 Md€ cette année',direction:'up'});
});
test('annual closure shows the closed ledger and deferred receipts wait for their year',()=>{
 let g=initial(); while(g.turn<9)g=cut(g);
 const closed=g.history.at(-1)!;
 assert.equal(closed.closed,true);
 close(annualDeficit(g),closed.ledger.deficit);
 assert.notEqual(annualDeficit(g),nationalBudget(g.finance).deficit);
 assert.match(nationalCommandPulse(g),/Année 1 clôturée/);
 let control=decide(g,'n10a'), comparison=decide(g,'n10c');
 close(control.finance.revenue,comparison.finance.revenue);
 assert.deepEqual(nationalDecisionImpact(control)[0],{label:'Déficit +0,5 Md€ cette année',direction:'down'});
 assert.ok(nationalDecisionImpact(control).some(i=>i.label==='Recette prévue · année 3'));
 assert.deepEqual(nationalDecisionImpact(decide(g,'n10b'))[0],{label:'Déficit +0,6 Md€ cette année',direction:'down'});
 while(control.turn<18){control=cut(control);comparison=cut(comparison);}
 close(control.finance.revenue,comparison.finance.revenue);
 control=cut(control);comparison=cut(comparison);
 close(control.finance.revenue-comparison.finance.revenue,2);
 assert.match(nationalCommandPulse(control),/Année 3 · budget prévu/);
});
test('v6 full campaign is replayable and its final balance measures annual deficit',()=>{
 let g=initial();
 while(g.turn<45){g=cut(g);if(g.turn%9===0)assert.deepEqual(decode(encode(g)),g);}
 assert.equal(g.history.filter(h=>h.closed).length,5);
 assert.deepEqual(sharedResult(new URL(resultURL(g,'https://example.org')).hash),g);
 assert.equal(challengeFromURL(new URL(challengeURL(g,'https://example.org')))!.version,6);
 assert.match(result(g),/Déficit de départ : 153 Md€/); assert.match(result(g),/du solde annuel/);
 const zero=initial(); zero.finance.operating-=153;
 close(annualDeficit(zero),0); close(domainFor(zero).sustainability(zero),100);
 assert.match(result(zero),/Équilibre atteint/);
 zero.finance.operating-=10;
 assert.match(nationalCommandPulse(zero),/Excédent annuel/);
 assert.match(result(zero),/Excédent annuel en fin de mandat : <strong>10 Md€/);
});
test('v5 retains its historical deficit and first-year interest rule',()=>{
 const old=start('national',42,'equilibre',5);
 close(annualDeficit(old),107.6); close(annualDeficit(decide(old,'n01a')),114.48);
 const played=cut(initial());
 assert.deepEqual(decode(encode(old)),old); assert.deepEqual(decode(encode(played)),played);
 assert.throws(()=>start('municipal',42,'equilibre',6),/national/);
});

test('legacy national games retain their debt presentation and historical objective',()=>{
 for(const version of [1,2,3,4,5] as const){
  const g=start('national',42,'equilibre',version);
  assert.match(nationalCommandPulse(g),/Dette publique/);
  assert.doesNotMatch(nationalCommandPulse(g),/Objectif : 0|Déficit annuel/);
  assert.match(pulse(g),/Dette \/ PIB/);
  assert.doesNotMatch(result(g),/deficit-result|Équilibre atteint/);
 }
});
