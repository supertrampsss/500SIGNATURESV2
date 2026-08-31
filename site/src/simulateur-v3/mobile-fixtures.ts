import { BALANCED_PATH_BASELINE, BALANCED_PATHS, type BalancedPathFixture } from "./balanced-paths.ts";
import { currentDecision, createCampaign, selectOption } from "./campaign.ts";
import { resolveCrisis } from "./crises.ts";
import { confirmSelection } from "./effects.ts";
import { advanceCampaign } from "./flow.ts";
import { SCENARIO_V10_CRISIS_RULES } from "./scenario-crises.ts";
import type { CampaignState, Scenario } from "./types.ts";

export type E2ePhase = "decision" | "crisis" | "verdict";
export type E2eFixture = "default" | "epr2";

/** Deterministic, sourced baseline reserved for browser fixtures in Vite's test mode. */
export const MOBILE_E2E_BASELINE = BALANCED_PATH_BASELINE;

const EPR2_DECISION_ID = "engager-six-epr2-part-annuelle-de-l";

function optionByDecision(path: BalancedPathFixture): ReadonlyMap<string, string> {
  return new Map(path.optionIds.map((optionId) => [optionId.slice(0, optionId.lastIndexOf(":")), optionId]));
}

/** Builds each browser fixture by replaying the published reducer, never by forging a phase. */
export function stateForE2ePhase(
  phase: E2ePhase,
  scenario: Scenario,
  fixture: E2eFixture = "default",
): CampaignState {
  if (scenario.version !== 10) throw new Error("E2E mobile fixtures require V10");
  if (fixture === "epr2" && phase !== "decision") throw new Error("The EPR2 fixture is a decision scene");
  const path = BALANCED_PATHS[0]!;
  const selectedOptions = optionByDecision(path);
  let state: CampaignState = { ...createCampaign(scenario, BALANCED_PATH_BASELINE), phase: "chapter_intro" };

  for (let step = 0; step < 1_500; step += 1) {
    const decision = state.phase === "decision" ? currentDecision(state, scenario) : undefined;
    if (state.phase === phase && (fixture !== "epr2" || decision?.id === EPR2_DECISION_ID)) return state;
    if (state.phase === "decision") {
      const optionId = decision ? selectedOptions.get(decision.id) : undefined;
      if (!decision || !optionId) throw new Error("E2E path reached an unknown decision");
      state = confirmSelection(selectOption(state, scenario, decision.id, optionId), scenario);
      continue;
    }
    if (state.phase === "crisis") {
      const response = path.crisisChoiceIds[state.crisisHistory.length];
      if (!response?.startsWith(`${state.activeCrisis?.ruleId}:`)) {
        throw new Error(`E2E path cannot resolve crisis ${state.activeCrisis?.ruleId ?? "unknown"}`);
      }
      state = resolveCrisis(state, SCENARIO_V10_CRISIS_RULES, response.slice(state.activeCrisis!.ruleId.length + 1));
      continue;
    }
    state = advanceCampaign(state, scenario, SCENARIO_V10_CRISIS_RULES);
  }
  throw new Error(`E2E fixture did not reach ${phase}`);
}
