import type { Ambition, Choice, Effect, Game, Ledger } from './types.ts';
import type { PressureProgramme, PressureSectorId } from './pressure-types.ts';
import type { PresidencyInitiative } from './presidency-types.ts';
import type { PresidencyEvent } from './presidency-engine.ts';
import type { StrategyActionId, StrategyActionSpec, StrategyStage } from './presidency-strategy-content.ts';
import type { StrategyCommitment, StrategyOutcome, StrategyState } from './presidency-strategy-types.ts';
import { STRATEGY_SECTOR_IDS, STRATEGY_SECTORS } from './presidency-strategy-content.ts';
import { startPresidency } from './presidency-engine.ts';
import { advancePressure, PRESSURE_SECTORS } from './pressure-engine.ts';
import { nationalBudget } from './national.ts';
import { NATIONAL_AGENDA } from './national-agenda.ts';
import { policyPressureEffects } from './pressure-content.ts';
import { socialYearEnd, applySociety } from './national-society.ts';
import { resolvePoliticalChoice } from './politics.ts';
import { clamp } from './types.ts';

/** V17 explicit hypotheses. 30 two-month clock periods; orders spend no time.
 * An 18 Md€ intervention authorisation is distinct from public cash and receipts.
 * Ministers may fund one permanent, bounded operational arrangement per sector;
 * its annual rate then accrues on the clock, without repeated purchase prompts.
 * Their competence changes real capacity, their written mandate limits expense.
 * Major programmes use the very same four-unit delivery pool and reserve.
 * Outcomes depend on delivered services/backlogs, fiscal and government viability,
 * never click count. Four critical fronts sustained for three periods open a
 * three-period recovery window before institutional failure can be recorded.
 */
export const STRATEGY_INITIAL_RESERVE = 18;
export const STRATEGY_JOURNAL_LIMIT = 512;
const IDS = STRATEGY_SECTOR_IDS;
const STAGES: Array<'normal' | StrategyStage> = ['normal','warning','accumulation','organisation','conflict','national'];
const ACTION_IDS: StrategyActionId[] = ['capacity','organisation','agreement','recovery','network'];
const round = (n: number) => Math.round(n * 1000) / 1000;
const num = (n: number) => new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 2}).format(n);
const money = (n: number) => `${num(n)} Md€`;
const year = (g: Game) => Math.min(5, Math.floor(g.turn / 6) + 1);
const open = (g: Game) => g.turn < 30 && !g.politics?.ending;
const presidency = (g: Game) => {
  if (g.version !== 17 || !g.presidency?.strategy || !g.pressure || !g.politics) throw new Error('Cette partie ne possède pas de stratégie présidentielle v17.');
  return g.presidency;
};
export function strategyState(g: Game): StrategyState { return presidency(g).strategy!; }
const support = (g: Game) => {
  const blocs = g.politics!.blocs.filter(b => b.inGovernment), seats = blocs.reduce((n,b) => n+b.seats,0);
  return seats ? blocs.reduce((n,b) => n+b.loyalty*b.seats,0)/seats : 0;
};
export function strategySupport(g: Game): number { presidency(g); return support(g); }
function changeSupport(g: Game, value: number) {
  g.politics!.blocs = g.politics!.blocs.map(b => ({...b,loyalty:clamp(b.loyalty+(b.inGovernment?value:0))}));
}
function apply(g: Game, e: Effect) {
  applySociety(g,e.society);
  for (const k of ['revenue','operating','investment','grants','repayment','growth'] as const) g.finance[k] += e[k]??0;
  for (const k of ['services','cohesion','resilience','trust','assets'] as const) g.metrics[k] = clamp(g.metrics[k]+(e[k]??0));
  for (const a of g.areas) {
    if (!e.area || e.area===a.id) { a.services=clamp(a.services+(e.services??0));a.resilience=clamp(a.resilience+(e.resilience??0)); }
    const local=e.areaEffects?.[a.id];if(local){a.services=clamp(a.services+(local.services??0));a.resilience=clamp(a.resilience+(local.resilience??0));}
  }
}
function material(g: Game, detail: string) {
  const s=strategyState(g);s.lastMaterialEvents.push(detail);s.lastMaterialEvents=s.lastMaterialEvents.slice(-8);
  presidency(g).lastEvents.push(detail);presidency(g).lastEvents=presidency(g).lastEvents.slice(-12);
}
function initiative(g: Game, item: Omit<PresidencyInitiative,'id'|'period'>) {
  const p=presidency(g);p.initiativeSerial=(p.initiativeSerial??0)+1;
  p.initiatives.push({...item,id:`strategy-${g.choices.length}-${p.initiativeSerial}`,period:g.turn});p.initiatives=p.initiatives.slice(-96);
  material(g,item.detail);
}
function prepareYear(g: Game) {
  const p=presidency(g),y=year(g);if(p.preparedYear===y)return;
  g.finance.revenue*=(1+g.finance.growth)*(1+g.finance.deflator);g.finance.operating*=1+g.finance.deflator;
  g.finance.investment=40;g.finance.grants=0;g.finance.repayment=0;g.finance.rate+=.2*(g.finance.marketRate-g.finance.rate);
  p.preparedYear=y;p.budget={year:y,accruedOperating:0,accruedRevenue:0};
  g.pressure!.budget={year:y,accruedOperating:0,accruedRevenue:0,operating:0,revenue:0};
}
export function strategyLedger(g: Game): Ledger {
  const p=presidency(g),closed=g.turn>0&&g.turn%6===0&&p.preparedYear===g.turn/6;
  if(closed&&g.history.at(-1)?.closed)return structuredClone(g.history.at(-1)!.ledger);
  const remaining=closed?0:6-g.turn%6,social=socialYearEnd(g),pressure=g.pressure!.budget;
  return nationalBudget({...g.finance,operating:p.budget.accruedOperating+(g.finance.operating+social.operating)*remaining/6+pressure.operating,
    revenue:p.budget.accruedRevenue+(g.finance.revenue+social.revenue)*remaining/6+pressure.revenue});
}
/** A completed year's deficit must not hide the next year's running charges.
 * Prepare that objective's forecast on a clone; the closed book and cash/debt
 * already recorded by the clock remain authoritative and unchanged. */
