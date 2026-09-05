import test from 'node:test';
import assert from 'node:assert/strict';
import { choicesFor, decide, domainFor, start } from './engine.ts';
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

test('living France uses actual public-service and equipment indicators without changing finances', () => {
  let game = start('national', 42, 'equilibre', 4);
  for (let i = 0; i < 45; i++) {
    const before = encode(game);
    const { visual, projects } = nationalSceneState(game);
    const baseline = domainFor(game).initial().metrics;
    const visualLevel = (value: number, inherited: number) => Math.max(0, Math.min(1, .5 + (value - inherited) / 16));
    assert.equal(visual.warmth, visualLevel(game.metrics.services, baseline.services));
    assert.equal(visual.activity, visualLevel(game.metrics.assets, baseline.assets));
    assert.equal(visual.turn, game.turn);
    assert.equal(visual.construction, projects.some(p => p.state === 'planned'));
    assert.equal(visual.renovated, projects.some(p => p.state === 'delivered'));
    assert.match(visual.caption, /Décor illustratif du mandat national/);
    assert.equal(encode(game), before, 'rendering must not settle budgets or commit choices');
    game = decide(game, choicesFor(game)[i % 3].id);
  }
});

test('unfunded and unchosen projects never appear as construction or delivery', () => {
  let game = start('national', 42, 'equilibre', 4);
  assert.equal(nationalSceneState(game).visual.construction, false);
  assert.equal(nationalSceneState(game).visual.renovated, false);
  for (let i = 0; i < 45; i++) {
    const choices = choicesFor(game);
    const unfunded = choices.find(c => !(c.effect.investment && c.effect.investment > 0)) ?? choices[2];
    const unchosenIds = choices.filter(c => c.id !== unfunded.id).map(c => c.id);
    game = decide(game, unfunded.id);
    const state = nationalSceneState(game);
    for (const id of unchosenIds) assert.equal(state.projects.some(p => p.id === id), false);
    if ((unfunded.effect.investment ?? 0) <= 0) {
      assert.equal(state.projects.some(p => p.id === unfunded.id), false);
    }
  }
});

test('inherited living scene restores its initial appearance, not the current mandate outcomes', () => {
  let game = start('national', 42, 'equilibre', 4);
  const initial = nationalSceneState(game).visual;
  for (let i = 0; i < 20; i++) game = decide(game, choicesFor(game)[0].id);
  assert.deepEqual(nationalSceneState(game, true).visual, initial);
  assert.notDeepEqual(nationalSceneState(game).visual, initial);
});
