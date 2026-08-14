/**
 * `fusionnerBranches` est partagé entre l'atelier interactif (`main.ts`) et le
 * pré-rendu (`scripts/prerendre.ts`) — avant l'extraction, le second en tenait
 * une copie qui avait déjà divergé de l'original au moment où elle a été
 * écrite : le champ `d` manquait sur chaque branche. Ce test verrouille ce que
 * `decoder()` et l'écran attendent des deux côtés, pour qu'une divergence
 * future casse ici plutôt que de repasser inaperçue.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Budget } from "./simulateur.ts";
import { BRANCHES, DIT_LA_BRANCHE, ECHELONS, fusionnerBranches } from "./simulateur-volets.ts";

const M = 1_000_000;

const VIEILLESSE: Budget = {
  exercice: "2026",
  loi: "PLFSS",
  unite: "EUR",
  depenses: [{ c: "D-PRE", l: "Prestations", v: 100 * M }],
  recettes: [{ t: "Cotisations", signe: 1, lignes: [{ c: "R-COT", l: "Cotisations sociales", v: 90 * M }] }],
};

const MALADIE: Budget = {
  exercice: "2026",
  loi: "PLFSS",
  unite: "EUR",
  depenses: [{ c: "D-PRE", l: "Prestations", v: 50 * M }],
  recettes: [{ t: "Cotisations", signe: 1, lignes: [{ c: "R-COT", l: "Cotisations sociales", v: 40 * M }] }],
};

const CONSOLIDE: Budget = {
  ...VIEILLESSE,
  // Le consolidé publié compte 10 M€ de moins que la somme des deux branches :
  // c'est ce qui fait apparaître une ligne d'élimination.
  depenses: [{ c: "D-PRE", l: "Prestations", v: 140 * M }],
  recettes: [{ t: "Cotisations", signe: 1, lignes: [{ c: "R-COT", l: "Cotisations sociales", v: 130 * M }] }],
};

test("chaque branche porte ce qu'elle paie, sur le nœud que l'écran affiche", () => {
  // C'est le champ qui manquait à la copie divergente : « Autonomie » ne se
  // comprend pas seul, et decoder() comme l'écran s'attendent à le trouver ici.
  const fusionne = fusionnerBranches(CONSOLIDE, [
    ["vieillesse", "Retraites", VIEILLESSE],
    ["maladie", "Maladie", MALADIE],
  ]);
  const vieillesse = fusionne.depenses.find((n) => n.c === "vieillesse");
  const maladie = fusionne.depenses.find((n) => n.c === "maladie");
  assert.equal(vieillesse?.d, DIT_LA_BRANCHE["vieillesse"]);
  assert.equal(maladie?.d, DIT_LA_BRANCHE["maladie"]);
  assert.ok(vieillesse?.d, "le champ d ne doit pas être vide");
});

test("l'écart entre la somme des branches et le consolidé est une ligne visible, des deux côtés", () => {
  const fusionne = fusionnerBranches(CONSOLIDE, [
    ["vieillesse", "Retraites", VIEILLESSE],
    ["maladie", "Maladie", MALADIE],
  ]);
  // 100 + 50 = 150 côté branches, 140 côté consolidé : 10 M€ d'écart, en dépense.
  const eliminationDepense = fusionne.depenses.find((n) => n.l.includes("comptés deux fois"));
  assert.equal(eliminationDepense?.v, -10 * M);
  // 90 + 40 = 130 côté branches, 130 côté consolidé : pas d'écart, en recette.
  const groupeElimination = fusionne.recettes.find((g) => g.t === "Transferts entre branches");
  assert.equal(groupeElimination?.lignes[0]?.v, 0);
});

test("les codes de chaque branche sont préfixés, jusque dans les feuilles", () => {
  const fusionne = fusionnerBranches(CONSOLIDE, [["vieillesse", "Retraites", VIEILLESSE]]);
  const vieillesse = fusionne.depenses.find((n) => n.c === "vieillesse");
  assert.equal(vieillesse?.enfants?.[0]?.c, "vieillesse:D-PRE");
});

test("les cinq branches et les trois échelons sont ceux que l'écran et le pré-rendu construisent", () => {
  assert.deepEqual(
    BRANCHES.map(([cle]) => cle),
    ["vieillesse", "maladie", "famille", "autonomie", "atmp"],
  );
  assert.deepEqual(ECHELONS, { commune: "Communes", departement: "Départements", region: "Régions" });
});
