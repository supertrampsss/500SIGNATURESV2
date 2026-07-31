/**
 * La logique d'affichage décide de ce que le lecteur croit voir : des bornes de
 * classes fausses ou une division par la mauvaise population produiraient une
 * carte trompeuse tout en restant « techniquement » fonctionnelle.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { expressionCouleur, formater, quantiles } from "./echelle.ts";

test("les classes répartissent les territoires en parts égales", () => {
  const echelle = quantiles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], 7);
  assert.equal(echelle.couleurs.length, 7);
  assert.equal(echelle.bornes.length, 6);
  // bornes strictement croissantes : sinon deux classes se confondent
  for (let i = 1; i < echelle.bornes.length; i += 1) {
    assert.ok(echelle.bornes[i] > echelle.bornes[i - 1]);
  }
});

test("une valeur extrême n'écrase pas l'échelle", () => {
  const echelle = quantiles([1, 1, 1, 1, 1, 1, 1, 1_000_000_000], 4);
  // le milieu reste dans la masse des valeurs, pas tiré par l'extrême
  assert.ok(echelle.bornes[1] < 10);
});

test("aucune classe sans donnée", () => {
  assert.deepEqual(quantiles([]), { bornes: [], couleurs: [] });
});

test("un territoire sans population n'est pas colorié par habitant", () => {
  const expression = expressionCouleur(
    { "33318": 1000, "99999": 2000 },
    quantiles([10, 20, 30], 3),
    true,
    { "33318": 100 },
  ) as unknown[];
  const codes = expression.filter((x) => typeof x === "string" && /^\d{5}$/.test(x));
  assert.deepEqual(codes, ["33318"]); // 99999 n'a pas de dénominateur : écarté
});

test("les montants gardent leur unité et leur ordre de grandeur", () => {
  assert.match(formater(30_761_441, "EUR", false), /30,8\s?M€/);
  assert.match(formater(999_000_000, "EUR", false), /M€/);
  // Un budget d'État se lit en milliards : « 441 194,3 M€ » est exact et illisible.
  assert.match(formater(441_194_313_369.76, "EUR", false), /441,2\s?Md€/);
  assert.match(formater(-124_205_673_501.55, "EUR", false), /124,2\s?Md€/);
  assert.match(formater(456, "EUR", true), /456/);
  assert.equal(formater(67_339, "count", false), "67 339".replace(" ", " "));
});
