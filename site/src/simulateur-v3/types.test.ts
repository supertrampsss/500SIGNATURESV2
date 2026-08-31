import assert from "node:assert/strict";
import { test } from "node:test";

import { SCHEMA_VERSION, type CampaignState, type Decision, type DecisionOption, type EffectRule } from "./types.ts";

test("le schéma V3 représente une décision confirmable et une campagne versionnée", () => {
  const option: DecisionOption = {
    id: "maintenir",
    label: "Maintenir le cap",
    summary: "La politique reste en vigueur.",
    mechanism: "Conserver le droit existant.",
    horizon: { kind: "immediate" },
    legalConstraints: [],
    budgetDuration: "annual",
    budgetTiming: { kind: "immediate" },
    beneficiaries: ["entreprises"],
    contributors: ["budget_public"],
    uncertainty: "moyenne",
    effects: [],
    scheduledEvents: [],
    promises: [],
    fulfillsPromises: [],
    locks: [],
    unlocks: [],
  };
  const decision: Decision = {
    id: "decision-test",
    version: 1,
    kind: "gestion",
    chapterId: "chapitre-test",
    title: "Que décider ?",
    context: "Un contexte testable.",
    options: [option],
    evidence: [],
    dependencies: [],
    conflicts: [],
  };
  const state = { schemaVersion: 4, scenarioVersion: 1 } satisfies Pick<CampaignState, "schemaVersion" | "scenarioVersion">;
  const indicatorEffect = {
    id: "effect-test",
    target: "indicator",
    key: "growth",
    delta: 1,
    timing: { kind: "immediate" },
    duration: "once",
    explanation: "An indicator effect.",
  } satisfies EffectRule;
  const mandateYearEffect = {
    ...indicatorEffect,
    id: "effect-year-test",
    timing: { kind: "mandate_year", year: 3 },
  } satisfies EffectRule;
  assert.equal(SCHEMA_VERSION, 4);
  assert.equal(decision.options[0]?.id, "maintenir");
  assert.equal(state.schemaVersion, 4);
  assert.equal(indicatorEffect.key, "growth");
  assert.equal(mandateYearEffect.timing.year, 3);
});
