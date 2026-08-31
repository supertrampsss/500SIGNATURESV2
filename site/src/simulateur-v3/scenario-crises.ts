import type { CrisisRule, EffectRule, IndicatorKey } from "./types.ts";

function crisisEffect(id: string, key: IndicatorKey, delta: number, explanation: string): EffectRule {
  return {
    id,
    target: "indicator",
    key,
    delta,
    timing: { kind: "immediate" },
    duration: "once",
    explanation,
  };
}

/** One conditional and option-traceable crisis family for each campaign chapter. */
export const SCENARIO_V9_CRISIS_RULES: readonly CrisisRule[] = Object.freeze([
  {
    id: "flat-tax-revolt",
    title: "Le pays se fracture sur l'impôt et le déficit",
    body: "Le taux unique ou le refus durable de nouvelles recettes cristallise une contestation nationale avant le premier Conseil.",
    indicator: "opinion",
    threshold: 55,
    comparator: "lte",
    eligibleFromChapterIndex: 0,
    maxOccurrences: 1,
    requiredDecisionIds: [
      "geler-le-bareme-de-l-impot-sur",
      "flat-tax-a-20-des-le-premier",
    ],
    aggravatingChoices: [
      {
        decisionId: "geler-le-bareme-de-l-impot-sur",
        optionIds: ["geler-le-bareme-de-l-impot-sur:keep"],
      },
      {
        decisionId: "flat-tax-a-20-des-le-premier",
        optionIds: ["flat-tax-a-20-des-le-premier:adopt"],
      },
      {
        decisionId: "retablir-un-impot-sur-la-fortune-financiere",
        optionIds: ["retablir-un-impot-sur-la-fortune-financiere:keep"],
      },
    ],
    concessions: [
      {
        id: "suspend-flat-tax",
        label: "Suspendre la flat tax et rétablir le barème",
        targetDecisionId: "flat-tax-a-20-des-le-premier",
        policyChange: "suspend",
        effects: [
          crisisEffect("suspend-flat-tax:budget", "annualBalance", -150_000, "La suspension annule l'économie annuelle attribuée au taux unique."),
          crisisEffect("suspend-flat-tax:opinion", "opinion", 8, "Le retrait apaise une partie de la contestation."),
          crisisEffect("suspend-flat-tax:capacity", "reformCapacity", -4, "Le recul réduit la capacité à imposer la réforme suivante."),
        ],
      },
      {
        id: "partial-bracket-freeze",
        label: "Limiter le gel du barème",
        targetDecisionId: "geler-le-bareme-de-l-impot-sur",
        policyChange: "amend",
        effects: [
          crisisEffect("partial-bracket-freeze:budget", "annualBalance", 800, "L'indexation ciblée préserve une partie de la recette attendue."),
          crisisEffect("partial-bracket-freeze:trust", "institutionalTrust", 2, "Le compromis rend la trajectoire fiscale plus lisible."),
        ],
      },
    ],
    holdCourseEffects: [
      crisisEffect("flat-tax-revolt:opinion", "opinion", -5, "Le maintien du cap élargit la contestation."),
      crisisEffect("flat-tax-revolt:credibility", "financialCredibility", -4, "L'absence de compromis dégrade la crédibilité financière."),
    ],
  },
  {
    id: "labour-reform-blockade",
    title: "Le conflit social bloque les transports",
    body: "L'accumulation de réformes sur le temps de travail et les retraites transforme la contestation en mouvement national.",
    indicator: "opinion",
    threshold: 45,
    comparator: "lte",
    eligibleFromChapterIndex: 1,
    maxOccurrences: 1,
    requiredDecisionIds: [
      "repousser-l-age-legal-a-65-ans",
      "retablir-la-semaine-de-39-heures",
    ],
    aggravatingChoices: [
      {
        decisionId: "repousser-l-age-legal-a-65-ans",
        optionIds: ["repousser-l-age-legal-a-65-ans:adopt"],
      },
      {
        decisionId: "desindexer-les-pensions-d-un-point",
        optionIds: ["desindexer-les-pensions-d-un-point:adopt"],
      },
      {
        decisionId: "durcir-l-assurance-chomage-degressivite-duree",
        optionIds: ["durcir-l-assurance-chomage-degressivite-duree:adopt"],
      },
      {
        decisionId: "retablir-la-semaine-de-39-heures",
        optionIds: ["retablir-la-semaine-de-39-heures:adopt"],
      },
    ],
    concessions: [
      {
        id: "suspend-age-65",
        label: "Suspendre le passage à 65 ans",
        targetDecisionId: "repousser-l-age-legal-a-65-ans",
        policyChange: "suspend",
        effects: [
          crisisEffect("suspend-age-65:opinion", "opinion", 6, "La suspension ouvre une négociation avec les partenaires sociaux."),
          crisisEffect("suspend-age-65:capacity", "reformCapacity", -3, "Le recul rend les réformes suivantes plus difficiles."),
        ],
      },
      {
        id: "amend-39-hours",
        label: "Limiter les 39 heures aux accords de branche",
        targetDecisionId: "retablir-la-semaine-de-39-heures",
        policyChange: "amend",
        effects: [
          crisisEffect("amend-39-hours:opinion", "opinion", 4, "La négociation de branche réduit le front du refus."),
          crisisEffect("amend-39-hours:majority", "majority", -2, "Une partie de la majorité refuse le compromis."),
        ],
      },
    ],
    holdCourseEffects: [
      crisisEffect("labour-blockade:opinion", "opinion", -5, "La poursuite du conflit élargit la contestation."),
      crisisEffect("labour-blockade:majority", "majority", -5, "Des élus de la majorité demandent une pause sociale."),
    ],
  },
  {
    id: "care-access-breakdown",
    title: "L'accès aux soins se dégrade brutalement",
    body: "Les économies et les capacités hospitalières insuffisantes produisent des fermetures temporaires et des renoncements aux soins.",
    indicator: "publicServices",
    threshold: 50,
    comparator: "lte",
    eligibleFromChapterIndex: 2,
    maxOccurrences: 1,
    requiredDecisionIds: [
      "doubler-les-franchises-medicales",
      "loi-grand-age-50-000-recrutements",
    ],
    aggravatingChoices: [
      {
        decisionId: "doubler-les-franchises-medicales",
        optionIds: ["doubler-les-franchises-medicales:adopt"],
      },
      {
        decisionId: "creer-5-000-postes-de-soignants",
        optionIds: ["creer-5-000-postes-de-soignants:keep"],
      },
      {
        decisionId: "loi-grand-age-50-000-recrutements",
        optionIds: ["loi-grand-age-50-000-recrutements:keep"],
      },
      {
        decisionId: "supprimer-l-aide-medicale-d-etat",
        optionIds: ["supprimer-l-aide-medicale-d-etat:adopt"],
      },
    ],
    concessions: [
      {
        id: "amend-medical-deductibles",
        label: "Exonérer les patients chroniques",
        targetDecisionId: "doubler-les-franchises-medicales",
        policyChange: "amend",
        effects: [
          crisisEffect("amend-deductibles:services", "publicServices", 3, "L'exonération réduit les renoncements aux soins."),
          crisisEffect("amend-deductibles:budget", "annualBalance", -300, "L'exonération réduit l'économie annuelle."),
        ],
      },
      {
        id: "amend-grand-age-plan",
        label: "Financer un recrutement d'urgence",
        targetDecisionId: "loi-grand-age-50-000-recrutements",
        policyChange: "amend",
        effects: [
          crisisEffect("amend-grand-age:services", "publicServices", 4, "Le recrutement d'urgence réouvre des capacités."),
          crisisEffect("amend-grand-age:budget", "annualBalance", -900, "Le renfort augmente la dépense annuelle."),
        ],
      },
    ],
    holdCourseEffects: [
      crisisEffect("care-breakdown:services", "publicServices", -3, "Les tensions de personnel ferment de nouvelles capacités."),
      crisisEffect("care-breakdown:opinion", "opinion", -4, "Les délais et renoncements alimentent la colère."),
    ],
  },
  {
    id: "rule-of-law-fracture",
    title: "La contestation juridique devient institutionnelle",
    body: "Plusieurs mesures de sécurité et d'immigration sont attaquées ensemble. Les recours ralentissent leur exécution et divisent la majorité.",
    indicator: "institutionalTrust",
    threshold: 45,
    comparator: "lte",
    eligibleFromChapterIndex: 3,
    maxOccurrences: 1,
    requiredDecisionIds: [
      "doubler-l-execution-des-eloignements-oqtf",
      "reserver-les-prestations-non-contributives-aux-nationaux",
    ],
    aggravatingChoices: [
      {
        decisionId: "doubler-l-execution-des-eloignements-oqtf",
        optionIds: ["doubler-l-execution-des-eloignements-oqtf:adopt"],
      },
      {
        decisionId: "supprimer-l-allocation-pour-demandeurs-d",
        optionIds: ["supprimer-l-allocation-pour-demandeurs-d:adopt"],
      },
      {
        decisionId: "reserver-les-prestations-non-contributives-aux-nationaux",
        optionIds: ["reserver-les-prestations-non-contributives-aux-nationaux:adopt"],
      },
      {
        decisionId: "quotas-annuels-d-immigration",
        optionIds: ["quotas-annuels-d-immigration:adopt"],
      },
    ],
    concessions: [{
      id: "amend-residency-condition",
      label: "Remplacer la nationalité par une durée de résidence",
      targetDecisionId: "reserver-les-prestations-non-contributives-aux-nationaux",
      policyChange: "amend",
      effects: [
        crisisEffect("amend-residency:trust", "institutionalTrust", 5, "Le nouveau critère réduit le risque constitutionnel."),
        crisisEffect("amend-residency:budget", "annualBalance", -2_000, "Le compromis réduit l'économie attendue."),
      ],
    }],
    holdCourseEffects: [
      crisisEffect("rule-of-law:trust", "institutionalTrust", -4, "Le conflit durable affaiblit la confiance institutionnelle."),
      crisisEffect("rule-of-law:majority", "majority", -3, "Le désaccord juridique traverse la majorité."),
    ],
  },
  {
    id: "currency-sovereignty-shock",
    title: "Le choc monétaire atteint les banques",
    body: "La sortie monétaire et le référendum européen provoquent une hausse des taux et une révision immédiate des projets d'investissement.",
    indicator: "financialCredibility",
    threshold: 40,
    comparator: "lte",
    eligibleFromChapterIndex: 4,
    maxOccurrences: 1,
    requiredDecisionIds: [
      "sortir-de-l-euro",
      "referendum-sur-la-sortie-de-l-ue",
    ],
    aggravatingChoices: [
      {
        decisionId: "porter-l-effort-de-defense-vers-3",
        optionIds: ["porter-l-effort-de-defense-vers-3:adopt"],
      },
      {
        decisionId: "sortir-de-l-euro",
        optionIds: ["sortir-de-l-euro:adopt"],
      },
      {
        decisionId: "referendum-sur-la-sortie-de-l-ue",
        optionIds: ["referendum-sur-la-sortie-de-l-ue:adopt"],
      },
    ],
    concessions: [{
      id: "suspend-euro-exit",
      label: "Suspendre la sortie de l'euro",
      targetDecisionId: "sortir-de-l-euro",
      policyChange: "suspend",
      effects: [
        crisisEffect("suspend-euro-exit:credibility", "financialCredibility", 12, "La suspension rassure une partie des prêteurs."),
        crisisEffect("suspend-euro-exit:investment", "investment", 5, "Les projets les plus avancés sont relancés."),
      ],
    }],
    holdCourseEffects: [
      crisisEffect("currency-shock:credibility", "financialCredibility", -6, "L'incertitude monétaire augmente la prime de risque."),
      crisisEffect("currency-shock:interest", "interestCost", 2_000, "La hausse des taux alourdit la charge annuelle."),
    ],
  },
  {
    id: "energy-transition-bottleneck",
    title: "Le système énergétique manque d'investissements",
    body: "Les reports d'infrastructures et les choix contradictoires provoquent un goulot d'étranglement industriel et territorial.",
    indicator: "investment",
    threshold: 100,
    comparator: "lte",
    eligibleFromChapterIndex: 5,
    maxOccurrences: 1,
    requiredDecisionIds: ["plan-ferroviaire-3-000-m-de-plus"],
    aggravatingChoices: [
      {
        decisionId: "doubler-maprimerenov",
        optionIds: ["doubler-maprimerenov:keep"],
      },
      {
        decisionId: "plan-ferroviaire-3-000-m-de-plus",
        optionIds: ["plan-ferroviaire-3-000-m-de-plus:keep"],
      },
      {
        decisionId: "engager-six-epr2-part-annuelle-de-l",
        optionIds: ["engager-six-epr2-part-annuelle-de-l:none"],
      },
      {
        decisionId: "sortie-du-nucleaire-en-2040",
        optionIds: ["sortie-du-nucleaire-en-2040:adopt"],
      },
      {
        decisionId: "moratoire-sur-les-renouvelables",
        optionIds: ["moratoire-sur-les-renouvelables:adopt"],
      },
    ],
    concessions: [{
      id: "amend-rail-plan",
      label: "Garantir les nœuds ferroviaires prioritaires",
      targetDecisionId: "plan-ferroviaire-3-000-m-de-plus",
      policyChange: "amend",
      effects: [
        crisisEffect("amend-rail-plan:investment", "investment", 4, "Les chantiers prioritaires sécurisent les commandes."),
        crisisEffect("amend-rail-plan:budget", "annualBalance", -1_000, "La garantie publique augmente la dépense annuelle."),
      ],
    }],
    holdCourseEffects: [
      crisisEffect("energy-bottleneck:investment", "investment", -4, "Les industriels reportent de nouvelles capacités."),
      crisisEffect("energy-bottleneck:services", "publicServices", -2, "Les réseaux dégradés réduisent la qualité de service."),
    ],
  },
  {
    id: "education-housing-strain",
    title: "Les écoles et le logement décrochent",
    body: "Le maintien des moyens existants ne couvre plus les besoins. Les tensions de recrutement et de logement étudiant deviennent visibles ensemble.",
    indicator: "publicServices",
    threshold: 50,
    comparator: "lte",
    eligibleFromChapterIndex: 6,
    maxOccurrences: 1,
    requiredDecisionIds: [
      "revaloriser-les-enseignants-de-5",
      "doubler-les-bourses-etudiantes-sur-criteres",
    ],
    aggravatingChoices: [
      {
        decisionId: "revaloriser-les-enseignants-de-5",
        optionIds: ["revaloriser-les-enseignants-de-5:keep"],
      },
      {
        decisionId: "doubler-les-bourses-etudiantes-sur-criteres",
        optionIds: ["doubler-les-bourses-etudiantes-sur-criteres:keep"],
      },
      {
        decisionId: "financer-100-000-logements-sociaux-de-plus",
        optionIds: ["financer-100-000-logements-sociaux-de-plus:keep"],
      },
    ],
    concessions: [{
      id: "amend-teacher-pay",
      label: "Cibler la revalorisation sur les postes vacants",
      targetDecisionId: "revaloriser-les-enseignants-de-5",
      policyChange: "amend",
      effects: [
        crisisEffect("amend-teacher-pay:services", "publicServices", 4, "La prime ciblée réduit les vacances de postes."),
        crisisEffect("amend-teacher-pay:budget", "annualBalance", -1_200, "La mesure ciblée augmente la masse salariale."),
      ],
    }],
    holdCourseEffects: [
      crisisEffect("education-strain:services", "publicServices", -3, "Les postes vacants et les files d'attente s'allongent."),
      crisisEffect("education-strain:trust", "institutionalTrust", -2, "Les familles doutent de l'égalité d'accès au service."),
    ],
  },
  {
    id: "state-capacity-collapse",
    title: "La capacité opérationnelle de l'État décroche",
    body: "Les coupes simultanées dans les opérateurs, les collectivités et les effectifs saturent les services restants.",
    indicator: "publicServices",
    threshold: 90,
    comparator: "lte",
    eligibleFromChapterIndex: 7,
    maxOccurrences: 1,
    requiredDecisionIds: [
      "reduire-de-5-les-dotations-aux-collectivites",
      "fermer-un-tiers-des-agences-et-operateurs",
    ],
    aggravatingChoices: [
      {
        decisionId: "reduire-de-5-les-dotations-aux-collectivites",
        optionIds: ["reduire-de-5-les-dotations-aux-collectivites:adopt"],
      },
      {
        decisionId: "geler-le-point-d-indice-en-2026",
        optionIds: ["geler-le-point-d-indice-en-2026:adopt"],
      },
      {
        decisionId: "ne-pas-remplacer-un-depart-administratif-sur",
        optionIds: ["ne-pas-remplacer-un-depart-administratif-sur:adopt"],
      },
      {
        decisionId: "fermer-un-tiers-des-agences-et-operateurs",
        optionIds: ["fermer-un-tiers-des-agences-et-operateurs:adopt"],
      },
    ],
    concessions: [{
      id: "amend-agency-closures",
      label: "Préserver les guichets territoriaux",
      targetDecisionId: "fermer-un-tiers-des-agences-et-operateurs",
      policyChange: "amend",
      effects: [
        crisisEffect("amend-agency-closures:services", "publicServices", 5, "Le maintien des guichets rétablit une capacité locale."),
        crisisEffect("amend-agency-closures:budget", "annualBalance", -900, "Le compromis réduit l'économie annuelle."),
      ],
    }],
    holdCourseEffects: [
      crisisEffect("state-collapse:services", "publicServices", -5, "Les délais et fermetures s'étendent aux missions prioritaires."),
      crisisEffect("state-collapse:majority", "majority", -3, "Les élus locaux de la majorité s'opposent aux fermetures."),
      crisisEffect("state-collapse:trust", "institutionalTrust", -3, "L'éloignement des services dégrade la confiance."),
    ],
  },
]);

