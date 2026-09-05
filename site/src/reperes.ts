/**
 * Les quatre repères qui ouvrent une fiche.
 *
 * La fiche listait cent quinze indicateurs et n'en désignait aucun. Ces
 * quatre-là sont choisis, et ils le sont par un rôle, pas par un thème : ce
 * qui entre, ce qui sort, ce qui reste, ce qui est dû. C'est l'ordre dans
 * lequel l'argent circule, et il ne change pas d'une maille à l'autre.
 *
 * Deux règles gouvernent ce module.
 *
 * **Le rôle se dit avant le terme comptable.** « Épargne brute » ne veut rien
 * dire pour qui n'a pas fait de comptabilité publique ; « Ce qui reste » le
 * dit, et le terme suit sous le nombre pour qui le cherche. Les libellés
 * tiennent en trois mots pour ne pas passer sur deux lignes.
 *
 * **Quatre, et pas cinq.** Au niveau local, le lecteur peut vérifier
 * l'arithmétique à l'écran : 417,14 moins 369,01 égale 48,13. Ce n'est pas une
 * coïncidence, c'est la définition de l'épargne brute, donc c'est vrai partout
 * où l'OFGL publie. Un cinquième repère casserait cette chaîne. L'investissement
 * en est absent pour cette raison, et parce qu'une année d'investissement est
 * trop irrégulière pour tenir lieu d'état.
 *
 * Au niveau national la soustraction ne tombe pas juste — les prélèvements sur
 * recettes et les comptes spéciaux passent entre les deux — et c'est le pont
 * budgétaire qui l'explique, pas ces quatre cases. Le quatrième rôle y devient
 * « ce qui manque » : un solde, pas une épargne.
 */

import { moins, montantLisible, pourcentage } from "./echelle.ts";

export type Role = {
  /** Ce que le nombre est, en trois mots. */
  role: string;
  id: string;
  /** Le terme comptable, sous le nombre, pour qui cherche ce mot précis. */
  terme: string;
};

/** Les quatre rôles, maille par maille.
 *
 *  Les trois échelons locaux lisent les mêmes agrégats OFGL. L'État a les
 *  siens, et le féminin devient masculin : c'est « ce qu'il doit », pas « ce
 *  qu'elle doit ». */
export const ROLES: Record<string, readonly Role[]> = {
  commune: [
    { role: "Ce qu'elle encaisse", id: "ofgl_recettes_fonctionnement", terme: "recettes" },
    { role: "Ce qu'elle dépense", id: "ofgl_depenses_fonctionnement", terme: "dépenses" },
    { role: "Ce qui reste", id: "ofgl_epargne_brute", terme: "épargne" },
    { role: "Ce qu'elle doit", id: "ofgl_encours_dette", terme: "dette" },
  ],
  departement: [
    { role: "Ce qu'il encaisse", id: "ofgl_recettes_fonctionnement", terme: "recettes" },
    { role: "Ce qu'il dépense", id: "ofgl_depenses_fonctionnement", terme: "dépenses" },
    { role: "Ce qui reste", id: "ofgl_epargne_brute", terme: "épargne" },
    { role: "Ce qu'il doit", id: "ofgl_encours_dette", terme: "dette" },
  ],
  region: [
    { role: "Ce qu'elle encaisse", id: "ofgl_recettes_fonctionnement", terme: "recettes" },
    { role: "Ce qu'elle dépense", id: "ofgl_depenses_fonctionnement", terme: "dépenses" },
    { role: "Ce qui reste", id: "ofgl_epargne_brute", terme: "épargne" },
    { role: "Ce qu'elle doit", id: "ofgl_encours_dette", terme: "dette" },
  ],
  pays: [
    { role: "Ce qu'il encaisse", id: "etat_recettes_nettes_bg", terme: "recettes nettes" },
    { role: "Ce qu'il dépense", id: "etat_depenses_nettes_bg", terme: "dépenses nettes" },
    { role: "Ce qui manque", id: "etat_solde_budgetaire", terme: "solde" },
    { role: "Ce qu'il doit", id: "insee_dette_apu_montant", terme: "dette publique" },
  ],
};

export type Repere = {
  role: string;
  /** L'indicateur qui porte ce repère. Sans lui, un repère est un nombre et
   *  trois mots : ni son unité, ni sa source ne se retrouvent, et la fiche ne
   *  peut ni le citer ni le peindre sur une carte qui circule seule. Le rôle
   *  et le terme sont écrits pour l'œil, celui-ci pour le catalogue. */
  id: string;
  terme: string;
  /** Le montant de l'exercice le plus récent, tel qu'il sera formaté. */
  valeur: number;
  /** L'exercice qui porte ce montant. */
  exercice: string;
  /** La variation depuis la borne d'ouverture, ou `null` si elle ne se calcule
   *  pas : série trop courte, ou passage par zéro. */
  variation: number | null;
};

type Series = Record<string, Record<string, number>>;

/** La borne d'ouverture de la fenêtre de comparaison. Elle se lit sur les
 *  exercices publiés, jamais sur un calendrier électoral. */
export const OUVERTURE = "2019";

/**
 * Les quatre repères d'un territoire, dans l'ordre des rôles.
 *
 * Un rôle dont la série n'est pas publiée pour cette maille disparaît plutôt
 * que d'afficher un trou : trois repères valent mieux qu'un quatrième vide.
 */
