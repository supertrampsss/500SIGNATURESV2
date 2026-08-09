/**
 * Le second budget du simulateur : la Sécurité sociale.
 *
 * Ce qui change par rapport à celui de l'État tient en trois points, et chacun
 * est une occasion de mentir :
 *
 * 1. **les recettes portent un arbre**, parce que le non-recouvrement se déduit
 *    des cotisations et se détaille ;
 * 2. **l'ONDAM est publié à côté**, et ne doit toucher ni les dépenses, ni les
 *    recettes, ni le solde — c'est un objectif sur un périmètre qui traverse
 *    trois branches ;
 * 3. **le cadrage vient du fichier**, parce qu'aucune phrase écrite pour un vote
 *    de crédits de l'État ne décrit un tableau de charges et de produits.
 *
 * Les montants sont ceux du PLFSS 2026, arrondis au million : c'est la matière
 * qui piège, pas une matière inventée.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  decoder,
  defis,
  ecartAuReel,
  ecartObjectif,
  encoder,
  indexer,
  regler,
  totalObjectif,
  totaux,
  type Budget,
  type Reglages,
} from "./simulateur.ts";
import {
  perimetre,
  rendu,
  renduObjectif,
  renduOnglets,
  renduRecettes,
  repere,
  titre,
} from "./simulateur-rendu.ts";

const M = 1_000_000;

/** Le PLFSS 2026, réduit à ce qui compte ici mais aux vrais montants. */
const SECU: Budget = {
  exercice: "2026",
  loi: "PLFSS",
  unite: "EUR",
  titre: "Le budget de la Sécurité sociale, poste par poste",
  cadre:
    "PLFSS 2026, régimes obligatoires de base consolidés, charges et produits nets,"
    + " montants en millions d'euros (M€)",
  repere: "poste",
  depenses: [
    {
      c: "D-PRE",
      l: "Prestations sociales",
      v: 640_388.48 * M,
      enfants: [
        { c: "D-PRE-LEG", l: "Prestations légales", v: 631_960.9 * M },
        { c: "D-PRE-XLE", l: "Prestations extralégales (action sociale)", v: 8_427.58 * M },
      ],
    },
    { c: "D-GES", l: "Charges de gestion courante", v: 14_566.45 * M },
  ],
  recettes: [
    {
      t: "Cotisations, contributions et recettes fiscales",
      signe: 1,
      lignes: [
        { c: "R-COT-SOC", l: "Cotisations sociales", v: 336_099.9 * M },
        {
          c: "R-COT-NRE",
          l: "Non-recouvrement (se déduit)",
          v: -2_152.45 * M,
          enfants: [
            { c: "R-COT-NRE-COT", l: "Non-recouvrement sur cotisations", v: -1_621.42 * M },
            { c: "R-COT-NRE-CSG", l: "Non-recouvrement sur CSG d'activité", v: -531.03 * M },
          ],
        },
      ],
    },
  ],
  objectif: {
    t: "ONDAM 2026",
    note:
      "L'ONDAM est un objectif de dépenses d'assurance maladie, voté à part. Il traverse"
      + " les branches maladie, AT-MP et autonomie : il ne s'ajoute pas aux charges"
      + " ci-dessus et n'entre pas dans le solde.",
    lignes: [
      { c: "O-SDV", l: "Soins de ville", v: 114_900 * M },
      {
        c: "O-MS",
        l: "Établissements et services médico-sociaux",
        v: 34_200 * M,
        enfants: [
          { c: "O-MS-PA", l: "Établissements et services pour personnes âgées", v: 18_200 * M },
          {
            c: "O-MS-PH",
            l: "Établissements et services pour personnes handicapées",
            v: 16_000 * M,
          },
        ],
      },
    ],
  },
};

const INDEX = indexer(SECU);

function reglages(...paires: [string, number][]): Reglages {
  const table: Reglages = new Map();
  for (const [code, valeur] of paires) regler(table, code, valeur);
  return table;
}

/* -------------------------------------------------------------- les totaux */

test("les totaux somment les feuilles des deux côtés", () => {
  const t = totaux(SECU, new Map());
  assert.equal(Math.round(t.depenses / M), 654_955);
  assert.equal(Math.round(t.recettes / M), 333_947);
  assert.equal(Math.round(t.solde / M), -321_007);
});

test("une ligne de recette détaillée compose avec sa mère", () => {
  // Le non-recouvrement est un nœud, pas une feuille : régler la mère à −50 %
  // doit valoir exactement la même chose que régler ses deux composantes.
  const parMere = totaux(SECU, reglages([`rR-COT-NRE`, -50])).recettes;
  const parFilles = totaux(
    SECU,
    reglages([`rR-COT-NRE-COT`, -50], [`rR-COT-NRE-CSG`, -50]),
  ).recettes;
  assert.equal(Math.round(parMere), Math.round(parFilles));
  // Et un non-recouvrement réduit fait *monter* les recettes, puisqu'il s'en
  // déduit : le signe de la ligne est dans son montant, pas ailleurs.
  assert.ok(parMere > totaux(SECU, new Map()).recettes);
});

test("l'arbre des recettes est indexé à toute profondeur", () => {
  assert.equal(INDEX.get("rR-COT-NRE-COT")?.ancetres.join(","), "rR-COT-NRE");
  assert.equal(INDEX.get("rR-COT-NRE-COT")?.cote, "recette");
  // Le chemin nomme le groupe puis la mère : c'est ce qui rend la ligne
  // trouvable et situable dans « Votre plan ».
  assert.match(INDEX.get("rR-COT-NRE-COT")!.chemin, /Cotisations.*Non-recouvrement/);
});

