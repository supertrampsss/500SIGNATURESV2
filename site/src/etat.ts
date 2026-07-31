/**
 * Budget de l'État : ce qui a été voté, ce qui a été dépensé.
 *
 * Le pont va des recettes au solde en passant par les dépenses. Il ne prétend
 * pas suivre un euro d'impôt jusqu'à une dépense : il montre les grandeurs que
 * la comptabilité budgétaire relie réellement, dans l'ordre où elle les relie
 * (docs/00 §2). Chaque étape porte son signe, et le total de la colonne se
 * referme sur le solde publié — c'est vérifié à l'ingestion, pas ici.
 *
 * Deux confusions sont refusées explicitement : le solde budgétaire de l'État
 * n'est pas le déficit public au sens de Maastricht, et les prélèvements sur
 * recettes ne sont pas des dépenses de l'État — ils sont retirés de ses
 * recettes avant qu'il ne les encaisse.
 */

import type { BudgetEtat, EtapeBudget, LigneBudget } from "./donnees.ts";
import { formater } from "./echelle.ts";

const SIGNES: Record<string, string> = { recette: "+", depense: "−" };

/** Échappement sans DOM : le rendu doit être testable hors navigateur. */
function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Barre proportionnelle : la largeur dit l'ordre de grandeur, le chiffre dit le reste. */
function barre(montant: number, reference: number): string {
  const part = reference ? Math.min(100, (Math.abs(montant) / reference) * 100) : 0;
  return `<span class="pont__barre" style="width:${part.toFixed(1)}%"></span>`;
}

function ligne(
  meta: LigneBudget,
  montant: number,
  reference: number,
  profondeur: number,
): string {
  const signe = meta.cote ? SIGNES[meta.cote] : montant >= 0 ? "+" : "−";
  return `<tr class="pont__ligne pont__ligne--n${profondeur}">
    <th scope="row">${echapper(meta.libelle)}</th>
    <td class="pont__signe">${signe}</td>
    <td class="pont__montant">${formater(Math.abs(montant), "EUR", false)}</td>
    <td class="pont__jauge">${barre(montant, reference)}</td>
  </tr>`;
}

/** Têtes du pont. La hiérarchie sous chacune vient du champ `parent` publié :
 *  la redéclarer ici la ferait diverger du connecteur au premier changement. */
const PONT = [
  "Total recettes nettes du budget général",
  "Fonds de concours et attribution de produits",
  "Total dépenses nettes du budget général",
  "Total prélèvements sur recettes",
];

function pont(budget: BudgetEtat, exercice: string, etape: string): string {
  const donnees = budget.exercices[exercice]?.[etape];
  if (!donnees) return "";
  const meta = new Map(budget.lignes.map((l) => [l.libelle, l]));
  const enfants = new Map<string, LigneBudget[]>();
  for (const l of budget.lignes) {
    if (l.parent) enfants.set(l.parent, [...(enfants.get(l.parent) ?? []), l]);
  }
  const montants = donnees.montants;
  const reference = Math.max(...PONT.map((libelle) => Math.abs(montants[libelle] ?? 0)), 1);

  const rendre = (libelle: string, profondeur: number): string[] => {
    const fiche = meta.get(libelle);
    if (!fiche || montants[libelle] === undefined) return [];
    return [
      ligne(fiche, montants[libelle], reference, profondeur),
      ...(enfants.get(libelle) ?? []).flatMap((e) => rendre(e.libelle, profondeur + 1)),
    ];
  };
  const corps = PONT.flatMap((libelle) => rendre(libelle, 0)).join("");

  const soldes = [
    ["Solde des comptes spéciaux", donnees.solde_comptes_speciaux],
    ["Solde des budgets annexes", donnees.solde_budgets_annexes],
  ]
    .filter(([, valeur]) => valeur !== null && valeur !== undefined)
    .map(
      ([libelle, valeur]) => `<tr class="pont__ligne pont__ligne--n0">
        <th scope="row">${echapper(libelle as string)}</th>
        <td class="pont__signe">${(valeur as number) >= 0 ? "+" : "−"}</td>
        <td class="pont__montant">${formater(Math.abs(valeur as number), "EUR", false)}</td>
        <td class="pont__jauge">${barre(valeur as number, reference)}</td>
      </tr>`,
    )
    .join("");

  const solde = donnees.solde;
  return `<table class="pont">
    <caption>Exercice ${echapper(exercice)} · ${echapper(
      budget.etapes.find((e) => e.cle === etape)?.libelle ?? etape,
    )}</caption>
    <tbody>${corps}${soldes}</tbody>
    <tfoot>
      <tr class="pont__solde">
        <th scope="row">Solde budgétaire</th>
        <td class="pont__signe">${solde !== null && solde < 0 ? "−" : "+"}</td>
        <td class="pont__montant">${
          solde === null ? "—" : formater(Math.abs(solde), "EUR", false)
        }</td>
        <td></td>
      </tr>
    </tfoot>
  </table>`;
}

