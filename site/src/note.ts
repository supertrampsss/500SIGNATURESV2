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
  /** L'échelon dont le barème a produit cette note. Une note se conteste sur
   *  son barème autant que sur ses mesures, et les barèmes diffèrent d'un
   *  échelon à l'autre : sans ce champ, deux notes de 12 pourraient venir de
   *  deux grilles sans que rien ne le dise. */
  niveau: string;
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
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI LES BORNES SONT PROPRES À CHAQUE ÉCHELON
 * ─────────────────────────────────────────────────────────────────────────
 * Un premier barème unique a été mesuré sur la publication 2026-08-11T0807.
 * Il donnait ceci, et c'était faux :
 *
 * | échelon      | taux d'épargne médian | trajectoire médiane |
 * |--------------|-----------------------|---------------------|
 * | commune      | 16,9 %                | −2,7 pts            |
 * | région       | 18,6 %                | −2,3 pts            |
 * | département  | **9,6 %**             | **−4,4 pts**        |
 *
 * **Un département n'a pas la marge d'une commune, et ce n'est pas une faute
 * de gestion.** Ses recettes de fonctionnement portent le RSA, l'APA et la
 * PCH — des prestations qui entrent et ressortent — quand celles d'une commune
 * ne portent rien de tel. Rapporter l'épargne à ces recettes-là donne
 * mécaniquement la moitié du taux d'une commune. Le barème commun retirait
 * donc ~2,3 points sur 8 à l'échelon entier, pour sa définition de périmètre.
 * C'est exactement la comparaison que la charte du dépôt refuse : « aucune
 * comparaison territoriale sans contrôle de définition, périmètre, période et
 * unité ».
 *
 * **Et la trajectoire médiane est négative aux trois échelons.** Entre 2019 et
 * 2025, l'inflation et la crise de l'énergie ont comprimé l'épargne de
 * presque toutes les collectivités. Une borne centrée sur zéro faisait donc
 * perdre des points à la moitié d'entre elles pour un choc macroéconomique
 * qu'aucune n'a décidé. Le terme est recentré sur le mouvement **médian de son
 * échelon** : il mesure ce qu'il a toujours prétendu mesurer — a-t-elle fait
 * mieux ou moins bien que les autres sur la même période — et plus le cycle.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * D'OÙ VIENT CHAQUE BORNE
 * ─────────────────────────────────────────────────────────────────────────
 * `DETTE` : les plafonds de référence de la **loi de programmation des
 * finances publiques 2018-2022** (art. 29), qui sont eux-mêmes propres à
 * chaque échelon — 12 ans pour le bloc communal, 10 pour les départements,
 * 9 pour les régions. Le terme est nul à une fois et demie le plafond, plein
 * en dessous de 2 ans. Ce sont des seuils publiés, pas des seuils d'ici.
 *
 * `MARGE` et `TRAJECTOIRE` : mesurées sur la publication 2026-08-11T0807 —
 * premier et neuvième déciles de l'échelon pour la marge, médiane de l'échelon
 * pour le point de bascule de la trajectoire. Elles sont **empiriques, et le
 * disent** : aucune doctrine ne publie de seuil d'épargne par échelon, et
 * inventer un seuil rond aurait caché ce fait sous un chiffre d'apparence
 * officielle.
 *
 * Ce sont des **constantes**, pas des quantiles recalculés à chaque
 * publication. Une note qui bougerait parce que les voisins ont bougé ne
 * dirait plus rien du territoire qu'elle décrit — c'est la règle que la
 * mention tient déjà, et elle vaut pour le barème.
 */
type Bornes = {
  MARGE: { bas: number; haut: number; points: number };
  DETTE: { pire: number; meilleur: number; points: number };
  TRAJECTOIRE: { bas: number; haut: number; points: number };
};

