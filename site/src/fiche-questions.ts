/**
 * Le corps de la fiche, rangé sous des questions et non sous des comptes.
 *
 * Une fiche communale publie deux cent neuf indicateurs. Rangés par thème, ils
 * portent les noms de la nomenclature : « Finances locales », « Impôts
 * locaux », « Secteurs salariés ». Ce sont les intitulés du plan comptable, pas
 * ceux d'une question — personne n'ouvre un site pour lire « épargne de
 * gestion », on l'ouvre pour savoir si la dette de sa ville est tenable.
 *
 * Cette table range donc chaque indicateur sous la question à laquelle il
 * contribue. Deux propriétés la gouvernent, toutes deux testées :
 *
 * 1. **Exhaustivité.** Aucun indicateur ne se perd. Ce qui ne répond à aucune
 *    des six questions tombe dans une entrée de repli — visible, nommée, pas un
 *    trou. C'est la même règle que les rubriques de `fiche.ts` : une liste
 *    écrite en dur avait déjà fait disparaître des données publiées.
 * 2. **Unicité.** Aucun indicateur ne figure sous deux questions. Le même
 *    chiffre lu deux fois à deux endroits d'une même fiche est le défaut que
 *    cette refonte corrige ; le recréer sous des intitulés plus aimables ne
 *    l'excuserait pas.
 *
 * Le classement se lit dans un seul sens : ce qui sort (« Où va l'argent ? »),
 * ce qui entre (« Qui paie ? »), l'impôt lui-même (« Les impôts ont-ils
 * monté ? »), l'équilibre (« La dette est-elle tenable ? »), puis ce que
 * l'argent public traite et ce qui situe le territoire.
 */

import type { Indicateur } from "./donnees.ts";

export type Question = {
  /** Identifiant stable : il vit dans le DOM (`data-question`) et dans l'URL. */
  cle: string;
  /** L'intitulé tel qu'il s'affiche. En langue naturelle, avec son point
   *  d'interrogation — c'est une question, pas un titre de rubrique. */
  intitule: string;
  /**
   * Les lignes qui ouvrent la question, dans cet ordre.
   *
   * « L'essentiel » ne montre pas les cinquante lignes d'une question : il
   * montre celles qui y répondent. Ce sont des identifiants, pas des règles —
   * l'ordre de lecture d'une question est un choix éditorial, et il se lit
   * mieux écrit qu'inféré. Ce qui n'y figure pas n'est pas perdu : la question
   * se complète avec ses autres indicateurs, et « Tout voir » rouvre la fiche
   * entière.
   *
   * Un identifiant écrit ici doit tomber dans sa propre question : c'est vérifié.
   */
  tete: string[];
};

/** La clé de l'entrée de repli. Elle existe comme les autres : ce qui ne répond
 *  à aucune question reste publié, sous un intitulé qui ne ment pas. */
export const REPLI = "reste";

export const QUESTIONS: Question[] = [
  {
    cle: "depenses",
    intitule: "Où va l'argent ?",
    // À quoi sert l'argent avant ce qu'on achète : « 23 M€ pour le sport » se
    // discute, « achats et charges externes » non.
    tete: [
      "fonction_commune_services_generaux",
      "fonction_commune_culture_sport",
      "fonction_commune_enseignement",
      "fonction_commune_social_famille",
      "fonction_commune_amenagement_economie",
      "ofgl_frais_personnel",
      "ofgl_depenses_d_equipement",
      "etat_depenses_nettes_bg",
      "drees_protection_sociale_total",
    ],
  },
  {
    cle: "recettes",
    intitule: "Qui paie ?",
    // Le partage entre le contribuable local, l'État et l'usager : c'est cela,
    // « qui paie ». Le détail des impôts appartient à la question suivante.
    tete: [
      "ofgl_impots_locaux",
      "dgcl_dotation_globale_fonctionnement",
      "ofgl_ventes_de_biens_et_services",
      "derive_part_dgf",
      "ofgl_recettes_fonctionnement",
      "etat_recettes_nettes_bg",
    ],
  },
  {
    cle: "impots",
    intitule: "Les impôts ont-ils monté ?",
    // Le taux global d'abord : c'est celui qui figure sur l'avis d'imposition.
    tete: [
      "dgfip_taux_tfb_global",
      "dgfip_taux_tfb_commune",
      "derive_part_non_communale_tfb",
      "dgfip_produit_foncier_bati",
      "dgfip_produit_cfe",
      "depense_fiscale_totale",
    ],
  },
  {
    cle: "dette",
    intitule: "La dette est-elle tenable ?",
    // L'encours puis ce qui permet de le rembourser : la capacité de
    // désendettement est le rapport que les financiers publics lisent en premier.
    tete: [
      "ofgl_encours_dette",
      "derive_desendettement",
      "ofgl_epargne_brute",
      "derive_taux_epargne",
      "ofgl_annuite_de_la_dette",
      "insee_dette_apu_part_pib",
    ],
  },
  {
    cle: "evolution",
    intitule: "Ça s'améliore ou ça se dégrade ?",
    tete: [
      "insee_niveau_vie_median",
      "insee_taux_pauvrete",
      "insee_taux_chomage_localise",
      "ssmsi_cambriolages_taux",
      "insee_logements_vacants",
      "drees_apl_generalistes",
    ],
  },
  {
    cle: "semblables",
    intitule: "Et par rapport aux villes semblables ?",
    tete: [
      "insee_population_municipale",
      "insee_pcs_cadres",
      "insee_pcs_ouvriers",
      "insee_diplome_superieur",
      "insee_etablissements_actifs",
      "eurostat_pib_habitant_spa",
    ],
  },
  // Le repli n'a pas de tête : ce qui n'y répond à aucune question n'a pas
  // d'ordre de lecture à proposer. Ses lignes suivent celles du catalogue.
  { cle: REPLI, intitule: "Le reste", tete: [] },
];

