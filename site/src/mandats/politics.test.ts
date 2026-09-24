import test from 'node:test';
import assert from 'node:assert/strict';
import { choicesFor, decide, isFinished, replay, start } from './engine.ts';
import { initialPolitics, resolvePoliticalChoice } from './politics.ts';
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
