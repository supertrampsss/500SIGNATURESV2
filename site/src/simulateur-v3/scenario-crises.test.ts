import assert from "node:assert/strict";
import { test } from "node:test";

import { currentDecision, selectOption } from "./campaign.ts";
import { resolveCrisis } from "./crises.ts";
import { confirmSelection } from "./effects.ts";
import { advanceCampaign } from "./flow.ts";
import { SCENARIO_V3_CRISIS_RULES } from "./scenario-crises.ts";
import { SCENARIO_V3_PREVIEW } from "./scenario.ts";
import { createTestCampaign as createCampaign, validScenario } from "./test-fixtures.ts";
import type { CampaignState } from "./types.ts";

const INITIAL_INDICATORS = createCampaign(validScenario()).indicators;

function playToFlatTaxCrisis(): CampaignState {
  const scenario = SCENARIO_V3_PREVIEW;
  let state: CampaignState = { ...createCampaign(scenario), phase: "chapter_intro" };
  for (let step = 0; step < 100 && state.phase !== "crisis"; step += 1) {
    if (state.phase === "decision") {
      const decision = currentDecision(state, scenario)!;
      const option = decision.id === "flat-tax-a-20-des-le-premier"
        ? decision.options.find((candidate) => candidate.id.endsWith(":adopt"))!
        : decision.options.at(-1)!;
      state = confirmSelection(selectOption(state, scenario, decision.id, option.id), scenario);
    } else {
      state = advanceCampaign(state, scenario, SCENARIO_V3_CRISIS_RULES);
    }
  }
  assert.equal(state.phase, "crisis");
  return state;
}

test("le premier chapitre contient une conséquence différée lisible", () => {
  const decision = SCENARIO_V3_PREVIEW.decisions.find((candidate) => candidate.id === "tranche-a-50-au-dela-de-250");
  const option = decision?.options.find((candidate) => candidate.id.endsWith(":adopt"));

  assert.equal(option?.scheduledEvents.length, 1);
  assert.ok((option?.scheduledEvents[0]?.afterDecisions ?? 0) > 0);
  assert.match(option?.scheduledEvents[0]?.title ?? "", /stress|assiette/i);
  assert.ok((option?.scheduledEvents[0]?.effects.length ?? 0) > 0);
});

test("la crise de la flat tax cite la réforme et permet de la suspendre réellement", () => {
  const crisis = playToFlatTaxCrisis();
  const decision = SCENARIO_V3_PREVIEW.decisions.find((candidate) => candidate.id === "flat-tax-a-20-des-le-premier")!;
  assert.equal(crisis.activeCrisis?.triggeredByDecisionId, decision.id);

  const suspended = resolveCrisis(crisis, SCENARIO_V3_CRISIS_RULES, "suspend-flat-tax");
  const flatTax = suspended.decisions.find((record) => record.decisionId === decision.id);
  assert.equal(flatTax?.status, "suspended");
  assert.equal(flatTax?.changedByCrisisId, "flat-tax-revolt");
  assert.equal(suspended.indicators.annualBalance, INITIAL_INDICATORS.annualBalance);
  assert.equal(suspended.crisisHistory[0]?.resolvedBy, "suspend-flat-tax");
});

test("maintenir le cap conserve la réforme mais aggrave la crise politique", () => {
  const crisis = playToFlatTaxCrisis();

  const held = resolveCrisis(crisis, SCENARIO_V3_CRISIS_RULES, "hold-course");

  assert.equal(held.decisions.find((record) => record.decisionId === "flat-tax-a-20-des-le-premier")?.status, "confirmed");
  assert.ok(held.indicators.opinion < crisis.indicators.opinion);
  assert.ok(held.indicators.majority < crisis.indicators.majority);
});

test("les textes des crises ne contiennent aucun cadratin", () => {
  assert.equal(JSON.stringify(SCENARIO_V3_CRISIS_RULES).includes("\u2014"), false);
});
