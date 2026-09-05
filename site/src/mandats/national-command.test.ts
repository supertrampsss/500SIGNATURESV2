import test from 'node:test';
import assert from 'node:assert/strict';
import { choicesFor, decide, start } from './engine.ts';
import { nationalCommandPulse, nationalDecisionImpact } from './national-command.ts';

test('France exposes the committed measure in three short facts at most', () => {
  let game = start('national', 42, 'equilibre', 4);
  assert.deepEqual(nationalDecisionImpact(game), []);
  game = decide(game, choicesFor(game)[0].id);
  assert.deepEqual(nationalDecisionImpact(game), [
    { label: 'Recettes +4 Md€/an', direction: 'up' },
    { label: 'Confiance −2', direction: 'down' },
  ]);
  const pulse = nationalCommandPulse(game);
  assert.match(pulse, /Effet immédiat/);
  assert.match(pulse, /Recettes \+4 Md€\/an/);
  assert.match(pulse, /Confiance −2/);
  assert.match(pulse, /Confiance<\/dt>/);
});

test('France impact remains concise when a measure changes several systems', () => {
  let game = start('national', 42, 'equilibre', 4);
  for (let turn = 0; turn < 3; turn++) game = decide(game, choicesFor(game)[0].id);
  assert.equal(nationalDecisionImpact(game).length, 3);
  assert.deepEqual(nationalDecisionImpact(game).map(item => item.label), [
    'Dépenses +2 Md€/an', 'Services +2', 'Cohésion +1',
  ]);
});
