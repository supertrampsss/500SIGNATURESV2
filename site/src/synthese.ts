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

/** « 16 % au-dessus de la médiane des communes de France ». */
export function lecture(
  valeur: number,
  comparaisons: Comparaison[],
  formater: (v: number) => string,
): string {
  const repere = comparaisons.find((c) => Number.isFinite(c.valeur) && c.valeur !== 0);
  if (!repere) return "";
  const ecart = ((valeur - repere.valeur) / Math.abs(repere.valeur)) * 100;
  // Pas de mise en minuscules : « France » deviendrait « france ». Les
  // libellés sont écrits par l'appelant, déjà dans la forme voulue.
  const nom = repere.libelle;
  if (Math.abs(ecart) < SEUIL_PROCHE) {
    return `Proche de ${nom} (${formater(repere.valeur)}).`;
  }
  const arrondi = Math.abs(ecart) >= 100
    ? Math.round(Math.abs(ecart) / 10) * 10
    : Math.round(Math.abs(ecart));
  return `${arrondi} % ${ecart > 0 ? "au-dessus" : "en dessous"} de ${nom} (${formater(
    repere.valeur,
  )}).`;
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
