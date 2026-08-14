/**
 * `comparer` met deux ou trois états de l'atelier côte à côte, ligne à ligne.
 *
 * Deux principes à vérifier avant tout le reste : l'alignement se fait sur la
 * paire `(volet, code)`, jamais le libellé ni le code seul — les nomenclatures
 * se recoupent d'un volet à l'autre — et une colonne qui ne touche pas une
 * ligne y laisse `null`, jamais `0` : ce sont deux décisions différentes du
 * lecteur, et un tableau qui les confond ment.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { effort, etatVide, gestes, type EtatAtelier, type Volet, type VoletBudget } from "./atelier.ts";
import { indexer, type Budget } from "./simulateur.ts";
import { comparer, type Colonne } from "./comparaison.ts";

/** Un budget à une seule ligne de dépense — juste assez pour un écart. */
function budgetUneLigne(code: string, valeur: number, libelle = "Dépense"): Budget {
  return {
    exercice: "2025",
    loi: "PLF",
    mesure: "credit_de_paiement",
    unite: "EUR",
    depenses: [{ c: code, l: libelle, v: valeur }],
    recettes: [],
  };
}

/** Un budget à trois lignes de dépense, pour les tests de tri. */
function budgetTroisLignes(): Budget {
  return {
    exercice: "2025",
    loi: "PLF",
    mesure: "credit_de_paiement",
    unite: "EUR",
    depenses: [
      { c: "A", l: "Ligne A", v: 1_000_000_000 },
      { c: "B", l: "Ligne B", v: 2_000_000_000 },
      { c: "C", l: "Ligne C", v: 500_000_000 },
    ],
    recettes: [],
  };
}

function volet(cle: string, nom: string, budget: Budget): VoletBudget {
  return { genre: "budget", cle, nom, budget, index: indexer(budget) };
}

/**
 * Tolérance pour les montants calculés : 1 centime. Assez large pour
 * absorber l'arrondi flottant d'un pourcentage appliqué à une base, assez
 * étroite pour qu'un écart réel — mauvaise ligne, mauvais pourcentage,
 * mauvaise base — le dépasse de plusieurs ordres de grandeur et fasse
 * échouer l'assertion.
 */
const EPSILON_EUROS = 0.01;

function assertMontantProche(actual: number, expected: number, message?: string): void {
  assert.ok(
    Math.abs(actual - expected) < EPSILON_EUROS,
    message ?? `attendu ${expected} ± ${EPSILON_EUROS}, obtenu ${actual}`,
  );
}

/** Comme `assertMontantProche`, mais pour un tableau de cellules : les `null`
 *  restent comparés à l'identique, jamais à une tolérance. */
function assertCellulesProches(actual: (number | null)[], expected: (number | null)[]): void {
  assert.equal(actual.length, expected.length);
  actual.forEach((valeur, i) => {
    const attendu = expected[i];
    if (attendu === null) {
      assert.ok(Object.is(valeur, null), `cellule ${i} : attendu null, obtenu ${valeur}`);
    } else {
      assert.ok(valeur !== null, `cellule ${i} : attendu ${attendu}, obtenu null`);
      assertMontantProche(valeur, attendu, `cellule ${i} : attendu ${attendu} ± ${EPSILON_EUROS}, obtenu ${valeur}`);
    }
  });
}

/** Un état où un seul volet porte des réglages. */
function etatAvec(cle: string, reglages: [string, number][]): EtatAtelier {
  return { budgets: new Map([[cle, new Map(reglages)]]), baremes: new Map() };
}

/** Une colonne dont l'effort et les gestes viennent d'atelier.ts, jamais d'un
 *  calcul refait ici — voir le test 7. */
function colonne(nom: string, volets: readonly Volet[], etat: EtatAtelier): Colonne {
  return { nom, etat, effort: effort(volets, etat), gestes: gestes(volets, etat) };
}

test("deux colonnes qui règlent la même ligne produisent une seule ligne comparée, deux cellules non nulles", () => {
  const etatVolet = volet("etat", "État", budgetUneLigne("146", 1_000_000_000));
  const volets = [etatVolet];

  const etatA = etatAvec("etat", [["146", -10]]);
  const etatB = etatAvec("etat", [["146", -30]]);
  const colonnes = [colonne("A", volets, etatA), colonne("B", volets, etatB)];

  const lignes = comparer(volets, colonnes);

  assert.equal(lignes.length, 1);
  assert.equal(lignes[0].volet, "etat");
  assert.equal(lignes[0].code, "146");
  assertCellulesProches(lignes[0].cellules, [-100_000_000, -300_000_000]);
});

test("une ligne réglée par une seule colonne laisse l'autre cellule à null, jamais zéro", () => {
  const etatVolet = volet("etat", "État", budgetUneLigne("146", 1_000_000_000));
  const volets = [etatVolet];

  const touchee = etatAvec("etat", [["146", -10]]);
  const colonnes = [colonne("Moi", volets, touchee), colonne("Référence", volets, etatVide())];

  const lignes = comparer(volets, colonnes);

  assert.equal(lignes.length, 1);
  assertMontantProche(lignes[0].cellules[0]!, -100_000_000);
  assert.equal(lignes[0].cellules[1], null);
  // Une assertion stricte de type : `0` passerait un `assert.equal` laxiste,
  // pas `Object.is`.
  assert.ok(Object.is(lignes[0].cellules[1], null));
});

