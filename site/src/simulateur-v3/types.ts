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

export const SCHEMA_VERSION = 3 as const;

export type Uncertainty = "faible" | "moyenne" | "forte";
export type DecisionStatus = "confirmed" | "suspended" | "amended" | "reversed";
export type EffectTarget = "indicator" | "group";

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

export type EffectRule = {
  id: string;
  target: EffectTarget;
  key: IndicatorKey | GroupKey;
  delta: number;
  timing: { kind: "immediate" } | { kind: "after_decisions"; count: number };
  duration: "once" | "annual" | "permanent";
  explanation: string;
};

export type ScheduledEventRule = {
  id: string;
  title: string;
  body: string;
  afterDecisions: number;
  effects: EffectRule[];
};

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

export type DecisionRecord = {
  decisionId: string;
  optionId: string;
  status: DecisionStatus;
  confirmedAtIndex: number;
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
  explanation: string;
  appliedAtDecision: number;
};

export type CrisisConcession = {
  id: string;
  label: string;
  targetDecisionId: string;
  policyChange: "suspend" | "amend" | "reverse";
  effects: EffectRule[];
};

export type CrisisRule = {
  id: string;
  title: string;
  body: string;
  indicator: IndicatorKey;
  threshold: number;
  comparator: "lte" | "gte";
  aggravatingDecisionIds: string[];
  concessions: CrisisConcession[];
  holdCourseEffects: EffectRule[];
};

export type CrisisState = {
  ruleId: string;
  triggeredByDecisionId: string;
  aggravatingDecisionIds: string[];
  resolvedBy?: string;
};

export type PoliticalPromise = {
  id: string;
  sourceDecisionId: string;
  label: string;
  dueAtDecision: number;
  fulfilled: boolean;
  failureEffects: EffectRule[];
};

export type IndicatorState = Record<IndicatorKey, number>;
export type GroupState = Record<GroupKey, number>;

export type CampaignState = {
  schemaVersion: typeof SCHEMA_VERSION;
  scenarioVersion: number;
  seed: number;
  phase: CampaignPhase;
  chapterIndex: number;
  decisionIndex: number;
  pendingSelection?: { decisionId: string; optionId: string };
  decisions: DecisionRecord[];
  indicators: IndicatorState;
  groups: GroupState;
  scheduledEvents: ScheduledEvent[];
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
