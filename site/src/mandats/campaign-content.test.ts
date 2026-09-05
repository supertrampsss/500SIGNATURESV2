import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_THREADS, LONG_CALENDARS, longDossiers } from './campaign-content.ts';
import type { Mode } from './types.ts';

for (const mode of ['municipal', 'national'] as const) {
  test(`${mode}: 45 dossiers réellement distincts, trois choix et calendrier cohérent`, () => {
    const dossiers = longDossiers(mode);
    assert.equal(dossiers.length, 45);
    assert.equal(new Set(dossiers.map(d => d.title)).size, 45);
    assert.equal(new Set(dossiers.map(d => d.story)).size, 45);
    assert.equal(LONG_CALENDARS[mode].reduce((sum, count) => sum + count, 0), 45);
    assert.equal(LONG_CALENDARS[mode].length, mode === 'municipal' ? 6 : 5);
    const ids = dossiers.flatMap(d => d.choices.map(c => c.id));
    assert.equal(new Set(ids).size, 135);
    for (const dossier of dossiers) {
      assert.equal(dossier.choices.length, 3);
      assert.equal(new Set(dossier.choices.map(c => c.title)).size, 3);
      assert.ok(dossier.story.length >= 60 && dossier.advisor.length >= 30);
      for (const choice of dossier.choices) {
        assert.match(choice.id, /^[a-z0-9]{1,24}$/);
        assert.ok(choice.description && choice.cost && choice.benefit && choice.sacrifice);
      }
    }
  });

  test(`${mode}: chaque dossier propose une voie sans financement nouveau`, () => {
    for (const dossier of longDossiers(mode)) {
      const safe = dossier.choices.some(({ effect, delayed }) => {
        const effects = [effect, ...(delayed ? [delayed.effect] : [])];
        return effects.every(e => (e.investment ?? 0) <= 0 && (e.operating ?? 0) <= 0 && (e.repayment ?? 0) <= 0 && (e.revenue ?? 0) >= 0);
      });
      assert.ok(safe, dossier.title);
    }
  });

  test(`${mode}: effets calibrés, délais annuels et extinction des aides identifiables`, () => {
    let delayedCount = 0;
    for (const dossier of longDossiers(mode)) for (const choice of dossier.choices) {
      const effects = [choice.effect, ...(choice.delayed ? [choice.delayed.effect] : [])];
      for (const effect of effects) {
        for (const key of ['services', 'cohesion', 'resilience', 'trust', 'assets'] as const) {
          assert.ok(Math.abs(effect[key] ?? 0) <= 3, `${choice.id}: ${key}`);
        }
        assert.ok(Math.abs(effect.operating ?? 0) <= (mode === 'municipal' ? .6 : 4));
        assert.ok(Math.abs(effect.revenue ?? 0) <= (mode === 'municipal' ? .6 : 4));
        assert.ok((effect.investment ?? 0) <= (mode === 'municipal' ? 3 : 8));
        assert.ok(Math.abs(effect.growth ?? 0) <= .0002);
      }
      if (choice.delayed) {
        delayedCount++;
        assert.ok(Number.isInteger(choice.delayed.after) && choice.delayed.after >= 1 && choice.delayed.after <= 2);
      }
      // A real-city adapter scales costs. Narrative must not retain reference-city amounts.
      for (const text of [choice.description, choice.benefit, choice.sacrifice, choice.delayed?.label ?? '']) assert.doesNotMatch(text, /\d[\d ,.]*\s*M(?:d)?€/);
    }
    assert.ok(delayedCount >= 8);
    const ids = mode === 'municipal' ? ['m18a'] : ['n19a', 'n20a', 'n21a', 'n37a'];
    for (const id of ids) {
      const choice = longDossiers(mode).flatMap(d => d.choices).find(c => c.id === id)!;
      assert.equal(choice.delayed?.after, 1);
      assert.equal(choice.delayed?.effect.operating, -(choice.effect.operating ?? 0), id);
    }
  });

  test(`${mode}: les fils ne supposent pas un chantier refusé et pointent des choix existants`, () => {
    const dossiers = longDossiers(mode);
    const choices = new Map(dossiers.flatMap((d, index) => d.choices.map(c => [c.id, { choice: c, index }] as const)));
    for (const thread of CAMPAIGN_THREADS[mode]) {
      const launch = choices.get(thread.launchChoice);
      assert.ok(launch, thread.id);
      assert.ok(launch.choice.delayed, `${thread.id} doit avoir une livraison propre`);
      assert.ok(thread.underway.length > 30 && thread.absent.length > 30);
      for (const index of thread.followUps) assert.ok(index > launch.index && index < 45, `${thread.id}: ${index}`);
    }
  });
}

test('les campagnes compilées sont indépendantes des adaptations de ville', () => {
  const before = longDossiers('municipal');
  const altered = longDossiers('municipal');
  altered[0].choices[0].effect.investment = 999;
  altered[0].choices[0].delayed!.effect.operating = 999;
  altered[0].title = 'Autre ville';
  assert.deepEqual(longDossiers('municipal'), before);
});

test('les identifiants ne se chevauchent pas entre modes', () => {
  const ids = (['municipal', 'national'] as Mode[]).flatMap(mode => longDossiers(mode).flatMap(d => d.choices.map(c => c.id)));
  assert.equal(new Set(ids).size, 270);
});
