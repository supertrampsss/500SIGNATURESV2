import { MINISTERES_BERCY_MONTANTS, MINISTERES_BERCY_FLUX } from './bercy-ministeres-montants.ts';
export const SOURCE_RECLASSEMENT_BERCY = 'https://www.budget.gouv.fr/documentation/file-download/34465';
/** Budgets des ministères et part qui finance les retraites, PLF 2027 (montants en euros). */
export function reclassementBercy() {
 return { annee: '2027', statut: 'PLF', ministeres: MINISTERES_BERCY_MONTANTS, selection: MINISTERES_BERCY_FLUX };
}
