import { SCENARIO_V10_CATALOGUE } from "./scenario-v10-catalogue.ts";
import { V11_COPY } from "./scenario-v11-copy.ts";
import type { BudgetProfile, Decision, DecisionOption, Scenario } from "./types.ts";

const NEUTRAL_PROFILE: BudgetProfile = {
  estimateKey: null, runRateMillions: 0, runRateTiming: null, transitionFlows: [], exclusiveScopeKeys: [],
};

type SourceReference = string | readonly string[];
type Definition = readonly [id: string, sources: readonly SourceReference[]];

// An option is either `-`, one exact V10 option, or an explicit combination of
// non-overlapping V10 measures. Combined options preserve the budget levers
// that were previously lost when several V10 cards became one V11 dossier.
const definitions: readonly Definition[] = [
  ["v11-01-prelevement-personnel", ["unifier-ir-csg-bareme-continu:adopt", "-"]],
  ["v11-02-tva", ["-", "porter-le-taux-normal-de-tva-a:adopt", "relever-tva-restauration-commerciale:adopt", ["porter-le-taux-normal-de-tva-a:adopt", "relever-tva-restauration-commerciale:adopt", "facturation-electronique-controle-tva:adopt"]]],
  ["v11-03-grands-groupes", ["-", "perenniser-surtaxe-grandes-entreprises:adopt", "doubler-la-taxe-sur-les-rachats-d:adopt"]],
  ["v11-04-grandes-fortunes", ["-", "retablir-un-impot-sur-la-fortune-financiere:adopt", "impot-plancher-de-2-sur-les-patrimoines:adopt"]],
  ["v11-05-epargne", ["supprimer-niches-fiscales-menages-capital:adopt", "-"]],
  ["v11-06-heritages", ["-", "exonerer-de-droits-de-succession-jusqu-a:adopt", "raboter-l-avantage-successoral-de-l-assurance:adopt", "abolir-les-droits-de-succession:adopt"]],
  ["v11-07-aides-emploi", ["-", "cibler-aides-apprentissage:adopt", "recentrer-allegements-exonerations-sociales:adopt", ["cibler-aides-apprentissage:adopt", "recentrer-allegements-exonerations-sociales:adopt"]]],
  ["v11-08-aides-entreprises", ["-", "supprimer-subventions-directes-entreprises:adopt", "recentrer-cir-niches-fiscales-entreprises:adopt", ["supprimer-subventions-directes-entreprises:adopt", "recentrer-cir-niches-fiscales-entreprises:adopt"]]],
  ["v11-09-age-retraite", ["revenir-a-62-ans:adopt", "-", "repousser-l-age-legal-a-65-ans:adopt"]],
  ["v11-10-pensions", ["-", "desindexer-les-pensions-d-un-point:adopt"]],
  ["v11-11-assurance-chomage", ["-", "durcir-l-assurance-chomage-degressivite-duree:adopt"]],
  ["v11-12-capitalisation", ["-", "ouvrir-un-etage-de-capitalisation-collective:adopt"]],
  ["v11-13-duree-legale", ["-", "retablir-la-semaine-de-39-heures:adopt"]],
  ["v11-14-revenu-travail", ["-", "augmenter-le-smic-de-10:adopt", "remplacer-prime-activite-prelevements-travail:adopt"]],
  ["v11-15-financement-soins", ["-", "doubler-les-franchises-medicales:adopt", "fiscalite-nutritionnelle-au-niveau-recommande:adopt", ["doubler-les-franchises-medicales:adopt", "fiscalite-nutritionnelle-au-niveau-recommande:adopt"]]],
  ["v11-16-medicaments", ["medicaments-comparables-achats-sante:adopt", "-"]],
  ["v11-17-arrets-maladie", ["reduire-arrets-evitables-prescription:adopt", "-"]],
  ["v11-18-metiers-soin", ["creer-5-000-postes-de-soignants:adopt", "loi-grand-age-50-000-recrutements:adopt", "loi-grand-age-50-000-recrutements:adopt", "-"]],
  ["v11-19-prestations", ["-", "unifier-instruction-prestations-solidarite:adopt", ["unifier-instruction-prestations-solidarite:adopt", "recouvrer-fraude-sociale-additionnelle:adopt"]]],
  ["v11-20-rsa", ["-", "porter-le-rsa-au-seuil-de:adopt"]],
  ["v11-21-aide-medicale", ["-", "supprimer-l-aide-medicale-d-etat:adopt"]],
  ["v11-22-couverture-publique", ["-", "assurance-maladie-publique-unique:adopt"]],
  ["v11-23-effectifs-publics", ["-", "ne-pas-remplacer-un-depart-administratif-sur:adopt", "reduire-cout-absences-fonctions-publiques:adopt", ["ne-pas-remplacer-un-depart-administratif-sur:adopt", "reduire-cout-absences-fonctions-publiques:adopt"]]],
  ["v11-24-frais-structure", ["-", "rationaliser-operateurs-ingenierie-territoriale:adopt", "mutualiser-achats-publics:adopt", ["rationaliser-operateurs-ingenierie-territoriale:adopt", "mutualiser-achats-publics:adopt", "reduire-surfaces-loyers-publics:adopt"]]],
  ["v11-25-actionnaire-etat", ["ceder-des-participations-non-strategiques-de-l:adopt", "-", "nationaliser-les-entreprises-strategiques:adopt"]],
  ["v11-26-collectivites", ["-", "clarifier-competences-doublons-territoriaux:adopt", "supprimer-les-departements:adopt", ["clarifier-competences-doublons-territoriaux:adopt", "supprimer-les-departements:adopt"]]],
  ["v11-27-proportionnelle", ["-", "proportionnelle-integrale:adopt"]],
  ["v11-28-ecole-moyens", ["-", "revaloriser-les-enseignants-de-5:adopt", "etendre-le-dedoublement-des-classes-au-cm1:adopt"]],
  ["v11-29-bourses", ["-", "doubler-les-bourses-etudiantes-sur-criteres:adopt"]],
  ["v11-30-logement-apl", ["-", "financer-100-000-logements-sociaux-de-plus:adopt", "revaloriser-les-apl-de-5:adopt"]],
  ["v11-31-creches", ["-", "ouvrir-200-000-places-de-creche:adopt"]],
  ["v11-32-allocations-familiales", ["-", "allocations-familiales-des-le-premier-enfant:adopt"]],
  ["v11-33-pilotage-ecole", ["-", "autonomie-complete-des-etablissements:adopt", "supprimer-le-financement-public-du-prive:adopt", ["autonomie-complete-des-etablissements:adopt", "supprimer-le-financement-public-du-prive:adopt"]]],
  ["v11-34-service-national", ["-", "generaliser-le-service-national-universel:adopt"]],
  ["v11-35-police-gendarmerie", ["-", "recruter-10-000-policiers-et-gendarmes:adopt"]],
  ["v11-36-asile", ["-", "reduire-les-delais-de-traitement-de-l:adopt", ["reduire-les-delais-de-traitement-de-l:adopt", "supprimer-l-allocation-pour-demandeurs-d:adopt"]]],
  ["v11-37-oqtf", ["-", "doubler-l-execution-des-eloignements-oqtf:adopt"]],
  ["v11-38-integration", ["-", "doubler-les-moyens-de-l-integration-francais:adopt"]],
  ["v11-39-residence-aides", ["-", "reserver-les-prestations-non-contributives-aux-nationaux:adopt"]],
  ["v11-40-immigration-travail", ["-", "quotas-annuels-d-immigration:adopt"]],
  ["v11-41-recidive", ["-", "peines-planchers-automatiques:adopt"]],
  ["v11-42-cannabis", ["-", "legaliser-et-taxer-le-cannabis:adopt"]],
  ["v11-43-renovation", ["-", "doubler-maprimerenov:adopt"]],
  ["v11-44-ferroviaire", ["-", "plan-ferroviaire-3-000-m-de-plus:adopt"]],
  ["v11-45-electrique", ["relancer-le-leasing-social-de-vehicules-electriques:adopt", "-", "supprimer-le-bonus-automobile-electrique:adopt"]],
  ["v11-46-nucleaire", ["engager-six-epr2-part-annuelle-de-l:adopt", "-", "sortie-du-nucleaire-en-2040:adopt"]],
  ["v11-47-energies-fossiles", ["-", "retablir-une-trajectoire-carbone-recettes-redistribuees:adopt", "retablir-une-trajectoire-carbone-recettes-redistribuees:adopt", ["retablir-une-trajectoire-carbone-recettes-redistribuees:adopt", "renforcer-la-taxe-sur-les-billets-d:adopt"]]],
  ["v11-48-renouvelables", ["-", "moratoire-sur-les-renouvelables:adopt"]],
  ["v11-49-avantages-fossiles", ["-", "supprimer-niches-fiscales-brunes:adopt"]],
  ["v11-50-budget-militaire", ["porter-l-effort-de-defense-vers-3:adopt", "-", "etaler-la-marche-2026-de-la-programmation:adopt"]],
  ["v11-51-effectifs-defense", ["doubler-la-reserve-operationnelle:adopt", "service-militaire-volontaire-de-50-000:adopt", "-"]],
  ["v11-52-renseignement", ["-", "doubler-les-moyens-du-renseignement-interieur:adopt"]],
  ["v11-53-defense-europe", ["-", "achats-militaires-europeens-prioritaires:adopt", "creer-une-armee-europeenne:adopt", ["creer-une-armee-europeenne:adopt", "reduire-l-aide-publique-au-developpement-de:adopt"]]],
  ["v11-54-euro", ["-", "sortir-de-l-euro:adopt"]],
  ["v11-55-referendum-union", ["-", "referendum-sur-la-sortie-de-l-ue:adopt"]],
  ["v11-56-magistrats-greffiers", ["-", "recruter-3-000-magistrats-et-greffiers:adopt"]],
  ["v11-57-places-prison", ["-", "construire-15-000-places-de-prison-supplementaires:adopt"]],
];

