/** Read retained real trajectories; distinguish temporary cover from durable capacity. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PressureProgramme, PressureFront } from '../src/mandats/pressure-types.ts';
import type { Metrics } from '../src/mandats/types.ts';

type Snapshot = {
  turn: number; debt: number; deficit: number; metrics: Metrics;
  sectors: Record<string, Pick<PressureFront, 'capacity' | 'need' | 'effectiveCapacity' | 'pressure' | 'backlog' | 'stage'>>;
  programmes: PressureProgramme[]; execution: { capacity: number; used: number; waiting: number };
};
type Trajectory = {
  scenario: string; seed: number; ambition: string; strategy: string; endTurn: number;
  decisionTypes: Record<string, number>; interventionAttempts: Record<string, number>;
  adoptedInterventions: Record<string, number>; snapshots: Snapshot[];
};
type AuditSummary = {
  sourceChangedDuringRun: boolean; invariantChecks: number; invariantViolations: number;
  sourceAtStart: Record<string, string>; coverage: Record<string, unknown>;
  gaps: { authoredMappingsNotPlayed: string[]; institutionalEndingsNotEncountered: string[] };
};

const directory = resolve(process.argv[2] ?? 'pressure-artifacts/model-final');
const trajectories = JSON.parse(await readFile(resolve(directory, 'trajectories.json'), 'utf8')) as Trajectory[];
const audit = JSON.parse(await readFile(resolve(directory, 'summary.json'), 'utf8')) as AuditSummary;
const round = (value: number) => Math.round(value * 1000) / 1000;
const prematureDeliveries: Array<{ scenario: string; turn: number; programme: string }> = [];
const profiles = trajectories.map(trace => {
  const last = trace.snapshots.at(-1)!;
  const initial = trace.snapshots[0];
  const active = last.programmes.filter(p => p.status === 'active' && p.duration !== undefined);
  const sectors = Object.fromEntries(Object.entries(last.sectors).map(([id, front]) => {
    const support = active.filter(p => p.sector === id);
    const temporaryCapacity = support.reduce((sum, p) => sum + (p.appliedCapacity ?? 0), 0);
    const temporaryNeed = support.reduce((sum, p) => sum + (p.appliedNeed ?? 0), 0);
    return [id, {
      pressure: front.pressure, backlog: front.backlog,
      capacity: front.capacity, capacityWithoutTemporarySupport: round(front.capacity - temporaryCapacity),
      temporaryCapacity: round(temporaryCapacity), need: front.need,
      needWithoutTemporarySupport: round(front.need - temporaryNeed),
      initialCapacity: initial.sectors[id].capacity, initialNeed: initial.sectors[id].need,
      temporarySupportEnds: support.map(p => ({ sourceChoice: p.sourceChoice, endsTurn: p.endsTurn })),
    }];
  }));
  for (const snapshot of trace.snapshots) for (const p of snapshot.programmes) {
    if (p.deliveredTurn !== undefined && (p.deliveredTurn < p.dueTurn || p.remainingWork > 0.001)) {
      prematureDeliveries.push({ scenario: trace.scenario, turn: snapshot.turn, programme: p.id });
    }
  }
  const emergencyDecisions = (trace.interventionAttempts.relief ?? 0) + (trace.interventionAttempts.delegate ?? 0);
  const temporaryCapacity = Object.values(sectors).reduce((sum, sector) => sum + sector.temporaryCapacity, 0);
  const totalCapacity = Object.values(last.sectors).reduce((sum, front) => sum + front.capacity, 0);
  return {
    scenario: trace.scenario, seed: trace.seed, ambition: trace.ambition, strategy: trace.strategy,
    endTurn: trace.endTurn, debt: last.debt, deficit: last.deficit, metrics: last.metrics,
    meanPressure: round(Object.values(last.sectors).reduce((sum, front) => sum + front.pressure, 0) / 6),
    crisisSectors: Object.entries(last.sectors).filter(([, s]) => s.stage === 'crisis').map(([id]) => id),
    decisions: trace.decisionTypes, interventionAttempts: trace.interventionAttempts,
    adoptedInterventions: trace.adoptedInterventions,
    emergencyDecisionShare: round(emergencyDecisions / Math.max(1, trace.endTurn - initial.turn)),
    activeTemporaryProgrammes: active.length, activeTemporaryCapacityShare: round(temporaryCapacity / Math.max(1, totalCapacity)),
    sectors, maximumWaiting: Math.max(...trace.snapshots.map(s => s.execution.waiting)),
    milestones: trace.snapshots.filter(s => [12, 24, 30].includes(s.turn)).map(s => ({ turn: s.turn, debt: s.debt, deficit: s.deficit,
      meanPressure: round(Object.values(s.sectors).reduce((sum, front) => sum + front.pressure, 0) / 6),
      crises: Object.values(s.sectors).filter(front => front.stage === 'crisis').length,
      waiting: s.execution.waiting })),
  };
});
const review = {
  schema: 1, sourceAtStart: audit.sourceAtStart, sourceChangedDuringRun: audit.sourceChangedDuringRun,
  invariantChecks: audit.invariantChecks, invariantViolations: audit.invariantViolations,
  prematureDeliveryViolations: prematureDeliveries,
  scope: 'Profils calculés depuis des décisions légales conservées. La présence de secours actifs est distincte de la capacité durable ; aucun scénario après le dernier tour n’est inventé.',
  profiles, coverage: audit.coverage, gaps: audit.gaps,
  limits: [
    'Trois seeds représentent trois ouvertures, sans constituer un échantillon statistique de tous les mandats.',
    'Les priorités de mandat peuvent partager une trajectoire physique ; elles ne sont pas trois seeds indépendantes.',
    'Les décisions institutionnelles imposées peuvent comporter des engagements hors de la préférence de la stratégie.',
    'Un secteur stable à la dernière période peut encore dépendre d’un secours qui arrive bientôt à son terme.',
    'Les hypothèses de besoins et de capacités ne sont pas des observations de la France.',
  ],
};
await writeFile(resolve(directory, 'review.json'), JSON.stringify(review, null, 2));
process.stdout.write(`${JSON.stringify({ directory, profiles: profiles.length, prematureDeliveries: prematureDeliveries.length, sourceChangedDuringRun: audit.sourceChangedDuringRun })}\n`);
if (prematureDeliveries.length || audit.invariantViolations || audit.sourceChangedDuringRun) process.exitCode = 1;
