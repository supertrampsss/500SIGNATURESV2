import assert from "node:assert/strict";
import test from "node:test";

import type { Indicateur, Territoire } from "./donnees.ts";
import {
  RECETTES_MISSIONS,
  RECETTES_TENDANCES,
  type RecetteTendance,
} from "./insights-france-catalogue.ts";
import {
  creerInsightTendance,
  insightsFranceGeneriques,
} from "./insights-france-generiques.ts";

const indicateur = (id: string, unite: string): Indicateur => ({
  id,
  libelle: id,
  unite,
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
});

test("le catalogue déclare exactement 64 trajectoires et 24 missions uniques", () => {
  assert.equal(RECETTES_TENDANCES.length, 64);
  assert.equal(RECETTES_MISSIONS.length, 24);
  const ids = [
    ...RECETTES_TENDANCES.map(({ id }) => id),
    ...RECETTES_MISSIONS.map(({ id }) => id),
  ];
  assert.equal(new Set(ids).size, 88);
});

test("une trajectoire en pourcentage traverse zéro et s'exprime en points", () => {
  const recette: RecetteTendance = {
    id: "croissance-test",
    indicateur: "croissance",
    unite: "percent",
    famille: "travail",
    surtitre: "Activité · le retournement",
    sujet: "Croissance",
    reserve: "Une variation trimestrielle reste volatile.",
  };

  const resultat = creerInsightTendance(
    recette,
    { croissance: { "2024": -1, "2025": 2 } },
    [indicateur("croissance", "percent")],
  );

  assert.ok(resultat);
  assert.match(resultat.titre, /3 points/);
  assert.equal(resultat.preuves.length, 2);
});

test("une baisse ne reçoit jamais un signe positif dans l'analyse", () => {
  const recette: RecetteTendance = {
    id: "baisse-test",
    indicateur: "baisse",
    unite: "number",
    famille: "services",
    surtitre: "Société · la trajectoire",
    sujet: "Indicateur en baisse",
    reserve: "La série mesure une évolution, pas une causalité.",
  };

  const resultat = creerInsightTendance(
    recette,
    { baisse: { "2020": 100, "2025": 75 } },
    [indicateur("baisse", "number")],
  );

  assert.ok(resultat);
  assert.match(resultat.texte, /baisse de 25 %/);
  assert.doesNotMatch(resultat.texte, /baisse de \+25 %/);
});

test("une longue série nationale privilégie 2017 comme point de comparaison", () => {
  const recette: RecetteTendance = {
    id: "serie-longue-test",
    indicateur: "serie_longue",
    unite: "number",
    famille: "budget",
    surtitre: "Budget · la trajectoire récente",
    sujet: "Série longue",
    reserve: "La période de comparaison est affichée.",
  };

  const resultat = creerInsightTendance(
    recette,
    { serie_longue: { "1959": 10, "2017": 100, "2025": 125 } },
    [indicateur("serie_longue", "number")],
  );

  assert.ok(resultat);
  assert.equal(resultat.preuves[0].periode, "2017");
  assert.match(resultat.texte, /entre 2017 et 2025/);
});

test("le générateur produit les 88 cartes quand chaque série est compatible", () => {
  const series: Territoire["series"] = {};
  const catalogue: Indicateur[] = [];

  for (const recette of RECETTES_TENDANCES) {
    series[recette.indicateur] = { "2020": 100, "2025": 125 };
    catalogue.push(indicateur(recette.indicateur, recette.unite));
  }
  for (const recette of RECETTES_MISSIONS) {
    series[recette.vote] = { "2025": 100 };
    series[recette.consomme] = { "2025": 110 };
    catalogue.push(indicateur(recette.vote, "EUR"), indicateur(recette.consomme, "EUR"));
  }

  const resultat = insightsFranceGeneriques(series, catalogue);

  assert.equal(resultat.length, 88);
  assert.equal(new Set(resultat.map(({ id }) => id)).size, 88);
  assert.equal(resultat.every(({ preuves }) => preuves.length >= 2), true);
  assert.equal(
    resultat.filter(({ id }) => id.startsWith("mission-")).every(({ reserve }) => reserve === ""),
    true,
  );
});
