import {
  SCHEMA_VERSION,
  type CampaignPhase,
  type CampaignState,
  type CausalEntry,
  type Decision,
  type DecisionOption,
  type DecisionRecord,
  type EffectRule,
  type GroupKey,
  type IndicatorKey,
  materializedDelayedEventId,
  type PromiseRule,
  type Scenario,
} from "./types.ts";
import { optionDistanceDimensions } from "./policy-catalogue.ts";
import {
  CHAPTER_MANDATE_YEARS,
  decisionCountAtMandateYearEnd,
  mandateYearEndingAfterChapter,
  mandateYearForChapter,
  validateBaseline,
} from "./timeline.ts";

const PHASES: readonly CampaignPhase[] = [
  "intro", "chapter_intro", "decision", "decision_result", "council", "crisis",
  "delayed_event", "chapter_verdict", "pause", "verdict",
];
const DECISION_STATUSES = new Set(["confirmed", "suspended", "amended", "reversed", "superseded"]);
const INDICATOR_KEYS = [
  "annualBalance", "debtToGdp", "interestCost", "growth", "employment", "investment",
  "publicServices", "majority", "reformCapacity", "opinion", "institutionalTrust", "financialCredibility",
] as const satisfies readonly IndicatorKey[];
const GROUP_KEYS = [
  "lowIncomeHouseholds", "middleClasses", "retirees", "publicEmployees", "privateEmployees", "unions",
  "businesses", "farmers", "localAuthorities", "creditors", "europeanPartners", "parliamentaryMajority",
] as const satisfies readonly GroupKey[];
const EFFECT_DURATIONS = new Set<EffectRule["duration"]>(["once", "annual", "permanent"]);
const CAUSAL_SOURCE_TYPES = new Set<CausalEntry["sourceType"]>(["decision", "event", "crisis", "promise"]);
const DECISION_KINDS = ["gestion", "transformation", "rupture"] as const;

type ConfirmedDecision = Pick<DecisionRecord, "decisionId" | "optionId" | "confirmedAtIndex">;

export const totalDecisions = (scenario: Scenario): number =>
  scenario.chapters.reduce((sum, chapter) => sum + chapter.decisionIds.length, 0);

export function positionBeforeNext(scenario: Scenario, completed: number): { chapterIndex: number; decisionIndex: number } | null {
  let remaining = completed;
  for (let chapterIndex = 0; chapterIndex < scenario.chapters.length; chapterIndex += 1) {
    const size = scenario.chapters[chapterIndex]!.decisionIds.length;
    if (remaining < size) return { chapterIndex, decisionIndex: remaining };
    remaining -= size;
  }
  return null;
}

export function positionAfterCompleted(scenario: Scenario, completed: number): { chapterIndex: number; decisionIndex: number } | null {
  return completed === 0 ? null : positionBeforeNext(scenario, completed - 1);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const isIndicatorKey = (value: unknown): value is IndicatorKey =>
  typeof value === "string" && INDICATOR_KEYS.includes(value as IndicatorKey);

const isGroupKey = (value: unknown): value is GroupKey =>
  typeof value === "string" && GROUP_KEYS.includes(value as GroupKey);

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) (seen.has(value) ? duplicates : seen).add(value);
  return [...duplicates];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDistanceComparableOption(value: unknown): value is DecisionOption {
  return isRecord(value)
    && typeof value.id === "string"
    && isNonEmptyString(value.mechanism)
    && hasValidPolicyHorizon(value.horizon)
    && isStringArray(value.legalConstraints)
    && (value.budgetDuration === "annual" || value.budgetDuration === "once")
    && isEffectTiming(value.budgetTiming)
    && isStringArray(value.beneficiaries)
    && isStringArray(value.contributors)
    && isStringArray(value.locks)
    && isStringArray(value.unlocks)
    && isStringArray(value.fulfillsPromises)
    && Array.isArray(value.effects)
    && value.effects.every(isEffectRule)
    && Array.isArray(value.scheduledEvents)
    && value.scheduledEvents.every(isDeclaredScheduledEventRule)
    && Array.isArray(value.promises)
    && value.promises.every(isDeclaredPromiseRule);
}

function hasExactFiniteKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length
    && expectedKeys.every((key) => Object.hasOwn(value, key))
    && actualKeys.every((key) => typeof value[key] === "number" && Number.isFinite(value[key]));
}

function hasValidBaseline(value: unknown): boolean {
  if (!isRecord(value)) return false;
  try {
    validateBaseline(value as CampaignState["baseline"]);
    return true;
  } catch {
    return false;
  }
}

function expectedAnnualCheckpoints(scenario: Scenario): Map<number, number> {
  const expected = new Map<number, number>();
  let decisionCount = 0;
  scenario.chapters.forEach((chapter, chapterIndex) => {
    decisionCount += chapter.decisionIds.length;
    const year = mandateYearEndingAfterChapter(chapterIndex);
    if (year !== null) expected.set(year, decisionCount);
  });
  return expected;
}

function hasValidAnnualCheckpoints(value: unknown, scenario: Scenario, decisionCount: number): boolean {
  const expected = expectedAnnualCheckpoints(scenario);
  if (!Array.isArray(value) || value.length > expected.size) return false;
  return value.every((checkpoint, index) => {
    if (!isRecord(checkpoint) || checkpoint.year !== index + 1) return false;
    if (checkpoint.afterDecisionCount !== expected.get(index + 1)
        || (checkpoint.afterDecisionCount as number) > decisionCount) return false;
    if (!Array.isArray(checkpoint.causes)
        || checkpoint.causes.some((id) => typeof id !== "string")
        || hasDuplicates(checkpoint.causes as string[])) return false;
    return [
      checkpoint.nominalGdpMillions,
      checkpoint.debtMillions,
      checkpoint.debtToGdp,
      checkpoint.annualBalance,
      checkpoint.interestCost,
    ].every((item) => typeof item === "number" && Number.isFinite(item));
  });
}

