/**
 * « Est-ce beaucoup ? » — un chiffre seul ne répond pas.
 *
 * Une commune qui dépense 871 € par habitant ne dit rien tant qu'on ne sait pas
 * ce que dépensent les autres. Ce module fournit les deux repères qui manquaient :
 * l'ensemble des communes de la région, puis l'ensemble des communes de France.
 *
 * **La région de référence n'est pas le conseil régional.** Rapporter une
 * commune au budget de sa région comparerait deux collectivités qui n'exercent
 * pas les mêmes compétences. Le repère est l'agrégat des communes de cette
 * région — et le libellé le dit, sans quoi la confusion est garantie.
 *
 * **Deux natures de repère, parce que deux natures de grandeur.** Un montant
 * qui s'additionne donne un rapport agrégé : somme des montants sur somme des
 * populations, c'est-à-dire la dépense par habitant de l'ensemble. Une moyenne
 * des valeurs communales, elle, donnerait à Rochefourchat (une habitante) le
 * même poids qu'à Paris. Un taux ou une médiane ne s'additionne pas du tout :
 * le repère est alors la médiane des territoires, et l'écart ne se lit pas de
 * la même façon.
 */

export type Agregat = {
  n: number;
  mediane: number;
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

export type Repere = { libelle: string; valeur: number; nature: string };

/** La valeur d'un agrégat, ramenée ou non à l'habitant comme la valeur affichée. */
export function valeurDe(agregat: Agregat, nature: string, parHabitant: boolean): number | null {
  if (nature === "agregat" && agregat.total !== undefined && agregat.habitants) {
    return parHabitant ? agregat.total / agregat.habitants : agregat.total;
  }
  // Une médiane ne se divise pas : c'est déjà une valeur par territoire.
  return nature === "mediane" ? agregat.mediane : null;
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
    const valeur = bloc && valeurDe(bloc, nature, parHabitant);
    if (valeur !== null && valeur !== undefined) {
      sortie.push({ libelle: `${ensemble} de la région`, valeur, nature });
    }
  }
  const france = valeurDe(reference.france, nature, parHabitant);
  if (france !== null) sortie.push({ libelle: `${ensemble} de France`, valeur: france, nature });
  return sortie;
}

/** De quoi le repère est-il l'agrégat ? Le dire évite de laisser croire qu'on
 *  compare une commune au budget de sa région. */
const ENSEMBLES: Record<string, string> = {
  commune: "Communes",
  epci: "Intercommunalités",
  departement: "Départements",
  region: "Régions",
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
  const nature = liste[0].nature;
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
      return `<li><span>${echapper(r.libelle)}</span>
        <span>${echapper(formater(r.valeur))}${chiffre}</span></li>`;
    })
    .join("");
  const note =
    nature === "agregat"
      ? "Rapport de l'ensemble : total des montants sur total des habitants."
      : "Médiane des territoires : ces valeurs ne s'additionnent pas.";
  return `<ul class="reperes">${lignes}</ul>
    <p class="reperes__note">${note}</p>`;
}
