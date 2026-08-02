/**
 * Trois défauts vus en naviguant sur le site, que rien ne testait : la légende
 * recouvrait la carte, l'année restait bloquée sur un vieux millésime, et un
 * maire manquant laissait un blanc indistinct d'une absence de fonctionnalité.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const PAGE = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const MAIN = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const CSS = readFileSync(new URL("./style.css", import.meta.url), "utf8");
const FICHE = readFileSync(new URL("./fiche.ts", import.meta.url), "utf8");

test("la légende ne flotte plus au-dessus de la carte", () => {
  // Elle recouvrait le sud-ouest de la France : une échelle qui cache la
  // donnée qu'elle explique.
  assert.match(PAGE, /<div class="carte-zone">[\s\S]*id="carte"[\s\S]*id="legende"[\s\S]*<\/div>/);
  const bloc = CSS.slice(CSS.indexOf(".legende {"), CSS.indexOf(".legende__titre"));
  assert.doesNotMatch(bloc, /position:\s*absolute/);
});

test("changer de thème repart sur l'année la plus récente", () => {
  assert.match(MAIN, /cible\.id === "theme"[\s\S]{0,600}etat\.periode = ""/);
});

test("un maire absent est dit, pas laissé en blanc", () => {
  assert.match(FICHE, /non renseigné par le Répertoire National des Élus/);
});
