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

test("chaque exercice publié a sa colonne, et une absence reste vide", () => {
  const liste = rubriques(BORDEAUX, CATALOGUE, LIBELLES, ["finances_locales", "population"]);
  const finances = liste.find((r) => r.theme === "finances_locales")!;
  // Les colonnes du thème sont l'union de ses exercices, du plus ancien au plus
  // récent : sans quoi une série plus courte effacerait la colonne des autres.
  assert.deepEqual(finances.exercices, ["2024", "2025"]);
  const depenses = finances.lignes.find((l) => l.id === "ofgl_depenses_fonctionnement")!;
  assert.deepEqual(depenses.valeurs, {
    "2024": "361,9 M€",
    "2025": "369,0 M€",
  });
  // L'encours n'a que 2025 : sa cellule 2024 reste vide, et l'absence se voit.
  const dette = finances.lignes.find((l) => l.id === "ofgl_encours_dette")!;
  assert.equal(dette.valeurs["2024"], undefined);
  assert.equal(dette.valeurs["2025"], "413,0 M€");
  // La population est d'un autre millésime : le thème a ses propres colonnes.
  const population = liste.find((r) => r.theme === "population")!;
  assert.deepEqual(population.exercices, ["2023"]);
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

test("les crédits des missions sortent de la liste et gardent leurs colonnes", () => {
  // Le thème « Budget de l'État » alignait 81 lignes pour la France, dont 66
  // pour les missions : 33 missions × 2 montants, empilés au même niveau. Ce
  // sont deux colonnes, pas soixante-six lignes — et le reste du thème, lui,
  // ne bouge pas.
  const catalogue = [
    { id: "etat_depenses_nettes_bg", libelle: "Dépenses nettes du budget général",
      theme: "budget_etat", unite: "EUR" },
    { id: "etat_mission_defense_credits_votes", libelle: "Défense (crédits votés)",
      theme: "budget_etat", unite: "EUR" },
    { id: "etat_mission_defense_credits_consommes", libelle: "Défense (crédits consommés)",
      theme: "budget_etat", unite: "EUR" },
  ] as never[];
  const france = {
    nom: "France",
    series: {
      etat_depenses_nettes_bg: { "2019": 337_000_000_000, "2025": 441_194_000_000 },
      // Les missions publient un exercice — 2024 — que l'agrégat n'a pas :
      // c'est lui qui doit disparaître des colonnes du tableau ordinaire une
      // fois les missions parties.
      etat_mission_defense_credits_votes: { "2024": 47_178_000_000, "2025": 59_946_000_000 },
      etat_mission_defense_credits_consommes: { "2024": 48_000_000_000, "2025": 62_124_000_000 },
    },
  } as never;
  const liste = rubriques(france, catalogue, { budget_etat: "Budget de l'État" });
  // Le compte de la page reste celui des séries publiées : trois indicateurs
  // sont renseignés, et les remettre en colonnes n'en supprime aucun.
  assert.equal(total(liste), 3);
  const html = rendu("France", liste);
  // Une seule ligne de corps dans le tableau ordinaire — l'agrégat —, et une
  // seule pour la mission dans le tableau des crédits.
  assert.equal(html.match(/<tr><th scope="row">/g)?.length, 2);
  assert.match(html, /<th scope="row">Dépenses nettes du budget général<\/th>/);
  assert.match(html, /<th scope="row">Défense<\/th>/);
  // Les colonnes du tableau ordinaire se recalculent sur ce qui y reste : la
  // fenêtre 2019-2025 de l'agrégat est intacte, et aucune colonne fantôme n'est
  // laissée par les missions parties.
  assert.match(html, /<th scope="col">Indicateur<\/th><th scope="col">2019<\/th><th scope="col">2025<\/th><\/tr>/);
});

test("un thème sans mission garde exactement le tableau qu'il avait", () => {
  // Plier une liste de trois lignes la rend moins lisible, pas plus : seize
  // thèmes sur dix-sept n'ont rien à condenser, et rien ne doit leur arriver.
  const html = rendu("Bordeaux", rubriques(BORDEAUX, CATALOGUE, LIBELLES));
  assert.doesNotMatch(html, /credits__|<details/);
  assert.equal(html.match(/<tr><th scope="row">/g)?.length, 3);
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
