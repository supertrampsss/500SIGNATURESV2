/**
 * Une courbe est une comparaison d'un territoire avec lui-même. Ces tests
 * vérifient qu'elle ne franchit pas une fusion sans le dire — c'est la même
 * règle de périmètre qu'entre deux territoires, appliquée dans le temps.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { evolution, rendu, ruptureDePerimetre, type Evenement } from "./serie.ts";

const FINE = "\u202f";

const SERIE = { "2018": 100, "2019": 110, "2020": 120, "2021": 132 };
const FUSION: Evenement[] = [{ type: "fusion", date: "2020-01-01", avec: "33999" }];
const brut = (v: number) => `${v} €`;

test("sans changement de périmètre, l'évolution part du premier exercice", () => {
  assert.equal(evolution(SERIE, "2021", []).includes(`+32${FINE}% depuis 2018`), true);
});

test("une fusion borne l'évolution au périmètre courant", () => {
  const texte = evolution(SERIE, "2021", FUSION);
  assert.equal(texte.includes(`+10${FINE}% depuis 2020`), true);
  assert.match(texte, /depuis le changement de périmètre/);
  assert.doesNotMatch(texte, /depuis 2018/);
});

test("un événement hors de la série ne borne rien", () => {
  const avant: Evenement[] = [{ type: "fusion", date: "2015-06-01", avec: "33999" }];
  assert.match(evolution(SERIE, "2021", avant), /depuis 2018/);
});

test("la rupture retenue est la plus récente", () => {
  const deux: Evenement[] = [
    { type: "fusion", date: "2019-01-01", avec: "a" },
    { type: "scission", date: "2020-01-01", avec: "b" },
  ];
  assert.equal(ruptureDePerimetre(deux, Object.keys(SERIE)), "2020");
});

test("le graphique marque la rupture et l'écrit en toutes lettres", () => {
  const html = rendu(SERIE, FUSION, brut);
  assert.match(html, /class="serie__rupture"/);
  assert.match(html, /Périmètre modifié en 2020/);
  assert.match(html, /ne portent pas sur le même territoire/);
});

test("sans rupture, ni trait ni avertissement", () => {
  const html = rendu(SERIE, [], brut);
  assert.doesNotMatch(html, /serie__rupture/);
  assert.doesNotMatch(html, /Périmètre modifié/);
});

test("deux points ne font pas une courbe", () => {
  assert.equal(rendu({ "2020": 1, "2021": 2 }, [], brut), "");
});

test("une série plate ne divise pas par zéro", () => {
  const html = rendu({ "2019": 5, "2020": 5, "2021": 5 }, [], brut);
  assert.doesNotMatch(html, /NaN/);
  assert.match(html, /<polyline/);
});

test("le graphique porte un équivalent textuel", () => {
  const html = rendu(SERIE, [], brut);
  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="Évolution 2018 : 100 € — 2021 : 132 €"/);
});

test("une valeur de départ nulle ne produit pas d'infini", () => {
  assert.equal(evolution({ "2019": 0, "2020": 5, "2021": 8 }, "2021", []), "");
});

test("une série recalculée dans la géographie courante ne se coupe pas", () => {
  /*
   * L'INSEE republie les populations légales anciennes dans les communes
   * d'aujourd'hui : Vire Normandie, née en 2016 de huit communes, porte 17 951
   * habitants dès 2013 — le territoire entier. Couper cette série reviendrait à
   * déclarer incomparable ce que le producteur a justement rendu comparable.
   * La fiche traduit ce cas en n'envoyant aucun événement.
   */
  const legales = { "2013": 17951, "2023": 17457 };
  assert.equal(ruptureDePerimetre([], Object.keys(legales)), null);
  assert.equal(evolution(legales, "2023", []).includes(`−2,8${FINE}% depuis 2013`), true);
  assert.doesNotMatch(evolution(legales, "2023", []), /périmètre/);
});
