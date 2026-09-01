import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSessionPlan,
  refreshFutureSessionPlan,
  sessionPosition,
} from "./adaptive-session.ts";
import {
  SCENARIO_V11_CATALOGUE,
  V11_ADAPTIVE_DECISION_IDS,
  V11_COMMON_DECISION_IDS,
  V11_SYNTHESIS_DECISION_IDS,
} from "./scenario-v11-catalogue.ts";
import type { CampaignState } from "./types.ts";

function v11State(plan: readonly string[], completed = 0): CampaignState {
  return {
    schemaVersion: 5,
    scenarioVersion: 11,
    seed: 417,
    phase: "decision",
    chapterIndex: 0,
    decisionIndex: 0,
    sessionDecisionIds: [...plan],
    decisions: plan.slice(0, completed).map((decisionId, index) => ({
      decisionId,
      optionId: SCENARIO_V11_CATALOGUE.decisions.find((decision) => decision.id === decisionId)!.options[0]!.id,
      status: "confirmed",
      confirmedAtIndex: index + 1,
    })),
    baseline: {
      period: "2025", debtPeriod: "2025-Q4", nominalGdpMillions: 1, debtMillions: 1,
      annualBalanceMillions: -1, interestCostMillions: 1, nominalGrowthPercent: 1,
      sourceIds: ["test"], dataVersion: "test",
    },
    annualCheckpoints: [],
    indicators: {
      annualBalance: -1, debtToGdp: 1, interestCost: 1, growth: 1, employment: 100,
      investment: 100, publicServices: 50, majority: 50, reformCapacity: 50, opinion: 50,
      institutionalTrust: 50, financialCredibility: 50,
    },
    groups: {
      lowIncomeHouseholds: 50, middleClasses: 50, retirees: 50, publicEmployees: 50,
      privateEmployees: 50, unions: 50, businesses: 50, farmers: 50, localAuthorities: 50,
      creditors: 50, europeanPartners: 50, parliamentaryMajority: 50,
    },
    scheduledEvents: [], eventHistory: [], activePromises: [], promiseHistory: [], crisisHistory: [],
    resolvedCrisisIds: [], causalLedger: [], unlockedDecisionIds: [], lockedDecisionIds: [],
    savedAt: "1970-01-01T00:00:00.000Z",
  };
}

test("un plan V11 est déterministe et contient exactement 45 cartes distinctes", () => {
  const first = buildSessionPlan(SCENARIO_V11_CATALOGUE, 417);
  const repeated = buildSessionPlan(SCENARIO_V11_CATALOGUE, 417);

  assert.deepEqual(repeated, first);
  assert.equal(first.length, 45);
  assert.equal(new Set(first).size, 45);
  assert.ok(V11_COMMON_DECISION_IDS.every((id) => first.includes(id)));
  assert.ok(V11_SYNTHESIS_DECISION_IDS.every((id) => first.includes(id)));
  assert.equal(first.filter((id) => V11_ADAPTIVE_DECISION_IDS.includes(id)).length, 34);
  assert.equal(V11_ADAPTIVE_DECISION_IDS.filter((id) => !first.includes(id)).length, 10);
});

test("le plan V11 conserve une enveloppe de cartes dans chaque thème", () => {
  const plan = buildSessionPlan(SCENARIO_V11_CATALOGUE, 19);
  const chapterById = new Map(SCENARIO_V11_CATALOGUE.decisions.map((decision) => [decision.id, decision.chapterId]));
  const chapterIndexById = new Map(SCENARIO_V11_CATALOGUE.chapters.map((chapter, index) => [chapter.id, index]));
  for (const chapter of SCENARIO_V11_CATALOGUE.chapters) {
    const adaptive = V11_ADAPTIVE_DECISION_IDS.filter((id) => chapterById.get(id) === chapter.id);
    if (adaptive.length > 0) assert.ok(plan.some((id) => adaptive.includes(id)), chapter.id);
  }
  const chapterIndexes = plan.map((id) => chapterIndexById.get(chapterById.get(id)!)!);
  assert.deepEqual(chapterIndexes, [...chapterIndexes].sort((left, right) => left - right));
});

test("une carte future verrouillée est remplacée par une carte adaptative du même thème", () => {
  const plan = buildSessionPlan(SCENARIO_V11_CATALOGUE, 4);
  const chapterById = new Map(SCENARIO_V11_CATALOGUE.decisions.map((decision) => [decision.id, decision.chapterId]));
  const blockedId = "v11-05-epargne";
  const futureIndex = plan.indexOf(blockedId);
  assert.ok(futureIndex >= 0 && V11_ADAPTIVE_DECISION_IDS.some((candidate) => chapterById.get(candidate) === chapterById.get(blockedId) && !plan.includes(candidate)));
  const state = v11State(plan, futureIndex);
  state.lockedDecisionIds = [blockedId];

  const refreshed = refreshFutureSessionPlan(state, SCENARIO_V11_CATALOGUE);

  assert.equal(refreshed.sessionDecisionIds!.length, 45);
  assert.deepEqual(refreshed.sessionDecisionIds!.slice(0, futureIndex), plan.slice(0, futureIndex));
  assert.equal(refreshed.sessionDecisionIds!.includes(blockedId), false);
  assert.equal(chapterById.get(refreshed.sessionDecisionIds![futureIndex]!), chapterById.get(blockedId));
  assert.equal(new Set(refreshed.sessionDecisionIds).size, 45);
});

