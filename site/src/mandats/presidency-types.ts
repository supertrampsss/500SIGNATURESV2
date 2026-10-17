import type { PresidencyCrisis } from './presidency-crises.ts';
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
  crises?: PresidencyCrisis[];
  /** Civil escalation is clock-owned and separate from local incident slots. */
  civic?: { crisis?: PresidencyCrisis; nextPeriod: number; sustained: number; serial: number; cabinetResignationPeriod?: number };
  reformEvents?: Array<{ id: string; offeredPeriod: number; availablePeriod?: number; expiresPeriod?: number; reason?: string; deferred?: boolean }>;
  reformArchive?: Array<{ id: string; period: number; outcome: 'expired' | 'withdrawn' }>;
  cabinet?: { serial: number; name: string; appointedPeriod: number; agreement?: { name: string; period: number }; attempts: Array<{ choice: string; period: number }> };
  lastFeedback?: { status: 'adopted' | 'rejected' | 'engaged' | 'delivered' | 'information'; title: string; detail: string };
  nextReformPeriod?: number;
  nextCrisisPeriod?: number;
  quietUntilPeriod?: number;
  reserve: number;
  authorised: number;
  spent: number;
  autonomy: boolean;
  priority: PressureSectorId | null;
  initiativeSerial?: number;
  initiatives: PresidencyInitiative[];
  reforms: Array<{ id: string; choice: string; period: number; adopted: boolean }>;
  redeploymentYears?: number[];
  budgetHoldYears?: number[];
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
