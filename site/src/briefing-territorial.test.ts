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
  code: "33063",
  niveau: "commune",
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
  assert.equal(briefing.exercice, "2025");
  assert.equal(briefing.code, "33063");
  assert.equal(briefing.niveau, "commune");
});

test("le rendu montre l'exercice, échappe les textes et porte des actions adressables", () => {
  const html = renduBriefing(briefingTerritorial(entree), territoire);

  assert.match(html, /<header[\s\S]*<h[1-6][^>]*>[^<]*Saint-&lt;Martin&gt; &amp; &quot;Co/);
  assert.match(html, /<dl>/);
  assert.match(html, /Exercice 2025/);
  assert.match(html, /Une situation &amp; solide\./);
  assert.match(html, /Communes comparables : communes de &lt;10 000&gt; habitants &amp; rurales/);
  assert.match(html, />Comparer<\/a>/);
  assert.match(html, />Simuler le budget national<\/a>/);
  assert.match(html, /Le simulateur porte sur le budget national\./);
  assert.match(html, /href="\/territoire\?niveau=commune&amp;territoire=33063&amp;comparer=33063"/);
  assert.match(html, /href="\/simulateur"/);
  assert.doesNotMatch(html, /Saint-%3CMartin|Simuler ce territoire/);
});
