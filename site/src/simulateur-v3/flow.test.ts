import assert from "node:assert/strict";
import { test } from "node:test";

import { advanceCampaign } from "./flow.ts";
import { validCampaignState, validScenario } from "./test-fixtures.ts";
import type { CrisisRule } from "./types.ts";

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
