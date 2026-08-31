import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceMandateYear,
  buildMandateBaseline,
  decisionCountAtMandateYearEnd,
  projectYear,
  REQUIRED_BASELINE_INDICATORS,
  validateBaseline,
} from "./timeline.ts";
import { applyEffect } from "./effects.ts";
import { SCENARIO_V3 } from "./scenario.ts";
import { createTestCampaign, validScenario } from "./test-fixtures.ts";
import type { CampaignState, EffectRule } from "./types.ts";
import { positionAfterCompleted } from "./validation.ts";

function previewStateAt(state: CampaignState, count: number): CampaignState {
  return {
    ...state,
    phase: "decision_result",
    ...positionAfterCompleted(SCENARIO_V3, count)!,
    decisions: SCENARIO_V3.decisions.slice(0, count).map((decision, index) => ({
      decisionId: decision.id,
      optionId: decision.options[0]!.id,
      status: "confirmed" as const,
      confirmedAtIndex: index + 1,
    })),
  };
}

function applyBudgetEffect(
  state: CampaignState,
  id: string,
  delta: number,
  duration: EffectRule["duration"],
  appliedAtDecision: number,
): CampaignState {
  const source = state.decisions[appliedAtDecision - 1]!;
  return applyEffect(state, {
    id,
    target: "indicator",
    key: "annualBalance",
    delta,
    timing: { kind: "immediate" },
    duration,
    explanation: `Effet budgétaire ${id}.`,
  }, {
    sourceType: "decision",
    sourceId: `${source.decisionId}:${source.optionId}`,
    appliedAtDecision,
  });
}

test("les frontières annuelles sont dérivées de la taille réelle des chapitres", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((year) => decisionCountAtMandateYearEnd(SCENARIO_V3, year as 1 | 2 | 3 | 4 | 5)),
    [16, 32, 39, 53, 60],
  );
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((year) => decisionCountAtMandateYearEnd(validScenario(), year as 1 | 2 | 3 | 4 | 5)),
    [24, 48, 60, 84, 96],
  );
});

test("un flux ponctuel finance un seul exercice puis sort du rythme annuel sans effacer sa cause", () => {
  const baseline = createTestCampaign(SCENARIO_V3).baseline;
  let state = previewStateAt(createTestCampaign(SCENARIO_V3), 16);
  state = applyBudgetEffect(state, "recurring-budget", 1_200, "annual", 1);
  state = applyBudgetEffect(state, "one-off-budget", -5_000, "once", 16);
  const recurringCause = state.causalLedger.find((entry) => entry.id.includes(":recurring-budget:"))!;
  const oneOffCause = state.causalLedger.find((entry) => entry.id.includes(":one-off-budget:"))!;
  const ledger = structuredClone(state.causalLedger);

  const yearOne = advanceMandateYear(state, 1);
  const firstCheckpoint = yearOne.annualCheckpoints[0]!;
  assert.equal(firstCheckpoint.annualBalance, baseline.annualBalanceMillions + 1_200 - 5_000);
  assert.equal(firstCheckpoint.debtMillions, baseline.debtMillions - firstCheckpoint.annualBalance);
  assert.equal(yearOne.indicators.annualBalance, baseline.annualBalanceMillions + 1_200);
  assert.ok(firstCheckpoint.causes.includes(recurringCause.id));
  assert.ok(firstCheckpoint.causes.includes(oneOffCause.id));
  assert.deepEqual(yearOne.causalLedger, ledger);
  assert.deepEqual(advanceMandateYear(yearOne, 1), yearOne);

  const yearTwo = advanceMandateYear(previewStateAt(yearOne, 32), 2);
  const secondCheckpoint = yearTwo.annualCheckpoints[1]!;
  assert.equal(secondCheckpoint.annualBalance, baseline.annualBalanceMillions + 1_200);
  assert.equal(secondCheckpoint.debtMillions, firstCheckpoint.debtMillions - secondCheckpoint.annualBalance);
  assert.equal(yearTwo.indicators.annualBalance, baseline.annualBalanceMillions + 1_200);
  assert.ok(secondCheckpoint.causes.includes(recurringCause.id));
  assert.ok(!secondCheckpoint.causes.includes(oneOffCause.id));
  assert.deepEqual(yearTwo.causalLedger, ledger);
});

test("chaque Conseil consomme uniquement les flux ponctuels de sa fenêtre ouverte-fermée", () => {
  const boundaries = [16, 32, 39, 53, 60] as const;
  const baseline = createTestCampaign(SCENARIO_V3).baseline.annualBalanceMillions;
  let state = createTestCampaign(SCENARIO_V3);
  let previousBoundary = 0;
  const consumedCauses: string[] = [];

  boundaries.forEach((boundary, index) => {
    state = previewStateAt(state, boundary);
    state = applyBudgetEffect(state, `window-${index + 1}-open`, 100 + index, "once", previousBoundary + 1);
    state = applyBudgetEffect(state, `window-${index + 1}-close`, 10 + index, "once", boundary);
    const currentCauses = state.causalLedger.slice(-2).map((entry) => entry.id);

    state = advanceMandateYear(state, (index + 1) as 1 | 2 | 3 | 4 | 5);
    const checkpoint = state.annualCheckpoints[index]!;
    assert.equal(checkpoint.afterDecisionCount, boundary);
    assert.equal(checkpoint.annualBalance, baseline + 110 + index * 2);
    assert.equal(state.indicators.annualBalance, baseline);
    assert.ok(currentCauses.every((id) => checkpoint.causes.includes(id)));
    assert.ok(consumedCauses.every((id) => !checkpoint.causes.includes(id)));

    consumedCauses.push(...currentCauses);
    previousBoundary = boundary;
  });
});

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
