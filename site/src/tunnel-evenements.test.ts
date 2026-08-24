import assert from "node:assert/strict";
import { test } from "node:test";

import { emettreEvenement, type EvenementTunnel } from "./tunnel-evenements.ts";

test("les événements du tunnel sont anonymes et passent par le document", () => {
  const global = globalThis as Record<string, unknown>;
  const ancien = global.document;
  const recus: EvenementTunnel[] = [];
  global.document = {
    dispatchEvent: (evenement: { type: string; detail: EvenementTunnel }) => {
      assert.equal(evenement.type, "simulateur:evenement");
      recus.push(evenement.detail);
      return true;
    },
  };
  try {
    emettreEvenement({ type: "decision", acte: 2, numero: 4, verdict: "adopte" });
    assert.deepEqual(recus, [{ type: "decision", acte: 2, numero: 4, verdict: "adopte" }]);
  } finally {
    if (ancien === undefined) delete global.document;
    else global.document = ancien;
  }
});
