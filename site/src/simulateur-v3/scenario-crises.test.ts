import assert from "node:assert/strict";
import { test } from "node:test";

import { INITIAL_INDICATORS, createCampaign, selectOption } from "./campaign.ts";
import { detectCrisis, resolveCrisis } from "./crises.ts";
import { confirmSelection } from "./effects.ts";
import { SCENARIO_V3_CRISIS_RULES } from "./scenario-crises.ts";
import { SCENARIO_V3_PREVIEW } from "./scenario.ts";

test("le premier chapitre contient une conséquence différée lisible", () => {
  const decision = SCENARIO_V3_PREVIEW.decisions.find((candidate) => candidate.id === "tranche-a-50-au-dela-de-250");
  const option = decision?.options.find((candidate) => candidate.id.endsWith(":apply"));

  assert.equal(option?.scheduledEvents.length, 1);
  assert.equal(option?.scheduledEvents[0]?.afterDecisions, 1);
  assert.match(option?.scheduledEvents[0]?.title ?? "", /tranche|départs/i);
  assert.ok((option?.scheduledEvents[0]?.effects.length ?? 0) > 0);
});

test("la crise de la flat tax cite la réforme et permet de la suspendre réellement", () => {
  const scenario = SCENARIO_V3_PREVIEW;
  const decision = scenario.decisions[0]!;
  const apply = decision.options.find((option) => option.id.endsWith(":apply"))!;
  const started = { ...createCampaign(scenario), phase: "decision" as const };
  const confirmed = confirmSelection(selectOption(started, scenario, decision.id, apply.id), scenario);

  const crisis = detectCrisis(confirmed, SCENARIO_V3_CRISIS_RULES);
  assert.equal(crisis.phase, "crisis");
  assert.equal(crisis.activeCrisis?.triggeredByDecisionId, decision.id);

  const suspended = resolveCrisis(crisis, SCENARIO_V3_CRISIS_RULES, "suspend-flat-tax");
  assert.equal(suspended.decisions[0]?.status, "suspended");
  assert.equal(suspended.decisions[0]?.changedByCrisisId, "flat-tax-revolt");
  assert.equal(suspended.indicators.annualBalance, INITIAL_INDICATORS.annualBalance);
  assert.equal(suspended.crisisHistory[0]?.resolvedBy, "suspend-flat-tax");
});

test("maintenir le cap conserve la réforme mais aggrave la crise politique", () => {
  const scenario = SCENARIO_V3_PREVIEW;
  const decision = scenario.decisions[0]!;
  const apply = decision.options.find((option) => option.id.endsWith(":apply"))!;
  const started = { ...createCampaign(scenario), phase: "decision" as const };
  const confirmed = confirmSelection(selectOption(started, scenario, decision.id, apply.id), scenario);
  const crisis = detectCrisis(confirmed, SCENARIO_V3_CRISIS_RULES);

  const held = resolveCrisis(crisis, SCENARIO_V3_CRISIS_RULES, "hold-course");

  assert.equal(held.decisions[0]?.status, "confirmed");
  assert.ok(held.indicators.opinion < confirmed.indicators.opinion);
  assert.ok(held.indicators.majority < confirmed.indicators.majority);
});

test("les textes des crises ne contiennent aucun cadratin", () => {
  assert.equal(JSON.stringify(SCENARIO_V3_CRISIS_RULES).includes("\u2014"), false);
});
