/**
 * La note de gestion d'une collectivité, sur 20.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QU'ON NOTE, ET CE QU'ON NE NOTE JAMAIS
 * ─────────────────────────────────────────────────────────────────────────
 * On note la **solvabilité**, et elle seule : la marge que la collectivité
 * dégage sur son fonctionnement, le temps qu'il lui faudrait pour rembourser
 * sa dette, et le sens dans lequel les deux vont depuis 2019.
 *
 * On ne note **jamais** le niveau de dépense, ni sa répartition, ni les taux
 * d'impôts. Dépenser beaucoup en action sociale n'est pas une faute de
 * gestion : c'est un choix d'électeurs, et le noter reviendrait à noter un
 * programme politique. C'est précisément la ligne que l'Argus des communes ne
 * tient pas — il note « les coûts fixes » et « la pression fiscale » —, et
 * c'est ce qui rend sa note contestable là où la nôtre ne l'est pas.
 *
 * On ne note pas non plus la sécurité, l'école ou la santé sur un territoire :
 * un maire ne commande ni la police nationale ni l'hôpital.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI TROIS TERMES, ET POURQUOI CONTINUS
 * ─────────────────────────────────────────────────────────────────────────
 * Une première version notait par paliers — 10 points si le taux d'épargne
 * dépasse 15 %, 7 s'il dépasse 10 %. Mesurée sur les 464 communes de Gironde
 * qui portent les trois séries, elle donnait **159 communes à 20/20**. Un tiers
 * du département avec la note maximale : le classement ne classait rien.
 *
 * Les seuils restent — ils viennent de la doctrine des finances locales, pas
 * d'ici — mais la note s'interpole entre eux. La distribution s'étale alors, et
 * deux communes à 15 % et 24 % d'épargne cessent d'avoir la même note.
 *
 * Le troisième terme, la trajectoire, est ce qui distingue un héritage d'un
 * bilan. Le Bouscat gagne 10,2 points d'épargne depuis 2019, Lège-Cap-Ferret
 * en perd 11,6 : à niveau comparable, ce ne sont pas deux mêmes gestions.
 */

import { OUVERTURE } from "./reperes.ts";

/** Les trois séries de l'OFGL dont la note dépend, et rien d'autre. */
export const RECETTES = "ofgl_recettes_fonctionnement";
export const EPARGNE = "ofgl_epargne_brute";
export const DETTE = "ofgl_encours_dette";

export type Mesures = {
  /** Marge dégagée sur le fonctionnement, en pourcentage des recettes. */
  tauxEpargne: number;
  /** Années d'épargne brute qu'il faudrait pour rembourser toute la dette.
   *  `null` quand l'épargne est nulle ou négative : le ratio n'existe pas
   *  alors, et écrire « l'infini » ferait passer pour une durée ce qui est une
   *  impossibilité. */
  desendettement: number | null;
  /** L'écart de taux d'épargne depuis la borne d'ouverture, en points.
   *  `null` quand la borne n'est pas publiée pour ce territoire. */
  trajectoire: number | null;
  exercice: string;
};

export type Note = {
  /** Sur 20, un chiffre après la virgule. */
  valeur: number;
  mesures: Mesures;
  /** Ce que chaque terme apporte, pour que la note se lise et se conteste. */
  detail: { marge: number; dette: number; trajectoire: number };
};

type Series = Record<string, Record<string, number>>;

/** Le dernier exercice où les trois séries sont publiées ensemble. Une note
 *  composée de trois millésimes différents ne veut rien dire. */
function exerciceComplet(series: Series): string | null {
  const communs = Object.keys(series[RECETTES] ?? {})
    .filter((a) => series[EPARGNE]?.[a] !== undefined && series[DETTE]?.[a] !== undefined)
    .sort();
  return communs[communs.length - 1] ?? null;
}

export function mesurer(series: Series): Mesures | null {
  const exercice = exerciceComplet(series);
  if (!exercice) return null;
  const recettes = series[RECETTES][exercice];
  const epargne = series[EPARGNE][exercice];
  const dette = series[DETTE][exercice];
  if (!recettes) return null;

  const tauxEpargne = (epargne / recettes) * 100;
  const recettesAvant = series[RECETTES]?.[OUVERTURE];
  const epargneAvant = series[EPARGNE]?.[OUVERTURE];
  const trajectoire =
    recettesAvant && epargneAvant !== undefined
      ? tauxEpargne - (epargneAvant / recettesAvant) * 100
      : null;

  return {
    tauxEpargne,
    desendettement: epargne > 0 ? dette / epargne : null,
    trajectoire,
    exercice,
  };
}

