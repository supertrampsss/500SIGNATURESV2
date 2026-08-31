import { applyEffect, reverseDecisionConsequences } from "./effects.ts";
import { crisisTransitionEstimateFor } from "./budget-registry.ts";
import type {
  CampaignState,
  CrisisConcession,
  CrisisRule,
  DecisionRecord,
  DecisionStatus,
  Scenario,
  TriggeredCrisisChoiceRef,
} from "./types.ts";

const HOLD_COURSE_ID = "hold-course";
const MAX_MANDATE_CRISES = 8;

function thresholdReached(state: CampaignState, rule: CrisisRule): boolean {
  const value = state.indicators[rule.indicator];
  return rule.comparator === "lte" ? value <= rule.threshold : value >= rule.threshold;
}

function currentChapterIndex(state: CampaignState, scenario: Scenario): number | null {
  const latest = state.decisions.reduce<DecisionRecord | null>((candidate, decision) => (
    candidate === null || decision.confirmedAtIndex > candidate.confirmedAtIndex ? decision : candidate
  ), null);
  if (!latest) return null;
  const chapterIndex = scenario.chapters.findIndex((chapter) => chapter.decisionIds.includes(latest.decisionId));
  return chapterIndex >= 0 ? chapterIndex : null;
}

function hasRequiredDecisions(state: CampaignState, rule: CrisisRule): boolean {
  return rule.requiredDecisionIds.every((decisionId) => state.decisions.some((decision) => (
    decision.decisionId === decisionId
      && (decision.status === "confirmed" || decision.status === "amended")
  )));
}

function confirmedAggravatingChoices(state: CampaignState, rule: CrisisRule): TriggeredCrisisChoiceRef[] {
  const allowedOptions = new Map(rule.aggravatingChoices.map((choice) => [choice.decisionId, new Set(choice.optionIds)]));
  return state.decisions.flatMap((decision) => (
    decision.status === "confirmed" && allowedOptions.get(decision.decisionId)?.has(decision.optionId)
      ? [{ decisionId: decision.decisionId, optionId: decision.optionId }]
      : []
  ));
}

function ruleOccurrenceCount(state: CampaignState, ruleId: string): number {
  return state.crisisHistory.filter((crisis) => crisis.ruleId === ruleId).length
    + (state.activeCrisis?.ruleId === ruleId ? 1 : 0);
}

function crisisCount(state: CampaignState): number {
  return state.crisisHistory.length + (state.activeCrisis ? 1 : 0);
}

function activeRule(state: CampaignState, rules: readonly CrisisRule[]): CrisisRule {
  if (!state.activeCrisis) throw new Error("No active crisis to resolve");
  const rule = rules.find((candidate) => candidate.id === state.activeCrisis!.ruleId);
  if (!rule) throw new Error(`Unknown active crisis rule: ${state.activeCrisis.ruleId}`);
  return rule;
}

function statusForConcession(concession: CrisisConcession): DecisionStatus {
  switch (concession.policyChange) {
    case "suspend": return "suspended";
    case "amend": return "amended";
    case "reverse": return "reversed";
  }
}

function applyCrisisEffects(state: CampaignState, rule: CrisisRule, effects: readonly CrisisConcession["effects"][number][]): CampaignState {
  return effects.reduce(
    (current, effect) => applyEffect(current, effect, { sourceType: "crisis", sourceId: rule.id }),
    state,
  );
}

/** Enters the first eligible crisis and preserves the exact choices which caused it. */
export function detectCrisis(
  state: CampaignState,
  scenario: Scenario,
  rules: readonly CrisisRule[],
): CampaignState {
  if (state.activeCrisis) return state;
  if (crisisCount(state) >= MAX_MANDATE_CRISES) return state;

  const chapterIndex = currentChapterIndex(state, scenario);
  if (chapterIndex === null) return state;
  if (state.crisisHistory.some((crisis) => crisis.triggeredChapterIndex === chapterIndex)) return state;

  for (const rule of rules) {
    if (chapterIndex < rule.eligibleFromChapterIndex
        || ruleOccurrenceCount(state, rule.id) >= rule.maxOccurrences
        || state.resolvedCrisisIds.includes(rule.id)
        || !thresholdReached(state, rule)
        || !hasRequiredDecisions(state, rule)) continue;
    const aggravatingChoices = confirmedAggravatingChoices(state, rule);
    if (aggravatingChoices.length === 0) continue;
    const aggravatingDecisionIds = [...new Set(aggravatingChoices.map((choice) => choice.decisionId))];
    const trigger = state.decisions
      .filter((decision) => aggravatingDecisionIds.includes(decision.decisionId))
      .reduce((latest, decision) => decision.confirmedAtIndex > latest.confirmedAtIndex ? decision : latest);
    return {
      ...state,
      phase: "crisis",
      activeCrisis: {
        ruleId: rule.id,
        triggeredAtDecisionCount: state.decisions.length,
        triggeredChapterIndex: chapterIndex,
        aggravatingChoices,
        triggeredByDecisionId: trigger.decisionId,
        aggravatingDecisionIds,
      },
    };
  }

  return state;
}