test("un choix fiscal structurant modifie seulement la suite fiscale de la partie", () => {
  const plan = buildSessionPlan(SCENARIO_V11_CATALOGUE, 4);
  const target = "v11-05-epargne";
  const targetIndex = plan.indexOf(target);
  assert.ok(targetIndex > 0, "seed fixture keeps the fiscal alternative in the route");
  const state = v11State(plan, 1);
  state.decisions[0] = {
    decisionId: "v11-01-prelevement-personnel",
    optionId: "v11-01-prelevement-personnel:option-1",
    status: "confirmed",
    confirmedAtIndex: 1,
  };

  const refreshed = refreshFutureSessionPlan(state, SCENARIO_V11_CATALOGUE);

  assert.deepEqual(refreshed.sessionDecisionIds!.slice(0, 1), plan.slice(0, 1));
  assert.notEqual(refreshed.sessionDecisionIds![targetIndex], target);
  assert.equal(refreshed.sessionDecisionIds!.length, 45);
});

test("deux choix opposés produisent bien deux parcours futurs différents de 45 cartes", () => {
  const plan = buildSessionPlan(SCENARIO_V11_CATALOGUE, 4);
  const unified = v11State(plan, 1);
  unified.decisions[0] = {
    decisionId: "v11-01-prelevement-personnel",
    optionId: "v11-01-prelevement-personnel:option-1",
    status: "confirmed",
    confirmedAtIndex: 1,
  };
  const separate = v11State(plan, 1);
  separate.decisions[0] = {
    decisionId: "v11-01-prelevement-personnel",
    optionId: "v11-01-prelevement-personnel:option-2",
    status: "confirmed",
    confirmedAtIndex: 1,
  };

  const unifiedRoute = refreshFutureSessionPlan(unified, SCENARIO_V11_CATALOGUE).sessionDecisionIds!;
  const separateRoute = refreshFutureSessionPlan(separate, SCENARIO_V11_CATALOGUE).sessionDecisionIds!;

  assert.equal(unifiedRoute.length, 45);
  assert.equal(separateRoute.length, 45);
  assert.deepEqual(unifiedRoute.slice(0, 1), separateRoute.slice(0, 1));
  assert.notDeepEqual(unifiedRoute.slice(1), separateRoute.slice(1));
});

test("un choix énergétique incompatible modifie seulement une carte énergétique future", () => {
  const plan = buildSessionPlan(SCENARIO_V11_CATALOGUE, 4);
  const nuclearIndex = plan.indexOf("v11-46-nucleaire");
  const renewablesIndex = plan.indexOf("v11-48-renouvelables");
  assert.ok(nuclearIndex >= 0 && renewablesIndex > nuclearIndex, "seed fixture keeps the energy alternative after nuclear");
  const state = v11State(plan, nuclearIndex + 1);
  state.decisions[nuclearIndex] = {
    decisionId: "v11-46-nucleaire",
    optionId: "v11-46-nucleaire:option-3",
    status: "confirmed",
    confirmedAtIndex: nuclearIndex + 1,
  };

  const refreshed = refreshFutureSessionPlan(state, SCENARIO_V11_CATALOGUE);

  assert.deepEqual(refreshed.sessionDecisionIds!.slice(0, nuclearIndex + 1), plan.slice(0, nuclearIndex + 1));
  assert.notEqual(refreshed.sessionDecisionIds![renewablesIndex], "v11-48-renouvelables");
  assert.equal(refreshed.sessionDecisionIds!.length, 45);
});

test("la position de session suit les 45 cartes persistées, pas les 55 de la bibliothèque", () => {
  const plan = buildSessionPlan(SCENARIO_V11_CATALOGUE, 91);
  const state = v11State(plan, 44);
  assert.deepEqual(sessionPosition(state, SCENARIO_V11_CATALOGUE), {
    chapterIndex: SCENARIO_V11_CATALOGUE.chapters.findIndex((chapter) => chapter.id === SCENARIO_V11_CATALOGUE.decisions.find((decision) => decision.id === plan[44])!.chapterId),
    decisionIndex: plan.slice(0, 45).filter((id) => SCENARIO_V11_CATALOGUE.decisions.find((decision) => decision.id === id)!.chapterId === SCENARIO_V11_CATALOGUE.decisions.find((decision) => decision.id === plan[44])!.chapterId).length - 1,
  });
});
