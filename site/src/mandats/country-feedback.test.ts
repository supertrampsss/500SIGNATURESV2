import test from 'node:test';
import assert from 'node:assert/strict';
import { choicesFor, decide, domainFor, start, startingGame } from './engine.ts';
import { nationalSceneState } from './national-scene-state.ts';
import { countryFeedback } from './country-feedback.ts';

test('scene feedback names only the committed choice and follows its affected area', () => {
  let game = start('national', 17, 'equilibre', 4);
  const selected = choicesFor(game).find(choice => choice.effect.investment && choice.delayed) ?? choicesFor(game)[0];
  game = decide(game, selected.id);
  const feedback = countryFeedback(game, nationalSceneState(game));
  assert.equal(feedback.title, `Profil · ${feedback.focus === 'national' ? 'France' : feedback.focus === 'metropoles' ? 'Métropoles' : feedback.focus === 'industrie' ? 'Industrie' : feedback.focus === 'rural' ? 'Territoires ruraux' : 'Littoraux'}`);
  assert.match(feedback.copy, /depuis la décision précédente|après cette décision|Pas de variation/);
  assert.equal(feedback.focus, nationalSceneState(game).focus);
  assert.match(feedback.progress, /livrés|projet financé/);
});

test('progress counts only committed projects and inherited feedback resets to baseline', () => {
  let game = start('national', 17, 'equilibre', 4);
  const baseline = countryFeedback(game, nationalSceneState(game));
  assert.equal(baseline.progressPercent, 0);
  assert.equal(baseline.title, 'Votre première décision attend');
  assert.match(baseline.copy, /Choisissez une mesure/);
  for (let i = 0; i < 12; i++) game = decide(game, choicesFor(game)[i % choicesFor(game).length].id);
  const now = countryFeedback(game, nationalSceneState(game));
  const inherited = countryFeedback(game, nationalSceneState(game, true));
  assert.match(now.progress, /projets livrés|projet financé/);
  assert.equal(inherited.title, 'Point de départ');
  assert.equal(inherited.progress, 'Repère initial · aucun projet engagé');
  assert.equal(inherited.progressPercent, 0);
});

test('scene reaction reports measured positive and negative service changes', () => {
  const initial = start('national', 21, 'equilibre', 4);
  const dossiers = domainFor(initial).dossiers;
  const positive = dossiers.flatMap(dossier => dossier.choices).find(choice => (choice.effect.services ?? 0) > 0);
  const negative = dossiers.flatMap(dossier => dossier.choices).find(choice => (choice.effect.services ?? 0) < 0);
  assert.ok(positive && negative);
  const playChoice = (dossierIndex: number, choiceId: string) => {
    let game = start('national', 21, 'equilibre', 4);
    while (game.turn <= dossierIndex) {
      const choice = choicesFor(game).find(item => item.id === choiceId) ?? choicesFor(game)[0];
      game = decide(game, choice.id);
    }
    return game;
  };
  for (const [choice, sign, dossierIndex] of [[positive, '+', dossiers.findIndex(d => d.choices.some(c => c.id === positive.id))], [negative, '−', dossiers.findIndex(d => d.choices.some(c => c.id === negative.id))]] as const) {
    const game = playChoice(dossierIndex, choice.id);
    const actual = game.history.at(-1)!.metrics.services - (game.history.at(-2)?.metrics.services ?? domainFor(game).initial().metrics.services);
    const feedback = countryFeedback(game, nationalSceneState(game));
    assert.equal(actual > 0 ? '+' : '−', sign);
    assert.match(feedback.copy, new RegExp(`Services publics : ${sign}`));
    assert.match(feedback.copy, new RegExp(`${Math.abs(actual)} point`));
    assert.match(feedback.copy, /après cette décision|depuis la décision précédente/);
  }
});

test('first decision uses the selected ambition baseline and French decimal punctuation', () => {
  const gameAtStart = start('national', 38, 'services', 9);
  const choice = choicesFor(gameAtStart).find(item => item.effect.services || item.effect.assets || item.effect.cohesion || item.effect.resilience || item.effect.trust) ?? choicesFor(gameAtStart)[0];
  const game = decide(gameAtStart, choice.id);
  const baseline = startingGame(game).metrics;
  const history = game.history[0].metrics;
  const expected = [['services', 'Services publics'], ['assets', 'Équipements'], ['cohesion', 'Cohésion'], ['resilience', 'Résilience'], ['trust', 'Confiance']].find(([key]) => history[key as keyof typeof history] !== baseline[key as keyof typeof baseline]);
  const feedback = countryFeedback(game, nationalSceneState(game));
  if (expected) {
    assert.match(feedback.copy, new RegExp(`${expected[1]} : [−+]\\d`));
    assert.match(feedback.copy, /après cette décision/);
  }
  assert.doesNotMatch(feedback.copy, /\d\.\d/);
});
