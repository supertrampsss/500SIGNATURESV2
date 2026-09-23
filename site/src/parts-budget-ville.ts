/** Parts du budget de fonctionnement, calculées sur un même exercice OFGL. */
import type { Territoire } from "./donnees.ts";

const pourcent = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function rendrePartsBudgetVille(territoire: Territoire): string {
  const series = territoire.series ?? {};
  const recettes = series.ofgl_recettes_fonctionnement ?? {};
  const depenses = series.ofgl_depenses_fonctionnement ?? {};
  const epargne = series.ofgl_epargne_brute ?? {};
  const exercice = Object.keys(recettes).filter((annee) =>
    Number.isFinite(recettes[annee]) && recettes[annee] > 0 &&
    Number.isFinite(depenses[annee]) && Number.isFinite(epargne[annee]),
  ).sort().at(-1);
  if (!exercice) return "";
  const partDepenses = depenses[exercice] / recettes[exercice] * 100;
  const partEpargne = epargne[exercice] / recettes[exercice] * 100;
  return `<aside class="parts-budget" aria-label="Part des recettes consacrée aux dépenses et à l’épargne">
    <p class="territoire-section-kicker">SUR 100 € ENCAISSÉS · ${exercice}</p>
    <div class="parts-budget__grille">
      <p><strong>${pourcent.format(partDepenses)} %</strong><span>en dépenses de fonctionnement</span></p>
      <p><strong>${pourcent.format(partEpargne)} %</strong><span>en épargne brute</span></p>
    </div>
    <small>Chaque part est rapportée aux recettes de fonctionnement du même exercice. Source : OFGL.</small>
  </aside>`;
}
