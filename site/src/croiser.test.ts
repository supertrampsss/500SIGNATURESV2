/**
 * Le r de Pearson affiché doit être le vrai : un coefficient faux dans un
 * outil d'analyse ferait conclure des politiques publiques sur du bruit. Les
 * valeurs attendues sont recalculables à la main.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { enLog, joindre, lectureDeR, moindresCarres, pearson } from "./croiser.ts";

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
