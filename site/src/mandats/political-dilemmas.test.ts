import test from 'node:test';
import assert from 'node:assert/strict';
import { start } from './engine.ts';
import { initialPolitics } from './politics.ts';
import { politicalDossier, POLITICAL_ACTIONS } from './political-dilemmas.ts';
import type { Game } from './types.ts';
import type { PendingCrisis } from './politics-types.ts';

const game = (turn = 0): Game => {
  const g = start('national', 17, 'equilibre', 10);
  g.turn = turn;
  g.politics = initialPolitics(g.seed);
  return g;
};
const setPromise = (g: Game) => {
  g.politics!.commitments.push({ id: 'wealth-hospital', label: 'Prélèvement patrimonial et financement hospitalier votés', dueTurn: 1, status: 'pending' });
};
const findChoice = (g: Game, crisis: PendingCrisis, id: string) => {
  g.politics!.pendingCrisis = crisis;
  return politicalDossier(g)!.choices.find(choice => choice.id === id)!;
};

test('the opening wealth levy and hospital credits form an actual, vote-gated package', () => {
  const g = game();
  const d = politicalDossier(g)!;
  assert.equal(d.choices[0].id, 'pol-wealth-hospital-package');
  assert.equal(d.choices[0].effect.revenue, 6);
  assert.equal(d.choices[0].effect.operating, 4);
  assert.equal(d.choices[0].political?.commitment?.id, 'wealth-hospital');
  assert.equal(d.choices[0].political?.action, 'enact');
  assert.equal(d.choices[1].effect.operating, undefined);
  assert.match(d.choices[0].cost, /recettes/);
});

test('the ally bargain cannot appear without the enacted package commitment', () => {
  const g = game(1);
  g.politics!.pendingCrisis = 'coalition';
  assert.equal(politicalDossier(g), null);
  setPromise(g);
  const d = politicalDossier(g)!;
  assert.equal(d.choices[0].id, 'pol-coalition-compromise');
  assert.equal(d.choices[0].effect.revenue, -6);
  assert.equal(d.choices[0].effect.operating, -4);
  assert.equal(d.choices[0].political?.breakCommitment, 'wealth-hospital');
  assert.equal(d.choices[1].id, 'pol-coalition-refuse');
  assert.equal(d.choices[1].political?.action, 'reject_bargain');
  assert.equal(d.choices[1].political?.vote, undefined); // Engine maps reject_bargain to an Assembly law vote.
});

test('political dossiers map to concrete engine actions and costly alternatives', () => {
  const g = game(11);
  const cases: Array<[PendingCrisis, string, string]> = [
    ['censure', 'pol-censure-vote', 'censure'],
    ['cabinet', 'pol-cabinet-cohabitation', 'coalition_government'],
    ['scandal', 'pol-scandal-publish', 'publish_scandal'],
    ['destitution', 'pol-destitution-vote', 'destitute'],
    ['rupture', 'pol-rupture-negotiate', 'negotiate_rupture'],
  ];
  for (const [crisis, id, action] of cases) {
    const choice = findChoice(g, crisis, id);
    assert.ok(choice, `${crisis} choice is present`);
    assert.equal(choice.political?.action, action);
    assert.ok(choice.title.length > 12 && choice.sacrifice.length > 12);
  }
  assert.ok(POLITICAL_ACTIONS.includes('emergency_rule'));
  assert.equal(findChoice(g, 'censure', 'pol-censure-withdraw').political?.action, 'coalition_bargain');
  g.politics!.pendingCrisis = 'cabinet';
  const accord = politicalDossier(g)!.choices[0];
  assert.equal(accord.political?.vote, 'law');
  assert.equal(accord.effect.operating, -2, 'no unpassed wealth/hospital funding is removed');
  assert.equal(accord.effect.revenue, undefined);
  const transition = findChoice(g, 'destitution', 'pol-destitution-transition');
  assert.equal(transition.political?.action, 'negotiate_rupture');
});

test('rupture is only selected by institutional crisis state, not low trust or popularity alone', () => {
  const g = game(20);
  g.metrics.trust = 0;
  g.politics!.legitimacy = 1;
  g.politics!.unrest = 99;
  g.politics!.cabinet = 'fallen';
  assert.equal(politicalDossier(g), null);
  const coverUp = findChoice(g, 'scandal', 'pol-scandal-cover-up');
  assert.equal(coverUp.political?.legitimacy, -12);
  assert.equal(coverUp.political?.unrest, 18);
  const d = findChoice(g, 'rupture', 'pol-rupture-emergency');
  assert.equal(d.political?.action, 'emergency_rule');
  assert.equal(d.political?.legitimacy, -22);
  assert.equal(d.political?.unrest, 12);
  assert.equal(d.effect.operating, 4);
  assert.equal(d.effect.services, 3);
  g.politics!.emergencyUses = 1;
  g.politics!.pendingCrisis = 'rupture';
  const secondEmergency = politicalDossier(g)!.choices.find(choice => choice.id === 'pol-rupture-emergency')!;
  assert.match(secondEmergency.title, /seconde fois/);
  assert.match(secondEmergency.sacrifice, /mandat s’achève/);
});

test('political choice IDs use the frozen `pol-` namespace and no generic hold-the-course option', () => {
  const g = game();
  const all: string[] = [];
  const crisisIds: PendingCrisis[] = ['coalition', 'censure', 'cabinet', 'scandal', 'destitution', 'rupture'];
  for (const crisis of crisisIds) {
    if (crisis === 'coalition') setPromise(g);
    g.politics!.pendingCrisis = crisis;
    all.push(...(politicalDossier(g)?.choices.map(c => c.id) ?? []));
  }
  assert.ok(all.length > 10);
  assert.ok(all.every(id => id.startsWith('pol-')));
  const copy = JSON.stringify(all).toLowerCase();
  assert.doesNotMatch(copy, /maintenir le cap|maintenir la réforme|continuer comme avant/);
});

test('a seeded public-accounts scandal is reachable through ordinary play after turn 12', () => {
  const g = game(12);
  g.seed = 12;
  assert.equal(politicalDossier(g)?.choices[0].id, 'pol-scandal-publish');
  g.seed = 13;
  assert.equal(politicalDossier(g), null);
});
