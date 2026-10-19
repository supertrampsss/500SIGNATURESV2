/**
 * Bounded, legal-input audit of the v17 presidential strategy.
 * Failure hypotheses precede implementation in docs/mandats-strategy-v17.md.
 * This is a simulation audit, not a human playtest or an exhaustive search.
 * Run: node --experimental-strip-types scripts/mandats-strategy-audit.ts
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { decide, isFinished, replayGame, start } from '../src/mandats/engine.ts';
import { decode, encode } from '../src/mandats/storage.ts';
import { socialYearEnd } from '../src/mandats/national-society.ts';
import {
  strategyActions, strategyChoices, strategyDecide, strategyEvents, strategyLedger,
  strategyOutcome, strategyReforms, strategyStart, strategyState,
} from '../src/mandats/presidency-strategy-engine.ts';
import type { PressureSectorId } from '../src/mandats/pressure-types.ts';
import type { Ambition, Choice, Game } from '../src/mandats/types.ts';

type Policy = 'capacity' | 'organisation' | 'autonomy' | 'neglect' | 'late-correction' | 'overcommit' | 'one-order';
type Issue = { scenario: string; period: number; message: string; choice?: string };
const sectors: PressureSectorId[] = ['health', 'housing', 'transport', 'energy', 'education', 'administration'];
const seeds = [0, 1, 2, 47];
const policies: Policy[] = ['capacity', 'organisation', 'autonomy', 'neglect', 'late-correction', 'overcommit'];
const output = resolve(process.env.MANDATS_STRATEGY_OUTPUT ?? 'strategy-artifacts/model');
const modules = ['engine.ts', 'campaign.ts', 'types.ts', 'presidency-api.ts', 'presidency-types.ts',
  'presidency-engine.ts', 'presidency-crises.ts', 'presidency-strategy-types.ts',
  'presidency-strategy-content.ts', 'presidency-strategy-engine.ts', 'pressure-types.ts',
  'pressure-engine.ts', 'pressure-content.ts', 'pressure-recovery.ts', 'national-agenda.ts',
  'narrative-engine.ts', 'narrative-consequences.ts', 'narrative-content.ts', 'politics.ts',
  'political-dilemmas.ts', 'social-engine.ts', 'social-content.ts', 'storage.ts'];
async function manifest() {
  return Object.fromEntries(await Promise.all([
    ...modules.map(async path => [path,
      createHash('sha256').update(await readFile(new URL(`../src/mandats/${path}`, import.meta.url))).digest('hex')]),
    (async () => ['audit-script', createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex')])(),
  ]));
}
const startedAt = new Date().toISOString();
const baseCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceAtStart = await manifest();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const issues: Issue[] = [];
let invariantChecks = 0;
const coverage = { ticks: 0, orders: 0, annualClosings: 0, governmentInitiatives: 0, deliveries: 0,
  unavailableRefusals: 0, duplicateRefusals: 0, executionContention: 0, rejectedVotes: 0,
  adoptedVotes: 0, transformations: 0, recoveredTrajectories: 0, quietTrajectories: 0,
  fullMandates: 0, legacyTransitions: 0 };
function check(ok: unknown, scenario: string, period: number, message: string, choice?: string) {
  invariantChecks++;
  if (ok) return;
  const issue = { scenario, period, message, ...(choice ? { choice } : {}) };
  issues.push(issue);
  if (issues.length <= 25) process.stderr.write(`${JSON.stringify(issue)}\n`);
}
function numeric(value: unknown, path = '', result: Record<string, number> = {}) {
  if (typeof value === 'number') result[path] = value;
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) numeric(item, `${path}/${key}`, result);
  return result;
}
function fronts(g: Game) {
  return Object.fromEntries(sectors.map(id => {
    const f = g.pressure!.sectors[id];
    return [id, { pressure: f.pressure, backlog: f.backlog, capacity: f.capacity, effectiveCapacity: f.effectiveCapacity,
      need: f.need, incomingNeed: f.incomingNeed, fatigue: f.fatigue, stage: f.stage }];
  })) as Record<PressureSectorId, { pressure: number; backlog: number; capacity: number; effectiveCapacity: number;
    need: number; incomingNeed: number; fatigue: number; stage: string }>;
}
function options(g: Game, legal = true) {
  const choices = [...sectors.flatMap(sector => strategyActions(g, sector)), ...strategyReforms(g).flatMap(r => r.choices)];
  return [...new Map(choices.map(choice => [choice.id, choice])).values()]
    .filter(choice => !legal || !choice.presidencyOrder?.unavailable);
}
function meanPressure(g: Game) { return sectors.reduce((n, id) => n + g.pressure!.sectors[id].pressure, 0) / sectors.length; }
function backlog(g: Game) { return sectors.reduce((n, id) => n + g.pressure!.sectors[id].backlog, 0); }
function kind(id: string) {
  return id === 's17-coalition-pact' ? 'coalition' : id.startsWith('s17-') ? id.split('-').at(-1)!
    : id.startsWith('live-priority-') ? 'priority' : id.startsWith('live-') ? id : 'legislation';
}
function view(g: Game) {
  const before = JSON.stringify(g);
  const state = strategyState(g), choices = options(g, false), events = strategyEvents(g), outcome = strategyOutcome(g);
  check(JSON.stringify(g) === before, `inspection-${g.seed}`, g.turn, 'Lire les objectifs ou les événements modifie le mandat.');
  if (events.some(e => e.id === 's17-funding')) {
    const missed = outcome.objectives.some(o => (o.id === 'services' || o.id === 'backlog') && !o.met);
    const realNeed = sectors.some(sector => {
      const front = g.pressure!.sectors[sector];
      const useful = front.pressure >= 35 || front.backlog > 0 && front.lastChange > .2 || missed && front.backlog > .01;
      const preparing = state.commitments.some(c => c.sector === sector && c.status === 'preparing' && c.kind !== 'routine' && c.kind !== 'recovery');
      return useful && !preparing && strategyActions(g, sector).some(c =>
        (c.presidencyOrder?.cost ?? 0) > g.presidency!.reserve && /disponibles.*nécessaires/.test(c.presidencyOrder?.unavailable ?? ''));
    });
    check(realNeed, `budget-pin-${g.seed}`, g.turn, 'Une réserve basse crée une alerte sans intervention utile réellement non financée.');
  }
  if (g.turn > 0 && g.turn % 6 === 0 && g.turn < 30 && !isFinished(g)) {
    const forecast = strategyDecide(g, 'live-priority-health');
    const deficit = strategyLedger(forecast).deficit;
    const objective = outcome.objectives.find(o => o.id === 'finances')!;
    const formatted = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(deficit);
    check(objective.met === (deficit <= state.initialDeficit + .01) && objective.current.includes(formatted),
      `finance-boundary-${g.seed}`, g.turn, 'L’objectif financier à la frontière annuelle utilise le livre clos au lieu de la prévision suivante.');
    check(same(strategyLedger(g), g.history.at(-1)!.ledger) && JSON.stringify(g) === before,
      `finance-boundary-${g.seed}`, g.turn, 'La prévision d’objectif réécrit le livre annuel clos ou l’état sauvegardé.');
  }
  return { period: g.turn, journalIndex: g.choices.length, sectors: fronts(g), finance: structuredClone(g.finance),
    ledger: strategyLedger(g), reserve: g.presidency!.reserve, spent: g.presidency!.spent,
    teams: structuredClone(g.pressure!.execution), phase: state.phase, phaseReason: state.phaseReason,
    institutionalStrain: state.institutionalStrain, routineInitiatives: state.routineInitiatives,
    commitments: structuredClone(state.commitments), outcome,
    sectorsStrategy: structuredClone(state.sectors),
    choices: choices.map(c => ({ id: c.id, kind: kind(c.id), title: c.title, cost: c.presidencyOrder?.cost,
      delay: c.presidencyOrder?.delay, teams: c.presidencyOrder?.implementation, blocked: c.presidencyOrder?.unavailable,
      benefit: c.benefit, sacrifice: c.sacrifice })),
    events: events.map(e => ({ id: e.id, kind: e.kind, title: e.title, sector: e.sector, status: e.status,
      choices: e.choices.map(c => c.id) })) };
}
type Snapshot = ReturnType<typeof view>;
function reject(g: Game, id: string, scenario: string, duplicate = false) {
  const original = JSON.stringify(g); let rejected = false;
  try { strategyDecide(g, id); } catch { rejected = true; }
  check(rejected && JSON.stringify(g) === original, scenario, g.turn,
    duplicate ? 'Un second engagement identique est accepté ou modifie l’entrée.' : 'Un ordre indisponible est accepté ou modifie l’entrée.', id);
  if (duplicate) coverage.duplicateRefusals++; else coverage.unavailableRefusals++;
}
function transition(g: Game, id: string, scenario: string, offered?: Choice) {
  const original = JSON.stringify(g), after = strategyDecide(g, id), tick = id === 'live-tick';
  check(JSON.stringify(g) === original, scenario, g.turn, 'Le moteur modifie son entrée.', id);
  check(after.turn === g.turn + (tick ? 1 : 0), scenario, after.turn, 'Le calendrier avance sans période, ou omet une période.', id);
  check(after.choices.length === g.choices.length + 1 && same(after.choices.slice(0, -1), g.choices) && after.choices.at(-1) === id,
    scenario, after.turn, 'Le journal ne conserve pas exactement la décision reçue.', id);
  check(after.history.length === after.choices.length && after.history.at(-1)?.choice === id,
    scenario, after.turn, 'Le résultat enregistré ne correspond pas au journal.', id);
  check(!Object.values(numeric(after)).some(n => !Number.isFinite(n)), scenario, after.turn, 'Valeur numérique non finie.', id);
  const p = after.presidency!, old = g.presidency!, state = strategyState(after), before = strategyState(g);
  const pressureText = [...Object.values(after.pressure!.sectors).flatMap(f => f.causes.map(c => c.label)),
    ...after.pressure!.lastEvents.map(e => e.title), ...after.pressure!.lastWorld];
  check(!pressureText.some(text => /besoins du chapitre évoluent|besoins tendanciels du scénario/i.test(text)),
    scenario, after.turn, 'Un message de besoins legacy décrit une variation physique absente en v17.', id);
  check(p.reserve >= -0.001 && p.spent >= old.spent - 0.001 && Math.abs(p.reserve - p.authorised + p.spent) <= 0.003,
    scenario, after.turn, 'Autorisations, engagements et disponible ne se conservent pas.', id);
  const engaged = p.initiatives.filter(i => i.status === 'engaged' && !old.initiatives.some(o => o.id === i.id));
  check(Math.abs(p.spent - old.spent - engaged.reduce((n, i) => n + i.cost, 0)) <= 0.003,
    scenario, after.turn, 'Une dépense n’a pas son engagement, ou un engagement est débité deux fois.', id);
  coverage.governmentInitiatives += engaged.filter(i => i.actor === 'government').length;
  const teams = after.pressure!.execution;
  check(teams.used >= 0 && teams.used <= teams.capacity + 0.001 && teams.waiting >= 0,
    scenario, after.turn, 'La file utilise des équipes inexistantes.', id);
  if (teams.waiting > 0 && teams.used >= teams.capacity - 0.001) coverage.executionContention++;
  check(new Set(state.commitments.map(c => c.id)).size === state.commitments.length,
    scenario, after.turn, 'Un engagement possède deux entrées identiques.', id);
  for (const sector of sectors) check(state.commitments.filter(c => c.kind === 'routine' && c.sector === sector).length <= 1,
    scenario, after.turn, `Le secours courant se renouvelle en engagements identiques : ${sector}`, id);
  check(new Set(after.pressure!.programmes.map(c => c.id)).size === after.pressure!.programmes.length,
    scenario, after.turn, 'Un chantier possède deux entrées identiques.', id);
  for (const commitment of state.commitments) {
    const programme = after.pressure!.programmes.find(c => c.id === commitment.programmeId);
    check(!!programme, scenario, after.turn, `Engagement sans chantier : ${commitment.id}`, id);
    check(commitment.sourcePeriod <= after.turn && commitment.sourceJournalIndex < after.choices.length,
      scenario, after.turn, `Origine incohérente : ${commitment.id}`, id);
    const previous = before.commitments.find(c => c.id === commitment.id);
    if (!previous) check(tick || commitment.status === 'preparing', scenario, after.turn,
      `Un engagement livre pendant le clic : ${commitment.id}`, id);
    if (commitment.deliveredPeriod !== undefined && previous?.deliveredPeriod === undefined) {
      coverage.deliveries++;
      check(tick && commitment.deliveredPeriod === after.turn && programme?.deliveredTurn === after.turn && programme.remainingWork <= 0.001,
        scenario, after.turn, `Livraison prématurée ou sans travail achevé : ${commitment.id}`, id);
    }
    if (previous?.deliveredPeriod !== undefined) check(commitment.deliveredPeriod === previous.deliveredPeriod,
      scenario, after.turn, `Une livraison est répétée : ${commitment.id}`, id);
  }
  for (const sector of sectors) {
    const f = after.pressure!.sectors[sector];
    check(f.backlog >= 0 && f.need >= 0 && f.capacity >= 0 && f.pressure >= 0 && f.pressure <= 100,
      scenario, after.turn, `Stock, flux ou pression hors domaine : ${sector}`, id);
    const transforms = state.sectors[sector].transformations;
    check(new Set(transforms.map(t => t.choice)).size === transforms.length,
      scenario, after.turn, `Transformation permanente appliquée deux fois : ${sector}`, id);
    for (const transform of transforms) check(state.commitments.some(c => c.choice === transform.choice && c.sector === sector && c.deliveredPeriod !== undefined),
      scenario, after.turn, `Transformation sans engagement livré : ${transform.choice}`, id);
    const delivered = after.pressure!.programmes.filter(c => c.sector === sector && c.deliveredTurn !== undefined
      && g.pressure!.programmes.find(old => old.id === c.id)?.deliveredTurn === undefined);
    const expired = after.pressure!.programmes.filter(c => c.sector === sector && c.duration && c.status === 'completed'
      && g.pressure!.programmes.find(old => old.id === c.id)?.status === 'active');
    const spillovers = state.commitments.filter(c => c.deliveredPeriod !== undefined
      && before.commitments.find(old => old.id === c.id)?.deliveredPeriod === undefined)
      .flatMap(c => c.spillovers).filter(link => link.sector === sector);
    const expectedCapacityChange = delivered.reduce((n, c) => n + (c.appliedCapacity ?? 0), 0)
      - expired.reduce((n, c) => n + (c.appliedCapacity ?? 0), 0) + spillovers.reduce((n, link) => n + (link.capacity ?? 0), 0);
    check(Math.abs(f.capacity - g.pressure!.sectors[sector].capacity - expectedCapacityChange) < 0.004,
      scenario, after.turn, `La capacité physique diverge des livraisons, expirations et effets intersectoriels : ${sector}`, id);
  }
  const votes = (after.politics?.votes ?? []).slice(g.politics?.votes.length ?? 0);
  for (const vote of votes) {
    if (vote.passed) coverage.adoptedVotes++; else {
      coverage.rejectedVotes++;
      check(after.presidency!.spent === old.spent && after.pressure!.programmes.length === g.pressure!.programmes.length,
        scenario, after.turn, 'Un vote rejeté engage la dépense ou finance un chantier.', id);
    }
  }
  if (!tick) {
    coverage.orders++;
    check(same(fronts(g), fronts(after)), scenario, after.turn, 'Un clic fait évoluer les stocks physiques avant l’horloge.', id);
    check(after.finance.debt === g.finance.debt, scenario, after.turn, 'Un ordre clôture la dette.', id);
    check(g.pressure!.programmes.every(c => {
      const a = after.pressure!.programmes.find(x => x.id === c.id);
      return a && a.remainingWork === c.remainingWork && a.deliveredTurn === c.deliveredTurn;
    }), scenario, after.turn, 'Un ordre fait travailler un chantier.', id);
    if (offered && !votes.some(v => !v.passed)) check(Math.abs(p.spent - old.spent - (offered.presidencyOrder?.cost ?? 0)) <= 0.003,
      scenario, after.turn, 'Le coût débité diffère de celui annoncé avant l’ordre.', id);
  } else {
    coverage.ticks++;
    check(after.history.at(-1)?.closed === (after.turn % 6 === 0), scenario, after.turn, 'Clôture annuelle hors calendrier.', id);
    check(after.history.filter(h => h.closed).length === Math.floor(after.turn / 6), scenario, after.turn, 'Une clôture est absente ou répétée.', id);
    if (after.turn % 6 === 0) {
      coverage.annualClosings++;
      const ledger = after.history.at(-1)!.ledger;
      check(Math.abs(ledger.revenue - ledger.operating - ledger.interest - ledger.investment + ledger.grants + ledger.deficit) < 0.00001,
        scenario, after.turn, 'Le déficit ne correspond pas aux charges et recettes de l’année.', id);
      check(Math.abs(after.finance.debt - g.finance.debt - ledger.borrowing - after.finance.stockFlow) < 0.00001,
        scenario, after.turn, 'Les engagements sont perdus ou doublés dans la dette annuelle.', id);
      check(Math.abs(after.finance.debt - ledger.debt) < 0.00001, scenario, after.turn, 'Dette et clôture divergent.', id);
    } else check(after.finance.debt === g.finance.debt, scenario, after.turn, 'La dette clôture plusieurs fois dans l’année.', id);
  }
  const outcome = strategyOutcome(after);
  const catastrophic = sectors.filter(s => after.pressure!.sectors[s].pressure >= 85).length >= 3;
  const institutionalFailure = ['rupture', 'destitution', 'resignation'].includes(after.politics?.ending?.kind ?? '');
  if (isFinished(after)) {
    check(outcome.status !== 'ongoing', scenario, after.turn, 'Le bilan reste en cours après la fin du mandat.', id);
    if (catastrophic || institutionalFailure) check(outcome.status === 'failure', scenario, after.turn,
      'Un effondrement ou une fin institutionnelle reçoit un bilan favorable.', id);
  } else check(outcome.status === 'ongoing', scenario, after.turn, 'Une réussite est annoncée avant la fin.', id);
  return after;
}
function roundTrip(g: Game, scenario: string) {
  check(same(replayGame(g, g.choices), g), scenario, g.turn, 'Le replay change les comptes, initiatives, transformations ou stocks.');
  check(same(decode(encode(g)), g), scenario, g.turn, 'L’export/import ne reconstruit pas le mandat.');
  const raw = JSON.parse(encode(g)) as Record<string, unknown>;
  raw.turn = 0; raw.finance = { debt: 0 }; raw.presidency = { reserve: 999999 };
  check(same(decode(JSON.stringify(raw)), g), scenario, g.turn, 'Un solde importé remplace le journal canonique.');
}

// Policies are deliberately bounded (at most two presidential orders per period).
// They observe the same visible stocks and advertised conditions as a player.
function futureMargin(g: Game, sector: PressureSectorId) {
  const front = g.pressure!.sectors[sector], state = strategyState(g), local = state.sectors[sector];
  let capacity = front.capacity, need = front.need + Math.max(0, local.demandForecast.at(-1)! - local.appliedDemand);
  for (const programme of g.pressure!.programmes.filter(p => p.sector === sector)) {
    if (programme.duration && programme.status === 'active') {
      capacity -= programme.appliedCapacity ?? 0; need -= programme.appliedNeed ?? 0;
    } else if (!programme.duration && programme.status === 'preparing') {
      capacity += programme.capacity ?? 0; need += programme.need ?? 0;
    }
  }
  for (const commitment of state.commitments.filter(c => c.status === 'preparing')) {
    for (const link of commitment.spillovers.filter(link => link.sector === sector)) {
      capacity += link.capacity ?? 0; need += link.need ?? 0;
    }
  }
  return capacity - need - Math.max(0, front.incomingNeed - front.need);
}
function policyWanted(g: Game, policy: Policy) {
  const state = strategyState(g), offered = options(g, false);
  const ranked = [...sectors].sort((a, b) =>
    (g.pressure!.sectors[b].pressure + 6 * Math.max(0, -futureMargin(g, b)))
    - (g.pressure!.sectors[a].pressure + 6 * Math.max(0, -futureMargin(g, a))));
  const preparingTeams = state.commitments.filter(c => c.status === 'preparing').reduce((n, c) => n + c.teams, 0);
  const emergencies: string[] = [], networks: string[] = [], foundations: string[] = [];
  for (const sector of ranked) {
    const front = g.pressure!.sectors[sector], current = state.sectors[sector], margin = futureMargin(g, sector);
    if (front.backlog > 30) emergencies.push(`s17-${sector}-recovery`);
    if (current.phase === 'conflict' || front.fatigue > 55) emergencies.push(`s17-${sector}-agreement`);
    const queueFull = preparingTeams >= g.pressure!.execution.capacity;
    if (queueFull && front.pressure < 60 && policy !== 'one-order') continue;
    const transformed = current.transformations.some(t => t.kind === 'capacity' || t.kind === 'organisation'
      || t.kind === 'legislation' && (t.capacity > 0 || t.need < 0));
    if (transformed && (margin < .5 || front.pressure >= 40)) networks.push(`s17-${sector}-network`);
    if (margin < 0 || front.pressure > 45 || policy === 'one-order') foundations.push(`s17-${sector}-${policy === 'organisation' || policy === 'one-order' ? 'organisation' : 'capacity'}`);
  }
  // Finish an already useful transformation before extending the portfolio;
  // severe current service pressure takes precedence over this coordination.
  const urgent = foundations.filter(id => {
    const choice = offered.find(c => c.id === id);
    return choice?.pressure && g.pressure!.sectors[choice.pressure.sector].pressure >= 60;
  });
  if (policy === 'overcommit' && g.turn === 0) return ranked.reverse().map(s => `s17-${s}-capacity`);
  return [...emergencies, ...urgent, ...networks, ...foundations];
}
function commands(g: Game, policy: Policy, scenario: string) {
  if (policy === 'autonomy' || policy === 'neglect') return g;
  if (policy === 'one-order' && g.turn > 0) return g;
  if (policy === 'late-correction' && g.turn < 8) return g;
  if (policy === 'overcommit' && g.turn > 0 && g.turn < 10) return g;
  for (let count = 0; count < 2; count++) {
    const state = strategyState(g);
    const offered = options(g);
    const wanted = policyWanted(g, policy);
    let choice = wanted.map(id => offered.find(c => c.id === id)).find(Boolean);
    if (!choice) {
      const desired = wanted.map(id => options(g, false).find(c => c.id === id))
        .filter((c): c is Choice => !!c && !state.commitments.some(commitment => commitment.choice === c.id));
      const institutions = strategyChoices(g).filter(c => !c.presidencyOrder?.unavailable);
      if (desired.some(c => /compromis politique|gouvernement/.test(c.presidencyOrder?.unavailable ?? '')))
        choice = institutions.find(c => c.id === 's17-coalition-pact');
      if (!choice && desired.some(c => /disponibles.*nécessaires/.test(c.presidencyOrder?.unavailable ?? '')))
        choice = institutions.find(c => c.id === 'live-credits');
    }
    if (!choice) break;
    g = transition(g, choice.id, scenario, choice);
    if (choice.id.startsWith('s17-') && !choice.id.endsWith('-recovery')) reject(g, choice.id, scenario, true);
    if (choice.id === 'live-credits') reject(g, choice.id, scenario, true);
    if (policy === 'one-order') break;
  }
  return g;
}
function run(seed: number, ambition: Ambition, policy: Policy) {
  const scenario = `${seed}-${ambition}-${policy}`;
  let g = strategyStart(seed, ambition);
  const snapshots: Snapshot[] = [view(g)], commandsUsed: Array<{ period: number; id: string; kind: string }> = [];
  const untouched = JSON.stringify(g);
  sectors.forEach(s => strategyActions(g, s)); strategyReforms(g); strategyEvents(g); strategyOutcome(g); strategyLedger(g);
  check(JSON.stringify(g) === untouched, scenario, 0, 'Consulter les informations modifie le pays.');
  check(g.version === 17 && g.presidency?.reserve === 18, scenario, 0, 'Le départ ne porte pas la version et l’autorisation prévues.');
  if (policy === 'neglect' && g.presidency!.autonomy) g = transition(g, 'live-autonomy', scenario);
  while (!isFinished(g)) {
    const journalIndex = g.choices.length;
    g = commands(g, policy, scenario);
    for (const id of g.choices.slice(journalIndex)) commandsUsed.push({ period: g.turn, id, kind: kind(id) });
    const disabled = options(g, false).find(c => c.presidencyOrder?.unavailable);
    if (disabled) reject(g, disabled.id, scenario);
    g = transition(g, 'live-tick', scenario);
    snapshots.push(view(g));
  }
  roundTrip(g, scenario);
  const final = snapshots.at(-1)!, early = snapshots.filter(s => s.period < 10), late = snapshots.filter(s => s.period >= 20);
  const recovery = Math.max(...snapshots.map(s => sectors.reduce((n, id) => n + s.sectors[id].backlog, 0))) - backlog(g);
  const quietPeriods = snapshots.filter(s => sectors.every(id => s.sectors[id].pressure < 55)).length;
  if (recovery > 5) coverage.recoveredTrajectories++;
  if (quietPeriods >= 3) coverage.quietTrajectories++;
  if (g.turn === 30) coverage.fullMandates++;
  coverage.transformations += sectors.reduce((n, id) => n + strategyState(g).sectors[id].transformations.length, 0);
  const mix = (rows: Snapshot[]) => Object.fromEntries([...new Set(rows.flatMap(s => s.choices.filter(c => !c.blocked).map(c => c.kind)))].map(k => [k,
    rows.reduce((n, s) => n + s.choices.filter(c => c.kind === k && !c.blocked).length, 0)]));
  const actionMix = (min: number, max: number) => Object.fromEntries([...new Set(commandsUsed.filter(c => c.period >= min && c.period < max).map(c => c.kind))]
    .map(k => [k, commandsUsed.filter(c => c.period >= min && c.period < max && c.kind === k).length]));
  const repeatedCommands = commandsUsed.filter((c, index) => commandsUsed.slice(0, index).some(old => old.id === c.id)).length;
  const deadPeriods = snapshots.filter(s => !s.choices.some(c => !c.blocked) && !s.commitments.some(c => c.status === 'preparing') && s.outcome.status === 'ongoing').map(s => s.period);
  const maxPressure = Math.max(...snapshots.flatMap(s => sectors.map(id => s.sectors[id].pressure)));
  const phaseTransitions = snapshots.slice(1).flatMap((s, index) => sectors.filter(id =>
    s.sectorsStrategy[id].phase !== snapshots[index].sectorsStrategy[id].phase).map(id => ({ period: s.period,
      sector: id, from: snapshots[index].sectorsStrategy[id].phase, to: s.sectorsStrategy[id].phase })));
  const lateCalmPeriods = late.filter(s => sectors.every(id => s.sectors[id].pressure < 45)
    && !s.commitments.some(c => c.status === 'preparing')).map(s => s.period);
  return { scenario, seed, ambition, policy, input: JSON.parse(encode(g)), endPeriod: g.turn,
    outcome: final.outcome, finalPressure: meanPressure(g), finalBacklog: backlog(g), recovery, quietPeriods,
    spent: g.presidency!.spent, finalFinance: g.finance, commandsUsed, repeatedCommands, deadPeriods,
    maxPressure, phaseTransitions, lateCalmPeriods,
    foundationSectors: sectors.filter(sector => strategyState(g).commitments.some(c => c.sector === sector && (c.kind === 'capacity' || c.kind === 'organisation'))),
    availableMix: { early: mix(early), late: mix(late) }, actionMix: { early: actionMix(0, 10), late: actionMix(20, 30) }, snapshots };
}

await mkdir(output, { recursive: true });
const trajectories: ReturnType<typeof run>[] = [];
const matrix = seeds.flatMap(seed => policies.map(policy => ({ seed, ambition: 'equilibre' as Ambition, policy })))
  .concat([1, 47].flatMap(seed => (['services', 'resilience'] as Ambition[]).flatMap(ambition =>
    (['capacity', 'organisation', 'autonomy'] as Policy[]).map(policy => ({ seed, ambition, policy })))));
for (const item of matrix) {
  try {
    const result = run(item.seed, item.ambition, item.policy); trajectories.push(result);
    await writeFile(resolve(output, `${result.scenario}.json`), JSON.stringify(result, null, 2));
    process.stdout.write(`${JSON.stringify({ scenario: result.scenario, outcome: result.outcome.status, pressure: +result.finalPressure.toFixed(2),
      period: result.endPeriod, orders: result.commandsUsed.length, quiet: result.quietPeriods, repeated: result.repeatedCommands })}\n`);
  } catch (error) { issues.push({ scenario: `${item.seed}-${item.ambition}-${item.policy}`, period: -1,
    message: error instanceof Error ? error.stack ?? error.message : String(error) }); }
}

// Four anti-triviality observations compare genuine zero-order autonomy with a
// single relevant opening organisation order. Success is not forced to fail:
// service outcomes and later decision depth must be assessed together.
const singleOrder: ReturnType<typeof run>[] = [];
for (const seed of seeds) {
  try {
    const result = run(seed, 'equilibre', 'one-order'); singleOrder.push(result);
    check(result.commandsUsed.length === 1 && result.commandsUsed[0].id.endsWith('-organisation'),
      result.scenario, 0, 'L’oracle à un ordre n’a pas une seule organisation initiale.');
    await writeFile(resolve(output, `${result.scenario}.json`), JSON.stringify(result, null, 2));
  } catch (error) { issues.push({ scenario: `${seed}-one-order`, period: -1,
    message: error instanceof Error ? error.stack ?? error.message : String(error) }); }
}

// A reproduced financing exploit justified these four parliamentary branches:
// different bills and credits share one saved passage per period, including a
// refusal. Restructuring's cash-rate effects wait for actual physical delivery.
const legislation: Array<{ seed: number; input: unknown; adopted: boolean; deliveredPeriod?: number;
  firstActivePeriod?: number; operatingChange: number; snapshots: unknown[] }> = [];
for (const seed of seeds) {
  const scenario = `legislation-${seed}`;
  try {
    const before = strategyStart(seed, 'equilibre');
    const law = strategyChoices(before).find(c => c.id === 'r02a' && !c.presidencyOrder?.unavailable);
    if (!law) throw Error('La restructuration r02a n’est pas consultable au départ.');
    let g = transition(before, law.id, scenario, law);
    const adopted = g.politics!.lastVote!.passed;
    const target = strategyState(g).commitments.find(c => c.choice === law.id);
    check(g.finance.operating === before.finance.operating && g.finance.revenue === before.finance.revenue,
      scenario, 0, 'Une économie de restructuration est acquise dès le vote, avant livraison.');
    check(!adopted || Math.abs(g.finance.investment - before.finance.investment - (law.effect.investment ?? 0)) < 0.001,
      scenario, 0, 'L’investissement voté n’est pas payé au moment de l’engagement.');
    reject(g, 'r03b', scenario); reject(g, 'live-credits', scenario);
    const snapshots: unknown[] = [];
    let deliveredPeriod: number | undefined, firstActivePeriod: number | undefined;
    while (!isFinished(g)) {
      const previous = g;
      g = transition(g, 'live-tick', scenario);
      const state = strategyState(g), commitment = state.commitments.find(c => c.choice === law.id);
      const deliveredNow = commitment?.deliveredPeriod !== undefined && deliveredPeriod === undefined;
      const previousState = strategyState(previous);
      const deliveredEffects = state.commitments.filter(c => c.deliveredPeriod !== undefined
        && previousState.commitments.find(old => old.id === c.id)?.deliveredPeriod === undefined)
        .reduce((n, c) => n + (c.secondaryEffect?.operating ?? 0), 0);
      const base = previous.finance.operating * (previous.presidency!.preparedYear !== g.presidency!.preparedYear
        ? 1 + previous.finance.deflator : 1);
      check(Math.abs(g.finance.operating - base - deliveredEffects) < 0.003,
        scenario, g.turn, 'Les économies de postes sont appliquées avant livraison, perdues ou répétées.');
      const previousAccrued = previous.presidency!.budget.year === g.presidency!.budget.year
        ? previous.presidency!.budget.accruedOperating : 0;
      const acquired = g.presidency!.budget.accruedOperating - previousAccrued;
      check(Math.abs(acquired - (g.finance.operating + socialYearEnd(g).operating) / 6) < 0.003,
        scenario, g.turn, 'Le premier taux actif n’est pas acquis à la bonne période.');
      if (deliveredNow) { deliveredPeriod = commitment!.deliveredPeriod; firstActivePeriod = g.turn; }
      snapshots.push({ period: g.turn, operating: g.finance.operating, acquiredOperating: acquired,
        lawStatus: commitment?.status, deliveredPeriod: commitment?.deliveredPeriod, ledger: strategyLedger(g) });
    }
    if (adopted) check(deliveredPeriod !== undefined && firstActivePeriod === deliveredPeriod,
      scenario, g.turn, 'La restructuration financée n’a pas livré ses effets et sa première période active.');
    roundTrip(g, scenario);
    legislation.push({ seed, input: JSON.parse(encode(g)), adopted, deliveredPeriod, firstActivePeriod,
      operatingChange: target?.secondaryEffect?.operating ?? 0, snapshots });
  } catch (error) { issues.push({ scenario, period: -1,
    message: error instanceof Error ? error.stack ?? error.message : String(error) }); }
}

// Reproduced queue exploit: padding the journal with neutral priority toggles
// formerly made programme 10 sort before programme 2 and deliver earlier.
// Compare the same funded order sequence and final instruction, not journal IDs.
const fifoProfiles: Array<{ toggles: number; inputs: string[]; periods: unknown[] }> = [];
for (const toggles of [0, 6]) {
  const scenario = `fifo-neutral-${toggles}`;
  try {
    let g = strategyStart(0, 'equilibre');
    const inputs = ['live-autonomy', 'live-priority-energy', 's17-health-capacity', 's17-housing-capacity',
      ...Array.from({ length: toggles }, () => 'live-priority-energy'), 's17-transport-capacity'];
    for (const id of inputs) g = transition(g, id, scenario, options(g).find(c => c.id === id));
    const periods: unknown[] = [];
    for (let period = 0; period < 6; period++) {
      g = transition(g, 'live-tick', scenario);
      periods.push({ period: g.turn, sectors: g.pressure!.sectors, finance: g.finance, ledger: strategyLedger(g),
        execution: g.pressure!.execution, budget: g.presidency!.budget,
        reserve: g.presidency!.reserve, spent: g.presidency!.spent, priority: g.presidency!.priority,
        programmes: g.pressure!.programmes.map(p => ({ choice: p.sourceChoice, work: p.remainingWork, status: p.status,
          delivered: p.deliveredTurn, due: p.dueTurn, capacity: p.appliedCapacity, need: p.appliedNeed })) });
    }
    roundTrip(g, scenario);
    fifoProfiles.push({ toggles, inputs: g.choices, periods });
  } catch (error) { issues.push({ scenario, period: -1,
    message: error instanceof Error ? error.stack ?? error.message : String(error) }); }
}
const fifoIdentical = fifoProfiles.length === 2 && same(fifoProfiles[0].periods, fifoProfiles[1].periods);
check(fifoIdentical, 'fifo-neutral-priority', 6,
  'Des consignes neutres modifient les stocks, les finances, la file ou la date des livraisons.');

// Once every ministry has funded its routine, a new priority must still direct
// shared execution. Reach that state through six real, saved instructions rather
// than imported balances or manufactured stocks; compare two orders at period 8.
const latePriority: Array<{ sector: PressureSectorId; input: unknown; periods: unknown[]; firstAllocation: unknown[] }> = [];
try {
  const scenario = 'late-priority-prefix';
  let prefix = strategyStart(0, 'equilibre');
  for (const sector of sectors) {
    prefix = transition(prefix, `live-priority-${sector}`, scenario);
    prefix = transition(prefix, 'live-tick', scenario);
  }
  prefix = transition(prefix, 'live-priority-administration', scenario);
  for (let period = 0; period < 2; period++) prefix = transition(prefix, 'live-tick', scenario);
  check(prefix.turn === 8 && strategyState(prefix).routineInitiatives === 6, scenario, 8,
    'Le préfixe légal n’a pas atteint six opérations ministérielles à la période 8.');
  for (const sector of ['health', 'housing', 'transport'] as PressureSectorId[]) {
    const choice = options(prefix).find(c => c.id === `s17-${sector}-capacity`);
    if (!choice) throw Error(`Le chantier ${sector} ne peut pas être engagé depuis le préfixe légal.`);
    prefix = transition(prefix, choice.id, scenario, choice);
  }
  for (const sector of ['health', 'transport'] as PressureSectorId[]) {
    const scenario = `late-priority-${sector}`;
    let g = transition(prefix, `live-priority-${sector}`, scenario);
    check(g.turn === prefix.turn && g.presidency!.reserve === prefix.presidency!.reserve
      && same(g.finance, prefix.finance) && same(fronts(g), fronts(prefix))
      && same(g.pressure!.programmes, prefix.pressure!.programmes), scenario, g.turn,
    'La consigne de priorité change le calendrier, dépense ou fait travailler avant la prochaine période.');
    const periods: unknown[] = [];
    let firstAllocation: unknown[] = [];
    for (let period = 0; period < 6; period++) {
      const previous = g;
      g = transition(g, 'live-tick', scenario);
      const allocation = g.pressure!.programmes.map(p => {
        const before = previous.pressure!.programmes.find(old => old.id === p.id);
        const work = before ? before.remainingWork - p.remainingWork : 0;
        check(work >= -0.001 && work <= (p.implementation ?? 1) + 0.001, scenario, g.turn,
          `Un chantier reçoit plus de travail que ses équipes peuvent réaliser : ${p.sourceChoice}`);
        return { choice: p.sourceChoice, remaining: p.remainingWork, work, status: p.status, delivered: p.deliveredTurn };
      });
      if (period === 0) firstAllocation = allocation;
      periods.push({ period: g.turn, allocation, teams: g.pressure!.execution, reserve: g.presidency!.reserve,
        sectors: fronts(g), ledger: strategyLedger(g) });
    }
    roundTrip(g, scenario);
    latePriority.push({ sector, input: JSON.parse(encode(g)), periods, firstAllocation });
  }
} catch (error) { issues.push({ scenario: 'late-priority', period: -1,
  message: error instanceof Error ? error.stack ?? error.message : String(error) }); }
const latePriorityDiffers = latePriority.length === 2 && !same(latePriority[0].firstAllocation, latePriority[1].firstAllocation);
check(latePriorityDiffers, 'late-priority', 9,
  'Après les six opérations ministérielles, changer la priorité n’oriente plus la prochaine allocation.');

// Fixed causal regressions from the actual UI47 journals, with the own
// Transport foundation removed and a recorded useful neighbouring network.
// These prove possibility; they are separate from the general matrix policy.
const noOwnFoundationJournals = [
  {
    "route": "capacity",
    "inputs": [
      "s17-health-capacity",
      "s17-energy-capacity",
      "live-tick",
      "live-tick",
      "live-tick",
      "s17-education-capacity",
      "live-credits",
      "s17-health-network",
      "live-tick",
      "live-tick",
      "live-tick",
      "s17-energy-network",
      "s17-education-network",
      "live-credits",
      "s17-housing-capacity",
      "s17-administration-capacity",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-priority-housing",
      "live-tick",
      "live-tick",
      "live-tick",
      "r03b",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "s17-administration-network",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick"
    ]
  },
  {
    "route": "organisation",
    "inputs": [
      "s17-health-organisation",
      "s17-energy-organisation",
      "s17-education-organisation",
      "live-tick",
      "live-tick",
      "live-tick",
      "s17-health-network",
      "s17-energy-network",
      "live-tick",
      "live-tick",
      "live-tick",
      "s17-education-network",
      "s17-coalition-pact",
      "live-tick",
      "live-tick",
      "live-tick",
      "s17-housing-organisation",
      "s17-administration-organisation",
      "live-tick",
      "live-tick",
      "live-tick",
      "r04b",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-credits",
      "s17-housing-network",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick",
      "live-tick"
    ]
  }
];
const noOwnFoundation: Array<{ route: string; input: unknown; outcome: unknown; foundationSectors: PressureSectorId[] }> = [];
for (const route of noOwnFoundationJournals) {
  const scenario = `no-own-transport-${route.route}`;
  try {
    let g = strategyStart(47, 'equilibre');
    for (const id of route.inputs) g = transition(g, id, scenario, options(g).find(c => c.id === id));
    const foundationSectors = sectors.filter(sector => strategyState(g).commitments.some(c => c.sector === sector && (c.kind === 'capacity' || c.kind === 'organisation')));
    const outcome = strategyOutcome(g);
    check(outcome.status === 'success' && foundationSectors.length < 6 && !foundationSectors.includes('transport'),
      scenario, g.turn, 'La réussite exige désormais une fondation propre dans les six secteurs.');
    roundTrip(g, scenario);
    noOwnFoundation.push({ route: route.route, input: JSON.parse(encode(g)), outcome, foundationSectors });
  } catch (error) { issues.push({ scenario, period: -1,
    message: error instanceof Error ? error.stack ?? error.message : String(error) }); }
}

// Local branches start from legal journals. No balance, fatigue, seats or date is
// manufactured to reach a desirable outcome. Maximum 120 branches in this audit.
const branches: Array<{ scenario: string; input: unknown; outcome: string; cost: number }> = [];
for (const seed of [0, 2, 47]) {
  let prefix = strategyStart(seed, 'equilibre');
  for (const period of [0, 12, 24]) {
    while (prefix.turn < period && !isFinished(prefix)) prefix = transition(prefix, 'live-tick', `prefix-${seed}`);
    if (isFinished(prefix)) break;
    const all = options(prefix).filter(c => c.id.startsWith('s17-'));
    const candidates = [...all.filter(c => /-(capacity|organisation)$/.test(c.id)),
      ...all.filter(c => !/-(capacity|organisation)$/.test(c.id))].slice(0, 13);
    for (const choice of candidates) {
      const scenario = `branch-${seed}-${period}-${choice.id}`;
      try {
        const after = transition(prefix, choice.id, scenario, choice);
        roundTrip(after, scenario);
        branches.push({ scenario, input: JSON.parse(encode(after)), outcome: strategyOutcome(after).status, cost: choice.presidencyOrder?.cost ?? 0 });
      } catch (error) { issues.push({ scenario, period, message: error instanceof Error ? error.message : String(error) }); }
    }
  }
}

// Independent, pre-change numeric fixture: 12 v16 games + one municipal v4.
// It is intentionally an audit artifact, never a new post-hoc unit expectation.
// lossless-per-path-delta-v1 stores changed numeric paths in `set` and deleted
// paths in `remove`, accumulated from an empty map for each trajectory. Full
// terminal states remain verbatim. All 585 expanded numeric states were hashed
// against the original pre-change fixture; proof: strategy-artifacts/legacy-delta-proof.json.
const legacyPath = resolve(process.env.MANDATS_STRATEGY_LEGACY_BASELINE ?? 'tests/fixtures/presidency-v16-before-strategy.json.gz');
let legacy: { available: boolean; trajectories: number; transitions: number; createdAt?: string } = { available: false, trajectories: 0, transitions: 0 };
try {
  const baseline = JSON.parse(gunzipSync(await readFile(legacyPath)).toString('utf8')) as {
    createdAt: string; numericEncoding?: 'lossless-per-path-delta-v1';
    cases: Array<{ mode: 'national' | 'municipal'; seed: number; ambition: Ambition; version: 4 | 16;
      rows: Array<{ id: string | null; numeric?: Record<string, number>; set?: Record<string, number>; remove?: string[] }>; terminal: Game }>;
  };
  for (const row of baseline.cases) {
    const scenario = `legacy-v${row.version}-${row.mode}-${row.seed}-${row.ambition}`;
    let expectedNumbers: Record<string, number> = {};
    const expand = (r: (typeof row.rows)[number]) => {
      if (r.numeric) return r.numeric;
      if (baseline.numericEncoding !== 'lossless-per-path-delta-v1' || !r.set || !r.remove) throw Error('Encodage de fixture inconnu.');
      for (const key of r.remove) delete expectedNumbers[key];
      Object.assign(expectedNumbers, r.set);
      return expectedNumbers;
    };
    const sameNumbers = (a: Record<string, number>, b: Record<string, number>) =>
      Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([key, value]) => b[key] === value);
    let game = start(row.mode, row.seed, row.ambition, row.version);
    check(sameNumbers(numeric(game), expand(row.rows[0])), scenario, 0, 'Les nombres initiaux d’une ancienne version ont changé.');
    for (const expected of row.rows.slice(1)) {
      game = decide(game, expected.id!); coverage.legacyTransitions++;
      check(sameNumbers(numeric(game), expand(expected)), scenario, game.turn, 'Les nombres d’une ancienne trajectoire ont changé.', expected.id!);
    }
    check(same(game, row.terminal), scenario, game.turn, 'L’état final complet d’une ancienne trajectoire a changé.');
  }
  legacy = { available: true, trajectories: baseline.cases.length, transitions: coverage.legacyTransitions, createdAt: baseline.createdAt };
} catch (error) {
  issues.push({ scenario: 'legacy-baseline', period: -1, message: error instanceof Error ? error.message : String(error) });
}

const pairs = seeds.map(seed => {
  const get = (policy: Policy) => trajectories.find(t => t.seed === seed && t.ambition === 'equilibre' && t.policy === policy);
  const capacity = get('capacity'), organisation = get('organisation'), autonomy = get('autonomy'), neglected = get('neglect'), correction = get('late-correction');
  return { seed, capacity: capacity?.outcome.status, organisation: organisation?.outcome.status,
    bothStrategiesSucceed: capacity?.outcome.status === 'success' && organisation?.outcome.status === 'success',
    strategiesDiffer: capacity && organisation ? !same(capacity.snapshots.map(s => s.sectors), organisation.snapshots.map(s => s.sectors)) : false,
    capacitySpent: capacity?.spent, organisationSpent: organisation?.spent,
    autonomousRelief: neglected && autonomy ? neglected.finalBacklog - autonomy.finalBacklog : undefined,
    correctionRelief: neglected && correction ? neglected.finalBacklog - correction.finalBacklog : undefined };
});
const antiTriviality = singleOrder.map(one => {
  const zero = trajectories.find(t => t.seed === one.seed && t.ambition === 'equilibre' && t.policy === 'autonomy');
  return { seed: one.seed, zeroOrderOutcome: zero?.outcome.status, singleOrderOutcome: one.outcome.status,
    order: one.commandsUsed[0]?.id, openingOrderCount: one.commandsUsed.length,
    pressureDifference: zero ? zero.finalPressure - one.finalPressure : undefined,
    singleOrderLateCalmPeriods: one.lateCalmPeriods, phaseTransitions: one.phaseTransitions,
    lateAvailableKinds: Object.keys(one.availableMix.late) };
});
check(trajectories.length === 36, 'coverage', -1, 'La matrice bornée de 36 trajectoires n’a pas abouti.');
check(coverage.governmentInitiatives > 0, 'coverage', -1, 'Le gouvernement ne prend aucune initiative autonome.');
check(coverage.deliveries > 0 && coverage.transformations > 0, 'coverage', -1, 'Aucune transformation réellement livrée.');
check(pairs.filter(p => p.bothStrategiesSucceed).length >= 2, 'coverage', -1,
  'Deux stratégies ne réussissent pas sur au moins deux départs reproductibles.');
check(pairs.every(p => p.strategiesDiffer), 'coverage', -1, 'Les deux stratégies produisent les mêmes trajectoires.');
check(pairs.some(p => (p.autonomousRelief ?? 0) > 5), 'coverage', -1, 'L’autonomie ne réduit pas effectivement les retards.');
check(pairs.some(p => (p.correctionRelief ?? 0) > 5), 'coverage', -1, 'La correction tardive ne permet aucune reprise.');
check(coverage.quietTrajectories > 0 && coverage.recoveredTrajectories > 0, 'coverage', -1, 'Aucun répit ou redressement mesurable.');
check(coverage.executionContention > 0 && coverage.unavailableRefusals > 0 && coverage.duplicateRefusals > 0,
  'coverage', -1, 'Les limites d’exécution, de crédits ou de double engagement ne sont pas exercées.');
check(trajectories.filter(t => t.policy === 'autonomy').every(t => t.commandsUsed.length === 0), 'coverage', -1,
  'Les trajectoires autonomes contiennent des ordres présidentiels cachés.');
check(legislation.length === 4 && legislation.some(law => law.adopted && law.operatingChange < 0), 'coverage', -1,
  'Les quatre branches parlementaires ou une économie réellement différée ne sont pas exercées.');
const sourceAtEnd = await manifest(), sourceChangedDuringRun = !same(sourceAtStart, sourceAtEnd);
check(!sourceChangedDuringRun, 'sources', -1, 'Des sources moteur ont changé pendant la mesure.');
const report = { version: 17, scope: '36 trajectoires légales, quatre observations à un ordre et branches bornées ; ni exhaustivité ni tests humains.', startedAt,
  completedAt: new Date().toISOString(), baseCommit, sourceAtStart, sourceAtEnd, sourceChangedDuringRun,
  trajectoryCount: trajectories.length, singleOrderCount: singleOrder.length, legislationCount: legislation.length, branchCount: branches.length,
  invariantChecks, coverage, legacy, pairs, antiTriviality, noOwnFoundation,
  fifo: { identical: fifoIdentical, periodsCompared: 6, profiles: fifoProfiles.length },
  latePriority: { allocationDiffers: latePriorityDiffers, comparedPriorities: latePriority.map(p => p.sector),
    startPeriod: 8, periodsCompared: 6 },
  rhythm: trajectories.map(t => ({ scenario: t.scenario, outcome: t.outcome.status, endPeriod: t.endPeriod,
    orders: t.commandsUsed.length, repeated: t.repeatedCommands, quietPeriods: t.quietPeriods, deadPeriods: t.deadPeriods,
    maxPressure: t.maxPressure, phaseTransitions: t.phaseTransitions, lateCalmPeriods: t.lateCalmPeriods,
    availableMix: t.availableMix, actionMix: t.actionMix })), issues };
await writeFile(resolve(output, 'branches.json'), JSON.stringify(branches, null, 2));
await writeFile(resolve(output, 'legislation.json'), JSON.stringify(legislation, null, 2));
await writeFile(resolve(output, 'fifo.json'), JSON.stringify(fifoProfiles, null, 2));
await writeFile(resolve(output, 'late-priority.json'), JSON.stringify(latePriority, null, 2));
await writeFile(resolve(output, 'no-own-foundation.json'), JSON.stringify(noOwnFoundation, null, 2));
await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
process.stdout.write(`${JSON.stringify({ trajectories: trajectories.length, branches: branches.length, invariantChecks,
  issues: issues.length, sourceChangedDuringRun, legacy, pairs })}\n`);
if (issues.length) process.exitCode = 1;
