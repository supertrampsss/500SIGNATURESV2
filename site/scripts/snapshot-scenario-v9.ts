import { existsSync, writeFileSync } from "node:fs";

import { SCENARIO_V3 as SCENARIO_V3_PRE_REFACTOR } from "../src/simulateur-v3/scenario.ts";

const snapshotUrl = new URL("../src/simulateur-v3/scenario-v9.snapshot.ts", import.meta.url);

if (existsSync(snapshotUrl)) {
  throw new Error("Refusing to overwrite existing V9 snapshot");
}

if (SCENARIO_V3_PRE_REFACTOR.version !== 9) {
  throw new Error(`Expected a V9 scenario, received V${SCENARIO_V3_PRE_REFACTOR.version}`);
}

const output = [
  'import type { Scenario } from "./types.ts";',
  "",
  "// Generated once from the pre-V10 scenario. Keep this file self-contained.",
  "function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {",
  '  if (value !== null && typeof value === "object" && !seen.has(value)) {',
  "    seen.add(value);",
  "    for (const nestedValue of Object.values(value)) deepFreeze(nestedValue, seen);",
  "    Object.freeze(value);",
  "  }",
  "  return value;",
  "}",
  "",
  "export const SCENARIO_V9_SNAPSHOT: Scenario = deepFreeze(",
  `${JSON.stringify(SCENARIO_V3_PRE_REFACTOR, null, 2)}`,
  ");",
  "",
].join("\n");

writeFileSync(snapshotUrl, output);
