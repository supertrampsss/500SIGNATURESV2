import assert from "node:assert/strict";
import { test } from "node:test";

import { selectOption } from "./campaign.ts";
import { detectCrisis, resolveCrisis } from "./crises.ts";
import { confirmSelection } from "./effects.ts";
import { SCENARIO_V3_CRISIS_RULES } from "./scenario-crises.ts";
import { SCENARIO_V3_PREVIEW } from "./scenario.ts";
import { createTestCampaign as createCampaign, validScenario } from "./test-fixtures.ts";

const INITIAL_INDICATORS = createCampaign(validScenario()).indicators;

function stateBefore(decisionId: string) {
  const index = SCENARIO_V3_PREVIEW.decisions.findIndex((decision) => decision.id === decisionId);
  const base = createCampaign(SCENARIO_V3_PREVIEW);
  return {
    ...base,
    phase: "decision" as const,
    decisionIndex: index,
    decisions: SCENARIO_V3_PREVIEW.decisions.slice(0, index).map((decision, decisionIndex) => ({
      decisionId: decision.id, optionId: decision.options.at(-1)!.id, status: "confirmed" as const, confirmedAtIndex: decisionIndex + 1,
    })),
  };
}

test("le premier chapitre contient une conséquence différée lisible", () => {
  const decision = SCENARIO_V3_PREVIEW.decisions.find((candidate) => candidate.id === "tranche-a-50-au-dela-de-250");
  const option = decision?.options.find((candidate) => candidate.id.endsWith(":adopt"));

  assert.equal(option?.scheduledEvents.length, 1);
  assert.ok((option?.scheduledEvents[0]?.afterDecisions ?? 0) > 0);
  assert.match(option?.scheduledEvents[0]?.title ?? "", /tranche|départs/i);
  assert.ok((option?.scheduledEvents[0]?.effects.length ?? 0) > 0);
});

test("la crise de la flat tax cite la réforme et permet de la suspendre réellement", () => {
  const scenario = SCENARIO_V3_PREVIEW;
  const decision = scenario.decisions.find((candidate) => candidate.id === "flat-tax-a-20-des-le-premier")!;
  const apply = decision.options.find((option) => option.id.endsWith(":adopt"))!;
  const started = stateBefore(decision.id);
  const confirmed = confirmSelection(selectOption(started, scenario, decision.id, apply.id), scenario);

  const crisis = detectCrisis(confirmed, SCENARIO_V3_CRISIS_RULES);
  assert.equal(crisis.phase, "crisis");
  assert.equal(crisis.activeCrisis?.triggeredByDecisionId, decision.id);

  const suspended = resolveCrisis(crisis, SCENARIO_V3_CRISIS_RULES, "suspend-flat-tax");
  assert.equal(suspended.decisions.at(-1)?.status, "suspended");
  assert.equal(suspended.decisions.at(-1)?.changedByCrisisId, "flat-tax-revolt");
  assert.equal(suspended.indicators.annualBalance, INITIAL_INDICATORS.annualBalance);
  assert.equal(suspended.crisisHistory[0]?.resolvedBy, "suspend-flat-tax");
});

test("maintenir le cap conserve la réforme mais aggrave la crise politique", () => {
  const scenario = SCENARIO_V3_PREVIEW;
  const decision = scenario.decisions.find((candidate) => candidate.id === "flat-tax-a-20-des-le-premier")!;
  const apply = decision.options.find((option) => option.id.endsWith(":adopt"))!;
  const started = stateBefore(decision.id);
  const confirmed = confirmSelection(selectOption(started, scenario, decision.id, apply.id), scenario);
  const crisis = detectCrisis(confirmed, SCENARIO_V3_CRISIS_RULES);

  const held = resolveCrisis(crisis, SCENARIO_V3_CRISIS_RULES, "hold-course");

  assert.equal(held.decisions.at(-1)?.status, "confirmed");
  assert.ok(held.indicators.opinion < confirmed.indicators.opinion);
  assert.ok(held.indicators.majority < confirmed.indicators.majority);
});

test("les textes des crises ne contiennent aucun cadratin", () => {
  assert.equal(JSON.stringify(SCENARIO_V3_CRISIS_RULES).includes("\u2014"), false);
});
