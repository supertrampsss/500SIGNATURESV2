import type { BudgetEstimate, BudgetProfile, BudgetTransitionFlow, EffectTiming, RunRateTiming } from "./types.ts";

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

/**
 * Entries are keyed by their policy join, never by editorial wording. Task 2
 * fills this registry with the V10 catalogue estimates.
 */
export const BUDGET_ESTIMATES: Readonly<Record<string, BudgetEstimate>> = deepFreeze({
  [registryId(PRIME_ACTIVITY_DECISION_ID, PRIME_ACTIVITY_OPTION_ID, PRIME_ACTIVITY_ESTIMATE_KEY)]: PRIME_ACTIVITY_RECYCLE,
});

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
  if (optionId === "keep") {
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
