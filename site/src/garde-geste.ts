/**
 * Absorbeur de clic fantôme.
 *
 * Sur un écran tactile, le navigateur émet un `click` de compatibilité après le
 * `touchend`, et il refait le test de recouvrement **au moment du clic**, pas au
 * moment du contact. Une commande qui déplace ce qui se trouve sous le doigt
 * envoie donc ce clic à ce qui vient d'apparaître dessous.
 *
 * C'est le défaut de la poignée du tiroir : la relâcher réduit le panneau, le
 * bord supérieur du tiroir descend sous le point touché, et le clic de
 * compatibilité part vers le canevas de la carte, qui sélectionne la commune à
 * cet endroit. Toucher la poignée sur la fiche de Bordeaux ouvrait la fiche de
 * la commune peinte sous le doigt.
 *
 * La garde s'arme au relâchement de la poignée et absorbe **un seul** clic dans
 * la fenêtre qui suit : deux clics fantômes ne viennent pas d'un même geste, et
 * manger les vrais clics suivants serait pire que le défaut corrigé.
 */
export type Garde = {
  /** Ouvre la fenêtre d'absorption, à partir de maintenant. */
  armer(): void;
  /** Vrai si ce clic vient du geste précédent : l'appelant doit l'ignorer. */
  absorbe(): boolean;
};

/** Fenêtre par défaut : le clic de compatibilité suit le `touchend` de quelques
 *  dizaines de millisecondes. 500 ms couvre les appareils lents sans mordre sur
 *  un second geste volontaire, qui demande le temps de relever puis reposer le
 *  doigt. */
export const FENETRE_FANTOME = 500;

export function creerGarde(
  fenetreMs: number = FENETRE_FANTOME,
  horloge: () => number = () => Date.now(),
): Garde {
  let jusqua = 0;
  return {
    armer(): void {
      jusqua = horloge() + fenetreMs;
    },
    absorbe(): boolean {
      if (horloge() >= jusqua) return false;
      jusqua = 0;
      return true;
    },
  };
}
