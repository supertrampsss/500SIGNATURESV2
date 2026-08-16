/**
 * La mission et le contrat.
 *
 * Deux propriétés se vérifient ici et nulle part ailleurs : le compteur ne
 * somme que des déficits, et un contrat se juge sur ce que les gestes font
 * vraiment — y compris à travers un barème ou un transfert, où le lecteur n'a
 * pas cliqué.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { reglagesDe, type EtatAtelier, type Volet } from "./atelier.ts";
import { indexer, regler, type Budget } from "./simulateur.ts";
import {
  CONTRATS,
  PALIERS,
  aTrouverAuDepart,
  budgetsTenus,
  contratsDe,
  fusionner,
  permis,
  resteATrouver,
  verrouDuBareme,
  verrous,
} from "./mission.ts";

/** Un budget d'une ligne de chaque côté, dont on choisit le solde. */
function budget(depense: number, recette: number, libelle = "Défense"): Budget {
  return {
    exercice: "2025",
    loi: "PLF",
    mesure: "credit_de_paiement",
    unite: "EUR",
    depenses: [{ c: "D", l: libelle, v: depense }],
    recettes: [{ t: "Recettes", signe: 1, lignes: [{ c: "R", l: "Impôt", v: recette }] }],
  };
}

function volet(cle: string, nom: string, b: Budget): Volet {
  return { genre: "budget", cle, nom, budget: b, index: indexer(b) };
}

const vide = (): EtatAtelier => ({ budgets: new Map(), baremes: new Map() });

test("les marches se disent en M€, comme le compteur qu'elles jalonnent", () => {
  // Elles s'écrivaient « 10 Md€ » au-dessus d'un compteur qui dit
  // « 159 297 M€ » : savoir si la marche des 100 Md€ était franchie demandait
  // une conversion de tête. Le dépôt refuse déjà `Md€` dans les analyses et
  // dans les citations ; l'échelle de la mission y échappait seule.
  //
  // Le séparateur est l'espace fine insécable U+202F, celle qu'`Intl` met dans
  // « 159 297 M€ » — écrite ici en échappement parce qu'elle est indiscernable
  // d'une espace ordinaire dans un extrait, et que c'est ce qui a fait échouer
  // la première version de ce test.
  const noms = PALIERS.map((p) => p.nom);
  for (const nom of noms) assert.doesNotMatch(nom, /Md€|k€/, nom);
  assert.deepEqual(noms, [
    "10\u202f000 M€",
    "50\u202f000 M€",
    "100\u202f000 M€",
    "L'équilibre",
  ]);
});

test("le compteur somme les déficits, jamais les soldes", () => {
  // Un excédent de 400 ne comble pas un déficit de 1 000 : rien dans le droit
  // ne verse l'un à l'autre. Une somme de soldes dirait 600 à trouver ; la
  // mission en demande 1 000.
  const monde = [
    volet("a", "En déficit", budget(1_000, 0)),
    volet("b", "En excédent", budget(0, 400)),
  ];
  assert.equal(aTrouverAuDepart(monde), 1_000);
  assert.deepEqual(budgetsTenus(monde, vide()), { tenus: 1, total: 2 });
});

test("le compteur descend à mesure qu'on comble, et s'arrête à zéro", () => {
  const monde = [volet("a", "A", budget(1_000, 0))];
  const etat = vide();
  regler(reglagesDe(etat, monde[0]!), "D", -50);
  assert.equal(resteATrouver(monde, etat), 500);
  // Couper au-delà de l'équilibre ne creuse pas un « reste » négatif.
  regler(reglagesDe(etat, monde[0]!), "D", -100);
  assert.equal(resteATrouver(monde, etat), 0);
  assert.deepEqual(budgetsTenus(monde, etat), { tenus: 1, total: 1 });
});

