import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { start, decide } from './engine.ts';
import { strategyLedger } from './presidency-strategy-engine.ts';
import type { Game } from './types.ts';
import * as model from './presidency-read-model.ts';

// Failure cases: danger hidden by work/trend; period mistaken for journal index;
// programme order mistaken for commitment identity; annual rate shown as spending;
// passive macro trajectory removed with ministers, or compared to a closed book.
// API semantics: v17 read-only, severity independent of trend and preparing work;
// receipts join programmeId, sourceJournalIndex points at the originating order;
// comparison is annual deficit at equal period and equal open/closed ledger status.
function api() { return model; }
function ticks(g: Game, count: number) { for (let i=0;i<count;i++) g=decide(g,'live-tick'); return g; }
function archive(name: string): Game {
  const input=JSON.parse(readFileSync(new URL(`../../../docs/mandats-strategy-v17/${name}-inputs.json`,import.meta.url),'utf8'));
  return input.choices.reduce((g:Game,id:string)=>decide(g,id),start(input.mode,input.seed,input.ambition,input.version));
}

test('a legal critical front keeps danger while a project prepares and when trend improves', () => {
  const g=decide(ticks(start('national',0,'equilibre',17),15),'s17-health-capacity');
  const before=structuredClone(g),reading=api().strategySectorReading(g,'health');
  assert.equal(reading.severity,'critical'); assert.equal(reading.working,true);
  const improving=structuredClone(g); improving.pressure!.sectors.health.trend='improving';
  assert.equal(api().strategySectorReading(improving,'health').severity,'critical');
  assert.equal(api().strategySectorReading(improving,'health').trend,'improving');
  assert.deepEqual(g,before);
});

test('archived capacity and hybrid receipts join the actual programme and exact journal index', () => {
  for(const route of ['capacity','organisation-hybrid']) {
    const g=archive(route),before=structuredClone(g),receipts=api().strategyCausalReceipts(g);
    assert.equal(receipts.length,g.presidency!.strategy!.commitments.length);
    for(const c of g.presidency!.strategy!.commitments) {
      const receipt=receipts.find(r=>r.id===c.id)!;
      assert.equal(receipt.annualOperating,c.annualOperating);
      assert.equal(receipt.cost,c.cost); assert.equal(receipt.engagedPeriod,c.sourcePeriod);
      assert.equal(receipt.deliveredPeriod,c.deliveredPeriod);
      assert.equal(receipt.sourceJournalIndex,c.sourceJournalIndex);
      assert.equal(receipt.replayable,c.kind!=='routine');
      assert.equal(g.choices[receipt.sourceJournalIndex],c.kind==='routine'?'live-tick':c.choice);
      assert.ok(receipt.effect.length>0);
    }
    // Reordering the programme collection cannot change causal association.
    g.pressure!.programmes.reverse(); assert.deepEqual(api().strategyCausalReceipts(g),receipts);
    g.pressure!.programmes.reverse(); assert.deepEqual(g,before);
  }
});

test('orphan programmes and invalid presidential source indices never gain replay links', () => {
  const g=ticks(decide(start('national',47,'equilibre',17),'s17-health-capacity'),3);
  const c=g.presidency!.strategy!.commitments.find(c=>c.kind==='capacity')!;
  c.sourceJournalIndex=1; // This is a real tick, not the order at index 0.
  assert.equal(api().strategyCausalReceipts(g).find(r=>r.id===c.id)!.replayable,false);
  g.pressure!.programmes=g.pressure!.programmes.filter(p=>p.id!==c.programmeId);
  assert.ok(!api().strategyCausalReceipts(g).some(r=>r.id===c.id));
});

test('financial reference retains autonomous ministries and compares equal-period annual deficits', () => {
  const actual=ticks(decide(start('national',47,'equilibre',17),'s17-health-capacity'),6);
  const reference=ticks(start('national',47,'equilibre',17),6),before=structuredClone(actual);
  assert.ok(reference.presidency!.strategy!.routineCost>0);
  const result=api().strategyFinancialComparison(actual);
  assert.deepEqual(result,{actual:strategyLedger(actual).deficit,reference:strategyLedger(reference).deficit,
    delta:strategyLedger(actual).deficit-strategyLedger(reference).deficit,periods:6,comparable:true,referenceEndedEarly:false});
  assert.deepEqual(actual,before);
  // An order at P6 prepares year 2: its forecast cannot be compared to year 1 closed.
  const nextYear=decide(actual,'live-priority-housing'),comparison=api().strategyFinancialComparison(nextYear);
  assert.equal(comparison.comparable,false); assert.equal(comparison.reference,null); assert.equal(comparison.delta,null);
});

test('financial cache keys preserve seed, ambition and horizon and never expose cached state', () => {
  for(const seed of [0,47]) for(const ambition of ['services','equilibre'] as const) {
    const g=ticks(start('national',seed,ambition,17),9),expected=strategyLedger(g).deficit;
    const a=api().strategyFinancialComparison(g); a.reference=-999;
    assert.equal(api().strategyFinancialComparison(g).reference,expected);
    assert.equal(api().strategyFinancialComparison(g).delta,0);
  }
});

test('non-programme fiscal laws have a separate authentic receipt without an invented sector', () => {
  const g=decide(start('national',47,'equilibre',17),'r03b');
  const receipt=api().strategyLegislativeReceipts(g).find(r=>r.choice==='r03b')!;
  assert.ok(receipt); assert.equal(receipt.sourceJournalIndex,0);
  assert.equal(receipt.status,g.history[0].vote!.passed?'adopted':'rejected');
  assert.equal(receipt.annualRevenue,g.history[0].vote!.passed?30:0);
  assert.ok(!('sector' in receipt)); assert.equal(receipt.replayable,true);
});
