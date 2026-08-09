/**
 * Refaire le barème : le calcul, et ce qu'il refuse de supposer.
 *
 * Les tranches sont celles du fichier publié — IRCOM, revenus 2024 —, aux
 * montants réels. Ce qui est vérifié en premier n'est pas que le rendement se
 * calcule, mais qu'il est **exact** : la somme des matières taxables de toutes
 * les tranches doit valoir le revenu déclaré total, sans quoi un taux unique ne
 * rapporterait pas ce taux fois le revenu du pays.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  MODELES,
  appliquer,
  borner,
  decoder,
  ecartAuReel,
  encoder,
  foyersConcernes,
  partDesFoyers,
  regler,
  rendement,
  tauxMoyen,
  tauxMoyenDesConcernes,
  type Bareme,
  type Taux,
} from "./bareme.ts";
import { intitule, lecture, renduCockpit, renduTranches } from "./bareme-rendu.ts";

const Md = 1_000_000_000;

/** Cinq tranches réelles du millésime 2024, bornes et masses comprises.
 *  Les matières taxables sont celles que `publish.py` calcule. */
const BAREME: Bareme = {
  exercice: "2024",
  titre: "L'impôt sur le revenu, barème à refaire",
  cadre: "IRCOM, revenus 2024, 41 635 259 foyers fiscaux, montants en millions d'euros (M€)",
  note: "L'assiette simulée ici est le revenu fiscal de référence du foyer…",
  foyers: 30_000,
  revenu_total: 1_000 * Md,
  impot_emis: 60 * Md,
  tranches: [
    { b: 0, h: 20_000, f: 10_000, fa: 30_000, r: 150 * Md, a: 400 * Md, i: -1 * Md },
    { b: 20_000, h: 100_000, f: 15_000, fa: 20_000, r: 600 * Md, a: 500 * Md, i: 40 * Md },
    { b: 100_000, h: null, f: 5_000, fa: 5_000, r: 250 * Md, a: 100 * Md, i: 21 * Md },
  ],
};

function taux(...paires: [number, number][]): Taux {
  const table: Taux = new Map();
  for (const [borne, valeur] of paires) regler(table, borne, valeur);
  return table;
}

/* ---------------------------------------------------------- l'exactitude */

test("les matières taxables font le revenu déclaré total", () => {
  // C'est la propriété dont tout le reste dépend : un taux unique appliqué à
  // toutes les tranches doit rapporter ce taux fois le revenu du pays. Si la
  // somme des assiettes s'écartait du total, le simulateur inventerait ou
  // perdrait de la matière imposable sans rien afficher d'anormal.
  const somme = BAREME.tranches.reduce((s, t) => s + t.a, 0);
  assert.equal(somme, BAREME.revenu_total);
  const unique = taux([0, 10], [20_000, 10], [100_000, 10]);
  assert.equal(rendement(BAREME, unique), 0.1 * BAREME.revenu_total);
});

test("un taux ne s'applique qu'à ce qui dépasse la borne de sa tranche", () => {
  // 30 % sur la seule tranche haute : 30 % de 100 Md€, pas de 250 Md€. La
  // différence — le revenu des mêmes foyers en dessous de 100 000 € — est
  // exactement ce qu'un barème marginal ne prend pas.
  assert.equal(rendement(BAREME, taux([100_000, 30])), 30 * Md);
});

test("le taux moyen n'est pas la moyenne des taux affichés", () => {
  // 45 % sur la seule tranche haute font 4,5 % du revenu déclaré du pays.
  const t = taux([100_000, 45]);
  assert.equal(tauxMoyen(BAREME, t), 45 * Md / (1_000 * Md));
  // Et 18 % du revenu des seuls foyers atteints : trois lectures, trois
  // chiffres, et c'est l'écart entre eux qui apprend quelque chose.
  assert.equal(tauxMoyenDesConcernes(BAREME, t), 45 * Md / (250 * Md));
});

/* ------------------------------------------------------------------ qui ? */

test("qui paie : les foyers au-dessus de la première tranche taxée", () => {
  assert.equal(foyersConcernes(BAREME, taux([100_000, 10])), 5_000);
  assert.equal(foyersConcernes(BAREME, taux([20_000, 5], [100_000, 10])), 20_000);
  assert.equal(foyersConcernes(BAREME, taux([0, 1])), 30_000);
  assert.equal(partDesFoyers(BAREME, taux([20_000, 5])), 20_000 / 30_000);
});

test("un barème vide ne touche personne et ne rapporte rien", () => {
  assert.equal(rendement(BAREME, new Map()), 0);
  assert.equal(foyersConcernes(BAREME, new Map()), 0);
  assert.equal(tauxMoyen(BAREME, new Map()), 0);
  assert.match(lecture(BAREME, new Map()), /ne rapporte rien/);
});

test("l'écart se mesure contre l'impôt réellement émis", () => {
  assert.equal(ecartAuReel(BAREME, new Map()), -BAREME.impot_emis);
  assert.equal(ecartAuReel(BAREME, taux([0, 6], [20_000, 6], [100_000, 6])), 0);
});

/* --------------------------------------------------------------- réglages */

test("un taux vit entre 0 et 100 points, et zéro n'est pas un réglage", () => {
  assert.equal(borner(150), 100);
  assert.equal(borner(-20), 0);
  assert.equal(borner(Number.NaN), 0);
  const t = taux([20_000, 10]);
  regler(t, 20_000, 0);
  assert.equal(t.size, 0, "un taux nul sort de la table plutôt que d'y rester à zéro");
});

