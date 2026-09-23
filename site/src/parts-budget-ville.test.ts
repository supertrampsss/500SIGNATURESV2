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
