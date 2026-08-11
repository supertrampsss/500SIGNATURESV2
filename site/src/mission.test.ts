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
  aTrouverAuDepart,
  budgetsTenus,
  contratDe,
  resteATrouver,
  ruptures,
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

test("« sans toucher à l'école ni à la santé » ne voit que les baisses", () => {
  const monde = [volet("etat", "État", budget(1_000, 0, "Enseignement scolaire"))];
  const etat = vide();
  const contrat = contratDe("ecole-sante")!;

  regler(reglagesDe(etat, monde[0]!), "D", 10);
  assert.deepEqual(ruptures(contrat, monde, etat), [], "monter l'école ne rompt rien");

  regler(reglagesDe(etat, monde[0]!), "D", -10);
  const rompu = ruptures(contrat, monde, etat);
  assert.equal(rompu.length, 1);
  assert.equal(rompu[0]!.libelle, "Enseignement scolaire");
  assert.equal(rompu[0]!.nomVolet, "État");
});

test("« sans lever un impôt » ne confond pas un prélèvement qu'on baisse", () => {
  // Un prélèvement sur recettes se déduit : le baisser améliore le solde sans
  // lever le moindre impôt. Le signe de la ligne le dit, son intitulé non.
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
  const monde = [volet("etat", "État", psr)];
  const etat = vide();
  const contrat = contratDe("sans-impot")!;

  regler(reglagesDe(etat, monde[0]!), "r3101", -50);
  assert.deepEqual(ruptures(contrat, monde, etat), [], "baisser un prélèvement ne lève rien");

  regler(reglagesDe(etat, monde[0]!), "r1101", 10);
  assert.equal(ruptures(contrat, monde, etat).length, 1);
});

test("un contrat se juge sur ce qui bouge, pas sur ce qu'on a cliqué", () => {
  // Couper la dotation globale de l'État fait baisser les concours que les
  // collectivités reçoivent : le lecteur n'a pas touché leur budget, et le
  // contrat est rompu quand même. C'est tout l'intérêt de le juger sur les
  // réglages effectifs.
  const etatBudget: Budget = {
    exercice: "2025",
    loi: "PLF",
    mesure: "credit_de_paiement",
    unite: "EUR",
    depenses: [{ c: "D", l: "Défense", v: 1_000 }],
    recettes: [
      {
        t: "Prélèvements sur les recettes de l'État au profit des collectivités territoriales",
        signe: -1,
        lignes: [{ c: "3101", l: "Dotation globale", v: 400 }],
      },
    ],
  };
  const commune: Budget = {
    exercice: "2024",
    loi: "OFGL",
    mesure: "credit_de_paiement",
    unite: "EUR",
    depenses: [{ c: "d", l: "Dépenses", v: 100 }],
    recettes: [
      {
        t: "Recettes",
        signe: 1,
        lignes: [{ c: "ofgl_concours_de_l_etat", l: "Concours de l'Etat", v: 300 }],
      },
    ],
  };
  const monde = [
    volet("etat", "État", etatBudget),
    volet("collectivites-commune", "Communes", commune),
  ];
  const etat = vide();
  regler(reglagesDe(etat, monde[0]!), "r3101", -25);

  const rompu = ruptures(contratDe("sans-collectivites")!, monde, etat);
  const lignes = rompu.map((r) => `${r.volet}/${r.libelle}`);
  assert.ok(lignes.includes("etat/Dotation globale"), lignes.join(" · "));
  assert.ok(lignes.includes("collectivites-commune/Concours de l'État"), lignes.join(" · "));
});

test("les quatre contrats ont une clé, un nom et une ligne d'interdit", () => {
  // La liste est courte exprès : cinq contrats, et personne ne les lit.
  assert.equal(CONTRATS.length, 4);
  for (const contrat of CONTRATS) {
    assert.ok(contrat.cle && contrat.nom && contrat.interdit, contrat.cle);
    assert.ok(contrat.interdit.length <= 120, `${contrat.cle} : interdit trop long`);
    assert.equal(contratDe(contrat.cle), contrat);
  }
  // Une clé inconnue ne signe rien plutôt que de signer le premier venu.
  assert.equal(contratDe("inconnu"), null);
  assert.equal(contratDe(null), null);
  assert.deepEqual(ruptures(null, [], vide()), []);
});
