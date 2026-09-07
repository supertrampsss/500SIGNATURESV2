import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateBusinessCase, type AdvertisingCase } from './business-model.ts';

const baseline: AdvertisingCase = {
  monthlyPageViews: 100_000, editorialShare: .7, slotsPerEditorialPage: 1.5,
  slotReachRate: .75, programmaticEligibilityRate: .7, fillRate: .9, netImpressionRpm: 4,
  directImpressions: 0, directNetCpm: 0, directSalesHours: 0,
  monthlyCashCost: 150, editorialHours: 40, adOperationsHours: 4, hourlyCost: 60,
};
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < .000001, actual + ' != ' + expected);

test('revenue discounts non-editorial views, unreached slots, consent/adblock and unfilled requests once', () => {
  const result = evaluateBusinessCase(baseline);
  close(result.reachedSlots, 78_750);
  close(result.programmaticImpressions, 49_612.5);
  close(result.revenue, 198.45);
  close(result.sitePageRpm!, 1.9845);
  close(result.cashSurplus, 48.45);
  close(result.economicResult, -2591.55);
  const threshold = result.programmaticOnlyBreakEvenPageViews!;
  assert.ok(evaluateBusinessCase({ ...baseline, monthlyPageViews: threshold }).economicResult >= 0);
  assert.ok(evaluateBusinessCase({ ...baseline, monthlyPageViews: threshold - 1 }).economicResult < 0);
});

test('direct sponsorship replaces inventory and includes its sales time instead of adding a second revenue on it', () => {
  const result = evaluateBusinessCase({ ...baseline, directImpressions: 20_000, directNetCpm: 25, directSalesHours: 4 });
  close(result.programmaticRevenue, 148.05);
  close(result.directRevenue, 500);
  close(result.revenue, 648.05);
  close(result.economicCost, 3030);
  close(result.economicResult, -2381.95);
  const directOnly = evaluateBusinessCase({ ...baseline, directImpressions: 78_750, directNetCpm: 25 });
  close(directOnly.programmaticRevenue, 0);
});

test('no audience or eligible inventory means no programmatic income but costs remain', () => {
  const empty = evaluateBusinessCase({ ...baseline, monthlyPageViews: 0 });
  assert.equal(empty.sitePageRpm, null);
  close(empty.revenue, 0);
  close(empty.economicResult, -2790);
  for (const key of ['editorialShare', 'slotsPerEditorialPage', 'slotReachRate', 'programmaticEligibilityRate', 'fillRate', 'netImpressionRpm'] as const) {
    const result = evaluateBusinessCase({ ...baseline, [key]: 0 });
    close(result.revenue, 0);
    assert.equal(result.programmaticOnlyBreakEvenPageViews, null);
  }
});

test('invalid rates, oversold inventory and density cannot produce plausible forecasts', () => {
  for (const value of [NaN, Infinity, -1]) assert.throws(() => evaluateBusinessCase({ ...baseline, netImpressionRpm: value }));
  for (const key of ['editorialShare', 'slotReachRate', 'programmaticEligibilityRate', 'fillRate'] as const) {
    assert.throws(() => evaluateBusinessCase({ ...baseline, [key]: 1.01 }));
  }
  assert.throws(() => evaluateBusinessCase({ ...baseline, slotsPerEditorialPage: 3 }));
  assert.throws(() => evaluateBusinessCase({ ...baseline, directImpressions: 78_751 }));
});
