/**
 * « Ma feuille d'impôts » : à qui va chaque euro d'un avis de taxe foncière.
 *
 * C'est le seul chiffre du site dont le lecteur possède déjà sa propre version,
 * imprimée sur son avis d'imposition. Le bloc ne lui apprend donc pas ce qu'il
 * paie : il lui apprend **qui l'encaisse**, dans sa commune et nulle part
 * ailleurs. La ventilation se calcule commune par commune parce qu'elle varie
 * du simple au triple d'une commune à l'autre : à Bordeaux les ordures
 * ménagères pèsent 13 % de l'avis, à Mayotte 44 %. Une moyenne nationale
 * mentirait à presque tout le monde.
 *
 * Les cinq bénéficiaires réunis font l'avis entier — c'est ce qui autorise le
 * rapport à 1 000 €. Si l'un des cinq manque au millésime le plus récent, le
 * dénominateur serait amputé sans que rien ne le signale à l'écran : on recule
 * d'un an, et si aucun millésime n'est complet, le bloc ne s'affiche pas.
 *
 * Périmètre : la taxe foncière sur les **propriétés bâties** seule. Le non
 * bâti, la taxe d'habitation sur les résidences secondaires et la cotisation
 * foncière des entreprises sont d'autres avis.
 */

import type { Territoire } from "./donnees.ts";
import { echapper } from "./texte.ts";
import { formater } from "./echelle.ts";

/** Les cinq bénéficiaires d'un avis de taxe foncière bâtie, et le nom que
 *  chacun porte pour qui reçoit l'avis. L'ordre sert de départage : à part
 *  strictement égale, c'est celui-ci qui tranche. */
export const BENEFICIAIRES = [
  ["dgfip_produit_foncier_bati", "La commune"],
  ["dgfip_taxe_fonciere_intercommunalite", "L'intercommunalité"],
  ["dgfip_taxe_fonciere_ordures_menageres", "Les ordures ménagères"],
  ["dgfip_taxe_fonciere_frais_etat", "Les frais de gestion de l'État"],
  ["dgfip_taxe_fonciere_taxes_annexes", "Les syndicats et taxes spéciales"],
] as const;

export type Part = {
  /** « La commune », « Les ordures ménagères »... */
  libelle: string;
  /** L'identifiant publié, pour renvoyer vers son détail. */
  indicateur: string;
  /** Le montant total encaissé sur la commune, en euros. */
  montant: number;
  /** La part sur 1 000 € d'avis, arrondie à l'euro. */
  surMille: number;
  /** La part en pourcentage de l'avis, non arrondie. */
  pourcentage: number;
};

export type Feuille = {
  /** Le millésime employé, le plus récent complet. */
  exercice: string;
  /** Les cinq parts, la plus lourde d'abord. Somme des `surMille` = 1000. */
  parts: Part[];
  /** L'avis total encaissé sur la commune, en euros. */
  total: number;
};

/**
 * Le millésime le plus récent où les cinq bénéficiaires sont renseignés **et**
 * où l'avis n'est pas nul. Une part manquante fausserait le dénominateur en
 * silence ; un total nul ferait une division par zéro.
 */
export function dernierExerciceComplet(
  series: Record<string, Record<string, number>>,
): string | null {
  const suivies = BENEFICIAIRES.map(([id]) => series[id]);
  if (suivies.some((serie) => !serie)) return null;
  const exercices = [...new Set(suivies.flatMap((serie) => Object.keys(serie)))].sort();
  for (let i = exercices.length - 1; i >= 0; i -= 1) {
    const exercice = exercices[i];
    const valeurs = suivies.map((serie) => serie[exercice]);
    if (valeurs.some((v) => v === undefined)) continue;
    if (valeurs.reduce((somme, v) => somme + v, 0) > 0) return exercice;
  }
  return null;
}

/**
 * Cinq arrondis indépendants ne font pas 1 000.
 *
 * Arrondir chaque part au plus près donne 999 ou 1 001 une fois sur deux, et un
 * total qui ne tombe pas juste discrédite tout le bloc : le lecteur compte, il
 * a l'avis sous les yeux. On plancher chaque part, puis on distribue les euros
 * restants aux plus fortes décimales — la méthode du plus fort reste. Le
 * classement des entrées départage les décimales égales, donc les euros
 * restants vont aux plus gros bénéficiaires.
 */
export function repartirSurMille(valeurs: number[], total: number): number[] {
  const exactes = valeurs.map((v) => (v / total) * 1000);
  const planchers = exactes.map((e) => Math.floor(e));
  let reste = 1000 - planchers.reduce((somme, p) => somme + p, 0);
  const ordre = exactes
    .map((e, i) => ({ i, decimale: e - Math.floor(e) }))
    .sort((a, b) => b.decimale - a.decimale || a.i - b.i);
  for (const { i } of ordre) {
    if (reste <= 0) break;
    planchers[i] += 1;
    reste -= 1;
  }
  return planchers;
}

export function feuilleDImpots(territoire: Territoire): Feuille | null {
  const series = territoire.series;
  if (!series) return null;
  const exercice = dernierExerciceComplet(series);
  if (!exercice) return null;

  const brutes = BENEFICIAIRES.map(([indicateur, libelle]) => ({
    indicateur,
    libelle,
    montant: series[indicateur][exercice],
  })).sort((a, b) => b.montant - a.montant);

  const total = brutes.reduce((somme, p) => somme + p.montant, 0);
  const surMille = repartirSurMille(
    brutes.map((p) => p.montant),
    total,
  );
  return {
    exercice,
    total,
    parts: brutes.map((p, i) => ({
      ...p,
      surMille: surMille[i],
      pourcentage: (p.montant / total) * 100,
    })),
  };
}

function euros(montant: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(montant)} €`;
}

/** Le rendu HTML du bloc, pur, testable hors DOM. Chaîne vide si `null`. */
export function rendu(territoire: Territoire): string {
  const feuille = feuilleDImpots(territoire);
  if (!feuille) return "";
  // Une part à zéro euro sur mille n'écrit pas de ligne : plus d'une commune
  // sur trois ne lève aucune taxe d'enlèvement des ordures ménagères, et
  // « 0 € » répété fait une ligne morte, pas une information. Le montant reste
  // dans `parts` pour qui le veut.
  const visibles = feuille.parts.filter((p) => p.surMille > 0);
  if (!visibles.length) return "";
  const maximum = visibles[0].surMille;

  const lignes = visibles
    .map(
      (p) => `<li data-indicateur="${echapper(p.indicateur)}" tabindex="0">
          <span class="cent__part">${euros(p.surMille)}</span>
          <span class="cent__libelle">${echapper(p.libelle)}
            <span class="camembert__montant">${echapper(
              formater(p.montant, "EUR", false),
            )}</span></span>
          <span class="cent__barre" style="width:${((p.surMille / maximum) * 100).toFixed(
            1,
          )}%"></span>
        </li>`,
    )
    .join("");

  return `
    <h3>Ma feuille d'impôts
      <span class="cent-euros__exercice">taxe foncière ${echapper(feuille.exercice)}</span></h3>
    <p class="cent__question">Sur 1 000 € d'avis de taxe foncière bâtie à ${echapper(
      territoire.nom,
    )}, à qui va chaque euro. Total encaissé en ${echapper(feuille.exercice)} : ${echapper(
      formater(feuille.total, "EUR", false),
    )}.</p>
    <ul class="cent">${lignes}</ul>`;
}
