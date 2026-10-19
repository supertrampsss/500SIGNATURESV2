import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startPresidency } from './presidency-engine.ts';
import { presidencyCrises } from './presidency-crises.ts';
import { presidencyOutcome } from './presidency-outcome.ts';
import { presidencyShell, presidencyPanel } from './presidency-view.ts';
import { encode, decode } from './storage.ts';

test('mission changes the opening emergency and actual credit envelope', () => {
  const budget = startPresidency(9, 'equilibre');
  const hospital = startPresidency(9, 'services');
  const grid = startPresidency(9, 'resilience');
  assert.equal(budget.presidency!.reserve, 6.4);
  assert.equal(hospital.presidency!.reserve, 7.2);
  assert.equal(grid.presidency!.reserve, 5.4);
  assert.equal(presidencyCrises(hospital)[0].spec, 'cyber');
  assert.equal(presidencyCrises(grid)[0].spec, 'transformateur');
  assert.match(presidencyShell(hospital), /Objectif : Sauver les services/);
  assert.deepEqual(decode(encode(hospital)), hospital);
});

test('finishing five years with services in collapse does not award victory', () => {
  const game = startPresidency(3, 'services');
  game.turn = 30;
  for (const front of Object.values(game.pressure!.sectors)) front.pressure = 100;
  const outcome = presidencyOutcome(game);
  assert.equal(outcome.status, 'incomplete');
  assert.match(presidencyPanel(game, 'ending'), /objectif non atteint/);
  assert.match(presidencyPanel(game, 'ending'), /data-ending-kind="incomplete"/);
});

test('a successful mission and a political defeat are different outcomes', () => {
  const game = startPresidency(4, 'resilience');
  game.turn = 30;
  game.pressure!.sectors.energy.pressure = 30;
  for (const crisis of presidencyCrises(game)) crisis.status = 'resolved';
  assert.equal(presidencyOutcome(game).status, 'victory');
  game.politics!.ending = { kind: 'resignation', title: 'Démission', reason: 'Fin anticipée', turn: 28, causes: ['Démission'] };
  assert.equal(presidencyOutcome(game).status, 'defeat');
});
