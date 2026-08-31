import { EDUCATION_DECISIONS } from "./policies/education.ts";
import { ENERGY_DECISIONS } from "./policies/energy.ts";
import { HEALTH_DECISIONS } from "./policies/health.ts";
import { SECURITY_DECISIONS } from "./policies/security.ts";
import { SOVEREIGNTY_DECISIONS } from "./policies/sovereignty.ts";
import { STATE_DECISIONS } from "./policies/state.ts";
import { TAX_DECISIONS } from "./policies/taxes.ts";
import { WORK_DECISIONS } from "./policies/work.ts";
import { CAMPAIGN_DECISION_IDS } from "./campaign-topology.ts";
import type { Chapter, Decision, Scenario } from "./types.ts";

const CHAPTERS: Omit<Chapter, "decisionIds">[] = [
  {
    id: "taxes-assets-transmission", title: "Impôts, patrimoine et transmission",
    domains: ["Impôt sur le revenu", "Patrimoine", "Consommation", "Entreprises"],
    opening: "Le mandat commence par la question la plus immédiate : qui finance l'action publique et selon quelles règles.",
    tension: "Chaque recette protège un budget, mais déplace l'effort vers un groupe précis.",
  },
  {
    id: "work-wages-pensions", title: "Travail, salaires et retraites",
    domains: ["Emploi", "Salaires", "Retraites", "Assurance chômage"],
    opening: "Le financement du modèle social dépend du travail, des cotisations et de la durée d'activité.",
    tension: "Redresser les comptes sociaux modifie directement les revenus et les parcours de vie.",
  },
  {
    id: "health-social-protection", title: "Santé et protection sociale",
    domains: ["Hôpital", "Soins de ville", "Prestations", "Solidarité"],
    opening: "Les besoins progressent plus vite que certaines ressources et rendent les arbitrages immédiatement visibles.",
    tension: "Réduire la dépense peut déplacer le coût vers les patients, les familles ou les professionnels.",
  },
  {
    id: "security-immigration-justice", title: "Sécurité, immigration et justice",
    domains: ["Police", "Justice", "Immigration", "Prisons"],
    opening: "L'autorité publique se mesure à ses moyens, mais aussi aux règles qu'elle accepte de s'imposer.",
    tension: "Les décisions les plus visibles sont souvent celles dont les effets budgétaires et juridiques sont les plus discutés.",
  },
  {
    id: "defence-europe-sovereignty", title: "Défense, Europe et souveraineté",
    domains: ["Armées", "Europe", "Diplomatie", "Industrie stratégique"],
    opening: "La souveraineté exige des capacités coûteuses et des alliances qui limitent parfois la liberté de décision.",
    tension: "Préparer les crises futures oblige à financer aujourd'hui des résultats difficiles à observer immédiatement.",
  },
  {
    id: "energy-climate-transport-agriculture", title: "Énergie, climat, transports et agriculture",
    domains: ["Électricité", "Climat", "Mobilités", "Agriculture"],
    opening: "La transition transforme les infrastructures, les prix et l'aménagement du territoire.",
    tension: "Accélérer coûte maintenant. Attendre reporte le coût et augmente certains risques.",
  },
  {
    id: "education-housing-family", title: "Éducation, logement et famille",
    domains: ["École", "Université", "Logement", "Famille"],
    opening: "Ces politiques déterminent les possibilités offertes aux générations présentes et futures.",
    tension: "Les économies rapides peuvent produire des coûts durables sur l'égalité et l'attractivité.",
  },
  {
    id: "state-institutions-territories", title: "État, institutions et territoires",
    domains: ["Administration", "Institutions", "Collectivités", "Services publics"],
    opening: "Le dernier chapitre interroge la machine publique elle-même et la manière dont le pouvoir est réparti.",
    tension: "Transformer l'État peut dégager des marges, mais fragilise les équilibres qui permettent encore d'agir.",
  },
];

const rawDecisions = [
  ...TAX_DECISIONS,
  ...WORK_DECISIONS,
  ...HEALTH_DECISIONS,
  ...SECURITY_DECISIONS,
  ...SOVEREIGNTY_DECISIONS,
  ...ENERGY_DECISIONS,
  ...EDUCATION_DECISIONS,
  ...STATE_DECISIONS,
];
const knownDecisionIds = new Set(rawDecisions.map((decision) => decision.id));
function normalizeDecisionReferences(decision: Decision): Decision {
  const conflicts = decision.conflicts.filter((id) => id !== decision.id && knownDecisionIds.has(id));
  return {
    ...decision,
    conflicts,
    dependencies: decision.dependencies.filter((id) => id !== decision.id && knownDecisionIds.has(id)),
    options: decision.options.map((option) => ({
      ...option,
      locks: option.locks.filter((id) => id !== decision.id && knownDecisionIds.has(id)),
      unlocks: option.unlocks.filter((id) => id !== decision.id && knownDecisionIds.has(id)),
    })),
  };
}

const catalogueDecisions = rawDecisions.map(normalizeDecisionReferences);
const catalogueById = new Map(catalogueDecisions.map((decision) => [decision.id, decision]));
const selected = new Set<string>(CAMPAIGN_DECISION_IDS);
const campaignDecisions = CAMPAIGN_DECISION_IDS.map((id) => {
  const decision = catalogueById.get(id);
  if (!decision) throw new Error(`Unknown campaign decision ID: ${id}`);
  return decision;
}).map((decision) => ({
  ...decision,
  options: decision.options.map((option) => ({
    ...option,
    locks: option.locks.filter((id) => selected.has(id)),
    unlocks: option.unlocks.filter((id) => selected.has(id)),
  })),
}));

function buildScenario(title: string, version: number, selectedDecisions: Decision[]): Scenario {
  const selectedIds = new Set(selectedDecisions.map(({ id }) => id));
  return {
    version,
    title,
    chapters: CHAPTERS.map((chapter) => ({
      ...chapter,
      decisionIds: selectedDecisions
        .filter((decision) => decision.chapterId === chapter.id)
        .map((decision) => decision.id),
    })),
    decisions: selectedDecisions.map((decision) => ({
      ...decision,
      options: decision.options.map((option) => ({
        ...option,
        locks: option.locks.filter((id) => selectedIds.has(id)),
        unlocks: option.unlocks.filter((id) => selectedIds.has(id)),
      })),
    })),
  };
}

export const SCENARIO_V3_CATALOGUE = buildScenario("Bibliothèque des politiques", 7, catalogueDecisions);
export const SCENARIO_V3 = buildScenario("La France à l'épreuve des comptes", 7, campaignDecisions);
export const SCENARIO_V3_PREVIEW = SCENARIO_V3;

export function policyById(id: string): Decision | undefined {
  return SCENARIO_V3_CATALOGUE.decisions.find((decision) => decision.id === id);
}
