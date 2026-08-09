/**
 * La pièce qui ouvre la fiche.
 *
 * C'est la seule chose que la plupart des visiteurs liront. Elle doit donc être
 * exacte au dixième de point, tenir pour 34 875 communes et pour une commune
 * dont trois séries manquent, et ne jamais écrire un mot que les comptes ne
 * portent pas. Ces tests figent le titre et le paragraphe réellement produits
 * pour Bordeaux — s'ils changent, c'est que les règles ont changé, et cela doit
 * se voir dans un diff.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Mandat } from "./mandat.ts";
import type { Contexte } from "./verdict.ts";
import { recit } from "./recit.ts";

/** Espace fine insécable : la typographie française avant une unité. */
const FINE = " ";

const MANDAT: Mandat = {
  debut: "2020-03-15",
  fin: "2026-03-22",
  exerciceReference: "2019",
  exerciceFin: "2025",
  exercices: 6,
  enCours: false,
};

/** Bordeaux (33063), comptes du budget principal publiés par l'OFGL. */
const BORDEAUX: Record<string, Record<string, number>> = {
  ofgl_recettes_fonctionnement: { "2019": 351_954_165, "2025": 417_137_958.52 },
  ofgl_depenses_fonctionnement: { "2019": 294_082_497, "2025": 369_011_621 },
  ofgl_frais_personnel: { "2019": 143_587_933, "2025": 183_054_743 },
  ofgl_impots_locaux: { "2019": 195_193_601, "2025": 253_975_935 },
  ofgl_encours_dette: { "2019": 252_257_675, "2025": 412_980_520 },
  ofgl_epargne_brute: { "2019": 57_871_668, "2025": 48_126_337 },
  ofgl_epargne_nette: { "2019": 32_521_814, "2025": 14_392_071 },
  ofgl_depenses_d_equipement: { "2019": 56_355_924, "2025": 109_850_176 },
  ofgl_dotation_globale_de_fonctionnement: { "2019": 37_287_230, "2025": 36_477_848 },
};

function contexte(sur: Partial<Contexte> = {}): Contexte {
  return {
    mandat: MANDAT,
    series: BORDEAUX,
    inflation: 16.1,
    population: 5.0,
    nom: "Bordeaux",
    ...sur,
  };
}

/**
 * Le titre, obtenu par une règle et non écrit en dur.
 *
 * C'est le fait le plus lourd du mandat qui le prend, mesuré en euros déplacés
 * par rapport à l'évolution mécanique. Pour Bordeaux, l'encours de dette : il
 * gagne 63,7 % quand les prix en font 16,1, et la phrase suivante dit ce que
 * cela coûterait à rembourser.
 */
test("le titre de Bordeaux porte le fait le plus lourd, et le paragraphe le chiffre", () => {
  const r = recit(contexte());
  assert.equal(r?.titre, `À Bordeaux, l'encours de dette a augmenté de 63,7${FINE}% sur le mandat`);
  assert.equal(
    r?.paragraphe,
    `L'encours de dette passe de 252,3${FINE}M€ en 2019 à 413,0${FINE}M€ en 2025, soit`
      + ` +63,7${FINE}%, quand les prix ont monté de 16,1${FINE}% et la population de`
      + ` 5,0${FINE}% ; au rythme de ce que la collectivité met de côté chaque année, il`
      + ` faudrait 8,6${FINE}ans pour la rembourser, contre 4,4${FINE}ans en 2019.`
      + ` Ce que les impôts locaux rapportent passe de 195,2${FINE}M€ à 254,0${FINE}M€, soit`
      + ` +30,1${FINE}% ; ce total ne dit pas ce qui vient des taux votés et ce qui vient du`
      + ` nombre de contribuables.`
      + ` Les dépenses de fonctionnement, ce que la collectivité paie chaque année pour faire`
      + ` tourner ses services, passent de 294,1${FINE}M€ à 369,0${FINE}M€, soit`
      + ` +25,5${FINE}%.`,
  );
  assert.deepEqual(r?.cites, [
    "ofgl_encours_dette",
    "ofgl_impots_locaux",
    "ofgl_depenses_fonctionnement",
  ]);
  // La fenêtre nomme son point de départ. Elle s'intitulait « mandat 2020-2026 »
  // pendant que toutes ses phrases partaient de 2019 : le lecteur y voyait une
  // contradiction, faute qu'on lui dise que 2019 est le dernier exercice de
  // l'équipe sortante, celui que le nouveau conseil a trouvé.
  assert.equal(r?.fenetre, "mandat 2020-2026, mesuré depuis l'exercice 2019");
});

test("le titre n'a pas de point final", () => {
  assert.ok(!recit(contexte())?.titre.endsWith("."));
});

/**
 * Trois phrases, trois sujets.
 *
 * Sans cette règle, Bordeaux ouvrait sur l'encours de dette, les dépenses
 * d'équipement et l'épargne nette : trois formulations d'un unique fait, un
 * investissement financé par l'emprunt. Le lecteur croyait lire trois
 * informations et n'en recevait qu'une.
 */
test("le paragraphe enchaîne trois faits, jamais trois fois le même", () => {
  const r = recit(contexte());
  assert.equal(r?.paragraphe.split(". ").length, 3);
  assert.equal(new Set(r?.cites).size, 3);
});

/**
 * Le cadre n'est écrit qu'une fois.
 *
 * Chaque phrase de niveau sait nommer les prix et la population — il le faut
 * pour la barre latérale, où elle est seule. Dans un paragraphe, trois rappels
 * de « +16,1 % » à deux lignes d'intervalle font relire pour rien.
 */
