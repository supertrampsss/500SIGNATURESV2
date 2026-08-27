import assert from "node:assert/strict";
import { test } from "node:test";

import { INITIAL_INDICATORS, createCampaign, selectOption } from "./campaign.ts";
import {
  applyEffect,
  confirmSelection,
  resolveDueEvents,
  resolveDuePromises,
  scheduleOptionConsequences,
} from "./effects.ts";
import { validScenario } from "./test-fixtures.ts";
import type { EffectRule, IndicatorKey, Scenario } from "./types.ts";
import { isCampaignState } from "./validation.ts";

function scenarioWithEffect(key: IndicatorKey, delta: number, timing: EffectRule["timing"]): Scenario {
  const scenario = validScenario();
  const option = scenario.decisions[0]!.options[0]!;
  option.effects = [{
    id: "effect-1",
    target: "indicator",
    key,
    delta,
    timing,
    duration: "once",
    explanation: "Effet test",
  }];
  return scenario;
}

function startAtFirstDecision(scenario: Scenario) {
  return { ...createCampaign(scenario, 42), phase: "decision" as const };
}

function confirmFirstDecision(scenario: Scenario) {
  const started = startAtFirstDecision(scenario);
  return confirmSelection(selectOption(started, scenario, "decision-1", "decision-1-option-a"), scenario);
}

test("confirmer applique les effets immédiats une seule fois", () => {
  const scenario = scenarioWithEffect("annualBalance", 1_000, { kind: "immediate" });
  const started = startAtFirstDecision(scenario);
  const selected = selectOption(started, scenario, "decision-1", "decision-1-option-a");
  const confirmed = confirmSelection(selected, scenario);
  assert.equal(confirmed.indicators.annualBalance, started.indicators.annualBalance + 1_000);
  assert.equal(confirmed.decisions[0]?.status, "confirmed");
  assert.equal(confirmed.phase, "decision_result");
  assert.throws(() => confirmSelection(confirmed, scenario), /selection required/);
});

test("un effet différé attend le bon nombre de décisions", () => {
  const scenario = scenarioWithEffect("growth", -0.4, { kind: "after_decisions", count: 2 });
  const confirmed = confirmFirstDecision(scenario);
  assert.equal(confirmed.indicators.growth, INITIAL_INDICATORS.growth);
  assert.equal(confirmed.scheduledEvents[0]?.dueAtDecision, 3);
});

test("chaque variation conserve sa cause lisible", () => {
  const scenario = scenarioWithEffect("opinion", -4, { kind: "immediate" });
  const confirmed = confirmFirstDecision(scenario);
  assert.deepEqual(confirmed.causalLedger.at(-1), {
    id: "decision:decision-1:decision-1-option-a:effect-1:1",
    sourceType: "decision",
    sourceId: "decision-1:decision-1-option-a",
    target: "indicator",
    key: "opinion",
    delta: -4,
    duration: "once",
    explanation: "Effet test",
    appliedAtDecision: 1,
  });
});

test("une confirmation avec effet conserve un état persistable", () => {
  const scenario = scenarioWithEffect("opinion", -4, { kind: "immediate" });
  assert.equal(isCampaignState(confirmFirstDecision(scenario), scenario), true);
});

test("une promesse échue applique son coût et quitte les promesses actives", () => {
  const scenario = validScenario();
  const option = scenario.decisions[0]!.options[0]!;
  option.promises = [{
    id: "promise-1",
    label: "Compenser les ménages",
    dueAfterDecisions: 1,
    failureEffects: [{
      id: "promise-opinion",
      target: "indicator",
      key: "opinion",
      delta: -6,
      timing: { kind: "immediate" },
      duration: "once",
      explanation: "La compensation promise n'est pas arrivée.",
    }],
  }];
  const confirmed = confirmFirstDecision(scenario);
  const due = { ...confirmed, decisions: [
    ...confirmed.decisions,
    { decisionId: "decision-2", optionId: "decision-2-option-a", status: "confirmed" as const, confirmedAtIndex: 2 },
  ] };
  const resolved = resolveDuePromises(due);
  assert.deepEqual(resolved.failedPromiseIds, ["promise-1"]);
  assert.equal(resolved.state.activePromises.length, 0);
  assert.equal(resolved.state.indicators.opinion, confirmed.indicators.opinion - 6);
  assert.equal(resolved.state.causalLedger.at(-1)?.sourceType, "promise");
});

