/**
 * « Est-ce tenable ? » : la question reçoit une réponse, et chaque nombre de
 * la réponse vient des séries.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Indicateur, Territoire } from "./donnees.ts";
import { finsAnnee, HORIZON, prolongement, rendu } from "./tenable.ts";

const Md = 1e9;
const SERIES: Record<string, Record<string, number>> = {
  insee_dette_apu_montant: {
    "2017-Q2": 2_232.0 * Md,
    "2017-Q4": 2_263.3 * Md,
    "2019-Q4": 2_387.4 * Md,
    "2021-Q4": 2_828.8 * Md,
    "2023-Q4": 3_103.2 * Md,
    "2025-Q4": 3_460.5 * Md,
    "2026-Q1": 3_536.1 * Md,
  },
  insee_dette_etat_montant: { "2026-Q1": 2_861.4 * Md },
  insee_dette_asso_montant: { "2026-Q1": 281.5 * Md },
  insee_dette_apul_montant: { "2026-Q1": 256.7 * Md },
  insee_dette_odac_montant: { "2026-Q1": 136.5 * Md },
  eurostat_taux_10_ans: { "2017": 0.81, "2020": -0.15, "2023": 2.99, "2025": 3.34979 },
  eurostat_apu_interets: { "2025": 66.6359 * Md },
  eurostat_apu_recettes: { "2025": 1_561.6261 * Md },
  eurostat_pib_montant: { "2017": 2_291.6805 * Md, "2025": 2_991.0559 * Md },
  eurostat_population: { "2026": 69_112_309 },
  eurostat_dette_pib: { "2025": 115.6 },
};

const PAYS: Record<string, Territoire> = {
  FR: { nom: "", parent: null, population: null, drapeaux: {}, series: SERIES },
  DE: { nom: "", parent: null, population: null, drapeaux: {}, series: { eurostat_dette_pib: { "2025": 63.5 } } },
  IT: { nom: "", parent: null, population: null, drapeaux: {}, series: { eurostat_dette_pib: { "2025": 137.1 } } },
};

const CATALOGUE = [
  { id: "insee_dette_apu_montant", libelle: "" },
  { id: "eurostat_taux_10_ans", libelle: "" },
] as unknown as Indicateur[];

const texte = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ").trim();

test("la question reçoit sa réponse, et chaque nombre vient des séries", () => {
  // Le bloc posait la question du chapitre sans y répondre, et le lecteur l'a
  // refusé. La réponse est factuelle : hausse de la dette contre hausse de la
  // richesse, taux d'aujourd'hui contre taux de la base, intérêts par an.
  const lu = texte(rendu(PAYS, CATALOGUE));
  assert.match(lu, /la charge de la dette va augmenter/);
  // 3 536,1 / 2 263,3 − 1 = +56,2 % ; PIB +30,5 % ; taux 3,3 contre 0,8.
  assert.match(lu, /augmenté de 56,2 % depuis 2017/);
  assert.match(lu, /richesse produite augmentait de 30,5 %/);
  assert.match(lu, /à 3,3 % contre 0,8 % en 2017/);
  // 66,64 Md€ d'intérêts, soit 4,3 € sur 100 € encaissés.
  assert.match(lu, /67 milliards d'euros/);
  assert.match(lu, /4,3 € sur chaque 100 € encaissés/);
});

test("la dette se lit année par année, fins d'année plus le dernier trimestre", () => {
  const points = finsAnnee(SERIES["insee_dette_apu_montant"]);
  assert.deepEqual(
    points.map(([an]) => an),
    ["2017", "2019", "2021", "2023", "2025", "2026 Q1"],
  );
  // Et jamais un trimestre intermédiaire pris pour une fin d'année.
  assert.ok(!points.some(([an]) => an.includes("Q2")));
  const lu = texte(rendu(PAYS, CATALOGUE));
  assert.match(lu, /2017.*2 263.*2026 Q1.*3 536/s);
});

test("le coût d'un nouvel emprunt ne porte plus son propre graphique", () => {
  // « 3,3 % contre 0,8 % en 2017 » est déjà dans la réponse ; un second
  // graphique pour les mêmes deux nombres ne les rendait pas plus vrais.
  const html = rendu(PAYS, CATALOGUE);
  assert.doesNotMatch(html, /Le coût d'un nouvel emprunt/);
  assert.doesNotMatch(html, /tenable__rang--taux/);
});

test("le par-habitant et les porteurs de la dette sont écrits, dans la réponse", () => {
  // « Qui la porte » vivait dans la légende du graphique, sous « année par
  // année » ; il est dans la réponse elle-même, avant le graphique.
  const html = rendu(PAYS, CATALOGUE);
  const lu = texte(html);
  assert.match(lu, /51 165 € par habitant/);
  assert.match(lu, /L'État 2 861 milliards d'euros/);
  assert.match(lu, /Sécurité sociale 282 milliards/);
  assert.ok(html.indexOf("Qui la porte") < html.indexOf("La dette, jusqu'en"));
});

test("les voisins partagent le millésime de la France, sans tri par valeur", () => {
  const html = rendu(PAYS, CATALOGUE);
  // L'ordre est celui de la déclaration (France, Italie, Allemagne présents) :
  // un tri par valeur ferait un classement.
  assert.ok(html.indexOf("France") < html.indexOf("Italie"));
  assert.ok(html.indexOf("Italie") < html.indexOf("Allemagne"));
  assert.match(texte(html), /France 115,6 %/);
  assert.match(texte(html), /Allemagne 63,5 %/);
});

test("sans la dette ou sans le taux au catalogue, rien ne s'écrit", () => {
  // La réponse cite les deux : une réponse à moitié sourcée ne s'écrit pas.
  assert.equal(rendu(PAYS, []), "");
  assert.equal(rendu({}, CATALOGUE), "");
  const sansTaux = {
    ...PAYS,
    FR: { ...PAYS["FR"], series: { ...SERIES, eurostat_taux_10_ans: { "2025": 3.35 } } },
  };
  assert.equal(rendu(sansTaux, CATALOGUE), "");
});

test("le prolongement est l'arithmétique du rythme observé, ancré au dernier point publié", () => {
  // Cinq exercices pleins d'écart : (3000 − 2000) / 5 = 200 par an, depuis le
  // dernier point publié (2026 T1, 3080) — jamais depuis l'exercice plein,
  // qui poserait un second 2026 à côté du publié.
  const annees: [string, number][] = [
    ["2019", 1800], ["2020", 2000], ["2021", 2200], ["2022", 2400],
    ["2023", 2600], ["2024", 2800], ["2025", 3000], ["2026 Q1", 3080],
  ];
  const points = prolongement(annees);
  assert.equal(points[0]?.[0], "2027");
  assert.equal(points[0]?.[1], 3080 + 200);
  assert.equal(points[points.length - 1]?.[0], String(HORIZON));
  assert.equal(points[points.length - 1]?.[1], 3080 + 200 * (HORIZON - 2026));
  // Moins de six exercices pleins : pas de rythme mesurable, pas de trait.
  assert.deepEqual(prolongement(annees.slice(0, 4)), []);
});

test("la dette se lit en courbe, le prolongement en pointillé, et la légende dit la méthode", () => {
  const html = rendu(PAYS, CATALOGUE);
  assert.match(html, /class="graphique__dessin"/);
  assert.match(html, /La dette, jusqu'en 2032/);
  assert.doesNotMatch(html, /tenable__rang">\s*<span class="apu__nom">20/);
  // La figure ne remplace pas le tableau : les valeurs exactes suivent, dans
  // un cadre qui défile, et la méthode du pointillé est écrite en entier.
  assert.match(html, /class="tenable__valeurs" tabindex="0"/);
  assert.match(html, /un prolongement arithmétique du rythme\s+observé, pas une prévision/);
});
