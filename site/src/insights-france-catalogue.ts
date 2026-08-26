import type { FamilleInsight } from "./insights.ts";

export type RecetteTendance = {
  id: string;
  indicateur: string;
  unite: string;
  famille: FamilleInsight;
  surtitre: string;
  sujet: string;
  reserve: string;
};

export type RecetteMission = {
  id: string;
  vote: string;
  consomme: string;
  famille: FamilleInsight;
  sujet: string;
  reserve: string;
};

const t = (
  id: string,
  indicateur: string,
  unite: string,
  famille: FamilleInsight,
  surtitre: string,
  sujet: string,
  reserve: string,
): RecetteTendance => ({ id, indicateur, unite, famille, surtitre, sujet, reserve });

const m = (
  id: string,
  slug: string,
  famille: FamilleInsight,
  sujet: string,
): RecetteMission => ({
  id,
  vote: `etat_mission_${slug}_credits_votes`,
  consomme: `etat_mission_${slug}_credits_consommes`,
  famille,
  sujet,
  reserve: "Un écart d'exécution ne permet pas, à lui seul, de juger l'utilité ou l'efficacité de la dépense.",
});

const reserveBudget = "Les montants courants ne retirent pas l'inflation et le périmètre budgétaire peut évoluer.";
const reserveMacro = "Une évolution nationale agrège des situations différentes et ne démontre pas une cause unique.";
const reserveSocial = "Cette moyenne ne décrit ni chaque ménage ni les différences de composition familiale.";
const reserveSecurite = "Les faits enregistrés dépendent aussi du dépôt de plainte, de la révélation et des pratiques d'enregistrement.";