test("les bornes politiques sont appliquées sans modifier l'état d'origine", () => {
  const scenario = validScenario();
  const state = createCampaign(scenario);
  const effect: EffectRule = {
    id: "clamp",
    target: "indicator",
    key: "opinion",
    delta: 100,
    timing: { kind: "immediate" },
    duration: "once",
    explanation: "Soutien accru.",
  };
  const updated = applyEffect(state, effect, { sourceType: "decision", sourceId: "decision-1" });
  assert.equal(updated.indicators.opinion, 100);
  assert.equal(state.indicators.opinion, INITIAL_INDICATORS.opinion);
  assert.notEqual(updated.indicators, state.indicators);
  assert.equal(updated.groups, state.groups);
});

test("un effet différé est programmé mais jamais appliqué directement", () => {
  const scenario = scenarioWithEffect("growth", 2, { kind: "after_decisions", count: 1 });
  const state = createCampaign(scenario);
  const result = scheduleOptionConsequences(state, scenario.decisions[0]!, scenario.decisions[0]!.options[0]!);
  assert.equal(result.indicators.growth, INITIAL_INDICATORS.growth);
  assert.deepEqual(result.scheduledEvents[0], {
    id: "decision-1:decision-1-option-a:effect-1",
    sourceDecisionId: "decision-1",
    sourceOptionId: "decision-1-option-a",
    dueAtDecision: 1,
    title: "Effet différé : Decision decision-1",
    body: "Effet test",
    effects: [{ ...scenario.decisions[0]!.options[0]!.effects[0]!, timing: { kind: "immediate" } }],
  });
});

test("les événements échus appliquent leurs effets et sortent de la file", () => {
  const scenario = validScenario();
  const option = scenario.decisions[0]!.options[0]!;
  option.scheduledEvents = [{
    id: "event-1",
    title: "Annonce publique",
    body: "Les conséquences deviennent visibles.",
    afterDecisions: 1,
    effects: [{
      id: "event-opinion",
      target: "indicator",
      key: "opinion",
      delta: -3,
      timing: { kind: "immediate" },
      duration: "once",
      explanation: "Réaction négative.",
    }],
  }];
  const confirmed = confirmFirstDecision(scenario);
  const resolved = resolveDueEvents({ ...confirmed, decisionIndex: 1, decisions: [...confirmed.decisions, {
    decisionId: "decision-2", optionId: "decision-2-option-a", status: "confirmed", confirmedAtIndex: 2,
  }] });
  assert.equal(resolved.events[0]?.id, "event-1");
  assert.equal(resolved.state.scheduledEvents.length, 0);
  assert.equal(resolved.state.eventHistory[0]?.id, "event-1");
  assert.equal(resolved.state.indicators.opinion, confirmed.indicators.opinion - 3);
  assert.equal(resolved.state.causalLedger.at(-1)?.sourceType, "event");
  assert.equal(isCampaignState(resolved.state, scenario), true);
});

test("confirmer applique les verrous, déverrouillages et promesses remplies", () => {
  const scenario = validScenario();
  const firstOption = scenario.decisions[0]!.options[0]!;
  firstOption.promises = [{
    id: "old-promise",
    label: "Ancienne promesse",
    dueAfterDecisions: 3,
    failureEffects: [],
  }];
  const option = scenario.decisions[1]!.options[0]!;
  option.locks = ["decision-3"];
  option.unlocks = ["decision-4"];
  option.fulfillsPromises = ["old-promise"];
  const state = {
    ...confirmFirstDecision(scenario),
    phase: "decision" as const,
    decisionIndex: 1,
    lockedDecisionIds: ["decision-4"],
  };
  const confirmed = confirmSelection(selectOption(state, scenario, "decision-2", "decision-2-option-a"), scenario);
  assert.deepEqual(confirmed.lockedDecisionIds, ["decision-3"]);
  assert.ok(confirmed.unlockedDecisionIds.includes("decision-4"));
  assert.equal(confirmed.activePromises[0]?.fulfilled, true);
});

test("un delta non fini est refusé", () => {
  const state = createCampaign(validScenario());
  const effect: EffectRule = {
    id: "invalid", target: "group", key: "unions", delta: Number.NaN,
    timing: { kind: "immediate" }, duration: "once", explanation: "Invalide.",
  };
  assert.throws(() => applyEffect(state, effect, { sourceType: "event", sourceId: "event-1" }), /finite/);
});

