import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { SCENARIO_V9_SNAPSHOT } from "./scenario-v9.snapshot.ts";

const SNAPSHOT_SHA256 = "8cf60e4eaaf388dbecf60be015f8838f2cb9437587621e4a42f7740cd28ecc3d";
const snapshotUrl = new URL("./scenario-v9.snapshot.ts", import.meta.url);
const scriptUrl = new URL("../../scripts/snapshot-scenario-v9.ts", import.meta.url);

test("le littéral V9 est intègre, versionné et autonome", () => {
  assert.equal(SCENARIO_V9_SNAPSHOT.version, 9);
  assert.equal(SCENARIO_V9_SNAPSHOT.chapters.length, 8);
  assert.equal(SCENARIO_V9_SNAPSHOT.decisions.length, 60);
  assert.equal(
    createHash("sha256").update(JSON.stringify(SCENARIO_V9_SNAPSHOT)).digest("hex"),
    SNAPSHOT_SHA256,
  );

  const source = readFileSync(snapshotUrl, "utf8");
  assert.match(source, /^import type \{ Scenario \} from "\.\/types\.ts";$/m);
  assert.doesNotMatch(source, /^import (?!type )/m);
  assert.doesNotMatch(source, /from\s+["'][^"']*(polic|consequence|registry|topology)/i);
});

test("le graphe du snapshot V9 est gelé en profondeur", () => {
  const option = SCENARIO_V9_SNAPSHOT.decisions[0]!.options[0]!;
  const label = option.label;

  assert.throws(() => {
    option.label = "Mutation interdite";
  }, TypeError);
  assert.equal(option.label, label);
});

test("le script de capture refuse d'écraser le littéral V9", () => {
  assert.throws(() => {
    execFileSync(process.execPath, ["--experimental-strip-types", fileURLToPath(scriptUrl)], {
      cwd: new URL("../..", import.meta.url),
      stdio: "pipe",
    });
  }, /Refusing to overwrite existing V9 snapshot/);
});
