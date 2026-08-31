import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertNoEmDash,
  isCampaignState,
  positionAfterCompleted,
  positionBeforeNext,
  totalDecisions,
  validateScenario,
} from "./validation.ts";
import { createCampaign, selectOption } from "./campaign.ts";
import { confirmSelection, resolveDueEvents } from "./effects.ts";
import { SCENARIO_V3 } from "./scenario.ts";
import { validCampaignState, validScenario } from "./test-fixtures.ts";
import type { CampaignState, DecisionRecord, EffectRule, Scenario } from "./types.ts";

function confirmedRecord(scenario: Scenario, index: number, confirmedAtIndex = index + 1): DecisionRecord {
  const decision = scenario.decisions[index]!;
  return {
    decisionId: decision.id,
    optionId: decision.options[0]!.id,
    status: "confirmed",
    confirmedAtIndex,
  };
}

function stateAfterRecords(scenario: Scenario, decisions: DecisionRecord[]): CampaignState {
  const count = decisions.length;
  const position = positionAfterCompleted(scenario, count) ?? positionBeforeNext(scenario, count)!;
  return {
    ...validCampaignState(scenario),
    phase: "decision_result",
    ...position,
    decisions,
  };
}

test("un scénario valide contient chaque décision une seule fois", () => {
  assert.deepEqual(validateScenario(validScenario()), []);
});

test("le positionnement suit des chapitres de longueurs variables", () => {
  assert.deepEqual(positionAfterCompleted(SCENARIO_V3, 8), { chapterIndex: 0, decisionIndex: 7 });
  assert.deepEqual(positionBeforeNext(SCENARIO_V3, 8), { chapterIndex: 1, decisionIndex: 0 });
  assert.deepEqual(positionBeforeNext(SCENARIO_V3, 53), { chapterIndex: 7, decisionIndex: 0 });
  assert.equal(totalDecisions(SCENARIO_V3), 60);
});

test("la validation accepte une petite topologie non uniforme", () => {
  const source = validScenario();
  const decisions = source.decisions.slice(0, 3);
  const scenario: Scenario = {
    ...source,
    chapters: [{ ...source.chapters[0]!, decisionIds: decisions.map((decision) => decision.id) }],
    decisions,
  };

  assert.deepEqual(validateScenario(scenario), []);
  assert.equal(totalDecisions(scenario), 3);
});

