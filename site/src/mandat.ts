/**
 * Sur quoi la fiche raconte : un mandat, pas « les dernières années ».
 *
 * Une fiche qui compare 2019 à 2025 ne dit pas la même chose selon la borne
 * qu'on choisit, et le lecteur ne vient pas chercher « six ans » : il vient
 * chercher **le bilan d'une équipe**. Les bornes sont donc politiques avant
 * d'être comptables — l'élection générale qui ouvre le mandat, l'élection qui
 * le clôt — et l'exercice de référence est le dernier exercice clos *avant*
 * l'arrivée de l'équipe : ce qu'elle a trouvé en s'installant.
 *
 * **Le mandat en cours ne se raconte pas.** Les élections générales du
 * 22 mars 2026 ont installé des équipes dont aucun exercice n'est publié : les
 * comptes des collectivités s'arrêtent à 2025. Une fiche qui titrerait sur le
 * mandat en cours n'aurait aucun chiffre à mettre dessous. Le bilan lisible est
 * celui du mandat qui vient de s'achever, ouvert en mars 2020 et clos en
 * mars 2026, avec 2019 pour référence et 2025 pour dernier exercice.
 *
 * **Le calendrier est figé dans le code.** Précédent maison : la nomenclature
 * des programmes budgétaires est « figée en fichier de graine plutôt que lue en
 * ligne à la publication : le dépôt doit pouvoir se rejouer sans réseau ». Trois
 * dates statutaires, publiques et passées valent mieux qu'un appel réseau qui
 * ferait bouger la fenêtre de toutes les fiches sans qu'aucun commit ne le
 * montre. Une élection s'ajoute ici, en une ligne, quand elle a eu lieu.
 */

/**
 * Les élections municipales générales, par date du **premier tour**.
 *
 * C'est le premier tour qui ouvre le scrutin et donne son millésime au mandat.
 * Le second tour de 2020, reporté au 28 juin pour cause d'épidémie, n'a pas
 * décalé le premier : les conseils élus dès le 15 mars ont été installés en
 * mai, et l'exercice 2019 reste l'exercice trouvé par les équipes sortantes de
 * ce scrutin. Retenir la date du second tour ferait basculer l'exercice de
 * référence d'une année dans les seules communes à deux tours, ce qui rendrait
 * deux fiches voisines incomparables.
 */
export const ELECTIONS_MUNICIPALES = ["2014-03-23", "2020-03-15", "2026-03-22"];

/**
 * Combien d'exercices publiés il faut pour qu'un mandat se raconte.
 *
 * Deux points font une droite et n'importe quelle histoire. Trois exercices
 * dans la fenêtre, plus l'exercice de référence, sont le minimum pour qu'une
 * variation ne soit pas l'accident d'une année : une commune qui touche une
 * subvention exceptionnelle une année sur deux ferait autrement un « bilan de
 * mandat » entier sur ce seul aléa.
 */
const EXERCICES_MINIMUM = 3;

export type Mandat = {
  /** Date de l'élection générale qui a ouvert le mandat, ISO court. */
  debut: string;
  /** Date de l'élection qui l'a clos, ou null si le mandat est en cours. */
  fin: string | null;
  /** Dernier exercice clos AVANT l'élection d'ouverture : la référence. */
  exerciceReference: string;
  /** Dernier exercice publié qui tombe dans le mandat. */
  exerciceFin: string;
  /** Nombre d'exercices couverts, référence exclue. */
  exercices: number;
  /** Vrai quand c'est le mandat en cours. */
  enCours: boolean;
};

/** L'année d'une date ISO courte, en nombre. */
function annee(date: string): number {
  return Number(date.slice(0, 4));
}

/**
 * L'exercice trouvé par l'équipe qui arrive.
 *
 * Les élections municipales générales se tiennent en mars : le 31 décembre
 * précédent a déjà clos son exercice, et c'est celui-là que l'équipe sortante
 * laisse. D'où l'année de l'élection moins un, sans autre subtilité tant que le
 * scrutin reste au premier trimestre.
 */
function reference(debut: string): string {
  return String(annee(debut) - 1);
}

/** Le mandat ouvert par `debut`, tel que les exercices publiés le montrent. */
function decrire(debut: string, suivante: string | undefined, publies: string[]): Mandat {
  // Une élection encore à venir ne clôt rien : le mandat est en cours.
  const fin = suivante ?? null;
  // L'exercice de l'année d'une élection appartient très majoritairement à
  // l'équipe suivante, installée en avril : la fenêtre s'arrête l'année d'avant.
  const dernier = fin ? annee(fin) - 1 : Infinity;
  const dans = publies.filter((e) => annee(e) >= annee(debut) && annee(e) <= dernier).sort();
  return {
    debut,
    fin,
    exerciceReference: reference(debut),
    // Aucun exercice publié dans la fenêtre : rien à nommer, et la chaîne vide
    // n'écrit rien là où « 2026 » affirmerait un exercice qui n'existe pas.
    exerciceFin: dans.length ? dans[dans.length - 1] : "",
    exercices: dans.length,
    enCours: fin === null,
  };
}

/** Le mandat sur lequel la fiche raconte, choisi parmi les élections connues.
 *  Rend `null` si aucun mandat n'a assez d'exercices publiés pour raconter
 *  quoi que ce soit. `exercicesDisponibles` sont les périodes réellement
 *  publiées pour ce territoire (triées ou non). */
export function mandatRaconte(exercicesDisponibles: string[], aujourdhui: string): Mandat | null {
  // Seuls les exercices annuels bornent un mandat : un trimestre n'est pas un
  // compte administratif, et « 2024-Q3 » ne se compare pas à « 2019 ».
  const publies = exercicesDisponibles.filter((e) => /^\d{4}$/.test(e));
  const tenues = ELECTIONS_MUNICIPALES.filter((d) => d <= aujourdhui);
  for (let i = tenues.length - 1; i >= 0; i -= 1) {
    // Le calendrier est trié : les élections tenues en forment le début, et
    // l'élection suivante porte le même indice, plus un.
    const suivante = ELECTIONS_MUNICIPALES[i + 1];
    const mandat = decrire(tenues[i], suivante && suivante <= aujourdhui ? suivante : undefined, publies);
    // Sans l'exercice de référence, il n'y a pas de point de départ : toute
    // variation se mesurerait depuis une année choisie par le hasard de la
    // publication. Règle maison : une donnée absente n'écrit rien.
    if (mandat.exercices >= EXERCICES_MINIMUM && publies.includes(mandat.exerciceReference)) {
      return mandat;
    }
  }
  return null;
}

/** Le mandat en cours, même sans données : sert à dire en une ligne que ses
 *  comptes ne sont pas encore publiés. */
export function mandatEnCours(aujourdhui: string): Mandat {
  const tenues = ELECTIONS_MUNICIPALES.filter((d) => d <= aujourdhui);
  // Avant la première élection du calendrier, il n'y a pas de mandat à décrire ;
  // la plus ancienne date connue tient lieu de repli plutôt qu'une exception.
  const debut = tenues[tenues.length - 1] ?? ELECTIONS_MUNICIPALES[0];
  // Cette fonction ne lit aucune série : elle ne peut donc nommer aucun
  // exercice publié, et n'en invente pas.
  return {
    debut,
    fin: null,
    exerciceReference: reference(debut),
    exerciceFin: "",
    exercices: 0,
    enCours: true,
  };
}