/** Voté, rectifié, exécuté : trois moments du même exercice, jamais mélangés. */
function comparaisonEtapes(budget: BudgetEtat, exercice: string): string {
  const etapes = budget.exercices[exercice] ?? {};
  const lignes = budget.etapes
    .filter((etape: EtapeBudget) => etapes[etape.cle]?.solde !== undefined)
    .map((etape: EtapeBudget) => {
      const solde = etapes[etape.cle].solde;
      return `<tr>
        <th scope="row">${echapper(etape.libelle)}</th>
        <td>${solde === null ? "—" : formater(solde, "EUR", false)}</td>
      </tr>`;
    })
    .join("");
  const vote = etapes["vote"]?.solde;
  const execute = etapes["execute"]?.solde;
  // « Au-dessus » et « en dessous » sont ambigus sur un solde négatif : le
  // lecteur y entend « a dépensé plus », qui peut être l'inverse du vrai. Tant
  // que les deux soldes sont des déficits, la phrase parle du déficit.
  const ecart =
    vote != null && execute != null
      ? `<p class="bloc__complement">${
          vote < 0 && execute < 0
            ? `Le déficit constaté est <strong>${formater(
                Math.abs(execute - vote),
                "EUR",
                false,
              )}</strong> ${
                execute > vote ? "plus faible" : "plus élevé"
              } que celui voté en loi de finances initiale.`
            : `Le solde constaté s'écarte de <strong>${formater(
                Math.abs(execute - vote),
                "EUR",
                false,
              )}</strong> du solde voté en loi de finances initiale.`
        }</p>`
      : "";
  return `<table class="comparaison">
      <caption>Solde budgétaire de l'exercice ${echapper(exercice)}</caption>
      <tbody>${lignes}</tbody>
    </table>${ecart}`;
}

function avertissements(budget: BudgetEtat, exercice: string): string {
  const notes = [
    "Comptabilité budgétaire, État seul : ce solde n'est pas le déficit public au sens" +
      " de Maastricht, qui couvre aussi la Sécurité sociale et les collectivités et se" +
      " calcule en comptabilité nationale.",
    "Les prélèvements sur recettes ne sont pas des dépenses de l'État : ils sont retirés" +
      " de ses recettes avant qu'il ne les encaisse.",
    "Les montants sont nets des remboursements et dégrèvements d'impôts, comptés à part.",
  ];
  for (const [cle, totaux] of Object.entries(budget.quarantaine ?? {})) {
    if (cle.startsWith(`${exercice}/`)) {
      notes.push(
        `Décomposition non publiée pour ${totaux.join(", ")} : dans le fichier source, ` +
          "ce total ne se recompose pas à partir de ses lignes. Le total, lui, est vérifié.",
      );
    }
  }
  return `<details class="panneau">
    <summary>Ce que ces chiffres ne disent pas</summary>
    <ul>${notes.map((n) => `<li>${echapper(n)}</li>`).join("")}</ul>
  </details>`;
}

/** Exercices publiables : ceux dont l'exécution est connue, du plus récent au
 *  plus ancien. Un exercice en cours n'en fait pas partie (docs/06). */
export function exercicesDisponibles(budget: BudgetEtat): string[] {
  return Object.keys(budget.exercices)
    .filter((annee) => budget.exercices[annee]["execute"])
    .sort()
    .reverse();
}

/** Rendu pur, sans DOM : c'est lui qui est testé. */
export function rendu(budget: BudgetEtat, exercice: string): string {
  const exercices = exercicesDisponibles(budget);
  return `
    <h3>Budget de l'État</h3>
    <p class="champ champ--exercice">
      <label for="exercice-etat">Exercice</label>
      <select id="exercice-etat">
        ${exercices
          .map(
            (annee) =>
              `<option value="${annee}"${annee === exercice ? " selected" : ""}>${annee}</option>`,
          )
          .join("")}
      </select>
    </p>
    ${pont(budget, exercice, "execute")}
    ${comparaisonEtapes(budget, exercice)}
    ${avertissements(budget, exercice)}`;
}

export function afficherBudgetEtat(
  bloc: HTMLElement,
  budget: BudgetEtat,
  exercice?: string,
): boolean {
  const exercices = exercicesDisponibles(budget);
  const choisi = exercice && exercices.includes(exercice) ? exercice : exercices[0];
  if (!choisi) return false;

  bloc.innerHTML = rendu(budget, choisi);
  bloc.querySelector<HTMLSelectElement>("#exercice-etat")?.addEventListener("change", (e) => {
    afficherBudgetEtat(bloc, budget, (e.target as HTMLSelectElement).value);
  });
  return true;
}