/** Interpolation bornée : 0 sous `bas`, 1 au-dessus de `haut`, linéaire entre. */
function entre(valeur: number, bas: number, haut: number): number {
  return Math.max(0, Math.min(1, (valeur - bas) / (haut - bas)));
}

/**
 * Les bornes, et d'où elles viennent.
 *
 * `MARGE` : un taux d'épargne brute de 10 % est le plancher d'alerte usuel des
 * analyses financières locales, 15 % le niveau confortable. On étale de 0 à
 * 25 % pour que les communes très au-dessus se distinguent encore.
 *
 * `DETTE` : le plafond national de référence de la loi de programmation des
 * finances publiques 2018-2022 est de **12 ans** pour le bloc communal, et
 * 8 ans est le seuil de vigilance courant. Au-delà de 15 ans, la note du terme
 * est nulle ; en dessous de 2 ans, elle est pleine.
 *
 * `TRAJECTOIRE` : ±8 points d'épargne sur six exercices est l'amplitude
 * réellement observée sur les grosses communes, bornes comprises.
 */
export const BORNES = {
  MARGE: { bas: 0, haut: 25, points: 8 },
  DETTE: { pire: 15, meilleur: 2, points: 8 },
  TRAJECTOIRE: { bas: -8, haut: 8, points: 4 },
} as const;

export function noter(mesures: Mesures): Note {
  const marge = entre(mesures.tauxEpargne, BORNES.MARGE.bas, BORNES.MARGE.haut) * BORNES.MARGE.points;
  // Une épargne nulle ou négative ne rembourse rien : le terme vaut zéro, et
  // ce n'est pas un trou de donnée mais le pire cas possible.
  const dette =
    mesures.desendettement === null
      ? 0
      : entre(
          BORNES.DETTE.pire - mesures.desendettement,
          0,
          BORNES.DETTE.pire - BORNES.DETTE.meilleur,
        ) * BORNES.DETTE.points;
  // Sans borne d'ouverture publiée, le terme vaut la moitié de ses points :
  // ni récompense ni punition pour une donnée que le territoire ne choisit pas.
  const trajectoire =
    mesures.trajectoire === null
      ? BORNES.TRAJECTOIRE.points / 2
      : entre(mesures.trajectoire, BORNES.TRAJECTOIRE.bas, BORNES.TRAJECTOIRE.haut) *
        BORNES.TRAJECTOIRE.points;

  // **Le total est la somme des termes ARRONDIS, pas l'arrondi de la somme.**
  // Arrondir séparément donnait « 6,4 + 7,4 + 3,3 = 17,0 » : un lecteur qui
  // additionne le détail trouvait 17,1 et concluait que la note est bricolée.
  // Une note publiée sur 34 875 communes doit se recalculer de tête sans
  // tomber sur un autre chiffre que celui affiché.
  const arrondi = (n: number) => Math.round(n * 10) / 10;
  const detail = { marge: arrondi(marge), dette: arrondi(dette), trajectoire: arrondi(trajectoire) };
  return {
    valeur: arrondi(detail.marge + detail.dette + detail.trajectoire),
    mesures,
    detail,
  };
}

/** La note d'un territoire, ou `null` s'il ne porte pas les trois séries. */
export function note(series: Series): Note | null {
  const mesures = mesurer(series);
  return mesures ? noter(mesures) : null;
}

/**
 * La mention, parce qu'un nombre sur 20 ne se lit pas seul.
 *
 * Cinq crans, bornes rondes. Ils ne sont pas calibrés sur la distribution :
 * une mention qui bougerait d'une publication à l'autre parce que les voisins
 * ont bougé ne dirait plus rien du territoire qu'elle décrit.
 */
export function mention(valeur: number): string {
  if (valeur >= 16) return "solide";
  if (valeur >= 13) return "confortable";
  if (valeur >= 10) return "tendue";
  if (valeur >= 6) return "fragile";
  return "critique";
}
