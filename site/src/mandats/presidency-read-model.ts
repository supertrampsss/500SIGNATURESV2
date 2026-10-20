import type { Game } from './types.ts';
import type { PressureSectorId, PressureProgramme } from './pressure-types.ts';
import { start, decide, isFinished } from './engine.ts';
import { strategyState, strategyLedger } from './presidency-strategy-engine.ts';
import { STRATEGY_SECTORS } from './presidency-strategy-content.ts';
import { NATIONAL_AGENDA } from './national-agenda.ts';
import { policyPressureEffects } from './pressure-content.ts';

/** Read-only v17 projections. Pressure is danger, never service quality. Work
 * and trend do not downgrade danger: conflict/national (or >=72 pressure) is
 * critical; any other non-normal phase (or >=22 pressure) is warning.
 * Clock periods are completed two-month intervals, journal indices include
 * every order and tick. They are never interchangeable. */
export function strategySectorReading(game: Game, sector: PressureSectorId): {
  severity: 'stable' | 'warning' | 'critical'; trend: 'improving' | 'steady' | 'worsening';
  working: boolean; phase: string; label: string; pressure: number;
} {
  const state = strategyState(game).sectors[sector], front = game.pressure!.sectors[sector];
  return {
    severity: state.phase === 'conflict' || state.phase === 'national' || front.pressure >= 72 ? 'critical'
      : state.phase !== 'normal' || front.pressure >= 22 ? 'warning' : 'stable',
    trend: front.trend,
    working: game.pressure!.programmes.some(p => p.sector === sector && p.status === 'preparing'),
    phase: state.phase, label: STRATEGY_SECTORS[sector].label, pressure: front.pressure,
  };
}

export type StrategyCausalReceipt = {
  id: string; sector: PressureSectorId; title: string; choice: string;
  sourceJournalIndex: number; engagedPeriod: number; deliveredPeriod?: number;
  status: 'preparing' | 'delivered' | 'expired'; replayable: boolean;
  cost: number; annualOperating: number; effect: string;
};
const number = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(n);
const signed = (n: number) => `${n > 0 ? '+' : ''}${number(n)}`;
function validOrder(game: Game, index: number, choice: string, period: number): boolean {
  return Number.isInteger(index) && index >= 0 && choice !== 'live-tick'
    && game.choices[index] === choice && game.history[index]?.choice === choice
    && game.choices.slice(0, index).filter(id => id === 'live-tick').length === period;
}
function programmeEffect(programme: PressureProgramme): string {
  // Delivered quantities come from the programme; these are direct recorded
  // effects, not a claim that all subsequent macro/service change is causal.
  const delivered = programme.deliveredTurn !== undefined;
  const capacity = delivered ? programme.appliedCapacity : programme.capacity;
  const need = delivered ? programme.appliedNeed : programme.need;
  const effects = [capacity ? `Capacité ${signed(capacity)} par période.` : '',
    need ? `Besoins ${signed(need)} par période.` : '',
    programme.fatigue ? `Fatigue ${signed(programme.fatigue)} à la livraison.` : ''].filter(Boolean);
  if (!effects.length) effects.push('Mise en service de l’engagement enregistré.');
  if (programme.status === 'completed' && programme.duration) effects.push('Effet temporaire terminé ; les charges acquises restent dans les comptes.');
  else if (!delivered) effects.unshift('Effet attendu après la livraison.');
  return effects.join(' ');
}

/** Inner join by programmeId, never collection order or period. An orphan is
 * omitted; a malformed origin stays readable but cannot launch causal replay.
 * cost is the engine's engagement authorisation, annualOperating a rate in
 * Md€/year, not cumulative expenditure. A routine originates in live-tick and
 * has no presidential decision to replay. */
export function strategyCausalReceipts(game: Game): StrategyCausalReceipt[] {
  return strategyState(game).commitments.flatMap(commitment => {
    const programme = game.pressure!.programmes.find(p => p.id === commitment.programmeId);
    if (!programme) return [];
    return [{
      id: commitment.id, sector: commitment.sector, title: commitment.title, choice: commitment.choice,
      sourceJournalIndex: commitment.sourceJournalIndex, engagedPeriod: commitment.sourcePeriod,
      ...(commitment.deliveredPeriod !== undefined ? { deliveredPeriod: commitment.deliveredPeriod } : {}),
      status: commitment.status,
      replayable: commitment.kind !== 'routine'
        && programme.sourceChoice === commitment.choice && programme.sourceTurn === commitment.sourcePeriod
        && programme.sector === commitment.sector
        && validOrder(game, commitment.sourceJournalIndex, commitment.choice, commitment.sourcePeriod),
      cost: commitment.cost, annualOperating: commitment.annualOperating, effect: programmeEffect(programme),
    }];
  });
}

