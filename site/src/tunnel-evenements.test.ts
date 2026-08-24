import assert from "node:assert/strict";
import { test } from "node:test";

import { emettreEvenement, type EvenementTunnel } from "./tunnel-evenements.ts";
import { partagerBilan, telechargerCarteBilan } from "./tunnel.ts";

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

test("Web Share envoie la carte anonyme lorsque le navigateur accepte le fichier", async () => {
  const carte = { name: "bilan-conseil.svg", type: "image/svg+xml" } as File;
  let fichiers: readonly File[] | undefined;
  const resultat = await partagerBilan("Le bilan", "https://exemple.test/defi", {
    canShare: (donnees) => Array.isArray(donnees.files) && donnees.files[0] === carte,
    share: async (donnees) => { fichiers = donnees.files; },
  }, undefined, { carte });
  assert.equal(resultat, "partage");
  assert.deepEqual(fichiers, [carte]);
});

test("sans partage de fichier, Web Share reçoit le bilan texte et son URL", async () => {
  const carte = { name: "bilan-conseil.svg", type: "image/svg+xml" } as File;
  let partage = 0;
  let copie = 0;
  let donneesPartagees: { text?: string; url?: string; files?: File[] } | undefined;
  const resultat = await partagerBilan("Le bilan", "https://exemple.test/defi", {
    canShare: () => false,
    share: async (donnees) => { partage++; donneesPartagees = donnees; },
    clipboard: { writeText: async () => { copie++; } },
  }, undefined, { carte });
  assert.equal(resultat, "partage");
  assert.equal(partage, 1);
  assert.equal(copie, 0);
  assert.deepEqual(donneesPartagees, { title: "Mon bilan du conseil", text: "Le bilan", url: "https://exemple.test/defi" });
});

test("un échec de partage et de copie télécharge clairement la carte locale", async () => {
  const carte = { name: "bilan-conseil.svg", type: "image/svg+xml" } as File;
  const telecharges: File[] = [];
  const resultat = await partagerBilan("Le bilan", "https://exemple.test/defi", {
    canShare: () => true,
    share: async () => { throw new Error("annulé"); },
    clipboard: { writeText: async () => { throw new Error("refus"); } },
  }, undefined, { carte, telecharger: (fichier) => { telecharges.push(fichier); } });
  assert.equal(resultat, "telechargement");
  assert.deepEqual(telecharges, [carte]);
});

test("le téléchargement local crée puis libère une URL de carte", () => {
  const global = globalThis as Record<string, unknown>;
  const ancienDocument = global.document;
  const ancienURL = global.URL;
  const carte = { name: "bilan-conseil.svg", type: "image/svg+xml" } as File;
  const clics: string[] = [];
  const liberees: string[] = [];
  try {
    global.document = { createElement: () => ({ href: "", download: "", click() { clics.push(this.download); } }) };
    global.URL = { createObjectURL: (fichier: File) => { assert.equal(fichier, carte); return "blob:carte"; }, revokeObjectURL: (url: string) => { liberees.push(url); } };
    telechargerCarteBilan(carte);
    assert.deepEqual(clics, ["bilan-conseil.svg"]);
    assert.deepEqual(liberees, ["blob:carte"]);
  } finally {
    if (ancienDocument === undefined) delete global.document;
    else global.document = ancienDocument;
    if (ancienURL === undefined) delete global.URL;
    else global.URL = ancienURL;
  }
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

test("Web Share conserve navigator comme receveur", async () => {
  const navigateur = {
    share: async function(this: unknown) {
      assert.equal(this, navigateur);
    },
  };
  assert.equal(await partagerBilan("Le bilan", "https://exemple.test/defi", navigateur, undefined), "partage");
});

test("le presse-papiers conserve son receveur", async () => {
  const pressePapiers = {
    writeText: async function(this: unknown, texte: string) {
      assert.equal(this, pressePapiers);
      assert.equal(texte, "Le bilan");
    },
  };
  assert.equal(await partagerBilan("Le bilan", "https://exemple.test/defi", { clipboard: pressePapiers }, undefined), "copie");
});

test("les getters Web API qui échouent repartent vers l'invite", async () => {
  const erreurs = [
    Object.defineProperty({}, "share", { get: () => { throw new Error("share"); } }),
    Object.defineProperty({}, "clipboard", { get: () => { throw new Error("clipboard"); } }),
    { clipboard: Object.defineProperty({}, "writeText", { get: () => { throw new Error("writeText"); } }) },
  ];
  for (const navigateur of erreurs) {
    let invites = 0;
    assert.equal(await partagerBilan("Le bilan", "https://exemple.test/defi", navigateur, () => { invites++; }), "invite");
    assert.equal(invites, 1);
  }
});
