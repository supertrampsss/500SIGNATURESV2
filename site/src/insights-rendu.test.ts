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

test("les arbitrages France sont tous visibles et regroupés dans un sommaire thématique", () => {
  const fiscalite: Insight = { ...insight, id: "angle-fiscalite", famille: "fiscalite" };
  const travail: Insight = { ...insight, id: "angle-travail", famille: "travail" };
  const html = renduInsights([insight, fiscalite, travail], catalogue, { contexte: "france" });

  assert.match(html, /3 arbitrages, 3 thèmes/);
  assert.match(html, /href="#arbitrages-budget"/);
  assert.match(html, /id="arbitrages-budget"/);
  assert.match(html, /id="arbitrages-fiscalite"/);
  assert.match(html, /id="arbitrages-travail"/);
  assert.match(html, /Dette et budget/);
  assert.match(html, /Fiscalité/);
  assert.match(html, /Travail et entreprises/);
  assert.equal((html.match(/class="insight insight--/g) ?? []).length, 3);
  assert.doesNotMatch(html, /Afficher plus|Voir plus/);
});
