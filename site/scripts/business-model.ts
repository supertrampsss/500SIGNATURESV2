import { MAX_AD_SLOTS_PER_PAGE } from '../src/advertising-policy.ts';

/** Internal sensitivity model, not measured audience, ad serving or a revenue promise. */
export type AdvertisingCase = {
  monthlyPageViews: number;
  editorialShare: number;
  slotsPerEditorialPage: number;
  slotReachRate: number;
  programmaticEligibilityRate: number;
  fillRate: number;
  /** Publisher revenue per 1,000 paid impressions, already net of network fees. */
  netImpressionRpm: number;
  /** Direct inventory replaces programmatic inventory. Never count both on the same slot. */
  directImpressions: number;
  directNetCpm: number;
  directSalesHours: number;
  monthlyCashCost: number;
  editorialHours: number;
  adOperationsHours: number;
  hourlyCost: number;
};

function nonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(label + ': finite non-negative value required');
}

export function evaluateBusinessCase(input: AdvertisingCase) {
  for (const [key, value] of Object.entries(input)) nonNegative(value, key);
  for (const key of ['editorialShare', 'slotReachRate', 'programmaticEligibilityRate', 'fillRate'] as const) {
    if (input[key] > 1) throw new Error(key + ': rate must be at most 1');
  }
  if (input.slotsPerEditorialPage > MAX_AD_SLOTS_PER_PAGE) throw new Error('ad density exceeds the product contract');
  const editorialPageViews = input.monthlyPageViews * input.editorialShare;
  const reachedSlots = editorialPageViews * input.slotsPerEditorialPage * input.slotReachRate;
  if (input.directImpressions > reachedSlots) throw new Error('direct inventory exceeds reached slots');
  const programmaticImpressions = (reachedSlots - input.directImpressions)
    * input.programmaticEligibilityRate * input.fillRate;
  const programmaticRevenue = programmaticImpressions * input.netImpressionRpm / 1000;
  const directRevenue = input.directImpressions * input.directNetCpm / 1000;
  const revenue = programmaticRevenue + directRevenue;
  const hours = input.editorialHours + input.adOperationsHours + input.directSalesHours;
  const economicCost = input.monthlyCashCost + hours * input.hourlyCost;
  const programmaticRevenuePerPage = input.editorialShare * input.slotsPerEditorialPage
    * input.slotReachRate * input.programmaticEligibilityRate * input.fillRate * input.netImpressionRpm / 1000;
  const baselineCost = input.monthlyCashCost + (input.editorialHours + input.adOperationsHours) * input.hourlyCost;
  return {
    editorialPageViews, reachedSlots, programmaticImpressions,
    programmaticRevenue, directRevenue, revenue,
    sitePageRpm: input.monthlyPageViews > 0 ? revenue / input.monthlyPageViews * 1000 : null,
    hours, cashSurplus: revenue - input.monthlyCashCost,
    economicCost, economicResult: revenue - economicCost,
    // Separate baseline thresholds, with no direct sales assumed at any traffic level.
    programmaticOnlyBreakEvenPageViews: programmaticRevenuePerPage > 0 ? Math.ceil(baselineCost / programmaticRevenuePerPage) : null,
    programmaticOnlyCashBreakEvenPageViews: programmaticRevenuePerPage > 0 ? Math.ceil(input.monthlyCashCost / programmaticRevenuePerPage) : null,
  };
}
