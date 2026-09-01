import { SCENARIO_V9 } from "./scenario-v9.ts";
import { SCENARIO_V10 } from "./scenario-v10.ts";
import { SCENARIO_V11 } from "./scenario-v11.ts";
import type { Scenario } from "./types.ts";

const SCENARIOS: Readonly<Record<9 | 10 | 11, Scenario>> = Object.freeze({
  9: SCENARIO_V9,
  10: SCENARIO_V10,
  11: SCENARIO_V11,
});

/** Resolves only published historical and current scenario versions. */
export function scenarioForVersion(version: number): Scenario | null {
  return version === 9 || version === 10 || version === 11 ? SCENARIOS[version] : null;
}
