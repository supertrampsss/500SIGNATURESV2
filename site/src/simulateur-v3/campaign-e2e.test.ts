import assert from "node:assert/strict";
import test from "node:test";

import { currentDecision, selectOption } from "./campaign.ts";
import { availableConcessions, resolveCrisis } from "./crises.ts";
import { confirmSelection } from "./effects.ts";
import { advanceCampaign } from "./flow.ts";
import { SCENARIO_V3_CRISIS_RULES } from "./scenario-crises.ts";
import { SCENARIO_V3, SCENARIO_V3_PREVIEW } from "./scenario.ts";
import { restoreCampaign, saveCampaign, type StorageLike } from "./storage.ts";
import { createTestCampaign as createCampaign } from "./test-fixtures.ts";
import type { CampaignState } from "./types.ts";
import { isCampaignState } from "./validation.ts";

type Choice = "adopt" | "keep";

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

function playUntil(
  initial: CampaignState,
  stop: (state: CampaignState) => boolean,
  choices: Readonly<Record<string, Choice>> = {},
): CampaignState {
  let state = initial;
  for (let step = 0; step < 400; step += 1) {
    if (stop(state)) return state;
    assert.notEqual(state.phase, "verdict", "verdict atteint avant l'état attendu");
    assert.notEqual(state.phase, "crisis", "aucune crise n'est injectée dans ce parcours");
    if (state.phase === "decision") {
      const decision = currentDecision(state, SCENARIO_V3);
      assert.ok(decision);
      const suffix = choices[decision.id] ?? "keep";
      const option = decision.options.find((candidate) => candidate.id === `${decision.id}:${suffix}`)
        ?? (suffix === "keep" ? decision.options.at(-1) : decision.options[0]);
      assert.ok(option, `option ${suffix} absente pour ${decision.id}`);
      state = confirmSelection(selectOption(state, SCENARIO_V3, decision.id, option.id), SCENARIO_V3);
    } else {
      state = advanceCampaign(state, SCENARIO_V3, []);
    }
    assert.equal(isCampaignState(state, SCENARIO_V3), true, `état invalide en phase ${state.phase}`);
  }
  throw new Error("état attendu non atteint en 400 transitions");
}

function playFullCampaign(optionIndex: 0 | 1): CampaignState {
  let state: CampaignState = { ...createCampaign(SCENARIO_V3_PREVIEW), phase: "chapter_intro" };

  for (let step = 0; step < 400 && state.phase !== "verdict"; step += 1) {
    if (state.phase === "decision") {
      const decision = currentDecision(state, SCENARIO_V3_PREVIEW);
      assert.ok(decision, `dossier introuvable après ${state.decisions.length} décisions`);
      const option = decision.options[optionIndex] ?? decision.options[0];
      assert.ok(option, `option introuvable pour ${decision.id}`);
      state = confirmSelection(selectOption(state, SCENARIO_V3_PREVIEW, decision.id, option.id), SCENARIO_V3_PREVIEW);
    } else if (state.phase === "crisis") {
      const concession = availableConcessions(state, SCENARIO_V3_CRISIS_RULES)[0];
      state = resolveCrisis(state, SCENARIO_V3_CRISIS_RULES, concession?.id ?? "hold-course");
    } else {
      state = advanceCampaign(state, SCENARIO_V3_PREVIEW, SCENARIO_V3_CRISIS_RULES);
    }

    if (state.phase === "council") {
      assert.ok(state.scheduledEvents.every((event) => event.dueAtDecision > state.decisions.length));
      assert.ok(state.activePromises.every((promise) => promise.dueAtDecision > state.decisions.length));
      if (state.decisions.length === 53 && optionIndex === 0) {
        assert.ok(state.eventHistory.some((event) => event.id === "housing-rent-capture"));
      }
    }
    assert.equal(isCampaignState(state, SCENARIO_V3_PREVIEW), true, `état invalide en phase ${state.phase}`);
  }

  return state;
}

test("les 60 dossiers atteignent le verdict en choisissant toujours la première option", () => {
  const state = playFullCampaign(0);
  assert.equal(state.phase, "verdict");
  assert.equal(state.decisions.length, 60);
  assert.equal(new Set(state.decisions.map((decision) => decision.decisionId)).size, 60);
});

test("les 60 dossiers atteignent le verdict en choisissant toujours la seconde option", () => {
  const state = playFullCampaign(1);
  assert.equal(state.phase, "verdict");
  assert.equal(state.decisions.length, 60);
  assert.equal(new Set(state.decisions.map((decision) => decision.decisionId)).size, 60);
});

test("deux lignes politiques opposées produisent des verdicts économiques et politiques différents", () => {
  const adoption = playFullCampaign(0);
  const statuQuo = playFullCampaign(1);

  assert.notEqual(adoption.indicators.growth, statuQuo.indicators.growth);
  const politicalIndicators = [
    "majority", "opinion", "institutionalTrust", "financialCredibility",
  ] as const;
  assert.ok(politicalIndicators.some((key) => adoption.indicators[key] !== statuQuo.indicators[key]));
  assert.ok(adoption.causalLedger.some((entry) => entry.key === "growth"));
  assert.ok(adoption.causalLedger.some((entry) => entry.key === "majority"));
});

