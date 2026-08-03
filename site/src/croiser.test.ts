/**
 * Le r de Pearson affiché doit être le vrai : un coefficient faux dans un
 * outil d'analyse ferait conclure des politiques publiques sur du bruit. Les
 * valeurs attendues sont recalculables à la main.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  couleurCellule,
  enLog,
  joindre,
  lectureDeR,
  matrice,
  moindresCarres,
  paires,
  pearson,
} from "./croiser.ts";

const droite = (n: number, pente: number, bruit = 0) =>
  Array.from({ length: n }, (_, i) => ({ x: i + 1, y: pente * (i + 1) + (i % 2 ? bruit : -bruit) }));

test("une relation parfaitement linéaire donne r = ±1", () => {
  assert.ok(Math.abs((pearson(droite(10, 2)) as number) - 1) < 1e-12);
  assert.ok(Math.abs((pearson(droite(10, -3)) as number) + 1) < 1e-12);
});

test("un nuage sans relation donne un r proche de zéro", () => {
  // x alterné, y en dents de scie décorrélées
  const points = [1, 2, 3, 4, 5, 6, 7, 8].map((x, i) => ({ x, y: [5, 1, 5, 1, 1, 5, 1, 5][i] }));
  assert.ok(Math.abs(pearson(points) as number) < 0.05);
});

test("moins de huit points : pas de coefficient, et la lecture le dit", () => {
  assert.equal(pearson(droite(7, 1)), null);
  assert.match(lectureDeR(null, 7), /Trop peu de territoires/);
});

test("la lecture emploie les mots de la statistique, jamais un jugement", () => {
  assert.match(lectureDeR(0.85, 100), /forte et positive/);
  assert.match(lectureDeR(-0.5, 100), /modérée et négative/);
  assert.match(lectureDeR(0.05, 100), /quasi nulle/);
  assert.doesNotMatch(lectureDeR(0.85, 100), /bonne|mauvaise/);
});

test("la droite des moindres carrés retrouve pente et ordonnée", () => {
  const d = moindresCarres(droite(20, 2.5)) as { a: number; b: number };
  assert.ok(Math.abs(d.a - 2.5) < 1e-9);
  assert.ok(Math.abs(d.b) < 1e-9);
});

test("la jointure croise par code et ramène par habitant chaque axe selon sa règle", () => {
  const points = joindre(
    { A: 1000, B: 2000, C: 3000 },
    { A: 10, B: 20 },
    { A: "Alpha", B: "Bravo" },
    { A: 100, B: 200 },
    true,
    false,
  );
  assert.deepEqual(points, [
    { code: "A", nom: "Alpha", x: 10, y: 10 },
    { code: "B", nom: "Bravo", x: 10, y: 20 },
  ]);
});

test("un territoire sans population ne produit pas de point par habitant", () => {
  const points = joindre({ A: 100 }, { A: 5 }, {}, {}, true, false);
  assert.deepEqual(points, []);
});

test("le passage en log refuse dès qu'une valeur n'est pas strictement positive", () => {
  assert.equal(enLog([{ code: "A", nom: "A", x: 0, y: 5 }]), null);
  const log = enLog([{ code: "A", nom: "A", x: 100, y: 10 }]) as { x: number; y: number }[];
  assert.ok(Math.abs(log[0].x - 2) < 1e-12 && Math.abs(log[0].y - 1) < 1e-12);
});

test("la matrice est symétrique, diagonale à 1, et porte son n par cellule", () => {
  const populations = { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1, I: 1 };
  const codes = Object.keys(populations);
  const serie = (f: (k: number) => number) =>
    Object.fromEntries(codes.map((c, k) => [c, f(k)]));
  const cellules = matrice(
    [
      { id: "x", libelle: "X", valeurs: serie((k) => k + 1), parHabitant: false },
      { id: "y", libelle: "Y", valeurs: serie((k) => 2 * (k + 1)), parHabitant: false },
      // couverture partielle : seules cinq communes portent z
      {
        id: "z",
        libelle: "Z",
        valeurs: Object.fromEntries(codes.slice(0, 5).map((c, k) => [c, 10 - k])),
        parHabitant: false,
      },
    ],
    populations,
  );
  const cellule = (i: number, j: number) => cellules.find((c) => c.i === i && c.j === j);
  assert.equal(cellule(0, 0)?.r, 1);
  assert.ok(Math.abs((cellule(1, 0)?.r as number) - 1) < 1e-12); // y = 2x
  // z ne couvre que cinq territoires : sous le seuil, pas de coefficient
  assert.equal(cellule(2, 0)?.r, null);
  assert.equal(cellule(2, 0)?.n, 5);
});

test("la couleur d'une cellule suit le signe et la force, jamais l'inverse", () => {
  assert.match(couleurCellule(0.9), /rgb\(15 27 46/);
  assert.match(couleurCellule(-0.9), /rgb\(197 106 77/);
  const faible = couleurCellule(0.05);
  const forte = couleurCellule(0.95);
  const alpha = (c: string) => Number(c.match(/\/ ([\d.]+)\)/)?.[1]);
  assert.ok(alpha(faible) < alpha(forte));
  assert.equal(couleurCellule(null), "transparent");
});

test("les paires les plus corrélées sortent en tête, signe compris", () => {
  const series = [
    { id: "a", libelle: "A", valeurs: {}, parHabitant: false },
    { id: "b", libelle: "B", valeurs: {}, parHabitant: false },
    { id: "c", libelle: "C", valeurs: {}, parHabitant: false },
  ];
  const cellules = [
    { i: 0, j: 0, r: 1, n: 10 },
    { i: 1, j: 0, r: -0.92, n: 10 },
    { i: 2, j: 0, r: 0.31, n: 10 },
    { i: 2, j: 1, r: null, n: 3 },
  ];
  const top = paires(cellules, series, 2);
  assert.equal(top.length, 2);
  assert.equal(top[0].r, -0.92);
  assert.equal(top[0].a, "B");
  assert.equal(top[1].r, 0.31);
});
