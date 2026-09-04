/**
 * « La Sécu est-elle en déficit ? » : le bloc emploie les mots de la
 * comptabilité nationale, répond à sa propre question, et montre le solde
 * comme l'écart entre deux lignes — recettes et dépenses, un exercice par
 * colonne (maquette 4.5 de la shortlist validée).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Indicateur, Territoire } from "./donnees.ts";
import { DEPENSES, RECETTES, SOLDE, points, rendu } from "./secu.ts";

const FINE = "\u202f";

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
    [DEPENSES]: { "2020": 28.5, "2022": 27.0, "2024": 26.5, "2025": 26.8 },
    [RECETTES]: { "2020": 26.5, "2022": 27.3, "2024": 26.5, "2025": 26.6 },
    [SOLDE]: { "2020": -2.1, "2022": 0.3, "2024": 0.0, "2025": -0.2 },
  }),
};

test("le solde se lit signé, en % du PIB, chiffres tabulaires", () => {
  // Il s'écrivait « pt », et c'était une sur-application de la règle des
  // points : elle vaut pour la VARIATION d'un taux dans le temps, pas pour un
  // niveau. Le solde est recettes moins dépenses d'une même année — de la
  // même nature que le déficit public que le site écrit « −5,1 % ».
  //
  // Le signe est le moins typographique U+2212, jamais le trait d'union U+002D
  // que rend `Intl`.
  assert.equal(points(-2.1), `−2,1${FINE}%`);
  assert.equal(points(0.4), `+0,4${FINE}%`);
  assert.equal(points(0), `0,0${FINE}%`);
  assert.ok(!points(-2.1).includes("-"), "aucun trait d'union ne doit rester");
});

test("la question du titre reçoit sa réponse, avec les choses nommées", () => {
  // « Il lui manque donc 0,2 % » ne nommait rien, et le lecteur l'a refusé :
  // la réponse est Oui ou Non, les recettes et les dépenses sont signées, et
  // le déficit est écrit en euros — sans qualificatif : le chiffre parle seul.
  const html = rendu(PAYS, CATALOGUE);
  assert.match(html, /En 2025/);
  assert.match(html, /<strong>Oui\.<\/strong>/);
  assert.match(html, /dépensé l'équivalent de\s*<strong>26,8/);
  assert.match(html, /encaissé\s*<strong>26,6/);
  const reponse = html.match(/<p class="bloc__complement">([\s\S]*?)<\/p>/)?.[1] ?? "";
  assert.doesNotMatch(reponse, /flux--moins|flux--plus|−26,8|\+26,6/);
  assert.doesNotMatch(html, /besoin de financement/);
  assert.doesNotMatch(html, /léger/i);
});

test("un exercice par colonne, en ordre, et le solde est l'écart entre deux lignes", () => {
  // La maquette validée montre la série année par année — le choc de 2020 se
  // lit dans la ligne du solde, pas dans un chiffre isolé.
  const html = rendu(PAYS, CATALOGUE);
  const tetes = [...html.matchAll(/<th scope="col">(\d{4})<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(tetes, ["2020", "2022", "2024", "2025"]);
  assert.match(html, new RegExp(`−2,1${FINE}%`));
  assert.ok(html.indexOf("Recettes") < html.indexOf("Dépenses"));
  assert.ok(html.indexOf("Dépenses") < html.indexOf("Solde"));
});

test("une année dont le détail manque garde sa colonne, en tirets", () => {
  // Le solde de 2019 est publié sans ses recettes ni ses dépenses : la
  // colonne reste, en « — » — un chiffre d'une autre année à sa place
  // casserait la lecture ligne à ligne.
  const troue = {
    FR: territoire({
      [DEPENSES]: { "2025": 26.8 },
      [RECETTES]: { "2025": 26.6 },
      [SOLDE]: { "2019": 0.5, "2025": -0.2 },
    }),
  };
  const html = rendu(troue, CATALOGUE);
  assert.match(html, /<th scope="col">2019<\/th>/);
  assert.match(html, /—/);
});

test("les colonnes comparées gardent leur décimale, même sur un compte rond", () => {
  // Les dépenses de 2022 valent exactement 27,0 % du PIB. Sans décimale
  // imposée, `Intl` la laissait tomber et la ligne lisait « 27 » entre
  // « 28,5 » et « 26,5 » — trois formats sur une ligne qu'on vient
  // précisément lire d'une année à l'autre.
  const html = rendu(PAYS, CATALOGUE);
  assert.match(html, new RegExp(`−27,0${FINE}%`));
  assert.doesNotMatch(html, new RegExp(`−27${FINE}%`));
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

test("le bloc ne porte que la maquette validée : ni comparaison de pays, ni 100 €", () => {
  // Deux moitiés ont vécu ici et la maquette validée ne les montre pas : le
  // tableau France / Allemagne / zone euro, et « 100 € de prestations
  // sociales ». Un chapitre porte
  // exactement les blocs de sa maquette.
  const html = rendu(PAYS, CATALOGUE);
  assert.doesNotMatch(html, /Allemagne|Zone euro/);
  assert.doesNotMatch(html, /prestations sociales, où vont-ils/);
});

test("sans données françaises ou sans indicateur publié, le bloc ne s'affiche pas", () => {
  assert.equal(rendu({}, CATALOGUE), "");
  assert.equal(rendu(PAYS, [] as Indicateur[]), "");
  const sansSolde = { FR: territoire({ [DEPENSES]: { "2024": 26.5 } }) };
  assert.equal(rendu(sansSolde, CATALOGUE), "");
});
