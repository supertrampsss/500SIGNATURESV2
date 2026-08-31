import assert from "node:assert/strict";
import { test } from "node:test";

import { currentDecision, selectOption } from "./campaign.ts";
import { resolveCrisis } from "./crises.ts";
import { confirmSelection } from "./effects.ts";
import { advanceCampaign, advanceToVisiblePhase } from "./flow.ts";
import { SCENARIO_V3_PREVIEW } from "./scenario.ts";
import { createTestCampaign, testAnnualCheckpoints, validCampaignState, validScenario } from "./test-fixtures.ts";
import type { CampaignState, CrisisRule } from "./types.ts";
import { positionAfterCompleted } from "./validation.ts";

const crisis: CrisisRule = {
  id: "opinion-crisis",
  title: "Le pays se fracture",
  body: "La contestation bloque le mandat.",
  indicator: "opinion",
  threshold: 10,
  comparator: "lte",
  eligibleFromChapterIndex: 0,
  maxOccurrences: 1,
  requiredDecisionIds: ["decision-1"],
  aggravatingChoices: [{ decisionId: "decision-1", optionIds: ["decision-1-option-a"] }],
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

test("les conséquences échues sont résolues silencieusement une seule fois avant le dossier suivant", () => {
  const scenario = validScenario();
  const state = validCampaignState(scenario);
  state.indicators.opinion = 50;
  state.scheduledEvents = [{
    id: "silent-event",
    sourceDecisionId: "decision-1",
    sourceOptionId: "decision-1-option-a",
    dueAtDecision: 1,
    title: "Effet silencieux",
    body: "Cet effet ne doit pas interrompre le mandat.",
    effects: [{
      id: "silent-event-opinion",
      target: "indicator",
      key: "opinion",
      delta: -4,
      timing: { kind: "immediate" },
      duration: "once",
      explanation: "La contestation progresse.",
    }],
  }];

  const next = advanceToVisiblePhase(state, scenario, []);

  assert.equal(next.phase, "decision");
  assert.equal(next.decisionIndex, 1);
  assert.equal(next.indicators.opinion, 46);
  assert.equal(next.eventHistory.filter((event) => event.id === "silent-event").length, 1);
  assert.equal(advanceToVisiblePhase(next, scenario, []).eventHistory.filter((event) => event.id === "silent-event").length, 1);
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

test("un Conseil annuel est calculé sans devenir une scène visible", () => {
  const next = advanceToVisiblePhase(stateAfterPreviewDecisions(16), SCENARIO_V3_PREVIEW, []);

  assert.equal(next.phase, "chapter_intro");
  assert.equal(next.annualCheckpoints.at(-1)?.afterDecisionCount, 16);
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
    }, {
      id: "annual-event-one-off",
      target: "indicator",
      key: "annualBalance",
      delta: -2_500,
      timing: { kind: "immediate" },
      duration: "once",
      explanation: "La transition est payée sur cet exercice seulement.",
    }],
  }];

  const delayed = advanceCampaign(state, SCENARIO_V3_PREVIEW, []);
  assert.equal(delayed.phase, "delayed_event");
  const council = advanceCampaign(delayed, SCENARIO_V3_PREVIEW, []);
  assert.equal(council.phase, "council");
  assert.equal(council.annualCheckpoints[0]?.annualBalance, state.indicators.annualBalance + 1_000 - 2_500);
  assert.equal(council.indicators.annualBalance, state.indicators.annualBalance + 1_000);
  assert.ok(council.annualCheckpoints[0]?.causes.includes("event:annual-event:annual-event-balance:1"));
  assert.ok(council.annualCheckpoints[0]?.causes.includes("event:annual-event:annual-event-one-off:2"));
});

