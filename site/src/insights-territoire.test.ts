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
  indicateur("ofgl_recettes_fonctionnement", "EUR"),
  indicateur("ofgl_depenses_fonctionnement", "EUR"),
  indicateur("ofgl_epargne_brute", "EUR"),
  indicateur("ofgl_encours_dette", "EUR"),
  indicateur("ofgl_frais_personnel", "EUR"),
  indicateur("ofgl_charges_financieres", "EUR"),
  indicateur("ofgl_impots_locaux", "EUR"),
  indicateur("rpls_logements_sociaux", "count"),
  indicateur("insee_residences_principales", "count"),
  indicateur("insee_pcs_retraites", "count"),
  indicateur("insee_population_15_24_ans", "count"),
  indicateur("dgfip_ircom_impot_net", "EUR"),
  indicateur("dgfip_ircom_foyers_fiscaux", "count"),
];

const territoire = (series: Territoire["series"]): Territoire => ({
  nom: "Ville-test",
  parent: "00",
  population: 100_000,
  drapeaux: {},
  series,
});

test("insightsTerritoire ajoute les arbitrages financiers aux lectures de contexte", () => {
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
      ofgl_recettes_fonctionnement: { "2019": 40_000_000, "2025": 50_000_000 },
      ofgl_depenses_fonctionnement: { "2019": 35_000_000, "2025": 45_000_000 },
      ofgl_epargne_brute: { "2019": 5_000_000, "2025": 5_000_000 },
      ofgl_encours_dette: { "2019": 25_000_000, "2025": 30_000_000 },
      ofgl_frais_personnel: { "2019": 14_000_000, "2025": 18_000_000 },
      ofgl_charges_financieres: { "2019": 900_000, "2025": 2_000_000 },
      ofgl_impots_locaux: { "2019": 15_000_000, "2025": 20_000_000 },
      rpls_logements_sociaux: { "2025": 12_000 },
      insee_residences_principales: { "2023": 50_000 },
      insee_pcs_retraites: { "2023": 18_000 },
      insee_population_15_24_ans: { "2023": 12_000 },
      dgfip_ircom_impot_net: { "2024": 90_000_000 },
      dgfip_ircom_foyers_fiscaux: { "2024": 50_000 },
    }),
    catalogue,
  );

  assert.deepEqual(
    resultat.map(({ id }) => id),
    [
      "foncier",
      "impots-face-depenses",
      "impot-revenu-par-foyer",
      "taux-epargne",
      "dette-sur-epargne",
      "poids-personnel",
      "interets-sur-impots",
      "retraites-pour-cent-jeunes",
      "chomage",
      "logements-vacants",
      "part-logements-sociaux",
      "cambriolages",
      "electricite",
      "parc-logements",
      "passoires-sociales",
      "gaz",
      "vols-vehicules",
    ],
  );
  const parId = new Map(resultat.map((insight) => [insight.id, insight]));
  assert.match(parId.get("foncier")?.texte ?? "", /4 points/);
  assert.match(parId.get("impots-face-depenses")?.titre ?? "", /Impôts locaux \+33,3 % · dépenses \+28,6 %/);
  assert.match(parId.get("impot-revenu-par-foyer")?.titre ?? "", /1\s?800 € par foyer fiscal/);
  assert.match(parId.get("taux-epargne")?.titre ?? "", /10 % des recettes/);
  assert.match(parId.get("dette-sur-epargne")?.titre ?? "", /6 années d'épargne brute/);
  assert.match(parId.get("poids-personnel")?.titre ?? "", /40 % des dépenses/);
  assert.match(parId.get("interets-sur-impots")?.titre ?? "", /10 % des impôts locaux/);
  assert.match(parId.get("interets-sur-impots")?.texte ?? "", /4 points/);
  assert.match(parId.get("retraites-pour-cent-jeunes")?.titre ?? "", /150 retraités pour 100 jeunes/);
  assert.match(parId.get("chomage")?.titre ?? "", /8/);
  assert.match(parId.get("logements-vacants")?.titre ?? "", /8 %/);
  assert.match(parId.get("part-logements-sociaux")?.titre ?? "", /24 % des résidences principales/);
  assert.match(parId.get("part-logements-sociaux")?.texte ?? "", /parc social 2025.*recensées en 2023/);
  assert.match(parId.get("parc-logements")?.titre ?? "", /8,3 %/);
  assert.match(parId.get("passoires-sociales")?.titre ?? "", /8 %/);
  assert.match(parId.get("gaz")?.titre ?? "", /33,3 %/);
  assert.match(parId.get("vols-vehicules")?.titre ?? "", /2 vols/);
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
