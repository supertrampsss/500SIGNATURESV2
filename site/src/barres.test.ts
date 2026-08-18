/**
 * Les barres de magnitude : ce qu'une figure doit garantir pour ne pas mentir.
 *
 * Une barre est un rapport de longueurs. Les trois choses qui la rendent fausse
 * — une échelle qui ne part pas de zéro, un maximum pris ailleurs que dans les
 * données, un regroupement peint comme un poste — ne se voient pas à l'œil sur
 * une figure isolée : elles se voient ici.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { barresMagnitude, type Part } from "./barres.ts";

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

const VENTILATION: Part[] = [
  { libelle: "Retraites", valeur: 24.09 },
  { libelle: "Chômage", valeur: 2.7 },
  { libelle: "Hors protection sociale", valeur: 0.41, regroupement: true },
];

function largeurs(html: string): number[] {
  return [...html.matchAll(/width:([0-9.]+)%/g)].map((m) => Number(m[1]));
}

test("la longueur est proportionnelle à la valeur, sur une échelle qui part de zéro", () => {
  // C'est LA garantie d'une barre. Une échelle tronquée — commencée à la plus
  // petite valeur plutôt qu'à zéro — ferait lire « deux fois » là où le rapport
  // est de un à neuf, et rien dans la figure ne le dirait.
  const [retraites, chomage, reste] = largeurs(barresMagnitude("t", VENTILATION, euros));
  assert.equal(retraites, 100);
  assert.equal(chomage, Number(((2.7 / 24.09) * 100).toFixed(2)));
  assert.equal(reste, Number(((0.41 / 24.09) * 100).toFixed(2)));
  // Le rapport dessiné est le rapport des nombres : neuf fois.
  assert.ok(Math.abs(retraites / chomage - 24.09 / 2.7) < 0.01);
});

test("le maximum vient des données affichées, jamais d'ailleurs", () => {
  // Une même figure rendue sur un sous-ensemble doit se renormaliser : sinon la
  // plus grande barre d'un tableau filtré resterait courte sans raison visible.
  const [premiere] = largeurs(barresMagnitude("t", VENTILATION.slice(1), euros));
  assert.equal(premiere, 100);
});

test("un regroupement ne prend pas la teinte d'un poste", () => {
  // « Ce qui reste » n'est pas une catégorie nommée : peint comme les autres,
  // il se lirait comme un poste de plus.
  const html = barresMagnitude("t", VENTILATION, euros);
  const rangs = html.split("<li");
  assert.doesNotMatch(rangs[1], /barres__marque--reste/);
  assert.match(rangs[3], /barres__marque--reste/);
});

test("chaque barre porte son libellé et sa valeur : l'identité ne tient pas à la couleur", () => {
  const html = barresMagnitude("Pour 100 € encaissés", VENTILATION, euros);
  for (const attendu of ["Retraites", "24,09 €", "Chômage", "2,70 €", "Pour 100 € encaissés"]) {
    assert.ok(html.includes(attendu), attendu);
  }
});

test("le formatage vient de l'appelant, pas de la figure", () => {
  // La figure ne connaît pas l'unité de ce qu'elle dessine. Si elle la
  // décidait, elle afficherait des euros sur des points de pourcentage.
  const html = barresMagnitude("t", [{ libelle: "Taux", valeur: 12.5 }], (v) => `${v} points`);
  assert.match(html, /12\.5 points/);
  assert.doesNotMatch(html, /€/);
});

test("rien n'est peint quand rien n'est mesurable", () => {
  assert.equal(barresMagnitude("t", [], euros), "");
  assert.equal(barresMagnitude("t", [{ libelle: "Néant", valeur: 0 }], euros), "");
});

test("les libellés sont échappés", () => {
  const html = barresMagnitude("t", [{ libelle: '<img src=x onerror="a">', valeur: 1 }], euros);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});
