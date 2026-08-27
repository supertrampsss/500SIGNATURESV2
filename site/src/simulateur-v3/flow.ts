import { advanceAfterResult } from "./campaign.ts";
import { detectCrisis } from "./crises.ts";
import { resolveDueEvents, resolveDuePromises } from "./effects.ts";
import type { CampaignState, CrisisRule, Scenario } from "./types.ts";

function advanceFromDecisionResult(
  state: CampaignState,
  scenario: Scenario,
  crisisRules: readonly CrisisRule[],
): CampaignState {
  const eventResolution = resolveDueEvents(state);
  const promiseHistoryBefore = eventResolution.state.promiseHistory.length;
  const promiseResolution = resolveDuePromises(eventResolution.state);
  const hasVisibleConsequence = eventResolution.events.length > 0
    || promiseResolution.state.promiseHistory.length > promiseHistoryBefore;

  if (hasVisibleConsequence) {
    return { ...promiseResolution.state, phase: "delayed_event" };
  }

  const crisis = detectCrisis(promiseResolution.state, crisisRules);
  if (crisis.phase === "crisis") return crisis;
  return advanceAfterResult(promiseResolution.state, scenario);
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
    const afterEvent = { ...state, phase: "decision_result" as const };
    const crisis = detectCrisis(afterEvent, crisisRules);
    if (crisis.phase === "crisis") return crisis;
    return advanceAfterResult(afterEvent, scenario);
  }

  if (state.phase === "council" || state.phase === "chapter_verdict" || state.phase === "chapter_intro") {
    return advanceAfterResult(state, scenario);
  }

  return state;
}
