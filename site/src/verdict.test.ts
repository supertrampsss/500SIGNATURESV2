/**
 * Ce que les phrases ont le droit de dire.
 *
 * Le client demandait un commentaire — « faut commenter ! ». Le risque est
 * entier : commenter des comptes publics, c'est à un mot près publier un
 * jugement sous couvert de constat. Ces tests tiennent la frontière. Ils
 * vérifient les chiffres, mais surtout ils vérifient **ce que le module refuse
 * d'écrire** : aucun adjectif qui ne se calcule pas, aucun pourcentage tiré
 * d'une grandeur nulle ou négative, aucune phrase sur une série incomplète, et
 * rien du tout quand rien n'a bougé.
 *
 * Les montants de Bordeaux sont réels, repris de la publication en ligne des
 * exercices 2019 et 2025. Des ronds ne feraient pas apparaître les arrondis à
 * la décimale ni les parts qui basculent d'un dixième de point.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Mandat } from "./mandat.ts";
import type { Contexte } from "./verdict.ts";
import { faitsRetenus, verdict } from "./verdict.ts";

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

/**
 * Bordeaux (33063), comptes du budget principal publiés par l'OFGL.
 *
 * Les recettes de fonctionnement de 2019 ne sont pas inventées : l'OFGL publie
 * l'identité « épargne brute = recettes de fonctionnement − dépenses de
 * fonctionnement », que le bloc « pont » du site recalcule déjà. 294 082 497 +
 * 57 871 668 = 351 954 165, et 2025 boucle de même sur 417 137 958,52.
 */
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
  ofgl_population_reference: { "2019": 256_045, "2025": 268_822 },
};

function bordeaux(series = BORDEAUX): Contexte {
  return { mandat: MANDAT, series, inflation: 16.1, population: 5.0, nom: "Bordeaux" };
}

/** Les mêmes séries, moins une. */
function sans(id: string): Record<string, Record<string, number>> {
  const copie = { ...BORDEAUX };
  delete copie[id];
  return copie;
}

/**
 * Bordeaux déplace sa part d'impôts locaux de 5,4 points sur le mandat, et ce
 * n'est pas un fait bordelais : mesuré sur les 534 communes de la Gironde, le
 * déplacement médian vaut +4,7 points et 65 % des communes dépassent trois
 * points. La réforme de la fiscalité de 2021 le produit presque partout. La
 * phrase ne sort donc qu'au delà de huit points, le troisième quartile de cette
 * mesure, et Bordeaux n'y est pas.
 */
test("le déplacement de structure ordinaire ne fait pas une phrase", () => {
  const phrases = verdict(bordeaux());
  assert.equal(phrases.length, 6);
  assert.equal(
    phrases.some((p) => /couvrent .* des recettes de fonctionnement/.test(p.texte)),
    false,
  );
});

test("un déplacement hors norme, lui, se dit, et sans en nommer la cause", () => {
  const series = { ...BORDEAUX };
  // Mêmes recettes, impôts locaux portés de 55,5 % à 71,5 % : +16 points.
  series.ofgl_impots_locaux = { ...series.ofgl_impots_locaux, "2025": 298_255_640 };
  const phrase = verdict({ ...bordeaux(), series }).find((p) =>
    /couvrent .* des recettes de fonctionnement/.test(p.texte),
  );
  assert.ok(phrase, "la phrase de structure doit sortir au dela de huit points");
  // Une recette fiscale en hausse renforce les comptes et pèse sur celui qui la
  // paie : colorer la puce trancherait entre les deux.
  assert.equal(phrase.sens, "neutre");
  // Elle décrit les comptes ; elle n'attribue le déplacement à personne.
  assert.doesNotMatch(phrase.texte, /déplacé|contribuable local|choix|décision/);
});

test("la dette est chiffrée avec le temps qu'il faudrait pour la rembourser", () => {
  const dette = verdict(bordeaux()).find((p) => p.vers === "ofgl_encours_dette");
  assert.equal(
    dette?.texte,
    `L'encours de dette passe de 252,3${FINE}M€ en 2019 à 413,0${FINE}M€ en 2025, soit`
      + ` +63,7${FINE}% ; au rythme de ce que la collectivité met de côté chaque année, il`
      + ` faudrait 8,6${FINE}ans pour la rembourser, contre 4,4${FINE}ans en 2019.`,
  );
  assert.equal(dette?.sens, "tend");
});

