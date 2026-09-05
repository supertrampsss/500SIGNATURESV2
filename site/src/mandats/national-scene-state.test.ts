import test from 'node:test';
import assert from 'node:assert/strict';
import { choicesFor, decide, start } from './engine.ts';
import { nationalSceneState } from './national-scene-state.ts';
import { decode, encode } from './storage.ts';

test('France scene preserves delivery timing and survives resume over all 45 decisions', () => {
  let game = start('national', 42, 'equilibre', 4);
  for (let i = 0; i < 45; i++) {
    const choice = choicesFor(game)[0];
    game = decide(game, choice.id);
    const state = nationalSceneState(game);
    assert.deepEqual(nationalSceneState(decode(encode(game))), state);
    const project = state.projects.find(p => p.id === choice.id);
    if (choice.effect.investment && choice.delayed && game.pending.some(p => p.label === choice.delayed!.label)) {
      assert.equal(project?.state, 'planned');
    }
    if (!choice.effect.investment) assert.equal(project, undefined);
  }
  assert.equal(game.turn, 45);
});

test('inherited France hides player projects and restores initial indicators', () => {
  let game = start('national', 42, 'equilibre', 4);
  const initial = nationalSceneState(game);
  for (let i = 0; i < 12; i++) game = decide(game, choicesFor(game)[0].id);
  const inherited = nationalSceneState(game, true, true);
  assert.deepEqual(inherited.areas, initial.areas);
  assert.deepEqual(inherited.projects, []);
  assert.equal(inherited.assets, initial.assets);
  assert.equal(inherited.turn, 0);
  assert.equal(inherited.reducedMotion, true);
});
