import assert from "node:assert/strict";
import test from "node:test";

import type { Indicateur, Territoire } from "./donnees.ts";
import { insightsFrance } from "./insights-france.ts";
import { IDS_SOURCES_ARBITRAGES } from "./insights-sources.ts";

const indicateur = (id: string, libelle = id, unite = "EUR"): Indicateur => ({
  id,
  libelle,
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

const france = (series: Territoire["series"]): Territoire => ({
  nom: "France",
  parent: null,
  population: 68_000_000,
  drapeaux: {},
  series,
});

test("insightsFrance produit les angles composés puis les missions disponibles", () => {
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
    etat_depenses_personnel: { "2025": 156 },
    etat_depenses_nettes_bg: { "2025": 440 },
    etat_impot_revenu: { "2025": 95_000_000_000 },
    etat_recettes_fiscales: { "2025": 357_000_000_000 },
    etat_charge_dette: { "2025": 66_500_000_000 },
    insee_dette_etat_montant: { "2025-Q1": 2_880 },
    insee_dette_apu_montant: { "2025-Q1": 3_525 },
    drees_protection_sociale_vieillesse: { "2024": 427 },
    drees_protection_sociale_sante: { "2024": 318 },
    drees_protection_sociale_famille: { "2024": 66 },
    drees_protection_sociale_total: { "2024": 908 },
    insee_rapport_interquintile_avant_redistribution: { "2024": 8.37 },
    insee_rapport_interquintile: { "2024": 4.62 },
    insee_niveau_vie_d1_avant_redistribution: { "2024": 9_970 },
    insee_niveau_vie_d1: { "2024": 13_970 },
    eurostat_apu_interets: { "2021": 35_000_000_000, "2025": 66_500_000_000 },
    eurostat_prelevements_obligatoires_pib: { "2017": 48.3, "2024": 45.2 },
    eurostat_taux_emploi: { "2003": 70.1, "2025": 75.4 },
    eurostat_chomage: { "2025": 7.7 },
    eurostat_chomage_jeunes: { "2025": 19.8 },
    insee_taux_pauvrete_60: { "2004": 12.4, "2024": 15.4 },
    insee_personnes_pauvres_60: { "2024": 9_817_000 },
    justice_densite_carcerale: { "2025-01": 129.4, "2026-07": 141.4 },
    justice_personnes_detenues: { "2025-01": 80_514, "2026-07": 89_283 },
    eurostat_pib_habitant_spa: { "2017": 108, "2025": 104 },
  };
  const catalogue = [
    indicateur("etat_mission_defense_credits_votes", "Défense — crédits votés"),
    indicateur("etat_mission_defense_credits_consommes", "Défense — crédits consommés"),
    indicateur("etat_mission_culture_credits_votes", "Culture — crédits votés"),
    indicateur("etat_mission_culture_credits_consommes", "Culture — crédits consommés"),
    indicateur("etat_charge_dette"),
    indicateur("etat_impot_revenu"),
    indicateur("eurostat_pib_habitant_spa", "PIB par habitant en SPA", "count"),
  ];
  const pays = {
    PL: france({ eurostat_pib_habitant_spa: { "2017": 70, "2025": 87 } }),
  };

  const resultat = insightsFrance(france(series), catalogue, pays);

  assert.deepEqual(
    resultat.map(({ id }) => id),
    [
      "niches-fiscales",
      "budget-vote-execute",
      "cotisants-retraites",
      "pensions-femmes-hommes",
      "defaillances",
      "redistribution",
      "poids-personnel-etat",
      "poids-impot-revenu",
      "dette-portee-par-etat",
      "protection-sociale-vieillesse-sante",
      "protection-sociale-vieillesse-famille",
      "redistribution-interquintile",
      "redistribution-bas-echelle",
      "interets-dette",
      "prelevements-obligatoires",
      "taux-emploi",
      "chomage-jeunes",
      "pauvrete",
      "densite-carcerale",
      "ir-foyers-imposes",
      "tres-hauts-revenus",
      "redistribution-ocde",
      "pauvrete-actifs-retraites",
      "majoration-trois-enfants",
      "projection-charge-dette",
      "charge-dette-sur-ir",
      "surtaxe-exceptionnelle-prolongee",
      "rattrapage-pologne",
      "sncf-financement-public",
      "mission-defense",
      "mission-culture",
    ],
  );
  assert.equal(resultat[1].preuves[0].periode, "2024");
  assert.match(resultat[1].titre, /Défense/);
  assert.match(resultat[3].titre, /40/);
  assert.equal(resultat[5].preuves.every(({ periode }) => periode === "2024"), true);
  assert.match(resultat[6].titre, /35,5 %/);
  assert.match(resultat[7].titre, /26,6 %/);
  assert.match(resultat[8].texte, /1er trimestre 2025/);
  assert.doesNotMatch(resultat[8].texte, /2025-Q1/);
  assert.match(resultat[9].titre, /82 %/);
  assert.match(resultat[11].titre, /44,8 %/);
  assert.match(resultat[12].titre, /40,1 %/);
  assert.match(resultat[13].titre, /67 Md€/);
  assert.match(resultat[16].titre, /2,57 fois/);
  assert.equal(resultat[17].preuves.every(({ periode }) => periode === "2024"), true);
  assert.match(resultat[18].titre, /141,4/);
  assert.match(resultat.find(({ id }) => id === "charge-dette-sur-ir")?.titre ?? "", /70/);
  assert.match(resultat.find(({ id }) => id === "rattrapage-pologne")?.titre ?? "", /84 %/);
  assert.equal(
    resultat
      .flatMap(({ sourceIds = [] }) => sourceIds)
      .every((sourceId) => IDS_SOURCES_ARBITRAGES.has(sourceId)),
    true,
  );
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

  assert.deepEqual(
    resultat.map(({ id }) => id),
    [
      "ir-foyers-imposes",
      "tres-hauts-revenus",
      "redistribution-ocde",
      "pauvrete-actifs-retraites",
      "majoration-trois-enfants",
      "projection-charge-dette",
      "surtaxe-exceptionnelle-prolongee",
      "sncf-financement-public",
    ],
  );
});

test("insightsFrance ajoute le catalogue générique après les lectures composées", () => {
  const resultat = insightsFrance(
    france({ etat_charge_dette: { "2020": 40_000_000_000, "2025": 50_000_000_000 } }),
    [indicateur("etat_charge_dette", "Charge de la dette de l'État")],
  );

  assert.deepEqual(resultat.map(({ id }) => id), [
    "ir-foyers-imposes",
    "tres-hauts-revenus",
    "redistribution-ocde",
    "pauvrete-actifs-retraites",
    "majoration-trois-enfants",
    "projection-charge-dette",
    "surtaxe-exceptionnelle-prolongee",
    "sncf-financement-public",
    "charge-dette-etat",
  ]);
});
