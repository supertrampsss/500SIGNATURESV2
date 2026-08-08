/**
 * La couche d'évolution décide de ce que le lecteur croit voir bouger : un
 * taux dont la variation serait affichée en % (« +20 % » pour un taux qui
 * gagne 2 points), un territoire absent peint quand même, ou une échelle qui
 * mélangerait hausses et baisses produiraient une carte trompeuse tout en
 * restant « techniquement » fonctionnelle.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  RAMPE_BAISSE,
  RAMPE_HAUSSE,
  coucheEvolution,
  echelleDivergente,
  formaterVariation,
  libelleEvolution,
  modeVariation,
  noteEvolution,
  variationExportee,
} from "./evolution-carte.ts";
import { expressionCouleur } from "./echelle.ts";

/* ---------------------------- unité de la variation ---------------------- */

test("une grandeur additive varie en %, un taux varie en points", () => {
  for (const unite of ["EUR", "count", "mwh", "m2"]) {
    assert.equal(modeVariation(unite), "pourcent", unite);
  }
  for (const unite of ["percent", "rate", "pour_1000_habitants", "pour_1000_logements"]) {
    assert.equal(modeVariation(unite), "points", unite);
  }
});

/* ---------------------------- calcul de la couche ------------------------ */

test("la variation en % se calcule sur les territoires présents les deux années", () => {
  const couche = coucheEvolution(
    { A: 100, B: 50, F: 7 },
    { A: 110, B: 25, E: 7 },
    "pourcent",
  );
  assert.deepEqual(couche.A, { avant: 100, apres: 110, variation: 10 });
  assert.deepEqual(couche.B, { avant: 50, apres: 25, variation: -50 });
  // E n'existe qu'après, F n'existe qu'avant : ni l'un ni l'autre n'a de
  // variation — ils resteront gris.
  assert.deepEqual(Object.keys(couche).sort(), ["A", "B"]);
});

test("une valeur de départ nulle ne produit pas d'infini : pas de valeur du tout", () => {
  const couche = coucheEvolution({ A: 0, B: 10 }, { A: 5, B: 11 }, "pourcent");
  assert.equal(couche.A, undefined);
  assert.ok(couche.B);
});

test("le dénominateur du % est |N−1| : partir de −10 pour arriver à −5 est +50 %", () => {
  const couche = coucheEvolution({ A: -10 }, { A: -5 }, "pourcent");
  assert.equal(couche.A.variation, 50);
});

test("un taux varie en points : de 10 à 12, +2 points — jamais +20 %", () => {
  const couche = coucheEvolution({ A: 10, B: 0 }, { A: 12, B: 3 }, "points");
  assert.equal(couche.A.variation, 2);
  // En points, un départ à zéro est une variation ordinaire, pas un infini.
  assert.equal(couche.B.variation, 3);
});

test("une valeur non finie n'entre pas dans la couche", () => {
  const couche = coucheEvolution({ A: NaN, B: 10 }, { A: 5, B: Infinity }, "points");
  assert.deepEqual(couche, {});
});

/* ---------------------------- échelle divergente ------------------------- */

test("hausses et baisses sont classées séparément, zéro pour pivot", () => {
  const echelle = echelleDivergente([-30, -20, -10, -5, -2, -1, 1, 2, 4, 8, 16, 32]);
  assert.deepEqual(echelle.bornes, [-10, -2, 0, 4, 16]);
  assert.equal(echelle.couleurs.length, echelle.bornes.length + 1);
  // Trois classes de chaque côté : les orangés en dessous de zéro, les bleus
  // au-dessus — jamais une classe à cheval sur le zéro.
  assert.deepEqual(echelle.couleurs.slice(0, 3), RAMPE_BAISSE);
  assert.deepEqual(echelle.couleurs.slice(3), RAMPE_HAUSSE);
  for (let i = 1; i < echelle.bornes.length; i += 1) {
    assert.ok(echelle.bornes[i] > echelle.bornes[i - 1]);
  }
});

