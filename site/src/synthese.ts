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
  const ecart = ((valeur - repere.valeur) / Math.abs(repere.valeur)) * 100;
  // Pas de mise en minuscules : « France » deviendrait « france ». Les
  // libellés sont écrits par l'appelant, déjà dans la forme voulue.
  const nom = repere.libelle;
  if (Math.abs(ecart) < SEUIL_PROCHE) {
    return `Proche de ${nom} (${formater(repere.valeur)}).`;
  }
  return `${arrondiEcart(ecart)} % ${ecart > 0 ? "au-dessus" : "en dessous"} de ${nom} (${formater(
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
  const finis = ecarts.filter((e) => Number.isFinite(e.ecart));
  if (finis.length < 2) return "";
  const hauts = finis.filter((e) => e.ecart >= SEUIL_PROCHE).length;
  const bas = finis.filter((e) => e.ecart <= -SEUIL_PROCHE).length;
  const proches = finis.length - hauts - bas;
  const morceaux = [
    hauts ? `${hauts} au-dessus` : "",
    bas ? `${bas} en dessous` : "",
    proches ? `${proches} au niveau` : "",
  ].filter(Boolean);
  const fort = finis.reduce((a, b) => (Math.abs(b.ecart) > Math.abs(a.ecart) ? b : a));
  const marque =
    Math.abs(fort.ecart) >= SEUIL_PROCHE
      ? ` Écart le plus marqué : ${fort.libelle}, ${fort.ecart > 0 ? "+" : "−"}${arrondiEcart(
          fort.ecart,
        )} %.`
      : "";
  return `Sur ${finis.length} indicateurs comparés à ${repere} : ${morceaux.join(
    ", ",
  )}.${marque}`;
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
  const finis = ecarts.filter((e) => Number.isFinite(e.ecart));
  if (finis.length < 2) return "";
  const hauts = finis.filter((e) => e.ecart >= SEUIL_PROCHE).length;
  const bas = finis.filter((e) => e.ecart <= -SEUIL_PROCHE).length;
  if (hauts === 0 && bas === 0) {
    return `${finis.length} indicateurs, tous au niveau de ${repere}.`;
  }
  // À égalité, on ne désigne pas de côté : le thème ne penche pas, et prétendre
  // le contraire sur un départage arbitraire serait le seul vrai biais ici.
  if (hauts === bas) {
    return `${finis.length} indicateurs, autant au-dessus qu'en dessous de ${repere}.`;
  }
  const [combien, sens] = hauts > bas ? [hauts, "au-dessus"] : [bas, "en dessous"];
  return `${combien} des ${finis.length} indicateurs ${sens} de ${repere}.`;
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
