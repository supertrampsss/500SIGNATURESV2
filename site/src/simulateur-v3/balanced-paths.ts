import {
  STRUCTURAL_ADOPT_DECISION_IDS,
  budgetEstimateFor,
  findExclusiveScopeCollisions,
} from "./budget-registry.ts";
import { currentDecision, createCampaign, selectOption } from "./campaign.ts";
import { CAMPAIGN_DECISION_IDS } from "./campaign-topology.ts";
import { availableResolutionIds, resolveCrisis } from "./crises.ts";
import { confirmSelection } from "./effects.ts";
import { advanceCampaign } from "./flow.ts";
import { SCENARIO_V10_CRISIS_RULES } from "./scenario-crises.ts";
import type { BudgetEstimate, CampaignState, Decision, DecisionOption, MandateBaseline, Scenario } from "./types.ts";

type PathId = "doctrine-21689" | "redressement-prudent" | "reformes-structurelles";
type QualifiedOptionId = `${string}:${"adopt" | "keep"}`;

export type BalancedPathFixture = Readonly<{
  id: PathId;
  optionIds: readonly QualifiedOptionId[];
  crisisChoiceIds: readonly `${string}:${string}`[];
}>;

export type PathSimulation = CampaignState & Readonly<{
  status: "balanced" | "budget_gap";
  honestGapMillions: number;
}>;

/** Published source baseline, used only to replay the state machine. */
export const BALANCED_PATH_BASELINE: Readonly<MandateBaseline> = Object.freeze({
  period: "2025",
  debtPeriod: "2025-Q4",
  nominalGdpMillions: 2_991_055.9,
  debtMillions: 3_460_651.6763,
  annualBalanceMillions: -152_532,
  interestCostMillions: 66_635.9,
  nominalGrowthPercent: 1.9011968652765887,
  sourceIds: ["eurostat_pib_montant", "insee_dette_apu_part_pib", "insee_apu_solde", "eurostat_apu_interets"],
  dataVersion: "2026-08-22T1939",
});

function optionsFor(adoptedDecisionIds: readonly string[]): readonly QualifiedOptionId[] {
  const adopted = new Set(adoptedDecisionIds);
  return Object.freeze(CAMPAIGN_DECISION_IDS.map((decisionId) => `${decisionId}:${adopted.has(decisionId) ? "adopt" : "keep"}` as QualifiedOptionId));
}

function crisisChoices<T extends readonly `${string}:${string}`[]>(...choiceIds: T): T {
  return Object.freeze(choiceIds) as T;
}

const STRUCTURAL_AND_FISCAL_ADOPTIONS = Object.freeze([
  ...STRUCTURAL_ADOPT_DECISION_IDS,
  "perenniser-surtaxe-grandes-entreprises",
  "relever-tva-restauration-commerciale",
]);

const PRUDENT_ADOPTIONS = Object.freeze([
  ...STRUCTURAL_AND_FISCAL_ADOPTIONS,
  "porter-le-taux-normal-de-tva-a",
  "doubler-la-taxe-sur-les-rachats-d",
  "retablir-un-impot-sur-la-fortune-financiere",
  "repousser-l-age-legal-a-65-ans",
  "desindexer-les-pensions-d-un-point",
  "durcir-l-assurance-chomage-degressivite-duree",
  "doubler-les-franchises-medicales",
  "fiscalite-nutritionnelle-au-niveau-recommande",
  "supprimer-l-aide-medicale-d-etat",
  "reduire-les-delais-de-traitement-de-l",
  "supprimer-l-allocation-pour-demandeurs-d",
  "reserver-les-prestations-non-contributives-aux-nationaux",
  "legaliser-et-taxer-le-cannabis",
  "etaler-la-marche-2026-de-la-programmation",
  "reduire-l-aide-publique-au-developpement-de",
  "creer-une-armee-europeenne",
  "supprimer-le-bonus-automobile-electrique",
  "renforcer-la-taxe-sur-les-billets-d",
  "retablir-une-trajectoire-carbone-recettes-redistribuees",
  "moratoire-sur-les-renouvelables",
  "supprimer-le-financement-public-du-prive",
  "autonomie-complete-des-etablissements",
  "supprimer-les-departements",
  "ne-pas-remplacer-un-depart-administratif-sur",
  "regle-d-or-constitutionnelle",
]);

