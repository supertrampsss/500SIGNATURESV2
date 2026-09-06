import { test } from 'node:test';
import assert from 'node:assert/strict';
import { start, decide, choicesFor, domainFor, score } from './engine.ts';
import { encode, decode } from './storage.ts';
import { challengeURL, challengeFromURL, resultURL, sharedResult } from './sharing.ts';
import { choiceCopy, choiceCosts } from './novice.ts';
import { nationalPolicyDossiers } from './national-policy.ts';
import type { Choice, Game } from './types.ts';

const genuineCut = (c: Choice) => (c.effect.operating ?? 0) < 0 && (c.effect.revenue ?? 0) >= 0 && (c.effect.investment ?? 0) <= 0;
const next = (g: Game, rank = 2) => decide(g, choicesFor(g)[rank].id);
function reach(turn: number, seed = 42): Game {
  let g = start('national', seed, 'equilibre', 5);
  while (g.turn < turn) g = next(g);
  return g;
}

test('each national dossier offers a real spending reduction with a visible trade-off', () => {
  const dossiers = nationalPolicyDossiers();
  assert.equal(dossiers.length, 45);
  const titles: string[] = [];
  for (const [turn, dossier] of dossiers.entries()) {
    assert.equal(dossier.choices.length, 3);
    const cut = dossier.choices.find(genuineCut);
    assert.ok(cut, dossier.title);
    titles.push(cut.title);
    assert.ok(!cut.delayed, 'a temporary aid expiry cannot count as a new saving');
    assert.ok(['services', 'cohesion', 'trust', 'resilience', 'assets'].some(k => (cut.effect[k as keyof typeof cut.effect] as number ?? 0) < 0), cut.title);
    const g = reach(turn);
    const before = next(g, dossier.choices.indexOf(cut));
    const due = turn % 9 === 0 ? g.pending.filter(p => p.due === Math.floor(turn / 9)).reduce((sum,p) => sum + (p.effect.operating ?? 0), 0) : 0;
    assert.equal(before.finance.operating, g.finance.operating + due + cut.effect.operating!, cut.title);
    assert.match(choiceCosts(cut, 'national').join(' '), /Économie/);
    assert.equal(choiceCopy(g, dossier, cut).outcome, cut.sacrifice);
    assert.ok(cut.sacrifice.length > 30);
  }
  assert.equal(new Set(titles).size, 45, 'do not repeat a generic economy in every sector');
});

test('tax choices identify different bases, both increases and reductions, with distinct timing', () => {
  const taxes = nationalPolicyDossiers().flatMap(d => d.choices).filter(c => c.effect.revenue || c.delayed?.effect.revenue);
  assert.equal(new Set(taxes.map(c => c.title)).size, taxes.length);
  const text = taxes.map(c => c.title).join(' ');
  for (const base of ['niches', 'patrimoines', 'fraude', 'TVA', 'successions', 'émissions', 'capital', 'cotisations', 'transactions', 'boissons']) assert.ok(text.includes(base), base);
  assert.ok(taxes.filter(c => (c.effect.revenue ?? 0) < 0).length >= 4);
  assert.ok(taxes.some(c => (c.effect.operating ?? 0) > 0 && (c.delayed?.effect.revenue ?? 0) > 0));
  assert.ok(taxes.some(c => c.effect.revenue! > 0 && c.delayed?.effect.revenue === -c.effect.revenue!));
});

test('fiscal controls cost now and yield only after the next annual transition', () => {
  const initial = reach(9);
  let control = decide(initial, 'n10a'), comparison = decide(initial, 'n10c');
  assert.equal(control.finance.revenue, comparison.finance.revenue);
  assert.equal(control.finance.operating - comparison.finance.operating, 1);
  while (control.turn < 18) { control = next(control); comparison = next(comparison); }
  assert.equal(control.finance.revenue, comparison.finance.revenue);
  control = next(control); comparison = next(comparison);
  assert.equal(control.finance.revenue - comparison.finance.revenue, 2);
  assert.deepEqual(decode(encode(control)), control);
  const costs = choiceCosts(domainFor(initial).dossiers[9].choices[0], 'national').join(' ');
  assert.match(costs, /Coût/); assert.match(costs, /Puis recettes en plus.*dans 1 an/);
});

test('the exceptional profit levy ends once, without being treated as a permanent tax', () => {
  const initial = reach(25);
  let taxed = decide(initial, 'n26b'), comparison = decide(initial, 'n26c');
  assert.equal(taxed.finance.revenue - comparison.finance.revenue, 3);
  while (taxed.turn < 28) { taxed = next(taxed); comparison = next(comparison); }
  assert.equal(taxed.finance.revenue, comparison.finance.revenue);
  while (taxed.turn < 37) { taxed = next(taxed); comparison = next(comparison); }
  assert.equal(taxed.finance.revenue, comparison.finance.revenue);
});

test('saving, service and investment strategies finish with five budgets and different legacies', () => {
  for (const seed of [40, 42, 43]) {
    const outcomes = [];
    for (const strategy of ['saving', 'services', 'investment']) {
      let g = start('national', seed, 'equilibre', 5);
      while (g.turn < 45) {
        const choices = choicesFor(g);
        const c = strategy === 'saving' ? choices.find(genuineCut)! : choices.reduce((a,b) => ((b.effect[strategy === 'services' ? 'services' : 'investment'] ?? 0) > (a.effect[strategy === 'services' ? 'services' : 'investment'] ?? 0) ? b : a));
        g = decide(g, c.id);
        if (g.turn % 9 === 0) assert.deepEqual(decode(encode(g)), g);
        assert.ok(g.finance.operating > 0 && g.finance.revenue > 0 && g.finance.debt > 0);
      }
      assert.equal(g.history.filter(h => h.closed).length, 5);
      assert.deepEqual(sharedResult(new URL(resultURL(g, 'https://example.org')).hash), g);
      assert.equal(challengeFromURL(new URL(challengeURL(g, 'https://example.org')))!.version, 5);
      outcomes.push(g);
    }
    assert.ok(outcomes[0].finance.debt < outcomes[1].finance.debt);
    assert.ok(outcomes[0].metrics.services < outcomes[1].metrics.services);
    assert.ok(outcomes[0].metrics.assets < outcomes[2].metrics.assets);
    assert.ok(outcomes.every(g => Number.isFinite(score(g).total)));
  }
});

test('old national saves and challenge rules stay unchanged after playing v5', () => {
  for (const version of [3, 4] as const) {
    let old = start('national', 42, 'equilibre', version);
    const oldDossiers = structuredClone(domainFor(old).dossiers);
    assert.deepEqual(oldDossiers[0].choices[2].effect, {});
    assert.equal(oldDossiers.filter(d => d.choices.some(genuineCut)).length, 10);
    while (old.turn < 45) old = next(old);
    const before = encode(old);
    reach(45);
    assert.deepEqual(decode(before), old);
    assert.deepEqual(domainFor(start('national', 42, 'equilibre', version)).dossiers, oldDossiers);
    assert.equal(challengeFromURL(new URL(challengeURL(old, 'https://example.org')))!.version, version);
  }
  assert.throws(() => start('municipal', 42, 'equilibre', 5), /national/);
});