/** Checks an untrusted effect and enforces the target to key relationship at runtime. */
export function isEffectRule(value: unknown): value is EffectRule {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.delta !== "number" || !Number.isFinite(value.delta)) return false;
  if (!isNonEmptyString(value.explanation) || !EFFECT_DURATIONS.has(value.duration as EffectRule["duration"])) return false;
  if (!isRecord(value.timing) || typeof value.timing.kind !== "string") return false;
  const validTiming = value.timing.kind === "immediate"
    || (value.timing.kind === "after_decisions" && isPositiveInteger(value.timing.count))
    || (value.timing.kind === "mandate_year"
      && Number.isInteger(value.timing.year)
      && (value.timing.year as number) >= 1
      && (value.timing.year as number) <= 5);
  if (!validTiming) return false;
  return (value.target === "indicator" && isIndicatorKey(value.key))
    || (value.target === "group" && isGroupKey(value.key));
}

function hasValidPolicyHorizon(value: unknown): boolean {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  return value.kind === "immediate"
    || (value.kind === "after_decisions" && isPositiveInteger(value.count))
    || (value.kind === "mandate_year" && Number.isInteger(value.year) && (value.year as number) >= 1 && (value.year as number) <= 5);
}

function isEffectTiming(value: unknown): value is EffectRule["timing"] {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  return value.kind === "immediate"
    || (value.kind === "after_decisions" && isPositiveInteger(value.count))
    || (value.kind === "mandate_year"
      && Number.isInteger(value.year)
      && (value.year as number) >= 1
      && (value.year as number) <= 5);
}

function sameTiming(left: EffectRule["timing"], right: EffectRule["timing"]): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "after_decisions" && right.kind === "after_decisions") return left.count === right.count;
  if (left.kind === "mandate_year" && right.kind === "mandate_year") return left.year === right.year;
  return left.kind === "immediate" && right.kind === "immediate";
}

function normalizeContractString(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function validateNormalizedContractList(
  values: unknown[],
  label: "beneficiary" | "contributor" | "legal-constraint",
  optionId: string,
  errors: string[],
): void {
  const normalized = values.map((value) => typeof value === "string" ? normalizeContractString(value) : "");
  if (normalized.some((value) => value.length === 0)) errors.push(`option:${optionId}:blank-${label}`);
  for (const duplicate of duplicateValues(normalized.filter(Boolean))) {
    errors.push(`option:${optionId}:duplicate-${label}:${duplicate}`);
  }
}

function dueAtDecisionForTiming(
  horizon: DecisionOption["horizon"] | EffectRule["timing"],
  position: number | undefined,
  scenario: Scenario,
): number | undefined {
  if (horizon.kind === "mandate_year") {
    try {
      return decisionCountAtMandateYearEnd(scenario, horizon.year);
    } catch {
      return undefined;
    }
  }
  if (position === undefined) return undefined;
  return horizon.kind === "immediate" ? position : position + horizon.count;
}

function isImmediateEffectRule(value: unknown): value is EffectRule {
  return isEffectRule(value) && value.timing.kind === "immediate";
}

function isDeclaredScheduledEventRule(value: unknown): boolean {
  return isRecord(value)
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.title)
    && isNonEmptyString(value.body)
    && isPositiveInteger(value.afterDecisions)
    && Array.isArray(value.effects)
    && value.effects.every(isImmediateEffectRule);
}

function isDeclaredPromiseRule(value: unknown): value is PromiseRule {
  return isRecord(value)
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.label)
    && isPositiveInteger(value.dueAfterDecisions)
    && Array.isArray(value.failureEffects)
    && value.failureEffects.every(isImmediateEffectRule);
}

function effectId(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.id === "string" ? value.id : fallback;
}

function knownDecisionAndOption(value: unknown, decisions: Map<string, Decision>): boolean {
  if (!isRecord(value) || typeof value.decisionId !== "string" || typeof value.optionId !== "string") return false;
  return decisions.get(value.decisionId)?.options.some((option) => option.id === value.optionId) ?? false;
}

function hasConfirmedSource(
  decisionId: unknown,
  optionId: unknown,
  confirmedDecisions: Map<string, ConfirmedDecision>,
): boolean {
  return typeof decisionId === "string"
    && typeof optionId === "string"
    && confirmedDecisions.get(decisionId)?.optionId === optionId;
}

function isDecisionRecord(value: unknown, decisions: Map<string, Decision>): value is DecisionRecord {
  return knownDecisionAndOption(value, decisions)
    && isRecord(value)
    && typeof value.status === "string"
    && DECISION_STATUSES.has(value.status)
    && isPositiveInteger(value.confirmedAtIndex)
    && (value.changedByCrisisId === undefined || typeof value.changedByCrisisId === "string");
}

function isScheduledEvent(value: unknown, confirmedDecisions: Map<string, ConfirmedDecision>, campaignLength: number): boolean {
  if (!isRecord(value) || typeof value.id !== "string" || !hasConfirmedSource(value.sourceDecisionId, value.sourceOptionId, confirmedDecisions)) return false;
  const source = confirmedDecisions.get(value.sourceDecisionId as string)!;
  return isPositiveInteger(value.dueAtDecision)
    && value.dueAtDecision >= source.confirmedAtIndex
    && value.dueAtDecision <= campaignLength
    && typeof value.title === "string"
    && typeof value.body === "string"
    && Array.isArray(value.effects)
    && value.effects.every(isImmediateEffectRule);
}

function isPoliticalPromise(value: unknown, confirmedDecisions: Map<string, ConfirmedDecision>, campaignLength: number): boolean {
  if (!isRecord(value) || typeof value.id !== "string" || !hasConfirmedSource(value.sourceDecisionId, value.sourceOptionId, confirmedDecisions)) return false;
  const source = confirmedDecisions.get(value.sourceDecisionId as string)!;
  return typeof value.label === "string"
    && isPositiveInteger(value.dueAtDecision)
    && value.dueAtDecision > source.confirmedAtIndex
    && value.dueAtDecision <= campaignLength
    && typeof value.fulfilled === "boolean"
    && Array.isArray(value.failureEffects)
    && value.failureEffects.every(isImmediateEffectRule);
}