export const BORNES_PAR_NIVEAU: Record<string, Bornes> = {
  // Communes : déciles 4,1 % et 33,0 % ; médiane de trajectoire −2,7 pts.
  commune: {
    MARGE: { bas: 4, haut: 33, points: 8 },
    DETTE: { pire: 18, meilleur: 2, points: 8 },
    TRAJECTOIRE: { bas: -12.7, haut: 7.3, points: 4 },
  },
  // Un arrondissement municipal n'a pas de compte administratif propre ; s'il
  // en portait un, il serait du bloc communal.
  arrondissement_municipal: {
    MARGE: { bas: 4, haut: 33, points: 8 },
    DETTE: { pire: 18, meilleur: 2, points: 8 },
    TRAJECTOIRE: { bas: -12.7, haut: 7.3, points: 4 },
  },
  // Départements : déciles 4,5 % et 15,0 % ; médiane de trajectoire −4,4 pts.
  departement: {
    MARGE: { bas: 4, haut: 15, points: 8 },
    DETTE: { pire: 15, meilleur: 2, points: 8 },
    TRAJECTOIRE: { bas: -14.4, haut: 5.6, points: 4 },
  },
  // Régions : déciles 8,6 % et 24,8 % ; médiane de trajectoire −2,3 pts.
  region: {
    MARGE: { bas: 9, haut: 25, points: 8 },
    DETTE: { pire: 13.5, meilleur: 2, points: 8 },
    TRAJECTOIRE: { bas: -12.3, haut: 7.7, points: 4 },
  },
};

/** Le barème d'un échelon. Un échelon inconnu n'est pas noté : c'est ce que
 *  `note()` en fait, et non un repli sur le barème d'un autre. */
export function bornes(niveau: string): Bornes | null {
  return BORNES_PAR_NIVEAU[niveau] ?? null;
}

export function noter(mesures: Mesures, niveau: string): Note {
  const BORNES = bornes(niveau);
  if (!BORNES) throw new Error(`aucun barème pour l'échelon ${niveau}`);
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
    niveau,
  };
}

/**
 * La note d'un territoire, ou `null`.
 *
 * `null` dans deux cas, et les deux sont des faits sur ce qui est publié : le
 * territoire ne porte pas les trois séries de l'OFGL, ou son échelon n'a pas
 * de barème. La France est le second cas — elle n'a pas de compte
 * administratif, et lui appliquer le barème d'une commune n'aurait aucun sens.
 */
export function note(series: Series, niveau: string): Note | null {
  if (!bornes(niveau)) return null;
  const mesures = mesurer(series);
  return mesures ? noter(mesures, niveau) : null;
}

/**
 * La solvabilité d'un exercice donné : les deux termes structurels, sur 16.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI SUR 16, ET PAS SUR 20
 * ─────────────────────────────────────────────────────────────────────────
 * Le troisième terme de la note est **par construction** un écart depuis 2019.
 * Le porter sur l'exercice 2019 lui-même demanderait une borne six ans plus
 * tôt : les communes n'ont que sept exercices publiés, 2019 à 2025 — pas de
 * 2013, pas même de 2018 (les départements et les régions s'arrêtent à 2018).
 * Mesuré sur le catalogue, pas supposé.
 *
 * Deux issues étaient possibles et une seule est honnête. Donner au terme sa
 * demi-valeur par défaut, comme pour une borne absente, poserait 2 points sur 4
 * à chaque exercice ancien : le lecteur lirait une mesure là où il n'y a qu'un
 * remplissage, et 2019 sortirait mécaniquement au milieu. L'autre est de dire
 * que ce terme n'existe pas avant le dernier exercice, et de comparer les
 * années sur **ce qui est mesurable à toutes** : la marge et la dette.
 *
 * D'où un second total, nommé et borné à 16, qui ne se confond pas avec la
 * note. Et il n'y a rien à regretter : la trajectoire EST déjà la comparaison
 * 2019 → aujourd'hui, écrite en points de marge sur la ligne du dessus.
 */
export const SOLVABILITE_POINTS =
  BORNES_PAR_NIVEAU.commune.MARGE.points + BORNES_PAR_NIVEAU.commune.DETTE.points;

