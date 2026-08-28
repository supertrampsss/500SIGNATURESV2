import { INITIAL_INDICATORS } from "./campaign.ts";
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
  signals: VerdictSignal[];
  trajectory: VerdictCheckpoint[];
  decisiveChoices: VerdictChoice[];
  aftermath: VerdictAftermath[];
};

const CHECKPOINTS = [0, 24, 48, 72, 96] as const;
const CLAMPED_INDICATORS = new Set<IndicatorKey>([
  "publicServices",
  "majority",
  "reformCapacity",
  "opinion",
  "institutionalTrust",
  "financialCredibility",
]);

const EFFECT_LABELS: Record<string, string> = {
  growth: "Croissance",
  employment: "Emploi",
  investment: "Investissement",
  publicServices: "Services publics",
  majority: "Pouvoir",
  reformCapacity: "Capacité de réforme",
  opinion: "Opinion",
  institutionalTrust: "Confiance",
  financialCredibility: "Crédibilité financière",
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
  const indicators: IndicatorState = { ...INITIAL_INDICATORS };
  for (const entry of orderedLedger(state.causalLedger)) {
    if (entry.appliedAtDecision > decisionCount || entry.target !== "indicator") continue;
    const key = entry.key as IndicatorKey;
    indicators[key] = clampIndicator(key, indicators[key] + entry.delta);
  }
  return indicators;
}

function descriptorFor(key: VerdictSignal["key"], value: number): string {
  if (key === "growth") {
    if (value < 0) return "Récession";
    if (value < 1) return "Activité faible";
    if (value < 2) return "Activité modérée";
    return "Activité soutenue";
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
  return ([
    ["growth", "Croissance"],
    ["majority", "Pouvoir"],
    ["opinion", "Opinion"],
  ] as const).map(([key, label]) => ({
    key,
    label,
    value: state.indicators[key],
    initialValue: INITIAL_INDICATORS[key],
    delta: state.indicators[key] - INITIAL_INDICATORS[key],
    descriptor: descriptorFor(key, state.indicators[key]),
  }));
}

function buildTrajectory(state: CampaignState): VerdictCheckpoint[] {
  return CHECKPOINTS.map((decisionCount) => {
    const indicators = decisionCount === 96 ? state.indicators : reconstructAt(state, decisionCount);
    return {
      decisionCount,
      label: decisionCount === 0 ? "Début du mandat" : decisionCount === 96 ? "Verdict final" : `Après ${decisionCount} dossiers`,
      annualBalance: indicators.annualBalance,
      majority: indicators.majority,
    };
  });
}

function immediateBudgetDelta(option: DecisionOption): number {
  return option.effects
    .filter((effect) => effect.target === "indicator" && effect.key === "annualBalance")
    .reduce((sum, effect) => sum + effect.delta, 0);
}

function strongestStructuralEffect(option: DecisionOption): VerdictStructuralEffect | undefined {
  const effects = option.effects.filter((effect) => !(effect.target === "indicator" && effect.key === "annualBalance"));
  const strongest = effects.sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))[0];
  if (!strongest) return undefined;
  return {
    key: strongest.key,
    label: EFFECT_LABELS[strongest.key] ?? strongest.key,
    delta: strongest.delta,
  };
}

function impactScore(option: DecisionOption): number {
  const budget = Math.abs(immediateBudgetDelta(option));
  const structural = option.effects
    .filter((effect) => !(effect.target === "indicator" && effect.key === "annualBalance"))
    .reduce((largest, effect) => Math.max(largest, Math.abs(effect.delta)), 0);
  return budget * 100 + structural;
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
    .sort((left, right) => impactScore(right.option) - impactScore(left.option))
    .slice(0, 3)
    .map(({ record, option, chapter }, index) => ({
      rank: index + 1,
      decisionId: record.decisionId,
      label: option.label,
      chapter: chapter?.title ?? "Mandat national",
      budgetDelta: immediateBudgetDelta(option),
      structuralEffect: strongestStructuralEffect(option),
      status: STATUS_LABELS[record.status],
    }));
}

function buildAftermath(
  state: CampaignState,
  scenario: Scenario,
  crisisRules: readonly CrisisRule[],
): VerdictAftermath[] {
  const crises: VerdictAftermath[] = state.crisisHistory.map((crisis) => {
    const rule = crisisRules.find((candidate) => candidate.id === crisis.ruleId);
    const trigger = scenario.decisions.find((decision) => decision.id === crisis.triggeredByDecisionId);
    const concession = rule?.concessions.find((candidate) => candidate.id === crisis.resolvedBy);
    const resolution = crisis.resolvedBy === "hold-course"
      ? "Vous avez maintenu le cap."
      : concession
        ? `${concession.label}.`
        : "La crise a été tranchée.";
    return {
      kind: "crisis",
      title: rule?.title ?? "Crise du mandat",
      detail: `${trigger?.title ?? "Une décision du mandat"}. ${resolution}`,
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
  return {
    headline: headlineFor(state.indicators.annualBalance, state.indicators.majority, state.indicators.opinion),
    summary: summaryFor(state),
    annualBalance: state.indicators.annualBalance,
    annualBalanceDelta: state.indicators.annualBalance - INITIAL_INDICATORS.annualBalance,
    signals: buildSignals(state),
    trajectory: buildTrajectory(state),
    decisiveChoices: buildDecisiveChoices(state, scenario),
    aftermath: buildAftermath(state, scenario, crisisRules),
  };
}