test("les 39 heures ne produisent leurs effets qu'au Conseil de l'année 2", () => {
  const target = "retablir-la-semaine-de-39-heures";
  let state: CampaignState = { ...createCampaign(SCENARIO_V3), phase: "chapter_intro" };

  state = playUntil(state, (candidate) =>
    candidate.phase === "decision" && currentDecision(candidate, SCENARIO_V3)?.id === target);
  assert.equal(state.decisions.length, 13);
  const beforeConfirmation = structuredClone(state);
  const decision = currentDecision(state, SCENARIO_V3)!;
  const adopt = decision.options.find((option) => option.id === `${target}:adopt`)!;
  state = confirmSelection(selectOption(state, SCENARIO_V3, target, adopt.id), SCENARIO_V3);

  assert.equal(state.phase, "decision_result");
  assert.equal(state.decisions.length, 14);
  assert.deepEqual(state.indicators, beforeConfirmation.indicators);
  assert.deepEqual(state.groups, beforeConfirmation.groups);
  const queuedAtConfirmation = state.scheduledEvents.filter((item) => item.sourceDecisionId === target);
  assert.equal(queuedAtConfirmation.length, 7);
  assert.ok(queuedAtConfirmation.every((item) => item.dueAtDecision === 32));
  assert.ok(queuedAtConfirmation.some((item) => item.id === "hours-wage-bargain"));

  const storage = memoryStorage();
  state = saveCampaign(storage, state, new Date("2026-08-30T00:00:00.000Z"));
  const restored = restoreCampaign(storage, SCENARIO_V3);
  if (restored.kind !== "restored") assert.fail(`restauration inattendue : ${restored.kind}`);
  state = restored.state;
  assert.equal(state.scheduledEvents.filter((item) => item.sourceDecisionId === target).length, 7);

  state = playUntil(state, (candidate) => candidate.phase === "council" && candidate.decisions.length === 16);
  assert.equal(state.annualCheckpoints.at(-1)?.year, 1);
  assert.equal(state.eventHistory.filter((item) => item.sourceDecisionId === target).length, 0);
  assert.ok(state.scheduledEvents.filter((item) => item.sourceDecisionId === target)
    .every((item) => item.dueAtDecision === 32));

  state = playUntil(state, (candidate) =>
    candidate.phase === "decision_result" && candidate.decisions.length === 32);
  const beforeResolution = structuredClone(state);
  const delayed = advanceCampaign(state, SCENARIO_V3, []);
  assert.equal(delayed.phase, "delayed_event");
  assert.deepEqual(delayed.indicators, beforeResolution.indicators);
  assert.deepEqual(delayed.groups, beforeResolution.groups);

  const council = advanceCampaign(delayed, SCENARIO_V3, []);
  assert.equal(council.phase, "council");
  assert.equal(council.indicators.annualBalance, beforeResolution.indicators.annualBalance + 2_000);
  assert.ok(Math.abs((council.indicators.growth - beforeResolution.indicators.growth) - 0.12) < 1e-12);
  assert.equal(council.indicators.employment, beforeResolution.indicators.employment - 4);
  assert.equal(council.groups.businesses, beforeResolution.groups.businesses + 5);
  assert.equal(council.groups.unions, beforeResolution.groups.unions - 8);
  assert.equal(council.groups.privateEmployees, beforeResolution.groups.privateEmployees - 5);

  const resolved = council.eventHistory.filter((item) => item.sourceDecisionId === target);
  assert.equal(resolved.length, 7);
  assert.ok(resolved.some((item) => item.id === "hours-wage-bargain"));
  assert.equal(council.scheduledEvents.filter((item) => item.sourceDecisionId === target).length, 0);
  const checkpoint = council.annualCheckpoints.at(-1)!;
  assert.equal(checkpoint.year, 2);
  assert.equal(checkpoint.afterDecisionCount, 32);
  const budgetCause = council.causalLedger.find((entry) =>
    entry.sourceType === "event" && entry.sourceId.includes(target) && entry.key === "annualBalance");
  const growthCause = council.causalLedger.find((entry) =>
    entry.sourceType === "event" && entry.sourceId.includes(target) && entry.key === "growth");
  assert.ok(budgetCause && checkpoint.causes.includes(budgetCause.id));
  assert.ok(growthCause && checkpoint.causes.includes(growthCause.id));
});

