import { DILEMMES } from "../dilemmes.ts";
import { MESURES } from "../mesures.ts";
import { INDICATOR_META } from "./indicator-meta.ts";
import { policyConsequence, type ExplicitEffect } from "./policy-consequences.ts";
import { policyEvidence, type PolicySourceKey } from "./policy-sources.ts";
import type {
  Decision,
  DecisionKind,
  DecisionOption,
  EffectRule,
  GroupKey,
  IndicatorKey,
  PolicyHorizon,
  PromiseRule,
  ScheduledEventRule,
  Uncertainty,
} from "./types.ts";

export type PolicyOptionDefinition = {
  id: string;
  label: string;
  summary: string;
  mechanism: string;
  horizon: PolicyHorizon;
  legalConstraints: string[];
  budgetDelta: number;
  budgetDuration: "annual" | "once";
  beneficiaries: string[];
  contributors: string[];
  uncertainty?: Uncertainty;
  indicatorEffects: Partial<Record<IndicatorKey, ExplicitEffect>>;
  groupEffects: Partial<Record<GroupKey, ExplicitEffect>>;
  locks?: string[];
  unlocks?: string[];
  scheduledEvents?: ScheduledEventRule[];
  promises?: PromiseRule[];
  fulfillsPromises?: string[];
};

export type PolicyDecisionDefinition = {
  id: string;
  chapterId: string;
  kind: DecisionKind;
  title: string;
  context: string;
  options: PolicyOptionDefinition[];
  sourceKeys: PolicySourceKey[];
  evidenceLabel: string;
  evidenceNote?: string;
  dependencies?: string[];
  conflicts?: string[];
};

/** Catalogue inventory only; causal fields live exclusively in policy-consequences.ts. */
type PolicyOptionDraft = Omit<PolicyOptionDefinition,
  | "mechanism"
  | "horizon"
  | "legalConstraints"
  | "budgetDuration"
  | "indicatorEffects"
  | "groupEffects"
  | "locks"
  | "unlocks"
  | "scheduledEvents"
  | "promises"
  | "fulfillsPromises"
>;

type PolicyDecisionDraft = Omit<PolicyDecisionDefinition, "options"> & { options: PolicyOptionDraft[] };

export type ExistingPolicyCopy = {
  id: string;
  chapterId: string;
  kind: DecisionKind;
  title?: string;
  context?: string;
  adoptLabel?: string;
  adoptSummary: string;
  keepLabel: string;
  keepSummary: string;
  beneficiaries: string[];
  contributors: string[];
  sourceKeys: PolicySourceKey[];
};

export type OptionDistanceDimension =
  | "budget"
  | "indicators"
  | "groups"
  | "horizon"
  | "stakeholders"
  | "legal_constraints"
  | "locks"
  | "uncertainty"
  | "commitments";

const MEASURES_BY_ID = new Map(MESURES.map((measure) => [measure.id, measure]));
const GROUP_STAKEHOLDER_LABELS: Record<GroupKey, string> = {
  lowIncomeHouseholds: "ménages modestes",
  middleClasses: "classes moyennes",
  retirees: "retraités",
  publicEmployees: "agents publics",
  privateEmployees: "salariés du privé",
  unions: "syndicats",
  businesses: "entreprises",
  farmers: "agriculteurs",
  localAuthorities: "collectivités territoriales",
  creditors: "créanciers publics",
  europeanPartners: "partenaires européens",
  parliamentaryMajority: "majorité parlementaire",
};

function clean(value: string): string {
  return value.replaceAll("\u2014", ":").replace(/\s+/g, " ").trim();
}

function validHorizon(horizon: PolicyHorizon): boolean {
  return horizon.kind === "immediate"
    || (horizon.kind === "after_decisions" && Number.isInteger(horizon.count) && horizon.count > 0)
    || (horizon.kind === "mandate_year" && Number.isInteger(horizon.year) && horizon.year >= 1 && horizon.year <= 5);
}

function explicitValue(value: ExplicitEffect): Exclude<ExplicitEffect, number> {
  return typeof value === "number" ? { delta: value } : value;
}

