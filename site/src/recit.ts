/**
 * Ce que la fiche dit avant tout le reste.
 *
 * Un tableau de vingt mesures ne répond pas à la question qu'on se pose en
 * arrivant : « et alors ? ». Le récit y répond en un titre et trois phrases,
 * construits par les mêmes règles que la barre latérale — il n'ajoute aucun
 * fait, il choisit ceux qui commandent la lecture et les met dans l'ordre.
 *
 * **Le titre est celui de la règle la plus saillante**, pas une formule
 * générique. À Bordeaux, la part des impôts locaux dans les recettes de
 * fonctionnement passe de 55,5 % à 60,9 % sur le mandat : le titre dit ce
 * déplacement, et le paragraphe le chiffre avant d'enchaîner sur les deux
 * autres sujets. Ailleurs, une autre règle prendra la tête ou aucune ne
 * franchira son seuil, et la fiche s'ouvrira alors sans récit — c'est la règle
 * maison : une donnée absente n'écrit rien.
 *
 * **Un paragraphe est plusieurs faits, pas un fait répété.** Les phrases
 * viennent de sujets différents : qui paie, ce que coûte le fonctionnement, ce
 * qu'on construit. Trois phrases sur l'investissement financé par l'emprunt
 * seraient trois fois la même information sous trois habillages.
 */

import type { Contexte, Fait } from "./verdict.ts";
import { faits } from "./verdict.ts";

export type Recit = {
  /** Le titre, une phrase, sans point final. */
  titre: string;
  /** Le paragraphe, deux à trois phrases. */
  paragraphe: string;
  /** Les identifiants d'indicateurs cités, dans l'ordre d'apparition. */
  cites: string[];
};

/**
 * Combien de faits le paragraphe enchaîne, et combien il en faut pour exister.
 *
 * Trois phrases sont la longueur qu'on lit debout, dans un ascenseur, sur un
 * téléphone. En dessous de deux faits, il n'y a pas de récit : un titre suivi
 * de la seule phrase qui le redit n'apprend rien de plus que la puce
 * correspondante de la barre latérale, et il occupe dix fois la place.
 */
const PHRASES_MAXIMUM = 3;
const PHRASES_MINIMUM = 2;


/**
 * Les faits du paragraphe : le premier, puis un autre sujet, puis un troisième.
 *
 * Le premier fait est celui du titre — le titre affirme, la phrase qui suit le
 * chiffre. Les suivants viennent chacun d'un sujet qui n'a pas encore parlé,
 * pris dans l'ordre de saillance.
 */
function enchainement(retenus: Fait[]): Fait[] {
  const suite = [retenus[0]];
  const dits = new Set([retenus[0].sujet]);
  for (const fait of retenus.slice(1)) {
    if (suite.length >= PHRASES_MAXIMUM) break;
    if (dits.has(fait.sujet)) continue;
    dits.add(fait.sujet);
    suite.push(fait);
  }
  return suite;
}

export function recit(contexte: Contexte): Recit | null {
  const retenus = faits(contexte);
  if (retenus.length < PHRASES_MINIMUM) return null;
  const suite = enchainement(retenus);

  // La première phrase pose les millésimes. Le cadre — les prix, la population —
  // revient à la première phrase qui sache le porter : une part de recettes
  // n'a pas d'inflation à nommer, un montant en euros courants, si. Il n'est
  // écrit qu'une fois : trois rappels de « +16,1 % » dans trois phrases
  // voisines font lire le paragraphe deux fois plus lentement pour rien.
  let cadreDit = false;
  const phrases = suite.map((fait, rang) => {
    const autonome = rang === 0 || (!cadreDit && fait.cadre);
    if (autonome && fait.cadre) cadreDit = true;
    return autonome ? fait.texte : fait.bref;
  });

  return {
    titre: suite[0].titre,
    paragraphe: phrases.join(" "),
    // Un même indicateur peut porter deux règles — le niveau des impôts locaux
    // et leur part dans les recettes. Il ne se cite qu'une fois.
    cites: [...new Set(suite.map((f) => f.vers))],
  };
}
