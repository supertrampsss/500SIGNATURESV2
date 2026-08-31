import assert from "node:assert/strict";
import { test } from "node:test";

import { advanceCampaign } from "./flow.ts";
import { SCENARIO_V3_PREVIEW } from "./scenario.ts";
import { createTestCampaign, validCampaignState, validScenario } from "./test-fixtures.ts";
import type { CampaignState, CrisisRule } from "./types.ts";
import { positionAfterCompleted } from "./validation.ts";

const crisis: CrisisRule = {
  id: "opinion-crisis",
  title: "Le pays se fracture",
  body: "La contestation bloque le mandat.",
  indicator: "opinion",
  threshold: 10,
  comparator: "lte",
  aggravatingDecisionIds: ["decision-1"],
  concessions: [],
  holdCourseEffects: [],
};

test("une conséquence échue occupe un écran avant la transition normale", () => {
  const scenario = validScenario();
  const state = validCampaignState(scenario);
  state.indicators.opinion = 50;
  state.scheduledEvents = [{
    id: "event-1",
    sourceDecisionId: "decision-1",
    sourceOptionId: "decision-1-option-a",
    dueAtDecision: 1,
    title: "La réforme revient",
    body: "Son coût politique apparaît.",
    effects: [{
      id: "event-opinion",
      target: "indicator",
      key: "opinion",
      delta: -4,
      timing: { kind: "immediate" },
      duration: "once",
      explanation: "La contestation progresse.",
    }],
  }];

  const event = advanceCampaign(state, scenario, []);
  assert.equal(event.phase, "delayed_event");
  assert.equal(event.indicators.opinion, 50);
  assert.equal(event.scheduledEvents.length, 1);
  assert.equal(event.eventHistory.length, 0);

  const next = advanceCampaign(event, scenario, []);
  assert.equal(next.phase, "decision");
  assert.equal(next.decisionIndex, 1);
  assert.equal(next.indicators.opinion, 46);
  assert.equal(next.eventHistory.at(-1)?.id, "event-1");
  assert.equal(next.causalLedger.filter((entry) => entry.sourceId === "event-1").length, 1);
});

test("une crise causée par la dernière décision précède le dossier suivant", () => {
  const scenario = validScenario();
  const state = validCampaignState(scenario);

  const result = advanceCampaign(state, scenario, [crisis]);

  assert.equal(result.phase, "crisis");
  assert.equal(result.activeCrisis?.ruleId, "opinion-crisis");
  assert.equal(result.activeCrisis?.triggeredByDecisionId, "decision-1");
  assert.equal(result.decisionIndex, 0);
});

test("un événement est lu avant la crise qu'il déclenche", () => {
  const scenario = validScenario();
  const state = validCampaignState(scenario);
  state.indicators.opinion = 12;
  state.scheduledEvents = [{
    id: "event-trigger",
    sourceDecisionId: "decision-1",
    sourceOptionId: "decision-1-option-a",
    dueAtDecision: 1,
    title: "Le choc arrive",
    body: "L'opinion décroche.",
    effects: [{
      id: "event-trigger-opinion",
      target: "indicator",
      key: "opinion",
      delta: -3,
      timing: { kind: "immediate" },
      duration: "once",
      explanation: "Le seuil de crise est franchi.",
    }],
  }];

  const event = advanceCampaign(state, scenario, [crisis]);
  assert.equal(event.phase, "delayed_event");
  assert.equal(event.activeCrisis, undefined);
  assert.equal(event.indicators.opinion, 12);

  const crisisState = advanceCampaign(event, scenario, [crisis]);
  assert.equal(crisisState.phase, "crisis");
  assert.equal(crisisState.indicators.opinion, 9);
  assert.equal(crisisState.activeCrisis?.ruleId, "opinion-crisis");
});

test("la quatrième décision mène directement au dossier suivant", () => {
  const scenario = validScenario();
  const state = validCampaignState(scenario);
  state.indicators.opinion = 50;
  state.decisions = scenario.decisions.slice(0, 4).map((decision, index) => ({
    decisionId: decision.id,
    optionId: decision.options[0]!.id,
    status: "confirmed" as const,
    confirmedAtIndex: index + 1,
  }));
  state.decisionIndex = 3;

  const result = advanceCampaign(state, scenario, []);

  assert.equal(result.phase, "decision");
  assert.equal(result.decisionIndex, 4);
});

function stateAfterPreviewDecisions(count: number): CampaignState {
  return {
    ...createTestCampaign(SCENARIO_V3_PREVIEW),
    phase: "decision_result",
    ...positionAfterCompleted(SCENARIO_V3_PREVIEW, count)!,
    decisions: SCENARIO_V3_PREVIEW.decisions.slice(0, count).map((decision, index) => ({
      decisionId: decision.id,
      optionId: decision.options[0]!.id,
      status: "confirmed" as const,
      confirmedAtIndex: index + 1,
    })),
  };
}

test("les cinq Conseils surviennent uniquement après 16, 32, 39, 53 et 60 décisions", () => {
  const councilCounts = [16, 32, 39, 53, 60];
  for (const count of councilCounts) {
    const result = advanceCampaign(stateAfterPreviewDecisions(count), SCENARIO_V3_PREVIEW, []);
    assert.equal(result.phase, "council", `Conseil attendu après ${count} décisions`);
    assert.equal(result.annualCheckpoints.at(-1)?.afterDecisionCount, count);
  }
  for (const count of [8, 24, 46]) {
    const result = advanceCampaign(stateAfterPreviewDecisions(count), SCENARIO_V3_PREVIEW, []);
    assert.equal(result.phase, "chapter_intro", `aucun Conseil attendu après ${count} décisions`);
  }
});

test("le Conseil final précède le verdict", () => {
  const council = advanceCampaign(stateAfterPreviewDecisions(60), SCENARIO_V3_PREVIEW, []);
  assert.equal(council.phase, "council");
  assert.equal(advanceCampaign(council, SCENARIO_V3_PREVIEW, []).phase, "verdict");
});

test("une conséquence différée est résolue avant le Conseil annuel", () => {
  const state = stateAfterPreviewDecisions(16);
  state.scheduledEvents = [{
    id: "annual-event",
    sourceDecisionId: state.decisions[0]!.decisionId,
    sourceOptionId: state.decisions[0]!.optionId,
    dueAtDecision: 16,
    title: "Le solde est révisé",
    body: "La conséquence annuelle est publiée.",
    effects: [{
      id: "annual-event-balance",
      target: "indicator",
      key: "annualBalance",
      delta: 1_000,
      timing: { kind: "immediate" },
      duration: "annual",
      explanation: "Le solde annuel progresse.",
    }],
  }];

  const delayed = advanceCampaign(state, SCENARIO_V3_PREVIEW, []);
  assert.equal(delayed.phase, "delayed_event");
  const council = advanceCampaign(delayed, SCENARIO_V3_PREVIEW, []);
  assert.equal(council.phase, "council");
  assert.equal(council.annualCheckpoints[0]?.annualBalance, state.indicators.annualBalance + 1_000);
  assert.ok(council.annualCheckpoints[0]?.causes.includes("event:annual-event:annual-event-balance:1"));
});
