import { SCHEMA_VERSION, type CampaignPhase, type CampaignState, type Decision, type DecisionOption, type EffectRule, type Scenario } from "./types.ts";

const PHASES: readonly CampaignPhase[] = [
  "intro", "chapter_intro", "decision", "decision_result", "council", "crisis",
  "delayed_event", "chapter_verdict", "pause", "verdict",
];
const DECISION_STATUSES = new Set(["confirmed", "suspended", "amended", "reversed"]);
const INDICATOR_KEYS = [
  "annualBalance", "debtToGdp", "interestCost", "growth", "employment", "investment",
  "publicServices", "majority", "reformCapacity", "opinion", "institutionalTrust", "financialCredibility",
] as const;
const GROUP_KEYS = [
  "lowIncomeHouseholds", "middleClasses", "retirees", "publicEmployees", "privateEmployees", "unions",
  "businesses", "farmers", "localAuthorities", "creditors", "europeanPartners", "parliamentaryMajority",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) (seen.has(value) ? duplicates : seen).add(value);
  return [...duplicates];
}

function hasExactFiniteKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length
    && expectedKeys.every((key) => Object.hasOwn(value, key))
    && actualKeys.every((key) => typeof value[key] === "number" && Number.isFinite(value[key]));
}

function effectRules(option: DecisionOption): readonly EffectRule[] {
  return [...option.effects, ...option.scheduledEvents.flatMap((event) => event.effects), ...option.promises.flatMap((promise) => promise.failureEffects)];
}

function assertPositiveDelayedCounts(decision: Decision): string[] {
  const errors: string[] = [];
  for (const option of decision.options) {
    for (const effect of effectRules(option)) {
      if (effect.timing.kind === "after_decisions" && !isPositiveInteger(effect.timing.count)) {
        errors.push(`effect:${effect.id}:delayed-count-required`);
      }
    }
    for (const event of option.scheduledEvents) {
      if (!isPositiveInteger(event.afterDecisions)) errors.push(`event:${event.id}:delayed-count-required`);
    }
    for (const promise of option.promises) {
      if (!isPositiveInteger(promise.dueAfterDecisions)) errors.push(`promise:${promise.id}:delayed-count-required`);
    }
  }
  return errors;
}

