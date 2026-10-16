import type { PressureSectorId } from './pressure-types.ts';

/** V16 deterministic scenario state. Credits authorise interventions; they are
 * neither the APU cash balance nor revenue. All amounts are fictional Md€. */
export type PresidencyInitiative = {
  id: string;
  period: number;
  actor: 'president' | 'government';
  sector?: PressureSectorId;
  title: string;
  detail: string;
  cost: number;
  choice: string;
  status: 'engaged' | 'rejected' | 'delivered' | 'information';
};
export type PresidencyState = {
  reserve: number;
  authorised: number;
  spent: number;
  autonomy: boolean;
  priority: PressureSectorId | null;
  initiatives: PresidencyInitiative[];
  reforms: Array<{ id: string; choice: string; period: number; adopted: boolean }>;
  creditsRequested: number;
  creditYears: number[];
  /** Annual preparation happens once, even with several orders before a tick. */
  preparedYear: number;
  budget: { year: number; accruedOperating: number; accruedRevenue: number };
  lastEvents: string[];
};
export type PresidencyOrder = {
  /** Investment + one year of permanent running cost, or all finite running cost. */
  cost: number;
  /** Two-month clock periods, never number of clicks. */
  delay: number;
  implementation: number;
  unavailable?: string;
};
