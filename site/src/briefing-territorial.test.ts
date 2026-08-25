import assert from "node:assert/strict";
import { test } from "node:test";

import type { Territoire } from "./donnees.ts";
import {
  briefingTerritorial,
  naviguerVersThemeTerritorial,
  renduBriefing,
  synchroniserThemesTerritoriaux,
} from "./briefing-territorial.ts";

const territoire: Territoire = {
  nom: 'Saint-<Martin> & "Co', parent: "33", population: 12_000, drapeaux: {}, series: {},
};

const entree = {
  territoire,
  exercice: "2025",
  code: "33063",
  niveau: "commune",
  comparer: ["33063", "33100"],
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
  assert.deepEqual(briefing.comparer, ["33063", "33100"]);
});

test("le rendu montre l'exercice, échappe les textes et porte des actions adressables", () => {
  const html = renduBriefing(briefingTerritorial(entree), territoire);

  assert.match(html, /<header[\s\S]*<h[1-6][^>]*>[^<]*Saint-&lt;Martin&gt; &amp; &quot;Co/);
  assert.match(html, /<dl>/);
  assert.match(html, /Exercice 2025/);
  assert.match(html, /Une situation &amp; solide\./);
  assert.match(html, /Territoires comparables : communes de &lt;10 000&gt; habitants &amp; rurales/);
  assert.match(html, />Comparer<\/a>/);
  assert.match(html, />Simuler le budget national<\/a>/);
  assert.match(html, /Le simulateur porte sur le budget national\./);
  assert.match(html, /href="\/territoire\?niveau=commune&amp;territoire=33063&amp;comparer=33063%2C33100"/);
  assert.match(html, /href="\/simulateur"/);
  assert.doesNotMatch(html, /Saint-%3CMartin|Simuler ce territoire/);
});

test("la France renvoie sa comparaison vers le bilan national", () => {
  const html = renduBriefing(
    briefingTerritorial({ ...entree, code: "FR", niveau: "pays", comparer: ["FR"] }),
    territoire,
  );

  assert.match(html, /href="\/bilan#france-verdict">Comparer la France<\/a>/);
  assert.doesNotMatch(html, /comparer=FR/);
});

test("les raccourcis invisibles ne prennent pas le focus, les autres y conduisent", () => {
  const appels: unknown[] = [];
  const budget = {
    dataset: { territoireTheme: "budget" },
    hidden: false,
    disabled: false,
  } as unknown as HTMLButtonElement;
  const dette = {
    dataset: { territoireTheme: "dette" },
    hidden: false,
    disabled: false,
  } as unknown as HTMLButtonElement;
  const cible = {
    dataset: {},
    tabIndex: 0,
    scrollIntoView: (options: unknown) => appels.push(["scroll", options]),
    focus: (options: unknown) => appels.push(["focus", options]),
  } as unknown as HTMLElement;
  const cibles = { budget: cible };

  synchroniserThemesTerritoriaux([budget, dette], cibles);
  assert.equal(budget.hidden, false);
  assert.equal(budget.disabled, false);
  assert.equal(dette.hidden, true);
  assert.equal(dette.disabled, true);
  assert.equal(cible.dataset.territoireSection, "budget");
  assert.equal(cible.tabIndex, -1);
  assert.equal(naviguerVersThemeTerritorial("budget", cibles, false), true);
  assert.deepEqual(appels, [
    ["scroll", { block: "start", behavior: "smooth" }],
    ["focus", { preventScroll: true }],
  ]);
  assert.equal(naviguerVersThemeTerritorial("dette", cibles, true), false);
});