function objectiveFinances(g:Game):{ledger:Ledger;year:number;closed:boolean} {
  const nextYear=open(g)&&g.turn>0&&g.turn%6===0;
  const projected=nextYear?structuredClone(g):g;
  if(nextYear)prepareYear(projected);
  const p=presidency(projected);
  return {ledger:strategyLedger(projected),year:p.preparedYear,
    closed:!open(g)&&g.turn>0&&g.turn%6===0&&p.preparedYear===g.turn/6};
}
function record(g: Game,id:string,title:string,messages:string[],ledger=strategyLedger(g),closed=false,vote?:import('./politics-types.ts').VoteRecord) {
  g.choices.push(id);g.history.push({year:closed?Math.max(1,Math.ceil(g.turn/6)):year(g),closed,choice:id,title,messages:[...messages],
    event:id==='live-tick'?'Le pays évolue, le gouvernement met en œuvre son mandat.':'Ordre enregistré ; le calendrier reste inchangé.',ledger,
    metrics:structuredClone(g.metrics),areas:structuredClone(g.areas),...(vote?{vote:structuredClone(vote)}:{})});
}
const actionFor = (sector:PressureSectorId,id:StrategyActionId):StrategyActionSpec => {
  const c=STRATEGY_SECTORS[sector];return id==='organisation'?c.organisationPlan:c[id];
};
function commitmentCost(c:Choice) {return round(Math.max(0,c.effect.investment??0)+Math.max(0,c.effect.operating??0)+Math.max(0,c.effect.temporaryOperating??0)*(c.pressure?.duration??0)/6);}
function metadata(g:Game,c:Choice,reason?:string):Choice {
  const cost=commitmentCost(c),p=presidency(g);
  const parliamentary=c.political?.vote==='law'||c.political?.action==='enact'||c.political?.action==='coalition_bargain';
  const calendarReason=parliamentary&&strategyState(g).lastParliamentPeriod===g.turn?'L’Assemblée a déjà examiné un texte pendant cette période. Le prochain passage attend la période suivante (deux mois).':undefined;
  const unavailable=reason??calendarReason??(cost>p.reserve+.00001?`${money(p.reserve)} disponibles ; ${money(cost)} nécessaires.`:undefined);
  const physicalRunning=c.pressure&&!c.pressure.duration&&c.effect.operating;
  return {...c,...(physicalRunning?{cost:`${c.cost} Le fonctionnement change à la mise en service, après préparation.`}:{}),presidencyOrder:{cost,delay:c.pressure?Math.max(1,c.pressure.delay??1):0,implementation:c.pressure?.implementation??0,...(unavailable?{unavailable}:{})}};
}
function sectorChoice(g:Game,sector:PressureSectorId,kind:StrategyActionId):Choice {
  const spec=actionFor(sector,kind),s=strategyState(g),front=s.sectors[sector],commitments=s.commitments;
  const done=commitments.find(c=>c.sector===sector&&c.kind===kind);
  const transformed=front.transformations.some(t=>t.kind==='capacity'||t.kind==='organisation'||t.kind==='legislation'&&(t.capacity>0||t.need<0));
  let unavailable=done?done.status==='preparing'?'Déjà financé ; les équipes préparent la livraison.':kind==='recovery'?'Cette mobilisation exceptionnelle a déjà été engagée pour ce mandat.':'Cette transformation est déjà en service.':undefined;
  if(!unavailable&&spec.requires?.transformation&&!transformed)unavailable='Une première transformation de capacité ou d’organisation doit être livrée.';
  if(!unavailable&&spec.requires?.phase&&STAGES.indexOf(front.phase)<STAGES.indexOf(spec.requires.phase))unavailable=`Disponible si la situation atteint le stade « ${{warning:'alerte',accumulation:'retards accumulés',organisation:'organisation sous tension',conflict:'conflit social',national:'arbitrage national'}[spec.requires.phase]} ».`;
  if(!unavailable&&spec.supportCost>0&&support(g)-spec.supportCost<25)unavailable='Un compromis politique est nécessaire : conserver au moins 25 points d’appui après l’engagement.';
  if(!unavailable&&g.politics!.cabinet==='fallen')unavailable='Constituer un gouvernement avant de lancer une transformation.';
  const effect:Effect={investment:spec.investment,...(spec.duration?{temporaryOperating:spec.annualOperating}:{operating:spec.annualOperating})};
  const pressure={sector,kind:spec.duration?'relief' as const:'programme' as const,label:spec.title,capacity:spec.capacity,need:spec.need,fatigue:spec.fatigue,delay:spec.delay,implementation:spec.teams,...(spec.duration?{duration:spec.duration}:{})};
  return metadata(g,{id:`s17-${sector}-${kind}`,title:spec.title,description:spec.description,
    cost:`${money(spec.investment)} d’investissement · ${money(spec.annualOperating)}/an${spec.duration?` pendant ${spec.duration*2} mois`:''}${spec.supportCost?` · ${spec.supportCost} points d’appui politique`:''}`,
    benefit:[spec.capacity?`Capacité +${num(spec.capacity)} par période.`:'',spec.need?`Besoins ${num(spec.need)} par période.`:'',spec.fatigue?`Fatigue ${num(spec.fatigue)} à la livraison.`:'',spec.prevention?'La prévention réduit la perte de capacité liée à un conflit.':'',...(spec.spillovers??[]).map(link=>`${STRATEGY_SECTORS[link.sector].label} : ${[link.capacity?`capacité +${num(link.capacity)}`:'',link.need?`besoins ${num(link.need)}`:'',link.fatigue?`fatigue ${num(link.fatigue)}`:'',link.prevention?'prévention renforcée':''].filter(Boolean).join(', ')}.`),spec.unlocks.length?'Après livraison, une coordination territoriale devient disponible.':''].filter(Boolean).join(' '),
    sacrifice:spec.sacrifice,effect,pressure,political:{action:'administrative'}},unavailable);
}
export function strategyActions(g:Game,sector:PressureSectorId):Choice[] {
  if(g.version!==17||!g.presidency?.strategy||!IDS.includes(sector)||!open(g))return[];
  return ACTION_IDS.map(kind=>sectorChoice(g,sector,kind));
}
export function strategyPriorityChoice(g:Game,sector:PressureSectorId):Choice {
  return {id:`live-priority-${sector}`,title:g.presidency?.priority===sector?'Revenir à un arbitrage équilibré':`Priorité : ${STRATEGY_SECTORS[sector].label}`,description:'Cette consigne reste valable jusqu’à sa modification. À la prochaine période, les chantiers en préparation de ce secteur reçoivent les équipes en priorité.',
    cost:'Aucun crédit créé.',benefit:'Les ministres privilégient ce secteur pour les nouveaux engagements et les chantiers financés, avec les mêmes crédits et équipes.',sacrifice:'Les autres chantiers peuvent prendre du retard ; les délais minimaux de mise en service restent nécessaires.',effect:{},political:{action:'administrative'},presidencyOrder:{cost:0,delay:0,implementation:0}};
}
export function strategyReforms(g:Game):Array<{id:string;title:string;choices:Choice[]}> {
  if(g.version!==17||!g.presidency?.strategy||!open(g))return[];
  const structural=IDS.map(sector=>({id:`strategy-${sector}`,title:`Transformer : ${STRATEGY_SECTORS[sector].label}`,choices:strategyActions(g,sector)}));
  const used=new Set(g.presidency.reforms.filter(r=>r.adopted).map(r=>r.id));
  const laws=NATIONAL_AGENDA.filter(e=>e.kind==='reform'&&!used.has(e.id)).map(e=>({id:e.id,title:e.dossier.title,
    choices:e.dossier.choices.filter(c=>!g.presidency!.reforms.some(r=>r.choice===c.id)).map(raw=>metadata(g,{...structuredClone(raw),pressure:policyPressureEffects(raw),political:raw.political??{action:'enact'}},
      g.politics!.cabinet==='fallen'?'Un gouvernement est nécessaire pour présenter cette loi.':undefined))}));
  return [...structural,...laws];
}
function politicalChoices(g:Game):Choice[] {
  const s=strategyState(g),p=presidency(g);
  const already=s.commitments.some(c=>c.choice==='s17-coalition-pact'&&c.status==='preparing');
  const tooSoon=s.coalitionNegotiations>=2;
  const reason=already?'Les engagements du compromis sont déjà en préparation.':tooSoon?'Deux compromis budgétaires ont déjà été engagés pendant ce mandat.':support(g)>80?'Les appuis sont déjà consolidés.':undefined;
  const pact=metadata(g,{id:'s17-coalition-pact',title:g.politics!.cabinet==='fallen'?'Constituer un gouvernement de compromis':'Négocier un compromis de services publics',
    description:'Associer les partenaires à un programme de permanences et de suivi des engagements. Le soutien revient après la mise en service effective.',cost:'0,35 Md€ d’investissement · 0,2 Md€/an · deux périodes de mise en œuvre.',
    benefit:'Appuis +18 après livraison et gouvernement opérationnel.',sacrifice:'Une unité d’exécution par période pendant au moins deux périodes, des engagements annuels et au plus deux compromis dans le mandat.',effect:{investment:.35,operating:.2},
    pressure:{sector:'administration',kind:'programme',label:'Compromis de gouvernement et permanences',delay:2,implementation:1},political:{action:'administrative'}},reason);
  return p.autonomy?[pact]:[pact];
}
export function strategyCreditsChoice(g:Game):Choice {
  const p=presidency(g),used=p.creditYears.includes(year(g));
  return metadata(g,{id:'live-credits',title:'Soumettre 10 Md€ d’autorisation au Parlement',description:'Une enveloppe supplémentaire pour les transformations, soumise au vote des groupes parlementaires.',cost:'Aucune recette nouvelle ; dépenses au moment des engagements.',benefit:'10 Md€ d’autorisation si le vote est adopté.',sacrifice:'Une demande par année ; un refus ne finance rien.',effect:{},political:{action:'enact'}},used?'Une demande a déjà été présentée cette année.':g.politics!.cabinet==='fallen'?'Constituer un gouvernement avant une demande budgétaire.':undefined);
}
export function strategyBudgetChoices(g:Game):Choice[] {
  const p=presidency(g),used=p.redeploymentYears?.includes(year(g));
  return [strategyCreditsChoice(g),metadata(g,{id:'live-budget-redeploy',title:'Réaffecter 1,2 Md€ d’investissement général',description:'Reporter une partie du programme général au profit des transformations prioritaires.',cost:'1,2 Md€ d’investissement général réaffecté ; actifs −1.',benefit:'Une autorisation de 1,2 Md€ pour les interventions ; aucun euro de recette créé.',sacrifice:'Les autres infrastructures attendent. Une réaffectation par année.',effect:{},political:{action:'administrative'}},used?'Une réaffectation a déjà été décidée cette année.':g.finance.investment<1.2?'Aucune enveloppe générale disponible.':undefined)];
}
/** Low reserve alone is not a presidential task. A funding event needs an
 * actual service/backlog problem, a useful option blocked only by credits, and
 * no permanent response already preparing in that sector. */
