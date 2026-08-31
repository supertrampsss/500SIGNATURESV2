import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

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