function effect(
  id: string,
  target: "indicator" | "group",
  key: IndicatorKey | GroupKey,
  value: ExplicitEffect,
  mechanism: string,
  defaultTiming: EffectRule["timing"] = { kind: "immediate" },
): EffectRule {
  const declared = explicitValue(value);
  return {
    id,
    target,
    key,
    delta: declared.delta,
    timing: declared.timing ?? defaultTiming,
    duration: declared.duration ?? "once",
    explanation: clean(declared.explanation ?? mechanism),
  } as EffectRule;
}

function consequenceTiming(horizon: PolicyHorizon): EffectRule["timing"] {
  return horizon.kind === "after_decisions"
    ? { kind: "after_decisions", count: horizon.count }
    : { kind: "immediate" };
}

function compiledOption(decisionId: string, definition: PolicyOptionDefinition): DecisionOption {
  if (!definition.mechanism.trim()) throw new Error(`Mécanisme absent : ${decisionId}:${definition.id}`);
  if (!validHorizon(definition.horizon)) throw new Error(`Horizon invalide : ${decisionId}:${definition.id}`);
  if (!Array.isArray(definition.legalConstraints)) throw new Error(`Contraintes absentes : ${decisionId}:${definition.id}`);
  const mechanism = clean(definition.mechanism);
  const effects: EffectRule[] = [];
  if (definition.budgetDelta !== 0) {
    effects.push(effect(
      `${decisionId}:${definition.id}:indicator:annualBalance`,
      "indicator",
      "annualBalance",
      { delta: definition.budgetDelta, duration: definition.budgetDuration },
      `${mechanism} Impact budgétaire retenu par le jeu : ${definition.budgetDelta} millions d'euros.`,
    ));
  }
  for (const [key, value] of Object.entries(definition.indicatorEffects)) {
    effects.push(effect(
      `${decisionId}:${definition.id}:indicator:${key}`,
      "indicator",
      key as IndicatorKey,
      value as ExplicitEffect,
      mechanism,
      consequenceTiming(definition.horizon),
    ));
  }
  for (const [key, value] of Object.entries(definition.groupEffects)) {
    effects.push(effect(
      `${decisionId}:${definition.id}:group:${key}`,
      "group",
      key as GroupKey,
      value as ExplicitEffect,
      mechanism,
      consequenceTiming(definition.horizon),
    ));
  }
  if (!effects.some((rule) => !(rule.target === "indicator" && rule.key === "annualBalance"))) {
    throw new Error(`Effet non budgétaire absent : ${decisionId}:${definition.id}`);
  }
  return {
    id: `${decisionId}:${definition.id}`,
    label: clean(definition.label),
    summary: clean(definition.summary),
    mechanism,
    horizon: definition.horizon,
    legalConstraints: definition.legalConstraints.map(clean),
    budgetDuration: definition.budgetDuration,
    beneficiaries: definition.beneficiaries.map(clean),
    contributors: definition.contributors.map(clean),
    uncertainty: definition.uncertainty ?? "moyenne",
    effects,
    scheduledEvents: definition.scheduledEvents ?? [],
    promises: definition.promises ?? [],
    fulfillsPromises: definition.fulfillsPromises ?? [],
    locks: definition.locks ?? [],
    unlocks: definition.unlocks ?? [],
  };
}

function consequenceGroupStakeholders(consequence: ReturnType<typeof policyConsequence>): {
  beneficiaries: string[];
  contributors: string[];
} {
  const entries = Object.entries(consequence.groupEffects) as [GroupKey, ExplicitEffect][];
  const beneficiaries = entries
    .filter(([, value]) => explicitValue(value).delta > 0)
    .map(([key]) => GROUP_STAKEHOLDER_LABELS[key]);
  const contributors = entries
    .filter(([, value]) => explicitValue(value).delta < 0)
    .map(([key]) => GROUP_STAKEHOLDER_LABELS[key]);
  return {
    beneficiaries: beneficiaries.length > 0 ? beneficiaries : ["continuité du dispositif"],
    contributors: contributors.length > 0 ? contributors : ["marges de réforme non mobilisées"],
  };
}

