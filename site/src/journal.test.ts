/**
 * Le journal est lu par quelqu'un qui soupçonne une erreur. Il doit être clair
 * sans être anxiogène, et surtout ne jamais laisser croire que rien n'a bougé.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { Changement } from "./donnees.ts";
import { afficherJournal, rendu } from "./journal.ts";

const plat = (html: string) => html.replace(/\s+/g, " ");

const ENTREES: Changement[] = [
  {
    annonce: "2026-07-31",
    type: "correction",
    jeu: "execution-budget-etat",
    indicateur: null,
    effet_au: "2019-01-01",
    public: "Les dépenses exécutées de 2019 à 2021 ont été corrigées.",
    technique: "Défaut du producteur, non corrigé à la source.",
  },
  {
    annonce: "2026-06-01",
    type: "deprecation",
    jeu: "ofgl-communes",
    indicateur: null,
    effet_au: null,
    public: "Les finances communales antérieures à 2022 ne sont plus servies.",
    technique: null,
  },
];

test("chaque entrée dit son type en français", () => {
  const html = plat(rendu(ENTREES));
  // Le libellé visible, pas la classe CSS : `journal__type--deprecation` est un
  // modificateur, il ne s'adresse à personne.
  const libelles = [...html.matchAll(/class="journal__type[^"]*">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(libelles, ["Correction", "Retrait"]);
});

test("la portée s'écrit en année, pas en date ISO", () => {
  const html = plat(rendu(ENTREES));
  assert.match(html, /à partir de 2019/);
  assert.doesNotMatch(html, /2019-01-01<\/span>/);
});

test("le détail technique est présent mais replié", () => {
  const html = plat(rendu(ENTREES));
  assert.match(html, /<details[^>]*>\s*<summary>Détail technique<\/summary>/);
  // une entrée sans détail technique ne produit pas de bloc vide
  assert.equal(html.match(/<details/g)?.length, 1);
});

test("un journal vide ne s'affiche pas du tout", () => {
  const bloc = { innerHTML: "" } as HTMLElement;
  assert.equal(afficherJournal(bloc, []), false);
  assert.equal(bloc.innerHTML, "");
});

test("le contenu est échappé", () => {
  const html = rendu([
    { ...ENTREES[1], public: "chute de <b>50 %</b>", technique: null },
  ]);
  assert.match(html, /&lt;b&gt;50 %&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>/);
});

test("la section existe dans la page", () => {
  const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(page.includes('id="journal"'));
});

test("l'ordre reçu est conservé : le plus récent d'abord vient du serveur", () => {
  const html = plat(rendu(ENTREES));
  assert.ok(html.indexOf("dépenses exécutées") < html.indexOf("finances communales"));
});
