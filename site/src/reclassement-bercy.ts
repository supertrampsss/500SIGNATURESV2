import { MINISTERES_BERCY } from './bercy-ministeres-2027.ts';
import { stackedPercent } from './stacked-percent.ts';

export const SOURCE_RECLASSEMENT_BERCY = 'https://www.budget.gouv.fr/documentation/file-download/34465';
/** Chaque barre conserve 100 % des crédits du ministère ; les parts ne se cumulent pas entre ministères. */
export function reclassementBercy() {
  return { annee: '2027', statut: 'PLF', ministeres: MINISTERES_BERCY };
}
export function renduReclassementBercy(): string {
  return `<section class="bercy-reclassement" id="reclassement-bercy" aria-labelledby="bercy-titre">
    <h2 id="bercy-titre">Les budgets des ministères</h2>
    ${stackedPercent(MINISTERES_BERCY.map(m => ({ label: m.nom, value: m.partRetraites })), {partLabel: 'Retraites', remainderLabel: 'Autres crédits'})}
    <p><a href="${SOURCE_RECLASSEMENT_BERCY}#page=24">Bercy · PLF 2027 · figure 3B, pages 24–25</a> · <a href="/analyses/financement-retraites-publiques/">Lire le dossier</a></p>
  </section>`;
}
