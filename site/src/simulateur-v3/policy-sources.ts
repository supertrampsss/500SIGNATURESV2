import type { EvidenceBlock } from "./types.ts";

export const POLICY_SOURCES = {
  "budget-recettes-2026": {
    sourceName: "Direction du Budget",
    sourceUrl: "https://www.budget.gouv.fr/documentation/file-download/30583",
    publishedAt: "2025-10-14",
    note: "Évaluation des recettes de l'État annexée au projet de loi de finances pour 2026.",
  },
  "budget-niches-2026": {
    sourceName: "Direction du Budget",
    sourceUrl: "https://www.budget.gouv.fr/documentation/file-download/30586",
    publishedAt: "2025-10-14",
    note: "Dépenses fiscales recensées dans les voies et moyens du projet de loi de finances pour 2026.",
  },
  "cour-finances-2025": {
    sourceName: "Cour des comptes",
    sourceUrl: "https://www.ccomptes.fr/sites/default/files/2025-02/20250213-synthese-Situation-des-finances-publiques-debut-2025.pdf",
    publishedAt: "2025-02-13",
    note: "Situation et trajectoire des finances publiques françaises.",
  },
  "france-strategie-heritages": {
    sourceName: "France Stratégie",
    sourceUrl: "https://www.strategie.gouv.fr/files/files/Publications/Rapport/ns-fiscalite-heritages-26-janvier-2018.pdf",
    publishedAt: "2018-01-26",
    note: "Fiscalité des héritages et effets des règles de transmission.",
  },
  "cor-2025": {
    sourceName: "Conseil d'orientation des retraites",
    sourceUrl: "https://www.cor-retraites.fr/rapports-du-cor/rapport-annuel-cor-juin-2025-evolutions-perspectives-retraites-france",
    publishedAt: "2025-06-12",
    note: "Évolutions et perspectives du système de retraite français.",
  },
  "cour-securite-sociale-2025": {
    sourceName: "Cour des comptes",
    sourceUrl: "https://www.ccomptes.fr/fr/documents/75392",
    publishedAt: "2025-05-26",
    note: "Rapport annuel sur l'application des lois de financement de la Sécurité sociale.",
  },
  "drees-minima-2025": {
    sourceName: "DREES",
    sourceUrl: "https://www.drees.solidarites-sante.gouv.fr/publications-communique-de-presse/panoramas-de-la-drees/251204-minima-sociaux-et-prestations-de-solidarite",
    publishedAt: "2025-12-04",
    note: "Bénéficiaires, montants et non-recours aux minima sociaux.",
  },
  "insee-france-sociale-2025": {
    sourceName: "Insee",
    sourceUrl: "https://www.insee.fr/fr/statistiques/8612544?sommaire=8612596",
    publishedAt: "2025-11-20",
    note: "Revenus, emploi et inégalités dans France, portrait social.",
  },
  "justice-2025": {
    sourceName: "Ministère de la Justice",
    sourceUrl: "https://www.justice.gouv.fr/sites/default/files/2026-01/RSJ2025%20ouvrage%20complet.pdf",
    publishedAt: "2026-04-29",
    note: "Activité des juridictions, administration pénitentiaire et moyens de la justice.",
  },
  "immigration-2025": {
    sourceName: "Ministère de l'Intérieur",
    sourceUrl: "https://www.immigration.interieur.gouv.fr/documentation/etudes-et-statistiques/lessentiel-de-limmigration-donnees-2025.html",
    publishedAt: "2026-08-25",
    note: "Titres, asile, éloignements, acquisitions et intégration en 2025.",
  },
  "eloignements-2025": {
    sourceName: "Ministère de l'Intérieur",
    sourceUrl: "https://www.immigration.interieur.gouv.fr/chiffres-de-limmigration-en-france/eloignements-detrangers-en-situation-irreguliere-en-2025-dynamique-ascendante",
    publishedAt: "2026-02-12",
    note: "Éloignements exécutés et moyens mobilisés en 2025.",
  },
  "cour-immigration-2024": {
    sourceName: "Cour des comptes",
    sourceUrl: "https://www.ccomptes.fr/sites/default/files/2025-04/NEB-2024-Immigration.pdf",
    publishedAt: "2025-04-15",
    note: "Exécution budgétaire de la mission Immigration, asile et intégration.",
  },
  "defense-lpm": {
    sourceName: "Ministère des Armées",
    sourceUrl: "https://www.defense.gouv.fr/actualites/lpm-2024-2030-accroitre-forces-morales",
    publishedAt: "2024-02-19",
    note: "Objectifs, effectifs et trajectoire de la loi de programmation militaire 2024-2030.",
  },
  "eurostat-finances": {
    sourceName: "Eurostat",
    sourceUrl: "https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Government_finance_statistics",
    publishedAt: "2026-04-22",
    note: "Comparaisons européennes des recettes, dépenses, déficits et dettes publics.",
  },
  "commission-budget-ue": {
    sourceName: "Commission européenne",
    sourceUrl: "https://european-union.europa.eu/institutions-law-budget/budget/spending_en",
    publishedAt: "2025-01-01",
    note: "Architecture et affectation du budget de l'Union européenne.",
  },
  "bce-euro": {
    sourceName: "Banque centrale européenne",
    sourceUrl: "https://www.ecb.europa.eu/euro/html/index.fr.html",
    publishedAt: "2026-01-01",
    note: "Fonctionnement de la monnaie unique et rôle de l'Eurosystème.",
  },
  "rte-futurs-2050": {
    sourceName: "RTE",
    sourceUrl: "https://www.rte-france.com/donnees-publications/etudes-prospectives/futurs-energetique-2050",
    publishedAt: "2021-10-25",
    note: "Scénarios comparés du système électrique français jusqu'en 2050.",
  },
  "rte-epr2-2026": {
    sourceName: "RTE",
    sourceUrl: "https://assets.rte-france.com/prod/public/2026-04/RTE-Reactualisation-FE-2050-consultation-publique-2026-propositions-detaillees.pdf",
    publishedAt: "2026-04-30",
    note: "Réactualisation des hypothèses de demande, de production et de nouveaux réacteurs.",
  },
  "depp-ecole-2025": {
    sourceName: "DEPP",
    sourceUrl: "https://www.education.gouv.fr/depp/l-etat-de-l-ecole-2025-467767",
    publishedAt: "2025-11-01",
    note: "Résultats, moyens et inégalités du système éducatif français.",
  },
  "education-chiffres-2025": {
    sourceName: "Ministère de l'Éducation nationale",
    sourceUrl: "https://www.education.gouv.fr/depp/l-education-nationale-en-chiffres-edition-2025-452838",
    publishedAt: "2025-09-01",
    note: "Effectifs, personnels et budgets de l'Éducation nationale.",
  },
  "ofgl-rapports": {
    sourceName: "Observatoire des finances et de la gestion publique locales",
    sourceUrl: "https://www.collectivites-locales.gouv.fr/etudes-et-statistiques/rapports-de-lobservatoire-des-finances-et-de-la-gestion-publique-locales-ofgl",
    publishedAt: "2026-07-15",
    note: "Finances, investissements et effectifs des collectivités locales.",
  },
  "collectivites-chiffres-2025": {
    sourceName: "DGCL",
    sourceUrl: "https://www.collectivites-locales.gouv.fr/les-collectivites-locales-en-chiffres-2025",
    publishedAt: "2025-07-10",
    note: "Organisation territoriale, personnels, budgets et fiscalité locale.",
  },
  "education-daf-budget": {
    sourceName: "Direction des affaires financières de l'Éducation nationale",
    sourceUrl: "https://www.education.gouv.fr/sites/default/files/document/la-direction-des-affaires-financi-res-du-minist-re-charg-de-l-education-nationale-pr-sentation-476861.pdf",
    publishedAt: "2025-12-01",
    note: "La DAF indique 58 milliards d'euros de masse salariale hors CAS Pensions en LFI 2025.",
  },
  "ape-portefeuille": {
    sourceName: "Agence des participations de l'État",
    sourceUrl: "https://www.economie.gouv.fr/agence-participations-etat/comprendre-lape/les-entreprises-de-lape",
    publishedAt: "2026-08-30",
    note: "Composition et valeur du portefeuille de l'État actionnaire; cette valeur n'est pas un prix de cession ou de nationalisation.",
  },
  "ape-rapport-activite": {
    sourceName: "Agence des participations de l'État",
    sourceUrl: "https://www.economie.gouv.fr/actualites/rapport-dactivite-de-lape-une-agence-au-service-de-la-souverainete-economique",
    publishedAt: "2025-10-24",
    note: "Le rapport documente le portefeuille et les dividendes, pas le rendement récurrent d'une cession hypothétique.",
  },
  "hcaam-assurance-maladie": {
    sourceName: "Haut Conseil pour l'avenir de l'assurance maladie",
    sourceUrl: "https://www.securite-sociale.fr/home/hcaam/zone-main-content/rapports-et-avis-1/rapport-du-hcaam-quatre-scenario.html",
    publishedAt: "2022-01-14",
    note: "Quatre scénarios polaires d'articulation entre assurance maladie obligatoire et complémentaire.",
  },
  "drees-complementaire-sante-2024": {
    sourceName: "DREES",
    sourceUrl: "https://drees.solidarites-sante.gouv.fr/publications-communique-de-presse/panoramas-de-la-drees/240710_Panorama_ComplementaireSante2024",
    publishedAt: "2024-07-10",
    note: "Prestations, primes et bénéficiaires de la complémentaire santé.",
  },
  "pap-gendarmerie-2025": {
    sourceName: "Direction du Budget",
    sourceUrl: "https://www.budget.gouv.fr/documentation/file-download/27911",
    publishedAt: "2024-10-10",
    note: "Projet annuel de performances 2025 du programme Gendarmerie nationale.",
  },
  "pap-police-2025": {
    sourceName: "Direction du Budget",
    sourceUrl: "https://www.budget.gouv.fr/documentation/file-download/27959",
    publishedAt: "2024-10-10",
    note: "Projet annuel de performances 2025 du programme Police nationale.",
  },
  "lopmi-2023": {
    sourceName: "Légifrance",
    sourceUrl: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000047046768",
    publishedAt: "2023-01-24",
    note: "Loi d'orientation et de programmation du ministère de l'Intérieur.",
  },
  "cae-cannabis": {
    sourceName: "Conseil d'analyse économique",
    sourceUrl: "https://cae-eco.fr/Cannabis-comment-reprendre-le-controle",
    publishedAt: "2019-06-20",
    note: "Scénario public d'expertise sur la régulation du cannabis; il ne garantit pas le rendement retenu par le jeu.",
  },
  "ceseda": {
    sourceName: "Légifrance",
    sourceUrl: "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006070158/",
    publishedAt: "2026-08-30",
    note: "Code consolidé de l'entrée et du séjour des étrangers et du droit d'asile.",
  },
  "directive-retour-2008": {
    sourceName: "Union européenne",
    sourceUrl: "https://eur-lex.europa.eu/eli/dir/2008/115/oj?locale=fr",
    publishedAt: "2008-12-16",
    note: "Cadre européen des décisions de retour, de leur exécution et de la rétention.",
  },
  "directive-defense-2009-81": {
    sourceName: "Union européenne",
    sourceUrl: "https://eur-lex.europa.eu/eli/dir/2009/81/oj/fra",
    publishedAt: "2009-07-13",
    note: "Règles européennes applicables aux marchés de défense et de sécurité.",
  },
  "tfue-article-311": {
    sourceName: "Union européenne",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/FR/TXT/HTML/?uri=CELEX:12012E311",
    publishedAt: "2012-10-26",
    note: "L'article 311 TFUE encadre l'adoption des ressources propres de l'Union.",
  },
  "tue-article-42": {
    sourceName: "Union européenne",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/FR/TXT/HTML/?uri=CELEX:12012M042",
    publishedAt: "2012-10-26",
    note: "L'article 42 TUE encadre la politique de sécurité et une éventuelle défense commune.",
  },
  "ddhc-article-17": {
    sourceName: "Légifrance",
    sourceUrl: "https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000006527444",
    publishedAt: "1789-08-26",
    note: "Nécessité publique et indemnité juste et préalable en cas de privation de propriété.",
  },
  "ppe-2026": {
    sourceName: "Ministère de la Transition écologique",
    sourceUrl: "https://www.ecologie.gouv.fr/politiques-publiques/programmations-pluriannuelles-lenergie-ppe",
    publishedAt: "2026-02-13",
    note: "Programmation pluriannuelle de l'énergie 2026-2035.",
  },
  "anah-maprimerenov": {
    sourceName: "Anah",
    sourceUrl: "https://www.anah.gouv.fr/presse/maprimerenov-reouverture-du-guichet-la-promulgation-de-la-loi-de-finances",
    publishedAt: "2026-02-06",
    note: "Budget d'intervention et conditions de réouverture de MaPrimeRénov'.",
  },
  "sncf-reseau-finances": {
    sourceName: "SNCF Réseau",
    sourceUrl: "https://www.sncf-reseau.com/fr/finances",
    publishedAt: "2026-08-30",
    note: "Financement de la régénération et de la modernisation du réseau ferroviaire.",
  },
  "cpo-fiscalite-environnementale": {
    sourceName: "Conseil des prélèvements obligatoires",
    sourceUrl: "https://www.ccomptes.fr/fr/publications/la-fiscalite-environnementale-au-defi-de-lurgence-climatique",
    publishedAt: "2019-09-18",
    note: "Rendement, acceptabilité et redistribution de la fiscalité environnementale.",
  },
  "ue-vehicules-2023-851": {
    sourceName: "Union européenne",
    sourceUrl: "https://eur-lex.europa.eu/eli/reg/2023/851/oj/fra",
    publishedAt: "2023-04-19",
    note: "Objectif européen de réduction de 100 % des émissions moyennes des voitures neuves en 2035.",
  },
  "art-autoroutes": {
    sourceName: "Autorité de régulation des transports",
    sourceUrl: "https://www.autorite-transports.fr/les-autoroutes/",
    publishedAt: "2026-08-30",
    note: "Contrats, économie et régulation des concessions autoroutières.",
  },
  "itm-50-decisions": {
    sourceName: "Institut Thomas More",
    sourceUrl: "https://institut-thomas-more.org/2026/06/25/rapport36/",
    publishedAt: "2026-06-25",
    note: "Contrepoint éditorial libéral-conservateur. Cette source ne fonde jamais seule un chiffrage.",
  },
} as const satisfies Record<string, Omit<EvidenceBlock, "label">>;

export type PolicySourceKey = keyof typeof POLICY_SOURCES;

export function policyEvidence(sourceKeys: readonly PolicySourceKey[], label: string): EvidenceBlock[] {
  return sourceKeys.map((key) => ({ label, ...POLICY_SOURCES[key] }));
}