/** Returns only concessions that still modify a real, live policy decision. */
export function availableConcessions(state: CampaignState, rules: readonly CrisisRule[]): CrisisConcession[] {
  if (!state.activeCrisis) return [];
  const rule = rules.find((candidate) => candidate.id === state.activeCrisis!.ruleId);
  if (!rule) return [];
  return rule.concessions.filter((concession) => {
    if (concession.id === HOLD_COURSE_ID) return false;
    if (!state.activeCrisis?.aggravatingChoices.some((choice) => choice.decisionId === concession.targetDecisionId)) {
      return false;
    }
    const decision = state.decisions.find((record) => record.decisionId === concession.targetDecisionId);
    return decision?.status === "confirmed" || decision?.status === "amended";
  });
}

function applyCrisisTransitionCost(state: CampaignState, rule: CrisisRule, concession: CrisisConcession): CampaignState {
  if (!concession.transitionEstimateKey) return state;
  const estimate = crisisTransitionEstimateFor(concession.transitionEstimateKey);
  return estimate.transitionFlows.reduce((current, flow) => {
    if (flow.timing.kind !== "immediate") throw new Error(`Crisis transition ${flow.id} must be immediate`);
    if (current.causalLedger.some((entry) => entry.sourceType === "crisis" && entry.sourceId === rule.id && entry.id.includes(flow.id))) {
      return current;
    }
    return applyEffect(current, {
      id: flow.id,
      target: "indicator",
      key: "annualBalance",
      delta: flow.amountMillions,
      timing: { kind: "immediate" },
      duration: "once",
      explanation: estimate.scope,
    }, { sourceType: "crisis", sourceId: rule.id });
  }, state);
}

/** The visible choices always include the implicit decision to maintain course. */
export function availableResolutionIds(state: CampaignState, rules: readonly CrisisRule[]): string[] {
  return state.activeCrisis ? [HOLD_COURSE_ID, ...availableConcessions(state, rules).map((concession) => concession.id)] : [];
}

/** Resolves the active crisis, records the choice, and applies its political consequences. */
export function resolveCrisis(state: CampaignState, rules: readonly CrisisRule[], resolutionId: string): CampaignState {
  const crisis = state.activeCrisis;
  const rule = activeRule(state, rules);
  let resolved: CampaignState;
  if (resolutionId === HOLD_COURSE_ID) {
    resolved = applyCrisisEffects(state, rule, rule.holdCourseEffects);
  } else {
    const concession = availableConcessions(state, rules).find((candidate) => candidate.id === resolutionId);
    if (!concession) throw new Error(`Crisis resolution not offered: ${resolutionId}`);
    resolved = concession.policyChange === "reverse"
      ? reverseDecisionConsequences(state, concession.targetDecisionId, rule.id)
      : {
        ...state,
        decisions: state.decisions.map((decision) => decision.decisionId === concession.targetDecisionId
          ? { ...decision, status: statusForConcession(concession), changedByCrisisId: rule.id }
          : decision),
      };
    resolved = {
      ...resolved,
      decisions: resolved.decisions.map((decision) => decision.decisionId === concession.targetDecisionId
        ? { ...decision, changedByCrisisId: rule.id }
        : decision),
      lockedDecisionIds: resolved.lockedDecisionIds.filter(
        (decisionId) => !(concession.unlocksDecisionIds ?? []).includes(decisionId),
      ),
    };
    resolved = applyCrisisTransitionCost(resolved, rule, concession);
    resolved = applyCrisisEffects(resolved, rule, concession.effects);
  }

  const { activeCrisis: _activeCrisis, ...withoutActiveCrisis } = resolved;
  return {
    ...withoutActiveCrisis,
    phase: "decision_result",
    resolvedCrisisIds: resolved.resolvedCrisisIds.includes(rule.id)
      ? resolved.resolvedCrisisIds
      : [...resolved.resolvedCrisisIds, rule.id],
    crisisHistory: [...resolved.crisisHistory, { ...crisis!, resolvedBy: resolutionId }],
  };
}
