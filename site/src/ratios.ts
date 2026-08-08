/**
 * Six ratios pour lire les comptes d'une collectivité comme un créancier.
 *
 * Le panneau montrait des montants : 47 millions de dépenses de fonctionnement,
 * 62 millions d'encours de dette. Ces nombres ne disent rien seuls — ils disent
 * la taille de la collectivité, pas sa situation. Un créancier ne lit jamais un
 * montant sans son dénominateur : il regarde ce que la collectivité dégage
 * rapporté à ce qu'elle encaisse, et sa dette rapportée à ce qu'elle dégage.
 * Ce sont ces rapports-là, et non les masses, qui répondent à « est-ce que ça
 * tient ».
 *
 * Trois règles tiennent l'honnêteté du bloc.
 *
 * **Un seul exercice.** Tous les ratios sont calculés sur la même année. Une
 * dette de 2024 divisée par une épargne de 2022 donnerait un nombre d'années
 * qui n'a jamais existé. Un ratio dont un seul terme manque pour cet exercice
 * n'est pas calculé sur l'année d'à côté : il n'est pas affiché.
 *
 * **Une épargne brute négative n'est pas un très grand nombre d'années.** Quand
 * la collectivité ne dégage rien, le quotient n'est pas « mauvais », il n'a pas
 * de valeur : c'est une division par une grandeur nulle ou négative. Le bloc
 * l'écrit en toutes lettres plutôt que d'afficher un ratio négatif, qui se
 * lirait comme une dette remboursée en moins quatre ans.
 *
 * **Un seuil ne s'invente pas.** Le seul repère chiffré du bloc est celui que
 * la loi écrit : le plafond national de référence de la capacité de
 * désendettement (loi n° 2018-32 du 22 janvier 2018 de programmation des
 * finances publiques pour 2018-2022, art. 29). Les autres ratios n'ont pas de
 * norme publiée ; ils se lisent contre les autres territoires, ce que la fiche
 * fait déjà, et le bloc ne prétend pas trancher à leur place.
 */

import type { Territoire } from "./donnees.ts";

const RECETTES = "ofgl_recettes_fonctionnement";
const EPARGNE = "ofgl_epargne_brute";
const ENCOURS = "ofgl_encours_dette";
const PERSONNEL = "ofgl_frais_personnel";
const ANNUITE = "ofgl_annuite_de_la_dette";
const EQUIPEMENT = "ofgl_depenses_d_equipement";
const DGF = "ofgl_dotation_globale_de_fonctionnement";
const POPULATION = "ofgl_population_reference";

/**
 * Plafond national de référence de la capacité de désendettement, en années.
 *
 * Loi n° 2018-32 du 22 janvier 2018 de programmation des finances publiques
 * pour les années 2018 à 2022, art. 29 : douze années pour les communes et les
 * établissements publics de coopération intercommunale à fiscalité propre, dix
 * pour les départements et la métropole de Lyon, neuf pour les régions, la
 * collectivité de Corse et les collectivités territoriales de Guyane et de
 * Martinique.
 */
const PLAFOND: Record<string, number> = {
  commune: 12,
  departement: 10,
  region: 9,
};

export type Ratio = {
  cle: string;
  libelle: string;
  /** Absente quand le ratio n'a pas de valeur : c'est alors `impossible` qui
   *  dit pourquoi. Les deux ne coexistent jamais. */
  valeur?: number;
  unite: "percent" | "annees" | "euro_par_habitant";
  lecture: string;
  impossible?: string;
  /** Le plafond légal, pour le seul ratio qui en a un. */
  plafond?: number;
};

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/**
 * Le dernier exercice où les comptes sont là.
 *
 * Les recettes de fonctionnement font le dénominateur de quatre ratios sur
 * six : sans elles, il n'y a pas de panneau. C'est donc leur dernière année
 * publiée qui fixe l'exercice, et les autres grandeurs sont lues sur celle-là
 * ou pas du tout.
 */
export function exerciceDesComptes(territoire: Territoire): string | null {
  const annees = Object.keys(territoire.series?.[RECETTES] ?? {});
  return annees.length ? annees.sort()[annees.length - 1] : null;
}

