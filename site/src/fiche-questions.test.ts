/**
 * Une table de classement se juge sur deux propriétés, pas sur son goût :
 * rien ne se perd, rien ne compte deux fois. Le reste — l'intitulé, l'ordre —
 * est un choix éditorial que ces tests n'ont pas à trancher.
 *
 * Le catalogue de contrôle n'est pas inventé : ce sont les identifiants
 * réellement publiés, thème par thème. Les finances locales y figurent en
 * entier, parce que c'est le seul thème que la table défait ligne à ligne — un
 * `ofgl_*` ajouté par le connecteur et oublié ici tomberait dans le repli sans
 * que rien ne le dise, et c'est exactement ce que le dernier test surveille.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Indicateur } from "./donnees.ts";
import { QUESTIONS, REPLI, questionDe, repartir } from "./fiche-questions.ts";

/** Les identifiants publiés, par thème. Seuls `id` et `theme` comptent ici. */
const PUBLIES: Record<string, string[]> = {
  finances_locales: [
    "dgcl_dotation_globale_fonctionnement", "dgcl_dotation_nationale_perequation",
    "dgcl_dotation_solidarite_rurale", "dgcl_dotation_solidarite_urbaine",
    "dgfip_delai_global_paiement", "dgfip_dmto_communes", "dgfip_dmto_departement",
    "fonction_commune_amenagement_economie", "fonction_commune_culture_sport",
    "fonction_commune_enseignement", "fonction_commune_retraitements_ofgl",
    "fonction_commune_securite", "fonction_commune_services_generaux",
    "fonction_commune_social_famille", "ofgl_achats_et_charges_externes",
    "ofgl_allocations_apa", "ofgl_allocations_pch", "ofgl_allocations_rsa",
    "ofgl_annuite_de_la_dette", "ofgl_attribution_fonds_de_pereq_dmto",
    "ofgl_autres_depenses_d_investissement", "ofgl_autres_depenses_de_fonctionnement",
    "ofgl_autres_dotations_de_fonctionnement", "ofgl_autres_dotations_et_subventions",
    "ofgl_autres_impots_et_taxes", "ofgl_autres_recettes_d_investissement",
    "ofgl_autres_recettes_de_fonctionnement", "ofgl_capacite_ou_besoin_de_financement",
    "ofgl_cartes_grises", "ofgl_charges_financieres", "ofgl_cnsa",
    "ofgl_concours_de_l_etat", "ofgl_contributions_aux_sdis",
    "ofgl_credits_de_tresorerie", "ofgl_cvae", "ofgl_ddec",
    "ofgl_depenses_d_equipement", "ofgl_depenses_d_intervention",
    "ofgl_depenses_d_investissement_hors_remb", "ofgl_depenses_fonctionnement",
    "ofgl_depenses_investissement", "ofgl_depenses_totales",
    "ofgl_depenses_totales_hors_remb", "ofgl_depots_au_tresor", "ofgl_dmto_apres_pereq",
    "ofgl_dmto_avant_pereq", "ofgl_dotation_globale_de_fonctionnement", "ofgl_dres",
    "ofgl_emprunts_hors_gad", "ofgl_encours_de_dette_depots_et_cautionnements_recus",
    "ofgl_encours_de_dette_dettes_bancaires_et_assimilees", "ofgl_encours_dette",
    "ofgl_epargne_brute", "ofgl_epargne_brute_avant_travaux_en_regie",
    "ofgl_epargne_de_gestion", "ofgl_epargne_nette", "ofgl_fctva",
    "ofgl_fiscalite_reversee", "ofgl_flux_net_de_dette", "ofgl_fmdi",
    "ofgl_fonds_de_roulement", "ofgl_fonds_de_soutien_aux_emprunts_a_risque",
    "ofgl_frais_d_hebergement", "ofgl_frais_personnel", "ofgl_impots_et_taxes",
    "ofgl_impots_locaux", "ofgl_perequations_et_compensations_fiscales",
    "ofgl_prelevement_fonds_de_pereq_dmto", "ofgl_produit_des_cessions_d_immobilisations",
    "ofgl_recettes_d_investissement", "ofgl_recettes_d_investissement_hors_emprunts",
    "ofgl_recettes_fonctionnement", "ofgl_recettes_totales",
    "ofgl_recettes_totales_hors_emprunts", "ofgl_remboursements_d_emprunts_hors_gad",
    "ofgl_subventions_aux_personnes_de_droit_prive",
    "ofgl_subventions_d_equipement_versees", "ofgl_subventions_recues_et_participations",
    "ofgl_taxe_d_enlevement_des_ordures_menageres", "ofgl_ticpe",
    "ofgl_travaux_en_regie", "ofgl_tsca", "ofgl_tva",
    "ofgl_variation_du_fonds_de_roulement", "ofgl_ventes_de_biens_et_services",
    "ofgl_versement_transport", "derive_desendettement", "derive_taux_epargne",
    "derive_effort_investissement", "derive_rigidite", "derive_interets_sur_recettes",
    "derive_part_dgf", "derive_charge_dette_sur_impots", "derive_dette_locale_en_revenu",
  ],
  impots_locaux: [
    "dgfip_produit_cfe", "dgfip_produit_th_residences_secondaires", "dgfip_produit_foncier_bati",
    "dgfip_produit_foncier_non_bati", "dgfip_taux_tfb_commune", "dgfip_taux_tfb_global",
    "dgfip_taxe_fonciere_frais_etat", "dgfip_taxe_fonciere_intercommunalite",
    "dgfip_taxe_fonciere_ordures_menageres", "dgfip_taxe_fonciere_taxes_annexes",
    "derive_part_non_communale_tfb",
  ],
  budget_etat: [
    "etat_charge_dette", "etat_depenses_personnel", "etat_depenses_nettes_bg",
    "etat_impot_revenu", "etat_impot_societes", "etat_psr_union_europeenne",
    "etat_psr_collectivites", "etat_recettes_fiscales", "etat_recettes_nettes_bg",
    "etat_recettes_non_fiscales", "etat_remboursements_impots_etat", "etat_solde_budgetaire",
    "etat_solde_comptes_speciaux", "etat_tva", "etat_ticpe",
    "etat_mission_defense_credits_consommes", "etat_mission_justice_credits_votes",
  ],
  dette: [
    "insee_dette_etat_montant", "insee_dette_apu_montant", "insee_dette_apu_part_pib",
    "insee_apu_solde", "insee_apu_solde_apul",
  ],
  depenses_fiscales: ["depense_fiscale_totale", "depense_fiscale_tva"],
  fonctions: [
    "ofgl_fonction_total", "ofgl_fonction_culture", "eurostat_fonction_sante",
    "eurostat_depenses_publiques_pib",
  ],
  securite_sociale: [
    "drees_protection_sociale_total", "drees_protection_sociale_vieillesse",
    "eurostat_secu_depenses_pib", "eurostat_secu_recettes_pib", "eurostat_secu_solde_pib",
  ],
  europe: [
    "eurostat_dette_pib", "eurostat_deficit_pib", "eurostat_chomage", "eurostat_pib_habitant_spa",
    "eurostat_prelevements_obligatoires_pib", "eurostat_impots_capital_pib",
    "eurostat_cotisations_sociales_pib", "anct_fonds_europeens_ue_conventionne",
  ],
  macro: ["insee_inflation_ipc", "eurostat_inflation_ipch", "eurostat_croissance_pib"],
  vie_associative: ["etat_subventions_associations", "etat_subventions_associations_etablissements"],
  securite: ["ssmsi_cambriolages_taux", "ssmsi_cambriolages_nombre", "derive_atteintes_biens"],
  revenus: ["insee_niveau_vie_median", "insee_taux_pauvrete", "cnaf_foyers_rsa"],
  logement: ["insee_logements", "insee_logements_vacants"],
  emploi: ["insee_taux_chomage_localise", "dares_defm_abc"],
  sante: ["drees_apl_generalistes"],
  education: ["menj_ecoles", "menj_colleges_lycees"],
  justice: ["justice_densite_carcerale"],
  environnement: ["cerema_espaces_consommes"],
  transports: ["sdes_parc_voitures"],
  energie: ["ore_conso_gaz"],
  population: ["insee_population_municipale"],
  famille: ["insee_familles", "insee_familles_monoparentales"],
  professions: ["insee_pcs_cadres", "insee_pcs_ouvriers"],
  diplomes: ["insee_diplome_superieur"],
  entreprises: ["insee_etablissements_actifs"],
  secteurs_salaries: ["insee_effectifs_salaries_services_marchands"],
  secteurs_etablissements: ["insee_etablissements_employeurs_services_marchands"],
  equipements: ["insee_equipements_total"],
  tourisme: ["insee_hotels_chambres", "insee_campings_emplacements", "insee_hotels",
    "insee_campings", "insee_hebergements_collectifs", "insee_hebergements_collectifs_lits"],
  elections: ["elections_taux_participation", "elections_inscrits", "elections_votants",
    "elections_blancs", "elections_nuls"],
  prenoms: ["insee_prenom_premier_effectif_filles", "insee_prenom_premier_effectif_garcons"],
};

