import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startPresidency, decidePresidency, presidencyEvents, presidencyActions } from './presidency-engine.ts';
import { encode, decode } from './storage.ts';

test('spontaneous reforms are seeded, actionable and disappear after a saved decision', () => {
  let g = startPresidency(2);
  const events = presidencyEvents(g).filter(e => e.kind === 'reform');
  assert.ok(events.length > 0);
  assert.deepEqual(events, presidencyEvents(startPresidency(2)).filter(e => e.kind === 'reform'));
  assert.notEqual(events[0].id, presidencyEvents(startPresidency(3)).find(e => e.kind === 'reform')!.id);
  const event = events[0], choice = event.choices.find(c => !c.presidencyOrder?.unavailable)!;
  g = decidePresidency(g, choice.id);
  assert.equal(g.turn, 0);
  assert.ok(!presidencyEvents(g).some(e => e.id === event.id));
  assert.deepEqual(decode(encode(g)), g);
});

test('inaction announces strikes, blockade, revolt and revolution before a reproducible early loss', () => {
  let g = decidePresidency(startPresidency(2), 'live-autonomy');
  const stages = new Set<string>();
  while (g.turn < 30 && !g.politics!.ending) {
    g = decidePresidency(g, 'live-tick');
    if (g.presidency!.civic?.crisis) stages.add(g.presidency!.civic.crisis.spec);
  }
  for (const stage of ['greve', 'blocage', 'revolte', 'revolution']) assert.ok(stages.has(stage), stage);
  assert.equal(g.politics!.ending?.kind, 'rupture');
  assert.ok(g.turn < 30);
  assert.throws(() => decidePresidency(g, 'live-tick'));
  assert.deepEqual(decode(encode(g)), g);
});

test('funded delivered civil negotiations resolve the crisis and create a real quiet period', () => {
  let g = decidePresidency(startPresidency(2), 'live-autonomy');
  while (!g.presidency!.civic?.crisis) g = decidePresidency(g, 'live-tick');
  const crisis = g.presidency!.civic!.crisis!;
  const response = presidencyActions(g, crisis.sector).find(c => c.pressure?.crisisId === crisis.id && c.pressure.crisisOutcome === 'resolve')!;
  assert.ok(response);
  g = decidePresidency(g, response.id);
  assert.equal(g.presidency!.civic!.crisis!.status, 'active');
  for (let i = 0; i < 3; i++) g = decidePresidency(g, 'live-tick');
  assert.equal(g.presidency!.civic!.crisis!.status, 'resolved');
  assert.ok(g.presidency!.civic!.nextPeriod > g.turn);
  assert.ok(!g.politics!.ending);
});

test('a cabinet resignation caused by civil revolt never claims a censure vote', () => {
  let g = decidePresidency(startPresidency(2), 'live-autonomy');
  while (g.presidency!.civic?.crisis?.spec !== 'revolte') g = decidePresidency(g, 'live-tick');
  assert.equal(g.politics!.pendingCrisis, 'cabinet');
  assert.ok(!g.politics!.votes.some(vote => vote.kind === 'censure' && vote.passed));
  const event = presidencyEvents(g).find(item => item.id === 'political-cabinet')!;
  assert.match(event.detail, /démission/i);
  assert.doesNotMatch(event.detail, /censure.*adoptée/i);
  assert.deepEqual(decode(encode(g)), g);
});
