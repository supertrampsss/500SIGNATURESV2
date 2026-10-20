import { budgetFlow } from './budget-flow.ts';
import { MINISTERES_BERCY_MONTANTS, MINISTERES_BERCY_FLUX } from './bercy-ministeres-montants.ts';
import { budgetComparison } from './budget-comparison.ts';
export const SOURCE_RECLASSEMENT_BERCY = 'https://www.budget.gouv.fr/documentation/file-download/34465';
export function reclassementBercy() {
 return { annee: '2027', statut: 'PLF', ministeres: MINISTERES_BERCY_MONTANTS, selection: MINISTERES_BERCY_FLUX };
}
export function renduReclassementBercy(): string {
 return `<section class="bercy-reclassement" id="reclassement-bercy" aria-labelledby="bercy-titre">
 <h2 id="bercy-titre">Budgets des ministères : suivez les milliards.</h2>
 <p class="bercy-reclassement__periode">PLF 2027 · Sélection de trois ministères · Montants en milliards d’euros</p>
 ${budgetFlow(MINISTERES_BERCY_FLUX.map(m=>({label:m.nom.startsWith('Défense')?'Défense':m.nom,budget:m.budget,retirement:m.retraites,estimated:m.estimation})))}
 <h3 class="bercy-reclassement__detail-titre">Les 19 ministères</h3>
 ${budgetComparison(MINISTERES_BERCY_MONTANTS.map(m=>({label:m.nom,budget:m.budget,retirement:m.retraites,estimated:m.estimation})))}
 <p class="bercy-reclassement__source">Champ : versements au CAS Pensions, cotisations salariales estimées comprises. Zéro indique l’absence de versement à ce compte. Enseignement supérieur : montant complet non publié dans les sources consultées.</p>
 <p><a href="${SOURCE_RECLASSEMENT_BERCY}#page=24">Bercy · PLF 2027</a> · <a href="/analyses/financement-retraites-publiques/">Sources et calculs</a></p>
 </section>`;
}
