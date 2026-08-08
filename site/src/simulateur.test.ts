/**
 * Le simulateur promet une chose : que le chiffre affiché soit celui qu'on
 * obtiendrait en refaisant l'addition à la main. Tout le reste (l'arbre, la
 * recherche, les défis) est du confort ; l'arithmétique, elle, ne peut pas se
 * tromper sans que la promesse tombe.
 *
 * Ces tests couvrent donc d'abord les deux principes du module — un réglage
 * est un coefficient qui se compose, un total est toujours la somme de ses
 * feuilles — puis ce qui rend un budget partageable et lisible.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  base,
  decoder,
  defis,
  ecartAuReel,
  encoder,
  equivalence,
  chercher,
  impact,
  indexer,
  missionTouchee,
  net,
  plan,
  programmes,
  regler,
  totaux,
  type Budget,
  type Reglages,
} from "./simulateur.ts";

/**
 * Un budget minuscule mais complet : deux missions, une hiérarchie à quatre
 * niveaux d'un côté, deux niveaux de l'autre, et les deux familles de recettes
 * (encaissée, déduite). Les `v` des nœuds intermédiaires sont volontairement
 * faux (zéro) : le module ne doit jamais les lire.
 */
const BUDGET: Budget = {
  exercice: "2025",
  loi: "PLF",
  mesure: "credit_de_paiement",
  unite: "EUR",
  depenses: [
    {
      c: "DA",
      l: "Défense",
      v: 0,
      enfants: [
        {
          c: "146",
          l: "Équipement des forces",
          v: 0,
          enfants: [
            {
              c: "146-09",
              l: "Engagement et combat",
              v: 0,
              enfants: [
                { c: "146-09-63", l: "Frapper à distance — porte-avions", v: 100_000_000 },
                { c: "146-09-64", l: "Frapper au contact", v: 900_000_000 },
              ],
            },
          ],
        },
        { c: "178", l: "Préparation et emploi des forces", v: 4_000_000_000 },
      ],
    },
    {
      c: "IA",
      l: "Enseignement scolaire",
      v: 0,
      enfants: [{ c: "140", l: "Enseignement public du premier degré", v: 20_000_000_000 }],
    },
  ],
  recettes: [
    {
      t: "Recettes fiscales",
      signe: 1,
      lignes: [
        { c: "1301", l: "Impôt sur les sociétés", v: 30_000_000_000 },
        { c: "1401", l: "Taxe sur la valeur ajoutée", v: 10_000_000_000 },
      ],
    },
    {
      t: "Prélèvement au profit de l'Union européenne",
      signe: -1,
      lignes: [{ c: "9001", l: "Prélèvement européen", v: 5_000_000_000 }],
    },
  ],
};

const INDEX = indexer(BUDGET);
const DEPENSES_REELLES = 25_000_000_000;
const RECETTES_REELLES = 35_000_000_000;

function reglages(...paires: [string, number][]): Reglages {
  const table: Reglages = new Map();
  for (const [code, valeur] of paires) regler(table, code, valeur);
  return table;
}

test("le montant d'un nœud est la somme de ses feuilles, jamais son `v` publié", () => {
  // `v` vaut 0 sur les trois nœuds intermédiaires de la Défense.
  assert.equal(base(BUDGET.depenses[0]), 5_000_000_000);
  assert.equal(INDEX.get("DA")?.base, 5_000_000_000);
  assert.equal(INDEX.get("146")?.base, 1_000_000_000);
});

test("le budget de départ est la somme exacte de ses lignes", () => {
  const t = totaux(BUDGET, new Map());
  assert.equal(t.depenses, DEPENSES_REELLES);
  // Les prélèvements se déduisent : 30 + 10 − 5.
  assert.equal(t.recettes, RECETTES_REELLES);
  assert.equal(t.solde, 10_000_000_000);
  assert.equal(ecartAuReel(BUDGET, new Map()), 0);
});

test("les réglages se composent au lieu de se remplacer", () => {
  // La promesse produit : « je coupe la Défense de 10 %, mais je protège le
  // porte-avions ». La feuille doit valoir 0,90 × 1,50 fois sa base.
  const table = reglages(["DA", -10], ["146-09-63", 50]);
  const porteAvions = INDEX.get("146-09-63");
  assert.ok(porteAvions);
  assert.equal(impact(porteAvions, table).montant, 100_000_000 * 0.9 * 1.5);

  // Et la mission entière tient compte des deux : 0,90 × (4,9 Md + 0,15 Md).
  const defense = INDEX.get("DA");
  assert.ok(defense);
  assert.equal(impact(defense, table).montant, 0.9 * (4_900_000_000 + 150_000_000));
});

test("baisser une dépense améliore le solde, baisser une recette le dégrade", () => {
  const depense = INDEX.get("140");
  const recette = INDEX.get("r1301");
  assert.ok(depense && recette);

  const coupe = impact(depense, reglages(["140", -50]));
  assert.equal(coupe.delta, -10_000_000_000);
  assert.equal(coupe.surSolde, 10_000_000_000);

  const baisse = impact(recette, reglages(["r1301", -50]));
  assert.equal(baisse.delta, -15_000_000_000);
  assert.equal(baisse.surSolde, -15_000_000_000);
});

test("un prélèvement sur recettes qui monte fait baisser les recettes nettes", () => {
  // Le piège du signe : la ligne grossit, mais elle se déduit.
  const table = reglages(["r9001", 100]);
  assert.equal(totaux(BUDGET, table).recettes, RECETTES_REELLES - 5_000_000_000);
  assert.equal(ecartAuReel(BUDGET, table), -5_000_000_000);

  const prelevement = INDEX.get("r9001");
  assert.ok(prelevement);
  assert.equal(impact(prelevement, table).surSolde, -5_000_000_000);
});

