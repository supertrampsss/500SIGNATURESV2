/**
 * Le comparateur est l'endroit où une erreur de méthode devient un argument
 * politique. Ces tests portent sur ses refus autant que sur son affichage.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Indicateur, Territoire } from "./donnees.ts";
import { type Entree, refus, rendu, reserves } from "./comparateur.ts";

const INDICATEURS = [
  {
    id: "ofgl_depenses_fonctionnement",
    libelle: "Dépenses de fonctionnement",
    unite: "EUR",
  },
] as Indicateur[];

function territoire(nom: string, population: number | null, valeur?: number): Territoire {
  return {
    nom,
    parent: "33",
    population,
    drapeaux: {},
    series: valeur === undefined ? {} : { ofgl_depenses_fonctionnement: { "2024": valeur } },
  };
}

const PESSAC: Entree = {
  code: "33318",
  niveau: "commune",
  territoire: territoire("Pessac", 67_339, 58_500_000),
};
const BORDEAUX: Entree = {
  code: "33063",
  niveau: "commune",
  territoire: territoire("Bordeaux", 261_804, 380_000_000),
};

test("deux niveaux différents : refus motivé, pas un tableau douteux", () => {
  const gironde: Entree = {
    code: "33",
    niveau: "departement",
    territoire: territoire("Gironde", 1_600_000, 1_900_000_000),
  };
  assert.match(refus([PESSAC, gironde]), /communes et départements/);
  assert.match(rendu([PESSAC, gironde], INDICATEURS, "2024", true), /Comparaison impossible/);
  assert.equal(refus([PESSAC, BORDEAUX]), "");
});

test("moins de deux territoires : une invitation, pas un tableau vide", () => {
  const html = rendu([PESSAC], INDICATEURS, "2024", true);
  assert.match(html, /Ajoutez au moins deux territoires/);
  assert.doesNotMatch(html, /<table/);
});

test("une valeur manquante s'écrit, elle ne se remplit pas par un zéro", () => {
  const sansDonnee: Entree = {
    code: "33999",
    niveau: "commune",
    territoire: territoire("Sans données", 1_200),
  };
  const html = rendu([PESSAC, sansDonnee], INDICATEURS, "2024", true);
  assert.match(html, /donnée non disponible/);
  assert.doesNotMatch(html, />0\s?€</);
});

test("sans population, le montant par habitant n'est pas inventé", () => {
  const inconnue: Entree = {
    code: "33998",
    niveau: "commune",
    territoire: territoire("Population inconnue", null, 4_000_000),
  };
  assert.match(rendu([PESSAC, inconnue], INDICATEURS, "2024", true), /population inconnue/);
  // en montants totaux, la valeur reste affichable
  assert.match(rendu([PESSAC, inconnue], INDICATEURS, "2024", false), /4,0\s?M€/);
});

test("les compétences hors norme sont signalées", () => {
  const lyon: Entree = {
    code: "691",
    niveau: "departement",
    territoire: {
      ...territoire("Métropole de Lyon", 1_400_000, 1),
      drapeaux: { statut_particulier: true },
    },
  };
  assert.ok(reserves([lyon]).some((n) => /statut particulier/.test(n)));
});

test("l'écart de dépenses n'est jamais présenté comme un écart de gestion", () => {
  const html = rendu([PESSAC, BORDEAUX], INDICATEURS, "2024", true);
  assert.match(html, /n&#39;est pas un écart de gestion/);
  assert.match(html, /intercommunalité/);
});

test("l'unité et la période accompagnent le tableau", () => {
  assert.match(rendu([PESSAC, BORDEAUX], INDICATEURS, "2024", true), /2024, montants par habitant/);
  assert.match(rendu([PESSAC, BORDEAUX], INDICATEURS, "2024", false), /2024, montants totaux/);
});

test("la population saisonnière est toujours signalée", () => {
  const notes = reserves([{ code: "33009", territoire: territoire("Arcachon", 11_000, 1) }]);
  assert.ok(notes.some((n) => /touristique/.test(n)), JSON.stringify(notes));
});