/* --------------------------------------------------------------- l'ONDAM */

test("l'ONDAM a son total, et il n'est pas dans le solde", () => {
  assert.equal(Math.round(totalObjectif(SECU, new Map()) / M), 149_100);
  const regle = reglages(["O-SDV", -10]);
  // L'objectif bouge…
  assert.equal(Math.round(ecartObjectif(SECU, regle) / M), -11_490);
  // …et rien d'autre ne bouge : ni les dépenses, ni les recettes, ni le solde.
  const avant = totaux(SECU, new Map());
  const apres = totaux(SECU, regle);
  assert.deepEqual(apres, avant);
  assert.equal(ecartAuReel(SECU, regle), 0);
});

test("un sous-objectif réglé n'est jamais coloré comme un geste sur le solde", () => {
  const html = renduObjectif(SECU, INDEX, reglages(["O-SDV", -10]));
  assert.doesNotMatch(html, /simu__val--sobre|simu__val--argile/);
  // Mais l'écart à l'objectif, lui, s'affiche.
  assert.match(html, /Votre écart à l'objectif/);
});

test("la note de l'ONDAM dit qu'il ne s'ajoute pas, une fois", () => {
  const html = renduObjectif(SECU, INDEX, new Map());
  assert.equal(html.match(/entre pas dans le solde/g)?.length, 1);
});

test("l'onglet de l'objectif n'existe que si le budget en porte un", () => {
  assert.match(renduOnglets("depenses", 0, "ONDAM 2026"), /ONDAM 2026/);
  assert.doesNotMatch(renduOnglets("depenses", 0), /simu-onglet-objectif/);
});

/* ------------------------------------------------------- cadrage et défis */

test("le cadrage et le titre viennent du fichier, jamais d'une phrase d'État", () => {
  assert.equal(perimetre(SECU), SECU.cadre);
  assert.equal(titre(SECU), SECU.titre);
  assert.equal(repere(SECU), "poste");
  // Ni « budget général » ni « crédits de paiement » : ce budget n'en a pas.
  assert.doesNotMatch(perimetre(SECU), /budget général|crédits de paiement/);
  // L'unité est dite là où les nombres sont gros.
  assert.match(perimetre(SECU), /millions d'euros/);
});

test("le défi de l'école ne s'affiche pas sur un budget qui n'en porte pas", () => {
  const noms = defis(INDEX, new Map(), 0, -1).map((d) => d.nom);
  assert.deepEqual(noms, ["Dégagez 10 Md€", "L'équilibre"]);
});

/* ------------------------------------------------------------ le partage */

test("un lien de budget d'État n'ouvre rien dans celui de la Sécurité sociale", () => {
  // Les deux nomenclatures n'ont aucun code en commun : un lien partagé sur
  // l'un ne doit rien régler sur l'autre plutôt que de régler au hasard.
  assert.equal(encoder(decoder("146-09-63:-20,r1301:10", INDEX)), "");
  assert.equal(encoder(decoder("D-PRE-LEG:-5", INDEX)), "D-PRE-LEG:-5");
});

/* ----------------------------------------------------------------- l'écran */

test("le total d'un groupe de recettes suit les réglages de ses lignes", () => {
  const html = renduRecettes(SECU, INDEX, reglages(["rR-COT-SOC", -50]));
  // 336 099,90 réduits de moitié, moins 2 152,45 de non-recouvrement.
  assert.match(html, /165\s898/);
});

test("la page monte les quatre panneaux quand l'objectif existe", () => {
  const html = rendu(SECU, INDEX, new Map());
  for (const id of ["simu-vue-depenses", "simu-vue-recettes", "simu-vue-objectif"]) {
    assert.ok(html.includes(id), id);
  }
});

test("remonter le simulateur ne laisse pas les écouteurs du budget précédent", () => {
  // Deux jeux d'écouteurs sur le même élément et un pli sur deux ne s'ouvre
  // plus : le premier déplie une branche que le second referme. Le montage
  // précédent doit donc être coupé, pas seulement recouvert.
  const source = readFileSync(new URL("./simulateur-rendu.ts", import.meta.url), "utf8");
  assert.match(source, /montage\?\.abort\(\);/);
  assert.match(source, /montage = new AbortController\(\);/);
  // Tout écouteur posé sur le bloc lui-même — les autres meurent avec le HTML
  // qu'on remplace — porte le signal.
  const surLeBloc = source.match(/bloc\.addEventListener\(/g)?.length ?? 0;
  assert.equal(source.match(/\}, \{ signal \}\);/g)?.length, surLeBloc + 1);
});

/* ---------------------------------------------- ce que le dépôt doit tenir */

const PUBLISH = readFileSync(new URL("../../pipeline/plateforme/publish.py", import.meta.url), "utf8");

test("les deux budgets sont publiés séparément, et jamais additionnés", () => {
  assert.match(PUBLISH, /simulateur\/secu-\{exercice\}\.json/);
  assert.match(PUBLISH, /simulateur\/index-secu\.json/);
  // L'ONDAM sort dans sa propre clé : rien ne l'agrège aux charges.
  assert.match(PUBLISH, /"objectif": \{/);
});
