import assert from "node:assert/strict";
import { test } from "node:test";

import { assertNoEmDash, isCampaignState, validateScenario } from "./validation.ts";
import { createCampaign, selectOption } from "./campaign.ts";
import { confirmSelection, resolveDueEvents } from "./effects.ts";
import { validCampaignState, validScenario } from "./test-fixtures.ts";

test("un scénario valide contient huit chapitres de douze décisions uniques", () => {
  assert.deepEqual(validateScenario(validScenario()), []);
});

test("la validation refuse un scénario incomplet et un choix sans preuve", () => {
  const scenario = validScenario();
  scenario.chapters[0]!.decisionIds.pop();
  scenario.decisions[0]!.evidence = [];
  assert.deepEqual(validateScenario(scenario), [
    "chapter:chapter-1:expected-12-decisions",
    "decision:decision-1:evidence-required",
  ]);
});

test("le contrôle éditorial trouve tout cadratin dans un objet imbriqué", () => {
  assert.deepEqual(assertNoEmDash({ title: "Avant\u2014après", nested: ["ok"] }), ["$.title"]);
});

test("un état V2 n'est jamais accepté comme état V3", () => {
  assert.equal(isCampaignState({ version: 2, phase: "conseil" }, validScenario()), false);
});

test("la validation refuse un identifiant répété dans les chapitres", () => {
  const scenario = validScenario();
  scenario.chapters[0]!.decisionIds[11] = "decision-1";
  assert.ok(validateScenario(scenario).includes("chapter:chapter-1:duplicate-decision:decision-1"));
  assert.ok(validateScenario(scenario).includes("decision:decision-12:expected-once-in-chapters"));
});

test("la validation réserve les effets différés aux effets directs des options", () => {
  const scenario = validScenario();
  const option = scenario.decisions[0]!.options[0]!;
  option.scheduledEvents = [{
    id: "event-delayed", title: "Événement", body: "Texte", afterDecisions: 1,
    effects: [{
      id: "event-effect", target: "indicator", key: "opinion", delta: -1,
      timing: { kind: "after_decisions", count: 1 }, duration: "once", explanation: "Trop tard.",
    }],
  }];
  option.promises = [{
    id: "promise-delayed", label: "Promesse", dueAfterDecisions: 1,
    failureEffects: [{
      id: "promise-effect", target: "indicator", key: "opinion", delta: -1,
      timing: { kind: "after_decisions", count: 1 }, duration: "once", explanation: "Trop tard.",
    }],
  }];
  assert.ok(validateScenario(scenario).includes("event:event-delayed:effects-must-be-immediate"));
  assert.ok(validateScenario(scenario).includes("promise:promise-delayed:failure-effects-must-be-immediate"));
});

test("la validation impose des identifiants globaux uniques aux événements et promesses", () => {
  const scenario = validScenario();
  const first = scenario.decisions[0]!.options[0]!;
  const second = scenario.decisions[1]!.options[0]!;
  first.scheduledEvents = [{ id: "shared-event", title: "A", body: "A", afterDecisions: 1, effects: [] }];
  second.scheduledEvents = [{ id: "shared-event", title: "B", body: "B", afterDecisions: 1, effects: [] }];
  first.promises = [{ id: "shared-promise", label: "A", dueAfterDecisions: 1, failureEffects: [] }];
  second.promises = [{ id: "shared-promise", label: "B", dueAfterDecisions: 1, failureEffects: [] }];
  assert.ok(validateScenario(scenario).includes("scenario:duplicate-scheduled-event-id:shared-event"));
  assert.ok(validateScenario(scenario).includes("scenario:duplicate-promise-id:shared-promise"));
});

test("un état V3 complet est accepté", () => {
  const scenario = validScenario();
  assert.equal(isCampaignState(validCampaignState(scenario), scenario), true);
});

