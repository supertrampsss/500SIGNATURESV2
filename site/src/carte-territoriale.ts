/** Le même seuil que la grille desktop du briefing territorial. */
export const REQUETE_CARTE_SECONDAIRE = "(min-width: 60.0625rem)";

/**
 * La carte ne vole pas le premier écran sur mobile ; elle demeure en revanche
 * visible sur un grand écran comme outil de contexte du diagnostic.
 */
export function carteVisibleParDefaut(
  lireMedia: (requete: string) => { matches: boolean },
): boolean {
  return lireMedia(REQUETE_CARTE_SECONDAIRE).matches;
}