/** Three complete published paths. The response list is deliberately literal too. */
export const BALANCED_PATHS: readonly BalancedPathFixture[] = Object.freeze([
  Object.freeze({
    id: "doctrine-21689",
    optionIds: optionsFor(STRUCTURAL_AND_FISCAL_ADOPTIONS),
    crisisChoiceIds: crisisChoices(
      "v10-tax-legitimacy:reverse-ir-csg-unification",
      "v10-care-access:v10-care-access:amend-2",
      "v10-state-capacity:v10-state-capacity:amend-1",
    ),
  }),
  Object.freeze({
    id: "redressement-prudent",
    optionIds: optionsFor(PRUDENT_ADOPTIONS),
    crisisChoiceIds: crisisChoices(
      "v10-tax-legitimacy:reverse-ir-csg-unification",
      "v10-labour-blockade:v10-labour-blockade:amend-1",
      "v10-care-access:v10-care-access:amend-1",
      "v10-state-capacity:v10-state-capacity:amend-1",
    ),
  }),
  Object.freeze({
    id: "reformes-structurelles",
    optionIds: optionsFor(STRUCTURAL_ADOPT_DECISION_IDS),
    crisisChoiceIds: crisisChoices(
      "v10-tax-legitimacy:reverse-ir-csg-unification",
      "v10-care-access:v10-care-access:amend-2",
      "v10-state-capacity:v10-state-capacity:amend-1",
    ),
  }),
]);

function optionForId(scenario: Scenario, optionId: QualifiedOptionId): { decision: Decision; option: DecisionOption } {
  const separator = optionId.lastIndexOf(":");
  const decisionId = optionId.slice(0, separator);
  const decision = scenario.decisions.find((candidate) => candidate.id === decisionId);
  const option = decision?.options.find((candidate) => candidate.id === optionId);
  if (!decision || !option) throw new Error(`Unknown fixture option: ${optionId}`);
  return { decision, option };
}

function validateFixture(path: BalancedPathFixture, scenario: Scenario): void {
  if (scenario.version !== 10) throw new Error("Balanced paths require scenario V10");
  if (path.optionIds.length !== CAMPAIGN_DECISION_IDS.length) throw new Error(`Path ${path.id} has ${path.optionIds.length} options, expected ${CAMPAIGN_DECISION_IDS.length}`);
  const decisionIds = path.optionIds.map((optionId) => optionId.slice(0, optionId.lastIndexOf(":")));
  if (new Set(decisionIds).size !== decisionIds.length) throw new Error(`Path ${path.id} has duplicate decisions`);
  if (!decisionIds.every((id, index) => id === CAMPAIGN_DECISION_IDS[index])) throw new Error(`Path ${path.id} is missing, unknown, or out of order`);
  const profiles = path.optionIds.map((optionId) => optionForId(scenario, optionId).option.budgetProfile);
  const collisions = findExclusiveScopeCollisions(profiles);
  if (collisions.length > 0) throw new Error(`Path ${path.id} has exclusive scope collision: ${collisions.join(",")}`);
  const adopted = new Set<string>();
  const completed = new Set<string>();
  const locked = new Set<string>();
  for (const optionId of path.optionIds) {
    const { decision, option } = optionForId(scenario, optionId);
    const isAdopt = option.id.endsWith(":adopt");
    if (locked.has(decision.id)) {
      if (isAdopt) throw new Error(`Path ${path.id} selects locked decision ${decision.id}`);
      locked.delete(decision.id);
      completed.add(decision.id);
      continue;
    }
    if (isAdopt) {
      if (decision.dependencies.some((id) => !adopted.has(id))) {
        throw new Error(`Path ${path.id} has unsatisfied dependency for ${decision.id}`);
      }
      if (decision.conflicts.some((id) => adopted.has(id)
          || [...adopted].some((adoptedId) => scenario.decisions.find((candidate) => candidate.id === adoptedId)?.conflicts.includes(decision.id)))) {
        throw new Error(`Path ${path.id} has incompatible conflict for ${decision.id}`);
      }
      adopted.add(decision.id);
    }
    option.locks.filter((id) => !completed.has(id)).forEach((id) => locked.add(id));
    option.unlocks.forEach((id) => locked.delete(id));
    completed.add(decision.id);
  }
  const knownResponses = new Set(SCENARIO_V10_CRISIS_RULES.flatMap((rule) => [
    `${rule.id}:hold-course`,
    ...rule.concessions.map((concession) => `${rule.id}:${concession.id}`),
  ]));
  if (path.crisisChoiceIds.some((id) => !knownResponses.has(id))) throw new Error(`Path ${path.id} has unknown crisis response`);
}

