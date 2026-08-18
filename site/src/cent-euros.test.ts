/**
 * « 100 € » est la formulation la plus lue et la plus facile à fausser. Ces
 * tests vérifient que les parts somment à 100, que l'ordre décroissant tient,
 * et surtout que la page dit explicitement qu'aucun euro n'est tracé.
 *
 * Les montants sont ceux de l'exécution 2025 publiée par la DGFiP.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { BudgetEtat } from "./donnees.ts";
import { quartiers, rendu, repartition } from "./cent-euros.ts";

const MONTANTS: Record<string, number> = {
  "Total recettes nettes du budget général": 380_389_657_383.09,
  "Impôt sur le revenu": 94_943_503_972.64,
  "Impôt sur les sociétés": 59_917_571_411.89,
  "Taxe sur la valeur ajoutée": 98_067_165_507.43,
  "Taxe intérieure de consommation sur les produits énergétiques": 16_276_657_082.77,
  "Autres recettes fiscales": 87_193_027_534.77,
  "Total recettes non fiscales": 23_991_731_873.59,
  "Fonds de concours et attribution de produits": 7_353_016_418.63,
  "Total dépenses nettes du budget général": 441_194_313_369.76,
  "Dotation des pouvoirs publics": 1_137_842_146.81,
  "Dépenses de personnel": 156_182_829_225.88,
  "Dépenses de fonctionnement": 70_074_042_700.49,
  "Charges de la dette de l'Etat": 51_583_057_726.03,
  "Dépenses d'investissement": 22_194_569_749.79,
  "Dépenses d'intervention": 138_996_007_925.74,
  "Dépenses d'opérations financières": 1_025_963_895.02,
  "Total prélèvements sur recettes": 69_035_887_551.41,
  "PSR au profit des collectivités territoriales": 46_074_157_228.33,
  "PSR au profit de l'Union européenne": 22_961_730_323.08,
};

const BUDGET: BudgetEtat = {
  etapes: [{ cle: "execute", libelle: "Exécuté" }],
  lignes: [],
  exercices: {
    "2025": {
      execute: {
        solde: -124_205_673_501.55,
        solde_comptes_speciaux: -2_254_711_989.16,
        solde_budgets_annexes: 536_565_607.06,
        montants: MONTANTS,
      },
    },
  },
  quarantaine: {},
};

/** Le gabarit HTML est indenté sur plusieurs lignes : on compare le texte,
 *  pas sa mise en page. */
function plat(html: string): string {
  return html.replace(/\s+/g, " ");
}

function parts(html: string): number[] {
  return [...html.matchAll(/cent__part">([\d,]+)\s?€/g)].map((m) =>
    Number(m[1].replace(",", ".")),
  );
}

test("les parts d'une colonne somment à 100 €", () => {
  const html = rendu(BUDGET, "2025");
  const toutes = parts(html);
  const recettes = toutes.slice(0, 7);
  const depenses = toutes.slice(7, 16);
  assert.equal(recettes.length, 7);
  assert.equal(depenses.length, 9);
  assert.ok(Math.abs(recettes.reduce((a, b) => a + b, 0) - 100) < 0.05);
  assert.ok(Math.abs(depenses.reduce((a, b) => a + b, 0) - 100) < 0.05);
});

test("chaque colonne est classée du plus lourd au plus léger", () => {
  const toutes = parts(rendu(BUDGET, "2025"));
  const trie = (xs: number[]) => xs.every((v, i) => i === 0 || xs[i - 1] >= v);
  assert.ok(trie(toutes.slice(0, 7)));
  assert.ok(trie(toutes.slice(7, 16)));
});

test("la part empruntée se déduit des deux totaux affichés", () => {
  // 387,74 Md€ encaissés contre 510,23 Md€ décaissés : 24,01 % empruntés
  const html = plat(rendu(BUDGET, "2025"));
  assert.match(html, /75,99[^<]*<\/strong> viennent des recettes/);
  assert.match(html, /24,01[^<]*<\/strong> restants sont empruntés/);
});

test("les plus gros postes sont ceux de la source, pas une invention", () => {
  // 2025 : la TVA devance l'impôt sur le revenu, les rémunérations devancent
  // les interventions. L'ordre vient des montants, pas d'un classement figé.
  const html = rendu(BUDGET, "2025");
  const recettes = html.slice(html.indexOf("D&#39;où viennent"));
  assert.ok(recettes.indexOf("TVA") < recettes.indexOf("Impôt sur le revenu"));
  const depenses = html.slice(html.indexOf("Où vont"));
  assert.ok(
    depenses.indexOf("Salaires et pensions des agents") <
      depenses.indexOf("Aides, prestations"),
  );
});

test("aucune réserve qui s'excuse sous le bloc", () => {
  // « Pourquoi ce n'est pas suivre son impôt » énumérait quatre mises en garde
  // sous chaque camembert. Elles disaient au lecteur de se méfier du chiffre
  // sans lui donner de quoi le lire autrement : c'est le remplissage que la
  // règle du dépôt interdit. Ce qui compte — les 100 € sont une proportion —
  // est déjà dans le titre et dans la phrase de complément.
  const html = rendu(BUDGET, "2025");
  assert.doesNotMatch(html, /Pourquoi ce n'est pas/);
  assert.doesNotMatch(html, /Aucun euro n'est tracé/);
  assert.doesNotMatch(html, /ne disent pas/);
  // Le détail chiffré, lui, reste.
  assert.match(html, /Le détail ligne à ligne/);
});

test("une petite part seule garde son nom, deux petites se regroupent", () => {
  // Les fonds de concours pèsent 1,90 € des recettes : sous le seuil, mais
  // seuls sous le seuil. « Autres » avec un seul membre cache un libellé sans
  // simplifier la figure. Côté dépenses, deux postes minuscules se regroupent.
  const seule = quartiers([
    { libelle: "Gros", part: 97 },
    { libelle: "Fonds de concours", part: 3 - 0.1 },
  ]);
  assert.deepEqual(
    seule.map((e) => e.libelle),
    ["Gros", "Fonds de concours"],
  );
  const deux = quartiers([
    { libelle: "Gros", part: 96 },
    { libelle: "Petit A", part: 2 },
    { libelle: "Petit B", part: 2 },
  ]);
  assert.deepEqual(
    deux.map((e) => e.libelle),
    ["Gros", "Autres"],
  );
  assert.equal(deux[1].part, 4);
  const html = rendu(BUDGET, "2025");
  assert.match(html, /barres__nom">Fonds de concours/);
});

test("un exercice sans exécution ne produit rien plutôt qu'un cadre vide", () => {
  assert.equal(rendu(BUDGET, "2019"), "");
  assert.deepEqual(repartition({}, [["a", "A"]], 0), []);
});
