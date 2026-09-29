import test from 'node:test';
import assert from 'node:assert/strict';
import { choicesFor, decide, isFinished, replay, start } from './engine.ts';
import { initialPolitics, resolvePoliticalChoice, applyPoliticalResolution } from './politics.ts';
import type { Choice } from './types.ts';

test('v10 begins with 577 seats and repeats the same vote from the same seed and choices', () => {
  const initial = start('national', 42, 'equilibre', 10);
  assert.equal(initial.politics!.blocs.reduce((sum, bloc) => sum + bloc.seats, 0), 577);
  const ids = ['pol-wealth-hospital-package'];
  const first = replay('national', 42, ids, 10);
  const second = replay('national', 42, ids, 10);
  assert.deepEqual(first, second);
  assert.equal(first.history[0].vote!.total, 577);
  assert.equal(first.history[0].vote!.groups.reduce((sum, group) => sum + group.for + group.against + group.abstain, 0), 577);
});

test('a rejected opening bill cannot apply revenue, spending, services, or a commitment', () => {
  const before = start('national', 17, 'equilibre', 10);
  const after = decide(before, 'pol-wealth-hospital-package');
  assert.equal(after.history[0].vote!.passed, false);
  assert.equal(after.finance.revenue, before.finance.revenue);
  assert.equal(after.finance.operating, before.finance.operating);
  assert.equal(after.metrics.services, before.metrics.services - 1, 'only the standing annual service maintenance is applied');
  assert.equal(after.politics!.commitments.some(item => item.id === 'wealth-hospital'), false);
  assert.match(after.history[0].messages.join(' '), /texte rejeté/i);
});

test('censure only removes the government; the presidential mandate continues', () => {
  let game = start('national', 0, 'equilibre', 10);
  game = decide(game, 'pol-wealth-hospital-package');
  game = decide(game, 'pol-coalition-refuse');
  game = decide(game, 'pol-censure-vote');
  assert.equal(game.politics!.lastVote!.kind, 'censure');
  assert.equal(game.politics!.lastVote!.passed, true);
  assert.equal(game.politics!.cabinet, 'fallen');
  assert.equal(game.politics!.ending, undefined);
  assert.ok(choicesFor(game).length > 0);
});

