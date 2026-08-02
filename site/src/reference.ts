/**
 * « Est-ce beaucoup ? » — un chiffre seul ne répond pas.
 *
 * Une commune qui dépense 871 € par habitant ne dit rien tant qu'on ne sait pas
 * ce que dépensent les autres. Ce module fournit les deux repères qui
 * manquaient : les communes de la même région, puis celles de toute la France.
 *
 * **La région de référence n'est pas le conseil régional.** Rapporter une
 * commune au budget de sa région comparerait deux collectivités qui n'exercent
 * pas les mêmes compétences. Le repère est l'ensemble des communes de cette
 * région — et le libellé le dit, sans quoi la confusion est garantie.
 *
 * **Le repère est la médiane, pas le rapport agrégé.** Les deux sont publiés et
 * les deux sont exacts, mais ils répondent à des questions différentes.
 * L'ensemble des communes de France dépense 1 246 € par habitant — un rapport
 * écrasé par les grandes villes — quand la commune médiane en dépense 749.
 * Afficher 1 246 face à une commune à 871 € lui dirait qu'elle dépense peu,
 * alors qu'elle dépense plus que la moitié des communes françaises. La question
 * posée est « plus que les autres ? » : c'est la médiane qui y répond.
 *
 * **Et la médiane du bon dénominateur.** Médiane des montants bruts et médiane
 * des montants par habitant sont deux grandeurs, pas deux présentations : les
 * confondre met 328 659 € en face de 871 €.
 */
export type Agregat = {
  n: number;
  /** Médiane des montants bruts. */
  mediane: number;
  /** Médiane des montants ramenés à l'habitant : une autre grandeur, pas une
   *  variante de présentation. Confondre les deux met 328 659 € en face de
   *  871 €. Absent quand aucune population n'est connue. */
  mediane_habitant?: number;
  total?: number;
  habitants?: number;
};

export type Reference = {
  nature: "agregat" | "mediane";
  france: Agregat;
  regions: Record<string, Agregat>;
};

/** references.json : indicateur -> période -> niveau -> Reference */
export type References = Record<string, Record<string, Record<string, Reference>>>;

export type Repere = { libelle: string; valeur: number; nature: string; n: number };

/** En dessous de deux territoires, un « repère » est le territoire lui-même.
 *
 *  Douze indicateurs nationaux ne portent que sur la France : leur repère
 *  « Pays comparés » valait la valeur de la France, écart +0 %. Une tautologie
 *  déguisée en comparaison — la même que celle écartée pour les régions. */
const MINIMUM_COMPARABLE = 2;

/**
 * Le repère d'un territoire est la **médiane** de ses semblables.
 *
 * « Ma commune dépense-t-elle plus que les autres ? » se répond par la médiane,
 * pas par le rapport agrégé. Les deux sont publiés et les deux sont vrais, mais
 * ils répondent à des questions différentes : l'ensemble des communes de France
 * dépense 1 246 € par habitant — un chiffre écrasé par les grandes villes —
 * quand la commune médiane en dépense 749. Afficher 1 246 face à une commune à
 * 871 € lui dirait qu'elle dépense peu, alors qu'elle dépense plus que la
 * moitié des communes françaises.
 */
export function valeurDe(agregat: Agregat, nature: string, parHabitant: boolean): number | null {
  if (!parHabitant) return agregat.mediane ?? null;
  if (agregat.mediane_habitant !== undefined) return agregat.mediane_habitant;
  // Ici `mediane_habitant` manque, et `nature` dit s'il s'agit d'une absence
  // normale ou d'une publication trop ancienne.
  //
  // - `mediane` : un taux, une médiane de revenus. « Par habitant » n'existe
  //   pas pour eux, la médiane brute EST le repère.
  // - `agregat` : un montant divisible dont la médiane par habitant devrait
  //   exister. Une publication antérieure à ce champ n'en a pas — et servir la
  //   médiane des montants bruts mettrait 328 659 € en face de 871 €. Mieux
  //   vaut aucun repère qu'un repère faux.
  return nature === "mediane" ? (agregat.mediane ?? null) : null;
}

