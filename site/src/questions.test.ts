import assert from "node:assert/strict";
import test from "node:test";
import { normaliserQuestion, REPONSES_STATIQUES, resoudreQuestion, renduQuestionsIndex } from "./questions.ts";

test("les questions se normalisent sans accent ni stockage dans une URL", () => {
  assert.equal(normaliserQuestion("Électricité : plus chère ?"), "electricite plus chere");
  assert.doesNotMatch(renduQuestionsIndex(), /method="get"|fetch\(|localStorage|sessionStorage/);
});

test("une formulation connue reçoit une réponse statique", () => {
  const resolution = resoudreQuestion("Pourquoi on vend notre électricité moins cher aux autres pays ?");
  assert.equal(resolution.statut, "exact");
  if (resolution.statut !== "exact") return;
  assert.equal(resolution.reponse.analyseSlug, "electricite-exportee-facture-francais");
});

test("une question hors corpus n'invente aucune réponse", () => {
  assert.deepEqual(resoudreQuestion("Quelle sera la météo sur Mars demain ?"), { statut: "unsupported" });
});

test("une requête faible ou sans sujet précis est refusée", () => {
  assert.deepEqual(resoudreQuestion("France"), { statut: "unsupported" });
  assert.deepEqual(resoudreQuestion("Le prix augmente-t-il ?"), { statut: "unsupported" });
  assert.deepEqual(resoudreQuestion("Quel âge moyen pour le gaz ?"), { statut: "unsupported" });
  assert.deepEqual(resoudreQuestion("Quel est le prix moyen d'une résidence principale ?"), { statut: "unsupported" });
  assert.deepEqual(resoudreQuestion("Hausse prix énergie ménages"), { statut: "unsupported" });
});

test("une polarité inversée ne reçoit qu'un lien canonique, jamais le texte d'une réponse", () => {
  const resolution = resoudreQuestion("Le prix du gaz a-t-il baissé ?");
  assert.equal(resolution.statut, "matched");
  if (resolution.statut !== "matched") return;
  assert.equal(resolution.reponse.slug, "hausse-prix-gaz");
  assert.deepEqual(Object.keys(resolution.reponse).sort(), ["question", "slug"]);
});

test("une formulation réellement partagée propose les dossiers sans répondre", () => {
  const resolution = resoudreQuestion("électricité nucléaire");
  assert.equal(resolution.statut, "ambiguous");
  if (resolution.statut !== "ambiguous") return;
  assert.deepEqual(
    new Set(resolution.reponses.map((item) => item.slug)),
    new Set(["electricite-vendue-moins-chere-etranger", "arenh-42-euros-etranger"]),
  );
});

test("chaque réponse a une page stable et une provenance qualifiée", () => {
  assert.equal(new Set(REPONSES_STATIQUES.map((item) => item.slug)).size, REPONSES_STATIQUES.length);
  for (const item of REPONSES_STATIQUES) {
    assert.ok(item.sourceRefs.length > 0);
    assert.ok(item.motsCles.length > 0);
    assert.ok(item.sourceRefs.every((ref) => ref.analyseId === item.analyseSlug && ref.sourceId));
  }
});

test("les réponses comparatives citent chaque série mobilisée", () => {
  const fournitures = REPONSES_STATIQUES.find((item) => item.slug === "prix-fournitures-scolaires")!;
  assert.deepEqual(
    fournitures.sourceRefs.map((ref) => ref.sourceId),
    ["insee-fournitures", "insee-ipc-ensemble"],
  );
  const age = REPONSES_STATIQUES.find((item) => item.slug === "age-premier-achat-residence-principale")!;
  assert.ok(age.sourceRefs.some((ref) => ref.sourceId === "insee-cohortes-2017"));
});
