import assert from "node:assert/strict";
import { test } from "node:test";

import { emettreEvenement, type EvenementTunnel } from "./tunnel-evenements.ts";
import { partagerBilan } from "./tunnel.ts";

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

test("sans presse-papiers, le partage ouvre l'invite exacte", async () => {
  const invites: [string, string][] = [];
  const resultat = await partagerBilan("Le bilan", "https://exemple.test/defi", {}, (titre, texte) => {
    invites.push([titre, texte]);
  });
  assert.equal(resultat, "invite");
  assert.deepEqual(invites, [["Votre bilan, à copier :", "Le bilan"]]);
});

test("un presse-papiers qui refuse ouvre l'invite", async () => {
  let invite = 0;
  const resultat = await partagerBilan("Le bilan", "https://exemple.test/defi", {
    clipboard: { writeText: async () => { throw new Error("refus"); } },
  }, () => { invite++; });
  assert.equal(resultat, "invite");
  assert.equal(invite, 1);
});

test("un presse-papiers qui écrit confirme la copie sans invite", async () => {
  let texteCopie = "";
  let invite = 0;
  const resultat = await partagerBilan("Le bilan", "https://exemple.test/defi", {
    clipboard: { writeText: async (texte) => { texteCopie = texte; } },
  }, () => { invite++; });
  assert.equal(resultat, "copie");
  assert.equal(texteCopie, "Le bilan");
  assert.equal(invite, 0);
});

test("Web Share réussi ne copie pas et n'ouvre pas d'invite", async () => {
  let partage = 0;
  let copie = 0;
  let invite = 0;
  const resultat = await partagerBilan("Le bilan", "https://exemple.test/defi", {
    share: async () => { partage++; },
    clipboard: { writeText: async () => { copie++; } },
  }, () => { invite++; });
  assert.equal(resultat, "partage");
  assert.equal(partage, 1);
  assert.equal(copie, 0);
  assert.equal(invite, 0);
});

test("un refus Web Share reprend le presse-papiers puis l'invite si nécessaire", async () => {
  let copie = 0;
  let invite = 0;
  const resultat = await partagerBilan("Le bilan", "https://exemple.test/defi", {
    share: async () => { throw new Error("annulé"); },
    clipboard: { writeText: async () => { copie++; } },
  }, () => { invite++; });
  assert.equal(resultat, "copie");
  assert.equal(copie, 1);
  assert.equal(invite, 0);
});

test("sans invite disponible, le partage ne rejette pas et signale l'indisponibilité", async () => {
  const resultat = await partagerBilan("Le bilan", "https://exemple.test/defi", {}, undefined);
  assert.equal(resultat, "indisponible");
});

test("une invite qui échoue ne propage jamais son exception", async () => {
  const resultat = await partagerBilan("Le bilan", "https://exemple.test/defi", {}, () => {
    throw new Error("bloquée");
  });
  assert.equal(resultat, "indisponible");
});

test("les refus Share et presse-papiers sans invite restent sans rejet", async () => {
  const resultat = await partagerBilan("Le bilan", "https://exemple.test/defi", {
    share: async () => { throw new Error("annulé"); },
    clipboard: { writeText: async () => { throw new Error("refusé"); } },
  }, undefined);
  assert.equal(resultat, "indisponible");
});
