/**
 * Pour 100 € encaissés par toutes les administrations publiques, ce qui ressort.
 *
 * Le site répondait déjà deux fois à « où va l'argent public » : les 100 € du
 * budget de l'État, et les 100 € de prestations sociales. Il manquait la
 * réponse la plus large — celle qui met **l'État, les collectivités et la
 * Sécurité sociale ensemble** — et c'est la seule à laquelle on puisse
 * rattacher le déficit public dont tout le monde parle.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TROIS « 100 € » SUR LE MÊME SITE, ET CE QUI LES SÉPARE
 * ─────────────────────────────────────────────────────────────────────────
 * Ce bloc-ci compte **toutes** les administrations publiques en comptabilité
 * **nationale** ; celui du budget de l'État compte l'État seul en comptabilité
 * **budgétaire** ; celui des prestations sociales répartit une dépense, pas un
 * encaissement. Aucun des trois ne se soustrait d'un autre, et le cadrage le
 * dit avant les nombres plutôt que de laisser trois camemberts se contredire.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE TOTAL DÉPASSE 100 €, ET C'EST LE SUJET
 * ─────────────────────────────────────────────────────────────────────────
 * Les parts ne sont pas ramenées à cent : elles sont rapportées aux **recettes**,
 * si bien que leur somme vaut ce que les administrations dépensent pour 100 €
 * encaissés — 109,80 € en 2025. L'écart est le déficit, à sa place, dans
 * l'unité du lecteur. Le ramener à cent aurait fait disparaître la seule chose
 * que ce tableau existe pour montrer.
 *
 * **Le reste non détaillé est écrit.** Les neuf postes nommés couvrent 98,7 %
 * des dépenses ; le solde de la soustraction est une ligne, jamais un silence.
 */

import type { Territoire } from "./donnees.ts";
import { montantLisible } from "./echelle.ts";

const RECETTES = "eurostat_apu_recettes";
const DEPENSES = "eurostat_apu_depenses";

/** Les postes de dépense, du plus lourd au plus léger sur le dernier exercice
 *  connu. L'ordre est figé plutôt que recalculé : il change d'un exercice à
 *  l'autre pour des écarts de quelques centimes, et un tableau qui se
 *  réordonne tout seul empêche de comparer deux millésimes. */
const POSTES: [id: string, libelle: string][] = [
  ["eurostat_apu_prestations", "Retraites, chômage, allocations"],
  ["eurostat_apu_remunerations", "Rémunération des agents publics"],
  ["eurostat_apu_transferts_nature", "Soins et services remboursés"],
  ["eurostat_apu_consommations", "Achats de biens et de services"],
  ["eurostat_apu_investissement", "Investissement"],
  ["eurostat_apu_transferts_courants", "Transferts courants versés"],
  ["eurostat_apu_interets", "Intérêts de la dette"],
  ["eurostat_apu_subventions", "Subventions aux entreprises"],
  ["eurostat_apu_transferts_capital", "Transferts en capital"],
];

/** D'où viennent les 100 €. Trois lignes, et le reste nommé comme reste. */
const RESSOURCES: [id: string, libelle: string][] = [
  ["eurostat_apu_cotisations", "Cotisations sociales"],
  ["eurostat_apu_impots_production", "Impôts sur la production et la consommation"],
  ["eurostat_apu_impots_revenu", "Impôts sur le revenu et le patrimoine"],
];

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Un montant en euros pour 100 € encaissés, deux décimales : c'est une colonne
 *  qu'on lit de haut en bas, et les postes légers se départagent aux centimes. */
function pour100(part: number): string {
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(part)} €`;
}

/**
 * Le bloc, ou la chaîne vide tant que les deux totaux et les neuf postes ne
 * sont pas publiés **sur le même exercice**.
 *
 * Une part calculée sur des recettes d'une autre année ne mesure rien : le
 * dénominateur bouge de quarante milliards d'un exercice à l'autre.
 */
export function rendu(pays: Record<string, Territoire>): string {
  const france = pays["FR"];
  if (!france) return "";
  const serie = (id: string) => france.series[id];
  const recettes = serie(RECETTES);
  const depenses = serie(DEPENSES);
  if (!recettes || !depenses) return "";
  const exercices = Object.keys(recettes)
    .filter((an) => depenses[an] !== undefined)
    .sort();
  const exercice = exercices[exercices.length - 1];
  if (!exercice) return "";

  const total = recettes[exercice];
  const part = (id: string) => {
    const valeur = serie(id)?.[exercice];
    return valeur === undefined ? null : (valeur / total) * 100;
  };
  const postes = POSTES.map(([id, libelle]) => [libelle, part(id)] as const);
  if (postes.some(([, valeur]) => valeur === null)) return "";

  const nommees = postes.reduce((somme, [, valeur]) => somme + (valeur ?? 0), 0);
  const depense = (depenses[exercice] / total) * 100;
  const reste = depense - nommees;
  const solde = 100 - depense;

  const ressources = RESSOURCES.map(([id, libelle]) => [libelle, part(id)] as const).filter(
    (ligne): ligne is readonly [string, number] => ligne[1] !== null,
  );
  const autresRecettes = 100 - ressources.reduce((somme, [, valeur]) => somme + valeur, 0);

  return `
    <h3>Pour 100 € encaissés, ce qui ressort</h3>
    <p class="bloc__complement">Toutes les administrations publiques réunies —
      l'État, les collectivités, la Sécurité sociale et les organismes qu'ils
      financent — ont encaissé <strong>${montantLisible(total)}</strong> en
      ${echapper(exercice)} et dépensé <strong>${pour100(depense)}</strong> pour chaque
      100 € reçus. L'écart, <strong>${pour100(Math.abs(solde))}</strong>, est le déficit
      public.</p>
    <table class="comparaison" tabindex="0">
      <caption>Comptabilité nationale, exercice ${echapper(exercice)}. Ce tableau ne se
        soustrait ni des « 100 € du budget de l'État », qui comptent l'État seul en
        comptabilité budgétaire, ni des « 100 € de prestations sociales », qui
        répartissent une dépense et non un encaissement. Source : Eurostat, comptes
        des administrations publiques.</caption>
      <thead><tr><th scope="col">D'où viennent les 100 €</th>
        <th scope="col">Montant</th></tr></thead>
      <tbody>${ressources
        .map(
          ([libelle, valeur]) => `<tr><th scope="row">${echapper(libelle)}</th>
            <td>${pour100(valeur)}</td></tr>`,
        )
        .join("")}
        <tr><th scope="row">Ventes de services et autres recettes</th>
          <td>${pour100(autresRecettes)}</td></tr>
      </tbody>
      <thead><tr><th scope="col">Où ils vont</th><th scope="col">Montant</th></tr></thead>
      <tbody>${postes
        .map(
          ([libelle, valeur]) => `<tr><th scope="row">${echapper(libelle)}</th>
            <td>${pour100(valeur ?? 0)}</td></tr>`,
        )
        .join("")}
        <tr><th scope="row">Autres dépenses</th><td>${pour100(reste)}</td></tr>
        <tr class="souligne"><th scope="row">Total dépensé</th>
          <td>${pour100(depense)}</td></tr>
      </tbody>
    </table>`;
}

/** L'enveloppe DOM. `false` quand rien n'est peint : le sommaire de la page se
 *  construit sur ce qui s'est réellement affiché. */
export function afficherCentEurosApu(
  cadre: HTMLElement,
  pays: Record<string, Territoire>,
): boolean {
  const html = rendu(pays);
  if (html) cadre.innerHTML = html;
  return html !== "";
}
