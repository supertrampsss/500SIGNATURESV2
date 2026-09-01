import {
  V11_ADAPTIVE_DECISION_IDS,
  V11_COMMON_DECISION_IDS,
  V11_SYNTHESIS_DECISION_IDS,
} from "./scenario-v11-catalogue.ts";
import type { CampaignState, Decision, Scenario } from "./types.ts";

export const V11_SESSION_LENGTH = 45;
const V11_ADAPTIVE_COUNT = 32;
const V11_REQUIRED_BUDGET_CAPACITY_MILLIONS = 152_532;

/**
 * Editorial alternatives for a shorter replayable route. They are deliberately
 * narrow: a confirmed structural direction can replace only an unplayed card
 * in the same chapter, never an anchor or an already rendered decision.
 */
const V11_ROUTE_EXCLUSIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "v11-46-nucleaire:option-3": ["v11-48-renouvelables"],
});

type Random = () => number;

function seededRandom(seed: number): Random {
  let value = (Math.trunc(seed) >>> 0) || 0x6d2b79f5;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4_294_967_296;
  };
}

function shuffled<T>(values: readonly T[], random: Random): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}

function decisionMap(catalogue: Scenario): Map<string, Decision> {
  return new Map(catalogue.decisions.map((decision) => [decision.id, decision]));
}

function assertV11Roles(catalogue: Scenario): void {
  if (catalogue.version !== 11) throw new Error("V11 session requires scenario version 11");
  const knownIds = new Set(catalogue.decisions.map((decision) => decision.id));
  const allRoleIds = [...V11_COMMON_DECISION_IDS, ...V11_SYNTHESIS_DECISION_IDS, ...V11_ADAPTIVE_DECISION_IDS];
  if (allRoleIds.length !== catalogue.decisions.length || new Set(allRoleIds).size !== catalogue.decisions.length || allRoleIds.some((id) => !knownIds.has(id))) {
    throw new Error("Invalid V11 session roles");
  }
}

function maximumAnnualGain(decision: Decision): number {
  return Math.max(...decision.options.map((option) => option.budgetProfile.runRateMillions));
}

function planBudgetCapacity(plan: readonly string[], byId: ReadonlyMap<string, Decision>): number {
  return plan.reduce((sum, id) => sum + maximumAnnualGain(byId.get(id)!), 0);
}

function repairBudgetCapacity(
  plan: string[],
  catalogue: Scenario,
  futureStart: number,
  replacedIds: Set<string>,
): void {
  const byId = decisionMap(catalogue);
  if (planBudgetCapacity(plan, byId) >= V11_REQUIRED_BUDGET_CAPACITY_MILLIONS) return;
  const omitted = V11_ADAPTIVE_DECISION_IDS.filter((id) => !plan.includes(id))
    .sort((left, right) => maximumAnnualGain(byId.get(right)!) - maximumAnnualGain(byId.get(left)!));

  for (const candidateId of omitted) {
    if (planBudgetCapacity(plan, byId) >= V11_REQUIRED_BUDGET_CAPACITY_MILLIONS) break;
    const candidate = byId.get(candidateId)!;
    const candidateGain = maximumAnnualGain(candidate);
    let replacementIndex = -1;
    let replacementGain = Number.POSITIVE_INFINITY;
    for (let index = futureStart; index < plan.length; index += 1) {
      const selectedId = plan[index]!;
      if (!V11_ADAPTIVE_DECISION_IDS.includes(selectedId)) continue;
      const selected = byId.get(selectedId)!;
      const selectedGain = maximumAnnualGain(selected);
      if (selected.chapterId === candidate.chapterId && selectedGain < candidateGain && selectedGain < replacementGain) {
        replacementIndex = index;
        replacementGain = selectedGain;
      }
    }
    if (replacementIndex < 0) continue;
    replacedIds.add(plan[replacementIndex]!);
    plan[replacementIndex] = candidateId;
  }
}

/** Build the immutable 45-card route for one V11 mandate. */
export function buildSessionPlan(catalogue: Scenario, seed: number): string[] {
  assertV11Roles(catalogue);
  const byId = decisionMap(catalogue);
  const random = seededRandom(seed);
  // Every route keeps the actual budget levers. Replayability comes from the
  // remaining nine cards, not from silently creating an unwinnable mandate.
  const selectedAdaptive = new Set(V11_ADAPTIVE_DECISION_IDS.filter((id) => maximumAnnualGain(byId.get(id)!) > 0));

  // Keep at least one adaptive card in every chapter, including themes whose
  // choices only spend money or change institutions.
  for (const chapter of catalogue.chapters) {
    const candidates = V11_ADAPTIVE_DECISION_IDS.filter((id) => byId.get(id)?.chapterId === chapter.id);
    if (candidates.length > 0 && !candidates.some((id) => selectedAdaptive.has(id))) {
      selectedAdaptive.add(shuffled(candidates, random)[0]!);
    }
  }
  const remainingCandidates = V11_ADAPTIVE_DECISION_IDS.filter((id) => !selectedAdaptive.has(id));
  for (const id of shuffled(remainingCandidates, random).slice(0, V11_ADAPTIVE_COUNT - selectedAdaptive.size)) selectedAdaptive.add(id);
  if (selectedAdaptive.size !== V11_ADAPTIVE_COUNT) throw new Error("Invalid V11 adaptive selection");

  const selected = new Set([...V11_COMMON_DECISION_IDS, ...V11_SYNTHESIS_DECISION_IDS, ...selectedAdaptive]);
  const plan = catalogue.chapters.flatMap((chapter) => chapter.decisionIds.filter((id) => selected.has(id)));
  if (plan.length !== V11_SESSION_LENGTH || new Set(plan).size !== V11_SESSION_LENGTH) throw new Error("Invalid V11 session plan");
  return plan;
}