function isCrisisState(value: unknown, confirmedDecisions: Map<string, ConfirmedDecision>, requireResolution: boolean): boolean {
  if (!isRecord(value) || typeof value.ruleId !== "string" || typeof value.triggeredByDecisionId !== "string") return false;
  if (!confirmedDecisions.has(value.triggeredByDecisionId) || !Array.isArray(value.aggravatingDecisionIds)) return false;
  if (value.aggravatingDecisionIds.length === 0 || hasDuplicates(value.aggravatingDecisionIds as string[])) return false;
  if (!value.aggravatingDecisionIds.every((id) => typeof id === "string" && confirmedDecisions.has(id))) return false;
  if (!value.aggravatingDecisionIds.includes(value.triggeredByDecisionId)) return false;
  return requireResolution ? typeof value.resolvedBy === "string" : value.resolvedBy === undefined;
}

function isCausalEntry(
  value: unknown,
  sourceIds: Record<CausalEntry["sourceType"], ReadonlySet<string>>,
  decisionCount: number,
): boolean {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.sourceType !== "string") return false;
  if (!CAUSAL_SOURCE_TYPES.has(value.sourceType as CausalEntry["sourceType"]) || typeof value.sourceId !== "string") return false;
  const sourceType = value.sourceType as CausalEntry["sourceType"];
  if (!sourceIds[sourceType].has(value.sourceId)) return false;
  const validTarget = (value.target === "indicator" && isIndicatorKey(value.key))
    || (value.target === "group" && isGroupKey(value.key));
  return validTarget
    && typeof value.delta === "number"
    && Number.isFinite(value.delta)
    && EFFECT_DURATIONS.has(value.duration as EffectRule["duration"])
    && typeof value.explanation === "string"
    && typeof value.appliedAtDecision === "number"
    && Number.isInteger(value.appliedAtDecision)
    && value.appliedAtDecision >= 0
    && value.appliedAtDecision <= decisionCount;
}

function hasUniqueKnownDecisionIds(value: unknown, decisions: Map<string, Decision>): value is string[] {
  return Array.isArray(value)
    && value.every((id) => typeof id === "string" && decisions.has(id))
    && !hasDuplicates(value as string[]);
}

function hasUniqueDisjointIds(first: readonly { id: string }[], second: readonly { id: string }[]): boolean {
  const firstIds = first.map((item) => item.id);
  const secondIds = second.map((item) => item.id);
  return !hasDuplicates(firstIds)
    && !hasDuplicates(secondIds)
    && !firstIds.some((id) => secondIds.includes(id));
}

function isAtPosition(value: Record<string, unknown>, chapterIndex: number, decisionIndex: number): boolean {
  return value.chapterIndex === chapterIndex && value.decisionIndex === decisionIndex;
}

function matchesPositionBeforeConfirmation(value: Record<string, unknown>, scenario: Scenario, decisionCount: number): boolean {
  const position = positionBeforeNext(scenario, decisionCount);
  return position !== null && isAtPosition(value, position.chapterIndex, position.decisionIndex);
}

function matchesPositionAfterConfirmation(value: Record<string, unknown>, scenario: Scenario, decisionCount: number): boolean {
  const position = positionAfterCompleted(scenario, decisionCount);
  return position !== null && isAtPosition(value, position.chapterIndex, position.decisionIndex);
}

function isChapterBoundary(scenario: Scenario, decisionCount: number): boolean {
  const completed = positionAfterCompleted(scenario, decisionCount);
  const next = positionBeforeNext(scenario, decisionCount);
  return completed !== null
    && next !== null
    && next.chapterIndex === completed.chapterIndex + 1
    && next.decisionIndex === 0;
}

function hasPhasePositionConsistency(value: Record<string, unknown>, scenario: Scenario, decisionCount: number): boolean {
  const campaignLength = totalDecisions(scenario);
  switch (value.phase) {
    case "intro":
      return decisionCount === 0 && matchesPositionBeforeConfirmation(value, scenario, decisionCount);
    case "chapter_intro":
      return (decisionCount === 0 || isChapterBoundary(scenario, decisionCount))
        && matchesPositionBeforeConfirmation(value, scenario, decisionCount);
    case "decision":
      return matchesPositionBeforeConfirmation(value, scenario, decisionCount);
    case "decision_result":
    case "crisis":
    case "delayed_event":
      return matchesPositionAfterConfirmation(value, scenario, decisionCount);
    case "council":
      return matchesPositionAfterConfirmation(value, scenario, decisionCount);
    case "chapter_verdict":
      return isChapterBoundary(scenario, decisionCount)
        && matchesPositionAfterConfirmation(value, scenario, decisionCount);
    case "verdict":
      return decisionCount === campaignLength && matchesPositionAfterConfirmation(value, scenario, decisionCount);
    case "pause":
      return matchesPositionBeforeConfirmation(value, scenario, decisionCount)
        || matchesPositionAfterConfirmation(value, scenario, decisionCount);
    default:
      return false;
  }
}

function validatedChapterIds(chapters: readonly unknown[]): Map<string, number> {
  const positions = new Map<string, number>();
  let completed = 0;
  chapters.forEach((chapter) => {
    if (!isRecord(chapter) || !Array.isArray(chapter.decisionIds)) return;
    chapter.decisionIds.forEach((id, decisionIndex) => {
      if (typeof id === "string" && !positions.has(id)) {
        positions.set(id, completed + decisionIndex + 1);
      }
    });
    completed += chapter.decisionIds.length;
  });
  return positions;
}

