import { initialIndicators } from "./campaign.ts";
import { INDICATOR_META } from "./indicator-meta.ts";
import type {
  CampaignState,
  CausalEntry,
  CrisisRule,
  DecisionOption,
  DecisionStatus,
  IndicatorKey,
  IndicatorState,
  Scenario,
} from "./types.ts";

export type VerdictSignal = {
  key: "growth" | "majority" | "opinion";
  label: string;
  value: number;
  initialValue: number;
  delta: number;
  descriptor: string;
};

export type VerdictCheckpoint = {
  decisionCount: number;
  label: string;
  annualBalance: number;
  majority: number;
};

export type VerdictStructuralEffect = {
  target: "indicator" | "group";
  key: string;
  label: string;
  delta: number;
};

export type VerdictChoice = {
  rank: number;
  decisionId: string;
  label: string;
  chapter: string;
  budgetDelta: number;
  budgetDuration: "annual" | "once";
  structuralEffect?: VerdictStructuralEffect;
  status: string;
};

export type VerdictAftermath = {
  kind: "crisis" | "policy";
  title: string;
  detail: string;
  status?: string;
};

export type MandateVerdictViewModel = {
  headline: string;
  summary: string;
  annualBalance: number;
  annualBalanceDelta: number;
  target: number;
  score: number;
  remaining: number;
  surplus: number;
  signals: VerdictSignal[];
  trajectory: VerdictCheckpoint[];
  decisiveChoices: VerdictChoice[];
  aftermath: VerdictAftermath[];
};

const CLAMPED_INDICATORS = new Set<IndicatorKey>([
  "publicServices",
  "majority",
  "reformCapacity",
  "opinion",
  "institutionalTrust",
  "financialCredibility",
]);

const GROUP_EFFECT_LABELS: Record<string, string> = {
  lowIncomeHouseholds: "Ménages modestes",
  middleClasses: "Classes moyennes",
  retirees: "Retraités",
  publicEmployees: "Agents publics",
  privateEmployees: "Salariés du privé",
  unions: "Syndicats",
  businesses: "Entreprises",
  farmers: "Agriculteurs",
  localAuthorities: "Territoires",
  creditors: "Créanciers",
  europeanPartners: "Partenaires européens",
  parliamentaryMajority: "Majorité parlementaire",
};

const STATUS_LABELS: Record<DecisionStatus, string> = {
  confirmed: "En vigueur",
  suspended: "Suspendue",
  amended: "Amendée",
  reversed: "Renversée",
  superseded: "Sans objet",
};

function clampIndicator(key: IndicatorKey, value: number): number {
  return CLAMPED_INDICATORS.has(key) ? Math.min(100, Math.max(0, value)) : value;
}

function orderedLedger(ledger: readonly CausalEntry[]): CausalEntry[] {
  return ledger
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => left.entry.appliedAtDecision - right.entry.appliedAtDecision || left.index - right.index)
    .map(({ entry }) => entry);
}

function reconstructAt(state: CampaignState, decisionCount: number): IndicatorState {
  const indicators: IndicatorState = initialIndicators(state.baseline);
  for (const entry of orderedLedger(state.causalLedger)) {
    if (entry.appliedAtDecision > decisionCount || entry.target !== "indicator") continue;
    const key = entry.key as IndicatorKey;
    indicators[key] = clampIndicator(key, indicators[key] + entry.delta);
  }
  return indicators;
}

function descriptorFor(key: VerdictSignal["key"], value: number): string {
  if (key === "growth") {
    if (value < 0) return "Croissance nominale négative";
    if (value < 1) return "Croissance nominale faible";
    if (value < 2) return "Croissance nominale modérée";
    return "Croissance nominale soutenue";
  }
  if (key === "majority") {
    if (value < 35) return "Pouvoir très fragile";
    if (value < 50) return "Pouvoir minoritaire";
    if (value < 65) return "Majorité étroite";
    return "Majorité solide";
  }
  if (value < 35) return "Rejet net";
  if (value < 50) return "Pays contestataire";
  if (value < 65) return "Opinion partagée";
  return "Opinion favorable";
}

function buildSignals(state: CampaignState): VerdictSignal[] {
  const initial = initialIndicators(state.baseline);
  return ([
    ["growth", "Croissance"],
    ["majority", "Pouvoir"],
    ["opinion", "Opinion"],
  ] as const).map(([key, label]) => ({
    key,
    label,
    value: state.indicators[key],
    initialValue: initial[key],
    delta: state.indicators[key] - initial[key],
    descriptor: descriptorFor(key, state.indicators[key]),
  }));
}

