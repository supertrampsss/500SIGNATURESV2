import { echapper } from './texte.ts';

export type BudgetComparisonRow = {
  label: string;
  /** Montants en euros, issus de données monétaires, jamais d'une part lue sur un graphique. */
  budget: number;
  retirement: number | null;
  estimated?: boolean;
};

function milliards(euros: number): string {
  const value = euros / 1e9;
  // A positive amount below the rounding threshold must not look like a true zero.
  if (value > 0 && value < .005) return '< 0,01';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
}

function amount(euros: number | null): string {
  return `<span class="budget-comparison__value">${euros === null ? '—' : echapper(milliards(euros))}</span>`;
}

function cell(euros: number | null, maximum: number, kind: 'budget' | 'retirement' | 'remaining', estimated = false): string {
  // No minimum fill: a true zero or an unavailable value has an empty track.
  const fill = euros !== null && euros > 0
    ? `<span class="budget-comparison__spark-fill budget-comparison__spark-fill--${kind}" style="width:${euros / maximum * 100}%"></span>`
    : '';
  const accessible = euros === null ? ' aria-label="Non disponible"' : estimated
    ? ` data-estimated="true" aria-label="${echapper(milliards(euros))} milliards d’euros, ${kind === 'remaining' ? 'budget restant après déduction des cotisations salariales estimées' : 'financement des retraites comprenant des cotisations salariales estimées'}"` : '';
  return `<td role="cell" class="budget-comparison__${kind}"${accessible}><span class="budget-comparison__cell">${amount(euros)}<span class="budget-comparison__spark" aria-hidden="true">${fill}</span></span></td>`;
}

/** One semantic table; all three monetary columns share the same euro scale. */
export function budgetComparison(rows: readonly BudgetComparisonRow[]): string {
  for (const row of rows) {
    if (!Number.isFinite(row.budget) || row.budget < 0
      || (row.retirement !== null && (!Number.isFinite(row.retirement) || row.retirement < 0 || row.retirement > row.budget))) {
      throw new RangeError(`Montants budgétaires invalides : ${row.label}`);
    }
  }
  const maximum = Math.max(0, ...rows.map(row => row.budget));
  const body = rows.map(row => {
    const remaining = row.retirement === null ? null : row.budget - row.retirement;
    return `<tr class="budget-comparison__row" role="row" data-budget-eur="${row.budget}"${row.retirement !== null ? ` data-retirement-eur="${row.retirement}" data-remaining-eur="${remaining}"` : ''}>
      <th role="rowheader" scope="row">${echapper(row.label)}</th>
      ${cell(row.budget, maximum, 'budget')}
      ${cell(row.retirement, maximum, 'retirement', !!row.estimated)}
      ${cell(remaining, maximum, 'remaining', !!row.estimated)}
    </tr>`;
  }).join('');
  return `<div class="budget-comparison" data-scale-maximum-eur="${maximum}">
    <table class="budget-comparison__table" role="table">
      <caption>Budgets des ministères, en milliards d’euros</caption>
      <colgroup><col class="budget-comparison__name-column"><col><col><col></colgroup>
      <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Ministère</th><th scope="col" role="columnheader">Budget affiché <span class="budget-comparison__unit">Md€</span></th><th scope="col" role="columnheader">Ponctionné pour financer les retraites <span class="budget-comparison__unit">Md€</span></th><th scope="col" role="columnheader">Budget restant <span class="budget-comparison__unit">Md€</span></th></tr></thead>
      <tbody role="rowgroup">${body}</tbody>
    </table>
  </div>`;
}
