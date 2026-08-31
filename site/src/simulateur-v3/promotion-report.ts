export type PromotionEvidence = Readonly<{
  proof: string;
  score: 8 | 9 | 10;
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

export const PROMOTION_REPORT: PromotionReport = deepFreeze({
  version: 10,
  candidates: [
    { decisionId: "revenir-a-62-ans", replacesDecisionId: "repousser-l-age-legal-a-65-ans", chapterId: "work-wages-pensions", score: 9, status: "promoted", rejectionReason: null, proof: "Contre-choix explicite à l'âge légal de 65 ans : il remplace l'issue unique sur les retraites par un arbitrage à coût annuel majeur." },
    { decisionId: "relever-tva-restauration-commerciale", replacesDecisionId: "porter-le-taux-normal-de-tva-a", chapterId: "taxes-assets-transmission", score: 9, status: "promoted", rejectionReason: null, proof: "Arbitrage ciblé qui complète la TVA normale par l'assiette distincte de la restauration commerciale à 10 %, sans la remplacer ni la compter deux fois." },
    { decisionId: "perenniser-surtaxe-grandes-entreprises", replacesDecisionId: "doubler-la-taxe-sur-les-rachats-d", chapterId: "taxes-assets-transmission", score: 9, status: "promoted", rejectionReason: null, proof: "Arbitrage distinct sur la surtaxe IS des grands groupes, placé après la taxe sur les rachats pour remplacer une réponse budgétaire unique par deux assiettes séparées." },
    { decisionId: "doubler-les-franchises-medicales", replacesDecisionId: "medicaments-comparables-achats-sante", chapterId: "health-social-protection", score: 8, status: "promoted", rejectionReason: null, proof: "Alternative de financement de la santé : elle remplace le seul levier achats par un arbitrage documenté sur le reste à charge." },
    { decisionId: "fiscalite-nutritionnelle-au-niveau-recommande", replacesDecisionId: "medicaments-comparables-achats-sante", chapterId: "health-social-protection", score: 8, status: "promoted", rejectionReason: null, proof: "Arbitrage prévention, prix et recettes dont les assiettes sucre et alcool restent distinctes des achats, de la TVA et des niches brunes." },
    { decisionId: "reduire-les-delais-de-traitement-de-l", replacesDecisionId: "doubler-l-execution-des-eloignements-oqtf", chapterId: "security-immigration-justice", score: 8, status: "promoted", rejectionReason: null, proof: "Alternative de performance de l'asile : elle remplace une réponse centrée sur les éloignements par les coûts nets d'hébergement évités." },
    { decisionId: "etaler-la-marche-2026-de-la-programmation", replacesDecisionId: "porter-l-effort-de-defense-vers-3", chapterId: "defence-europe-sovereignty", score: 8, status: "promoted", rejectionReason: null, proof: "Contre-choix documenté au rythme de l'effort de défense : il remplace une trajectoire immédiate par un étalement compatible avec le mandat." },
    { decisionId: "reduire-l-aide-publique-au-developpement-de", replacesDecisionId: "porter-l-effort-de-defense-vers-3", chapterId: "defence-europe-sovereignty", score: 8, status: "promoted", rejectionReason: null, proof: "Arbitrage séparé sur l'aide publique au développement, net des engagements pluriannuels, qui complète le financement de la défense sans en reprendre l'assiette." },
    { decisionId: "supprimer-le-bonus-automobile-electrique", replacesDecisionId: "doubler-maprimerenov", chapterId: "energy-climate-transport-agriculture", score: 8, status: "promoted", rejectionReason: null, proof: "Choix entre soutien au bonus automobile et économie : il remplace une politique de transition unique par un arbitrage distinct de MaPrimeRénov'." },
    { decisionId: "renforcer-la-taxe-sur-les-billets-d", replacesDecisionId: "plan-ferroviaire-3-000-m-de-plus", chapterId: "energy-climate-transport-agriculture", score: 8, status: "promoted", rejectionReason: null, proof: "Recette climat distincte de l'investissement ferroviaire : elle remplace une réponse de dépense isolée par un arbitrage sur le transport aérien." },
    { decisionId: "supprimer-les-departements", replacesDecisionId: "clarifier-competences-doublons-territoriaux", chapterId: "state-institutions-territories", score: 8, status: "promoted", rejectionReason: null, proof: "Alternative institutionnelle de rupture : elle remplace la seule clarification des compétences par la suppression des départements, avec assiettes retranchées." },
    { decisionId: "ne-pas-remplacer-un-depart-administratif-sur", replacesDecisionId: "mutualiser-achats-publics", chapterId: "state-institutions-territories", score: 8, status: "promoted", rejectionReason: null, proof: "Arbitrage sur les fonctions support de l'État central, à assiette exclusive, qui remplace une réponse limitée aux achats publics." },
  ],
});
