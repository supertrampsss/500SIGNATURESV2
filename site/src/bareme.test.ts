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
  quiPaie,
  regler,
  rendement,
  tauxMoyen,
  tauxMoyenDesConcernes,
  type Bareme,
  type Taux,
} from "./bareme.ts";

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

test("trois modes, et trois seulement", () => {
  // Vingt-cinq champs de pourcentage reposaient la question vingt-cinq fois.
  assert.deepEqual(MODELES.map((m) => m.cle), ["france", "unique", "suisse"]);
  const formes = MODELES.map((m) => encoder(appliquer(BAREME, m, 7)));
  assert.equal(new Set(formes).size, 3);
  assert.ok(MODELES.every((m) => rendement(BAREME, appliquer(BAREME, m, 7)) > 0));
  // Le taux unique touche le premier euro de chaque foyer ; les deux barèmes
  // progressifs ne le touchent pas. C'est toute leur différence.
  assert.equal(appliquer(BAREME, MODELES[1], 7).get(0), 7);
  assert.equal(appliquer(BAREME, MODELES[0]).get(0), undefined);
  assert.equal(appliquer(BAREME, MODELES[2]).get(0), undefined);
});

test("le curseur du taux unique pose le même taux partout", () => {
  const taux = appliquer(BAREME, MODELES[1], 12.5);
  assert.deepEqual([...new Set(taux.values())], [12.5]);
  assert.equal(rendement(BAREME, taux), 0.125 * BAREME.revenu_total);
});

test("le barème suisse ne prétend pas dire ce que paie un Suisse", () => {
  // L'impôt fédéral direct plafonne à 11,5 % ; le cantonal et le communal
  // s'y ajoutent et pèsent plus lourd. Le taire ferait croire l'inverse.
  const suisse = MODELES[2];
  assert.match(suisse.aide, /cantonal/);
  assert.equal(Math.max(...Object.values(suisse.taux)), 11.5);
});

test("un lien partagé ne règle que des bornes que le millésime porte", () => {
  assert.equal(encoder(decoder("20000:12,100000:45", BAREME)), "20000:12,100000:45");
  // 45 000 € n'est pas une borne publiée : l'accepter obligerait à supposer
  // comment les revenus se répartissent dans la tranche, ce que ce simulateur
  // refuse de faire.
  assert.equal(encoder(decoder("45000:30", BAREME)), "");
  assert.equal(encoder(new Map()), "");
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

test("le récapitulatif est publié à part, sur le dernier exercice commun", () => {
  assert.match(PUBLISH, /simulateur\/comptabilite-nationale\.json/);
  // Le dernier exercice **commun** aux quatre séries : un total d'une année
  // face à des composantes d'une autre ferait un écart de plusieurs dizaines de
  // milliards qui ne serait qu'un décalage de millésime.
  assert.match(PUBLISH, /communs = set\.intersection/);
});

test("un barème redessiné dit qui paie plus et qui paie moins", () => {
  // « Vous levez un impôt » est faux dès qu'on redessine : baisser la tranche
  // basse et lever la haute fait des gagnants et des perdants, et c'est cette
  // répartition qui informe, pas le rendement agrégé.
  const bareme: Bareme = {
    exercice: "2024",
    titre: "Essai",
    cadre: "Essai",
    note: "Essai",
    foyers: 100,
    revenu_total: 1000,
    impot_emis: 0,
    tranches: [
      { b: 0, fa: 100, r: 0, a: 1000, i: 0 },
      { b: 10, fa: 40, r: 0, a: 900, i: 0 },
      { b: 100, fa: 10, r: 0, a: 500, i: 0 },
    ],
  };
  const depart: Taux = new Map([
    [0, 10],
    [10, 10],
    [100, 10],
  ]);
  // La première tranche tombe à 0, la dernière monte à 50.
  const refait: Taux = new Map([
    [10, 10],
    [100, 50],
  ]);
  const dit = quiPaie(bareme, refait, depart)!;
  // Les 60 foyers de la première tranche gagnent 1 € (10 % de 10) et ne
  // remontent jamais ; les 30 de la deuxième aussi. Les 10 de la dernière
  // partent de −1 € mais leur taux marginal bondit de 40 points.
  assert.equal(dit.paientMoins, 90);
  assert.equal(dit.paientPlus, 10);
});

test("un barème inchangé ne dit rien", () => {
  const bareme: Bareme = {
    exercice: "2024",
    titre: "Essai",
    cadre: "Essai",
    note: "Essai",
    foyers: 10,
    revenu_total: 100,
    impot_emis: 0,
    tranches: [{ b: 0, fa: 10, r: 0, a: 100, i: 0 }],
  };
  assert.equal(quiPaie(bareme, new Map([[0, 10]]), new Map([[0, 10]])), null);
});
