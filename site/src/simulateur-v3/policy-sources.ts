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
  "itm-50-decisions": {
    sourceName: "Institut Thomas More",
    sourceUrl: "https://institut-thomas-more.org/2026/08/01/itm-dans-les-medias/",
    publishedAt: "2026-06-01",
    note: "Contrepoint éditorial libéral-conservateur. Cette source ne fonde jamais seule un chiffrage.",
  },
} as const satisfies Record<string, Omit<EvidenceBlock, "label">>;

export type PolicySourceKey = keyof typeof POLICY_SOURCES;

export function policyEvidence(sourceKeys: readonly PolicySourceKey[], label: string): EvidenceBlock[] {
  return sourceKeys.map((key) => ({ label, ...POLICY_SOURCES[key] }));
}
