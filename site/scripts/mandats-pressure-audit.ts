/**
 * Bounded campaign exploration. These are real legal engine inputs, not synthetic
 * game states and not a substitute for the browser journeys or human playtests.
 * Failure hypotheses: docs/mandats-pressure-validation.md (written first).
 * Run: node --experimental-strip-types scripts/mandats-pressure-audit.ts
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { choicesFor, decide, isFinished, replayGame, selectStoryAgenda, start, storyAgenda } from '../src/mandats/engine.ts';
import { annualDeficit } from '../src/mandats/national-deficit.ts';
import { decode, encode } from '../src/mandats/storage.ts';
import type { Ambition, Choice, Game } from '../src/mandats/types.ts';
import type { PressureState, PressureChoice } from '../src/mandats/pressure-types.ts';
import { AUTHORED_PRESSURE_EFFECTS, policyPressureEffects } from '../src/mandats/pressure-content.ts';

type Intervention = Pick<PressureChoice, 'sector' | 'kind' | 'projectId'>;
type Strategy = 'neglect' | 'anticipate' | 'temporary' | 'late-rescue' | 'overcommit' | 'austerity' | 'solidarity' | 'delegation';
type Option = { front: string; game: Game; choice: Choice; intervention?: Intervention };
type Issue = { scenario: string; turn: number; message: string };

const strategies: Strategy[] = ['neglect', 'anticipate', 'temporary', 'late-rescue', 'overcommit', 'austerity', 'solidarity', 'delegation'];
const ambitions: Ambition[] = ['equilibre', 'services', 'resilience'];
const version = Number(process.env.MANDATS_PRESSURE_VERSION ?? 13) as Game['version'];
const configuredSeedCount = boundedNumber(process.env.MANDATS_PRESSURE_SEEDS, 12, 1, 120);
const seeds = process.env.MANDATS_PRESSURE_SEED_LIST
  ? [...new Set(process.env.MANDATS_PRESSURE_SEED_LIST.split(',').map(seed => boundedNumber(seed.trim(), 0, 0, 9999)))]
  : Array.from({ length: configuredSeedCount }, (_, index) => index);
const seedCount = seeds.length;
const branchSeeds = boundedNumber(process.env.MANDATS_PRESSURE_BRANCH_SEEDS, Math.min(3, seedCount), 0, seedCount);
const exploreAuthored = process.env.MANDATS_PRESSURE_AUTHORED !== '0';
const runMatrix = process.env.MANDATS_PRESSURE_MATRIX !== '0';
const authoredGuide = process.env.MANDATS_PRESSURE_AUTHORED_GUIDE ?? 'neglect';
if (!['neglect', 'authored-first'].includes(authoredGuide)) throw new Error('Guide de parcours auteur invalide.');
const output = resolve(process.env.MANDATS_PRESSURE_OUTPUT ?? 'pressure-artifacts/model');
const sourceModules = ['types.ts', 'pressure-types.ts', 'pressure-engine.ts', 'pressure-content.ts', 'pressure-agenda.ts',
  'engine.ts', 'campaign.ts', 'narrative-engine.ts', 'narrative-consequences.ts', 'narrative-content.ts', 'rework-content.ts',
  'politics.ts', 'political-dilemmas.ts', 'social-engine.ts', 'social-content.ts', 'national-agenda.ts', 'storage.ts'];
async function sourceManifest() {
  return Object.fromEntries(await Promise.all(sourceModules.map(async path => [path,
    createHash('sha256').update(await readFile(new URL(`../src/mandats/${path}`, import.meta.url))).digest('hex')])));
}
const sourceAtStart = await sourceManifest();
const startedAt = new Date().toISOString();
const baseCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const priorAuthored = process.env.MANDATS_PRESSURE_AUTHORED_PRIOR
  ? JSON.parse(await readFile(resolve(process.env.MANDATS_PRESSURE_AUTHORED_PRIOR), 'utf8')) as { sourceAtStart: Record<string, string>; coverage: { authoredInterventions: string[] } }
  : undefined;
if (priorAuthored && JSON.stringify(priorAuthored.sourceAtStart) !== JSON.stringify(sourceAtStart)) throw new Error('Le complément doit utiliser exactement les mêmes sources que son audit antérieur.');
const issues: Issue[] = [];
let invariantChecks = 0;
const covered = {
  contexts: new Set<string>(), fronts: new Set<string>(), choices: new Set<string>(), interventions: new Set<string>(),
  stages: new Set<string>(), programmeStatuses: new Set<string>(), projectStatuses: new Set<string>(),
  rejections: 0, adoption: 0, earlyEndings: new Set<string>(), closedYears: 0, recoveryTrajectories: 0,
  authoredInterventions: new Set<string>(), simultaneousCrisisTrajectories: 0,
  authoredOptionsEncountered: new Set<string>(), temporaryPeriodsBilled: 0,
  expiredReliefWithAccruedCost: 0, temporaryCrossYearPeriods: 0, executionContention: 0,
};

function boundedNumber(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Valeur hors limites : ${raw}`);
  return value;
}
function pressure(g: Game): PressureState | undefined { return g.pressure; }
function intervention(c: Choice, front: string): Intervention | undefined {
  const explicit = (c as Choice & { pressure?: Intervention }).pressure;
  if (explicit) return explicit;
  if (version >= 13 && front.startsWith('policy:')) return policyPressureEffects(c);
  if (!front.startsWith('pressure-')) return undefined;
  const kind = ['programme', 'relief', 'delegate', 'defer', 'maintain'].find(item => c.id.endsWith(`-${item}`));
  return kind ? { sector: front.slice('pressure-'.length) as Intervention['sector'], kind: kind as Intervention['kind'] } : undefined;
}
function available(g: Game, onlyFront?: string): Option[] {
  return storyAgenda(g).filter(front => !onlyFront || front.id === onlyFront).flatMap(front => {
    const focused = selectStoryAgenda(g, front.id);
    return choicesFor(focused).map(choice => {
      const key = authoredKey(focused, choice);
      if (key && AUTHORED_PRESSURE_EFFECTS[key]) covered.authoredOptionsEncountered.add(key);
      return { front: front.id, game: focused, choice, intervention: intervention(choice, front.id) };
    });
  });
}
function authoredKey(g: Game, choice: Choice): string | undefined {
  const event = choice.narrative?.eventId;
  return event ? `${event}/${choice.id.slice(`n11-${g.turn}-${event}-`.length)}` : undefined;
}
function risk(g: Game, sector?: string): number {
  const item = sector ? pressure(g)?.sectors[sector as Intervention['sector']] : undefined;
  return item ? item.pressure + Math.max(0, item.pressureChange) * 2 : 0;
}
function safePolitical(c: Choice): number {
  const action = c.political?.action;
  if (['cover_up', 'emergency_rule', 'defy_institutions', 'reject_bargain'].includes(action ?? '')) return -40;
  return ['publish_scandal', 'institutional_repair', 'negotiate_rupture', 'coalition_government', 'coalition_bargain'].includes(action ?? '') ? 15 : 0;
}
/** Policies use only advertised effects and the current situation, never future votes. */
function pick(g: Game, strategy: Strategy): Option {
  const current = pressure(g);
  const actual = strategy === 'late-rescue' && g.turn < 10 ? 'neglect' : strategy;
  const programmeExists = (sector: string) => current?.programmes.some(p => p.sector === sector && !['completed', 'cancelled', 'failed', 'withdrawn'].includes(p.status));
  // Rank fronts from the current, visible situation before reading their options.
  // This avoids rebuilding every unrelated dossier for every simulated decision.
  const frontScore = (id: string) => {
    if (id.startsWith('institutional:')) return 10_000;
    if (id.startsWith('policy:')) return ['neglect', 'austerity'].includes(actual) || actual === 'solidarity' && g.turn % 4 === 0 ? 5000 : -5000;
    if (!id.startsWith('pressure-')) return -1000;
    const sector = id.slice('pressure-'.length), priorProgramme = current?.programmes.some(p => p.sector === sector && p.kind === 'programme' && p.status !== 'cancelled');
    const preferred = actual === 'temporary' ? 'relief' : actual === 'delegation' ? 'delegate' : undefined;
    const preferredAlreadyRunning = preferred && current?.programmes.some(p => p.sector === sector && p.kind === preferred && ['active', 'preparing'].includes(p.status));
    return risk(g, sector) + (actual === 'overcommit' && priorProgramme || preferredAlreadyRunning ? -1000 : 0);
  };
  const front = storyAgenda(g).map((front, index) => ({ front, index, score: frontScore(front.id) })).sort((a, b) => b.score - a.score || a.index - b.index)[0]?.front;
  const options = front ? available(g, front.id) : [];
  if (!options.length) throw new Error(`Agenda vide au tour ${g.turn}`);
  const score = (o: Option): number => {
    const c = o.choice, p = o.intervention, budget = (c.effect.revenue ?? 0) - (c.effect.operating ?? 0);
    if (o.front.startsWith('institutional:')) return 1000 + safePolitical(c) + (c.effect.trust ?? 0);
    if (actual === 'neglect') return (o.front.startsWith('policy:') ? 60 : 0) + (p?.kind === 'maintain' ? 30 : p ? -30 : 0) + (c.effect.services ?? 0) + safePolitical(c);
    if (actual === 'austerity') return (o.front.startsWith('policy:') ? 100 : 0) + budget * 3 - (c.effect.investment ?? 0) + safePolitical(c);
    if (!p) return (actual === 'solidarity' && o.front.startsWith('policy:') && g.turn % 4 === 0 ? 180 : 0) + budget + safePolitical(c);
    const urgent = risk(g, p.sector), active = programmeExists(p.sector);
    if (actual === 'temporary') return urgent + (p.kind === 'relief' ? 100 : p.kind === 'maintain' ? 0 : -1000);
    if (actual === 'delegation') return urgent + (p.kind === 'delegate' ? 100 : p.kind === 'maintain' ? 0 : -1000);
    if (actual === 'overcommit') return urgent / 10 + (p.kind === 'programme' ? active ? 50 : 150 : -100);
    if (actual === 'late-rescue') return urgent + (p.kind === 'programme' ? active ? -70 : 100 : p.kind === 'relief' ? 35 : -80);
    return urgent + (p.kind === 'programme' ? active ? -90 : 90 : p.kind === 'relief' ? urgent > 65 ? 70 : 5 : p.kind === 'delegate' ? 0 : -100);
  };
  return options.map((option, index) => ({ option, index, score: score(option) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0].option;
}
function pickAuthored(g: Game): Option {
  if (g.politics?.pendingCrisis) return pick(g, 'anticipate');
  const authored = available(g).filter(option => {
    const key = authoredKey(g, option.choice);
    return key && AUTHORED_PRESSURE_EFFECTS[key];
  });
  return authored.find(option => !authoredExplored.has(authoredKey(g, option.choice)!)) ?? authored[0] ?? pick(g, 'neglect');
}
function stateKey(g: Game): string {
  return JSON.stringify({ turn: g.turn, choices: g.choices, finance: g.finance, metrics: g.metrics, society: g.society,
    pressure: pressure(g), projects: g.narrative?.projects, promises: g.narrative?.promises, social: g.social, politics: g.politics,
    history: g.history });
}
function check(condition: unknown, scenario: string, turn: number, message: string): void {
  invariantChecks++;
  if (!condition) {
    issues.push({ scenario, turn, message });
    if (issues.length <= 20) process.stderr.write(`${JSON.stringify({ scenario, turn, message })}\n`);
  }
}
function snapshot(g: Game) {
  const p = pressure(g);
  return {
    turn: g.turn, deficit: annualDeficit(g), debt: g.finance.debt, metrics: g.metrics,
    sectors: p && Object.fromEntries(Object.entries(p.sectors).map(([id, s]) => [id, { backlog: s.backlog, pressure: s.pressure, capacity: s.capacity, effectiveCapacity: s.effectiveCapacity, need: s.need, fatigue: s.fatigue, stage: s.stage, trend: s.trend }])),
    execution: p?.execution, pressureBudget: p?.budget, programmes: p?.programmes, projects: g.narrative?.projects.map(p => ({ id: p.id, status: p.status, causeTurn: p.causeTurn, sourceChoice: p.sourceChoice, dueTurn: p.dueTurn })),
    vote: g.history.at(-1)?.vote && { kind: g.history.at(-1)!.vote!.kind, passed: g.history.at(-1)!.vote!.passed },
  };
}
function validateTransition(before: Game, after: Game, chosen: Option, scenario: string): void {
  covered.fronts.add(chosen.front.replace(/:\d+$/, ':*'));
  covered.choices.add(chosen.choice.id.replace(/^n11-\d+-/, ''));
  if (chosen.intervention) {
    covered.interventions.add(`${chosen.intervention.sector}:${chosen.intervention.kind}`);
    const key = authoredKey(before, chosen.choice);
    if (key && AUTHORED_PRESSURE_EFFECTS[key]) covered.authoredInterventions.add(key);
  }
  check(after.turn === before.turn + 1 && after.choices.length === after.turn && after.history.length === after.turn, scenario, after.turn, 'Une décision doit avancer exactement une période.');
  const vote = after.history.at(-1)?.vote;
  if (vote?.kind === 'law') {
    if (vote.passed) covered.adoption++; else covered.rejections++;
    if (!vote.passed) {
      check(!pressure(after)?.programmes.some(p => p.sourceChoice === chosen.choice.id && p.sourceTurn === before.turn), scenario, after.turn, 'Un texte rejeté a engagé une intervention.');
      check(!after.narrative?.projects.some(p => p.sourceChoice === chosen.choice.id && p.startedTurn === before.turn), scenario, after.turn, 'Un texte rejeté a financé un projet.');
    }
  }
  const p = pressure(after);
  if (version >= 13) check(p && Object.keys(p.sectors).length >= 6, scenario, after.turn, 'Les besoins persistants sont absents.');
  for (const [id, sector] of Object.entries(p?.sectors ?? {})) {
    covered.stages.add(sector.stage);
    for (const [field, value] of Object.entries(sector)) if (typeof value === 'number') check(Number.isFinite(value), scenario, after.turn, `Valeur non finie : ${id}.${field}`);
    check(sector.backlog >= 0 && sector.capacity >= 0 && sector.need >= 0, scenario, after.turn, `Besoin ou capacité négatif : ${id}`);
  }
  for (const programme of p?.programmes ?? []) {
    covered.programmeStatuses.add(programme.status);
    check(after.choices[programme.sourceTurn] === programme.sourceChoice, scenario, after.turn, `Origine d'intervention perdue : ${programme.id}`);
    if (programme.deliveredTurn !== undefined && programme.duration !== undefined) {
      check(programme.endsTurn === programme.deliveredTurn + programme.duration, scenario, after.turn, `La durée du secours temporaire est modifiée : ${programme.id}`);
    }
    if (programme.projectId && programme.deliveredTurn !== undefined) {
      check(after.narrative?.projects.some(project => project.id === programme.projectId && project.status === 'delivered'), scenario, after.turn, `Une capacité est livrée avant son projet d’origine : ${programme.id}`);
    }
  }
  if (p) {
    const temporary = p.programmes.filter(item => item.status === 'active' && item.temporaryOperating);
    const rate = temporary.reduce((sum, item) => sum + item.temporaryOperating!, 0);
    const disruption = Object.values(p.sectors).reduce((sum, sector) => sum + Math.min(1, Math.max(0, (sector.pressure - 60) / 40)) * 0.5, 0);
    const previousAccrued = before.pressure?.budget.year === p.budget.year ? before.pressure.budget.accruedOperating : 0;
    // Independent accounting check: annual-rate expenses are acquired once per
    // two-month period, including relief that expires before the year's close.
    check(Math.abs(p.budget.accruedOperating - previousAccrued - (Math.round(disruption * 1000) / 1000 + rate) / 6) < 0.0011,
      scenario, after.turn, 'Les frais temporaires acquis ne correspondent pas aux périodes réellement actives.');
    if (temporary.length) covered.temporaryPeriodsBilled++;
    if (temporary.some(item => Math.floor(item.sourceTurn / 6) < Math.floor((after.turn - 1) / 6))) covered.temporaryCrossYearPeriods++;
    if (p.programmes.some(item => item.temporaryOperating && item.status === 'completed') && p.budget.accruedOperating > 0) covered.expiredReliefWithAccruedCost++;
    if (p.execution.waiting > 0 && p.execution.used >= p.execution.capacity - 0.001) covered.executionContention++;
    if (after.history.at(-1)?.closed) check(Math.abs(p.budget.operating - p.budget.accruedOperating) < 0.0011, scenario, after.turn, 'La clôture inclut encore des frais temporaires futurs.');
  }
  for (const project of after.narrative?.projects ?? []) {
    covered.projectStatuses.add(project.status);
    if (project.status === 'delivered') check(!p?.programmes.some(programme => programme.projectId === project.id && programme.status === 'preparing'), scenario, after.turn, `Le projet est livré alors que sa mise en œuvre attend encore : ${project.id}`);
  }
  const closed = after.history.at(-1)?.closed;
  check(closed === (after.turn % 6 === 0), scenario, after.turn, 'Le calendrier ne clôture plus exactement six périodes par exercice.');
  if (closed) {
    covered.closedYears++;
    const ledger = after.history.at(-1)!.ledger;
    check(Math.abs(after.finance.debt - ledger.debt) < 0.00001, scenario, after.turn, 'La clôture annuelle et la dette du pays divergent.');
    check(Math.abs(after.finance.debt - before.finance.debt - ledger.borrowing - after.finance.stockFlow) < 0.00001,
      scenario, after.turn, 'Le financement annuel a été perdu ou ajouté plusieurs fois à la dette.');
    check(Math.abs(ledger.revenue - ledger.operating - ledger.interest - ledger.investment + ledger.grants + ledger.deficit) < 0.00001, scenario, after.turn, 'Le déficit annuel ne correspond pas aux recettes et dépenses.');
  } else check(after.finance.debt === before.finance.debt, scenario, after.turn, 'La dette est clôturée plusieurs fois dans la même année.');
}
function meanPressure(g: Game): number {
  const sectors = Object.values(pressure(g)?.sectors ?? {});
  return sectors.length ? sectors.reduce((sum, sector) => sum + sector.pressure, 0) / sectors.length : 0;
}
function run(seed: number, ambition: Ambition, strategy: Strategy, initial?: Game, suffix = '') {
  let g = initial ?? start('national', seed, ambition, version);
  const scenario = `${seed}-${ambition}-${strategy}${suffix}`;
  const opening = g.narrative?.context ?? 'none';
  covered.contexts.add(opening);
  const startTurn = g.turn;
  const snapshots = [snapshot(g)], pressureSeries = [meanPressure(g)];
  const decisionTypes: Record<string, number> = {};
  const interventionAttempts: Record<string, number> = {};
  const adoptedInterventions: Record<string, number> = {};
  while (!isFinished(g)) {
    const chosen = pick(g, strategy), before = chosen.game;
    const unchanged = stateKey(before);
    g = decide(before, chosen.choice.id);
    const decisionType = chosen.front.startsWith('pressure-') ? 'persistent-front' : chosen.front.startsWith('policy:') ? 'national-policy' : chosen.front.startsWith('institutional:') ? 'institutions' : 'authored-dossier';
    decisionTypes[decisionType] = (decisionTypes[decisionType] ?? 0) + 1;
    if (chosen.intervention) {
      const kind = chosen.intervention.kind;
      interventionAttempts[kind] = (interventionAttempts[kind] ?? 0) + 1;
      if (g.history.at(-1)?.vote?.passed !== false) adoptedInterventions[kind] = (adoptedInterventions[kind] ?? 0) + 1;
    }
    check(stateKey(before) === unchanged, scenario, g.turn, 'Le moteur a muté l’état de départ.');
    validateTransition(before, g, chosen, scenario);
    snapshots.push(snapshot(g)); pressureSeries.push(meanPressure(g));
  }
  if (g.politics?.ending?.kind !== 'term_complete' && g.politics?.ending) covered.earlyEndings.add(g.politics.ending.kind);
  check(stateKey(replayGame(g, g.choices)) === stateKey(g), scenario, g.turn, 'Le replay des choix ne reconstruit pas le pays.');
  check(stateKey(decode(encode(g))) === stateKey(g), scenario, g.turn, 'L’export et l’import modifient la trajectoire.');
  const largestPressure = Math.max(...pressureSeries);
  const recovery = largestPressure - pressureSeries.at(-1)!;
  if (recovery >= 10) covered.recoveryTrajectories++;
  const simultaneous = snapshots.some(s => Object.values(s.sectors ?? {}).filter(s => ['disrupted', 'crisis'].includes(s.stage)).length >= 2);
  if (simultaneous) covered.simultaneousCrisisTrajectories++;
  return { scenario, seed, ambition, strategy, version, opening, startTurn, input: JSON.parse(encode(g)),
    endTurn: g.turn, ending: g.politics?.ending?.kind, finalPressure: meanPressure(g), peakPressure: largestPressure,
    recovery, simultaneous, debt: g.finance.debt, deficit: annualDeficit(g), decisionTypes, interventionAttempts, adoptedInterventions,
    milestones: snapshots.filter(s => [12, 24, 30].includes(s.turn)), snapshots };
}

await mkdir(output, { recursive: true });
const trajectories: ReturnType<typeof run>[] = [];
if (runMatrix) for (const seed of seeds) {
  for (const ambition of ambitions) for (const strategy of strategies) {
    try {
      const result = run(seed, ambition, strategy); trajectories.push(result);
      await writeFile(resolve(output, `${result.scenario}.json`), JSON.stringify(result, null, 2));
      process.stdout.write(`${JSON.stringify({ scenario: result.scenario, pressure: Math.round(result.finalPressure * 10) / 10, recovery: Math.round(result.recovery * 10) / 10, turn: result.endTurn, debt: Math.round(result.debt), deficit: Math.round(result.deficit), decisions: result.decisionTypes })}\n`);
    }
    catch (error) { issues.push({ scenario: `${seed}-${ambition}-${strategy}`, turn: -1, message: error instanceof Error ? error.stack ?? error.message : String(error) }); }
  }
  process.stdout.write(`Seed terminée : ${seed}\n`);
}

// Alternative legal decisions at three distinct points. Each continuation is
// played normally; this is a local branch sample, not an exhaustive game tree.
const branches: ReturnType<typeof run>[] = [];
const authoredBranches: ReturnType<typeof run>[] = [];
const authoredExplored = new Set<string>(priorAuthored?.coverage.authoredInterventions ?? []);
for (const seed of seeds.slice(0, branchSeeds)) {
  let prefix = start('national', seed, 'equilibre', version);
  while (!isFinished(prefix) && prefix.turn <= 18) {
    if ([0, 8, 17].includes(prefix.turn)) for (const option of available(prefix)) {
      const scenario = `branch-${seed}-${prefix.turn}-${option.choice.id}`;
      try {
        const alternative = decide(option.game, option.choice.id);
        validateTransition(option.game, alternative, option, scenario);
        branches.push(run(seed, 'equilibre', 'anticipate', alternative, `-branch-${prefix.turn}-${option.choice.id}`));
      } catch (error) { issues.push({ scenario, turn: prefix.turn, message: error instanceof Error ? error.message : String(error) }); }
    }
    const chosen = authoredGuide === 'authored-first' ? pickAuthored(prefix) : pick(prefix, 'neglect'); prefix = decide(chosen.game, chosen.choice.id);
  }
}
if (version >= 13 && exploreAuthored) for (const seed of seeds) {
  let prefix = start('national', seed, 'equilibre', version);
  while (!isFinished(prefix)) {
    for (const option of available(prefix)) {
      const key = authoredKey(prefix, option.choice);
      if (!key || !AUTHORED_PRESSURE_EFFECTS[key] || authoredExplored.has(key)) continue;
      authoredExplored.add(key);
      try {
        const alternative = decide(option.game, option.choice.id);
        validateTransition(option.game, alternative, option, `authored-${seed}-${key}`);
        authoredBranches.push(run(seed, 'equilibre', 'anticipate', alternative, `-authored-${prefix.turn}-${key}`));
      } catch (error) { issues.push({ scenario: `authored-${seed}-${key}`, turn: prefix.turn, message: error instanceof Error ? error.message : String(error) }); }
    }
    const chosen = authoredGuide === 'authored-first' ? pickAuthored(prefix) : pick(prefix, 'neglect'); prefix = decide(chosen.game, chosen.choice.id);
  }
}

const comparisons = seeds.map(seed => ambitions.map(ambition => {
  const find = (strategy: Strategy) => trajectories.find(t => t.seed === seed && t.ambition === ambition && t.strategy === strategy);
  const ignored = find('neglect'), anticipation = find('anticipate'), late = find('late-rescue');
  return { seed, ambition, neglect: ignored?.finalPressure, anticipate: anticipation?.finalPressure, lateRescue: late?.finalPressure,
    anticipationDifference: ignored && anticipation ? ignored.finalPressure - anticipation.finalPressure : null };
})).flat();
if (version >= 13 && runMatrix) {
  check(comparisons.some(c => (c.anticipationDifference ?? 0) > 5), 'matrix', 30, 'Aucune anticipation ne change sensiblement la pression finale.');
  check(covered.simultaneousCrisisTrajectories > 0, 'matrix', 30, 'Aucun scénario ne produit plusieurs fronts dégradés simultanément.');
  check(covered.recoveryTrajectories > 0, 'matrix', 30, 'Aucune trajectoire ne montre une récupération significative.');
  check(covered.rejections > 0, 'matrix', 30, 'La matrice n’a rencontré aucun rejet parlementaire.');
}
const coverage = Object.fromEntries(Object.entries(covered).map(([key, value]) => [key, value instanceof Set ? [...value].sort() : value]));
const gaps = {
  authoredMappingsNotPlayed: Object.keys(AUTHORED_PRESSURE_EFFECTS).filter(key => !covered.authoredInterventions.has(key)),
  institutionalEndingsNotEncountered: ['resignation', 'destitution', 'rupture'].filter(key => !covered.earlyEndings.has(key)),
};
const scenarioAssessments = [
  { id: 'P01', claim: 'Anticipation et attente produisent des trajectoires différentes', evidence: comparisons.filter(c => (c.anticipationDifference ?? 0) > 5).length, kind: 'sampled-comparison' },
  { id: 'P05', claim: 'Un rejet n’engage aucun projet ou capacité de cette mesure', evidence: covered.rejections, kind: 'transition-invariant' },
  { id: 'P07', claim: 'Plusieurs programmes se partagent une capacité finie', evidence: covered.executionContention, kind: 'sampled-outcome' },
  { id: 'P11', claim: 'Une intervention permet une récupération de pression', evidence: covered.recoveryTrajectories, kind: 'sampled-outcome' },
  { id: 'P15', claim: 'Les secours traversant une frontière annuelle sont comptabilisés par période', evidence: covered.temporaryCrossYearPeriods, kind: 'transition-invariant' },
  { id: 'P24', claim: 'Le besoin d’enseignement reste dans le monde après les premières décisions', evidence: trajectories.filter(t => t.endTurn >= 9 && t.snapshots.at(-1)?.sectors?.education).length, kind: 'sampled-outcome' },
  { id: 'P25', claim: 'Les interactions entre secteurs lisent la période précédente', evidence: 0, kind: 'source-review-required-not-an-order-inversion-test' },
  { id: 'P28/P29', claim: 'Les seuls choix reconstruisent le même pays et les mêmes événements', evidence: trajectories.length + branches.length + authoredBranches.length, kind: 'trajectory-invariant' },
  { id: 'P28-32', claim: 'Lisibilité, gestes, sauvegarde et hors ligne dans le vrai navigateur', evidence: 0, kind: 'separate-playwright-proof-required' },
];
const sourceAtEnd = await sourceManifest();
const sourceChangedDuringRun = JSON.stringify(sourceAtStart) !== JSON.stringify(sourceAtEnd);
check(!sourceChangedDuringRun, 'source-manifest', -1, 'Les sources ont changé pendant cet audit ; cette exécution ne prouve pas le code final.');
const summary = {
  schema: 1, version, seeds, seedCount, ambitions, strategies, trajectories: trajectories.length, localBranches: branches.length, authoredBranches: authoredBranches.length,
  authoredGuide, priorAuthoredMappings: priorAuthored?.coverage.authoredInterventions ?? [],
  startedAt, finishedAt: new Date().toISOString(), baseCommit, sourceAtStart, sourceAtEnd, sourceChangedDuringRun,
  scope: 'Exploration bornée du vrai moteur. Aucune injection d’état. La couverture visuelle vient des parcours Playwright séparés.',
  invariantChecks, invariantViolations: issues.length, coverage, comparisons, scenarioAssessments, gaps, issues,
};
await writeFile(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2));
await writeFile(resolve(output, 'trajectories.json'), JSON.stringify([...trajectories, ...branches, ...authoredBranches], null, 2));
process.stdout.write(`${JSON.stringify({ trajectories: trajectories.length, branches: branches.length, authoredBranches: authoredBranches.length, issues: issues.length, output, coverage })}\n`);
if (issues.length) process.exitCode = 1;
