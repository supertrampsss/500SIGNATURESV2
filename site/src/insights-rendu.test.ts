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
  comparaison: "Voisins européens : Allemagne 42,4 % · Belgique 47,2 %.",
  preuves: [{ indicateur: "test", periode: "2025", valeur: 12.5, libelle: "Mesure" }],
};

test("renduInsights rend l'analyse et la comparaison, jamais la réserve", () => {
  const html = renduInsights([insight], catalogue, {
    contexte: "territoire",
    nom: "Ville-test",
  });

  assert.match(html, /Ce que racontent les chiffres de Ville-test/);
  assert.match(html, /Le fait &lt;vérifié&gt;/);
  assert.match(html, /L&#39;analyse reste visible/);
  assert.doesNotMatch(html, /La limite est explicite/);
  assert.doesNotMatch(html, /insight__reserve/);
  assert.match(html, /Voisins européens : Allemagne 42,4 % · Belgique 47,2 %/);
  assert.match(html, /insight__comparaison/);
  assert.doesNotMatch(html, /À garder en tête/);
  assert.doesNotMatch(html, /Vérifier les chiffres/);
  assert.doesNotMatch(html, /insight__preuves/);
  assert.match(html, /href="\/sources\/"/);
});

test("renduInsights ne peint pas une section vide", () => {
  assert.equal(renduInsights([], catalogue, { contexte: "france" }), "");
});

test("les arbitrages France sont tous visibles et regroupés dans un sommaire thématique", () => {
  const fiscalite: Insight = { ...insight, id: "angle-fiscalite", famille: "fiscalite" };
  const travail: Insight = { ...insight, id: "angle-travail", famille: "travail" };
  const html = renduInsights([insight, fiscalite, travail], catalogue, { contexte: "france" });

  assert.doesNotMatch(html, /3 arbitrages, 3 thèmes/);
  assert.doesNotMatch(html, /Thème 0[1-9]/);
  assert.doesNotMatch(html, />1 arbitrage</);
  assert.doesNotMatch(html, /<strong>1<\/strong>/);
  assert.match(html, /href="#arbitrages-budget"/);
  assert.match(html, /id="arbitrages-budget"/);
  assert.match(html, /id="arbitrages-fiscalite"/);
  assert.match(html, /id="arbitrages-travail"/);
  assert.match(html, /Dette et budget/);
  assert.match(html, /Fiscalité/);
  assert.match(html, /Travail et entreprises/);
  assert.equal((html.match(/class="insight insight--/g) ?? []).length, 3);
  assert.doesNotMatch(html, /Afficher plus|Voir plus/);
  assert.doesNotMatch(html, /Revenir aux thèmes/);
  assert.doesNotMatch(html, /insights__retour/);
});

test("une carte sans comparaison ne crée pas de paragraphe fantôme", () => {
  const html = renduInsights([{ ...insight, comparaison: undefined }], catalogue, {
    contexte: "france",
  });

  assert.doesNotMatch(html, /insight__comparaison/);
});
