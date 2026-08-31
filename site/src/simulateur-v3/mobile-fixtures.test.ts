import assert from "node:assert/strict";
import test from "node:test";

import { currentDecision } from "./campaign.ts";
import { MOBILE_E2E_BASELINE, stateForE2ePhase } from "./mobile-fixtures.ts";
import { SCENARIO_V10 } from "./scenario-v10.ts";

test("les trois scènes E2E V10 visibles proviennent du reducer et restent atteignables", () => {
  for (const phase of ["decision", "crisis", "verdict"] as const) {
    const state = stateForE2ePhase(phase, SCENARIO_V10);
    assert.equal(state.phase, phase);
    assert.ok(state.decisions.length <= SCENARIO_V10.decisions.length);
  }
});

test("la fixture mobile EPR2 atteint le vrai dossier publié et sa baseline sourcée", () => {
  const state = stateForE2ePhase("decision", SCENARIO_V10, "epr2");

  assert.equal(state.phase, "decision");
  assert.equal(currentDecision(state, SCENARIO_V10)?.id, "engager-six-epr2-part-annuelle-de-l");
  assert.equal(MOBILE_E2E_BASELINE.period, "2025");
  assert.equal(MOBILE_E2E_BASELINE.sourceIds.length, 4);
});
