import type { Ambition, Choice, Effect, Game, Ledger } from './types.ts';
import type { PressureChoice, PressureProgramme, PressureSectorId } from './pressure-types.ts';
import type { PresidencyInitiative, PresidencyOrder, PresidencyState } from './presidency-types.ts';
import type { VoteRecord } from './politics-types.ts';
import { clamp } from './types.ts';
import { startCampaign } from './campaign.ts';
import { advancePressure, PRESSURE_SECTORS } from './pressure-engine.ts';
import { PRESSURE_DOSSIERS, policyPressureEffects } from './pressure-content.ts';
import { pressureRecoveryPlan } from './pressure-recovery.ts';
import { NATIONAL_AGENDA } from './national-agenda.ts';
import { nationalBudget } from './national.ts';
import { applySociety, socialYearEnd } from './national-society.ts';
import { applyPoliticalResolution, resolvePoliticalChoice } from './politics.ts';
import { politicalDossier } from './political-dilemmas.ts';

/** V16 hypotheses are deliberately explicit: one period = two months; 30 periods
 * = five years; intervention authorisation starts at 6.4 Md€. A credit bill can
 * authorise 10 more Md€ once per year. Authorisation does not create receipts.
 * One autonomous operational initiative is allowed per clock period, within the
 * same reserve and finite implementation queue as presidential orders. */
export const PRESIDENCY_SECTORS = PRESSURE_SECTORS;
export const PRESIDENCY_JOURNAL_LIMIT = 512;
export const PRESIDENCY_CREDIT_AMOUNT = 10;
export const PRESIDENCY_INITIAL_RESERVE = 6.4;
/** Ordinary delegated authority per initiative. A named presidential priority
 * permits a larger programme within the same remaining intervention reserve. */
