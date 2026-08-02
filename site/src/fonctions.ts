/**
 * Que finance la dépense publique — santé, école, retraites, défense.
 *
 * C'est la question fondatrice du produit, et elle ne se répond pas avec le
 * budget de l'État : la santé est surtout payée par la Sécurité sociale,
 * l'école en partie par les collectivités. Ce bloc montre donc l'ensemble des
 * administrations publiques (COFOG, secteur S13), en % du PIB — et face à
 * l'Allemagne et à la zone euro, sur la même définition, parce qu'un chiffre
 * de dépense publique sans point de comparaison ne dit rien.
 *
 * Le module « 100 € » à côté raconte autre chose : le seul budget de l'État,
 * par nature de dépense. Les deux se complètent et le texte le dit.
 */

import type { Indicateur, Territoire } from "./donnees.ts";
import { pourcentage } from "./echelle.ts";

export const FONCTIONS = [
  "eurostat_fonction_protection_sociale",
  "eurostat_fonction_sante",
  "eurostat_fonction_services_generaux",
  "eurostat_fonction_affaires_economiques",
  "eurostat_fonction_enseignement",
  "eurostat_fonction_ordre_securite",
  "eurostat_fonction_defense",
  "eurostat_fonction_culture",
  "eurostat_fonction_logement",
  "eurostat_fonction_environnement",
];
export const TOTAL = "eurostat_depenses_publiques_pib";

const COMPARES: [string, string][] = [
  ["DE", "Allemagne"],
  ["EA20", "Zone euro"],
];

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function derniere(serie: Record<string, number> | undefined): [string, number] | null {
  if (!serie) return null;
  const periodes = Object.keys(serie).sort();
  const p = periodes[periodes.length - 1];
  return p ? [p, serie[p]] : null;
}

/** Rendu pur, sans DOM : c'est lui qui est testé. */
export function rendu(
  pays: Record<string, Territoire>,
  catalogue: Indicateur[],
): string {
  const france = pays["FR"];
  const total = derniere(france?.series?.[TOTAL]);
  if (!france || !total) return "";
  const [annee, totalFr] = total;
  const libelle = (id: string) => catalogue.find((i) => i.id === id)?.libelle ?? id;
  const valeur = (code: string, id: string): number | undefined =>
    pays[code]?.series?.[id]?.[annee];

  const lignes = FONCTIONS.map((id) => ({ id, fr: valeur("FR", id) }))
    .filter((l): l is { id: string; fr: number } => l.fr !== undefined)
    .sort((a, b) => b.fr - a.fr)
    .map(({ id, fr }) => {
      const barres = `<span class="fonction__barre" style="width:${((fr / totalFr) * 100).toFixed(
        1,
      )}%"></span>`;
      const autres = COMPARES.map(([code]) => {
        const v = valeur(code, id);
        return `<td>${v === undefined ? "—" : echapper(pourcentage(v))}</td>`;
      }).join("");
      return `<tr>
        <th scope="row">${echapper(libelle(id))}</th>
        <td class="fonction__fr"><span class="fonction__piste">${barres}</span>
          <strong>${echapper(pourcentage(fr))}</strong></td>
        ${autres}
      </tr>`;
    })
    .join("");

  const totauxCompares = COMPARES.map(([code, nom]) => {
    const v = valeur(code, TOTAL);
    return v === undefined ? "" : ` · ${echapper(nom)} : ${echapper(pourcentage(v))}`;
  }).join("");

  return `
    <h3>Que finance la dépense publique ?</h3>
    <p class="bloc__complement">En ${echapper(annee)}, les administrations publiques
      françaises — État, collectivités et Sécurité sociale réunis — ont dépensé
      <strong>${echapper(pourcentage(totalFr))} du produit intérieur brut</strong>${totauxCompares}.</p>
    <table class="fonctions">
      <caption>Par fonction, en % du PIB · définitions harmonisées Eurostat (COFOG)</caption>
      <thead><tr><th scope="col">Fonction</th><th scope="col">France</th>
        ${COMPARES.map(([, nom]) => `<th scope="col">${echapper(nom)}</th>`).join("")}
      </tr></thead>
      <tbody>${lignes}</tbody>
    </table>
    <p class="avertissement">Ces montants couvrent <strong>toutes les administrations
      publiques</strong>, pas le seul budget de l'État : la santé est surtout payée par
      la Sécurité sociale, l'enseignement en partie par les collectivités. C'est ce qui
      distingue ce tableau du module « 100 € » ci-dessus, qui ne porte que sur l'État.
      Un pourcentage du PIB ne dit pas l'efficacité de la dépense — seulement son poids.</p>`;
}

export function afficherFonctions(
  bloc: HTMLElement,
  pays: Record<string, Territoire>,
  catalogue: Indicateur[],
): boolean {
  const html = rendu(pays, catalogue);
  if (!html) return false;
  bloc.innerHTML = html;
  return true;
}
