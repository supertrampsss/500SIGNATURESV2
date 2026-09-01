import type { CrisisRule, EffectRule, IndicatorKey } from "./types.ts";

function effect(id: string, key: IndicatorKey, delta: number, explanation: string): EffectRule {
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

/**
 * V11 limits a mandate to three possible crises. Every concession reverses a
 * policy that was actually selected, so it always changes the live campaign.
 */
export const SCENARIO_V11_CRISIS_RULES: readonly CrisisRule[] = Object.freeze([
  {
    id: "v11-fiscal-tension",
    title: "La réforme fiscale déclenche une contestation",
    body: "Le nouveau prélèvement et la hausse de TVA arrivent en même temps.",
    indicator: "opinion",
    threshold: 50,
    comparator: "lte",
    eligibleFromChapterIndex: 0,
    maxOccurrences: 1,
    requiredDecisionIds: ["v11-01-prelevement-personnel", "v11-02-tva"],
    aggravatingChoices: [
      { decisionId: "v11-01-prelevement-personnel", optionIds: ["v11-01-prelevement-personnel:option-1"] },
      { decisionId: "v11-02-tva", optionIds: ["v11-02-tva:option-2"] },
    ],
    concessions: [
      {
        id: "v11-fiscal-tension:separate-tax",
        label: "Garder deux prélèvements distincts",
        targetDecisionId: "v11-01-prelevement-personnel",
        policyChange: "reverse",
        effects: [effect("v11-fiscal-tension:separate-tax:opinion", "opinion", 3, "Le retrait réduit la tension.")],
      },
      {
        id: "v11-fiscal-tension:keep-tva",
        label: "Renoncer au taux normal à 21 %",
        targetDecisionId: "v11-02-tva",
        policyChange: "reverse",
        effects: [effect("v11-fiscal-tension:keep-tva:opinion", "opinion", 3, "Le retrait réduit la tension.")],
      },
    ],
    holdCourseEffects: [
      effect("v11-fiscal-tension:hold-opinion", "opinion", -3, "La contestation se prolonge."),
    ],
  },
  {
    id: "v11-work-tension",
    title: "La réforme du travail déclenche une grève",
    body: "Le recul de l'âge de départ et la baisse des droits au chômage sont contestés ensemble.",
    indicator: "opinion",
    threshold: 45,
    comparator: "lte",
    eligibleFromChapterIndex: 1,
    maxOccurrences: 1,
    requiredDecisionIds: ["v11-09-age-retraite", "v11-11-assurance-chomage"],
    aggravatingChoices: [
      { decisionId: "v11-09-age-retraite", optionIds: ["v11-09-age-retraite:option-3"] },
      { decisionId: "v11-11-assurance-chomage", optionIds: ["v11-11-assurance-chomage:option-2"] },
    ],
    concessions: [
      {
        id: "v11-work-tension:keep-retirement-age",
        label: "Renoncer au passage à 65 ans",
        targetDecisionId: "v11-09-age-retraite",
        policyChange: "reverse",
        effects: [effect("v11-work-tension:keep-retirement-age:opinion", "opinion", 4, "Le retrait calme le conflit.")],
      },
      {
        id: "v11-work-tension:keep-unemployment-rights",
        label: "Garder les droits au chômage actuels",
        targetDecisionId: "v11-11-assurance-chomage",
        policyChange: "reverse",
        effects: [effect("v11-work-tension:keep-unemployment-rights:opinion", "opinion", 4, "Le retrait calme le conflit.")],
      },
    ],
    holdCourseEffects: [
      effect("v11-work-tension:hold-opinion", "opinion", -4, "La grève dure."),
      effect("v11-work-tension:hold-majority", "majority", -2, "Des députés demandent une pause."),
    ],
  },
  {
    id: "v11-local-services",
    title: "Les services locaux sont sous tension",
    body: "Les réductions d'effectifs et la nouvelle organisation des collectivités arrivent au même moment.",
    indicator: "publicServices",
    threshold: 45,
    comparator: "lte",
    eligibleFromChapterIndex: 7,
    maxOccurrences: 1,
    requiredDecisionIds: ["v11-23-effectifs-publics", "v11-26-collectivites"],
    aggravatingChoices: [
      { decisionId: "v11-23-effectifs-publics", optionIds: ["v11-23-effectifs-publics:option-2", "v11-23-effectifs-publics:option-3"] },
      { decisionId: "v11-26-collectivites", optionIds: ["v11-26-collectivites:option-3"] },
    ],
    concessions: [
      {
        id: "v11-local-services:keep-staff",
        label: "Garder les effectifs actuels",
        targetDecisionId: "v11-23-effectifs-publics",
        policyChange: "reverse",
        effects: [effect("v11-local-services:keep-staff:services", "publicServices", 4, "Les services gardent leurs équipes." )],
      },
      {
        id: "v11-local-services:keep-funding",
        label: "Conserver les dotations actuelles",
        targetDecisionId: "v11-26-collectivites",
        policyChange: "reverse",
        effects: [effect("v11-local-services:keep-funding:services", "publicServices", 4, "Les collectivités gardent leurs moyens." )],
      },
    ],
    holdCourseEffects: [
      effect("v11-local-services:hold-services", "publicServices", -4, "Les délais s'allongent."),
    ],
  },
]);
