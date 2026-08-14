/**
 * Le jargon comptable traduit en français lisible. Le fichier existait, vide,
 * alors que chaque libellé d'indicateur passe par ce module avant l'écran.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { accentuer, TRADUCTIONS, traduire } from "./traductions.ts";

test("un sigle de comptable public se dit en français, sigle conservé", () => {
  // Le sigle reste entre parenthèses pour qui le connaît : la traduction
  // vulgarise sans effacer le vocabulaire de la source.
  assert.equal(traduire("FCTVA"), "TVA remboursée par l'État (FCTVA)");
  assert.equal(traduire("Dépenses d'intervention"), "Aides et subventions versées");
});

test("un libellé hors table ressort intact, à l'accentuation près", () => {
  // Le repli ne doit ni vider la chaîne ni lever : un indicateur nouveau
  // s'affiche sous son nom de source. Mais il passe quand même par
  // `accentuer` — c'est le contrat de `traduire`, pas un accident.
  assert.equal(traduire("Un libellé qui n'est dans aucune table"), "Un libellé qui n'est dans aucune table");
  assert.equal(traduire("Concours de l'Etat"), "Concours de l'État");
  assert.equal(traduire(""), "");
});

test("l'accentuation corrige des mots entiers, jamais une règle aveugle", () => {
  // Accentuer tout « Et » initial casserait « et » comme « Et si » : la table
  // ne porte que des mots entiers, bornés.
  assert.equal(accentuer("Etats et Etat"), "États et État");
  assert.equal(accentuer("et pourtant"), "et pourtant");
  // La faute de frappe de la nomenclature OFGL, corrigée en mot entier.
  assert.equal(accentuer("Taxe d'enlévement des ordures ménagères"), "Taxe d'enlèvement des ordures ménagères");
});

test("chaque traduction de la table est elle-même correctement accentuée", () => {
  // Garde : une table vidée par erreur ferait passer la boucle ci-dessous à
  // vide, silencieusement. Sans elle, le test suivant serait vert à vide.
  assert.ok(Object.keys(TRADUCTIONS).length >= 15, "la table des traductions semble incomplète ou vidée");
  // Une traduction dont la valeur porterait une capitale non accentuée
  // referait à l'écran la faute que la table existe pour corriger.
  for (const [source, cible] of Object.entries(TRADUCTIONS)) {
    assert.equal(cible, accentuer(cible), `« ${source} » se traduit par un libellé mal accentué`);
  }
});

test("aucun tiret cadratin ni demi-cadratin dans les traductions publiées", () => {
  // Même règle que côté pipeline (test_typographie_definitions.py) : ces
  // libellés sont rendus mot pour mot à l'écran, un tiret cadratin s'y voit.
  assert.ok(Object.keys(TRADUCTIONS).length >= 15, "la table des traductions semble incomplète ou vidée");
  for (const [source, cible] of Object.entries(TRADUCTIONS)) {
    assert.ok(!cible.includes("—"), `« ${source} » : tiret cadratin dans la traduction publiée`);
    assert.ok(!cible.includes("–"), `« ${source} » : tiret demi-cadratin dans la traduction publiée`);
  }
});
