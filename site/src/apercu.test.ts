/**
 * L'aperçu est ce que le lecteur voit avant d'avoir rien choisi : il doit être
 * exact ou absent, jamais approximatif.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Indicateur } from "./donnees.ts";
import { rendu, resumer } from "./apercu.ts";

const NOMS = { a: "Alpha", b: "Beta", c: "Gamma", d: "Delta", e: "Epsilon", f: "Zeta" };
const VALEURS = { a: 100, b: 200, c: 300, d: 400, e: 500, f: 600 };
const INDICATEUR = { libelle: "Dépenses de fonctionnement", unite: "EUR" } as Indicateur;

test("une couche trop maigre n'est pas résumée", () => {
  assert.equal(resumer({ a: 1, b: 2 }, NOMS), null);
  assert.ok(resumer(VALEURS, NOMS));
});

test("les extrêmes sont nommés, pas seulement chiffrés", () => {
  const apercu = resumer(VALEURS, NOMS)!;
  assert.deepEqual(apercu.bas, { code: "a", nom: "Alpha", valeur: 100 });
  assert.deepEqual(apercu.haut, { code: "f", nom: "Zeta", valeur: 600 });
});

test("la médiane décrit la masse et les quartiles l'encadrent", () => {
  const apercu = resumer(VALEURS, NOMS)!;
  assert.equal(apercu.effectif, 6);
  assert.ok(apercu.q1 <= apercu.mediane && apercu.mediane <= apercu.q3);
});

test("aucune moyenne n'est affichée, et la raison est écrite", () => {
  const html = rendu(resumer(VALEURS, NOMS), INDICATEUR, "commune", "2024", true);
  // Aucune ligne de valeur intitulée « moyenne » — seule la phrase qui explique
  // pourquoi elle est absente emploie le mot.
  assert.doesNotMatch(html, /<span>Moyenne<\/span>/i);
  assert.match(html, /Aucune moyenne/);
  assert.match(html, /6 communes avec une valeur/);
});

test("sans aperçu, le panneau garde son invitation", () => {
  const html = rendu(null, INDICATEUR, "commune", "2024", true);
  assert.match(html, /Choisissez un territoire/);
});
