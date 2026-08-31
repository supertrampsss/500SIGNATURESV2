import assert from "node:assert/strict";
import test from "node:test";

import { INDICATOR_META } from "./indicator-meta.ts";
import type { IndicatorKey } from "./types.ts";

const INDICATORS = [
  "annualBalance", "debtToGdp", "interestCost", "growth", "employment", "investment",
  "publicServices", "majority", "reformCapacity", "opinion", "institutionalTrust", "financialCredibility",
] as const satisfies readonly IndicatorKey[];

test("les métadonnées couvrent chaque indicateur avec une unité et un epsilon explicites", () => {
  assert.deepEqual(Object.keys(INDICATOR_META).sort(), [...INDICATORS].sort());
  for (const key of INDICATORS) {
    const meta = INDICATOR_META[key];
    assert.ok(meta.label.trim(), `${key}:label`);
    assert.ok(meta.unit.trim(), `${key}:unit`);
    assert.ok(meta.precision >= 0, `${key}:precision`);
    assert.ok(meta.epsilon > 0, `${key}:epsilon`);
    assert.ok(meta.priority > 0, `${key}:priority`);
  }
});

test("les unités financières, macroéconomiques et ludiques ne sont pas confondues", () => {
  assert.equal(INDICATOR_META.annualBalance.unit, "M€");
  assert.equal(INDICATOR_META.interestCost.unit, "M€");
  assert.equal(INDICATOR_META.debtToGdp.unit, "% du PIB");
  assert.equal(INDICATOR_META.growth.unit, "% par an");
  assert.equal(INDICATOR_META.growth.label, "Croissance nominale annuelle");
  for (const key of INDICATORS.filter((candidate) => !["annualBalance", "interestCost", "debtToGdp", "growth"].includes(candidate))) {
    assert.equal(INDICATOR_META[key].unit, "indice de jeu");
  }
});
