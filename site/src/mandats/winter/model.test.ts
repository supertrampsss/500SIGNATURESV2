import test from "node:test";
import assert from "node:assert/strict";
import { INITIAL, choices, decide, restore, scene, summary } from "./model.ts";
import type { State } from "./model.ts";

test("the first emergency visibly changes homes, factories, and reserves", () => {
  const homes = decide(INITIAL, "chauffer");
  const factories = decide(INITIAL, "produire");
  const reserve = decide(INITIAL, "partager");
  assert.ok(homes.comfort > factories.comfort);
  assert.ok(factories.industry > homes.industry);
  assert.ok(reserve.budget > homes.budget && reserve.budget > factories.budget);
  assert.notDeepEqual(scene(homes), scene(factories));
  assert.equal(INITIAL.budget, 60);
  assert.deepEqual(INITIAL.choices, []);
  assert.ok(Object.isFrozen(homes) && Object.isFrozen(homes.choices));
});

test("spring investment is delivered only when months pass into the second winter", () => {
  const spring = decide(INITIAL, "chauffer");
  assert.equal(scene(spring).season, "spring");
  assert.equal(scene(spring).renovated, false);
  assert.match(choices(spring)[0].detail, /livré avant le deuxième hiver/);
  const winter = decide(spring, "isoler");
  assert.equal(scene(winter).season, "winter-return");
  assert.equal(winter.insulation, true);
  assert.equal(winter.pending, false);
  assert.equal(scene(winter).renovated, true);
  assert.match(scene(winter).caption, /travaux du printemps sont livrés/);
  assert.equal(scene(decide(spring, "reseau")).renovated, false);
  assert.ok(winter.comfort > decide(spring, "entretenir").comfort);
});

test("unaffordable decisions reject; a free recovery path always remains", () => {
  const low = decide(decide(INITIAL, "chauffer"), "isoler");
  assert.equal(low.budget, 6);
  assert.deepEqual(choices(low).map(choice => choice.disabled), [true, true, false]);
  assert.throws(() => decide(low, "foyers"), /insuffisante/);
  assert.throws(() => decide(low, "ateliers"), /insuffisante/);
  const end = decide(low, "sobriete");
  assert.equal(end.budget, 6);
  assert.deepEqual(choices(end), []);
  assert.throws(() => decide(end, "sobriete"), /terminées/);
  assert.throws(() => decide(INITIAL, "isoler"), /saison/);
});

test("all 27 candidate paths are checked and every valid branch can finish", () => {
  let completed = 0;
  let rejected = 0;
  const results: State[] = [];
  for (const first of choices(INITIAL)) {
    const spring = decide(INITIAL, first.id);
    for (const second of choices(spring)) {
      const winter = decide(spring, second.id);
      assert.equal(choices(winter).filter(choice => !choice.disabled && choice.cost === 0).length, 1);
      for (const third of choices(winter)) {
        if (third.disabled) {
          assert.throws(() => decide(winter, third.id));
          rejected++;
          continue;
        }
        const end = decide(winter, third.id);
        completed++;
        results.push(end);
        assert.ok(end.budget >= 0 && end.budget <= 60);
        assert.ok(end.comfort >= 0 && end.comfort <= 100);
        assert.ok(end.industry >= 0 && end.industry <= 100);
        assert.equal(end.turn, 3);
        assert.deepEqual(restore(JSON.stringify(end)), end);
        assert.match(summary(end).tradeoff, /indices de jeu/);
        assert.deepEqual(decide(winter, third.id), end);
      }
    }
  }
  assert.equal(completed + rejected, 27);
  assert.equal(completed, 21);
  assert.equal(rejected, 6);
  assert.ok(new Set(results.map(state => `${state.budget}/${state.comfort}/${state.industry}`)).size >= 15);
});

test("save restoration rejects malformed, forged, and out-of-sequence snapshots", () => {
  const valid = decide(decide(INITIAL, "chauffer"), "isoler");
  assert.deepEqual(restore(valid), valid);
  assert.deepEqual(restore(JSON.stringify(INITIAL)), INITIAL);
  for (const raw of [null, false, [], "not json", {}, { version: 1, choices: [] },
    { ...valid, version: 2 }, { ...valid, turn: 4 }, { ...valid, turn: 1 },
    { ...valid, choices: ["isoler", "chauffer"] }, { ...valid, choices: ["chauffer", 42] },
    { ...valid, budget: 999 }, { ...valid, comfort: NaN }, { ...valid, industry: Infinity },
    { ...valid, insulation: false }, { ...valid, pending: true }, { ...valid, extra: true },
    { ...valid, choices: ["chauffer", "isoler", "foyers"], turn: 3 },
  ]) assert.equal(restore(raw), null);
  const restored = restore(valid)!;
  assert.notEqual(restored, valid);
  assert.notEqual(restored.choices, valid.choices);
});

test("the final narrative distinguishes investment and final sacrifice", () => {
  const homes = decide(decide(decide(INITIAL, "partager"), "isoler"), "foyers");
  const factories = decide(decide(decide(INITIAL, "partager"), "reseau"), "ateliers");
  const reserve = decide(decide(decide(INITIAL, "partager"), "entretenir"), "sobriete");
  assert.match(summary(homes).benefit, /isolation/);
  assert.match(summary(homes).tradeoff, /réduit l’activité/);
  assert.match(summary(factories).benefit, /réseau/);
  assert.match(summary(factories).tradeoff, /réduit le confort/);
  assert.match(summary(reserve).benefit, /60 crédits/);
  assert.equal(new Set([homes, factories, reserve].map(state => summary(state).title)).size, 3);
});