test("la validation refuse un scénario incomplet et un choix sans preuve", () => {
  const scenario = validScenario();
  scenario.chapters[0]!.decisionIds.pop();
  scenario.decisions[0]!.evidence = [];
  const errors = validateScenario(scenario);
  assert.ok(errors.includes("decision:decision-12:expected-once-in-chapters"));
  assert.ok(errors.includes("decision:decision-1:evidence-required"));
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
  const resolved = resolveDueEvents({ ...confirmed, decisionIndex: 1, decisions: [...confirmed.decisions, {
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
    id: "promise", sourceDecisionId: "decision-1", sourceOptionId: "decision-1-option-a", label: "Promesse", dueAtDecision: 1,
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
    id: "promise", sourceDecisionId: "decision-1", sourceOptionId: "decision-1-option-a", label: "Promesse", dueAtDecision: 1,
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

test("la validation refuse une clé de groupe portée par un effet indicateur", () => {
  const scenario = validScenario();
  const hostileEffect = {
    id: "hostile-effect",
    target: "indicator",
    key: "farmers",
    delta: 1,
    timing: { kind: "immediate" },
    duration: "once",
    explanation: "Une cible incohérente.",
  } as unknown as EffectRule;
  scenario.decisions[0]!.options[0]!.effects = [hostileEffect];

  assert.ok(validateScenario(scenario).includes("effect:hostile-effect:invalid-rule"));
});

test("un état V3 refuse les DecisionRecord dupliqués, hors ordre ou non séquentiels", () => {
  const scenario = validScenario();
  const duplicate = stateAfterRecords(scenario, [
    confirmedRecord(scenario, 0),
    { ...confirmedRecord(scenario, 0), confirmedAtIndex: 2 },
  ]);
  const outOfOrder = stateAfterRecords(scenario, [confirmedRecord(scenario, 1)]);
  const nonSequentialIndex = stateAfterRecords(scenario, [confirmedRecord(scenario, 0, 2)]);

  assert.equal(isCampaignState(duplicate, scenario), false);
  assert.equal(isCampaignState(outOfOrder, scenario), false);
  assert.equal(isCampaignState(nonSequentialIndex, scenario), false);
});

test("un état V3 refuse les conséquences dont la source n'a pas été confirmée", () => {
  const scenario = validScenario();
  const scheduled = stateAfterRecords(scenario, [confirmedRecord(scenario, 0)]);
  scheduled.scheduledEvents = [{
    id: "foreign-event",
    sourceDecisionId: "decision-2",
    sourceOptionId: "decision-2-option-a",
    dueAtDecision: 3,
    title: "Événement étranger",
    body: "La décision source manque.",
    effects: [],
  }];
  const promised = stateAfterRecords(scenario, [confirmedRecord(scenario, 0)]);
  promised.activePromises = [{
    id: "foreign-promise",
    sourceDecisionId: "decision-2",
    sourceOptionId: "decision-2-option-a",
    label: "Promesse étrangère",
    dueAtDecision: 3,
    fulfilled: false,
    failureEffects: [],
  }];

  assert.equal(isCampaignState(scheduled, scenario), false);
  assert.equal(isCampaignState(promised, scenario), false);
});

test("un état V3 refuse une sélection incompatible et des verrous qui se chevauchent", () => {
  const scenario = validScenario();
  const wrongCurrentDecision = {
    ...createCampaign(scenario),
    phase: "decision" as const,
    pendingSelection: { decisionId: "decision-2", optionId: "decision-2-option-a" },
  };
  const lockedPendingDecision = {
    ...createCampaign(scenario),
    phase: "decision" as const,
    pendingSelection: { decisionId: "decision-1", optionId: "decision-1-option-a" },
    lockedDecisionIds: ["decision-1"],
  };
  const overlappingLocks = {
    ...stateAfterRecords(scenario, [confirmedRecord(scenario, 0)]),
    lockedDecisionIds: ["decision-3"],
    unlockedDecisionIds: ["decision-3"],
  };

  assert.equal(isCampaignState(wrongCurrentDecision, scenario), false);
  assert.equal(isCampaignState(lockedPendingDecision, scenario), false);
  assert.equal(isCampaignState(overlappingLocks, scenario), false);
});

test("un état V3 refuse une phase ou une échéance persistée hors campagne", () => {
  const scenario = validScenario();
  const incoherentPhase = {
    ...stateAfterRecords(scenario, [confirmedRecord(scenario, 0)]),
    phase: "intro" as const,
  };
  const unreachableEvent = stateAfterRecords(scenario, [confirmedRecord(scenario, 0)]);
  unreachableEvent.scheduledEvents = [{
    id: "event-97",
    sourceDecisionId: "decision-1",
    sourceOptionId: "decision-1-option-a",
    dueAtDecision: totalDecisions(scenario) + 1,
    title: "Trop tard",
    body: "Cette échéance dépasse la campagne.",
    effects: [],
  }];

  assert.equal(isCampaignState(incoherentPhase, scenario), false);
  assert.equal(isCampaignState(unreachableEvent, scenario), false);
});

test("un état V3 accepte chaque phase à sa position atteignable", () => {
  const scenario = validScenario();
  const records = (count: number) => Array.from({ length: count }, (_, index) => confirmedRecord(scenario, index));
  const chapterVerdict = stateAfterRecords(scenario, records(12));
  const campaignLength = totalDecisions(scenario);
  const verdict = stateAfterRecords(scenario, records(campaignLength));
  const crisis = stateAfterRecords(scenario, records(1));
  const delayedEvent = stateAfterRecords(scenario, records(2));
  delayedEvent.scheduledEvents = [{
    id: "due-event",
    sourceDecisionId: "decision-1",
    sourceOptionId: "decision-1-option-a",
    dueAtDecision: 2,
    title: "Événement dû",
    body: "Il est prêt à être résolu.",
    effects: [],
  }];
  const states: CampaignState[] = [
    createCampaign(scenario),
    { ...createCampaign(scenario), phase: "chapter_intro" },
    { ...createCampaign(scenario), phase: "decision" },
    stateAfterRecords(scenario, records(1)),
    { ...stateAfterRecords(scenario, records(4)), phase: "council" },
    {
      ...crisis,
      phase: "crisis",
      activeCrisis: { ruleId: "crisis-1", triggeredByDecisionId: "decision-1", aggravatingDecisionIds: ["decision-1"] },
    },
    { ...delayedEvent, phase: "delayed_event" },
    { ...chapterVerdict, phase: "chapter_verdict" },
    { ...createCampaign(scenario), phase: "pause" },
    { ...verdict, phase: "verdict" },
  ];

  for (const state of states) assert.equal(isCampaignState(state, scenario), true, state.phase);
});

test("la validation refuse toute règle créée à la dernière décision et due après la campagne", () => {
  const scenario = validScenario();
  const finalDecision = totalDecisions(scenario) - 1;
  const option = scenario.decisions[finalDecision]!.options[0]!;
  option.effects = [{
    id: "effect-after-96",
    target: "indicator",
    key: "growth",
    delta: -1,
    timing: { kind: "after_decisions", count: 1 },
    duration: "once",
    explanation: "Trop tard.",
  }];
  option.scheduledEvents = [{
    id: "event-after-96",
    title: "Trop tard",
    body: "L'événement dépasse la campagne.",
    afterDecisions: 1,
    effects: [],
  }];
  option.promises = [{
    id: "promise-after-96",
    label: "Trop tard",
    dueAfterDecisions: 1,
    failureEffects: [],
  }];

  assert.ok(validateScenario(scenario).includes("effect:effect-after-96:due-after-campaign"));
  assert.ok(validateScenario(scenario).includes("event:event-after-96:due-after-campaign"));
  assert.ok(validateScenario(scenario).includes("promise:promise-after-96:due-after-campaign"));
});

test("la validation refuse les verrous inconnus, dupliqués ou chevauchants", () => {
  const scenario = validScenario();
  const option = scenario.decisions[0]!.options[0]!;
  option.locks = ["missing-decision", "decision-3", "decision-3"];
  option.unlocks = ["other-missing-decision", "decision-3", "decision-3"];

  const errors = validateScenario(scenario);

  assert.ok(errors.includes("option:decision-1-option-a:lock-unknown-decision:missing-decision"));
  assert.ok(errors.includes("option:decision-1-option-a:unlock-unknown-decision:other-missing-decision"));
  assert.ok(errors.includes("option:decision-1-option-a:duplicate-lock:decision-3"));
  assert.ok(errors.includes("option:decision-1-option-a:duplicate-unlock:decision-3"));
  assert.ok(errors.includes("option:decision-1-option-a:lock-unlock-overlap:decision-3"));

  const malformedScenario = validScenario();
  const malformedOption = malformedScenario.decisions[0]!.options[0]! as unknown as {
    locks: unknown;
    unlocks: unknown;
  };
  malformedOption.locks = "decision-3";
  malformedOption.unlocks = [42];
  const malformedErrors = validateScenario(malformedScenario);
  assert.ok(malformedErrors.includes("option:decision-1-option-a:locks-must-be-string-array"));
  assert.ok(malformedErrors.includes("option:decision-1-option-a:unlocks-must-be-string-array"));
});

test("la validation refuse les promesses accomplies inconnues ou dupliquées", () => {
  const scenario = validScenario();
  scenario.decisions[1]!.options[0]!.promises = [{
    id: "declared-promise",
    label: "Promesse déclarée",
    dueAfterDecisions: 1,
    failureEffects: [],
  }];
  const option = scenario.decisions[0]!.options[0]!;
  option.fulfillsPromises = ["missing-promise", "missing-promise"];

  const errors = validateScenario(scenario);

  assert.ok(errors.includes("option:decision-1-option-a:unknown-fulfilled-promise:missing-promise"));
  assert.ok(errors.includes("option:decision-1-option-a:duplicate-fulfilled-promise:missing-promise"));

  const malformedScenario = validScenario();
  (malformedScenario.decisions[0]!.options[0]! as unknown as { fulfillsPromises: unknown }).fulfillsPromises = [42];
  assert.ok(
    validateScenario(malformedScenario).includes("option:decision-1-option-a:fulfills-promises-must-be-string-array"),
  );
});

test("la validation réserve les identifiants matérialisés dans la même option", () => {
  const scenario = validScenario();
  const option = scenario.decisions[0]!.options[0]!;
  const immediateEffect = {
    id: "shared-effect",
    target: "indicator" as const,
    key: "growth" as const,
    delta: 1,
    timing: { kind: "immediate" as const },
    duration: "once" as const,
    explanation: "Effet immédiat",
  };
  const delayedEffect = {
    id: "same-delayed-effect",
    target: "indicator" as const,
    key: "growth" as const,
    delta: 1,
    timing: { kind: "after_decisions" as const, count: 1 },
    duration: "once" as const,
    explanation: "Effet différé",
  };
  option.effects = [immediateEffect, delayedEffect, { ...delayedEffect }];
  option.scheduledEvents = [{
    id: "event-with-shared-effect",
    title: "Événement local",
    body: "Événement explicite",
    afterDecisions: 1,
    effects: [{ ...immediateEffect }],
  }];
  option.promises = [{
    id: "promise-with-shared-effect",
    label: "Promesse avec effet partagé",
    dueAfterDecisions: 1,
    failureEffects: [{ ...immediateEffect }],
  }];
  scenario.decisions[1]!.options[0]!.scheduledEvents = [{
    id: "decision-1:decision-1-option-a:same-delayed-effect",
    title: "Collision distante",
    body: "Événement explicite",
    afterDecisions: 1,
    effects: [],
  }];

  const errors = validateScenario(scenario);

  assert.ok(errors.includes("option:decision-1-option-a:duplicate-effect-id:shared-effect"));
  assert.ok(errors.includes("option:decision-1-option-a:duplicate-effect-id:same-delayed-effect"));
  assert.ok(
    errors.includes(
      "option:decision-1-option-a:duplicate-materialized-event-id:decision-1:decision-1-option-a:same-delayed-effect",
    ),
  );
  assert.ok(
    errors.includes(
      "option:decision-1-option-a:materialized-event-id-collides:decision-1:decision-1-option-a:same-delayed-effect",
    ),
  );
});

for (const [description, field, value, expectedError] of [
  ["un identifiant d'événement non textuel", "id", 42, "event:unknown:id-must-be-non-empty-string"],
  ["un identifiant d'événement vide", "id", "", "event:unknown:id-must-be-non-empty-string"],
  ["un titre d'événement non textuel", "title", 42, "event:event:title-must-be-non-empty-string"],
  ["un titre d'événement vide", "title", "", "event:event:title-must-be-non-empty-string"],
  ["un corps d'événement non textuel", "body", 42, "event:event:body-must-be-non-empty-string"],
  ["un corps d'événement vide", "body", "", "event:event:body-must-be-non-empty-string"],
] as const) {
  test(`la validation refuse ${description}`, () => {
    const scenario = validScenario();
    const event: Record<string, unknown> = {
      id: "event",
      title: "Événement",
      body: "Texte",
      afterDecisions: 1,
      effects: [],
    };
    event[field] = value;
    scenario.decisions[0]!.options[0]!.scheduledEvents = [event] as unknown as Scenario["decisions"][number]["options"][number]["scheduledEvents"];

    assert.ok(validateScenario(scenario).includes(expectedError));
  });
}

for (const [description, field, value, expectedError] of [
  ["un identifiant de promesse non textuel", "id", 42, "promise:unknown:id-must-be-non-empty-string"],
  ["un identifiant de promesse vide", "id", "", "promise:unknown:id-must-be-non-empty-string"],
  ["un libellé de promesse non textuel", "label", 42, "promise:promise:label-must-be-non-empty-string"],
  ["un libellé de promesse vide", "label", "", "promise:promise:label-must-be-non-empty-string"],
] as const) {
  test(`la validation refuse ${description}`, () => {
    const scenario = validScenario();
    const promise: Record<string, unknown> = {
      id: "promise",
      label: "Promesse",
      dueAfterDecisions: 1,
      failureEffects: [],
    };
    promise[field] = value;
    scenario.decisions[0]!.options[0]!.promises = [promise] as unknown as Scenario["decisions"][number]["options"][number]["promises"];

    assert.ok(validateScenario(scenario).includes(expectedError));
  });
}

test("la validation conserve les délais positifs des événements et promesses", () => {
  const scenario = validScenario();
  const option = scenario.decisions[0]!.options[0]!;
  option.scheduledEvents = [{
    id: "event-with-invalid-delay",
    title: "Événement",
    body: "Texte",
    afterDecisions: 0,
    effects: [],
  }];
  option.promises = [{
    id: "promise-with-invalid-delay",
    label: "Promesse",
    dueAfterDecisions: 0,
    failureEffects: [],
  }];

  const errors = validateScenario(scenario);
  assert.ok(errors.includes("event:event-with-invalid-delay:delayed-count-required"));
  assert.ok(errors.includes("promise:promise-with-invalid-delay:delayed-count-required"));
});
test("Pause peut mémoriser précisément l'écran interrompu", () => {
  const scenario = validScenario();
  const council = stateAfterRecords(scenario, Array.from({ length: 4 }, (_, index) => confirmedRecord(scenario, index)));
  const paused = { ...council, phase: "pause" as const, pausedFrom: "council" as const };
  assert.equal(isCampaignState(paused, scenario), true);
  assert.equal(isCampaignState({ ...paused, pausedFrom: "pause" }, scenario), false);
  assert.equal(isCampaignState({ ...paused, phase: "council" }, scenario), false);
});
