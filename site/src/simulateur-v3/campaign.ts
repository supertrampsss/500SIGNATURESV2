import { validateBaseline } from "./timeline.ts";
import { SCHEMA_VERSION, type CampaignState, type Decision, type IndicatorState, type MandateBaseline, type Scenario } from "./types.ts";
import { totalDecisions, validateScenario } from "./validation.ts";

const NEUTRAL_LUDIC_INDICATORS = Object.freeze({
  employment: 100,
  investment: 100,
  publicServices: 50,
  majority: 50,
  reformCapacity: 50,
  opinion: 50,
  institutionalTrust: 50,
  financialCredibility: 50,
});

export const INITIAL_GROUPS = Object.freeze({
  lowIncomeHouseholds: 50,
  middleClasses: 50,
  retirees: 50,
  publicEmployees: 50,
  privateEmployees: 50,
  unions: 50,
  businesses: 50,
  farmers: 50,
  localAuthorities: 50,
  creditors: 50,
  europeanPartners: 50,
  parliamentaryMajority: 50,
});

const EPOCH = "1970-01-01T00:00:00.000Z";

export function initialIndicators(baseline: MandateBaseline): IndicatorState {
  validateBaseline(baseline);
  return {
    annualBalance: baseline.annualBalanceMillions,
    debtToGdp: baseline.debtMillions / baseline.nominalGdpMillions * 100,
    interestCost: baseline.interestCostMillions,
    growth: baseline.nominalGrowthPercent,
    ...NEUTRAL_LUDIC_INDICATORS,
  };
}

export function createCampaign(scenario: Scenario, baseline: MandateBaseline, seed = 0): CampaignState {
  const errors = validateScenario(scenario);
  if (errors.length > 0) throw new Error(`Invalid scenario: ${errors.join(", ")}`);
  validateBaseline(baseline);

  return {
    schemaVersion: SCHEMA_VERSION,
    scenarioVersion: scenario.version,
    seed,
    phase: "intro",
    chapterIndex: 0,
    decisionIndex: 0,
    decisions: [],
    baseline: structuredClone(baseline),
    annualCheckpoints: [],
    indicators: initialIndicators(baseline),
    groups: { ...INITIAL_GROUPS },
    scheduledEvents: [],
    eventHistory: [],
    activePromises: [],
    promiseHistory: [],
    crisisHistory: [],
    resolvedCrisisIds: [],
    causalLedger: [],
    unlockedDecisionIds: [],
    lockedDecisionIds: [],
    savedAt: EPOCH,
  };
}

export function currentDecision(state: CampaignState, scenario: Scenario): Decision | null {
  const chapter = scenario.chapters[state.chapterIndex];
  const decisionId = chapter?.decisionIds[state.decisionIndex];
  return scenario.decisions.find((decision) => decision.id === decisionId) ?? null;
}

export function selectOption(state: CampaignState, scenario: Scenario, decisionId: string, optionId: string): CampaignState {
  if (state.phase !== "decision") throw new Error("Cannot select an option outside phase decision");
  const decision = scenario.decisions.find((candidate) => candidate.id === decisionId);
  if (!decision) throw new Error(`Unknown decision ID: ${decisionId}`);
  if (currentDecision(state, scenario)?.id !== decisionId) {
    throw new Error(`Decision is not the current decision: ${decisionId}`);
  }
  if (!decision.options.some((option) => option.id === optionId)) throw new Error(`Unknown option ID: ${optionId}`);
  if (state.lockedDecisionIds.includes(decisionId)) throw new Error(`Cannot select a locked decision: ${decisionId}`);
  return { ...state, pendingSelection: { decisionId, optionId } };
}

export function clearSelection(state: CampaignState): CampaignState {
  const { pendingSelection: _pendingSelection, ...withoutSelection } = state;
  return withoutSelection;
}

function nextChapter(state: CampaignState): CampaignState {
  return { ...state, chapterIndex: state.chapterIndex + 1, decisionIndex: 0, phase: "chapter_intro" };
}

export function normalizeChapterTransition(state: CampaignState, scenario: Scenario): CampaignState {
  if (state.phase !== "chapter_verdict") return state;
  if (state.decisions.length >= totalDecisions(scenario)) return { ...state, phase: "verdict" };
  return nextChapter(state);
}

function chapterIsComplete(state: CampaignState, scenario: Scenario): boolean {
  const chapter = scenario.chapters[state.chapterIndex];
  return chapter !== undefined && state.decisionIndex + 1 >= chapter.decisionIds.length;
}

function advanceOneScreen(state: CampaignState, scenario: Scenario): CampaignState {
  if (state.phase === "chapter_verdict") return normalizeChapterTransition(state, scenario);
  if (state.phase === "chapter_intro") return { ...state, phase: "decision" };

  const completedDecisions = state.decisions.length;
  if (completedDecisions >= totalDecisions(scenario)) return { ...state, phase: "verdict" };
  if (chapterIsComplete(state, scenario)) return nextChapter(state);
  return { ...state, decisionIndex: state.decisionIndex + 1, phase: "decision" };
}

export function advanceAfterResult(
  state: CampaignState,
  scenario: Scenario,
  stopAtDecisionCounts: readonly number[] = [],
): CampaignState {
  let advanced = advanceOneScreen(state, scenario);
  while (advanced.phase === "decision") {
    const decision = currentDecision(advanced, scenario);
    if (!decision || !advanced.lockedDecisionIds.includes(decision.id)) break;
    const neutralOption = decision.options[1] ?? decision.options[0];
    if (!neutralOption) break;
    const superseded: CampaignState = {
      ...advanced,
      phase: "decision_result",
      decisions: [...advanced.decisions, {
        decisionId: decision.id,
        optionId: neutralOption.id,
        status: "superseded",
        confirmedAtIndex: advanced.decisions.length + 1,
      }],
    };
    if (stopAtDecisionCounts.includes(superseded.decisions.length)) return superseded;
    advanced = advanceOneScreen(superseded, scenario);
  }
  return advanced;
}
