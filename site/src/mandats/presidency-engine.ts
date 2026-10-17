import { initialCrises, advanceCrises, advanceCivicPressure, presidencyCrises, crisisSpec, crisisChoices, crisisSeverity } from './presidency-crises.ts';
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
  p.initiatives.push({ ...item, id: `presidency-${g.choices.length}-${g.turn}-${p.initiativeSerial ?? 0}`, period: g.turn });
  p.initiativeSerial = (p.initiativeSerial ?? 0) + 1;
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
  return [...crisisChoices(g, sector).map(choice => withMetadata(g, choice)), ...actions];
}
/** The authored reform catalogue is freely selectable, once per family. The
 * residency/benefits dossier retains its limited wording and zero claimed yield. */
export function presidencyReforms(g: Game): Array<{ id: string; title: string; choices: Choice[] }> {
  if (g.version !== 16 || !g.presidency || finished(g)) return [];
  const used = new Set([...g.presidency.reforms.filter(item => item.adopted).map(item => item.id), ...(g.presidency.reformArchive ?? []).map(item => item.id)]);
  return NATIONAL_AGENDA.filter(item => item.kind === 'reform' && !used.has(item.id)).map(item => ({
    id: item.id, title: item.dossier.title,
    choices: item.dossier.choices.filter(raw => !g.presidency!.reforms.some(attempt => attempt.id === item.id && attempt.choice === raw.id)).map(raw => {
      const choice = { ...structuredClone(raw), pressure: policyPressureEffects(raw), political: raw.political ?? { action: 'enact' as const } };
      const availablePeriod=g.presidency!.reformEvents?.find(e=>e.id===item.id)?.availablePeriod ?? 0;
      const prepared=withMetadata(g,choice);
      if(g.turn<availablePeriod)prepared.presidencyOrder!.unavailable=`Consultations en cours : dossier disponible dans ${(availablePeriod-g.turn)*2} mois.`;
      return prepared;
    }),
  }));
}
export type PresidencyEvent = { id: string; title: string; kind: 'reform' | 'political' | 'budget' | 'government' | 'followup'; sector: PressureSectorId; detail: string; choices: Choice[]; deadline?: number; reason?: string; status?: 'decision' | 'preparing' | 'delivered' | 'rejected'; progress?: number };
export function presidencyFeedback(g: Game) { return g.presidency?.lastFeedback; }
export function presidencyPriorityChoice(g: Game, sector: PressureSectorId): Choice {
 return { id: `live-priority-${sector}`, title: g.presidency?.priority === sector ? 'Retirer cette priorité' : 'Donner la priorité à ce secteur', description: 'Les ministres privilégient ce secteur dans les prochains engagements, avec les mêmes crédits et équipes.', cost: 'Aucun crédit supplémentaire.', benefit: 'Les prochains arbitrages ministériels suivent cette priorité.', sacrifice: 'Les autres secteurs attendent les moyens disponibles.', effect: {}, political: { action: 'administrative' }, presidencyOrder: { cost: 0, delay: 0, implementation: 0 } };
}
function reformControl(id: string, action: 'defer' | 'withdraw'): Choice {
 return { id: `live-reform-${action}-${id}`, title: action === 'defer' ? 'Reporter les consultations de quatre mois' : 'Retirer cette proposition', description: action === 'defer' ? 'Le dossier reviendra dans deux périodes. Un seul report est possible.' : 'Ce dossier quitte l’ordre du jour pour ce mandat.', cost: 'Aucun engagement.', benefit: 'Libérer l’ordre du jour.', sacrifice: 'Aucune amélioration de service pendant cette attente.', effect: {}, political: { action: 'administrative' }, presidencyOrder: { cost: 0, delay: 0, implementation: 0 } };
}

