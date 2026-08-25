import assert from "node:assert/strict";
import { test } from "node:test";

import type { Territoire } from "./donnees.ts";
import { briefingTerritorial, renduBriefing } from "./briefing-territorial.ts";

const territoire: Territoire = {
  nom: 'Saint-<Martin> & "Co', parent: "33", population: 12_000, drapeaux: {}, series: {},
};

const entree = {
  territoire,
  exercice: "2025",
  diagnostic: "Une situation & solide",
  groupe: 'communes de <10 000> habitants & rurales',
  chiffres: [
    { id: "autre", libelle: "Autre chiffre", unite: "EUR", valeur: 99_000_000 },
    { id: "ofgl_epargne_brute", libelle: "Épargne brute", unite: "EUR", valeur: 4_000_000 },
    { id: "ofgl_encours_dette", libelle: "Encours de dette", unite: "EUR", valeur: 20_000_000 },
    { id: "ofgl_depenses_fonctionnement", libelle: "Dépenses de fonctionnement", unite: "EUR", valeur: 35_000_000, comparaison: "Sous la médiane" },
    { id: "ofgl_recettes_fonctionnement", libelle: "Recettes de fonctionnement", unite: "EUR", valeur: 40_000_000 },
  ],
} as const;

test("le briefing priorise quatre chiffres, complète son diagnostic et nomme ses pairs", () => {
  const briefing = briefingTerritorial(entree);

  assert.deepEqual(
    briefing.chiffres.map((chiffre) => chiffre.id),
    [
      "ofgl_recettes_fonctionnement",
      "ofgl_depenses_fonctionnement",
      "ofgl_encours_dette",
      "ofgl_epargne_brute",
    ],
  );
  assert.equal(briefing.chiffres.length, 4);
  assert.equal(briefing.diagnostic, "Une situation & solide.");
  assert.equal(briefing.groupe, "communes de <10 000> habitants & rurales");
});

test("le rendu montre l'exercice, échappe les textes et porte des actions adressables", () => {
  const html = renduBriefing(briefingTerritorial(entree), territoire);

  assert.match(html, /<header[\s\S]*<h[1-6][^>]*>[^<]*Saint-&lt;Martin&gt; &amp; &quot;Co/);
  assert.match(html, /<dl>/);
  assert.match(html, /Exercice 2025/);
  assert.match(html, /Une situation &amp; solide\./);
  assert.match(html, /Communes comparables : communes de &lt;10 000&gt; habitants &amp; rurales/);
  assert.match(html, />Comparer<\/a>/);
  assert.match(html, />Simuler ce territoire<\/a>/);
  assert.match(html, /href="\/comparateur\?territoire=Saint-%3CMartin%3E%20%26%20%22Co"/);
  assert.match(html, /href="\/simulateur\?territoire=Saint-%3CMartin%3E%20%26%20%22Co"/);
});
