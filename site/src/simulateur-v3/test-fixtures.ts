import { createCampaign } from "./campaign.ts";
import { mandateYearEndingAfterChapter, projectYear } from "./timeline.ts";
import type { AnnualCheckpoint, CampaignState, Decision, GroupState, IndicatorState, MandateBaseline, Scenario } from "./types.ts";

export function testBaseline(): MandateBaseline {
  return {
    period: "2025",
    debtPeriod: "2025-Q4",
    nominalGdpMillions: 2_991_055.9,
    debtMillions: 3_460_651.6763,
    annualBalanceMillions: -152_532,
    interestCostMillions: 66_635.9,
    nominalGrowthPercent: 1.9011968652765887,
    sourceIds: [
      "eurostat_pib_montant",
      "insee_dette_apu_part_pib",
      "insee_apu_solde",
      "eurostat_apu_interets",
    ],
    dataVersion: "2026-08-22T1939",
  };
}

export function createTestCampaign(scenario: Scenario, seed = 0): CampaignState {
  return createCampaign(scenario, testBaseline(), seed);
}

export function testAnnualCheckpoints(
  scenario: Scenario,
  completedYears = 5,
  annualBalance = testBaseline().annualBalanceMillions,
): AnnualCheckpoint[] {
  const baseline = testBaseline();
  const interestRatePercent = baseline.interestCostMillions / baseline.debtMillions * 100;
  let previous = {
    nominalGdpMillions: baseline.nominalGdpMillions,
    debtMillions: baseline.debtMillions,
    interestCostMillions: baseline.interestCostMillions,
  };
  let decisionCount = 0;
  const checkpoints: AnnualCheckpoint[] = [];
  scenario.chapters.forEach((chapter, chapterIndex) => {
    decisionCount += chapter.decisionIds.length;
    const year = mandateYearEndingAfterChapter(chapterIndex);
    if (year === null || year > completedYears) return;
    const projected = projectYear(previous, {
      annualBalance,
      nominalGrowthPercent: baseline.nominalGrowthPercent,
      interestRatePercent,
    });
    checkpoints.push({
      year,
      afterDecisionCount: decisionCount,
      nominalGdpMillions: projected.nominalGdpMillions,
      debtMillions: projected.debtMillions,
      debtToGdp: projected.debtToGdp,
      annualBalance,
      interestCost: projected.interestCostMillions,
      causes: [],
    });
    previous = { ...projected };
  });
  return checkpoints;
}

function decisionFor(chapterNumber: number, decisionNumber: number): Decision {
  const id = `decision-${(chapterNumber - 1) * 12 + decisionNumber}`;
  return {
    id,
    version: 1,
    kind: decisionNumber <= 4 ? "gestion" : decisionNumber <= 8 ? "transformation" : "rupture",
    chapterId: `chapter-${chapterNumber}`,
    title: `Decision ${id}`,
    context: "A test context.",
    options: ["a", "b"].map((suffix) => ({
      id: `${id}-option-${suffix}`,
      label: `Option ${suffix}`,
      summary: "A test option.",
      mechanism: "Apply the explicit test rule.",
      horizon: suffix === "a" ? { kind: "immediate" } : { kind: "after_decisions", count: 1 },
      legalConstraints: [],
      budgetDuration: "annual",
      beneficiaries: ["beneficiary"],
      contributors: ["contributor"],
      uncertainty: "moyenne",
      effects: [{
        id: `${id}-effect-${suffix}`,
        target: "indicator",
        key: "growth",
        delta: suffix === "a" ? 1 : -1,
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
    schemaVersion: 4,
    scenarioVersion: scenario.version,
    seed: 1,
    phase: "decision_result",
    chapterIndex: 0,
    decisionIndex: 0,
    decisions: [{
      decisionId: "decision-1",
      optionId: "decision-1-option-a",
      status: "confirmed",
      confirmedAtIndex: 1,
    }],
    baseline: testBaseline(),
    annualCheckpoints: [],
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
