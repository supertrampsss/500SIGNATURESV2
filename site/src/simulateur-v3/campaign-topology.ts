export const CAMPAIGN_CHAPTER_SIZES = [8, 8, 8, 8, 7, 7, 7, 7] as const;

export const CAMPAIGN_DECISION_IDS = [
  "geler-le-bareme-de-l-impot-sur",
  "porter-le-taux-normal-de-tva-a",
  "tranche-a-50-au-dela-de-250",
  "retablir-un-impot-sur-la-fortune-financiere",
  "soumettre-les-revenus-du-capital-au-bareme",
  "exonerer-de-droits-de-succession-jusqu-a",
  "flat-tax-a-20-des-le-premier",
  "abolir-les-droits-de-succession",
  "supprimer-les-allegements-de-cotisations-entre-2",
  "repousser-l-age-legal-a-65-ans",
  "revenir-a-62-ans",
  "desindexer-les-pensions-d-un-point",
  "durcir-l-assurance-chomage-degressivite-duree",
  "retablir-la-semaine-de-39-heures",
  "augmenter-le-smic-de-10",
  "allocation-sociale-unique",
  "doubler-les-franchises-medicales",
  "renforcer-le-controle-des-arrets-de-travail",
  "creer-5-000-postes-de-soignants",
  "loi-grand-age-50-000-recrutements",
  "supprimer-l-aide-medicale-d-etat",
  "verser-le-rsa-automatiquement-fin-du-non",
  "porter-le-rsa-au-seuil-de",
  "assurance-maladie-publique-unique",
  "recruter-10-000-policiers-et-gendarmes",
  "construire-15-000-places-de-prison-supplementaires",
  "recruter-3-000-magistrats-et-greffiers",
  "doubler-l-execution-des-eloignements-oqtf",
  "supprimer-l-allocation-pour-demandeurs-d",
  "reserver-les-prestations-non-contributives-aux-nationaux",
  "quotas-annuels-d-immigration",
  "legaliser-et-taxer-le-cannabis",
  "porter-l-effort-de-defense-vers-3",
  "doubler-la-reserve-operationnelle",
  "service-militaire-volontaire-de-50-000",
  "doubler-les-moyens-du-renseignement-interieur",
  "sortir-de-l-euro",
  "referendum-sur-la-sortie-de-l-ue",
  "creer-une-armee-europeenne",
  "doubler-maprimerenov",
  "plan-ferroviaire-3-000-m-de-plus",
  "engager-six-epr2-part-annuelle-de-l",
  "retablir-une-trajectoire-carbone-recettes-redistribuees",
  "sortie-du-nucleaire-en-2040",
  "moratoire-sur-les-renouvelables",
  "interdire-les-voitures-thermiques-en-2030",
  "revaloriser-les-enseignants-de-5",
  "doubler-les-bourses-etudiantes-sur-criteres",
  "financer-100-000-logements-sociaux-de-plus",
  "revaloriser-les-apl-de-5",
  "cheque-education-par-eleve",
  "supprimer-le-financement-public-du-prive",
  "autonomie-complete-des-etablissements",
  "reduire-de-5-les-dotations-aux-collectivites",
  "regle-d-or-constitutionnelle",
  "geler-le-point-d-indice-en-2026",
  "ne-pas-remplacer-un-depart-administratif-sur",
  "fermer-un-tiers-des-agences-et-operateurs",
  "diviser-par-deux-le-nombre-de-parlementaires",
  "proportionnelle-integrale",
] as const;

export const campaignLength = CAMPAIGN_DECISION_IDS.length;

export function campaignPosition(completed: number): { chapterIndex: number; decisionIndex: number } {
  if (!Number.isInteger(completed) || completed < 0 || completed >= campaignLength) {
    throw new RangeError(`Invalid campaign position: ${completed}`);
  }
  let offset = completed;
  for (let chapterIndex = 0; chapterIndex < CAMPAIGN_CHAPTER_SIZES.length; chapterIndex += 1) {
    const size = CAMPAIGN_CHAPTER_SIZES[chapterIndex]!;
    if (offset < size) return { chapterIndex, decisionIndex: offset };
    offset -= size;
  }
  throw new RangeError(`Invalid campaign position: ${completed}`);
}
