/** Une lecture des seuls flux de fonctionnement, sur un même exercice OFGL. */
import type { Territoire } from "./donnees.ts";

const pourcent = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function rendrePartsBudgetVille(territoire: Territoire): string {
  const series = territoire.series ?? {};
  const recettes = series.ofgl_recettes_fonctionnement ?? {};
  const depenses = series.ofgl_depenses_fonctionnement ?? {};
  const epargne = series.ofgl_epargne_brute ?? {};
  const exercice = Object.keys(recettes).filter((annee) =>
    Number.isFinite(recettes[annee]) && recettes[annee] > 0 &&
    Number.isFinite(depenses[annee]) && depenses[annee] >= 0 &&
    Number.isFinite(epargne[annee]) && epargne[annee] >= 0 &&
    Math.abs(recettes[annee] - depenses[annee] - epargne[annee]) <= recettes[annee] * 0.001,
  ).sort().at(-1);
  if (!exercice) return "";
  const partDepenses = depenses[exercice] / recettes[exercice] * 100;
  const partEpargne = epargne[exercice] / recettes[exercice] * 100;
  if (partDepenses > 100.01 || partEpargne > 100.01) return "";
  return `<figure class="parts-budget" aria-label="Répartition des recettes de fonctionnement en ${exercice} : ${pourcent.format(partDepenses)} % de dépenses et ${pourcent.format(partEpargne)} % d’épargne brute">
    <figcaption><span>Recettes de fonctionnement · ${exercice}</span><strong>Ce qui est dépensé, ce qui reste.</strong></figcaption>
    <div class="parts-budget__barre" role="img" aria-label="${pourcent.format(partDepenses)} % de dépenses de fonctionnement ; ${pourcent.format(partEpargne)} % d’épargne brute">
      <span class="parts-budget__depenses" style="width:${partDepenses.toFixed(3)}%"></span><span class="parts-budget__epargne" style="width:${partEpargne.toFixed(3)}%"></span>
    </div>
    <div class="parts-budget__legende"><p><i aria-hidden="true"></i><strong>${pourcent.format(partDepenses)} %</strong><span>dépensés pour le fonctionnement</span></p><p><i aria-hidden="true"></i><strong>${pourcent.format(partEpargne)} %</strong><span>d’épargne brute</span></p></div>
    <p class="parts-budget__source">Rapportés aux recettes de fonctionnement du même exercice. Source : <a href="/sources/">OFGL</a>.</p>
  </figure>`;
}
