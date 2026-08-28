import assert from "node:assert/strict";
import test from "node:test";

import { createCampaign, currentDecision, selectOption } from "./campaign.ts";
import { availableConcessions, resolveCrisis } from "./crises.ts";
import { confirmSelection } from "./effects.ts";
import { advanceCampaign } from "./flow.ts";
import { SCENARIO_V3_CRISIS_RULES } from "./scenario-crises.ts";
import { SCENARIO_V3_PREVIEW } from "./scenario.ts";
import type { CampaignState } from "./types.ts";
import { isCampaignState } from "./validation.ts";

function playFullCampaign(optionIndex: 0 | 1): CampaignState {
  let state: CampaignState = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "chapter_intro" };

  for (let step = 0; step < 400 && state.phase !== "verdict"; step += 1) {
    if (state.phase === "decision") {
      const decision = currentDecision(state, SCENARIO_V3_PREVIEW);
      assert.ok(decision, `dossier introuvable après ${state.decisions.length} décisions`);
      const option = decision.options[optionIndex] ?? decision.options[0];
      assert.ok(option, `option introuvable pour ${decision.id}`);
      state = confirmSelection(selectOption(state, SCENARIO_V3_PREVIEW, decision.id, option.id), SCENARIO_V3_PREVIEW);
    } else if (state.phase === "crisis") {
      const concession = availableConcessions(state, SCENARIO_V3_CRISIS_RULES)[0];
      state = resolveCrisis(state, SCENARIO_V3_CRISIS_RULES, concession?.id ?? "hold-course");
    } else {
      state = advanceCampaign(state, SCENARIO_V3_PREVIEW, SCENARIO_V3_CRISIS_RULES);
    }

    assert.equal(isCampaignState(state, SCENARIO_V3_PREVIEW), true, `état invalide en phase ${state.phase}`);
  }

  return state;
}

test("les 96 dossiers restent jouables en choisissant toujours la première option", () => {
  const state = playFullCampaign(0);
  assert.equal(state.phase, "verdict");
  assert.equal(state.decisions.length, 96);
  assert.equal(new Set(state.decisions.map((decision) => decision.decisionId)).size, 96);
});

test("les 96 dossiers restent jouables en choisissant toujours la seconde option", () => {
  const state = playFullCampaign(1);
  assert.equal(state.phase, "verdict");
  assert.equal(state.decisions.length, 96);
  assert.equal(new Set(state.decisions.map((decision) => decision.decisionId)).size, 96);
});

test("deux lignes politiques opposées produisent des verdicts économiques et politiques différents", () => {
  const adoption = playFullCampaign(0);
  const statuQuo = playFullCampaign(1);

  assert.notEqual(adoption.indicators.growth, statuQuo.indicators.growth);
  assert.notEqual(adoption.indicators.majority, statuQuo.indicators.majority);
  assert.ok(adoption.causalLedger.some((entry) => entry.key === "growth"));
  assert.ok(adoption.causalLedger.some((entry) => entry.key === "majority"));
});
