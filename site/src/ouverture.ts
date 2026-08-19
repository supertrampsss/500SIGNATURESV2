/**
 * Le chapitre qui ouvre Bilan : de combien on parle, et depuis quand.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE PIÈGE DU DÉNOMINATEUR, ET POURQUOI CE MODULE LE DIT EN CLAIR
 * ─────────────────────────────────────────────────────────────────────────
 * « La dépense publique est passée de 57,7 % à 57,3 % de la richesse
 * produite » se lit comme une baisse. C'en est une du RATIO, pas de la
 * dépense : en euros elle a augmenté de 29,7 % depuis 2017, et de 5,8 % une
 * fois l'inflation retirée. Le ratio ne bouge presque pas parce que la
 * richesse a monté d'autant.
 *
 * La règle du bloc, demandée par le lecteur et tenue partout : **toute part
 * est suivie de son montant**, et toute évolution donne SES DEUX BOUTS —
 * jamais une variation seule, jamais un écart « en points » sans les deux
 * pourcentages qui le produisent.
 *
 * L'inflation retirée vient de l'indice des prix publié
 * (`eurostat_prix_ensemble`, IPCH en indice) : (valeur_fin / indice_fin) sur
 * (valeur_début / indice_début). Aucun chiffre déflaté ne s'écrit si l'indice
 * ne couvre pas les deux exercices.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA BASE EST NOMMÉE, ET COMMUNE AUX TROIS MESURES
 * ─────────────────────────────────────────────────────────────────────────
 * Depuis 1995 la part de la dépense monte, depuis 2019 aussi, depuis 2017
 * elle recule : le signe change avec la base. `REFERENCE` est donc déclarée,
 * écrite dans la page, et les recettes, la dépense et la richesse sont
 * mesurées depuis le même exercice — raconter la baisse de l'une sans la
 * baisse de l'autre est exactement ce que ce cadrage empêche.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES SIGNES
 * ─────────────────────────────────────────────────────────────────────────
 * Une recette entre : elle s'écrit +. Une dépense sort : elle s'écrit −.
 * C'est une identité de sens, pas un jugement — l'emprunt reste en encre,
 * jamais en rouge.
 */

import type { Territoire } from "./donnees.ts";
import { montantLisible } from "./echelle.ts";

// L'exercice de référence des écarts. Déclaré ici pour qu'il se voie et se
// discute, plutôt que d'être enfoui dans un calcul.
const REFERENCE = "2017";

const RECETTES = "eurostat_apu_recettes";
const DEPENSES = "eurostat_apu_depenses";
const PIB = "eurostat_pib_montant";
const PRIX = "eurostat_prix_ensemble";
const ETAT = "etat_recettes_nettes_bg";

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

/** Une variation en pourcentage, signée, une décimale : « +5,8 % ». Elle ne
 *  s'écrit jamais seule — l'appelant pose ses deux bouts à côté. */
export function variation(avant: number, apres: number): string {
  const taux = (apres / avant - 1) * 100;
  return `${taux >= 0 ? "+" : "−"}${PART.format(Math.abs(taux))} %`;
}

/** Un montant en milliards, signé selon le sens du flux. */
function milliards(valeur: number, signe: "+" | "−" | ""): string {
  return `${signe}${EUROS.format(Math.abs(valeur) / 1e9)}`;
}

export type Ouverture = {
  debut: string;
  fin: string;
  recettes: number;
  depenses: number;
  emprunte: number;
  partRecettes: number;
  partDepenses: number;
  partRecettesDebut: number;
  partDepensesDebut: number;
  /** Variations en euros constants depuis `debut`, ou null sans indice des
   *  prix couvrant les deux exercices. */
  reelDepenses: number | null;
  reelRecettes: number | null;
  reelPib: number | null;
  /** Les exercices du tableau d'évolution : début, un sur deux, fin. */
  exercices: string[];
};

