import type { Choice } from './types.ts';

export type PoliticalBlocId = 'presidential' | 'reformist' | 'social' | 'conservative' | 'regional';
export type PendingCrisis = 'coalition' | 'censure' | 'cabinet' | 'scandal' | 'destitution' | 'rupture';
export type PoliticalAction = 'enact' | 'coalition_bargain' | 'reject_bargain' | 'confidence' | 'censure' | 'coalition_government' | 'dissolve' | 'publish_scandal' | 'cover_up' | 'destitute' | 'negotiate_rupture' | 'emergency_rule';
export type PoliticalChoice = {
  action: PoliticalAction;
  targetBloc?: PoliticalBlocId;
  supportDelta?: Partial<Record<PoliticalBlocId, number>>;
  legitimacy?: number;
  unrest?: number;
  commitment?: { id: string; label: string; dueTurn: number };
  breakCommitment?: string;
  misconduct?: number;
  /** Specific vote kind when an action needs a parliamentary decision. */
  vote?: 'law' | 'censure' | 'election' | 'destitution';
};
export type PoliticalBloc = { id: PoliticalBlocId; label: string; seats: number; loyalty: number; inGovernment: boolean };
export type Commitment = { id: string; label: string; dueTurn: number; status: 'pending' | 'honored' | 'broken' };
export type VoteGroup = { id: PoliticalBlocId; label: string; for: number; against: number; abstain: number; seats?: number };
export type VoteRecord = {
  id: string; kind: 'law' | 'censure' | 'election' | 'destitution'; title: string; chamber: string;
  total: number; for: number; against: number; abstain: number; threshold: number; passed: boolean;
  groups: VoteGroup[]; consequences: string[]; stages?: Array<{ chamber: string; total: number; for: number; against: number; abstain: number; threshold: number; passed: boolean; groups: VoteGroup[] }>;
};
export type PoliticalEnding = { kind: 'resignation' | 'destitution' | 'rupture' | 'term_complete'; title: string; reason: string; turn: number; causes: string[] };
export type PoliticalState = {
  blocs: PoliticalBloc[]; legitimacy: number; unrest: number; cabinet: 'stable' | 'fallen' | 'cohabitation';
  commitments: Commitment[]; lastVote?: VoteRecord; votes: VoteRecord[]; pendingCrisis?: PendingCrisis;
  scandalExposure: number; misconduct: number; failedBills: number; emergencyUses: number; lastDissolutionTurn?: number; ending?: PoliticalEnding;
};
export type PoliticalResolution = { choice: Choice; vote?: VoteRecord; consequences: string[]; ending?: PoliticalEnding };