function assertFixtureOptionAtCurrent(state: CampaignState, scenario: Scenario, expectedId: QualifiedOptionId): void {
  const decision = currentDecision(state, scenario);
  if (!decision || decision.id !== expectedId.slice(0, expectedId.lastIndexOf(":"))) {
    throw new Error(`Path option does not match current decision: ${expectedId}`);
  }
  if (state.lockedDecisionIds.includes(decision.id)) throw new Error(`Path attempted locked decision: ${decision.id}`);
}

/** Replays a fixture through every actual transition of the campaign reducer. */
export function simulatePath(path: BalancedPathFixture, scenario: Scenario): PathSimulation {
  validateFixture(path, scenario);
  let state: CampaignState = { ...createCampaign(scenario, BALANCED_PATH_BASELINE), phase: "chapter_intro" };
  let nextCrisis = 0;
  const expectedByDecision = new Map(path.optionIds.map((optionId) => [optionId.slice(0, optionId.lastIndexOf(":")), optionId]));

  for (let step = 0; step < 1_500 && state.phase !== "verdict"; step += 1) {
    if (state.phase === "decision") {
      const decision = currentDecision(state, scenario);
      if (!decision) throw new Error("Path reached an unknown decision");
      const expected = expectedByDecision.get(decision.id);
      if (!expected) throw new Error(`Path is missing decision ${decision.id}`);
      assertFixtureOptionAtCurrent(state, scenario, expected as QualifiedOptionId);
      state = confirmSelection(selectOption(state, scenario, decision.id, expected), scenario);
      continue;
    }
    if (state.phase === "crisis") {
      const expected = path.crisisChoiceIds[nextCrisis];
      if (!expected || !expected.startsWith(`${state.activeCrisis!.ruleId}:`)) {
        throw new Error(`Path ${path.id} leaves crisis ${state.activeCrisis!.ruleId} unresolved at response ${nextCrisis}`);
      }
      const resolutionId = expected.slice(state.activeCrisis!.ruleId.length + 1);
      if (!availableResolutionIds(state, SCENARIO_V10_CRISIS_RULES).includes(resolutionId)) {
        throw new Error(`Path ${path.id} has unavailable crisis response: ${expected}`);
      }
      state = resolveCrisis(state, SCENARIO_V10_CRISIS_RULES, resolutionId);
      nextCrisis += 1;
      continue;
    }
    state = advanceCampaign(state, scenario, SCENARIO_V10_CRISIS_RULES);
  }
  if (state.phase !== "verdict") throw new Error(`Path ${path.id} exceeded reducer transition cap`);
  if (nextCrisis !== path.crisisChoiceIds.length) throw new Error(`Path ${path.id} has unused crisis response`);
  if (state.decisions.length !== CAMPAIGN_DECISION_IDS.length || state.annualCheckpoints.length !== 5) {
    throw new Error(`Path ${path.id} did not complete the published campaign`);
  }
  for (const optionId of path.optionIds) {
    const decisionId = optionId.slice(0, optionId.lastIndexOf(":"));
    const record = state.decisions.find((candidate) => candidate.decisionId === decisionId);
    if (!record) throw new Error(`Path ${path.id} has no record for ${decisionId}`);
    if (record.status === "superseded") {
      const expectedKeep = `${decisionId}:keep`;
      if (optionId !== expectedKeep || record.optionId !== expectedKeep) {
        throw new Error(`Path ${path.id} has incompatible auto-superseded option for ${decisionId}`);
      }
    } else if (record.optionId !== optionId) {
      throw new Error(`Path ${path.id} recorded ${record.optionId} instead of ${optionId}`);
    }
  }
  const honestGapMillions = Math.max(0, -state.indicators.annualBalance);
  return Object.assign(state, { status: honestGapMillions === 0 ? "balanced" as const : "budget_gap" as const, honestGapMillions });
}

