import type { CampaignState, Decision, GroupState, IndicatorState, Scenario } from "./types.ts";

function decisionFor(chapterNumber: number, decisionNumber: number): Decision {
  const id = `decision-${(chapterNumber - 1) * 12 + decisionNumber}`;
  return {
    id,
    version: 1,
    chapterId: `chapter-${chapterNumber}`,
    title: `Decision ${id}`,
    context: "A test context.",
    options: ["a", "b"].map((suffix) => ({
      id: `${id}-option-${suffix}`,
      label: `Option ${suffix}`,
      summary: "A test option.",
      beneficiaries: ["beneficiary"],
      contributors: ["contributor"],
      uncertainty: "moyenne",
      effects: [{
        id: `${id}-effect-${suffix}`,
        target: "indicator",
        key: "growth",
        delta: 1,
        timing: { kind: "immediate" },
        duration: "once",
        explanation: "A test effect.",
      }],
      scheduledEvents: [],
      promises: [],
      fulfillsPromises: [],
      locks: [],
      unlocks: [],
    })),
    evidence: [{
      label: "A source",
      sourceName: "Test source",
      sourceUrl: "https://example.com/source",
      publishedAt: "2026-01-01",
    }],
    dependencies: [],
    conflicts: [],
  };
}

export function validScenario(): Scenario {
  const decisions = Array.from({ length: 8 }, (_, chapterOffset) =>
    Array.from({ length: 12 }, (_, decisionOffset) =>
      decisionFor(chapterOffset + 1, decisionOffset + 1),
    ),
  ).flat();

  return {
    version: 1,
    title: "A valid test scenario",
    chapters: Array.from({ length: 8 }, (_, chapterOffset) => {
      const chapterNumber = chapterOffset + 1;
      return {
        id: `chapter-${chapterNumber}`,
        title: `Chapter ${chapterNumber}`,
        domains: ["one", "two", "three", "four"],
        opening: "A test opening.",
        tension: "A test tension.",
        decisionIds: decisions
          .filter((decision) => decision.chapterId === `chapter-${chapterNumber}`)
          .map((decision) => decision.id),
      };
    }),
    decisions,
  };
}

export function validCampaignState(scenario = validScenario()): CampaignState {
  const indicators: IndicatorState = {
    annualBalance: 0,
    debtToGdp: 0,
    interestCost: 0,
    growth: 0,
    employment: 0,
    investment: 0,
    publicServices: 0,
    majority: 0,
    reformCapacity: 0,
    opinion: 0,
    institutionalTrust: 0,
    financialCredibility: 0,
  };
  const groups: GroupState = {
    lowIncomeHouseholds: 0,
    middleClasses: 0,
    retirees: 0,
    publicEmployees: 0,
    privateEmployees: 0,
    unions: 0,
    businesses: 0,
    farmers: 0,
    localAuthorities: 0,
    creditors: 0,
    europeanPartners: 0,
    parliamentaryMajority: 0,
  };
  return {
    schemaVersion: 3,
    scenarioVersion: scenario.version,
    seed: 1,
    phase: "decision",
    chapterIndex: 0,
    decisionIndex: 0,
    decisions: [{
      decisionId: "decision-1",
      optionId: "decision-1-option-a",
      status: "confirmed",
      confirmedAtIndex: 1,
    }],
    indicators,
    groups,
    scheduledEvents: [],
    eventHistory: [],
    activePromises: [],
    promiseHistory: [],
    crisisHistory: [],
    resolvedCrisisIds: [],
    causalLedger: [],
    unlockedDecisionIds: [],
    lockedDecisionIds: [],
    savedAt: "2026-01-01T00:00:00.000Z",
  };
}