function unfundedServiceNeeds(g:Game):PressureSectorId[] {
  const s=strategyState(g),outcome=strategyOutcome(g);
  const missed=outcome.objectives.some(o=>(o.id==='services'||o.id==='backlog')&&!o.met);
  return IDS.filter(sector=>{
    const front=g.pressure!.sectors[sector];
    const useful=front.pressure>=35||front.backlog>0&&front.lastChange>.2||missed&&front.backlog>.01;
    if(!useful||s.commitments.some(c=>c.sector===sector&&c.status==='preparing'&&c.kind!=='routine'&&c.kind!=='recovery'))return false;
    return strategyActions(g,sector).some(c=>{
      const cost=c.presidencyOrder!.cost;
      return cost>presidency(g).reserve+.00001&&c.presidencyOrder!.unavailable===`${money(presidency(g).reserve)} disponibles ; ${money(cost)} nécessaires.`;
    });
  });
}
export function strategyEvents(g:Game):PresidencyEvent[] {
  if(g.version!==17||!g.presidency?.strategy||!open(g))return[];
  const s=strategyState(g),events:PresidencyEvent[]=[];
  for(const sector of IDS){const st=s.sectors[sector];
    if(['organisation','conflict','national'].includes(st.phase))events.push({id:`s17-arbitrage-${sector}`,title:STRATEGY_SECTORS[sector][st.phase as 'organisation'|'conflict'|'national'],kind:'reform',sector,detail:st.cause,reason:st.warning,status:'decision',choices:strategyActions(g,sector).filter(c=>!c.presidencyOrder?.unavailable)});
    const delivery=s.commitments.filter(c=>c.sector===sector&&c.status==='preparing');
    if(delivery.length)events.push({id:`s17-work-${sector}`,title:delivery[0].title,kind:'followup',sector,detail:'La livraison utilise les mêmes équipes que les autres engagements.',choices:[],status:'preparing'});
  }
  if(s.collapseWarningPeriod!==undefined)events.unshift({id:'s17-national-recovery',kind:'political',sector:'administration',title:'Rétablir la capacité de gouverner',detail:'Plusieurs services restent en crise durable. Les transformations financées doivent rétablir les services avant la fin de la fenêtre annoncée.',deadline:s.collapseWarningPeriod+3,choices:politicalChoices(g),status:'decision'});
  if(support(g)<45||g.politics!.cabinet==='fallen')events.push({id:'s17-coalition',title:g.politics!.cabinet==='fallen'?'Constituer un gouvernement':'Préserver le compromis politique',kind:'political',sector:'administration',detail:'Les choix d’organisation mobilisent des appuis. Un compromis engage des services réels et leurs crédits.',choices:politicalChoices(g),status:'decision'});
  const unfunded=unfundedServiceNeeds(g);
  if(unfunded.length)events.push({id:'s17-funding',kind:'budget',sector:'administration',title:'Financer les transformations',detail:`${unfunded.map(id=>STRATEGY_SECTORS[id].label).join(', ')} : une intervention utile reste sans financement. ${money(presidency(g).reserve)} disponibles. Les chantiers engagés conservent leur financement.`,choices:strategyBudgetChoices(g),status:'decision'});
  events.push({id:'government-orders',kind:'government',sector:'administration',title:'Gouvernement et consignes',detail:'Les opérations courantes sont déléguées ; les transformations engagent les moyens communs.',choices:[{id:'live-autonomy',title:presidency(g).autonomy?'Suspendre les nouveaux engagements délégués':'Autoriser les opérations déléguées',description:'Les contrats financés et les chantiers continuent.',cost:'Aucun crédit créé.',benefit:'Modifier le mandat des ministres.',sacrifice:'Suspendre les nouveaux engagements laisse certains besoins sans réponse.',effect:{},political:{action:'administrative'},presidencyOrder:{cost:0,delay:0,implementation:0}},...politicalChoices(g),...strategyBudgetChoices(g)]});
  return events;
}
export function strategyChoices(g:Game):Choice[] {
  if(g.version!==17||!g.presidency?.strategy||!open(g))return[];
  const choices=[...IDS.flatMap(sector=>strategyActions(g,sector)),...strategyReforms(g).flatMap(r=>r.choices),...strategyBudgetChoices(g),...politicalChoices(g),...strategyEvents(g).flatMap(e=>e.choices),...IDS.map(sector=>strategyPriorityChoice(g,sector))];
  return [...new Map(choices.map(c=>[c.id,c])).values()];
}
function charge(g:Game,c:Choice,upfront:Effect=c.effect) {
  const cost=commitmentCost(c),p=presidency(g);if(cost>p.reserve+.00001)throw new Error('L’autorisation disponible ne finance pas cet engagement.');
  p.reserve=round(Math.max(0,p.reserve-cost));p.spent=round(p.spent+cost);apply(g,upfront);
}
function engage(g:Game,c:Choice,kind:StrategyCommitment['kind'],spec?:StrategyActionSpec,secondaryEffect?:Effect):StrategyCommitment|undefined {
  const upfront:Effect=structuredClone(c.effect),onDelivery:Effect={...secondaryEffect};
  if(c.pressure&&!c.pressure.duration){
    // Investments are committed now. A future physical service cannot already
    // incur its permanent payroll, or save wages of posts not yet removed.
    if(upfront.operating!==undefined){onDelivery.operating=(onDelivery.operating??0)+upfront.operating;delete upfront.operating;}
    // Authored physical laws tie their service and social consequences to the
    // delivered change. A pure tax law has no pressure programme and retains
    // its immediate statutory rate, integrated only on subsequent clock ticks.
    if(kind==='legislation')for(const key of ['services','cohesion','resilience','trust','assets','growth','society','areaEffects'] as const){
      if(upfront[key]!==undefined){Object.assign(onDelivery,{[key]:upfront[key]});delete upfront[key];}
    }
  }
  charge(g,c,upfront);if(!c.pressure){if(c.delayed)g.pending.push({due:g.turn+Math.max(1,c.delayed.after*6),label:c.delayed.label,effect:structuredClone(c.delayed.effect)});return;}
  const a=c.pressure,delay=Math.max(1,a.delay??1),teams=Math.max(.25,Math.min(4,a.implementation??1));
  const id=`strategy-plan-${g.choices.length.toString().padStart(3,'0')}-${c.id}`;
  const programme:PressureProgramme={...a,id,kind:a.kind==='defer'||a.kind==='maintain'?'programme':a.kind,sourceChoice:c.id,sourceTurn:g.turn,dueTurn:g.turn+delay,status:'preparing',remainingWork:round(delay*teams),implementation:teams,...(c.effect.temporaryOperating!==undefined?{temporaryOperating:c.effect.temporaryOperating}:{})};
  g.pressure!.programmes.push(programme);
  const commitment:StrategyCommitment={id,programmeId:id,sector:a.sector,kind,title:c.title,choice:c.id,sourceJournalIndex:g.choices.length,sourcePeriod:g.turn,cost:commitmentCost(c),annualOperating:c.effect.operating??c.effect.temporaryOperating??0,teams,
    prevention:spec?.prevention??0,supportOnDelivery:spec?.supportOnDelivery??0,spillovers:spec?.spillovers?[...spec.spillovers]:[],status:'preparing',...(Object.keys(onDelivery).length?{secondaryEffect:onDelivery}: {})};
  strategyState(g).commitments.push(commitment);if(spec?.supportCost)changeSupport(g,-spec.supportCost);
  return commitment;
}
function ministries(g:Game) {
  const s=strategyState(g),p=presidency(g);if(!p.autonomy||g.politics!.cabinet==='fallen')return;
  const candidates=[...IDS].sort((a,b)=>(g.pressure!.sectors[b].pressure+(p.priority===b?30:0))-(g.pressure!.sectors[a].pressure+(p.priority===a?30:0))||a.localeCompare(b));
  for(const sector of candidates){const st=s.sectors[sector],front=g.pressure!.sectors[sector];
    if(st.routine.status!=='idle'||!(front.pressure>=22||front.lastChange>.15||p.priority===sector))continue;
    const capacity=round(.7+st.minister.competence/100*.55),annual=round(.12+(100-st.minister.competence)*.002);
    if(annual>st.minister.annualLimit||annual>p.reserve+.00001)continue;
    const c:Choice={id:`s17-routine-${sector}`,title:`${STRATEGY_SECTORS[sector].ministry} organise le service courant`,description:'Une convention de fonctionnement durable regroupe les remplacements et la coordination existants.',cost:`${money(annual)}/an`,benefit:`Capacité +${num(capacity)} après mise en place.`,sacrifice:'Charge annuelle durable et équipes partagées.',effect:{operating:annual},pressure:{sector,kind:'delegate',label:`Organisation déléguée : ${STRATEGY_SECTORS[sector].label}`,capacity,delay:1,implementation:.6,fatigue:-3},political:{action:'administrative'}};
    const commitment=engage(g,c,'routine')!;st.routine={status:'preparing',capacity,annualOperating:annual,committed:annual,programmeId:commitment.programmeId};s.routineInitiatives++;s.routineCost=round(s.routineCost+annual);
    initiative(g,{actor:'government',sector,title:'Le ministère organise les opérations courantes',detail:`${STRATEGY_SECTORS[sector].ministry} regroupe les remplacements et la coordination : ${money(annual)}/an engagés. Les opérations suivantes suivent cette consigne, sans rachat répété.`,cost:annual,choice:c.id,status:'engaged'});
    // One actual initiative per period makes spending and work legible. Already
    // financed services continue together; their rates accrue without extra clicks.
    return;
  }
}
function delivered(g:Game) {
  const s=strategyState(g);
  for(const c of s.commitments){const p=g.pressure!.programmes.find(p=>p.id===c.programmeId);if(!p)continue;
    if(c.status==='preparing'&&p.deliveredTurn!==undefined){c.status='delivered';c.deliveredPeriod=p.deliveredTurn;const st=s.sectors[c.sector];
      if(c.kind==='routine')st.routine.status='operational';
      else if(c.kind!=='legislation'||(p.appliedCapacity??0)>0||(p.appliedNeed??0)<0){st.transformations.push({kind:c.kind,title:c.title,choice:c.choice,period:g.turn,capacity:p.appliedCapacity??0,need:p.appliedNeed??0,prevention:c.prevention});st.prevention=Math.min(.85,st.prevention+c.prevention);}
      if(c.supportOnDelivery)changeSupport(g,c.supportOnDelivery);
      for(const effect of c.spillovers){const front=g.pressure!.sectors[effect.sector];front.capacity=round(Math.max(1,front.capacity+(effect.capacity??0)));front.need=round(Math.max(0,front.need+(effect.need??0)));front.fatigue=Math.max(0,Math.min(70,front.fatigue+(effect.fatigue??0)));s.sectors[effect.sector].prevention=Math.min(.85,s.sectors[effect.sector].prevention+(effect.prevention??0));}
      if(c.secondaryEffect)apply(g,c.secondaryEffect);
      if(c.choice==='s17-coalition-pact'){g.politics!.cabinet='stable';g.politics!.pendingCrisis=undefined;}
      initiative(g,{actor:c.kind==='routine'?'government':'president',sector:c.sector,title:c.kind==='routine'?'La nouvelle organisation ministérielle fonctionne':'Une transformation entre en service',detail:`${c.title} est livré. ${c.kind==='routine'?'La consigne reste valable sans nouvelle commande.':'Les capacités, besoins ou appuis changent réellement ; les retards acquis restent à traiter.'}`,cost:0,choice:c.choice,status:'delivered'});
    }
    if(c.status==='delivered'&&p.duration&&p.status==='completed'){c.status='expired';material(g,`${c.title} arrive à son terme ; les dépenses acquises restent dans les comptes.`);}
  }
}
function updateChains(g:Game) {
  const s=strategyState(g);
  for(const sector of IDS){const st=s.sectors[sector],f=g.pressure!.sectors[sector],old=st.phase;
    st.conflictPeriods=f.pressure>=72?st.conflictPeriods+1:Math.max(0,st.conflictPeriods-2);
    st.phase=f.pressure>=85&&st.conflictPeriods>=3?'national':f.pressure>=72&&f.fatigue>=22?'conflict':f.pressure>=52||st.routine.status==='limited'?'organisation':f.pressure>=35?'accumulation':f.pressure>=22?'warning':'normal';
    st.phasePeriods=st.phase===old?st.phasePeriods+1:1;
    if(st.routine.status==='operational'&&(f.pressure>=45&&f.lastChange>.2||f.lastChange>1.2)){st.routine.status='limited';st.routine.limitedSince=g.turn;material(g,`${STRATEGY_SECTORS[sector].ministry} atteint sa limite opérationnelle : une transformation de l’organisation ou des capacités est nécessaire.`);}
    if(st.routine.status==='limited'&&f.pressure<35&&f.lastChange<=.1)st.routine.status='operational';
    st.cause=`${num(f.incomingNeed)} unités de besoins pour ${num(f.effectiveCapacity)} de capacité effective ; ${num(f.backlog)} en attente. ${STRATEGY_SECTORS[sector].reason} Charge additionnelle connue à l’horizon du mandat : +${num(st.demandForecast[4])} unités par période (hypothèse).`;
    st.warning=st.phase==='normal'?'Le service dispose d’une marge. Préparer la suite reste possible.':st.phase==='warning'?STRATEGY_SECTORS[sector].warning:STRATEGY_SECTORS[sector][st.phase as StrategyStage];
    st.riskIn=f.nextRiskIn;if(old!==st.phase)material(g,`${STRATEGY_SECTORS[sector].label} : ${st.warning}`);
  }
  const fronts=Object.values(g.pressure!.sectors),limited=IDS.filter(id=>s.sectors[id].routine.status==='limited').length,transformed=IDS.filter(id=>s.sectors[id].transformations.some(t=>t.kind==='capacity'||t.kind==='organisation')).length;
  s.phase=transformed>=3&&s.annualReviews.length>=2?'legacy':transformed?'transformation':limited>=2?'coordination':'opening';
  s.phaseReason=s.phase==='opening'?'Le gouvernement absorbe le quotidien ; choisissez une première transformation.':s.phase==='coordination'?'Plusieurs ministères atteignent leurs limites et partagent les mêmes moyens.':s.phase==='transformation'?'Les transformations livrées ouvrent des arbitrages entre secteurs.':'Les moyens nouveaux fonctionnent ; leur financement et les accords doivent durer.';
  const critical=fronts.filter(f=>f.pressure>=90).length;
  s.criticalPeriods=critical>=4?s.criticalPeriods+1:Math.max(0,s.criticalPeriods-2);
  s.institutionalStrain=Math.max(0,Math.min(100,s.institutionalStrain+(critical>=3?critical*1.8:-3)));
  if(s.criticalPeriods>=3&&s.collapseWarningPeriod===undefined){s.collapseWarningPeriod=g.turn;material(g,'Quatre services restent en crise durable. Une fenêtre de trois périodes est ouverte pour rétablir la situation.');}
  if(s.collapseWarningPeriod!==undefined&&critical<3){delete s.collapseWarningPeriod;s.criticalPeriods=0;material(g,'Les services rétablis interrompent la dégradation institutionnelle.');}
  if(s.collapseWarningPeriod!==undefined&&g.turn>=s.collapseWarningPeriod+3&&critical>=4){g.politics!.ending={kind:'rupture',title:'Le pays ne peut plus fonctionner',reason:'Quatre services essentiels demeurent en crise après la fenêtre de redressement annoncée.',turn:g.turn,causes:['Crises persistantes dans plusieurs services','Fenêtre de redressement épuisée','Capacité effective insuffisante malgré les moyens engagés']};}
  if(support(g)<20&&s.institutionalStrain>=60)g.politics!.cabinet='fallen';
}
/** Published initial scenario assumptions: future maintenance, service cohorts
 * and files are known at entry. The sequence is interpolated, never a new crisis
 * spawned after successful play. Contexts expose different needs; a network's
 * spillovers can cover several fronts without six identical purchases. */
