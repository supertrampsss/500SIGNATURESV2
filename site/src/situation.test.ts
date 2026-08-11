/**
 * Le rang dans la maille : la convention de classement, et les refus.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { situation, rendreSituation } from "./situation.ts";

const VALEURS: Record<string, number | null> = { a: 100, b: 300, c: 200, d: null, e: 300 };
const CRITERE = {
  libelle: "Dépenses de fonctionnement par habitant",
  sens: "de la plus élevée à la plus faible",
  valeur: (code: string) => VALEURS[code] ?? null,
};
const CODES = ["a", "b", "c", "d", "e"];

test("le rang se compte du plus élevé au plus bas", () => {
  const [r] = situation({ code: "c", codes: CODES, criteres: [CRITERE] });
  assert.equal(r.rang, 3);
});

test("les ex æquo prennent le même rang, et le suivant saute", () => {
  // Convention du classement sportif : deux premiers ex æquo, puis un 3e.
  assert.equal(situation({ code: "b", codes: CODES, criteres: [CRITERE] })[0].rang, 1);
  assert.equal(situation({ code: "e", codes: CODES, criteres: [CRITERE] })[0].rang, 1);
  assert.equal(situation({ code: "c", codes: CODES, criteres: [CRITERE] })[0].rang, 3);
});

test("le dénombrement ne compte que les territoires qui publient", () => {
  // « 412e sur 34 875 » se dit sur ceux qui publient, pas sur ceux qui existent :
  // `d` ne publie rien et sort du dénominateur.
  assert.equal(situation({ code: "a", codes: CODES, criteres: [CRITERE] })[0].effectif, 4);
});

test("un territoire qui ne publie pas n'a pas de ligne", () => {
  assert.deepEqual(situation({ code: "d", codes: CODES, criteres: [CRITERE] }), []);
});

test("il faut au moins deux valeurs pour qu'un rang existe", () => {
  assert.deepEqual(
    situation({ code: "a", codes: ["a"], criteres: [CRITERE] }),
    [],
  );
});

test("le rendu dit le rang, l'effectif, la maille et le sens du classement", () => {
  const html = rendreSituation(
    situation({ code: "c", codes: CODES, criteres: [CRITERE] }),
    "commune",
    "2025",
  );
  assert.match(html, /Où ça se situe/);
  assert.match(html, /3<sup>e<\/sup>/);
  assert.match(html, /sur 4 communes qui publient ce chiffre, de la plus élevée à la plus faible/);
  assert.match(html, /Exercice 2025\./);
});

test("le premier prend « er », pas « e »", () => {
  const html = rendreSituation(
    situation({ code: "b", codes: CODES, criteres: [CRITERE] }),
    "commune",
    "2025",
  );
  assert.match(html, /1<sup>er<\/sup>/);
});

test("la France n'a personne à qui se comparer : rien ne s'écrit", () => {
  assert.equal(
    rendreSituation(situation({ code: "c", codes: CODES, criteres: [CRITERE] }), "pays", "2025"),
    "",
  );
});

test("aucun montant par habitant n'est affiché, seulement le rang", () => {
  // Le dénominateur sert au classement ; le montant par habitant n'a sa place
  // que dans un tableau déplié.
  const html = rendreSituation(
    situation({ code: "c", codes: CODES, criteres: [CRITERE] }),
    "commune",
    "2025",
  );
  assert.doesNotMatch(html, /€/);
  assert.doesNotMatch(html, /[—–]/);
});