test("l'allocation unique attend l'année 3 et survit à une reprise en phase d'événement", () => {
  const target = "allocation-sociale-unique";
  let state: CampaignState = { ...createCampaign(SCENARIO_V3), phase: "chapter_intro" };
  state = playUntil(state, (candidate) =>
    candidate.phase === "decision" && currentDecision(candidate, SCENARIO_V3)?.id === target);
  const beforeConfirmation = structuredClone(state);
  const option = currentDecision(state, SCENARIO_V3)!.options.find((candidate) => candidate.id === `${target}:adopt`)!;
  state = confirmSelection(selectOption(state, SCENARIO_V3, target, option.id), SCENARIO_V3);

  assert.equal(state.decisions.length, 16);
  assert.deepEqual(state.indicators, beforeConfirmation.indicators);
  assert.deepEqual(state.groups, beforeConfirmation.groups);
  assert.deepEqual(new Set(state.lockedDecisionIds), new Set([
    "verser-le-rsa-automatiquement-fin-du-non",
    "porter-le-rsa-au-seuil-de",
  ]));
  assert.ok(state.scheduledEvents.filter((item) => item.sourceDecisionId === target)
    .every((item) => item.dueAtDecision === 39));

  state = playUntil(state, (candidate) => candidate.phase === "council" && candidate.decisions.length === 32);
  assert.equal(state.eventHistory.filter((item) => item.sourceDecisionId === target).length, 0);
  assert.equal(state.causalLedger.filter((entry) => entry.sourceId.includes(target)).length, 0);

  state = playUntil(state, (candidate) =>
    candidate.phase === "decision_result" && candidate.decisions.length === 39);
  const beforeResolution = structuredClone(state);
  let delayed = advanceCampaign(state, SCENARIO_V3, []);
  assert.equal(delayed.phase, "delayed_event");
  assert.deepEqual(delayed.indicators, beforeResolution.indicators);

  const storage = memoryStorage();
  delayed = saveCampaign(storage, delayed, new Date("2026-08-30T00:00:00.000Z"));
  const restored = restoreCampaign(storage, SCENARIO_V3);
  if (restored.kind !== "restored") assert.fail(`restauration inattendue : ${restored.kind}`);
  assert.equal(restored.state.phase, "delayed_event");

  const council = advanceCampaign(restored.state, SCENARIO_V3, []);
  assert.equal(council.phase, "council");
  assert.equal(council.indicators.annualBalance, beforeResolution.indicators.annualBalance + 1_000);
  assert.equal(council.indicators.publicServices, beforeResolution.indicators.publicServices + 2);
  assert.equal(council.indicators.institutionalTrust, beforeResolution.indicators.institutionalTrust + 2);
  assert.equal(council.groups.lowIncomeHouseholds, beforeResolution.groups.lowIncomeHouseholds - 4);
  assert.equal(council.eventHistory.filter((item) => item.sourceDecisionId === target).length, 5);
  assert.equal(council.eventHistory.filter((item) => item.id === "single-benefit-losers").length, 1);
});

test("le relèvement de l'âge à 65 ans reste absent jusqu'au Conseil de l'année 5", () => {
  const target = "repousser-l-age-legal-a-65-ans";
  let state: CampaignState = { ...createCampaign(SCENARIO_V3), phase: "chapter_intro" };
  state = playUntil(state, (candidate) =>
    candidate.phase === "decision" && currentDecision(candidate, SCENARIO_V3)?.id === target);
  const option = currentDecision(state, SCENARIO_V3)!.options.find((candidate) => candidate.id === `${target}:adopt`)!;
  state = confirmSelection(selectOption(state, SCENARIO_V3, target, option.id), SCENARIO_V3);

  assert.ok(state.scheduledEvents.filter((item) => item.sourceDecisionId === target)
    .every((item) => item.dueAtDecision === 60));
  for (const boundary of [16, 32, 39, 53]) {
    state = playUntil(state, (candidate) => candidate.phase === "council" && candidate.decisions.length === boundary);
    assert.equal(state.eventHistory.filter((item) => item.sourceDecisionId === target).length, 0, `Conseil ${boundary}`);
    assert.equal(state.causalLedger.filter((entry) => entry.sourceId.includes(target)).length, 0, `Conseil ${boundary}`);
  }

  state = playUntil(state, (candidate) =>
    candidate.phase === "decision_result" && candidate.decisions.length === 60);
  const beforeResolution = structuredClone(state);
  const delayed = advanceCampaign(state, SCENARIO_V3, []);
  assert.equal(delayed.phase, "delayed_event");
  const council = advanceCampaign(delayed, SCENARIO_V3, []);
  assert.equal(council.phase, "council");
  assert.equal(council.indicators.annualBalance, beforeResolution.indicators.annualBalance + 8_500);
  assert.equal(council.indicators.employment, beforeResolution.indicators.employment - 1);
  assert.equal(council.groups.privateEmployees, beforeResolution.groups.privateEmployees - 5);
  assert.equal(council.groups.unions, beforeResolution.groups.unions - 3);
  assert.equal(council.eventHistory.filter((item) => item.sourceDecisionId === target).length, 5);
  assert.equal(council.eventHistory.filter((item) => item.id === "senior-employment-test").length, 1);
  const superseded = council.decisions.find((record) => record.decisionId === "revenir-a-62-ans");
  assert.equal(superseded?.status, "superseded");
});
