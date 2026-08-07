/**
 * Ce que les chiffres veulent dire, en une phrase.
 *
 * Un panneau de vingt mesures reste muet si personne ne dit ce qui s'y joue :
 * le lecteur voit « 866 € » et ne sait pas si c'est beaucoup. Deux écritures
 * répondent ici, et une seule règle les gouverne — **ne rien affirmer que les
 * chiffres ne portent** :
 *
 * - la **lecture** d'une mesure : sa position par rapport à un repère publié,
 *   et le sens de sa tendance. Jamais un jugement (« bien géré », « trop
 *   dépensier ») : une dépense élevée peut venir d'une compétence exercée ici
 *   et pas ailleurs, ce que le site répète par ailleurs ;
 * - la **synthèse** d'un territoire : les trois ou quatre faits qui situent,
 *   pris parmi ce qui est réellement publié pour lui, sans jamais combler un
 *   trou par une moyenne nationale.
 *
 * Les écarts sous 5 % ne sont pas commentés : à ce niveau, la différence
 * tient au périmètre comptable autant qu'à la réalité.
 */

export type Comparaison = { libelle: string; valeur: number };

const SEUIL_PROCHE = 5; // en %, en deçà duquel on dit « proche de »

/** Un écart de 340 % ne se lit pas au point près : au-delà de 100 %, la
 *  précision affichée serait une fausse précision. */
function arrondiEcart(ecart: number): number {
  const absolu = Math.abs(ecart);
  return absolu >= 100 ? Math.round(absolu / 10) * 10 : Math.round(absolu);
}

/** Deux grandeurs de signes opposés ne s'écartent pas d'un pourcentage.
 *
 *  Un solde de Sécurité sociale à −0,2 % du PIB comparé à une médiane
 *  européenne de +0,1 % donnait « 300 % en dessous » : un déficit n'est pas
 *  « trois fois » un excédent, il en est le contraire. Le rapport n'a de sens
 *  que du même côté de zéro — c'est vrai de tous les soldes, déficits et
 *  variations, qui changent de signe sans changer de nature. */
/**
 * Facteur au-delà duquel un rapport cesse de comparer.
 *
 * Une commune ne se compare à une médiane que si cette médiane est une
 * grandeur. Vérifié sur la publication du 4 août : la médiane régionale des
 * « emprunts hors gestion active de la dette » vaut **0,13 € par habitant** —
 * plus de la moitié des communes n'empruntent rien cette année-là — et Bordeaux,
 * à 339 € par habitant, ressortait « +254 040 % au-dessus », promu en écart le
 * plus marqué du thème.
 *
 * Le nombre est exact et ne dit rien : il mesure la petitesse du dénominateur,
 * pas la position de la commune. Passé un facteur cent, le pourcentage n'est
 * plus une comparaison — il énonce que l'autre grandeur est à peu près nulle,
 * ce que la phrase dit alors en toutes lettres.
 */
export const FACTEUR_MAXIMUM = 100;

/** Le repère a-t-il une grandeur suffisante pour qu'un rapport le compare ? */
export function repereComparable(valeur: number, repere: number): boolean {
  if (!Number.isFinite(valeur) || !Number.isFinite(repere) || repere === 0) return false;
  return Math.abs(valeur) <= Math.abs(repere) * FACTEUR_MAXIMUM;
}

export function memeSens(valeur: number, repere: number): boolean {
  return valeur * repere > 0;
}

/** « 16 % au-dessus de la médiane des communes de France ». */
export function lecture(
  valeur: number,
  comparaisons: Comparaison[],
  formater: (v: number) => string,
): string {
  const repere = comparaisons.find((c) => Number.isFinite(c.valeur) && c.valeur !== 0);
  if (!repere) return "";
  // De part et d'autre de zéro, on pose les deux chiffres côte à côte et on
  // laisse le lecteur voir l'écart plutôt que de lui en donner un faux.
  if (!memeSens(valeur, repere.valeur)) {
    return `Contre ${formater(repere.valeur)} pour ${repere.libelle}.`;
  }
  // Un repère cent fois plus petit que la valeur ne la situe pas : il dit que
  // l'autre grandeur est à peu près nulle. On l'écrit ainsi plutôt que d'en
  // tirer un pourcentage à cinq chiffres.
  if (!repereComparable(valeur, repere.valeur)) {
    return `Sans commune mesure : ${repere.libelle} est à ${formater(repere.valeur)}.`;
  }
  const ecart = ((valeur - repere.valeur) / Math.abs(repere.valeur)) * 100;
  // Pas de mise en minuscules : « France » deviendrait « france ». Les
  // libellés sont écrits par l'appelant, déjà dans la forme voulue.
  const nom = repere.libelle;
  if (Math.abs(ecart) < SEUIL_PROCHE) {
    return `Proche de ${nom} (${formater(repere.valeur)}).`;
  }
  // Le signe porte le sens : « +24 % vs » se lit d'un coup d'œil là où
  // « 24 % au-dessus de » se lisait en deux temps.
  return `${ecart > 0 ? "+" : "−"}${arrondiEcart(ecart)} % vs ${nom} (${formater(
    repere.valeur,
  )}).`;
}

