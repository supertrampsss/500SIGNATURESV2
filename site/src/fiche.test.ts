/**
 * Deux réponses à « est-ce beaucoup ? », et ce qui les distingue.
 *
 * Un effectif ne se compare pas d'une maille à l'autre : « 171 777 logements »
 * face à un département ne dit que la différence de taille. Sa densité, elle,
 * se compare — et c'est la seule grandeur qui le fasse. Le groupe de communes
 * semblables, lui, compare ce qui est comparable par construction, mais ses
 * quartiles ne sont pas tous dans la même unité : une dépense se rapporte aux
 * habitants, une médiane de revenus et un taux se comparent tels qu'ils sont
 * publiés.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Indicateur } from "./donnees.ts";
import {
  afficherFiche,
  comparableAuxAutresTerritoires,
  densiteRapportableAuxHabitants,
  ecartEnEuros,
  fenetreLisible,
  groupeDeLaCommune,
  jumeaux,
  lectureDeDensite,
  mesurer,
  mentionAgregat,
  ongletsThemes,
  positionDansGroupe,
  rubriqueDuTheme,
  valeurComparable,
} from "./fiche.ts";

const TERRITOIRE = {
  nom: "Bordeaux",
  series: {},
  drapeaux: { tranche_population: "7", rural: "Non", outre_mer: "Non" },
} as never;
const CRITERES = ["tranche_population", "rural", "outre_mer"];

test("un effectif sans repère direct se lit en pourcentage d'écart", () => {
  // « 641 pour 1 000 hab., contre 505 pour 1 000 hab. pour son département »
  // demandait une soustraction de tête ; « +27 % » la fait pour le lecteur.
  const phrase = lectureDeDensite({
    valeur: 641,
    comparaisons: [{ libelle: "son département", valeur: 505 }],
  });
  assert.match(phrase, /\+27\u202f% vs son département/);
  assert.match(phrase, /par habitant/);
});

test("sans densité comparable, rien n'est écrit plutôt qu'un chiffre seul", () => {
  assert.equal(lectureDeDensite(null), "");
  assert.equal(lectureDeDensite({ valeur: 641, comparaisons: [] }), "");
  assert.equal(
    lectureDeDensite({ valeur: 641, comparaisons: [{ libelle: "x", valeur: NaN }] }),
    "",
  );
});

test("la position dans le groupe tient en une phrase, en pourcentage", () => {
  // Quatre lignes de quartiles demandaient de savoir ce qu'est un quartile ;
  // « +68 % vs la médiane, dans le quart le plus haut » se comprend sans.
  const html = positionDansGroupe(
    TERRITOIRE,
    { n: 536, q1: 600, mediane: 800, q3: 1000 },
    1344,
    CRITERES,
    { base: "par_habitant", unite: "EUR" },
  );
  assert.match(html, /536/);
  assert.match(html, /\+68\u202f% vs la médiane/);
  assert.match(html, /dans le quart le plus haut/);
  assert.doesNotMatch(html, /quartile/i);
});

test("les quartiles d'un effectif se lisent pour mille habitants", () => {
  // « 0,04 logement vacant par habitant » ne se lit pas ; « 36 pour 1 000 hab. »
  // se lit, et c'est la convention du reste du site.
  const html = positionDansGroupe(
    TERRITOIRE,
    { n: 812, q1: 28, mediane: 36, q3: 45 },
    43,
    CRITERES,
    { base: "pour_mille", unite: "count" },
  );
  assert.doesNotMatch(html, /€/);
  assert.match(html, /vs la médiane \(36 pour 1 000 hab/);
  assert.match(html, /dans la moitié centrale/);
});

test("les quartiles d'un taux ne s'affichent pas en euros", () => {
  // Le défaut que la base corrige : un taux de pauvreté de 11 % s'affichait
  // « 11 € par habitant », parce que le rendu codait l'unité en dur.
  const html = positionDansGroupe(
    TERRITOIRE,
    { n: 812, q1: 9, mediane: 11, q3: 14 },
    11.4,
    CRITERES,
    { base: "valeur", unite: "percent" },
  );
  assert.doesNotMatch(html, /€/);
  assert.doesNotMatch(html, /par habitant/);
  assert.match(html, /dans la moitié centrale/);
});

test("la réserve du groupe vit sur la page Données, plus dans la fiche", () => {
  // Six lignes de texte serré avant le premier chiffre du panneau : critères
  // du groupe et réserve sur l'intercommunalité sont repris, développés, dans
  // « Ce qui rend deux territoires comparables ».
  const html = positionDansGroupe(
    TERRITOIRE,
    { n: 536, q1: 600, mediane: 800, q3: 1000 },
    1344,
    CRITERES,
    { base: "par_habitant", unite: "EUR" },
  );
  assert.doesNotMatch(html, /ne signifie pas une meilleure gestion/);
  assert.doesNotMatch(html, /strate de population/);
  assert.doesNotMatch(html, /<details/);
});

test("sans quartiles ni valeur, aucune position n'est affirmée", () => {
  assert.equal(positionDansGroupe(TERRITOIRE, undefined, 1344, CRITERES), "");
  assert.equal(
    positionDansGroupe(TERRITOIRE, { n: 5, q1: 1, mediane: 2, q3: 3 }, undefined, CRITERES),
    "",
  );
});

// La Brède, Gironde, exercice 2025 : le cas mesuré. La population municipale du
// recensement et la population de référence de l'OFGL diffèrent de 12 % ; le
// quartile de la commune dans son groupe en dépend.
const LA_BREDE = {
  nom: "La Brède",
  population: 4_386,
  series: {
    ofgl_depenses_fonctionnement: { "2025": 4_385_666.73 },
    ofgl_population_reference: { "2025": 4_941 },
  },
  drapeaux: { tranche_population: "3", rural: "Non", outre_mer: "Non" },
} as never;

test("la valeur comparée se rapporte à la population de l'OFGL, pas à celle du recensement", () => {
  // 4 385 666,73 / 4 941 = 888 €. Avec la population municipale (4 386) :
  // 1 000 €. Le groupe de La Brède compte 949 communes, premier quartile 775 €
  // et médiane 916 € : 888 € la place dans la moitié centrale, 1 000 € au-dessus
  // de la médiane. Une commune sur douze en Gironde changeait ainsi de quartile.
  const valeur = valeurComparable(LA_BREDE, "ofgl_depenses_fonctionnement", "2025", {
    base: "par_habitant",
  });
  assert.equal(Math.round(valeur as number), 888);
});

test("un effectif se compare pour mille habitants, un taux tel qu'il est publié", () => {
  const pourMille = valeurComparable(LA_BREDE, "ofgl_depenses_fonctionnement", "2025", {
    base: "pour_mille",
  });
  assert.equal(Math.round(pourMille as number), 887_607);
  const telQuel = valeurComparable(LA_BREDE, "ofgl_depenses_fonctionnement", "2025", {
    base: "valeur",
  });
  assert.equal(telQuel, 4_385_666.73);
});

test("sans population de référence, la commune n'est pas placée", () => {
  // La publication l'écarte du calcul des quartiles : la placer quand même
  // reviendrait à la comparer à un groupe dont elle ne fait pas partie. Sa
  // population municipale ne peut pas servir de substitut — c'est justement
  // l'erreur qu'on répare.
  const valeur = valeurComparable(LA_BREDE, "ofgl_depenses_fonctionnement", "2024", {
    base: "par_habitant",
  });
  assert.equal(valeur, undefined);
});

test("un indicateur absent de la commune ne produit aucune position", () => {
  assert.equal(
    valeurComparable(LA_BREDE, "insee_logements_vacants", "2025", { base: "pour_mille" }),
    undefined,
  );
});

// La cascade : plusieurs découpages du même ensemble, du plus fin au plus large.
const CASCADE = [
  ["tranche_population", "rural", "outre_mer", "montagne", "touristique"],
  ["tranche_population", "rural", "outre_mer"],
];
const QUARTILES = { n: 40, q1: 1, mediane: 2, q3: 3 };

test("la commune reçoit le groupe le plus fin qui existe pour elle", () => {
  const commune = {
    nom: "Station",
    series: {},
    drapeaux: {
      tranche_population: "3",
      rural: "Oui",
      outre_mer: "Non",
      montagne: "Oui",
      touristique: "Oui",
    },
  } as never;
  const trouve = groupeDeLaCommune(
    commune,
    { "0:3|Oui|Non|Oui|Oui": QUARTILES, "1:3|Oui|Non": { ...QUARTILES, n: 900 } },
    CASCADE,
  );
  assert.equal(trouve?.quartiles.n, 40);
  assert.deepEqual(trouve?.criteres, CASCADE[0]);
});

test("une commune trop singulière retombe sur un découpage plus large", () => {
  // C'est tout l'intérêt de la cascade : sans elle, affiner les critères ferait
  // disparaître le repère des communes atypiques — sans un mot, un groupe absent
  // ne s'affiche pas.
  const commune = {
    nom: "Cas rare",
    series: {},
    drapeaux: {
      tranche_population: "7",
      rural: "Non",
      outre_mer: "Oui",
      montagne: "Oui",
      touristique: "Oui",
    },
  } as never;
  const trouve = groupeDeLaCommune(commune, { "1:7|Non|Oui": QUARTILES }, CASCADE);
  assert.equal(trouve?.quartiles.n, 40);
  assert.deepEqual(trouve?.criteres, CASCADE[1]);
});

test("aucun groupe ne vaut mieux qu'un groupe inventé", () => {
  const commune = { nom: "Inconnue", series: {}, drapeaux: {} } as never;
  assert.equal(groupeDeLaCommune(commune, { "0:x": QUARTILES }, CASCADE), undefined);
  assert.equal(groupeDeLaCommune(commune, undefined, CASCADE), undefined);
});

test("le groupe se nomme sans étaler ses critères dans la fiche", () => {
  // Les critères qui ont servi restent expliqués sur la page « Données » ;
  // dans la fiche ils faisaient une ligne de jargon avant les chiffres.
  const commune = {
    nom: "Station",
    series: {},
    drapeaux: { tranche_population: "3", rural: "Oui", outre_mer: "Non", montagne: "Oui",
                touristique: "Oui" },
  } as never;
  const html = positionDansGroupe(commune, QUARTILES, 2, CASCADE[0]);
  assert.match(html, /communes semblables/);
  assert.doesNotMatch(html, /commune de montagne/);
});

test("un effectif compté au lieu de travail n'a pas de densité résidente", () => {
  // Bordeaux compte 201 045 postes salariés pour 268 000 habitants, une
  // commune-dortoir voisine quelques centaines pour dix mille. « Rapporté à la
  // population » présenterait cet écart comme une intensité d'emploi, alors
  // qu'il mesure la distance entre là où l'on travaille et là où l'on dort.
  const posteSalarie = {
    id: "insee_effectifs_salaries",
    unite: "count",
    sommable: true,
    jeu: "melodi-flores-a5",
  } as never;
  assert.equal(densiteRapportableAuxHabitants(posteSalarie), false);
});

test("un effectif qui décrit bien les habitants garde sa densité", () => {
  const logementVacant = {
    id: "insee_logements_vacants",
    unite: "count",
    sommable: true,
    jeu: "melodi-rp-logement",
  } as never;
  assert.equal(densiteRapportableAuxHabitants(logementVacant), true);
});

test("une population ne se rapporte pas à elle-même", () => {
  const population = {
    id: "insee_population_municipale",
    unite: "count",
    sommable: true,
    jeu: "melodi-rp-population",
  } as never;
  assert.equal(densiteRapportableAuxHabitants(population), false);
});

/**
 * Vingt-six onglets sur une ligne cachaient vingt-deux thèmes hors de l'écran.
 * Ces tests fixent ce que le regroupement en rubriques doit préserver : rien
 * ne disparaît, et la barre des thèmes reste dans le document même quand elle
 * ne s'affiche pas — c'est elle qui dit quoi ouvrir en changeant de rubrique.
 */

