import assert from "node:assert/strict";
import test from "node:test";

import type { Indicateur } from "./donnees.ts";
import type { Insight } from "./insights.ts";
import { renduInsights } from "./insights-rendu.ts";

const catalogue = [{
  id: "test",
  libelle: "Indicateur test",
  unite: "percent",
  theme: "test",
  sommable: false,
  cadre_comptable: null,
  niveaux: ["pays"],
  definition: "",
  definition_technique: "",
  formule: "",
  confiance: "haute",
  badges: [],
  jeu: "test",
  periodes: [],
}] satisfies Indicateur[];

const insight: Insight = {
  id: "angle-test",
  famille: "budget",
  surtitre: "Le fait <vérifié>",
  titre: "Une conclusion & son chiffre",
  texte: "L'analyse reste visible.",
  reserve: "La limite est explicite.",
  preuves: [{ indicateur: "test", periode: "2025", valeur: 12.5, libelle: "Mesure" }],
};

test("renduInsights rend l'analyse, la preuve et la réserve sans HTML injecté", () => {
  const html = renduInsights([insight], catalogue, {
    contexte: "territoire",
    nom: "Ville-test",
  });

  assert.match(html, /Ce que racontent les chiffres de Ville-test/);
  assert.match(html, /Le fait &lt;vérifié&gt;/);
  assert.match(html, /L&#39;analyse reste visible/);
  assert.match(html, /2025/);
  assert.match(html, /12,5/);
  assert.match(html, /La limite est explicite/);
  assert.doesNotMatch(html, /À garder en tête/);
  assert.match(html, /href="\/sources\/"/);
});

test("renduInsights ne peint pas une section vide", () => {
  assert.equal(renduInsights([], catalogue, { contexte: "france" }), "");
});