test("l'alignement se fait sur la paire (volet, code), pas sur le code seul : deux volets qui partagent D-PRE donnent deux lignes", () => {
  const vieillesse = volet("vieillesse", "Vieillesse", budgetUneLigne("D-PRE", 400_000_000_000, "Prestations vieillesse"));
  const famille = volet("famille", "Famille", budgetUneLigne("D-PRE", 500_000_000, "Prestations familiales"));
  const volets = [vieillesse, famille];

  const etat: EtatAtelier = {
    budgets: new Map([
      ["vieillesse", new Map([["D-PRE", -5]])],
      ["famille", new Map([["D-PRE", 10]])],
    ]),
    baremes: new Map(),
  };
  const colonnes = [colonne("Moi", volets, etat)];

  const lignes = comparer(volets, colonnes);

  assert.equal(lignes.length, 2);
  const parVolet = new Map(lignes.map((l) => [l.volet, l]));
  const ligneVieillesse = parVolet.get("vieillesse");
  const ligneFamille = parVolet.get("famille");
  assert.ok(ligneVieillesse && ligneFamille);
  assert.equal(ligneVieillesse.code, "D-PRE");
  assert.equal(ligneFamille.code, "D-PRE");
  // Un index par code seul aurait écrasé l'une des deux entrées, ou sommé
  // leurs écarts. Aucun des deux ne doit se produire.
  assertMontantProche(ligneVieillesse.cellules[0]!, -20_000_000_000);
  assertMontantProche(ligneFamille.cellules[0]!, 50_000_000);
});

test("le tri est par écart absolu décroissant, tous volets confondus", () => {
  const etatVolet = volet("etat", "État", budgetTroisLignes());
  const volets = [etatVolet];

  // A : -100 M€, B : -1 000 M€, C : -20 M€.
  const etat = etatAvec("etat", [
    ["A", -10],
    ["B", -50],
    ["C", -4],
  ]);
  const colonnes = [colonne("Moi", volets, etat)];

  const lignes = comparer(volets, colonnes);

  assert.deepEqual(
    lignes.map((l) => l.code),
    ["B", "A", "C"],
  );
});

test("comparer trie lui-même, il ne se contente pas de l'ordre d'insertion : deux colonnes, chacune ne touchant qu'une ligne", () => {
  const etatVolet = volet("etat", "État", budgetTroisLignes());
  const volets = [etatVolet];

  // La colonne A ne règle que C (petit écart, -20 M€) : c'est la seule
  // ligne qu'elle insère dans la table, et elle est traitée en premier.
  // La colonne B ne règle que B (gros écart, -1 000 M€) : elle n'est
  // insérée que dans un second temps. Un `comparer` qui se contenterait de
  // renvoyer l'ordre d'insertion de la `Map` — au lieu de trier — rendrait
  // donc [C, B], l'inverse de l'ordre attendu par écart décroissant.
  const etatA = etatAvec("etat", [["C", -4]]);
  const etatB = etatAvec("etat", [["B", -50]]);
  const colonnes = [colonne("A", volets, etatA), colonne("B", volets, etatB)];

  const lignes = comparer(volets, colonnes);

  assert.deepEqual(
    lignes.map((l) => l.code),
    ["B", "C"],
  );
});

test("une colonne sans aucun réglage produit une liste vide plutôt que de lever", () => {
  const etatVolet = volet("etat", "État", budgetUneLigne("146", 1_000_000_000));
  const volets = [etatVolet];
  const colonnes = [colonne("Vide", volets, etatVide())];

  const lignes = comparer(volets, colonnes);

  assert.deepEqual(lignes, []);
});

test("la référence — l'état neutre — n'ajoute aucune ligne à elle seule", () => {
  const etatVolet = volet("etat", "État", budgetUneLigne("146", 1_000_000_000));
  const volets = [etatVolet];

  const colA = colonne("A", volets, etatAvec("etat", [["146", -10]]));
  const colRef = colonne("Référence", volets, etatVide());
  const colB = colonne("B", volets, etatAvec("etat", [["146", -20]]));

  const lignes = comparer(volets, [colA, colRef, colB]);

  // Une seule ligne, pas trois : la colonne de référence, posée entre les
  // deux autres, ne fait apparaître aucune ligne de son cru.
  assert.equal(lignes.length, 1);
  assertCellulesProches(lignes[0].cellules, [-100_000_000, null, -200_000_000]);
});

test("effort et gestes d'une colonne viennent d'atelier.ts, jamais recalculés en parallèle", () => {
  const etatVolet = volet("etat", "État", budgetUneLigne("146", 1_000_000_000));
  const volets = [etatVolet];
  const etat = etatAvec("etat", [["146", -10]]);

  const col = colonne("Moi", volets, etat);

  // Valeur attendue calculée à la main : couper 10 % de 1 000 M€ améliore le
  // solde de 100 M€, en un seul geste.
  assertMontantProche(col.effort, 100_000_000);
  assert.equal(col.gestes, 1);
  // Et elle doit correspondre à l'appel direct des fonctions d'atelier.ts,
  // pas à un calcul refait dans ce module ou dans le test.
  assert.equal(col.effort, effort(volets, etat));
  assert.equal(col.gestes, gestes(volets, etat));

  // Une valeur d'effort volontairement fausse ne doit influencer aucune
  // cellule : `comparer` ne lit jamais `effort`/`gestes`, seulement `etat`.
  const colFaussee: Colonne = { ...col, effort: -999, gestes: 999 };
  const avecVraie = comparer(volets, [col]);
  const avecFaussee = comparer(volets, [colFaussee]);
  assert.deepEqual(avecVraie, avecFaussee);
});