function initialFragileSectors(seed:number):readonly PressureSectorId[] {
  return seed%3===0?['health','housing']:seed%3===1?['housing','administration']:['energy','health','education'];
}
function workloadForecast(seed: number, sector: PressureSectorId): { demandForecast: number[]; demandReason: string } {
  const index=IDS.indexOf(sector),context=seed%3;
  const base:Record<PressureSectorId,number>={health:3.2,housing:3,transport:2.8,energy:2.6,education:2.5,administration:2.9};
  const differences:Record<PressureSectorId,number>[]=[
    {health:.45,housing:.45,transport:.25,energy:-.75,education:-.25,administration:.25},
    {health:-.25,housing:.8,transport:-.4,energy:.15,education:.15,administration:.65},
    {health:.45,housing:-.35,transport:.5,energy:.8,education:.5,administration:.05},
  ];
  const demandReason:Record<PressureSectorId,string>={
    health:'Les suivis déjà reportés et les besoins de soins de la population ouvrent davantage de créneaux à assurer.',
    housing:'Les travaux et demandes de logement déjà recensés doivent être instruits puis accompagnés sur plusieurs années.',
    transport:'Les échéances d’entretien et de contrôle des réseaux hérités augmentent la charge de maintenance.',
    energy:'Les renouvellements de matériels et les contrôles prévus des réseaux mobiliseront davantage d’interventions.',
    education:'Les parcours d’élèves et le rattrapage des bâtiments déjà inscrits créent une charge d’accueil et de suivi.',
    administration:'Les renouvellements de titres et les dossiers des chantiers publics déjà annoncés augmentent les instructions.',
  };
  // Initially functioning sectors also inherit announced maintenance/renewals.
  // Their 1.2-unit horizon is fixed at entry, never triggered by recovery.
  const renewal=initialFragileSectors(seed).includes(sector)?0:1.2;
  const final=round(base[sector]+differences[context][sector]+((seed*7+index*3)%5-2)*.12+renewal);
  return {demandForecast:[0,.3,.68,.94,1].map(factor=>round(final*factor)),
    demandReason:demandReason[sector]+(renewal?' Les entretiens et renouvellements déjà recensés ajoutent aussi 1,2 unité de charge par période à l’horizon du mandat.':'')};
}
function advanceInheritedWork(g:Game) {
  for(const id of IDS){const st=strategyState(g).sectors[id];
    // Four opening periods retain their initial demand. Thereafter the known
    // trajectory progresses smoothly; the full horizon is reached at period 28.
    const progress=Math.max(0,Math.min(4,(g.turn-4)/6)),index=Math.floor(progress),fraction=progress-index;
    const target=round(st.demandForecast[index]+(index<4?(st.demandForecast[index+1]-st.demandForecast[index])*fraction:0));
    const change=round(target-st.appliedDemand);if(change){g.pressure!.sectors[id].need=round(Math.max(0,g.pressure!.sectors[id].need+change));st.appliedDemand=target;}
  }
}
function clockTick(g:Game):Game {
  prepareYear(g);advanceInheritedWork(g);const p=presidency(g),s=strategyState(g);ministries(g);
  // Material disruption is conditional on the previous service state. Delivered
  // prevention reduces its actual capacity loss; a successful service has no
  // compensating catastrophe inserted by a calendar or click counter.
  const losses=new Map<PressureSectorId,number>();
  for(const sector of IDS){const st=s.sectors[sector];const loss=(st.phase==='national'?1.2:st.phase==='conflict'?.65:0)*(1-st.prevention);if(loss){g.pressure!.sectors[sector].capacity-=loss;losses.set(sector,loss);g.pressure!.sectors[sector].causes.push({kind:'overload',turn:g.turn,label:`${STRATEGY_SECTORS[sector].conflict} Capacité mobilisable réduite de ${num(loss)}.`,direction:'increase'});}}
  const before=structuredClone(g),neutral:Choice={id:'live-tick',title:'Deux mois s’écoulent',description:'',cost:'',benefit:'',sacrifice:'',effect:{},political:{action:'administrative'}};
  const transition=advancePressure(before,g,neutral,true);g.pressure=transition.state;
  for(const [sector,loss]of losses)g.pressure.sectors[sector].capacity=round(g.pressure.sectors[sector].capacity+loss);
  apply(g,transition.effect);g.politics!.unrest=clamp(g.politics!.unrest+transition.unrest);g.politics!.legitimacy=clamp(g.politics!.legitimacy+transition.legitimacy);changeSupport(g,transition.support);
  g.turn++;for(const due of g.pending.filter(d=>d.due<=g.turn)){apply(g,due.effect);material(g,due.label);}g.pending=g.pending.filter(d=>d.due>g.turn);
  delivered(g);
  // The period in which capacity actually starts operating pays its acquired
  // running charge. Moving delivery after accrual would grant a free period.
  const social=socialYearEnd(g);p.budget.accruedOperating+=(g.finance.operating+social.operating)/6;p.budget.accruedRevenue+=(g.finance.revenue+social.revenue)/6;
  updateChains(g);
  const closed=g.turn%6===0,remaining=closed?0:6-g.turn%6;
  const ledger=nationalBudget({...g.finance,operating:p.budget.accruedOperating+(g.finance.operating+social.operating)*remaining/6+g.pressure.budget.operating,revenue:p.budget.accruedRevenue+(g.finance.revenue+social.revenue)*remaining/6+g.pressure.budget.revenue});
  if(closed){g.finance.debt=ledger.debt;g.finance.cash+=ledger.cashChange;g.finance.gdp=ledger.gdp;s.annualReviews.push({year:Math.ceil(g.turn/6),deficit:ledger.deficit,pressure:round(IDS.reduce((n,id)=>n+g.pressure!.sectors[id].pressure,0)/6),backlog:round(IDS.reduce((n,id)=>n+g.pressure!.sectors[id].backlog,0)),functioning:IDS.filter(id=>g.pressure!.sectors[id].pressure<65).length});}
  if(g.turn===30&&!g.politics!.ending)g.politics!.ending={kind:'term_complete',title:'Le quinquennat se termine',reason:'Le calendrier est achevé ; le résultat dépend des services, des engagements et du gouvernement.',turn:30,causes:[]};
  p.lastEvents=p.lastEvents.slice(-12);record(g,'live-tick','Le pays et le gouvernement évoluent',p.lastEvents,ledger,closed);return g;
}
export function strategyStart(seed=0,ambition:Ambition='equilibre'):Game {
  const g=startPresidency(seed,ambition);g.version=17;const p=g.presidency!;
  p.reserve=STRATEGY_INITIAL_RESERVE;p.authorised=STRATEGY_INITIAL_RESERVE;p.spent=0;p.crises=[];delete p.civic;p.reformEvents=[];p.reformArchive=[];p.lastEvents=[];
  const sectors={}as StrategyState['sectors'];
  const fragile=initialFragileSectors(seed);
  for(const [i,id]of IDS.entries()){const front=g.pressure!.sectors[id],isFragile=fragile.includes(id),competence=58+(seed*17+i*11)%31;
    front.capacity=round(PRESSURE_SECTORS[id].baseNeed+(isFragile?-.45:.95));front.fatigue=isFragile?18:8;front.backlog=round(front.backlog*.6+(isFragile?2.5:0));front.effectiveCapacity=round(front.capacity*(1-front.fatigue/300));front.pressure=round(Math.min(100,front.backlog/front.capacity*30+front.fatigue*.3));front.stage=front.pressure>=25?'watch':'stable';front.causes=[{kind:'inherited',turn:0,label:isFragile?'Postes fragiles et retards hérités ; organisation ministérielle déjà constituée.':'Services en fonctionnement avec une marge héritée.',direction:isFragile?'increase':'neutral'}];
    sectors[id]={phase:front.pressure>=22?'warning':'normal',phasePeriods:0,conflictPeriods:0,cause:`${STRATEGY_SECTORS[id].reason} Les services fonctionnent dès la prise de fonctions.`,warning:isFragile?STRATEGY_SECTORS[id].warning:'Une marge de fonctionnement est disponible.',minister:{competence,annualLimit:round(.3+competence/100*.2),mandate:'Assurer les remplacements, coordonner les services et signaler les transformations nécessaires.'},routine:{status:'idle',capacity:0,annualOperating:0,committed:0},transformations:[],prevention:0,vulnerability:isFragile?.35:.12,lastDemandPressure:front.pressure,...workloadForecast(seed,id),appliedDemand:0};
    sectors[id].cause+=` Charge additionnelle prévue à l’horizon du mandat : +${num(sectors[id].demandForecast[4])} unités par période (hypothèse).`;
  }
  p.strategy={phase:'opening',phaseReason:'Le pays fonctionne, les ministres ont leurs consignes ; une première transformation peut prévenir la surcharge.',sectors,commitments:[],initialBacklog:round(IDS.reduce((n,id)=>n+g.pressure!.sectors[id].backlog,0)),initialDeficit:nationalBudget(g.finance).deficit,institutionalStrain:0,criticalPeriods:0,coalitionNegotiations:0,routineInitiatives:0,routineCost:0,lastMaterialEvents:[],annualReviews:[]};
  material(g,`${STRATEGY_SECTORS[fragile[0]].label} présente une fragilité héritée. Le gouvernement prépare ses réponses courantes ; vous choisissez les transformations.`);return g;
}
export function strategyDecide(game:Game,id:string):Game {
  presidency(game);if(!open(game))throw new Error('Ce mandat est terminé.');
  if(game.choices.length>=STRATEGY_JOURNAL_LIMIT||(id!=='live-tick'&&game.choices.length>=STRATEGY_JOURNAL_LIMIT-(30-game.turn)))throw new Error('La limite d’ordres est atteinte ; le calendrier conserve ses périodes disponibles.');
  const g=structuredClone(game),p=presidency(g),s=strategyState(g);p.lastEvents=[];s.lastMaterialEvents=[];delete p.lastFeedback;
  if(id==='live-tick')return clockTick(g);prepareYear(g);
  if(id==='live-autonomy'){p.autonomy=!p.autonomy;const detail=p.autonomy?'Les ministres peuvent préparer leurs arrangements opérationnels dans leurs limites.':'Les nouveaux engagements ministériels sont suspendus ; les services et contrats financés continuent.';initiative(g,{actor:'president',title:'Mandat du gouvernement',detail,cost:0,choice:id,status:'information'});record(g,id,'Consigne gouvernementale',[detail]);return g;}
  const priority=id.startsWith('live-priority-')?id.slice(14)as PressureSectorId:undefined;
  if(priority&&IDS.includes(priority)){p.priority=p.priority===priority?null:priority;const detail=p.priority?`${STRATEGY_SECTORS[priority].label} devient prioritaire pour les nouveaux engagements et les chantiers en préparation, dès la prochaine période. Les mêmes équipes restent partagées ; les autres chantiers peuvent attendre.`:'La préparation des chantiers revient à l’ordre de financement à la prochaine période. Les ministères arbitrent leurs nouveaux engagements selon les besoins, avec les mêmes moyens.';initiative(g,{actor:'president',sector:priority,title:p.priority?'Les chantiers du secteur deviennent prioritaires':'L’arbitrage équilibré est rétabli',detail,cost:0,choice:id,status:'information'});record(g,id,'Priorité du gouvernement',[detail]);return g;}
  const c=strategyChoices(g).find(c=>c.id===id);if(!c)throw new Error('Cette orientation n’est pas disponible.');if(c.presidencyOrder?.unavailable)throw new Error(c.presidencyOrder.unavailable);
  if(id==='live-budget-redeploy'){g.finance.investment-=1.2;apply(g,{assets:-1});p.authorised=round(p.authorised+1.2);p.reserve=round(p.reserve+1.2);(p.redeploymentYears??=[]).push(year(g));initiative(g,{actor:'president',title:c.title,detail:'1,2 Md€ de l’investissement général sont réservés aux interventions, sans recette nouvelle.',cost:0,choice:id,status:'information'});record(g,id,c.title,p.lastEvents);return g;}
  const resolution=resolvePoliticalChoice(g.politics!,c,g.seed,g.turn,g.society?.workers??50),adopted=!resolution.vote||resolution.vote.passed;
  if(resolution.vote){s.lastParliamentPeriod=g.turn;g.politics!.lastVote=resolution.vote;g.politics!.votes.push(resolution.vote);if(!adopted){g.politics!.failedBills++;g.politics!.legitimacy=clamp(g.politics!.legitimacy-2);g.politics!.unrest=clamp(g.politics!.unrest+3);}else g.politics!.failedBills=0;}
  if(id==='live-credits'){p.creditYears.push(year(g));p.creditsRequested++;if(adopted){p.authorised=round(p.authorised+10);p.reserve=round(p.reserve+10);}}
  else if(adopted){const match=/^s17-(health|housing|transport|energy|education|administration)-(capacity|organisation|agreement|recovery|network)$/.exec(id);
    if(match)engage(g,resolution.choice,match[2]as StrategyActionId,actionFor(match[1]as PressureSectorId,match[2]as StrategyActionId));
    else if(id==='s17-coalition-pact'){const commitment=engage(g,c,'legislation')!;commitment.supportOnDelivery=18;s.coalitionNegotiations++;}
    else{engage(g,resolution.choice,'legislation');const entry=NATIONAL_AGENDA.find(e=>e.dossier.choices.some(choice=>choice.id===id));if(entry)p.reforms.push({id:entry.id,choice:id,period:g.turn,adopted:true});}
  }else{const entry=NATIONAL_AGENDA.find(e=>e.dossier.choices.some(choice=>choice.id===id));if(entry)p.reforms.push({id:entry.id,choice:id,period:g.turn,adopted:false});}
  p.lastFeedback={status:adopted?(resolution.vote?'adopted':c.pressure?'engaged':'information'):'rejected',title:adopted?c.pressure?'Transformation financée':resolution.vote?'Texte adopté':'Consigne enregistrée':'Texte rejeté',detail:adopted?c.pressure?'Les équipes préparent la livraison ; les effets physiques attendent le calendrier.':c.benefit:'Aucun coût, aucune recette et aucune capacité de la proposition ne sont appliqués.'};
  initiative(g,{actor:'president',...(c.pressure?{sector:c.pressure.sector}:{}),title:c.title,detail:adopted?`${c.title} : ${id==='live-credits'?'autorisation votée, aucune recette créée':`${money(commitmentCost(c))} engagés`}. ${p.lastFeedback.detail}`:`${c.title} : rejeté, aucun effet engagé.`,cost:adopted?commitmentCost(c):0,choice:id,status:adopted?'engaged':'rejected'});
  record(g,id,c.title,[...resolution.consequences,...p.lastEvents],strategyLedger(g),false,resolution.vote);return g;
}
/** Result contract: services, actual backlog, financing and cabinet viability.
 * Completion is chronology only. A severe service failure cannot be compensated
 * by a good fiscal indicator. No objective counts orders or mandatory purchases. */
