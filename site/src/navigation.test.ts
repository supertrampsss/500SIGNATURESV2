import assert from "node:assert/strict";
import { test } from "node:test";

import { DESTINATIONS, intercepterNavigation, renduNavigation } from "./navigation.ts";

test("la navigation expose les quatre destinations dans l'ordre convenu", () => {
  assert.deepEqual(
    DESTINATIONS.map(({ cle, href, libelle }) => ({ cle, href, libelle })),
    [
      { cle: "accueil", href: "/", libelle: "Accueil" },
      { cle: "france", href: "/bilan", libelle: "France" },
      { cle: "territoires", href: "/territoire", libelle: "Territoires" },
      { cle: "simuler", href: "/simulateur", libelle: "Simuler" },
    ],
  );
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

test("Simuler reste visible mais indisponible avant la publication des données", () => {
  const html = renduNavigation("/", false);
  assert.match(html, /href="\/simulateur"[^>]*data-vue="simuler"[^>]*aria-disabled="true"/);
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
