/**
 * Les niches fiscales : ce que l'État renonce à percevoir.
 *
 * Le site montrait ce que l'État dépense. Il ne montrait pas ce qu'il ne
 * perçoit pas — quatre-vingt-huit milliards d'euros d'exonérations, de taux
 * réduits et de crédits d'impôt qui n'apparaissent sur aucune ligne de
 * dépense, et que personne ne vote ligne à ligne.
 *
 * Deux confusions sont refusées explicitement. Une dépense fiscale **n'est pas
 * une dépense** : c'est un impôt non encaissé, et l'ajouter aux crédits votés
 * donnerait un total qui ne mesure rien. Et ce sont des **chiffrages**, pas des
 * encaissements : le document qui les publie signale lui-même que leur
 * fiabilité est inégale.
 *
 * Le bloc montre les dispositifs les plus coûteux, pas les quatre cent
 * cinquante-sept : la liste entière est un document, le classement est une
 * réponse.
 */

import type { DepensesFiscales, Indicateur, Territoire } from "./donnees.ts";
import { formater } from "./echelle.ts";

export const TOTAL = "depense_fiscale_totale";

/** Combien de dispositifs le bloc nomme. Au-delà, c'est une annexe. */
export const MONTRES = 10;

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Une libellé législatif entier fait trois lignes : il est coupé sur un mot. */
export function raccourcir(texte: string, limite = 110): string {
  if (texte.length <= limite) return texte;
  const coupe = texte.slice(0, limite);
  const espace = coupe.lastIndexOf(" ");
  return `${coupe.slice(0, espace > 40 ? espace : limite)}…`;
}

/** Rendu pur, sans DOM : c'est lui qui est testé. */
export function rendu(
  niches: DepensesFiscales,
  pays: Record<string, Territoire>,
  catalogue: Indicateur[],
): string {
  // Le chiffre annoncé est celui de l'exercice **constaté**, pas du dernier
  // publié : le document porte deux prévisions, et « l'État renonce à
  // percevoir » ne se dit pas d'une année qui n'a pas eu lieu.
  const exercice = niches.realise ?? niches.exercices[niches.exercices.length - 1];
  if (!exercice || !niches.dispositifs.length) return "";
  if (!catalogue.some((i) => i.id === TOTAL)) return "";
  const total = pays["FR"]?.series?.[TOTAL]?.[exercice];
  if (total === undefined) return "";

  // La prévision la plus lointaine, quand elle existe, se dit au conditionnel
  // et à part — c'est ce qui empêche de la lire comme un constat.
  const horizon = niches.exercices[niches.exercices.length - 1];
  const prevu = horizon !== exercice ? pays["FR"]?.series?.[TOTAL]?.[horizon] : undefined;
  const prevision =
    prevu === undefined
      ? ""
      : ` Pour ${echapper(horizon)}, le projet de loi de finances en prévoit
      ${echapper(formater(prevu, "EUR", false))}.`;

  const classement = niches.dispositifs
    .filter((d) => d.montants[exercice] !== undefined)
    .slice(0, MONTRES);
  // La part que pèsent les dix premières : c'est elle qui dit si le coût est
  // concentré sur quelques dispositifs ou dispersé sur quatre cent cinquante.
  const cumul = classement.reduce((somme, d) => somme + (d.montants[exercice] ?? 0), 0);
  const part = total ? Math.round((cumul / total) * 100) : 0;

  const lignes = classement
    .map(
      (d) => `<tr>
      <th scope="row">${echapper(raccourcir(d.libelle))}</th>
      <td class="niches__mission">${echapper(d.mission ?? "—")}</td>
      <td class="niches__montant">${echapper(formater(d.montants[exercice] ?? 0, "EUR", false))}</td>
    </tr>`,
    )
    .join("");

  return `
    <h3>Les niches fiscales, c'est combien&nbsp;?</h3>
    <p class="bloc__complement">En ${echapper(exercice)}, l'État renonce à percevoir
      <strong>${echapper(formater(total, "EUR", false))}</strong> au titre des
      exonérations, taux réduits et crédits d'impôt. Ce n'est pas une dépense&nbsp;:
      c'est un impôt qui n'est pas encaissé, et qui n'apparaît sur aucune ligne du
      budget. Les ${MONTRES} dispositifs les plus coûteux en portent
      ${echapper(String(part))}&nbsp;%.${prevision}</p>
    <table class="niches">
      <caption>Dépenses fiscales chiffrées, ${echapper(exercice)} · Voies et moyens
        tome 2 annexé au projet de loi de finances pour 2026 · euros courants</caption>
      <thead><tr><th scope="col">Dispositif</th><th scope="col">Mission de rattachement</th>
        <th scope="col">Coût</th></tr></thead>
      <tbody>${lignes}</tbody>
    </table>
    <p class="bloc__note">Ce sont des chiffrages, pas des encaissements&nbsp;: le
      document signale lui-même que leur fiabilité est inégale. Les dispositifs dont
      le coût est inférieur à 0,5&nbsp;M€ ou non calculé sont absents&nbsp;;
      ${echapper(String(niches.dispositifs.length))} dispositifs sont chiffrés sur
      les 465 que le document recense.</p>`;
}

export function afficherNiches(
  bloc: HTMLElement,
  niches: DepensesFiscales,
  pays: Record<string, Territoire>,
  catalogue: Indicateur[],
): boolean {
  const html = rendu(niches, pays, catalogue);
  if (!html) return false;
  bloc.innerHTML = html;
  return true;
}