test("les trois barèmes tout faits sont trois barèmes différents", () => {
  const formes = MODELES.map((m) => encoder(appliquer(BAREME, m)));
  assert.equal(new Set(formes).size, 3);
  assert.ok(MODELES.every((m) => rendement(BAREME, appliquer(BAREME, m)) > 0));
  // Deux d'entre eux ne touchent pas les premiers euros de chaque foyer, et
  // c'est là toute la différence avec le taux unique.
  assert.equal(appliquer(BAREME, MODELES[0]).get(0), 7);
  assert.equal(appliquer(BAREME, MODELES[1]).get(0), undefined);
  assert.equal(appliquer(BAREME, MODELES[2]).get(0), undefined);
});

test("un lien partagé ne règle que des bornes que le millésime porte", () => {
  assert.equal(encoder(decoder("20000:12,100000:45", BAREME)), "20000:12,100000:45");
  // 45 000 € n'est pas une borne publiée : l'accepter obligerait à supposer
  // comment les revenus se répartissent dans la tranche, ce que ce simulateur
  // refuse de faire.
  assert.equal(encoder(decoder("45000:30", BAREME)), "");
  assert.equal(encoder(new Map()), "");
});

/* ----------------------------------------------------------------- l'écran */

test("les bornes s'écrivent en français, et la dernière n'a pas de plafond", () => {
  // Les milliers portent l'espace fine insécable d'`Intl` : la comparaison la
  // normalise plutôt que de la reproduire à l'aveugle dans le test.
  const lisible = (t: { b: number; h: number | null }) =>
    intitule(t).replace(/[\u202f\u00a0]/g, " ");
  assert.equal(lisible({ b: 0, h: 20_000 }), "Jusqu'à 20 000 €");
  assert.equal(lisible({ b: 20_000, h: 100_000 }), "De 20 000 € à 100 000 €");
  assert.equal(lisible({ b: 100_000, h: null }), "Au-dessus de 100 000 €");
});

test("le cockpit dit le rendement, qui paie, et l'écart au réel", () => {
  const html = renduCockpit(BAREME, taux([100_000, 45]));
  assert.match(html, /Rendement/);
  assert.match(html, /Foyers qui paient/);
  assert.match(html, /Taux moyen/);
  assert.match(html, /Écart à l'impôt émis/);
  // Aucune couleur de jugement sur un barème : ni sobre ni argile.
  assert.doesNotMatch(html, /simu__val--sobre|simu__val--argile/);
});

test("une tranche non réglée n'affiche pas un rendement de zéro", () => {
  // Un « 0,00 M€ » sur chaque ligne non touchée remplirait la colonne de bruit.
  const html = renduTranches(BAREME, taux([100_000, 45]));
  assert.equal(html.match(/simu__ligne--reglee/g)?.length, 1);
});

/* ---------------------------------------------- ce que le dépôt doit tenir */

const PUBLISH = readFileSync(new URL("../../pipeline/plateforme/publish.py", import.meta.url), "utf8");

test("le barème est publié à part, et son assiette est calculée au dépôt", () => {
  assert.match(PUBLISH, /simulateur\/bareme-\{exercice\}\.json/);
  assert.match(PUBLISH, /simulateur\/index-bareme\.json/);
  // La matière taxable ne se recalcule pas dans le navigateur : elle est
  // publiée, donc testable, donc opposable.
  assert.match(PUBLISH, /def masse_au_dessus/);
});

/* ------------------------------ le récapitulatif en comptabilité nationale */

test("le récapitulatif dit d'abord ce qui ne s'additionne pas", async () => {
  const { mention, rendu } = await import("./recapitulatif.ts");
  const recapitulatif = {
    exercice: "2025",
    titre: "Tout l'argent public, en comptabilité nationale",
    cadre: "INSEE, comptes nationaux annuels, exercice 2025…",
    note: "Les budgets réglables du simulateur ne s'additionnent pas entre eux…",
    lignes: [
      { c: "insee_apu_solde_centrales", l: "État", v: -130_254_600_000 },
      { c: "insee_apu_solde_asso", l: "Sécurité sociale", v: -6_722_500_000 },
      { c: "insee_apu_solde_apul", l: "Collectivités", v: -15_554_900_000 },
    ],
    total: { c: "insee_apu_solde", l: "Toutes administrations", v: -152_532_000_000 },
    ecart: 0,
  };
  // L'écart s'affiche même — surtout — quand il vaut zéro : c'est lui qui fait
  // la différence entre « ils se somment » et une affirmation.
  assert.match(mention(recapitulatif), /exactement le total publié/);
  assert.match(mention({ ...recapitulatif, ecart: 1e9 }), /s'écartent de/);
  const html = rendu(recapitulatif);
  assert.match(html, /additionnent pas/);
  assert.equal(html.match(/recap__ligne/g)?.length, 4);
  // Rien à régler : c'est un écran de lecture.
  assert.doesNotMatch(html, /simu__pas|simu__pct/);
});

test("le récapitulatif est publié à part, sur le dernier exercice commun", () => {
  assert.match(PUBLISH, /simulateur\/comptabilite-nationale\.json/);
  // Le dernier exercice **commun** aux quatre séries : un total d'une année
  // face à des composantes d'une autre ferait un écart de plusieurs dizaines de
  // milliards qui ne serait qu'un décalage de millésime.
  assert.match(PUBLISH, /communs = set\.intersection/);
});