/** Pure fiscal laws have no programme or meaningful pressure sector. Keep their
 * authentic authored effects and recorded vote in a complementary receipt;
 * never invent a sector merely to fit the physical-programme interface. */
export type StrategyLegislativeReceipt = {
  id: string; title: string; choice: string; sourceJournalIndex: number; engagedPeriod: number;
  status: 'adopted' | 'rejected'; replayable: boolean; cost: number;
  annualOperating: number; annualRevenue: number; effect: string;
  delayed?: { duePeriod: number; label: string; annualOperating: number; annualRevenue: number };
};
export function strategyLegislativeReceipts(game: Game): StrategyLegislativeReceipt[] {
  strategyState(game);
  let period = 0;
  return game.choices.flatMap((choice, sourceJournalIndex) => {
    if (choice === 'live-tick') { period++; return []; }
    const authored = NATIONAL_AGENDA.flatMap(entry => entry.dossier.choices).find(c => c.id === choice);
    if (!authored || policyPressureEffects(authored)) return [];
    const recorded = game.presidency!.reforms.find(r => r.choice === choice && r.period === period);
    const history = game.history[sourceJournalIndex];
    if (!recorded || history?.choice !== choice) return [];
    const adopted = recorded.adopted;
    return [{ id: `legislation-${sourceJournalIndex}-${choice}`, title: history.title, choice,
      sourceJournalIndex, engagedPeriod: period, status: adopted ? 'adopted' as const : 'rejected' as const,
      replayable: validOrder(game, sourceJournalIndex, choice, period),
      cost: adopted ? Math.max(0, authored.effect.investment ?? 0) + Math.max(0, authored.effect.operating ?? 0) : 0,
      annualOperating: adopted ? authored.effect.operating ?? 0 : 0,
      annualRevenue: adopted ? authored.effect.revenue ?? 0 : 0,
      effect: adopted ? authored.benefit : 'Texte rejeté : aucun effet de la proposition engagé.',
      ...(adopted && authored.delayed ? { delayed: {
        duePeriod: period + Math.max(1, authored.delayed.after * 6), label: authored.delayed.label,
        annualOperating: authored.delayed.effect.operating ?? 0, annualRevenue: authored.delayed.effect.revenue ?? 0,
      } } : {}),
    }];
  });
}

export type StrategyFinancialComparison = {
  actual: number; reference: number | null; delta: number | null; periods: number;
  comparable: boolean; referenceEndedEarly: boolean;
};
type Reference = { deficit: number; period: number; year: number; closed: boolean; endedEarly: boolean };
// Only scalar summaries are retained. FIFO 64 horizons bounds memory even when
// many scenarios are inspected; callers never receive a mutable cached object.
const references = new Map<string, Reference>();
function ledgerStatus(game: Game) {
  return { year: game.presidency!.preparedYear,
    closed: game.turn > 0 && game.turn % 6 === 0 && game.presidency!.preparedYear === game.turn / 6
      && game.history.at(-1)?.closed === true };
}
/** Annual deficit, delta=actual-reference, in simulated Md€. The reference
 * repeats only ordinary live-ticks from the same version/seed/ambition, retaining
 * autonomous ministers, finite reserve and queue. Equal clock period AND ledger
 * year/status are required; a prematurely ended reference is never extrapolated.
 * This is a scenario comparison, not attribution of every macro change to orders. */
export function strategyFinancialComparison(game: Game): StrategyFinancialComparison {
  strategyState(game);
  if (!Number.isInteger(game.turn) || game.turn < 0 || game.turn > 30) throw new Error('Horizon v17 invalide.');
  const actual = strategyLedger(game).deficit;
  const key = `${game.version}:${game.seed}:${game.ambition ?? 'equilibre'}:${game.turn}`;
  let reference = references.get(key);
  if (!reference) {
    let passive = start('national', game.seed, game.ambition ?? 'equilibre', game.version);
    for (let period = 0; period < game.turn && !isFinished(passive); period++) passive = decide(passive, 'live-tick');
    reference = { deficit: strategyLedger(passive).deficit, period: passive.turn,
      ...ledgerStatus(passive), endedEarly: passive.turn < game.turn };
    if (references.size >= 64) references.delete(references.keys().next().value!);
    references.set(key, reference);
  }
  const status = ledgerStatus(game);
  const comparable = !reference.endedEarly && reference.period === game.turn
    && reference.year === status.year && reference.closed === status.closed;
  return { actual, reference: comparable ? reference.deficit : null,
    delta: comparable ? actual - reference.deficit : null, periods: game.turn,
    comparable, referenceEndedEarly: reference.endedEarly };
}
