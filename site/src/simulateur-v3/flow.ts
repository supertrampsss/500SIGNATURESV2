import { advanceAfterResult } from "./campaign.ts";
import { detectCrisis } from "./crises.ts";
import { resolveDueEvents, resolveDuePromises } from "./effects.ts";
import {
  advanceMandateYear,
  mandateYearEndingAfterChapter,
} from "./timeline.ts";
import type { CampaignState, CrisisRule, Scenario } from "./types.ts";

function consequenceOrCrisis(
  state: CampaignState,
  scenario: Scenario,
  crisisRules: readonly CrisisRule[],
): CampaignState | null {
  const decisionCount = state.decisions.length;
  const hasVisibleConsequence = state.scheduledEvents.some((event) => event.dueAtDecision <= decisionCount)
    || state.activePromises.some((promise) => promise.dueAtDecision <= decisionCount);
  if (hasVisibleConsequence) return { ...state, phase: "delayed_event" };

  const crisis = detectCrisis(state, scenario, crisisRules);
  return crisis.phase === "crisis" ? crisis : null;
}

function advanceAndResolveAutoSuperseded(
  state: CampaignState,
  scenario: Scenario,
  crisisRules: readonly CrisisRule[],
): CampaignState {
  let current = state;
  while (true) {
    const advanced = advanceAfterResult(current, scenario, true);
    const autoSuperseded = advanced.phase === "decision_result"
      && advanced.decisions.length > current.decisions.length;
    if (!autoSuperseded) return advanced;

    const interruption = consequenceOrCrisis(advanced, scenario, crisisRules);
    if (interruption) return interruption;
    const chapter = scenario.chapters[advanced.chapterIndex];
    const chapterComplete = chapter !== undefined && advanced.decisionIndex + 1 >= chapter.decisionIds.length;
    const year = chapterComplete ? mandateYearEndingAfterChapter(advanced.chapterIndex) : null;
    if (year !== null) return advanceMandateYear(advanced, year);
    current = advanced;
  }
}

function advanceNormallyOrToCouncil(
  state: CampaignState,
  scenario: Scenario,
  crisisRules: readonly CrisisRule[],
): CampaignState {
  const chapter = scenario.chapters[state.chapterIndex];
  const chapterComplete = chapter !== undefined && state.decisionIndex + 1 >= chapter.decisionIds.length;
  const year = chapterComplete ? mandateYearEndingAfterChapter(state.chapterIndex) : null;
  if (year !== null) return advanceMandateYear(state, year);
  return advanceAndResolveAutoSuperseded(state, scenario, crisisRules);
}

function advanceFromDecisionResult(
  state: CampaignState,
  scenario: Scenario,
  crisisRules: readonly CrisisRule[],
): CampaignState {
  const interruption = consequenceOrCrisis(state, scenario, crisisRules);
  if (interruption) return interruption;
  return advanceNormallyOrToCouncil(state, scenario, crisisRules);
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
    const crisis = detectCrisis(afterEvent, scenario, crisisRules);
    if (crisis.phase === "crisis") return crisis;
    return advanceNormallyOrToCouncil(afterEvent, scenario, crisisRules);
  }

  if (state.phase === "chapter_intro") {
    return advanceAndResolveAutoSuperseded(state, scenario, crisisRules);
  }

  if (state.phase === "council" || state.phase === "chapter_verdict") {
    return advanceAfterResult(state, scenario);
  }

  return state;
}