/** Compatibility name for the historical V9 simulator and its frozen snapshot. */
export const SCENARIO_V3_CRISIS_RULES = SCENARIO_V9_CRISIS_RULES;

type V10CrisisDefinition = Readonly<{
  id: string;
  title: string;
  body: string;
  indicator: IndicatorKey;
  threshold: number;
  eligibleFromChapterIndex: number;
  causes: readonly [string, string];
}>;

function v10Crisis(definition: V10CrisisDefinition): CrisisRule {
  const [firstCause, secondCause] = definition.causes;
  return {
    id: definition.id,
    title: definition.title,
    body: definition.body,
    indicator: definition.indicator,
    threshold: definition.threshold,
    comparator: "lte",
    eligibleFromChapterIndex: definition.eligibleFromChapterIndex,
    maxOccurrences: 1,
    requiredDecisionIds: [firstCause, secondCause],
    aggravatingChoices: [firstCause, secondCause].map((decisionId) => ({
      decisionId,
      optionIds: [`${decisionId}:adopt`],
    })),
    concessions: [firstCause, secondCause].map((targetDecisionId, index) => ({
      id: `${definition.id}:amend-${index + 1}`,
      label: `Amender ${targetDecisionId}`,
      targetDecisionId,
      policyChange: "amend" as const,
      effects: [
        crisisEffect(`${definition.id}:amend-${index + 1}:services`, "publicServices", 2, "Le compromis rétablit une partie de la capacité publique."),
        crisisEffect(`${definition.id}:amend-${index + 1}:budget`, "annualBalance", -250, "Le compromis réduit la marge budgétaire annuelle."),
      ],
    })),
    holdCourseEffects: [
      crisisEffect(`${definition.id}:hold-opinion`, "opinion", -3, "Le maintien du cap élargit la contestation."),
      crisisEffect(`${definition.id}:hold-trust`, "institutionalTrust", -2, "Le conflit persistant dégrade la confiance institutionnelle."),
    ],
  };
}

