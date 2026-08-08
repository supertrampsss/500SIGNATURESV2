import assert from "node:assert/strict";
import { test } from "node:test";

import { creerGarde, FENETRE_FANTOME } from "./garde-geste.ts";

/** Horloge pilotée : la garde se teste au millième, pas au chronomètre. */
function horlogeFixe(): { avancer(ms: number): void; lire(): number } {
  let t = 1_000;
  return { avancer: (ms) => { t += ms; }, lire: () => t };
}

test("une garde non armée n'absorbe rien", () => {
  const h = horlogeFixe();
  const garde = creerGarde(500, h.lire);
  assert.equal(garde.absorbe(), false);
});

test("le clic fantôme qui suit le geste est absorbé", () => {
  const h = horlogeFixe();
  const garde = creerGarde(500, h.lire);
  garde.armer();
  h.avancer(40);
  assert.equal(garde.absorbe(), true);
});

test("un seul clic est absorbé par geste", () => {
  const h = horlogeFixe();
  const garde = creerGarde(500, h.lire);
  garde.armer();
  assert.equal(garde.absorbe(), true);
  // Le deuxième clic dans la même fenêtre est un vrai clic : deux clics
  // fantômes ne viennent pas d'un seul contact.
  assert.equal(garde.absorbe(), false);
});

test("passé la fenêtre, le clic est rendu à la carte", () => {
  const h = horlogeFixe();
  const garde = creerGarde(500, h.lire);
  garde.armer();
  h.avancer(500);
  assert.equal(garde.absorbe(), false);
});

test("réarmer rouvre la fenêtre", () => {
  const h = horlogeFixe();
  const garde = creerGarde(500, h.lire);
  garde.armer();
  assert.equal(garde.absorbe(), true);
  h.avancer(2_000);
  garde.armer();
  h.avancer(10);
  assert.equal(garde.absorbe(), true);
});

test("la fenêtre par défaut couvre le délai du clic de compatibilité", () => {
  // Le clic de compatibilité suit le touchend de quelques dizaines de ms ;
  // 500 ms laisse la marge d'un appareil lent.
  assert.ok(FENETRE_FANTOME >= 300 && FENETRE_FANTOME <= 800);
});
