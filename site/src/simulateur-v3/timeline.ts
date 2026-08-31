import type { CampaignState, CausalEntry, MandateBaseline, MandateYear, Scenario } from "./types.ts";

export const REQUIRED_BASELINE_INDICATORS = [
  "eurostat_pib_montant",
  "insee_dette_apu_part_pib",
  "insee_apu_solde",
  "eurostat_apu_interets",
] as const;

export type PublishedBaselineSeries = {
  gdp: Record<string, number>;
  debtToGdp: Record<string, number>;
  balance: Record<string, number>;
  interest: Record<string, number>;
  dataVersion: string;
};

const EURO_PER_MILLION = 1_000_000;
export const CHAPTER_MANDATE_YEARS = [1, 1, 2, 2, 3, 4, 4, 5] as const;

function sameIds(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length
    && new Set(actual).size === actual.length
    && expected.every((id) => actual.includes(id));
}

export function validateBaseline(value: MandateBaseline): void {
  if (!value || typeof value !== "object") throw new Error("Campaign baseline is required");
  if (!Number.isFinite(value.nominalGdpMillions) || value.nominalGdpMillions <= 0
      || !Number.isFinite(value.debtMillions) || value.debtMillions < 0
      || !Number.isFinite(value.annualBalanceMillions)
      || !Number.isFinite(value.interestCostMillions) || value.interestCostMillions < 0
      || !Number.isFinite(value.nominalGrowthPercent)) {
    throw new Error("Invalid campaign baseline values");
  }
  if (!/^\d{4}$/.test(value.period) || value.debtPeriod !== `${value.period}-Q4`
      || !sameIds(value.sourceIds, REQUIRED_BASELINE_INDICATORS) || !value.dataVersion.trim()) {
    throw new Error("Campaign baseline must be sourced and versioned");
  }
}

export function buildMandateBaseline(series: PublishedBaselineSeries): MandateBaseline | null {
  const annualPeriods = Object.keys(series.gdp)
    .filter((period) => /^\d{4}$/.test(period))
    .sort((left, right) => Number(right) - Number(left));

  for (const period of annualPeriods) {
    const previousPeriod = String(Number(period) - 1);
    const debtPeriod = `${period}-Q4`;
    const gdpEuros = series.gdp[period];
    const previousGdpEuros = series.gdp[previousPeriod];
    const debtToGdp = series.debtToGdp[debtPeriod];
    const annualBalanceEuros = series.balance[period];
    const interestEuros = series.interest[period];
    if (![gdpEuros, previousGdpEuros, debtToGdp, annualBalanceEuros, interestEuros].every(Number.isFinite)) continue;
    if (gdpEuros <= 0 || previousGdpEuros <= 0 || debtToGdp < 0 || interestEuros < 0) continue;

    const nominalGdpMillions = gdpEuros / EURO_PER_MILLION;
    const baseline: MandateBaseline = {
      period,
      debtPeriod,
      nominalGdpMillions,
      debtMillions: nominalGdpMillions * debtToGdp / 100,
      annualBalanceMillions: annualBalanceEuros / EURO_PER_MILLION,
      interestCostMillions: interestEuros / EURO_PER_MILLION,
      nominalGrowthPercent: ((gdpEuros / previousGdpEuros) - 1) * 100,
      sourceIds: [...REQUIRED_BASELINE_INDICATORS],
      dataVersion: series.dataVersion,
    };
    try {
      validateBaseline(baseline);
      return baseline;
    } catch {
      continue;
    }
  }
  return null;
}

export function projectYear(
  previous: Pick<MandateBaseline, "nominalGdpMillions" | "debtMillions" | "interestCostMillions">,
  input: { annualBalance: number; nominalGrowthPercent: number; interestRatePercent: number },
) {
  const nominalGdpMillions = previous.nominalGdpMillions * (1 + input.nominalGrowthPercent / 100);
  const debtMillions = previous.debtMillions - input.annualBalance;
  const interestCostMillions = debtMillions * (input.interestRatePercent / 100);
  return {
    nominalGdpMillions,
    debtMillions,
    debtToGdp: (debtMillions / nominalGdpMillions) * 100,
    interestCostMillions,
  };
}

export function mandateYearEndingAfterChapter(chapterIndex: number): Exclude<MandateYear, 0> | null {
  const current = CHAPTER_MANDATE_YEARS[chapterIndex];
  if (current === undefined) return null;
  return CHAPTER_MANDATE_YEARS[chapterIndex + 1] === current ? null : current;
}

