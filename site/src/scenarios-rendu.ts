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
import { contratsDe } from "./mission.ts";
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
 *
 * `disparues` porte les lignes que le budget de CETTE colonne réglait et que
 * la nomenclature courante ne reprend pas (`transposerBudget`, scenarios.ts).
 * Sans elles à l'écran, l'en-tête annoncerait un effort et un nombre de
 * gestes calculés sur un état tronqué, et le lecteur croirait la colonne d'en
 * face porteuse de ce que son auteur y avait mis.
 *
 * `contrat` porte les contraintes sous lesquelles ce budget a été construit,
 * encodées comme l'adresse les porte. Elles sont NOMMÉES, pas appliquées :
 * l'atelier n'a qu'un jeu de contraintes, celui du lecteur, et une colonne
 * comparée ne peut pas imposer le sien. Les taire ferait pourtant lire comme
 * un exploit ce qui était un exploit sous serment.
 *
 * `lien` mène là d'où la colonne vient, quand elle vient de quelque part :
 * l'analyse qui porte ce chiffrage. `null` pour un scénario du lecteur, qui
 * n'a pas de page.
 */
export type Comparable = Colonne & {
  exercice: string | null;
  disparues: readonly string[];
  contrat: string;
  lien: string | null;
};

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
 * Ce qu'une transposition (`transposerBudget()`, scenarios.ts) n'a pas pu
 * reprendre : les lignes que la nomenclature courante ne porte plus.
 *
 * Rien à écrire quand `disparues` est vide — le cas courant, un budget
 * transposé sans perte. Sinon la liste est nommée, jamais seulement comptée
 * (le lecteur doit savoir *quelles* décisions ont sauté), et quand plus rien
 * n'a survécu, la phrase le dit en toutes lettres plutôt que de laisser un
 * atelier vide passer pour un budget sain.
 *
 * `rienRepris` est un fait de la transposition, pas de l'écran : il est donc
 * reçu, jamais recalculé sur l'état vif. Le déduire ici de `gestes(volets,
 * etat)` faisait dire « aucun réglage n'a pu être repris » à un lecteur qui
 * avait simplement remis à zéro les trois curseurs que la transposition lui
 * avait bel et bien rendus.
 */
export function renduDisparues(disparues: readonly string[], rienRepris: boolean): string {
  if (disparues.length === 0) return "";
  const intro = rienRepris
    ? "Aucun réglage n'a pu être repris : ces lignes ont disparu de la nomenclature."
    : "Ces lignes ont disparu de la nomenclature et n'ont pas pu être reprises.";
  const items = disparues.map((d) => `<li>${echapper(d)}</li>`).join("");
  return `<div class="scenarios-rendu__disparues">
    <p>${intro}</p>
    <ul>${items}</ul>
  </div>`;
}

/**
 * Les lignes qu'une colonne réglait et que la nomenclature courante ne
 * reprend pas, attribuées à leur colonne.
 *
 * Sous le tableau, jamais dedans : une colonne d'écarts n'a pas de case pour
 * une ligne qui n'a pas d'écart. Et nommées colonne par colonne, parce qu'un
 * lecteur ne doit pas pouvoir croire que la colonne d'en face porte ce que
 * son auteur y avait mis.
 */
function renduAbandons(colonnes: Comparable[]): string {
  return colonnes
    .filter((c) => c.disparues.length > 0)
    .map(
      (c) => `<div class="scenarios-rendu__disparues">
      <p>« ${echapper(c.nom)} » réglait ces lignes, que l'atelier ne reprend pas :</p>
      <ul>${c.disparues.map((d) => `<li>${echapper(d)}</li>`).join("")}</ul>
    </div>`,
    )
    .join("");
}

/**
 * Les contraintes sous lesquelles une colonne a été construite, nommées en
 * tête de cette colonne.
 *
 * Nommées, jamais appliquées : l'atelier n'a qu'un jeu de contraintes, celui
 * du lecteur. Un budget bâti sans lever un seul impôt et un budget bâti sans
 * serment ne se lisent pas de la même façon, et rien d'autre à l'écran ne
 * porte la différence. Une clé inconnue ne nomme rien (`contratsDe`,
 * mission.ts), et un budget sans serment n'écrit pas de ligne du tout.
 */
function renduContrainte(contrat: string): string {
  const contrats = contratsDe(contrat.split(",").filter(Boolean));
  if (contrats.length === 0) return "";
  return `
        <span class="scenarios-rendu__contrainte-colonne">Sous contrainte : ${echapper(
          contrats.map((c) => c.nom.toLowerCase()).join(" · "),
        )}</span>`;
}

/**
 * Le tableau de comparaison : une colonne par comparable, une ligne par
 * entrée touchée dans au moins une colonne (`comparer()`, comparaison.ts).
 *
 * La légende dit l'unité, comme partout ailleurs sur le site.
 *
 * Le montant en tête de colonne est NOMMÉ, comme les mentions qui l'entourent.
 * Seul et gras au-dessus d'une colonne d'écarts, il se lisait comme le total
 * de cette colonne — la lecture que ce module interdit partout ailleurs. C'est
 * la somme des écarts de cette colonne, et rien d'autre : les écarts
 * s'additionnent, les budgets non (`effort`, atelier.ts).
 */
export function renduComparaison(colonnes: Comparable[], lignes: LigneComparee[]): string {
  const entetes = colonnes
    .map(
      (c) => `<th scope="col" class="scenarios-rendu__entete">
        <span class="scenarios-rendu__nom-colonne">${
          c.lien === null
            ? echapper(c.nom)
            : `<a class="scenarios-rendu__lien-colonne" href="${echapper(c.lien)}">${echapper(
                c.nom,
              )}</a>`
        }</span>
        <span class="scenarios-rendu__exercice-colonne">${
          c.exercice === null ? "Exercice inconnu" : `Exercice ${echapper(c.exercice)}`
        }</span>${renduContrainte(c.contrat)}
        <span class="scenarios-rendu__effort-quoi">Somme des écarts</span>
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

  return `<div class="scenarios-rendu__defilement" tabindex="0"><table class="scenarios-rendu__tableau">
    <caption>Montants en millions d'euros.</caption>
    <thead><tr><th scope="col">Ligne</th>${entetes}</tr></thead>
    <tbody>${corps}</tbody>
  </table></div>${renduAbandons(colonnes)}`;
}
