/**
 * « D'où viennent 100 € ? Où vont 100 € ? »
 *
 * C'est la question que le produit doit savoir traiter — et celle où il serait
 * le plus facile de mentir. Ce module ne trace **aucun** euro : il n'existe pas
 * de chemin entre un impôt payé et une dépense faite. Le budget de l'État obéit
 * au principe d'universalité budgétaire (docs/00 §2) : les recettes tombent
 * dans une masse commune, et les dépenses en sortent.
 *
 * Ce qui est affiché est donc une **décomposition proportionnelle** d'une année
 * exécutée : la part de chaque ligne dans le total, ramenée à 100 €. Rien de
 * plus, et la phrase qui le dit accompagne le chiffre.
 *
 * Périmètre : l'État seul, en comptabilité budgétaire. Ni la Sécurité sociale,
 * ni les collectivités, ni les cotisations sociales n'y figurent — ce sont
 * d'autres budgets, financés autrement.
 */

import { barresMagnitude } from "./barres.ts";
import type { BudgetEtat, MontantsEtape } from "./donnees.ts";

const RECETTES = [
  ["Taxe sur la valeur ajoutée", "TVA"],
  ["Impôt sur le revenu", "Impôt sur le revenu"],
  ["Impôt sur les sociétés", "Impôt sur les sociétés"],
  ["Taxe intérieure de consommation sur les produits énergétiques", "Taxes sur l'énergie"],
  ["Autres recettes fiscales", "Autres impôts et taxes"],
  ["Total recettes non fiscales", "Recettes non fiscales"],
  ["Fonds de concours et attribution de produits", "Fonds de concours"],
] as const;

