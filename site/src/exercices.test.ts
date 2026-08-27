/**
 * Le tableau des exercices : ce qu'il montre, ce qu'il refuse de montrer.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { exercices, rendreExercices } from "./exercices.ts";
import type { Indicateur } from "./donnees.ts";

const CATALOGUE = [
  { id: "ofgl_depenses_fonctionnement", libelle: "Depenses de fonctionnement" },
  { id: "ofgl_frais_personnel", libelle: "Frais de personnel" },
  { id: "ofgl_recettes_fonctionnement", libelle: "Recettes de fonctionnement" },
] as unknown as Indicateur[];

const SERIES = {
  ofgl_depenses_fonctionnement: { "2017": 280e6, "2019": 294.1e6, "2022": 320.7e6, "2025": 369e6 },
  ofgl_frais_personnel: { "2019": 143.6e6, "2025": 183.1e6 },
  ofgl_recettes_fonctionnement: { "2019": 351.9e6, "2022": 381.4e6, "2025": 417.1e6 },
};

test("les lignes sont celles des blocs, dans leur ordre, sans doublon", () => {
  const t = exercices({
    cites: ["ofgl_depenses_fonctionnement", "ofgl_frais_personnel", "ofgl_depenses_fonctionnement"],
    series: SERIES,
    catalogue: CATALOGUE,
  })!;
  assert.deepEqual(
    t.lignes.map((l) => l.id),
    ["ofgl_depenses_fonctionnement", "ofgl_frais_personnel"],
  );
});

test("la fenêtre part de 2019 : un exercice antérieur n'a pas de colonne", () => {
  // La fenêtre du site se lit sur les exercices publiés, jamais sur un
  // calendrier électoral, et elle commence en 2019 à toutes les mailles.
  const t = exercices({
    cites: ["ofgl_depenses_fonctionnement"],
    series: SERIES,
    catalogue: CATALOGUE,
  })!;
  assert.deepEqual(t.exercices, ["2019", "2022", "2025"]);
});

test("un exercice manquant à une ligne laisse une case vide, pas un zéro", () => {
  const t = exercices({
    cites: ["ofgl_depenses_fonctionnement", "ofgl_frais_personnel"],
    series: SERIES,
    catalogue: CATALOGUE,
  })!;
  assert.deepEqual(t.lignes[1].valeurs, [143.6e6, null, 183.1e6]);
  assert.match(rendreExercices(t), /<td><\/td>/);
});

test("une seule colonne ne fait pas un tableau", () => {
  // Une valeur unique ne s'analyse pas, et le bloc juste au-dessus la dit déjà.
  assert.equal(
    exercices({
      cites: ["ofgl_frais_personnel"],
      series: { ofgl_frais_personnel: { "2025": 183.1e6 } },
      catalogue: CATALOGUE,
    }),
    null,
  );
});

test("un identifiant sans série ne fait pas une ligne vide", () => {
  // Cité par un bloc mais absent des séries du territoire : il sort du
  // tableau, et un tableau sans ligne n'existe pas du tout.
  assert.equal(
    exercices({ cites: ["etat_depenses_nettes_bg"], series: SERIES, catalogue: CATALOGUE }),
    null,
  );
  const t = exercices({
    cites: ["etat_depenses_nettes_bg", "ofgl_depenses_fonctionnement"],
    series: SERIES,
    catalogue: CATALOGUE,
  })!;
  assert.deepEqual(
    t.lignes.map((l) => l.id),
    ["ofgl_depenses_fonctionnement"],
  );
});

test("l'unité est dans la légende, à l'échelle du tableau entier", () => {
  // Répétée quatre-vingts fois dans une grille, l'unité n'ajoute rien et
  // empêche les colonnes de s'aligner : la légende la porte une fois.
  //
  // Et elle suit le plus gros montant du tableau. « Montants en millions »
  // valait pour toute maille, ce qui donnait « 336 069 » à l'État — six rangs
  // qu'il fallait diviser de tête. Deux décimales toujours, pour que la
  // colonne reste alignée quand un montant tombe rond.
  const html = rendreExercices(
    exercices({ cites: ["ofgl_depenses_fonctionnement"], series: SERIES, catalogue: CATALOGUE }),
  );
  assert.match(html, /<td>294,10<\/td>/);
  const corps = html.replace(/<caption>[\s\S]*?<\/caption>/, "");
  assert.doesNotMatch(corps, /M€|millions|milliards/);
  assert.match(html, /<caption>Montants en millions d'euros\./);
});

test("un tableau de l'État se lit en milliards, pas en millions", () => {
  // Le cas qui a fait changer la règle : à la maille nationale, la même
  // fonction écrivait « 336 069 » sous une légende qui disait « millions ».
  const millier = Object.fromEntries(
    Object.entries(SERIES.ofgl_depenses_fonctionnement).map(([a, v]) => [a, v * 4000]),
  );
  const html = rendreExercices(
    exercices({
      cites: ["ofgl_depenses_fonctionnement"],
      series: { ofgl_depenses_fonctionnement: millier },
      catalogue: CATALOGUE,
    }),
  );
  assert.match(html, /<caption>Montants en milliards d'euros\./);
    // L'espace des milliers est une fine insécable : tapée à la main dans le
  // motif, elle passe pour une espace ordinaire et le test échoue sur une
  // valeur pourtant juste. Septième fois cette session.
  assert.match(html, /<td>1\u202f176<\/td>/u);
});

/**
 * Une ligne porte le nom que le bloc lui a donné, jamais un second.
 *
 * Le bloc de la France écrit « les impôts que l'État perçoit » ; la ligne qui
 * chiffre ce poste ne peut pas s'intituler « Recettes fiscales nettes » sous
 * lui — ce serait deux noms pour une ligne. Le libellé du fichier publié va
 * sous le curseur, où le tableau déplié le retrouve.
 */