test("les prix et la population sont nommés une fois et une seule", () => {
  const paragraphe = recit(contexte())?.paragraphe ?? "";
  assert.equal(paragraphe.split("les prix ont monté").length - 1, 1);
  assert.equal(paragraphe.split("la population de").length - 1, 1);
});

test("aucun tiret cadratin ni demi-cadratin dans le récit", () => {
  for (const nom of ["Bordeaux", "Le Havre", "Les Sables-d'Olonne", "La Rochelle"]) {
    const r = recit(contexte({ nom }));
    assert.ok(!`${r?.titre} ${r?.paragraphe}`.includes("—"));
    assert.ok(!`${r?.titre} ${r?.paragraphe}`.includes("–"));
  }
});

/**
 * L'article fait partie du nom officiel, et il se contracte.
 *
 * « À Le Havre » ne s'écrit pas. Seuls « le » et « les » se contractent : « À La
 * Rochelle » et « À L'Haÿ-les-Roses » sont corrects tels quels, et les mettre au
 * même traitement produirait « À La Rochelle » en « Au Rochelle ».
 */
test("le titre contracte la préposition quand le nom porte un article", () => {
  assert.match(recit(contexte({ nom: "Le Havre" }))?.titre ?? "", /^Au Havre, /);
  assert.match(recit(contexte({ nom: "Les Sables-d'Olonne" }))?.titre ?? "", /^Aux Sables-d'Olonne, /);
  assert.match(recit(contexte({ nom: "La Rochelle" }))?.titre ?? "", /^À La Rochelle, /);
  assert.match(recit(contexte({ nom: "Bordeaux" }))?.titre ?? "", /^À Bordeaux, /);
});

/**
 * Un seul fait ne fait pas un récit.
 *
 * Un titre suivi de la phrase qui le redit n'apprend rien de plus que la puce
 * correspondante de la barre latérale, et occupe dix fois la place. La fiche
 * s'ouvre alors sans récit : règle maison, une donnée absente n'écrit rien.
 */
test("moins de deux faits n'ouvrent pas la fiche", () => {
  const series = {
    ofgl_recettes_fonctionnement: BORDEAUX.ofgl_recettes_fonctionnement,
    ofgl_depenses_fonctionnement: BORDEAUX.ofgl_depenses_fonctionnement,
  };
  assert.equal(recit(contexte({ series })), null);
});

test("un territoire sans aucune série n'ouvre pas la fiche", () => {
  assert.equal(recit(contexte({ series: {} })), null);
});

/**
 * Un mandat en cours a une fenêtre ouverte.
 *
 * « mandat 2020-2026 » affirme une fin. Tant que l'élection suivante n'a pas eu
 * lieu, la fenêtre le dit autrement plutôt que d'inventer une borne.
 */
test("la fenêtre d'un mandat en cours ne s'invente pas de fin", () => {
  const enCours: Mandat = { ...MANDAT, fin: null, enCours: true };
  assert.equal(
    recit(contexte({ mandat: enCours }))?.fenetre,
    "mandat ouvert en 2020, mesuré depuis l'exercice 2019",
  );
});

/**
 * Sans exercice publié dans la fenêtre, il n'y a rien à raconter.
 *
 * C'est l'état du mandat ouvert le 22 mars 2026 pour les 534 communes de
 * Gironde : les comptes s'arrêtent à 2025. Le récit se tait, et la fiche dira
 * en une ligne que les comptes ne sont pas encore publiés.
 */
test("un mandat sans exercice publié ne raconte rien", () => {
  const neuf: Mandat = {
    debut: "2026-03-22",
    fin: null,
    exerciceReference: "2025",
    exerciceFin: "",
    exercices: 0,
    enCours: true,
  };
  assert.equal(recit(contexte({ mandat: neuf })), null);
});

/**
 * Le titre change avec les chiffres, pas avec le territoire.
 *
 * Quand aucun déplacement de structure n'atteint son seuil, c'est la règle de
 * niveau la plus saillante qui prend la tête. La commune ci-dessous voit sa
 * part d'impôts locaux ne bouger que de deux points ; son titre parle donc de
 * ce qui a réellement bougé.
 */
test("sans déplacement de structure, le titre revient à la règle la plus saillante", () => {
  const series: Record<string, Record<string, number>> = {
    ofgl_recettes_fonctionnement: { "2019": 1_200_000, "2025": 1_480_000 },
    ofgl_depenses_fonctionnement: { "2019": 980_000, "2025": 1_240_000 },
    ofgl_frais_personnel: { "2019": 420_000, "2025": 520_000 },
    ofgl_impots_locaux: { "2019": 610_000, "2025": 790_000 },
    ofgl_epargne_brute: { "2019": 220_000, "2025": 240_000 },
    ofgl_epargne_nette: { "2019": 180_000, "2025": 150_000 },
    ofgl_depenses_d_equipement: { "2019": 300_000, "2025": 260_000 },
    ofgl_dotation_globale_de_fonctionnement: { "2019": 210_000, "2025": 195_000 },
  };
  const r = recit(contexte({ nom: "Sainte-Croix-du-Mont", series, population: 1.2 }));
  assert.ok(!r?.titre.includes("contribuable local"));
  assert.match(r?.titre ?? "", /^À Sainte-Croix-du-Mont, /);
  // Le récit reste un enchaînement de sujets différents, même sans dette.
  assert.equal(new Set(r?.cites).size, r?.cites.length);
});
