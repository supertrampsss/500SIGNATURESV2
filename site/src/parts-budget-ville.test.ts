import assert from "node:assert/strict";
import { test } from "node:test";
import { rendrePartsBudgetVille } from "./parts-budget-ville.ts";
import type { Territoire } from "./donnees.ts";

function ville(series: Territoire["series"]): Territoire {
  return { nom: "Ville", parent: "01", population: 1000, drapeaux: {}, series };
}

test("rapporte dépenses et épargne aux recettes du même exercice", () => {
  const html = rendrePartsBudgetVille(ville({
    ofgl_recettes_fonctionnement: { "2024": 100, "2025": 200 },
    ofgl_depenses_fonctionnement: { "2024": 70, "2025": 150 },
    ofgl_epargne_brute: { "2024": 30, "2025": 50 },
  }));
  assert.match(html, /SUR 100 € ENCAISSÉS · 2025/);
  assert.match(html, /75 %.*en dépenses de fonctionnement/s);
  assert.match(html, /25 %.*en épargne brute/s);
});

test("n'affiche aucune part quand les recettes ou une composante manquent", () => {
  assert.equal(rendrePartsBudgetVille(ville({
    ofgl_recettes_fonctionnement: { "2025": 200 },
    ofgl_depenses_fonctionnement: { "2025": 150 },
  })), "");
});

test("affiche deux repères supplémentaires calculés sur le même exercice", () => {
  const html = rendrePartsBudgetVille(ville({
    ofgl_recettes_fonctionnement: { "2025": 200 },
    ofgl_depenses_fonctionnement: { "2025": 150 },
    ofgl_epargne_brute: { "2025": 50 },
    ofgl_encours_dette: { "2024": 900, "2025": 250 },
    ofgl_depenses_d_investissement_hors_remb: { "2025": 100_000 },
    ofgl_population_reference: { "2025": 1_000 },
  }));
  assert.match(html, /5 ans.*de dette rapportée à l’épargne annuelle/s);
  assert.match(html, /100\s?€.*investis par habitant/su);
  assert.doesNotMatch(html, /18 ans/);
});

test("omet la durée de désendettement quand l'épargne n'est pas positive", () => {
  const html = rendrePartsBudgetVille(ville({
    ofgl_recettes_fonctionnement: { "2025": 200 },
    ofgl_depenses_fonctionnement: { "2025": 210 },
    ofgl_epargne_brute: { "2025": -10 },
    ofgl_encours_dette: { "2025": 250 },
  }));
  assert.doesNotMatch(html, /ans<\/strong>/);
});
