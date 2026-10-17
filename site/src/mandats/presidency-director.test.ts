import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startPresidency } from './presidency-engine.ts';
import { advanceCivicPressure, crisisDirectorCandidates, crisisPhase, crisisChoices } from './presidency-crises.ts';

test('director selects eligible seasonal incidents and uses pressure and family memory deterministically', () => {
  const g = startPresidency(2); g.turn = 6;
  assert.ok(!crisisDirectorCandidates(g).some(c => c.spec.id === 'chaleur'));
  g.turn = 8;
  assert.ok(crisisDirectorCandidates(g).some(c => c.spec.id === 'chaleur'));
  const before = crisisDirectorCandidates(g).find(c => c.spec.id === 'transformateur')!.weight;
  g.pressure!.sectors.energy.pressure = 100;
  assert.ok(crisisDirectorCandidates(g).find(c => c.spec.id === 'transformateur')!.weight > before);
  assert.deepEqual(crisisDirectorCandidates(g), crisisDirectorCandidates(structuredClone(g)));
  const pressured = crisisDirectorCandidates(g).find(c => c.spec.id === 'transformateur')!.weight;
  g.presidency!.crises!.push({ id: 'maintenance-test', spec: 'maintenance', sector: 'energy', startedPeriod: 7, resolvedPeriod: 8, status: 'resolved', sourceJournalIndex: 0, deadline: 3 });
  assert.ok(crisisDirectorCandidates(g).find(c => c.spec.id === 'transformateur')!.weight < pressured);
});

test('civil recovery needs sustained removal of causes, recedes one stage and remains resolved', () => {
  const g = startPresidency(2); g.turn = 10;
  g.presidency!.crises = [];
  for (const s of Object.values(g.pressure!.sectors)) s.pressure = 20;
  g.presidency!.civic = { nextPeriod: 3, sustained: 5, serial: 1, crisis: { id: 'civil-test', spec: 'blocage', sector: 'administration', startedPeriod: 3, stageStartedPeriod: 7, sourceJournalIndex: 0, deadline: 3, status: 'active' } };
  advanceCivicPressure(g);
  assert.equal(g.presidency!.civic.crisis!.spec, 'blocage');
  g.turn++; advanceCivicPressure(g);
  assert.equal(g.presidency!.civic.crisis!.spec, 'greve');
  g.turn++; advanceCivicPressure(g); g.turn++; advanceCivicPressure(g);
  const c = g.presidency!.civic.crisis!;
  assert.equal(c.status, 'resolved');
  assert.equal(crisisPhase(c, [], g.turn + 1), 'resolved');
  assert.ok(!g.politics!.ending);
});

test('port, cyber and power incidents offer materially different third options', () => {
  for (const [seed, sector] of [[0,'health'],[1,'energy'],[2,'transport']] as const) {
    const g = startPresidency(seed);
    const choices = crisisChoices(g, sector);
    assert.equal(choices.length, 3);
    assert.equal(new Set(choices.map(c => JSON.stringify(c.pressure))).size, 3);
  }
});
