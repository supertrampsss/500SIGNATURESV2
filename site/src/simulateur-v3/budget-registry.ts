import type { BudgetEstimate, BudgetProfile, BudgetTransitionFlow, EffectTiming, RunRateTiming } from "./types.ts";
import { POLICY_SOURCES } from "./policy-sources.ts";
import { SCENARIO_V3_CATALOGUE } from "./scenario.ts";

const PRIME_ACTIVITY_DECISION_ID = "remplacer-prime-activite-prelevements-travail";
const PRIME_ACTIVITY_OPTION_ID = "adopt";
const PRIME_ACTIVITY_ESTIMATE_KEY = "prime-activity-recycle-2024";

function registryId(decisionId: string, optionId: string, estimateKey: string): string {
  return `${decisionId}:${optionId}:${estimateKey}`;
}

const PRIME_ACTIVITY_RECYCLE: BudgetEstimate = {
  key: PRIME_ACTIVITY_ESTIMATE_KEY,
  baseYear: 2024,
  baseAmountMillions: 10_300,
  baseNature: "realise",
  scope: "Dépenses de prime d'activité 2024 intégralement recyclées en baisse des prélèvements sur les premiers revenus du travail.",
  // This entry documents a neutral recycling operation. The outgoing benefit
  // envelope and the matching levy reduction stay outside the operating-cost
  // equation so the registry does not invent a recurring expense.
  grossActionMillions: 0,
  behavioralOffsetMillions: 0,
  recurringOperatingCostMillions: 0,
  runRateMillions: 0,
  transitionFlows: [],
  sourceKeys: ["cnaf-prime-activite-2024"],
  estimateStatus: "observe",
  uncertainty: "faible",
  exclusiveScopeKeys: [],
  reconciliation: {
    outgoingAmountMillions: 10_300,
    counterpartAmountMillions: 10_300,
  },
};

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

const audited = (
  key: string, baseYear: number, baseAmountMillions: number, baseNature: BudgetEstimate["baseNature"],
  scope: string, grossActionMillions: number, behavioralOffsetMillions: number, recurringOperatingCostMillions: number,
  runRateMillions: number, sourceKeys: readonly string[], exclusiveScopeKeys: readonly string[],
  estimateStatus: BudgetEstimate["estimateStatus"], uncertainty: BudgetEstimate["uncertainty"],
): BudgetEstimate => ({ key, baseYear, baseAmountMillions, baseNature, scope, grossActionMillions, behavioralOffsetMillions,
  recurringOperatingCostMillions, runRateMillions, transitionFlows: [], sourceKeys, estimateStatus, uncertainty,
  exclusiveScopeKeys, });

export const STRUCTURAL_ADOPT_DECISION_IDS = [
  "unifier-ir-csg-bareme-continu", "supprimer-niches-fiscales-menages-capital", "facturation-electronique-controle-tva",
  "recentrer-allegements-exonerations-sociales", "cibler-aides-apprentissage", "supprimer-subventions-directes-entreprises",
  "recentrer-cir-niches-fiscales-entreprises", "remplacer-prime-activite-prelevements-travail", "medicaments-comparables-achats-sante",
  "reduire-arrets-evitables-prescription", "recouvrer-fraude-sociale-additionnelle", "unifier-instruction-prestations-solidarite",
  "supprimer-niches-fiscales-brunes", "clarifier-competences-doublons-territoriaux", "mutualiser-achats-publics",
  "rationaliser-operateurs-ingenierie-territoriale", "reduire-surfaces-loyers-publics", "reduire-cout-absences-fonctions-publiques",
] as const;

