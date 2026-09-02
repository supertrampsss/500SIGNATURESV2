import assert from "node:assert/strict";
import { test } from "node:test";

import { DESTINATIONS, intercepterNavigation, renduNavigation } from "./navigation.ts";

test("la navigation expose les quatre destinations utiles sans lien Accueil", () => {
  assert.deepEqual(
    DESTINATIONS.map(({ cle, href, libelle }) => ({ cle, href, libelle })),
    [
      { cle: "france", href: "/bilan", libelle: "France" },
      { cle: "territoires", href: "/territoire", libelle: "Territoires" },
      { cle: "salaires", href: "/salaires", libelle: "Salaires" },
      { cle: "simuler", href: "/simulateur", libelle: "Simuler" },
    ],
  );
  assert.doesNotMatch(renduNavigation("/", true), /Accueil|data-vue="accueil"/);
});

test("France est la destination courante sur le chemin historique du bilan", () => {
  assert.match(renduNavigation("/bilan", true), /href="\/bilan"[^>]*aria-current="page"/);
});

test("Simuler est la destination courante avec ou sans barre finale", () => {
  assert.match(renduNavigation("/simulateur", true), /href="\/simulateur"[^>]*aria-current="page"/);
  assert.match(renduNavigation("/simulateur/", true), /href="\/simulateur"[^>]*aria-current="page"/);
});

test("Analyses ne figure pas dans la navigation principale", () => {
  assert.doesNotMatch(renduNavigation("/", true), /Analyses|\/analyses/);
});

test("Salaires reste un lien natif vers sa page pré-rendue", () => {
  const html = renduNavigation("/salaires/", true);
  assert.match(html, /<a href="\/salaires" aria-current="page">Salaires<\/a>/);
  assert.doesNotMatch(html, /href="\/salaires"[^>]*data-vue/);
});

test("Simuler reste visible mais indisponible avant la publication des données", () => {
  const html = renduNavigation("/", false);
  assert.match(html, /href="\/simulateur"[^>]*data-vue="simuler"[^>]*aria-disabled="true"/);
});

test("Simuler disponible reste un lien natif, atteignable au clic comme au clavier", () => {
  const html = renduNavigation("/analyses/", true);
  // Un vrai <a href> garde son comportement natif : clic souris et touche
  // Entrée déclenchent le même évènement de navigation. Aucun tabindex négatif
  // ou aria-disabled ne doit donc le sortir de la tabulation.
  assert.match(html, /<a href="\/simulateur" data-vue="simuler">Simuler<\/a>/);
  assert.doesNotMatch(html, /href="\/simulateur"[^>]*(?:aria-disabled|tabindex)/);
});

test("un clic sur une destination indisponible est annulé avant la navigation", () => {
  const lien = {
    dataset: { vue: "simuler" },
    getAttribute: (nom: string) => nom === "aria-disabled" ? "true" : null,
  } as unknown as HTMLAnchorElement;
  let preventions = 0;
  const clic = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: { closest: () => lien },
    preventDefault: () => { preventions++; },
  } as unknown as MouseEvent;

  assert.equal(intercepterNavigation(clic), null);
  assert.equal(preventions, 1);
});

test("le clic natif de Simuler disponible prépare la navigation interne", () => {
  // La touche Entrée d'une ancre produit ce même clic sans modificateur : le
  // contrat couvre donc les deux modes d'activation sans recréer un raccourci
  // clavier parallèle.
  const lien = {
    dataset: { vue: "simuler" },
    getAttribute: () => null,
  } as unknown as HTMLAnchorElement;
  let preventions = 0;
  const clic = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: { closest: () => lien },
    preventDefault: () => { preventions++; },
  } as unknown as MouseEvent;

  assert.deepEqual(intercepterNavigation(clic), { cle: "simuler", href: "/simulateur", libelle: "Simuler" });
  assert.equal(preventions, 1);
});
