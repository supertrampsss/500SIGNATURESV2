import { advanceAfterResult } from "./campaign.ts";
import { detectCrisis } from "./crises.ts";
import { resolveDueEvents, resolveDuePromises } from "./effects.ts";
import type { CampaignState, CrisisRule, Scenario } from "./types.ts";

function advanceFromDecisionResult(
  state: CampaignState,
  scenario: Scenario,
  crisisRules: readonly CrisisRule[],
): CampaignState {
  const decisionCount = state.decisions.length;
  const hasVisibleConsequence = state.scheduledEvents.some((event) => event.dueAtDecision <= decisionCount)
    || state.activePromises.some((promise) => promise.dueAtDecision <= decisionCount);

  if (hasVisibleConsequence) {
    return { ...state, phase: "delayed_event" };
  }

  const crisis = detectCrisis(state, crisisRules);
  if (crisis.phase === "crisis") return crisis;
  return advanceAfterResult(state, scenario);
}

/**
 * Advances one persistent campaign screen. Consequences are resolved before a
 * crisis is detected, and both are shown before the normal campaign cadence.
 */
export function advanceCampaign(
  state: CampaignState,
  scenario: Scenario,
  crisisRules: readonly CrisisRule[],
): CampaignState {
  if (state.phase === "decision_result") {
    return advanceFromDecisionResult(state, scenario, crisisRules);
  }

  if (state.phase === "delayed_event") {
    const eventResolution = resolveDueEvents(state);
    const promiseResolution = resolveDuePromises(eventResolution.state);
    const afterEvent = { ...promiseResolution.state, phase: "decision_result" as const };
    const crisis = detectCrisis(afterEvent, crisisRules);
    if (crisis.phase === "crisis") return crisis;
    return advanceAfterResult(afterEvent, scenario);
  }

  if (state.phase === "council" || state.phase === "chapter_verdict" || state.phase === "chapter_intro") {
    return advanceAfterResult(state, scenario);
  }

  return state;
}
