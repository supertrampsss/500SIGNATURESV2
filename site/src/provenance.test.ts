/**
 * D'où vient une hausse — et quand on n'a pas le droit de le dire.
 *
 * Les montants sont ceux de Bordeaux et de la Gironde, entre 2019 et 2025 :
 * une décomposition se teste sur la matière qui piège, pas sur des nombres
 * ronds qui tombent juste par construction.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Indicateur } from "./donnees.ts";
import { provenance, provenanceDite } from "./provenance.ts";

const M = 1_000_000;

function indicateur(id: string, libelle: string, parent: string | null): Indicateur {
  return {
    id,
    libelle,
    unite: "EUR",
    theme: "budget",
    sommable: true,
    cadre_comptable: null,
    niveaux: ["commune"],
    definition: "",
    definition_technique: "",
    formule: "",
    confiance: "haute",
    badges: [],
    jeu: "ofgl",
    periodes: ["2019", "2025"],
    parent,
  };
}

const CATALOGUE: Indicateur[] = [
  // La hiérarchie est celle que l'OFGL déclare : le fonctionnement et
  // l'investissement sont sous les dépenses totales, avec la variante « hors
  // remb » que le module doit écarter.
  indicateur("ofgl_depenses_fonctionnement", "Dépenses de fonctionnement", "ofgl_depenses_totales"),
  indicateur("ofgl_frais_personnel", "Frais de personnel", "ofgl_depenses_fonctionnement"),
  indicateur("ofgl_achats_et_charges_externes", "Achats et charges externes", "ofgl_depenses_fonctionnement"),
  indicateur("ofgl_charges_financieres", "Charges financières", "ofgl_depenses_fonctionnement"),
  indicateur("ofgl_travaux_en_regie", "Travaux en régie", "ofgl_depenses_fonctionnement"),
  indicateur("ofgl_depenses_totales", "Dépenses totales", null),
  indicateur("ofgl_depenses_investissement", "Dépenses d'investissement", "ofgl_depenses_totales"),
  indicateur("ofgl_depenses_totales_hors_remb", "Dépenses totales hors remb", "ofgl_depenses_totales"),
  indicateur("ofgl_remboursements_d_emprunts_hors_gad", "Remboursements d'emprunts", "ofgl_depenses_investissement"),
  indicateur("ofgl_depenses_d_intervention", "Dépenses d'intervention", null),
  indicateur("ofgl_allocations_apa", "Allocations APA", "ofgl_depenses_d_intervention"),
  indicateur("ofgl_allocations_rsa", "Allocations RSA", "ofgl_depenses_d_intervention"),
];

/** Les séries de Bordeaux, aux montants publiés. */
const BORDEAUX: Record<string, Record<string, number>> = {
  ofgl_depenses_fonctionnement: { 2019: 294.08 * M, 2025: 369.01 * M },
  ofgl_frais_personnel: { 2019: 143.59 * M, 2025: 183.05 * M },
  ofgl_achats_et_charges_externes: { 2019: 64.53 * M, 2025: 85.70 * M },
  // Les deux postes qui restent, agrégés ici pour que la somme soit exacte :
  // le test porte sur la règle, pas sur le nombre de lignes.
  ofgl_charges_financieres: { 2019: 85.96 * M, 2025: 100.26 * M },
};

function lecteur(series: Record<string, Record<string, number>>) {
  return (id: string, exercice: string) => series[id]?.[exercice] ?? null;
}

const lire = lecteur(BORDEAUX);

/* ------------------------------------------------------------ ce qui passe */

test("la variation d'un agrégat se répartit sur ses composantes", () => {
  const p = provenance("ofgl_depenses_fonctionnement", lire, "2019", "2025", CATALOGUE);
  assert.ok(p);
  assert.equal(Math.round(p.delta / M), 75);
  // Les apports somment à la variation du total : c'est ce qui fait de la
  // phrase une attribution et non une illustration.
  assert.equal(Math.round(p.parts.reduce((s, x) => s + x.delta, 0) / M), Math.round(p.delta / M));
  assert.equal(p.parts[0].id, "ofgl_frais_personnel");
});

