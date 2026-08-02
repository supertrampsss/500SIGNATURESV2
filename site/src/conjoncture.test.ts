/**
 * Le décryptage de conjoncture doit dire le chiffre juste avec le bon verbe
 * (une déflation n'est pas une hausse), désamorcer les deux contresens (IPCH
 * vs INSEE, glissement annuel vs trimestre-sur-trimestre) et disparaître
 * proprement tant que les séries ne sont pas publiées.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { CROISSANCE, INFLATION, extraireSeries, rendu, taux } from "./conjoncture.ts";
import type { Indicateur, Territoire } from "./donnees.ts";

const FINE = " ";

const CATALOGUE = [
  { id: INFLATION, libelle: "Inflation (IPCH, sur un an)" },
  { id: CROISSANCE, libelle: "Croissance du PIB (volume, sur un an)" },
] as Indicateur[];

function territoire(series: Record<string, Record<string, number>>): Territoire {
  return { nom: "x", parent: null, population: null, drapeaux: {}, series };
}

function moisDepuis(debut: number, valeurs: number[]): Record<string, number> {
  const serie: Record<string, number> = {};
  valeurs.forEach((v, i) => {
    const mois = (i % 12) + 1;
    serie[`${debut + Math.floor(i / 12)}-${String(mois).padStart(2, "0")}`] = v;
  });
  return serie;
}

const PAYS: Record<string, Territoire> = {
  FR: territoire({
    [INFLATION]: moisDepuis(2025, [1.8, 1.5, 1.3]),
    [CROISSANCE]: { "2025-Q4": 0.4, "2026-Q1": 0.6, "2026-Q2": 0.8 },
  }),
  DE: territoire({
    [INFLATION]: moisDepuis(2025, [2.9, 2.6, 2.3]),
    [CROISSANCE]: { "2025-Q4": -0.1, "2026-Q1": 0.2, "2026-Q2": 0.3 },
  }),
  EA20: territoire({
    [INFLATION]: moisDepuis(2025, [2.8, 2.4, 2.1]),
    [CROISSANCE]: { "2025-Q4": 0.2, "2026-Q1": 0.5, "2026-Q2": 0.6 },
  }),
};

test("un taux se lit signé, avec l'espace fine insécable", () => {
  assert.equal(taux(0.8), `+0,8${FINE}%`);
  assert.equal(taux(-0.2), `-0,2${FINE}%`);
  assert.equal(taux(0), `0,0${FINE}%`);
});

test("le bloc dit l'inflation du dernier mois et la compare à la zone euro", () => {
  const html = rendu(PAYS, CATALOGUE);
  assert.ok(html.includes("En mars 2025"));
  assert.ok(html.includes(`1,3${FINE}%`));
  assert.ok(html.includes("zone euro"));
  assert.ok(html.includes("augmenté"));
});

test("le bloc dit la croissance du dernier trimestre avec le bon verbe", () => {
  const html = rendu(PAYS, CATALOGUE);
  assert.ok(html.includes("Au 2ᵉ trimestre 2026"));
  assert.ok(html.includes("progressé"));
});

test("une déflation se dit « baissé », jamais « augmenté de −0,3 % »", () => {
  const pays = {
    ...PAYS,
    FR: territoire({ [INFLATION]: moisDepuis(2025, [0.2, -0.1, -0.3]) }),
  };
  const html = rendu(pays, [CATALOGUE[0]]);
  assert.ok(html.includes("baissé"));
  assert.ok(html.includes(`0,3${FINE}%`));
  assert.ok(!html.includes("augmenté de <strong>−"));
});

test("les deux contresens de méthode sont désamorcés par écrit", () => {
  const html = rendu(PAYS, CATALOGUE);
  assert.ok(html.includes("l'indice national de l'INSEE"));
  assert.ok(html.includes("même trimestre de l'année"));
  assert.ok(html.includes("jamais de prévision"));
});

test("le graphique et sa légende sont présents, la zone euro en repère", () => {
  const html = rendu(PAYS, CATALOGUE);
  assert.ok(html.includes("<svg"));
  assert.ok(html.includes("graphique__legende-item--pointille"));
  assert.ok(html.includes("France"));
  assert.ok(html.includes("data-fenetre"));
});

test("sans publication, le bloc disparaît proprement", () => {
  assert.equal(rendu(PAYS, [] as Indicateur[]), "");
  assert.equal(rendu({}, CATALOGUE), "");
});

test("la fenêtre de cinq ans borne les séries au plus récent", () => {
  const longue: Record<string, number> = {};
  for (let annee = 2013; annee <= 2025; annee++) {
    for (let mois = 1; mois <= 12; mois++) {
      longue[`${annee}-${String(mois).padStart(2, "0")}`] = 2.0;
    }
  }
  const pays = { FR: territoire({ [INFLATION]: longue }) };
  const cinq = extraireSeries(pays, INFLATION, 5);
  assert.equal(cinq[0].points.length, 60);
  assert.equal(cinq[0].points[0][0], "2021-01");
  const tout = extraireSeries(pays, INFLATION, null);
  assert.equal(tout[0].points.length, 156);
});