export const RECETTES_TENDANCES: RecetteTendance[] = [
  // Dette, budget et fiscalité — 15
  t("charge-dette-etat", "etat_charge_dette", "EUR", "budget", "Dette · le budget sous pression", "Charge de la dette de l'État", reserveBudget),
  t("depenses-budget-general", "etat_depenses_nettes_bg", "EUR", "budget", "État · la taille du budget", "Dépenses nettes du budget général", reserveBudget),
  t("personnel-etat", "etat_depenses_personnel", "EUR", "budget", "Fonction publique · la masse salariale", "Dépenses de personnel de l'État", reserveBudget),
  t("recette-impot-revenu", "etat_impot_revenu", "EUR", "fiscalite", "Impôt · ce que rapporte le revenu", "Recettes d'impôt sur le revenu", reserveBudget),
  t("recette-impot-societes", "etat_impot_societes", "EUR", "fiscalite", "Entreprises · la contribution au budget", "Recettes d'impôt sur les sociétés", reserveBudget),
  t("transferts-collectivites", "etat_psr_collectivites", "EUR", "budget", "Territoires · ce que l'État reverse", "Transferts de l'État aux collectivités", reserveBudget),
  t("contribution-ue", "etat_psr_union_europeenne", "EUR", "budget", "Europe · la contribution française", "Prélèvement au profit de l'Union européenne", reserveBudget),
  t("recettes-fiscales-etat", "etat_recettes_fiscales", "EUR", "fiscalite", "Fiscalité · le rendement total", "Recettes fiscales nettes de l'État", reserveBudget),
  t("recettes-non-fiscales", "etat_recettes_non_fiscales", "EUR", "budget", "État · les recettes hors impôts", "Recettes non fiscales", reserveBudget),
  t("remboursements-impots", "etat_remboursements_impots_etat", "EUR", "fiscalite", "Fiscalité · ce qui est rendu", "Remboursements et dégrèvements d'impôts", reserveBudget),
  t("tva-conservee-etat", "etat_tva", "EUR", "fiscalite", "TVA · ce que l'État conserve", "Part de TVA conservée par l'État", "La série porte sur la part conservée par l'État, pas sur tout le produit de TVA collecté."),
  t("ticpe-etat", "etat_ticpe", "EUR", "fiscalite", "Carburants · la recette de l'État", "Part de taxe énergétique conservée par l'État", "Les transferts de fiscalité entre administrations modifient la part conservée par l'État."),
  t("dette-publique-montant", "insee_dette_apu_montant", "EUR", "budget", "Dette · l'encours nominal", "Dette publique en euros", "L'encours nominal ne tient compte ni de l'inflation ni de la richesse produite."),
  t("dette-etat-montant", "insee_dette_etat_montant", "EUR", "budget", "Dette · la part de l'État", "Dette portée par l'État", "Cette série n'inclut pas les autres administrations publiques."),
  t("dette-securite-sociale", "insee_dette_asso_montant", "EUR", "budget", "Sécurité sociale · la dette séparée", "Dette de la Sécurité sociale", "Le partage de la dette entre administrations ne change pas l'encours public total."),

  // Retraites et protection sociale — 13
  t("age-depart-retraite", "drees_age_depart", "annees", "generation", "Retraites · l'âge effectif", "Âge moyen de départ à la retraite", "L'âge conjoncturel neutralise une partie des effets de génération et diffère de l'âge légal."),
  t("pension-moyenne", "drees_pension_moyenne_brute", "EUR", "generation", "Retraites · le niveau moyen", "Pension mensuelle brute moyenne", "La moyenne mélange régimes, carrières complètes et carrières incomplètes."),
  t("nombre-retraites", "drees_retraites_effectif", "count", "generation", "Retraites · le nombre à financer", "Nombre de retraités", "L'effectif ne dit rien du montant individuel des pensions."),
  t("protection-sante", "drees_protection_sociale_sante", "EUR", "services", "Santé · la protection sociale", "Prestations sociales de santé", reserveBudget),
  t("protection-vieillesse", "drees_protection_sociale_vieillesse", "EUR", "generation", "Retraites · le premier poste social", "Prestations vieillesse et survie", reserveBudget),
  t("protection-famille", "drees_protection_sociale_famille", "EUR", "services", "Familles · l'effort collectif", "Prestations consacrées à la famille", reserveBudget),
  t("protection-logement", "drees_protection_sociale_logement", "EUR", "logement", "Logement · les aides versées", "Prestations sociales de logement", reserveBudget),
  t("protection-emploi", "drees_protection_sociale_emploi", "EUR", "travail", "Chômage · la protection versée", "Prestations sociales liées à l'emploi", reserveBudget),
  t("protection-pauvrete", "drees_protection_sociale_pauvrete", "EUR", "services", "Pauvreté · la dépense ciblée", "Prestations contre la pauvreté et l'exclusion", reserveBudget),
  t("protection-sociale-total", "drees_protection_sociale_total", "EUR", "services", "Modèle social · le total", "Ensemble des prestations sociales", reserveBudget),
  t("retraite-taux-prelevement", "insee_retraite_taux_prelevement", "percent", "generation", "Générations · l'effort de cotisation", "Part du salaire cotisée pour la retraite", "Les périodes désignent ici des générations de naissance, pas des années d'observation."),
  t("retraite-rendement", "insee_retraite_rendement_interne", "percent", "generation", "Générations · le rendement du système", "Rendement interne de la retraite", "Le calcul dépend d'hypothèses de carrière, de mortalité et d'actualisation."),
  t("retraite-recuperation", "insee_retraite_taux_recuperation", "percent", "generation", "Générations · ce qui revient", "Retraite récupérée pour 100 euros cotisés", "Les périodes désignent des générations et le résultat dépend de la durée de retraite observée ou projetée."),

  // Travail, entreprises et prix — 13
  t("chomage-trajectoire", "eurostat_chomage", "percent", "travail", "Emploi · le chômage harmonisé", "Taux de chômage", reserveMacro),
  t("creations-entreprises-indice", "eurostat_creations_entreprises_indice", "indice", "travail", "Entreprises · le flux de créations", "Indice des créations d'entreprises", "L'indice ne mesure ni la taille ni la survie des entreprises créées."),
  t("defaillances-entreprises-indice", "eurostat_defaillances", "indice", "travail", "Entreprises · les cessations judiciaires", "Indice des défaillances d'entreprises", "Une défaillance judiciaire n'est pas synonyme de disparition définitive de l'activité."),
  t("croissance-pib", "eurostat_croissance_pib", "percent", "travail", "Économie · la croissance réelle", "Croissance du PIB sur un an", "Une variation trimestrielle sur un an reste sensible au point de comparaison."),
  t("inflation-harmonisee", "eurostat_inflation_ipch", "percent", "travail", "Prix · l'inflation européenne", "Inflation harmonisée", "Le taux moyen ne reflète pas le panier de consommation de chaque ménage."),
  t("inflation-insee", "insee_inflation_ipc", "percent", "travail", "Pouvoir d'achat · le thermomètre français", "Inflation mesurée par l'Insee", "L'indice des prix n'est pas un indice du coût de la vie individuel."),
  t("investissement-entreprises", "eurostat_investissement_entreprises_pib", "percent", "travail", "Entreprises · l'investissement productif", "Investissement des entreprises dans le PIB", reserveMacro),
  t("marge-entreprises", "eurostat_marge_entreprises", "percent", "travail", "Entreprises · le partage de la valeur", "Taux de marge des entreprises", "Le taux de marge n'est ni le bénéfice net ni le revenu des actionnaires."),
  t("pib-habitant", "eurostat_pib_habitant_spa", "count", "travail", "Niveau de vie · la richesse produite", "PIB par habitant en pouvoir d'achat", "Le PIB par habitant est une moyenne de production, pas un revenu distribué."),
  t("production-industrielle", "eurostat_production_industrielle", "indice", "travail", "Industrie · le décrochage ou le rebond", "Production industrielle", "L'indice agrège des branches industrielles dont les trajectoires diffèrent."),
  t("epargne-menages", "eurostat_taux_epargne_menages", "percent", "travail", "Ménages · l'argent non consommé", "Taux d'épargne des ménages", "Une forte épargne moyenne peut coexister avec des ménages sans capacité d'épargne."),
  t("creations-entreprises-nombre", "insee_creations_entreprises", "count", "travail", "Entreprises · le record brut", "Nombre de créations d'entreprises", "Le total inclut des microentreprises et ne mesure pas les emplois créés ni la survie."),
  t("salaire-net-moyen", "insee_salaire_net_eqtp_mensuel", "EUR", "travail", "Salaires · la moyenne nationale", "Salaire net mensuel moyen", "La moyenne est supérieure à la médiane et ne décrit pas les temps partiels."),

  // Inégalités et société — 10
  t("gini-trajectoire", "insee_gini", "ratio", "services", "Inégalités · le mouvement après redistribution", "Indice de Gini après redistribution", "Une variation faible de l'indice peut masquer des mouvements importants aux extrêmes."),
  t("rapport-interdecile", "insee_rapport_interdecile", "ratio", "services", "Inégalités · l'écart entre les seuils", "Rapport entre le neuvième et le premier décile", reserveSocial),
  t("rapport-interquintile", "insee_rapport_interquintile", "ratio", "services", "Inégalités · la part du haut face au bas", "Rapport de niveau de vie entre les 20 % extrêmes", reserveSocial),
  t("pauvrete-seuil-50", "insee_taux_pauvrete_50", "percent", "services", "Pauvreté · le seuil le plus sévère", "Taux de pauvreté au seuil de 50 %", "Le seuil est relatif au niveau de vie médian et évolue avec lui."),
  t("intensite-pauvrete", "insee_intensite_pauvrete_60", "percent", "services", "Pauvreté · à quelle distance du seuil", "Intensité de la pauvreté", "L'intensité mesure l'écart médian au seuil parmi les personnes pauvres."),
  t("niveau-vie-bas", "insee_niveau_vie_d1", "EUR", "services", "Niveaux de vie · le bas de l'échelle", "Seuil des 10 % les plus modestes", "Les montants sont publiés en euros constants ; le seuil ne décrit pas tous les revenus sous ce niveau."),
  t("niveau-vie-haut", "insee_niveau_vie_d9", "EUR", "services", "Niveaux de vie · le haut de l'échelle", "Seuil des 10 % les plus aisés", "Le neuvième décile est un seuil d'entrée et non la moyenne des plus aisés."),
  t("mariages", "insee_mariages", "count", "generation", "Société · le mariage recule-t-il vraiment", "Nombre de mariages", "Les restrictions de 2020 créent une rupture exceptionnelle dans la série."),
  t("pacs", "insee_pacs", "count", "generation", "Société · l'autre forme d'union", "Nombre de Pacs conclus", "Mariages et Pacs ne couvrent pas toutes les formes de vie en couple."),
  t("nuptialite", "insee_taux_nuptialite", "pour_1000_habitants", "generation", "Société · l'union rapportée à la population", "Taux de nuptialité", "Le taux dépend aussi de la structure par âge de la population."),

  // Sécurité — 13
  t("escroqueries", "ssmsi_escroqueries_nombre", "count", "securite", "Fraudes · la délinquance qui se déplace", "Victimes d'escroqueries enregistrées", reserveSecurite),
  t("tentatives-homicide", "ssmsi_tentatives_homicide_nombre", "count", "securite", "Violence · les tentatives d'homicide", "Tentatives d'homicide enregistrées", reserveSecurite),
  t("trafic-stupefiants", "ssmsi_trafic_stupefiants_nombre", "count", "securite", "Drogue · l'activité policière et judiciaire", "Personnes mises en cause pour trafic", "La série dépend fortement de l'activité des services de sécurité, pas seulement du trafic réel."),
  t("usage-stupefiants", "ssmsi_usage_stupefiants_nombre", "count", "securite", "Drogue · la réponse pénale à l'usage", "Personnes mises en cause pour usage", "La série dépend des contrôles et des politiques de verbalisation."),
  t("violences-hors-famille", "ssmsi_violences_hors_famille_nombre", "count", "securite", "Violences · hors du cercle familial", "Victimes de violences physiques hors famille", reserveSecurite),
  t("violences-intrafamiliales", "ssmsi_violences_intrafamiliales_nombre", "count", "securite", "Famille · les violences révélées", "Victimes de violences intrafamiliales", reserveSecurite),
  t("violences-sexuelles", "ssmsi_violences_sexuelles_nombre", "count", "securite", "Violences sexuelles · le nombre enregistré", "Victimes de violences sexuelles", "La hausse peut refléter à la fois les faits et une libération de la parole ou un meilleur accueil des plaintes."),
  t("vols-armes", "ssmsi_vols_armes_nombre", "count", "securite", "Vols · la violence armée", "Vols avec armes enregistrés", reserveSecurite),
  t("vols-dans-vehicules", "ssmsi_vols_dans_vehicules_nombre", "count", "securite", "Automobile · les vols dans l'habitacle", "Véhicules touchés par un vol intérieur", reserveSecurite),
  t("vols-sans-violence", "ssmsi_vols_sans_violence_nombre", "count", "securite", "Vols · la masse des atteintes", "Victimes de vols sans violence", reserveSecurite),
  t("vols-vehicules-france", "ssmsi_vols_vehicules_nombre", "count", "securite", "Automobile · les véhicules volés", "Véhicules volés", reserveSecurite),
  t("cambriolages-france", "ssmsi_cambriolages_nombre", "count", "securite", "Logement · les cambriolages", "Cambriolages de logement enregistrés", reserveSecurite),
  t("degradations", "ssmsi_degradations_nombre", "count", "securite", "Cadre de vie · les dégradations", "Destructions et dégradations enregistrées", reserveSecurite),
];

