import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { emettreInterface, type EvenementInterface } from "./evenements-interface.ts";

test("les événements d'interface passent par le document sans exprimer de choix", () => {
  const source = readFileSync(new URL("./evenements-interface.ts", import.meta.url), "utf8");
  assert.match(source, /interface:evenement/);
  assert.doesNotMatch(source, /mesureId|adopte|rejete|tampon/);

  const global = globalThis as Record<string, unknown>;
  const ancien = global.document;
  const recus: EvenementInterface[] = [];
  global.document = {
    dispatchEvent: (evenement: { type: string; detail: EvenementInterface }) => {
      assert.equal(evenement.type, "interface:evenement");
      recus.push(evenement.detail);
      return true;
    },
  };
  try {
    emettreInterface({ type: "navigation", destination: "territoires" });
    assert.deepEqual(recus, [{ type: "navigation", destination: "territoires" }]);
  } finally {
    if (ancien === undefined) delete global.document;
    else global.document = ancien;
  }
});

test("l'interface branche les quatre gestes sans transport ni persistance", () => {
  const source = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
  assert.match(source, /type: "navigation"/);
  assert.match(source, /type: "territoire_recherche"/);
  assert.match(source, /type: "preuve_ouverte"/);
  assert.match(source, /type: "simulateur_abandon"/);
  assert.doesNotMatch(source, /fetch\([^)]*interface:evenement|localStorage[^\n]*interface:evenement/);
});
