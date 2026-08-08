/**
 * « Ma feuille d'impôts ». Le lecteur a l'avis sous les yeux : il compte. Deux
 * choses le feraient décrocher — un total qui ne tombe pas sur 1 000 €, et une
 * ventilation calculée sur un millésime amputé d'un bénéficiaire.
 *
 * Les montants employés ici sont ceux que le site publie : Bordeaux (33063) et
 * Aillas (33002), millésimes 2024 et 2025, taxe foncière sur les propriétés
 * bâties.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Territoire } from "./donnees.ts";
import {
  BENEFICIAIRES,
  dernierExerciceComplet,
  feuilleDImpots,
  rendu,
  repartirSurMille,
} from "./feuille-impots.ts";

const BORDEAUX: Record<string, Record<string, number>> = {
  dgfip_produit_foncier_bati: { "2024": 242_316_385, "2025": 248_422_691 },
  dgfip_taxe_fonciere_intercommunalite: { "2024": 1_001_907, "2025": 2_537_198 },
  dgfip_taxe_fonciere_ordures_menageres: { "2024": 39_549_720, "2025": 40_802_541 },
  dgfip_taxe_fonciere_frais_etat: { "2024": 10_692_462, "2025": 11_029_065 },
  dgfip_taxe_fonciere_taxes_annexes: { "2024": 2_469_864, "2025": 2_543_239 },
};

/** Aillas : aucune taxe d'enlèvement des ordures ménagères. Plus d'une commune
 *  de Gironde sur trois est dans ce cas. */
const AILLAS: Record<string, Record<string, number>> = {
  dgfip_produit_foncier_bati: { "2025": 290_872 },
  dgfip_taxe_fonciere_intercommunalite: { "2025": 36_251 },
  dgfip_taxe_fonciere_ordures_menageres: { "2025": 0 },
  dgfip_taxe_fonciere_frais_etat: { "2025": 10_272 },
  dgfip_taxe_fonciere_taxes_annexes: { "2025": 4_707 },
};

function territoire(nom: string, series: Record<string, Record<string, number>>): Territoire {
  return { nom, parent: "33", population: null, drapeaux: {}, series };
}

/** Le gabarit est indenté sur plusieurs lignes : on compare le texte, pas sa
 *  mise en page. */
function plat(html: string): string {
  return html.replace(/\s+/g, " ");
}

/** Cinq arrondis au plus près, chacun dans son coin : ce que la répartition des
 *  restes existe pour ne pas faire. */
function naif(valeurs: number[], total: number): number[] {
  return valeurs.map((v) => Math.round((v / total) * 1000));
}

test("Bordeaux 2025 : la commune prend 814 € des 1 000 € de l'avis", () => {
  const feuille = feuilleDImpots(territoire("Bordeaux", BORDEAUX));
  assert.ok(feuille);
  assert.equal(feuille.exercice, "2025");
  assert.equal(feuille.total, 305_334_734);
  assert.deepEqual(
    feuille.parts.map((p) => [p.libelle, p.montant, p.surMille]),
    [
      ["La commune", 248_422_691, 814],
      ["Les ordures ménagères", 40_802_541, 134],
      ["Les frais de gestion de l'État", 11_029_065, 36],
      ["Les syndicats et taxes spéciales", 2_543_239, 8],
      ["L'intercommunalité", 2_537_198, 8],
    ],
  );
  assert.equal(feuille.parts[0].pourcentage.toFixed(2), "81.36");
  assert.equal(feuille.parts[1].pourcentage.toFixed(2), "13.36");
});

test("les cinq parts somment à 1 000 € exactement, la plus lourde d'abord", () => {
  const feuille = feuilleDImpots(territoire("Bordeaux", BORDEAUX));
  assert.ok(feuille);
  assert.equal(feuille.parts.length, 5);
  assert.equal(
    feuille.parts.reduce((somme, p) => somme + p.surMille, 0),
    1000,
  );
  assert.ok(feuille.parts.every((p, i) => i === 0 || feuille.parts[i - 1].montant >= p.montant));
  assert.equal(
    feuille.parts.reduce((somme, p) => somme + p.montant, 0),
    feuille.total,
  );
});

test("la répartition des restes rattrape les 998 que cinq arrondis isolés produisent", () => {
  // Cinq parts dont quatre à 199,4 et une à 202,4 : chacune arrondie dans son
  // coin descend, et l'avis affiche 998 € au lieu de 1 000.
  const valeurs = [1012, 997, 997, 997, 997];
  assert.equal(
    naif(valeurs, 5000).reduce((a, b) => a + b, 0),
    998,
  );
  const parts = repartirSurMille(valeurs, 5000);
  assert.deepEqual(parts, [203, 200, 199, 199, 199]);
  assert.equal(
    parts.reduce((a, b) => a + b, 0),
    1000,
  );
});

test("elle rattrape aussi les 1 001 que produit l'arrondi vers le haut", () => {
  // Une part à 333,33 et quatre à 166,67 : quatre montées d'un cran font
  // dépasser l'avis.
  const valeurs = [2, 1, 1, 1, 1];
  assert.equal(
    naif(valeurs, 6).reduce((a, b) => a + b, 0),
    1001,
  );
  const parts = repartirSurMille(valeurs, 6);
  // Les quatre décimales sont strictement égales : c'est le classement des
  // parts qui départage, et les euros restants vont aux plus lourdes.
  assert.deepEqual(parts, [333, 167, 167, 167, 166]);
  assert.equal(
    parts.reduce((a, b) => a + b, 0),
    1000,
  );
});