function buildTrajectory(state: CampaignState): VerdictCheckpoint[] {
  return state.annualCheckpoints.map((checkpoint) => ({
    decisionCount: checkpoint.afterDecisionCount,
    label: checkpoint.year === 5 ? "Verdict final" : `Fin de l'année ${checkpoint.year}`,
    annualBalance: checkpoint.annualBalance,
    majority: checkpoint.year === 5
      ? state.indicators.majority
      : reconstructAt(state, checkpoint.afterDecisionCount).majority,
  }));
}

type VerdictBudgetImpact = {
  delta: number;
  duration: "annual" | "once";
};

function legacyBudgetImpact(option: DecisionOption): VerdictBudgetImpact {
  const effects = option.effects.filter((effect) => effect.target === "indicator" && effect.key === "annualBalance");
  return {
    delta: effects.reduce((sum, effect) => sum + effect.delta, 0),
    duration: effects[0]?.duration === "once" ? "once" : "annual",
  };
}

function v10BudgetImpact(option: DecisionOption): VerdictBudgetImpact {
  const profile = option.budgetProfile;
  if (profile.runRateMillions !== 0) return { delta: profile.runRateMillions, duration: "annual" };
  const transition = [...profile.transitionFlows].sort((left, right) => (
    Math.abs(right.amountMillions) - Math.abs(left.amountMillions)
    || left.id.localeCompare(right.id, "fr")
  ))[0];
  return transition ? { delta: transition.amountMillions, duration: "once" } : { delta: 0, duration: "annual" };
}

function budgetImpact(option: DecisionOption, scenario: Scenario): VerdictBudgetImpact {
  return scenario.version >= 10 ? v10BudgetImpact(option) : legacyBudgetImpact(option);
}

function effectPriority(effect: DecisionOption["effects"][number]): number {
  return effect.target === "indicator" ? INDICATOR_META[effect.key].priority : 60;
}

function normalizedEffectMagnitude(effect: DecisionOption["effects"][number]): number {
  const epsilon = effect.target === "indicator" ? INDICATOR_META[effect.key].epsilon : 1;
  return Math.abs(effect.delta) / epsilon;
}

function strongestStructuralEffect(option: DecisionOption): VerdictStructuralEffect | undefined {
  const effects = option.effects.filter((effect) => !(effect.target === "indicator" && effect.key === "annualBalance"));
  const strongest = [...effects].sort((left, right) => (
    effectPriority(right) - effectPriority(left)
    || (left.target === right.target && left.key === right.key
      ? normalizedEffectMagnitude(right) - normalizedEffectMagnitude(left)
      : 0)
  ))[0];
  if (!strongest) return undefined;
  return {
    target: strongest.target,
    key: strongest.key,
    label: strongest.target === "indicator"
      ? INDICATOR_META[strongest.key].label
      : GROUP_EFFECT_LABELS[strongest.key] ?? strongest.key,
    delta: strongest.delta,
  };
}

function compareImpact(left: DecisionOption, right: DecisionOption, scenario: Scenario): number {
  const budgetDifference = Math.abs(budgetImpact(right, scenario).delta) - Math.abs(budgetImpact(left, scenario).delta);
  if (budgetDifference !== 0) return budgetDifference;
  const leftStructural = strongestStructuralEffect(left);
  const rightStructural = strongestStructuralEffect(right);
  if (!leftStructural || !rightStructural) return Number(Boolean(rightStructural)) - Number(Boolean(leftStructural));
  const leftEffect = left.effects.find((effect) => effect.key === leftStructural.key && effect.delta === leftStructural.delta)!;
  const rightEffect = right.effects.find((effect) => effect.key === rightStructural.key && effect.delta === rightStructural.delta)!;
  const priorityDifference = effectPriority(rightEffect) - effectPriority(leftEffect);
  if (priorityDifference !== 0) return priorityDifference;
  return leftEffect.target === rightEffect.target && leftEffect.key === rightEffect.key
    ? normalizedEffectMagnitude(rightEffect) - normalizedEffectMagnitude(leftEffect)
    : 0;
}

function selfContainedChoiceLabel(decisionTitle: string | undefined, optionLabel: string): string {
  const title = decisionTitle?.replace(/\s*\?\s*$/, "").trim();
  const label = optionLabel.trim().replace(/^Mettre en œuvre\s+/i, "");
  if (!title || label.split(/\s+/).length > 3) return label;
  return title.toLocaleLowerCase("fr-FR").startsWith(label.toLocaleLowerCase("fr-FR")) ? title : label;
}

