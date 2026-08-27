import assert from "node:assert/strict";
import { test } from "node:test";

import { assertNoEmDash, isCampaignState, validateScenario } from "./validation.ts";
import { validCampaignState, validScenario } from "./test-fixtures.ts";

test("un scénario valide contient huit chapitres de douze décisions uniques", () => {
  assert.deepEqual(validateScenario(validScenario()), []);
});

test("la validation refuse un scénario incomplet et un choix sans preuve", () => {
  const scenario = validScenario();
  scenario.chapters[0]!.decisionIds.pop();
  scenario.decisions[0]!.evidence = [];
  assert.deepEqual(validateScenario(scenario), [
    "chapter:chapter-1:expected-12-decisions",
    "decision:decision-1:evidence-required",
  ]);
});

test("le contrôle éditorial trouve tout cadratin dans un objet imbriqué", () => {
  assert.deepEqual(assertNoEmDash({ title: "Avant\u2014après", nested: ["ok"] }), ["$.title"]);
});

test("un état V2 n'est jamais accepté comme état V3", () => {
  assert.equal(isCampaignState({ version: 2, phase: "conseil" }, validScenario()), false);
});

test("la validation refuse un identifiant répété dans les chapitres", () => {
  const scenario = validScenario();
  scenario.chapters[0]!.decisionIds[11] = "decision-1";
  assert.ok(validateScenario(scenario).includes("chapter:chapter-1:duplicate-decision:decision-1"));
  assert.ok(validateScenario(scenario).includes("decision:decision-12:expected-once-in-chapters"));
});

test("un état V3 complet est accepté", () => {
  const scenario = validScenario();
  assert.equal(isCampaignState(validCampaignState(scenario), scenario), true);
});

test("un état V3 refuse chaque DecisionRecord malformé", () => {
  const scenario = validScenario();
  const cases = [
    { optionId: "decision-2-option-a" },
    { status: "invalid" },
    { confirmedAtIndex: 0 },
    { changedByCrisisId: 12 },
  ];
  for (const mutation of cases) {
    const state = validCampaignState(scenario) as unknown as Record<string, unknown>;
    const record = (state.decisions as Record<string, unknown>[])[0]!;
    Object.assign(record, mutation);
    assert.equal(isCampaignState(state, scenario), false);
  }
});

test("un état V3 exige les clés exactes des indicateurs et groupes", () => {
  const scenario = validScenario();
  const cases: Array<["indicators" | "groups", string, boolean]> = [
    ["indicators", "growth", false],
    ["indicators", "unknown", true],
    ["groups", "farmers", false],
    ["groups", "unknown", true],
  ];
  for (const [field, key, add] of cases) {
    const state = validCampaignState(scenario) as unknown as Record<string, Record<string, unknown>>;
    if (add) state[field][key] = 0;
    else delete state[field][key];
    assert.equal(isCampaignState(state, scenario), false);
  }
});