test('a dissolution produces 577 deterministic seat results and blocks another election for six slots', () => {
  let game = start('national', 0, 'equilibre', 10);
  for (const id of ['pol-wealth-hospital-package', 'pol-coalition-refuse', 'pol-censure-vote', 'pol-cabinet-dissolve']) game = decide(game, id);
  const election = game.politics!.lastVote!;
  assert.equal(election.kind, 'election');
  assert.equal(election.groups.reduce((sum, group) => sum + (group.seats ?? 0), 0), 577);
  assert.deepEqual(election.groups.map(group => group.seats), game.politics!.blocs.map(bloc => bloc.seats));

  const forcedCabinet = structuredClone(game);
  forcedCabinet.politics!.pendingCrisis = 'cabinet';
  assert.equal(choicesFor(forcedCabinet).some(choice => choice.political?.action === 'dissolve'), false);
  assert.throws(() => decide(forcedCabinet, 'pol-cabinet-dissolve'), /décision n'appartient pas/);
});

test('destitution is a separate three-stage two-thirds procedure, not a 289-seat vote', () => {
  const political = initialPolitics(27);
  political.misconduct = 10;
  const choice: Choice = {
    id: 'test-destitution', title: 'Procédure', description: '', cost: '', benefit: '', sacrifice: '', effect: {},
    political: { action: 'destitute', vote: 'destitution' },
  };
  const resolution = resolvePoliticalChoice(political, choice, 27, 18);
  const vote = resolution.vote!;
  assert.equal(vote.kind, 'destitution');
  assert.deepEqual(vote.stages!.map(stage => stage.total), [577, 348, 925]);
  assert.deepEqual(vote.stages!.map(stage => stage.threshold), [385, 232, 617]);
  assert.equal(vote.stages!.every(stage => stage.passed), true);
  const renewed = structuredClone(political);
  [renewed.blocs[0].seats, renewed.blocs[1].seats] = [renewed.blocs[1].seats, renewed.blocs[0].seats];
  const later = resolvePoliticalChoice(renewed, choice, 27, 18).vote!;
  assert.notDeepEqual(later.stages![0].groups, vote.stages![0].groups);
  assert.deepEqual(later.stages![1].groups, vote.stages![1].groups, "Assembly elections do not renew the Senate");
});

test('a high-pressure scandal can end early and disables every later choice', () => {
  let game = start('national', 42, 'equilibre', 10);
  for (let guard = 0; guard < 30 && !isFinished(game); guard++) {
    const choices = choicesFor(game);
    const crisis = game.politics!.pendingCrisis;
    let id = choices[0]?.id;
    if (crisis === 'coalition') id = 'pol-coalition-compromise';
    if (crisis === 'censure') id = 'pol-censure-vote';
    if (crisis === 'cabinet') id = 'pol-cabinet-cohabitation';
    if (choices.some(choice => choice.id === 'pol-scandal-cover-up')) {
      const numberOfCoverups = game.choices.filter(choice => choice === 'pol-scandal-cover-up').length;
      id = numberOfCoverups < 4 ? 'pol-scandal-cover-up' : 'pol-scandal-publish';
    }
    assert.ok(id, `game has a decision at slot ${game.turn}`);
    game = decide(game, id!);
  }
  assert.equal(game.politics!.ending?.kind, 'rupture');
  assert.equal(game.turn < 30, true);
  assert.deepEqual(choicesFor(game), []);
  assert.throws(() => decide(game, 'pol-rupture-negotiate'), /terminé/);
});


test('two grave institutional breaches open a three-decision repair window and another breach accelerates it', () => {
  const game = start('national', 9, 'equilibre', 10);
  const breach = (id: string): Choice => ({
    id, title: id, description: '', cost: '', benefit: '', sacrifice: '', effect: {},
    political: { action: 'cover_up', misconduct: 2, ruleOfLaw: -18, institutionalBreach: true },
  });
  let politics = initialPolitics(9);
  const first = breach('breach-1');
  politics = applyPoliticalResolution(politics, game, first, resolvePoliticalChoice(politics, first, 9, 1), 9, 1);
  assert.equal(politics.institutionalBreaches, 1);
  assert.equal(politics.institutionalCrisis, undefined);

  const second = breach('breach-2');
  politics = applyPoliticalResolution(politics, game, second, resolvePoliticalChoice(politics, second, 9, 2), 9, 2);
  assert.equal(politics.institutionalBreaches, 2);
  assert.deepEqual(politics.institutionalCrisis, { stage: 'national', remaining: 3, openedTurn: 2, lastBreachTurn: 2 });

  const third = breach('breach-3');
  politics = applyPoliticalResolution(politics, game, third, resolvePoliticalChoice(politics, third, 9, 3), 9, 3);
  assert.equal(politics.institutionalCrisis?.stage, 'national');
  assert.equal(politics.institutionalCrisis?.remaining, 1, 'a fresh breach consumes the normal step plus an extra step');

  const fourth = breach('breach-4');
  politics = applyPoliticalResolution(politics, game, fourth, resolvePoliticalChoice(politics, fourth, 9, 4), 9, 4);
  assert.equal(politics.institutionalCrisis?.stage, 'regime');
  assert.equal(politics.pendingCrisis, 'rupture');
  assert.equal(politics.cabinet, 'fallen');
});

test('the institutional repair window is respected even when legitimacy and unrest are already critical', () => {
  const game = start('national', 11, 'equilibre', 10);
  let politics = initialPolitics(11);
  politics.institutionalBreaches = 2;
  politics.ruleOfLaw = 32;
  politics.institutionalCrisis = { stage: 'national', remaining: 3, openedTurn: 4, lastBreachTurn: 4 };
  politics.cabinet = 'fallen';
  politics.legitimacy = 10;
  politics.unrest = 95;
  politics.pendingCrisis = 'scandal';

  const neutral: Choice = { id: 'neutral', title: 'neutral', description: '', cost: '', benefit: '', sacrifice: '', effect: {}, political: { action: 'confidence' } };
  politics = applyPoliticalResolution(politics, game, neutral, resolvePoliticalChoice(politics, neutral, 11, 5), 11, 5);
  assert.equal(politics.institutionalCrisis?.stage, 'national');
  assert.equal(politics.institutionalCrisis?.remaining, 2);
  assert.notEqual(politics.pendingCrisis, 'rupture', 'the old generic rupture trigger must not bypass the announced repair delay');
});

test('publishing the scandal can repair the independent institutional crisis without erasing political consequences', () => {
  const game = start('national', 5, 'equilibre', 10);
  let politics = initialPolitics(5);
  politics.institutionalBreaches = 2;
  politics.ruleOfLaw = 36;
  politics.misconduct = 4;
  politics.scandalExposure = 4;
  politics.pendingCrisis = 'scandal';
  politics.institutionalCrisis = { stage: 'national', remaining: 3, openedTurn: 2, lastBreachTurn: 2 };
  const publish: Choice = {
    id: 'publish', title: 'publish', description: '', cost: '', benefit: '', sacrifice: '', effect: { trust: 3 },
    political: { action: 'publish_scandal', legitimacy: 7, ruleOfLaw: 12, repairInstitutions: 1 },
  };
  politics = applyPoliticalResolution(politics, game, publish, resolvePoliticalChoice(politics, publish, 5, 3), 5, 3);
  assert.equal(politics.institutionalBreaches, 1);
  assert.equal(politics.institutionalCrisis, undefined);
  assert.equal(politics.pendingCrisis, 'censure');
  assert.equal(politics.scandalExposure, 0);
});

test('term completion happens after decision 30, never after decision 29, and an unresolved crisis cannot masquerade as a normal ending', () => {
  const game = start('national', 3, 'equilibre', 10);
  const neutral: Choice = { id: 'neutral', title: 'neutral', description: '', cost: '', benefit: '', sacrifice: '', effect: {}, political: { action: 'enact' } };
  let politics = initialPolitics(3);
  politics = applyPoliticalResolution(politics, game, neutral, resolvePoliticalChoice(politics, neutral, 3, 29), 3, 29);
  assert.equal(politics.ending, undefined);
  const completed = applyPoliticalResolution(politics, game, neutral, resolvePoliticalChoice(politics, neutral, 3, 30), 3, 30);
  assert.equal(completed.ending?.kind, 'term_complete');

  const unresolved = initialPolitics(3);
  unresolved.institutionalBreaches = 2;
  unresolved.ruleOfLaw = 30;
  unresolved.institutionalCrisis = { stage: 'national', remaining: 2, openedTurn: 28, lastBreachTurn: 28 };
  const forced = applyPoliticalResolution(unresolved, game, neutral, resolvePoliticalChoice(unresolved, neutral, 3, 30), 3, 30);
  assert.equal(forced.ending?.kind, 'rupture');
  assert.match(forced.ending?.reason ?? '', /crise politique ou institutionnelle reste ouverte/i);
});