export type Ecart = { libelle: string; ecart: number };

/**
 * Ce que dit un thème pris dans son ensemble — l'agrégat honnête.
 *
 * **On ne somme pas les indicateurs d'un thème.** Sur la sécurité, additionner
 * les cambriolages, les vols de véhicules, les coups et blessures et les
 * personnes mises en cause ferait un total de victimes, de véhicules et
 * d'auteurs : trois unités et trois périmètres dans un seul nombre. La règle du
 * projet l'interdit, et elle a raison — ce nombre ne voudrait rien dire.
 *
 * Ce qui s'agrège sans mentir, c'est **l'écart au repère** : chaque indicateur
 * est comparé à la même référence, et les écarts, eux, sont sans unité. On peut
 * donc dire combien d'indicateurs du thème situent ce territoire au-dessus,
 * combien en dessous, et lequel s'écarte le plus. C'est une synthèse du thème
 * entier, pas un extrait de l'un de ses indicateurs.
 */
export function resumeEcarts(ecarts: Ecart[], repere: string): string {
  const marquants = ecartsMarquants(ecarts, 3);
  // Rien de marquant, rien d'écrit. « Sur 2 indicateurs comparés : 2 au
  // niveau » occupait une ligne pour dire qu'il n'y avait rien à dire — et
  // les décomptes (« 13 au-dessus ») annonçaient qu'il y avait quelque chose
  // à voir sans jamais dire quoi.
  if (!marquants.length) return "";
  return `Vs ${repere} : ${marquants.map(nommerEcart).join(", ")}.`;
}

/** Les écarts qui méritent d'être nommés, du plus marqué au moins marqué. */
function ecartsMarquants(ecarts: Ecart[], combien: number): Ecart[] {
  return ecarts
    .filter((e) => Number.isFinite(e.ecart) && Math.abs(e.ecart) >= SEUIL_PROCHE)
    .sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart))
    .slice(0, combien);
}

function nommerEcart(e: Ecart): string {
  return `${e.libelle} ${e.ecart > 0 ? "+" : "−"}${arrondiEcart(e.ecart)} %`;
}

/**
 * Le même agrégat, en une proposition — pour l'ouverture de la fiche.
 *
 * `resumeEcarts` écrit la version complète, avec le décompte des trois
 * positions et l'écart le plus marqué. Affichée à la fois dans « L'essentiel »
 * et sous les onglets, elle apparaissait deux fois mot pour mot à trois
 * centimètres d'intervalle. La forme longue reste là où l'on regarde le thème ;
 * l'ouverture n'en garde que le côté dominant, en une ligne.
 */
export function compteEcarts(ecarts: Ecart[], repere: string): string {
  // « 13 des 15 indicateurs au-dessus de son département » ne disait pas
  // lesquels — le seul renseignement qu'on venait chercher. Deux noms, pas
  // un décompte ; rien de marquant, rien d'écrit.
  const marquants = ecartsMarquants(ecarts, 2);
  if (!marquants.length) return "";
  return `${marquants.map(nommerEcart).join(", ")} vs ${repere}.`;
}

/** Sens d'une série : « en hausse depuis 2022 », « stable ». */
export function tendance(serie: Record<string, number>): string {
  const periodes = Object.keys(serie).sort();
  if (periodes.length < 3) return "";
  const premiere = serie[periodes[0]];
  const derniere = serie[periodes[periodes.length - 1]];
  if (!premiere) return "";
  const variation = ((derniere - premiere) / Math.abs(premiere)) * 100;
  if (Math.abs(variation) < SEUIL_PROCHE) return `Stable depuis ${periodes[0]}.`;
  return `En ${variation > 0 ? "hausse" : "baisse"} depuis ${periodes[0]}.`;
}

export type FaitSynthese = {
  /** L'indicateur d'où vient le fait — la synthèse ne dit rien qui ne soit
   *  ailleurs dans le panneau, chiffre à l'appui. */
  id: string;
  texte: string;
};

/**
 * La synthèse d'un territoire : ce qu'on retiendrait en trois lignes.
 *
 * Elle ne classe pas, elle situe. Chaque fait est un chiffre publié et sa
 * comparaison la plus parlante ; un indicateur absent est simplement absent
 * de la synthèse — mieux vaut trois faits vrais que cinq dont deux inventés.
 */
export function synthese(faits: FaitSynthese[], maximum = 4): string[] {
  return faits.filter((f) => f.texte).slice(0, maximum).map((f) => f.texte);
}
