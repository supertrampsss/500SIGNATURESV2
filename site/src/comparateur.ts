/**
 * Comparateur de territoires (T-21).
 *
 * Comparer deux territoires n'a de sens qu'à définition, période, unité et
 * périmètre identiques (docs/06). Le comparateur applique cette règle plutôt
 * que de la rappeler : il refuse, en disant pourquoi, une comparaison entre
 * niveaux différents ou entre périmètres qui se recouvrent, et il n'invente
 * jamais une valeur manquante — une case vide est écrite « donnée non
 * disponible », pas remplie par un zéro.
 */

import type { Indicateur, Territoire } from "./donnees.ts";
import { formater, parHabitantAUnSens, populationDeReference } from "./echelle.ts";

export type Entree = { code: string; niveau: string; territoire: Territoire };

export const MAXIMUM = 5;

const NIVEAUX: Record<string, string> = {
  commune: "communes",
  epci: "intercommunalités",
  departement: "départements",
  region: "régions",
  pays: "pays",
};

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Refus motivé, ou chaîne vide si la comparaison est licite. */
export function refus(entrees: Entree[]): string {
  const niveaux = [...new Set(entrees.map((e) => e.niveau))];
  if (niveaux.length > 1) {
    return `Comparaison impossible entre ${niveaux
      .map((n) => NIVEAUX[n] ?? n)
      .join(" et ")} : leurs compétences et leurs budgets ne couvrent pas les mêmes
      dépenses. Choisissez des territoires de même niveau.`;
  }
  return "";
}

/** Avertissements qui n'empêchent pas la comparaison mais la conditionnent. */
export function reserves(entrees: Entree[]): string[] {
  const notes: string[] = [];
  const drapeaux = (e: Entree) => (e.territoire.drapeaux ?? {}) as Record<string, unknown>;
  if (entrees.some((e) => drapeaux(e).type === "EPT")) {
    notes.push(
      "Un établissement public territorial du Grand Paris figure dans la sélection :" +
        " son périmètre est inclus dans celui de la Métropole du Grand Paris.",
    );
  }
  if (entrees.some((e) => drapeaux(e).statut_particulier)) {
    notes.push(
      "Une collectivité à statut particulier figure dans la sélection : elle exerce des" +
        " compétences que les autres territoires du même niveau n'exercent pas.",
    );
  }
  if (entrees.some((e) => !e.territoire.population)) {
    notes.push(
      "Un territoire de la sélection n'a pas de population de référence : ses montants" +
        " par habitant ne sont pas calculables.",
    );
  }
  notes.push(
    "Un écart de dépenses n'est pas un écart de gestion : l'intercommunalité, la" +
      " géographie et les compétences exercées expliquent l'essentiel des différences.",
  );
  return notes;
}

function cellule(
  indicateur: Indicateur,
  entree: Entree,
  periode: string,
  parHabitant: boolean,
): string {
  const brut = entree.territoire.series[indicateur.id]?.[periode];
  if (brut === undefined) return `<td class="absente">donnée non disponible</td>`;
  const ratio = parHabitant && parHabitantAUnSens(indicateur);
  // Même dénominateur que la carte et la fiche : la population de l'exercice
  // comparé. Deux territoires rapportés à deux années différentes ne se
  // comparent pas.
  const population = populationDeReference(entree.territoire, periode).valeur;
  if (ratio && !population) {
    return `<td class="absente">population inconnue</td>`;
  }
  const valeur = ratio ? brut / (population as number) : brut;
  return `<td>${formater(valeur, indicateur.unite, ratio)}</td>`;
}

/** Rendu pur, sans DOM : c'est lui qui est testé. */
export function rendu(
  entrees: Entree[],
  indicateurs: Indicateur[],
  periode: string,
  parHabitant: boolean,
): string {
  if (entrees.length < 2) {
    return `<h2>Comparer des territoires</h2>
      <p class="tableau__aide">Ajoutez au moins deux territoires depuis leur fiche pour
      les comparer côte à côte (${MAXIMUM} au maximum).</p>`;
  }
  const motif = refus(entrees);
  if (motif) {
    return `<h2>Comparer des territoires</h2>
      <p class="avertissement">${echapper(motif.replace(/\s+/g, " ").trim())}</p>`;
  }
  const entetes = entrees
    .map(
      (e) => `<th scope="col">${echapper(e.territoire.nom)}
        <button type="button" class="retirer" data-retirer="${echapper(e.code)}"
          aria-label="Retirer ${echapper(e.territoire.nom)} de la comparaison">×</button></th>`,
    )
    .join("");
  const lignes = indicateurs
    .map(
      (indicateur) => `<tr>
        <th scope="row">${echapper(indicateur.libelle)}</th>
        ${entrees.map((e) => cellule(indicateur, e, periode, parHabitant)).join("")}
      </tr>`,
    )
    .join("");
  return `
    <h2>Comparer des territoires</h2>
    <div class="tableau__cadre">
      <table class="comparateur">
        <caption>${echapper(periode)}${
          parHabitant ? ", montants par habitant" : ", montants totaux"
        } · ${entrees.length} ${echapper(NIVEAUX[entrees[0].niveau] ?? entrees[0].niveau)}</caption>
        <thead><tr><th scope="col">Indicateur</th>${entetes}</tr></thead>
        <tbody>${lignes}</tbody>
      </table>
    </div>
    <details class="panneau">
      <summary>Ce que cette comparaison suppose</summary>
      <ul>${reserves(entrees)
        .map((n) => `<li>${echapper(n)}</li>`)
        .join("")}</ul>
    </details>`;
}

export function afficherComparateur(
  bloc: HTMLElement,
  entrees: Entree[],
  indicateurs: Indicateur[],
  periode: string,
  parHabitant: boolean,
): void {
  bloc.innerHTML = rendu(entrees, indicateurs, periode, parHabitant);
}
