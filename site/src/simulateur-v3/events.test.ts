import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { emitSimulatorV3Event } from "./events.ts";

test("domain analytics dispatches the exact decision_confirmed event", () => {
  const target = new EventTarget();
  const detail = { type: "decision_confirmed" as const, chapter: 2, position: 7 };
  let received: Event | undefined;
  let dispatchCount = 0;

  target.addEventListener("simulateur-v3:evenement", (event) => {
    dispatchCount += 1;
    received = event;
  });

  emitSimulatorV3Event(detail, target);

  assert.ok(received instanceof CustomEvent);
  assert.equal(dispatchCount, 1);
  assert.deepEqual(received.detail, detail);
});

test("domain analytics source excludes identifying or decision-specific fields", () => {
  const source = readFileSync(new URL("./events.ts", import.meta.url), "utf8");
  for (const forbiddenKey of ["decisionId", "optionId", "userId", "email", "territoire"]) {
    assert.equal(source.includes(forbiddenKey), false, `forbidden key: ${forbiddenKey}`);
  }
});