test("les frais de personnel disent aussi le poids qu'ils prennent", () => {
  const paie = verdict(bordeaux()).find((p) => p.vers === "ofgl_frais_personnel");
  // Le cadre est posé par une phrase précédente : celle-ci garde son chiffre,
  // son évolution et le poids du poste, sans réécrire les prix ni la population.
  assert.equal(
    paie?.texte,
    `Les frais de personnel passent de 143,6${FINE}M€ à 183,1${FINE}M€, soit`
      + ` +27,5${FINE}% ; ils pèsent 49,6${FINE}% des dépenses de fonctionnement, contre`
      + ` 48,8${FINE}% en 2019.`,
  );
});
test("toutes les phrases restent chiffrées et situées dans le temps", () => {
  // Alléger la queue ne doit pas produire des phrases en l'air : chacune garde
  // son chiffre, et les millésimes posés par la première valent pour la suite.
  const phrases = verdict(bordeaux());
  assert.ok(phrases.length >= 3);
  assert.match(phrases[0].texte, /2019/);
  for (const phrase of phrases) {
    assert.match(phrase.texte, /\d/, phrase.texte);
  }
});

test("les six phrases répondent à trois questions, pas trois fois à la même", () => {
  const vers = verdict(bordeaux()).map((p) => p.vers);
  // Ce qu'on doit, ce qu'on construit, qui paie, ce que coûte le fonctionnement.
  assert.deepEqual(vers, [
    "ofgl_encours_dette",
    "ofgl_depenses_d_equipement",
    "ofgl_epargne_nette",
    "ofgl_impots_locaux",
    "ofgl_depenses_fonctionnement",
    "ofgl_frais_personnel",
  ]);
});

test("les phrases sortent des plus saillantes aux moins saillantes", () => {
  const saillances = verdict(bordeaux()).map((p) => p.saillance);
  assert.deepEqual(saillances, [...saillances].sort((a, b) => b - a));
});

test("le plafond de phrases est respecté", () => {
  assert.equal(verdict(bordeaux(), 2).length, 2);
  assert.equal(verdict(bordeaux(), 0).length, 0);
});

/**
 * La liste noire.
 *
 * « Explosé », « dérive », « inquiétant » sont des jugements déguisés en
 * constats : deux lecteurs ne mettent pas le même seuil derrière, et aucun des
 * deux ne peut le vérifier. Le test balaie toutes les sorties de tous les
 * territoires d'essai, y compris les titres que le récit reprendra.
 */
const INTERDITS = [
  "explos", "dériv", "deriv", "flamb", "envolé", "envole", "dérap", "derap",
  "inquiét", "inquiet", "alarm", "catastroph", "spectacul", "massif", "massive",
  "considérable", "considerable", "excessi", "abusi", "gaspill", "scandal",
  "gabegie", "laxis", "vertueu", "malsain", "mal géré", "mal gere", "importan",
  "dérisoire", "derisoire", "faramineu", "vertigineu", "plomb", "creuse",
];

function toutesLesSorties(): string[] {
  const contextes = [
    bordeaux(),
    bordeaux(sans("ofgl_recettes_fonctionnement")),
    { ...bordeaux(), inflation: null, population: null },
    { ...bordeaux(), nom: "Le Havre" },
    petiteCommune(),
  ];
  return contextes.flatMap((c) => faitsRetenus(c, 20).flatMap((f) => [f.texte, f.bref, f.titre]));
}

test("aucun adjectif qui ne se calcule pas", () => {
  for (const sortie of toutesLesSorties()) {
    for (const mot of INTERDITS) {
      assert.ok(
        !sortie.toLowerCase().includes(mot),
        `« ${mot} » apparaît dans : ${sortie}`,
      );
    }
  }
});