test("les cadratins des intitulés officiels ne sortent jamais du modèle", () => {
  assert.equal(net("Frapper à distance — porte-avions"), "Frapper à distance - porte-avions");
  assert.equal(net("Action – ambiguë"), "Action - ambiguë");
  for (const entree of INDEX.values()) {
    assert.doesNotMatch(entree.libelle, /[–—]/, `cadratin dans « ${entree.libelle} »`);
    assert.doesNotMatch(entree.chemin, /[–—]/, `cadratin dans « ${entree.chemin} »`);
  }
});

test("un réglage à zéro n'existe pas, et les réglages sont bornés à ±100", () => {
  const table = reglages(["DA", -10]);
  regler(table, "DA", 0);
  assert.equal(table.has("DA"), false);

  regler(table, "140", -500);
  regler(table, "146", 500);
  assert.equal(table.get("140"), -100);
  assert.equal(table.get("146"), 100);
  // Une dépense coupée à 100 % vaut zéro, jamais un montant négatif.
  assert.equal(impact(INDEX.get("140")!, table).montant, 0);
});

test("un budget fait l'aller-retour par l'URL sans perdre une ligne", () => {
  const table = reglages(["DA", -10], ["146-09-63", 50], ["r1301", -25]);
  const relu = decoder(encoder(table), INDEX);
  assert.deepEqual([...relu].sort(), [...table].sort());
  assert.equal(ecartAuReel(BUDGET, relu), ecartAuReel(BUDGET, table));
});

test("un lien partagé survit à la disparition d'une ligne", () => {
  // Les codes budgétaires changent d'un exercice à l'autre : un plan de 2025
  // doit rester ouvrable en 2026 avec les lignes qui existent encore.
  const relu = decoder("DA:-10,999-99-99:-50,cassé,r1301:x", INDEX);
  assert.deepEqual([...relu], [["DA", -10]]);
});

test("l'écart se traduit en programme seulement quand un programme en est proche", () => {
  const candidats = programmes(INDEX);
  assert.deepEqual(
    candidats.map((p) => p.code).sort(),
    ["140", "146", "178"],
  );

  // 4,2 Md€ : le programme « Préparation et emploi des forces » (4 Md€) est à
  // 5 % près, il éclaire.
  assert.equal(equivalence(candidats, 4_200_000_000)?.libelle, "Préparation et emploi des forces");
  // 12 Md€ : aucun programme n'en est proche, on ne dit rien plutôt que de
  // comparer à ce qui ne se ressemble pas.
  assert.equal(equivalence(candidats, 12_000_000_000), null);
  // 200 M€ : sous le seuil, une équivalence serait du bruit.
  assert.equal(equivalence(candidats, 200_000_000), null);
});

test("le défi de l'école voit une coupe cachée au fond de la mission", () => {
  const ecole = /Enseignement scolaire/i;
  assert.equal(missionTouchee(INDEX, reglages(["DA", -10]), ecole), false);
  // Réglée sur le programme, pas sur la mission : c'est le cas que le défi
  // doit attraper, sinon il suffit de descendre d'un cran pour tricher.
  assert.equal(missionTouchee(INDEX, reglages(["140", -10]), ecole), true);
  assert.equal(missionTouchee(INDEX, reglages(["IA", -10]), ecole), true);
});

test("les défis disent leur progression et ce qui les bloque", () => {
  const table = reglages(["140", -60]);
  const ecart = ecartAuReel(BUDGET, table);
  assert.equal(ecart, 12_000_000_000);
  const [dix, trente, equilibre] = defis(INDEX, table, ecart, totaux(BUDGET, table).solde);

  assert.equal(dix.reussi, true);
  // 12 Md€ dégagés, mais l'école est touchée : le chiffre ne suffit pas.
  assert.equal(trente.reussi, false);
  assert.equal(trente.obstacle, "l'école est touchée");
  assert.equal(equilibre.reussi, true);
  assert.equal(equilibre.valeur, 22_000_000_000);
});

test("le plan classe les lignes réglées par ce qu'elles pèsent", () => {
  const table = reglages(["146-09-63", -50], ["140", -10]);
  const lignes = plan(INDEX, table);
  assert.deepEqual(
    lignes.map((l) => l.entree.code),
    ["140", "146-09-63"],
  );
  assert.equal(lignes[0].delta, -2_000_000_000);
  assert.equal(lignes[0].surSolde, 2_000_000_000);
  assert.equal(lignes[0].pourcentage, -10);
});

test("le plan ignore une ligne réglée qui n'existe plus", () => {
  const table: Reglages = new Map([["disparue", -10]]);
  assert.deepEqual(plan(INDEX, table), []);
});

test("la recherche trouve sans accent, à toute profondeur, les plus grosses d'abord", () => {
  // La recherche porte aussi sur le chemin : « defense » remonte la mission
  // puis tout ce qu'elle contient, la plus grosse ligne d'abord.
  assert.deepEqual(
    chercher(INDEX, "defense").map((e) => e.code),
    ["DA", "178", "146", "146-09", "146-09-64", "146-09-63"],
  );
  assert.deepEqual(
    chercher(INDEX, "porte-avions").map((e) => e.code),
    ["146-09-63"],
  );
  // « forces » est dans deux intitulés et dans le chemin des feuilles : le plus
  // gros montant sort en tête.
  const forces = chercher(INDEX, "forces");
  assert.equal(forces[0].code, "178");
  // Deux caractères ne suffisent pas à chercher.
  assert.deepEqual(chercher(INDEX, "fo"), []);
});