const CLES = new Set(QUESTIONS.map((q) => q.cle));

/**
 * Les identifiants qui ne se déduisent d'aucune règle générale.
 *
 * Le thème « Finances locales » mélange les trois premières questions : la même
 * étiquette porte ce que la commune dépense, ce qu'elle encaisse et ce qu'elle
 * doit. C'est précisément ce mélange qui rend le thème illisible, et c'est donc
 * ici qu'il se défait, ligne par ligne. Aucun préfixe ne peut le faire :
 * `ofgl_depenses_*` et `ofgl_recettes_*` s'y prêteraient, mais `ofgl_epargne_*`,
 * `ofgl_fctva` ou `ofgl_travaux_en_regie` non.
 */
const PAR_ID: Record<string, string> = {};

function ranger(cle: string, ids: string[]): void {
  for (const id of ids) PAR_ID[id] = cle;
}

/* Ce que la collectivité dépense. Les douze fonctions (à quoi sert l'argent)
   et les natures de dépense (ce qu'elle achète) décrivent le même total par
   deux axes qui ne s'additionnent pas — ils répondent pourtant à la même
   question, et c'est la fiche, pas cette table, qui interdit de les sommer. */
ranger("depenses", [
  "ofgl_depenses_totales",
  "ofgl_depenses_totales_hors_remb",
  "ofgl_depenses_fonctionnement",
  "ofgl_depenses_investissement",
  "ofgl_depenses_d_investissement_hors_remb",
  "ofgl_depenses_d_equipement",
  "ofgl_depenses_d_intervention",
  "ofgl_frais_personnel",
  "ofgl_frais_d_hebergement",
  "ofgl_achats_et_charges_externes",
  "ofgl_subventions_aux_personnes_de_droit_prive",
  "ofgl_subventions_d_equipement_versees",
  "ofgl_autres_depenses_de_fonctionnement",
  "ofgl_autres_depenses_d_investissement",
  "ofgl_travaux_en_regie",
  // Ce que les départements versent aux personnes et aux services : ce sont
  // des dépenses de la collectivité, quel que soit qui en fixe le barème.
  "ofgl_allocations_apa",
  "ofgl_allocations_pch",
  "ofgl_allocations_rsa",
  "ofgl_contributions_aux_sdis",
  // Les deux ratios qui décrivent la composition de la dépense, pas son
  // financement : ils se lisent avec les lignes ci-dessus.
  "derive_rigidite",
  "derive_effort_investissement",
]);

/* D'où vient l'argent. Les impôts locaux figurent ici en masse — « qui paie »
   se répond d'abord par le partage entre contribuable local, État et usager.
   Le détail des impôts, taux compris, appartient à la question suivante. */