export const PRESIDENCY_OPERATIONAL_LIMIT = .4;
const IDS = Object.keys(PRESSURE_SECTORS) as PressureSectorId[];
const round = (value: number) => Math.round(value * 1000) / 1000;
const number = (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
const money = (value: number) => `${number(value)} Md€`;
const family = (sector: PressureSectorId) => PRESSURE_DOSSIERS[sector].family.title;
const ministry = (sector: PressureSectorId) => ({ health: 'Santé', housing: 'Logement', transport: 'Transports', energy: 'Énergie', education: 'Éducation', administration: 'Services publics' })[sector];
const yearFor = (g: Game) => Math.min(5, Math.floor(g.turn / 6) + 1);
function state(g: Game): PresidencyState {
  if (g.version !== 16 || !g.presidency || !g.pressure || !g.politics) throw new Error('Cette partie ne possède pas de gouvernement autonome.');
  return g.presidency;
}
function finished(g: Game): boolean { return g.turn >= 30 || !!g.politics?.ending; }
function assertOpen(g: Game) {
  state(g);
  if (finished(g)) throw new Error('Ce mandat est terminé.');
  // Reserve enough journal entries for every remaining clock period, so issuing
  // many orders can never make the five-year calendar impossible to complete.
  if (g.choices.length >= PRESIDENCY_JOURNAL_LIMIT) throw new Error('Le journal de ce mandat est complet.');
}
function apply(g: Game, effect: Effect) {
  applySociety(g, effect.society);
  for (const key of ['revenue', 'operating', 'investment', 'grants', 'repayment', 'growth'] as const) g.finance[key] += effect[key] ?? 0;
  for (const key of ['services', 'cohesion', 'resilience', 'trust', 'assets'] as const) g.metrics[key] = clamp(g.metrics[key] + (effect[key] ?? 0));
  for (const area of g.areas) {
    if (!effect.area || area.id === effect.area) {
      area.services = clamp(area.services + (effect.services ?? 0));
      area.resilience = clamp(area.resilience + (effect.resilience ?? 0));
    }
    const local = effect.areaEffects?.[area.id];
    if (local) { area.services = clamp(area.services + (local.services ?? 0)); area.resilience = clamp(area.resilience + (local.resilience ?? 0)); }
  }
}
function addInitiative(g: Game, item: Omit<PresidencyInitiative, 'id' | 'period'>) {
  const p = state(g);
  p.initiatives.push({ ...item, id: `presidency-${g.choices.length}-${g.turn}-${p.initiatives.length}`, period: g.turn });
  if (p.initiatives.length > 96) p.initiatives.splice(0, p.initiatives.length - 96);
  p.lastEvents.push(item.detail);
  if (p.lastEvents.length > 12) p.lastEvents.splice(0, p.lastEvents.length - 12);
}
function prepareYear(g: Game) {
  const p = state(g), year = yearFor(g);
  if (p.preparedYear === year) return;
  // Never prepare a new budget on every order. Nominal growth, baseline capital
  // spending and interest-rate adjustment are annual, regardless of click count.
  g.finance.revenue *= (1 + g.finance.growth) * (1 + g.finance.deflator);
  g.finance.operating *= 1 + g.finance.deflator;
  g.finance.investment = 40; g.finance.grants = 0; g.finance.repayment = 0;
  g.finance.rate += .2 * (g.finance.marketRate - g.finance.rate);
  p.preparedYear = year;
  p.budget = { year, accruedOperating: 0, accruedRevenue: 0 };
  g.pressure!.budget = { year, accruedOperating: 0, accruedRevenue: 0, operating: 0, revenue: 0 };
  apply(g, { services: -1, assets: -2 });
}
/** Annual forecast integrates the rates actually acquired on completed clock
 * periods, then projects the remaining periods. At closure the forecast term is
 * zero. Capital commitments enter the year's investment exactly once. */
export function presidencyLedger(g: Game): Ledger {
  const p = state(g), completed = g.turn % 6;
  const closed = g.turn > 0 && completed === 0 && p.preparedYear === Math.floor(g.turn / 6);
  if (closed && g.history.at(-1)?.closed) return structuredClone(g.history.at(-1)!.ledger);
  const remaining = closed ? 0 : 6 - completed;
  const social = socialYearEnd(g), pressure = g.pressure!.budget;
  return nationalBudget({ ...g.finance,
    operating: p.budget.accruedOperating + (g.finance.operating + social.operating) * remaining / 6 + pressure.operating,
    revenue: p.budget.accruedRevenue + (g.finance.revenue + social.revenue) * remaining / 6 + pressure.revenue,
  });
}
function append(g: Game, id: string, title: string, messages: string[], closed = false, vote?: VoteRecord, ledger = presidencyLedger(g)) {
  g.choices.push(id);
  g.history.push({ year: closed ? Math.max(1, Math.ceil(g.turn / 6)) : yearFor(g), closed, choice: id, title,
    messages: [...messages], event: id === 'live-tick' ? 'Le pays et les équipes évoluent avec le temps.' : 'Ordre enregistré ; le calendrier reste inchangé.',
    ledger, metrics: structuredClone(g.metrics), areas: structuredClone(g.areas), ...(vote ? { vote: structuredClone(vote) } : {}) });
}
function orderCost(choice: Choice): number {
  const temporary = Math.max(0, choice.effect.temporaryOperating ?? 0) * (choice.pressure?.duration ?? 0) / 6;
  return round(Math.max(0, choice.effect.investment ?? 0) + Math.max(0, choice.effect.operating ?? 0) + temporary);
}
function orderMetadata(g: Game, choice: Choice): PresidencyOrder {
  const cost = orderCost(choice);
  return { cost, delay: choice.pressure ? Math.max(1, choice.pressure.delay ?? 1) : (choice.delayed?.after ?? 0) * 6,
    implementation: choice.pressure ? choice.pressure.implementation ?? 1 : 0,
    ...(cost > state(g).reserve + .00001 ? { unavailable: `Crédits disponibles : ${money(state(g).reserve)} ; engagement nécessaire : ${money(cost)}.` } : {}) };
}
function withMetadata(g: Game, choice: Choice): Choice { return { ...choice, presidencyOrder: orderMetadata(g, choice) }; }
function operationalChoice(g: Game, sector: PressureSectorId, kind: 'relief' | 'programme' | 'delegate' | 'recovery'): Choice {
  const content = PRESSURE_DOSSIERS[sector];
  let title: string, description: string, effect: Effect, pressure: PressureChoice, sacrifice: string;
  if (kind === 'recovery') {
    const plan = pressureRecoveryPlan(g.pressure!.sectors[sector], content);
    title = `Rattrapage : ${family(sector)}`;
    description = `Une équipe temporaire traite le retard accumulé, avec une capacité de ${number(plan.capacity)} unités par période pendant huit mois après préparation.`;
    sacrifice = `Préparation : ${plan.delay * 2} mois au minimum, ${plan.implementation} unités de mise en œuvre partagées. Le renfort expire après huit mois.`;
    effect = { investment: plan.investment, temporaryOperating: plan.operating };
    pressure = { sector, kind: 'programme', label: title, capacity: plan.capacity, delay: plan.delay, implementation: plan.implementation, duration: plan.duration };
  } else if (kind === 'programme') {
    const item = content.programme;
    ({ title, description, sacrifice } = item);
    effect = { investment: item.investment, operating: item.operating };
    pressure = { sector, kind, label: title, capacity: item.capacity, delay: item.delay, implementation: 2, fatigue: -8 };
  } else if (kind === 'delegate') {
    const item = content.delegate;
    ({ title, description, sacrifice } = item);
    effect = { temporaryOperating: item.operating };
    pressure = { sector, kind, label: title, capacity: item.capacity, delay: 1, implementation: 1, duration: 3 };
  } else {
    const item = content.relief;
    ({ title, description, sacrifice } = item);
    effect = { temporaryOperating: item.operating };
    // V16 operational mobilisation takes a real clock period and shares staff.
    pressure = { sector, kind, label: title, capacity: item.capacity, delay: 1, implementation: 1, duration: 2, fatigue: -6 };
  }
  const choice: Choice = { id: `live-pressure-${sector}-${kind}`, title, description,
    cost: effect.temporaryOperating !== undefined
      ? `${money(effect.investment ?? 0)} d’investissement · ${money(effect.temporaryOperating)}/an pendant ${(pressure.duration ?? 0) * 2} mois`
      : `${money(effect.investment ?? 0)} d’investissement · ${money(effect.operating ?? 0)}/an`,
    benefit: `+${number(pressure.capacity ?? 0)} unités de capacité après mise en œuvre.`, sacrifice, effect, pressure, political: { action: 'administrative' } };
  return withMetadata(g, choice);
}
export function presidencyActions(g: Game, sector: PressureSectorId): Choice[] {
  if (g.version !== 16 || !g.presidency || !g.pressure || finished(g) || !IDS.includes(sector)) return [];
  const all = g.pressure.programmes, inProgress = all.filter(item => item.status === 'preparing' || item.status === 'active');
  const actions: Choice[] = [];
  for (const kind of ['relief', 'delegate', 'programme', 'recovery'] as const) {
    const id = `live-pressure-${sector}-${kind}`;
    if (inProgress.some(item => item.sourceChoice === id)) continue;
    // A durable programme is one authored package, never a repeatedly purchasable
    // capacity button. Finite relief may be bought again only after expiration.
    if (kind === 'programme' && all.some(item => item.sourceChoice === id && item.status !== 'cancelled')) continue;
    if (kind === 'recovery' && !['disrupted', 'crisis'].includes(g.pressure.sectors[sector].stage)) continue;
    actions.push(operationalChoice(g, sector, kind));
  }
  return actions;
}
/** The authored reform catalogue is freely selectable, once per family. The
 * residency/benefits dossier retains its limited wording and zero claimed yield. */
export function presidencyReforms(g: Game): Array<{ id: string; title: string; choices: Choice[] }> {
  if (g.version !== 16 || !g.presidency || finished(g)) return [];
  const used = new Set(g.presidency.reforms.map(item => item.id));
  return NATIONAL_AGENDA.filter(item => item.kind === 'reform' && !used.has(item.id)).map(item => ({
    id: item.id, title: item.dossier.title,
    choices: item.dossier.choices.map(raw => {
      const choice = { ...structuredClone(raw), pressure: policyPressureEffects(raw), political: raw.political ?? { action: 'enact' as const } };
      return withMetadata(g, choice);
    }),
  }));
}
export function presidencyPoliticalActions(g: Game): Choice[] {
  if (g.version !== 16 || !g.presidency || finished(g)) return [];
  return (politicalDossier(g)?.choices ?? []).map(choice => withMetadata(g, choice));
}
export function presidencyCreditsChoice(g: Game): Choice {
  const p = state(g), year = yearFor(g), used = p.creditYears.includes(year);
  return { id: 'live-credits', title: 'Demander une nouvelle enveloppe au Parlement',
    description: 'Soumettre une autorisation supplémentaire de 10 Md€ pour les interventions. Le vote peut être rejeté. Une demande au maximum par année.',
    cost: '10 Md€ d’autorisation ; les dépenses n’entrent dans les comptes que lorsqu’elles sont engagées.',
    benefit: 'Une enveloppe disponible pour vos ordres et les initiatives des ministères.', sacrifice: 'Le soutien parlementaire reste nécessaire ; aucune recette nouvelle.',
    effect: {}, political: { action: 'enact' },
    presidencyOrder: { cost: 0, delay: 0, implementation: 0, ...(used ? { unavailable: 'Une demande a déjà été soumise cette année.' } : {}) } };
}
export function presidencyChoices(g: Game): Choice[] {
  if (g.version !== 16 || !g.presidency || finished(g)) return [];
  return [...IDS.flatMap(sector => presidencyActions(g, sector)), ...presidencyReforms(g).flatMap(item => item.choices),
    ...presidencyPoliticalActions(g), presidencyCreditsChoice(g)];
}
function registerProgramme(g: Game, choice: Choice) {
  if (!choice.pressure) return;
  const action = choice.pressure, delay = Math.max(1, Math.trunc(action.delay ?? 1)), implementation = Math.max(.25, Math.min(4, action.implementation ?? 1));
  // Even adverse structural changes wait for a clock period. A vote or an order
  // cannot mutate a sector stock or deliver physical capacity on a click.
  const programme: PressureProgramme = { ...action, kind: action.kind === 'maintain' || action.kind === 'defer' ? 'programme' : action.kind,
    id: `presidency-plan-${choice.id}-${g.choices.length}`, sourceChoice: choice.id, sourceTurn: g.turn,
    dueTurn: g.turn + delay, status: 'preparing', remainingWork: round(delay * implementation), implementation,
    ...(choice.effect.temporaryOperating !== undefined ? { temporaryOperating: choice.effect.temporaryOperating } : {}) };
  g.pressure!.programmes.push(programme);
}
function spend(g: Game, choice: Choice) {
  const p = state(g), cost = orderCost(choice);
  if (cost > p.reserve + .00001) throw new Error(`Crédits insuffisants : ${money(p.reserve)} disponibles pour ${money(cost)} d’engagement.`);
  p.reserve = round(Math.max(0, p.reserve - cost)); p.spent = round(p.spent + cost);
  apply(g, choice.effect);
  if (choice.delayed) g.pending.push({ due: g.turn + Math.max(1, choice.delayed.after * 6), label: choice.delayed.label, effect: structuredClone(choice.delayed.effect) });
  registerProgramme(g, choice);
}
function governmentInitiative(g: Game) {
  const p = state(g);
  if (!p.autonomy || g.politics!.cabinet === 'fallen') return;
  const sectors = [...IDS].sort((a, b) => (g.pressure!.sectors[b].pressure + (p.priority === b ? 35 : 0)) - (g.pressure!.sectors[a].pressure + (p.priority === a ? 35 : 0)) || a.localeCompare(b));
  for (const sector of sectors) {
    const front = g.pressure!.sectors[sector], priority = p.priority === sector;
    if (front.pressure < (priority ? 8 : 35)) continue;
    const live = g.pressure!.programmes.filter(item => item.sector === sector && (item.status === 'preparing' || item.status === 'active'));
    // A ministry waits for the measures it already funded; it cannot stack three
    // temporary purchases on the same front in one period.
    if (live.some(item => (item.capacity ?? 0) > 0 || (item.need ?? 0) < 0)) continue;
    const choices = presidencyActions(g, sector).filter(choice => !choice.presidencyOrder?.unavailable
      && (priority || choice.presidencyOrder!.cost <= PRESIDENCY_OPERATIONAL_LIMIT));
    const kinds = front.pressure >= 65 ? ['recovery', 'relief', 'delegate'] : priority ? ['programme', 'delegate', 'relief'] : ['delegate', 'relief'];
    const choice = kinds.flatMap(kind => choices.filter(item => item.id.endsWith(`-${kind}`)))[0];
    if (!choice) continue;
    spend(g, choice);
    addInitiative(g, { actor: 'government', sector, title: `${ministry(sector)} prend l’initiative`,
      detail: `${choice.title} : ${money(choice.presidencyOrder!.cost)} engagés. Mise en œuvre : ${choice.presidencyOrder!.delay * 2} mois au minimum, selon les équipes disponibles.`,
      cost: choice.presidencyOrder!.cost, choice: choice.id, status: 'engaged' });
    return;
  }
}
function resolveOrder(g: Game, choice: Choice, reformId?: string): { messages: string[]; vote?: VoteRecord } {
  const resolution = resolvePoliticalChoice(g.politics!, choice, g.seed, g.turn, g.society?.workers ?? 50);
  const adopted = !resolution.vote || resolution.vote.passed;
  if (adopted && choice.id !== 'live-credits') spend(g, resolution.choice);
  const political = applyPoliticalResolution(g.politics!, g, choice, resolution, g.seed, g.turn);
  // Existing politics names its 30th decision the ending. V16 has no decision
  // calendar: only its 30th clock tick can complete the term.
  if (political.ending?.kind === 'term_complete' && g.turn < 30) delete political.ending;
  g.politics = political;
  if (choice.id === 'live-credits') {
    const p = state(g); p.creditsRequested++; p.creditYears.push(yearFor(g));
    if (adopted) { p.reserve = round(p.reserve + PRESIDENCY_CREDIT_AMOUNT); p.authorised = round(p.authorised + PRESIDENCY_CREDIT_AMOUNT); }
  }
  if (reformId) state(g).reforms.push({ id: reformId, choice: choice.id, period: g.turn, adopted });
  addInitiative(g, { actor: 'president', ...(choice.pressure ? { sector: choice.pressure.sector } : {}), title: choice.title,
    detail: adopted ? choice.id === 'live-credits' ? 'Le Parlement autorise 10 Md€ supplémentaires ; aucun montant n’est ajouté aux recettes.'
      : `${choice.title} : ${money(orderCost(choice))} engagés. ${choice.pressure ? 'Les moyens attendent le calendrier et les équipes de mise en œuvre.' : choice.benefit}`
      : `${choice.title} : texte rejeté. Aucun coût ni effet de la proposition n’est engagé.`,
    cost: adopted ? orderCost(choice) : 0, choice: choice.id, status: adopted ? 'engaged' : 'rejected' });
  return { messages: [...resolution.consequences, state(g).lastEvents.at(-1)!], ...(resolution.vote ? { vote: resolution.vote } : {}) };
}
function tick(g: Game): Game {
  prepareYear(g);
  const beforeProgrammes = new Map(g.pressure!.programmes.map(item => [item.id, item.status]));
  governmentInitiative(g);
  const before = structuredClone(g);
  const clock: Choice = { id: 'live-tick', title: 'Deux mois s’écoulent', description: '', cost: '', benefit: '', sacrifice: '', effect: {}, political: { action: 'administrative' } };
  const pressure = advancePressure(before, g, clock, true);
  g.pressure = pressure.state; apply(g, pressure.effect);
  const p = state(g), social = socialYearEnd(g);
  p.budget.accruedOperating += (g.finance.operating + social.operating) / 6;
  p.budget.accruedRevenue += (g.finance.revenue + social.revenue) / 6;
  const nextPeriod = g.turn + 1;
  for (const due of g.pending.filter(item => item.due <= nextPeriod)) { apply(g, due.effect); p.lastEvents.push(due.label); }
  g.pending = g.pending.filter(item => item.due > nextPeriod);
  g.politics!.unrest = clamp(g.politics!.unrest + pressure.unrest);
  g.politics!.legitimacy = clamp(g.politics!.legitimacy + pressure.legitimacy);
  g.politics!.blocs = g.politics!.blocs.map(bloc => ({ ...bloc, loyalty: clamp(bloc.loyalty + (bloc.inGovernment ? pressure.support : 0)) }));
  g.turn = nextPeriod;
  for (const programme of g.pressure.programmes) {
    if (programme.deliveredTurn === g.turn && beforeProgrammes.get(programme.id) !== programme.status) {
      addInitiative(g, { actor: [...p.initiatives].reverse().find(item => item.choice === programme.sourceChoice && item.period === programme.sourceTurn && item.status === 'engaged')?.actor ?? 'president',
        sector: programme.sector, title: 'Des moyens entrent en service', detail: `${programme.label} est opérationnel. Le retard évolue désormais avec cette capacité effective.`,
        cost: 0, choice: programme.sourceChoice, status: 'delivered' });
    }
  }
  p.lastEvents.push(...pressure.messages);
  p.lastEvents = p.lastEvents.slice(-12);
  if (g.narrative) {
    g.narrative.events.push(...pressure.events); g.narrative.events = g.narrative.events.slice(-160);
    g.narrative.lastConsequences = [...p.lastEvents];
  }
  // Political deterioration is clock-owned too. No silent presidential removal
  // from a service-pressure gauge; a pending institutional crisis stays playable.
  const resolution = resolvePoliticalChoice(g.politics!, clock, g.seed, g.turn - 1, g.society?.workers ?? 50);
  g.politics = applyPoliticalResolution(g.politics!, g, clock, resolution, g.seed, g.turn - 1);
  if (g.turn === 30 && g.politics.ending?.kind === 'term_complete') {
    g.politics.ending.turn = 30; g.politics.ending.reason = 'Les cinq années du mandat se sont écoulées.';
  }
  const closed = g.turn % 6 === 0;
  // Compute the just-closed ledger before installing its debt for the next year.
  const remaining = closed ? 0 : 6 - g.turn % 6;
  const ledger = nationalBudget({ ...g.finance,
    operating: p.budget.accruedOperating + (g.finance.operating + social.operating) * remaining / 6 + pressure.state.budget.operating,
    revenue: p.budget.accruedRevenue + (g.finance.revenue + social.revenue) * remaining / 6 + pressure.state.budget.revenue });
  if (closed) { g.finance.debt = ledger.debt; g.finance.cash += ledger.cashChange; g.finance.gdp = ledger.gdp; }
  append(g, clock.id, clock.title, [...p.lastEvents, ...(closed ? [`Exercice ${Math.ceil(g.turn / 6)} clôturé une fois ; les dépenses acquises restent comptabilisées.`] : [])], closed, undefined, ledger);
  return g;
}
export function startPresidency(seed = 0, ambition: Ambition = 'equilibre'): Game {
  if (!Number.isInteger(seed) || seed < 0 || seed > 9999 || !['equilibre', 'services', 'resilience'].includes(ambition)) throw new Error('Scénario de présidence invalide.');
  const g = startCampaign('national', seed, ambition, undefined, 15);
  g.version = 16;
  g.presidency = { reserve: PRESIDENCY_INITIAL_RESERVE, authorised: PRESIDENCY_INITIAL_RESERVE, spent: 0, autonomy: true,
    priority: ambition === 'services' ? 'health' : ambition === 'resilience' ? 'energy' : null,
    initiatives: [], reforms: [], creditsRequested: 0, creditYears: [], preparedYear: 1,
    budget: { year: 1, accruedOperating: 0, accruedRevenue: 0 },
    lastEvents: ['Le gouvernement est en fonction. Les ministères interviennent dans leurs crédits ; vous fixez le cap.'] };
  return g;
}
export function decidePresidency(game: Game, id: string): Game {
  assertOpen(game);
  if (id !== 'live-tick' && game.choices.length >= PRESIDENCY_JOURNAL_LIMIT - (30 - game.turn)) throw new Error('La limite d’ordres est atteinte ; le mandat peut encore avancer jusqu’à son terme.');
  const g = structuredClone(game), p = state(g);
  p.lastEvents = [];
  if (id === 'live-tick') return tick(g);
  prepareYear(g);
  if (id === 'live-autonomy') {
    p.autonomy = !p.autonomy;
    const detail = p.autonomy ? 'Les ministères reprennent leurs initiatives opérationnelles dans les crédits disponibles.' : 'Les ministères poursuivent les engagements déjà financés ; toute nouvelle intervention attend votre ordre.';
    addInitiative(g, { actor: 'president', title: p.autonomy ? 'Initiative ministérielle autorisée' : 'Nouveaux engagements sous votre contrôle', detail, cost: 0, choice: id, status: 'information' });
    append(g, id, 'Mandat du gouvernement', [detail]); return g;
  }
  const sector = id.startsWith('live-priority-') ? id.slice('live-priority-'.length) as PressureSectorId : undefined;
  if (sector && IDS.includes(sector)) {
    p.priority = p.priority === sector ? null : sector;
    const detail = p.priority ? `${family(sector)} devient prioritaire : le gouvernement privilégie ce secteur dans ses prochains engagements.` : 'Le gouvernement arbitre les nouvelles interventions selon la pression de chaque secteur.';
    addInitiative(g, { actor: 'president', sector, title: p.priority ? `Priorité : ${family(sector)}` : 'Arbitrage équilibré', detail, cost: 0, choice: id, status: 'information' });
    append(g, id, 'Priorité du gouvernement', [detail]); return g;
  }
  const credit = id === 'live-credits' ? presidencyCreditsChoice(g) : undefined;
  const reform = presidencyReforms(g).find(item => item.choices.some(choice => choice.id === id));
  const choice = credit ?? reform?.choices.find(item => item.id === id) ?? presidencyPoliticalActions(g).find(item => item.id === id)
    ?? IDS.flatMap(item => presidencyActions(g, item)).find(item => item.id === id);
  if (!choice) throw new Error('Cette commande n’est pas disponible ou a déjà été engagée.');
  if (choice.presidencyOrder?.unavailable) throw new Error(choice.presidencyOrder.unavailable);
  const result = resolveOrder(g, choice, reform?.id);
  append(g, id, choice.title, result.messages, false, result.vote);
  return g;
}
/** These are the exact pressure-engine links from the previous common period,
 * only while they caused a real loss. A line on the map is never a new rule. */
export function presidencyLinks(g: Game): Array<{ from: PressureSectorId; to: PressureSectorId; loss: number; label: string }> {
  if (g.version !== 16 || !g.pressure) return [];
  const links: Array<{ from: PressureSectorId; to: PressureSectorId; capacity: number; label: string }> = [
    { from: 'housing', to: 'health', capacity: 1.2, label: 'Le manque de logements freine l’installation des équipes de soins.' },
    { from: 'transport', to: 'health', capacity: .8, label: 'Les trajets perturbés réduisent les créneaux de soins accessibles.' },
    { from: 'transport', to: 'education', capacity: .8, label: 'Les transports perturbés compliquent la présence aux enseignements.' },
    { from: 'transport', to: 'administration', capacity: .6, label: 'Les trajets perturbés compliquent l’accès aux guichets.' },
    { from: 'energy', to: 'health', capacity: 1, label: 'Les perturbations énergétiques réduisent les capacités des équipements de soins.' },
    { from: 'energy', to: 'education', capacity: .8, label: 'Les perturbations énergétiques limitent l’ouverture des bâtiments scolaires.' },
    { from: 'energy', to: 'transport', capacity: .7, label: 'Les perturbations énergétiques affectent le réseau de transport.' },
    { from: 'administration', to: 'housing', capacity: .8, label: 'Les délais d’instruction ralentissent les solutions de logement.' },
    { from: 'administration', to: 'energy', capacity: .6, label: 'Les délais d’instruction ralentissent les travaux énergétiques.' },
    { from: 'education', to: 'administration', capacity: .5, label: 'Les interruptions de cours compliquent la disponibilité des parents aux guichets.' },
  ];
  if (!g.history.length) return [];
  // Front causes are written during advancePressure from its common previous
  // state; use their presence, then the last pressure delta to recover that state.
  const active = links.flatMap(link => {
    const front = g.pressure!.sectors[link.to], source = g.pressure!.sectors[link.from];
    if (!front.causes.some(cause => cause.kind === 'link' && cause.label === link.label)) return [];
    const beforePressure = source.pressure - source.pressureChange;
    const loss = link.capacity * Math.max(0, Math.min(1, (beforePressure - 60) / 40));
    return loss > .01 ? [{ from: link.from, to: link.to, loss, label: link.label }] : [];
  });
  // The shared pressure engine caps combined incoming losses at 2.2 units per
  // destination. Allocate that cap proportionally rather than drawing an
  // uncapped line claiming capacity the simulation never actually removed.
  return active.map(link => ({ ...link, loss: round(link.loss * Math.min(1, 2.2 / active.filter(item => item.to === link.to).reduce((sum, item) => sum + item.loss, 0))) }));
}
