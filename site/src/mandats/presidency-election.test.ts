import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startPresidency, decidePresidency, presidencyEvents, presidencyPoliticalActions } from './presidency-engine.ts';
import { encode, decode } from './storage.ts';
import { presidencyPanel } from './presidency-view.ts';

test('dissolution begins a campaign, then publishes an election exactly once', () => {
  let game = decidePresidency(startPresidency(2), 'live-autonomy');
  for (let i = 0; i < 28 && game.politics?.pendingCrisis !== 'cabinet'; i++) {
    game = decidePresidency(game, 'live-tick');
  }
  assert.equal(game.politics!.pendingCrisis, 'cabinet');
  const seatsBefore = game.politics!.blocs.map(bloc => bloc.seats);
  assert.ok(presidencyPoliticalActions(game).some(choice => choice.id === 'pol-cabinet-dissolve'));
  game = decidePresidency(game, 'pol-cabinet-dissolve');
  assert.deepEqual(game.politics!.blocs.map(bloc => bloc.seats), seatsBefore);
  assert.ok(game.presidency!.pendingElection);
  assert.ok(presidencyEvents(game).some(event => event.id === 'political-campaign'));
  assert.ok(!presidencyPoliticalActions(game).some(choice => choice.id === 'pol-cabinet-dissolve'));
  assert.deepEqual(decode(encode(game)), game);
  game = decidePresidency(game, 'live-tick');
  assert.equal(game.presidency!.pendingElection, undefined);
  assert.equal(game.politics!.lastVote?.kind, 'election');
  const electionResult = presidencyPanel(game, 'government');
  assert.match(electionResult, /Élections législatives · sièges/);
  assert.match(electionResult, /sièges/);
  assert.doesNotMatch(electionResult, /0 pour · 0 contre/);
  assert.equal(game.politics!.blocs.reduce((sum, bloc) => sum + bloc.seats, 0), 577);
  assert.equal(game.politics!.votes.filter(vote => vote.kind === 'election').length, 1);
  assert.deepEqual(decode(encode(game)), game);
});
