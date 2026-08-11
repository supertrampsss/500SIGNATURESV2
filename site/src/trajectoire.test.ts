/**
 * La boucle dette → intérêts : le mécanisme, et les trois réponses possibles.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { trajectoire, tauxApparent, lecture, HORIZON_MAXIMUM } from "./trajectoire.ts";

/** Chiffres publiés, arrondis : encours 2 889 Md, charge 51,58 Md. */
const DEPART = {
  encours: 2_889e9,
  encoursExercice: "2026-Q1",
  charge: 51.583e9,
  chargeExercice: "2025",
};
const H = (taux: number, horizon = 20) => ({ taux, horizon });

test("le taux apparent est la charge publiée sur l'encours publié", () => {
  assert.equal(Math.round(tauxApparent(DEPART) * 100) / 100, 1.79);
});

test("les intérêts suivent la dette, ils ne se règlent pas", () => {
  // 1 000 de dette à 2 %, solde primaire nul : 20 d'intérêts, donc 20 de dette
  // en plus. Un budget à l'équilibre primaire laisse encore la dette monter.
  const t = trajectoire({ ...DEPART, encours: 1000, charge: 20 }, 0, H(2, 3));
  assert.deepEqual(
    t.annees.map((a) => Math.round(a.interets)),
    [20, 20, 21],
  );
  assert.deepEqual(
    t.annees.map((a) => Math.round(a.dette)),
    [1020, 1040, 1061],
  );
  assert.equal(t.stabilisation, null);
});

test("un excédent primaire fait baisser la dette de plus en plus vite", () => {
  // À mesure que la dette baisse, les intérêts s'allègent, donc le solde
  // s'améliore sans qu'aucun geste ne s'ajoute.
  const t = trajectoire({ ...DEPART, encours: 1000, charge: 20 }, 100, H(2, 3));
  const baisses = t.annees.map((a, i) => (i ? t.annees[i - 1].dette : 1000) - a.dette);
  assert.ok(baisses[1] > baisses[0], "la deuxième année baisse plus que la première");
  assert.ok(baisses[2] > baisses[1], "la troisième baisse plus que la deuxième");
});

test("l'extinction est datée, et la trajectoire s'arrête là", () => {
  const t = trajectoire({ ...DEPART, encours: 1000, charge: 20 }, 400, H(2, 20));
  assert.equal(t.extinction, 3);
  assert.equal(t.annees.length, 3);
  assert.equal(t.annees[2].dette, 0);
});

test("la dette ne passe jamais sous zéro : on s'arrête à l'extinction", () => {
  const t = trajectoire({ ...DEPART, encours: 1000, charge: 20 }, 5000, H(2, 20));
  assert.equal(t.extinction, 1);
  assert.equal(t.annees[0].dette, 0);
});

test("une dette qui se stabilise sans s'éteindre se dit comme telle", () => {
  const t = trajectoire({ ...DEPART, encours: 1000, charge: 20 }, 20, H(2, 5));
  assert.equal(t.extinction, null);
  assert.equal(t.stabilisation, 1);
  assert.match(lecture(t, 5), /cesse d'augmenter la première année, sans s'éteindre en 5 ans/);
});

test("une dette qui monte tout du long se dit aussi", () => {
  const t = trajectoire({ ...DEPART, encours: 1000, charge: 20 }, -50, H(2, 5));
  assert.equal(t.extinction, null);
  assert.equal(t.stabilisation, null);
  assert.match(lecture(t, 5), /augmente pendant les 5 années projetées/);
});

test("le taux est une hypothèse : le changer change tout", () => {
  const bas = trajectoire(DEPART, 60e9, H(1));
  const haut = trajectoire(DEPART, 60e9, H(4));
  assert.ok(bas.annees[19].dette < haut.annees[19].dette);
  // Au taux apparent publié, 60 Md d'excédent primaire ne suffisent pas à
  // éteindre 2 889 Md en vingt ans — le dire est le résultat, pas un échec.
  assert.equal(trajectoire(DEPART, 60e9, H(1.79)).extinction, null);
});

test("l'horizon est borné, et une valeur folle ne boucle pas", () => {
  assert.equal(trajectoire(DEPART, -100e9, H(1.79, 9999)).annees.length, HORIZON_MAXIMUM);
  assert.equal(trajectoire(DEPART, -100e9, H(1.79, 0)).annees.length, 1);
});

test("le solde primaire est hors intérêts : c'est la seule part qu'on règle", () => {
  const t = trajectoire({ ...DEPART, encours: 1000, charge: 20 }, 100, H(2, 1));
  assert.equal(t.soldePrimaire, 100);
  assert.equal(Math.round(t.annees[0].solde), 80);
});
