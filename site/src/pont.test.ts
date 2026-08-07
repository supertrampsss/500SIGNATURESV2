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

import { marches, montant, rendu, surCentEuros } from "./pont.ts";
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

test("les marches s'enchaînent des recettes au solde, en trois blocs", () => {
  const etapes = marches(BORDEAUX, "2025");
  assert.ok(etapes);
  // Neuf lignes d'affilée se lisent comme une liste ; trois blocs de trois se
  // lisent comme un raisonnement.
  assert.deepEqual(
    etapes.map((e) => e.role),
    ["depart", "flux", "palier", "flux", "palier", "report", "flux", "flux", "flux", "arrivee"],
  );
  assert.deepEqual(
    [...new Set(etapes.map((e) => e.section))],
    ["fonctionnement", "dette", "investissement"],
  );
  // Une sortie porte son signe : c'est ce qui fait du pont une addition.
  assert.equal(etapes[1].montant, -369_011_621.25);
  assert.equal(etapes[2].montant, 48_126_337.27);
  // 536 663 746,47 − 538 711 875,41
  assert.ok(Math.abs((etapes[9].montant as number) + 2_048_128.94) < 0.01);
});

test("chaque bloc s'additionne de lui-même, report compris", () => {
  const etapes = marches(BORDEAUX, "2025") as NonNullable<ReturnType<typeof marches>>;
  // Le report reprend le total du bloc précédent : sans lui, la dernière ligne
  // tomberait d'un calcul dont deux termes sont hors du bloc.
  for (const section of ["fonctionnement", "dette", "investissement"] as const) {
    const bloc = etapes.filter((e) => e.section === section);
    const total = bloc.find((e) => e.role === "palier" || e.role === "arrivee");
    const termes = bloc.filter((e) => e.role !== "palier" && e.role !== "arrivee");
    const somme = termes.reduce((s, e) => s + e.montant, 0);
    // Le bloc « dette » n'a qu'un flux : son palier vaut l'épargne brute plus
    // ce flux, et l'épargne brute est le palier du bloc d'avant.
    const report = section === "dette" ? (etapes[2].montant as number) : 0;
    assert.ok(
      Math.abs(somme + report - (total?.montant as number)) < 1,
      `${section} ne s'additionne pas`,
    );
  }
});

test("le report ne compte pas deux fois : il redit le palier précédent", () => {
  const etapes = marches(BORDEAUX, "2025") as NonNullable<ReturnType<typeof marches>>;
  const nette = etapes.find((e) => e.libelle === "Épargne nette");
  const report = etapes.find((e) => e.role === "report");
  assert.equal(report?.montant, nette?.montant);
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

test("le bloc s'affiche ouvert : c'est la question qu'on vient poser", () => {
  const html = rendu(BORDEAUX, "2025");
  assert.match(html, /^<section class="pont">/);
  // Derrière un triangle à déplier, « d'un euro encaissé à ce qu'il en reste »
  // se rangeait avec les annexes.
  assert.doesNotMatch(html, /<details/);
  assert.match(html, /exercice 2025/);
  assert.match(html, /Épargne brute/);
  assert.match(html, new RegExp(`417,1${FINE}M€`));
  assert.match(html, /Ce n&#39;est pas un déficit au sens de l&#39;État/);
});

test("le signe tient sa colonne : on lit une addition, pas une liste", () => {
  const html = rendu(BORDEAUX, "2025");
  assert.match(html, /<span class="pont__signe" aria-hidden="true">−<\/span>/);
  assert.match(html, /<span class="pont__signe" aria-hidden="true">\+<\/span>/);
  assert.match(html, /<span class="pont__signe" aria-hidden="true">=<\/span>/);
});

test("une phrase remplace les neuf barres à comparer entre elles", () => {
  // 369 011 621,25 / 417 137 958,52 = 88,46 % ;
  // 33 734 266,11 / 417 137 958,52 = 8,09 % ; reste 3,45 %.
  const phrase = surCentEuros(marches(BORDEAUX, "2025") as never);
  assert.match(phrase, new RegExp(`88,46${FINE}€ paient les`));
  assert.match(phrase, new RegExp(`8,09${FINE}€ remboursent`));
  assert.match(phrase, new RegExp(`il reste 3,45${FINE}€`));
  // Et plus aucune barre proportionnelle ligne à ligne.
  assert.doesNotMatch(rendu(BORDEAUX, "2025"), /pont__barre/);
});

test("la source n'encombre plus la barre latérale", () => {
  // Le pavé de méthode est repris en entier sur la page « Données », où l'on
  // va quand on veut la méthode. Dans la fiche, il poussait les chiffres.
  const html = rendu(BORDEAUX, "2025");
  assert.doesNotMatch(html, /Observatoire des finances/);
  assert.doesNotMatch(html, /loi n° 2018-32/);
});
