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
const SERIES: Record<string, Record<string, number>> = {
  eurostat_apu_recettes: { "2024": 1503.59 * Md, "2025": 1561.6 * Md },
  eurostat_apu_depenses: { "2024": 1672.71 * Md, "2025": 1714.1 * Md },
  eurostat_apu_prestations: { "2025": 579.4 * Md },
  eurostat_apu_remunerations: { "2025": 370.0 * Md },
  eurostat_apu_transferts_nature: { "2025": 192.0 * Md },
  eurostat_apu_consommations: { "2025": 162.4 * Md },
  eurostat_apu_investissement: { "2025": 131.2 * Md },
  eurostat_apu_transferts_courants: { "2025": 93.7 * Md },
  eurostat_apu_interets: { "2025": 67.1 * Md },
  eurostat_apu_subventions: { "2025": 56.2 * Md },
  eurostat_apu_transferts_capital: { "2025": 42.2 * Md },
  eurostat_apu_cotisations: { "2025": 498.7 * Md },
  eurostat_apu_impots_production: { "2025": 470.4 * Md },
  eurostat_apu_impots_revenu: { "2025": 389.9 * Md },
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
  assert.match(lu, /1\s?561,60\s?milliards d'euros/);
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
  // 1 714,1 − la somme des neuf postes = 19,9 Md€, soit 1,27 € pour 100.
  assert.match(html, />1,27\s?€</);
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
