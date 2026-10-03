import assert from "node:assert/strict";
import test from "node:test";
import { codeAdsense, contenuAdsTxt, identifiantAdsense, injecterAdsense } from "./adsense.ts";

const ID = "ca-pub-1234567890123456";

test("AdSense reste inactif sans identifiant et refuse les valeurs inventées", () => {
  assert.equal(identifiantAdsense(undefined), null);
  assert.equal(injecterAdsense("<head></head>", undefined), "<head></head>");
  assert.throws(() => identifiantAdsense("ca-pub-demo"), /identifiant AdSense/);
});

// Régressions observées : un SDK partait avant consentement et un identifiant
// statique empêchait la configuration de déploiement de remplacer le mauvais.
test("la vérification du compte n'émet aucune requête publicitaire", () => {
  const html = injecterAdsense("<head></head>", ID);
  assert.equal(html, `<head>  ${codeAdsense(ID)}\n  </head>`);
  assert.match(html, /name="google-adsense-account"/);
  assert.ok(!html.includes("<script"));
  assert.equal(injecterAdsense(html, ID), html);
});

test("un ancien chargeur publicitaire ne peut contourner la désactivation", () => {
  const shell = '<head><script src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-670518726201125"></script></head>';
  assert.throws(() => injecterAdsense(shell, undefined), /consentement/);
  assert.throws(() => injecterAdsense(shell, ID), /consentement/);
});

test("ads.txt porte l'identifiant pub sans le préfixe ca-", () => {
  assert.equal(contenuAdsTxt(ID), "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
  assert.equal(contenuAdsTxt(undefined), null);
});
