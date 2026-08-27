/**
 * « La Sécu est-elle en déficit ? » : dépenses, recettes et solde du
 * sous-secteur administrations de sécurité sociale (S1314), en % du PIB,
 * année par année — le solde est l'écart entre deux lignes, pas un chiffre
 * isolé (maquette 4.5 de la shortlist validée).
 *
 * Le bloc a porté deux autres choses, sorties parce que la maquette validée
 * ne les montre pas : la répartition « 100 € de prestations sociales »
 * (`cent-euros-secu.ts`, qui garde son rendu et ses tests sans appelant) et
 * un tableau de comparaison France / Allemagne / zone euro. Un chapitre porte
 * exactement les blocs de sa maquette.
 *
 * Le solde s'exprime en **% du PIB**, comme le déficit public partout
 * ailleurs sur le site : c'est un niveau (recettes moins dépenses d'une même
 * année), pas la variation d'un taux — la règle des points ne vaut que pour
 * les variations.
 *
 * La légende du tableau (définition du sous-secteur, lecture de la courbe
 * excédent/déficit) est partie : les sources se tiennent courtes et sous le
 * tableau, jamais en légende au-dessus. Le sous-secteur reste nommé dans ce
 * docstring et dans la réponse du bloc.
 */

import type { Indicateur, Territoire } from "./donnees.ts";
import { moins, montantLisible, pourcentage } from "./echelle.ts";

export const DEPENSES = "eurostat_secu_depenses_pib";
export const RECETTES = "eurostat_secu_recettes_pib";
export const SOLDE = "eurostat_secu_solde_pib";

const FINE = "\u202f";

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Un solde se lit signé, en % du PIB : « +0,4 % » / « −2,1 % ».
 *
 *  Il s'écrivait « pt », et c'était une sur-application de la règle des
 *  points : elle vaut pour la VARIATION d'un taux dans le temps, pas pour un
 *  niveau. Le solde de la Sécu est recettes moins dépenses d'une même année,
 *  deux niveaux en % du PIB — de la même nature que le déficit public que le
 *  site écrit « −5,1 % » partout ailleurs. Deux écritures pour une même
 *  nature de chiffre se lisaient comme deux mesures. */
export function points(valeur: number): string {
  const texte = valeur.toLocaleString("fr-FR", {
    signDisplay: "exceptZero",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  // Le moins typographique, comme partout ailleurs : `Intl` rend un trait
  // d'union, et « -0,2 pt » se lisait sous « −5,1 % » dans le bloc voisin —
  // deux signes de deux largeurs pour la même soustraction.
  return `${moins(texte)}${FINE}%`;
}

/** Rendu pur, sans DOM : c'est lui qui est testé.
 *
 *  Un tableau, un exercice par colonne (la règle du dépôt : un tableau
 *  d'analyse montre tous les exercices publiés), trois lignes — recettes en
 *  positif, dépenses en négatif, et le solde est l'écart entre les deux. */
export function rendu(pays: Record<string, Territoire>, catalogue: Indicateur[]): string {
  const france = pays["FR"];
  if (!france) return "";
  if (!catalogue.some((i) => i.id === SOLDE)) return "";
  const serie = (id: string) => france.series?.[id] ?? {};
  const soldes = serie(SOLDE);
  const annees = Object.keys(soldes).sort();
  const annee = annees[annees.length - 1];
  if (!annee) return "";
  const soldeFr = soldes[annee];
  const depensesFr = serie(DEPENSES)[annee];
  const recettesFr = serie(RECETTES)[annee];
  if (depensesFr === undefined || recettesFr === undefined) return "";

  // La réponse à la question du titre, avec les choses nommées : recettes,
  // dépenses, déficit — et le déficit en euros, pas seulement en part. Le
  // montant vient du produit de deux chiffres publiés (solde en % du PIB,
  // PIB en euros), et « environ » dit l'arrondi du premier. Aucun
  // qualificatif : 6 milliards, c'est 6 milliards, le chiffre parle seul.
  const pib = serie("eurostat_pib_montant")[annee];
  const enEuros =
    pib !== undefined
      ? ` : le déficit est d'environ ${montantLisible(Math.abs((soldeFr / 100) * pib))}`
      : "";

  // Une année dont le solde est publié mais pas le détail garde sa colonne,
  // en tirets : « pas encore publié » se dit, une colonne qui disparaît se
  // devine.
  const cellule = (v: number | undefined, ecrire: (n: number) => string) =>
    v === undefined ? "—" : echapper(ecrire(v));
  const rangee = (valeurs: Record<string, number>, classe: string, ecrire: (n: number) => string) =>
    annees.map((a) => `<td class="${classe}">${cellule(valeurs[a], ecrire)}</td>`).join("");

  return `
    <h3>La Sécu est-elle en déficit ?</h3>
    <p class="bloc__complement"><strong>${
      soldeFr < 0 ? "Oui." : soldeFr > 0 ? "Non, elle est en excédent." : "Non, elle est à l'équilibre."
    }</strong> En ${echapper(annee)}, la Sécurité sociale a dépensé l'équivalent de
      <strong>${echapper(pourcentage(depensesFr))}</strong> du PIB et encaissé
      <strong>${echapper(pourcentage(recettesFr))}</strong> du PIB${enEuros}.</p>
    <table class="secu" tabindex="0">
      <thead><tr><th scope="col">% du PIB</th>${annees
        .map((a) => `<th scope="col">${echapper(a)}</th>`)
        .join("")}</tr></thead>
      <tbody>
        <tr><th scope="row">Recettes</th>${rangee(serie(RECETTES), "flux--plus", (n) => `+${pourcentage(n, true)}`)}</tr>
        <tr><th scope="row">Dépenses</th>${rangee(serie(DEPENSES), "flux--moins", (n) => `−${pourcentage(n, true)}`)}</tr>
      </tbody>
      <tfoot><tr><th scope="row">Solde</th>${annees
        .map(
          (a) => `<td class="${soldes[a] < 0 ? "secu__besoin" : "secu__capacite"}">${echapper(points(soldes[a]))}</td>`,
        )
        .join("")}</tr></tfoot>
    </table>
    <p class="bloc__complement">Source : Eurostat.</p>
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
  // Le cadre est peut-être REPLIÉ : le pré-rendu replie ce qu'il ne peut pas
  // écrire, et rien ne le rouvrait. Un bloc dont les séries sont publiées
  // APRÈS le dernier déploiement restait alors invisible à tout lecteur —
  // écrit, peint, et caché. Qui remplit un cadre le déplie.
  bloc.hidden = false;
  return true;
}