const CATALOGUE: Indicateur[] = Object.entries(PUBLIES).flatMap(([theme, ids]) =>
  ids.map((id) => ({ id, theme, libelle: id, unite: "EUR" }) as never as Indicateur),
);

test("le catalogue de contrôle n'a pas de doublon d'identifiant", () => {
  // Sans quoi les deux tests suivants passeraient sur un jeu incohérent.
  assert.equal(new Set(CATALOGUE.map((i) => i.id)).size, CATALOGUE.length);
});

test("la répartition est exhaustive : aucun indicateur perdu", () => {
  const range = repartir(CATALOGUE).flatMap((g) => g.indicateurs.map((i) => i.id));
  assert.equal(range.length, CATALOGUE.length);
  assert.deepEqual(new Set(range), new Set(CATALOGUE.map((i) => i.id)));
});

test("la répartition est sans doublon : aucun indicateur sous deux questions", () => {
  const range = repartir(CATALOGUE).flatMap((g) => g.indicateurs.map((i) => i.id));
  assert.equal(new Set(range).size, range.length);
});

test("un indicateur inconnu tombe dans le repli plutôt que de disparaître", () => {
  const inconnu = { id: "source_future_serie", theme: "theme_qui_n_existe_pas" } as never;
  assert.equal(questionDe(inconnu), REPLI);
  const groupes = repartir([...CATALOGUE, inconnu]);
  const repli = groupes.find((g) => g.question.cle === REPLI);
  assert.ok(repli, "l'entrée de repli manque");
  assert.ok(repli!.indicateurs.some((i) => i.id === "source_future_serie"));
});

