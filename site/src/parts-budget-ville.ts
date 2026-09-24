/** Parts du budget de fonctionnement, calculées sur un même exercice OFGL. */
import type { Territoire } from "./donnees.ts";
import { DERIVES } from "./derives.ts";

const pourcent = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const desendettement = DERIVES.find(({ id }) => id === "derive_desendettement")!;

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
  const dette = series.ofgl_encours_dette?.[exercice];
  const capacite = Number.isFinite(dette) && dette >= 0
    ? desendettement.calcul({ ofgl_encours_dette: dette, ofgl_epargne_brute: epargne[exercice] })
    : null;
  const investissement = series.ofgl_depenses_d_investissement_hors_remb?.[exercice];
  const population = series.ofgl_population_reference?.[exercice];
  const investissementParHabitant = Number.isFinite(investissement) && investissement >= 0 &&
    Number.isFinite(population) && population > 0 ? investissement / population : null;
  return `<aside class="parts-budget" aria-label="Part des recettes consacrée aux dépenses et à l’épargne">
    <p class="territoire-section-kicker">SUR 100 € ENCAISSÉS · ${exercice}</p>
    <div class="parts-budget__grille">
      <p><strong>${pourcent.format(partDepenses)} %</strong><span>en dépenses de fonctionnement</span></p>
      <p><strong>${pourcent.format(partEpargne)} %</strong><span>en épargne brute</span></p>
      ${capacite !== null ? `<p><strong>${decimal.format(capacite)} ans</strong><span>de dette rapportée à l’épargne annuelle</span></p>` : ""}
      ${investissementParHabitant !== null ? `<p><strong>${euros.format(investissementParHabitant)}</strong><span>investis par habitant</span></p>` : ""}
    </div>
    <small>Dépenses et épargne rapportées aux recettes de fonctionnement ; dette divisée par l’épargne brute ; investissement hors remboursement du capital rapporté à la population de référence. Exercice ${exercice} · <a href="/sources/">OFGL</a>.</small>
  </aside>`;
}
