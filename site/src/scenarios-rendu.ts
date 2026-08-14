/**
 * Le rendu des scénarios : la barre qui les liste, le tableau qui les compare.
 *
 * Deux fonctions pures, sur le modèle d'`analyse-rendu.ts` : chacune rend une
 * chaîne, sans toucher au DOM, et c'est cette chaîne qui est testée.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE CE MODULE N'ÉCRIT JAMAIS
 * ─────────────────────────────────────────────────────────────────────────
 * Deux budgets ne s'additionnent pas — entre le budget général de l'État et
 * les régimes de base circulent des dizaines de milliards que chacun compte
 * de son côté — donc ce module n'écrit jamais la valeur d'une colonne
 * combinée à celle d'une autre : chaque effort reste attaché à sa propre
 * colonne, chaque cellule à sa propre ligne. Et il ne désigne personne :
 * deux colonnes et leurs écarts, rien qui les ordonne ni les note.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * NULL ET ZÉRO SONT DEUX DÉCISIONS DIFFÉRENTES DU LECTEUR
 * ─────────────────────────────────────────────────────────────────────────
 * `comparaison.ts` pose `null` dans une cellule que la colonne n'a pas
 * touchée, et un nombre — zéro compris — dans une cellule qu'elle a réglée.
 * Confondre les deux à l'écran ferait dire au tableau qu'un lecteur a réglé
 * une ligne qu'il n'a jamais ouverte. La cellule `null` porte donc un texte
 * qui ne ressemble à aucun montant, jamais un « 0 M€ » qui s'y confondrait.
 */

import type { Scenario } from "./scenarios.ts";
import type { Colonne, LigneComparee } from "./comparaison.ts";
import { formater } from "./echelle.ts";
import { echapper } from "./texte.ts";

/**
 * Une colonne comparée, avec l'exercice sur lequel elle a été construite.
 *
 * `Colonne` (comparaison.ts) ne le porte pas — `atelier.ts` ignore le
 * millésime, il ne connaît que des coefficients. Deux scénarios construits
 * sur des exercices différents doivent pourtant se dire en tête du tableau
 * (spec §12) : c'est ce module qui affiche l'écran, donc c'est lui qui porte
 * le champ.
 *
 * `null` quand l'exercice est authentiquement inconnu — un scénario partagé
 * par lien que le lecteur n'a pas en local, sur lequel rien ne dit à quel
 * millésime il a été construit. Jamais une valeur par défaut plausible mais
 * sans rapport : voir `colonnesComparaison` (main.ts).
 */
export type Comparable = Colonne & { exercice: string | null };

/**
 * La barre des scénarios enregistrés, le courant marqué.
 *
 * Un dépôt vide n'affiche pas une liste vide — un cadre sans rien dedans, qui
 * laisse le lecteur deviner s'il a bien cherché — mais invite explicitement à
 * enregistrer, la première fois qu'il n'y a rien à lister.
 */
export function renduBarre(scenarios: Scenario[], courant: string | null): string {
  if (scenarios.length === 0) {
    return `<nav class="scenarios-rendu__barre" aria-label="Mes scénarios">
      <p class="scenarios-rendu__vide">Aucun scénario enregistré. Réglez le simulateur, puis enregistrez-le pour le retrouver ici.</p>
    </nav>`;
  }
  const items = scenarios
    .map((s) => {
      const actif = s.nom === courant;
      return `<li><button type="button" class="scenarios-rendu__scenario${
        actif ? " scenarios-rendu__scenario--courant" : ""
      }" data-nom="${echapper(s.nom)}"${actif ? ' aria-current="true"' : ""}>${echapper(
        s.nom,
      )}</button></li>`;
    })
    .join("");
  return `<nav class="scenarios-rendu__barre" aria-label="Mes scénarios">
    <ul class="scenarios-rendu__liste">${items}</ul>
  </nav>`;
}

/**
 * Le tableau de comparaison : une colonne par comparable, une ligne par
 * entrée touchée dans au moins une colonne (`comparer()`, comparaison.ts).
 *
 * La légende dit l'unité, comme partout ailleurs sur le site.
 */
export function renduComparaison(colonnes: Comparable[], lignes: LigneComparee[]): string {
  const entetes = colonnes
    .map(
      (c) => `<th scope="col" class="scenarios-rendu__entete">
        <span class="scenarios-rendu__nom-colonne">${echapper(c.nom)}</span>
        <span class="scenarios-rendu__exercice-colonne">${
          c.exercice === null ? "Exercice inconnu" : `Exercice ${echapper(c.exercice)}`
        }</span>
        <span class="scenarios-rendu__effort-colonne">${formater(c.effort, "EUR", false)}</span>
        <span class="scenarios-rendu__gestes-colonne">${c.gestes} ${
          c.gestes > 1 ? "gestes" : "geste"
        }</span>
      </th>`,
    )
    .join("");

  const corps = lignes
    .map((ligne) => {
      const cellules = ligne.cellules
        .map((cellule) =>
          cellule === null
            ? `<td class="scenarios-rendu__cellule scenarios-rendu__cellule--non-reglee">Non réglé</td>`
            : `<td class="scenarios-rendu__cellule">${formater(cellule, "EUR", false)}</td>`,
        )
        .join("");
      return `<tr><th scope="row">${echapper(ligne.libelle)}</th>${cellules}</tr>`;
    })
    .join("");

  return `<div class="scenarios-rendu__defilement"><table class="scenarios-rendu__tableau">
    <caption>Montants en millions d'euros.</caption>
    <thead><tr><th scope="col">Ligne</th>${entetes}</tr></thead>
    <tbody>${corps}</tbody>
  </table></div>`;
}