test("une question sans indicateur ne produit pas de groupe vide", () => {
  // Rien de cliquable ne mène à une section vide : la règle vaut dès la
  // répartition, pas seulement au rendu.
  const groupes = repartir([{ id: "ofgl_encours_dette", theme: "finances_locales" } as never]);
  assert.equal(groupes.length, 1);
  assert.equal(groupes[0].question.cle, "dette");
});

test("les groupes sortent dans l'ordre déclaré des questions", () => {
  const ordre = repartir(CATALOGUE).map((g) => g.question.cle);
  const attendu = QUESTIONS.map((q) => q.cle).filter((cle) => ordre.includes(cle));
  assert.deepEqual(ordre, attendu);
});

test("aucune ligne de finances locales ne tombe dans le repli", () => {
  // Le seul thème que la table défait ligne à ligne. Un `ofgl_*` publié demain
  // et oublié ici se rangerait silencieusement sous « Le reste » : ce test le
  // fait échouer à la place.
  const orphelines = PUBLIES.finances_locales.filter(
    (id) => questionDe({ id, theme: "finances_locales" } as never) === REPLI,
  );
  assert.deepEqual(orphelines, ["dgfip_delai_global_paiement"]);
});

test("les trois questions d'argent se partagent les finances locales sans se croiser", () => {
  const cle = (id: string) => questionDe({ id, theme: "finances_locales" } as never);
  assert.equal(cle("ofgl_frais_personnel"), "depenses");
  assert.equal(cle("fonction_commune_culture"), "depenses");
  assert.equal(cle("ofgl_impots_locaux"), "recettes");
  assert.equal(cle("dgcl_dotation_globale_fonctionnement"), "recettes");
  assert.equal(cle("ofgl_encours_dette"), "dette");
  assert.equal(cle("ofgl_epargne_brute"), "dette");
  assert.equal(cle("derive_desendettement"), "dette");
  // Les taux et produits d'imposition ont leur propre question : « qui paie »
  // se répond par des masses, « les impôts ont-ils monté » par des taux.
  assert.equal(questionDe({ id: "dgfip_taux_tfb_global", theme: "impots_locaux" } as never), "impots");
});

test("le budget de l'État se défait par la convention de nommage du connecteur", () => {
  const cle = (id: string) => questionDe({ id, theme: "budget_etat" } as never);
  assert.equal(cle("etat_mission_defense_credits_consommes"), "depenses");
  assert.equal(cle("etat_depenses_nettes_bg"), "depenses");
  assert.equal(cle("etat_impot_revenu"), "recettes");
  assert.equal(cle("etat_recettes_fiscales"), "recettes");
  assert.equal(cle("etat_solde_budgetaire"), "dette");
  assert.equal(cle("etat_charge_dette"), "dette");
});

test("chaque identifiant de tête tombe bien dans sa propre question", () => {
  // Une tête écrite sous la mauvaise question ferait ouvrir « Qui paie ? » sur
  // une ligne rangée ailleurs : le lecteur cliquerait une question et lirait la
  // réponse d'une autre. La table se contrôle elle-même.
  const themeDe = new Map(CATALOGUE.map((i) => [i.id, i.theme]));
  for (const question of QUESTIONS) {
    for (const id of question.tete) {
      const theme = themeDe.get(id);
      assert.ok(theme, `tête inconnue du catalogue publié : ${id}`);
      assert.equal(
        questionDe({ id, theme } as never),
        question.cle,
        `${id} est en tête de « ${question.intitule} » mais se range ailleurs`,
      );
    }
  }
});

test("chaque question a un intitulé en langue naturelle, sans tiret cadratin", () => {
  for (const { intitule } of QUESTIONS) {
    assert.doesNotMatch(intitule, /[—–]/, intitule);
    assert.ok(intitule.length > 2, intitule);
  }
  // Les six questions de la maquette, dans l'ordre, plus le repli.
  assert.deepEqual(
    QUESTIONS.map((q) => q.intitule),
    [
      "Où va l'argent ?",
      "Qui paie ?",
      "Les impôts ont-ils monté ?",
      "La dette est-elle tenable ?",
      "Ça s'améliore ou ça se dégrade ?",
      "Et par rapport aux villes semblables ?",
      "Le reste",
    ],
  );
});
