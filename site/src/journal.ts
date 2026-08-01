/**
 * Journal des changements.
 *
 * Un site qui corrige ses chiffres sans le dire demande la même confiance
 * aveugle que celui qui ne les corrige jamais. Ce bloc s'adresse à quelqu'un
 * qui a noté une valeur et la retrouve différente : il lui dit laquelle a
 * bougé, quand, et pourquoi.
 *
 * Le détail technique est là aussi, replié : il intéresse celui qui réutilise
 * les données, il encombre celui qui lit un chiffre.
 */

import type { Changement } from "./donnees.ts";

const TYPES: Record<string, string> = {
  correction: "Correction",
  methodology: "Méthode",
  break: "Rupture de série",
  revision: "Révision",
  deprecation: "Retrait",
};

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function date(iso: string): string {
  const rendu = new Date(iso).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  // « 1 août » n'existe pas en français : le premier du mois est un ordinal, et
  // Intl ne le connaît pas. Les autres jours restent cardinaux.
  return rendu.replace(/^1 /, "1er ");
}

/** « À partir de 2019 » se comprend ; « effet au 2019-01-01 » demande un effort. */
function portee(effetAu: string | null): string {
  if (!effetAu) return "";
  const annee = effetAu.slice(0, 4);
  return ` <span class="journal__portee">à partir de ${echapper(annee)}</span>`;
}

/** Rendu pur, sans DOM : c'est lui qui est testé. */
export function rendu(changements: Changement[]): string {
  const entrees = changements
    .map(
      (c) => `<li class="journal__entree">
        <p class="journal__entete">
          <span class="journal__type journal__type--${echapper(c.type)}">${echapper(
            TYPES[c.type] ?? c.type,
          )}</span>
          <time datetime="${echapper(c.annonce)}">${echapper(date(c.annonce))}</time>
          ${portee(c.effet_au)}
        </p>
        <p class="journal__public">${echapper(c.public)}</p>
        ${
          c.technique
            ? `<details class="journal__technique">
                 <summary>Détail technique</summary>
                 <p>${echapper(c.technique)}</p>
               </details>`
            : ""
        }
      </li>`,
    )
    .join("");
  return `
    <h2>Ce qui a changé</h2>
    <p class="tableau__aide">
      Les corrections, retraits et changements de méthode depuis la mise en ligne,
      du plus récent au plus ancien. Un chiffre que vous auriez noté et qui ne
      correspond plus devrait s'expliquer ici.
    </p>
    <ul class="journal">${entrees}</ul>`;
}

export function afficherJournal(bloc: HTMLElement, changements: Changement[]): boolean {
  if (!changements.length) return false;
  bloc.innerHTML = rendu(changements);
  return true;
}