export function mandateYearForChapter(chapterIndex: number): Exclude<MandateYear, 0> | null {
  return CHAPTER_MANDATE_YEARS[chapterIndex] ?? null;
}

export function decisionCountAtMandateYearEnd(
  scenario: Pick<Scenario, "chapters">,
  year: Exclude<MandateYear, 0>,
): number {
  let decisionCount = 0;
  for (const [chapterIndex, chapter] of scenario.chapters.entries()) {
    decisionCount += chapter.decisionIds.length;
    if (mandateYearEndingAfterChapter(chapterIndex) === year) return decisionCount;
  }
  throw new Error(`Mandate year ${year} has no checkpoint in this scenario`);
}

type AnnualBalanceProfile = {
  fiscalYearBalance: number;
  activeRunRate: number;
  fiscalCauseIds: Set<string>;
};

function annualBalanceProfile(
  state: CampaignState,
  previousDecisionCount: number,
  currentDecisionCount: number,
): AnnualBalanceProfile {
  const appliedBudgetEntries = state.causalLedger.filter((entry): entry is CausalEntry => (
    entry.target === "indicator"
      && entry.key === "annualBalance"
      && entry.appliedAtDecision <= currentDecisionCount
  ));
  const recurringEntries = appliedBudgetEntries.filter((entry) =>
    entry.duration === "annual" || entry.duration === "permanent",
  );
  const oneOffEntries = appliedBudgetEntries.filter((entry) =>
    entry.duration === "once" && entry.appliedAtDecision > previousDecisionCount,
  );
  const recurringDelta = recurringEntries.reduce((sum, entry) => sum + entry.delta, 0);
  const oneOffDelta = oneOffEntries.reduce((sum, entry) => sum + entry.delta, 0);
  return {
    fiscalYearBalance: state.baseline.annualBalanceMillions + recurringDelta + oneOffDelta,
    activeRunRate: state.baseline.annualBalanceMillions + recurringDelta,
    fiscalCauseIds: new Set([...recurringEntries, ...oneOffEntries].map((entry) => entry.id)),
  };
}

export function advanceMandateYear(
  state: CampaignState,
  year: Exclude<MandateYear, 0>,
): CampaignState {
  validateBaseline(state.baseline);
  if (state.annualCheckpoints.some((checkpoint) => checkpoint.year === year)) return state;
  const previous = state.annualCheckpoints.at(-1) ?? {
    nominalGdpMillions: state.baseline.nominalGdpMillions,
    debtMillions: state.baseline.debtMillions,
    interestCost: state.baseline.interestCostMillions,
  };
  const previousDecisionCount = state.annualCheckpoints.at(-1)?.afterDecisionCount ?? 0;
  const currentDecisionCount = state.decisions.length;
  const balanceProfile = annualBalanceProfile(state, previousDecisionCount, currentDecisionCount);
  const interestRatePercent = previous.debtMillions === 0
    ? 0
    : state.indicators.interestCost / previous.debtMillions * 100;
  const projected = projectYear({
    nominalGdpMillions: previous.nominalGdpMillions,
    debtMillions: previous.debtMillions,
    interestCostMillions: previous.interestCost,
  }, {
    annualBalance: balanceProfile.fiscalYearBalance,
    nominalGrowthPercent: state.indicators.growth,
    interestRatePercent,
  });
  const causes = state.causalLedger
    .filter((entry) => entry.target === "indicator"
      && entry.appliedAtDecision <= currentDecisionCount
      && (entry.key === "annualBalance"
        ? balanceProfile.fiscalCauseIds.has(entry.id)
        : ["growth", "interestCost"].includes(entry.key)))
    .map((entry) => entry.id);
  return {
    ...state,
    phase: "council",
    indicators: {
      ...state.indicators,
      annualBalance: balanceProfile.activeRunRate,
      debtToGdp: projected.debtToGdp,
      interestCost: projected.interestCostMillions,
    },
    annualCheckpoints: [...state.annualCheckpoints, {
      year,
      afterDecisionCount: state.decisions.length,
      nominalGdpMillions: projected.nominalGdpMillions,
      debtMillions: projected.debtMillions,
      debtToGdp: projected.debtToGdp,
      annualBalance: balanceProfile.fiscalYearBalance,
      interestCost: projected.interestCostMillions,
      causes: [...new Set(causes)],
    }],
  };
}