const RETIRED_V10_IDS = new Set([
  "geler-le-bareme-de-l-impot-sur", "flat-tax-a-20-des-le-premier", "flat-tax-a-20-avec-abattement-protegeant", "tranche-a-50-au-dela-de-250",
  "soumettre-les-revenus-du-capital-au-bareme", "supprimer-les-allegements-de-cotisations-entre-2", "fiscaliser-les-heures-supplementaires-comme-le",
  "raboter-de-5-les-subventions-directes-aux", "raboter-le-credit-d-impot-recherche-de", "allocation-sociale-unique",
  "imposer-generiques-et-biosimilaires-en-premiere-intention", "renforcer-le-controle-des-arrets-de-travail", "derembourser-les-cures-thermales",
  "verser-le-rsa-automatiquement-fin-du-non", "interdire-les-voitures-thermiques-en-2030", "reduire-de-5-les-dotations-aux-collectivites",
  "geler-le-point-d-indice-en-2026", "fermer-un-tiers-des-agences-et-operateurs", "diviser-par-deux-le-nombre-de-parlementaires",
  "deux-jours-de-carence-dans-la-fonction",
]);

function knownSourceKeys(decision: typeof SCENARIO_V3_CATALOGUE.decisions[number]): string[] {
  return decision.evidence.map((evidence) => Object.entries(POLICY_SOURCES)
    .find(([, source]) => source.sourceUrl === evidence.sourceUrl)?.[0]).filter((key): key is string => key !== undefined);
}

function carryForwardEntries(): Record<string, BudgetEstimate> {
  const result: Record<string, BudgetEstimate> = {};
  for (const decision of SCENARIO_V3_CATALOGUE.decisions) {
    if (RETIRED_V10_IDS.has(decision.id)) continue;
    const sourceKeys = knownSourceKeys(decision);
    for (const option of decision.options) {
      const localOptionId = option.id.split(":").at(-1)!;
      const v10OptionId = decision.id === "engager-six-epr2-part-annuelle-de-l" && localOptionId === "six" ? "adopt" : localOptionId;
      if (v10OptionId !== "adopt" || (option.budgetProfile.runRateMillions === 0 && option.budgetProfile.transitionFlows.length === 0)) continue;
      const key = `carry-forward-${decision.id}-${v10OptionId}`;
      const flows = option.budgetProfile.transitionFlows.map((flow, index) => ({ ...flow, id: `carry-forward-${index + 1}`, sourceKey: sourceKeys[0]! }));
      result[registryId(decision.id, v10OptionId, key)] = {
        key, baseYear: 2026, baseAmountMillions: Math.max(0, Math.abs(option.budgetProfile.runRateMillions) + flows.reduce((sum, flow) => sum + Math.abs(flow.amountMillions), 0)),
        baseNature: "prevision", scope: `Profil V9 conservé pour ${decision.id}; assiette distincte des réformes auditées V10.`,
        grossActionMillions: option.budgetProfile.runRateMillions, behavioralOffsetMillions: 0, recurringOperatingCostMillions: 0,
        runRateMillions: option.budgetProfile.runRateMillions, transitionFlows: flows, sourceKeys, estimateStatus: "scenario",
        uncertainty: option.uncertainty, exclusiveScopeKeys: [`carry-forward-${decision.id}`],
      };
    }
  }
  return result;
}

