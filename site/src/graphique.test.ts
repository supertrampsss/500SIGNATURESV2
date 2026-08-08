/**
 * Le graphique est la pièce de confiance des décryptages : une échelle qui
 * dramatise, un trou relié en douce ou un maximum coupé feraient mentir la
 * courbe. Ces tests fixent les règles du dessin, pas son pixel près.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  LARGEUR_ETROITE,
  dessiner,
  graduations,
  graduationsTemps,
  pasArrondi,
  periodeAuPoint,
  periodeLisible,
  typographieDuDessin,
  type Serie,
} from "./graphique.ts";

const FORMATER = (v: number) => `${v} %`;

test("les pas d'échelle sont ronds, jamais ajustés aux données", () => {
  assert.equal(pasArrondi(10), 2.5);
  assert.equal(pasArrondi(3), 1);
  assert.equal(pasArrondi(0.9), 0.25);
  assert.equal(pasArrondi(40), 10);
});

test("le zéro entre dans l'échelle quand il est à portée", () => {
  assert.ok(graduations(2, 12).includes(0)); // une inflation se lit depuis zéro
  assert.ok(graduations(-3, 2).includes(0)); // la récession passe sous la ligne
});

test("le zéro n'est pas imposé quand il écraserait la série", () => {
  const ticks = graduations(96, 102);
  assert.ok(!ticks.includes(0));
  assert.ok(ticks[0] >= 96 - 2);
});

test("les graduations couvrent toujours le maximum", () => {
  // 12 au-dessus d'une dernière graduation à 10 sortirait du cadre, coupé
  const ticks = graduations(2, 12);
  assert.ok(ticks[ticks.length - 1] >= 12);
  assert.ok(ticks[0] <= 2);
});

test("l'axe du temps marque les débuts d'année", () => {
  const mois = ["2024-11", "2024-12", "2025-01", "2025-02", "2026-01"];
  assert.deepEqual(graduationsTemps(mois), [2, 4]);
  const trimestres = ["2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2"];
  assert.deepEqual(graduationsTemps(trimestres), [2]);
});

test("les périodes se lisent en français", () => {
  assert.equal(periodeLisible("2025-12"), "décembre 2025");
  assert.equal(periodeLisible("2026-01"), "janvier 2026");
  assert.equal(periodeLisible("2026-Q1"), "1ᵉʳ trimestre 2026");
  assert.equal(periodeLisible("2026-Q2"), "2ᵉ trimestre 2026");
  assert.equal(periodeLisible("2024"), "2024");
});

const SERIES: Serie[] = [
  {
    nom: "France",
    couleur: "#1b4f77",
    accent: true,
    points: [
      ["2025-01", 1.8],
      ["2025-02", 1.5],
      ["2025-03", 1.2],
    ],
  },
  {
    nom: "Zone euro",
    couleur: "#5a6472",
    pointille: true,
    points: [
      ["2025-01", 2.5],
      // février manque : la ligne doit se casser, pas enjamber
      ["2025-03", 2.2],
    ],
  },
];

test("le dessin porte une courbe par série et casse la ligne sur un trou", () => {
  const { svg } = dessiner(SERIES, { formater: FORMATER, titre: "Inflation" });
  const groupes = svg.match(/<g class="graphique__serie[^>]*>/g) ?? [];
  assert.equal(groupes.length, 2);
  // la zone euro n'a que des segments d'un point de part et d'autre du trou :
  // aucune polyline ne doit la traverser
  const zoneEuro = svg.split('<g class="graphique__serie graphique__serie--pointille"')[1] ?? "";
  assert.ok(!zoneEuro.split("</g>")[0].includes("<polyline"));
  // la France, continue, garde sa polyline
  assert.ok(svg.includes("graphique__serie--accent"));
  assert.match(svg, /<polyline/);
});

test("le zéro absent des données ne fait pas disparaître la ligne zéro d'une série qui le croise", () => {
  const { svg } = dessiner(
    [{ nom: "PIB", couleur: "#000", points: [["2020-Q2", -12.0], ["2021-Q2", 15.0]] }],
    { formater: FORMATER, titre: "Croissance" },
  );
  assert.ok(svg.includes("graphique__zero"));
});

test("le résumé accessible nomme les bornes et les dernières valeurs", () => {
  const { svg } = dessiner(SERIES, { formater: FORMATER, titre: "Inflation" });
  assert.ok(svg.includes("de janvier 2025 à mars 2025"));
  assert.ok(svg.includes("France : 1.2 %"));
});

test("une abscisse de pointeur retombe sur la période la plus proche", () => {
  const { geometrie } = dessiner(SERIES, { formater: FORMATER, titre: "Inflation" });
  assert.equal(periodeAuPoint(geometrie, geometrie.gauche), 0);
  assert.equal(periodeAuPoint(geometrie, geometrie.droite), 2);
  assert.equal(periodeAuPoint(geometrie, (geometrie.gauche + geometrie.droite) / 2), 1);
  // hors cadre : bornée, jamais d'indice fantôme
  assert.equal(periodeAuPoint(geometrie, 0), 0);
  assert.equal(periodeAuPoint(geometrie, geometrie.largeur + 50), 2);
});

test("sans donnée, pas de dessin", () => {
  assert.equal(dessiner([], { formater: FORMATER, titre: "Vide" }).svg, "");
});

/**
 * Les tailles de texte du graphique sont en unités du viewBox : la feuille de
 * style ne peut rien y faire, c'est la géométrie du dessin qui décide. Sur un
 * téléphone, les étiquettes d'axe se rendaient à cinq pixels.
 */

test("un dessin étroit resserre ses marges et grossit ses étiquettes", () => {
  const etroit = typographieDuDessin(340);
  const large = typographieDuDessin(720);
  assert.ok(etroit.corps >= 13, `${etroit.corps}`);
  assert.equal(large.corps, 12);
  // Quarante-six unités de gouttière sur 340, c'est un septième du dessin.
  assert.ok(etroit.marges.gauche < large.marges.gauche);
  // Le seuil est celui du téléphone, pas une valeur au hasard.
  assert.equal(typographieDuDessin(LARGEUR_ETROITE).corps, 12);
  assert.equal(typographieDuDessin(LARGEUR_ETROITE - 1).corps, 13);
});

test("chaque texte porte sa taille, aucune ne dépend de la seule feuille de style", () => {
  const { svg } = dessiner(SERIES, { largeur: 340, formater: FORMATER, titre: "Inflation" });
  const textes = svg.match(/<text[^>]*>/g) ?? [];
  assert.ok(textes.length > 0);
  for (const t of textes) assert.match(t, /font-size="13"/, t);
  // Et la courbe reste dans le cadre resserré.
  const { geometrie } = dessiner(SERIES, { largeur: 340, formater: FORMATER, titre: "Inflation" });
  assert.equal(geometrie.gauche, 34);
  assert.equal(geometrie.droite, 330);
});
