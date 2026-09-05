import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { start, choicesFor, preview, decide, score, domainFor, calendarFor, startingGame, replayGame } from './engine.ts';
import { encode, decode } from './storage.ts';
import { loadCity, scaleForCity, validateCityBaseline } from './cities.ts';
import type { CityBaseline } from './cities.ts';
import type { Game, Mode } from './types.ts';

const MODES: readonly Mode[] = ['municipal', 'national'];
function legal(game: Game): Game[] {
  return choicesFor(game).map(choice => preview(game, choice.id).game).filter((g): g is Game => !!g);
}
function next(game: Game, selector = 0): Game {
  const candidates = legal(game);
  assert.ok(candidates.length, `No legal recovery at ${game.mode} seed ${game.seed}, decision ${game.turn + 1}: ${game.choices.join(',')}`);
  return candidates[selector % candidates.length];
}
function prudent(game: Game): Game {
  const candidates = legal(game);
  assert.ok(candidates.length, `No recovery at ${game.mode} ${game.turn}`);
  return candidates.sort((a, b) => {
    const burden = (g: Game) => g.finance.operating + g.finance.investment + g.finance.repayment - g.finance.revenue - g.finance.grants;
    return burden(a) - burden(b);
  })[0];
}
function closeEnough(a: number, b: number, message: string) {
  assert.ok(Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b)), `${message}: ${a} vs ${b}`);
}

for (const mode of MODES) {
  test(`campaign v3 ${mode}: 45 decisions, annual cash/debt accounting, 48 seeded paths`, () => {
    // 24 independent seeds × 2 policies. This samples actual allowed choices, not fixed scripted wins.
    for (let seed = 0; seed < 24; seed++) {
      for (const strategy of ['random', 'prudent'] as const) {
        let game = start(mode, seed, 'equilibre', 3);
        const initial = structuredClone(game);
        assert.equal(domainFor(game).turns, 45);
        assert.equal(domainFor(game).dossiers.length, 45);
        assert.equal(new Set(domainFor(game).dossiers.map(d => d.title)).size, 45, '45 authored dilemmas, not repeated screens');
        assert.equal(new Set(domainFor(game).dossiers.flatMap(d => d.choices.map(c => c.id))).size, 135, 'Every choice has a stable unique identifier');
        let random = seed + 1;
        while (game.turn < 45) {
          const before = game;
          const calendar = calendarFor(before);
          random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
          game = strategy === 'prudent' ? prudent(before) : next(before, random);
          assert.equal(game.turn, before.turn + 1);
          assert.equal(game.choices.length, game.turn);
          assert.equal(game.history.length, game.turn);
          const entry = game.history.at(-1)!;
          assert.equal(entry.year, calendar.year);
          assert.equal(entry.closed, calendar.isYearEnd);
          if (calendar.slot > 1) assert.equal(game.finance.rate, before.finance.rate, 'Refinancing is applied once per year');
          if (!calendar.isYearEnd) {
            assert.equal(game.finance.cash, before.finance.cash, 'No repeated cash flows inside a year');
            assert.equal(game.finance.debt, before.finance.debt, 'No repeated borrowing or principal inside a year');
            assert.equal(game.finance.gdp, before.finance.gdp, 'GDP compounds annually, not each decision');
          } else {
            closeEnough(game.finance.cash, before.finance.cash + entry.ledger.cashChange, 'Cash reconciliation');
            closeEnough(game.finance.debt, entry.ledger.debt, 'Debt reconciliation');
            if (mode === 'municipal') {
              closeEnough(entry.ledger.debt, before.finance.debt + entry.ledger.borrowing - entry.ledger.repayment, 'Municipal debt bridge');
              assert.ok(entry.ledger.borrowing <= entry.ledger.investment + 1e-8);
              assert.ok(entry.ledger.savings >= entry.ledger.repayment - 1e-8);
            }
          }
          assert.ok(game.finance.cash >= -1e-8 && game.finance.debt >= 0);
          assert.ok(Object.values(game.finance).every(Number.isFinite));
          assert.ok(Object.values(game.metrics).every(value => Number.isFinite(value) && value >= 0 && value <= 100));
          const years = game.history.filter(h => h.closed);
          closeEnough(game.finance.cash, initial.finance.cash + years.reduce((sum, h) => sum + h.ledger.cashChange, 0), 'Only closed annual ledgers move cash');
        }
        const expectedYears = mode === 'municipal' ? 6 : 5;
        assert.equal(game.history.filter(h => h.closed).length, expectedYears);
        assert.equal(calendarFor(game).completedYears, expectedYears);
        assert.equal(score(game).total >= 0 && score(game).total <= 100, true);
        assert.deepEqual(startingGame(game), initial);
        assert.deepEqual(replayGame(game, game.choices), game);
        assert.equal(choicesFor(game).length, 0);
        assert.throws(() => decide(game, game.choices.at(-1)!), /terminé/);
      }
    }
  });

  test(`campaign v3 ${mode}: save resumes mid-year and after 45 decisions with identical effects`, () => {
    let game = start(mode, 73, 'resilience', 3);
    for (let turn = 0; turn < 45; turn++) {
      game = prudent(game);
      if ([1, 6, 8, 19, 31, 44].includes(turn)) {
        const raw = encode(game);
        assert.ok(raw.length < 32768);
        assert.deepEqual(decode(raw), game);
        if (game.turn < 45) assert.deepEqual(prudent(decode(raw)), prudent(game));
      }
    }
    const injected = JSON.parse(encode(game));
    injected.choices[4] = '<script>';
    assert.throws(() => decode(JSON.stringify(injected)));
    assert.throws(() => replayGame(game, [...game.choices, 'extra']), /Journal trop long/);
  });
}

