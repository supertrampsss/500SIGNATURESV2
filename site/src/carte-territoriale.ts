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

type MediaCarte = {
  matches: boolean;
  addEventListener(type: "change", ecouter: () => void): void;
};

/** Suit le breakpoint tant que le lecteur ne tranche pas lui-même. */
export function suivreVisibiliteCarteParDefaut(
  lireMedia: (requete: string) => MediaCarte,
  appliquer: (ouverte: boolean) => void,
  choixInitial = false,
): { choisir(ouverte: boolean): void } {
  const media = lireMedia(REQUETE_CARTE_SECONDAIRE);
  let explicite = choixInitial;
  appliquer(choixInitial || media.matches);
  media.addEventListener("change", () => {
    if (!explicite) appliquer(media.matches);
  });
  return {
    choisir(ouverte) {
      explicite = true;
      appliquer(ouverte);
    },
  };
}

/** La même instance MapLibre est redimensionnée après chaque révélation. */
export function appliquerEtatCarte(
  cadre: { hidden: boolean },
  bouton: { textContent: string | null; setAttribute(nom: string, valeur: string): void },
  ouverte: boolean,
  redimensionner: () => void,
): void {
  cadre.hidden = !ouverte;
  bouton.setAttribute("aria-expanded", String(ouverte));
  bouton.textContent = ouverte ? "Masquer la carte" : "Voir sur la carte";
  if (ouverte) redimensionner();
}

/** Un ancien fragment transportait une intention, pas simplement une vue. */
export function carteDemandeeParFragment(fragment: string): boolean {
  return fragment === "#carte";
}
