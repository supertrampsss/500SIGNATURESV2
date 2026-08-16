/**
 * Le bloc Sécurité sociale, en deux temps.
 *
 * 1. « 100 € de prestations sociales, où vont-ils ? » : la répartition par
 *    risque, la question que le lecteur se pose vraiment. Elle vient en
 *    premier, comme « 100 € du budget de l'État » précède le pont détaillé.
 *    Le rendu vit dans `cent-euros-secu.ts`.
 * 2. « La Sécu est-elle en déficit ? » : dépenses, recettes et solde du
 *    sous-secteur administrations de sécurité sociale (S1314), en % du PIB.
 *
 * Les deux ne se recouvrent pas — une répartition d'une dépense d'un côté, un
 * solde comparé de l'autre, sur deux périmètres différents — et le second le
 * dit. Ils tiennent dans le même bloc parce qu'ils répondent à la même
 * question posée deux fois.
 *
 * Le bloc dit deux pièges de vocabulaire : ce solde n'est pas le « trou de la
 * Sécu » débattu au Parlement (autre périmètre : régime général + FSV), et les
 * recettes ne sont pas que des cotisations (CSG, fractions de TVA).
 *
 * Le solde s'exprime en **points de PIB**, pas en pourcentage d'un total : la
 * différence entre deux grandeurs en % du PIB se compte en points.
 */

import type { Indicateur, Territoire } from "./donnees.ts";
import { moins, pourcentage } from "./echelle.ts";
import { rendu as renduCentEuros } from "./cent-euros-secu.ts";

export const DEPENSES = "eurostat_secu_depenses_pib";
export const RECETTES = "eurostat_secu_recettes_pib";
export const SOLDE = "eurostat_secu_solde_pib";

const COMPARES: [string, string][] = [
  ["FR", "France"],
  ["DE", "Allemagne"],
  ["EA20", "Zone euro"],
];

const FINE = "\u202f";

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Un solde se lit signé, en points de PIB : « +0,4 pt » / « −2,1 pt ». */
export function points(valeur: number): string {
  const texte = valeur.toLocaleString("fr-FR", {
    signDisplay: "exceptZero",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  // Le moins typographique, comme partout ailleurs : `Intl` rend un trait
  // d'union, et « -0,2 pt » se lisait sous « −5,1 % » dans le bloc voisin —
  // deux signes de deux largeurs pour la même soustraction.
  return `${moins(texte)}${FINE}pt`;
}

function derniere(serie: Record<string, number> | undefined): [string, number] | null {
  if (!serie) return null;
  const periodes = Object.keys(serie).sort();
  const p = periodes[periodes.length - 1];
  return p ? [p, serie[p]] : null;
}

/** Rendu pur, sans DOM : c'est lui qui est testé. Les deux moitiés sont
 *  indépendantes — l'une peut être publiée sans l'autre, et ce qui manque ne
 *  s'écrit pas.
 *
 *  **Le solde en premier, parce que c'est lui qu'on vient lire.** La seule
 *  question qui pointe sur `#bloc-secu` est « La Sécu est-elle en déficit ? »,
 *  et le lecteur qui la suivait atterrissait sur « 100 € de prestations
 *  sociales, où vont-ils ? » — une autre question, à laquelle rien ne renvoie
 *  ici. Le sommaire de REPÈRES nomme l'entrée d'après ce même premier titre :
 *  il annonçait donc le bloc du déficit sous le nom de la répartition. */
export function rendu(pays: Record<string, Territoire>, catalogue: Indicateur[]): string {
  const html = renduSolde(pays, catalogue) + renduCentEuros(pays["FR"], catalogue);
  return html.trim() ? html : "";
}

function renduSolde(pays: Record<string, Territoire>, catalogue: Indicateur[]): string {
  const france = pays["FR"];
  const dernieres = derniere(france?.series?.[SOLDE]);
  if (!france || !dernieres) return "";
  const [annee, soldeFr] = dernieres;
  if (!catalogue.some((i) => i.id === SOLDE)) return "";
  const valeur = (code: string, id: string): number | undefined =>
    pays[code]?.series?.[id]?.[annee];

  const depensesFr = valeur("FR", DEPENSES);
  const recettesFr = valeur("FR", RECETTES);
  if (depensesFr === undefined || recettesFr === undefined) return "";

  // « Capacité » ou « besoin de financement » : les mots de la comptabilité
  // nationale, pas une paraphrase — c'est ce que mesure B9.
  const lecture =
    soldeFr > 0
      ? `une capacité de financement de ${points(soldeFr)} de PIB`
      : soldeFr < 0
        ? `un besoin de financement de ${points(Math.abs(soldeFr)).replace("+", "")} de PIB`
        : "un solde équilibré";

  const lignes = COMPARES.map(([code, nom]) => {
    const d = valeur(code, DEPENSES);
    const r = valeur(code, RECETTES);
    const s = valeur(code, SOLDE);
    // Un comparateur sans valeur cette année-là garde sa ligne, en tirets :
    // « pas encore publié » se dit, un comparateur qui disparaît se devine.
    const cellule = (v: number | undefined, rendu: (n: number) => string) =>
      v === undefined ? "—" : echapper(rendu(v));
    return `<tr>
      <th scope="row">${echapper(nom)}</th>
      <td>${cellule(d, pourcentage)}</td>
      <td>${cellule(r, pourcentage)}</td>
      <td>${cellule(s, points)}</td>
    </tr>`;
  }).join("");

  // Le solde dans le temps : la série qui répond à « la Sécu est-elle en
  // déficit ? » mieux qu'un chiffre isolé — le signe change d'une année à
  // l'autre, et 2020 le montre.
  const serieSolde = Object.entries(france.series?.[SOLDE] ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const frise = serieSolde
    .map(
      ([a, v]) => `<tr><th scope="row">${echapper(a)}</th>
      <td class="${v < 0 ? "secu__besoin" : "secu__capacite"}">${echapper(points(v))}</td></tr>`,
    )
    .join("");

  return `
    <h3>La Sécu est-elle en déficit ?</h3>
    <p class="bloc__complement">En ${echapper(annee)}, les administrations de sécurité
      sociale françaises ont dépensé <strong>${echapper(pourcentage(depensesFr))} du produit
      intérieur brut</strong> et reçu ${echapper(pourcentage(recettesFr))}, soit
      ${lecture}.</p>
    <table class="secu">
      <caption>Sous-secteur administrations de sécurité sociale (S1314), ${echapper(
        annee,
      )} · % du PIB, définitions harmonisées Eurostat</caption>
      <thead><tr><th scope="col">Territoire</th><th scope="col">Dépenses</th>
        <th scope="col">Recettes</th><th scope="col">Solde</th></tr></thead>
      <tbody>${lignes}</tbody>
    </table>
    <table class="secu secu--serie">
      <caption>Le solde français année par année, en points de PIB</caption>
      <thead><tr><th scope="col">Année</th><th scope="col">Solde</th></tr></thead>
      <tbody>${frise}</tbody>
    </table>
`;
}

export function afficherSecu(
  bloc: HTMLElement,
  pays: Record<string, Territoire>,
  catalogue: Indicateur[],
): boolean {
  const html = rendu(pays, catalogue);
  if (!html) return false;
  bloc.innerHTML = html;
  return true;
}
