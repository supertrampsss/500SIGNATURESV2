import { clearSelection, currentDecision } from "./campaign.ts";
import { INDICATOR_META } from "./indicator-meta.ts";
import { isEffectRule, totalDecisions, validateScenario } from "./validation.ts";
import { materializedDelayedEventId } from "./types.ts";
import { decisionCountAtMandateYearEnd } from "./timeline.ts";
import type {
  CampaignState,
  CausalEntry,
  Decision,
  DecisionOption,
  EffectRule,
  IndicatorKey,
  PoliticalPromise,
  Scenario,
  ScheduledEvent,
} from "./types.ts";

export type EffectCause = {
  sourceType: CausalEntry["sourceType"];
  sourceId: string;
  appliedAtDecision?: number;
};

const CLAMPED_INDICATORS = new Set<IndicatorKey>([
  "publicServices",
  "majority",
  "reformCapacity",
  "opinion",
  "institutionalTrust",
  "financialCredibility",
]);

function clampPoliticalIndicator(key: IndicatorKey, value: number): number {
  return CLAMPED_INDICATORS.has(key) ? Math.min(100, Math.max(0, value)) : value;
}

function cloneEffectRule(effect: EffectRule, timing = effect.timing): EffectRule {
  const copiedTiming = timing.kind === "immediate"
    ? { kind: "immediate" as const }
    : timing.kind === "after_decisions"
      ? { kind: "after_decisions" as const, count: timing.count }
      : { kind: "mandate_year" as const, year: timing.year };
  return effect.target === "indicator"
    ? { ...effect, key: effect.key, timing: copiedTiming }
    : { ...effect, key: effect.key, timing: copiedTiming };
}

function immediateCopy(effect: EffectRule): EffectRule {
  return cloneEffectRule(effect, { kind: "immediate" });
}

function assertEffectRule(effect: unknown): asserts effect is EffectRule {
  if (typeof effect !== "object" || effect === null) throw new Error("Invalid effect rule");
  if (!Number.isFinite((effect as { delta?: unknown }).delta)) throw new Error("Effect delta must be finite");
  if (!isEffectRule(effect)) throw new Error("Invalid effect rule");
}

function assertPositiveDueAtDecision(dueAtDecision: number): void {
  if (!Number.isInteger(dueAtDecision) || dueAtDecision <= 0) throw new Error("Consequence due date must be a positive integer");
}

function assertDueAtDecision(dueAtDecision: number, scenario: Scenario): void {
  assertPositiveDueAtDecision(dueAtDecision);
  const campaignLength = totalDecisions(scenario);
  if (dueAtDecision > campaignLength) throw new Error(`Consequence cannot be due after decision ${campaignLength}`);
}

function eventForDelayedEffect(decision: Decision, option: DecisionOption, effect: EffectRule, dueAtDecision: number): ScheduledEvent {
  return {
    id: materializedDelayedEventId(decision.id, option.id, effect.id),
    sourceDecisionId: decision.id,
    sourceOptionId: option.id,
    dueAtDecision,
    title: `Effet différé : ${decision.title}`,
    body: effect.explanation,
    effects: [immediateCopy(effect)],
  };
}

function dueAtDecisionForTiming(
  timing: Exclude<EffectRule["timing"], { kind: "immediate" }>,
  decisionCount: number,
  scenario: Scenario,
): number {
  return timing.kind === "after_decisions"
    ? decisionCount + timing.count
    : decisionCountAtMandateYearEnd(scenario, timing.year);
}

function implementationDueAtDecision(option: DecisionOption, decisionCount: number, scenario: Scenario): number {
  if (option.horizon.kind === "immediate") return decisionCount;
  return option.horizon.kind === "after_decisions"
    ? decisionCount + option.horizon.count
    : decisionCountAtMandateYearEnd(scenario, option.horizon.year);
}

/**
 * Applies one recorded occurrence of an effect. An `annual` effect changes the annual
 * run rate once, records that duration, and is never replayed on an implicit annual tick.
 */