const AUDITED_ENTRIES: Record<string, BudgetEstimate> = {
  [registryId(PRIME_ACTIVITY_DECISION_ID, PRIME_ACTIVITY_OPTION_ID, PRIME_ACTIVITY_ESTIMATE_KEY)]: PRIME_ACTIVITY_RECYCLE,
  [registryId("supprimer-niches-fiscales-menages-capital", "adopt", "household-capital-tax-expenditures-net")]: audited("household-capital-tax-expenditures-net", 2026, 5_234, "prevision", "Panier ménages/capital ; exclut CIR, niches sociales, niches brunes et barème unifié.", 5_234, 0, 0, 5_234, ["evm-2026"], ["tax-exp-household-capital-selected"], "scenario", "forte"),
  [registryId("facturation-electronique-controle-tva", "adopt", "vat-einvoice-control-net")]: audited("vat-einvoice-control-net", 2023, 3_000, "objectif", "Fraude TVA par facturation électronique ; aucune économie privée de conformité au solde public.", 3_000, 150, 150, 2_700, ["plan-antifraude-facturation-electronique"], ["vat-fraud-einvoice"], "scenario", "forte"),
  [registryId("recentrer-allegements-exonerations-sociales", "adopt", "social-exemptions-targeted-net")]: audited("social-exemptions-targeted-net", 2025, 66_853, "prevision", "Allègements ciblés ; les 800 M€ sont le retour IS officiel ; exclut apprentissage et prélèvement unifié.", 3_900, 800, 0, 3_100, ["plfss-2025-annexe-4", "plfss-2026-annexe-9"], ["social-exemptions-selected"], "ex_ante", "moyenne"),
  [registryId("cibler-aides-apprentissage", "adopt", "apprenticeship-aid-targeted-net")]: audited("apprenticeship-aid-targeted-net", 2026, 2_368, "prevision", "Aides employeurs et exonérations d'apprentis ; exclut aides générales aux entreprises.", 1_200, 0, 0, 1_200, ["pap-travail-2026", "plfss-2026-annexe-9"], ["apprenticeship-aid-selected", "apprenticeship-exemption-selected"], "ex_ante", "moyenne"),
  [registryId("recentrer-cir-niches-fiscales-entreprises", "adopt", "business-cir-tax-expenditures-net")]: audited("business-cir-tax-expenditures-net", 2026, 8_041, "prevision", "CIR demi-taux, décotes 5 % et 0,5 % ; exclut subventions directes et ne prétend pas préserver toute R&D additionnelle.", 4_020, 201, 20, 3_799, ["evm-2026", "bofip-cir-2025"], ["tax-exp-business-selected", "tax-exp-cir-selected"], "scenario", "forte"),
  [registryId("medicaments-comparables-achats-sante", "adopt", "health-drugs-procurement-net")]: audited("health-drugs-procurement-net", 2023, 20_500, "realise", "Médicaments comparables, biosimilaires et achats hospitaliers ; exclut les 2 300 M€ déjà intégrés à l'ONDAM.", 410, 50, 60, 300, ["igf-annexe-xii-achats-hospitaliers-2026", "plfss-2026-annexe-5"], ["health-drugs-procurement-selected"], "scenario", "forte"),
  [registryId("reduire-arrets-evitables-prescription", "adopt", "health-sick-leave-net")]: audited("health-sick-leave-net", 2023, 3_170, "realise", "Contrôles, prévention et prescription ; exclut 600 M€ déjà inclus dans la trajectoire et les absences publiques.", 238, 100, 35, 103, ["cnam-rapport-charges-produits-2026", "placss-2025-annexe-6"], ["health-sick-leave-selected"], "scenario", "forte"),
  [registryId("recouvrer-fraude-sociale-additionnelle", "adopt", "social-fraud-recovery-net")]: audited("social-fraud-recovery-net", 2025, 1_503, "notifie", "Recouvrement additionnel ; détection et redressement exclus pour éviter le double compte.", 225, 100, 40, 85, ["placss-2025-annexe-6"], ["social-fraud-additional-recovery"], "scenario", "forte"),
  [registryId("unifier-instruction-prestations-solidarite", "adopt", "benefits-backoffice-net")]: audited("benefits-backoffice-net", 2026, 322, "prevision", "Back-office APL seulement ; exclut non-recours et prime d'activité.", 32, 0, 10, 22, ["budget-programme-109"], ["benefits-backoffice-selected"], "scenario", "forte"),
  [registryId("supprimer-niches-fiscales-brunes", "adopt", "brown-tax-expenditures-net")]: audited("brown-tax-expenditures-net", 2026, 2_990, "prevision", "Tarifs réduits et remboursements nommés ; exclut aides budgétaires, bonus automobile et taxe carbone.", 2_990, 600, 50, 2_340, ["evm-2026"], ["tax-exp-brown-selected"], "scenario", "forte"),
  [registryId("clarifier-competences-doublons-territoriaux", "adopt", "territorial-competencies-net")]: audited("territorial-competencies-net", 2022, 2_000, "realise", "Compétences et doublons ; exclut achats, immobilier, absences et opérateurs.", 500, 100, 25, 375, ["igf-collectivites-2024", "senat-ravignon"], ["local-competency-staff-overlap"], "scenario", "forte"),
  [registryId("mutualiser-achats-publics", "adopt", "public-procurement-net")]: audited("public-procurement-net", 2022, 51_000, "realise", "Part réalisable État et collectivités ; exclut marchés déjà retenus par un autre dossier.", 2_550, 500, 150, 1_900, ["igf-collectivites-2024", "dae-2025"], ["public-procurement-selected"], "scenario", "forte"),
  [registryId("rationaliser-operateurs-ingenierie-territoriale", "adopt", "territorial-engineering-operators-net")]: audited("territorial-engineering-operators-net", 2024, 200, "realise", "Cerema, ANCT et ADEME, sans fermeture générique.", 55, 20, 10, 25, ["igf-ingenierie-territoriale-2025"], ["territorial-engineering-operators"], "scenario", "forte"),
  [registryId("reduire-surfaces-loyers-publics", "adopt", "public-property-rent-net")]: audited("public-property-rent-net", 2024, 1_950, "realise", "Loyers et entretien récurrents évités ; cessions exclues car ponctuelles.", 146, 25, 15, 106, ["die-2025"], ["public-property-rent-maintenance"], "scenario", "forte"),
  [registryId("reduire-cout-absences-fonctions-publiques", "adopt", "public-absence-replacement-net")]: audited("public-absence-replacement-net", 2022, 15_000, "realise", "Trois fonctions publiques ; exclut arrêts santé déjà chiffrés.", 700, 200, 100, 400, ["dgafp-temps-2024", "igf-igas-absences"], ["public-workforce-absence-replacement"], "scenario", "forte"),
  [registryId("perenniser-surtaxe-grandes-entreprises", "adopt", "corporate-profit-surtax-net")]: audited("corporate-profit-surtax-net", 2026, 7_300, "prevision", "Clé exclusive corporate-profit-surtax-2026 ; surtaxe IS seulement.", 7_300, 730, 0, 6_570, ["senat-plf-2026-surtaxe-is"], ["corporate-profit-surtax-2026"], "scenario", "moyenne"),
  [registryId("relever-tva-restauration-commerciale", "adopt", "commercial-restaurant-vat-net")]: audited("commercial-restaurant-vat-net", 2026, 2_275, "prevision", "Clé exclusive commercial-restaurant-vat-10, distincte du taux normal général.", 2_275, 228, 0, 2_047, ["bofip-tva-restauration-2024", "evm-2026-tva-restauration"], ["commercial-restaurant-vat-10"], "scenario", "moyenne"),
};

