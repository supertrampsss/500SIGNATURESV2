/**
 * Bounded legal-input exploration of the living presidency (v16).
 * Failure hypotheses were written first in docs/mandats-presidency-contract.md.
 * This is a model audit, not a claim to cover every journal or a UI test.
 * Run: node --experimental-strip-types scripts/mandats-presidency-audit.ts
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decide, isFinished, replayGame, start } from '../src/mandats/engine.ts';
import { decidePresidency, presidencyActions, presidencyCreditsChoice, presidencyLinks, presidencyReforms, startPresidency } from '../src/mandats/presidency-engine.ts';
import { decode, encode } from '../src/mandats/storage.ts';
import type { PressureSectorId } from '../src/mandats/pressure-types.ts';
import type { Ambition, Choice, Game } from '../src/mandats/types.ts';

type Strategy = 'autonomy' | 'neglect' | 'health' | 'structural' | 'late-recovery' | 'overcommit' | 'priority-health' | 'priority-education';
type Issue = { scenario: string; period: number; message: string; choice?: string };
const output = resolve(process.env.MANDATS_PRESIDENCY_OUTPUT ?? 'presidency-artifacts/model');
const seeds = (process.env.MANDATS_PRESIDENCY_SEEDS ?? '0,1,2').split(',').map(Number);
if (!seeds.length || seeds.length > 12 || seeds.some(seed => !Number.isInteger(seed) || seed < 0 || seed > 9999)) throw Error('Graines invalides.');
const ambitions: Ambition[] = ['equilibre', 'services', 'resilience'];
const sectors: PressureSectorId[] = ['health', 'housing', 'transport', 'energy', 'education', 'administration'];
const strategies: Strategy[] = ['autonomy', 'neglect', 'health', 'structural', 'late-recovery', 'overcommit'];
const modules = ['engine.ts', 'campaign.ts', 'types.ts', 'presidency-types.ts', 'presidency-engine.ts', 'pressure-types.ts',
  'pressure-engine.ts', 'pressure-content.ts', 'pressure-agenda.ts', 'pressure-recovery.ts', 'narrative-engine.ts',
  'narrative-consequences.ts', 'narrative-content.ts', 'politics.ts', 'political-dilemmas.ts', 'social-engine.ts',
  'social-content.ts', 'social-types.ts', 'national-agenda.ts', 'storage.ts'];
async function manifest() {
  return Object.fromEntries(await Promise.all(modules.map(async path => [path,
    createHash('sha256').update(await readFile(new URL(`../src/mandats/${path}`, import.meta.url))).digest('hex')])));
}
const sourceAtStart = await manifest();
const startedAt = new Date().toISOString();
const baseCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const issues: Issue[] = [];
let invariantChecks = 0;
const coverage = { ticks: 0, commands: 0, annualClosings: 0, governmentInitiatives: 0, rejectedVotes: 0,
  adoptedVotes: 0, preparations: 0, deliveries: 0, expirations: 0, executionContention: 0,
  blockedCommands: 0, simultaneousCommands: 0, links: new Set<string>(), contexts: new Set<string>(),
  recoveredTrajectories: 0, fiveYearTrajectories: 0, legacyPeriods: 0, creditRequests: 0, creditRefusals: 0, journalBoundary: false };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function check(ok: unknown, scenario: string, period: number, message: string, choice?: string) {
  invariantChecks++;
  if (!ok) {
    const issue = { scenario, period, message, ...(choice ? { choice } : {}) };
    issues.push(issue);
    if (issues.length <= 30) process.stderr.write(`${JSON.stringify(issue)}\n`);
  }
}
function numeric(value: unknown, path = '', out: Record<string, number> = {}) {
  if (typeof value === 'number') out[path] = value;
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) numeric(item, `${path}/${key}`, out);
  return out;
}
function frontSnapshot(g: Game) {
  return Object.fromEntries(sectors.map(id => {
    const sector = g.pressure!.sectors[id];
    return [id, { backlog: sector.backlog, pressure: sector.pressure, capacity: sector.capacity, need: sector.need,
      fatigue: sector.fatigue, effectiveCapacity: sector.effectiveCapacity, stage: sector.stage }];
  }));
}
function snapshot(g: Game) {
  return { period: g.turn, journalLength: g.choices.length, sectors: frontSnapshot(g), finance: structuredClone(g.finance),
    presidency: structuredClone(g.presidency), programmes: structuredClone(g.pressure!.programmes),
    execution: structuredClone(g.pressure!.execution), pressureBudget: structuredClone(g.pressure!.budget),
    vote: structuredClone(g.politics?.lastVote), closedYears: g.history.filter(row => row.closed).length };
}
type Snapshot = ReturnType<typeof snapshot>;
function meanPressure(g: Game) { return sectors.reduce((sum, id) => sum + g.pressure!.sectors[id].pressure, 0) / sectors.length; }
function available(g: Game, sector?: PressureSectorId) {
  return (sector ? presidencyActions(g, sector) : sectors.flatMap(id => presidencyActions(g, id))).filter(choice => !choice.presidencyOrder?.unavailable);
}
function reforms(g: Game) { return presidencyReforms(g).flatMap(reform => reform.choices); }
function validate(before: Game, after: Game, id: string, scenario: string, offered?: Choice) {
  const tick = id === 'live-tick';
  check(after.turn === before.turn + (tick ? 1 : 0), scenario, after.turn, 'Seule une période d’horloge doit avancer le calendrier.', id);
  check(after.choices.length === before.choices.length + 1 && same(after.choices.slice(0, -1), before.choices) && after.choices.at(-1) === id,
    scenario, after.turn, 'Le journal ne conserve pas exactement la commande reçue.', id);
  check(after.choices.length <= 512, scenario, after.turn, 'Le journal dépasse sa limite.');
  check(after.history.length === after.choices.length && after.history.length === before.history.length + 1,
    scenario, after.turn, 'Une entrée du journal n’a pas son résultat enregistré.', id);
  check(after.history.every((row, index) => row.choice === after.choices[index] && (!row.closed || row.choice === 'live-tick')),
    scenario, after.turn, 'Le résultat enregistré ne correspond pas au journal, ou un ordre clôture une année.');
  const nonFinite = Object.entries(numeric(after)).filter(([, value]) => !Number.isFinite(value));
  check(nonFinite.length === 0, scenario, after.turn, `Valeurs non finies : ${nonFinite.slice(0, 5).map(([key]) => key).join(', ')}`);
  const p = after.presidency!;
  check(p.reserve >= -0.001 && p.spent >= -0.001 && p.authorised >= -0.001 && Math.abs(p.reserve - p.authorised + p.spent) <= 0.002,
    scenario, after.turn, 'L’enveloppe disponible diverge des autorisations et dépenses engagées.');
  check(p.spent >= before.presidency!.spent - 0.001, scenario, after.turn, 'Une dépense engagée a été effacée.');
  check(p.initiatives.length <= 96 && new Set(p.initiatives.map(item => item.id)).size === p.initiatives.length,
    scenario, after.turn, 'Le fil des initiatives dépasse sa limite ou duplique un identifiant.');
  check(new Set(p.creditYears).size === p.creditYears.length && p.creditYears.every(year => year >= 1 && year <= 5),
    scenario, after.turn, 'Plusieurs autorisations supplémentaires ont été demandées dans la même année.');
  const newInitiatives = p.initiatives.filter(item => !before.presidency!.initiatives.some(old => old.id === item.id));
  const engaged = newInitiatives.filter(item => item.status === 'engaged').reduce((sum, item) => sum + item.cost, 0);
  check(Math.abs(p.spent - before.presidency!.spent - engaged) <= 0.003, scenario, after.turn,
    'Une intervention est dépensée sans engagement enregistré, ou l’engagement est payé plusieurs fois.', id);
  coverage.governmentInitiatives += newInitiatives.filter(item => item.actor === 'government' && item.status === 'engaged').length;
  const votes = (after.politics?.votes ?? []).slice(before.politics?.votes.length ?? 0);
  for (const vote of votes) {
    if (vote.passed) coverage.adoptedVotes++; else coverage.rejectedVotes++;
    if (!vote.passed) {
      // A first order after closure prepares next year's nominal accounts once.
      // Compare to the same preparation without a fiscal or operational order.
      const prepared = before.presidency!.preparedYear === after.presidency!.preparedYear
        ? before : decidePresidency(before, 'live-autonomy');
      check(p.spent === before.presidency!.spent && same(after.finance, prepared.finance),
        scenario, after.turn, 'Un vote rejeté engage des crédits ou un investissement.', id);
      check(after.pressure!.programmes.length === before.pressure!.programmes.length,
        scenario, after.turn, 'Un vote rejeté a financé un programme.', id);
    }
  }
  const programmes = after.pressure!.programmes;
  check(new Set(programmes.map(item => item.id)).size === programmes.length, scenario, after.turn, 'Un chantier est financé deux fois sous le même identifiant.');
  check(after.pressure!.execution.used <= after.pressure!.execution.capacity + 0.001,
    scenario, after.turn, 'Les chantiers utilisent plus d’équipes que la capacité partagée.');
  if (after.pressure!.execution.waiting > 0 && after.pressure!.execution.used >= after.pressure!.execution.capacity - 0.001) coverage.executionContention++;
  for (const sector of Object.values(after.pressure!.sectors)) check(sector.backlog >= 0 && sector.capacity >= 0 && sector.need >= 0,
    scenario, after.turn, `Stock ou flux négatif : ${sector.id}`);
  for (const programme of programmes) {
    const old = before.pressure!.programmes.find(item => item.id === programme.id);
    if (!old) {
      coverage.preparations++;
      check(tick || programme.status === 'preparing' && programme.deliveredTurn === undefined,
        scenario, after.turn, `Un financement livre immédiatement : ${programme.id}`);
    }
    if (programme.deliveredTurn !== undefined && old?.deliveredTurn === undefined) {
      coverage.deliveries++;
      check(tick && programme.deliveredTurn === after.turn && after.turn >= programme.dueTurn && programme.remainingWork <= 0.001,
        scenario, after.turn, `Livraison avant horloge, délai ou fin de réalisation : ${programme.id}`);
    }
    if (old?.deliveredTurn !== undefined) check(programme.deliveredTurn === old.deliveredTurn, scenario, after.turn, `Une livraison est répétée : ${programme.id}`);
    if (programme.duration !== undefined && programme.deliveredTurn !== undefined) {
      check(programme.endsTurn === programme.deliveredTurn + programme.duration, scenario, after.turn, `La durée temporaire a changé : ${programme.id}`);
      if (old?.status === 'active' && programme.status === 'completed') {
        coverage.expirations++;
        check(tick && (programme.endsTurn ?? Infinity) <= after.turn, scenario, after.turn, `Un renfort expire avant sa fin : ${programme.id}`);
      }
    }
  }
  for (const sector of sectors) {
    const delivered = programmes.filter(item => item.sector === sector && item.deliveredTurn !== undefined && !before.pressure!.programmes.find(old => old.id === item.id)?.deliveredTurn)
      .reduce((sum, item) => sum + (item.appliedCapacity ?? 0), 0);
    const expired = programmes.filter(item => item.sector === sector && item.duration && item.status === 'completed' && before.pressure!.programmes.find(old => old.id === item.id)?.status === 'active')
      .reduce((sum, item) => sum + (item.appliedCapacity ?? 0), 0);
    check(Math.abs(after.pressure!.sectors[sector].capacity - before.pressure!.sectors[sector].capacity - delivered + expired) < 0.002,
      scenario, after.turn, `La capacité ne correspond pas aux seules livraisons et expirations : ${sector}`);
  }
  if (!tick) {
    coverage.commands++;
    check(same(frontSnapshot(before), frontSnapshot(after)), scenario, after.turn, 'Une commande avance les besoins, la fatigue ou la capacité avant l’horloge.', id);
    check(before.finance.debt === after.finance.debt, scenario, after.turn, 'Une commande clôture la dette avant l’horloge.', id);
    check(before.pressure!.budget.year === after.pressure!.budget.year ? same(before.pressure!.budget, after.pressure!.budget)
      : after.pressure!.budget.accruedOperating === 0 && after.pressure!.budget.accruedRevenue === 0,
      scenario, after.turn, 'Une commande acquiert des frais temporaires avant l’horloge.', id);
    check(before.pressure!.programmes.every(old => {
      const item = programmes.find(item => item.id === old.id);
      return item && item.status === old.status && item.remainingWork === old.remainingWork && item.deliveredTurn === old.deliveredTurn;
    }), scenario, after.turn, 'Un clic fait travailler ou livrer un chantier existant.', id);
    if (offered && votes.every(vote => vote.passed)) check(Math.abs(p.spent - before.presidency!.spent - offered.presidencyOrder!.cost) < 0.002,
      scenario, after.turn, 'Le coût engagé diffère du coût affiché avant l’ordre.', id);
  } else {
    coverage.ticks++;
    check(after.history.at(-1)?.closed === (after.turn % 6 === 0), scenario, after.turn, 'Le calendrier ne clôture pas exactement tous les six passages de l’horloge.');
    if (after.turn % 6 === 0) {
      coverage.annualClosings++;
      const ledger = after.history.at(-1)!.ledger;
      check(Math.abs(after.finance.debt - ledger.debt) < 0.00001, scenario, after.turn, 'La dette et le bilan de clôture divergent.');
      check(Math.abs(after.finance.debt - before.finance.debt - ledger.borrowing - after.finance.stockFlow) < 0.00001,
        scenario, after.turn, 'Un financement est perdu ou compté deux fois dans la dette.');
      check(Math.abs(ledger.revenue - ledger.operating - ledger.interest - ledger.investment + ledger.grants + ledger.deficit) < 0.00001,
        scenario, after.turn, 'Le déficit annuel ne correspond pas aux recettes et dépenses.');
    } else check(after.finance.debt === before.finance.debt, scenario, after.turn, 'La dette est clôturée plusieurs fois dans l’année.');
    const budget = after.pressure!.budget;
    const previous = before.pressure!.budget.year === budget.year ? before.pressure!.budget.accruedOperating : 0;
    const rate = programmes.filter(item => item.status === 'active').reduce((sum, item) => sum + (item.temporaryOperating ?? 0), 0);
    const disruption = Object.values(after.pressure!.sectors).reduce((sum, sector) => sum + Math.min(1, Math.max(0, (sector.pressure - 60) / 40)) * .5, 0);
    check(Math.abs(budget.accruedOperating - previous - (Math.round(disruption * 1000) / 1000 + rate) / 6) < 0.0012,
      scenario, after.turn, 'Les frais acquis ne correspondent pas aux seuls renforts actifs et perturbations de cette période.');
    check(after.history.filter(row => row.closed).length === Math.floor(after.turn / 6), scenario, after.turn, 'Une clôture annuelle est absente ou répétée.');
  }
  for (const link of presidencyLinks(after)) {
    coverage.links.add(JSON.stringify({ from: link.from, to: link.to }));
    if (tick) check(link.loss > 0 && before.pressure!.sectors[link.from].pressure > 60
      && after.pressure!.sectors[link.to].causes.some(cause => cause.kind === 'link' && cause.label === link.label),
      scenario, after.turn, 'Une propagation est affichée sans pression source ni cause de capacité correspondante.');
  }
}
function transition(g: Game, id: string, scenario: string, offered?: Choice) {
  const initial = JSON.stringify(g);
  const after = decidePresidency(g, id);
  check(JSON.stringify(g) === initial, scenario, g.turn, 'Le moteur a modifié son état d’entrée.', id);
  validate(g, after, id, scenario, offered);
  return after;
}
function execute(g: Game, choice: Choice | undefined, scenario: string) {
  return choice ? transition(g, choice.id, scenario, choice) : g;
}
function best(g: Game, kind: string, only?: PressureSectorId) {
  return available(g, only).filter(choice => choice.id.endsWith(`-${kind}`)).sort((a, b) =>
    g.pressure!.sectors[b.pressure!.sector].pressure - g.pressure!.sectors[a.pressure!.sector].pressure)[0];
}
function programmeExists(g: Game, sector: PressureSectorId) {
  return g.pressure!.programmes.some(item => item.sector === sector && item.kind === 'programme' && !item.duration && item.status !== 'cancelled');
}
function commands(g: Game, strategy: Strategy, scenario: string) {
  if (['autonomy', 'neglect', 'priority-health', 'priority-education'].includes(strategy)) return g;
  if (strategy === 'health') {
    if (!programmeExists(g, 'health')) g = execute(g, best(g, 'programme', 'health'), scenario);
    if (g.pressure!.sectors.health.pressure > 65) g = execute(g, best(g, 'recovery', 'health') ?? best(g, 'relief', 'health'), scenario);
    return g;
  }
  if (strategy === 'structural') {
    const candidates = available(g).filter(choice => choice.id.endsWith('-programme') && !programmeExists(g, choice.pressure!.sector))
      .sort((a, b) => g.pressure!.sectors[b.pressure!.sector].pressure - g.pressure!.sectors[a.pressure!.sector].pressure);
    g = execute(g, candidates[0], scenario);
    if (g.turn % 6 === 0) g = execute(g, reforms(g).find(choice => !choice.presidencyOrder?.unavailable), scenario);
    return g;
  }
  if (strategy === 'late-recovery') {
    if (g.turn < 10) return g;
    return execute(g, best(g, 'recovery') ?? best(g, 'programme') ?? best(g, 'relief'), scenario);
  }
  const period = g.turn, startCommands = g.choices.length;
  for (let index = 0; index < 12; index++) {
    const options = available(g).sort((a, b) => b.presidencyOrder!.cost - a.presidencyOrder!.cost);
    if (!options.length) break;
    g = execute(g, options[0], scenario);
  }
  check(g.turn === period, scenario, g.turn, 'Des ordres simultanés ont fait avancer le pays.');
  if (g.choices.length - startCommands >= 2) coverage.simultaneousCommands++;
  return g;
}
function validateRoundTrip(g: Game, scenario: string) {
  check(same(replayGame(g, g.choices), g), scenario, g.turn, 'Le replay ne reconstruit pas exactement les comptes, votes, équipes et stocks.');
  check(same(decode(encode(g)), g), scenario, g.turn, 'L’export/import ne reconstruit pas exactement le mandat.');
  const raw = JSON.parse(encode(g)) as Record<string, unknown>;
  raw.presidency = { reserve: 999999, spent: -100 }; raw.finance = { debt: 0 }; raw.turn = 0;
  check(same(decode(JSON.stringify(raw)), g), scenario, g.turn, 'L’import a pris un solde ou calendrier arbitraire comme autorité.');
}
function run(seed: number, ambition: Ambition, strategy: Strategy) {
  const scenario = `${seed}-${ambition}-${strategy}`;
  let g = startPresidency(seed, ambition);
  coverage.contexts.add(g.narrative?.context ?? 'none');
  const snapshots: Snapshot[] = [snapshot(g)];
  const beforeInspection = JSON.stringify(g);
  sectors.forEach(sector => presidencyActions(g, sector)); presidencyReforms(g); presidencyLinks(g);
  check(JSON.stringify(g) === beforeInspection, scenario, g.turn, 'Consulter les actions ou la carte modifie la partie.');
  if (['neglect', 'late-recovery', 'overcommit'].includes(strategy) && g.presidency!.autonomy) g = transition(g, 'live-autonomy', scenario);
  if (strategy === 'priority-health' || strategy === 'priority-education') g = transition(g, `live-priority-${strategy.slice('priority-'.length)}`, scenario);
  while (!isFinished(g)) {
    g = commands(g, strategy, scenario);
    const unavailable = sectors.flatMap(sector => presidencyActions(g, sector)).find(choice => choice.presidencyOrder?.unavailable);
    if (unavailable) {
      const before = JSON.stringify(g); let rejected = false;
      try { decidePresidency(g, unavailable.id); } catch { rejected = true; }
      check(rejected && JSON.stringify(g) === before, scenario, g.turn, 'Un ordre indisponible est accepté ou modifie la partie.', unavailable.id);
      coverage.blockedCommands++;
    }
    g = transition(g, 'live-tick', scenario);
    snapshots.push(snapshot(g));
  }
  validateRoundTrip(g, scenario);
  const pressures = snapshots.map(row => sectors.reduce((sum, id) => sum + row.sectors[id].pressure, 0) / sectors.length);
  const recovery = Math.max(...pressures) - pressures.at(-1)!;
  const sectorRecovery = Math.max(0, ...sectors.flatMap(id => snapshots.map((row, index) => {
    if (row.period < 10) return 0;
    return row.sectors[id].backlog - Math.min(...snapshots.slice(index + 1).map(next => next.sectors[id].backlog));
  }).filter(Number.isFinite)));
  if (recovery > 5) coverage.recoveredTrajectories++;
  if (g.turn === 30) { coverage.fiveYearTrajectories++; check(g.history.filter(row => row.closed).length === 5, scenario, 30, 'Le mandat complet n’a pas cinq bilans annuels.'); }
  return { scenario, seed, ambition, strategy, version: g.version, input: JSON.parse(encode(g)),
    finalPressure: meanPressure(g), recovery, sectorRecovery, endPeriod: g.turn, ending: g.politics?.ending?.kind,
    reserve: g.presidency!.reserve, spent: g.presidency!.spent,
    governmentInitiatives: g.presidency!.initiatives.filter(item => item.actor === 'government' && item.status === 'engaged').length, snapshots };
}
const specialCases: Array<{ scenario: string; input: unknown; details: unknown }> = [];
for (const seed of [0, 7]) {
  const scenario = `credits-${seed}`;
  try {
    const before = startPresidency(seed, 'equilibre');
    const after = transition(before, 'live-credits', scenario, presidencyCreditsChoice(before));
    const adopted = after.politics!.lastVote!.passed;
    coverage.creditRequests++;
    if (!adopted) coverage.creditRefusals++;
    check(Math.abs(after.presidency!.authorised - before.presidency!.authorised - (adopted ? 10 : 0)) < 0.001,
      scenario, 0, 'Le vote de crédits n’a pas modifié l’autorisation comme annoncé.');
    check(same(after.finance, before.finance), scenario, 0, 'Une autorisation de crédits est devenue une recette ou une dépense.');
    const unchanged = JSON.stringify(after); let duplicateRejected = false;
    try { decidePresidency(after, 'live-credits'); } catch { duplicateRejected = true; }
    check(duplicateRejected && JSON.stringify(after) === unchanged, scenario, 0, 'Une seconde demande de crédits dans la même année est acceptée.');
    validateRoundTrip(after, scenario);
    specialCases.push({ scenario, input: JSON.parse(encode(after)), details: { adopted, available: after.presidency!.reserve } });
  } catch (error) { issues.push({ scenario, period: -1, message: error instanceof Error ? error.stack ?? error.message : String(error) }); }
}
try {
  const scenario = 'journal-boundary';
  let g = startPresidency(0, 'equilibre');
  for (let index = 0; index < 482; index++) g = transition(g, 'live-autonomy', scenario);
  check(g.turn === 0 && g.history.every(row => !row.closed), scenario, 0, 'Des ordres répétés ont avancé le calendrier ou clôturé l’année.');
  let nextOrderRejected = false;
  try { decidePresidency(g, 'live-autonomy'); } catch { nextOrderRejected = true; }
  check(nextOrderRejected, scenario, 0, 'Les ordres peuvent consommer les places réservées aux dernières périodes.');
  while (!isFinished(g)) g = transition(g, 'live-tick', scenario);
  check(g.choices.length === 512 && g.turn === 30, scenario, 30, 'La limite du journal empêche de finir le calendrier.');
  validateRoundTrip(g, scenario); coverage.journalBoundary = true;
  specialCases.push({ scenario, input: JSON.parse(encode(g)), details: { journalLength: g.choices.length, period: g.turn } });
} catch (error) { issues.push({ scenario: 'journal-boundary', period: -1, message: error instanceof Error ? error.stack ?? error.message : String(error) }); }

await mkdir(output, { recursive: true });
const trajectories: ReturnType<typeof run>[] = [];
for (const seed of seeds) for (const ambition of ambitions) for (const strategy of strategies) {
  try {
    const result = run(seed, ambition, strategy); trajectories.push(result);
    await writeFile(resolve(output, `${result.scenario}.json`), JSON.stringify(result, null, 2));
    process.stdout.write(`${JSON.stringify({ scenario: result.scenario, pressure: +result.finalPressure.toFixed(2), recovery: +result.recovery.toFixed(2), spent: result.spent, period: result.endPeriod })}\n`);
  } catch (error) { issues.push({ scenario: `${seed}-${ambition}-${strategy}`, period: -1, message: error instanceof Error ? error.stack ?? error.message : String(error) }); }
}
for (const seed of seeds) for (const strategy of ['priority-health', 'priority-education'] as Strategy[]) {
  try { const result = run(seed, 'equilibre', strategy); trajectories.push(result); await writeFile(resolve(output, `${result.scenario}.json`), JSON.stringify(result, null, 2)); }
  catch (error) { issues.push({ scenario: `${seed}-equilibre-${strategy}`, period: -1, message: error instanceof Error ? error.stack ?? error.message : String(error) }); }
}

// Independent policy branches at the opening and after actual unattended time.
// These branches inspect advertised legal options, never modify balances or seats.
const branches: Array<{ scenario: string; input: unknown; adopted: boolean; cost: number; beforeReserve: number; afterReserve: number }> = [];
for (const seed of seeds) {
  let prefix = startPresidency(seed, 'equilibre');
  if (prefix.presidency!.autonomy) prefix = transition(prefix, 'live-autonomy', `branch-${seed}`);
  for (const period of [0, 10, 20]) {
    while (prefix.turn < period && !isFinished(prefix)) prefix = transition(prefix, 'live-tick', `branch-${seed}`);
    if (isFinished(prefix)) break;
    const options = [...reforms(prefix), ...available(prefix)].filter(choice => !choice.presidencyOrder?.unavailable);
    for (const choice of options) {
      const scenario = `branch-${seed}-${period}-${choice.id}`;
      try {
        const after = transition(prefix, choice.id, scenario, choice);
        validateRoundTrip(after, scenario);
        branches.push({ scenario, input: JSON.parse(encode(after)), adopted: after.politics?.lastVote?.id === prefix.politics?.lastVote?.id || after.politics?.lastVote?.passed !== false,
          cost: choice.presidencyOrder!.cost, beforeReserve: prefix.presidency!.reserve, afterReserve: after.presidency!.reserve });
      } catch (error) { issues.push({ scenario, period, message: error instanceof Error ? error.stack ?? error.message : String(error) }); }
    }
  }
}
const comparisons = seeds.flatMap(seed => ambitions.map(ambition => {
  const get = (strategy: Strategy) => trajectories.find(row => row.seed === seed && row.ambition === ambition && row.strategy === strategy);
  const neglected = get('neglect'), autonomous = get('autonomy'), structural = get('structural'), late = get('late-recovery');
  const difference = (other: typeof neglected, sector?: PressureSectorId) => neglected && other ? Math.max(...neglected.snapshots.map(row => {
    const paired = other.snapshots.find(snapshot => snapshot.period === row.period);
    if (!paired) return 0;
    return sector ? row.sectors[sector].backlog - paired.sectors[sector].backlog
      : sectors.reduce((sum, id) => sum + row.sectors[id].backlog - paired.sectors[id].backlog, 0);
  })) : undefined;
  return { seed, ambition, autonomousBacklogRelief: difference(autonomous), structuralBacklogRelief: difference(structural), lateRecoveryBacklogRelief: difference(late) };
}));
const priorities = seeds.map(seed => {
  const health = trajectories.find(row => row.seed === seed && row.strategy === 'priority-health');
  const education = trajectories.find(row => row.seed === seed && row.strategy === 'priority-education');
  return { seed, outcomesDiffer: health && education ? !same(health.snapshots.map(row => row.sectors), education.snapshots.map(row => row.sectors)) : false };
});
check(coverage.governmentInitiatives > 0, 'coverage', 30, 'Le gouvernement ne prend aucune initiative sans commande.');
check(comparisons.some(row => (row.autonomousBacklogRelief ?? 0) > 1), 'coverage', 30, 'L’autonomie n’apporte aucun répit réel comparée à la négligence.');
check(comparisons.some(row => (row.structuralBacklogRelief ?? 0) > 5), 'coverage', 30, 'L’investissement structurel ne change pas les retards.');
check(comparisons.some(row => (row.lateRecoveryBacklogRelief ?? 0) > 5), 'coverage', 30, 'Aucun rattrapage tardif ne réduit les retards.');
check(trajectories.some(row => row.strategy === 'late-recovery' && row.sectorRecovery > 3), 'coverage', 30,
  'Le rattrapage ralentit peut-être la hausse, mais aucun secteur ne résorbe réellement ses retards.');
check(priorities.some(row => row.outcomesDiffer), 'coverage', 30, 'Deux priorités différentes produisent exactement les mêmes secteurs.');
check(coverage.deliveries > 0 && coverage.expirations > 0 && coverage.preparations > 0, 'coverage', 30, 'La préparation, livraison ou fin d’un renfort temporaire n’a pas été exercée.');
check(coverage.rejectedVotes > 0 && coverage.adoptedVotes > 0, 'coverage', 30, 'Les votes adoptés et rejetés ne sont pas tous exercés.');
check(coverage.blockedCommands > 0 && coverage.simultaneousCommands > 0 && coverage.executionContention > 0,
  'coverage', 30, 'Les crédits limités, ordres simultanés ou équipes partagées ne sont pas exercés.');
check(coverage.fiveYearTrajectories > 0, 'coverage', 30, 'Aucune trajectoire ne parvient aux cinq clôtures annuelles.');
check(coverage.creditRefusals > 0 && coverage.creditRequests > coverage.creditRefusals, 'coverage', 30, 'Les autorisations supplémentaires adoptées et rejetées ne sont pas toutes exercées.');

const baselinePath = resolve(process.env.MANDATS_PRESIDENCY_LEGACY_BASELINE ?? 'presidency-artifacts/model-baseline/v15-numeric.json');
let legacy: { available: boolean; path: string; trajectories: number; periods: number } = { available: false, path: baselinePath, trajectories: 0, periods: 0 };
try {
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as Array<{ seed: number; ambition: Ambition; choices: string[]; turns: Record<string, number>[] }>;
  for (const row of baseline) {
    let game = start('national', row.seed, row.ambition, 15);
    check(same(numeric(game), row.turns[0]), `legacy-${row.seed}`, 0, 'Les valeurs initiales v15 ont changé.');
    for (const id of row.choices) {
      game = decide(game, id); coverage.legacyPeriods++;
      check(same(numeric(game), row.turns[game.turn]), `legacy-${row.seed}`, game.turn, 'Une trajectoire numérique v15 a changé.', id);
    }
  }
  legacy = { available: true, path: baselinePath, trajectories: baseline.length, periods: coverage.legacyPeriods };
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') issues.push({ scenario: 'legacy', period: -1, message: error instanceof Error ? error.message : String(error) });
}
const sourceAtEnd = await manifest();
const sourceChangedDuringRun = !same(sourceAtStart, sourceAtEnd);
check(!sourceChangedDuringRun, 'source', -1, 'Les sources moteur ont changé pendant cet audit.');
const report = { version: 16, scope: 'Matrice bornée, branches locales légales ; aucune exhaustivité revendiquée.', startedAt, completedAt: new Date().toISOString(), baseCommit,
  sourceAtStart, sourceAtEnd, sourceChangedDuringRun, invariantChecks, seeds, ambitions, trajectoryCount: trajectories.length,
  branchCount: branches.length, coverage: { ...coverage, links: coverage.links.size, contexts: [...coverage.contexts] }, legacy, comparisons, priorities, issues };
await writeFile(resolve(output, 'branches.json'), JSON.stringify(branches, null, 2));
await writeFile(resolve(output, 'special-cases.json'), JSON.stringify(specialCases, null, 2));
await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
process.stdout.write(`${JSON.stringify({ trajectories: trajectories.length, branches: branches.length, invariantChecks, issues: issues.length, sourceChangedDuringRun, legacy })}\n`);
if (issues.length) process.exitCode = 1;