test("un dossier final verrouillé repasse par conséquences, promesses et crise avant le Conseil", () => {
  const state = stateAfterPreviewDecisions(52);
  const source = state.decisions[49]!;
  const lockedDecisionId = SCENARIO_V3_PREVIEW.decisions[52]!.id;
  state.annualCheckpoints = testAnnualCheckpoints(SCENARIO_V3_PREVIEW, 3);
  state.lockedDecisionIds = [lockedDecisionId];
  state.indicators.opinion = 12;
  state.scheduledEvents = [{
    id: "locked-year-event",
    sourceDecisionId: source.decisionId,
    sourceOptionId: source.optionId,
    dueAtDecision: 53,
    title: "La réforme revient",
    body: "Le coût arrive en fin d'année.",
    effects: [
      {
        id: "locked-year-event-balance",
        target: "indicator",
        key: "annualBalance",
        delta: 1_000,
        timing: { kind: "immediate" },
        duration: "annual",
        explanation: "Le solde est révisé.",
      },
      {
        id: "locked-year-event-opinion",
        target: "indicator",
        key: "opinion",
        delta: -3,
        timing: { kind: "immediate" },
        duration: "once",
        explanation: "L'opinion décroche.",
      },
    ],
  }];
  state.activePromises = [{
    id: "locked-year-promise",
    sourceDecisionId: source.decisionId,
    sourceOptionId: source.optionId,
    label: "Tenir la promesse annuelle",
    dueAtDecision: 53,
    fulfilled: false,
    failureEffects: [{
      id: "locked-year-promise-balance",
      target: "indicator",
      key: "annualBalance",
      delta: 2_000,
      timing: { kind: "immediate" },
      duration: "annual",
      explanation: "La promesse non tenue révise le solde.",
    }],
  }];
  const boundaryCrisis: CrisisRule = {
    id: "locked-year-crisis",
    title: "La fin d'année se tend",
    body: "Le Conseil doit attendre la résolution.",
    indicator: "opinion",
    threshold: 10,
    comparator: "lte",
    eligibleFromChapterIndex: 6,
    maxOccurrences: 1,
    requiredDecisionIds: [source.decisionId],
    aggravatingChoices: [{ decisionId: source.decisionId, optionIds: [source.optionId] }],
    concessions: [],
    holdCourseEffects: [{
      id: "locked-year-crisis-balance",
      target: "indicator",
      key: "annualBalance",
      delta: 3_000,
      timing: { kind: "immediate" },
      duration: "annual",
      explanation: "La résolution révise le solde.",
    }],
  };

  const delayed = advanceCampaign(state, SCENARIO_V3_PREVIEW, [boundaryCrisis]);
  assert.equal(delayed.phase, "delayed_event");
  assert.equal(delayed.decisions.length, 53);
  assert.equal(delayed.decisions.at(-1)?.status, "superseded");
  assert.equal(delayed.annualCheckpoints.length, 3);

  const crisisState = advanceCampaign(delayed, SCENARIO_V3_PREVIEW, [boundaryCrisis]);
  assert.equal(crisisState.phase, "crisis");
  assert.equal(crisisState.eventHistory.at(-1)?.id, "locked-year-event");
  assert.equal(crisisState.promiseHistory.at(-1)?.id, "locked-year-promise");
  assert.equal(crisisState.annualCheckpoints.length, 3);

  const resolved = resolveCrisis(crisisState, [boundaryCrisis], "hold-course");
  const council = advanceCampaign(resolved, SCENARIO_V3_PREVIEW, [boundaryCrisis]);
  assert.equal(council.phase, "council");
  assert.equal(council.annualCheckpoints.length, 4);
  assert.equal(council.annualCheckpoints.at(-1)?.annualBalance, state.indicators.annualBalance + 6_000);
  for (const sourceId of ["locked-year-event", "locked-year-promise", "locked-year-crisis"]) {
    const cause = council.causalLedger.find((entry) => entry.sourceId === sourceId && entry.key === "annualBalance");
    assert.ok(cause);
    assert.ok(council.annualCheckpoints.at(-1)?.causes.includes(cause.id));
  }
});