/**
 * Les chiffres du chapitre, ou `null` tant que les séries ne partagent pas
 * deux exercices. Sans point de départ il n'y a pas de bilan, il y a une
 * photo.
 */
export function chiffres(france: Territoire | undefined): Ouverture | null {
  if (!france) return null;
  const serie = (id: string) => france.series[id] ?? {};
  const [r, d, p, prix] = [RECETTES, DEPENSES, PIB, PRIX].map(serie);
  const communs = Object.keys(r)
    .filter((an) => d[an] !== undefined && p[an] !== undefined)
    .sort();
  if (communs.length < 2) return null;
  const fin = communs[communs.length - 1];
  // La référence si elle est publiée, le premier exercice sinon : un module qui
  // exigerait 2017 se tairait entièrement sur une source qui commence après.
  const debut = communs.includes(REFERENCE) && REFERENCE !== fin ? REFERENCE : communs[0];

  // L'évolution en euros constants : chaque bout déflaté par l'indice des prix
  // de son exercice. Null plutôt qu'un chiffre courant déguisé en constant.
  const reel = (s: Record<string, number>): number | null =>
    prix[debut] !== undefined && prix[fin] !== undefined
      ? (s[fin] / prix[fin] / (s[debut] / prix[debut]) - 1) * 100
      : null;

  // Le tableau : le début, un exercice sur deux, et toujours la fin.
  const exercices = communs.filter(
    (an, i) => an >= debut && ((i - communs.indexOf(debut)) % 2 === 0 || an === fin),
  );

  return {
    debut,
    fin,
    recettes: r[fin],
    depenses: d[fin],
    emprunte: d[fin] - r[fin],
    partRecettes: (r[fin] / p[fin]) * 100,
    partDepenses: (d[fin] / p[fin]) * 100,
    partRecettesDebut: (r[debut] / p[debut]) * 100,
    partDepensesDebut: (d[debut] / p[debut]) * 100,
    reelDepenses: reel(d),
    reelRecettes: reel(r),
    reelPib: reel(p),
    exercices,
  };
}

