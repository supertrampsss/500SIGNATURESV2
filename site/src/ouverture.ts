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
import { graphiqueEcart } from "./dataviz.ts";
import { montantLisible } from "./echelle.ts";

// L'exercice de référence des écarts. Déclaré ici pour qu'il se voie et se
// discute, plutôt que d'être enfoui dans un calcul.
const REFERENCE = "2017";
const DEBUT_HISTORIQUE = "2000";

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
  /** Les exercices publiés du tableau historique, depuis 2000 quand possible. */
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

  // L'historique ne reprend pas la base narrative : 2017→2025 ne couvre que
  // neuf exercices. Il remonte donc à 2000 dès que les séries le permettent.
  const debutHistorique = communs.find((an) => an >= DEBUT_HISTORIQUE) ?? communs[0];
  const exercices = communs.filter((an) => an >= debutHistorique);

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
  const graphique = graphiqueEcart({
    titre: "Les dépenses restent au-dessus des recettes",
    unite: "Milliards d'euros courants",
    description: `Recettes et dépenses publiques de ${c.exercices[0]} à ${c.fin}, en milliards d'euros.`,
    points: c.exercices.map((periode) => ({
      periode,
      haut: d[periode] / 1e9,
      bas: r[periode] / 1e9,
    })),
    noms: ["Dépenses", "Recettes"],
    formater: (valeur) => `${EUROS.format(valeur)} Md€`,
  });

  // La maquette validée pose l'affirmation à gauche et sa preuve à droite :
  // les phrases dans une colonne, le tableau dans l'autre. Sous 56 rem, la
  // grille retombe en pile et l'ordre de lecture reste le même.
  return `
    ${graphique}
    <p class="chart-source">Milliards d'euros courants · ${echapper(c.exercices[0]!)} à ${echapper(c.fin)} · Eurostat</p>

  `;
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
  return `L'État conserve <strong>${montantLisible(etat)}</strong> sur les ${montantLisible(c.recettes)}
    de recettes publiques. Le reste revient à la Sécurité sociale, aux collectivités et aux autres organismes publics.`;
}

/** L'enveloppe DOM. `false` quand rien n'est peint. Le pont est rempli ici :
 *  le même peintre porte les séries de ses deux périmètres. */
export function afficherOuverture(cadre: HTMLElement, pays: Record<string, Territoire>): boolean {
  const html = rendu(pays);
  if (html) {
    cadre.innerHTML = html;
    cadre.hidden = false;
    const perimetre = document.getElementById("pont-perimetre");
    const corps = pont(pays);
    if (perimetre && corps) {
      perimetre.innerHTML = corps;
      perimetre.hidden = false;
    }
  }
  return html !== "";
}