ranger("recettes", [
  "ofgl_recettes_totales",
  "ofgl_recettes_totales_hors_emprunts",
  "ofgl_recettes_fonctionnement",
  "ofgl_recettes_d_investissement",
  "ofgl_recettes_d_investissement_hors_emprunts",
  "ofgl_impots_et_taxes",
  "ofgl_impots_locaux",
  "ofgl_autres_impots_et_taxes",
  "ofgl_taxe_d_enlevement_des_ordures_menageres",
  "ofgl_versement_transport",
  "ofgl_tva",
  "ofgl_fiscalite_reversee",
  "ofgl_dotation_globale_de_fonctionnement",
  "ofgl_autres_dotations_de_fonctionnement",
  "ofgl_autres_dotations_et_subventions",
  "ofgl_concours_de_l_etat",
  "ofgl_perequations_et_compensations_fiscales",
  "ofgl_subventions_recues_et_participations",
  "ofgl_fctva",
  "ofgl_ventes_de_biens_et_services",
  "ofgl_produit_des_cessions_d_immobilisations",
  "ofgl_autres_recettes_de_fonctionnement",
  "ofgl_autres_recettes_d_investissement",
  "dgcl_dotation_globale_fonctionnement",
  "dgcl_dotation_solidarite_rurale",
  "dgcl_dotation_solidarite_urbaine",
  "dgcl_dotation_nationale_perequation",
  "derive_part_dgf",
  // Les recettes propres aux départements et aux régions : droits de mutation,
  // CVAE, cartes grises, TICPE, TSCA, concours de la CNSA et compensations de
  // la décentralisation. La péréquation des DMTO figure ici de ses deux côtés —
  // ce qui est prélevé et ce qui est reversé se lisent ensemble, ou pas du tout.
  "ofgl_dmto_avant_pereq",
  "ofgl_dmto_apres_pereq",
  "ofgl_attribution_fonds_de_pereq_dmto",
  "ofgl_prelevement_fonds_de_pereq_dmto",
  "ofgl_cvae",
  "ofgl_cartes_grises",
  "ofgl_ticpe",
  "ofgl_tsca",
  "ofgl_cnsa",
  "ofgl_ddec",
  "ofgl_dres",
  "ofgl_fmdi",
  "dgfip_dmto_departement",
  "dgfip_dmto_communes",
]);

/* La dette et ce qui permet de la tenir. Les intérêts sont une dépense au
   compte de résultat ; ils se lisent pourtant avec l'encours, parce que la
   question posée est celle de la charge, pas celle du service rendu. L'épargne
   est ici pour la même raison : c'est le dénominateur de la capacité de
   désendettement, et la séparer du numérateur rendrait les deux illisibles. */
ranger("dette", [
  "ofgl_encours_dette",
  "ofgl_encours_de_dette_dettes_bancaires_et_assimilees",
  "ofgl_encours_de_dette_depots_et_cautionnements_recus",
  "ofgl_annuite_de_la_dette",
  "ofgl_charges_financieres",
  "ofgl_emprunts_hors_gad",
  "ofgl_remboursements_d_emprunts_hors_gad",
  "ofgl_flux_net_de_dette",
  "ofgl_credits_de_tresorerie",
  "ofgl_fonds_de_soutien_aux_emprunts_a_risque",
  "ofgl_epargne_brute",
  "ofgl_epargne_nette",
  "ofgl_epargne_de_gestion",
  "ofgl_epargne_brute_avant_travaux_en_regie",
  "ofgl_capacite_ou_besoin_de_financement",
  "ofgl_fonds_de_roulement",
  "ofgl_variation_du_fonds_de_roulement",
  "ofgl_depots_au_tresor",
  "derive_desendettement",
  "derive_taux_epargne",
  "derive_interets_sur_recettes",
  "derive_charge_dette_sur_impots",
  "derive_dette_locale_en_revenu",
]);

/**
 * Les préfixes, appliqués après les identifiants et avant les thèmes.
 *
 * Quatre-vingt-une lignes du budget de l'État portent le même thème
 * `budget_etat` et se répartissent pourtant sur trois questions : les missions
 * sont des dépenses, les impôts d'État des recettes, le solde et la charge de
 * la dette un équilibre. Les nommer une à une ferait une table à tenir à jour à
 * chaque loi de finances ; le préfixe, lui, suit la convention de nommage du
 * connecteur.
 *
 * L'ordre compte : le premier préfixe qui correspond l'emporte.
 */
