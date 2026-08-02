/**
 * Un repère mal choisi est pire que pas de repère : il fait croire à une
 * comparaison qui n'en est pas une.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { rendu, reperes, valeurDe, type Reference } from "./reference.ts";

const EUROS: Reference = {
  nature: "agregat",
  france: { n: 34772, mediane: 749, total: 52_000_000_000, habitants: 65_000_000 },
  regions: { "75": { n: 1200, mediane: 812, total: 5_000_000_000, habitants: 6_000_000 } },
};
const TAUX: Reference = {
  nature: "mediane",
  france: { n: 2482, mediane: 16.3 },
  regions: { "75": { n: 90, mediane: 14.1 } },
};

test("un montant agrégé se lit en rapport, pas en moyenne de moyennes", () => {
  // 52 Md€ / 65 M habitants = 800 €, et non la moyenne des 34 772 valeurs
  assert.equal(valeurDe(EUROS.france, "agregat", true), 800);
  assert.equal(valeurDe(EUROS.france, "agregat", false), 52_000_000_000);
});

test("une médiane ne se divise pas par la population", () => {
  assert.equal(valeurDe(TAUX.france, "mediane", true), 16.3);
  assert.equal(valeurDe(TAUX.france, "mediane", false), 16.3);
});

test("une commune se compare aux communes, pas au conseil régional", () => {
  const liste = reperes(EUROS, "commune", "75", true);
  assert.deepEqual(liste.map((r) => r.libelle), [
    "Communes de la région",
    "Communes de France",
  ]);
});

test("une région n'a pas la région pour repère : ce serait une tautologie", () => {
  const liste = reperes(EUROS, "region", "75", true);
  assert.deepEqual(liste.map((r) => r.libelle), ["Régions de France"]);
});

test("un territoire sans région connue garde le repère national", () => {
  assert.deepEqual(reperes(EUROS, "commune", null, true).map((r) => r.libelle), [
    "Communes de France",
  ]);
});

test("une référence absente ne produit rien plutôt qu'un zéro", () => {
  assert.deepEqual(reperes(undefined, "commune", "75", true), []);
});

test("l'écart au repère est affiché, avec son signe", () => {
  const html = rendu(reperes(EUROS, "commune", "75", true), 871, (v) => `${Math.round(v)} €`);
  assert.match(html, /Communes de la région/);
  assert.match(html, /833 €/); // 5 Md€ / 6 M habitants
  assert.match(html, /\+5 %/); // 871 contre 833
  assert.match(html, /\+9 %/); // 871 contre 800
});

test("la note dit de quelle nature est le repère", () => {
  assert.match(rendu(reperes(EUROS, "commune", "75", true), 871, String), /total des habitants/);
  assert.match(rendu(reperes(TAUX, "commune", "75", false), 20, String), /ne s'additionnent pas/);
});
