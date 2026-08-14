/**
 * Le rendu des scénarios : la barre qui les liste, le tableau qui les compare.
 *
 * Deux fonctions pures, sur le modèle d'`analyse-rendu.ts` : chacune rend une
 * chaîne, et c'est cette chaîne qui est testée, jamais le DOM.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { Scenario } from "./scenarios.ts";
import type { LigneComparee } from "./comparaison.ts";
import { type Comparable, renduBarre, renduComparaison } from "./scenarios-rendu.ts";
import { formater } from "./echelle.ts";

const SOURCE = readFileSync(new URL("./scenarios-rendu.ts", import.meta.url), "utf8");

/** Un scénario minimal, pour ne pas répéter les six champs à chaque test. */
function scenario(nom: string, exercice = "2025"): Scenario {
  return { nom, budget: "b64", contrat: "c64", cree_le: "2026-01-01", modifie_le: "2026-01-01", exercice };
}

/** Une colonne comparée minimale. */
function comparable(nom: string, effort: number, gestes: number, exercice = "2025"): Comparable {
  return { nom, etat: { budgets: new Map(), baremes: new Map() }, effort, gestes, exercice };
}

function ligne(libelle: string, cellules: (number | null)[]): LigneComparee {
  return { volet: "etat", code: "146", libelle, base: 1_000_000_000, cellules };
}

test("1. la barre liste les scénarios, le courant marqué", () => {
  const html = renduBarre([scenario("Mon budget"), scenario("Un autre")], "Un autre");
  assert.match(html, />Mon budget</);
  assert.match(html, />Un autre</);
  // Le courant se distingue dans le balisage, pas seulement à l'œil.
  const balise = html.slice(html.indexOf('data-nom="Un autre"') - 200, html.indexOf('data-nom="Un autre"') + 50);
  assert.match(balise, /aria-current="true"|scenarios-rendu__scenario--courant/);
  const balisePremier = html.slice(0, html.indexOf('data-nom="Un autre"'));
  assert.doesNotMatch(balisePremier, /aria-current="true"/);
});

test("2. un nom est échappé : un scénario nommé <script> ne produit pas de balise", () => {
  const html = renduBarre([scenario("<script>alert(1)</script>")], null);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("3. la barre sans scénario invite à enregistrer plutôt que d'afficher une liste vide", () => {
  const html = renduBarre([], null);
  assert.doesNotMatch(html, /<li>/);
  assert.doesNotMatch(html, /<ul[^>]*>\s*<\/ul>/);
  assert.match(html, /enregistr/i);
});

test("4. le tableau porte une colonne par comparable, en tête le nom, l'effort et le nombre de gestes", () => {
  const colonnes = [comparable("A", 100_000_000, 2), comparable("B", -50_000_000, 1)];
  const html = renduComparaison(colonnes, [ligne("Défense", [10_000_000, null])]);
  assert.match(html, />A</);
  assert.match(html, />B</);
  assert.match(html, new RegExp(formater(100_000_000, "EUR", false).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, new RegExp(formater(-50_000_000, "EUR", false).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /2 gestes/);
  assert.match(html, /1 geste\b/);
});

test("5. une cellule null se distingue à l'écran d'un écart nul", () => {
  const colonnes = [comparable("Touché", 0, 1), comparable("Zéro", 0, 1), comparable("Absent", 0, 0)];
  const html = renduComparaison(
    colonnes,
    [ligne("Défense", [10_000_000, 0, null])],
  );
  const zeroAffiche = formater(0, "EUR", false);
  // Les trois cellules produisent trois textes différents : la valeur réglée,
  // le zéro effectivement réglé, et le texte qui dit « non réglé ». Aucun des
  // deux derniers ne doit se confondre.
  const cellules = [...html.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]);
  assert.equal(cellules.length, 3);
  assert.equal(cellules[0], formater(10_000_000, "EUR", false));
  assert.equal(cellules[1], zeroAffiche);
  assert.notEqual(cellules[2], zeroAffiche);
  assert.notEqual(cellules[2], "");
  assert.match(cellules[2]!, /non réglé/i);
});

test("6. les montants passent par formater : l'attendu se calcule en appelant formater", () => {
  const colonnes = [comparable("A", 1_234_567, 1), comparable("B", 0, 0)];
  const html = renduComparaison(colonnes, [ligne("Défense", [987_654_321, null])]);
  assert.match(html, new RegExp(formater(1_234_567, "EUR", false).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, new RegExp(formater(987_654_321, "EUR", false).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  // Le séparateur des milliers est l'espace fine insécable (U+202F), pas
  // l'espace ordinaire : un attendu tapé à la main l'aurait manqué.
  assert.match(formater(987_654_321, "EUR", false), / /);
});

test("7. la légende du tableau dit l'unité, comme exercices.ts et la page d'analyse", () => {
  const html = renduComparaison([comparable("A", 0, 0)], []);
  assert.match(html, /<caption>Montants en millions d'euros\.?<\/caption>/);
});

test("8. aucun total de dépense n'est écrit : verrouillé sur le source du module", () => {
  assert.doesNotMatch(SOURCE, /\btotal(e|aux|s)?\b/i);
  assert.doesNotMatch(SOURCE, /\bsomme\b/i);
});

test("9. aucun gagnant : ni meilleur, ni pire, ni note, ni rang", () => {
  assert.doesNotMatch(SOURCE, /meilleur|pire|gagnant|perdant|classement|score\b/i);
});

test("10. deux scénarios construits sur des exercices différents le disent en tête du tableau", () => {
  const colonnes = [comparable("A", 0, 0, "2019"), comparable("B", 0, 0, "2025")];
  const html = renduComparaison(colonnes, []);
  assert.match(html, /2019/);
  assert.match(html, /2025/);
});
