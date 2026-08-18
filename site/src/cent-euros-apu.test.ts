/**
 * Les 100 € de toutes les administrations publiques.
 *
 * Les valeurs des fixtures sont celles d'Eurostat pour 2025, en euros : c'est
 * la seule façon de vérifier que les parts sont calculées sur les recettes et
 * non sur les dépenses — l'écart entre les deux étant précisément le sujet.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Territoire } from "./donnees.ts";
import { rendu } from "./cent-euros-apu.ts";

const Md = 1e9;
// Les valeurs RÉELLEMENT publiées, au dixième de million près, et non des
// arrondis commodes : un fixture arrondi affichait « 37,10 € » là où la
// production affiche « 37,11 € », c'est-à-dire faisait passer au vert un
// chiffre que personne ne verra jamais. C'est la faute exacte qu'un fixture de
// la redistribution avait déjà coûtée.
const SERIES: Record<string, Record<string, number>> = {
  eurostat_apu_recettes: { "2024": 1503.59 * Md, "2025": 1561.6261 * Md },
  eurostat_apu_depenses: { "2024": 1672.7108 * Md, "2025": 1714.1372 * Md },
  eurostat_apu_prestations: { "2025": 579.5423 * Md },
  eurostat_apu_remunerations: { "2025": 370.016 * Md },
  eurostat_apu_transferts_nature: { "2025": 191.4967 * Md },
  eurostat_apu_consommations: { "2025": 162.9945 * Md },
  eurostat_apu_investissement: { "2025": 131.6488 * Md },
  eurostat_apu_transferts_courants: { "2025": 94.0009 * Md },
  eurostat_apu_interets: { "2025": 66.6359 * Md },
  eurostat_apu_subventions: { "2025": 56.516 * Md },
  eurostat_apu_transferts_capital: { "2025": 41.563 * Md },
  eurostat_apu_cotisations: { "2025": 498.736 * Md },
  eurostat_apu_impots_production: { "2025": 470.392 * Md },
  eurostat_apu_impots_revenu: { "2025": 389.922 * Md },
  // La ventilation par fonction, aux valeurs d'Eurostat pour 2024 : elle
  // s'arrête un exercice plus tôt que les totaux, et c'est le sujet des deux
  // tests qui la vérifient.
  eurostat_apu_prestations_vieillesse: { "2024": 362.1784 * Md },
  eurostat_apu_prestations_maladie_invalidite: { "2024": 50.2514 * Md },
  eurostat_apu_prestations_chomage: { "2024": 40.6642 * Md },
  eurostat_apu_prestations_survivants: { "2024": 40.2548 * Md },
  eurostat_apu_prestations_famille: { "2024": 34.3586 * Md },
  eurostat_apu_prestations_exclusion: { "2024": 26.9809 * Md },
  eurostat_apu_prestations_logement: { "2024": 1.0353 * Md },
  eurostat_apu_prestations_ventilees: { "2024": 561.8784 * Md },
};

function territoire(series: Record<string, Record<string, number>>): Territoire {
  return { nom: "", parent: null, population: null, drapeaux: {}, series };
}

const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

test("le total encaissé s'écrit en toutes lettres, pas en sept rangs suivis d'un sigle", () => {
  // « 1 561 626 M€ » demande une conversion de tête et il faut être du métier
  // pour lire mille cinq cents milliards derrière deux lettres. C'est la règle
  // que `montantLisible` porte, et que ce bloc a d'abord enfreinte.
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /1\s?561,63\s?milliards d'euros/);
  assert.doesNotMatch(lu, /M€/);
});

test("les parts se rapportent aux recettes, donc leur somme dépasse 100 €", () => {
  // Ramenées à cent, elles feraient disparaître la seule chose que ce tableau
  // existe pour montrer : le déficit.
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /dépensé 109,77\s?€ pour chaque 100\s?€ reçus/);
  assert.match(lu, /9,77\s?€.{0,40}déficit public/);
});

test("le reste non détaillé est une ligne, jamais un silence", () => {
  // Neuf postes nommés ne font pas la dépense entière ; la soustraction est
  // écrite plutôt que laissée au lecteur.
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /Autres dépenses/);
  const html = rendu({ FR: territoire(SERIES) });
  // 1 714,1372 − la somme des neuf postes = 19,62 Md€, soit 1,26 € pour 100.
  assert.match(html, />1,26\s?€</);
});

test("le tableau dit ce qui le sépare des deux autres « 100 € » du site", () => {
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /ne se soustrait ni des «\s?100\s?€ du budget de l'État/);
  assert.match(lu, /100\s?€ de prestations sociales/);
  assert.match(lu, /Eurostat/);
});

test("les recettes se décomposent aussi, reste compris", () => {
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /Cotisations sociales/);
  assert.match(lu, /Ventes de services et autres recettes/);
  // 498,7 + 470,4 + 389,9 = 1 359 sur 1 561,6, soit 12,97 € de reste.
  assert.match(rendu({ FR: territoire(SERIES) }), />12,97\s?€</);
});

test("le premier poste s'ouvre, et la retraite n'y pèse pas ce que le libellé suggère", () => {
  // « Retraites, chômage, allocations » mettait dans un seul nombre trois
  // choses qui n'ont ni le même montant, ni le même public. Séparées, la
  // retraite pèse NEUF fois le chômage.
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  for (const attendu of [
    /Retraites 24,09\s?€/,
    /Arrêts maladie et invalidité 3,34\s?€/,
    /Chômage 2,70\s?€/,
    /Pensions de réversion 2,68\s?€/,
    /Famille et enfants 2,29\s?€/,
    /RSA et autres minima sociaux 1,79\s?€/,
  ]) {
    assert.match(lu, attendu);
  }
  // Le reste de la ventilation est écrit, comme celui du tableau du dessus :
  // 561,8784 − la somme des sept fonctions = 6,155 Md€, soit 0,41 € pour 100.
  assert.match(lu, /hors protection sociale.{0,40}0,41\s?€/);
  assert.match(lu, /Ensemble du poste 37,37\s?€/);
});

test("la figure précède le tableau, et son rapport est celui des nombres", () => {
  // Le tableau seul demandait au lecteur de diviser 24,09 par 2,70. La figure
  // le lui montre — c'est sa seule raison d'être, et c'est ce qui se vérifie.
  const html = rendu({ FR: territoire(SERIES) });
  const figure = html.indexOf("barres__rangs");
  const tableauVentile = html.indexOf("Pour 100 € encaissés en 2024</th>");
  assert.ok(figure > -1, "aucune figure peinte");
  assert.ok(figure < tableauVentile, "la figure est passée sous son tableau");
  const largeurs = [...html.matchAll(/width:([0-9.]+)%/g)].map((m) => Number(m[1]));
  assert.equal(largeurs[0], 100, "la plus grande barre n'occupe pas la piste");
  assert.ok(
    Math.abs(largeurs[0] / largeurs[2] - 24.09 / 2.7) < 0.05,
    `rapport dessiné ${largeurs[0] / largeurs[2]}, rapport des nombres 8,9`,
  );
});

test("la ventilation porte son exercice, et ses parts en viennent", () => {
  // Deux jeux de la même source, deux millésimes : la ventilation s'arrête en
  // 2024 quand les totaux donnent 2025. Redistribuer les 37,11 € de 2025 sur
  // des clés de 2024 aurait donné un tableau qui tombe juste et qui ment.
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /Exercice 2024/);
  assert.match(lu, /Pour 100\s?€ encaissés en 2024/);
  assert.match(lu, /s'arrête un exercice plus tôt/);
  // 362,1784 / 1 503,59 = 24,09 €. Sur les recettes de 2025 il aurait affiché
  // 23,19 € : c'est cette valeur-là que le tableau ne doit jamais porter.
  assert.doesNotMatch(lu, /Retraites 23,19\s?€/);
  // Et l'ensemble du poste ventilé n'est pas celui du tableau principal : même
  // compte, deux millésimes, 37,37 contre 37,11.
  assert.match(lu, /Retraites, chômage, allocations 37,11\s?€/);
});

test("sans ses sept fonctions, la ventilation se tait plutôt que d'en montrer six", () => {
  const ampute = { ...SERIES } as Record<string, Record<string, number>>;
  delete ampute["eurostat_apu_prestations_chomage"];
  const lu = texte(rendu({ FR: territoire(ampute) }));
  assert.doesNotMatch(lu, /ce que recouvre le poste/);
  // Mais le tableau principal, lui, reste servi.
  assert.match(lu, /Total dépensé 109,77\s?€/);
});

test("un exercice sans ses deux totaux n'est pas retenu", () => {
  // 2024 porte recettes et dépenses mais aucun poste : le bloc prend le dernier
  // exercice qui a les deux totaux, et se tait si les postes lui manquent.
  const sansPostes = {
    eurostat_apu_recettes: SERIES.eurostat_apu_recettes,
    eurostat_apu_depenses: SERIES.eurostat_apu_depenses,
  };
  assert.equal(rendu({ FR: territoire(sansPostes) }), "");
});

test("rien n'est peint sans les deux totaux", () => {
  assert.equal(rendu({}), "");
  const sansDepenses = { ...SERIES } as Record<string, Record<string, number>>;
  delete sansDepenses["eurostat_apu_depenses"];
  assert.equal(rendu({ FR: territoire(sansDepenses) }), "");
});
