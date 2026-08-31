export type PromotionCriteria = Readonly<{
  proofQuality: 0 | 1 | 2 | 3;
  scopeIndependence: 0 | 1 | 2;
  annualEffectAndCalendar: 0 | 1 | 2;
  mandateFeasibility: 0 | 1;
  dilemmaReality: 0 | 1;
  publicSalience: 0 | 1;
}>;

export type PromotionEvidence = Readonly<{
  proof: string;
  evidence: readonly string[];
  criteria: PromotionCriteria;
  score: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  status: "promoted" | "rejected";
  rejectionReason: null | string;
}>;

export type PromotionCandidate = PromotionEvidence & Readonly<{
  decisionId: string;
  replacesDecisionId: string;
  chapterId: string;
}>;

export type PromotionReport = Readonly<{ version: 10; candidates: readonly PromotionCandidate[] }>;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const STRONG_CRITERIA: PromotionCriteria = {
  proofQuality: 3, scopeIndependence: 2, annualEffectAndCalendar: 2,
  mandateFeasibility: 1, dilemmaReality: 1, publicSalience: 0,
};
const QUALIFIED_CRITERIA: PromotionCriteria = {
  proofQuality: 2, scopeIndependence: 2, annualEffectAndCalendar: 2,
  mandateFeasibility: 1, dilemmaReality: 1, publicSalience: 0,
};

export const PROMOTION_REPORT: PromotionReport = deepFreeze({
  version: 10,
  candidates: [
    { decisionId: "revenir-a-62-ans", replacesDecisionId: "repousser-l-age-legal-a-65-ans", chapterId: "work-wages-pensions", criteria: STRONG_CRITERIA, score: 9, status: "promoted", rejectionReason: null, proof: "Contre-choix explicite à l'âge légal de 65 ans : il remplace l'issue unique sur les retraites par un arbitrage à coût annuel majeur.", evidence: ["Documentation des retraites et calendrier législatif de mandat."] },
    { decisionId: "relever-tva-restauration-commerciale", replacesDecisionId: "porter-le-taux-normal-de-tva-a", chapterId: "taxes-assets-transmission", criteria: STRONG_CRITERIA, score: 9, status: "promoted", rejectionReason: null, proof: "Arbitrage ciblé qui complète la TVA normale par l'assiette distincte de la restauration commerciale à 10 %, sans la remplacer ni la compter deux fois.", evidence: ["BOFiP TVA restauration 2024.", "Évaluation des voies et moyens 2026, borne nette sous 2 275 M€."] },
    { decisionId: "perenniser-surtaxe-grandes-entreprises", replacesDecisionId: "doubler-la-taxe-sur-les-rachats-d", chapterId: "taxes-assets-transmission", criteria: STRONG_CRITERIA, score: 9, status: "promoted", rejectionReason: null, proof: "Arbitrage distinct sur la surtaxe IS des grands groupes, placé après la taxe sur les rachats pour remplacer une réponse budgétaire unique par deux assiettes séparées.", evidence: ["Rapport du Sénat sur le PLF 2026.", "Registre corporate-profit-surtax-2026."] },
    { decisionId: "doubler-les-franchises-medicales", replacesDecisionId: "medicaments-comparables-achats-sante", chapterId: "health-social-protection", criteria: QUALIFIED_CRITERIA, score: 8, status: "promoted", rejectionReason: null, proof: "Alternative de financement de la santé : elle remplace le seul levier achats par un arbitrage documenté sur le reste à charge.", evidence: ["Évaluation des franchises, plafonds et exonérations."] },
    { decisionId: "fiscalite-nutritionnelle-au-niveau-recommande", replacesDecisionId: "medicaments-comparables-achats-sante", chapterId: "health-social-protection", criteria: QUALIFIED_CRITERIA, score: 8, status: "promoted", rejectionReason: null, proof: "Arbitrage prévention, prix et recettes dont les assiettes sucre et alcool restent distinctes des achats, de la TVA et des niches brunes.", evidence: ["Assiettes nutritionnelles séparées et calendrier de montée en charge."] },
    { decisionId: "reduire-les-delais-de-traitement-de-l", replacesDecisionId: "doubler-l-execution-des-eloignements-oqtf", chapterId: "security-immigration-justice", criteria: QUALIFIED_CRITERIA, score: 8, status: "promoted", rejectionReason: null, proof: "Alternative de performance de l'asile : elle remplace une réponse centrée sur les éloignements par les coûts nets d'hébergement évités.", evidence: ["Données d'hébergement et calendrier de traitement de l'asile."] },
    { decisionId: "etaler-la-marche-2026-de-la-programmation", replacesDecisionId: "porter-l-effort-de-defense-vers-3", chapterId: "defence-europe-sovereignty", criteria: QUALIFIED_CRITERIA, score: 8, status: "promoted", rejectionReason: null, proof: "Contre-choix documenté au rythme de l'effort de défense : il remplace une trajectoire immédiate par un étalement compatible avec le mandat.", evidence: ["Programmation militaire 2026 et échéancier de mandat."] },
    { decisionId: "reduire-l-aide-publique-au-developpement-de", replacesDecisionId: "porter-l-effort-de-defense-vers-3", chapterId: "defence-europe-sovereignty", criteria: QUALIFIED_CRITERIA, score: 8, status: "promoted", rejectionReason: null, proof: "Arbitrage séparé sur l'aide publique au développement, net des engagements pluriannuels, qui complète le financement de la défense sans en reprendre l'assiette.", evidence: ["Crédits d'aide publique au développement et engagements pluriannuels."] },
    { decisionId: "supprimer-le-bonus-automobile-electrique", replacesDecisionId: "doubler-maprimerenov", chapterId: "energy-climate-transport-agriculture", criteria: QUALIFIED_CRITERIA, score: 8, status: "promoted", rejectionReason: null, proof: "Choix entre soutien au bonus automobile et économie : il remplace une politique de transition unique par un arbitrage distinct de MaPrimeRénov'.", evidence: ["Barème du bonus automobile et enveloppe budgétaire 2025."] },
    { decisionId: "renforcer-la-taxe-sur-les-billets-d", replacesDecisionId: "plan-ferroviaire-3-000-m-de-plus", chapterId: "energy-climate-transport-agriculture", criteria: QUALIFIED_CRITERIA, score: 8, status: "promoted", rejectionReason: null, proof: "Recette climat distincte de l'investissement ferroviaire : elle remplace une réponse de dépense isolée par un arbitrage sur le transport aérien.", evidence: ["Données de trafic aérien et taxe de solidarité sur les billets."] },
    { decisionId: "supprimer-les-departements", replacesDecisionId: "clarifier-competences-doublons-territoriaux", chapterId: "state-institutions-territories", criteria: QUALIFIED_CRITERIA, score: 8, status: "promoted", rejectionReason: null, proof: "Alternative institutionnelle de rupture : elle remplace la seule clarification des compétences par la suppression des départements, avec assiettes retranchées.", evidence: ["Évaluation territoriale, dette, agents, SI et immobilier."] },
    { decisionId: "ne-pas-remplacer-un-depart-administratif-sur", replacesDecisionId: "mutualiser-achats-publics", chapterId: "state-institutions-territories", criteria: QUALIFIED_CRITERIA, score: 8, status: "promoted", rejectionReason: null, proof: "Arbitrage sur les fonctions support de l'État central, à assiette exclusive, qui remplace une réponse limitée aux achats publics.", evidence: ["Données d'effectifs support et échéancier de non-remplacement."] },
  ],
});