function validateDirectEffect(
  effect: unknown,
  position: number | undefined,
  decisionYear: number | null,
  minimumDueAtDecision: number | undefined,
  scenario: Scenario,
  campaignLength: number,
  enforceCampaignBounds: boolean,
  errors: string[],
): void {
  const id = effectId(effect, "unknown");
  if (!isEffectRule(effect)) {
    if (isRecord(effect) && isRecord(effect.timing) && effect.timing.kind === "after_decisions" && !isPositiveInteger(effect.timing.count)) {
      errors.push(`effect:${id}:delayed-count-required`);
    } else {
      errors.push(`effect:${id}:invalid-rule`);
    }
    return;
  }
  if (effect.timing.kind === "after_decisions" && enforceCampaignBounds && position !== undefined && position + effect.timing.count > campaignLength) {
    errors.push(`effect:${effect.id}:due-after-campaign`);
  }
  if (effect.timing.kind === "mandate_year" && decisionYear !== null && effect.timing.year < decisionYear) {
    errors.push(`effect:${effect.id}:timing-before-decision-year`);
  }
  const effectDueAtDecision = dueAtDecisionForTiming(effect.timing, position, scenario);
  if (effect.timing.kind === "mandate_year" && effectDueAtDecision === undefined) {
    errors.push(`effect:${effect.id}:timing-year-without-checkpoint`);
  }
  if (position !== undefined && effectDueAtDecision !== undefined && effectDueAtDecision < position) {
    errors.push(`effect:${effect.id}:timing-before-decision`);
  }
  const isBudgetEffect = effect.target === "indicator" && effect.key === "annualBalance";
  if (!isBudgetEffect && effectDueAtDecision !== undefined && minimumDueAtDecision !== undefined
      && effectDueAtDecision < minimumDueAtDecision) {
    errors.push(`effect:${effect.id}:timing-before-option-horizon`);
  }
}

function validateScheduledEvent(
  event: unknown,
  position: number | undefined,
  minimumDueAtDecision: number | undefined,
  campaignLength: number,
  enforceCampaignBounds: boolean,
  errors: string[],
): void {
  const id = isRecord(event) && isNonEmptyString(event.id) ? event.id : "unknown";
  if (!isRecord(event) || !isNonEmptyString(event.id)) errors.push(`event:${id}:id-must-be-non-empty-string`);
  if (!isRecord(event) || !isNonEmptyString(event.title)) errors.push(`event:${id}:title-must-be-non-empty-string`);
  if (!isRecord(event) || !isNonEmptyString(event.body)) errors.push(`event:${id}:body-must-be-non-empty-string`);
  if (!isRecord(event) || !isPositiveInteger(event.afterDecisions)) {
    errors.push(`event:${id}:delayed-count-required`);
  } else if (enforceCampaignBounds && position !== undefined
      && Math.max(position + event.afterDecisions, minimumDueAtDecision ?? position) > campaignLength) {
    errors.push(`event:${id}:due-after-campaign`);
  }
  if (!isRecord(event) || !Array.isArray(event.effects) || event.effects.some((effect) => !isImmediateEffectRule(effect))) {
    errors.push(`event:${id}:effects-must-be-immediate`);
  }
}

function validatePromise(
  promise: unknown,
  position: number | undefined,
  campaignLength: number,
  enforceCampaignBounds: boolean,
  errors: string[],
): void {
  const id = isRecord(promise) && isNonEmptyString(promise.id) ? promise.id : "unknown";
  if (!isRecord(promise) || !isNonEmptyString(promise.id)) errors.push(`promise:${id}:id-must-be-non-empty-string`);
  if (!isRecord(promise) || !isNonEmptyString(promise.label)) errors.push(`promise:${id}:label-must-be-non-empty-string`);
  if (!isRecord(promise) || !isPositiveInteger(promise.dueAfterDecisions)) {
    errors.push(`promise:${id}:delayed-count-required`);
  } else if (enforceCampaignBounds && position !== undefined && position + promise.dueAfterDecisions > campaignLength) {
    errors.push(`promise:${id}:due-after-campaign`);
  }
  if (!isRecord(promise) || !Array.isArray(promise.failureEffects) || promise.failureEffects.some((effect) => !isImmediateEffectRule(effect))) {
    errors.push(`promise:${id}:failure-effects-must-be-immediate`);
  }
}

function validateOptionReferences(
  option: unknown,
  optionId: string,
  decisionIds: ReadonlySet<string>,
  promiseIds: ReadonlySet<string>,
  errors: string[],
): void {
  const locks = isRecord(option) ? option.locks : undefined;
  const unlocks = isRecord(option) ? option.unlocks : undefined;
  const fulfillsPromises = isRecord(option) ? option.fulfillsPromises : undefined;

  if (!isStringArray(locks)) {
    errors.push(`option:${optionId}:locks-must-be-string-array`);
  } else {
    for (const id of duplicateValues(locks)) errors.push(`option:${optionId}:duplicate-lock:${id}`);
    for (const id of locks) if (!decisionIds.has(id)) errors.push(`option:${optionId}:lock-unknown-decision:${id}`);
  }
  if (!isStringArray(unlocks)) {
    errors.push(`option:${optionId}:unlocks-must-be-string-array`);
  } else {
    for (const id of duplicateValues(unlocks)) errors.push(`option:${optionId}:duplicate-unlock:${id}`);
    for (const id of unlocks) if (!decisionIds.has(id)) errors.push(`option:${optionId}:unlock-unknown-decision:${id}`);
  }
  if (isStringArray(locks) && isStringArray(unlocks)) {
    for (const id of locks) if (unlocks.includes(id)) errors.push(`option:${optionId}:lock-unlock-overlap:${id}`);
  }
  if (!isStringArray(fulfillsPromises)) {
    errors.push(`option:${optionId}:fulfills-promises-must-be-string-array`);
  } else {
    for (const id of duplicateValues(fulfillsPromises)) errors.push(`option:${optionId}:duplicate-fulfilled-promise:${id}`);
    for (const id of fulfillsPromises) if (!promiseIds.has(id)) errors.push(`option:${optionId}:unknown-fulfilled-promise:${id}`);
  }
}

