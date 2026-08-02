/**
 * Un CSV qui s'ouvre mal dans Excel français est un CSV que personne ne lira :
 * ces tests verrouillent les conventions tableur (BOM, point-virgule, virgule
 * décimale) et la règle « un chiffre ne voyage pas seul » — l'en-tête doit
 * nommer l'indicateur, la source et la licence.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { enCsv, nomDeFichier, uniteLisible } from "./export.ts";

const QUAND = new Date("2026-08-02T14:00:00Z");
const META = {
  indicateur: "Dépenses de fonctionnement",
  unite: "EUR",
  periode: "2024",
  niveau: "commune",
  parHabitant: true,
  source: "OFGL — Comptes des communes",
};

test("le fichier s'ouvre en français : BOM, point-virgule, virgule décimale, CRLF", () => {
  const csv = enCsv([{ code: "33318", nom: "Pessac", valeur: 1234.567 }], META, QUAND);
  assert.ok(csv.startsWith("\uFEFF"), "BOM UTF-8 absent : Excel lirait les accents en mojibake");
  const lignes = csv.slice(1).split("\r\n");
  assert.equal(lignes[3], "code;territoire;valeur;unite;periode;niveau");
  assert.equal(lignes[4], "33318;Pessac;1234,57;euros par habitant;2024;commune");
  assert.equal(lignes.at(-1), "", "le fichier se termine par une fin de ligne");
  assert.ok(!csv.slice(1).includes("\n\r"), "fins de ligne CRLF uniquement");
});

test("l'en-tête nomme l'indicateur, la source, la date et la licence", () => {
  const csv = enCsv([], META, QUAND);
  const lignes = csv.slice(1).split("\r\n");
  assert.equal(lignes[0], "# Dépenses de fonctionnement — 2024");
  assert.equal(lignes[1], "# Source : OFGL — Comptes des communes · exporté le 2026-08-02");
  assert.match(lignes[2], /^# Licence Ouverte 2\.0\./);
});

test("un nom qui contient le séparateur ou des guillemets est cité, pas cassé", () => {
  const csv = enCsv(
    [{ code: "01", nom: 'Saint-Martin; dit "le Haut"', valeur: 2 }],
    META,
    QUAND,
  );
  assert.ok(csv.includes('"Saint-Martin; dit ""le Haut""";2;'));
});

test("l'arrondi au centième est une vue tableur, pas une précision inventée", () => {
  const csv = enCsv([{ code: "01", nom: "A", valeur: 871.6666666667 }], META, QUAND);
  assert.ok(csv.includes(";871,67;"));
  const entier = enCsv([{ code: "01", nom: "A", valeur: 42 }], META, QUAND);
  assert.ok(entier.includes(";42;"), "un entier reste un entier, sans décimales cosmétiques");
});

test("l'unité se lit dans un tableur, et une unité inconnue reste elle-même", () => {
  assert.equal(uniteLisible("EUR", false), "euros");
  assert.equal(uniteLisible("EUR", true), "euros par habitant");
  assert.equal(uniteLisible("percent", false), "%");
  assert.equal(uniteLisible("count", false), "nombre");
  // La règle d'echelle.ts vaut aussi ici : jamais convertir l'inconnu en euros.
  assert.equal(uniteLisible("PC_GDP", false), "PC_GDP");
});

test("le nom de fichier dit ce qu'il contient, sans accents ni surprises", () => {
  assert.equal(
    nomDeFichier("Dépenses de fonctionnement", "commune", "2024"),
    "depenses-de-fonctionnement-commune-2024.csv",
  );
  assert.equal(
    nomDeFichier("Taux global de taxe foncière (bâti)", "commune", "2025"),
    "taux-global-de-taxe-fonciere-bati-commune-2025.csv",
  );
});