test("un contrat verrouille la ligne, il ne se contente pas de la signaler", () => {
  // Une règle qu'on peut enfreindre sans conséquence n'est pas une règle.
  const monde = [volet("etat", "État", budget(1_000, 0, "Enseignement scolaire"))];
  const table = verrous(monde[0]!, contratsDe(["ecole-sante"]), "SS-ELIM");
  assert.equal(table.get("D")?.sens, "tout");
  assert.equal(table.get("D")?.par, "Sans toucher à l'école ni à la santé");
  // Verrouillée dans les deux sens : « sans toucher » ne se négocie pas.
  assert.equal(permis("tout", 0, -5), false);
  assert.equal(permis("tout", 0, 5), false);
  assert.equal(permis("tout", 0, 0), true);
});

test("« sans lever un impôt » ferme la hausse et laisse la baisse", () => {
  // Un contrat qui interdirait aussi d'alléger un impôt serait absurde.
  const psr: Budget = {
    exercice: "2025",
    loi: "PLF",
    mesure: "credit_de_paiement",
    unite: "EUR",
    depenses: [{ c: "D", l: "Défense", v: 1_000 }],
    recettes: [
      { t: "Recettes fiscales", signe: 1, lignes: [{ c: "1101", l: "Impôt", v: 500 }] },
      { t: "Prélèvements", signe: -1, lignes: [{ c: "3101", l: "Dotation", v: 200 }] },
    ],
  };
  const table = verrous(volet("etat", "État", psr), contratsDe(["sans-impot"]), "SS-ELIM");
  assert.equal(table.get("r1101")?.sens, "hausse");
  // Un prélèvement se déduit : le baisser ne lève aucun impôt.
  assert.equal(table.get("r3101"), undefined);
  assert.equal(permis("hausse", 0, 10), false);
  assert.equal(permis("hausse", 0, -10), true);
});

test("le barème se verrouille tranche par tranche, pas sur son rendement", () => {
  // Une flat tax à 30 % baisse les tranches hautes et lève les basses. Juger
  // sur le rendement agrégé dirait « vous levez un impôt » à qui en baisse la
  // moitié ; le verrou porte sur chaque tranche et laisse passer les baisses.
  const ferme = verrouDuBareme(contratsDe(["sans-impot"]))!;
  assert.equal(ferme.sens, "hausse");
  assert.equal(permis(ferme.sens, 45, 30), true, "baisser une tranche haute reste permis");
  assert.equal(permis(ferme.sens, 11, 30), false, "lever une tranche basse est refusé");
  assert.equal(verrouDuBareme(contratsDe(["ecole-sante"])), null);
});

test("les contraintes se cumulent, et le verrou le plus fort gagne", () => {
  assert.equal(contratsDe(["sans-impot", "sans-prestation"]).length, 2);
  assert.equal(fusionner(["hausse", "baisse"]), "tout");
  assert.equal(fusionner(["aucun", "hausse"]), "hausse");
  assert.equal(fusionner([]), "aucun");
  // Une clé inconnue ne signe rien plutôt que de signer le premier venu.
  assert.deepEqual(contratsDe(["inconnu"]), []);
});

test("la ligne qui élimine les transferts entre branches est toujours verrouillée", () => {
  // Ce n'est pas un poste : c'est la soustraction qui rend le total exact. La
  // régler ferait apparaître 19 019 M€ venus de nulle part.
  const b = budget(1_000, 0);
  b.depenses.push({ c: "SS-ELIM", l: "Transferts entre branches", v: -19 });
  const table = verrous(volet("secu", "Sécurité sociale", b), [], "SS-ELIM");
  assert.equal(table.get("SS-ELIM")?.sens, "tout");
  assert.equal(table.get("SS-ELIM")?.par, "la comptabilité");
});


test("les quatre contraintes ont une clé, un nom et une ligne d'interdit", () => {
  // La liste est courte exprès : cinq contraintes, et personne ne les lit.
  assert.equal(CONTRATS.length, 4);
  for (const contrat of CONTRATS) {
    assert.ok(contrat.cle && contrat.nom && contrat.interdit, contrat.cle);
    assert.ok(contrat.interdit.length <= 120, `${contrat.cle} : interdit trop long`);
    assert.deepEqual(contratsDe([contrat.cle]), [contrat]);
  }
});
