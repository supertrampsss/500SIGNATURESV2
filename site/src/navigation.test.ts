import assert from "node:assert/strict";
import { test } from "node:test";

import { DESTINATIONS, intercepterNavigation, renduNavigation } from "./navigation.ts";

test("Mandats est une entrée native indépendante du chargement des données", () => {
  assert.match(renduNavigation("/bilan", false), /<a href="\/mandats\/">Mandats<\/a>/);
  assert.doesNotMatch(renduNavigation("/bilan", false), /href="\/mandats\/"[^>]*data-vue/);
});

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

test("Mandats est la destination courante avec ou sans barre finale", () => {
  assert.match(renduNavigation("/mandats", true), /href="\/mandats\/"[^>]*aria-current="page"/);
  assert.match(renduNavigation("/mandats/", true), /href="\/mandats\/"[^>]*aria-current="page"/);
});

test("Analyses ne figure pas dans la navigation principale", () => {
  assert.doesNotMatch(renduNavigation("/", true), /Analyses|\/analyses/);
});

test("Salaires reste un lien natif vers sa page pré-rendue", () => {
  const html = renduNavigation("/salaires/", true);
  assert.match(html, /<a href="\/salaires" aria-current="page">Salaires<\/a>/);
  assert.doesNotMatch(html, /href="\/salaires"[^>]*data-vue/);
});

test("le menu partagé contient quatre destinations, sans l'ancien simulateur", () => {
  for (const disponible of [true, false]) {
    const html = renduNavigation("/bilan", disponible);
    assert.equal((html.match(/<a /g) ?? []).length, 4);
    assert.doesNotMatch(html, /href="\/simulateur"/);
    assert.match(html, /href="\/mandats\/"/);
  }
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