test("une variation nulle se range du côté des hausses, pas des baisses", () => {
  const echelle = echelleDivergente([-5, -4, 0, 3, 6]);
  const expression = expressionCouleur({ A: 0 }, echelle, false, {}) as unknown[];
  const couleur = expression[expression.indexOf("A") + 1] as string;
  assert.ok(RAMPE_HAUSSE.includes(couleur), `${couleur} devrait être un bleu`);
  assert.ok(!RAMPE_BAISSE.includes(couleur));
});

test("tout monte : une seule rampe, pas de classe de baisse vide dans la légende", () => {
  const echelle = echelleDivergente([1, 2, 3, 4, 5, 6]);
  assert.ok(!echelle.bornes.includes(0));
  assert.ok(echelle.couleurs.every((c) => RAMPE_HAUSSE.includes(c)));
  const tout = echelleDivergente([-6, -5, -4, -3, -2, -1]);
  assert.ok(tout.couleurs.every((c) => RAMPE_BAISSE.includes(c)));
});

test("un seul côté clairsemé garde son contraste face à l'autre", () => {
  // Deux baisses, trois hausses identiques : une classe de baisse dédupliquée,
  // une classe de hausse unique — chacune avec une teinte encore lisible.
  const echelle = echelleDivergente([-5, -4, 3, 3, 3]);
  assert.deepEqual(echelle.bornes, [-4, 0]);
  assert.equal(echelle.couleurs.length, 3);
  assert.deepEqual(echelle.couleurs.slice(0, 2), [RAMPE_BAISSE[0], RAMPE_BAISSE[2]]);
  assert.equal(echelle.couleurs[2], RAMPE_HAUSSE[1]);
});

test("aucune classe sans donnée", () => {
  assert.deepEqual(echelleDivergente([]), { bornes: [], couleurs: [] });
  assert.deepEqual(echelleDivergente([NaN]), { bornes: [], couleurs: [] });
});

/* ---------------------------- formatage ---------------------------------- */

test("une variation s'affiche signée, avec le moins typographique", () => {
  assert.equal(formaterVariation(12, "EUR", "pourcent"), `+12 %`);
  assert.equal(formaterVariation(-3.24, "EUR", "pourcent"), `−3,2 %`);
});

test("une variation qui s'arrondit à zéro s'écrit « 0 », sans signe", () => {
  assert.equal(formaterVariation(0.04, "EUR", "pourcent"), `0 %`);
  assert.equal(formaterVariation(-0.04, "EUR", "pourcent"), `0 %`);
  assert.equal(formaterVariation(-0.04, "percent", "points"), `0 pt`);
});

test("les points s'écrivent en points, singulier compris", () => {
  assert.equal(formaterVariation(2, "percent", "points"), `+2 pts`);
  assert.equal(formaterVariation(1.5, "percent", "points"), `+1,5 pt`);
  assert.equal(formaterVariation(-2.5, "percent", "points"), `−2,5 pts`);
});

test("les taux pour mille suivent leur conversion d'affichage (÷ 10)", () => {
  // À l'écran, 25 ‰ se lit 2,5 % : ses points suivent la même conversion,
  // sinon l'infobulle contredirait la carte.
  assert.equal(formaterVariation(25, "pour_1000_habitants", "points"), `+2,5 pts`);
  assert.equal(variationExportee(25, "pour_1000_habitants", "points"), 2.5);
  assert.equal(variationExportee(25, "EUR", "pourcent"), 25);
  assert.equal(variationExportee(3, "percent", "points"), 3);
});

/* ---------------------------- légende ------------------------------------ */

test("la légende dit ce qu'elle montre : les deux millésimes et l'unité de la variation", () => {
  assert.equal(libelleEvolution("2023", "2024", "pourcent"), "Évolution 2024 vs 2023, en %");
  assert.equal(libelleEvolution("2023", "2024", "points"), "Évolution 2024 vs 2023, en points");
});

test("la note explique le gris, les points, et la déclinaison par habitant", () => {
  assert.match(noteEvolution("pourcent", false), /gris/);
  assert.match(noteEvolution("points", false), /gagne 2 points/);
  assert.match(noteEvolution("pourcent", true), /par habitant/);
  assert.ok(!noteEvolution("pourcent", false).includes("par habitant"));
});
