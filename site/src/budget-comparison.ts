import { echapper } from './texte.ts';

export type BudgetComparisonRow = {
  label: string;
  /** Montants en euros, issus de données monétaires, jamais d'une part lue sur un graphique. */
  budget: number;
  retirement: number | null;
  estimated?: boolean;
};

function milliards(euros: number): string {
  if (euros === 0) return '0';
  const value = euros / 1e9;
  const digits = value >= 1 ? 1 : value >= .1 ? 2 : value >= .01 ? 3 : 4;
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function amount(euros: number | null, estimated: boolean): string {
  if (euros === null) return '<span class="budget-comparison__value" aria-label="Non disponible">—</span>';
  return `<span class="budget-comparison__value">${estimated ? '<span class="budget-comparison__approx" aria-label="Estimation">≈ </span>' : ''}${milliards(euros)}</span>`;
}

/** Table monétaire compacte ; les barres utilisent un maximum commun à toutes les lignes. */
export function budgetComparison(rows: readonly BudgetComparisonRow[]): string {
  for (const row of rows) {
    if (!Number.isFinite(row.budget) || row.budget < 0
      || (row.retirement !== null && (!Number.isFinite(row.retirement) || row.retirement < 0 || row.retirement > row.budget))) {
      throw new RangeError(`Montants budgétaires invalides : ${row.label}`);
    }
  }
  const maximum = Math.max(1, ...rows.map(row => row.budget));
  const hasEstimates = rows.some(row => row.estimated && row.retirement !== null);
  const body = rows.map(row => {
    const remaining = row.retirement === null ? null : row.budget - row.retirement;
    const segments = remaining === null
      ? ''
      : `<span class="budget-comparison__segment budget-comparison__segment--remaining" style="width:${remaining / maximum * 100}%"></span><span class="budget-comparison__segment budget-comparison__segment--retirement" style="width:${row.retirement! / maximum * 100}%"></span>`;
    return `<tr class="budget-comparison__row" role="row" data-budget-eur="${row.budget}"${row.retirement !== null ? ` data-retirement-eur="${row.retirement}" data-remaining-eur="${remaining}"` : ''}>
      <th role="rowheader" scope="row">${echapper(row.label)}<span class="budget-comparison__bar" aria-hidden="true"><span class="budget-comparison__total" style="width:${row.budget / maximum * 100}%"></span>${segments}</span></th>
      <td role="cell" data-label="Budget · Md€">${amount(row.budget, false)}</td>
      <td role="cell" data-label="Retraites · Md€" class="budget-comparison__retirement">${amount(row.retirement, !!row.estimated)}</td>
      <td role="cell" data-label="Après · Md€">${amount(remaining, !!row.estimated)}</td>
    </tr>`;
  }).join('');
  return `<div class="budget-comparison">
    <table class="budget-comparison__table" role="table">
      <caption>Budgets des ministères, en milliards d’euros</caption>
      <colgroup><col class="budget-comparison__name-column"><col><col><col></colgroup>
      <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Ministère</th><th scope="col" role="columnheader">Budget <span class="budget-comparison__unit">Md€</span></th><th scope="col" role="columnheader">Retraites <span class="budget-comparison__unit">Md€</span></th><th scope="col" role="columnheader">Après reclassement <span class="budget-comparison__unit">Md€</span></th></tr></thead>
      <tbody role="rowgroup">${body}</tbody>
    </table>
    <p class="budget-comparison__legend"><span class="budget-comparison__key budget-comparison__key--remaining"></span>Après reclassement <span class="budget-comparison__key budget-comparison__key--retirement"></span>Retraites · Même échelle pour tous les budgets.${hasEstimates ? '<br>≈ : estimation des retraites et du montant après reclassement.' : ''}</p>
  </div>`;
}