/** V10 joins are frozen after the V9 carry-forward migration and audited additions. */
export const BUDGET_ESTIMATES: Readonly<Record<string, BudgetEstimate>> = deepFreeze({ ...AUDITED_ENTRIES, ...carryForwardEntries() });

export function hasBudgetEstimate(decisionId: string, optionId: string, estimateKey: string): boolean {
  return Object.hasOwn(BUDGET_ESTIMATES, registryId(decisionId, optionId, estimateKey));
}

export function budgetEstimateFor(decisionId: string, optionId: string, estimateKey: string): BudgetEstimate {
  const estimate = BUDGET_ESTIMATES[registryId(decisionId, optionId, estimateKey)];
  if (!estimate) throw new Error(`Unknown budget estimate: ${decisionId}:${optionId}:${estimateKey}`);
  return estimate;
}

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object";
const BASE_NATURES = new Set<BudgetEstimate["baseNature"]>(["realise", "prevision", "objectif", "notifie", "recouvre"]);
const ESTIMATE_STATUSES = new Set<BudgetEstimate["estimateStatus"]>(["observe", "ex_ante", "scenario"]);
const UNCERTAINTIES = new Set<BudgetEstimate["uncertainty"]>(["faible", "moyenne", "forte"]);

function isEffectTiming(value: unknown): value is EffectTiming {
  if (!value || typeof value !== "object" || !("kind" in value)) return false;
  const timing = value as Record<string, unknown>;
  if (timing.kind === "immediate") return true;
  return (timing.kind === "after_decisions" && Number.isInteger(timing.count) && (timing.count as number) > 0)
    || (timing.kind === "mandate_year" && Number.isInteger(timing.year) && (timing.year as number) >= 1 && (timing.year as number) <= 5);
}