function optionEffectRules(
  effects: readonly unknown[],
  events: readonly unknown[],
  promises: readonly unknown[],
): EffectRule[] {
  const rules = effects.filter(isEffectRule);
  for (const event of events) {
    if (isRecord(event) && Array.isArray(event.effects)) rules.push(...event.effects.filter(isEffectRule));
  }
  for (const promise of promises) {
    if (isRecord(promise) && Array.isArray(promise.failureEffects)) rules.push(...promise.failureEffects.filter(isEffectRule));
  }
  return rules;
}

function validateOptionEffectIds(
  decisionId: string,
  optionId: string,
  effects: readonly unknown[],
  events: readonly unknown[],
  promises: readonly unknown[],
  explicitEventIds: ReadonlySet<string>,
  errors: string[],
): string[] {
  for (const id of duplicateValues(optionEffectRules(effects, events, promises).map((effect) => effect.id))) {
    errors.push(`option:${optionId}:duplicate-effect-id:${id}`);
  }
  const delayedEventIds = effects
    .filter(isEffectRule)
    .filter((effect) => effect.timing.kind !== "immediate")
    .map((effect) => materializedDelayedEventId(decisionId, optionId, effect.id));
  for (const id of duplicateValues(delayedEventIds)) {
    errors.push(`option:${optionId}:duplicate-materialized-event-id:${id}`);
  }
  for (const id of delayedEventIds) {
    if (explicitEventIds.has(id)) errors.push(`option:${optionId}:materialized-event-id-collides:${id}`);
  }
  return delayedEventIds;
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

/** Validates catalogue structure and rejects malformed effects before any campaign can materialize them. */
export function validateScenario(
  scenario: Scenario,
  options: { allowConsequencesBeyondCampaign?: boolean } = {},
): string[] {
  const rawScenario: unknown = scenario;
  if (!isRecord(rawScenario) || !Array.isArray(rawScenario.chapters) || !Array.isArray(rawScenario.decisions)) {
    return ["scenario:invalid-structure"];
  }

  const errors: string[] = [];
  const enforceCampaignBounds = !options.allowConsequencesBeyondCampaign;
  const chapters = rawScenario.chapters;
  const rawDecisions = rawScenario.decisions;
  if (!isPositiveInteger(rawScenario.version)) errors.push("scenario:version:positive-integer-required");
  if (chapters.length === 0) errors.push("scenario:chapters-required");
  if (chapters.length > CHAPTER_MANDATE_YEARS.length) errors.push("scenario:chapters-exceed-mandate-calendar");
  for (const [chapterIndex, chapter] of chapters.entries()) {
    const chapterId = isRecord(chapter) && typeof chapter.id === "string" ? chapter.id : `index-${chapterIndex + 1}`;
    if (!isRecord(chapter) || !Array.isArray(chapter.decisionIds) || chapter.decisionIds.length === 0) {
      errors.push(`chapter:${chapterId}:decisions-required`);
      continue;
    }
    const ids = chapter.decisionIds.filter((id): id is string => typeof id === "string");
    for (const id of duplicateValues(ids)) errors.push(`chapter:${chapterId}:duplicate-decision:${id}`);
  }
  if (rawDecisions.length === 0) errors.push("scenario:decisions-required");

  const decisions = rawDecisions.filter((decision): decision is Decision => isRecord(decision) && typeof decision.id === "string") as Decision[];
  if (hasDuplicates(decisions.map((decision) => decision.id))) errors.push("scenario:duplicate-decision-id");
  const scheduledEventIds = decisions.flatMap((decision) => Array.isArray(decision.options)
    ? decision.options.flatMap((option) => isRecord(option) && Array.isArray(option.scheduledEvents)
      ? option.scheduledEvents.map((event) => effectId(event, "unknown"))
      : [])
    : []);
  const promiseIds = decisions.flatMap((decision) => Array.isArray(decision.options)
    ? decision.options.flatMap((option) => isRecord(option) && Array.isArray(option.promises)
      ? option.promises.map((promise) => effectId(promise, "unknown"))
      : [])
    : []);
  const declaredPromiseIds = new Set(decisions.flatMap((decision) => Array.isArray(decision.options)
    ? decision.options.flatMap((option) => isRecord(option) && Array.isArray(option.promises)
      ? option.promises.filter(isDeclaredPromiseRule).map((promise) => promise.id)
      : [])
    : []));
  const explicitScheduledEventIds = new Set(scheduledEventIds);
  for (const id of duplicateValues(scheduledEventIds)) errors.push(`scenario:duplicate-scheduled-event-id:${id}`);
  for (const id of duplicateValues(promiseIds)) errors.push(`scenario:duplicate-promise-id:${id}`);
  for (const decision of decisions) {
    if (Array.isArray(decision.options) && hasDuplicates(decision.options.filter(isRecord).map((option) => typeof option.id === "string" ? option.id : "unknown"))) {
      errors.push(`decision:${decision.id}:duplicate-option-id`);
    }
  }

  const decisionsById = new Map(decisions.map((decision) => [decision.id, decision]));
  const decisionIds = new Set(decisionsById.keys());
  for (const chapter of chapters) {
    if (!isRecord(chapter) || typeof chapter.id !== "string" || !Array.isArray(chapter.decisionIds)) continue;
    for (const id of chapter.decisionIds) {
      if (typeof id !== "string" || decisionsById.get(id)?.chapterId !== chapter.id) errors.push(`chapter:${chapter.id}:unknown-decision:${String(id)}`);
    }
  }
  const chapterDecisionCounts = new Map<string, number>();
  for (const chapter of chapters) {
    if (!isRecord(chapter) || !Array.isArray(chapter.decisionIds)) continue;
    for (const id of chapter.decisionIds) {
      if (typeof id === "string") chapterDecisionCounts.set(id, (chapterDecisionCounts.get(id) ?? 0) + 1);
    }
  }
  for (const decision of decisions) {
    if (chapterDecisionCounts.get(decision.id) !== 1) errors.push(`decision:${decision.id}:expected-once-in-chapters`);
  }

  const positions = validatedChapterIds(chapters);
  const chapterIndexById = new Map(chapters.flatMap((chapter, chapterIndex) =>
    isRecord(chapter) && typeof chapter.id === "string" ? [[chapter.id, chapterIndex] as const] : [],
  ));
  const campaignLength = chapters.every((chapter) => isRecord(chapter) && Array.isArray(chapter.decisionIds))
    ? totalDecisions(scenario)
    : rawDecisions.length;
  const materializedDelayedEventIds: string[] = [];
  for (const decision of decisions) {
    const options = Array.isArray(decision.options) ? decision.options : [];
    if (!DECISION_KINDS.includes(decision.kind)) errors.push(`decision:${decision.id}:invalid-kind`);
    const decisionChapterIndex = chapterIndexById.get(decision.chapterId);
    const decisionYear = decisionChapterIndex === undefined ? null : mandateYearForChapter(decisionChapterIndex);
    if (options.length < 2 || options.length > 4) errors.push(`decision:${decision.id}:expected-2-to-4-options`);
    if (!Array.isArray(decision.evidence) || decision.evidence.length === 0) errors.push(`decision:${decision.id}:evidence-required`);
    for (const [optionIndex, option] of options.entries()) {
      const optionId = isRecord(option) && typeof option.id === "string" ? option.id : `${decision.id}-option-${optionIndex + 1}`;
      const effects = isRecord(option) && Array.isArray(option.effects) ? option.effects : [];
      const events = isRecord(option) && Array.isArray(option.scheduledEvents) ? option.scheduledEvents : [];
      const promises = isRecord(option) && Array.isArray(option.promises) ? option.promises : [];
      validateOptionReferences(option, optionId, decisionIds, declaredPromiseIds, errors);
      materializedDelayedEventIds.push(
        ...validateOptionEffectIds(decision.id, optionId, effects, events, promises, explicitScheduledEventIds, errors),
      );
      if (!isRecord(option) || !Array.isArray(option.beneficiaries) || option.beneficiaries.length === 0) {
        errors.push(`option:${optionId}:beneficiaries-required`);
      } else {
        validateNormalizedContractList(option.beneficiaries, "beneficiary", optionId, errors);
      }
      if (!isRecord(option) || !Array.isArray(option.contributors) || option.contributors.length === 0) {
        errors.push(`option:${optionId}:contributors-required`);
      } else {
        validateNormalizedContractList(option.contributors, "contributor", optionId, errors);
      }
      if (!isRecord(option) || !isNonEmptyString(option.mechanism)) errors.push(`option:${optionId}:mechanism-required`);
      if (!isRecord(option) || !hasValidPolicyHorizon(option.horizon)) {
        errors.push(`option:${optionId}:valid-horizon-required`);
      } else {
        if (option.horizon.kind === "mandate_year" && decisionYear !== null && option.horizon.year < decisionYear) {
          errors.push(`option:${optionId}:horizon-before-decision-year`);
        }
        if (enforceCampaignBounds && option.horizon.kind === "after_decisions"
            && positions.get(decision.id) !== undefined
            && positions.get(decision.id)! + option.horizon.count > campaignLength) {
          errors.push(`option:${optionId}:horizon-after-campaign`);
        }
        if (option.horizon.kind === "mandate_year"
            && dueAtDecisionForTiming(option.horizon, positions.get(decision.id), scenario) === undefined) {
          errors.push(`option:${optionId}:horizon-year-without-checkpoint`);
        }
        const horizonDueAtDecision = dueAtDecisionForTiming(option.horizon, positions.get(decision.id), scenario);
        if (horizonDueAtDecision !== undefined && positions.get(decision.id) !== undefined
            && horizonDueAtDecision < positions.get(decision.id)!) {
          errors.push(`option:${optionId}:horizon-before-decision`);
        }
      }
      if (!isRecord(option) || !isStringArray(option.legalConstraints)) {
        errors.push(`option:${optionId}:legal-constraints-required`);
      } else {
        validateNormalizedContractList(option.legalConstraints, "legal-constraint", optionId, errors);
      }
      if (!isRecord(option) || (option.budgetDuration !== "annual" && option.budgetDuration !== "once")) errors.push(`option:${optionId}:budget-duration-required`);
      if (!isRecord(option) || !isEffectTiming(option.budgetTiming)) {
        errors.push(`option:${optionId}:budget-timing-required`);
      } else {
        if (option.budgetTiming.kind === "mandate_year" && decisionYear !== null && option.budgetTiming.year < decisionYear) {
          errors.push(`option:${optionId}:budget-timing-before-decision-year`);
        }
        if (enforceCampaignBounds && option.budgetTiming.kind === "after_decisions"
            && positions.get(decision.id) !== undefined
            && positions.get(decision.id)! + option.budgetTiming.count > campaignLength) {
          errors.push(`option:${optionId}:budget-timing-after-campaign`);
        }
        if (option.budgetTiming.kind === "mandate_year"
            && dueAtDecisionForTiming(option.budgetTiming, positions.get(decision.id), scenario) === undefined) {
          errors.push(`option:${optionId}:budget-timing-year-without-checkpoint`);
        }
        const budgetDueAtDecision = dueAtDecisionForTiming(option.budgetTiming, positions.get(decision.id), scenario);
        if (budgetDueAtDecision !== undefined && positions.get(decision.id) !== undefined
            && budgetDueAtDecision < positions.get(decision.id)!) {
          errors.push(`option:${optionId}:budget-timing-before-decision`);
        }
      }
      if (effects.length === 0 && events.length === 0) errors.push(`option:${optionId}:effect-or-event-required`);
      if (!effects.some((effect) => isEffectRule(effect) && effect.target === "indicator" && effect.key !== "annualBalance")) {
        errors.push(`option:${optionId}:non-budget-indicator-required`);
      }
      const budgetEffects = effects.filter((effect) => isEffectRule(effect)
        && effect.target === "indicator" && effect.key === "annualBalance");
      if (budgetEffects.length > 1) errors.push(`option:${optionId}:multiple-budget-effects`);
      if (isRecord(option) && option.budgetDuration === "once" && budgetEffects.length === 0) {
        errors.push(`option:${optionId}:once-budget-effect-required`);
      }
      if (isRecord(option) && isEffectTiming(option.budgetTiming)) {
        if (budgetEffects.some((effect) => !sameTiming(effect.timing, option.budgetTiming))) {
          errors.push(`option:${optionId}:budget-timing-mismatch`);
        }
        if ((option.budgetDuration === "annual" || option.budgetDuration === "once")
            && budgetEffects.some((effect) => effect.duration !== option.budgetDuration)) {
          errors.push(`option:${optionId}:budget-duration-mismatch`);
        }
      }
      const minimumDueAtDecision = isRecord(option) && hasValidPolicyHorizon(option.horizon)
        ? dueAtDecisionForTiming(option.horizon, positions.get(decision.id), scenario)
        : undefined;
      for (const effect of effects) validateDirectEffect(
        effect,
        positions.get(decision.id),
        decisionYear,
        minimumDueAtDecision,
        scenario,
        campaignLength,
        enforceCampaignBounds,
        errors,
      );
      for (const event of events) validateScheduledEvent(
        event,
        positions.get(decision.id),
        minimumDueAtDecision,
        campaignLength,
        enforceCampaignBounds,
        errors,
      );
      for (const promise of promises) validatePromise(
        promise,
        positions.get(decision.id),
        campaignLength,
        enforceCampaignBounds,
        errors,
      );
    }
    for (let left = 0; left < options.length; left += 1) {
      for (let right = left + 1; right < options.length; right += 1) {
        const leftOption = options[left];
        const rightOption = options[right];
        if (isDistanceComparableOption(leftOption) && isDistanceComparableOption(rightOption)
            && optionDistanceDimensions(leftOption, rightOption).length < 2) {
          errors.push(`decision:${decision.id}:options-too-close:${String(leftOption.id)}:${String(rightOption.id)}`);
        }
      }
    }
    if (Array.isArray(decision.evidence)) {
      for (const evidence of decision.evidence) {
        const label = isRecord(evidence) && typeof evidence.label === "string" ? evidence.label : "unknown";
        if (!isRecord(evidence) || typeof evidence.sourceUrl !== "string" || !evidence.sourceUrl.startsWith("https://")) {
          errors.push(`evidence:${decision.id}:${label}:https-required`);
        } else if (evidence.sourceUrl === "https://500signatures.fr/sources/") {
          errors.push(`evidence:${decision.id}:${label}:direct-source-required`);
        }
      }
    }
    if (decision.historicalPrecedent && (!isRecord(decision.historicalPrecedent) || typeof decision.historicalPrecedent.sourceUrl !== "string" || !decision.historicalPrecedent.sourceUrl.startsWith("https://"))) {
      errors.push(`precedent:${decision.id}:https-required`);
    }
  }
  for (const id of duplicateValues(materializedDelayedEventIds)) {
    errors.push(`scenario:duplicate-materialized-event-id:${id}`);
  }
  for (const path of assertNoEmDash(rawScenario)) errors.push(`editorial:em-dash:${path}`);
  return errors;
}

export function validatePolicyCatalogue(scenario: Scenario): string[] {
  return validateScenario(scenario, { allowConsequencesBeyondCampaign: true });
}

/** Narrow an untrusted persisted value to a reachable V3 campaign state. */
export function isCampaignState(value: unknown, scenario: Scenario): value is CampaignState {
  if (validateScenario(scenario).length > 0) return false;
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION || value.scenarioVersion !== scenario.version) return false;
  if (!PHASES.includes(value.phase as CampaignPhase) || !Number.isInteger(value.chapterIndex) || !Number.isInteger(value.decisionIndex)) return false;
  if (value.pausedFrom !== undefined) {
    if (value.phase !== "pause" || value.pausedFrom === "pause" || !PHASES.includes(value.pausedFrom as CampaignPhase)) return false;
  }
  const chapter = scenario.chapters[value.chapterIndex as number];
  if (!chapter || (value.decisionIndex as number) < 0 || (value.decisionIndex as number) >= chapter.decisionIds.length) return false;
  if (!Array.isArray(value.decisions) || !Array.isArray(value.scheduledEvents) || !Array.isArray(value.eventHistory) || !Array.isArray(value.activePromises) || !Array.isArray(value.promiseHistory) || !Array.isArray(value.crisisHistory) || !Array.isArray(value.resolvedCrisisIds) || !Array.isArray(value.causalLedger) || !Array.isArray(value.unlockedDecisionIds) || !Array.isArray(value.lockedDecisionIds)) return false;
  if (!hasValidBaseline(value.baseline) || !hasValidAnnualCheckpoints(value.annualCheckpoints, scenario, value.decisions.length)) return false;
  if (!isRecord(value.indicators) || !hasExactFiniteKeys(value.indicators, INDICATOR_KEYS)) return false;
  if (!isRecord(value.groups) || !hasExactFiniteKeys(value.groups, GROUP_KEYS)) return false;
  if (typeof value.seed !== "number" || !Number.isFinite(value.seed) || typeof value.savedAt !== "string" || Number.isNaN(Date.parse(value.savedAt))) return false;

  const decisionRecords = value.decisions as unknown[];
  const scheduledEvents = value.scheduledEvents as unknown[];
  const eventHistory = value.eventHistory as unknown[];
  const activePromises = value.activePromises as unknown[];
  const promiseHistory = value.promiseHistory as unknown[];
  const crisisHistory = value.crisisHistory as unknown[];
  const resolvedCrisisIds = value.resolvedCrisisIds as unknown[];
  const causalLedger = value.causalLedger as unknown[];
  const unlockedDecisionIds = value.unlockedDecisionIds as unknown[];
  const lockedDecisionIds = value.lockedDecisionIds as unknown[];

  const decisions = new Map(scenario.decisions.map((decision) => [decision.id, decision]));
  const editorialOrder = scenario.chapters.flatMap((chapter) => chapter.decisionIds);
  const campaignLength = totalDecisions(scenario);
  if (decisionRecords.length > campaignLength || !decisionRecords.every((record) => isDecisionRecord(record, decisions))) return false;
  if (!decisionRecords.every((record, index) => {
    const typedRecord = record as DecisionRecord;
    return typedRecord.decisionId === editorialOrder[index] && typedRecord.confirmedAtIndex === index + 1;
  })) return false;
  const confirmedDecisions = new Map<string, ConfirmedDecision>(decisionRecords.map((record) => {
    const typedRecord = record as DecisionRecord;
    return [typedRecord.decisionId, typedRecord];
  }));
  if (confirmedDecisions.size !== decisionRecords.length) return false;
  if (!hasPhasePositionConsistency(value, scenario, decisionRecords.length)) return false;
  if (value.phase === "council") {
    const latest = (value.annualCheckpoints as unknown[]).at(-1);
    if (!isRecord(latest) || latest.afterDecisionCount !== decisionRecords.length) return false;
  }
  if (value.phase === "verdict"
      && (value.annualCheckpoints as unknown[]).length !== expectedAnnualCheckpoints(scenario).size) return false;

  const pendingSelection = value.pendingSelection;
  if (pendingSelection !== undefined) {
    if (value.phase !== "decision" || !isRecord(pendingSelection) || !knownDecisionAndOption(pendingSelection, decisions)) return false;
    const currentDecisionId = editorialOrder[decisionRecords.length];
    if (pendingSelection.decisionId !== currentDecisionId || (lockedDecisionIds as string[]).includes(currentDecisionId)) return false;
  }
  if (!scheduledEvents.every((event) => isScheduledEvent(event, confirmedDecisions, campaignLength))) return false;
  if (!eventHistory.every((event) => isScheduledEvent(event, confirmedDecisions, campaignLength))) return false;
  if (![...activePromises, ...promiseHistory].every((promise) => isPoliticalPromise(promise, confirmedDecisions, campaignLength))) return false;
  if (!hasUniqueDisjointIds(scheduledEvents as { id: string }[], eventHistory as { id: string }[])) return false;
  if (!hasUniqueDisjointIds(activePromises as { id: string }[], promiseHistory as { id: string }[])) return false;

  if (!crisisHistory.every((crisis) => isCrisisState(crisis, confirmedDecisions, true))) return false;
  if (value.activeCrisis !== undefined && !isCrisisState(value.activeCrisis, confirmedDecisions, false)) return false;
  if ((value.phase === "crisis") !== (value.activeCrisis !== undefined)) return false;
  if (value.phase === "delayed_event"
      && !(scheduledEvents as { dueAtDecision: number }[]).some((event) => event.dueAtDecision <= decisionRecords.length)
      && !(activePromises as { dueAtDecision: number }[]).some((promise) => promise.dueAtDecision <= decisionRecords.length)) return false;
  const crisisHistoryIds = (crisisHistory as { ruleId: string }[]).map((crisis) => crisis.ruleId);
  if (hasDuplicates(crisisHistoryIds) || !resolvedCrisisIds.every((id) => typeof id === "string") || hasDuplicates(resolvedCrisisIds as string[])) return false;
  if ((resolvedCrisisIds as string[]).length !== crisisHistoryIds.length || !(resolvedCrisisIds as string[]).every((id) => crisisHistoryIds.includes(id))) return false;
  if (value.activeCrisis !== undefined && (resolvedCrisisIds as string[]).includes((value.activeCrisis as { ruleId: string }).ruleId)) return false;

  if (!hasUniqueKnownDecisionIds(unlockedDecisionIds, decisions) || !hasUniqueKnownDecisionIds(lockedDecisionIds, decisions)) return false;
  if ((lockedDecisionIds as string[]).some((id) => (unlockedDecisionIds as string[]).includes(id))) return false;
  const confirmedDecisionIds = new Set(decisionRecords.map((record) => (record as DecisionRecord).decisionId));
  if ([...lockedDecisionIds, ...unlockedDecisionIds].some((id) => confirmedDecisionIds.has(id as string))) return false;
  const sourceIds: Record<CausalEntry["sourceType"], ReadonlySet<string>> = {
    decision: new Set(decisionRecords.map((record) => `${(record as DecisionRecord).decisionId}:${(record as DecisionRecord).optionId}`)),
    event: new Set([...scheduledEvents, ...eventHistory].map((event) => (event as { id: string }).id)),
    promise: new Set([...activePromises, ...promiseHistory].map((promise) => (promise as { id: string }).id)),
    crisis: new Set([...(value.activeCrisis ? [value.activeCrisis] : []), ...crisisHistory].map((crisis) => (crisis as { ruleId: string }).ruleId)),
  };
  if (!causalLedger.every((entry) => isCausalEntry(entry, sourceIds, decisionRecords.length))) return false;
  if (hasDuplicates((causalLedger as { id: string }[]).map((entry) => entry.id))) return false;
  const causalEntries = new Map((causalLedger as CausalEntry[]).map((entry) => [entry.id, entry]));
  if (!(value.annualCheckpoints as CampaignState["annualCheckpoints"]).every((checkpoint) => (
    checkpoint.causes.every((id) => {
      const entry = causalEntries.get(id);
      return entry?.target === "indicator"
        && ["annualBalance", "growth", "interestCost"].includes(entry.key)
        && entry.appliedAtDecision <= checkpoint.afterDecisionCount;
    })
  ))) return false;
  return true;
}