const sourceById = new Map(SCENARIO_V10_CATALOGUE.decisions.map((decision) => [decision.id, decision]));
const sourceOption = (reference: string): DecisionOption => {
  const separator = reference.lastIndexOf(":");
  const decision = sourceById.get(reference.slice(0, separator));
  const option = decision?.options.find((candidate) => candidate.id.endsWith(reference.slice(separator)));
  if (!option) throw new Error(`unknown-v10-option:${reference}`);
  return option;
};
const referencesOf = (reference: SourceReference): readonly string[] => typeof reference === "string" ? [reference] : reference;
const flattenedReferences = (sources: readonly SourceReference[]): string[] => sources.flatMap(referencesOf).filter((reference) => reference !== "-");
const sourceDecision = (sources: readonly SourceReference[]) => sourceById.get(flattenedReferences(sources)[0]!.split(":")[0])!;

function neutralOption(id: string, label: string): DecisionOption {
  return {
    id, label, summary: "Le cadre actuel reste en place.", mechanism: "Conserver les règles en vigueur.", horizon: { kind: "immediate" }, legalConstraints: [],
    budgetProfile: structuredClone(NEUTRAL_PROFILE), beneficiaries: ["personnes concernées"], contributors: ["finances publiques"], uncertainty: "moyenne",
    effects: [], scheduledEvents: [], promises: [], fulfillsPromises: [], locks: [], unlocks: [],
  };
}