export type Solvabilite = {
  exercice: string;
  tauxEpargne: number;
  desendettement: number | null;
  marge: number;
  dette: number;
  /** Sur `SOLVABILITE_POINTS`, un chiffre après la virgule. */
  valeur: number;
};

export function solvabilite(
  series: Series,
  exercice: string,
  niveau: string,
): Solvabilite | null {
  const BORNES = bornes(niveau);
  if (!BORNES) return null;
  const recettes = series[RECETTES]?.[exercice];
  const epargne = series[EPARGNE]?.[exercice];
  const dette = series[DETTE]?.[exercice];
  if (!recettes || epargne === undefined || dette === undefined) return null;

  const tauxEpargne = (epargne / recettes) * 100;
  const desendettement = epargne > 0 ? dette / epargne : null;
  const arrondi = (n: number) => Math.round(n * 10) / 10;
  const pointsMarge = arrondi(
    entre(tauxEpargne, BORNES.MARGE.bas, BORNES.MARGE.haut) * BORNES.MARGE.points,
  );
  const pointsDette = arrondi(
    desendettement === null
      ? 0
      : entre(
          BORNES.DETTE.pire - desendettement,
          0,
          BORNES.DETTE.pire - BORNES.DETTE.meilleur,
        ) * BORNES.DETTE.points,
  );
  return {
    exercice,
    tauxEpargne,
    desendettement,
    marge: pointsMarge,
    dette: pointsDette,
    // Somme des termes ARRONDIS, comme la note : un lecteur qui additionne la
    // colonne doit retrouver le total affiché.
    valeur: arrondi(pointsMarge + pointsDette),
  };
}

/** Les exercices où les trois séries existent ensemble, du plus ancien au plus
 *  récent. Un exercice qui n'en porte que deux ne donne pas de solvabilité. */
export function exercicesNotables(series: Series): string[] {
  return Object.keys(series[RECETTES] ?? {})
    .filter((a) => series[EPARGNE]?.[a] !== undefined && series[DETTE]?.[a] !== undefined)
    .sort();
}

/**
 * La note d'un territoire à partir des couches de la carte, et non de sa fiche.
 *
 * Le classement lit des couches — un fichier par indicateur, par maille et par
 * exercice, `{code: valeur}` — quand la fiche lit des séries. Cette fonction
 * recompose la forme que `note()` attend **pour réutiliser le même barème** :
 * une seconde implémentation de la grille aurait fini par diverger de la
 * première, et deux notes différentes pour le même territoire sur deux écrans
 * du même site est le défaut qu'aucun lecteur ne pardonne.
 *
 * Les deux valeurs d'ouverture sont facultatives : sans elles, le terme de
 * trajectoire vaut la moitié de ses points, comme sur la fiche.
 */
export function noteDepuisCouches(
  valeurs: {
    recettes?: number;
    epargne?: number;
    dette?: number;
    recettesAvant?: number;
    epargneAvant?: number;
  },
  exercice: string,
  niveau: string,
): Note | null {
  const { recettes, epargne, dette, recettesAvant, epargneAvant } = valeurs;
  if (recettes === undefined || epargne === undefined || dette === undefined) return null;
  // Si l'exercice noté EST la borne d'ouverture, il n'y a pas de trajectoire à
  // mesurer — et les deux valeurs s'écraseraient sous la même clé, ce qui
  // aurait donné une trajectoire nulle au lieu d'une trajectoire absente.
  const serie = (courant: number, avant?: number) =>
    avant === undefined || exercice === OUVERTURE
      ? { [exercice]: courant }
      : { [OUVERTURE]: avant, [exercice]: courant };
  return note(
    {
      [RECETTES]: serie(recettes, recettesAvant),
      [EPARGNE]: serie(epargne, epargneAvant),
      // La dette d'ouverture n'entre dans aucun terme : seule la trajectoire
      // regarde 2019, et elle ne regarde que la marge.
      [DETTE]: { [exercice]: dette },
    },
    niveau,
  );
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
