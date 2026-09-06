/**
 * « Combien pour la santé ? » ne se répond pas avec le budget de l'État. Ce
 * bloc porte sur toutes les administrations publiques, et doit le dire.
 *
 * Trois propriétés se vérifient ici et nulle part ailleurs : la décomposition
 * se referme sur son total ou disparaît, l'évolution se dit en points de PIB,
 * et le dénominateur annoncé est bien le PIB — le bloc voisin, dans le même
 * chapitre, rapporte les mêmes dépenses aux recettes, et rien ne distingue
 * mécaniquement les deux sauf ce qui est écrit.
 *
 * Les valeurs des fixtures sont celles d'Eurostat pour 2013 et 2024, telles
 * que le site les publie — jamais des arrondis commodes. La somme des dix
 * fonctions vaut 57,2 quand le total publié vaut 57,3 : cet écart-là est celui
 * des arrondis d'Eurostat, et le bloc doit le tolérer.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Indicateur, Territoire } from "./donnees.ts";
import { FONCTIONS, TOTAL, rendu } from "./fonctions.ts";

// L'espace fine insécable U+202F, celle qu'`Intl` met dans « 57,3 % » — écrite
// en échappement parce qu'elle est indiscernable d'une espace ordinaire dans un
// extrait, et que c'est exactement ce qui a fait échouer la réécriture de ce
// fichier. Même piège, même parade que dans `mission.test.ts`.
const FINE = "\u202f";

function territoire(series: Record<string, Record<string, number>>): Territoire {
  return { nom: "", parent: null, population: null, drapeaux: {}, series };
}

const CATALOGUE = [
  { id: "eurostat_fonction_protection_sociale", libelle: "Protection sociale" },
  { id: "eurostat_fonction_sante", libelle: "Santé" },
  { id: "eurostat_fonction_services_generaux", libelle: "Services généraux" },
  { id: "eurostat_fonction_affaires_economiques", libelle: "Affaires économiques" },
  { id: "eurostat_fonction_enseignement", libelle: "Enseignement" },
  { id: "eurostat_fonction_ordre_securite", libelle: "Ordre et sécurité" },
  { id: "eurostat_fonction_defense", libelle: "Défense" },
  { id: "eurostat_fonction_culture", libelle: "Loisirs, culture et culte" },
  { id: "eurostat_fonction_logement", libelle: "Logement et équipements collectifs" },
  { id: "eurostat_fonction_environnement", libelle: "Protection de l'environnement" },
] as Indicateur[];

/** Les dix fonctions françaises, 2013 et 2024, aux valeurs publiées. */
const FRANCE: Record<string, Record<string, number>> = {
  [TOTAL]: { "2013": 58.6, "2024": 57.3 },
  eurostat_fonction_protection_sociale: { "2013": 24.4, "2024": 23.7 },
  eurostat_fonction_sante: { "2013": 8.2, "2024": 8.9 },
  eurostat_fonction_services_generaux: { "2013": 7.2, "2024": 6.2 },
  eurostat_fonction_affaires_economiques: { "2013": 6.0, "2024": 5.7 },
  eurostat_fonction_enseignement: { "2013": 5.3, "2024": 5.1 },
  eurostat_fonction_defense: { "2013": 1.8, "2024": 1.9 },
  eurostat_fonction_ordre_securite: { "2013": 1.6, "2024": 1.8 },
  eurostat_fonction_culture: { "2013": 1.6, "2024": 1.5 },
  eurostat_fonction_logement: { "2013": 1.3, "2024": 1.4 },
  eurostat_fonction_environnement: { "2013": 1.0, "2024": 1.0 },
};

const PAYS: Record<string, Territoire> = {
  FR: territoire(FRANCE),
  // Les voisins ne portent que trois fonctions : c'est le cas réel d'une
  // publication partielle, et le tableau doit écrire le manque plutôt que
  // d'afficher zéro.
  DE: territoire({
    [TOTAL]: { "2024": 49.4 },
    eurostat_fonction_protection_sociale: { "2024": 20.4 },
    eurostat_fonction_sante: { "2024": 7.6 },
  }),
  EA20: territoire({
    [TOTAL]: { "2024": 49.4 },
    eurostat_fonction_sante: { "2024": 7.5 },
  }),
};

const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

