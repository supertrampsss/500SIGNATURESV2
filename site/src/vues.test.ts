/**
 * 129 communes françaises sont en outre-mer. Elles étaient dans les données,
 * dans les tuiles et dans la recherche — et introuvables sur la carte, qui
 * s'ouvrait sur un cadrage figé de la métropole.
 */

import { niveauPourZoom } from "./mailles.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const SOURCE = readFileSync(new URL("./main.ts", import.meta.url), "utf8");

test("les cinq départements d'outre-mer ont une vue", () => {
  for (const nom of ["guadeloupe", "martinique", "guyane", "reunion", "mayotte"]) {
    assert.match(SOURCE, new RegExp(`\\b${nom}:`), nom);
  }
});

test("chaque préfixe de code mène à sa vue", () => {
  for (const [prefixe, vue] of [
    ["971", "guadeloupe"],
    ["972", "martinique"],
    ["973", "guyane"],
    ["974", "reunion"],
    ["976", "mayotte"],
  ]) {
    assert.match(SOURCE, new RegExp(`"${prefixe}": "${vue}"`), prefixe);
  }
});

test("la carte se cadre sur des bornes, pas sur un centre figé", () => {
  // Un centre et un zoom fixes ne s'adaptent pas à la taille du conteneur, et
  // laissaient la France décentrée avec du vide à droite.
  assert.match(SOURCE, /bounds: VUES\[etat\.vue\]/);
  assert.doesNotMatch(SOURCE, /center: \[2\.4, 46\.6\]/);
});

test("ouvrir une fiche entraîne la carte", () => {
  assert.match(SOURCE, /async function montrerFiche[^}]*suivreLaSelection\(code\)/s);
});

test("la vue voyage dans l'URL, comme le reste de l'état", () => {
  assert.match(SOURCE, /p\.set\("vue", etat\.vue\)/);
  assert.match(SOURCE, /p\.get\("vue"\)/);
});

test("la maille suit le zoom : régions de loin, communes de près", () => {
  // On zoomait sur une ville en gardant la couche des régions, et la carte
  // semblait ne rien avoir de plus fin — personne ne pensait au sélecteur.
  assert.equal(niveauPourZoom(4.5), "region");
  assert.equal(niveauPourZoom(6.2), "departement");
  assert.equal(niveauPourZoom(7.5), "departement");
  assert.equal(niveauPourZoom(8), "epci");
  assert.equal(niveauPourZoom(9), "commune");
  assert.equal(niveauPourZoom(13), "commune");
});
