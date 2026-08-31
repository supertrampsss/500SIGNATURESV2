export type CampaignPhase =
  | "intro"
  | "chapter_intro"
  | "decision"
  | "decision_result"
  | "council"
  | "crisis"
  | "delayed_event"
  | "chapter_verdict"
  | "pause"
  | "verdict";

export const SCHEMA_VERSION = 4 as const;

export type Uncertainty = "faible" | "moyenne" | "forte";
export type DecisionKind = "gestion" | "transformation" | "rupture";
export type DecisionStatus = "confirmed" | "suspended" | "amended" | "reversed" | "superseded";
export type EffectTarget = "indicator" | "group";

export type PolicyHorizon =
  | { kind: "immediate" }
  | { kind: "after_decisions"; count: number }
  | { kind: "mandate_year"; year: 1 | 2 | 3 | 4 | 5 };

export type IndicatorKey =
  | "annualBalance"
  | "debtToGdp"
  | "interestCost"
  | "growth"
  | "employment"
  | "investment"
  | "publicServices"
  | "majority"
  | "reformCapacity"
  | "opinion"
  | "institutionalTrust"
  | "financialCredibility";

export type GroupKey =
  | "lowIncomeHouseholds"
  | "middleClasses"
  | "retirees"
  | "publicEmployees"
  | "privateEmployees"
  | "unions"
  | "businesses"
  | "farmers"
  | "localAuthorities"
  | "creditors"
  | "europeanPartners"
  | "parliamentaryMajority";

export type EvidenceBlock = {
  label: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  note?: string;
};

export type EffectTiming =
  | { kind: "immediate" }
  | { kind: "after_decisions"; count: number }
  | { kind: "mandate_year"; year: 1 | 2 | 3 | 4 | 5 };

/** A dated, one-off budget flow. It is distinct from an annual run rate. */
export type BudgetTransitionFlow = {
  id: string;
  amountMillions: number;
  timing: EffectTiming;
  sourceKey: string;
};

export type RunRateTiming =
  | { kind: "immediate" }
  | { kind: "mandate_year"; year: 1 | 2 | 3 | 4 | 5 };

export type BudgetProfile = {
  estimateKey: string | null;
  runRateMillions: number;
  runRateTiming: RunRateTiming | null;
  transitionFlows: BudgetTransitionFlow[];
  exclusiveScopeKeys: string[];
};

/** Optional audit legs kept outside the operating budget equation. */
export type BudgetEstimateReconciliation = {
  outgoingAmountMillions: number;
  counterpartAmountMillions: number;
};

export type BudgetEstimate = {
  key: string;
  baseYear: number;
  baseAmountMillions: number;
  baseNature: "realise" | "prevision" | "objectif" | "notifie" | "recouvre";
  scope: string;
  grossActionMillions: number;
  behavioralOffsetMillions: number;
  recurringOperatingCostMillions: number;
  runRateMillions: number;
  transitionFlows: BudgetTransitionFlow[];
  sourceKeys: readonly string[];
  estimateStatus: "observe" | "ex_ante" | "scenario";
  uncertainty: Uncertainty;
  exclusiveScopeKeys: readonly string[];
  reconciliation?: BudgetEstimateReconciliation;
};

type EffectRuleBase = {
  id: string;
  delta: number;
  timing: EffectTiming;
  duration: "once" | "annual" | "permanent";
  explanation: string;
};

export type EffectRule = EffectRuleBase & (
  | { target: "indicator"; key: IndicatorKey }
  | { target: "group"; key: GroupKey }
);

export type ScheduledEventRule = {
  id: string;
  title: string;
  body: string;
  afterDecisions: number;
  effects: EffectRule[];
};

/** Stable queue identifier used when a delayed direct effect materializes as an event. */
export function materializedDelayedEventId(decisionId: string, optionId: string, effectId: string): string {
  return `${decisionId}:${optionId}:${effectId}`;
}

export type PromiseRule = {
  id: string;
  label: string;
  dueAfterDecisions: number;
  failureEffects: EffectRule[];
};

export type DecisionOption = {
  id: string;
  label: string;
  summary: string;
  mechanism: string;
  horizon: PolicyHorizon;
  legalConstraints: string[];
  budgetProfile: BudgetProfile;
  beneficiaries: string[];
  contributors: string[];
  uncertainty: Uncertainty;
  effects: EffectRule[];
  scheduledEvents: ScheduledEventRule[];
  promises: PromiseRule[];
  fulfillsPromises: string[];
  locks: string[];
  unlocks: string[];
};

export type Decision = {
  id: string;
  version: number;
  kind: DecisionKind;
  chapterId: string;
  title: string;
  context: string;
  options: DecisionOption[];
  evidence: EvidenceBlock[];
  historicalPrecedent?: { title: string; body: string; sourceUrl: string };
  dependencies: string[];
  conflicts: string[];
};