function consequenceOption(
  decisionId: string,
  draft: PolicyOptionDraft,
  useConsequenceStakeholders = false,
): PolicyOptionDefinition {
  const consequence = policyConsequence(decisionId, draft.id);
  const stakeholders = useConsequenceStakeholders
    ? consequenceGroupStakeholders(consequence)
    : { beneficiaries: draft.beneficiaries, contributors: draft.contributors };
  return {
    ...draft,
    ...stakeholders,
    mechanism: consequence.mechanism,
    horizon: consequence.horizon,
    legalConstraints: consequence.legalConstraints,
    budgetDuration: consequence.budgetDuration,
    indicatorEffects: consequence.indicatorEffects,
    groupEffects: consequence.groupEffects,
    uncertainty: consequence.uncertainty ?? draft.uncertainty,
    locks: consequence.locks,
    unlocks: consequence.unlocks,
    scheduledEvents: consequence.scheduledEvents ?? [],
    promises: [],
    fulfillsPromises: [],
  };
}

export function policyDecision(definition: PolicyDecisionDefinition): Decision {
  if (!definition.context.trim() || !definition.title.trim() || !definition.evidenceLabel.trim()) {
    throw new Error(`Dossier éditorial incomplet : ${definition.id}`);
  }
  if (definition.sourceKeys.length === 0) throw new Error(`Source absente : ${definition.id}`);
  const options = definition.options.map((option) => compiledOption(definition.id, option));
  if (options.some((option) => !option.label || !option.summary)) throw new Error(`Option incomplète : ${definition.id}`);
  return {
    id: definition.id,
    version: 3,
    kind: definition.kind,
    chapterId: definition.chapterId,
    title: clean(definition.title),
    context: clean(definition.context),
    options,
    evidence: policyEvidence(definition.sourceKeys, clean(definition.evidenceLabel)).map((item) => ({
      ...item,
      ...(definition.evidenceNote ? { note: clean(definition.evidenceNote) } : {}),
    })),
    dependencies: definition.dependencies ?? [],
    conflicts: [...new Set([...(definition.conflicts ?? []), ...options.flatMap((option) => option.locks)])],
  };
}

export function existingPolicy(copy: ExistingPolicyCopy): PolicyDecisionDefinition {
  const measure = MEASURES_BY_ID.get(copy.id);
  if (!measure) throw new Error(`Mesure inconnue : ${copy.id}`);
  const editorial = DILEMMES[copy.id];
  const uncertainty = measure.precision ? "forte" as const : "moyenne" as const;
  return {
    id: copy.id,
    chapterId: copy.chapterId,
    kind: copy.kind,
    title: clean(copy.title ?? editorial?.question ?? `${measure.titre.replace(/[.?!]+$/, "")} ?`),
    context: clean(copy.context ?? editorial?.contradiction ?? measure.detail),
    sourceKeys: copy.sourceKeys,
    evidenceLabel: clean(measure.detail),
    evidenceNote: measure.precision ? clean(measure.precision) : undefined,
    dependencies: [],
    conflicts: [],
    options: [
      consequenceOption(copy.id, {
        id: "adopt",
        label: clean(copy.adoptLabel ?? editorial?.adopter.libelle ?? measure.titre),
        summary: copy.adoptSummary,
        budgetDelta: measure.effet,
        beneficiaries: copy.beneficiaries,
        contributors: copy.contributors,
        uncertainty,
      }),
      consequenceOption(copy.id, {
        id: "keep",
        label: copy.keepLabel,
        summary: copy.keepSummary,
        budgetDelta: 0,
        beneficiaries: [],
        contributors: [],
        uncertainty,
      }, true),
    ],
  };
}

export function standalonePolicy(definition: PolicyDecisionDraft): PolicyDecisionDefinition {
  return {
    ...definition,
    dependencies: [],
    conflicts: [],
    options: definition.options.map((option) => consequenceOption(definition.id, option)),
  };
}

export function delayedEvent(
  id: string,
  title: string,
  body: string,
  afterDecisions: number,
  indicator: IndicatorKey,
  delta: number,
): ScheduledEventRule {
  return {
    id,
    title: clean(title),
    body: clean(body),
    afterDecisions,
    effects: [effect(`${id}:indicator:${indicator}`, "indicator", indicator, delta, `Conséquence différée du dossier ${id}.`)],
  };
}