export const RECETTES_MISSIONS: RecetteMission[] = [
  m("mission-defense", "defense", "securite", "Défense"),
  m("mission-enseignement", "enseignement_scolaire", "services", "Enseignement scolaire"),
  m("mission-justice", "justice", "securite", "Justice"),
  m("mission-securites", "securites", "securite", "Police, gendarmerie et sécurité civile"),
  m("mission-immigration", "immigration_asile", "services", "Immigration, asile et intégration"),
  m("mission-sante", "sante", "services", "Santé"),
  m("mission-solidarite", "solidarite_insertion", "services", "Solidarité et insertion"),
  m("mission-recherche", "recherche_enseignement_superieur", "services", "Recherche et enseignement supérieur"),
  m("mission-ecologie", "ecologie_mobilite", "environnement", "Écologie et mobilités"),
  m("mission-agriculture", "agriculture", "environnement", "Agriculture et alimentation"),
  m("mission-aide-developpement", "aide_developpement", "budget", "Aide publique au développement"),
  m("mission-culture", "culture", "services", "Culture"),
  m("mission-sport-jeunesse", "sport_jeunesse", "generation", "Sport, jeunesse et vie associative"),
  m("mission-cohesion-territoires", "cohesion_territoires", "logement", "Cohésion des territoires"),
  m("mission-travail", "travail_emploi", "travail", "Travail et emploi"),
  m("mission-economie", "economie", "travail", "Économie"),
  m("mission-action-exterieure", "action_exterieure", "budget", "Action extérieure de l'État"),
  m("mission-administration", "administration_generale", "budget", "Administration territoriale de l'État"),
  m("mission-finances-publiques", "gestion_finances_publiques", "budget", "Gestion des finances publiques"),
  m("mission-collectivites", "relations_collectivites", "budget", "Relations avec les collectivités"),
  m("mission-outre-mer", "outre_mer", "services", "Outre-mer"),
  m("mission-medias", "medias_livre", "services", "Médias et livre"),
  m("mission-france-2030", "investir_france_2030", "travail", "Investir pour la France de 2030"),
  m("mission-regimes-retraite", "regimes_sociaux_retraite", "generation", "Régimes sociaux et de retraite"),
];

