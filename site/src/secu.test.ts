/**
 * « La Sécu est-elle en déficit ? » : le bloc doit employer les mots de la
 * comptabilité nationale (capacité / besoin de financement, points de PIB) et
 * désamorcer la confusion avec le « trou de la Sécu » parlementaire — sinon il
 * fabrique la comparaison interdite au lieu de l'empêcher.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Indicateur, Territoire } from "./donnees.ts";
import { DEPENSES, RECETTES, SOLDE, points, rendu } from "./secu.ts";

const FINE = " ";

const CATALOGUE = [
  { id: DEPENSES, libelle: "Dépenses de la Sécurité sociale" },
  { id: RECETTES, libelle: "Recettes de la Sécurité sociale" },
  { id: SOLDE, libelle: "Solde de la Sécurité sociale" },
] as Indicateur[];

function territoire(series: Record<string, Record<string, number>>): Territoire {
  return { nom: "x", parent: null, population: null, drapeaux: {}, series };
}

const PAYS: Record<string, Territoire> = {
  FR: territoire({
    [DEPENSES]: { "2020": 28.5, "2024": 26.5, "2025": 26.8 },
    [RECETTES]: { "2020": 26.5, "2024": 26.5, "2025": 26.6 },
    [SOLDE]: { "2020": -2.1, "2024": 0.0, "2025": -0.2 },
  }),
  DE: territoire({
    [DEPENSES]: { "2025": 21.0 },
    [RECETTES]: { "2025": 20.9 },
    [SOLDE]: { "2025": 0.0 },
  }),
  EA20: territoire({ [DEPENSES]: { "2024": 21.5 } }),
};

test("le solde se lit signé, en points de PIB, chiffres tabulaires", () => {
  // Le signe est le moins typographique U+2212, jamais le trait d'union U+002D
  // que rend `Intl` : le bloc voisin écrit « −5,1 % », et deux signes de deux
  // largeurs pour la même soustraction se voient à l'écran. Écrit ici en
  // échappement pour que la différence reste lisible dans le test lui-même.
  assert.equal(points(-2.1), `\u22122,1${FINE}pt`);
  assert.equal(points(0.4), `+0,4${FINE}pt`);
  assert.equal(points(0), `0,0${FINE}pt`);
  assert.ok(!points(-2.1).includes("\u002D"), "aucun trait d'union ne doit rester");
});

test("l'année affichée est la dernière du solde français, et 2025 est déficitaire", () => {
  const html = rendu(PAYS, CATALOGUE);
  assert.match(html, /En 2025/);
  assert.match(html, /besoin de financement de 0,2/);
  assert.doesNotMatch(html, /capacité de financement/);
});

test("la comparaison porte les trois pays, et une valeur absente reste un tiret", () => {
  const html = rendu(PAYS, CATALOGUE);
  assert.match(html, /France/);
  assert.match(html, /Allemagne/);
  // EA20 n'a rien en 2025 : sa ligne dit « — » plutôt qu'un chiffre d'une
  // autre année, qui casserait la comparaison à périmètre et période égaux.
  assert.match(html, /Zone euro/);
  assert.match(html, /—/);
});

test("la série du solde est là, chronologique, avec l'année du choc Covid", () => {
  const html = rendu(PAYS, CATALOGUE);
  assert.match(html, new RegExp(`2020.*\u22122,1${FINE}pt`, "s"));
  assert.ok(html.indexOf("2020") < html.lastIndexOf("2025"));
});

test("aucune réserve qui s'excuse sous le tableau", () => {
  // Le paragraphe expliquait que ce solde n'est pas le « trou de la Sécu », que
  // le périmètre inclut l'assurance chômage, que cotisation et impôt diffèrent.
  // Trois mises en garde sous un tableau que le lecteur n'a pas encore lu.
  const html = rendu(PAYS, CATALOGUE);
  assert.doesNotMatch(html, /trou de la Sécu/);
  assert.doesNotMatch(html, /ne se comparent pas/);
  assert.doesNotMatch(html, /class="avertissement"/);
});

test("sans données françaises ou sans indicateur publié, le bloc ne s'affiche pas", () => {
  assert.equal(rendu({}, CATALOGUE), "");
  assert.equal(rendu(PAYS, [] as Indicateur[]), "");
  const sansSolde = { FR: territoire({ [DEPENSES]: { "2024": 26.5 } }) };
  assert.equal(rendu(sansSolde, CATALOGUE), "");
});