test("la sortie de l'euro résout la conversion après un dossier joué, sans verrou automatique", () => {
  let state: CampaignState = { ...createTestCampaign(SCENARIO_V3_PREVIEW), phase: "chapter_intro" };
  state = advanceCampaign(state, SCENARIO_V3_PREVIEW, []);
  while (state.decisions.length < 36) {
    assert.equal(state.phase, "decision");
    const decision = currentDecision(state, SCENARIO_V3_PREVIEW)!;
    const keep = decision.options.at(-1)!;
    state = confirmSelection(selectOption(state, SCENARIO_V3_PREVIEW, decision.id, keep.id), SCENARIO_V3_PREVIEW);
    do state = advanceCampaign(state, SCENARIO_V3_PREVIEW, []);
    while (state.phase !== "decision");
  }

  const runRateBeforeExit = state.indicators.annualBalance;
  const euroExit = currentDecision(state, SCENARIO_V3_PREVIEW)!;
  assert.equal(euroExit.id, "sortir-de-l-euro");
  state = confirmSelection(
    selectOption(state, SCENARIO_V3_PREVIEW, euroExit.id, euroExit.options[0]!.id),
    SCENARIO_V3_PREVIEW,
  );

  const referendum = advanceCampaign(state, SCENARIO_V3_PREVIEW, []);
  assert.equal(referendum.phase, "decision");
  assert.equal(referendum.decisions.length, 37);
  assert.equal(currentDecision(referendum, SCENARIO_V3_PREVIEW)?.id, "referendum-sur-la-sortie-de-l-ue");
  assert.ok(referendum.scheduledEvents.some((event) => event.id === "currency-conversion" && event.dueAtDecision === 38));

  const referendumDecision = currentDecision(referendum, SCENARIO_V3_PREVIEW)!;
  state = confirmSelection(
    selectOption(referendum, SCENARIO_V3_PREVIEW, referendumDecision.id, referendumDecision.options.at(-1)!.id),
    SCENARIO_V3_PREVIEW,
  );
  const delayed = advanceCampaign(state, SCENARIO_V3_PREVIEW, []);
  assert.equal(delayed.phase, "delayed_event");
  assert.equal(delayed.decisions.length, 38);
  assert.equal(delayed.decisions.at(-1)?.status, "confirmed");
  assert.ok(delayed.scheduledEvents.some((event) => event.id === "currency-conversion" && event.dueAtDecision === 38));
  assert.equal(delayed.annualCheckpoints.length, 2);

  const army = advanceCampaign(delayed, SCENARIO_V3_PREVIEW, []);
  assert.equal(army.phase, "decision");
  assert.equal(currentDecision(army, SCENARIO_V3_PREVIEW)?.id, "creer-une-armee-europeenne");
  assert.ok(army.eventHistory.some((event) => event.id === "currency-conversion"));

  const armyDecision = currentDecision(army, SCENARIO_V3_PREVIEW)!;
  state = confirmSelection(
    selectOption(army, SCENARIO_V3_PREVIEW, armyDecision.id, armyDecision.options.at(-1)!.id),
    SCENARIO_V3_PREVIEW,
  );
  const council = advanceCampaign(state, SCENARIO_V3_PREVIEW, []);
  assert.equal(council.phase, "council");
  assert.equal(council.decisions.length, 39);
  assert.equal(council.decisions.at(-1)?.status, "confirmed");
  assert.ok(council.eventHistory.some((event) => event.id === "currency-conversion"));
  assert.ok(council.scheduledEvents.every((event) => event.dueAtDecision > council.decisions.length));
  assert.equal(council.annualCheckpoints.at(-1)?.afterDecisionCount, 39);
  assert.equal(council.annualCheckpoints.at(-1)?.annualBalance, runRateBeforeExit - 35_000);
  assert.equal(council.indicators.annualBalance, runRateBeforeExit);
  const euroExitBudgetCause = council.causalLedger.find((entry) =>
    entry.sourceId === `${euroExit.id}:${euroExit.options[0]!.id}`
      && entry.key === "annualBalance"
      && entry.duration === "once");
  assert.ok(euroExitBudgetCause);
  assert.ok(council.annualCheckpoints.at(-1)?.causes.includes(euroExitBudgetCause.id));
});