function buildDecisiveChoices(state: CampaignState, scenario: Scenario): VerdictChoice[] {
  return state.decisions
    .filter((record) => record.status !== "superseded")
    .map((record) => {
      const decision = scenario.decisions.find((candidate) => candidate.id === record.decisionId);
      const option = decision?.options.find((candidate) => candidate.id === record.optionId);
      const chapter = scenario.chapters.find((candidate) => candidate.id === decision?.chapterId);
      return { record, decision, option, chapter };
    })
    .filter((item): item is typeof item & { option: DecisionOption } => Boolean(item.option))
    .sort((left, right) => compareImpact(left.option, right.option, scenario))
    .slice(0, 3)
    .map(({ record, decision, option, chapter }, index) => {
      const impact = budgetImpact(option, scenario);
      return {
        rank: index + 1,
        decisionId: record.decisionId,
        label: selfContainedChoiceLabel(decision?.title, option.label),
        chapter: chapter?.title ?? "Mandat national",
        budgetDelta: impact.delta,
        budgetDuration: impact.duration,
        structuralEffect: strongestStructuralEffect(option),
        status: STATUS_LABELS[record.status],
      };
    });
}

function buildAftermath(
  state: CampaignState,
  scenario: Scenario,
  crisisRules: readonly CrisisRule[],
): VerdictAftermath[] {
  const crises: VerdictAftermath[] = state.crisisHistory.map((crisis) => {
    const rule = crisisRules.find((candidate) => candidate.id === crisis.ruleId);
    const concession = rule?.concessions.find((candidate) => candidate.id === crisis.resolvedBy);
    const resolution = crisis.resolvedBy === "hold-course"
      ? "Vous avez maintenu le cap."
      : concession
        ? `${concession.label}.`
        : "La crise a été tranchée.";
    return {
      kind: "crisis",
      title: rule?.title ?? "Crise du mandat",
      detail: resolution,
    };
  });

  const policies: VerdictAftermath[] = state.decisions
    .filter((record) => ["suspended", "amended", "reversed"].includes(record.status))
    .map((record) => {
      const decision = scenario.decisions.find((candidate) => candidate.id === record.decisionId);
      const option = decision?.options.find((candidate) => candidate.id === record.optionId);
      return {
        kind: "policy",
        title: option?.label ?? decision?.title ?? "Réforme modifiée",
        detail: decision?.title ?? "Cette réforme a changé sous la pression du mandat.",
        status: STATUS_LABELS[record.status],
      };
    });

  return [...crises, ...policies];
}

function headlineFor(balance: number, majority: number, opinion: number): string {
  if (balance >= 0 && majority >= 50) return "Vous avez redressé les comptes sans perdre le pouvoir.";
  if (balance >= 0) return "Les comptes sont redressés. Le pays vous a retiré les moyens d'agir.";
  if (balance >= -50_000 && opinion >= 45) return "La trajectoire est devenue crédible. Le compromis tient encore.";
  if (balance >= -50_000) return "Le déficit recule. La fracture politique reste ouverte.";
  if (opinion >= 60) return "Le pays vous suit. Les comptes, eux, résistent encore.";
  return "Le déficit résiste. Votre mandat a choisi qui devait être protégé.";
}

function summaryFor(state: CampaignState): string {
  const superseded = state.decisions.filter((record) => record.status === "superseded").length;
  const altered = state.decisions.filter((record) => ["suspended", "amended", "reversed"].includes(record.status)).length;
  const parts = [`${state.decisions.length - superseded} arbitrages rendus`];
  if (superseded > 0) parts.push(`${superseded} ${superseded === 1 ? "dossier sans objet" : "dossiers sans objet"}`);
  if (state.crisisHistory.length > 0) parts.push(`${state.crisisHistory.length} ${state.crisisHistory.length === 1 ? "crise traversée" : "crises traversées"}`);
  if (altered > 0) parts.push(`${altered} ${altered === 1 ? "réforme modifiée sous pression" : "réformes modifiées sous pression"}`);
  return `${parts.join(". ")}.`;
}

export function buildMandateVerdictViewModel(
  state: CampaignState,
  scenario: Scenario,
  crisisRules: readonly CrisisRule[] = [],
): MandateVerdictViewModel {
  const target = Math.abs(state.baseline.annualBalanceMillions);
  const recovered = state.indicators.annualBalance - state.baseline.annualBalanceMillions;
  const score = Math.min(target, recovered);
  return {
    headline: headlineFor(state.indicators.annualBalance, state.indicators.majority, state.indicators.opinion),
    summary: summaryFor(state),
    annualBalance: state.indicators.annualBalance,
    annualBalanceDelta: state.indicators.annualBalance - state.baseline.annualBalanceMillions,
    target,
    score,
    remaining: Math.max(0, -state.indicators.annualBalance),
    surplus: Math.max(0, state.indicators.annualBalance),
    signals: buildSignals(state),
    trajectory: buildTrajectory(state),
    decisiveChoices: buildDecisiveChoices(state, scenario),
    aftermath: buildAftermath(state, scenario, crisisRules),
  };
}