function combinedOption(references: readonly string[], id: string, copy: (typeof V11_COPY)[number]["options"][number]): DecisionOption {
  const sources = references.map((reference) => structuredClone(sourceOption(reference)));
  const first = sources[0]!;
  const uncertaintyRank = { faible: 0, moyenne: 1, forte: 2 } as const;
  return {
    ...first,
    id,
    label: copy.shortLabel,
    summary: copy.outcome,
    mechanism: sources.map((source) => source.mechanism).join(" "),
    horizon: { kind: "immediate" },
    legalConstraints: [...new Set(sources.flatMap((source) => source.legalConstraints))],
    budgetProfile: {
      estimateKey: `combined-${references.map((reference) => reference.split(":")[0]).join("-")}`,
      runRateMillions: sources.reduce((sum, source) => sum + source.budgetProfile.runRateMillions, 0),
      runRateTiming: { kind: "immediate" },
      transitionFlows: sources.flatMap((source) => source.budgetProfile.transitionFlows),
      exclusiveScopeKeys: [...new Set(sources.flatMap((source) => source.budgetProfile.exclusiveScopeKeys))],
    },
    beneficiaries: [...new Set(sources.flatMap((source) => source.beneficiaries))],
    contributors: [...new Set(sources.flatMap((source) => source.contributors))],
    uncertainty: sources.reduce((worst, source) => uncertaintyRank[source.uncertainty] > uncertaintyRank[worst] ? source.uncertainty : worst, first.uncertainty),
    effects: sources.flatMap((source) => source.effects).map((effect) => ({ ...effect, timing: { kind: "immediate" } })),
    scheduledEvents: [], promises: [], fulfillsPromises: [], locks: [], unlocks: [], displayCopy: copy,
  };
}