/** Returns paths to each editorial em dash in JSON-compatible data. */
export function assertNoEmDash(value: unknown): string[] {
  const paths: string[] = [];
  const visited = new WeakSet<object>();
  const visit = (current: unknown, path: string): void => {
    if (typeof current === "string") {
      if (current.includes("\u2014")) paths.push(path);
      return;
    }
    if (typeof current !== "object" || current === null || visited.has(current)) return;
    visited.add(current);
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`));
    } else if (isRecord(current)) {
      for (const [key, item] of Object.entries(current)) {
        const next = /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
        visit(item, next);
      }
    }
  };
  visit(value, "$");
  return paths;
}

export function validateScenario(scenario: Scenario): string[] {
  const errors: string[] = [];
  if (!isPositiveInteger(scenario.version)) errors.push("scenario:version:positive-integer-required");
  if (scenario.chapters.length !== 8) errors.push("scenario:expected-8-chapters");
  for (const chapter of scenario.chapters) {
    if (chapter.decisionIds.length !== 12) errors.push(`chapter:${chapter.id}:expected-12-decisions`);
    for (const id of duplicateValues(chapter.decisionIds)) errors.push(`chapter:${chapter.id}:duplicate-decision:${id}`);
  }
  if (scenario.decisions.length !== 96) errors.push("scenario:expected-96-decisions");

  if (hasDuplicates(scenario.decisions.map((decision) => decision.id))) errors.push("scenario:duplicate-decision-id");
  for (const decision of scenario.decisions) {
    if (hasDuplicates(decision.options.map((option) => option.id))) errors.push(`decision:${decision.id}:duplicate-option-id`);
  }

  const decisionsById = new Map(scenario.decisions.map((decision) => [decision.id, decision]));
  for (const chapter of scenario.chapters) {
    for (const id of chapter.decisionIds) {
      if (decisionsById.get(id)?.chapterId !== chapter.id) errors.push(`chapter:${chapter.id}:unknown-decision:${id}`);
    }
  }
  const chapterDecisionCounts = new Map<string, number>();
  for (const chapter of scenario.chapters) {
    for (const id of chapter.decisionIds) chapterDecisionCounts.set(id, (chapterDecisionCounts.get(id) ?? 0) + 1);
  }
  if (scenario.chapters.every((chapter) => chapter.decisionIds.length === 12)) {
    for (const decision of scenario.decisions) {
      if (chapterDecisionCounts.get(decision.id) !== 1) errors.push(`decision:${decision.id}:expected-once-in-chapters`);
    }
  }

  for (const decision of scenario.decisions) {
    if (decision.options.length < 2 || decision.options.length > 4) errors.push(`decision:${decision.id}:expected-2-to-4-options`);
    if (decision.evidence.length === 0) errors.push(`decision:${decision.id}:evidence-required`);
    for (const option of decision.options) {
      if (option.beneficiaries.length === 0) errors.push(`option:${option.id}:beneficiaries-required`);
      if (option.contributors.length === 0) errors.push(`option:${option.id}:contributors-required`);
      if (option.effects.length === 0 && option.scheduledEvents.length === 0) errors.push(`option:${option.id}:effect-or-event-required`);
    }
    errors.push(...assertPositiveDelayedCounts(decision));
    for (const evidence of decision.evidence) {
      if (!evidence.sourceUrl.startsWith("https://")) errors.push(`evidence:${decision.id}:${evidence.label}:https-required`);
    }
    if (decision.historicalPrecedent && !decision.historicalPrecedent.sourceUrl.startsWith("https://")) {
      errors.push(`precedent:${decision.id}:https-required`);
    }
  }
  for (const path of assertNoEmDash(scenario)) errors.push(`editorial:em-dash:${path}`);
  return errors;
}

function knownDecisionAndOption(value: unknown, decisions: Map<string, Decision>): boolean {
  if (!isRecord(value) || typeof value.decisionId !== "string" || typeof value.optionId !== "string") return false;
  return decisions.get(value.decisionId)?.options.some((option) => option.id === value.optionId) ?? false;
}

function isDecisionRecord(value: unknown, decisions: Map<string, Decision>): boolean {
  return knownDecisionAndOption(value, decisions)
    && isRecord(value)
    && typeof value.status === "string"
    && DECISION_STATUSES.has(value.status)
    && isPositiveInteger(value.confirmedAtIndex)
    && (value.changedByCrisisId === undefined || typeof value.changedByCrisisId === "string");
}

/** Narrow an untrusted persisted value to the V3 campaign state schema. */
export function isCampaignState(value: unknown, scenario: Scenario): value is CampaignState {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION || value.scenarioVersion !== scenario.version) return false;
  if (!PHASES.includes(value.phase as CampaignPhase) || !Number.isInteger(value.chapterIndex) || !Number.isInteger(value.decisionIndex)) return false;
  if ((value.chapterIndex as number) < 0 || (value.chapterIndex as number) >= scenario.chapters.length || (value.decisionIndex as number) < 0 || (value.decisionIndex as number) > scenario.decisions.length) return false;
  if (!Array.isArray(value.decisions) || !Array.isArray(value.scheduledEvents) || !Array.isArray(value.activePromises) || !Array.isArray(value.promiseHistory) || !Array.isArray(value.crisisHistory) || !Array.isArray(value.resolvedCrisisIds) || !Array.isArray(value.causalLedger) || !Array.isArray(value.unlockedDecisionIds) || !Array.isArray(value.lockedDecisionIds)) return false;
  if (!isRecord(value.indicators) || !hasExactFiniteKeys(value.indicators, INDICATOR_KEYS)) return false;
  if (!isRecord(value.groups) || !hasExactFiniteKeys(value.groups, GROUP_KEYS)) return false;
  if (typeof value.seed !== "number" || !Number.isFinite(value.seed) || typeof value.savedAt !== "string" || Number.isNaN(Date.parse(value.savedAt))) return false;

  const decisions = new Map(scenario.decisions.map((decision) => [decision.id, decision]));
  if (!value.decisions.every((record) => isDecisionRecord(record, decisions))) return false;
  if (value.pendingSelection !== undefined && !knownDecisionAndOption(value.pendingSelection, decisions)) return false;
  if (!value.scheduledEvents.every((event) => isRecord(event) && typeof event.sourceDecisionId === "string" && typeof event.sourceOptionId === "string" && knownDecisionAndOption({ decisionId: event.sourceDecisionId, optionId: event.sourceOptionId }, decisions))) return false;
  if (![...value.activePromises, ...value.promiseHistory].every((promise) => isRecord(promise) && typeof promise.sourceDecisionId === "string" && decisions.has(promise.sourceDecisionId))) return false;
  if (![...value.unlockedDecisionIds, ...value.lockedDecisionIds].every((id) => typeof id === "string" && decisions.has(id))) return false;
  return true;
}