export function strategyOutcome(g:Game):StrategyOutcome {
  const s=strategyState(g),fronts=IDS.map(id=>g.pressure!.sectors[id]),finances=objectiveFinances(g),ledger=finances.ledger;
  const stable=fronts.filter(f=>f.pressure<=45).length,critical=fronts.filter(f=>f.pressure>=85).length,backlog=round(fronts.reduce((n,f)=>n+f.backlog,0));
  const government=g.politics!.cabinet!=='fallen'&&support(g)>=30;
  const objectives:StrategyOutcome['objectives']=[{id:'services',title:'Des services accessibles',current:`${stable}/6 secteurs avec au plus 45 de pression ; ${critical} en crise.`,target:'Au moins cinq secteurs avec au plus 45 de pression ; tous strictement sous 65.',met:stable>=5&&fronts.every(f=>f.pressure<65)},
    {id:'backlog',title:'Réduire les retards hérités',current:`${num(backlog)} unités en attente contre ${num(s.initialBacklog)} au départ.`,target:'Un retard total inférieur ou égal au début du mandat.',met:backlog<=s.initialBacklog+.01},
    {id:'finances',title:'Financer les services dans la durée',current:`${finances.closed?'Déficit de l’année':'Prévision de déficit annuel, année'} ${finances.year}${finances.closed?' clôturée':''} : ${money(ledger.deficit)}.`,target:`Ne pas dépasser le déficit hérité de ${money(s.initialDeficit)}.`,met:ledger.deficit<=s.initialDeficit+.01},
    {id:'government',title:'Un gouvernement capable d’agir',current:`${g.politics!.cabinet==='fallen'?'Gouvernement démissionnaire':'Gouvernement en fonction'} ; ${num(support(g))} points d’appui.`,target:'Gouvernement en fonction et au moins 30 points d’appui.',met:government}];
  const ended=!open(g),catastrophe=critical>=3||g.politics!.ending?.kind==='rupture'||g.politics!.ending?.kind==='destitution'||g.politics!.ending?.kind==='resignation';
  const met=objectives.filter(o=>o.met).length,status:StrategyOutcome['status']=!ended?'ongoing':catastrophe?'failure':met===4?'success':'mixed';
  const transforms=IDS.flatMap(sector=>s.sectors[sector].transformations.filter(t=>t.kind!=='recovery').map(t=>({sector,title:t.title,choice:t.choice,period:t.period})));
  const damages=fronts.filter(f=>f.pressure>=65).map(f=>`${STRATEGY_SECTORS[f.id].label} : pression ${num(f.pressure)}/100, ${num(f.backlog)} unités en attente.`);
  const pending=s.commitments.filter(c=>c.status==='preparing');if(pending.length)damages.push(`${pending.length} engagements financés ne sont pas encore livrés.`);
  const weakest=[...fronts].sort((a,b)=>b.pressure-a.pressure)[0];
  return {status,title:status==='success'?'Les objectifs du mandat sont atteints':status==='failure'?'Le pays termine en échec':status==='mixed'?'Un mandat aux résultats partagés':'Votre objectif : rétablir les services',
    summary:status==='ongoing'?'Les ministres traitent le quotidien. Les transformations changent les besoins et les capacités après livraison.':status==='success'?'Les services, les retards, le financement et le gouvernement remplissent les objectifs.':status==='failure'?'Des services essentiels restent en crise. La fin du calendrier ne constitue pas une réussite.':'Certaines améliorations sont acquises, mais des objectifs restent manqués.',
    objectives,causes:status==='failure'?[...damages.slice(0,3),...g.politics!.ending?.causes??[]]:objectives.filter(o=>!o.met).map(o=>`${o.title} : ${o.current}`),transforms,damages,
    ministries:{initiatives:s.routineInitiatives,cost:s.routineCost,detail:`${s.routineInitiatives} organisations courantes ont été engagées par les ministres ; leurs ${money(s.routineCost)}/an restent dans les comptes et utilisent les mêmes équipes.`},
    hint:!ended&&s.commitments.every(c=>c.kind==='routine')?`Préparer ${STRATEGY_SECTORS[weakest.id].label.toLowerCase()} : choisir une capacité nouvelle ou une organisation durable, puis consulter les besoins déjà prévus dans les autres secteurs.`:weakest.pressure>=45?`Essayer une transformation plus précoce en ${STRATEGY_SECTORS[weakest.id].label.toLowerCase()}, puis coordonner les secteurs dont ce service dépend.`:!objectives[3].met?'Préparer le compromis politique avant de multiplier les réorganisations.':'Essayer l’autre voie : capacité nouvelle ou organisation et accords, avec un financement et des appuis différents.'};
}
