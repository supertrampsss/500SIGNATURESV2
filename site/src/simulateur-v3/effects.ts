import { clearSelection, currentDecision } from "./campaign.ts";
import { validateScenario } from "./validation.ts";
import type {
  CampaignState,
  CausalEntry,
  Decision,
  DecisionOption,
  EffectRule,
  GroupKey,
  IndicatorKey,
  PoliticalPromise,
  Scenario,
  ScheduledEvent,
} from "./types.ts";

export type EffectCause = {
  sourceType: CausalEntry["sourceType"];
  sourceId: string;
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

function eventForDelayedEffect(decision: Decision, option: DecisionOption, effect: EffectRule, dueAtDecision: number): ScheduledEvent {
  return {
    id: `${decision.id}:${option.id}:${effect.id}`,
    sourceDecisionId: decision.id,
    sourceOptionId: option.id,
    dueAtDecision,
    title: `Effet différé : ${decision.title}`,
    body: effect.explanation,
    effects: [{ ...effect, timing: { kind: "immediate" } }],
  };
}

/** Applies one immediate effect and records the precise causal chain that produced it. */
export function applyEffect(state: CampaignState, effect: EffectRule, cause: EffectCause): CampaignState {
  if (!Number.isFinite(effect.delta)) throw new Error("Effect delta must be finite");
  if (effect.timing.kind !== "immediate") throw new Error("Cannot apply a delayed effect directly");

  const appliedAtDecision = state.decisions.length;
  const causalEntry: CausalEntry = {
    id: `${cause.sourceType}:${cause.sourceId}:${effect.id}:${state.causalLedger.length + 1}`,
    sourceType: cause.sourceType,
    sourceId: cause.sourceId,
    target: effect.target,
    key: effect.key,
    delta: effect.delta,
    explanation: effect.explanation,
    appliedAtDecision,
  };

  if (effect.target === "indicator") {
    const key = effect.key as IndicatorKey;
    const value = clampPoliticalIndicator(key, state.indicators[key] + effect.delta);
    return {
      ...state,
      indicators: { ...state.indicators, [key]: value },
      causalLedger: [...state.causalLedger, causalEntry],
    };
  }

  const key = effect.key as GroupKey;
  return {
    ...state,
    groups: { ...state.groups, [key]: Math.min(100, Math.max(0, state.groups[key] + effect.delta)) },
    causalLedger: [...state.causalLedger, causalEntry],
  };
}

/** Queues effects, explicit events and promises which follow the selected option. */
export function scheduleOptionConsequences(state: CampaignState, decision: Decision, option: DecisionOption): CampaignState {
  const decisionCount = state.decisions.length;
  const delayedEffects = option.effects.flatMap((effect) =>
    effect.timing.kind === "after_decisions"
      ? [eventForDelayedEffect(decision, option, effect, decisionCount + effect.timing.count)]
      : [],
  );
  const explicitEvents: ScheduledEvent[] = option.scheduledEvents.map((event) => ({
    id: event.id,
    sourceDecisionId: decision.id,
    sourceOptionId: option.id,
    dueAtDecision: decisionCount + event.afterDecisions,
    title: event.title,
    body: event.body,
    effects: [...event.effects],
  }));
  const promises: PoliticalPromise[] = option.promises.map((promise) => ({
    id: promise.id,
    sourceDecisionId: decision.id,
    label: promise.label,
    dueAtDecision: decisionCount + promise.dueAfterDecisions,
    fulfilled: false,
    failureEffects: [...promise.failureEffects],
  }));

  assertImmediateEffects(explicitEvents.flatMap((event) => event.effects), "Scheduled event");
  assertImmediateEffects(promises.flatMap((promise) => promise.failureEffects), "Political promise");
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
  return effects.reduce(
    (current, effect) => effect.timing.kind === "immediate" ? applyEffect(current, effect, cause) : current,
    state,
  );
}

function assertImmediateEffects(effects: readonly EffectRule[], label: string): void {
  if (effects.some((effect) => effect.timing.kind !== "immediate")) {
    throw new Error(`${label} effects must be immediate`);
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

function applyResolvedEffects(state: CampaignState, effects: readonly EffectRule[], cause: EffectCause): CampaignState {
  assertImmediateEffects(effects, "Resolved consequence");
  return effects.reduce((current, effect) => applyEffect(current, effect, cause), state);
}

function applyLocksAndUnlocks(state: CampaignState, option: DecisionOption): CampaignState {
  if (option.locks.length === 0 && option.unlocks.length === 0) return state;
  const locked = new Set(state.lockedDecisionIds);
  const unlocked = new Set(state.unlockedDecisionIds);
  for (const id of option.locks) {
    locked.add(id);
    unlocked.delete(id);
  }
  for (const id of option.unlocks) {
    locked.delete(id);
    unlocked.add(id);
  }
  return { ...state, lockedDecisionIds: [...locked], unlockedDecisionIds: [...unlocked] };
}

/** Confirms the current pending decision exactly once and materializes all its consequences. */
export function confirmSelection(state: CampaignState, scenario: Scenario): CampaignState {
  if (state.phase !== "decision" || !state.pendingSelection) throw new Error("A selection required before confirmation");
  const scenarioErrors = validateScenario(scenario);
  if (scenarioErrors.length > 0) throw new Error(`Invalid scenario: ${scenarioErrors.join(", ")}`);
  const decision = currentDecision(state, scenario);
  const { decisionId, optionId } = state.pendingSelection;
  if (!decision || decision.id !== decisionId) throw new Error("Pending selection does not match the current decision");
  const option = decision.options.find((candidate) => candidate.id === optionId);
  if (!option) throw new Error("Pending selection has an unknown option");
  if (state.decisions.some((record) => record.decisionId === decisionId)) throw new Error(`Decision already confirmed: ${decisionId}`);

  const confirmed = {
    ...state,
    decisions: [...state.decisions, {
      decisionId,
      optionId,
      status: "confirmed" as const,
      confirmedAtIndex: state.decisions.length + 1,
    }],
  };
  const withImmediateEffects = applyImmediateEffects(confirmed, option.effects, {
    sourceType: "decision",
    sourceId: `${decisionId}:${optionId}`,
  });
  const withConsequences = scheduleOptionConsequences(withImmediateEffects, decision, option);
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
