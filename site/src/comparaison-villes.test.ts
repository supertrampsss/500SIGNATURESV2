import assert from "node:assert/strict";
import { test } from "node:test";
import type { IndexTerritoires } from "./repertoire.ts";
import { rendreComparaisonVilles, villesProches } from "./comparaison-villes.ts";

const index: IndexTerritoires = {
  denominateur: "ofgl_population_reference", periodes: ["2025"], unite: "habitants",
  millesime_geographique: 2023,
  codes: ["ville", "a", "b", "c", "d", "lointaine", "autre"],
  noms: ["Ville", "A", "B", "C", "D", "Lointaine", "Autre catégorie"],
  parents: Array(7).fill("01"),
  population_municipale: [1000, 900, 1100, 1200, 1300, 2000, 1000],
  population_reference: [[1000], [900], [1100], [1200], [1300], [2000], [1000]],
  semblables: {
    cascade: [["strate", "type"]], minimum: 3,
    libelles: { strate: { petite: "de 500 à 2 000 habitants" }, type: { rurale: "rurales", urbaine: "urbaines" } },
    cles: ["petite|rurale", "petite|urbaine"],
    groupe: [0, 0, 0, 0, 0, 0, 1],
  },
};

test("retient des communes de même catégorie et à population proche", () => {
  assert.deepEqual(villesProches(index, "ville"), ["a", "b", "c", "d"]);
});

test("compare les euros par habitant au même exercice et explique l'écart en pourcentage", () => {
  const comptes = {
    ofgl_recettes_fonctionnement: { ville: 150_000, a: 90_000, b: 132_000, c: 96_000, d: 130_000 },
    ofgl_depenses_fonctionnement: { ville: 120_000, a: 72_000, b: 99_000, c: 108_000, d: 130_000 },
    ofgl_encours_dette: { ville: 50_000, a: 45_000, b: 55_000, c: 60_000, d: 65_000 },
  };
  const html = rendreComparaisonVilles(index, "ville", "2025", comptes);
  assert.match(html, /50 % au-dessus de la médiane/);
  assert.match(html, /150\s?€/u);
  assert.match(html, /100\s?€/u);
  assert.match(html, /par hab\./);
  assert.match(html, /exercice 2025/);
  assert.match(html, /référentiel 2023/);
  assert.doesNotMatch(html, /Lointaine|Autre catégorie/);
  assert.match(html, /<li>A · 900 hab\.<\/li>/);
});

test("ne fabrique pas de comparaison quand trop peu de pairs publient", () => {
  const html = rendreComparaisonVilles(index, "ville", "2025", {
    ofgl_recettes_fonctionnement: { ville: 150_000, a: 90_000, b: 110_000 },
  });
  assert.match(html, /ne permettent pas de calculer une médiane/);
  assert.doesNotMatch(html, /villes-paires__carte/);
});

test("explique l'absence de pairs de population comparable", () => {
  const html = rendreComparaisonVilles(index, "lointaine", "2025", {});
  assert.match(html, /Moins de trois communes/);
});
