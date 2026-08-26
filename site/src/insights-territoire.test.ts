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
  indicateur("insee_logements", "count"),
  indicateur("rpls_logements_sociaux_etiquetes", "count"),
  indicateur("rpls_logements_sociaux_passoires", "count"),
  indicateur("ore_conso_gaz", "mwh"),
  indicateur("ssmsi_vols_vehicules_taux", "pour_1000_habitants"),
];

const territoire = (series: Territoire["series"]): Territoire => ({
  nom: "Ville-test",
  parent: "00",
  population: 100_000,
  drapeaux: {},
  series,
});

test("insightsTerritoire produit neuf lectures normalisées", () => {
  const resultat = insightsTerritoire(
    territoire({
      dgfip_taux_tfb_global: { "2022": 20, "2025": 24 },
      insee_actifs: { "2018": 50_000, "2023": 55_000 },
      insee_chomeurs_rp: { "2018": 5_000, "2023": 4_400 },
      insee_logements: { "2018": 60_000, "2023": 65_000 },
      insee_logements_vacants: { "2018": 3_000, "2023": 5_200 },
      ssmsi_cambriolages_taux: { "2019": 10, "2025": 6 },
      ore_conso_electricite: { "2019": 1_000_000, "2024": 800_000 },
      rpls_logements_sociaux_etiquetes: { "2025": 10_000 },
      rpls_logements_sociaux_passoires: { "2025": 800 },
      ore_conso_gaz: { "2018": 900_000, "2024": 600_000 },
      ssmsi_vols_vehicules_taux: { "2016": 4, "2025": 2 },
    }),
    catalogue,
  );

  assert.deepEqual(
    resultat.map(({ id }) => id),
    [
      "foncier",
      "chomage",
      "logements-vacants",
      "cambriolages",
      "electricite",
      "parc-logements",
      "passoires-sociales",
      "gaz",
      "vols-vehicules",
    ],
  );
  assert.match(resultat[0].texte, /4 points/);
  assert.match(resultat[1].titre, /8/);
  assert.match(resultat[5].titre, /8,3 %/);
  assert.match(resultat[6].titre, /8 %/);
  assert.match(resultat[7].titre, /33,3 %/);
  assert.match(resultat[8].titre, /2 vols/);
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
