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

test("les surcouches ne cachent pas la donnée qu'elles expliquent", () => {
  // Première version : la légende recouvrait le sud-ouest de la France. La
  // leçon n'a pas changé quand la carte est devenue la page : les surcouches
  // flottent, mais le cadrage réserve leurs zones (`paddingCarte`) pour que
  // la France se dessine dans l'espace libre, jamais derrière un panneau.
  assert.match(PAGE, /class="legende surcouche surcouche--legende"/);
  assert.match(MAIN, /function paddingCarte\(\)/);
  assert.match(MAIN, /fitBounds\(bornes, \{ padding: paddingCarte\(\)/);
  assert.match(MAIN, /fitBoundsOptions: \{ padding: paddingCarte\(\) \}/);
  assert.ok(CSS.includes(".surcouche--legende"));
});

test("changer de thème repart sur l'année la plus récente", () => {
  // La barre latérale gauche a disparu : le panneau de droite porte tout le
  // catalogue, thème après thème, déjà chargé. La règle vit dans
  // choisirIndicateur(), appelée au clic sur une ligne du panneau.
  assert.match(MAIN, /async function choisirIndicateur[\s\S]{0,500}etat\.periode = ""/);
  assert.doesNotMatch(PAGE, /surcouche--commandes/);
  assert.match(MAIN, /\$\("fiche"\)\.addEventListener\("click", surLigne\)/);
});

test("un maire absent est dit, pas laissé en blanc", () => {
  assert.match(FICHE, /non renseigné par le Répertoire National des Élus/);
});