export function reperes(series: Series, niveau: string): Repere[] {
  const roles = ROLES[niveau];
  if (!roles) return [];
  const sortie: Repere[] = [];
  for (const { role, id, terme } of roles) {
    const serie = series[id];
    if (!serie) continue;
    const exercices = Object.keys(serie).sort();
    const dernier = exercices[exercices.length - 1];
    if (dernier === undefined) continue;
    sortie.push({
      role,
      id,
      terme,
      valeur: serie[dernier],
      exercice: dernier,
      variation: variationDepuis(serie, dernier),
    });
  }
  return sortie;
}

/**
 * La variation entre la borne d'ouverture et le dernier exercice.
 *
 * Elle se tait dans deux cas, et les deux comptent. Sans borne d'ouverture
 * publiée, il n'y a rien à comparer. Et **si les deux bornes n'ont pas le même
 * signe**, aucun pourcentage ne dit ce qui s'est passé : un solde qui passe de
 * l'excédent au déficit n'a pas « baissé de 24 686 % », il a changé de camp.
 * C'est le cas de tous les soldes, c'est-à-dire du quatrième repère national.
 */
export function variationDepuis(
  serie: Record<string, number>,
  arrivee: string,
): number | null {
  const depart = serie[OUVERTURE];
  const fin = serie[arrivee];
  if (depart === undefined || fin === undefined || depart === 0) return null;
  if (Math.sign(depart) !== Math.sign(fin)) return null;
  return ((fin - depart) / Math.abs(depart)) * 100;
}

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/**
 * Le bloc des repères.
 *
 * Des cartes, pas une bande de filets : quatre nombres posés côte à côte sans
 * cadre se lisent comme une seule ligne de chiffres, et le rôle de chacun se
 * perd. Le montant sort du formateur commun, en millions d'euros, sans jamais
 * de par-habitant — un repère d'ouverture ne se divise pas par la population.
 */
export function rendreReperes(liste: Repere[]): string {
  if (!liste.length) return "";
  const cases = liste
    .map(({ role, terme, valeur, variation, exercice }) => {
      // `montantLisible` rend « 417,14 millions d'euros » ou « 380,39 milliards
      // d'euros » selon la taille du montant. Le nombre porte le corps de
      // titre, l'unité rejoint la ligne du terme : « 380,39 » puis
      // « milliards d'euros de recettes nettes · +28,8 % ».
      //
      // Elle s'écrit en toutes lettres, et c'est le point : « 3 536 100 M€ »
      // demandait de savoir que le sigle vaut un million pour comprendre qu'on
      // lit trois mille cinq cents milliards de dette. Personne hors du métier
      // ne fait cette conversion de tête, et le site existe pour les autres.
      const [nombre, unite] = separer(montantLisible(valeur));
      const evolution = variation === null ? "" : ` · ${signe(variation)}`;
      // « de épargne » : l'élision se fait devant une voyelle, et « épargne »
      // est le seul terme concerné aujourd'hui. La règle vaut mieux que le cas.
      return `<div class="repere">
        <span class="repere__role">${echapper(role)}</span><span class="repere__date">${echapper(exercice)}</span>
        <span class="repere__valeur">${echapper(nombre)}</span>
        <span class="repere__terme">${echapper(`${unite} ${de(terme)}${terme}${evolution}`)}</span>
      </div>`;
    })
    .join("");
  return `<div class="reperes">${cases}</div>`;
}

/**
 * « 417,1 M€ » se coupe en nombre et unité : le nombre est le titre, l'unité la
 * légende.
 *
 * La coupure se fait sur **n'importe quelle espace**, pas sur l'espace
 * ordinaire : `millions` sépare le nombre de son sigle par une espace fine
 * insécable, et un `lastIndexOf(" ")` ne la trouvait pas. Le nombre gardait
 * alors son sigle et la légende commençait par « de recettes ».
 *
 * Le nombre de décimales n'est pas décidé ici : c'est `montantLisible` qui
 * l'arrête, et il en met deux. Cette règle est celle du site, elle vaut pour
 * toute la fiche, et un repère n'a aucune raison d'y déroger.
 *
 * **La coupe se fait sur l'insécable, pas sur la dernière espace.** L'unité
 * s'écrit désormais en toutes lettres — « milliards d'euros » — et chercher la
 * dernière espace rendait « 380,39 milliards » d'un côté et « d'euros » de
 * l'autre. `montantLisible` pose une insécable entre le nombre et son unité,
 * et c'est elle, et elle seule, qui marque la coupe : les espaces de milliers
 * sont des fines insécables, d'un autre caractère.
 */
function separer(formate: string): [string, string] {
  const coupe = formate.indexOf("\u00a0");
  if (coupe === -1) return [formate, ""];
  return [formate.slice(0, coupe), formate.slice(coupe + 1)];
}

/** L'élision devant une voyelle ou un h muet : « d'épargne », pas « de
 *  épargne ». Les termes viennent de la table des rôles, donc du français, pas
 *  d'un identifiant technique. */
function de(terme: string): string {
  return /^[aeiouyéèêàâîôûh]/i.test(terme) ? "d'" : "de ";
}

/** Le signe est écrit même pour une hausse : « 18,5 % » ne dit pas dans quel
 *  sens, « +18,5 % » si. Le moins est le signe typographique, comme partout.
 *
 *  Et la décimale est imposée. Les quatre repères se lisent ensemble — « +9,1 »
 *  de recettes contre « +10 » de dépenses — et la même variation reparaît plus
 *  bas dans la colonne « 2019 → 2025 », qui écrit « +10,0 ». Un seul chiffre
 *  affiché de deux façons sur une même page, sur la fiche de la
 *  Nouvelle-Aquitaine ; `Intl` laisse tomber la décimale des comptes ronds. */
function signe(variation: number): string {
  return `${variation >= 0 ? "+" : ""}${moins(pourcentage(variation, true))}`;
}