function valeur(territoire: Territoire, id: string, exercice: string): number | undefined {
  const v = territoire.series?.[id]?.[exercice];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Les six ratios, sur un exercice unique. Ceux dont un terme manque sont
 *  absents de la liste — jamais calculés sur l'année d'à côté. */
export function ratios(territoire: Territoire, niveau: string, exercice: string): Ratio[] {
  const lu = (id: string) => valeur(territoire, id, exercice);
  const recettes = lu(RECETTES);
  const epargne = lu(EPARGNE);
  const encours = lu(ENCOURS);
  const liste: Ratio[] = [];

  if (recettes !== undefined && recettes > 0 && epargne !== undefined) {
    liste.push({
      cle: "epargne",
      libelle: "Taux d'épargne brute",
      valeur: (epargne / recettes) * 100,
      unite: "percent",
      lecture:
        "Ce qui reste des recettes une fois les charges courantes payées. C'est de là que viennent l'investissement et le remboursement de la dette.",
    });
  }

  if (encours !== undefined) {
    // Une épargne brute nulle ou négative ne rembourse rien : le quotient n'est
    // pas grand, il n'existe pas. L'écrire en années donnerait un nombre
    // négatif, qui se lirait comme une dette éteinte avant d'être contractée.
    liste.push(
      epargne !== undefined && epargne > 0
        ? {
            cle: "desendettement",
            libelle: "Capacité de désendettement",
            valeur: encours / epargne,
            unite: "annees",
            lecture:
              "Le nombre d'années d'épargne qu'il faudrait pour rembourser toute la dette, à épargne inchangée et sans nouvel emprunt.",
            plafond: PLAFOND[niveau],
          }
        : {
            cle: "desendettement",
            libelle: "Capacité de désendettement",
            unite: "annees",
            lecture:
              "Le nombre d'années d'épargne qu'il faudrait pour rembourser toute la dette, à épargne inchangée et sans nouvel emprunt.",
            impossible:
              epargne === undefined
                ? "L'épargne brute n'est pas publiée pour cet exercice."
                : "L'épargne brute est nulle ou négative : cet exercice ne dégage rien pour rembourser, et le ratio n'a pas de valeur.",
            plafond: PLAFOND[niveau],
          },
    );
  }

  const habitants = lu(POPULATION);
  if (encours !== undefined && habitants !== undefined && habitants > 0) {
    liste.push({
      cle: "dette_habitant",
      libelle: "Dette par habitant",
      valeur: encours / habitants,
      unite: "euro_par_habitant",
      lecture:
        "L'encours rapporté à la population de référence des ratios officiels, pas à la population municipale du recensement.",
    });
  }

  const personnel = lu(PERSONNEL);
  const annuite = lu(ANNUITE);
  if (
    recettes !== undefined && recettes > 0 &&
    personnel !== undefined && annuite !== undefined
  ) {
    liste.push({
      cle: "rigidite",
      libelle: "Charges déjà engagées",
      valeur: ((personnel + annuite) / recettes) * 100,
      unite: "percent",
      lecture:
        "Sur 100 € de recettes, ce qui part déjà en salaires et en remboursement de la dette. Plus c'est haut, moins la commune a les mains libres.",
    });
  }

  const equipement = lu(EQUIPEMENT);
  if (recettes !== undefined && recettes > 0 && equipement !== undefined) {
    liste.push({
      cle: "equipement",
      libelle: "Effort d'équipement",
      valeur: (equipement / recettes) * 100,
      unite: "percent",
      lecture:
        "Les dépenses d'équipement rapportées aux recettes. L'investissement se fait par à-coups : une année ne décrit pas une politique.",
    });
  }

  const dgf = lu(DGF);
  if (recettes !== undefined && recettes > 0 && dgf !== undefined) {
    liste.push({
      cle: "dgf",
      libelle: "Part de la DGF",
      valeur: (dgf / recettes) * 100,
      unite: "percent",
      lecture:
        "La part des recettes versée par l'État au titre de la dotation globale de fonctionnement. Les autres dotations sont comptées ailleurs.",
    });
  }

  return liste;
}

/** Le mouvement d'un rapport, dans l'unité où il se lit : des points pour un
 *  taux (un taux qui passe de 10 à 12 % ne « monte pas de 20 % »), des années,
 *  des euros. `null` quand l'écart s'arrondit à rien : « +0,0 pt » est du bruit. */
function deltaTexte(delta: number, unite: Ratio["unite"]): string | null {
  const nombre = (v: number, d: number) =>
    new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })
      .format(Math.abs(v));
  const signe = delta >= 0 ? "+" : "−";
  if (unite === "percent") {
    if (Math.abs(delta) < 0.05) return null;
    return `${signe}${nombre(delta, 1)} pt`;
  }
  if (unite === "annees") {
    if (Math.abs(delta) < 0.05) return null;
    return `${signe}${nombre(delta, 1)} ${Math.abs(delta) >= 2 ? "ans" : "an"}`;
  }
  if (Math.abs(delta) < 0.5) return null;
  return `${signe}${nombre(delta, 0)} €`;
}