test("la phrase nomme les postes qui font l'essentiel du mouvement", () => {
  const dite = provenanceDite("ofgl_depenses_fonctionnement", lire, "2019", "2025", CATALOGUE);
  assert.match(dite, /la hausse vient surtout de deux postes/);
  assert.match(dite, /Frais de personnel \+39/);
  assert.match(dite, /Achats et charges externes \+21/);
});

test("un poste absent des deux côtés n'empêche rien", () => {
  // Bordeaux ne publie pas de travaux en régie. Refuser pour autant privait la
  // fiche d'une décomposition dont la somme est pourtant exacte à l'euro.
  assert.ok(provenance("ofgl_depenses_fonctionnement", lire, "2019", "2025", CATALOGUE));
});

test("une variante de périmètre n'est pas une composante", () => {
  // « Dépenses totales hors remb » vaut « totales − remboursements » : le
  // sommer à ses frères compterait près de deux fois le budget. Il est écarté
  // parce que l'identité est vérifiée sur les séries, pas parce qu'il se nomme
  // « hors remb ».
  const series = {
    ofgl_depenses_totales: { 2019: 100 * M, 2025: 130 * M },
    ofgl_depenses_fonctionnement: { 2019: 70 * M, 2025: 88 * M },
    ofgl_depenses_investissement: { 2019: 30 * M, 2025: 42 * M },
    ofgl_remboursements_d_emprunts_hors_gad: { 2019: 8 * M, 2025: 9 * M },
    ofgl_depenses_totales_hors_remb: { 2019: 92 * M, 2025: 121 * M },
  };
  const p = provenance("ofgl_depenses_totales", lecteur(series), "2019", "2025", CATALOGUE);
  assert.ok(p);
  assert.deepEqual(p.parts.map((x) => x.id).sort(), [
    "ofgl_depenses_fonctionnement",
    "ofgl_depenses_investissement",
  ]);
});

/* ------------------------------------------------------------ ce qui bloque */

test("sans l'identité qui la prouve, la variante n'est pas écartée", () => {
  // Mêmes libellés, mais « hors remb » ne vaut plus « totales − remb ». Le
  // module ne peut plus dire que c'est une variante : il refuse plutôt que de
  // se fier au nom.
  const series = {
    ofgl_depenses_totales: { 2019: 100 * M, 2025: 130 * M },
    ofgl_depenses_fonctionnement: { 2019: 70 * M, 2025: 88 * M },
    ofgl_depenses_investissement: { 2019: 30 * M, 2025: 42 * M },
    ofgl_remboursements_d_emprunts_hors_gad: { 2019: 8 * M, 2025: 9 * M },
    ofgl_depenses_totales_hors_remb: { 2019: 55 * M, 2025: 60 * M },
  };
  assert.equal(provenance("ofgl_depenses_totales", lecteur(series), "2019", "2025", CATALOGUE), null);
});

test("une décomposition partielle est refusée, pas complétée", () => {
  // Les dépenses d'intervention n'ont que des composantes choisies : aucune
  // ligne « autres ». Attribuer le mouvement à l'APA et au RSA désignerait des
  // coupables au hasard.
  const series = {
    ofgl_depenses_d_intervention: { 2019: 100 * M, 2025: 130 * M },
    ofgl_allocations_apa: { 2019: 20 * M, 2025: 24 * M },
    ofgl_allocations_rsa: { 2019: 30 * M, 2025: 39 * M },
  };
  assert.equal(
    provenanceDite("ofgl_depenses_d_intervention", lecteur(series), "2019", "2025", CATALOGUE),
    "",
  );
});

