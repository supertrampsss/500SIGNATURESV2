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

function colonne(
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
    <h3>100 € du budget de l'État — exercice ${echapper(exercice)}</h3>
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
    <p class="bloc__complement">Sur 100 € dépensés, <strong>${euros(
      100 - empruntes,
    )}</strong> viennent des recettes de l'année ; les <strong>${euros(
      empruntes,
    )}</strong> restants sont empruntés.${
      solde !== null
        ? ` Le solde budgétaire complet ajoute à ce calcul le résultat des comptes
            spéciaux et des budgets annexes.`
        : ""
    }</p>
    <details class="panneau">
      <summary>Pourquoi ce n'est pas « suivre son impôt »</summary>
      <ul>
        <li>Aucun euro n'est tracé. Le budget de l'État obéit au principe
          d'universalité : les recettes ne financent pas une dépense en particulier,
          elles alimentent une masse commune. Ces 100 € sont une proportion, pas un
          trajet.</li>
        <li>Le périmètre est l'État seul. La Sécurité sociale, les hôpitaux, les
          retraites et les budgets des collectivités n'y figurent pas : ils sont
          financés par d'autres recettes, cotisations comprises.</li>
        <li>Les montants sont ceux d'un exercice exécuté, en comptabilité
          budgétaire, nets des remboursements et dégrèvements d'impôts.</li>
        <li>Les prélèvements sur recettes reversés aux collectivités et à l'Union
          européenne sont comptés comme des emplois, parce que c'est ce qu'ils sont
          du point de vue du contribuable — même si la comptabilité budgétaire les
          retire des recettes plutôt que de les inscrire en dépenses.</li>
      </ul>
    </details>`;
}

export function afficherCentEuros(
  bloc: HTMLElement,
  budget: BudgetEtat,
  exercice: string,
): boolean {
  const html = rendu(budget, exercice);
  if (!html) return false;
  bloc.innerHTML = html;
  return true;
}
