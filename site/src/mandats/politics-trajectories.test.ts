import test from 'node:test';
import assert from 'node:assert/strict';
import { choicesFor, decide, isFinished, replay, start } from './engine.ts';
import { encode, decode } from './storage.ts';
import type { VoteRecord } from './politics-types.ts';

function tallyIsComplete(vote: VoteRecord) {
  assert.equal(vote.total, 577);
  assert.equal(vote.groups.reduce((n, group) => n + group.for + group.against + group.abstain, 0), 577);
  assert.equal(vote.groups.reduce((n, group) => n + group.for, 0), vote.for);
  assert.equal(vote.groups.reduce((n, group) => n + group.against, 0), vote.against);
  assert.equal(vote.groups.reduce((n, group) => n + group.abstain, 0), vote.abstain);
}

test('the same opening bill funds its effects when passed and grants none when rejected', () => {
  const passedStart = start('national', 0, 'equilibre', 10);
  const passedChoice = choicesFor(passedStart).find(choice => choice.id === 'pol-wealth-hospital-package')!;
  const passed = decide(passedStart, passedChoice.id);
  assert.equal(passed.politics!.lastVote!.passed, true);
  tallyIsComplete(passed.politics!.lastVote!);
  assert.equal(passed.finance.revenue - passedStart.finance.revenue, 6);
  assert.equal(passed.finance.operating - passedStart.finance.operating, 4);
  assert.equal(passed.politics!.commitments[0].id, 'wealth-hospital');

  const rejectedStart = start('national', 17, 'equilibre', 10);
  const rejected = decide(rejectedStart, 'pol-wealth-hospital-package');
  assert.equal(rejected.politics!.lastVote!.kind, 'law');
  assert.equal(rejected.politics!.lastVote!.passed, false);
  tallyIsComplete(rejected.politics!.lastVote!);
  assert.equal(rejected.finance.revenue, rejectedStart.finance.revenue);
  assert.equal(rejected.finance.operating, rejectedStart.finance.operating);
  assert.equal(rejected.metrics.services, rejectedStart.metrics.services - 1, 'only the scheduled annual settling applies');
  assert.equal(rejected.politics!.commitments.length, 0);
});

test('a 577-seat tally and its next dossier replay identically after save restoration', () => {
  let game = start('national', 0, 'equilibre', 10);
  game = decide(game, choicesFor(game).find(choice => choice.id === 'pol-wealth-hospital-package')!.id);
  const original = encode(game);
  const restored = decode(original);
  assert.deepEqual(restored, game);
  const nextChoices = choicesFor(restored);
  assert.equal(nextChoices.some(choice => choice.id === 'pol-coalition-compromise'), true);
  assert.deepEqual(choicesFor(decode(encode(restored))), nextChoices);
  const replayed = decide(restored, nextChoices.find(choice => choice.id === 'pol-coalition-compromise')!.id);
  assert.deepEqual(decode(encode(replayed)), replayed);
  assert.equal(replayed.politics!.votes.length, 2);
  for (const record of replayed.politics!.votes) tallyIsComplete(record);
  assert.deepEqual(replayed, decide(game, nextChoices.find(choice => choice.id === 'pol-coalition-compromise')!.id));
});

test('a refused ally bargain leads to a real censure, cabinet change and election that governs later votes', () => {
  let game = start('national', 0, 'equilibre', 10);
  const pick = (id: string) => {
    assert.ok(choicesFor(game).some(choice => choice.id === id), `expected reachable choice ${id} at decision ${game.turn}`);
    game = decide(game, id);
  };
  pick('pol-wealth-hospital-package');
  assert.equal(game.politics!.pendingCrisis, 'coalition');
  const seatsBefore = game.politics!.blocs.map(bloc => bloc.seats);
  pick('pol-coalition-refuse');
  assert.equal(game.politics!.pendingCrisis, 'censure');
  pick('pol-censure-vote');
  const censure = game.politics!.lastVote!;
  assert.equal(censure.kind, 'censure');
  assert.equal(censure.passed, true);
  assert.equal(game.politics!.cabinet, 'fallen');
  assert.equal(game.politics!.ending, undefined, 'censure alone must not end the presidential mandate');
  pick('pol-cabinet-dissolve');
  assert.equal(game.politics!.lastVote!.kind, 'election');
  assert.equal(game.politics!.lastVote!.passed, true);
  const newSeats = game.politics!.blocs.map(bloc => bloc.seats);
  assert.equal(newSeats.reduce((a,b)=>a+b,0),577);
  assert.notDeepEqual(newSeats,seatsBefore);
  const next = choicesFor(game)[0];
  game = decide(game,next.id);
  for (const bloc of game.politics!.blocs) {
    const group = game.politics!.lastVote!.groups.find(item=>item.id===bloc.id)!;
    assert.equal(group.for+group.against+group.abstain,bloc.seats,`${bloc.label} post-election vote count follows its new seats`);
  }
  assert.equal(game.politics!.ending, undefined);
  assert.ok(choicesFor(game).length > 0, 'a surviving elected government continues to accept decisions');
  assert.deepEqual(decode(encode(game)),game);
});

test('cover-ups escalate to a distinct destitution route that ends early and survives replay', () => {
  const ids = ['pol-wealth-hospital-package','pol-coalition-compromise','u24c','r03c','r04c','u03c','r05c','r06c','u02c','r07c','r08c','u05c',
    'pol-scandal-cover-up','pol-scandal-cover-up','pol-scandal-cover-up','pol-scandal-cover-up','pol-scandal-publish','pol-censure-vote','pol-destitution-vote'];
  let game = replay('national',27,ids,10,'equilibre');
  assert.equal(game.turn,19);
  assert.equal(isFinished(game),true);
  assert.equal(game.politics!.ending?.kind,'destitution');
  assert.equal(game.politics!.ending?.turn,19);
  assert.equal(game.politics!.misconduct,8);
  const procedure=game.politics!.lastVote!;
  assert.equal(procedure.kind,'destitution');
  assert.equal(procedure.passed,true);
  assert.deepEqual(procedure.stages?.map(stage=>[stage.total,stage.threshold,stage.for,stage.passed]),[[577,385,413,true],[348,232,255,true],[925,617,663,true]]);
  assert.deepEqual(choicesFor(game),[]);
  assert.throws(()=>decide(game,'pol-destitution-vote'));
  const restored=decode(encode(game));
  assert.deepEqual(restored,game);
  assert.deepEqual(replay('national',27,restored.choices,10,'equilibre'),game);
});

test('v9 remains politically frozen while v10 can continue to an early ending', () => {
  const legacy = start('national', 42, 'equilibre', 9);
  assert.equal(legacy.politics, undefined);
  assert.equal(choicesFor(legacy).some(choice => choice.political), false);
  const political = start('national', 42, 'equilibre', 10);
  assert.ok(political.politics);
  assert.equal(political.version, 10);
});