test("un poste lisible d'un seul côté fait tomber toute la décomposition", () => {
  // La somme est exacte à l'arrivée : c'est précisément le cas dangereux, la
  // composante nouvelle capterait la totalité du mouvement.
  const series = {
    ofgl_depenses_fonctionnement: { 2019: 60 * M, 2025: 100 * M },
    ofgl_frais_personnel: { 2019: 40 * M, 2025: 60 * M },
    ofgl_achats_et_charges_externes: { 2019: 20 * M, 2025: 25 * M },
    ofgl_charges_financieres: { 2025: 15 * M },
  };
  assert.equal(provenance("ofgl_depenses_fonctionnement", lecteur(series), "2019", "2025", CATALOGUE), null);
});

test("une somme qui ne redonne pas le total est refusée", () => {
  const series = {
    ofgl_depenses_fonctionnement: { 2019: 100 * M, 2025: 130 * M },
    ofgl_frais_personnel: { 2019: 40 * M, 2025: 60 * M },
    ofgl_achats_et_charges_externes: { 2019: 20 * M, 2025: 25 * M },
  };
  assert.equal(provenance("ofgl_depenses_fonctionnement", lecteur(series), "2019", "2025", CATALOGUE), null);
});

test("une composante unique ne décompose rien", () => {
  const series = {
    ofgl_depenses_d_intervention: { 2019: 100 * M, 2025: 130 * M },
    ofgl_allocations_apa: { 2019: 100 * M, 2025: 130 * M },
  };
  assert.equal(provenance("ofgl_depenses_d_intervention", lecteur(series), "2019", "2025", CATALOGUE), null);
});

/* -------------------------------------------------------- ce qui se dit bien */

test("un poste à contre-courant est nommé quand il pèse", () => {
  // La réforme de 2021 en Gironde : les autres impôts explosent, les impôts
  // locaux s'effondrent. N'écrire que la hausse cacherait la moitié du fait.
  const series = {
    ofgl_depenses_fonctionnement: { 2019: 100 * M, 2025: 110 * M },
    ofgl_frais_personnel: { 2019: 40 * M, 2025: 75 * M },
    ofgl_achats_et_charges_externes: { 2019: 30 * M, 2025: 25 * M },
    ofgl_charges_financieres: { 2019: 30 * M, 2025: 10 * M },
  };
  const dite = provenanceDite("ofgl_depenses_fonctionnement", lecteur(series), "2019", "2025", CATALOGUE);
  assert.match(dite, /Frais de personnel \+35/);
  assert.match(dite, /un poste la retient : Charges financières −20/);
});

test("le libellé garde sa capitale : « Concours de l'État », jamais « l'état »", () => {
  const catalogue = [
    indicateur("ofgl_recettes_fonctionnement", "Recettes de fonctionnement", null),
    indicateur("ofgl_concours_de_l_etat", "Concours de l'État", "ofgl_recettes_fonctionnement"),
    indicateur("ofgl_impots_et_taxes", "Impôts et taxes", "ofgl_recettes_fonctionnement"),
  ];
  const series = {
    ofgl_recettes_fonctionnement: { 2019: 100 * M, 2025: 130 * M },
    ofgl_concours_de_l_etat: { 2019: 40 * M, 2025: 60 * M },
    ofgl_impots_et_taxes: { 2019: 60 * M, 2025: 70 * M },
  };
  const dite = provenanceDite("ofgl_recettes_fonctionnement", lecteur(series), "2019", "2025", catalogue);
  assert.match(dite, /Concours de l'État/);
  assert.doesNotMatch(dite, /l'etat|l'état/);
});

test("la clause s'accroche à une phrase, elle n'en commence pas une", () => {
  const dite = provenanceDite("ofgl_depenses_fonctionnement", lire, "2019", "2025", CATALOGUE);
  assert.ok(dite.startsWith(" ; "), dite);
  assert.ok(!dite.endsWith("."), dite);
});