test("le poste national se dit comme le bloc le dit, le libellé publié en infobulle", () => {
  const t = exercices({
    cites: ["etat_recettes_nettes_bg", "etat_recettes_fiscales"],
    series: {
      etat_recettes_nettes_bg: { "2019": 295256348109.01, "2025": 380389657383.09 },
      etat_recettes_fiscales: { "2019": 281289250970.51, "2025": 356397925509.5 },
    },
    catalogue: [
      { id: "etat_recettes_nettes_bg", libelle: "Recettes nettes du budget général" },
      { id: "etat_recettes_fiscales", libelle: "Recettes fiscales nettes" },
    ] as unknown as Indicateur[],
  })!;
  const poste = t.lignes[1];
  assert.equal(poste.libelle, "Impôts perçus par l'État");
  assert.equal(poste.terme, "Recettes fiscales nettes");
});

test("la colonne des variations garde sa décimale sur un compte rond", () => {
  // Bordeaux, en vrai : la colonne « 2019 → 2025 » alignait onze valeurs à une
  // décimale — +25,5 %, +63,7 %, +94,9 % — et « +67 % » au milieu, parce
  // qu'`Intl` laisse tomber la décimale d'un compte rond. Une colonne qu'on lit
  // de haut en bas pour comparer des lignes ne change pas de précision en route.
  // Ici 100 → 200 fait exactement +100 %.
  const catalogue = [
    { id: "ofgl_depenses_fonctionnement", libelle: "Dépenses de fonctionnement" },
  ] as unknown as Indicateur[];
  const tableau = exercices({
    cites: ["ofgl_depenses_fonctionnement"],
    series: { ofgl_depenses_fonctionnement: { "2019": 100e6, "2025": 200e6 } },
    catalogue,
  })!;
  const html = rendreExercices(tableau);
  assert.match(html, /\+100,0\s*%/, html.slice(html.indexOf("<b>") - 40, html.indexOf("</b>") + 4));
});

test("aucun tiret cadratin ni demi-cadratin", () => {
  assert.doesNotMatch(
    rendreExercices(
      exercices({ cites: ["ofgl_depenses_fonctionnement"], series: SERIES, catalogue: CATALOGUE }),
    ),
    /[—–]/,
  );
});

test("rien à montrer n'écrit rien", () => {
  assert.equal(rendreExercices(null), "");
});