const TOUS_LES_THEMES = [
  "finances_locales", "impots_locaux", "budget_etat", "depenses_fiscales", "dette",
  "fonctions", "securite_sociale", "vie_associative", "macro", "europe", "population",
  "revenus", "famille", "diplomes", "elections", "prenoms", "emploi", "professions",
  "entreprises", "secteurs_salaries", "secteurs_etablissements", "logement", "sante",
  "education", "securite", "equipements", "tourisme",
];

test("les vingt-sept thèmes publiés sont rangés à la main, aucun par défaut", () => {
  // Un thème non listé tombe dans la dernière rubrique : c'est un filet, pas
  // une décision. Ce test dit combien de thèmes le site publie, pour qu'un
  // vingt-huitième n'y arrive pas en silence.
  assert.equal(TOUS_LES_THEMES.length, 27);
  for (const theme of TOUS_LES_THEMES) {
    if (theme === "tourisme") continue; // dernier de la dernière rubrique
    assert.notEqual(rubriqueDuTheme(theme), undefined);
  }
  // Les subventions de l'État aux associations sont de l'argent public qui
  // sort, pas un trait du cadre de vie.
  assert.equal(rubriqueDuTheme("vie_associative"), "argent");
});

test("chaque thème publié garde un onglet, aucun n'est perdu en chemin", () => {
  const html = ongletsThemes(TOUS_LES_THEMES, "finances_locales");
  for (const theme of TOUS_LES_THEMES) {
    assert.match(html, new RegExp(`data-theme="${theme}"`), `${theme} n'a pas d'onglet`);
  }
});

