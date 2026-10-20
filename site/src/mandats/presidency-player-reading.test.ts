import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { start, decide } from './engine.ts';
import type { Game } from './types.ts';
import { presidencyObjective, presidencyPanel, presidencyFan, presidencyPins, presidencyEventFan, presidencyReadings } from './presidency-view.ts';
import { presidencyReforms, presidencyEvents } from './presidency-api.ts';
import { strategyOutcome } from './presidency-strategy-engine.ts';
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

test('real legacy v16 reforms remain readable without a v17 strategy',()=>{
 const g=start('national',612,'equilibre',16); assert.doesNotThrow(()=>presidencyPanel(g,'reforms'));
 assert.match(presidencyPanel(g,'reforms'),/Engagez un dossier/);
});
test('P25 credit adoption preserves its contextual result after funding event disappears',()=>{
 const before=prefix('live-credits',1); assert.ok(presidencyEvents(before).some(event=>event.id==='s17-funding'));
 const next=decide(before,'live-credits'); assert.ok(!presidencyEvents(next).some(event=>event.id==='s17-funding'));
 const html=presidencyEventFan(next,'s17-funding'); assert.match(html,/308 pour/); assert.match(html,/227 contre/); assert.match(html,/Résultat par groupe/);
});
test('finished legislative consultation preserves the actual r01c cost delay and team requirement',()=>{
 const original=presidencyReforms(start('national',612,'equilibre',17)).flatMap(entry=>entry.choices).find(choice=>choice.id==='r01c')!;
 assert.equal(original.presidencyOrder!.cost,2); assert.equal(original.presidencyOrder!.delay,2); assert.equal(original.presidencyOrder!.implementation,1);
 const ended=input.choices.reduce((g:Game,id:string)=>decide(g,id),start('national',612,'equilibre',17));
 const html=presidencyPanel(ended,'reforms').split('data-order="r01c"')[1].split('</button>')[0];
 assert.match(html,/2 Md€ engagés/); assert.match(html,/4 mois minimum/); assert.match(html,/1 unité d’équipes/); assert.match(html,/disabled/);
});
test('annual boundary headline uses the same year two deficit as the outcome goal',()=>{
 let g=start('national',612,'equilibre',17);
 for(const id of ['live-credits','s17-health-capacity','s17-housing-capacity','s17-transport-capacity','s17-education-capacity',...Array(6).fill('live-tick')]) g=decide(g,id);
 const goal=strategyOutcome(g).objectives.find(goal=>goal.id==='finances')!; assert.match(goal.current,/153,53/);
 const html=presidencyObjective(g); assert.match(html,/153,53/); assert.doesNotMatch(html,/171,2/);
});

test('completed original mandate keeps the same ministry limit in footer and final sector reading',()=>{
 const ended=input.choices.reduce((g:Game,id:string)=>decide(g,id),start('national',612,'equilibre',17));
 assert.equal(ended.presidency!.strategy!.sectors.education.routine.status,'limited');
 assert.equal(strategyOutcome(ended).objectives.find(goal=>goal.id==='services')!.met,true);
 const footer=presidencyReadings(ended,null); assert.match(footer,/Limite opérationnelle/);
 const education=presidencyPanel(ended,'ending').split('data-strategy-pressure="education"')[1].split('</div>')[0];
 assert.match(education,/Limite opérationnelle/); assert.doesNotMatch(education,/Organisation sous tension/);
});
