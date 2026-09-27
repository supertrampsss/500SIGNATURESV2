import assert from "node:assert/strict";
import { test } from "node:test";
import { rendrePartsBudgetVille } from "./parts-budget-ville.ts";
import type { Territoire } from "./donnees.ts";

function ville(series: Territoire["series"]): Territoire {
  return { nom: "Ville", parent: "01", population: 1000, drapeaux: {}, series };
}

test("rapporte dépenses et épargne brute aux recettes du même exercice sans remboursement publié", () => {
  const html = rendrePartsBudgetVille(ville({
    ofgl_recettes_fonctionnement: { "2024": 100, "2025": 200 },
    ofgl_depenses_fonctionnement: { "2024": 70, "2025": 150 },
    ofgl_epargne_brute: { "2024": 30, "2025": 50 },
  }));
  assert.match(html, /Fonctionnement · 2025/);
  assert.match(html, /75,0 €.*Fonctionnement/s);
  assert.match(html, /25,0 €.*Épargne brute avant remboursement/s);
  assert.doesNotMatch(html, /parts-budget__capital/);
});

test("n'affiche aucune part quand les recettes ou une composante manquent", () => {
  assert.equal(rendrePartsBudgetVille(ville({
    ofgl_recettes_fonctionnement: { "2025": 200 },
    ofgl_depenses_fonctionnement: { "2025": 150 },
  })), "");
});

test("ne mélange pas le stock de dette et le flux d'investissement dans la barre", () => {
  const html = rendrePartsBudgetVille(ville({
    ofgl_recettes_fonctionnement: { "2025": 200 },
    ofgl_depenses_fonctionnement: { "2025": 150 },
    ofgl_epargne_brute: { "2025": 50 },
    ofgl_encours_dette: { "2024": 900, "2025": 250 },
    ofgl_depenses_d_investissement_hors_remb: { "2025": 100_000 },
    ofgl_population_reference: { "2025": 1_000 },
  }));
  assert.doesNotMatch(html, /250 €|100 000 €|ans<\/strong>/);
  assert.match(html, /flex:0\.75000000/);
  assert.match(html, /flex:0\.25000000/);
});

test("annonce le dépassement quand les dépenses dépassent les recettes", () => {
  const html = rendrePartsBudgetVille(ville({
    ofgl_recettes_fonctionnement: { "2025": 200 },
    ofgl_depenses_fonctionnement: { "2025": 210 },
    ofgl_epargne_brute: { "2025": -10 },
    ofgl_encours_dette: { "2025": 250 },
  }));
  assert.match(html, /dépenses de fonctionnement dépassent les recettes/);
  assert.doesNotMatch(html, /parts-budget__barre/);
});

test("déduit le capital et l'épargne nette avant de parler de l'argent disponible", () => {
  const html = rendrePartsBudgetVille(ville({
    ofgl_recettes_fonctionnement: { "2025": 100 },
    ofgl_depenses_fonctionnement: { "2025": 80 },
    ofgl_epargne_brute: { "2025": 20 },
    ofgl_remboursements_d_emprunts_hors_gad: { "2025": 15 },
    ofgl_epargne_nette: { "2025": 5 },
  }));
  assert.match(html, /80,0 €.*Fonctionnement/s);
  assert.match(html, /15,0 €.*Capital de la dette remboursé/s);
  assert.match(html, /5,0 €.*Épargne nette/s);
  assert.doesNotMatch(html, /20,0 €/);
});
