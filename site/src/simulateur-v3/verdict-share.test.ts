import assert from "node:assert/strict";
import test from "node:test";

import type { MandateVerdictViewModel } from "./verdict.ts";
import { buildVerdictShare, offerVerdictShare } from "./verdict-share.ts";

const VIEW: MandateVerdictViewModel = {
  headline: "La trajectoire est devenue crédible. Le compromis tient encore.",
  summary: "96 arbitrages rendus.",
  annualBalance: -42_000,
  annualBalanceDelta: 111_000,
  signals: [
    { key: "growth", label: "Croissance", value: 1.4, initialValue: 0.9, delta: 0.5, descriptor: "Activité modérée" },
    { key: "majority", label: "Pouvoir", value: 54, initialValue: 62, delta: -8, descriptor: "Majorité étroite" },
    { key: "opinion", label: "Opinion", value: 49, initialValue: 58, delta: -9, descriptor: "Pays contestataire" },
  ],
  trajectory: [],
  decisiveChoices: [],
  aftermath: [],
};

test("résume le verdict en deux lignes sans répéter le lien", () => {
  const share = buildVerdictShare(VIEW, "https://example.test/simulateur?version=3");

  assert.equal(share.lignes.length, 2);
  assert.match(share.lignes[0]!, /Solde annuel : -42 milliards d'euros/);
  assert.match(share.lignes[1]!, /Croissance 1,4 %.*Pouvoir 54.*Opinion 49/);
  assert.ok(share.lignes.every((line) => !line.includes(share.permalien)));
  assert.equal(share.image, null);
});

test("utilise le panneau natif avant le presse-papiers", async () => {
  const shares: unknown[] = [];
  const copies: string[] = [];
  const issue = await offerVerdictShare(buildVerdictShare(VIEW, "https://example.test/simulateur"), {
    partager: async (payload) => { shares.push(payload); },
    copier: async (text) => { copies.push(text); },
  });

  assert.equal(issue, "partagé");
  assert.equal(shares.length, 1);
  assert.deepEqual(copies, []);
});

test("propose le texte à copier si les deux API sont indisponibles", async () => {
  const prompts: string[] = [];
  const share = buildVerdictShare(VIEW, "https://example.test/simulateur");
  const issue = await offerVerdictShare(share, {
    proposer: (_message, value) => { prompts.push(value); },
  });

  assert.equal(issue, "proposé");
  assert.equal(prompts.length, 1);
  assert.match(prompts[0]!, /https:\/\/example\.test\/simulateur/);
});

