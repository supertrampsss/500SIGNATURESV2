/**
 * Le tableau des exercices, sous le dernier bloc.
 *
 * Les quatre blocs posent deux millésimes : celui d'où l'on part et celui où
 * l'on arrive. Ce qui s'est passé entre les deux n'existait nulle part sur la
 * fiche — ni la marche d'escalier de 2022, ni le creux de 2020, ni le fait
 * qu'une hausse « depuis 2019 » soit en réalité arrivée d'un coup.
 *
 * Trois règles tiennent le module.
 *
 * **Les lignes sont celles des blocs, dans leur ordre.** Le tableau ne choisit
 * pas ses agrégats : il reprend exactement ce que les blocs ont cité, agrégats
 * et postes confondus. Un chiffre qui n'a pas été dit au-dessus n'apparaît pas
 * ici, et un chiffre dit au-dessus se retrouve toujours ici avec ses années.
 *
 * **Une colonne par exercice publié, à partir de 2019.** C'est la fenêtre du
 * site, lue sur les exercices et jamais sur un calendrier électoral.
 *
 * **Les montants sont en millions d'euros, et le sigle est dans la légende.**
 * Répété quatre-vingts fois dans une grille de chiffres, il n'ajoute rien et
 * empêche les colonnes de s'aligner.
 *
 * **Une colonne d'évolution ferme le tableau.** Sept colonnes de montants ne
 * disent pas ce qui a bougé : l'œil compare mal 6 526 à 7 795, et c'est
 * pourtant la seule question qu'on pose à une série. Elle se lit du premier au
 * dernier exercice **où la ligne publie quelque chose**, pas du premier au
 * dernier du tableau : une ligne qui commence en 2021 dirait sinon une
 * évolution depuis un vide.
 *
 * **Le poste se dit en français, le terme comptable reste dans l'infobulle**,
 * exactement comme dans les blocs. Un tableau qui dirait « Dépenses
 * d'intervention » sous un bloc qui vient d'écrire « les aides et subventions
 * versées » ferait deux noms pour une ligne.
 */

import type { Indicateur } from "./donnees.ts";
import { millions } from "./echelle.ts";
import { accentuer } from "./traductions.ts";

/** Premier exercice de la fenêtre du site. */
export const PREMIER_EXERCICE = "2019";

/**
 * Le vocabulaire affiché, en intitulés de colonne.
 *
 * `blocs.ts` porte les mêmes postes sous forme de groupe nominal — « les
 * salaires de ses agents » — parce qu'ils entrent dans une phrase. Ici ils
 * intitulent une ligne : ni article, ni possessif. Le libellé du catalogue
 * reste, sous le curseur, dans l'infobulle.
 */
const AFFICHES: Record<string, string> = {
  ofgl_frais_personnel: "Salaires des agents",
  ofgl_achats_et_charges_externes: "Achats, énergie, prestataires",
  ofgl_depenses_d_intervention: "Aides et subventions versées",
  ofgl_charges_financieres: "Intérêts de la dette",
  ofgl_impots_locaux: "Taxe foncière et impôts des entreprises",
  ofgl_concours_de_l_etat: "Ce que l'État lui verse",
  ofgl_dotation_globale_de_fonctionnement: "Dotation principale de l'État",
  ofgl_ventes_de_biens_et_services: "Ce que paient les usagers des services",
  ofgl_depenses_d_investissement_hors_remb: "Dépenses d'investissement",
  ofgl_depenses_totales_hors_remb: "Dépenses totales",
};

export type Tableau = {
  /** Les exercices publiés pour au moins une ligne, croissants. */
  exercices: string[];
  lignes: {
    id: string;
    /** Ce que la ligne dit : le français des blocs. */
    libelle: string;
    /** Le libellé du fichier publié, quand il diffère : il va dans l'infobulle. */
    terme: string;
    valeurs: (number | null)[];
    /** Du premier au dernier exercice publié de la ligne. `null` s'il n'y en a
     *  qu'un, ou si le départ est nul — on ne divise pas par zéro. */
    evolution: Evolution | null;
  }[];
};

export type Evolution = {
  /** Variation relative, en pourcentage. */
  pourcentage: number;
  /** Variation absolue, dans l'unité de la ligne. */
  ecart: number;
  /** Les deux millésimes réellement comparés. */
  de: string;
  a: string;
};

export type Entree = {
  /** Les identifiants cités par les blocs, dans leur ordre d'apparition. */
  cites: string[];
  series: Record<string, Record<string, number>>;
  catalogue: Indicateur[];
};

/**
 * Le tableau, ou `null` s'il n'y a rien à montrer.
 *
 * Rien à montrer, c'est : aucune ligne, ou une seule colonne. Une valeur unique
 * ne s'analyse pas, et un tableau à une colonne redirait le bloc qui le
 * précède.
 */
