import assert from "node:assert/strict";
import test from "node:test";

import { policyDecision, type PolicyDecisionDefinition } from "./policy-catalogue.ts";
import { policyById, SCENARIO_V3_CATALOGUE } from "./scenario.ts";

const VALID: PolicyDecisionDefinition = {
  id: "test-policy",
  chapterId: "test-chapter",
  kind: "gestion",
  title: "Tester cette décision ?",
  context: "Un contexte explicite.",
  sourceKeys: ["cour-finances-2025"],
  evidenceLabel: "Une publication identifiable.",
  options: [
    { id: "yes", label: "Décider", summary: "Le choix produit un effet.", budgetDelta: 1, beneficiaries: ["A"], contributors: ["B"] },
    { id: "no", label: "Refuser", summary: "Le choix conserve le dispositif.", budgetDelta: 0, beneficiaries: ["B"], contributors: ["A"] },
  ],
};

test("le compilateur résout une source directe sans fabriquer le texte visible", () => {
  const decision = policyDecision(VALID);
  assert.equal(decision.kind, "gestion");
  assert.match(decision.evidence[0]!.sourceUrl, /^https:\/\//);
  assert.equal(decision.options[0]!.summary, "Le choix produit un effet.");
});

test("le compilateur refuse une copie ou une source manquante", () => {
  assert.throws(() => policyDecision({ ...VALID, context: "" }));
  assert.throws(() => policyDecision({ ...VALID, sourceKeys: [] }));
});

test("l'accessor retrouve une politique dans le catalogue complet", () => {
  assert.equal(policyById(SCENARIO_V3_CATALOGUE.decisions[0]!.id)?.id, SCENARIO_V3_CATALOGUE.decisions[0]!.id);
  assert.equal(policyById("missing-policy"), undefined);
});
