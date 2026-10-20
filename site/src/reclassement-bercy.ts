import { MINISTERES_BERCY_MONTANTS, MINISTERES_BERCY_FLUX } from './bercy-ministeres-montants.ts';
import { budgetComparison } from './budget-comparison.ts';
export const SOURCE_RECLASSEMENT_BERCY = 'https://www.budget.gouv.fr/documentation/file-download/34465';
export function reclassementBercy() {
 return { annee: '2027', statut: 'PLF', ministeres: MINISTERES_BERCY_MONTANTS, selection: MINISTERES_BERCY_FLUX };
}
export function renduReclassementBercy(): string {
 return `<section class="bercy-reclassement" id="reclassement-bercy" aria-labelledby="bercy-titre">
 <h2 id="bercy-titre">Les budgets des ministères</h2>
 <p class="bercy-reclassement__periode">PLF 2027 · En milliards d’euros</p>
 ${budgetComparison(MINISTERES_BERCY_MONTANTS.map(m=>({label:m.nom,budget:m.budget,retirement:m.retraites,estimated:m.estimation})))}
 <p class="bercy-reclassement__source"><a href="${SOURCE_RECLASSEMENT_BERCY}#page=24">Bercy · PLF 2027</a> · <a href="/analyses/financement-retraites-publiques/">Sources et calculs</a></p>
 </section>`;
}