function advanceReformEvents(g: Game): void {
 const p=state(g); p.reformEvents ??=[]; p.reformArchive ??=[]; p.nextReformPeriod ??=0;
 for(const event of p.reformEvents) if(g.turn >= (event.expiresPeriod ?? event.offeredPeriod+5)) {
  p.reformArchive.push({id:event.id,period:g.turn,outcome:'expired'});
  p.lastEvents.push('Une proposition est retirée faute d’arbitrage : aucune mesure ni dépense engagée.');
 }
 p.reformEvents=p.reformEvents.filter(e=>!p.reformArchive!.some(a=>a.id===e.id)&&!p.reforms.some(r=>r.id===e.id&&r.adopted));
 if(g.turn<p.nextReformPeriod || p.reformEvents.filter(e=>(e.availablePeriod??0)<=g.turn).length>=2 || g.turn>=28)return;
 const remaining=presidencyReforms(g).filter(r=>r.choices.length&&!p.reformEvents!.some(e=>e.id===r.id));
 if(!remaining.length)return;
 const score=(r:typeof remaining[number])=> {
  const sector=r.choices.find(c=>c.pressure)?.pressure?.sector;
  return (sector ? g.pressure!.sectors[sector].pressure*.7 : 15) + ((g.seed*37+g.turn*19+NATIONAL_AGENDA.findIndex(a=>a.id===r.id)*29)%47);
 };
 remaining.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));
 const item=remaining[0], sector=item.choices.find(c=>c.pressure)?.pressure?.sector;
 p.reformEvents.push({id:item.id,offeredPeriod:g.turn,expiresPeriod:g.turn+5,reason:sector?`Les besoins en ${ministry(sector).toLowerCase()} ouvrent ce dossier.`:'Une fenêtre parlementaire ouvre ce dossier.'});
 p.nextReformPeriod=g.turn+2+(g.seed+g.turn)%2;
 p.lastEvents.push(`Une réforme arrive à l’ordre du jour : ${item.title}`);
}
export function presidencyEvents(g: Game): PresidencyEvent[] {
  if (g.version !== 16 || !g.presidency || finished(g)) return [];
  const reforms = presidencyReforms(g);
  const events: PresidencyEvent[] = (g.presidency.reformEvents ?? []).flatMap(event => {
    const reform = (event.availablePeriod ?? 0) <= g.turn ? reforms.find(item => item.id === event.id) : undefined;
    return reform ? [{ ...reform, kind: 'reform' as const, sector: reform.choices.find(c => c.pressure)?.pressure?.sector ?? 'administration' as PressureSectorId,
      reason: event.reason, status: 'decision' as const, deadline: event.expiresPeriod ?? event.offeredPeriod + 5, choices: [...reform.choices, ...(!event.deferred ? [reformControl(event.id,'defer')] : []), reformControl(event.id,'withdraw')], detail: NATIONAL_AGENDA.find(item => item.id === reform.id)!.dossier.story }] : [];
  });
  const civil = g.presidency.civic?.crisis;
  if (civil && civil.status !== 'resolved') events.push({ id: civil.id, kind: 'political', title: crisisSpec(civil).title, sector: civil.sector,
    detail: crisisSpec(civil).cause, deadline: (civil.stageStartedPeriod ?? civil.startedPeriod) + civil.deadline,
    choices: [...crisisChoices(g, civil.sector).filter(choice => choice.pressure?.crisisId === civil.id).map(choice => withMetadata(g, choice)), ...presidencyPoliticalActions(g).filter(choice => choice.id === 'live-resign')] });
  if (g.politics?.pendingCrisis) {
    const dossier = politicalDossier(g);
    if (dossier) events.push({ id: `political-${g.politics.pendingCrisis}`, kind: 'political', title: dossier.title, sector: 'administration',
      detail: g.politics.pendingCrisis === 'cabinet' && g.presidency.civic?.cabinetResignationPeriod !== undefined
        ? 'Le gouvernement a présenté sa démission face à la révolte sociale. Votre mandat présidentiel continue : il faut constituer un gouvernement disposant d’un appui à l’Assemblée.'
        : dossier.story, choices: presidencyPoliticalActions(g) });
  }
  if(g.presidency.reserve < 1.5 || presidencyCrises(g).some(crisis=>{const responses=presidencyActions(g,crisis.sector).filter(c=>c.pressure?.crisisId===crisis.id);return responses.length>0 && responses.every(c=>(c.presidencyOrder?.cost??0)>g.presidency!.reserve+.00001);})) events.push({id:'budget-credits',kind:'budget',sector:'administration',title:'Financer les interventions',reason:'La réserve devient insuffisante.',detail:`${money(g.presidency.reserve)} disponibles. Les engagements attendent une autorisation réelle. Une demande de crédits est possible chaque année.`,choices:presidencyBudgetChoices(g),status:'decision'});
  if(!g.politics?.pendingCrisis) events.push({id:'government-orders',kind:'government',sector:'administration',title:g.presidency.cabinet?.name ?? 'Le gouvernement en fonction',reason:'Fixer le mandat des ministres.',detail:`${g.presidency.autonomy?'Les ministres peuvent engager des interventions.':'Les nouveaux engagements attendent vos ordres.'} La priorité se choisit directement sur chaque secteur.`,choices:[{id:'live-autonomy',title:g.presidency.autonomy?'Reprendre les engagements en main':'Autoriser les initiatives des ministres',description:'Les chantiers déjà financés continuent.',cost:'Aucun crédit créé.',benefit:'Modifier le mandat des ministres.',sacrifice:'Les équipes et crédits restent partagés.',effect:{},political:{action:'administrative'},presidencyOrder:{cost:0,delay:0,implementation:0}}, ...presidencyBudgetChoices(g)]});
  for(const sector of IDS) {
   const projects=g.pressure!.programmes.filter(p=>p.sector===sector&&(p.status==='preparing'||(p.deliveredTurn!==undefined&&g.turn-p.deliveredTurn<=1)));
   if(!projects.length)continue;
   const pending=projects.filter(p=>p.status==='preparing'), total=projects.reduce((sum,p)=>sum+Math.max(1,(p.delay??1)*(p.implementation??1)),0), remaining=pending.reduce((sum,p)=>sum+p.remainingWork,0);
   events.push({id:`followup-${sector}`,kind:'followup',sector,title:pending.length?`${pending.length} intervention${pending.length>1?'s':''} en préparation`:'Moyens en service',reason:projects.map(p=>p.label).join(' · '),detail:projects.map(p=>p.status==='preparing'?`${p.label} : travail restant ${number(p.remainingWork)}, équipes partagées.`:`${p.label} : capacité en service ; les retards restent à rattraper.`).join(' '),choices:[],status:pending.length?'preparing':'delivered',progress:Math.max(0,Math.min(1,1-remaining/total))});
  }
  return events;
}
export function presidencyPoliticalActions(g: Game): Choice[] {
  if (g.version !== 16 || !g.presidency || finished(g)) return [];
  const cabinet=g.presidency.cabinet;
  if(g.politics?.pendingCrisis==='cabinet' && cabinet?.agreement) return [{id:'live-cabinet-appoint',title:`Nommer le gouvernement ${cabinet.agreement.name}`,description:'L’accord parlementaire est adopté. La nomination remet les ministères en fonction.',cost:'Les concessions de l’accord sont déjà engagées.',benefit:'La capacité du gouvernement reprend à la prochaine période.',sacrifice:'Le programme négocié engage le gouvernement.',effect:{},political:{action:'administrative'},presidencyOrder:{cost:0,delay:0,implementation:0}}];
  const choices = (politicalDossier(g)?.choices ?? []).filter(choice=> !cabinet?.attempts.some(a=>a.choice===choice.id&&a.period===g.turn)).map(choice => withMetadata(g, choice.id==='pol-cabinet-cohabitation'?{...choice,title:'Soumettre un accord de cohabitation',description:'Consulter les groupes puis soumettre leur accord au vote. La nomination aura lieu seulement après adoption.'}:choice));
  if(g.politics?.pendingCrisis==='cabinet' && cabinet?.attempts.some(a=>a.period===g.turn) && !cabinet.attempts.some(a=>a.choice==='live-cabinet-compromise'&&a.period===g.turn)) {
   const raw=politicalDossier(g)?.choices.find(c=>c.id==='pol-cabinet-cohabitation');
   if(raw)choices.unshift(withMetadata(g,{...raw,id:'live-cabinet-compromise',title:'Proposer un accord de services publics',description:'Une autre coalition examine un compromis qui protège les moyens de fonctionnement, avec une charge annuelle de 0,2 Md€.',effect:{operating:.2},political:{action:'coalition_government',vote:'law'}}));
  }
  if (g.presidency.civic?.crisis?.spec === 'revolution' && g.presidency.civic.crisis.status !== 'resolved') choices.push({
    id: 'live-resign', title: 'Présenter votre démission', description: 'Mettre fin à votre mandat présidentiel et ouvrir une transition.',
    cost: 'Le mandat prend fin immédiatement.', benefit: 'Une transition est engagée.', sacrifice: 'Vous quittez la présidence avant cinq ans.', effect: {}, political: { action: 'administrative' }, presidencyOrder: { cost: 0, delay: 0, implementation: 0 } });
  return choices;
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
export function presidencyBudgetChoices(g: Game): Choice[] {
 const p=state(g), year=yearFor(g);
 const choice=(id:string,title:string,description:string,benefit:string,sacrifice:string,unavailable?:string):Choice=>({id,title,description,cost:'Aucune recette nouvelle.',benefit,sacrifice,effect:{},political:{action:'administrative'},presidencyOrder:{cost:0,delay:0,implementation:0,...(unavailable?{unavailable}:{})}});
 return [presidencyCreditsChoice(g),choice('live-budget-redeploy','Réaffecter 0,8 Md€ d’investissement','Reporter une partie de l’investissement général et réserver cette enveloppe aux interventions prioritaires. Une fois par année.','0,8 Md€ deviennent disponibles pour les interventions.','Les investissements généraux reculent ; les actifs publics perdent un point.',p.redeploymentYears?.includes(year)?'Une réaffectation a déjà été décidée cette année.':g.finance.investment<.8?'Aucune enveloppe d’investissement disponible.':undefined),choice('live-budget-hold','Différer les nouveaux engagements','Suspendre les initiatives ministérielles. Les chantiers financés continuent et le calendrier avance vers le prochain budget.','Conserver la réserve actuelle et attendre la prochaine fenêtre budgétaire.','Les besoins non financés restent sans réponse.',p.budgetHoldYears?.includes(year)?'Le report est déjà enregistré pour cette année.':undefined)];
}
export function presidencyChoices(g: Game): Choice[] {
  if (g.version !== 16 || !g.presidency || finished(g)) return [];
  return [...IDS.flatMap(sector => presidencyActions(g, sector)), ...presidencyReforms(g).flatMap(item => item.choices),
    ...presidencyPoliticalActions(g), ...presidencyBudgetChoices(g)];
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
    const choices = presidencyActions(g, sector).filter(choice => !choice.presidencyOrder?.unavailable
      && (priority || choice.presidencyOrder!.cost <= PRESIDENCY_OPERATIONAL_LIMIT));
    const kinds = front.pressure >= 65 ? ['recovery', 'relief', 'delegate'] : priority ? ['programme', 'delegate', 'relief'] : ['delegate', 'relief'];
    const incidents = choices.filter(choice => choice.pressure?.crisisId).sort((a, b) => {
      const ca = presidencyCrises(g).find(c => c.id === a.pressure!.crisisId)!;
      const cb = presidencyCrises(g).find(c => c.id === b.pressure!.crisisId)!;
      return Number(cb.status === 'active') - Number(ca.status === 'active')
        || crisisSeverity(cb, g.turn) - crisisSeverity(ca, g.turn)
        || ca.startedPeriod - cb.startedPeriod
        || Number(b.pressure!.crisisOutcome === 'resolve') - Number(a.pressure!.crisisOutcome === 'resolve');
    });
    // A programme for one incident cannot suppress a different emergency in the
    // same sector. Ordinary capacity purchases still wait for their funded means.
    const choice = incidents[0] ?? (live.some(item => (item.capacity ?? 0) > 0 || (item.need ?? 0) < 0) ? undefined
      : kinds.flatMap(kind => choices.filter(item => item.id.endsWith(`-${kind}`)))[0]);
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
  if(choice.political?.action==='coalition_government') {
   const cabinet=state(g).cabinet ??= {serial:0,name:'Gouvernement initial',appointedPeriod:0,attempts:[]};
   cabinet.attempts.push({choice:choice.id,period:g.turn});
   if(adopted){cabinet.agreement={name:choice.id==='live-cabinet-compromise'?'de services publics':'de cohabitation',period:g.turn};political.cabinet='fallen';political.pendingCrisis='cabinet';}
  }
  state(g).lastFeedback={status:adopted?(resolution.vote?'adopted':choice.pressure?'engaged':'information'):'rejected',title:adopted?(resolution.vote?(choice.id==='live-credits'?'Crédits autorisés':reformId?'Réforme adoptée':'Accord adopté'):choice.pressure?'Intervention engagée':'Décision enregistrée'):'Proposition rejetée',detail:resolution.vote?`${resolution.vote.for} pour, ${resolution.vote.against} contre. ${adopted?(choice.id==='live-credits'?'10 Md€ autorisés pour financer des interventions.':choice.political?.action==='coalition_government'?'Le gouvernement peut maintenant être nommé.':choice.pressure?'La préparation peut commencer.':'Les effets votés sont enregistrés.'): 'Aucun coût ni effet de la proposition. Une autre orientation ou de nouvelles consultations sont nécessaires.'}`:choice.pressure?`${choice.title}. Les équipes préparent la mise en service ; le problème reste ouvert.`:choice.benefit};
  if (state(g).civic && political.pendingCrisis !== 'cabinet') delete state(g).civic!.cabinetResignationPeriod;
  if (choice.id === 'live-credits') {
    const p = state(g); p.creditsRequested++; p.creditYears.push(yearFor(g));
    if (adopted) { p.reserve = round(p.reserve + PRESIDENCY_CREDIT_AMOUNT); p.authorised = round(p.authorised + PRESIDENCY_CREDIT_AMOUNT); }
  }
  if (reformId) {
    state(g).reforms.push({ id: reformId, choice: choice.id, period: g.turn, adopted });
    state(g).reformEvents = state(g).reformEvents?.filter(event => event.id !== reformId);
    if(!adopted) state(g).reformEvents!.push({id:reformId,offeredPeriod:g.turn,availablePeriod:g.turn+1,expiresPeriod:g.turn+5,reason:'Le texte a été rejeté : choisir une autre orientation après les consultations.'});
  }
  if (choice.id === 'live-resign') g.politics!.ending = { kind: 'resignation', title: 'Vous démissionnez',
    reason: 'Vous présentez votre démission face à la crise révolutionnaire.', turn: g.turn, causes: ['Crise révolutionnaire ouverte', 'Démission présidentielle choisie'] };
  addInitiative(g, { actor: 'president', ...(choice.pressure ? { sector: choice.pressure.sector } : {}), title: choice.title,
    detail: adopted ? choice.id === 'live-credits' ? 'Le Parlement autorise 10 Md€ supplémentaires ; aucun montant n’est ajouté aux recettes.'
      : `${choice.title} : ${money(orderCost(choice))} engagés. ${choice.pressure ? 'Les moyens attendent le calendrier et les équipes de mise en œuvre.' : choice.benefit}`
      : `${choice.title} : texte rejeté. Aucun coût ni effet de la proposition n’est engagé.`,
    cost: adopted ? orderCost(choice) : 0, choice: choice.id, status: adopted ? 'engaged' : 'rejected' });
  return { messages: [...resolution.consequences, state(g).lastEvents.at(-1)!], ...(resolution.vote ? { vote: resolution.vote } : {}) };
}
function tick(g: Game): Game {
  prepareYear(g);
  const previousCrisisState = structuredClone(g);
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
  advanceCrises(g, previousCrisisState);
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
  advanceCivicPressure(g);
  if(g.politics.pendingCrisis!=='cabinet' && p.cabinet)delete p.cabinet.agreement;
  advanceReformEvents(g);
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
    cabinet: { serial: 0, name: 'Gouvernement initial', appointedPeriod: 0, attempts: [] }, initiatives: [], reforms: [], creditsRequested: 0, creditYears: [], preparedYear: 1,
    budget: { year: 1, accruedOperating: 0, accruedRevenue: 0 },
    lastEvents: ['Le gouvernement est en fonction. Les ministères interviennent dans leurs crédits ; vous fixez le cap.'] };
  initialCrises(g);
  advanceReformEvents(g);
  return g;
}
export function decidePresidency(game: Game, id: string): Game {
  assertOpen(game);
  if (id !== 'live-tick' && game.choices.length >= PRESIDENCY_JOURNAL_LIMIT - (30 - game.turn)) throw new Error('La limite d’ordres est atteinte ; le mandat peut encore avancer jusqu’à son terme.');
  const g = structuredClone(game), p = state(g);
  p.lastEvents = []; delete p.lastFeedback;
  if (id === 'live-tick') return tick(g);
  prepareYear(g);
  if (id === 'live-autonomy') {
    p.autonomy = !p.autonomy;
    const detail = p.autonomy ? 'Les ministères reprennent leurs initiatives opérationnelles dans les crédits disponibles.' : 'Les ministères poursuivent les engagements déjà financés ; toute nouvelle intervention attend votre ordre.';
    addInitiative(g, { actor: 'president', title: p.autonomy ? 'Initiative ministérielle autorisée' : 'Nouveaux engagements sous votre contrôle', detail, cost: 0, choice: id, status: 'information' });
    p.lastFeedback={status:'information',title:p.autonomy?'Initiatives autorisées':'Engagements sous votre contrôle',detail}; append(g, id, 'Mandat du gouvernement', [detail]); return g;
  }
  const sector = id.startsWith('live-priority-') ? id.slice('live-priority-'.length) as PressureSectorId : undefined;
  if (sector && IDS.includes(sector)) {
    p.priority = p.priority === sector ? null : sector;
    const detail = p.priority ? `${family(sector)} devient prioritaire : le gouvernement privilégie ce secteur dans ses prochains engagements.` : 'Le gouvernement arbitre les nouvelles interventions selon la pression de chaque secteur.';
    addInitiative(g, { actor: 'president', sector, title: p.priority ? `Priorité : ${family(sector)}` : 'Arbitrage équilibré', detail, cost: 0, choice: id, status: 'information' });
    p.lastFeedback={status:'information',title:p.priority?'Priorité enregistrée':'Priorité retirée',detail}; append(g, id, 'Priorité du gouvernement', [detail]); return g;
  }
  if(id==='live-budget-redeploy'||id==='live-budget-hold') {
   const choice=presidencyBudgetChoices(g).find(c=>c.id===id)!;
   if(choice.presidencyOrder?.unavailable)throw new Error(choice.presidencyOrder.unavailable);
   const year=yearFor(g), redeploy=id==='live-budget-redeploy';
   if(redeploy){(p.redeploymentYears??=[]).push(year);p.reserve=round(p.reserve+.8);p.authorised=round(p.authorised+.8);apply(g,{investment:-.8,assets:-1});}
   else{(p.budgetHoldYears??=[]).push(year);p.autonomy=false;}
   p.lastFeedback={status:'information',title:redeploy?'Enveloppe réaffectée':'Nouveaux engagements différés',detail:redeploy?'0,8 Md€ transférés de l’investissement général. Les actifs publics perdent un point ; aucune recette créée.':'Les ministres ne lancent plus de nouvel engagement. Les projets financés continuent ; les besoins non financés persistent.'};
   addInitiative(g,{actor:'president',title:p.lastFeedback.title,detail:p.lastFeedback.detail,cost:0,choice:id,status:'information'});append(g,id,p.lastFeedback.title,[p.lastFeedback.detail]);return g;
  }
  if(id==='live-cabinet-appoint') {
   const cabinet=p.cabinet;
   if(!cabinet?.agreement||g.politics!.pendingCrisis!=='cabinet')throw new Error('Aucun accord de gouvernement à nommer.');
   cabinet.serial++;cabinet.name=`Gouvernement ${cabinet.agreement.name} ${cabinet.serial}`;cabinet.appointedPeriod=g.turn;delete cabinet.agreement;
   g.politics!.cabinet='cohabitation';delete g.politics!.pendingCrisis;
   p.lastFeedback={status:'information',title:'Gouvernement nommé',detail:`${cabinet.name} entre en fonction. Les ministères reprennent leur capacité d’exécution.`};
   addInitiative(g,{actor:'president',title:p.lastFeedback.title,detail:p.lastFeedback.detail,cost:0,choice:id,status:'information'});
   append(g,id,p.lastFeedback.title,[p.lastFeedback.detail]);return g;
  }
  if(id.startsWith('live-reform-defer-')||id.startsWith('live-reform-withdraw-')) {
   const defer=id.startsWith('live-reform-defer-'), reformId=id.slice(defer?'live-reform-defer-'.length:'live-reform-withdraw-'.length);
   const event=p.reformEvents?.find(e=>e.id===reformId&&(e.availablePeriod??0)<=g.turn);
   if(!event||(defer&&event.deferred))throw new Error('Ce dossier ne peut plus être reporté.');
   if(defer){event.availablePeriod=g.turn+2;event.expiresPeriod=g.turn+5;event.deferred=true;}
   else{(p.reformArchive??=[]).push({id:reformId,period:g.turn,outcome:'withdrawn'});p.reformEvents=p.reformEvents!.filter(e=>e.id!==reformId);}
   const title=defer?'Consultations reportées':'Proposition retirée';
   p.lastFeedback={status:'information',title,detail:defer?'Le dossier reviendra dans quatre mois ; aucun effet ni coût engagé.':'Ce dossier quitte le mandat ; aucune mesure engagée.'};
   addInitiative(g,{actor:'president',title,detail:p.lastFeedback.detail,cost:0,choice:id,status:'information'});append(g,id,title,[p.lastFeedback.detail]);return g;
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