/** Le chapitre, ou la chaîne vide. */
export function rendu(pays: Record<string, Territoire>): string {
  const france = pays["FR"];
  const c = chiffres(france);
  if (!c) return "";
  const r = france!.series[RECETTES];
  const d = france!.series[DEPENSES];

  // Le piège du dénominateur, écrit seulement quand l'inflation retirée est
  // calculable : sans indice des prix, la phrase se tairait plutôt que de
  // comparer des euros courants en les appelant constants.
  // La phrase du décrochage des recettes n'est écrite que tant qu'elle est
  // vraie dans les séries : le jour où les recettes suivront la richesse,
  // elle disparaîtra au lieu de mentir.
  const recettesDecrochent =
    c.reelRecettes !== null &&
    c.reelPib !== null &&
    c.reelDepenses !== null &&
    c.reelRecettes < c.reelPib &&
    c.reelRecettes < c.reelDepenses;
  const piege =
    c.reelDepenses !== null && c.reelRecettes !== null && c.reelPib !== null
      ? `<p class="ouverture__piege">On lit souvent que la dépense publique a baissé, parce que
          sa part de la richesse produite est passée de
          <strong>${PART.format(c.partDepensesDebut)} %</strong> à
          <strong>${PART.format(c.partDepenses)} %</strong>.
          <strong>C'est le ratio qui a baissé, pas la dépense</strong>&nbsp;: une fois
          l'inflation retirée, elle a augmenté de
          <strong>${echapper(`${c.reelDepenses >= 0 ? "+" : "−"}${PART.format(Math.abs(c.reelDepenses))}`)} %</strong>
          depuis ${echapper(c.debut)}, presque au rythme de la richesse
          (${echapper(`${c.reelPib >= 0 ? "+" : "−"}${PART.format(Math.abs(c.reelPib))}`)} %).
${
            recettesDecrochent
              ? `
          Ce qui a décroché, ce sont les recettes&nbsp;:
          <strong>${echapper(`${c.reelRecettes >= 0 ? "+" : "−"}${PART.format(Math.abs(c.reelRecettes))}`)} %</strong>
          seulement.`
              : ""
          }</p>`
      : "";

  const colonnes = c.exercices
    .map((an) => `<th scope="col">${echapper(an)}</th>`)
    .join("");
  const ligne = (nom: string, cellule: (an: string) => string) =>
    `<tr><th scope="row">${echapper(nom)}</th>${c.exercices
      .map((an) => `<td>${cellule(an)}</td>`)
      .join("")}</tr>`;

  // La maquette validée pose l'affirmation à gauche et sa preuve à droite :
  // les phrases dans une colonne, le tableau dans l'autre. Sous 56 rem, la
  // grille retombe en pile et l'ordre de lecture reste le même.
  return `
    <div class="chapitre__duo">
      <div>
        <p class="ouverture__phrase">En ${echapper(c.fin)}, les administrations publiques ont
          encaissé <strong class="flux--plus">+${montantLisible(c.recettes)}</strong> et dépensé
          <strong class="flux--moins">−${montantLisible(c.depenses)}</strong>. Les
          <strong>${montantLisible(c.emprunte)}</strong> manquants ont été empruntés.</p>
        ${piege}
      </div>
      <div>
        <table class="comparaison ouverture__evolution" tabindex="0">
          <thead><tr><th scope="col"></th>${colonnes}</tr></thead>
          <tbody>
            ${ligne("Recettes", (an) => `<span class="flux--plus">${milliards(r[an], "+")}</span>`)}
            ${ligne("Dépenses", (an) => `<span class="flux--moins">${milliards(d[an], "−")}</span>`)}
            ${ligne("Emprunté", (an) => `<strong>${milliards(d[an] - r[an], "−")}</strong>`)}
          </tbody>
        </table>
      </div>
    </div>
    <p class="ouverture__source">Milliards d'euros courants, exercices ${echapper(c.debut)} à
      ${echapper(c.fin)}. Source&nbsp;: Eurostat.</p>`;
}

/**
 * Le pont des périmètres, en tête du chapitre 2.
 *
 * 1 562 milliards encaissés au chapitre 1, 380 ici : sans cette phrase, les
 * deux chiffres se lisaient comme une contradiction — c'est le premier
 * reproche du lecteur sur la maquette. Elle vivait sous « Le chapitre suivant
 * descend d'un étage. », une amorce qui n'a plus de sens une fois posée EN
 * TÊTE du chapitre suivant plutôt qu'à la fin du précédent. La chaîne vide
 * tant que les deux séries ne partagent pas l'exercice.
 */
export function pont(pays: Record<string, Territoire>): string {
  const france = pays["FR"];
  const c = chiffres(france);
  const etat = france?.series[ETAT]?.[c?.fin ?? ""];
  if (!c || etat === undefined) return "";
  return `Sur ${montantLisible(c.recettes)} encaissés par l'ensemble des administrations
    publiques, le budget de l'État en encaisse <strong>${montantLisible(etat)}</strong> en
    propre. Le reste est encaissé directement par la Sécurité sociale (les cotisations sur les
    salaires), les collectivités (impôts locaux) et les autres organismes publics.`;
}

/** L'enveloppe DOM. `false` quand rien n'est peint. Le pont est rempli ici
 *  aussi : le même peintre a les deux séries sous la main. */
export function afficherOuverture(cadre: HTMLElement, pays: Record<string, Territoire>): boolean {
  const html = rendu(pays);
  if (html) {
    cadre.innerHTML = html;
    cadre.hidden = false;
    const cible = document.getElementById("pont-perimetre");
    const phrase = pont(pays);
    if (cible && phrase) {
      cible.innerHTML = phrase;
      cible.hidden = false;
    }
  }
  return html !== "";
}