export function exercices(entree: Entree): Tableau | null {
  const libelles = new Map(entree.catalogue.map((i) => [i.id, accentuer(i.libelle)]));
  // Dédoublonné en gardant l'ordre : un poste peut être cité par deux blocs.
  const ids = [...new Set(entree.cites)].filter((id) => entree.series[id]);
  const annees = new Set<string>();
  for (const id of ids) {
    for (const annee of Object.keys(entree.series[id])) {
      if (annee >= PREMIER_EXERCICE) annees.add(annee);
    }
  }
  const colonnes = [...annees].sort();
  if (!ids.length || colonnes.length < 2) return null;
  return {
    exercices: colonnes,
    lignes: ids.map((id) => {
      const publie = libelles.get(id) ?? id;
      const affiche = AFFICHES[id] ?? publie;
      const valeurs = colonnes.map((annee) => entree.series[id][annee] ?? null);
      return {
        id,
        libelle: affiche,
        terme: affiche === publie ? "" : publie,
        valeurs,
        evolution: evolutionDe(valeurs, colonnes),
      };
    }),
  };
}

/**
 * Du premier au dernier exercice publié de la ligne.
 *
 * Un départ nul n'a pas d'évolution relative : « de 0 à 120 » n'est pas
 * « +∞ % », c'est une apparition, et la colonne se tait.
 */
function evolutionDe(valeurs: (number | null)[], colonnes: string[]): Evolution | null {
  const publies = valeurs
    .map((v, i) => [v, i] as const)
    .filter((paire): paire is readonly [number, number] => paire[0] !== null);
  if (publies.length < 2) return null;
  const [depart, iDepart] = publies[0]!;
  const [arrivee, iArrivee] = publies[publies.length - 1]!;
  if (depart === 0) return null;
  return {
    pourcentage: ((arrivee - depart) / Math.abs(depart)) * 100,
    ecart: arrivee - depart,
    de: colonnes[iDepart]!,
    a: colonnes[iArrivee]!,
  };
}

/** Un montant en millions, sans son sigle : la légende le porte une fois. */
function sansSigle(valeur: number): string {
  return millions(valeur).replace(/\s*M€$/u, "");
}

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

const POURCENT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** Le signe du site, jamais le trait d'union du formateur. */
function signe(valeur: number, texte: string): string {
  return `${valeur > 0 ? "+" : ""}${texte.replace("-", "\u2212")}`;
}

function rendreEvolution(evolution: Evolution | null, premier: string, dernier: string): string {
  if (!evolution) return `<td class="tableau-exercices__evo"></td>`;
  // Une ligne qui ne couvre pas toute la fenêtre le dit : « +19,5 % » sous un
  // en-tête « 2019 → 2025 » serait faux si la ligne commence en 2021.
  const partielle = evolution.de !== premier || evolution.a !== dernier;
  return `<td class="tableau-exercices__evo"${
    partielle ? ` title="Sur les exercices publiés de cette ligne : ${evolution.de} à ${evolution.a}"` : ""
  }>
    <b>${signe(evolution.pourcentage, POURCENT.format(evolution.pourcentage))} %</b>
    <span>${signe(evolution.ecart, sansSigle(evolution.ecart))}</span>${
      partielle ? `<em>${evolution.de}\u2009\u2192\u2009${evolution.a}</em>` : ""
    }
  </td>`;
}

export function rendreExercices(tableau: Tableau | null): string {
  if (!tableau) return "";
  const premier = tableau.exercices[0]!;
  const dernier = tableau.exercices[tableau.exercices.length - 1]!;
  const entetes = tableau.exercices.map((a) => `<th scope="col">${a}</th>`).join("");
  const corps = tableau.lignes
    .map(
      ({ libelle, terme, valeurs, evolution }) => `<tr><th scope="row">${
        terme
          ? `<abbr title="${echapper(terme)} (libellé du fichier publié)">${echapper(libelle)}</abbr>`
          : echapper(libelle)
      }</th>${valeurs
        .map((v) => `<td>${v === null ? "" : sansSigle(v)}</td>`)
        .join("")}${rendreEvolution(evolution, premier, dernier)}</tr>`,
    )
    .join("");
  return `<section class="bloc-lecture bloc-lecture--tableau">
    <h3>Les exercices publiés</h3>
    <div class="tableau-exercices">
      <table>
        <caption>Montants en millions d'euros. Une colonne vide : l'agrégat n'est pas publié cet exercice-là.</caption>
        <thead><tr><th scope="col"></th>${entetes}<th scope="col" class="tableau-exercices__evo">${premier}\u2009\u2192\u2009${dernier}</th></tr></thead>
        <tbody>${corps}</tbody>
      </table>
    </div>
  </section>`;
}
