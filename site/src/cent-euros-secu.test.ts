/**
 * « Où vont 100 € ? » côté protection sociale. Le risque n'est pas le calcul,
 * il est dans ce que la figure laisse croire : que les cotisations sont
 * fléchées, et que la moitié recettes existe. Ces tests vérifient les parts, la
 * complétude du millésime, et les deux phrases qui désamorcent.
 *
 * Les montants sont ceux des comptes de la protection sociale de la DREES,
 * millésime 2024, tels que publiés par le catalogue.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Indicateur, Territoire } from "./donnees.ts";
import { RISQUES, derniereAnneeComplete, postes, rendu } from "./cent-euros-secu.ts";

const CATALOGUE = RISQUES.map(([id]) => ({ id, libelle: id })) as unknown as Indicateur[];

const SERIES: Record<string, Record<string, number>> = {
  drees_protection_sociale_vieillesse: { "2023": 400_717_580_000, "2024": 426_665_300_000 },
  drees_protection_sociale_sante: { "2023": 325_717_360_000, "2024": 338_880_820_000 },
  drees_protection_sociale_famille: { "2023": 62_858_380_000, "2024": 65_806_890_000 },
  drees_protection_sociale_emploi: { "2023": 49_254_740_000, "2024": 51_123_850_000 },
  drees_protection_sociale_pauvrete: { "2023": 35_179_040_000, "2024": 34_012_870_000 },
  drees_protection_sociale_logement: { "2023": 15_751_830_000, "2024": 16_058_540_000 },
};

function territoire(series: Record<string, Record<string, number>>): Territoire {
  return { nom: "France", parent: null, population: null, drapeaux: {}, series };
}

/** Le gabarit HTML est indenté sur plusieurs lignes : on compare le texte,
 *  pas sa mise en page. */
function plat(html: string): string {
  return html.replace(/\s+/g, " ");
}

test("les six risques somment à 100 €, du plus lourd au plus léger", () => {
  const lignes = postes(SERIES, "2024");
  assert.equal(lignes.length, 6);
  assert.ok(Math.abs(lignes.reduce((a, l) => a + l.part, 0) - 100) < 1e-9);
  assert.ok(lignes.every((l, i) => i === 0 || lignes[i - 1].part >= l.part));
  assert.equal(lignes[0].libelle, "La retraite");
  assert.equal(lignes[1].libelle, "La santé");
});

test("les parts affichées sont celles de la source, pas un arrondi commode", () => {
  const lignes = postes(SERIES, "2024");
  // 426,665 3 Md€ sur 932,548 27 Md€ de prestations versées en 2024.
  assert.equal(lignes[0].part.toFixed(2), "45.75");
  assert.equal(lignes[1].part.toFixed(2), "36.34");
  assert.equal(lignes[0].montant, "426\u202f665\u202fM€");
});

test("le montant réel accompagne chaque part dans la légende du camembert", () => {
  const html = plat(rendu(territoire(SERIES), CATALOGUE));
  assert.match(html, /La retraite<\/span> <span class="camembert__montant">426.665.M€/);
  assert.match(html, /45,75 €/);
  assert.match(html, /932.548.M€<\/strong> de prestations sociales/);
});

test("les aides au logement gardent leur nom au lieu de tomber dans « Autres »", () => {
  // 1,72 € : sous le seuil de regroupement, mais seule sous ce seuil. La
  // masquer derrière « Autres » perdrait le libellé sans simplifier la figure.
  const html = rendu(territoire(SERIES), CATALOGUE);
  assert.match(html, /Les aides au logement/);
  assert.doesNotMatch(html, /Autres/);
});

test("le millésime retenu est le dernier où les six risques sont renseignés", () => {
  assert.equal(derniereAnneeComplete(SERIES), "2024");
  const partiel = {
    ...SERIES,
    drees_protection_sociale_logement: { "2023": 15_751_830_000 },
  };
  // 2024 y est incomplet : reculer d'un an vaut mieux que diviser par un total
  // amputé d'un risque, ce que rien n'indiquerait à l'écran.
  assert.equal(derniereAnneeComplete(partiel), "2023");
  assert.equal(plat(rendu(territoire(partiel), CATALOGUE)).includes("versées en 2023"), true);
});

test("aucune réserve qui s'excuse sous le bloc", () => {
  const html = rendu(territoire(SERIES), CATALOGUE);
  assert.doesNotMatch(html, /ne disent pas/);
  assert.doesNotMatch(html, /Ce n'est pas le trajet/);
  assert.match(html, /Le détail ligne à ligne/);
});

test("le titre parle de prestations, jamais de cotisations réparties", () => {
  const html = plat(rendu(territoire(SERIES), CATALOGUE));
  assert.match(html, /<h3>100 € de prestations sociales, où vont-ils \?/);
  assert.doesNotMatch(html, /<h3>[^<]*cotisations/);
});

test("le détail ligne à ligne relie le nom courant à l'intitulé de la source", () => {
  const html = plat(rendu(territoire(SERIES), CATALOGUE));
  assert.match(html, /Le détail ligne à ligne/);
  assert.match(html, /La retraite, 426.665.M€ \(Vieillesse-survie : pensions de base/);
  assert.match(html, /Les minima sociaux, 34.013.M€ \(Pauvreté-exclusion sociale : RSA/);
  assert.match(html, /Comptes de la protection sociale \(DREES\), base 2020/);
});

test("aucun tiret cadratin dans les chaînes visibles", () => {
  assert.doesNotMatch(rendu(territoire(SERIES), CATALOGUE), /—/);
});

test("sans série, sans indicateur publié ou sans total, le bloc n'écrit rien", () => {
  assert.equal(rendu(undefined, CATALOGUE), "");
  assert.equal(rendu(territoire(SERIES), [] as Indicateur[]), "");
  assert.equal(rendu(territoire({}), CATALOGUE), "");
  const zeros = Object.fromEntries(RISQUES.map(([id]) => [id, { "2024": 0 }]));
  assert.deepEqual(postes(zeros, "2024"), []);
});