test('campaign v3: delayed delivery follows years, fires exactly once and survives mid-year resume', () => {
  let game = start('municipal', 8, 'services', 3);
  const dossier = domainFor(game).dossiers[0];
  const delayed = dossier.choices.find(c => c.delayed && preview(game, c.id).game);
  assert.ok(delayed?.delayed, 'First municipal dilemma offers a multi-year project');
  const input = game;
  const original = structuredClone(input);
  game = decide(input, delayed.id);
  assert.deepEqual(input, original, 'Transition is pure');
  const target = game.pending.find(p => p.label === delayed.delayed!.label);
  assert.ok(target);
  const dueYear = 1 + delayed.delayed.after;
  assert.equal(target.due, dueYear - 1);
  const deliveryLabel = target.label;
  while (game.turn < 45) {
    const calendar = calendarFor(game);
    game = prudent(decode(encode(game)));
    const entry = game.history.at(-1)!;
    const delivered = entry.messages.includes(deliveryLabel);
    assert.equal(delivered, calendar.year === dueYear && calendar.slot === 1);
    if (calendar.year >= dueYear) assert.equal(game.pending.some(p => p.label === deliveryLabel), false);
  }
  assert.equal(game.history.flatMap(h => h.messages).filter(m => m === deliveryLabel).length, 1);
});

async function fixtureCity(): Promise<CityBaseline> {
  const f = JSON.parse(readFileSync(new URL('../../tests/fixtures/editorial-publication.json', import.meta.url), 'utf8'));
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const path = String(url);
    if (path.includes('geo.api.gouv.fr')) return Response.json({});
    if (path.endsWith('/derniere.json')) return Response.json({ version: f.publication });
    if (path.endsWith('/index.json')) return Response.json(f.index_commune);
    if (path.endsWith('/manifeste.json')) return Response.json({ jeux: f.jeux });
    if (path.endsWith('/commune/33.json')) return Response.json(f.communes);
    throw new Error(`Unexpected endpoint ${path}`);
  }) as typeof fetch;
  try { return await loadCity('33063'); } finally { globalThis.fetch = original; }
}

test('campaign v3: real-city scale, solvability and complete offline snapshot remain distinct from observations', async () => {
  const city = await fixtureCity();
  let game = start('municipal', 91, 'equilibre', 3, city);
  assert.equal(domainFor(game).place, 'Bordeaux');
  assert.equal(game.finance.revenue * 1e6, city.observed.revenue);
  assert.notEqual(game.city, city, 'Session owns a copied snapshot');
  const synthetic = domainFor(start('municipal', 91, 'equilibre', 3));
  const local = domainFor(game);
  const money = ['revenue', 'operating', 'investment', 'grants', 'repayment'] as const;
  for (let i = 0; i < 45; i++) {
    local.dossiers[i].choices.forEach((choice, rank) => {
      const reference = synthetic.dossiers[i].choices[rank];
      for (const key of money) {
        closeEnough(choice.effect[key] ?? 0, (reference.effect[key] ?? 0) * scaleForCity(city), `Scaled ${key}`);
        closeEnough(choice.delayed?.effect[key] ?? 0, (reference.delayed?.effect[key] ?? 0) * scaleForCity(city), `Scaled delayed ${key}`);
      }
      assert.equal(choice.effect.services, reference.effect.services, 'Service proxies are not multiplied by population');
    });
  }
  while (game.turn < 45) {
    game = prudent(game);
    assert.ok(Number.isFinite(domainFor(game).sustainability(game)));
    assert.deepEqual(game.city, city, 'Observed accounts never mutate with player choices');
    if (game.turn === 3 || game.turn === 45) {
      assert.ok(encode(game).length < 32768);
      assert.deepEqual(decode(encode(game)), game);
      assert.ok(validateCityBaseline(decode(encode(game)).city));
    }
  }
  assert.equal(game.history.filter(h => h.closed).length, 6);
  assert.deepEqual(replayGame(game, game.choices), game);
  assert.throws(() => start('national', 1, 'equilibre', 3, city), /commune/);
  assert.throws(() => start('municipal', 1, 'equilibre', 3, { ...city, observed: { ...city.observed, revenue: 0 } }), /Instantané/);
});

test('campaign v3: unavailable or injected choices cannot mutate the current mandate', () => {
  for (const mode of MODES) {
    const game = start(mode, 1, 'equilibre', 3);
    const before = structuredClone(game);
    assert.throws(() => decide(game, '__proto__'));
    assert.deepEqual(game, before);
    assert.equal(preview(game, '<script>').game, null);
    assert.deepEqual(game, before);
    assert.throws(() => start(mode, Infinity, 'equilibre', 3));
  }
});
