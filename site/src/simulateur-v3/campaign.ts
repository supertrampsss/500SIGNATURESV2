import { SCHEMA_VERSION, type CampaignState, type Decision, type Scenario } from "./types.ts";
import { validateScenario } from "./validation.ts";

export const INITIAL_INDICATORS = Object.freeze({
  annualBalance: -153_000,
  debtToGdp: 115.7,
  interestCost: 55_000,
  growth: 0.9,
  employment: 100,
  investment: 100,
  publicServices: 55,
  majority: 62,
  reformCapacity: 68,
  opinion: 58,
  institutionalTrust: 44,
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

export function createCampaign(scenario: Scenario, seed = 0): CampaignState {
  const errors = validateScenario(scenario);
  if (errors.length > 0) throw new Error(`Invalid scenario: ${errors.join(", ")}`);

  return {
    schemaVersion: SCHEMA_VERSION,
    scenarioVersion: scenario.version,
    seed,
    phase: "intro",
    chapterIndex: 0,
    decisionIndex: 0,
    decisions: [],
    indicators: { ...INITIAL_INDICATORS },
    groups: { ...INITIAL_GROUPS },
    scheduledEvents: [],
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

export function selectOption(state: CampaignState, decisionId: string, optionId: string): CampaignState {
  if (state.phase !== "decision") throw new Error("Cannot select an option outside phase decision");
  if (state.lockedDecisionIds.includes(decisionId)) throw new Error(`Cannot select a locked decision: ${decisionId}`);
  return { ...state, pendingSelection: { decisionId, optionId } };
}

export function clearSelection(state: CampaignState): CampaignState {
  const { pendingSelection: _pendingSelection, ...withoutSelection } = state;
  return withoutSelection;
}

export function advanceAfterResult(state: CampaignState, scenario: Scenario): CampaignState {
  if (state.phase === "chapter_verdict") {
    return { ...state, chapterIndex: state.chapterIndex + 1, decisionIndex: 0, phase: "chapter_intro" };
  }
  if (state.phase === "chapter_intro") return { ...state, phase: "decision" };

  const completedDecisions = state.decisions.length;
  if (completedDecisions === 96) return { ...state, phase: "verdict" };
  if (completedDecisions % 12 === 0) return { ...state, phase: "chapter_verdict" };
  if (completedDecisions % 4 === 0) return { ...state, phase: "council" };
  return { ...state, decisionIndex: state.decisionIndex + 1, phase: "decision" };
}