function optionFor(reference: SourceReference, id: string, copy: (typeof V11_COPY)[number]["options"][number]): DecisionOption {
  if (typeof reference !== "string") return combinedOption(reference, id, copy);
  if (reference === "-") return { ...neutralOption(id, copy.shortLabel), displayCopy: copy };
  const source = structuredClone(sourceOption(reference));
  return {
    ...source, id, label: copy.shortLabel, summary: copy.outcome,
    // Locks on separate V10 cards become alternatives of this single V11 card.
    // V11 is a library: its future campaign owns the event and promise topology.
    scheduledEvents: [], promises: [], fulfillsPromises: [], locks: [], unlocks: [], displayCopy: copy,
  };
}

function buildDecision(definition: Definition, index: number): Decision {
  const [id, sources] = definition;
  const copy = V11_COPY[index]!;
  const seed = sourceDecision(sources);
  const evidence = [...new Map(flattenedReferences(sources)
    .flatMap((reference) => sourceById.get(reference.split(":")[0])?.evidence ?? [])
    .map((item) => [`${item.sourceName}:${item.sourceUrl}`, structuredClone(item)] as const)).values()];
  return {
    ...structuredClone(seed), id, version: 11, title: copy.decision.question, context: copy.decision.context, displayCopy: copy.decision,
    evidence, dependencies: [], conflicts: [], options: sources.map((source, optionIndex) => optionFor(source, `${id}:option-${optionIndex + 1}`, copy.options[optionIndex]!)),
  };
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

const decisions = definitions.map(buildDecision);
export const SCENARIO_V11_CATALOGUE: Scenario = freeze({
  version: 11,
  title: "Bibliothèque V11 des politiques",
  chapters: SCENARIO_V10_CATALOGUE.chapters.map((chapter) => ({ ...structuredClone(chapter), decisionIds: decisions.filter((decision) => decision.chapterId === chapter.id).map((decision) => decision.id) })),
  decisions,
});

export const V11_COMMON_DECISION_IDS = definitions.filter((_, index) => [0, 8, 14, 25, 27, 34, 45, 49, 55, 56].includes(index)).map(([id]) => id);
export const V11_SYNTHESIS_DECISION_IDS = definitions.filter((_, index) => [13, 46, 52].includes(index)).map(([id]) => id);
export const V11_ADAPTIVE_DECISION_IDS = definitions.filter((_, index) => ![0, 8, 14, 25, 27, 34, 45, 49, 55, 56, 13, 46, 52].includes(index)).map(([id]) => id);

export function v11PolicyById(id: string): Decision | undefined {
  return SCENARIO_V11_CATALOGUE.decisions.find((decision) => decision.id === id);
}
