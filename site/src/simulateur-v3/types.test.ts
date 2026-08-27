import assert from "node:assert/strict";
import { test } from "node:test";

import { SCHEMA_VERSION, type CampaignState, type Decision, type DecisionOption } from "./types.ts";

test("le schéma V3 représente une décision confirmable et une campagne versionnée", () => {
  const option: DecisionOption = {
    id: "maintenir",
    label: "Maintenir le cap",
    summary: "La politique reste en vigueur.",
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
    chapterId: "chapitre-test",
    title: "Que décider ?",
    context: "Un contexte testable.",
    options: [option],
    evidence: [],
    dependencies: [],
    conflicts: [],
  };
  const state = { schemaVersion: 3, scenarioVersion: 1 } as CampaignState;
  assert.equal(SCHEMA_VERSION, 3);
  assert.equal(decision.options[0]?.id, "maintenir");
  assert.equal(state.schemaVersion, 3);
});
