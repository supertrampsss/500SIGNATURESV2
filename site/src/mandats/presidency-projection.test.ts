import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { start, decide } from './engine.ts';
import type { Game } from './types.ts';
import { projectToNextStop } from './presidency-projection.ts';

// Failure cases: jumping over a same-tick ministry delivery, critical phase,
// new decision, acquired temporary expiry, annual close, or mandate ending;
// mutating source state or replacing real ticks with a second simulation.
// Semantics: v17 only; ended => independent clone/0/ending; unsupported => error.
// Each result is exactly N ordinary live-ticks, bounded by the 30-period mandate.
// Existing decisions do not block observation; a NEW structured change stops it.
const project = projectToNextStop;
function ticks(g:Game,n:number) {for(let i=0;i<n;i++)g=decide(g,'live-tick');return g;}
function equalTicks(g:Game) {const before=structuredClone(g),result=project(g);assert.deepEqual(result.game,ticks(g,result.periods));assert.deepEqual(g,before);assert.notEqual(result.game,g);assert.ok(result.periods<=30-g.turn);return result;}
function routeAt(period:number) {
  const input=JSON.parse(readFileSync(new URL('../../../docs/mandats-strategy-v17/capacity-inputs.json',import.meta.url),'utf8'));
  let g=start('national',input.seed,input.ambition,17);
  for(const choice of input.choices){if(g.turn===period)break;g=decide(g,choice);}return g;
}

test('projection stops at a ministry arrangement created and delivered within its first tick',()=>{
  const g=start('national',47,'equilibre',17),r=equalTicks(g);
  assert.equal(r.periods,1);assert.equal(r.stop,'delivery');
  assert.equal(g.presidency!.strategy!.commitments.length,0);
  assert.equal(r.game.presidency!.strategy!.commitments[0].status,'delivered');
});
test('a newly financed presidential delivery cannot be skipped',()=>{
  const ordered=decide(start('national',47,'equilibre',17),'s17-health-capacity');
  const id=ordered.presidency!.strategy!.commitments.find(c=>c.kind==='capacity')!.id;
  const g=ticks(ordered,1);
  assert.equal(g.presidency!.strategy!.commitments.find(c=>c.id===id)!.status,'preparing');
  const r=equalTicks(g);
  assert.equal(r.periods,1);assert.equal(r.stop,'delivery');assert.equal(r.game.turn,2);
  assert.equal(r.game.presidency!.strategy!.commitments.find(c=>c.id===id)!.status,'delivered');
  assert.equal(r.game.pressure!.programmes.find(p=>p.id===id)!.deliveredTurn,2);
});
test('legal worsening phase stops even when its decision was already open',()=>{
  const g=ticks(start('national',0,'equilibre',17),14),r=equalTicks(g);
  assert.equal(r.periods,1);assert.equal(r.stop,'alert');
  assert.equal(r.game.presidency!.strategy!.sectors.health.phase,'conflict');
});
test('new service decision interrupts observation at its first actionable period',()=>{
  const g=ticks(start('national',47,'equilibre',17),7),r=equalTicks(g);
  assert.equal(r.periods,1); assert.equal(r.game.turn,8); assert.equal(r.stop,'alert');
});
test('ordinary calm ticks stop at P5 to P6 annual closure',()=>{
  const g=ticks(decide(start('national',0,'equilibre',17),'s17-health-capacity'),5),r=equalTicks(g);
  assert.equal(r.periods,1);assert.equal(r.stop,'annual-close');assert.equal(r.game.history.at(-1)!.closed,true);
});
test('P29 to P30 ends before another observation and ended calls do not tick',()=>{
  const g=routeAt(29),r=equalTicks(g); assert.equal(r.periods,1); assert.equal(r.stop,'ending');
  const ended=project(r.game);assert.equal(ended.periods,0);assert.equal(ended.stop,'ending');
  assert.deepEqual(ended.game,r.game);assert.notEqual(ended.game,r.game);
});
test('temporary recovery expiration stops at its real delivery-programme boundary',()=>{
  let g=ticks(start('national',0,'equilibre',17),15);g=decide(g,'s17-health-recovery');
  const id=g.presidency!.strategy!.commitments.find(c=>c.kind==='recovery')!.id;
  while(g.presidency!.strategy!.commitments.find(c=>c.id===id)!.status==='preparing')g=decide(g,'live-tick');
  const programme=g.pressure!.programmes.find(p=>p.id===id)!;
  g=ticks(g,programme.endsTurn!-1-g.turn);
  const r=equalTicks(g); assert.equal(r.periods,1);assert.equal(r.stop,'delivery');
  assert.equal(r.game.presidency!.strategy!.commitments.find(c=>c.id===id)!.status,'expired');
});
test('a scheduled statutory effect is applied through ordinary ticks before stopping',()=>{
  let g=decide(start('national',47,'equilibre',17),'r07a');assert.ok(g.pending.length);
  g=ticks(g,5);const r=equalTicks(g);
  assert.equal(r.periods,1);assert.equal(r.stop,'delivery');assert.equal(r.game.pending.length,0);
});
test('older versions fail explicitly without mutation or legacy ticking',()=>{
  const g=start('national',47,'equilibre',16),before=structuredClone(g);
  assert.throws(()=>project(g),/v17/);assert.deepEqual(g,before);
});
