import assert from "node:assert/strict";
import test from "node:test";

import { stateForE2ePhase } from "./mobile-fixtures.ts";
import { SCENARIO_V10 } from "./scenario-v10.ts";

test("les cinq scènes E2E V10 proviennent du reducer et restent atteignables", () => {
  for (const phase of ["decision", "decision_result", "council", "crisis", "verdict"] as const) {
    const state = stateForE2ePhase(phase, SCENARIO_V10);
    assert.equal(state.phase, phase);
    assert.ok(state.decisions.length <= SCENARIO_V10.decisions.length);
  }
});