test("un état confirmé reste valide après un aller-retour de persistance", () => {
  const scenario = validScenario();
  const started = { ...createCampaign(scenario), phase: "decision" as const };
  const confirmed = confirmSelection(selectOption(started, scenario, "decision-1", "decision-1-option-a"), scenario);
  assert.equal(isCampaignState(JSON.parse(JSON.stringify(confirmed)), scenario), true);
});

test("un événement résolu reste traçable et valide après persistance", () => {
  const scenario = validScenario();
  const option = scenario.decisions[0]!.options[0]!;
  option.scheduledEvents = [{
    id: "event-1",
    title: "Événement",
    body: "Conséquence différée.",
    afterDecisions: 1,
    effects: [{
      id: "event-effect", target: "indicator", key: "opinion", delta: -2,
      timing: { kind: "immediate" }, duration: "once", explanation: "Réaction.",
    }],
  }];
  const started = { ...createCampaign(scenario), phase: "decision" as const };
  const confirmed = confirmSelection(selectOption(started, scenario, "decision-1", "decision-1-option-a"), scenario);
  const resolved = resolveDueEvents({ ...confirmed, decisions: [...confirmed.decisions, {
    decisionId: "decision-2", optionId: "decision-2-option-a", status: "confirmed", confirmedAtIndex: 2,
  }] });
  assert.equal(resolved.state.eventHistory[0]?.id, "event-1");
  assert.equal(isCampaignState(JSON.parse(JSON.stringify(resolved.state)), scenario), true);
});

test("un état V3 refuse chaque DecisionRecord malformé", () => {
  const scenario = validScenario();
  const cases = [
    { optionId: "decision-2-option-a" },
    { status: "invalid" },
    { confirmedAtIndex: 0 },
    { changedByCrisisId: 12 },
  ];
  for (const mutation of cases) {
    const state = validCampaignState(scenario) as unknown as Record<string, unknown>;
    const record = (state.decisions as Record<string, unknown>[])[0]!;
    Object.assign(record, mutation);
    assert.equal(isCampaignState(state, scenario), false);
  }
});

test("un état V3 exige les clés exactes des indicateurs et groupes", () => {
  const scenario = validScenario();
  const cases: Array<["indicators" | "groups", string, boolean]> = [
    ["indicators", "growth", false],
    ["indicators", "unknown", true],
    ["groups", "farmers", false],
    ["groups", "unknown", true],
  ];
  for (const [field, key, add] of cases) {
    const state = validCampaignState(scenario) as unknown as Record<string, Record<string, unknown>>;
    if (add) state[field][key] = 0;
    else delete state[field][key];
    assert.equal(isCampaignState(state, scenario), false);
  }
});

test("un état V3 refuse un événement programmé ou une promesse mal formés", () => {
  const scenario = validScenario();
  const eventState = validCampaignState(scenario) as unknown as Record<string, unknown>;
  eventState.scheduledEvents = [{ id: 12 }];
  assert.equal(isCampaignState(eventState, scenario), false);

  const promiseState = validCampaignState(scenario) as unknown as Record<string, unknown>;
  promiseState.activePromises = [{ id: "promise", sourceDecisionId: "decision-1", fulfilled: "yes" }];
  assert.equal(isCampaignState(promiseState, scenario), false);
});

test("un état V3 refuse les effets différés déjà portés par un événement ou une promesse", () => {
  const scenario = validScenario();
  const delayedEffect = {
    id: "effect", target: "indicator", key: "opinion", delta: -1,
    timing: { kind: "after_decisions" as const, count: 1 }, duration: "once" as const, explanation: "Trop tard.",
  };
  const event = {
    id: "event", sourceDecisionId: "decision-1", sourceOptionId: "decision-1-option-a",
    dueAtDecision: 1, title: "Événement", body: "Texte", effects: [delayedEffect],
  };
  const promise = {
    id: "promise", sourceDecisionId: "decision-1", label: "Promesse", dueAtDecision: 1,
    fulfilled: false, failureEffects: [delayedEffect],
  };
  for (const field of ["scheduledEvents", "eventHistory"] as const) {
    const state = validCampaignState(scenario);
    state[field] = [event];
    assert.equal(isCampaignState(state, scenario), false);
  }
  for (const field of ["activePromises", "promiseHistory"] as const) {
    const state = validCampaignState(scenario);
    state[field] = [promise];
    assert.equal(isCampaignState(state, scenario), false);
  }
});