test("le total France est annoncé avec l'année et les points de comparaison", () => {
  const html = rendu(PAYS, CATALOGUE);
  assert.match(html, /2024/);
  assert.match(html, new RegExp(`57,3${FINE}% du PIB`));
  assert.match(html, new RegExp(`Allemagne : 49,4${FINE}%`));
  assert.match(html, new RegExp(`Zone euro \\(20 pays\\) : 49,4${FINE}%`));
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
  // La défense n'est renseignée ni pour DE ni pour EA20 dans ce jeu d'essai.
  assert.match(html, /Défense[\s\S]{0,600}<td>—<\/td>[\s\S]{0,60}<td>—<\/td>/);
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

test("une décomposition qui ne se referme pas sur son total ne s'affiche pas", () => {
  // C'est la garantie centrale du bloc : dix parts dont la somme ne retombe
  // pas sur la dépense totale publiée décrivent deux exercices différents, et
  // le lecteur additionnerait des nombres qui ne s'additionnent pas.
  const faux = { ...FRANCE, [TOTAL]: { "2013": 58.6, "2024": 71.0 } };
  assert.equal(rendu({ ...PAYS, FR: territoire(faux) }, CATALOGUE), "");
  // L'écart d'arrondi réel — 57,2 contre 57,3 — reste, lui, toléré.
  assert.notEqual(rendu(PAYS, CATALOGUE), "");
});

test("une seule fonction manquante efface le bloc", () => {
  // Neuf fonctions sur dix ne se somment plus au total : la décomposition
  // afficherait un trou sans le dire. C'est ce qui arrivait avant — le bloc
  // rendait ce qu'il avait, et sa barre rapportait chaque part à un total
  // qu'elle ne recouvrait pas.
  const { eurostat_fonction_defense: _retiree, ...neuf } = FRANCE;
  assert.equal(rendu({ ...PAYS, FR: territoire(neuf) }, CATALOGUE), "");
});

test("l'évolution se dit en points de PIB, jamais en pourcents", () => {
  const html = rendu(PAYS, CATALOGUE);
  const ecarts = [...html.matchAll(/class="evolution">([^<]*)</g)].map((m) => m[1]!.trim());
  // Dix lignes, plus l'en-tête de colonne qui ne porte pas de nombre.
  const nombres = ecarts.filter((e) => e && !/Depuis/.test(e));
  assert.equal(nombres.length, 10);
  // 23,7 − 24,4 = −0,7 point. Une lecture en pourcents aurait dit −2,9 %.
  assert.equal(nombres[0], "−0,7");
  // 8,9 − 8,2 = +0,7 point pour la santé, deuxième au classement.
  assert.equal(nombres[1], "+0,7");
  // L'environnement ne bouge pas : « = » plutôt qu'un « +0,0 » qui se lirait
  // comme une hausse minuscule.
  assert.equal(nombres[9], "=");
  for (const n of nombres) assert.doesNotMatch(n, /%/, `« ${n} » porte un pourcent`);
  assert.match(html, /Depuis 2013/);
  assert.doesNotMatch(texte(html), /écart avec 2013, en points de PIB/);
});

test("un seul exercice publié retire la colonne d'évolution sans effacer le bloc", () => {
  // Le départ et l'arrivée seraient le même exercice : la colonne vaudrait
  // « = » dix fois, ce qui se lirait comme une structure figée. Le tableau
  // reste, sans elle.
  const unSeul = Object.fromEntries(
    Object.entries(FRANCE).map(([cle, serie]) => [cle, { "2024": serie["2024"]! }]),
  );
  const html = rendu({ ...PAYS, FR: territoire(unSeul) }, CATALOGUE);
  assert.notEqual(html, "");
  assert.doesNotMatch(html, /class="evolution"/);
});

test("la note sous le tableau ne répète plus son unité et ne garde que la source", () => {
  const lu = texte(rendu(PAYS, CATALOGUE));
  assert.doesNotMatch(lu, /pourcentage du produit intérieur brut, pas des recettes/);
  assert.match(lu, /Même définition et même année · Eurostat$/);
});

test("chaque fonction porte une glose qui dit ce qu'elle contient", () => {
  // « Services généraux » est le nom officiel et ne dit rien à personne —
  // c'est pourtant là que vit la charge de la dette, que le lecteur cherche
  // ailleurs.
  const html = rendu(PAYS, CATALOGUE);
  assert.equal([...html.matchAll(/class="fonction__glose"/g)].length, 10);
  assert.match(html, /la charge de la dette/);
});
