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
  comparableAuxAutresTerritoires,
  densiteRapportableAuxHabitants,
  groupeDeLaCommune,
  jumeaux,
  lectureDeDensite,
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

test("un effectif sans repère direct se lit par sa densité", () => {
  const phrase = lectureDeDensite({
    valeur: 641,
    comparaisons: [{ libelle: "son département", valeur: 505 }],
  });
  assert.match(phrase, /641 pour 1 000 hab/);
  assert.match(phrase, /contre 505 pour 1 000 hab\. pour son département/);
});

test("sans densité comparable, rien n'est écrit plutôt qu'un chiffre seul", () => {
  assert.equal(lectureDeDensite(null), "");
  assert.equal(lectureDeDensite({ valeur: 641, comparaisons: [] }), "");
  assert.equal(
    lectureDeDensite({ valeur: 641, comparaisons: [{ libelle: "x", valeur: NaN }] }),
    "",
  );
});

test("les quartiles d'une dépense s'affichent par habitant", () => {
  const html = positionDansGroupe(
    TERRITOIRE,
    { n: 536, q1: 600, mediane: 800, q3: 1000 },
    1344,
    CRITERES,
    { base: "par_habitant", unite: "EUR" },
  );
  assert.match(html, /536/);
  assert.match(html, /au-dessus du quart supérieur/);
  // Le formateur français insère une espace insécable avant le symbole.
  assert.match(html, /600\s?€/);
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
  assert.match(html, /36 pour 1 000 hab/);
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

test("les critères du groupe sont affichés avec le résultat", () => {
  const html = positionDansGroupe(
    TERRITOIRE,
    { n: 536, q1: 600, mediane: 800, q3: 1000 },
    1344,
    CRITERES,
    { base: "par_habitant", unite: "EUR" },
  );
  // « Communes comparables » ne veut rien dire sans dire sur quoi.
  assert.match(html, /strate de population : 7/);
  assert.match(html, /caractère rural : Non/);
  // Et la réserve qui compte, celle qu'on ne peut pas déduire des chiffres.
  assert.match(html, /ne signifie pas une meilleure gestion/);
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

test("les critères affichés sont ceux qui ont servi, pas une liste figée", () => {
  const commune = {
    nom: "Station",
    series: {},
    drapeaux: { tranche_population: "3", rural: "Oui", outre_mer: "Non", montagne: "Oui",
                touristique: "Oui" },
  } as never;
  const html = positionDansGroupe(commune, QUARTILES, 2, CASCADE[0]);
  assert.match(html, /commune de montagne/);
  assert.match(html, /commune touristique/);
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
  const html = ongletsThemes(["finances_locales", "energie"], "finances_locales");
  assert.match(html, /data-theme="energie"/);
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
