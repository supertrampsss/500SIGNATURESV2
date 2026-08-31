import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { BUDGET_ESTIMATES } from "./budget-registry.ts";
import { POLICY_SOURCES } from "./policy-sources.ts";
import { SCENARIO_V10_CATALOGUE } from "./scenario-v10-catalogue.ts";

const ROOT = dirname(fileURLToPath(import.meta.url));
type ProductionFile = { name: string; source: string };

function productionFilesIn(directory: string, prefix = ""): ProductionFile[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = prefix.length > 0 ? `${prefix}/${entry.name}` : entry.name;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionFilesIn(path, name);
    if (!entry.isFile() || !entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) return [];
    return [{ name, source: readFileSync(path, "utf8") }];
  });
}

const productionFiles = productionFilesIn(ROOT);

test("le scan causal couvre aussi les modules de politiques", () => {
  assert.ok(productionFiles.some(({ name }) => name === "policies/education.ts"));
});

test("aucun générateur causal ou fallback éditorial ne revient en production", () => {
  const forbidden = [
    "continuité du dispositif",
    "marges de réforme non mobilisées",
    "supportEffects(",
    "measure.reactions",
    "adoptReactions",
    "mirrorEffects",
    "modeledIndicatorEffects",
    "modeledGroupEffects",
  ];
  for (const { name, source } of productionFiles) {
    for (const token of forbidden) assert.equal(source.includes(token), false, `${name}:${token}`);
  }
});

test("le marqueur historique reste isolé dans la migration de stockage", () => {
  const carryingMarker = productionFiles
    .filter(({ source }) => source.includes(":model:"))
    .map(({ name }) => name);
  assert.deepEqual(carryingMarker, ["storage.ts"]);
});

test("chaque chiffrage V10 et chaque flux renvoie à une source primaire déclarée", () => {
  const referenced = new Set(SCENARIO_V10_CATALOGUE.decisions.flatMap((decision) => decision.options.flatMap((option) => {
    const localOptionId = option.id.split(":").at(-1)!;
    return option.budgetProfile.estimateKey === null ? [] : [`${decision.id}:${localOptionId}:${option.budgetProfile.estimateKey}`];
  })));
  for (const [join, estimate] of Object.entries(BUDGET_ESTIMATES)) {
    assert.ok(referenced.has(join), `${join}:orphan`);
    for (const sourceKey of estimate.sourceKeys) assert.ok(sourceKey in POLICY_SOURCES, `${join}:${sourceKey}`);
    for (const flow of estimate.transitionFlows) assert.ok(flow.sourceKey in POLICY_SOURCES, `${join}:${flow.sourceKey}`);
  }
});