/**
 * Zéro tiret cadratin, zéro demi-cadratin.
 *
 * Ils se glissent partout dans du texte généré et ne se voient qu'à
 * l'impression, où ils cassent la justification. Le signe moins, lui, doit être
 * le vrai (U+2212) et non le trait d'union du clavier : les deux se côtoyaient
 * à l'écran dans deux dessins et deux largeurs.
 */
test("aucun tiret cadratin ni demi-cadratin dans les phrases produites", () => {
  for (const sortie of toutesLesSorties()) {
    assert.ok(!sortie.includes("—"), `cadratin dans : ${sortie}`);
    assert.ok(!sortie.includes("–"), `demi-cadratin dans : ${sortie}`);
  }
});

test("le signe moins est le vrai, pas le trait d'union", () => {
  const epargne = verdict(bordeaux(), 20).find((p) => p.vers === "ofgl_epargne_nette");
  assert.match(epargne?.texte ?? "", /−55,7/);
  assert.ok(!(epargne?.texte ?? "").includes("-55,7"));
});

/** Une commune de 1 800 habitants, sans dette, aux masses en milliers d'euros. */
function petiteCommune(): Contexte {
  return {
    mandat: MANDAT,
    nom: "Sainte-Croix-du-Mont",
    inflation: 16.1,
    population: 1.2,
    series: {
      ofgl_recettes_fonctionnement: { "2019": 1_200_000, "2025": 1_480_000 },
      ofgl_depenses_fonctionnement: { "2019": 980_000, "2025": 1_240_000 },
      ofgl_frais_personnel: { "2019": 420_000, "2025": 520_000 },
      ofgl_impots_locaux: { "2019": 610_000, "2025": 790_000 },
      ofgl_encours_dette: { "2019": 0, "2025": 0 },
      ofgl_epargne_brute: { "2019": 220_000, "2025": 240_000 },
      ofgl_epargne_nette: { "2019": 180_000, "2025": 150_000 },
      ofgl_depenses_d_equipement: { "2019": 300_000, "2025": 260_000 },
      ofgl_dotation_globale_de_fonctionnement: { "2019": 210_000, "2025": 195_000 },
    },
  };
}

/**
 * Une commune sans dette n'a pas de phrase de dette.
 *
 * Un encours nul au départ n'a pas de variation en pourcentage, et « +0 % » sur
 * une dette inexistante occuperait une ligne pour ne rien dire. La règle est
 * générale : aucune grandeur nulle ou négative au départ ne produit de
 * pourcentage.
 */
test("un territoire sans dette n'écrit rien sur sa dette", () => {
  const vers = faitsRetenus(petiteCommune(), 20).map((f) => f.vers);
  assert.ok(!vers.includes("ofgl_encours_dette"));
  // Le reste sort normalement : l'absence d'une série n'en fait pas taire une autre.
  assert.ok(vers.includes("ofgl_depenses_fonctionnement"));
  assert.ok(vers.includes("ofgl_frais_personnel"));
});

test("une épargne nette négative au départ ne produit pas de pourcentage", () => {
  const series = { ...BORDEAUX, ofgl_epargne_nette: { "2019": -50_000, "2025": 10_000 } };
  const vers = faitsRetenus(bordeaux(series), 20).map((f) => f.vers);
  // Une épargne qui passe de −50 k€ à +10 k€ s'améliore ; « +120 % » dirait
  // exactement le contraire, et le calcul serait pourtant juste.
  assert.ok(!vers.includes("ofgl_epargne_nette"));
});

/**
 * Une série manquante fait taire sa phrase, pas les autres.
 *
 * Sans recettes de fonctionnement publiées, la part des impôts locaux n'a pas
 * de dénominateur : la phrase qui dit qui paie disparaît. Les phrases de niveau
 * restent, et le classement bascule ensemble sur l'écart en points.
 */
test("sans recettes publiées, la phrase de structure disparaît et les autres restent", () => {
  const phrases = faitsRetenus(bordeaux(sans("ofgl_recettes_fonctionnement")), 20);
  assert.ok(!phrases.some((f) => f.texte.includes("couvrent")));
  assert.ok(phrases.length >= 5);
  // Les impôts locaux gardent leur phrase de niveau : c'est la part qui manque,
  // pas le montant.
  assert.ok(phrases.some((f) => f.vers === "ofgl_impots_locaux"));
});

