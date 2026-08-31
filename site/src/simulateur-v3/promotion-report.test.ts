import assert from "node:assert/strict";
import test from "node:test";

import { PROMOTION_REPORT } from "./promotion-report.ts";

test("le rapport V10 qualifie exhaustivement les douze promotions", () => {
  assert.equal(PROMOTION_REPORT.version, 10);
  assert.equal(PROMOTION_REPORT.candidates.length, 12);
  assert.deepEqual(PROMOTION_REPORT.candidates.map((candidate) => candidate.status), Array(12).fill("promoted"));
  for (const candidate of PROMOTION_REPORT.candidates) {
    assert.ok(candidate.score >= 8, candidate.decisionId);
    assert.equal(candidate.rejectionReason, null, candidate.decisionId);
    assert.match(candidate.proof, /remplace|contre-choix|assiette|arbitrage|alternative/i, candidate.decisionId);
    assert.notEqual(candidate.decisionId, candidate.replacesDecisionId, candidate.decisionId);
  }
});

test("le rapport est une preuve statique immuable, sans sélection pendant la partie", () => {
  assert.equal(Object.isFrozen(PROMOTION_REPORT), true);
  assert.equal(Object.isFrozen(PROMOTION_REPORT.candidates), true);
  assert.throws(() => {
    (PROMOTION_REPORT.candidates as unknown as { push(value: unknown): void }).push({});
  }, TypeError);
});