/** V10 rules are independent from the V9 rules: every policy reference is published in the 72-decision campaign. */
export const SCENARIO_V10_CRISIS_RULES: readonly CrisisRule[] = Object.freeze([
  {
    ...v10Crisis({ id: "v10-tax-legitimacy", title: "La réforme fiscale cristallise la contestation", body: "Les choix fiscaux simultanés mettent en cause la lisibilité de l'effort demandé.", indicator: "opinion", threshold: 55, eligibleFromChapterIndex: 0, causes: ["unifier-ir-csg-bareme-continu", "relever-tva-restauration-commerciale"] }),
    concessions: [{
      id: "reverse-ir-csg-unification",
      label: "Revenir à des prélèvements distincts",
      targetDecisionId: "unifier-ir-csg-bareme-continu",
      policyChange: "reverse",
      effects: [crisisEffect("reverse-ir-csg-unification:opinion", "opinion", 3, "Le retour à des prélèvements distincts désamorce une partie de la contestation.")],
    }],
  },
  v10Crisis({ id: "v10-labour-blockade", title: "Le conflit social bloque les transports", body: "Les réformes de l'emploi et des retraites créent un front social durable.", indicator: "opinion", threshold: 45, eligibleFromChapterIndex: 1, causes: ["repousser-l-age-legal-a-65-ans", "durcir-l-assurance-chomage-degressivite-duree"] }),
  v10Crisis({ id: "v10-care-access", title: "L'accès aux soins se dégrade", body: "Le reste à charge et les économies de santé rendent les renoncements aux soins visibles.", indicator: "publicServices", threshold: 50, eligibleFromChapterIndex: 2, causes: ["doubler-les-franchises-medicales", "medicaments-comparables-achats-sante"] }),
  v10Crisis({ id: "v10-rule-of-law", title: "La contestation juridique devient institutionnelle", body: "Les mesures d'éloignement et de prestations font converger les recours.", indicator: "institutionalTrust", threshold: 45, eligibleFromChapterIndex: 3, causes: ["doubler-l-execution-des-eloignements-oqtf", "reserver-les-prestations-non-contributives-aux-nationaux"] }),
  v10Crisis({ id: "v10-currency-shock", title: "Le choc monétaire atteint les banques", body: "Les options de rupture européenne alimentent une prime de risque immédiate.", indicator: "financialCredibility", threshold: 40, eligibleFromChapterIndex: 4, causes: ["sortir-de-l-euro", "referendum-sur-la-sortie-de-l-ue"] }),
  v10Crisis({ id: "v10-energy-bottleneck", title: "Le système énergétique manque d'investissements", body: "Les arbitrages sur la rénovation et le rail font apparaître un risque de sous-investissement.", indicator: "investment", threshold: 100, eligibleFromChapterIndex: 5, causes: ["doubler-maprimerenov", "plan-ferroviaire-3-000-m-de-plus"] }),
  v10Crisis({ id: "v10-education-housing", title: "Les écoles et le logement décrochent", body: "Les arbitrages éducatifs et étudiants font monter les tensions de service.", indicator: "publicServices", threshold: 50, eligibleFromChapterIndex: 6, causes: ["revaloriser-les-enseignants-de-5", "doubler-les-bourses-etudiantes-sur-criteres"] }),
  (() => {
    const rule = v10Crisis({ id: "v10-state-capacity", title: "La capacité opérationnelle de l'État décroche", body: "Les réformes territoriales et les achats publics saturent les services restants.", indicator: "publicServices", threshold: 90, eligibleFromChapterIndex: 7, causes: ["clarifier-competences-doublons-territoriaux", "mutualiser-achats-publics"] });
    return { ...rule, concessions: [rule.concessions[0]!] };
  })(),
]);