function completedIds(state: CampaignState): Set<string> {
  return new Set(state.decisions.map((record) => record.decisionId));
}

function selectedScopeKeys(state: CampaignState, catalogue: Scenario): Set<string> {
  const byId = decisionMap(catalogue);
  return new Set(state.decisions.flatMap((record) => byId.get(record.decisionId)?.options
    .find((option) => option.id === record.optionId)?.budgetProfile.exclusiveScopeKeys ?? []));
}

function excludedByConfirmedRoute(state: CampaignState): Set<string> {
  return new Set(state.decisions.flatMap((record) =>
    V11_ROUTE_EXCLUSIONS[record.optionId] ?? [],
  ));
}

function isFutureInadmissible(
  decision: Decision,
  state: CampaignState,
  completed: ReadonlySet<string>,
  scopes: ReadonlySet<string>,
  routeExclusions: ReadonlySet<string>,
): boolean {
  if (routeExclusions.has(decision.id)) return true;
  if (state.lockedDecisionIds.includes(decision.id)) return true;
  if (decision.conflicts.some((id) => completed.has(id))) return true;
  if (decision.dependencies.some((id) => !completed.has(id))) return true;
  const substantiveOptions = decision.options.filter((option) => option.budgetProfile.exclusiveScopeKeys.length > 0);
  return substantiveOptions.length > 0 && substantiveOptions.every((option) =>
    option.budgetProfile.exclusiveScopeKeys.some((scope) => scopes.has(scope)),
  );
}

function candidateFor(
  state: CampaignState,
  catalogue: Scenario,
  plan: readonly string[],
  replacing: Decision,
  completed: ReadonlySet<string>,
  scopes: ReadonlySet<string>,
  routeExclusions: ReadonlySet<string>,
): string | null {
  const byId = decisionMap(catalogue);
  const unavailable = new Set(plan);
  const candidates = V11_ADAPTIVE_DECISION_IDS.filter((id) => {
    const decision = byId.get(id);
    return decision !== undefined
      && decision.chapterId === replacing.chapterId
      && !unavailable.has(id)
      && !completed.has(id)
      && !isFutureInadmissible(decision, state, completed, scopes, routeExclusions);
  });
  if (candidates.length === 0) return null;
  return shuffled(candidates, seededRandom(state.seed ^ (state.decisions.length + 1) ^ replacing.id.length))[0]!;
}

/**
 * Replace only future adaptive cards that no longer fit the confirmed route.
 * Common and synthesis cards are fixed anchors and can never be replaced.
 */
export function refreshFutureSessionPlan(state: CampaignState, catalogue: Scenario): CampaignState {
  if (state.scenarioVersion !== 11 || !state.sessionDecisionIds) return state;
  assertV11Roles(catalogue);
  if (state.sessionDecisionIds.length !== V11_SESSION_LENGTH || new Set(state.sessionDecisionIds).size !== V11_SESSION_LENGTH) {
    throw new Error("Invalid persisted V11 session plan");
  }
  const byId = decisionMap(catalogue);
  const completed = completedIds(state);
  const scopes = selectedScopeKeys(state, catalogue);
  const routeExclusions = excludedByConfirmedRoute(state);
  const nextPlan = [...state.sessionDecisionIds];
  const futureStart = state.decisions.length;
  const replacedIds = new Set<string>();

  for (let index = futureStart; index < nextPlan.length; index += 1) {
    const id = nextPlan[index]!;
    if (!V11_ADAPTIVE_DECISION_IDS.includes(id)) continue;
    const decision = byId.get(id);
    if (!decision || !isFutureInadmissible(decision, state, completed, scopes, routeExclusions)) continue;
    const replacement = candidateFor(state, catalogue, nextPlan, decision, completed, scopes, routeExclusions);
    if (!replacement) continue;
    nextPlan[index] = replacement;
    replacedIds.add(id);
  }

  repairBudgetCapacity(nextPlan, catalogue, futureStart, replacedIds);

  if (replacedIds.size === 0) return state;
  return {
    ...state,
    sessionDecisionIds: nextPlan,
    lockedDecisionIds: state.lockedDecisionIds.filter((id) => !replacedIds.has(id)),
    pendingSelection: state.pendingSelection && replacedIds.has(state.pendingSelection.decisionId)
      ? undefined
      : state.pendingSelection,
  };
}

export function sessionPosition(state: CampaignState, catalogue: Scenario): { chapterIndex: number; decisionIndex: number } | null {
  const plan = state.sessionDecisionIds;
  if (state.scenarioVersion !== 11 || !plan || state.decisions.length >= plan.length) return null;
  const currentId = plan[state.decisions.length];
  const decision = catalogue.decisions.find((candidate) => candidate.id === currentId);
  if (!decision) return null;
  const chapterIndex = catalogue.chapters.findIndex((chapter) => chapter.id === decision.chapterId);
  if (chapterIndex < 0) return null;
  const decisionIndex = plan.slice(0, state.decisions.length + 1)
    .filter((id) => catalogue.decisions.find((candidate) => candidate.id === id)?.chapterId === decision.chapterId).length - 1;
  return { chapterIndex, decisionIndex };
}
