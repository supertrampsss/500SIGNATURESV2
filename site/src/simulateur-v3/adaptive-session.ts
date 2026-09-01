import {
  V11_ADAPTIVE_DECISION_IDS,
  V11_COMMON_DECISION_IDS,
  V11_SYNTHESIS_DECISION_IDS,
} from "./scenario-v11-catalogue.ts";
import type { CampaignState, Decision, Scenario } from "./types.ts";

export const V11_SESSION_LENGTH = 45;
const V11_ADAPTIVE_COUNT = 34;

/**
 * Editorial alternatives for a shorter replayable route. They are deliberately
 * narrow: a confirmed structural direction can replace only an unplayed card
 * in the same chapter, never an anchor or an already rendered decision.
 */
const V11_ROUTE_EXCLUSIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "v11-01-prelevement-personnel:option-1": ["v11-05-epargne"],
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
  if (allRoleIds.length !== 55 || new Set(allRoleIds).size !== 55 || allRoleIds.some((id) => !knownIds.has(id))) {
    throw new Error("Invalid V11 session roles");
  }
}

function adaptiveQuotas(catalogue: Scenario, seed: number): Map<string, number> {
  const byId = decisionMap(catalogue);
  const groups = catalogue.chapters.map((chapter) => ({
    chapterId: chapter.id,
    ids: V11_ADAPTIVE_DECISION_IDS.filter((id) => byId.get(id)?.chapterId === chapter.id),
  })).filter((group) => group.ids.length > 0);
  const exact = groups.map((group) => group.ids.length * V11_ADAPTIVE_COUNT / V11_ADAPTIVE_DECISION_IDS.length);
  const quotas = exact.map(Math.floor);
  let remaining = V11_ADAPTIVE_COUNT - quotas.reduce((sum, quota) => sum + quota, 0);
  const tieBreak = seededRandom(seed ^ 0x45d9f3b);
  const ordered = groups.map((group, index) => ({
    index,
    remainder: exact[index]! - quotas[index]!,
    tie: tieBreak(),
    chapterId: group.chapterId,
  })).sort((left, right) => right.remainder - left.remainder || left.tie - right.tie || left.chapterId.localeCompare(right.chapterId));
  for (const group of ordered) {
    if (remaining <= 0) break;
    quotas[group.index]! += 1;
    remaining -= 1;
  }
  return new Map(groups.map((group, index) => [group.chapterId, quotas[index]!]));
}

/** Build the immutable 45-card route for one V11 mandate. */
export function buildSessionPlan(catalogue: Scenario, seed: number): string[] {
  assertV11Roles(catalogue);
  const byId = decisionMap(catalogue);
  const random = seededRandom(seed);
  const quotas = adaptiveQuotas(catalogue, seed);
  const selectedAdaptive = new Set<string>();
  for (const chapter of catalogue.chapters) {
    const candidates = V11_ADAPTIVE_DECISION_IDS.filter((id) => byId.get(id)?.chapterId === chapter.id);
    const quota = quotas.get(chapter.id) ?? 0;
    for (const id of shuffled(candidates, random).slice(0, quota)) selectedAdaptive.add(id);
  }
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
