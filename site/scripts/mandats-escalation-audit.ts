/** Legal-input civil-pressure journeys; a repeatable audit, not an exhaustive search. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { startPresidency, decidePresidency, presidencyActions, presidencyEvents } from '../src/mandats/presidency-engine.ts';
import { encode, decode } from '../src/mandats/storage.ts';

const records: unknown[] = [];
for (const seed of [0, 1, 2, 17, 99]) {
  for (const strategy of ['neglect', 'civil-negotiation', 'resignation'] as const) {
    let g = decidePresidency(startPresidency(seed), 'live-autonomy');
    const stages: Array<{ period: number; stage: string; deadline: number; status: string }> = [];
    let last = '';
    while (g.turn < 30 && !g.politics!.ending) {
      const c = g.presidency!.civic?.crisis;
      if (c) {
        const key = `${c.id}-${c.spec}-${c.status}`;
        if (key !== last) stages.push({ period: g.turn, stage: c.spec, deadline: (c.stageStartedPeriod ?? c.startedPeriod) + c.deadline, status: c.status });
        last = key;
      }
      if (strategy === 'resignation' && c?.spec === 'revolution') {
        const action = presidencyEvents(g).find(event => event.id === c.id)?.choices.find(choice => choice.id === 'live-resign');
        assert.ok(action, 'Démission absente de la crise sur la carte.');
        g = decidePresidency(g, action.id); break;
      }
      if (strategy === 'civil-negotiation' && c?.status === 'active') {
        const response = presidencyActions(g, c.sector).find(choice => choice.pressure?.crisisId === c.id && choice.pressure.crisisOutcome === 'resolve' && !choice.presidencyOrder?.unavailable);
        if (response) g = decidePresidency(g, response.id);
      }
      g = decidePresidency(g, 'live-tick');
    }
    const ending = g.politics!.ending!;
    assert.ok(ending);
    assert.equal(ending.kind, strategy === 'neglect' ? 'rupture' : strategy === 'resignation' ? 'resignation' : 'term_complete');
    assert.deepEqual(decode(encode(g)), g);
    assert.throws(() => decidePresidency(g, 'live-tick'));
    if (strategy === 'neglect') {
      for (const expected of ['greve', 'blocage', 'revolte', 'revolution']) assert.ok(stages.some(row => row.stage === expected));
      assert.ok(g.turn < 30);
    }
    records.push({ seed, strategy, period: g.turn, ending, stages, reserve: g.presidency!.reserve, spent: g.presidency!.spent, input: JSON.parse(encode(g)) });
  }
}
let g = decidePresidency(startPresidency(2), 'live-autonomy');
while (!g.presidency!.civic?.crisis) g = decidePresidency(g, 'live-tick');
const original = structuredClone(g.presidency!.civic!.crisis!);
const response = presidencyActions(g, original.sector).find(choice => choice.pressure?.crisisId === original.id && choice.pressure.crisisOutcome === 'contain')!;
g = decidePresidency(g, response.id);
g = decidePresidency(g, 'live-tick');
assert.equal(g.presidency!.civic!.crisis!.status, 'contained');
const programme = g.pressure!.programmes.find(item => item.crisisId === original.id)!;
while (g.turn < programme.endsTurn!) g = decidePresidency(g, 'live-tick');
assert.equal(g.presidency!.civic!.crisis!.status, 'active');
assert.equal(g.presidency!.civic!.crisis!.startedPeriod, original.startedPeriod);
assert.deepEqual(decode(encode(g)), g);
records.push({ seed: 2, strategy: 'temporary-mediation-relapse', period: g.turn, input: JSON.parse(encode(g)) });
await mkdir('presidency-artifacts/escalation', { recursive: true });
await writeFile('presidency-artifacts/escalation/legal-journeys.json', JSON.stringify({ journeys: records.length, records }, null, 2));
console.log(JSON.stringify({ journeys: records.length, failures: 0, output: 'presidency-artifacts/escalation/legal-journeys.json' }));
