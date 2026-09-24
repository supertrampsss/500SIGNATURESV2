import { test } from "node:test";
import assert from "node:assert/strict";
import { createDecisionTransition } from "./decision-transition.ts";

function clockStub() {
  let id = 0;
  const jobs = new Map<number, () => void>();
  return {
    clock: { set(fn: () => void) { const key = ++id; jobs.set(key, fn); return key; }, clear(key: unknown) { jobs.delete(key as number); } },
    run() { for (const [key, fn] of [...jobs]) { jobs.delete(key); fn(); } },
    get count() { return jobs.size; },
  };
}

test("one gesture can commit only once until its transition finishes", () => {
  const fake = clockStub();
  const transition = createDecisionTransition(fake.clock);
  const token = transition.begin();
  assert.equal(typeof token, "number");
  assert.equal(transition.begin(), null);
  let applied = 0;
  transition.finish(token!, () => applied++);
  fake.run();
  assert.equal(applied, 1);
  assert.equal(transition.locked, false);
});

test("cancelling navigation clears a queued decision callback", () => {
  const fake = clockStub();
  const transition = createDecisionTransition(fake.clock);
  const token = transition.begin()!;
  let applied = 0;
  transition.finish(token, () => applied++);
  transition.cancel();
  fake.run();
  assert.equal(fake.count, 0);
  assert.equal(applied, 0);
  assert.equal(transition.locked, false);
});
