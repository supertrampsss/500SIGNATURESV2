import type { Effect } from './types.ts';

export type NarrativeContext = 'coalition' | 'hospital' | 'redress';
export type StoryUrgency = string | number;
export type StoryAgendaItem = {
  id: string;
  title: string;
  category: string;
  summary: string;
  art: string;
  urgency: StoryUrgency;
  dueTurn?: number;
};
export type Amendment = { id: string; label: string; effect: Effect; support: number };
export type NarrativeProjectStatus = 'funded' | 'blocked' | 'delivered' | 'withdrawn';
export type NarrativePromiseStatus = 'active' | 'kept' | 'broken';
export type NarrativePromise = { id: string; label: string; status: NarrativePromiseStatus; causeTurn?: number; dueTurn?: number; resolvedTurn?: number; targetProject?: string; keepWhen?: 'project_delivered' | 'deficit_lower' | 'coalition_stable' | 'services_improved' | 'programme_executed'; funded?: boolean; baseline?: number };
export type NarrativeProject = {
  id: string; kind: string; label: string; place: string; status: NarrativeProjectStatus;
  startedTurn: number; dueTurn: number; sourceChoice: string; deliveredTurn?: number; resolvedTurn?: number; failureTurn?: number; causeTurn?: number; remediationChoice?: string; deliveryEffect?: Effect; pressByStatus?: Partial<Record<NarrativeProjectStatus,string>>; note: string;
};
export type NarrativeRelationship = { id: string; name: string; role: string; loyalty: number; stance: string; lastTurn?: number };
export type NarrativeEventRecord = { id: string; turn: number; kind: string; title: string; detail: string; causeTurn: number; weight: number; sourceEventId?: string };
export type NarrativeState = {
  context: NarrativeContext;
  promiseCandidates?: Array<{id:string;label:string}>;
  focus?: string;
  deferred?: Array<{ eventId: string; dueTurn: number; expiresTurn: number; originTurn: number }>;
  retiredEvents?: string[];
  promises: NarrativePromise[];
  projects: NarrativeProject[];
  relationships: NarrativeRelationship[];
  events: NarrativeEventRecord[];
  lastConsequences: string[];
};

export type NarrativeChoice = {
  id: string; title: string; description: string; cost: string; benefit: string; sacrifice: string;
  effect: Effect; delayed?: { after: number; label: string; effect: Effect };
  political?: import('./politics-types.ts').PoliticalChoice;
  amendment?: Amendment;
  promise?: { id: string; label: string; dueAfter?: number; targetProject?: string; keepWhen?: NarrativePromise['keepWhen'] };
  project?: { id: string; kind: string; label: string; place: string; dueAfter: number; repair?: boolean; action?: 'fund'|'repair'|'withdraw'; deliveryEffect?: Effect;
    pressByStatus?: Partial<Record<NarrativeProjectStatus, string>> };
  relationships?: Partial<Record<'presidential' | 'reformist' | 'social' | 'conservative' | 'regional', number>>;
  press?: string;
};
export type NarrativeEvent = {
  id: string; familyId: string; title: string; body: string;
  turns?: number[]; contexts?: NarrativeContext[]; requiresProject?: string; requiresProjectStatus?: NarrativeProjectStatus;
  choices: NarrativeChoice[];
};
export type NarrativeFamily = Pick<StoryAgendaItem,'id'|'title'|'category'|'summary'|'art'|'urgency'> & { reformRefs?: string[] };
export type NarrativeObjective = { id: string; label: string; complete: boolean; progress: string };
export type NarrativeEpilogue = { kind: 'transition'|'renewed'|'fragile_majority'|'no_majority'|'alternation'; title: string; detail: string; governmentSeats: number; legitimacy: number; headline: string; character?: string };