test("une série amputée d'un de ses deux exercices n'écrit rien", () => {
  const series = { ...BORDEAUX, ofgl_frais_personnel: { "2019": 143_587_933 } };
  const vers = faitsRetenus(bordeaux(series), 20).map((f) => f.vers);
  // Un trou ne se comble pas par l'exercice voisin : ce serait comparer deux
  // fenêtres sous un seul titre.
  assert.ok(!vers.includes("ofgl_frais_personnel"));
});

/**
 * Quand rien n'a bougé, la fiche se tait.
 *
 * Toutes les masses de cette commune progressent de 3,0 % sur six exercices,
 * pour 2,5 % d'évolution mécanique (prix et population) : ni la variation ni
 * l'écart à cette évolution n'atteignent les seuils, et les parts ne bougent
 * pas d'un point. Une puce disant « +3,0 % » serait du bruit présenté comme un
 * fait de mandat.
 */
test("un territoire à variations minuscules ne produit aucune phrase", () => {
  const stable = (bas: number) => ({ "2019": bas, "2025": bas * 1.03 });
  const contexte: Contexte = {
    mandat: MANDAT,
    nom: "Fours",
    inflation: 2.0,
    population: 0.5,
    series: {
      ofgl_recettes_fonctionnement: stable(1_000_000),
      ofgl_depenses_fonctionnement: stable(900_000),
      ofgl_frais_personnel: stable(400_000),
      ofgl_impots_locaux: stable(500_000),
      ofgl_encours_dette: stable(300_000),
      ofgl_epargne_brute: stable(100_000),
      ofgl_epargne_nette: stable(60_000),
      ofgl_depenses_d_equipement: stable(80_000),
      ofgl_dotation_globale_de_fonctionnement: stable(120_000),
    },
  };
  assert.deepEqual(verdict(contexte, 20), []);
});
test("sans inflation connue, aucune phrase ne suppose les prix", () => {
  const phrases = verdict({ ...bordeaux(), inflation: null, population: null }, 20);
  for (const phrase of phrases) {
    assert.ok(!phrase.texte.includes("les prix"));
    assert.ok(!phrase.texte.includes("pouvoir d'achat"));
  }
  // La dotation ne sort plus : sans les prix, −2,2 % n'est qu'une variation
  // minuscule, et il n'y a rien à en dire.
  assert.ok(!phrases.some((p) => p.vers === "ofgl_dotation_globale_de_fonctionnement"));
});

/**
 * Le sens colore la puce, il ne juge pas la politique.
 *
 * Une hausse de dépenses tend les comptes, une hausse d'épargne les détend, et
 * un impôt qui monte ne fait ni l'un ni l'autre : il renforce les comptes et
 * pèse sur celui qui le paie. Trancher entre les deux serait une opinion.
 */
test("le sens suit les comptes et s'abstient quand deux lectures se valent", () => {
  const par = new Map(faitsRetenus(bordeaux(), 20).map((f) => [`${f.vers}|${f.sujet}`, f.sens]));
  assert.equal(par.get("ofgl_depenses_fonctionnement|exploitation"), "tend");
  assert.equal(par.get("ofgl_epargne_nette|investissement"), "tend");
  assert.equal(par.get("ofgl_impots_locaux|financement"), "neutre");
  assert.equal(par.get("ofgl_depenses_d_equipement|investissement"), "neutre");
});

test("une baisse de dépenses détend ce qu'une hausse tendait", () => {
  const series = {
    ...BORDEAUX,
    ofgl_depenses_fonctionnement: { "2019": 294_082_497, "2025": 220_000_000 },
  };
  const depenses = faitsRetenus(bordeaux(series), 20)
    .find((f) => f.vers === "ofgl_depenses_fonctionnement");
  assert.equal(depenses?.sens, "detend");
  assert.match(depenses?.texte ?? "", /soit −25,2/);
});
/* --------------------------------------------------------------------------
 * Le groupe de communes semblables : ce qui décroche, pas ce qui franchit
 * ----------------------------------------------------------------------- */

