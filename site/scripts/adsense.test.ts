import assert from "node:assert/strict";
import test from "node:test";
import { codeAdsense, contenuAdsTxt, identifiantAdsense, injecterAdsense } from "./adsense.ts";

const ID = "ca-pub-1234567890123456";

test("AdSense reste inactif sans identifiant et refuse les valeurs inventées", () => {
  assert.equal(identifiantAdsense(undefined), null);
  assert.equal(injecterAdsense("<head></head>", undefined), "<head></head>");
  assert.throws(() => identifiantAdsense("ca-pub-demo"), /identifiant AdSense/);
});

test("le script standard est ajouté une seule fois avec l'identifiant fourni", () => {
  const html = injecterAdsense("<head></head>", ID);
  assert.equal(html, `<head>  ${codeAdsense(ID)}\n  </head>`);
  assert.equal(injecterAdsense(html, ID), html);
});

test("ads.txt porte l'identifiant pub sans le préfixe ca-", () => {
  assert.equal(contenuAdsTxt(ID), "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
  assert.equal(contenuAdsTxt(undefined), null);
});
