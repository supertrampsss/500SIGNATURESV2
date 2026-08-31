import { DILEMMES } from "../dilemmes.ts";
import { MESURES, type Soutien } from "../mesures.ts";
import { policyEvidence, type PolicySourceKey } from "./policy-sources.ts";
import {
  V3_MODELED_EFFECT_MARKER,
  type Decision,
  type DecisionKind,
  type DecisionOption,
  type EffectRule,
  type GroupKey,
  type IndicatorKey,
  type PromiseRule,
  type ScheduledEventRule,
  type Uncertainty,
} from "./types.ts";

export type PolicyOptionDefinition = {
  id: string;
  label: string;
  summary: string;
  budgetDelta: number;
  beneficiaries: string[];
  contributors: string[];
  uncertainty?: Uncertainty;
  indicatorEffects?: Partial<Record<IndicatorKey, number>>;
  groupEffects?: Partial<Record<GroupKey, number>>;
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
  conflicts?: string[];
  dependencies?: string[];
  event?: ScheduledEventRule;
};

const MEASURES_BY_ID = new Map(MESURES.map((measure) => [measure.id, measure]));
let registeredCatalogue: readonly Decision[] = [];

export function registerPolicyCatalogue(decisions: readonly Decision[]): void {
  registeredCatalogue = decisions;
}

function clean(value: string): string {
  return value.replaceAll("\u2014", ":").replace(/\s+/g, " ").trim();
}

function effect(id: string, target: "indicator", key: IndicatorKey, delta: number, explanation: string): EffectRule;
function effect(id: string, target: "group", key: GroupKey, delta: number, explanation: string): EffectRule;
function effect(id: string, target: "indicator" | "group", key: IndicatorKey | GroupKey, delta: number, explanation: string): EffectRule {
  return {
    id,
    target,
    key,
    delta,
    timing: { kind: "immediate" },
    duration: key === "annualBalance" ? "annual" : "once",
    explanation: clean(explanation),
  } as EffectRule;
}

function supportEffects(decisionId: string, optionId: string, reactions: Partial<Record<Soutien, number>>): EffectRule[] {
  return Object.entries(reactions).flatMap(([support, delta]) => {
    const value = delta as number;
    const direct = support === "opinion"
      ? effect(`${decisionId}:${optionId}:opinion`, "indicator", "opinion", value, "Hypothèse de jeu sur l'opinion.")
      : support === "marches"
        ? effect(`${decisionId}:${optionId}:markets`, "indicator", "financialCredibility", value, "Hypothèse de jeu sur la crédibilité financière.")
        : support === "entreprises"
          ? effect(`${decisionId}:${optionId}:businesses`, "group", "businesses", value, "Hypothèse de jeu sur les entreprises.")
          : effect(`${decisionId}:${optionId}:territories`, "group", "localAuthorities", value, "Hypothèse de jeu sur les collectivités.");
    const modeled = support === "opinion"
      ? effect(`${decisionId}:${optionId}${V3_MODELED_EFFECT_MARKER}majority`, "indicator", "majority", Math.sign(value) * Math.max(1, Math.round(Math.abs(value) / 2)), "Hypothèse de jeu sur la majorité.")
      : support === "entreprises"
        ? effect(`${decisionId}:${optionId}${V3_MODELED_EFFECT_MARKER}growth`, "indicator", "growth", Math.round(value * 0.015 * 1_000) / 1_000, "Hypothèse de jeu sur la croissance.")
        : support === "marches"
          ? effect(`${decisionId}:${optionId}${V3_MODELED_EFFECT_MARKER}growth`, "indicator", "growth", Math.round(value * 0.01 * 1_000) / 1_000, "Hypothèse de jeu sur les conditions de financement.")
          : effect(`${decisionId}:${optionId}${V3_MODELED_EFFECT_MARKER}services`, "indicator", "publicServices", Math.sign(value) * Math.max(1, Math.round(Math.abs(value) / 2)), "Hypothèse de jeu sur les services publics locaux.");
    return [direct, modeled];
  });
}

