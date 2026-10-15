import type { Effect } from './types.ts';
import type { NarrativeEventRecord } from './narrative-types.ts';

/** All quantities are explicit scenario hypotheses, not measured French backlogs. */
export type PressureSectorId = 'health' | 'housing' | 'transport' | 'energy' | 'education' | 'administration';
export type PressureStage = 'stable' | 'watch' | 'strained' | 'disrupted' | 'crisis';
export type PressureIncidentId = 'cyber-hopital' | 'port-bloque';
export type PressureIncident = {
  id: PressureIncidentId;
  sector: PressureSectorId;
  status: 'active' | 'contained' | 'resolved';
  /** The incident starts only when an actual decision spends this period. */
  startedTurn: number;
  responseProgrammeId?: string;
  resolvedTurn?: number;
};
export type PressureCause = {
  kind: 'inherited' | 'decision' | 'shock' | 'link' | 'delivery' | 'overload' | 'incident';
  turn: number;
  label: string;
  choice?: string;
  direction?: 'increase' | 'reduce' | 'neutral';
};
export type PressureChoice = {
  sector: PressureSectorId;
  kind: 'programme' | 'relief' | 'delegate' | 'defer' | 'maintain';
  label: string;
  /** Capacity and incoming need are units of simulated work per period. */
  capacity?: number;
  need?: number;
  backlog?: number;
  fatigue?: number;
  /** Complete periods after financing, not annual chapters. */
  delay?: number;
  /** Maximum execution units used per period, across a shared finite pool. */
  implementation?: number;
  /** A temporary measure reverses its flow changes after this many periods. */
  duration?: number;
  /** Existing narrative projects must actually deliver before this benefit applies. */
  projectId?: string;
  /** A funded concession only applies after the actual social commitment is kept. */
  socialMovementId?: string;
  /** v14: only actual delivery can contain or resolve an active incident. */
  incidentId?: PressureIncidentId;
  incidentResponse?: 'contain' | 'resolve';
};
export type PressureFront = {
  id: PressureSectorId;
  backlog: number;
  need: number;
  /** This period's total, including finite shocks and seasonal demand. */
  incomingNeed: number;
  capacity: number;
  effectiveCapacity: number;
  fatigue: number;
  pressure: number;
  stage: PressureStage;
  trend: 'improving' | 'steady' | 'worsening';
  lastChange: number;
  pressureChange: number;
  nextRiskIn?: number;
  causes: PressureCause[];
};
export type PressureProgramme = PressureChoice & {
  id: string;
  sourceChoice: string;
  /** Index used by causal replay: the first decision is 0. */
  sourceTurn: number;
  /** Completed-decision count, as in narrative project dueTurn. */
  dueTurn: number;
  status: 'preparing' | 'active' | 'completed' | 'cancelled';
  remainingWork: number;
  deliveredTurn?: number;
  endsTurn?: number;
  appliedCapacity?: number;
  appliedNeed?: number;
  /** Annual rate billed only during active periods, never structural operating. */
  temporaryOperating?: number;
  lastDelayTurn?: number;
};
export type PressureBudget = {
  year: number;
  accruedOperating: number;
  accruedRevenue: number;
  operating: number;
  revenue: number;
};
export type PressureEvent = NarrativeEventRecord & { sector?: PressureSectorId };
export type PressureState = {
  sectors: Record<PressureSectorId, PressureFront>;
  programmes: PressureProgramme[];
  /** Absent from published v13 trajectories. Rebuilt from v14 inputs. */
  incidents?: PressureIncident[];
  execution: { capacity: number; used: number; waiting: number };
  budget: PressureBudget;
  lastDecision: string[];
  lastWorld: string[];
  lastEvents: PressureEvent[];
};
export type PressureTransition = {
  state: PressureState;
  effect: Effect;
  events: PressureEvent[];
  messages: string[];
  unrest: number;
  legitimacy: number;
  support: number;
};
