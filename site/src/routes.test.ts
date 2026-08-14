/**
 * Les adresses du site. Le chemin fait foi ; le fragment n'est lu que sur la
 * racine, pour les liens partagés avant que les chemins n'existent.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { ALIAS, CHEMINS, cheminDeVue, vueDepuisAdresse } from "./routes.ts";

test("un chemin nomme sa vue", () => {
  assert.equal(vueDepuisAdresse("/territoire", ""), "territoire");
  assert.equal(vueDepuisAdresse("/simulateur", ""), "simulateur");
  assert.equal(vueDepuisAdresse("/reperes", ""), "reperes");
  assert.equal(vueDepuisAdresse("/detail", ""), "detail");
  assert.equal(vueDepuisAdresse("/methode", ""), "methode");
});

test("la racine sans fragment ne demande aucune vue", () => {
  // `null` et non « territoire » : l'appelant doit pouvoir distinguer « rien
  // n'est demandé » de « la vue territoire est demandée », pour laisser en
  // place ce qui est déjà affiché.
  assert.equal(vueDepuisAdresse("/", ""), null);
});

test("les anciens liens à fragment ouvrent ce qu'ils promettaient", () => {
  // `#carte` était une vue avant de devenir un mode de la vue territoire.
  assert.equal(vueDepuisAdresse("/", "#carte"), "territoire");
  // `#analyses` désignait les tableaux d'un territoire ; le nom est passé à
  // l'éditorial, les tableaux s'appellent désormais `detail`.
  assert.equal(vueDepuisAdresse("/", "#analyses"), "detail");
  assert.equal(vueDepuisAdresse("/", "#decryptages"), "reperes");
  // `#donnees` a été retiré : le lien ne doit pas laisser sur une page blanche.
  assert.equal(vueDepuisAdresse("/", "#donnees"), "territoire");
  assert.equal(vueDepuisAdresse("/", "#simulateur"), "simulateur");
});

test("une ancre interne n'est pas une vue", () => {
  // Le sommaire de la vue Repères vise `#bloc-etat` : le prendre pour une vue
  // inconnue renverrait le lecteur ailleurs au moment précis où il descend
  // dans ce qu'il lit.
  assert.equal(vueDepuisAdresse("/", "#bloc-etat"), null);
  assert.equal(vueDepuisAdresse("/reperes", "#bloc-niches"), "reperes");
});

test("un chemin inconnu ne nomme aucune vue", () => {
  assert.equal(vueDepuisAdresse("/inexistant", ""), null);
  assert.equal(vueDepuisAdresse("/analyses/taxe-zucman", ""), null);
});

test("le chemin d'une vue est stable", () => {
  for (const vue of Object.keys(CHEMINS)) {
    assert.equal(vueDepuisAdresse(cheminDeVue(vue), ""), vue);
  }
  // Une vue inconnue retombe sur la racine du site plutôt que de fabriquer
  // une adresse qui n'existe pas.
  assert.equal(cheminDeVue("inexistante"), "/territoire");
});

test("un alias ne désigne jamais un autre alias", () => {
  // Une chaîne d'alias se résoudrait à moitié : `vueDepuisAdresse` ne déréférence
  // qu'une fois.
  for (const cible of Object.values(ALIAS)) {
    assert.ok(cible in CHEMINS, `${cible} n'est pas une vue`);
  }
});

test("les segments s'accommodent des barres obliques", () => {
  assert.equal(vueDepuisAdresse("/simulateur/", ""), "simulateur");
  // Le comparateur de scénarios vit sous le simulateur : le premier segment
  // suffit à nommer la vue.
  assert.equal(vueDepuisAdresse("/simulateur/comparer", ""), "simulateur");
});