function normalizedStrings(values: readonly string[]): string[] {
  return [...new Set(values.map(clean).filter(Boolean))].sort((left, right) => left.localeCompare(right, "fr"));
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function aggregateEffects(option: DecisionOption, target: "indicator" | "group", includeBudget: boolean): Map<string, number> {
  const result = new Map<string, number>();
  for (const rule of option.effects) {
    if (rule.target !== target || (!includeBudget && rule.target === "indicator" && rule.key === "annualBalance")) continue;
    result.set(rule.key, (result.get(rule.key) ?? 0) + rule.delta);
  }
  return result;
}

function effectProfilesDiffer(
  left: Map<string, number>,
  right: Map<string, number>,
  epsilonFor: (key: string) => number,
): boolean {
  const keys = new Set([...left.keys(), ...right.keys()]);
  return [...keys].some((key) => Math.abs((left.get(key) ?? 0) - (right.get(key) ?? 0)) >= epsilonFor(key));
}

function normalizedJsonList(values: readonly unknown[]): unknown[] {
  return [...new Set(values.map((value) => JSON.stringify(value)))]
    .sort((left, right) => left.localeCompare(right, "fr"))
    .map((value) => JSON.parse(value) as unknown);
}

function normalizedCommitmentEffects(rules: readonly EffectRule[]): unknown[] {
  return normalizedJsonList(rules.map((rule) => [
    clean(rule.id),
    rule.target,
    rule.key,
    rule.delta,
    rule.duration,
    rule.timing.kind === "after_decisions" ? [rule.timing.kind, rule.timing.count] : [rule.timing.kind],
  ]));
}

function commitmentProfile(option: DecisionOption): unknown {
  return {
    events: normalizedJsonList(option.scheduledEvents.map((item) => ({
      id: clean(item.id),
      afterDecisions: item.afterDecisions,
      effects: normalizedCommitmentEffects(item.effects),
    }))),
    promises: normalizedJsonList(option.promises.map((item) => ({
      id: clean(item.id),
      dueAfterDecisions: item.dueAfterDecisions,
      failureEffects: normalizedCommitmentEffects(item.failureEffects),
    }))),
    fulfillsPromises: normalizedStrings(option.fulfillsPromises),
  };
}

export function optionDistanceDimensions(a: DecisionOption, b: DecisionOption): OptionDistanceDimension[] {
  const dimensions: OptionDistanceDimension[] = [];
  const aBudget = aggregateEffects(a, "indicator", true).get("annualBalance") ?? 0;
  const bBudget = aggregateEffects(b, "indicator", true).get("annualBalance") ?? 0;
  if (Math.abs(aBudget - bBudget) >= INDICATOR_META.annualBalance.epsilon || a.budgetDuration !== b.budgetDuration) dimensions.push("budget");
  if (effectProfilesDiffer(
    aggregateEffects(a, "indicator", false),
    aggregateEffects(b, "indicator", false),
    (key) => INDICATOR_META[key as IndicatorKey].epsilon,
  )) dimensions.push("indicators");
  if (effectProfilesDiffer(aggregateEffects(a, "group", true), aggregateEffects(b, "group", true), () => 1)) dimensions.push("groups");
  if (!sameJson(a.horizon, b.horizon)) dimensions.push("horizon");
  if (!sameJson(
    [normalizedStrings(a.beneficiaries), normalizedStrings(a.contributors)],
    [normalizedStrings(b.beneficiaries), normalizedStrings(b.contributors)],
  )) dimensions.push("stakeholders");
  if (!sameJson(normalizedStrings(a.legalConstraints), normalizedStrings(b.legalConstraints))) dimensions.push("legal_constraints");
  if (!sameJson(
    [normalizedStrings(a.locks), normalizedStrings(a.unlocks)],
    [normalizedStrings(b.locks), normalizedStrings(b.unlocks)],
  )) dimensions.push("locks");
  if (a.uncertainty !== b.uncertainty) dimensions.push("uncertainty");
  if (!sameJson(commitmentProfile(a), commitmentProfile(b))) dimensions.push("commitments");
  return dimensions;
}