/** Le rapport agrégé : ce que coûte l'échelon entier, rapporté à sa population.
 *  Publié et documenté, mais ce n'est pas un repère de comparaison. */
export function rapportAgrege(agregat: Agregat): number | null {
  return agregat.total !== undefined && agregat.habitants
    ? agregat.total / agregat.habitants
    : null;
}

/**
 * Les repères applicables à un territoire, du plus proche au plus large.
 *
 * Un territoire n'est jamais son propre repère : comparer la France à la France
 * n'apprend rien, et afficher « région : 812 € » sur la fiche de la région
 * elle-même serait une tautologie déguisée en comparaison.
 */
export function reperes(
  reference: Reference | undefined,
  niveau: string,
  region: string | null,
  parHabitant: boolean,
): Repere[] {
  if (!reference) return [];
  const nature = reference.nature;
  const ensemble = ENSEMBLES[niveau] ?? "territoires";
  const sortie: Repere[] = [];
  if (niveau !== "region" && region) {
    const bloc = reference.regions[region];
    const valeur = bloc && bloc.n >= MINIMUM_COMPARABLE ? valeurDe(bloc, nature, parHabitant) : null;
    if (valeur !== null && valeur !== undefined) {
      sortie.push({ libelle: `${ensemble} de la région`, valeur, nature, n: bloc.n });
    }
  }
  const ensemblier =
    reference.france.n >= MINIMUM_COMPARABLE ? valeurDe(reference.france, nature, parHabitant) : null;
  if (ensemblier !== null) {
    // « Pays de France » n'aurait aucun sens : au niveau national, l'ensemble
    // de référence est celui des pays comparés, sur les définitions
    // harmonisées d'Eurostat — les seules qui rendent la comparaison honnête.
    const libelle = niveau === "pays" ? "Pays comparés" : `${ensemble} de France`;
    sortie.push({ libelle, valeur: ensemblier, nature, n: reference.france.n });
  }
  return sortie;
}

/** De quoi le repère est-il l'agrégat ? Le dire évite de laisser croire qu'on
 *  compare une commune au budget de sa région. */
const ENSEMBLES: Record<string, string> = {
  commune: "Communes",
  epci: "Intercommunalités",
  departement: "Départements",
  region: "Régions",
  pays: "Pays",
};

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/**
 * Rendu pur, sans DOM : c'est lui qui est testé.
 * `formater` vient de l'appelant, qui seul connaît l'unité de l'indicateur.
 */
export function rendu(
  liste: Repere[],
  valeur: number,
  formater: (v: number) => string,
): string {
  if (!liste.length) return "";
  const lignes = liste
    .map((r) => {
      const ecart = r.valeur ? ((valeur - r.valeur) / Math.abs(r.valeur)) * 100 : null;
      const signe = ecart !== null && ecart >= 0 ? "+" : "";
      const chiffre =
        ecart === null
          ? ""
          : ` <span class="repere__ecart">${signe}${new Intl.NumberFormat("fr-FR", {
              maximumFractionDigits: 0,
            }).format(ecart)} %</span>`;
      // Le nombre de territoires dit ce que vaut le repère : une médiane sur
      // 31 pays et une médiane sur 3 ne se lisent pas de la même façon.
      return `<li><span>${echapper(r.libelle)} <span class="repere__n">(${r.n})</span></span>
        <span>${echapper(formater(r.valeur))}${chiffre}</span></li>`;
    })
    .join("");
  // Pas de note ici : répétée sous chacun des sept indicateurs d'une fiche,
  // elle devient du bruit. Elle est dite une fois, dans le panneau de
  // comparabilité, avec les autres réserves de lecture.
  return `<ul class="reperes">${lignes}</ul>`;
}
