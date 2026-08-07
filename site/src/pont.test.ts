/**
 * Un enchaînement qui ne boucle pas ne s'explique pas, il s'enlève.
 *
 * Le pont affirme que l'épargne brute *est* la différence des deux premières
 * lignes, et que la dernière *est* ce qui reste après les six suivantes. Ce
 * sont des identités que l'OFGL publie ; le bloc les recalcule et les
 * confronte avant de s'afficher. Ces tests fixent les trois contrôles et le
 * comportement quand l'un d'eux échoue.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { marches, montant, rendu } from "./pont.ts";
import type { Territoire } from "./donnees.ts";

/** Espace fine insécable : la typographie française avant une unité. */
const FINE = "\u202f";

/**
 * Bordeaux, exercice 2025, comptes du budget principal publiés par l'OFGL.
 * Des valeurs réelles plutôt que des ronds : les identités du pont se vérifient
 * au centime sur des montants à neuf chiffres, et c'est là qu'un contrôle trop
 * serré ou une soustraction en flottant se verrait.
 */
const COMPTES = {
  ofgl_recettes_fonctionnement: 417_137_958.52,
  ofgl_depenses_fonctionnement: 369_011_621.25,
  ofgl_epargne_brute: 48_126_337.27,
  ofgl_epargne_nette: 14_392_071.16,
  ofgl_remboursements_d_emprunts_hors_gad: 33_734_266.11,
  ofgl_recettes_d_investissement_hors_emprunts: 28_524_787.95,
  ofgl_emprunts_hors_gad: 91_001_000.0,
  ofgl_depenses_d_investissement_hors_remb: 135_965_988.05,
  ofgl_recettes_totales: 536_663_746.47,
  ofgl_depenses_totales: 538_711_875.41,
};

function territoire(comptes: Record<string, number>): Territoire {
  return {
    nom: "Bordeaux",
    parent: "33",
    population: 265_000,
    drapeaux: {},
    series: Object.fromEntries(Object.entries(comptes).map(([id, v]) => [id, { "2025": v }])),
  };
}

const BORDEAUX = territoire(COMPTES);

test("les neuf marches s'enchaînent des recettes au solde", () => {
  const etapes = marches(BORDEAUX, "2025");
  assert.ok(etapes);
  assert.deepEqual(
    etapes.map((e) => e.role),
    ["depart", "flux", "palier", "flux", "palier", "flux", "flux", "flux", "arrivee"],
  );
  // Une sortie porte son signe : c'est ce qui fait du pont une addition.
  assert.equal(etapes[1].montant, -369_011_621.25);
  assert.equal(etapes[2].montant, 48_126_337.27);
  // 536 663 746,47 − 538 711 875,41
  assert.ok(Math.abs((etapes[8].montant as number) + 2_048_128.94) < 0.01);
});

test("chaque palier se recalcule depuis ses termes", () => {
  const etapes = marches(BORDEAUX, "2025") as NonNullable<ReturnType<typeof marches>>;
  const [depart, fonctionnement, brute, remboursements, nette, recettesInv, emprunts, depensesInv, arrivee] =
    etapes.map((e) => e.montant);
  assert.ok(Math.abs(depart + fonctionnement - brute) < 1);
  assert.ok(Math.abs(brute + remboursements - nette) < 1);
  assert.ok(Math.abs(nette + recettesInv + emprunts + depensesInv - arrivee) < 1);
});

test("un palier qui ne boucle pas retire le pont entier", () => {
  // L'épargne brute publiée démentie d'un million : le bloc ne montre pas huit
  // marches justes et une fausse, il ne montre rien.
  const fausse = territoire({ ...COMPTES, ofgl_epargne_brute: 49_126_337.27 });
  assert.equal(marches(fausse, "2025"), null);
  assert.equal(rendu(fausse, "2025"), "");
});

test("le bouclage de la section d'investissement est contrôlé lui aussi", () => {
  const fausse = territoire({ ...COMPTES, ofgl_depenses_totales: 500_000_000 });
  assert.equal(marches(fausse, "2025"), null);
});

test("une grandeur absente retire le pont, elle ne le tronque pas", () => {
  const partiel = { ...COMPTES } as Record<string, number>;
  delete partiel.ofgl_emprunts_hors_gad;
  assert.equal(marches(territoire(partiel), "2025"), null);
});

test("l'arrondi de publication ne casse pas le pont", () => {
  // Cent euros d'écart sur un demi-milliard, c'est l'arrondi ; la tolérance
  // vaut un millionième des recettes totales, soit environ 537 €.
  const arrondie = territoire({ ...COMPTES, ofgl_epargne_brute: 48_126_437.27 });
  assert.notEqual(marches(arrondie, "2025"), null);
});

test("un exercice sans comptes ne produit pas de bloc", () => {
  assert.equal(rendu(BORDEAUX, null), "");
  assert.equal(rendu(BORDEAUX, "2019"), "");
});

test("les montants se lisent à l'échelle de la collectivité", () => {
  assert.equal(montant(417_137_958.52), `417,1${FINE}M€`);
  assert.equal(montant(-369_011_621.25), `−369,0${FINE}M€`);
  assert.equal(montant(1_234_567_890), `1,23${FINE}Md€`);
  assert.equal(montant(45_600), `46${FINE}k€`);
  assert.equal(montant(-820), `−820${FINE}€`);
});

test("le bloc dit son exercice, sa source et que ce n'est pas un déficit d'État", () => {
  const html = rendu(BORDEAUX, "2025");
  assert.match(html, /exercice 2025/);
  assert.match(html, /Épargne brute/);
  assert.match(html, new RegExp(`417,1${FINE}M€`));
  assert.match(html, /Observatoire des finances/);
  assert.match(html, /Ce n&#39;est pas un déficit au sens de l&#39;État/);
  // Replié : neuf marches ouvertes pousseraient le reste de la fiche hors
  // de l'écran.
  assert.match(html, /^<details class="repli pont">/);
  assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
});