export type Chapter = {
  id: string;
  title: string;
  domains: [string, string, string, string];
  opening: string;
  tension: string;
  decisionIds: string[];
};

export type Scenario = {
  version: number;
  title: string;
  chapters: Chapter[];
  decisions: Decision[];
};

export type IndicatorImpactSnapshot = {
  key: IndicatorKey;
  before: number;
  after: number;
  delta: number;
  causalEntryIds: string[];
};

export type DecisionImpactSnapshot = {
  decisionId: string;
  optionId: string;
  confirmedAtIndex: number;
  indicators: IndicatorImpactSnapshot[];
};

export type DecisionRecord = {
  decisionId: string;
  optionId: string;
  status: DecisionStatus;
  confirmedAtIndex: number;
  impact?: DecisionImpactSnapshot;
  changedByCrisisId?: string;
};

export type ScheduledEvent = {
  id: string;
  sourceDecisionId: string;
  sourceOptionId: string;
  dueAtDecision: number;
  title: string;
  body: string;
  effects: EffectRule[];
};

export type CausalEntry = {
  id: string;
  sourceType: "decision" | "event" | "crisis" | "promise";
  sourceId: string;
  target: EffectTarget;
  key: IndicatorKey | GroupKey;
  delta: number;
  duration: EffectRule["duration"];
  explanation: string;
  appliedAtDecision: number;
};

export type CrisisConcession = {
  id: string;
  label: string;
  targetDecisionId: string;
  policyChange: "suspend" | "amend" | "reverse";
  unlocksDecisionIds?: string[];
  effects: EffectRule[];
};

/** Exact scenario choices which are allowed to aggravate a crisis family. */
export type CrisisChoiceRef = {
  decisionId: string;
  optionIds: string[];
};

/** One option which was actually confirmed when a crisis was detected. */
export type TriggeredCrisisChoiceRef = {
  decisionId: string;
  optionId: string;
};

export type CrisisRule = {
  id: string;
  title: string;
  body: string;
  indicator: IndicatorKey;
  threshold: number;
  comparator: "lte" | "gte";
  eligibleFromChapterIndex: number;
  maxOccurrences: 1;
  requiredDecisionIds: string[];
  aggravatingChoices: CrisisChoiceRef[];
  concessions: CrisisConcession[];
  holdCourseEffects: EffectRule[];
};

export type CrisisState = {
  ruleId: string;
  triggeredAtDecisionCount: number;
  triggeredChapterIndex: number;
  aggravatingChoices: TriggeredCrisisChoiceRef[];
  /** Compatibility projection for the existing crisis and verdict copy. */
  triggeredByDecisionId: string;
  /** Compatibility projection; exact option-level causes live above. */
  aggravatingDecisionIds: string[];
  resolvedBy?: string;
};

export type PoliticalPromise = {
  id: string;
  sourceDecisionId: string;
  sourceOptionId: string;
  label: string;
  dueAtDecision: number;
  fulfilled: boolean;
  failureEffects: EffectRule[];
};

export type IndicatorState = Record<IndicatorKey, number>;
export type GroupState = Record<GroupKey, number>;

export type MandateYear = 0 | 1 | 2 | 3 | 4 | 5;

export type MandateBaseline = {
  period: string;
  debtPeriod: string;
  nominalGdpMillions: number;
  debtMillions: number;
  annualBalanceMillions: number;
  interestCostMillions: number;
  nominalGrowthPercent: number;
  sourceIds: string[];
  dataVersion: string;
};

export type AnnualCheckpoint = {
  year: MandateYear;
  afterDecisionCount: number;
  nominalGdpMillions: number;
  debtMillions: number;
  debtToGdp: number;
  annualBalance: number;
  interestCost: number;
  causes: string[];
};

export type CampaignState = {
  schemaVersion: typeof SCHEMA_VERSION;
  scenarioVersion: number;
  seed: number;
  phase: CampaignPhase;
  pausedFrom?: Exclude<CampaignPhase, "pause">;
  chapterIndex: number;
  decisionIndex: number;
  pendingSelection?: { decisionId: string; optionId: string };
  decisions: DecisionRecord[];
  baseline: MandateBaseline;
  annualCheckpoints: AnnualCheckpoint[];
  indicators: IndicatorState;
  groups: GroupState;
  scheduledEvents: ScheduledEvent[];
  eventHistory: ScheduledEvent[];
  activePromises: PoliticalPromise[];
  promiseHistory: PoliticalPromise[];
  activeCrisis?: CrisisState;
  crisisHistory: CrisisState[];
  resolvedCrisisIds: string[];
  causalLedger: CausalEntry[];
  unlockedDecisionIds: string[];
  lockedDecisionIds: string[];
  savedAt: string;
};
