export type SourceArbitrage = {
  id: string;
  institution: string;
  titre: string;
  url: string;
  millesime: string;
};

export const SOURCES_ARBITRAGES: readonly SourceArbitrage[] = [
  {
    id: "dgfip-ir-2024",
    institution: "DGFiP",
    titre: "L'impôt sur le revenu 2024 a été plus dynamique que les revenus",
    url: "https://www.impots.gouv.fr/dgfip-statistiques-limpot-sur-le-revenu-2024-ete-plus-dynamique-que-les-revenus",
    millesime: "2025",
  },
  {
    id: "insee-tres-hauts-revenus",
    institution: "Insee",
    titre: "Les très hauts revenus en France",
    url: "https://www.insee.fr/fr/statistiques/8612588",
    millesime: "2025",
  },
  {
    id: "ocde-redistribution",
    institution: "OCDE",
    titre: "Pauvreté et inégalités, Panorama des administrations publiques 2025",
    url: "https://www.oecd.org/fr/publications/panorama-des-administrations-publiques-2025_758a7905-fr/full-report/poverty-and-inequality_5f7b56a0.html",
    millesime: "2025",
  },
  {
    id: "insee-pauvrete-2024",
    institution: "Insee",
    titre: "Niveau de vie et pauvreté en 2024",
    url: "https://www.insee.fr/fr/statistiques/9019316",
    millesime: "2026",
  },
  {
    id: "insee-patrimoine-age",
    institution: "Insee",
    titre: "Patrimoine des ménages selon l'âge de la personne de référence",
    url: "https://www.insee.fr/fr/statistiques/2412784",
    millesime: "2024",
  },
  {
    id: "drees-majoration-enfants",
    institution: "DREES",
    titre: "Majoration de pension pour trois enfants ou plus",
    url: "https://www.drees.solidarites-sante.gouv.fr/publications-communique-de-presse/les-dossiers-de-la-drees/250313_DD_majoration-pension-retraite-trois-enfants-ou-plus",
    millesime: "2025",
  },
  {
    id: "cour-comptes-finances-2025",
    institution: "Cour des comptes",
    titre: "La situation des finances publiques début 2025",
    url: "https://www.ccomptes.fr/sites/default/files/2025-02/20250213-synthese-Situation-des-finances-publiques-debut-2025.pdf",
    millesime: "2025",
  },
  {
    id: "bofip-contribution-exceptionnelle-2026",
    institution: "BOFiP",
    titre: "Prorogation de la contribution exceptionnelle sur les bénéfices des grandes entreprises",
    url: "https://bofip.impots.gouv.fr/bofip/15092-PGP.html/ACTU-2026-00097",
    millesime: "2026",
  },
  {
    id: "assemblee-nationale-sncf",
    institution: "Assemblée nationale",
    titre: "Question écrite sur le coût public de la SNCF",
    url: "https://www.assemblee-nationale.fr/dyn/17/questions/QANR5L17QE3193",
    millesime: "2025",
  },
];

export const IDS_SOURCES_ARBITRAGES = new Set(SOURCES_ARBITRAGES.map(({ id }) => id));
