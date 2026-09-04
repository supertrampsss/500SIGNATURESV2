/**
 * Les adresses du site. Le chemin fait foi ; le fragment n'est lu que sur la
 * racine, pour les liens partagés avant que les chemins n'existent.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import * as routes from "./routes.ts";

const { ALIAS, CHEMINS, adresseSimulateurCanonique, cheminDeVue, vueDepuisAdresse } = routes;

test("la racine publique redirige vers la page France", () => {
  const redirects = readFileSync(new URL("../public/_redirects", import.meta.url), "utf8");
  assert.match(redirects, /^\/\s+\/bilan\s+301\s*$/m);
  for (const [legacy, canonical] of [
    ["accueil", "bilan"],
    ["carte", "territoire"],
    ["donnees", "territoire"],
    ["reperes", "bilan"],
    ["detail", "bilan"],
    ["methode", "sources"],
    ["simulateur/v2", "simulateur"],
    ["simulateur/comparer", "simulateur"],
  ]) {
    assert.match(redirects, new RegExp(`^\\/${legacy}\\/?\\s+\\/${canonical}\\s+301\\s*$`, "m"));
  }
});

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

test("le simulateur V3 est l'entrée par défaut sans casser les permaliens V2", () => {
  const mode = (routes as unknown as {
    modeSimulateur?: (pathname: string, search: string) => "v2" | "v3";
  }).modeSimulateur;

  assert.equal(typeof mode, "function");
  assert.equal(mode?.("/simulateur", ""), "v3");
  assert.equal(mode?.("/simulateur", "?version=3"), "v3");
  assert.equal(mode?.("/simulateur", "?version=2"), "v2");
  assert.equal(mode?.("/simulateur", "?defi=ancien-defi"), "v2");
  assert.equal(mode?.("/simulateur", "?budget=R1%3A10"), "v2");
  assert.equal(mode?.("/simulateur/comparer", ""), "v2");
});

test("les anciens permaliens du simulateur convergent vers la seule interface publique", () => {
  assert.equal(adresseSimulateurCanonique("/simulateur", "?version=2"), "/simulateur?version=3");
  assert.equal(adresseSimulateurCanonique("/simulateur/comparer", ""), "/simulateur?version=3");
  assert.equal(adresseSimulateurCanonique("/simulateur", "?contrat=sans-impot"), "/simulateur?version=3");
  assert.equal(adresseSimulateurCanonique("/simulateur", "?version=3"), null);
});