test("confirmer refuse un scénario modifié avec une conséquence à échéance différée", () => {
  const scenario = validScenario();
  const started = startAtFirstDecision(scenario);
  scenario.decisions[0]!.options[0]!.scheduledEvents = [{
    id: "event-invalid", title: "Événement", body: "Texte", afterDecisions: 1,
    effects: [{
      id: "effect-invalid", target: "indicator", key: "opinion", delta: -1,
      timing: { kind: "after_decisions", count: 1 }, duration: "once", explanation: "Trop tard.",
    }],
  }];
  const selected = selectOption(started, scenario, "decision-1", "decision-1-option-a");
  assert.throws(() => confirmSelection(selected, scenario), /Invalid scenario/);
});

test("confirmer refuse un scénario modifié avec un événement sans titre", () => {
  const scenario = validScenario();
  const started = startAtFirstDecision(scenario);
  scenario.decisions[0]!.options[0]!.scheduledEvents = [{
    id: "event-without-title",
    title: "",
    body: "Texte",
    afterDecisions: 1,
    effects: [],
  }];

  const selected = selectOption(started, scenario, "decision-1", "decision-1-option-a");
  assert.throws(() => confirmSelection(selected, scenario), /event:event-without-title:title-must-be-non-empty-string/);
});

test("résoudre un événement non valide échoue au lieu de changer son timing", () => {
  const scenario = validScenario();
  const state = createCampaign(scenario);
  const malformed = {
    ...state,
    decisions: [{ decisionId: "decision-1", optionId: "decision-1-option-a", status: "confirmed" as const, confirmedAtIndex: 1 }],
    scheduledEvents: [{
      id: "event-invalid", sourceDecisionId: "decision-1", sourceOptionId: "decision-1-option-a",
      dueAtDecision: 1, title: "Événement", body: "Texte", effects: [{
        id: "effect-invalid", target: "indicator" as const, key: "opinion" as const, delta: -1,
        timing: { kind: "after_decisions" as const, count: 1 }, duration: "once" as const, explanation: "Trop tard.",
      }],
    }],
  };
  assert.throws(() => resolveDueEvents(malformed), /immediate/);
});

test("résoudre une promesse non valide échoue au lieu de changer son timing", () => {
  const scenario = validScenario();
  const state = createCampaign(scenario);
  const malformed = {
    ...state,
    decisions: [{ decisionId: "decision-1", optionId: "decision-1-option-a", status: "confirmed" as const, confirmedAtIndex: 1 }],
    activePromises: [{
      id: "promise-invalid", sourceDecisionId: "decision-1", sourceOptionId: "decision-1-option-a", label: "Promesse", dueAtDecision: 1,
      fulfilled: false, failureEffects: [{
        id: "effect-invalid", target: "indicator" as const, key: "opinion" as const, delta: -1,
        timing: { kind: "after_decisions" as const, count: 1 }, duration: "once" as const, explanation: "Trop tard.",
      }],
    }],
  };
  assert.throws(() => resolveDuePromises(malformed), /immediate/);
});

test("un effet hostile indicateur vers farmers est rejeté sans créer de NaN", () => {
  const state = createCampaign(validScenario());
  const hostile = {
    id: "hostile-effect",
    target: "indicator",
    key: "farmers",
    delta: 1,
    timing: { kind: "immediate" },
    duration: "once",
    explanation: "Une cible incohérente.",
  } as unknown as EffectRule;

  assert.throws(() => applyEffect(state, hostile, { sourceType: "decision", sourceId: "decision-1:decision-1-option-a" }), /Invalid effect rule/);
  assert.ok(Object.values(state.indicators).every(Number.isFinite));
});

test("un effet annual est appliqué une fois et journalisé comme rythme annuel", () => {
  const scenario = validScenario();
  scenario.decisions[0]!.options[0]!.effects = [{
    id: "annual-balance",
    target: "indicator",
    key: "annualBalance",
    delta: 1_200,
    timing: { kind: "immediate" },
    duration: "annual",
    explanation: "Le rythme annuel est relevé.",
  }];

  const confirmed = confirmFirstDecision(scenario);
  const resolvedEvents = resolveDueEvents(confirmed);
  const resolvedPromises = resolveDuePromises(resolvedEvents.state);

  assert.equal(confirmed.indicators.annualBalance, INITIAL_INDICATORS.annualBalance + 1_200);
  assert.equal(resolvedPromises.state.indicators.annualBalance, INITIAL_INDICATORS.annualBalance + 1_200);
  assert.deepEqual(confirmed.causalLedger, [{
    id: "decision:decision-1:decision-1-option-a:annual-balance:1",
    sourceType: "decision",
    sourceId: "decision-1:decision-1-option-a",
    target: "indicator",
    key: "annualBalance",
    delta: 1_200,
    duration: "annual",
    explanation: "Le rythme annuel est relevé.",
    appliedAtDecision: 1,
  }]);
});

