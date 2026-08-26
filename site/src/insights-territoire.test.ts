import assert from "node:assert/strict";
import test from "node:test";

import type { Indicateur, Territoire } from "./donnees.ts";
import { insightsTerritoire } from "./insights-territoire.ts";

const indicateur = (id: string, unite: string): Indicateur => ({
  id,
  libelle: id,
  unite,
  theme: "test",
  sommable: false,
  cadre_comptable: null,
  niveaux: ["commune"],
  definition: "",
  definition_technique: "",
  formule: "",
  confiance: "haute",
  badges: [],
  jeu: "test",
  periodes: [],
});

const catalogue = [
  indicateur("dgfip_taux_tfb_global", "percent"),
  indicateur("insee_actifs", "count"),
  indicateur("insee_chomeurs_rp", "count"),
  indicateur("insee_logements", "count"),
  indicateur("insee_logements_vacants", "count"),
  indicateur("ssmsi_cambriolages_taux", "pour_1000_logements"),
  indicateur("ore_conso_electricite", "mwh"),
];

const territoire = (series: Territoire["series"]): Territoire => ({
  nom: "Ville-test",
  parent: "00",
  population: 100_000,
  drapeaux: {},
  series,
});

test("insightsTerritoire produit cinq lectures normalisées et distinctes", () => {
  const resultat = insightsTerritoire(
    territoire({
      dgfip_taux_tfb_global: { "2022": 20, "2025": 24 },
      insee_actifs: { "2018": 50_000, "2023": 55_000 },
      insee_chomeurs_rp: { "2018": 5_000, "2023": 4_400 },
      insee_logements: { "2018": 60_000, "2023": 65_000 },
      insee_logements_vacants: { "2018": 3_000, "2023": 5_200 },
      ssmsi_cambriolages_taux: { "2019": 10, "2025": 6 },
      ore_conso_electricite: { "2019": 1_000_000, "2024": 800_000 },
    }),
    catalogue,
  );

  assert.deepEqual(
    resultat.map(({ id }) => id),
    ["foncier", "chomage", "logements-vacants", "cambriolages", "electricite"],
  );
  assert.equal(new Set(resultat.map(({ famille }) => famille)).size, 5);
  assert.match(resultat[0].texte, /4 points/);
  assert.match(resultat[1].titre, /8/);
  assert.equal(resultat.every(({ preuves }) => preuves.length >= 2), true);
});

test("insightsTerritoire refuse les ratios impossibles et les unités inattendues", () => {
  const resultat = insightsTerritoire(
    territoire({
      insee_actifs: { "2023": 100 },
      insee_chomeurs_rp: { "2023": 120 },
      ssmsi_cambriolages_taux: { "2019": 10, "2025": 6 },
    }),
    [indicateur("ssmsi_cambriolages_taux", "count")],
  );

  assert.deepEqual(resultat, []);
});
