/**
 * La boucle dette → intérêts, année après année.
 *
 * Un budget voté est une photo d'un an. « Ramener la dette à zéro » est une
 * trajectoire, et une trajectoire n'est pas un chiffre publié : c'est une
 * arithmétique posée sur des hypothèses. Ce module fait l'arithmétique et
 * **nomme les hypothèses**, une par une, pour que l'écran les montre à côté du
 * résultat plutôt que de les enterrer dans le calcul.
 *
 * LE MÉCANISME, en trois lignes qui se vérifient à la main :
 *
 *     intérêts(n)  = dette(n) × taux
 *     solde(n)     = solde primaire − intérêts(n)
 *     dette(n+1)   = dette(n) − solde(n)
 *
 * Le solde primaire est le solde **hors charge de la dette** : c'est la seule
 * part que le lecteur décide. Les intérêts, eux, ne se règlent pas — ils
 * suivent la dette. C'est tout l'objet du module : un budget à l'équilibre
 * primaire laisse encore la dette monter du montant des intérêts, et un
 * excédent primaire la fait baisser de plus en plus vite à mesure que les
 * intérêts s'allègent.
 *
 * LE TAUX est le **taux apparent** : la charge de la dette publiée rapportée à
 * l'encours publié. Ce n'est pas le taux auquel l'État emprunterait demain. Il
 * est réglable, parce que c'est l'hypothèse dont tout dépend et que personne ne
 * peut la trancher — pas parce qu'on l'ignore.
 *
 * CE QUI N'EST PAS MODÉLISÉ, et que rien ne doit laisser croire :
 *
 * - **Aucune croissance, aucune inflation.** Le solde primaire réglé est
 *   reconduit à l'identique. Une trajectoire en euros courants sans croissance
 *   est pessimiste ; l'écrire est plus honnête que de choisir un taux de
 *   croissance à la place du lecteur.
 * - **Aucun comportement.** Couper 10 Md de dépenses ne réduit pas l'activité,
 *   augmenter un impôt de 10 Md ne réduit pas son assiette. C'est déjà la règle
 *   du simulateur, elle vaut ici aussi.
 * - **L'encours est celui de l'État**, pas la dette publique toutes
 *   administrations : c'est le seul périmètre que le solde du budget général
 *   déplace.
 */

/** Le point de départ, entièrement composé de chiffres publiés. */
export type Depart = {
  /** Encours de dette de l'État, en euros. */
  encours: number;
  /** Millésime de l'encours, tel qu'il sera écrit à l'écran. */
  encoursExercice: string;
  /** Charge de la dette publiée, en euros — le numérateur du taux apparent. */
  charge: number;
  /** Millésime de la charge. */
  chargeExercice: string;
};

export type Hypotheses = {
  /** Taux d'intérêt appliqué à l'encours, en pourcentage. Le taux apparent
   *  publié par défaut ; réglable, parce que c'est l'hypothèse dont tout dépend. */
  taux: number;
  /** Nombre d'années projetées. */
  horizon: number;
};

export type Annee = {
  /** Rang, à partir de 1 : la première année projetée. */
  rang: number;
  interets: number;
  solde: number;
  /** Encours à la fin de l'année. */
  dette: number;
};

export type Trajectoire = {
  /** Le taux apparent publié, en pourcentage : `charge ÷ encours`. */
  tauxApparent: number;
  /** Le solde hors charge de la dette, tel que les réglages le laissent. */
  soldePrimaire: number;
  annees: Annee[];
  /**
   * Le rang de l'année où l'encours passe à zéro, ou `null` s'il n'y arrive pas
   * dans l'horizon. `null` n'est pas un échec du calcul : c'est la réponse.
   */
  extinction: number | null;
  /**
   * L'année où l'encours cesse d'augmenter, ou `null` s'il augmente tout du
   * long. Un solde primaire nul ne suffit pas : les intérêts creusent encore.
   */
  stabilisation: number | null;
};

/** Au-delà, la trajectoire tient plus de la prophétie que de l'arithmétique. */
export const HORIZON_MAXIMUM = 40;
export const HORIZON_PAR_DEFAUT = 20;

/** Le taux apparent : la charge publiée sur l'encours publié, en pourcentage. */
export function tauxApparent(depart: Depart): number {
  if (!depart.encours) return 0;
  return (depart.charge / depart.encours) * 100;
}

/**
 * La trajectoire.
 *
 * `soldePrimaire` est **hors charge de la dette** : l'appelant retire du solde
 * la ligne d'intérêts du budget, parce que le modèle la recalcule chaque année.
 * La laisser dedans la compterait deux fois.
 */
export function trajectoire(
  depart: Depart,
  soldePrimaire: number,
  hypotheses: Hypotheses,
): Trajectoire {
  const taux = hypotheses.taux / 100;
  const horizon = Math.max(1, Math.min(HORIZON_MAXIMUM, Math.round(hypotheses.horizon)));
  const annees: Annee[] = [];
  let dette = depart.encours;
  let extinction: number | null = null;
  let stabilisation: number | null = null;
  let precedente = dette;
  for (let rang = 1; rang <= horizon; rang += 1) {
    const interets = dette * taux;
    const solde = soldePrimaire - interets;
    dette = Math.max(0, dette - solde);
    annees.push({ rang, interets, solde, dette });
    if (extinction === null && dette === 0) extinction = rang;
    if (stabilisation === null && dette <= precedente) stabilisation = rang;
    precedente = dette;
    if (dette === 0) break;
  }
  return { tauxApparent: tauxApparent(depart), soldePrimaire, annees, extinction, stabilisation };
}

/**
 * Ce que la trajectoire dit en une phrase.
 *
 * Trois cas, et aucun n'en juge : la dette s'éteint dans l'horizon, elle se
 * stabilise sans s'éteindre, ou elle monte tout du long. Le pire cas est celui
 * qu'il faut le mieux écrire, parce que c'est celui du budget voté.
 */
export function lecture(t: Trajectoire, horizon: number): string {
  const derniere = t.annees[t.annees.length - 1];
  if (!derniere) return "";
  if (t.extinction !== null) {
    return t.extinction === 1
      ? "La dette de l'État s'éteint en un an."
      : `La dette de l'État s'éteint en ${t.extinction} ans.`;
  }
  if (t.stabilisation !== null) {
    return `La dette de l'État cesse d'augmenter la ${
      t.stabilisation === 1 ? "première" : `${t.stabilisation}e`
    } année, sans s'éteindre en ${horizon} ans.`;
  }
  return `La dette de l'État augmente pendant les ${horizon} années projetées.`;
}
