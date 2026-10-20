import type { Game } from './types.ts';
import { decide, isFinished } from './engine.ts';
import { strategyEvents, strategyState } from './presidency-strategy-engine.ts';
import { STRATEGY_SECTOR_IDS, STRATEGY_STAGES } from './presidency-strategy-content.ts';

export type ProjectionStop = 'delivery' | 'alert' | 'decision' | 'annual-close' | 'ending';
export type ProjectionResult = { game: Game; periods: number; stop: ProjectionStop };
const phaseRank = (phase: string) => phase === 'normal' ? 0 : STRATEGY_STAGES.indexOf(phase as typeof STRATEGY_STAGES[number]) + 1;
function decisionIds(game: Game): Set<string> {
  return new Set(strategyEvents(game).filter(event => event.status === 'decision').map(event => event.id));
}
function deliveredOrExpired(before: Game, after: Game): boolean {
  const old = new Map(strategyState(before).commitments.map(c => [c.id, c.status]));
  if (strategyState(after).commitments.some(c => (c.status === 'delivered' || c.status === 'expired') && old.get(c.id) !== c.status)) return true;
  const programmes = new Map(before.pressure!.programmes.map(p => [p.id, p]));
  if (after.pressure!.programmes.some(p =>
    p.deliveredTurn !== undefined && programmes.get(p.id)?.deliveredTurn === undefined
    || p.status === 'completed' && p.duration !== undefined && programmes.get(p.id)?.status !== 'completed')) return true;
  // Pending statutory effects are scheduled data, not matched by message text.
  return before.pending.some(effect => effect.due <= after.turn);
}
function newAlert(before: Game, after: Game): boolean {
  const previous = strategyState(before), next = strategyState(after);
  return STRATEGY_SECTOR_IDS.some(id => phaseRank(next.sectors[id].phase) > phaseRank(previous.sectors[id].phase)
    || previous.sectors[id].routine.status !== 'limited' && next.sectors[id].routine.status === 'limited')
    || previous.collapseWarningPeriod === undefined && next.collapseWarningPeriod !== undefined
    || before.politics!.cabinet !== 'fallen' && after.politics!.cabinet === 'fallen';
}

/** Controlled, read-only v17 observation. Existing decisions remain available;
 * only a new structured change interrupts observation. At coincident boundaries
 * priority is ending > delivery/expiry > worsening alert > new decision > close.
 * Every intermediate state is exclusively decide(previous,'live-tick'); no
 * event-message parsing, balancing, persistence, view imports or test hooks.
 * A finished input returns an independent clone and zero periods. Unsupported
 * versions fail explicitly. The finite 30-period horizon bounds all work. */
export function projectToNextStop(game: Game): ProjectionResult {
  strategyState(game);
  if (!Number.isInteger(game.turn) || game.turn < 0 || game.turn > 30) throw new Error('Horizon v17 invalide.');
  let current = structuredClone(game);
  if (isFinished(current)) return { game: current, periods: 0, stop: 'ending' };
  for (let periods = 1; periods <= 30 - game.turn; periods++) {
    const next = decide(current, 'live-tick');
    let stop: ProjectionStop | undefined;
    if (isFinished(next)) stop = 'ending';
    else if (deliveredOrExpired(current, next)) stop = 'delivery';
    else if (newAlert(current, next)) stop = 'alert';
    else {
      const previousDecisions = decisionIds(current);
      if ([...decisionIds(next)].some(id => !previousDecisions.has(id))) stop = 'decision';
      else if (next.history.at(-1)?.closed) stop = 'annual-close';
    }
    if (stop) return { game: next, periods, stop };
    current = next;
  }
  // The canonical engine ends at P30; this guard fails closed if that contract
  // ever changes rather than silently issuing unbounded ticks.
  throw new Error('La projection v17 a atteint son horizon sans arrêt.');
}
