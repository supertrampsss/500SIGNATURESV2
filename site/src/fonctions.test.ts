/**
 * « Combien pour la santé ? » ne se répond pas avec le budget de l'État. Ce
 * bloc porte sur toutes les administrations publiques, et doit le dire.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Indicateur, Territoire } from "./donnees.ts";
import { FONCTIONS, TOTAL, rendu } from "./fonctions.ts";

const FINE = " ";

function territoire(series: Record<string, Record<string, number>>): Territoire {
  return { nom: "", parent: null, population: null, drapeaux: {}, series };
}

const CATALOGUE = [
  { id: "eurostat_fonction_sante", libelle: "Santé" },
  { id: "eurostat_fonction_protection_sociale", libelle: "Protection sociale" },
  { id: "eurostat_fonction_defense", libelle: "Défense" },
] as Indicateur[];

const PAYS: Record<string, Territoire> = {
  FR: territoire({
    [TOTAL]: { "2023": 57.1, "2024": 57.3 },
    eurostat_fonction_protection_sociale: { "2024": 23.7 },
    eurostat_fonction_sante: { "2024": 8.9 },
    eurostat_fonction_defense: { "2024": 1.9 },
  }),
  DE: territoire({
    [TOTAL]: { "2024": 49.5 },
    eurostat_fonction_sante: { "2024": 8.6 },
    eurostat_fonction_protection_sociale: { "2024": 21.4 },
  }),
  EA20: territoire({
    [TOTAL]: { "2024": 49.8 },
    eurostat_fonction_sante: { "2024": 8.0 },
  }),
};

test("le total France est annoncé avec l'année et les points de comparaison", () => {
  const html = rendu(PAYS, CATALOGUE);
  assert.match(html, /En 2024/);
  assert.match(html, new RegExp(`57,3${FINE}% du produit intérieur brut`));
  assert.match(html, new RegExp(`Allemagne : 49,5${FINE}%`));
  assert.match(html, new RegExp(`Zone euro \\(20 pays\\) : 49,8${FINE}%`));
});

test("les fonctions sont triées par poids décroissant", () => {
  const html = rendu(PAYS, CATALOGUE);
  const protection = html.indexOf("Protection sociale");
  const sante = html.indexOf(">Santé<");
  const defense = html.indexOf(">Défense<");
  assert.ok(protection > 0 && protection < sante && sante < defense);
});

test("une valeur absente chez un voisin s'écrit — plutôt que zéro", () => {
  const html = rendu(PAYS, CATALOGUE);
  // la défense n'est renseignée ni pour DE ni pour EA20 dans ce jeu d'essai
  assert.match(html, /Défense<\/th>[\s\S]{0,400}<td>—<\/td>[\s\S]{0,60}<td>—<\/td>/);
});

test("aucune réserve qui s'excuse sous le tableau", () => {
  const html = rendu(PAYS, CATALOGUE);
  assert.doesNotMatch(html, /class="avertissement"/);
  assert.doesNotMatch(html, /efficacité de la dépense/);
});

test("sans donnée France, le bloc ne s'affiche pas du tout", () => {
  assert.equal(rendu({}, CATALOGUE), "");
});

test("les dix fonctions sont déclarées et distinctes", () => {
  assert.equal(new Set(FONCTIONS).size, 10);
});