test("les conséquences matérialisées ne changent pas après mutation du scénario", () => {
  const scenario = validScenario();
  const option = scenario.decisions[0]!.options[0]!;
  const delayedEffect: EffectRule = {
    id: "copied-delayed",
    target: "indicator",
    key: "growth",
    delta: -2,
    timing: { kind: "after_decisions", count: 1 },
    duration: "once",
    explanation: "Le coût différé reste inchangé.",
  };
  const eventEffect: EffectRule = {
    id: "copied-event-effect",
    target: "indicator",
    key: "opinion",
    delta: -3,
    timing: { kind: "immediate" },
    duration: "once",
    explanation: "La réaction reste inchangée.",
  };
  const promiseEffect: EffectRule = {
    id: "copied-promise-effect",
    target: "indicator",
    key: "majority",
    delta: -4,
    timing: { kind: "immediate" },
    duration: "once",
    explanation: "Le coût de la promesse reste inchangé.",
  };
  option.effects = [delayedEffect];
  option.scheduledEvents = [{
    id: "copied-event",
    title: "Événement copié",
    body: "Le contenu est figé.",
    afterDecisions: 1,
    effects: [eventEffect],
  }];
  option.promises = [{
    id: "copied-promise",
    label: "Promesse copiée",
    dueAfterDecisions: 1,
    failureEffects: [promiseEffect],
  }];

  const confirmed = confirmFirstDecision(scenario);
  delayedEffect.delta = -99;
  (delayedEffect.timing as { kind: string; count?: number }).count = 99;
  eventEffect.delta = -99;
  (eventEffect.timing as { kind: string; count?: number }).kind = "after_decisions";
  promiseEffect.delta = -99;
  (promiseEffect.timing as { kind: string; count?: number }).kind = "after_decisions";

  assert.equal(confirmed.scheduledEvents.find((event) => event.id === "decision-1:decision-1-option-a:copied-delayed")?.effects[0]?.delta, -2);
  assert.equal(confirmed.scheduledEvents.find((event) => event.id === "copied-event")?.effects[0]?.timing.kind, "immediate");
  assert.equal(confirmed.activePromises[0]?.failureEffects[0]?.delta, -4);

  const atSecondDecision = {
    ...confirmed,
    chapterIndex: 0,
    decisionIndex: 1,
    decisions: [...confirmed.decisions, {
      decisionId: "decision-2",
      optionId: "decision-2-option-a",
      status: "confirmed" as const,
      confirmedAtIndex: 2,
    }],
  };
  const events = resolveDueEvents(atSecondDecision);
  const promises = resolveDuePromises(events.state);

  assert.equal(promises.state.indicators.growth, INITIAL_INDICATORS.growth - 2);
  assert.equal(promises.state.indicators.opinion, INITIAL_INDICATORS.opinion - 3);
  assert.equal(promises.state.indicators.majority, INITIAL_INDICATORS.majority - 4);
});

test("la matérialisation refuse une conséquence créée à la décision 96 et due après la campagne", () => {
  const scenario = validScenario();
  const decision = scenario.decisions[95]!;
  const option = decision.options[0]!;
  option.effects = [{
    id: "after-campaign",
    target: "indicator",
    key: "growth",
    delta: -1,
    timing: { kind: "after_decisions", count: 1 },
    duration: "once",
    explanation: "Cette règle arrive trop tard.",
  }];
  const state = {
    ...createCampaign(validScenario()),
    decisions: scenario.decisions.map((candidate, index) => ({
      decisionId: candidate.id,
      optionId: candidate.options[0]!.id,
      status: "confirmed" as const,
      confirmedAtIndex: index + 1,
    })),
  };

  assert.throws(() => scheduleOptionConsequences(state, decision, option), /after decision 96/);
});
