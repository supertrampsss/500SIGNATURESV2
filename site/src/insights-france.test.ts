import assert from "node:assert/strict";
import test from "node:test";

import type { Indicateur, Territoire } from "./donnees.ts";
import { insightsFrance } from "./insights-france.ts";

const indicateur = (id: string, libelle = id): Indicateur => ({
  id,
  libelle,
  unite: "EUR",
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

const france = (series: Territoire["series"]): Territoire => ({
  nom: "France",
  parent: null,
  population: 68_000_000,
  drapeaux: {},
  series,
});

test("insightsFrance produit douze angles sourcés sans mélanger les périodes", () => {
  const series = {
    depense_fiscale_totale: { "2025": 100 },
    depense_fiscale_impot_revenu: { "2025": 40 },
    depense_fiscale_impot_revenu_societes: { "2025": 10 },
    depense_fiscale_impot_societes: { "2025": 5 },
    depense_fiscale_tva: { "2025": 15 },
    etat_mission_defense_credits_votes: { "2024": 100 },
    etat_mission_defense_credits_consommes: { "2024": 115 },
    etat_mission_culture_credits_votes: { "2024": 20 },
    etat_mission_culture_credits_consommes: { "2024": 21 },
    drees_cotisants_par_retraite: { "2004": 2, "2016": 1.7 },
    drees_pension_moyenne_brute_femmes: { "2022": 1_200 },
    drees_pension_moyenne_brute_hommes: { "2022": 2_000 },
    bdf_defaillances_taille_ensemble: { "2025-06": 60_000, "2026-06": 66_000 },
    insee_gini: { "2024": 0.3 },
    insee_gini_avant_redistribution: { "2024": 0.4 },
    eurostat_apu_interets: { "2021": 35_000_000_000, "2025": 66_500_000_000 },
    eurostat_prelevements_obligatoires_pib: { "2017": 48.3, "2024": 45.2 },
    eurostat_taux_emploi: { "2003": 70.1, "2025": 75.4 },
    eurostat_chomage: { "2025": 7.7 },
    eurostat_chomage_jeunes: { "2025": 19.8 },
    insee_taux_pauvrete_60: { "2004": 12.4, "2024": 15.4 },
    insee_personnes_pauvres_60: { "2024": 9_817_000 },
    justice_densite_carcerale: { "2025-01": 129.4, "2026-07": 141.4 },
    justice_personnes_detenues: { "2025-01": 80_514, "2026-07": 89_283 },
  };
  const catalogue = [
    indicateur("etat_mission_defense_credits_votes", "Défense — crédits votés"),
    indicateur("etat_mission_defense_credits_consommes", "Défense — crédits consommés"),
    indicateur("etat_mission_culture_credits_votes", "Culture — crédits votés"),
    indicateur("etat_mission_culture_credits_consommes", "Culture — crédits consommés"),
  ];

  const resultat = insightsFrance(france(series), catalogue);

  assert.deepEqual(
    resultat.map(({ id }) => id),
    [
      "niches-fiscales",
      "budget-vote-execute",
      "cotisants-retraites",
      "pensions-femmes-hommes",
      "defaillances",
      "redistribution",
      "interets-dette",
      "prelevements-obligatoires",
      "taux-emploi",
      "chomage-jeunes",
      "pauvrete",
      "densite-carcerale",
    ],
  );
  assert.equal(resultat[1].preuves[0].periode, "2024");
  assert.match(resultat[1].titre, /Défense/);
  assert.match(resultat[3].titre, /40/);
  assert.equal(resultat[5].preuves.every(({ periode }) => periode === "2024"), true);
  assert.match(resultat[6].titre, /66,5 Md€/);
  assert.match(resultat[9].titre, /2,57 fois/);
  assert.equal(resultat[10].preuves.every(({ periode }) => periode === "2024"), true);
  assert.match(resultat[11].titre, /141,4/);
});

test("insightsFrance supprime seulement les angles dont les séries sont insuffisantes", () => {
  const resultat = insightsFrance(
    france({
      insee_gini: { "2024": 0.3 },
      insee_gini_avant_redistribution: { "2023": 0.4 },
      drees_cotisants_par_retraite: { "2016": 1.7 },
    }),
    [],
  );

  assert.deepEqual(resultat, []);
});