const PAR_PREFIXE: [string, string][] = [
  // Les douze fonctions communales : à quoi sert l'argent de la ville.
  ["fonction_commune_", "depenses"],
  ["ofgl_fonction_", "depenses"],
  ["eurostat_fonction_", "depenses"],
  ["etat_mission_", "depenses"],
  ["etat_depenses", "depenses"],
  ["etat_psr_", "recettes"],
  ["etat_impot_", "recettes"],
  ["etat_recettes", "recettes"],
  ["etat_remboursements_impots", "recettes"],
  ["etat_tva", "recettes"],
  ["etat_ticpe", "recettes"],
  ["etat_charge_dette", "dette"],
  ["etat_solde_", "dette"],
  ["insee_apu_solde", "dette"],
  ["insee_dette_", "dette"],
  // Les prestations versées par la protection sociale : de l'argent public qui
  // sort, décomposé par risque.
  ["drees_protection_sociale_", "depenses"],
  ["eurostat_secu_depenses", "depenses"],
  ["eurostat_secu_recettes", "recettes"],
  ["eurostat_secu_solde", "dette"],
  // Une dépense fiscale est un impôt qu'on ne perçoit pas : elle se lit avec
  // l'impôt, pas avec le budget qui ne l'a jamais encaissé.
  ["depense_fiscale_", "impots"],
  ["eurostat_impots_", "impots"],
  ["eurostat_prelevements_obligatoires", "impots"],
  ["eurostat_cotisations_sociales", "impots"],
  ["eurostat_dette_pib", "dette"],
  ["eurostat_deficit_pib", "dette"],
];

/**
 * Le thème, en dernier recours.
 *
 * Les deux dernières questions ne sont pas des masses financières, et c'est
 * assumé : « ça s'améliore ou ça se dégrade ? » range ce que l'argent public
 * traite — la sécurité, la santé, l'école, le logement, l'emploi, les revenus —
 * c'est-à-dire les séries dont le sens d'évolution est l'information. « Et par
 * rapport aux villes semblables ? » range ce qui **situe** le territoire dans
 * son groupe : sa taille, sa structure sociale, son tissu économique, ses
 * équipements. Ce sont exactement les grandeurs qui définissent les communes
 * comparables, et elles ne se lisent que par comparaison.
 *
 * Un thème absent de cette table tombe dans le repli. Il n'est pas perdu.
 */
const PAR_THEME: Record<string, string> = {
  // « Finances locales » n'y figure pas, et c'est voulu : le thème mélange les
  // trois premières questions, et un repli sur l'une d'elles rangerait
  // silencieusement une recette nouvelle parmi les dépenses. Une ligne OFGL que
  // `PAR_ID` ne connaît pas tombe donc dans le repli — visible, et corrigeable.
  vie_associative: "depenses",
  fonctions: "depenses",
  securite_sociale: "depenses",
  budget_etat: "depenses",
  impots_locaux: "impots",
  depenses_fiscales: "impots",
  dette: "dette",
  securite: "evolution",
  sante: "evolution",
  education: "evolution",
  logement: "evolution",
  emploi: "evolution",
  revenus: "evolution",
  justice: "evolution",
  environnement: "evolution",
  transports: "evolution",
  energie: "evolution",
  macro: "evolution",
  population: "semblables",
  famille: "semblables",
  professions: "semblables",
  diplomes: "semblables",
  entreprises: "semblables",
  secteurs_salaries: "semblables",
  secteurs_etablissements: "semblables",
  equipements: "semblables",
  europe: "semblables",
};

/**
 * La question d'un indicateur. Trois passes, de la plus précise à la plus
 * générale, puis le repli. Ne rend jamais de clé inconnue.
 */
export function questionDe(indicateur: Indicateur): string {
  const parId = PAR_ID[indicateur.id];
  if (parId && CLES.has(parId)) return parId;
  for (const [prefixe, cle] of PAR_PREFIXE) {
    if (indicateur.id.startsWith(prefixe)) return cle;
  }
  const parTheme = PAR_THEME[indicateur.theme];
  return parTheme && CLES.has(parTheme) ? parTheme : REPLI;
}

/**
 * Répartit un catalogue sous les questions, dans l'ordre déclaré.
 *
 * Les questions sans aucun indicateur ne sont pas rendues : une question qui
 * ouvre sur du vide est un cul-de-sac, et la fiche n'en propose pas. L'ordre
 * des indicateurs à l'intérieur d'une question est celui reçu — c'est
 * l'appelant qui sait lequel est phare.
 */
export function repartir(
  indicateurs: Indicateur[],
): { question: Question; indicateurs: Indicateur[] }[] {
  const groupes = new Map<string, Indicateur[]>();
  for (const indicateur of indicateurs) {
    const cle = questionDe(indicateur);
    groupes.set(cle, [...(groupes.get(cle) ?? []), indicateur]);
  }
  return QUESTIONS.flatMap((question) => {
    const liste = groupes.get(question.cle);
    return liste?.length ? [{ question, indicateurs: liste }] : [];
  });
}
