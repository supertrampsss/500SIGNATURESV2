import assert from "node:assert/strict";
import { test } from "node:test";

import { assertNoEmDash, isCampaignState, validateScenario } from "./validation.ts";
import { validScenario } from "./test-fixtures.ts";

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
