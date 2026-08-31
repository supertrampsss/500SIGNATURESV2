import { writeFileSync } from "node:fs";

import { SCENARIO_V3 as SCENARIO_V3_PRE_REFACTOR } from "../src/simulateur-v3/scenario.ts";

const output = [
  'import type { Scenario } from "./types.ts";',
  "",
  "// Generated once from the pre-V10 scenario. Keep this file self-contained.",
  "export const SCENARIO_V9_SNAPSHOT: Scenario = Object.freeze(",
  `${JSON.stringify(SCENARIO_V3_PRE_REFACTOR, null, 2)}`,
  ");",
  "",
].join("\n");

writeFileSync(new URL("../src/simulateur-v3/scenario-v9.snapshot.ts", import.meta.url), output);
