import assert from "node:assert/strict";
import test from "node:test";

import type { Territoire } from "./donnees.ts";
import { comparaisonVoisins } from "./insights-europe.ts";

const territoire = (nom: string, valeur?: number): Territoire => ({
  nom,
  parent: null,
  population: null,
  drapeaux: {},
  series: valeur === undefined ? {} : { eurostat_test: { "2025": valeur } },
});

test("la comparaison aligne seulement les voisins publiés au même exercice", () => {
  const comparaison = comparaisonVoisins({
    DE: territoire("DE", 42.4),
    BE: territoire("BE", 47.2),
    ES: territoire("ES", 38.1),
    IT: { ...territoire("IT"), series: { eurostat_test: { "2024": 41.8 } } },
  }, "eurostat_test", "2025", "percent");

  assert.equal(
    comparaison,
    "Voisins européens — Allemagne 42,4\u202f% · Belgique 47,2\u202f% · Espagne 38,1\u202f%.",
  );
});

test("une comparaison trop partielle n'est pas affichée", () => {
  assert.equal(
    comparaisonVoisins({ DE: territoire("DE", 42.4) }, "eurostat_test", "2025", "percent"),
    undefined,
  );
});
