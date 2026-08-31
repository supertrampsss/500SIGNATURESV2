import { applyEffect } from "./effects.ts";
import { SCENARIO_V10 } from "./scenario-v10.ts";
import { SCHEMA_VERSION, type CampaignState, type DecisionRecord, type Scenario } from "./types.ts";
import { isCampaignState } from "./validation.ts";

export const V3_STORAGE_KEY = "simulateur-v3-campaign";
const V2_STORAGE_KEY = "tunnel-partie";
const MODELED_EFFECT_SOURCE_VERSION = 5;
const MODELED_EFFECT_TARGET_VERSION = 6;
const HISTORICAL_MODELED_EFFECT_MARKER = ":model:";

export const REPLACED_V9_DECISION_IDS = Object.freeze([
  "geler-le-bareme-de-l-impot-sur",
  "flat-tax-a-20-des-le-premier",
  "flat-tax-a-20-avec-abattement-protegeant",
  "tranche-a-50-au-dela-de-250",
  "soumettre-les-revenus-du-capital-au-bareme",
  "supprimer-les-allegements-de-cotisations-entre-2",
  "fiscaliser-les-heures-supplementaires-comme-le",
  "raboter-de-5-les-subventions-directes-aux",
  "raboter-le-credit-d-impot-recherche-de",
  "allocation-sociale-unique",
  "imposer-generiques-et-biosimilaires-en-premiere-intention",
  "renforcer-le-controle-des-arrets-de-travail",
  "derembourser-les-cures-thermales",
  "verser-le-rsa-automatiquement-fin-du-non",
  "interdire-les-voitures-thermiques-en-2030",
  "reduire-de-5-les-dotations-aux-collectivites",
  "geler-le-point-d-indice-en-2026",
  "fermer-un-tiers-des-agences-et-operateurs",
  "diviser-par-deux-le-nombre-de-parlementaires",
  "deux-jours-de-carence-dans-la-fonction",
] as const);

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type RestoreResult =
  | { kind: "restored"; state: CampaignState }
  | { kind: "restart_required" }
  | { kind: "new" }
  | { kind: "v2_found" }
  | { kind: "invalid" }
  | { kind: "unavailable" };

type V2RestoreResult = Extract<RestoreResult, { kind: "new" | "v2_found" | "unavailable" }>;

