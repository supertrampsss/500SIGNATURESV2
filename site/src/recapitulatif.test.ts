/**
 * Le récapitulatif en comptabilité nationale, et la seule chose qu'il affirme :
 * les trois sous-secteurs font le total.
 *
 * Cet écran n'existe que pour ça — c'est le seul endroit du site où l'État, la
 * Sécurité sociale et les collectivités ont le droit d'être additionnés. Sa
 * phrase le dit (« exactement le total publié »), et il faut donc que le lecteur
 * puisse le vérifier sur les chiffres qu'il a sous les yeux.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { mention, rendu, type Recapitulatif } from "./recapitulatif.ts";

/** Les vraies valeurs publiées pour 2025 : c'est leur arrondi qui posait le
 *  problème, et un jeu inventé aux montants ronds ne l'aurait pas montré. */
const RECAPITULATIF: Recapitulatif = {
  exercice: "2025",
  titre: "Tout l'argent public, en comptabilité nationale",
  cadre: "INSEE, comptes nationaux annuels, exercice 2025, montants en millions d'euros (M€)",
  note: "Les budgets réglables du simulateur ne s'additionnent pas entre eux.",
  lignes: [
    { c: "insee_apu_solde_centrales", l: "État et organismes d'administration centrale", v: -130_254_600_000 },
    { c: "insee_apu_solde_asso", l: "Administrations de sécurité sociale", v: -6_722_500_000 },
    { c: "insee_apu_solde_apul", l: "Administrations publiques locales", v: -15_554_900_000 },
  ],
  total: { c: "insee_apu_solde", l: "Toutes administrations publiques", v: -152_532_000_000 },
  ecart: 0,
};

/** Les montants tels qu'ils sont ÉCRITS, relus depuis le rendu : c'est ce que le
 *  lecteur additionne, et donc la seule chose qui prouve la phrase. */
function montantsAffiches(html: string): number[] {
  return [...html.matchAll(/simu__montant nombre">([^<]*)</g)].map((m) =>
    Number(m[1].replace(/−/g, "-").replace(/[^\d,.-]/g, "").replace(",", ".")),
  );
}

test("les trois sous-secteurs affichés font le total affiché", () => {
  // Ils s'affichaient −130 255 / −6 723 / −15 555 sous un total de −152 532 :
  // les trois arrondis montaient, leur somme faisait −152 533, et la phrase
  // « exactement le total publié » était démentie par les chiffres qu'elle
  // commente. L'écart des données valait pourtant bien zéro.
  const html = rendu(RECAPITULATIF);
  const montants = montantsAffiches(html);
  assert.equal(montants.length, 4, html);
  const [a, b, c, total] = montants;
  assert.equal(Number((a + b + c).toFixed(1)), total, `${a} + ${b} + ${c} ≠ ${total}`);
});

test("la phrase n'affirme l'exactitude que si l'écart est nul", () => {
  assert.match(mention(RECAPITULATIF), /exactement le total publié/);
  assert.match(
    mention({ ...RECAPITULATIF, ecart: 4_000_000 }),
    /s&#39;écartent|s'écartent/,
  );
});