function compiledOption(decisionId: string, definition: PolicyOptionDefinition): DecisionOption {
  const effects: EffectRule[] = [];
  if (definition.budgetDelta !== 0) {
    effects.push(effect(`${decisionId}:${definition.id}:budget`, "indicator", "annualBalance", definition.budgetDelta, `Effet annuel retenu par le jeu : ${definition.budgetDelta} millions d'euros.`));
  }
  for (const [key, delta] of Object.entries(definition.indicatorEffects ?? {})) {
    effects.push(effect(`${decisionId}:${definition.id}${V3_MODELED_EFFECT_MARKER}${key}`, "indicator", key as IndicatorKey, delta as number, `Hypothèse de jeu sur l'indicateur ${key}.`));
  }
  for (const [key, delta] of Object.entries(definition.groupEffects ?? {})) {
    effects.push(effect(`${decisionId}:${definition.id}${V3_MODELED_EFFECT_MARKER}${key}`, "group", key as GroupKey, delta as number, `Hypothèse de jeu sur le groupe ${key}.`));
  }
  if (effects.length === 0 && !(definition.scheduledEvents?.length)) {
    effects.push(effect(`${decisionId}:${definition.id}${V3_MODELED_EFFECT_MARKER}capacity`, "indicator", "reformCapacity", definition.id === "adopt" ? 1 : -1, "Hypothèse de jeu sur la capacité de réforme."));
  }
  return {
    id: `${decisionId}:${definition.id}`,
    label: clean(definition.label),
    summary: clean(definition.summary),
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

export function policyDecision(definition: PolicyDecisionDefinition): Decision {
  if (!definition.context.trim() || !definition.title.trim() || !definition.evidenceLabel.trim()) {
    throw new Error(`Dossier éditorial incomplet : ${definition.id}`);
  }
  if (definition.sourceKeys.length === 0) throw new Error(`Source absente : ${definition.id}`);
  const options = definition.options.map((option) => compiledOption(definition.id, option));
  if (options.some((option) => !option.label || !option.summary)) throw new Error(`Option incomplète : ${definition.id}`);
  return {
    id: definition.id,
    version: 2,
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
    conflicts: definition.conflicts ?? [],
  };
}

export function existingPolicy(copy: ExistingPolicyCopy): PolicyDecisionDefinition {
  const measure = MEASURES_BY_ID.get(copy.id);
  if (!measure) throw new Error(`Mesure inconnue : ${copy.id}`);
  const editorial = DILEMMES[copy.id];
  const conflicts = [...new Set([
    ...(copy.conflicts ?? []),
    ...(measure.exclut ?? []),
    ...MESURES.filter((candidate) => candidate.exclut?.includes(copy.id)).map((candidate) => candidate.id),
  ])];
  const adoptReactions = measure.reactions ?? {};
  const keepReactions = measure.rejet ?? Object.fromEntries(Object.entries(adoptReactions).map(([key, value]) => [key, -Math.sign(value) * Math.max(1, Math.ceil(Math.abs(value) / 3))]));
  const adoptEffects = supportEffects(copy.id, "adopt", adoptReactions);
  const keepEffects = supportEffects(copy.id, "keep", keepReactions);
  const toMaps = (rules: EffectRule[]) => ({
    indicatorEffects: Object.fromEntries(rules.filter((rule) => rule.target === "indicator").map((rule) => [rule.key, rule.delta])) as Partial<Record<IndicatorKey, number>>,
    groupEffects: Object.fromEntries(rules.filter((rule) => rule.target === "group").map((rule) => [rule.key, rule.delta])) as Partial<Record<GroupKey, number>>,
  });
  return {
    id: copy.id,
    chapterId: copy.chapterId,
    kind: copy.kind,
    title: clean(copy.title ?? editorial?.question ?? `${measure.titre.replace(/[.?!]+$/, "")} ?`),
    context: clean(copy.context ?? editorial?.contradiction ?? measure.detail),
    sourceKeys: copy.sourceKeys,
    evidenceLabel: clean(measure.detail),
    evidenceNote: measure.precision ? clean(measure.precision) : undefined,
    dependencies: copy.dependencies,
    conflicts,
    options: [
      {
        id: "adopt",
        label: clean(copy.adoptLabel ?? editorial?.adopter.libelle ?? measure.titre),
        summary: copy.adoptSummary,
        budgetDelta: measure.effet,
        beneficiaries: copy.beneficiaries,
        contributors: copy.contributors,
        uncertainty: measure.precision ? "forte" : "moyenne",
        ...toMaps(adoptEffects),
        locks: conflicts,
        scheduledEvents: copy.event ? [copy.event] : [],
      },
      {
        id: "keep",
        label: copy.keepLabel,
        summary: copy.keepSummary,
        budgetDelta: 0,
        beneficiaries: copy.contributors,
        contributors: copy.beneficiaries,
        uncertainty: measure.precision ? "forte" : "moyenne",
        ...toMaps(keepEffects),
      },
    ],
  };
}

export function standalonePolicy(definition: PolicyDecisionDefinition): PolicyDecisionDefinition {
  return definition;
}

export function policyById(id: string): Decision | undefined {
  return registeredCatalogue.find((decision) => decision.id === id);
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
    effects: [effect(`${id}:effect`, "indicator", indicator, delta, `Conséquence différée du dossier ${id}.`)],
  };
}
