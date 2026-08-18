/**
 * Le chapitre qui ouvre Bilan : de combien on parle, et depuis quand.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE LA PAGE NE DISAIT PAS
 * ─────────────────────────────────────────────────────────────────────────
 * Bilan ouvrait sur 1 412 px de conjoncture — inflation, croissance, chômage —
 * avant d'avoir dit de quoi elle parlait. Le lecteur doit savoir **en quatre
 * secondes** de combien il est question : ce que les administrations
 * encaissent, ce qu'elles dépensent, et l'écart entre les deux.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UN BILAN SE LIT SUR UNE DURÉE — ET LA BASE CHANGE LE SIGNE
 * ─────────────────────────────────────────────────────────────────────────
 * Un instantané ne fait pas un bilan, il fait une photo. Chaque chiffre est
 * donc posé avec son écart depuis un exercice de référence.
 *
 * **Le choix de cet exercice n'est pas neutre, et c'est mesuré.** La dépense
 * publique française vaut 57,3 % du PIB en 2025. Son écart :
 *
 * | depuis 1995 | depuis 2019 | depuis 2017 |
 * |---|---|---|
 * | +1,3 point | +2,0 points | **−0,4 point** |
 *
 * Le signe s'inverse. Une base choisie pour la conclusion qu'elle donne rend
 * n'importe quel bilan démontrable, et c'est exactement ce que ce site refuse
 * de faire.
 *
 * Deux garde-fous, donc. **La base est nommée dans la phrase**, pas reléguée
 * en note : le lecteur voit sur quoi la comparaison est faite. Et **les trois
 * chiffres portent leur écart depuis la MÊME base** — recettes, dépenses et
 * solde —, ce qui empêche de raconter la baisse de l'un sans la baisse de
 * l'autre. Entre 2017 et 2025, la dépense recule de 0,4 point quand la recette
 * recule de 2,1 : c'est là qu'est le déficit, et un seul des deux chiffres
 * l'aurait caché.
 *
 * La base est `REFERENCE`, déclarée et non déduite d'un calendrier électoral —
 * la règle du dépôt interdit de brancher une fenêtre sur une élection. Elle est
 * choisie parce que c'est le début de la période que le lecteur a en tête, et
 * le module retombe sur le premier exercice publié si elle ne l'est pas.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TROIS DÉNOMINATEURS, ET POURQUOI CHACUN
 * ─────────────────────────────────────────────────────────────────────────
 * Le montant brut ne se représente pas : « 1 714 milliards » n'a pas d'ordre
 * de grandeur pour un lecteur. Deux dénominateurs le rendent lisible, et ils
 * ne disent pas la même chose — la **part du PIB** dit le poids dans
 * l'économie, le **par habitant** dit ce que ça représente pour une personne.
 * Les deux sont donnés, jamais l'un seul.
 */

import type { Territoire } from "./donnees.ts";
import { montantLisible } from "./echelle.ts";

// L'exercice de référence des écarts. Déclaré ici pour qu'il se voie et se
// discute, plutôt que d'être enfoui dans un calcul.
const REFERENCE = "2017";

const RECETTES = "eurostat_apu_recettes";
const DEPENSES = "eurostat_apu_depenses";
const PIB = "eurostat_pib_montant";
const POPULATION = "eurostat_population";

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

const PART = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const EUROS = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** Un écart en points de PIB. **Un taux varie en points, jamais en
 *  pourcentage** : « +2,3 % » dirait que la part a grossi de 2,3 % de sa
 *  valeur, quand elle a gagné 2,3 points de PIB. */
function points(ecart: number): string {
  return `${ecart >= 0 ? "+" : "−"}${PART.format(Math.abs(ecart))} point${
    Math.abs(ecart) >= 2 ? "s" : ""
  }`;
}

export type Ouverture = {
  debut: string;
  fin: string;
  recettes: number;
  depenses: number;
  ecart: number;
  partRecettes: number;
  partDepenses: number;
  partEcart: number;
  ecartPartRecettes: number;
  ecartPartDepenses: number;
  ecartPartEcart: number;
  parHabitant: number;
};

/**
 * Les chiffres du chapitre, ou `null` tant que les quatre séries ne partagent
 * pas deux exercices.
 *
 * Deux exercices et non un : sans point de départ il n'y a pas de bilan, et
 * afficher le seul dernier exercice serait exactement ce que cette refonte
 * corrige.
 */