test("cinq parts parfaitement égales font cinq fois 200 €, sans reste à placer", () => {
  assert.deepEqual(repartirSurMille([7, 7, 7, 7, 7], 35), [200, 200, 200, 200, 200]);
});

test("une part écrasante ne vole pas l'euro des miettes, et l'inverse non plus", () => {
  // 999,996 contre quatre fois 0,001 : le seul euro restant revient à la plus
  // forte décimale, pas au premier de la liste par commodité.
  assert.deepEqual(repartirSurMille([999_996, 1, 1, 1, 1], 1_000_000), [1000, 0, 0, 0, 0]);
  // Le cas symétrique : la grosse part tombe pile, les miettes se partagent le
  // reste sans qu'aucune n'en reçoive deux.
  const parts = repartirSurMille([900, 30, 30, 20, 20], 1000);
  assert.deepEqual(parts, [900, 30, 30, 20, 20]);
  assert.equal(
    parts.reduce((a, b) => a + b, 0),
    1000,
  );
});

test("Aillas ne lève pas d'ordures ménagères : quatre lignes, toujours 1 000 €", () => {
  const feuille = feuilleDImpots(territoire("Aillas", AILLAS));
  assert.ok(feuille);
  assert.deepEqual(
    feuille.parts.map((p) => [p.libelle, p.surMille]),
    [
      ["La commune", 850],
      ["L'intercommunalité", 106],
      ["Les frais de gestion de l'État", 30],
      ["Les syndicats et taxes spéciales", 14],
      ["Les ordures ménagères", 0],
    ],
  );
  assert.equal(
    feuille.parts.reduce((somme, p) => somme + p.surMille, 0),
    1000,
  );
  // La ventilation est communale : à Bordeaux les ordures pèsent 134 € du
  // même millier, ici rien. Une moyenne nationale se tromperait des deux côtés.
  const html = plat(rendu(territoire("Aillas", AILLAS)));
  assert.doesNotMatch(html, /ordures/);
  assert.doesNotMatch(html, /class="cent__part">0 €/);
  assert.equal((html.match(/<li /g) ?? []).length, 4);
});

test("un millésime amputé d'un bénéficiaire fait reculer d'un an", () => {
  assert.equal(dernierExerciceComplet(BORDEAUX), "2025");
  const ampute = {
    ...BORDEAUX,
    dgfip_taxe_fonciere_frais_etat: { "2024": 10_692_462 },
  };
  // Diviser par un avis privé des frais de gestion donnerait des parts
  // plausibles et fausses, sans que rien ne l'indique à l'écran.
  assert.equal(dernierExerciceComplet(ampute), "2024");
  const feuille = feuilleDImpots(territoire("Bordeaux", ampute));
  assert.equal(feuille?.exercice, "2024");
  assert.equal(feuille?.total, 296_030_338);
  assert.match(plat(rendu(territoire("Bordeaux", ampute))), /taxe foncière 2024/);
});

test("sans millésime complet, sans série ou sans avis, le bloc n'écrit rien", () => {
  const jamaisComplet = {
    ...BORDEAUX,
    dgfip_taxe_fonciere_taxes_annexes: { "2023": 2_400_000 },
  };
  assert.equal(dernierExerciceComplet(jamaisComplet), null);
  assert.equal(feuilleDImpots(territoire("Bordeaux", jamaisComplet)), null);
  assert.equal(rendu(territoire("Bordeaux", jamaisComplet)), "");

  const sansIndicateur = { ...BORDEAUX };
  delete sansIndicateur.dgfip_taxe_fonciere_intercommunalite;
  assert.equal(feuilleDImpots(territoire("Bordeaux", sansIndicateur)), null);
  assert.equal(rendu(territoire("Bordeaux", {})), "");

  // Un avis nul ferait une division par zéro : cinq parts « NaN € ».
  const nul = Object.fromEntries(BENEFICIAIRES.map(([id]) => [id, { "2025": 0 }]));
  assert.equal(feuilleDImpots(territoire("Bordeaux", nul)), null);
  assert.equal(rendu(territoire("Bordeaux", nul)), "");
});

test("le bloc dit le dénominateur, le millésime et le total, et rien de plus", () => {
  const html = plat(rendu(territoire("Bordeaux", BORDEAUX)));
  assert.match(html, /<h3>Ma feuille d'impôts/);
  assert.match(html, /taxe foncière 2025/);
  assert.match(
    html,
    /Sur 1 000 € d'avis de taxe foncière bâtie à Bordeaux, à qui va chaque euro\./,
  );
  assert.match(html, /Total encaissé en 2025 : 305,3 M€\./);
  assert.match(html, /<span class="cent__part">814 €<\/span>/);
  assert.match(html, /La commune <span class="camembert__montant">248,4 M€/);
  // Une seule ligne de texte, aucun repli pédagogique, aucun paragraphe de
  // commentaire : le client l'a demandé deux fois.
  assert.equal((html.match(/<p/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<details|<summary/);
});

test("chaque ligne porte son indicateur, pour renvoyer vers son détail", () => {
  const html = rendu(territoire("Bordeaux", BORDEAUX));
  for (const [id] of BENEFICIAIRES) {
    assert.match(html, new RegExp(`data-indicateur="${id}"`));
  }
});

test("aucun tiret cadratin ni demi-cadratin dans les chaînes produites", () => {
  assert.doesNotMatch(rendu(territoire("Bordeaux", BORDEAUX)), /[—–]/);
  assert.doesNotMatch(rendu(territoire("Aillas", AILLAS)), /[—–]/);
});

test("le nom de la commune est échappé", () => {
  const html = rendu(territoire('L\'"Île" <script>', BORDEAUX));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /L&#39;&quot;Île&quot; &lt;script&gt;/);
});
