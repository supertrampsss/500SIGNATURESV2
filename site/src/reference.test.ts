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
    "la médiane des communes de la région",
    "la médiane des communes de France",
  ]);
});

test("une région n'a pas la région pour repère : ce serait une tautologie", () => {
  const liste = reperes(EUROS, "region", "75", true);
  assert.deepEqual(liste.map((r) => r.libelle), ["la médiane des régions de France"]);
});

test("un territoire sans région connue garde le repère national", () => {
  assert.deepEqual(reperes(EUROS, "commune", null, true).map((r) => r.libelle), [
    "la médiane des communes de France",
  ]);
});

test("une référence absente ne produit rien plutôt qu'un zéro", () => {
  assert.deepEqual(reperes(undefined, "commune", "75", true), []);
});

test("l'écart au repère est affiché, avec son signe", () => {
  const html = rendu(reperes(EUROS, "commune", "75", true), 871, (v) => `${Math.round(v)} €`);
  assert.match(html, /la médiane des communes de la région/);
  assert.match(html, /812 €/); // médiane des communes de la région
  assert.match(html, /\+7 %/); // 871 contre 812
  assert.match(html, /\+16 %/); // 871 contre 749
});

test("le repère nomme la médiane, sans répéter la phrase qui l'explique", () => {
  // Sept indicateurs sur une fiche, c'était sept fois la même explication.
  // Le libellé porte désormais le mot « médiane » — c'est lui qui informe —
  // et la phrase longue (« la moitié se situe en dessous ») reste dite une
  // seule fois, dans « Sources et méthode ».
  const html = rendu(reperes(EUROS, "commune", "75", true), 871, String);
  const visible = html.replace(/title="[^"]*"/g, "");
  assert.match(visible, /la médiane des communes de la région/);
  assert.doesNotMatch(visible, /moitié/i);
});

test("une publication sans médiane par habitant ne sert pas la médiane brute", () => {
  /*
   * Le champ `mediane_habitant` est apparu le 2 août. Une publication
   * antérieure n'en a pas : replier sur `mediane` mettrait 328 659 € en face
   * d'une commune à 871 €. Mieux vaut aucun repère qu'un repère faux.
   */
  const ancien = { n: 10, mediane: 328_659, total: 1, habitants: 1 };
  assert.equal(valeurDe(ancien, "agregat", true), null);
  assert.equal(valeurDe(ancien, "agregat", false), 328_659);
  // pour un taux, l'absence est normale et la médiane brute reste le repère
  assert.equal(valeurDe({ n: 10, mediane: 16.3 }, "mediane", true), 16.3);
});

test("au niveau national, l'ensemble de référence est celui des pays comparés", () => {
  // « Pays de France » n'aurait aucun sens.
  const monde: Reference = {
    nature: "mediane",
    france: { n: 6, mediane: 100.7 },
    regions: {},
  };
  const liste = reperes(monde, "pays", null, false);
  assert.deepEqual(liste.map((r) => r.libelle), ["la médiane des pays comparés"]);
  assert.equal(liste[0].valeur, 100.7);
  assert.equal(liste[0].n, 6);
});


test("un repère d'un seul territoire est la France comparée à elle-même", () => {
  /*
   * Douze indicateurs nationaux ne portent que sur la France : `n` vaut 1, et
   * le repère affichait la valeur de la France avec un écart de +0 %. C'est la
   * tautologie déjà écartée pour les régions, revenue par la porte des pays.
   */
  const seul: Reference = {
    nature: "mediane",
    france: { n: 1, mediane: 117.5 },
    regions: {},
  };
  assert.deepEqual(reperes(seul, "pays", null, false), []);
});

test("le nombre de territoires comparés reste dit, en infobulle", () => {
  // Une médiane sur 31 pays et une médiane sur 3 ne se lisent pas pareil.
  // Le nombre vivait entre parenthèses sur chaque ligne — du bruit ; il est
  // désormais dit au survol, mais toujours dit.
  const html = rendu(reperes(EUROS, "commune", "75", true), 871, String);
  assert.match(html, /Médiane calculée sur 1200 territoires/);
  assert.match(html, /Médiane calculée sur 34772 territoires/);
});
