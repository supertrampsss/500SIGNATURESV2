/**
 * Un repère mal choisi est pire que pas de repère : il fait croire à une
 * comparaison qui n'en est pas une.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { rapportAgrege, rendu, reperes, valeurDe, type Reference } from "./reference.ts";

const EUROS: Reference = {
  nature: "agregat",
  france: {
    n: 34772,
    mediane: 328_659,
    mediane_habitant: 749,
    total: 52_000_000_000,
    habitants: 65_000_000,
  },
  regions: {
    "75": {
      n: 1200,
      mediane: 410_000,
      mediane_habitant: 812,
      total: 5_000_000_000,
      habitants: 6_000_000,
    },
  },
};
const TAUX: Reference = {
  nature: "mediane",
  france: { n: 2482, mediane: 16.3 },
  regions: { "75": { n: 90, mediane: 14.1 } },
};

test("le repère est la médiane du dénominateur affiché", () => {
  // par habitant : la médiane des montants par habitant, pas celle des bruts
  assert.equal(valeurDe(EUROS.france, "agregat", true), 749);
  assert.equal(valeurDe(EUROS.france, "agregat", false), 328_659);
});

test("le rapport agrégé reste disponible, mais n'est pas le repère", () => {
  // 52 Md€ / 65 M habitants = 800 €, écrasé par les grandes villes
  assert.equal(rapportAgrege(EUROS.france), 800);
  assert.notEqual(valeurDe(EUROS.france, "agregat", true), rapportAgrege(EUROS.france));
});

test("un taux n'a pas de médiane par habitant : diviser un taux n'a pas de sens", () => {
  // `mediane_habitant` est absent pour ce genre de grandeur ; le repère reste
  // la médiane des taux, et ne devient pas nul parce qu'on regarde « par
  // habitant » — un affichage qui n'existe pas pour un taux.
  assert.equal(valeurDe(TAUX.france, "mediane", false), 16.3);
  assert.equal(valeurDe(TAUX.france, "mediane", true), 16.3);
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
  assert.match(html, /812 €/); // médiane des communes de la région
  assert.match(html, /\+7 %/); // 871 contre 812
  assert.match(html, /\+16 %/); // 871 contre 749
});

test("la note dit de quelle nature est le repère", () => {
  assert.match(rendu(reperes(EUROS, "commune", "75", true), 871, String), /la moitié se situe en dessous/);
  assert.match(rendu(reperes(TAUX, "commune", "75", false), 20, String), /ne s'additionnent pas/);
});