test("un état V3 refuse un événement historique encore en file et toute promesse dupliquée", () => {
  const scenario = validScenario();
  const event = {
    id: "event", sourceDecisionId: "decision-1", sourceOptionId: "decision-1-option-a",
    dueAtDecision: 1, title: "Événement", body: "Texte", effects: [],
  };
  const eventState = validCampaignState(scenario);
  eventState.scheduledEvents = [event];
  eventState.eventHistory = [event];
  assert.equal(isCampaignState(eventState, scenario), false);
  for (const field of ["scheduledEvents", "eventHistory"] as const) {
    const duplicateState = validCampaignState(scenario);
    duplicateState[field] = [event, event];
    assert.equal(isCampaignState(duplicateState, scenario), false);
  }

  const promise = {
    id: "promise", sourceDecisionId: "decision-1", label: "Promesse", dueAtDecision: 1,
    fulfilled: false, failureEffects: [],
  };
  const promiseState = validCampaignState(scenario);
  promiseState.activePromises = [promise];
  promiseState.promiseHistory = [promise];
  assert.equal(isCampaignState(promiseState, scenario), false);
  for (const field of ["activePromises", "promiseHistory"] as const) {
    const duplicateState = validCampaignState(scenario);
    duplicateState[field] = [promise, promise];
    assert.equal(isCampaignState(duplicateState, scenario), false);
  }
});

test("un état V3 refuse une crise ou une entrée causale mal formées", () => {
  const scenario = validScenario();
  const crisisState = validCampaignState(scenario) as unknown as Record<string, unknown>;
  crisisState.activeCrisis = { ruleId: "crisis", triggeredByDecisionId: 12, aggravatingDecisionIds: [] };
  assert.equal(isCampaignState(crisisState, scenario), false);

  const causalState = validCampaignState(scenario) as unknown as Record<string, unknown>;
  causalState.causalLedger = [{
    id: "entry",
    sourceType: "decision",
    sourceId: "decision-1",
    target: "indicator",
    key: "farmers",
    delta: 1,
    explanation: "test",
    appliedAtDecision: 1,
  }];
  assert.equal(isCampaignState(causalState, scenario), false);
});

test("un état V3 refuse les listes d'identifiants dupliquées ou inconnues", () => {
  const scenario = validScenario();
  const resolvedState = validCampaignState(scenario) as unknown as Record<string, unknown>;
  resolvedState.resolvedCrisisIds = ["crisis", "crisis"];
  assert.equal(isCampaignState(resolvedState, scenario), false);

  const unlockedState = validCampaignState(scenario) as unknown as Record<string, unknown>;
  unlockedState.unlockedDecisionIds = ["decision-1", "decision-1"];
  assert.equal(isCampaignState(unlockedState, scenario), false);

  const lockedState = validCampaignState(scenario) as unknown as Record<string, unknown>;
  lockedState.lockedDecisionIds = ["unknown-decision"];
  assert.equal(isCampaignState(lockedState, scenario), false);
});

test("un état V3 refuse une règle d'effet incomplète", () => {
  const scenario = validScenario();
  const state = validCampaignState(scenario) as unknown as Record<string, unknown>;
  state.scheduledEvents = [{
    id: "event-1",
    sourceDecisionId: "decision-1",
    sourceOptionId: "decision-1-option-a",
    dueAtDecision: 1,
    title: "Event",
    body: "Body",
    effects: [{
      id: "effect-1",
      target: "indicator",
      key: "growth",
      delta: Infinity,
      timing: { kind: "immediate" },
      duration: "once",
      explanation: "Effect",
    }],
  }];
  assert.equal(isCampaignState(state, scenario), false);
});