test("les thèmes tiennent dans quatre rubriques", () => {
  const html = ongletsThemes(TOUS_LES_THEMES, "finances_locales");
  const rubriques = [...html.matchAll(/data-rubrique="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(rubriques)], ["argent", "habitants", "travail", "cadre"]);
});

test("un thème inconnu de la table s'affiche au lieu de disparaître", () => {
  // La règle des libellés : une liste écrite en dur avait déjà fait disparaître
  // des données parfaitement publiées.
  // « transports » n'est pas dans la table : c'est le filet qui le range.
  const html = ongletsThemes(["finances_locales", "transports"], "finances_locales");
  assert.match(html, /data-theme="transports"/);
  assert.equal(rubriqueDuTheme("transports"), "cadre");
  // « energie », lui, y est désormais rangé à la main.
  assert.equal(rubriqueDuTheme("energie"), "cadre");
});

test("seule la barre de la rubrique ouverte s'affiche, les autres restent lisibles au code", () => {
  const html = ongletsThemes(TOUS_LES_THEMES, "logement");
  const barres = [...html.matchAll(/<nav class="onglets-themes" data-rubrique="([a-z]+)"([^>]*)>/g)];
  assert.equal(barres.length, 4);
  for (const [, cle, attributs] of barres) {
    assert.equal(attributs.includes("hidden"), cle !== "cadre", `barre ${cle}`);
  }
});

test("une rubrique d'un seul thème garde sa barre mais ne la montre pas", () => {
  const html = ongletsThemes(["finances_locales", "logement", "sante"], "finances_locales");
  assert.match(html, /<nav class="onglets-themes" data-rubrique="argent" data-seul/);
  assert.doesNotMatch(html, /<nav class="onglets-themes" data-rubrique="cadre" data-seul/);
});

test("sans deuxième rubrique, il n'y a pas de barre de rubriques", () => {
  const html = ongletsThemes(["logement", "sante", "education"], "logement");
  assert.doesNotMatch(html, /onglets-rubriques/);
  assert.match(html, /data-theme="sante"/);
});

/**
 * Une adresse n'est pas un territoire.
 *
 * Les subventions de l'État aux associations sont imputées au siège du
 * bénéficiaire : Paris porte 3,23 Md€, soit 32,5 % du total. Bordeaux
 * s'affichait « +3 460 % au-dessus de la médiane des communes de la région »,
 * un écart qui ne mesure ni ce que reçoivent les Bordelais ni ce que l'État y
 * dépense — seulement où les fédérations ont leur siège.
 */

const AU_SIEGE = {
  id: "etat_subventions_associations",
  unite: "EUR",
  sommable: true,
  jeu: "plf-2023-effort-associations",
} as never;

test("un montant imputé au siège ne se compare à aucun territoire", () => {
  assert.equal(comparableAuxAutresTerritoires(AU_SIEGE), false);
  // Et le chiffre reste publié : c'est la comparaison qui tombe, pas la donnée.
  assert.equal(
    comparableAuxAutresTerritoires({ ...(AU_SIEGE as object), jeu: "ofgl-communes" } as never),
    true,
  );
});

test("un effectif compté au siège n'a pas les habitants pour dénominateur", () => {
  const etablissements = {
    id: "etat_subventions_associations_etablissements",
    unite: "count",
    sommable: true,
    jeu: "plf-2023-effort-associations",
  } as never;
  assert.equal(densiteRapportableAuxHabitants(etablissements), false);
});

/**
 * Trop d'indicateurs, c'est moins d'information.
 *
 * Soixante-dix-neuf lignes de comptes locaux et trente-deux lignes de
 * sécurité — dont seize qui redisaient les seize autres — se faisaient défiler
 * sans que rien n'en reste. Ces tests fixent les deux réponses : le doublon
 * est fondu, et le reste passe derrière un pli.
 */

test("le nombre rejoint le taux : un phénomène, une ligne", () => {
  const catalogue = [
    { id: "ssmsi_cambriolages_taux", theme: "securite" },
    { id: "ssmsi_cambriolages_nombre", theme: "securite" },
    { id: "ssmsi_homicides_taux", theme: "securite" },
    { id: "ssmsi_homicides_nombre", theme: "securite" },
    { id: "insee_population_municipale", theme: "population" },
  ] as never as Indicateur[];
  const paires = jumeaux(catalogue);
  assert.equal(paires.size, 2);
  assert.equal(paires.get("ssmsi_cambriolages_taux")?.id, "ssmsi_cambriolages_nombre");
  // Le taux reste la ligne : c'est lui qui se compare d'un territoire à l'autre.
  assert.equal(paires.has("ssmsi_cambriolages_nombre"), false);
});

test("un nombre sans taux jumeau reste une ligne à lui seul", () => {
  // La règle ne doit pas faire disparaître un indicateur qui n'a pas de
  // jumeau : ce serait perdre une mesure pour ranger une liste.
  const catalogue = [
    { id: "insee_chomeurs_rp_nombre", theme: "emploi" },
    { id: "ssmsi_cambriolages_taux", theme: "securite" },
  ] as never as Indicateur[];
  assert.equal(jumeaux(catalogue).size, 0);
});

test("un taux et un nombre de thèmes différents ne sont pas jumeaux", () => {
  const catalogue = [
    { id: "x_taux", theme: "securite" },
    { id: "x_nombre", theme: "sante" },
  ] as never as Indicateur[];
  assert.equal(jumeaux(catalogue).size, 0);
});

test("les paires hors convention de nommage se replient aussi", () => {
  // Hôtels et chambres, votants et taux de participation : même phénomène,
  // deux comptages, la convention _taux/_nombre ne les attrapait pas.
  const catalogue = [
    { id: "insee_hotels", theme: "tourisme" },
    { id: "insee_hotels_chambres", theme: "tourisme" },
    { id: "elections_votants", theme: "elections" },
    { id: "elections_taux_participation", theme: "elections" },
  ] as never as Indicateur[];
  const paires = jumeaux(catalogue);
  assert.equal(paires.get("insee_hotels_chambres")?.id, "insee_hotels");
  assert.equal(paires.get("elections_taux_participation")?.id, "elections_votants");
  // La capacité et le taux restent les lignes ; l'enseigne et les votants
  // deviennent des phrases.
  assert.equal(paires.has("insee_hotels"), false);
});

test("le budget voté rejoint le budget exécuté, mission par mission", () => {
  const catalogue = [
    { id: "etat_mission_defense_credits_votes", theme: "budget_etat" },
    { id: "etat_mission_defense_credits_consommes", theme: "budget_etat" },
  ] as never as Indicateur[];
  const paires = jumeaux(catalogue);
  assert.equal(
    paires.get("etat_mission_defense_credits_consommes")?.id,
    "etat_mission_defense_credits_votes",
  );
});

/**
 * Un total national obtenu en additionnant dix-huit régions n'est pas de la
 * même nature qu'un chiffre que le producteur publie lui-même.
 */

const AGREGATS = {
  regions_attendues: 18,
  perimetre: "France entière, outre-mer compris",
  indicateurs: ["ssmsi_cambriolages_nombre", "ssmsi_homicides_nombre"],
  ecartes: [],
};

test("un total calculé par nous se dit tel, avec son périmètre", () => {
  const liste = [
    { id: "ssmsi_cambriolages_nombre", libelle: "a" },
    { id: "ssmsi_homicides_nombre", libelle: "b" },
  ] as never as Indicateur[];
  const html = mentionAgregat(liste, AGREGATS, "pays");
  assert.match(html, /Ces totaux sont\s+la somme des 18 régions/);
  assert.match(html, /calculée par ce site et non publiée/);
  // Le périmètre fait partie du chiffre : beaucoup de totaux nationaux publiés
  // ailleurs s'arrêtent à la métropole, et les deux ne se comparent pas.
  assert.match(html, /France entière, outre-mer compris/);
  // Et la raison pour laquelle les taux n'y sont pas.
  assert.match(html, /Un taux n'y figure pas/);
});

test("la mention compte les indicateurs concernés quand le thème est mixte", () => {
  const liste = [
    { id: "ssmsi_cambriolages_nombre", libelle: "a" },
    { id: "publie_par_la_source", libelle: "b" },
  ] as never as Indicateur[];
  assert.match(mentionAgregat(liste, AGREGATS, "pays"), /1 de ces totaux sont\s+la somme/);
});

test("un thème sans agrégat de notre main ne porte aucune mention", () => {
  const liste = [{ id: "etat_solde_budgetaire", libelle: "a" }] as never as Indicateur[];
  assert.equal(mentionAgregat(liste, AGREGATS, "pays"), "");
  // Et sans le fichier de méthode, rien n'est affirmé plutôt qu'une mention fausse.
  assert.equal(mentionAgregat(liste, null, "pays"), "");
  assert.equal(mentionAgregat(liste, undefined, "pays"), "");
});

test("la somme des régions ne se mentionne que sur la fiche France", () => {
  // Elle s'affichait sur le thème Logement d'une fiche communale : le chiffre
  // de la commune vient du producteur, notre addition ne le concerne pas.
  const liste = [
    { id: "ssmsi_cambriolages_nombre", libelle: "a" },
  ] as never as Indicateur[];
  for (const niveau of ["commune", "departement", "region"]) {
    assert.equal(mentionAgregat(liste, AGREGATS, niveau), "", niveau);
  }
  assert.match(mentionAgregat(liste, AGREGATS, "pays"), /la somme des 18 régions/);
});

/**
 * Un rang ne se conteste pas ; une somme, si.
 *
 * « La moitié des communes de la région sont en dessous de 291 € » se lisait
 * sous chaque ligne, deux fois, et n'apprenait rien qu'on puisse discuter.
 */

const EUROS = { id: "ofgl_depenses_fonctionnement", unite: "EUR" } as never as Indicateur;
const TAUX = { id: "insee_taux_pauvrete", unite: "percent" } as never as Indicateur;
const MEDIANE = { ensemble: "communes de la région", valeur: 1000 };

test("l'écart à la médiane se dit en euros, pas en rang", () => {
  // 1 373 € par habitant contre 1 000 € de médiane, sur 260 000 habitants :
  // 97 M€ de plus. C'est le même écart, dans la seule unité dont le lecteur
  // ait l'usage.
  const phrase = ecartEnEuros(1373, MEDIANE, EUROS, true, 260_000);
  assert.match(phrase ?? "", /de plus que si le montant était celui de la médiane/);
  assert.match(phrase ?? "", /97/);
});

test("un montant total ne se remultiplie pas par la population", () => {
  // La ligne affiche déjà des euros : remultiplier donnerait un chiffre
  // 260 000 fois trop grand.
  const phrase = ecartEnEuros(3_000_000, { ...MEDIANE, valeur: 1_000_000 }, EUROS, false, 260_000);
  assert.match(phrase ?? "", /2/);
  assert.doesNotMatch(phrase ?? "", /Md/);
});

test("sous un pour cent, l'écart est un arrondi et se dit comme tel", () => {
  // L'annoncer en millions donnerait du poids à du bruit.
  const phrase = ecartEnEuros(1005, MEDIANE, EUROS, true, 260_000);
  assert.equal(phrase, "Au niveau de la médiane des communes de la région.");
});

test("un taux n'a pas d'écart en euros : la médiane reste", () => {
  assert.equal(ecartEnEuros(11.4, MEDIANE, TAUX, false, 260_000), null);
  // Et un montant par habitant sans population connue non plus.
  assert.equal(ecartEnEuros(1373, MEDIANE, EUROS, true, null), null);
});

/**
 * Les extrêmes, amortis.
 *
 * Rochefourchat, deux habitants : la fiche écrivait « chômeurs 0, −100 % vs
 * son département », « +2 280 % vs la médiane », « Parmi 959 communes
 * semblables : +1 178 % ». Tous exacts, tous illisibles — ils mesurent la
 * petitesse du dénominateur, pas la position de la commune. Passé un ordre de
 * grandeur, on pose les deux chiffres au lieu d'un pourcentage ; de part et
 * d'autre de zéro, il n'y a pas de pourcentage du tout.
 */

test("au-delà d'un ordre de grandeur, l'écart se pose en deux chiffres", () => {
  // 12 000 pour 1 000 hab. face à 505 : facteur 24, soit « +2 276 % ».
  const phrase = lectureDeDensite({
    valeur: 12_000,
    comparaisons: [{ libelle: "son département", valeur: 505 }],
  });
  assert.doesNotMatch(phrase, /%/);
  assert.match(phrase, /12\s?000 pour 1\s?000 hab\. ici/);
  assert.match(phrase, /505 pour 1\s?000 hab\. pour son département/);
  // Un écart qui reste dans l'ordre de grandeur garde son pourcentage.
  assert.match(
    lectureDeDensite({ valeur: 2_000, comparaisons: [{ libelle: "son département", valeur: 505 }] }),
    /\+296 %/,
  );
});

test("un effectif nul ne baisse pas de cent pour cent, il est nul", () => {
  // « écoles 0, −100 % vs son département » : le signe suggère une baisse là
  // où il n'y a qu'une absence, et le zéro est déjà écrit à côté.
  const phrase = lectureDeDensite({
    valeur: 0,
    comparaisons: [{ libelle: "son département", valeur: 4.2 }],
  });
  assert.doesNotMatch(phrase, /−100/);
  assert.match(phrase, /0 pour 1\s?000 hab\. ici/);
  assert.match(phrase, /4,2 pour 1\s?000 hab\. pour son département/);
});

test("la position dans le groupe se tait plutôt que d'annoncer +1 178 %", () => {
  const html = positionDansGroupe(
    TERRITOIRE,
    { n: 959, q1: 40, mediane: 60, q3: 90 },
    768, // facteur 12,8 vs la médiane
    CRITERES,
    { base: "par_habitant", unite: "EUR" },
  );
  assert.doesNotMatch(html, /1\s?178/);
  assert.doesNotMatch(html, /vs la médiane/);
  // Les deux chiffres, et la situation dans la distribution : rien d'inventé.
  assert.match(html, /ici 768\s?€/);
  assert.match(html, /médiane 60\s?€/);
  assert.match(html, /dans le quart le plus haut/);
});

test("un écart hors d'échelle ne se convertit pas en contrefactuel d'euros", () => {
  // « 22,3 M€ de plus que si le montant était celui de la médiane » suppose
  // que la médiane soit une grandeur : à 0,13 € par habitant, elle ne l'est pas.
  assert.equal(ecartEnEuros(339, { ensemble: "communes de la région", valeur: 0.13 }, EUROS, true, 260_000), null);
  // Et de part et d'autre de zéro non plus.
  assert.equal(ecartEnEuros(-500, MEDIANE, EUROS, false, 260_000), null);
  assert.equal(ecartEnEuros(1373, { ...MEDIANE, valeur: 0 }, EUROS, true, 260_000), null);
});

/**
 * Ce qu'un mini-tableau montre, il le dit.
 *
 * Six colonnes sur dix-neuf points publiés, sans un mot, se lisaient comme la
 * série entière.
 */

test("le tableau nomme sa fenêtre et le nombre de points qu'il laisse derrière", () => {
  assert.equal(
    fenetreLisible(["2020", "2021", "2022", "2023"], 12),
    "4 derniers exercices sur 12 publiés",
  );
  assert.equal(
    fenetreLisible(["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06"], 19),
    "6 derniers mois sur 19 publiés",
  );
  assert.equal(fenetreLisible(["2024-Q1", "2024-Q2"], 8), "2 derniers trimestres sur 8 publiés");
  // Tout est montré : on ne promet pas un reste qui n'existe pas.
  assert.equal(fenetreLisible(["2023", "2024"], 2), "2 exercices publiés");
});

/**
 * Une donnée absente n'écrit rien, et cela vaut pour la navigation.
 *
 * L'onglet « Justice » s'affichait sur chaque fiche communale et ouvrait une
 * section blanche : la densité carcérale n'est mesurée qu'au département.
 */

const JUSTICE = {
  id: "justice_densite_carcerale", libelle: "Densité carcérale", unite: "percent",
  theme: "justice", sommable: false, niveaux: ["commune", "departement"],
  definition: "", jeu: "justice-prisons",
} as never as Indicateur;
const POPULATION_MUNICIPALE = {
  id: "insee_population_municipale", libelle: "Population municipale", unite: "count",
  theme: "population", sommable: true, niveaux: ["commune", "departement"],
  definition: "", jeu: "melodi-rp-population",
} as never as Indicateur;

const BORDEAUX = {
  nom: "Bordeaux", parent: "33", region: "75", population: 267_991, drapeaux: {},
  series: { insee_population_municipale: { "2022": 267_991 } },
} as never;
const GIRONDE = {
  nom: "Gironde", parent: "75", region: "75", population: 1_643_000, drapeaux: {},
  series: {
    insee_population_municipale: { "2022": 1_643_000 },
    justice_densite_carcerale: { "2024": 131.9 },
  },
} as never;

function ficheRendue(comparateurs: { libelle: string; territoire: never }[]): string {
  const cible = { innerHTML: "" } as unknown as HTMLElement;
  afficherFiche(cible, {
    niveau: "commune",
    territoire: BORDEAUX,
    indicateurs: [POPULATION_MUNICIPALE, JUSTICE],
    principal: "insee_population_municipale",
    jeux: [],
    periode: "2022",
    parHabitant: false,
    comparateurs,
    libelleTheme: (t) => (t === "justice" ? "Justice" : "Population"),
  });
  return cible.innerHTML;
}

test("un thème sans aucune mesure ici renvoie vers la maille qui la porte", () => {
  const html = ficheRendue([{ libelle: "son département", territoire: GIRONDE }]);
  // L'onglet reste : la donnée existe, une maille au-dessus.
  assert.match(html, /data-theme="justice"/);
  // Et il n'ouvre pas sur du blanc.
  assert.match(html, /Ce thème n'est pas mesuré ici, mais au département/);
  assert.match(
    html,
    /<button type="button" class="fiche__parent" data-code="33" data-niveau="departement">Gironde<\/button>/,
  );
  // Aucune ligne de mesure fantôme dans la section.
  assert.doesNotMatch(html, /data-mesure="justice_densite_carcerale"/);
});

test("un thème que personne ne mesure ne garde pas d'onglet", () => {
  // Sans maille porteuse connue, il n'y a rien à proposer : l'onglet disparaît
  // plutôt que d'être un cul-de-sac.
  const html = ficheRendue([]);
  assert.doesNotMatch(html, /data-theme="justice"/);
  assert.doesNotMatch(html, /theme-groupe__ailleurs/);
  // Le thème qui a des chiffres, lui, reste.
  assert.match(html, /data-theme="population"/);
});

test("« L'essentiel » est un titre, pas un span en petites capitales", () => {
  // Premier bloc de la fiche, et pourtant absent du plan du document : au
  // lecteur d'écran il n'existait pas. Le niveau suit celui des autres sections
  // de la fiche (le territoire est en h2), la classe porte toujours le style.
  const html = ficheRendue([{ libelle: "son département", territoire: GIRONDE }]);
  assert.match(html, /<h3 class="synthese__titre">L'essentiel<\/h3>/);
  assert.doesNotMatch(html, /<p class="synthese__titre">/);
});

test("le territoire parent de l'en-tête est un bouton, pas un mot gris", () => {
  const html = ficheRendue([{ libelle: "son département", territoire: GIRONDE }]);
  assert.match(
    html,
    /Commune · <button type="button" class="fiche__parent" data-code="33" data-niveau="departement">Gironde<\/button>/,
  );
});

/**
 * L'ouverture de la fiche non plus ne convertit pas l'infini en pourcentage.
 *
 * « Dépenses de fonctionnement 19 512 € par habitant. +2 280 % vs la médiane
 * régionale (819 €) » : le nombre est exact et ne dit que la petitesse de la
 * médiane. Les repères hors d'échelle sont retirés avant qu'on n'en tire un
 * rapport, et le repère se pose alors tel quel plutôt que de disparaître.
 */

const TAUX_LOCAL = {
  id: "dgfip_taux_tfb_global", libelle: "Taux global de taxe foncière", unite: "percent",
  theme: "impots_locaux", sommable: false, niveaux: ["commune", "departement"],
  definition: "", jeu: "dgfip-taux",
} as never as Indicateur;

function essentiel(valeurParent: number): string {
  const commune = {
    nom: "Rochefourchat", parent: "26", region: "84", population: 2, drapeaux: {},
    series: { dgfip_taux_tfb_global: { "2024": 40 } },
  } as never;
  const parent = {
    nom: "Drôme", parent: "84", region: "84", population: 520_000, drapeaux: {},
    series: { dgfip_taux_tfb_global: { "2024": valeurParent } },
  } as never;
  const cible = { innerHTML: "" } as unknown as HTMLElement;
  afficherFiche(cible, {
    niveau: "commune",
    territoire: commune,
    indicateurs: [TAUX_LOCAL],
    principal: "dgfip_taux_tfb_global",
    jeux: [],
    periode: "2024",
    parHabitant: false,
    comparateurs: [{ libelle: "son département", territoire: parent }],
    libelleTheme: () => "Impôts locaux",
  });
  return cible.innerHTML;
}

test("un repère quasi nul se pose à côté du chiffre, il ne devient pas un pourcentage", () => {
  // 40 % face à 0,5 % : facteur 80, soit « +7 900 % ».
  const html = essentiel(0.5);
  assert.doesNotMatch(html, /\+\d[\d\s ]*%/);
  assert.match(html, /Contre 0,5\s?% pour son département\./);
});

test("un repère à l'échelle garde son pourcentage", () => {
  assert.match(essentiel(20), /\+100\s?% vs son département/);
});

test("la population porte son infobulle sans se faire passer pour un lien", () => {
  const html = ficheRendue([{ libelle: "son département", territoire: GIRONDE }]);
  assert.match(html, /<abbr class="fiche__habitants" title="Population municipale/);
  assert.match(html, /267\s?991 hab\./);
});

test("la valeur affichée est le dernier exercice publié, jamais celui d'une autre couche", () => {
  // Le défaut tel qu'il s'est produit sur Bordeaux. La capacité de
  // désendettement sortait à 5,1 ans — le ratio de 2021 — au-dessus d'un
  // tableau donnant 8,6 ans en 2025. Le bloc entier était cohérent avec la
  // mauvaise année, et la dette de la ville paraissait nettement plus
  // soutenable qu'elle ne l'est. Aucune erreur nulle part : la période venait
  // de la carte, et la carte n'a pas le même calendrier que chaque indicateur.
  const territoire = {
    nom: "Bordeaux",
    population: 267_991,
    series: {
      derive_desendettement: {
        "2019": 4.36, "2020": 7.15, "2021": 5.09,
        "2022": 4.92, "2023": 4.49, "2024": 6.5, "2025": 8.58,
      },
    },
  } as never;
  const indicateur = {
    id: "derive_desendettement",
    libelle: "Capacité de désendettement",
    unite: "ans",
    theme: "finances_locales",
    sommable: false,
  } as never;
  const mesure = mesurer(indicateur, territoire, "2021", false, "commune", null, []);
  assert.notEqual(mesure, "absent");
  assert.equal((mesure as { periode: string }).periode, "2025");
  assert.equal((mesure as { brut: number }).brut, 8.58);
});
