import { applyEffect } from "./effects.ts";
import type { CampaignState, CrisisConcession, CrisisRule, DecisionStatus } from "./types.ts";

function thresholdReached(state: CampaignState, rule: CrisisRule): boolean {
  const value = state.indicators[rule.indicator];
  return rule.comparator === "lte" ? value <= rule.threshold : value >= rule.threshold;
}

function confirmedAggravatingDecisions(state: CampaignState, rule: CrisisRule) {
  return state.decisions
    .filter((decision) => decision.status === "confirmed" && rule.aggravatingDecisionIds.includes(decision.decisionId));
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

/** Enters the first eligible crisis and preserves the decisions which caused it. */
export function detectCrisis(state: CampaignState, rules: readonly CrisisRule[]): CampaignState {
  if (state.activeCrisis) return state;

  for (const rule of rules) {
    if (state.resolvedCrisisIds.includes(rule.id) || !thresholdReached(state, rule)) continue;
    const aggravatingDecisions = confirmedAggravatingDecisions(state, rule);
    if (aggravatingDecisions.length === 0) continue;
    const trigger = aggravatingDecisions.reduce((latest, decision) =>
      decision.confirmedAtIndex > latest.confirmedAtIndex ? decision : latest,
    );
    return {
      ...state,
      phase: "crisis",
      activeCrisis: {
        ruleId: rule.id,
        triggeredByDecisionId: trigger.decisionId,
        aggravatingDecisionIds: aggravatingDecisions.map((decision) => decision.decisionId),
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
    const decision = state.decisions.find((record) => record.decisionId === concession.targetDecisionId);
    return decision?.status === "confirmed" || decision?.status === "amended";
  });
}

/** Resolves the active crisis, records the choice, and applies its political consequences. */
export function resolveCrisis(state: CampaignState, rules: readonly CrisisRule[], resolutionId: string): CampaignState {
  const crisis = state.activeCrisis;
  const rule = activeRule(state, rules);
  const concession = availableConcessions(state, rules).find((candidate) => candidate.id === resolutionId);
  const isHoldingCourse = resolutionId === "hold-course";
  if (!isHoldingCourse && !concession) throw new Error(`Crisis resolution not offered: ${resolutionId}`);

  let resolved = state;
  if (concession) {
    resolved = {
      ...resolved,
      decisions: resolved.decisions.map((decision) => decision.decisionId === concession.targetDecisionId
        ? { ...decision, status: statusForConcession(concession), changedByCrisisId: rule.id }
        : decision),
    };
    resolved = applyCrisisEffects(resolved, rule, concession.effects);
  } else {
    resolved = applyCrisisEffects(resolved, rule, rule.holdCourseEffects);
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
