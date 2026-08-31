import assert from "node:assert/strict";
import test from "node:test";
import { normaliserQuestion, REPONSES_STATIQUES, resoudreQuestion, renduQuestionsIndex } from "./questions.ts";

test("les questions se normalisent sans accent ni stockage dans une URL", () => {
  assert.equal(normaliserQuestion("Électricité : plus chère ?"), "electricite plus chere");
  assert.doesNotMatch(renduQuestionsIndex(), /method="get"|fetch\(|localStorage|sessionStorage/);
});

test("une formulation connue reçoit une réponse statique", () => {
  const resolution = resoudreQuestion("Pourquoi on vend notre électricité moins cher aux autres pays ?");
  assert.ok(resolution.statut === "exact" || resolution.statut === "matched");
  assert.equal(resolution.reponse.analyseSlug, "electricite-exportee-facture-francais");
});

test("une question hors corpus n'invente aucune réponse", () => {
  assert.deepEqual(resoudreQuestion("Quelle sera la météo sur Mars demain ?"), { statut: "unsupported" });
});

test("chaque réponse a une page stable et une provenance qualifiée", () => {
  assert.equal(new Set(REPONSES_STATIQUES.map((item) => item.slug)).size, REPONSES_STATIQUES.length);
  for (const item of REPONSES_STATIQUES) {
    assert.ok(item.sourceRefs.length > 0);
    assert.ok(item.sourceRefs.every((ref) => ref.analyseId === item.analyseSlug && ref.sourceId));
  }
});