export function saveCampaign(storage: StorageLike, state: CampaignState, now = new Date()): CampaignState {
  const saved = { ...state, savedAt: now.toISOString() };
  try {
    storage.setItem(V3_STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Saving is best-effort: an unavailable browser storage must not stop the campaign.
  }
  return saved;
}

export function restoreCampaign(storage: StorageLike, scenario: Scenario): RestoreResult {
  const v3 = readItem(storage, V3_STORAGE_KEY);
  if (v3.kind === "unavailable") return v3;
  if (v3.value === null) return restoreV2Handoff(storage);

  try {
    const parsed: unknown = JSON.parse(v3.value);
    if (typeof parsed === "object" && parsed !== null
        && (parsed as { schemaVersion?: unknown }).schemaVersion === 3) {
      return { kind: "restart_required" };
    }
    if (isCampaignState(parsed, scenario)) return { kind: "restored", state: parsed };
    if (isSchemaVersion(parsed, 4)) {
      if (hasReplacedReference(parsed)) return { kind: "restart_required" };
      const migrated = migrateV4ToV5(parsed);
      if (!migrated || scenario.version !== 10 || !isCampaignState(migrated, scenario)) {
        return { kind: "restart_required" };
      }
      try {
        storage.setItem(V3_STORAGE_KEY, JSON.stringify(migrated));
      } catch {
        // A valid migration can still be used in this session without storage.
      }
      return { kind: "restored", state: migrated };
    }
    const migrated = migratePreviousModeledEffects(parsed, scenario);
    if (migrated) {
      try {
        storage.setItem(V3_STORAGE_KEY, JSON.stringify(migrated));
      } catch {
        // The corrected state can still be used for this session when persistence is unavailable.
      }
      return { kind: "restored", state: migrated };
    }
    if (isValidCampaignFromAnotherScenarioVersion(parsed, scenario)) return { kind: "restart_required" };
    return { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}

function isSchemaVersion(value: unknown, schemaVersion: number): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
    && (value as { schemaVersion?: unknown }).schemaVersion === schemaVersion;
}

function matchesReplacedReference(value: unknown): boolean {
  return typeof value === "string" && REPLACED_V9_DECISION_IDS.some((id) => value === id || value.startsWith(`${id}:`));
}

function referencesInDecision(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const impact = typeof record.impact === "object" && record.impact !== null ? record.impact as Record<string, unknown> : null;
  return [record.decisionId, record.optionId, impact?.decisionId, impact?.optionId]
    .some(matchesReplacedReference)
    || (Array.isArray(impact?.indicators) && impact!.indicators.some((indicator) =>
      typeof indicator === "object" && indicator !== null && Array.isArray((indicator as Record<string, unknown>).causalEntryIds)
        && ((indicator as Record<string, unknown>).causalEntryIds as unknown[]).some(matchesReplacedReference)));
}

function referencesInEventOrPromise(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return [entry.id, entry.sourceDecisionId, entry.sourceOptionId].some(matchesReplacedReference);
}

function referencesInCrisis(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const crisis = value as Record<string, unknown>;
  return [crisis.ruleId, crisis.triggeredByDecisionId, crisis.resolvedBy]
    .some(matchesReplacedReference)
    || (Array.isArray(crisis.aggravatingDecisionIds) && crisis.aggravatingDecisionIds.some(matchesReplacedReference))
    || (Array.isArray(crisis.aggravatingChoices) && crisis.aggravatingChoices.some(referencesInDecision));
}

/** Finds retired V9 decision references only at persisted identifier boundaries. */
export function hasReplacedReference(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Record<string, unknown>;
  const some = (field: string, predicate: (entry: unknown) => boolean): boolean =>
    Array.isArray(state[field]) && state[field].some(predicate);
  return [state.pendingSelection].some(referencesInDecision)
    || some("decisions", referencesInDecision)
    || some("lockedDecisionIds", matchesReplacedReference)
    || some("unlockedDecisionIds", matchesReplacedReference)
    || some("scheduledEvents", referencesInEventOrPromise)
    || some("eventHistory", referencesInEventOrPromise)
    || some("activePromises", referencesInEventOrPromise)
    || some("promiseHistory", referencesInEventOrPromise)
    || [state.activeCrisis].some(referencesInCrisis)
    || some("crisisHistory", referencesInCrisis)
    || some("causalLedger", (entry) => typeof entry === "object" && entry !== null
      && [
        (entry as Record<string, unknown>).id,
        (entry as Record<string, unknown>).sourceId,
      ].some(matchesReplacedReference));
}

/**
 * V4 has no V10 budget profile or exclusive scope in its records. Therefore
 * only a pristine V4 state, whose absence of policy references is provable,
 * can safely become V10; any selected policy requires a restart.
 */
export function migrateV4ToV5(value: unknown): CampaignState | null {
  if (!isSchemaVersion(value, 4) || hasReplacedReference(value)) return null;
  const candidate: Record<string, unknown> = { ...value, schemaVersion: SCHEMA_VERSION, scenarioVersion: 10 };
  if (Array.isArray(candidate.decisions) && candidate.decisions.length > 0) return null;
  return isCampaignState(candidate, SCENARIO_V10) ? candidate : null;
}

function isValidCampaignFromAnotherScenarioVersion(value: unknown, scenario: Scenario): boolean {
  if (typeof value !== "object" || value === null) return false;
  const campaign = value as Record<string, unknown>;
  if (campaign.schemaVersion !== SCHEMA_VERSION
      || typeof campaign.scenarioVersion !== "number"
      || !Number.isFinite(campaign.scenarioVersion)
      || campaign.scenarioVersion === scenario.version) {
    return false;
  }
  const confirmedDecisionIds = new Set(
    Array.isArray(campaign.decisions)
      ? campaign.decisions.flatMap((record) => typeof record === "object" && record !== null
          && typeof (record as { decisionId?: unknown }).decisionId === "string"
        ? [(record as { decisionId: string }).decisionId]
        : [])
      : [],
  );
  const withoutConfirmedReferences = (ids: unknown): unknown => Array.isArray(ids)
    ? ids.filter((id) => typeof id !== "string" || !confirmedDecisionIds.has(id))
    : ids;
  const detectionCandidate = {
    ...campaign,
    scenarioVersion: scenario.version,
    lockedDecisionIds: withoutConfirmedReferences(campaign.lockedDecisionIds),
    unlockedDecisionIds: withoutConfirmedReferences(campaign.unlockedDecisionIds),
  };
  return isCampaignState(detectionCandidate, scenario);
}

function migratePreviousModeledEffects(value: unknown, scenario: Scenario): CampaignState | null {
  if (typeof value !== "object" || value === null) return null;
  const previousVersion = (value as { scenarioVersion?: unknown }).scenarioVersion;
  if (previousVersion !== MODELED_EFFECT_SOURCE_VERSION || scenario.version !== MODELED_EFFECT_TARGET_VERSION) return null;
  const hasModeledEffects = scenario.decisions.some((decision) => (
    decision.options.some((option) => option.effects.some((effect) => effect.id.includes(HISTORICAL_MODELED_EFFECT_MARKER)))
  ));
  if (!hasModeledEffects) return null;

  const candidate = { ...(value as CampaignState), scenarioVersion: scenario.version };
  if (!isCampaignState(candidate, scenario)) return null;

  let migrated = candidate;
  for (const record of candidate.decisions) {
    if (record.status === "superseded") continue;
    migrated = applyModeledDecisionEffects(migrated, scenario, record);
  }
  return isCampaignState(migrated, scenario) ? migrated : null;
}

function applyModeledDecisionEffects(state: CampaignState, scenario: Scenario, record: DecisionRecord): CampaignState {
  const decision = scenario.decisions.find((candidate) => candidate.id === record.decisionId);
  const option = decision?.options.find((candidate) => candidate.id === record.optionId);
  if (!option) return state;
  const sourceId = `${record.decisionId}:${record.optionId}`;
  return option.effects
    .filter((effect) => effect.timing.kind === "immediate" && effect.id.includes(HISTORICAL_MODELED_EFFECT_MARKER))
    .reduce((current, effect) => applyEffect(current, effect, {
      sourceType: "decision",
      sourceId,
      appliedAtDecision: record.confirmedAtIndex,
    }), state);
}

export function clearCampaign(storage: StorageLike): void {
  try {
    storage.removeItem(V3_STORAGE_KEY);
  } catch {
    // Clearing is best-effort for the same reason as saving.
  }
}

function restoreV2Handoff(storage: StorageLike): V2RestoreResult {
  const v2 = readItem(storage, V2_STORAGE_KEY);
  if (v2.kind === "unavailable") return v2;
  if (v2.value === null) return { kind: "new" };
  try {
    const parsed: unknown = JSON.parse(v2.value);
    return typeof parsed === "object" && parsed !== null && (parsed as { version?: unknown }).version === 2
      ? { kind: "v2_found" }
      : { kind: "new" };
  } catch {
    return { kind: "new" };
  }
}

function readItem(storage: StorageLike, key: string): { kind: "value"; value: string | null } | { kind: "unavailable" } {
  try {
    return { kind: "value", value: storage.getItem(key) };
  } catch {
    return { kind: "unavailable" };
  }
}
