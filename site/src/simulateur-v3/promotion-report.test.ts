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

test("le rapport fixe les six critères, la preuve et le score de chaque promotion", () => {
  const expected = [
    ["revenir-a-62-ans", 9, [3, 2, 2, 1, 1, 0]],
    ["relever-tva-restauration-commerciale", 9, [3, 2, 2, 1, 1, 0]],
    ["perenniser-surtaxe-grandes-entreprises", 9, [3, 2, 2, 1, 1, 0]],
    ["doubler-les-franchises-medicales", 8, [2, 2, 2, 1, 1, 0]],
    ["fiscalite-nutritionnelle-au-niveau-recommande", 8, [2, 2, 2, 1, 1, 0]],
    ["reduire-les-delais-de-traitement-de-l", 8, [2, 2, 2, 1, 1, 0]],
    ["etaler-la-marche-2026-de-la-programmation", 8, [2, 2, 2, 1, 1, 0]],
    ["reduire-l-aide-publique-au-developpement-de", 8, [2, 2, 2, 1, 1, 0]],
    ["supprimer-le-bonus-automobile-electrique", 8, [2, 2, 2, 1, 1, 0]],
    ["renforcer-la-taxe-sur-les-billets-d", 8, [2, 2, 2, 1, 1, 0]],
    ["supprimer-les-departements", 8, [2, 2, 2, 1, 1, 0]],
    ["ne-pas-remplacer-un-depart-administratif-sur", 8, [2, 2, 2, 1, 1, 0]],
  ] as const;

  for (const [decisionId, score, criteria] of expected) {
    const candidate = PROMOTION_REPORT.candidates.find((item) => item.decisionId === decisionId)!;
    assert.equal(candidate.status, "promoted", decisionId);
    assert.equal(candidate.score, score, decisionId);
    assert.deepEqual(Object.values(candidate.criteria), criteria, decisionId);
    assert.equal(candidate.evidence.length > 0, true, decisionId);
    assert.equal(candidate.criteria.proofQuality + candidate.criteria.scopeIndependence
      + candidate.criteria.annualEffectAndCalendar + candidate.criteria.mandateFeasibility
      + candidate.criteria.dilemmaReality + candidate.criteria.publicSalience, score, decisionId);
  }
});

test("chaque rejet déclaré fournit son motif déterministe", () => {
  for (const candidate of PROMOTION_REPORT.candidates.filter((item) => item.status === "rejected")) {
    assert.notEqual(candidate.rejectionReason, null, candidate.decisionId);
    assert.ok(candidate.rejectionReason!.trim(), candidate.decisionId);
  }
});

test("le rapport est une preuve statique immuable, sans sélection pendant la partie", () => {
  assert.equal(Object.isFrozen(PROMOTION_REPORT), true);
  assert.equal(Object.isFrozen(PROMOTION_REPORT.candidates), true);
  assert.throws(() => {
    (PROMOTION_REPORT.candidates as unknown as { push(value: unknown): void }).push({});
  }, TypeError);
});
