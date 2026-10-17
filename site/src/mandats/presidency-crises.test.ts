import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startPresidency, decidePresidency, presidencyActions } from './presidency-engine.ts';
import { decode, encode } from './storage.ts';
import { crisisChoices, crisisPhase, crisisImpact } from './presidency-crises.ts';

test('a crisis response spends once, waits for delivery and replays exactly', () => {
  let g = decidePresidency(startPresidency(0), 'live-autonomy');
  const crisis = g.presidency!.crises![0];
  const choice = crisisChoices(g, crisis.sector).find(c => c.pressure?.crisisOutcome === 'resolve')!;
  assert.ok(choice);
  const before = structuredClone(g);
  g = decidePresidency(g, choice.id);
  assert.equal(g.turn, before.turn);
  assert.ok(g.presidency!.reserve < before.presidency!.reserve);
  assert.notEqual(g.presidency!.crises![0].status, 'resolved');
  assert.throws(() => decidePresidency(g, choice.id));
  for (let i = 0; i < 4; i++) g = decidePresidency(g, 'live-tick');
  assert.equal(g.presidency!.crises!.find(c => c.id === crisis.id)!.status, 'resolved');
  assert.deepEqual(decode(encode(g)), g);
});

test('temporary containment expires and an unresolved incident relapses', () => {
  let g = decidePresidency(startPresidency(2), 'live-autonomy');
  const crisis = g.presidency!.crises![0];
  const choice = crisisChoices(g, crisis.sector).find(c => c.pressure?.crisisOutcome === 'contain')!;
  g = decidePresidency(g, choice.id);
  g = decidePresidency(g, 'live-tick');
  const programme = g.pressure!.programmes.find(p => p.crisisId === crisis.id)!;
  assert.equal(crisisPhase(crisis, g.pressure!.programmes, g.turn), 'contained');
  assert.equal(crisisPhase(crisis, g.pressure!.programmes, programme.endsTurn!), 'active');
});

test('ignored crises propagate once with a named parent; bounded catalogue and finite states', () => {
  for (const seed of [0, 1, 2, 17, 99]) {
    let g = decidePresidency(startPresidency(seed), 'live-autonomy');
    for (let t = 0; t < 12; t++) {
      g = decidePresidency(g, 'live-tick');
      const crises = g.presidency!.crises!;
      assert.ok(crises.filter(c => c.status !== 'resolved').length <= 3);
      assert.equal(new Set(crises.map(c => c.spec)).size, crises.length);
      for (const c of crises) {
        if (c.parentId) assert.ok(crises.some(parent => parent.id === c.parentId));
        const impact = crisisImpact(g, c.sector, g.pressure!.programmes, g.turn);
        assert.ok(Number.isFinite(impact.loss) && impact.loss >= 0);
      }
    }
    assert.ok(g.presidency!.crises!.some(c => c.parentId));
    assert.deepEqual(decode(encode(g)), g);
  }
});

test('unaffordable response and stale command cannot spend or advance the clock', () => {
  const g = startPresidency(0);
  g.presidency!.reserve = 0;
  for (const c of presidencyActions(g, g.presidency!.crises![0].sector)) {
    if ((c.presidencyOrder?.cost ?? 0) > 0) {
      assert.ok(c.presidencyOrder?.unavailable);
      assert.throws(() => decidePresidency(g, c.id));
    }
  }
  assert.equal(g.turn, 0);
});
