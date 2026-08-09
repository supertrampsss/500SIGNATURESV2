/**
 * Le pont budgétaire est un raisonnement affiché : si l'ordre des lignes, les
 * signes ou la hiérarchie sont faux, le lecteur lit une addition qui n'existe
 * pas. Ces tests portent sur le rendu, pas sur le style.
 *
 * Les montants sont ceux de l'exercice 2025 tel que publié par la DGFiP.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { BudgetEtat } from "./donnees.ts";
import { exercicesDisponibles, rendu } from "./etat.ts";

const LIGNES = [
  { libelle: "Total recettes nettes du budget général", cote: "recette", parent: null },
  {
    libelle: "Total recettes fiscales",
    cote: "recette",
    parent: "Total recettes nettes du budget général",
  },
  { libelle: "Impôt sur le revenu", cote: "recette", parent: "Total recettes fiscales" },
  { libelle: "Taxe sur la valeur ajoutée", cote: "recette", parent: "Total recettes fiscales" },
  {
    libelle: "Total recettes non fiscales",
    cote: "recette",
    parent: "Total recettes nettes du budget général",
  },
  { libelle: "Fonds de concours et attribution de produits", cote: "recette", parent: null },
  { libelle: "Total dépenses nettes du budget général", cote: "depense", parent: null },
  {
    libelle: "Dépenses de personnel",
    cote: "depense",
    parent: "Total dépenses nettes du budget général",
  },
  { libelle: "Total prélèvements sur recettes", cote: "depense", parent: null },
].map((l) => ({ ...l, titre: null, agregat: false, indicateur: null })) as BudgetEtat["lignes"];

const BUDGET: BudgetEtat = {
  etapes: [
    { cle: "vote", libelle: "Voté — loi de finances initiale" },
    { cle: "execute", libelle: "Exécuté" },
  ],
  lignes: LIGNES,
  exercices: {
    "2024": {
      execute: {
        solde: -155_929_972_365.41,
        solde_comptes_speciaux: null,
        solde_budgets_annexes: null,
        montants: {},
      },
    },
    "2025": {
      vote: {
        solde: -138_995_864_047.87,
        solde_comptes_speciaux: null,
        solde_budgets_annexes: null,
        montants: {},
      },
      execute: {
        solde: -124_205_673_501.55,
        solde_comptes_speciaux: -2_254_711_989.16,
        solde_budgets_annexes: 536_565_607.06,
        montants: {
          "Total recettes nettes du budget général": 380_389_657_383.09,
          "Total recettes fiscales": 356_397_925_509.5,
          "Impôt sur le revenu": 94_943_503_972.64,
          "Taxe sur la valeur ajoutée": 98_067_165_507.43,
          "Total recettes non fiscales": 23_991_731_873.59,
          "Fonds de concours et attribution de produits": 7_353_016_418.63,
          "Total dépenses nettes du budget général": 441_194_313_369.76,
          "Dépenses de personnel": 156_182_829_225.88,
          "Total prélèvements sur recettes": 69_035_887_551.41,
        },
      },
    },
  },
  quarantaine: { "2022/vote": ["Total prélèvements sur recettes"] },
};

test("seuls les exercices dont l'exécution est connue sont proposés", () => {
  assert.deepEqual(exercicesDisponibles(BUDGET), ["2025", "2024"]);
  // le plus récent d'abord : c'est celui que le lecteur cherche
  assert.equal(exercicesDisponibles(BUDGET)[0], "2025");
});

test("les recettes portent un plus, les dépenses un moins", () => {
  const html = rendu(BUDGET, "2025");
  const ligne = (libelle: string) =>
    html.slice(html.indexOf(libelle), html.indexOf(libelle) + 260);
  assert.match(ligne("Total recettes nettes du budget général"), /pont__signe">\+/);
  assert.match(ligne("Total dépenses nettes du budget général"), /pont__signe">−/);
  assert.match(ligne("Total prélèvements sur recettes"), /pont__signe">−/);
});

test("la hiérarchie publiée devient l'indentation affichée", () => {
  const html = rendu(BUDGET, "2025");
  const profondeur = (libelle: string) => {
    const debut = html.lastIndexOf("<tr", html.indexOf(`>${libelle}<`));
    return html.slice(debut, debut + 60).match(/pont__ligne--n(\d)/)?.[1];
  };
  assert.equal(profondeur("Total recettes nettes du budget général"), "0");
  assert.equal(profondeur("Total recettes fiscales"), "1");
  assert.equal(profondeur("Impôt sur le revenu"), "2");
  assert.equal(profondeur("Dépenses de personnel"), "1");
});

test("le pont va des recettes au solde, dans cet ordre", () => {
  const html = rendu(BUDGET, "2025");
  const rang = (libelle: string) => html.indexOf(`>${libelle}<`);
  assert.ok(rang("Total recettes nettes du budget général") < rang("Impôt sur le revenu"));
  assert.ok(rang("Impôt sur le revenu") < rang("Total dépenses nettes du budget général"));
  assert.ok(rang("Total dépenses nettes du budget général") < rang("Solde des comptes spéciaux"));
  assert.ok(rang("Solde des comptes spéciaux") < rang("Solde budgétaire"));
});

test("dans le pont, le signe est une colonne, pas une décoration du nombre", () => {
  const html = rendu(BUDGET, "2025");
  const table = html.slice(html.indexOf('<table class="pont"'), html.indexOf("</table>"));
  assert.match(table, /380\u202f390\u202fM€/); // recettes nettes
  assert.match(table, /124\u202f206\u202fM€/); // solde, valeur absolue
  assert.doesNotMatch(table, /[-−]\d/); // aucun nombre négatif dans la colonne montant
  // le tableau de comparaison, lui, montre des soldes signés : c'est leur nature
  assert.match(html.slice(html.indexOf('<table class="comparaison"')), /−124\u202f206\u202fM€/);
});

test("l'écart entre voté et exécuté est nommé dans le bon sens", () => {
  // Exécuté −124,2 Md€ contre −139,0 Md€ votés : le déficit est plus faible que
  // prévu. Dire « au-dessus du solde voté » serait exact et compris à l'envers.
  const html = rendu(BUDGET, "2025");
  assert.match(html, /14\u202f7\d\d\u202fM€/);
  assert.match(html, /déficit constaté est[\s\S]{0,80}plus faible/);

  const creuse = structuredClone(BUDGET);
  creuse.exercices["2025"].execute.solde = -160_000_000_000;
  assert.match(rendu(creuse, "2025"), /déficit constaté est[\s\S]{0,80}plus élevé/);
});

test("les confusions interdites sont écrites, pas sous-entendues", () => {
  const html = rendu(BUDGET, "2025");
  assert.match(html, /pas le déficit public au sens de Maastricht/);
  assert.match(html, /prélèvements sur recettes ne sont pas des dépenses de l&#39;État/);
});

test("une décomposition mise en quarantaine s'explique sur son exercice", () => {
  assert.match(rendu(BUDGET, "2022"), /Décomposition non publiée/);
  assert.doesNotMatch(rendu(BUDGET, "2025"), /Décomposition non publiée/);
});
