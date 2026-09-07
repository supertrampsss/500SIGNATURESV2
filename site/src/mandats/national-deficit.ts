import { nationalBudget } from './national.ts';
import type { Finance, Game } from './types.ts';

/** Rounded game anchor, not a reconstruction or forecast of the national accounts.
 * Insee Première 2106, 29 May 2026: 2025 consolidated APU deficit = 152.5 Md€.
 * https://www.insee.fr/fr/statistiques/8997691 */
export const INITIAL_DEFICIT = 153;
export const DEFICIT_SOURCE = 'https://www.insee.fr/fr/statistiques/8997691';

export function deficitBaseline(finance: Finance): Finance {
  return { ...finance, operating: finance.revenue + INITIAL_DEFICIT - finance.investment - finance.debt * finance.rate };
}

/** The latest ledger is the current plan or the last closed budget.
 * Recomputing after a closing would charge interest on the newly accrued debt
 * to the year that has just ended. The next plan is prepared on the next choice. */
export function annualDeficit(game: Game): number {
  return game.history.at(-1)?.ledger.deficit ?? nationalBudget(game.finance).deficit;
}