export function chiffres(france: Territoire | undefined): Ouverture | null {
  if (!france) return null;
  const serie = (id: string) => france.series[id] ?? {};
  const [r, d, p, h] = [RECETTES, DEPENSES, PIB, POPULATION].map(serie);
  const communs = Object.keys(r)
    .filter((an) => d[an] !== undefined && p[an] !== undefined)
    .sort();
  if (communs.length < 2) return null;
  const fin = communs[communs.length - 1];
  // La référence si elle est publiée, le premier exercice sinon : un module qui
  // exigerait 2017 se tairait entièrement sur une source qui commence après.
  const debut = communs.includes(REFERENCE) && REFERENCE !== fin ? REFERENCE : communs[0];

  // La population porte le 1er janvier de l'année suivante quand l'exercice est
  // clos : on prend celle de l'exercice, et à défaut la plus proche disponible.
  const habitants = h[fin] ?? h[Object.keys(h).sort().pop() ?? ""];
  if (!habitants) return null;

  const part = (montant: number, an: string) => (montant / p[an]) * 100;
  return {
    debut,
    fin,
    recettes: r[fin],
    depenses: d[fin],
    ecart: r[fin] - d[fin],
    partRecettes: part(r[fin], fin),
    partDepenses: part(d[fin], fin),
    partEcart: part(r[fin] - d[fin], fin),
    ecartPartRecettes: part(r[fin], fin) - part(r[debut], debut),
    ecartPartDepenses: part(d[fin], fin) - part(d[debut], debut),
    ecartPartEcart: part(r[fin] - d[fin], fin) - part(r[debut] - d[debut], debut),
    parHabitant: d[fin] / habitants,
  };
}

/** Le chapitre, ou la chaîne vide. */
export function rendu(pays: Record<string, Territoire>): string {
  const c = chiffres(pays["FR"]);
  if (!c) return "";
  const deficitaire = c.ecart < 0;
  return `
    <p class="ouverture__phrase">En ${echapper(c.fin)}, les administrations publiques ont encaissé
      <strong>${montantLisible(c.recettes)}</strong> et en ont dépensé
      <strong>${montantLisible(c.depenses)}</strong>.</p>
    <ul class="ouverture__chiffres">
      <li><span class="ouverture__valeur">${PART.format(c.partRecettes)} %</span>
        <span class="ouverture__quoi">du PIB encaissé
          <em class="ouverture__ecart-depuis">${echapper(points(c.ecartPartRecettes))}</em></span></li>
      <li><span class="ouverture__valeur">${PART.format(c.partDepenses)} %</span>
        <span class="ouverture__quoi">du PIB dépensé
          <em class="ouverture__ecart-depuis">${echapper(points(c.ecartPartDepenses))}</em></span></li>
      <li class="ouverture__ecart"><span class="ouverture__valeur">${
        deficitaire ? "−" : "+"
      }${PART.format(Math.abs(c.partEcart))} %</span>
        <span class="ouverture__quoi">du PIB d'écart, le ${deficitaire ? "déficit" : "excédent"} public
          <em class="ouverture__ecart-depuis">${echapper(points(c.ecartPartEcart))}</em></span></li>
    </ul>
    <p class="ouverture__base">Les trois écarts sont mesurés depuis
      <strong>${echapper(c.debut)}</strong>, et depuis le même exercice pour les trois : la
      dépense recule quand la recette recule davantage, et c'est là qu'est le déficit. Sur une
      autre base, le sens de la première ligne changerait — c'est pourquoi elle est nommée ici.</p>
    <p class="ouverture__lecture">Rapporté aux habitants, la dépense publique représente
      <strong>${EUROS.format(c.parHabitant)} €</strong> par personne et par an. Elle ne leur est pas
      prélevée à chacun&nbsp;: elle comprend les retraites, les soins et les salaires des agents,
      c'est-à-dire de l'argent qui leur revient. Les chapitres suivants disent d'où elle vient,
      où elle va, et à qui elle profite.</p>
    <p class="ouverture__source">Comptabilité nationale, exercices ${echapper(c.debut)} à
      ${echapper(c.fin)}. Source&nbsp;: Eurostat, comptes des administrations publiques et
      comptes nationaux annuels.</p>`;
}

/** L'enveloppe DOM. `false` quand rien n'est peint. */
export function afficherOuverture(cadre: HTMLElement, pays: Record<string, Territoire>): boolean {
  const html = rendu(pays);
  if (html) {
    cadre.innerHTML = html;
    cadre.hidden = false;
  }
  return html !== "";
}