const FISCAL_PROMOTION_IDS = new Set(["perenniser-surtaxe-grandes-entreprises", "relever-tva-restauration-commerciale"]);

export function structuralRunRate(
  path: BalancedPathFixture,
  scenario: Scenario,
  options: { includeFiscalPromotions?: boolean } = {},
): number {
  return path.optionIds.reduce((total, optionId) => {
    const { decision, option } = optionForId(scenario, optionId);
    const isStructural = STRUCTURAL_ADOPT_DECISION_IDS.includes(decision.id as typeof STRUCTURAL_ADOPT_DECISION_IDS[number]);
    const isFiscalPromotion = options.includeFiscalPromotions && FISCAL_PROMOTION_IDS.has(decision.id);
    return (isStructural || isFiscalPromotion) && option.id.endsWith(":adopt")
      ? total + option.budgetProfile.runRateMillions
      : total;
  }, 0);
}

type Candidate = { decision: Decision; option: DecisionOption; estimate: BudgetEstimate };

function candidateEstimates(scenario: Scenario): Candidate[] {
  return CAMPAIGN_DECISION_IDS.flatMap((decisionId) => {
    const decision = scenario.decisions.find((candidate) => candidate.id === decisionId);
    const option = decision?.options.find((candidate) => candidate.id === `${decisionId}:adopt`);
    if (!decision || !option || option.budgetProfile.runRateMillions <= 0 || option.budgetProfile.estimateKey === null) return [];
    return [{ decision, option, estimate: budgetEstimateFor(decision.id, "adopt", option.budgetProfile.estimateKey) }];
  });
}

function maximumSelection(scenario: Scenario): Candidate[] {
  const candidates = candidateEstimates(scenario);
  const suffix = candidates.reduceRight<number[]>((values, candidate, index) => {
    values[index] = (values[index + 1] ?? 0) + candidate.estimate.runRateMillions;
    return values;
  }, []);
  let best: Candidate[] = [];
  let bestValue = -Infinity;
  const visited = new Map<string, number>();
  const search = (index: number, chosen: Candidate[], locks: Set<string>, scopes: Set<string>, value: number): void => {
    if (value + (suffix[index] ?? 0) < bestValue) return;
    const stateKey = [
      index,
      [...locks].sort().join(","),
      [...scopes].sort().join(","),
      chosen.map((candidate) => candidate.decision.id).join(","),
    ].join("|");
    if ((visited.get(stateKey) ?? -Infinity) >= value) return;
    visited.set(stateKey, value);
    if (index === candidates.length) {
      if (value > bestValue) { bestValue = value; best = chosen; }
      return;
    }
    const candidate = candidates[index]!;
    const conflicts = candidate.decision.conflicts.some((id) => chosen.some((item) => item.decision.id === id));
    const dependencyMissing = candidate.decision.dependencies.some((id) => !chosen.some((item) => item.decision.id === id));
    const scopeConflict = candidate.option.budgetProfile.exclusiveScopeKeys.some((key) => scopes.has(key));
    if (!locks.has(candidate.decision.id) && !conflicts && !dependencyMissing && !scopeConflict) {
      const nextLocks = new Set(locks);
      candidate.option.locks.forEach((id) => nextLocks.add(id));
      candidate.option.unlocks.forEach((id) => nextLocks.delete(id));
      const nextScopes = new Set(scopes);
      candidate.option.budgetProfile.exclusiveScopeKeys.forEach((key) => nextScopes.add(key));
      search(index + 1, [...chosen, candidate], nextLocks, nextScopes, value + candidate.estimate.runRateMillions);
    }
    search(index + 1, chosen, locks, scopes, value);
  };
  search(0, [], new Set(), new Set(), 0);
  return best;
}

export function maximumCompatibleProvenance(scenario: Scenario): readonly BudgetEstimate[] {
  return Object.freeze(maximumSelection(scenario).map((candidate) => candidate.estimate));
}

export function maximumCompatibleRunRate(scenario: Scenario): number {
  return maximumCompatibleProvenance(scenario).reduce((sum, estimate) => sum + estimate.runRateMillions, 0);
}