/**
 * Les quartiles réellement publiés pour Bordeaux dans `comparaisons.json`,
 * groupe « 0: » de la cascade, 25 communes semblables, par habitant.
 *
 * Ils disent trois choses différentes, et c'est tout l'intérêt : la dette sort
 * du groupe pendant le mandat, les dépenses de fonctionnement y restent d'un
 * bout à l'autre, la dotation globale de fonctionnement est sous le premier
 * quartile aux deux dates.
 */
const QUARTILES: Record<string, Record<string, { q1: number; mediane: number; q3: number }>> = {
  ofgl_encours_dette: {
    "2019": { q1: 693.8, mediane: 950.3, q3: 1458.4 },
    "2025": { q1: 911.7, mediane: 1148.7, q3: 1491.0 },
  },
  ofgl_depenses_fonctionnement: {
    "2019": { q1: 1036.6, mediane: 1154.0, q3: 1221.1 },
    "2025": { q1: 1178.9, mediane: 1357.7, q3: 1434.6 },
  },
  ofgl_dotation_globale_de_fonctionnement: {
    "2019": { q1: 207.4, mediane: 235.5, q3: 269.1 },
    "2025": { q1: 199.8, mediane: 237.9, q3: 285.1 },
  },
  ofgl_impots_locaux: {
    "2019": { q1: 648.5, mediane: 762.3, q3: 820.8 },
    "2025": { q1: 792.8, mediane: 892.7, q3: 1003.6 },
  },
};

function semblables(indicateur: string, exercice: string) {
  const quartiles = QUARTILES[indicateur]?.[exercice];
  const brut = BORDEAUX[indicateur]?.[exercice];
  const habitants = BORDEAUX["ofgl_population_reference"]?.[exercice];
  if (!quartiles || brut === undefined || !habitants) return null;
  return { valeur: brut / habitants, ...quartiles, n: 25, criteres: ["tranche_population"] };
}

const AVEC_GROUPE: Contexte = { ...bordeaux(), semblables };

test("un fait n'entre que s'il sort du lot de ses semblables", () => {
  const retenus = faitsRetenus(AVEC_GROUPE, 6).map((f) => f.vers);
  // La dette passe du centre du groupe au quart le plus haut : elle décroche.
  assert.ok(retenus.includes("ofgl_encours_dette"));
  // La dotation globale de fonctionnement n'a plus de règle : « −99,8 % » sur
  // Paris décrivait un écrêtement qui a dépassé la dotation, pas une politique.
  // Les dépenses de fonctionnement font +25,5 %, au-dessus du seuil absolu de
  // dix points — mais elles restent dans la moitié centrale du groupe d'un bout
  // à l'autre. Elles ne disent donc rien de propre à Bordeaux.
  assert.ok(!retenus.includes("ofgl_depenses_fonctionnement"));
});

test("sans groupe publié, la barre absolue reprend la main", () => {
  // Un département n'a pas de strate : la sélection ne peut pas être relative,
  // et se taire serait pire que de retomber sur le seuil mesuré.
  const retenus = faitsRetenus(bordeaux(), 6).map((f) => f.vers);
  assert.ok(retenus.includes("ofgl_depenses_fonctionnement"));
});

test("la phrase cite le groupe et son effectif, jamais un par-habitant", () => {
  const phrase = verdict(AVEC_GROUPE, 6)[0].texte;
  assert.match(phrase, /25 communes semblables/);
  // Le repère du groupe remplace les prix et la population : un seul repère
  // par phrase, et celui-là contient déjà l'inflation.
  assert.doesNotMatch(phrase, /les prix ont monté/);
  // Aucun jugement : une position et des nombres publiés.
  assert.match(phrase, /quart le plus haut/);
  // Les quartiles sont publiés par habitant : le niveau de la médiane ne se dit
  // donc pas ici. Le par-habitant ne s'affiche que dans les tableaux dépliés,
  // là où il porte son dénominateur.
  assert.doesNotMatch(phrase, /par habitant/);
  assert.doesNotMatch(phrase, /médiane est à/);
});