function isRunRateTiming(value: unknown): value is RunRateTiming {
  if (!value || typeof value !== "object" || !("kind" in value)) return false;
  const timing = value as Record<string, unknown>;
  return timing.kind === "immediate"
    || (timing.kind === "mandate_year" && Number.isInteger(timing.year) && (timing.year as number) >= 1 && (timing.year as number) <= 5);
}

function isTransitionFlow(value: unknown): value is BudgetTransitionFlow {
  return !!value && typeof value === "object"
    && "id" in value && isNonEmptyString(value.id)
    && "amountMillions" in value && isFiniteNumber(value.amountMillions)
    && "timing" in value && isEffectTiming(value.timing)
    && "sourceKey" in value && isNonEmptyString(value.sourceKey);
}

/** Validates the value contract only; V10 registration is checked by scenario validation. */
export function validateBudgetProfile(profile: BudgetProfile, decisionId: string, optionId: string): string[] {
  const prefix = `budget-profile:${decisionId}:${optionId}`;
  const errors: string[] = [];
  if (!profile || typeof profile !== "object") return [`${prefix}:required`];
  if (!isFiniteNumber(profile.runRateMillions)) errors.push(`${prefix}:run-rate-must-be-finite`);
  if (profile.estimateKey !== null && !isNonEmptyString(profile.estimateKey)) errors.push(`${prefix}:estimate-key-invalid`);
  const transitionFlows = Array.isArray(profile.transitionFlows) ? profile.transitionFlows : [];
  const exclusiveScopeKeys = Array.isArray(profile.exclusiveScopeKeys) ? profile.exclusiveScopeKeys : [];
  if (!Array.isArray(profile.transitionFlows) || !transitionFlows.every(isTransitionFlow)) errors.push(`${prefix}:transition-flows-invalid`);
  if (!Array.isArray(profile.exclusiveScopeKeys) || !exclusiveScopeKeys.every(isNonEmptyString)) errors.push(`${prefix}:exclusive-scope-keys-invalid`);
  if (new Set(exclusiveScopeKeys).size !== exclusiveScopeKeys.length) {
    errors.push(`${prefix}:duplicate-exclusive-scope-key`);
  }
  const ids = transitionFlows.filter(isTransitionFlow).map((flow) => flow.id);
  if (ids.length !== new Set(ids).size) errors.push(`${prefix}:duplicate-transition-flow-id`);
  const hasBudgetFlow = profile.runRateMillions !== 0 || transitionFlows.length > 0;
  if (hasBudgetFlow && !isNonEmptyString(profile.estimateKey)) errors.push(`${prefix}:estimate-key-required`);
  if (profile.runRateMillions === 0 ? profile.runRateTiming !== null : !isRunRateTiming(profile.runRateTiming)) {
    errors.push(`${prefix}:run-rate-timing-invalid`);
  }
  if (optionId.split(":").at(-1) === "keep") {
    if (profile.estimateKey !== null || profile.runRateMillions !== 0 || profile.runRateTiming !== null
        || transitionFlows.length !== 0 || exclusiveScopeKeys.length !== 0) {
      errors.push(`${prefix}:keep-must-be-null-profile`);
    }
  }
  return errors;
}

