import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { start, decide } from './engine.ts';
import type { Game } from './types.ts';
import { presidencyObjective, presidencyPanel, presidencyFan, presidencyPins } from './presidency-view.ts';
const input=JSON.parse(readFileSync(new URL('../../../docs/mandats/essai-joueur-2026-10-20/partie-jouee-v17.json',import.meta.url),'utf8'));
function prefix(choice: string, occurrence=0) { let seen=0; const index=input.choices.findIndex((id:string)=>id===choice&&seen++===occurrence); return input.choices.slice(0,index).reduce((g:Game,id:string)=>decide(g,id),start('national',612,'equilibre',17)) as Game; }
test('P25 names missed backlog with its value in the main objective and links responsible sectors',()=>{
 const g=prefix('live-credits',1), html=presidencyObjective(g);
 assert.match(html,/39,93/); assert.match(html,/28,4/); assert.match(html,/Retards/i);
 const detail=presidencyPanel(g,'priorities'); assert.match(detail,/data-objective-backlog-sector/);
});
test('all met before the end asks to maintain until review and anticipate needs',()=>{
 const html=presidencyObjective(start('national',612,'equilibre',17));
 assert.match(html,/maintenir jusqu’au bilan/i); assert.match(html,/besoins/i);
});
test('P18 and P19 sector and fan agree on the operational limit',()=>{
 for(const [choice,sector] of [['s17-housing-network','housing'],['s17-administration-organisation','administration']] as const) {
  const g=prefix(choice); assert.match(presidencyPins(g,null),/Limite opérationnelle/);
  const fan=presidencyFan(g,sector); assert.match(fan,/limite opérationnelle/); assert.doesNotMatch(fan,/dispose d’une marge/);
 }
});
test('P6 legislative result remains immediately in Reforms with historical ballot and next action',()=>{
 const before=prefix('r21a'); const prior=presidencyPanel(before,'reforms');
 assert.match(prior,/discipline/); assert.match(prior,/fidélité/); assert.match(prior,/265/); assert.match(prior,/Appuis/);
 const g=decide(before,'r21a'); assert.deepEqual([g.politics!.lastVote!.for,g.politics!.lastVote!.against,g.politics!.lastVote!.abstain],[249,286,42]);
 const html=presidencyPanel(g,'reforms'); assert.match(html,/249 pour/); assert.match(html,/286 contre/); assert.match(html,/Résultat par groupe/); assert.match(html,/prochaine période/i);
});
test('P21 and P25 credit ballots remain historical and expose result in context',()=>{
 for(const [occurrence,expected] of [[0,[246,286,45]],[1,[308,227,42]]] as const) {
  const before=prefix('live-credits',occurrence), g=decide(before,'live-credits');
  const vote=g.politics!.lastVote!; assert.deepEqual([vote.for,vote.against,vote.abstain],expected);
  assert.match(presidencyPanel(g,'government'),new RegExp(`${vote.for} pour`));
 }
});

test('legislative option states identical description benefit and sacrifice only once',()=>{
 const html=presidencyPanel(prefix('r21a'),'reforms');
 const card=html.split('data-order="r21a"')[1].split('</button>')[0];
 assert.equal(card.split('Les services disposent de moins de liberté dans leurs achats.').length-1,1);
});
test('completed mandate keeps legislative catalogue readable with every order disabled',()=>{
 const g=input.choices.reduce((g:Game,id:string)=>decide(g,id),start('national',612,'equilibre',17));
 const html=presidencyPanel(g,'reforms'); assert.match(html,/Réduire les achats dispersés/);
 for(const panel of ['reforms','government','priorities'] as const) for(const button of presidencyPanel(g,panel).matchAll(/<button[^>]*data-presidency-order[^>]*>/g)) assert.match(button[0],/disabled/);
});
test('preparation shows future work separately from the completed period mobilisation',()=>{
 const before=prefix('s17-housing-network'); const g=decide(before,'s17-housing-network');
 const html=presidencyPanel(g,'government'); assert.match(html,/Travail prévu/); assert.match(html,/Travail restant/);
 assert.match(presidencyFan(g,'housing'),/travail restantes/);
});

test('delivered responses clear the current housing P21 and administration P28 limit on original journal',()=>{
 let g=start('national',612,'equilibre',17);
 for(const id of input.choices){g=decide(g,id); if(id==='live-tick' && [21,28,30].includes(g.turn)) {
  const sector=g.turn===21?'housing':'administration';
  assert.equal(g.presidency!.strategy!.sectors[sector].routine.status,'operational');
  assert.doesNotMatch(presidencyFan(g,sector),/limite opérationnelle/);
 }}
});