/**
 * Le groupe se nomme dans la maille qu'il regroupe.
 *
 * La fiche de Nouvelle-Aquitaine écrivait « quand ses 17 communes semblables »
 * et « la commune est dans le quart le plus bas » : le mot était en dur ici,
 * et une région se lisait comme une commune.
 */
test("le groupe et le territoire se disent dans la maille de la fiche", () => {
  const phrase = verdict({ ...AVEC_GROUPE, maille: "région" }, 6)[0].texte;
  assert.match(phrase, /25 régions semblables/);
  assert.match(phrase, /la région est dans le quart/);
  assert.doesNotMatch(phrase, /commune/);
  // Le département prend son article.
  assert.match(
    verdict({ ...AVEC_GROUPE, maille: "département" }, 6)[0].texte,
    /le département est dans le quart/,
  );
});
test("le produit des impôts locaux dit le taux voté, pas ce qu'il ignore", () => {
  // « Ce total ne dit pas ce qui vient des taux votés » s'excusait d'un chiffre
  // que le site publie : le taux communal de taxe foncière de la DGFiP.
  const avecTaux = bordeaux({
    ...BORDEAUX,
    dgfip_taux_tfb_commune: { "2019": 27.66, "2025": 29.14 },
  });
  const phrase = verdict(avecTaux, 8).find(
    (p) => p.vers === "ofgl_impots_locaux" && p.texte.startsWith("Ce que"),
  );
  assert.ok(phrase);
  assert.match(phrase.texte, /le taux communal de taxe foncière voté est passé/);
  assert.doesNotMatch(phrase.texte, /ne dit pas/);
});

/* ------------------------------------------------------ la fiche nationale */

test("la France écrit des phrases, sur les séries qu'elle a vraiment", () => {
  // Les huit règles locales lisent toutes des séries `ofgl_*`, qu'aucune maille
  // nationale ne porte : la fiche France n'écrivait pas une phrase sur cent
  // quatre-vingt-dix séries publiées.
  const contexte = {
    mandat: {
      debut: "", fin: null, exerciceReference: "2019", exerciceFin: "2025",
      exercices: 6, enCours: true,
    },
    series: {
      etat_depenses_nettes_bg: { "2019": 336_069e6, "2025": 441_194e6 },
      etat_charge_dette: { "2019": 40_256e6, "2025": 51_583e6 },
      eurostat_dette_pib: { "2019": 98.2, "2025": 115.6 },
      eurostat_deficit_pib: { "2019": -2.4, "2025": -5.1 },
    },
    inflation: 16.1, population: 1.8, nom: "France",
    avecPreposition: false, fenetre: "depuis 2019",
  } as never as Contexte;
  const phrases = verdict(contexte);
  assert.ok(phrases.length >= 3, `${phrases.length} phrases`);

  // Un taux varie en points, jamais en pourcentage : la dette passe de 98,2 à
  // 115,6 % du PIB, c'est +17,4 points. « +17,7 % » serait un troisième nombre.
  const dette = phrases.find((p) => p.vers === "eurostat_dette_pib");
  assert.match(dette!.texte, /\+17,4 points/);
  assert.doesNotMatch(dette!.texte, /17,7/);

  // Un solde négatif a une variation comme un autre : la règle en pourcentage
  // l'écartait, parce qu'elle refuse une base négative.
  const solde = phrases.find((p) => p.vers === "eurostat_deficit_pib");
  assert.match(solde!.texte, /−2,7 points/);
  assert.match(solde!.texte, /un déficit de 5,1[\u202f\u00a0 ]% du PIB/);

  // Et la dette publique dégrade, le déficit qui se creuse aussi.
  assert.equal(dette!.sens, "tend");
  assert.equal(solde!.sens, "tend");
});

test("les règles nationales ne se déclenchent pas sur une commune", () => {
  // Une commune ne porte aucune de ces séries : rien ne doit apparaître par
  // défaut sur une fiche qui n'en a pas.
  const vers = verdict(bordeaux()).map((p) => p.vers);
  for (const national of ["etat_depenses_nettes_bg", "eurostat_dette_pib", "eurostat_deficit_pib"]) {
    assert.ok(!vers.includes(national), national);
  }
});