const DEPENSES = [
  ["Dépenses d'intervention", "Aides, prestations et subventions versées"],
  ["Dépenses de personnel", "Salaires et pensions des agents de l'État"],
  ["Dépenses de fonctionnement", "Fonctionnement des services"],
  ["Charges de la dette de l'Etat", "Intérêts de la dette"],
  ["PSR au profit des collectivités territoriales", "Reversé aux collectivités"],
  ["Dépenses d'investissement", "Investissement"],
  ["PSR au profit de l'Union européenne", "Contribution à l'Union européenne"],
  ["Dépenses d'opérations financières", "Opérations financières"],
  ["Dotation des pouvoirs publics", "Dotation des pouvoirs publics"],
] as const;

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function euros(part: number): string {
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(part)} €`;
}

/** -> [{libelle, part sur 100}], du plus lourd au plus léger. */
export function repartition(
  montants: Record<string, number>,
  lignes: readonly (readonly [string, string])[],
  total: number,
): { libelle: string; part: number }[] {
  if (!total) return [];
  return lignes
    .map(([source, libelle]) => ({ libelle, part: ((montants[source] ?? 0) / total) * 100 }))
    .filter((l) => l.part > 0)
    .sort((a, b) => b.part - a.part);
}

/** Une part de la figure : le libellé et sa valeur sur 100 €. */
export type Quartier = {
  libelle: string;
  part: number;
  composition?: string;
};

/** Regroupe les parts sous 3 € en « Autres » : douze rangs dont sept sous un
 *  euro font une liste, pas une figure. Une petite part **seule** garde son
 *  nom : la cacher derrière « Autres » ne simplifie rien et perd le libellé. */
export function quartiers(entrees: Quartier[]): Quartier[] {
  const grosses = entrees.filter((e) => e.part >= 3);
  const petites = entrees.filter((e) => e.part < 3);
  const total = petites.reduce((somme, e) => somme + e.part, 0);
  if (petites.length < 2) return [...grosses, ...petites];
  return [
    ...grosses,
    {
      libelle: "Autres",
      part: total,
      composition: petites.map((e) => `${e.libelle} (${euros(e.part)})`).join(" · "),
    },
  ];
}

/**
 * La figure des parts : des barres alignées, pas un disque.
 *
 * C'était un camembert, et il l'était deux fois pour rien. La direction du
 * 18 août 2026 dit que la forme se choisit sur le métier de la donnée : ici on
 * COMPARE DES TAILLES — « la TVA pèse-t-elle plus que l'impôt sur le revenu, et
 * combien de fois ? » —, et l'œil compare des longueurs alignées, pas des
 * angles.
 *
 * Et la gamme de huit teintes qui peignait ces quartiers avait été mesurée :
 * passée au validateur de palette catégorielle, elle échouait quatre contrôles
 * sur cinq — sept des huit teintes sous le plancher de chroma (donc lues comme
 * du gris), ΔE 5,3 en protanopie pour un seuil de 8, ΔE 13,3 en vision normale
 * pour un seuil de 15, et deux teintes sous 3:1 de contraste sur le fond. Une
 * magnitude ne prend qu'une teinte : la longueur porte déjà la mesure.
 */
export function figureParts(titre: string, question: string, entrees: Quartier[]): string {
  const parts = quartiers(entrees);
  return `<div class="cent__figure">
    <h4>${echapper(titre)}</h4>
    <p class="cent__question">${echapper(question)}</p>
    ${barresMagnitude(
      "",
      parts.map((e) => ({
        libelle: e.libelle,
        valeur: e.part,
        regroupement: e.libelle === "Autres",
        ...(e.composition ? { detail: e.composition } : {}),
      })),
      euros,
    )}
  </div>`;
}

export function colonne(
  titre: string,
  question: string,
  entrees: { libelle: string; part: number }[],
): string {
  const maximum = Math.max(...entrees.map((e) => e.part), 1);
  return `<div class="cent__colonne">
    <h4>${echapper(titre)}</h4>
    <p class="cent__question">${echapper(question)}</p>
    <ul class="cent">
      ${entrees
        .map(
          (e) => `<li>
            <span class="cent__part">${euros(e.part)}</span>
            <span class="cent__libelle">${echapper(e.libelle)}</span>
            <span class="cent__barre" style="width:${((e.part / maximum) * 100).toFixed(1)}%"></span>
          </li>`,
        )
        .join("")}
    </ul>
  </div>`;
}

function totaux(donnees: MontantsEtape): { recettes: number; depenses: number } {
  const m = donnees.montants;
  const recettes =
    (m["Total recettes nettes du budget général"] ?? 0) +
    (m["Fonds de concours et attribution de produits"] ?? 0);
  const depenses =
    (m["Total dépenses nettes du budget général"] ?? 0) +
    (m["Total prélèvements sur recettes"] ?? 0);
  return { recettes, depenses };
}

/** Rendu pur, sans DOM : c'est lui qui est testé. */
export function rendu(budget: BudgetEtat, exercice: string): string {
  const donnees = budget.exercices[exercice]?.["execute"];
  if (!donnees) return "";
  const { recettes, depenses } = totaux(donnees);
  if (!recettes || !depenses) return "";
  const empruntes = Math.max(0, ((depenses - recettes) / depenses) * 100);
  const solde = donnees.solde;

  return `
    <h3>100 € du budget de l'État <span class="cent-euros__exercice">exercice ${echapper(exercice)}</span></h3>
    <div class="cent__grille">
      ${figureParts(
        "D'où viennent 100 € ?",
        "Part de chaque recette dans le total encaissé par l'État.",
        repartition(donnees.montants, RECETTES, recettes),
      )}
      ${figureParts(
        "Où vont 100 € ?",
        "Part de chaque dépense dans le total décaissé par l'État.",
        repartition(donnees.montants, DEPENSES, depenses),
      )}
    </div>
    <details class="repli">
      <summary>Le détail ligne à ligne</summary>
      <div class="cent__grille">
        ${colonne(
          "D'où viennent 100 € ?",
          "Part de chaque recette dans le total encaissé par l'État.",
          repartition(donnees.montants, RECETTES, recettes),
        )}
        ${colonne(
          "Où vont 100 € ?",
          "Part de chaque dépense dans le total décaissé par l'État.",
          repartition(donnees.montants, DEPENSES, depenses),
        )}
      </div>
    </details>
    <p class="bloc__complement">Sur 100 € dépensés, <strong>${euros(
      100 - empruntes,
    )}</strong> viennent des recettes de l'année ; les <strong>${euros(
      empruntes,
    )}</strong> restants sont empruntés.${
      solde !== null
        ? ` Le solde budgétaire complet ajoute à ce calcul le résultat des comptes
            spéciaux et des budgets annexes.`
        : ""
    }</p>`;
}

export function afficherCentEuros(
  bloc: HTMLElement,
  budget: BudgetEtat,
  exercice: string,
): boolean {
  const html = rendu(budget, exercice);
  if (!html) return false;
  bloc.innerHTML = html;
  // Le cadre est peut-être REPLIÉ : le pré-rendu replie ce qu'il ne peut pas
  // écrire, et rien ne le rouvrait. Un bloc dont les séries sont publiées
  // APRÈS le dernier déploiement restait alors invisible à tout lecteur —
  // écrit, peint, et caché. Qui remplit un cadre le déplie.
  bloc.hidden = false;
  return true;
}