export function validateBudgetEstimate(estimate: BudgetEstimate): string[] {
  const estimateKey = isNonEmptyString(estimate?.key) ? estimate.key : "unknown";
  const prefix = `budget-estimate:${estimateKey}`;
  const errors: string[] = [];
  if (!isRecord(estimate)) return [`${prefix}:required`];
  if (!isNonEmptyString(estimate.key)) errors.push(`${prefix}:key-required`);
  if (!isNonEmptyString(estimate.scope)) errors.push(`${prefix}:scope-required`);
  if (!Number.isInteger(estimate.baseYear) || estimate.baseYear < 1900) errors.push(`${prefix}:base-year-invalid`);
  if (!isFiniteNumber(estimate.baseAmountMillions)) errors.push(`${prefix}:baseAmountMillions-must-be-finite`);
  else if (estimate.baseAmountMillions < 0) errors.push(`${prefix}:base-amount-must-be-non-negative`);
  if (!BASE_NATURES.has(estimate.baseNature)) errors.push(`${prefix}:base-nature-invalid`);
  if (!ESTIMATE_STATUSES.has(estimate.estimateStatus)) errors.push(`${prefix}:estimate-status-invalid`);
  if (!UNCERTAINTIES.has(estimate.uncertainty)) errors.push(`${prefix}:uncertainty-invalid`);
  for (const key of ["baseAmountMillions", "grossActionMillions", "behavioralOffsetMillions", "recurringOperatingCostMillions", "runRateMillions"] as const) {
    if (!isFiniteNumber(estimate[key])) errors.push(`${prefix}:${key}-must-be-finite`);
  }
  if (estimate.grossActionMillions - estimate.behavioralOffsetMillions - estimate.recurringOperatingCostMillions !== estimate.runRateMillions) {
    errors.push(`${prefix}:net-calculation-mismatch`);
  }
  if (!Array.isArray(estimate.sourceKeys) || estimate.sourceKeys.length === 0 || !estimate.sourceKeys.every(isNonEmptyString)) {
    errors.push(`${prefix}:source-keys-required`);
  }
  if (!Array.isArray(estimate.transitionFlows) || !estimate.transitionFlows.every(isTransitionFlow)) errors.push(`${prefix}:transition-flows-invalid`);
  if (!Array.isArray(estimate.exclusiveScopeKeys) || !estimate.exclusiveScopeKeys.every(isNonEmptyString)) errors.push(`${prefix}:exclusive-scope-keys-invalid`);
  if (estimate.reconciliation !== undefined && (!isRecord(estimate.reconciliation)
      || !isFiniteNumber(estimate.reconciliation.outgoingAmountMillions)
      || estimate.reconciliation.outgoingAmountMillions < 0
      || !isFiniteNumber(estimate.reconciliation.counterpartAmountMillions)
      || estimate.reconciliation.counterpartAmountMillions < 0)) {
    errors.push(`${prefix}:reconciliation-invalid`);
  }
  return errors;
}

export function findExclusiveScopeCollisions(profiles: readonly BudgetProfile[]): string[] {
  const seen = new Set<string>();
  const collisions = new Set<string>();
  for (const profile of profiles) {
    for (const key of profile.exclusiveScopeKeys) (seen.has(key) ? collisions : seen).add(key);
  }
  return [...collisions].sort();
}

export function primeActivityRecycleDifferenceMillions(): number {
  const estimate = budgetEstimateFor(PRIME_ACTIVITY_DECISION_ID, PRIME_ACTIVITY_OPTION_ID, PRIME_ACTIVITY_ESTIMATE_KEY);
  const reconciliation = estimate.reconciliation;
  if (!reconciliation) throw new Error("Prime activity reconciliation is required");
  return reconciliation.outgoingAmountMillions - reconciliation.counterpartAmountMillions;
}
