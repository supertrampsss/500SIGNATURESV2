import type { PressureSectorId } from './pressure-types.ts';
import type { StrategyActionId, StrategyStage } from './presidency-strategy-content.ts';

export type StrategyTransformation = {
  kind: StrategyActionId | 'legislation';
  title: string;
  choice: string;
  period: number;
  capacity: number;
  need: number;
  prevention: number;
};
export type StrategySectorState = {
  phase: 'normal' | StrategyStage;
  phasePeriods: number;
  conflictPeriods: number;
  cause: string;
  warning: string;
  riskIn?: number;
  minister: { competence: number; annualLimit: number; mandate: string };
  routine: { status: 'idle' | 'preparing' | 'operational' | 'limited'; capacity: number; annualOperating: number; committed: number; programmeId?: string; limitedSince?: number };
  transformations: StrategyTransformation[];
  prevention: number;
  vulnerability: number;
  lastDemandPressure: number;
  /** Additional inherited workload forecast at five horizon points, independent
   * of clicks and successes. Smoothed over the clock after the opening. */
  demandForecast: number[];
  demandReason: string;
  appliedDemand: number;
};
export type StrategyCommitment = {
  id: string;
  sector: PressureSectorId;
  kind: StrategyActionId | 'routine' | 'legislation';
  title: string;
  choice: string;
  sourceJournalIndex: number;
  sourcePeriod: number;
  cost: number;
  annualOperating: number;
  teams: number;
  programmeId: string;
  prevention: number;
  supportOnDelivery: number;
  spillovers: Array<{ sector: PressureSectorId; capacity?: number; need?: number; fatigue?: number; prevention?: number }>;
  status: 'preparing' | 'delivered' | 'expired';
  deliveredPeriod?: number;
  secondaryEffect?: import('./types.ts').Effect;
};
export type StrategyState = {
  phase: 'opening' | 'coordination' | 'transformation' | 'legacy';
  phaseReason: string;
  sectors: Record<PressureSectorId, StrategySectorState>;
  commitments: StrategyCommitment[];
  initialBacklog: number;
  initialDeficit: number;
  institutionalStrain: number;
  criticalPeriods: number;
  collapseWarningPeriod?: number;
  coalitionNegotiations: number;
  /** One Assembly examination per clock period, adopted or rejected. */
  lastParliamentPeriod?: number;
  routineInitiatives: number;
  routineCost: number;
  lastMaterialEvents: string[];
  annualReviews: Array<{ year: number; deficit: number; pressure: number; backlog: number; functioning: number }>;
};
export type StrategyObjective = {
  id: 'services' | 'backlog' | 'finances' | 'government';
  title: string;
  current: string;
  target: string;
  met: boolean;
};
export type StrategyOutcome = {
  status: 'ongoing' | 'success' | 'mixed' | 'failure';
  title: string;
  summary: string;
  objectives: StrategyObjective[];
  causes: string[];
  transforms: Array<{ sector: PressureSectorId; title: string; choice: string; period: number }>;
  damages: string[];
  ministries: { initiatives: number; cost: number; detail: string };
  hint: string;
};