export function applyEffect(state: CampaignState, effect: EffectRule, cause: EffectCause): CampaignState {
  assertEffectRule(effect);
  if (effect.timing.kind !== "immediate") throw new Error("Cannot apply a delayed effect directly");

  const appliedAtDecision = cause.appliedAtDecision ?? state.decisions.length;
  if (!Number.isInteger(appliedAtDecision) || appliedAtDecision < 0 || appliedAtDecision > state.decisions.length) {
    throw new Error("Effect application position must match the campaign history");
  }
  const causalEntry: CausalEntry = {
    id: `${cause.sourceType}:${cause.sourceId}:${effect.id}:${state.causalLedger.length + 1}`,
    sourceType: cause.sourceType,
    sourceId: cause.sourceId,
    target: effect.target,
    key: effect.key,
    delta: effect.delta,
    duration: effect.duration,
    explanation: effect.explanation,
    appliedAtDecision,
  };

  if (effect.target === "indicator") {
    const key = effect.key;
    const value = clampPoliticalIndicator(key, state.indicators[key] + effect.delta);
    return {
      ...state,
      indicators: { ...state.indicators, [key]: value },
      causalLedger: [...state.causalLedger, causalEntry],
    };
  }

  const key = effect.key;
  return {
    ...state,
    groups: { ...state.groups, [key]: Math.min(100, Math.max(0, state.groups[key] + effect.delta)) },
    causalLedger: [...state.causalLedger, causalEntry],
  };
}

/** Queues effects, explicit events and promises which follow the selected option. */
export function scheduleOptionConsequences(
  state: CampaignState,
  decision: Decision,
  option: DecisionOption,
  scenario: Scenario,
): CampaignState {
  const decisionCount = state.decisions.length;
  const delayedEffects: ScheduledEvent[] = [];
  for (const effect of option.effects) {
    assertEffectRule(effect);
    if (effect.timing.kind === "immediate") continue;
    const dueAtDecision = dueAtDecisionForTiming(effect.timing, decisionCount, scenario);
    assertDueAtDecision(dueAtDecision, scenario);
    delayedEffects.push(eventForDelayedEffect(decision, option, effect, dueAtDecision));
  }
  const explicitEvents: ScheduledEvent[] = option.scheduledEvents.map((event) => {
    const dueAtDecision = Math.max(
      decisionCount + event.afterDecisions,
      implementationDueAtDecision(option, decisionCount, scenario),
    );
    assertDueAtDecision(dueAtDecision, scenario);
    assertImmediateEffects(event.effects, "Scheduled event");
    return {
      id: event.id,
      sourceDecisionId: decision.id,
      sourceOptionId: option.id,
      dueAtDecision,
      title: event.title,
      body: event.body,
      effects: event.effects.map(immediateCopy),
    };
  });
  const promises: PoliticalPromise[] = option.promises.map((promise) => {
    const dueAtDecision = decisionCount + promise.dueAfterDecisions;
    assertDueAtDecision(dueAtDecision, scenario);
    assertImmediateEffects(promise.failureEffects, "Political promise");
    return {
      id: promise.id,
      sourceDecisionId: decision.id,
      sourceOptionId: option.id,
      label: promise.label,
      dueAtDecision,
      fulfilled: false,
      failureEffects: promise.failureEffects.map(immediateCopy),
    };
  });

  assertUniqueDisjointIds("event", state.scheduledEvents, state.eventHistory, [...delayedEffects, ...explicitEvents]);
  assertUniqueDisjointIds("promise", state.activePromises, state.promiseHistory, promises);

  if (delayedEffects.length === 0 && explicitEvents.length === 0 && promises.length === 0) return state;
  return {
    ...state,
    scheduledEvents: [...state.scheduledEvents, ...delayedEffects, ...explicitEvents],
    activePromises: [...state.activePromises, ...promises],
  };
}

function applyImmediateEffects(state: CampaignState, effects: readonly EffectRule[], cause: EffectCause): CampaignState {
  let applied = state;
  for (const effect of effects) {
    assertEffectRule(effect);
    if (effect.timing.kind === "immediate") applied = applyEffect(applied, effect, cause);
  }
  return applied;
}

