import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMandateBaseline,
  projectYear,
  REQUIRED_BASELINE_INDICATORS,
  validateBaseline,
} from "./timeline.ts";

test("un déficit annuel augmente le stock de dette une seule fois", () => {
  const baseline = {
    nominalGdpMillions: 2_000_000,
    debtMillions: 2_000_000,
    interestCostMillions: 40_000,
  };
  const next = projectYear(baseline, {
    annualBalance: -100_000,
    nominalGrowthPercent: 0,
    interestRatePercent: 2,
  });

  assert.equal(next.debtMillions, 2_100_000);
  assert.equal(next.debtToGdp, 105);
  assert.equal(next.interestCostMillions, 42_000);
});

test("le moteur refuse une baseline non sourcée", () => {
  assert.throws(() => validateBaseline({
    period: "2025",
    debtPeriod: "2025-Q4",
    nominalGdpMillions: 0,
    debtMillions: 1,
    annualBalanceMillions: -1,
    interestCostMillions: 1,
    nominalGrowthPercent: 1,
    sourceIds: [],
    dataVersion: "test",
  }), /baseline/i);
});

test("la baseline aligne les flux annuels sur la dette du quatrième trimestre", () => {
  const baseline = buildMandateBaseline({
    gdp: { "2024": 2_935_251_000_000, "2025": 2_991_055_900_000 },
    debtToGdp: { "2025-Q4": 115.7, "2026-Q1": 116.3 },
    balance: { "2025": -152_532_000_000 },
    interest: { "2025": 66_635_900_000 },
    dataVersion: "2026-08-22T1939",
  });

  assert.equal(baseline?.period, "2025");
  assert.equal(baseline?.debtPeriod, "2025-Q4");
  assert.equal(baseline?.nominalGdpMillions, 2_991_055.9);
  assert.equal(baseline?.annualBalanceMillions, -152_532);
  assert.equal(baseline?.interestCostMillions, 66_635.9);
  assert.equal(baseline?.debtMillions, 3_460_651.6763);
  assert.ok(Math.abs((baseline?.nominalGrowthPercent ?? 0) - 1.9011968652765887) < 1e-12);
  assert.deepEqual(baseline?.sourceIds, REQUIRED_BASELINE_INDICATORS);
  assert.equal(baseline?.dataVersion, "2026-08-22T1939");
});

test("la baseline exige le PIB annuel précédent sans valeur de secours", () => {
  assert.equal(buildMandateBaseline({
    gdp: { "2025": 2_991_055_900_000 },
    debtToGdp: { "2025-Q4": 115.7 },
    balance: { "2025": -152_532_000_000 },
    interest: { "2025": 66_635_900_000 },
    dataVersion: "2026-08-22T1939",
  }), null);
});

test("la baseline refuse un identifiant de source manquant ou supplémentaire", () => {
  const valid = {
    period: "2025",
    debtPeriod: "2025-Q4",
    nominalGdpMillions: 1,
    debtMillions: 1,
    annualBalanceMillions: 0,
    interestCostMillions: 0,
    nominalGrowthPercent: 0,
    sourceIds: [...REQUIRED_BASELINE_INDICATORS],
    dataVersion: "publication",
  };
  assert.doesNotThrow(() => validateBaseline(valid));
  assert.throws(() => validateBaseline({ ...valid, sourceIds: valid.sourceIds.slice(1) }), /sourced/i);
  assert.throws(() => validateBaseline({ ...valid, sourceIds: [...valid.sourceIds, "autre"] }), /sourced/i);
});
