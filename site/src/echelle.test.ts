/**
 * La logique d'affichage décide de ce que le lecteur croit voir : des bornes de
 * classes fausses ou une division par la mauvaise population produiraient une
 * carte trompeuse tout en restant « techniquement » fonctionnelle.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { expressionCouleur, formater, noteEchelle, parHabitantAUnSens, quantiles } from "./echelle.ts";

const FINE = "\u202f";

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

test("une médiane ne se divise pas par la population", () => {
  // Un budget communal ramené à l'habitant a un sens ; un niveau de vie médian
  // est déjà une valeur par personne, et une médiane ne s'additionne pas.
  assert.equal(parHabitantAUnSens({ unite: "EUR", sommable: true }), true);
  assert.equal(parHabitantAUnSens({ unite: "EUR", sommable: false }), false);
  assert.equal(parHabitantAUnSens({ unite: "percent", sommable: false }), false);
  // Catalogue ancien, sans le champ : on garde le comportement d'avant.
  assert.equal(parHabitantAUnSens({ unite: "EUR" }), true);
});

/*
 * Un taux affiché en euros est l'erreur que ce site existe pour ne pas
 * commettre. Elle a été trouvée en regardant la page : le taux de pauvreté de
 * Sainte-Foy-la-Grande, 51 %, s'affichait « 51 € », et la légende affirmait
 * « Montants en euros courants ». Ces tests la clouent.
 */
test("un taux se formate en pourcentage, jamais en euros", () => {
  // FINE = espace fine insécable U+202F, exigée avant % en typographie française
  assert.equal(formater(51, "percent", false), `51${FINE}%`);
  assert.equal(formater(12.4, "percent", false), `12,4${FINE}%`);
  assert.equal(formater(117.5, "percent", false), `117,5${FINE}%`);
  assert.doesNotMatch(formater(51, "percent", false), /€/);
});

test("le pourcentage n'est pas multiplié par cent", () => {
  // les valeurs publiées sont déjà en points de pourcentage
  assert.match(formater(7.7, "percent", false), /^7,7/);
});

test("un taux négatif garde son signe", () => {
  assert.match(formater(-5.1, "percent", false), /^-5,1/);
});

test("le séparateur décimal est français partout", () => {
  for (const rendu of [
    formater(12.4, "percent", false),
    formater(1.23e9, "EUR", false),
    formater(4567, "count", false),
  ]) {
    assert.doesNotMatch(rendu, /\d\.\d/, rendu);
  }
});

test("la note de légende suit l'unité au lieu de l'affirmer", () => {
  assert.match(noteEchelle("percent", false), /pourcentage/);
  assert.doesNotMatch(noteEchelle("percent", false), /euros/);
  assert.match(noteEchelle("EUR", false), /euros courants/);
  assert.match(noteEchelle("count", false), /Effectifs/);
  assert.match(noteEchelle("EUR", true), /population de référence/);
});