function assertImmediateEffects(effects: readonly EffectRule[], label: string): void {
  for (const effect of effects) {
    assertEffectRule(effect);
    if (effect.timing.kind !== "immediate") throw new Error(`${label} effects must be immediate`);
  }
}

function assertUniqueDisjointIds(
  label: string,
  active: readonly { id: string }[],
  history: readonly { id: string }[],
  additions: readonly { id: string }[],
): void {
  const ids = [...active, ...history, ...additions].map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${label} ID`);
}

function budgetEffect(
  id: string,
  delta: number,
  duration: "once" | "annual",
  explanation: string,
): EffectRule {
  return {
    id,
    target: "indicator",
    key: "annualBalance",
    delta,
    timing: { kind: "immediate" },
    duration,
    explanation,
  };
}

function scheduledBudgetEvent(
  decision: Decision,
  option: DecisionOption,
  id: string,
  dueAtDecision: number,
  effect: EffectRule,
): ScheduledEvent {
  return {
    id,
    sourceDecisionId: decision.id,
    sourceOptionId: option.id,
    dueAtDecision,
    title: `Flux budgétaire : ${decision.title}`,
    body: effect.explanation,
    effects: [effect],
  };
}

/** Schedules V10 budget profiles without duplicating them in policy EffectRules. */
export function scheduleBudgetProfile(
  state: CampaignState,
  decision: Decision,
  option: DecisionOption,
  scenario: Scenario,
): CampaignState {
  const decisionCount = state.decisions.length;
  const sourceId = `${decision.id}:${option.id}`;
  let scheduled = state;
  const additions: ScheduledEvent[] = [];
  const alreadyReserved = (id: string): boolean => (
    scheduled.scheduledEvents.some((event) => event.id === id)
    || scheduled.eventHistory.some((event) => event.id === id)
    || scheduled.causalLedger.some((entry) => entry.id.startsWith(`decision:${sourceId}:${id}:`))
  );
  const queue = (id: string, dueAtDecision: number, effect: EffectRule) => {
    assertDueAtDecision(dueAtDecision, scenario);
    additions.push(scheduledBudgetEvent(decision, option, id, dueAtDecision, effect));
  };
  const applyOrQueue = (id: string, dueAtDecision: number, effect: EffectRule) => {
    if (alreadyReserved(id)) return;
    if (dueAtDecision === decisionCount) {
      scheduled = applyEffect(scheduled, effect, { sourceType: "decision", sourceId, appliedAtDecision: decisionCount });
    } else {
      queue(id, dueAtDecision, effect);
    }
  };

  const profile = option.budgetProfile;
  if (profile.runRateMillions !== 0 && profile.runRateTiming !== null) {
    const id = `${decision.id}:${option.id}:run-rate`;
    const dueAtDecision = profile.runRateTiming.kind === "immediate"
      ? decisionCount
      : profile.runRateTiming.kind === "after_decisions"
        ? decisionCount + profile.runRateTiming.count
        : decisionCountAtMandateYearEnd(scenario, profile.runRateTiming.year);
    applyOrQueue(id, dueAtDecision, budgetEffect(id, profile.runRateMillions, "annual", "Flux annuel sourcé du profil budgétaire."));
  }
  for (const flow of profile.transitionFlows) {
    const id = flow.id;
    const dueAtDecision = flow.timing.kind === "immediate"
      ? decisionCount
      : dueAtDecisionForTiming(flow.timing, decisionCount, scenario);
    applyOrQueue(id, dueAtDecision, budgetEffect(id, flow.amountMillions, "once", `Flux ponctuel sourcé : ${flow.id}.`));
  }
  assertUniqueDisjointIds("event", scheduled.scheduledEvents, scheduled.eventHistory, additions);
  return additions.length === 0 ? scheduled : { ...scheduled, scheduledEvents: [...scheduled.scheduledEvents, ...additions] };
}

/** Removes future consequences and neutralizes only the future annual run rate. */
export function reverseDecisionConsequences(state: CampaignState, decisionId: string): CampaignState {
  const record = state.decisions.find((decision) => decision.decisionId === decisionId);
  if (!record || record.status === "reversed") return state;
  const directSourceId = `${decisionId}:${record.optionId}`;
  const materializedEventIds = new Set(state.eventHistory
    .filter((event) => event.sourceDecisionId === decisionId)
    .map((event) => event.id));
  const activeAnnualRunRate = state.causalLedger
    .filter((entry) => entry.target === "indicator" && entry.key === "annualBalance" && entry.duration === "annual"
      && (entry.sourceId === directSourceId || materializedEventIds.has(entry.sourceId)))
    .reduce((sum, entry) => sum + entry.delta, 0);
  let reversed: CampaignState = {
    ...state,
    scheduledEvents: state.scheduledEvents.filter((event) => event.sourceDecisionId !== decisionId),
    activePromises: state.activePromises.filter((promise) => promise.sourceDecisionId !== decisionId),
    decisions: state.decisions.map((decision) => decision.decisionId === decisionId
      ? { ...decision, status: "reversed" as const }
      : decision),
  };
  if (activeAnnualRunRate !== 0) {
    const compensation = budgetEffect(
      `reverse:${decisionId}:run-rate`,
      -activeAnnualRunRate,
      "annual",
      "Neutralisation du flux annuel après révocation.",
    );
    reversed = applyEffect(reversed, compensation, {
      sourceType: "crisis",
      sourceId: `reverse:${decisionId}`,
      appliedAtDecision: state.decisions.length,
    });
  }
  return reversed;
}

function applyResolvedEffects(state: CampaignState, effects: readonly EffectRule[], cause: EffectCause): CampaignState {
  assertImmediateEffects(effects, "Resolved consequence");
  return effects.reduce((current, effect) => applyEffect(current, effect, cause), state);
}

function applyLocksAndUnlocks(state: CampaignState, option: DecisionOption): CampaignState {
  const confirmed = new Set(state.decisions.map((record) => record.decisionId));
  const locked = new Set(state.lockedDecisionIds.filter((id) => !confirmed.has(id)));
  const unlocked = new Set(state.unlockedDecisionIds.filter((id) => !confirmed.has(id)));
  for (const id of option.locks) {
    if (confirmed.has(id)) continue;
    locked.add(id);
    unlocked.delete(id);
  }
  for (const id of option.unlocks) {
    if (confirmed.has(id)) continue;
    locked.delete(id);
    unlocked.add(id);
  }
  return { ...state, lockedDecisionIds: [...locked], unlockedDecisionIds: [...unlocked] };
}

/** Confirms the current pending decision exactly once and materializes all its consequences. */
export function confirmSelection(state: CampaignState, scenario: Scenario): CampaignState {
  if (state.phase !== "decision" || !state.pendingSelection) throw new Error("A selection required before confirmation");
  const scenarioErrors = validateScenario(scenario, { allowConsequencesBeyondCampaign: scenario.version >= 10 });
  if (scenarioErrors.length > 0) throw new Error(`Invalid scenario: ${scenarioErrors.join(", ")}`);
  const decision = currentDecision(state, scenario);
  const { decisionId, optionId } = state.pendingSelection;
  if (!decision || decision.id !== decisionId) throw new Error("Pending selection does not match the current decision");
  const option = decision.options.find((candidate) => candidate.id === optionId);
  if (!option) throw new Error("Pending selection has an unknown option");
  if (state.decisions.some((record) => record.decisionId === decisionId)) throw new Error(`Decision already confirmed: ${decisionId}`);

  const confirmedAtIndex = state.decisions.length + 1;
  const indicatorsBefore = { ...state.indicators };
  const ledgerLengthBefore = state.causalLedger.length;
  const confirmed = {
    ...state,
    decisions: [...state.decisions, {
      decisionId,
      optionId,
      status: "confirmed" as const,
      confirmedAtIndex,
    }],
  };
  const directEffects = scenario.version >= 10
    ? option.effects.filter((effect) => !(effect.target === "indicator" && effect.key === "annualBalance"))
    : option.effects;
  const withImmediateEffects = applyImmediateEffects(confirmed, directEffects, {
    sourceType: "decision",
    sourceId: `${decisionId}:${optionId}`,
  });
  const withBudgetProfile = scenario.version >= 10
    ? scheduleBudgetProfile(withImmediateEffects, decision, option, scenario)
    : withImmediateEffects;
  const immediateCausalEntries = withBudgetProfile.causalLedger.slice(ledgerLengthBefore);
  const indicatorKeys = (Object.keys(INDICATOR_META) as IndicatorKey[])
    .filter((key) => withBudgetProfile.indicators[key] !== indicatorsBefore[key]);
  indicatorKeys.sort((left, right) => INDICATOR_META[right].priority - INDICATOR_META[left].priority);
  const impact = {
    decisionId,
    optionId,
    confirmedAtIndex,
    indicators: indicatorKeys.map((key) => ({
      key,
      before: indicatorsBefore[key],
      after: withBudgetProfile.indicators[key],
      delta: withBudgetProfile.indicators[key] - indicatorsBefore[key],
      causalEntryIds: immediateCausalEntries
        .filter((entry) => entry.target === "indicator" && entry.key === key)
        .map((entry) => entry.id),
    })),
  };
  const withImpact = {
    ...withBudgetProfile,
    decisions: withBudgetProfile.decisions.map((record, index) =>
      index === withBudgetProfile.decisions.length - 1 ? { ...record, impact } : record),
  };
  const withConsequences = scheduleOptionConsequences(withImpact, decision, option, scenario);
  const withFulfilledPromises = option.fulfillsPromises.length === 0
    ? withConsequences
    : {
      ...withConsequences,
      activePromises: withConsequences.activePromises.map((promise) =>
        option.fulfillsPromises.includes(promise.id) ? { ...promise, fulfilled: true } : promise,
      ),
    };
  return { ...clearSelection(applyLocksAndUnlocks(withFulfilledPromises, option)), phase: "decision_result" };
}

/** Applies every event due at the current decision count, then consumes it from the queue. */
export function resolveDueEvents(state: CampaignState): { state: CampaignState; events: ScheduledEvent[] } {
  state.scheduledEvents.forEach((event) => assertPositiveDueAtDecision(event.dueAtDecision));
  const decisionCount = state.decisions.length;
  const events = state.scheduledEvents.filter((event) => event.dueAtDecision <= decisionCount);
  const futureEvents = state.scheduledEvents.filter((event) => event.dueAtDecision > decisionCount);
  let resolved: CampaignState = {
    ...state,
    scheduledEvents: futureEvents,
    eventHistory: [...state.eventHistory, ...events],
  };
  for (const event of events) {
    resolved = applyResolvedEffects(resolved, event.effects, {
      sourceType: "event",
      sourceId: event.id,
    });
  }
  return { state: resolved, events };
}

/** Resolves due political promises, penalizing only the promises left unfulfilled. */
export function resolveDuePromises(state: CampaignState): { state: CampaignState; failedPromiseIds: string[] } {
  state.activePromises.forEach((promise) => assertPositiveDueAtDecision(promise.dueAtDecision));
  const decisionCount = state.decisions.length;
  const duePromises = state.activePromises.filter((promise) => promise.dueAtDecision <= decisionCount);
  const activePromises = state.activePromises.filter((promise) => promise.dueAtDecision > decisionCount);
  let resolved: CampaignState = duePromises.length === 0
    ? state
    : { ...state, activePromises, promiseHistory: [...state.promiseHistory, ...duePromises] };
  const failedPromiseIds: string[] = [];
  for (const promise of duePromises) {
    if (promise.fulfilled) continue;
    failedPromiseIds.push(promise.id);
    resolved = applyResolvedEffects(resolved, promise.failureEffects, { sourceType: "promise", sourceId: promise.id });
  }
  return { state: resolved, failedPromiseIds };
}
