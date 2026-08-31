import assert from "node:assert/strict";
import test from "node:test";

import { SCENARIO_V3 as SCENARIO_V3_PRE_REFACTOR } from "./scenario.ts";
import { SCENARIO_V9_SNAPSHOT } from "./scenario-v9.snapshot.ts";

test("le snapshot V9 reproduit exactement le scénario pré-refonte", () => {
  assert.deepEqual(
    JSON.parse(JSON.stringify(SCENARIO_V9_SNAPSHOT)),
    JSON.parse(JSON.stringify(SCENARIO_V3_PRE_REFACTOR)),
  );
});
