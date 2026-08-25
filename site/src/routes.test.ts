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
  assert.equal(vueDepuisAdresse("/bilan", ""), "bilan");
  // REPÈRES, DÉTAIL et MÉTHODE ont fusionné dans BILAN : leurs adresses
  // continuent d'ouvrir ce qu'elles promettaient, par la table des alias.
  assert.equal(vueDepuisAdresse("/reperes", ""), "bilan");
  assert.equal(vueDepuisAdresse("/detail", ""), "bilan");
  assert.equal(vueDepuisAdresse("/methode", ""), "bilan");
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
  // Tous les anciens noms mènent à BILAN, qui a absorbé ce qu'ils
  // désignaient. Un lien partagé il y a un an ouvre encore quelque chose.
  assert.equal(vueDepuisAdresse("/", "#analyses"), "bilan");
  assert.equal(vueDepuisAdresse("/", "#decryptages"), "bilan");
  // `#donnees` a été retiré : le lien ne doit pas laisser sur une page blanche.
  assert.equal(vueDepuisAdresse("/", "#donnees"), "territoire");
  assert.equal(vueDepuisAdresse("/", "#simulateur"), "simulateur");
});

test("une ancre interne n'est pas une vue", () => {
  // Le sommaire de la vue Repères vise `#bloc-etat` : le prendre pour une vue
  // inconnue renverrait le lecteur ailleurs au moment précis où il descend
  // dans ce qu'il lit.
  assert.equal(vueDepuisAdresse("/", "#bloc-etat"), null);
  assert.equal(vueDepuisAdresse("/bilan", "#bloc-niches"), "bilan");
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

test("le bilan historique demeure l'adresse de la France", () => {
  assert.equal(cheminDeVue("bilan"), "/bilan");
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
