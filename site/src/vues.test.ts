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
  assert.equal(niveauPourZoom(9), "commune");
  assert.equal(niveauPourZoom(13), "commune");
});

test("la fiche d'un arrondissement s'ouvre sans faire changer la carte de couche", () => {
  // Deux mailles, pas une : celle que la carte peint, et celle du territoire
  // ouvert. Les confondre ferait demander `remplissage-undefined` à MapLibre
  // dès qu'on ouvre Paris 1er depuis la recherche.
  assert.match(SOURCE, /function niveauSelection\(\): string \{\s*return etat\.maille \?\? etat\.niveau;/);
  assert.match(SOURCE, /async function montrerFiche[^}]*const niveau = niveauSelection\(\)/s);
  // La maille de la carte se valide sur les couches de tuiles, pas sur les
  // mailles cherchables : `?niveau=arrondissement_municipal` ne doit pas passer.
  assert.match(SOURCE, /function niveauConnu[^}]*demande in COUCHES/s);
  // Choisir un arrondissement dans la recherche ne bascule pas la carte.
  assert.match(SOURCE, /etat\.maille = MAILLES_HORS_CARTE\.has\(voulu\) \? voulu : null;/);
  // Et la maille voyage dans l'URL : sans elle, recharger un lien vers Paris
  // 1er chercherait 75101 dans le lot des communes du 75 et n'y trouverait rien.
  assert.match(SOURCE, /p\.set\("maille", etat\.maille\)/);
  assert.match(SOURCE, /p\.get\("maille"\)/);
});

test("l'intercommunalité n'est plus une maille du site", () => {
  // Elle l'était entre le département et la commune : en zoomant vers sa ville
  // on traversait un découpage que personne ne reconnaît. Elle a quitté le zoom,
  // puis le produit entier — plus aucun territoire, aucune observation, aucune
  // couche de tuiles.
  for (let zoom = 0; zoom < 16; zoom += 0.1) {
    assert.notEqual(niveauPourZoom(zoom), "epci", `zoom ${zoom.toFixed(1)}`);
  }
});
