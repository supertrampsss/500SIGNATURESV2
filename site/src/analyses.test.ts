/**
 * La page ANALYSES : tout ce que le site sait d'un territoire.
 *
 * Trois choses s'y jouent, et chacune a son test. Le dernier exercice de chaque
 * indicateur — les jeux n'ont pas le même calendrier, et poser 2023 à côté de
 * 2025 sans le dire ferait croire à une même photographie. Les montants en
 * millions d'euros, avec deux décimales sous le million pour qu'un budget de
 * 340 000 € ne s'affiche pas « 0 M€ ». Et rien d'inventé : un indicateur sans
 * valeur ne produit pas de ligne à zéro.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { rubriques, rendu, total, valeurLisible } from "./analyses.ts";
import { millions } from "./echelle.ts";

const CATALOGUE = [
  { id: "ofgl_depenses_fonctionnement", libelle: "Dépenses de fonctionnement",
    theme: "finances_locales", unite: "EUR" },
  { id: "ofgl_encours_dette", libelle: "Encours de dette", theme: "finances_locales",
    unite: "EUR" },
  { id: "insee_population_municipale", libelle: "Population", theme: "population",
    unite: "count" },
  { id: "jamais_charge", libelle: "Rien ici", theme: "population", unite: "count" },
] as never[];

const LIBELLES = { finances_locales: "Finances locales", population: "Population" };

const BORDEAUX = {
  nom: "Bordeaux",
  series: {
    ofgl_depenses_fonctionnement: { "2024": 361_939_919, "2025": 369_011_621 },
    ofgl_encours_dette: { "2025": 413_000_000 },
    insee_population_municipale: { "2023": 267_991 },
  },
} as never;

test("chaque indicateur montre son dernier exercice, et l'année est écrite", () => {
  const liste = rubriques(BORDEAUX, CATALOGUE, LIBELLES, ["finances_locales", "population"]);
  const finances = liste.find((r) => r.theme === "finances_locales")!;
  const depenses = finances.lignes.find((l) => l.id === "ofgl_depenses_fonctionnement")!;
  assert.equal(depenses.periode, "2025");
  assert.equal(depenses.valeur, "369,0 M€");
  // La population est d'un autre millésime, et la page le dit plutôt que de
  // laisser croire à une photographie commune.
  const pop = liste.find((r) => r.theme === "population")!.lignes[0];
  assert.equal(pop.periode, "2023");
});

test("un indicateur sans valeur ne produit pas de ligne", () => {
  const liste = rubriques(BORDEAUX, CATALOGUE, LIBELLES);
  const ids = liste.flatMap((r) => r.lignes.map((l) => l.id));
  assert.ok(!ids.includes("jamais_charge"));
  assert.equal(total(liste), 3);
});

test("les montants sont en millions, et un petit budget ne s'efface pas", () => {
  assert.equal(millions(369_011_621), "369,0 M€");
  assert.equal(millions(1_400_000), "1,4 M€");
  // 340 000 € afficherait « 0 M€ » sans les deux décimales : le montant
  // disparaîtrait de la page en paraissant nul.
  assert.equal(millions(340_000), "0,34 M€");
  // L'espace des milliers est une fine insécable, pas une espace ordinaire :
  // on compare les chiffres, pas la typographie.
  assert.match(millions(8_641_730_000), /^8.642\u202fM€$/);
});

test("les taux et les comptages gardent leur unité", () => {
  assert.equal(valeurLisible(18.9, "percent"), "18,9 %");
  assert.match(valeurLisible(267_991, "count"), /^267.991$/);
  assert.equal(valeurLisible(8.58, "ans"), "8,6 ans");
});

test("les thèmes suivent l'ordre de la fiche, pas l'ordre du catalogue", () => {
  const liste = rubriques(BORDEAUX, CATALOGUE, LIBELLES, ["population", "finances_locales"]);
  assert.deepEqual(liste.map((r) => r.theme), ["population", "finances_locales"]);
});

test("un territoire sans donnée le dit plutôt que d'afficher une page vide", () => {
  const html = rendu("Nulle part", []);
  assert.match(html, /Aucune donnée publiée pour Nulle part/);
});

test("la page annonce ce qu'elle contient et d'où viennent les années", () => {
  const html = rendu("Bordeaux", rubriques(BORDEAUX, CATALOGUE, LIBELLES));
  assert.match(html, /3 indicateurs renseignés, 2 thèmes/);
  assert.match(html, /pas\s+tous le même calendrier/);
  assert.match(html, /369,0\u202fM€/);
});

test("chaque thème publié a un libellé lisible", () => {
  // La page ANALYSES est la seule à montrer TOUS les thèmes : un thème sans
  // libellé y sort en identifiant brut — « vie_associative » s'est affiché tel
  // quel à la première mise en ligne. Le rendu ne masque pas l'oubli, il le
  // rend visible ; ce test le rend visible plus tôt.
  const catalogue = [
    { id: "x", libelle: "X", theme: "inconnu_au_bataillon", unite: "count" },
  ] as never[];
  const territoire = { nom: "T", series: { x: { "2025": 1 } } } as never;
  const liste = rubriques(territoire, catalogue, {});
  assert.equal(liste[0].libelle, "inconnu_au_bataillon");
});
