import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startPresidency, decidePresidency, presidencyEvents, presidencyPoliticalActions } from './presidency-engine.ts';
import { encode, decode } from './storage.ts';
// Failure modes written before implementation: rejected cabinet agreement can be
// spammed at identical state; appointment masquerades as a vote; two abandoned
// reforms freeze all new proposals; deferred/rejected actions disappear without
// durable outcome. Engine tests exercise duplicate commands that a UI may suppress.
test('rejected cabinet agreement cannot repeat at identical state and survives replay',()=>{
 let g=decidePresidency(startPresidency(7),'live-autonomy');
 while(g.turn<9)g=decidePresidency(g,'live-tick');
 g=decidePresidency(g,'pol-cabinet-cohabitation');
 assert.equal(g.politics!.lastVote!.passed,false);
 assert.throws(()=>decidePresidency(g,'pol-cabinet-cohabitation'));
 assert.deepEqual(decode(encode(g)),g);
});
test('government agreement leads to one distinct saved appointment',()=>{
 let g=decidePresidency(startPresidency(2),'live-autonomy');
 while(g.politics!.pendingCrisis!=='cabinet')g=decidePresidency(g,'live-tick');
 g=decidePresidency(g,'pol-cabinet-cohabitation');
 assert.equal(g.politics!.lastVote!.passed,true);
 assert.equal(g.politics!.cabinet,'fallen');
 assert.ok(presidencyPoliticalActions(g).some(c=>c.id==='live-cabinet-appoint'));
 g=decidePresidency(g,'live-cabinet-appoint');
 assert.equal(g.politics!.cabinet,'cohabitation');
 assert.throws(()=>decidePresidency(g,'live-cabinet-appoint'));
 assert.deepEqual(decode(encode(g)),g);
});
test('unanswered reforms expire and do not freeze future proposals',()=>{
 let g=decidePresidency(startPresidency(2),'live-autonomy');
 const first=presidencyEvents(g).find(e=>e.kind==='reform')!.id;
 for(let i=0;i<7;i++)g=decidePresidency(g,'live-tick');
 assert.ok(!presidencyEvents(g).some(e=>e.id===first));
 assert.ok(presidencyEvents(g).some(e=>e.kind==='reform'));
 assert.deepEqual(decode(encode(g)),g);
});
test('explicit reform postponement is durable and not repeatable immediately',()=>{
 let g=startPresidency(3);
 const e=presidencyEvents(g).find(e=>e.kind==='reform')!;
 const defer=e.choices.find(c=>c.id.startsWith('live-reform-defer-'))!;
 assert.ok(defer);
 g=decidePresidency(g,defer.id);
 assert.throws(()=>decidePresidency(g,defer.id));
 assert.ok(!presidencyEvents(g).some(x=>x.id===e.id));
 assert.deepEqual(decode(encode(g)),g);
});
// Additional pre-implementation failure: a refused yearly envelope leaves no
// budget alternative; reallocating must not mint revenue or repeat at a click.
test('budget reallocation moves an existing investment envelope only once per year',()=>{
 let g=startPresidency(4); const before=structuredClone(g);
 g=decidePresidency(g,'live-budget-redeploy');
 assert.equal(g.presidency!.reserve,before.presidency!.reserve+.8);
 assert.equal(g.finance.investment,before.finance.investment-.8);
 assert.equal(g.finance.revenue,before.finance.revenue);
 assert.throws(()=>decidePresidency(g,'live-budget-redeploy'));
 assert.deepEqual(decode(encode(g)),g);
});