function formaterRatio(ratio: Ratio): string {
  if (ratio.valeur === undefined) return "—";
  const nombre = (valeur: number, decimales: number) =>
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    })
      .format(valeur)
      .replace("-", "−");
  if (ratio.unite === "percent") return `${nombre(ratio.valeur, 1)} %`;
  if (ratio.unite === "annees") {
    const annees = nombre(ratio.valeur, 1);
    return `${annees} ${ratio.valeur >= 2 ? "ans" : "an"}`;
  }
  return `${nombre(ratio.valeur, 0)} €`;
}

/**
 * Rendu pur, sans DOM : c'est lui qui est testé.
 *
 * Le bloc ne s'affiche pas quand il n'y a rien à rapporter à rien. Deux ratios
 * sont le minimum : un seul carreau ne serait pas une lecture des comptes, ce
 * serait un chiffre de plus au-dessus de ceux qui suivent.
 */
export function rendu(territoire: Territoire, niveau: string): string {
  const exercice = exerciceDesComptes(territoire);
  if (!exercice) return "";
  const liste = ratios(territoire, niveau, exercice);
  if (liste.length < 2) return "";

  // L'exercice d'avant, pour dire le mouvement de chaque rapport : un taux
  // d'épargne à 11,5 % ne se lit pas pareil s'il en perd deux points par an.
  const annees = Object.keys(territoire.series?.[RECETTES] ?? {})
    .filter((a) => a < exercice)
    .sort();
  const precedent = annees.length ? annees[annees.length - 1] : null;
  const anciens = new Map(
    (precedent ? ratios(territoire, niveau, precedent) : []).map((r) => [r.cle, r]),
  );

  const carreaux = liste
    .map((ratio) => {
      const ancien = anciens.get(ratio.cle);
      const evolution =
        precedent && ratio.valeur !== undefined && ancien?.valeur !== undefined
          ? deltaTexte(ratio.valeur - ancien.valeur, ratio.unite)
          : null;
      const mouvement = evolution
        ? `<p class="ratios__evolution">${echapper(`${evolution} vs ${precedent}`)}</p>`
        : "";
      // Le plafond se dit sous le chiffre, et il se dit même quand le ratio
      // n'a pas pu être calculé : c'est le repère qui manque le plus là où
      // l'épargne est négative.
      const repere =
        ratio.plafond === undefined
          ? ""
          : `<p class="ratios__plafond">Plafond national de référence : ${ratio.plafond} ans</p>`;
      const corps = ratio.impossible
        ? `<p class="ratios__impossible">${echapper(ratio.impossible)}</p>`
        : `<p class="ratios__valeur">${echapper(formaterRatio(ratio))}</p>`;
      return `<div class="ratios__carreau" data-ratio="${echapper(ratio.cle)}">
        <h4>${echapper(ratio.libelle)}</h4>
        ${corps}
        ${mouvement}
        ${repere}
        <p class="ratios__lecture">${echapper(ratio.lecture)}</p>
      </div>`;
    })
    .join("");

  return `<section class="ratios">
    <h3>Les comptes en ${liste.length} rapports <span class="ratios__exercice">exercice ${echapper(
      exercice,
    )}</span></h3>
    <div class="ratios__grille">${carreaux}</div>
  </section>`;
}
