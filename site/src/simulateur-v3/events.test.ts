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

test("domain analytics uses document when no target is provided", () => {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const detail = { type: "decision_confirmed" as const, chapter: 2, position: 7 };
  let received: Event | undefined;
  let dispatchCount = 0;
  const fakeDocument = {
    dispatchEvent(event: Event) {
      dispatchCount += 1;
      received = event;
      return true;
    },
  };

  Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDocument });
  try {
    emitSimulatorV3Event(detail);

    assert.equal(dispatchCount, 1);
    assert.ok(received instanceof CustomEvent);
    assert.equal(received.type, "simulateur-v3:evenement");
    assert.deepEqual(received.detail, detail);
  } finally {
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    else delete (globalThis as { document?: unknown }).document;
  }
});

test("domain analytics does nothing when neither target nor document exists", () => {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const customEventDescriptor = Object.getOwnPropertyDescriptor(globalThis, "CustomEvent");
  let customEventCalls = 0;

  Object.defineProperty(globalThis, "document", { configurable: true, value: undefined });
  Object.defineProperty(globalThis, "CustomEvent", {
    configurable: true,
    value: class {
      constructor() {
        customEventCalls += 1;
      }
    },
  });
  try {
    assert.doesNotThrow(() => emitSimulatorV3Event({ type: "campaign_started" }));
    assert.equal(customEventCalls, 0);
  } finally {
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    else delete (globalThis as { document?: unknown }).document;
    if (customEventDescriptor) Object.defineProperty(globalThis, "CustomEvent", customEventDescriptor);
    else delete (globalThis as { CustomEvent?: unknown }).CustomEvent;
  }
});

test("domain analytics source excludes identifying or decision-specific fields", () => {
  const source = readFileSync(new URL("./events.ts", import.meta.url), "utf8");
  for (const forbiddenKey of ["decisionId", "optionId", "userId", "email", "territoire"]) {
    assert.equal(source.includes(forbiddenKey), false, `forbidden key: ${forbiddenKey}`);
  }
});
