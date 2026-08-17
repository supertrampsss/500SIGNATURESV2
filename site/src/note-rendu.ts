/**
 * La note de gestion, à l'écran.
 *
 * `note.ts` calcule, ce module peint, et rien d'autre. La séparation n'est pas
 * de la coquetterie : la note sera contestée commune par commune, et un barème
 * qu'on peut lire sans ouvrir un navigateur est un barème qu'on peut discuter.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE LE BLOC MONTRE, ET POURQUOI DANS CET ORDRE
 * ─────────────────────────────────────────────────────────────────────────
 * La note d'abord, parce que c'est la question posée — « est-ce que ma commune
 * est bien gérée ». Puis les trois termes, chacun avec **la mesure qui le
 * produit** à côté des points qu'il vaut : « 13,4 % de marge → 4,3 sur 8 ». Une
 * note sans ses mesures est un verdict ; avec elles, c'est un calcul que le
 * lecteur refait.
 *
 * Enfin ce que la note ne regarde pas. Ce n'est pas une réserve qui s'excuse —
 * la règle du dépôt les refuse — mais un fait de méthode qui change la lecture
 * du chiffre : une commune notée 8/20 n'est pas une commune qui dépense mal,
 * c'est une commune dont la marge et la dette sont tendues. Sans cette ligne,
 * le lecteur lit une note de politique municipale.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES DÉCIMALES
 * ─────────────────────────────────────────────────────────────────────────
 * Les trois termes se lisent de haut en bas : ils forment une colonne, et la
 * règle de la colonne s'applique — la décimale ne tombe pas sur un compte rond.
 * « 8 » entre « 4,3 » et « 3,1 » casse l'alignement de la seule colonne que le
 * lecteur additionne pour vérifier le total.
 */

import { pourcentage } from "./echelle.ts";
import { bornes, mention, type Note } from "./note.ts";

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Un nombre de points, toujours avec sa décimale — c'est une colonne. */
function points(valeur: number): string {
  return valeur.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Une décimale, et l'accord du nom qui suit.
 *
 *  En français, le pluriel commence à 2 : « 1,5 année », « 0,7 point ». Le
 *  bloc écrivait « −0,7 points de marge », qui se lit comme une faute de
 *  frappe et fait douter du reste.
 *
 *  L'espace entre le nombre et son nom est **insécable**, comme partout où ce
 *  site pose une unité (`montantLisible`). Elle est écrite `\u00a0` et non
 *  tapée au clavier : une insécable tapée à la main est invisible à la
 *  relecture, et neuf vérifications de ce dépôt sont passées pour vertes à
 *  cause d'une espace qu'on croyait ordinaire. */
function nombreEtNom(valeur: number, singulier: string): string {
  const nombre = Math.abs(valeur).toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${nombre}\u00a0${singulier}${Math.abs(valeur) >= 2 ? "s" : ""}`;
}

/**
 * Les trois lignes du détail : le terme, la mesure qui le produit, ses points.
 *
 * La mesure est celle de la série publiée, pas une reformulation : le taux
 * d'épargne en pourcentage des recettes, la dette en années d'épargne, la
 * trajectoire en points de taux depuis 2019. **Un taux varie en points** — la
 * trajectoire est un écart entre deux pourcentages, l'écrire « +14 % » serait
 * faux de la façon exacte que le dépôt refuse partout ailleurs.
 */
export function lignes(note: Note): { terme: string; mesure: string; points: string; sur: number }[] {
  const { mesures, detail } = note;
  // Le barème de l'échelon qui a produit la note, jamais un autre : les points
  // sur lesquels chaque terme est noté se lisent là où ils ont été calculés.
  const BORNES = bornes(note.niveau);
  if (!BORNES) return [];
  return [
    {
      terme: "Marge de fonctionnement",
      mesure: `${pourcentage(mesures.tauxEpargne, true)} des recettes`,
      points: points(detail.marge),
      sur: BORNES.MARGE.points,
    },
    {
      terme: "Poids de la dette",
      mesure:
        mesures.desendettement === null
          ? // Le ratio n'existe pas quand l'épargne est nulle ou négative. Écrire
            // « l'infini » ferait passer une impossibilité pour une durée ; la
            // phrase dit ce que la mesure dit.
            "aucune épargne pour rembourser"
          : `${nombreEtNom(mesures.desendettement, "année")} d'épargne`,
      points: points(detail.dette),
      sur: BORNES.DETTE.points,
    },
    {
      terme: "Trajectoire depuis 2019",
      mesure:
        mesures.trajectoire === null
          ? "exercice 2019 non publié"
          : // **Un taux varie en points, jamais en pourcentage.** La trajectoire
            // est l'écart entre deux taux d'épargne : l'écrire « −4,9 % »
            // dirait que la marge a baissé de 4,9 % de sa valeur, quand elle a
            // perdu 4,9 points de recettes.
            `${mesures.trajectoire >= 0 ? "+" : "−"}${nombreEtNom(mesures.trajectoire, "point")} de marge`,
      points: points(detail.trajectoire),
      sur: BORNES.TRAJECTOIRE.points,
    },
  ];
}

/**
 * Le bloc entier.
 *
 * `nom` sert la phrase de méthode : « Bordeaux » plutôt que « ce territoire ».
 * Une note nominative se conteste mieux qu'une note anonyme.
 */
export function rendreNote(note: Note | null, nom: string): string {
  if (!note) return "";
  const total = points(note.valeur);
  const rangs = lignes(note)
    .map(
      (l) => `<tr>
        <th scope="row">${echapper(l.terme)}</th>
        <td class="note__mesure">${echapper(l.mesure)}</td>
        <td class="note__points">${echapper(l.points)}<span class="note__sur"> / ${l.sur}</span></td>
      </tr>`,
    )
    .join("");
  return `<section class="note" aria-labelledby="note-titre">
    <h3 class="note__titre" id="note-titre">Gestion financière</h3>
    <p class="note__valeur"><strong>${echapper(total)}</strong><span class="note__bareme"> / 20</span>
      <span class="note__mention">${echapper(mention(note.valeur))}</span></p>
    <table class="note__detail">
      <caption>Exercice ${echapper(note.mesures.exercice)}. Source : OFGL, comptes des collectivités locales.</caption>
      <tbody>${rangs}</tbody>
    </table>
    <p class="note__portee">La note mesure la solvabilité de ${echapper(
      nom,
    )} : la marge dégagée sur le fonctionnement, le temps qu'il faudrait pour rembourser la dette, et le sens dans lequel les deux vont depuis 2019. Elle ne juge ni le niveau de dépense, ni sa répartition, ni les taux d'impôts, qui sont des choix d'électeurs.</p>
  </section>`;
}
