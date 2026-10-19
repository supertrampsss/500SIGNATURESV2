import { crisisImpact } from './presidency-crises.ts';
import type { Choice, Effect, Game } from './types.ts';
import type { NarrativeContext } from './narrative-types.ts';
import type {
  PressureCause, PressureChoice, PressureEvent, PressureFront, PressureProgramme,
  PressureSectorId, PressureStage, PressureState, PressureTransition,
} from './pressure-types.ts';
import { isPressureIncidentId, PRESSURE_INCIDENTS } from './pressure-content.ts';

/**
 * Versioned simulation hypotheses, not observations of France.
 * Failure modes fixed before implementation: a rejected law funding capacity;
 * reading advancing time; temporary expenses becoming structural or disappearing
 * before annual closure; finite relief becoming permanent; same-period causal
 * loops; money bypassing implementation time; escalation with no recovery path.
 * Dependencies always read the previous period. The work queue never refuses a
 * financed action: it postpones delivery, retaining its real originating choice.
 */
export const PRESSURE_SECTORS: Record<PressureSectorId, {
  label: string; category: string; art: string; unit: string;
  baseNeed: number; baseCapacity: number; initialBacklog: number; initialFatigue: number;
}> = {
  health: { label: 'Accès aux soins', category: 'Santé', art: 'hospital', unit: 'unités de soins en attente (simulation)', baseNeed: 10.4, baseCapacity: 10.1, initialBacklog: 8, initialFatigue: 16 },
  housing: { label: 'Accès au logement', category: 'Logement', art: 'housing', unit: 'unités de logement en attente (simulation)', baseNeed: 10.2, baseCapacity: 10.5, initialBacklog: 9, initialFatigue: 9 },
  transport: { label: 'Fiabilité des transports', category: 'Transports', art: 'transport', unit: 'unités d’entretien reporté (simulation)', baseNeed: 10, baseCapacity: 10.4, initialBacklog: 6, initialFatigue: 12 },
  energy: { label: 'Continuité énergétique', category: 'Énergie', art: 'energy', unit: 'unités de travaux en attente (simulation)', baseNeed: 9.6, baseCapacity: 10.3, initialBacklog: 4, initialFatigue: 8 },
  education: { label: 'Continuité des enseignements', category: 'Éducation', art: 'school', unit: 'unités d’enseignement en attente (simulation)', baseNeed: 10.2, baseCapacity: 10.2, initialBacklog: 7, initialFatigue: 14 },
  administration: { label: 'Délais des services publics', category: 'Services publics', art: 'nation', unit: 'unités de dossiers en attente (simulation)', baseNeed: 10, baseCapacity: 10.6, initialBacklog: 5, initialFatigue: 10 },
};
const IDS = Object.keys(PRESSURE_SECTORS) as PressureSectorId[];
/** Fixed five-year scenario needs, in work units per period above the baseline.
 * This is a finite authored trajectory, not observed demographic growth and not
 * a difficulty curve triggered by successful recovery. Education cohorts can fall.
 */
export const PRESSURE_CHAPTER_NEEDS: Readonly<Record<PressureSectorId, readonly number[]>> = {
  health: [0, .4, .8, 1.2, 1.6],
  housing: [0, .25, .5, .75, 1],
  transport: [0, .2, .4, .6, .8],
  energy: [0, .15, .3, .45, .6],
  education: [0, .1, .2, .1, 0],
  administration: [0, .2, .4, .6, .8],
};
const round = (n: number) => Math.round(n * 1000) / 1000;
const limit = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const stageOf = (pressure: number): PressureStage => pressure >= 85 ? 'crisis' : pressure >= 65 ? 'disrupted' : pressure >= 45 ? 'strained' : pressure >= 25 ? 'watch' : 'stable';
const pressureOf = (front: Pick<PressureFront, 'backlog' | 'capacity' | 'fatigue'>) => round(limit(front.backlog / Math.max(1, front.capacity) * 30 + front.fatigue * .3, 0, 100));
const STAGE_LABELS: Record<PressureStage, string> = { stable: 'situation stabilisée', watch: 'vigilance', strained: 'tension', disrupted: 'service perturbé', crisis: 'crise' };
type PressureGame = Game & { pressure?: PressureState };
type PressureGameChoice = Choice & { pressure?: PressureChoice; effect: Effect & { temporaryOperating?: number } };

export function initialPressureState(seed: number, context?: NarrativeContext): PressureState {
  const sectors = {} as Record<PressureSectorId, PressureFront>;
  for (const [index, id] of IDS.entries()) {
    const spec = PRESSURE_SECTORS[id];
    const variation = ((seed + index * 7) % 5 - 2) * .35;
    const backlog = spec.initialBacklog + variation + (context === 'hospital' && id === 'health' ? 2 : 0);
    const front: PressureFront = {
      id, backlog: round(backlog), need: spec.baseNeed, incomingNeed: spec.baseNeed, capacity: spec.baseCapacity,
      effectiveCapacity: round(spec.baseCapacity * (1 - spec.initialFatigue / 300)),
      fatigue: spec.initialFatigue, pressure: 0, stage: 'stable', trend: 'steady',
      lastChange: 0, pressureChange: 0,
      causes: [{ kind: 'inherited', turn: 0, direction: 'increase', label: 'Retard et capacités hérités au début du mandat ; hypothèses du scénario.' }],
    };
    front.pressure = pressureOf(front); front.stage = stageOf(front.pressure);
    sectors[id] = front;
  }
  return { sectors, programmes: [], execution: { capacity: 4, used: 0, waiting: 0 },
    budget: { year: 1, accruedOperating: 0, accruedRevenue: 0, operating: 0, revenue: 0 },
    lastDecision: [], lastWorld: [], lastEvents: [],
  };
}

type Shock = { id: string; sector: PressureSectorId; at: number; duration: number; need?: number; capacity?: number; label: string };
function shocks(seed: number): Shock[] {
  // A finite scenario calendar. There is no event spawned because the player recovered.
  const offset = seed % 2;
  return [
    { id: 'soins-saison', sector: 'health', at: 2 + offset, duration: 2, need: 2, label: 'Afflux saisonnier de demandes de soins' },
    { id: 'entretien-ligne', sector: 'transport', at: 5, duration: 3, capacity: -1.8, label: 'Travaux de sécurité sur une ligne de transport' },
    { id: 'demandes-logement', sector: 'housing', at: 8 + offset, duration: 3, need: 2.2, label: 'Arrivée de nouvelles demandes de logement' },
    { id: 'enseignements-chaleur', sector: 'education', at: 11, duration: 2, need: 2, label: 'Rattrapage des enseignements perturbés par la chaleur' },
    { id: 'reseau-energie', sector: 'energy', at: 15 + offset, duration: 3, capacity: -2.4, label: 'Maintenance d’urgence du réseau énergétique' },
    { id: 'demandes-guichets', sector: 'administration', at: 19, duration: 3, need: 2.4, label: 'Vague de renouvellement des démarches administratives' },
    { id: 'soins-rattrapage', sector: 'health', at: 23 + offset, duration: 2, need: 2, label: 'Nouvelle hausse saisonnière des demandes de soins' },
    { id: 'logement-fin-mandat', sector: 'housing', at: 26, duration: 3, need: 1.5, label: 'Nouvelles demandes dans les bassins d’emploi' },
  ];
}
type Link = { from: PressureSectorId; to: PressureSectorId; capacity: number; label: string };
const LINKS: readonly Link[] = [
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

function annualDisruption(state: PressureState) {
  let operating = 0, revenue = 0;
  for (const front of Object.values(state.sectors)) {
    const disruption = limit((front.pressure - 60) / 40, 0, 1);
    operating += disruption * .5;
    revenue -= disruption * .65;
  }
  return { operating: round(operating), revenue: round(revenue) };
}
function addCause(front: PressureFront, cause: PressureCause) {
  const previous = front.causes.find(item => item.kind === cause.kind && item.label === cause.label && item.choice === cause.choice);
  if (!previous) front.causes.push(cause);
  if (front.causes.length > 8) front.causes.splice(0, front.causes.length - 8);
}
function directionOf(action: PressureChoice): NonNullable<PressureCause['direction']> {
  const flow = (action.need ?? 0) - (action.capacity ?? 0);
  const change = Math.abs(flow) > .001 ? flow : (action.backlog ?? 0) + (action.fatigue ?? 0) / 10;
  return change > .001 ? 'increase' : change < -.001 ? 'reduce' : 'neutral';
}
function causalOrigin(front: PressureFront, direction: 'increase' | 'reduce'): PressureCause {
  const causes = [...front.causes].reverse();
  return causes.find(cause => cause.direction === direction)
    ?? causes.find(cause => cause.kind === 'shock')
    ?? front.causes.find(cause => cause.kind === 'inherited')
    ?? { kind: 'inherited', turn: 0, label: 'Situation héritée au début du mandat.' };
}

function executionFor(previous: PressureState, afterChoice: Game): number {
  const cabinetPenalty = afterChoice.politics?.cabinet === 'fallen' ? 1.5 : 0;
  const administrationPenalty = Math.max(0, previous.sectors.administration.pressure - 65) / 35;
  return round(Math.max(1, 4 - cabinetPenalty - administrationPenalty));
}
/** V17 standing priorities reallocate the existing delivery pool, including
 * after ministers have established all their permanent operational routines.
 * Older rules and FIFO within each priority group remain unchanged. */
function programmeOrder(game: Game, a: PressureProgramme, b: PressureProgramme): number {
  const priority = game.version === 17 ? game.presidency?.priority : null;
  const preferred = priority ? Number(b.sector === priority) - Number(a.sector === priority) : 0;
  return preferred || a.sourceTurn - b.sourceTurn || a.id.localeCompare(b.id);
}
function workThisPeriod(before: Game, afterChoice: Game, state: PressureState, capacity: number): Map<string, number> {
  const allocation = new Map<string, number>();
  let available = capacity;
  for (const programme of state.programmes.filter(item => item.status === 'preparing').sort((a, b) => programmeOrder(afterChoice, a, b))) {
    const project = programme.projectId ? afterChoice.narrative?.projects.find(item => item.id === programme.projectId) : undefined;
    if (project?.status === 'withdrawn' || (before.version >= 16 ? programme.sourceTurn > before.turn : programme.sourceTurn >= before.turn)) continue;
    const work = Math.max(0, Math.min(programme.remainingWork, programme.implementation ?? 1, available));
    allocation.set(programme.id, round(work)); available = round(available - work);
  }
  return allocation;
}

/** Narrative delivery uses the exact same work allocation as the sector transition.
 * Waiting is a scheduling delay, not a failed project requiring a second payment.
 */
export function pressureProjectWaitReason(before: Game, afterChoice: Game, projectId: string): string | undefined {
  const state = (before as PressureGame).pressure;
  if (before.version < 13 || !state) return undefined;
  const programmes = state.programmes.filter(item => item.projectId === projectId && item.status === 'preparing');
  if (!programmes.length) return undefined;
  const allocation = workThisPeriod(before, afterChoice, state, executionFor(state, afterChoice));
  if (programmes.some(item => item.remainingWork - (allocation.get(item.id) ?? 0) > .0001))
    return 'Les équipes de mise en œuvre sont encore mobilisées : le chantier conserve son financement et attend sa place dans le calendrier partagé.';
  if (programmes.some(item => before.turn + 1 < item.dueTurn))
    return 'Le délai minimal de mise en œuvre n’est pas terminé ; les bénéfices attendent la réalisation effective du programme.';
  return undefined;
}
export function pressureProjectCanDeliver(before: Game, afterChoice: Game, projectId: string): boolean {
  return pressureProjectWaitReason(before, afterChoice, projectId) === undefined;
}

/** Exactly one transition per committed decision, including a rejected ballot. */
export function advancePressure(before: Game, afterChoice: Game, rawChoice: Choice, adopted: boolean, presentedIncidents: readonly string[] = []): PressureTransition {
  const previous = (before as PressureGame).pressure ?? initialPressureState(before.seed, before.narrative?.context);
  const state = structuredClone(previous);
  const result: PressureTransition = { state, effect: {}, events: [], messages: [], unrest: 0, legitimacy: 0, support: 0 };
  const choice = rawChoice as PressureGameChoice;
  if (choice.effect.temporaryOperating && (!choice.pressure?.duration || !Number.isInteger(choice.pressure.duration) || choice.pressure.duration < 1)) {
    throw new Error('Une dépense temporaire doit préciser sa durée en périodes.');
  }
  const turn = before.turn + 1, year = Math.floor(before.turn / 6) + 1, slot = before.turn % 6 + 1;
  state.lastDecision = []; state.lastWorld = []; state.lastEvents = [];
  if (state.budget.year !== year) state.budget = { year, accruedOperating: 0, accruedRevenue: 0, operating: 0, revenue: 0 };
  function record(sector: PressureSectorId, title: string, detail: string, kind: 'decision' | 'world', causeTurn = before.turn, weight = 0) {
    const event: PressureEvent = { id: `pressure-${sector}-${turn}-${result.events.length}`, sector, turn, kind: 'pressure', title, detail, causeTurn, weight };
    result.events.push(event); result.messages.push(detail); state.lastEvents.push(event);
    (kind === 'decision' ? state.lastDecision : state.lastWorld).push(detail);
    return event;
  }
  let waitingReceipt: PressureEvent | undefined;

  // Merely rendering an agenda never activates anything. The campaign supplies
  // the incident dossiers present when this real decision spends its period.
  if (before.version >= 14) {
    state.incidents ??= [];
    for (const id of presentedIncidents.filter(isPressureIncidentId)) {
      if (state.incidents.some(item => item.id === id)) continue;
      const spec = PRESSURE_INCIDENTS[id];
      state.incidents.push({ id, sector: spec.sector, status: 'active', startedTurn: before.turn });
      record(spec.sector, 'Une perturbation active continue de peser sur le service',
        `${spec.label}. Tant qu’aucune réponse n’est opérationnelle, la capacité effective est réduite de ${spec.capacityLoss.toLocaleString('fr-FR')} unité par période (hypothèse de simulation).`, 'world');
    }
  }

  // Temporary flow changes expire before the next period is spent. Accrued costs remain.
  for (const programme of state.programmes) {
    if (programme.status !== 'active' || programme.endsTurn === undefined || turn < programme.endsTurn) continue;
    const front = state.sectors[programme.sector];
    front.capacity = round(Math.max(1, front.capacity - (programme.appliedCapacity ?? 0)));
    front.need = round(Math.max(0, front.need - (programme.appliedNeed ?? 0)));
    programme.status = 'completed';
    record(programme.sector, 'Le renfort temporaire arrive à son terme', `${programme.label} prend fin. Les dépenses déjà engagées restent dans les comptes de l’année.`, 'world', programme.sourceTurn);
    if (before.version >= 14 && programme.incidentId) {
      const incident = state.incidents?.find(item => item.id === programme.incidentId);
      if (incident?.status === 'contained' && incident.responseProgrammeId === programme.id) {
        const fallback = state.programmes.find(item => item.incidentId === incident.id && item.incidentResponse === 'contain'
          && item.deliveredTurn !== undefined && (item.status === 'active' && (item.endsTurn ?? Infinity) > turn || item.status === 'completed' && item.duration === undefined));
        incident.status = fallback ? 'contained' : 'active';
        if (fallback) incident.responseProgrammeId = fallback.id;
        else delete incident.responseProgrammeId;
        const spec = PRESSURE_INCIDENTS[incident.id];
        record(incident.sector, 'La réponse provisoire prend fin, la perturbation reste ouverte',
          `${programme.label} arrive à son terme. ${spec.label}${fallback ? ' ; les autres moyens de secours opérationnels restent en place' : ' ; une réponse durable reste à mettre en œuvre'}.`, 'world', incident.startedTurn, -1);
      }
    }
  }

  const action = choice.pressure;
  if (action) {
    if (!adopted) {
      record(action.sector, 'La mesure n’est pas adoptée', `${action.label} : le vote est rejeté. Aucun renfort, chantier ni coût de cette proposition n’est engagé ; les besoins continuent d’évoluer.`, 'decision');
    } else if (action.kind === 'defer' || action.kind === 'maintain') {
      const front = state.sectors[action.sector];
      // Authored reductions of opening hours or staffing have concrete effects too.
      // A plain postponement has no delta and receives no invented penalty.
      const changesCapacity = Boolean(action.capacity || action.need || action.backlog || action.fatigue);
      front.capacity = round(Math.max(1, front.capacity + (action.capacity ?? 0)));
      front.need = round(Math.max(0, front.need + (action.need ?? 0)));
      front.backlog = round(Math.max(0, front.backlog + (action.backlog ?? 0)));
      front.fatigue = round(limit(front.fatigue + (action.fatigue ?? 0), 0, 70));
      waitingReceipt = record(action.sector, 'Le dossier reste ouvert', changesCapacity
        ? `${action.label} : l’organisation et les capacités sont modifiées comme annoncé. Les besoins continuent d’arriver.`
        : `${action.label} : aucune capacité supplémentaire n’est engagée. Les besoins et les moyens déjà en place déterminent la suite.`, 'decision');
      addCause(front, { kind: 'decision', turn: before.turn, choice: choice.id, label: action.label, direction: directionOf(action) });
    } else {
      const delay = Math.max(0, Math.trunc(action.delay ?? 0));
      const implementation = limit(action.implementation ?? 1, .25, 4);
      const programme: PressureProgramme = {
        ...action, id: `pressure-plan-${choice.id}-${before.turn}`, sourceChoice: choice.id,
        sourceTurn: before.turn, dueTurn: turn + delay, status: 'preparing',
        remainingWork: round(delay * implementation), implementation,
        ...(choice.effect.temporaryOperating !== undefined ? { temporaryOperating: choice.effect.temporaryOperating } : {}),
      };
      if (action.socialMovementId) {
        const commitment = afterChoice.social?.movements.find(item => item.id === action.socialMovementId)?.commitment;
        programme.remainingWork = 0;
        programme.dueTurn = Math.max(programme.dueTurn, commitment?.dueTurn ?? turn);
      }
      state.programmes.push(programme);
      addCause(state.sectors[action.sector], { kind: 'decision', turn: before.turn, choice: choice.id, label: action.label, direction: 'neutral' });
      record(action.sector, 'Des moyens sont engagés', action.socialMovementId
        ? `${action.label} est financé. La capacité attend la mise en œuvre effective de l’engagement négocié avec le collectif.`
        : delay
        ? `${action.label} est financé. Mise en œuvre : ${delay} période${delay > 1 ? 's' : ''} au minimum ; les équipes d’exécution sont partagées entre les chantiers.`
        : `${action.label} est engagé pour cette période${action.duration ? ` et pour ${action.duration} périodes au total` : ''}.`, 'decision', before.turn, 1);
    }
  }

  // The queue has its own finite workforce. A financing vote never creates staff.
  state.execution = { capacity: executionFor(previous, afterChoice), used: 0, waiting: 0 };
  const allocation = workThisPeriod(before, afterChoice, state, state.execution.capacity);
  for (const programme of state.programmes.filter(item => item.status === 'preparing').sort((a, b) => programmeOrder(afterChoice, a, b))) {
    const project = programme.projectId ? afterChoice.narrative?.projects.find(item => item.id === programme.projectId) : undefined;
    const movement = programme.socialMovementId ? afterChoice.social?.movements.find(item => item.id === programme.socialMovementId) : undefined;
    if (project?.status === 'withdrawn' || movement?.commitment?.status === 'broken') {
      programme.status = 'cancelled';
      record(programme.sector, 'La mise en œuvre n’aboutit pas', `${programme.label} : ${programme.socialMovementId ? 'l’engagement social n’a pas été tenu' : 'le projet d’origine est retiré'}. Sa capacité ne sera pas livrée.`, 'world', programme.sourceTurn, -1);
      continue;
    }
    // The financing decision itself does not consume one of its future delivery periods.
    if ((before.version >= 16 ? programme.sourceTurn <= before.turn : programme.sourceTurn < before.turn) && programme.remainingWork > 0) {
      const work = allocation.get(programme.id) ?? 0;
      programme.remainingWork = round(programme.remainingWork - work);
      state.execution.used = round(state.execution.used + work);
    }
    const ownWorkDone = programme.remainingWork <= .0001 && turn >= programme.dueTurn;
    const projectDone = !programme.projectId || project?.status === 'delivered';
    const socialDone = !programme.socialMovementId || movement?.commitment?.status === 'kept';
    if (!ownWorkDone || !projectDone || !socialDone) {
      state.execution.waiting++;
      if (turn >= programme.dueTurn && programme.lastDelayTurn !== turn) {
        programme.lastDelayTurn = turn;
        const reason = !socialDone ? 'l’engagement social n’est pas encore mis en œuvre' : programme.projectId && !projectDone ? 'le projet d’origine n’est pas encore livré' : 'les équipes d’exécution sont occupées sur d’autres chantiers';
        record(programme.sector, 'La mise en œuvre prend du retard', `${programme.label} attend : ${reason}. Le financement est conservé, sans nouveau paiement du coût initial.`, 'world', programme.sourceTurn, -1);
      }
      continue;
    }
    const front = state.sectors[programme.sector];
    const capacity = Math.max(1, front.capacity + (programme.capacity ?? 0));
    const need = Math.max(0, front.need + (programme.need ?? 0));
    programme.appliedCapacity = round(capacity - front.capacity);
    programme.appliedNeed = round(need - front.need);
    front.capacity = round(capacity); front.need = round(need);
    front.backlog = round(Math.max(0, front.backlog + (programme.backlog ?? 0)));
    front.fatigue = round(limit(front.fatigue + (programme.fatigue ?? 0), 0, 70));
    programme.deliveredTurn = turn;
    if (programme.duration !== undefined && programme.duration > 0) {
      programme.status = 'active'; programme.endsTurn = turn + Math.trunc(programme.duration);
    } else programme.status = 'completed';
    addCause(front, { kind: 'delivery', turn: programme.sourceTurn, choice: programme.sourceChoice, label: programme.label, direction: directionOf(programme) });
    record(programme.sector, 'Les moyens entrent en service', `${programme.label} est opérationnel${programme.duration ? ` pour ${programme.duration} périodes` : ''}. Les capacités changent maintenant ; le retard se résorbera selon les besoins qui continuent d’arriver.`, programme.sourceTurn === before.turn ? 'decision' : 'world', programme.sourceTurn, 2);
    if (before.version >= 14 && programme.incidentId && programme.incidentResponse) {
      const incident = state.incidents?.find(item => item.id === programme.incidentId);
      if (incident && incident.status !== 'resolved') {
        incident.status = programme.incidentResponse === 'resolve' ? 'resolved' : 'contained';
        incident.responseProgrammeId = programme.id;
        if (incident.status === 'resolved') incident.resolvedTurn = turn;
        record(incident.sector, incident.status === 'resolved' ? 'La perturbation est levée' : 'Une réponse de secours contient la perturbation',
          incident.status === 'resolved'
            ? `${programme.label} est réellement opérationnel. La perte de capacité liée à cet incident prend fin ; les retards accumulés restent à rattraper.`
            : `${programme.label} limite la perturbation${programme.duration ? ` pendant ${programme.duration} périodes` : ''}. Le fonctionnement de secours conserve une perte de capacité résiduelle ; les retards acquis ne disparaissent pas.`,
          programme.sourceTurn === before.turn ? 'decision' : 'world', programme.sourceTurn, 2);
      }
    }
  }

  const scenarioShocks = before.version === 17 || (before.version === 16 && before.presidency?.crises) ? [] : shocks(before.seed);
  if (before.version !== 17 && slot === 1 && year > 1) {
    for (const id of IDS) {
      const profile = PRESSURE_CHAPTER_NEEDS[id];
      const change = profile[Math.min(4, year - 1)] - profile[Math.min(4, year - 2)];
      if (!change) continue;
      const label = `${PRESSURE_SECTORS[id].label} : les besoins tendanciels du scénario ${change > 0 ? 'augmentent' : 'diminuent'} de ${Math.abs(change).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} unité par période pour ce chapitre. Cette évolution est une hypothèse de jeu.`;
      addCause(state.sectors[id], { kind: 'shock', turn: before.turn, label, direction: change > 0 ? 'increase' : 'reduce' });
      record(id, 'Les besoins du chapitre évoluent', label, 'world', before.turn);
    }
  }
  for (const shock of scenarioShocks.filter(item => item.at === turn)) {
    addCause(state.sectors[shock.sector], { kind: 'shock', turn: before.turn, label: shock.label, direction: 'increase' });
    record(shock.sector, 'Les besoins ou les capacités évoluent', `${shock.label} : perturbation prévue pour ${shock.duration} périodes dans le scénario.`, 'world');
  }
  for (const id of IDS) {
    const front = state.sectors[id], old = previous.sectors[id];
    // Cross-sector links use only the previous state, never this loop's updated neighbours.
    const links = LINKS.filter(link => link.to === id).map(link => ({ ...link, loss: link.capacity * limit((previous.sectors[link.from].pressure - 60) / 40, 0, 1) })).filter(link => link.loss > .01);
    const external = scenarioShocks.filter(item => item.sector === id && turn >= item.at && turn < item.at + item.duration);
    const seasonalNeed = id === 'health' && (slot === 1 || slot === 6) ? 1.2 : id === 'energy' && (slot === 1 || slot === 6) ? 1 : id === 'education' && slot === 4 ? 1 : 0;
    // V17 owns its declared, context-specific demand projections.
    const chapterNeed = before.version === 17 ? 0 : PRESSURE_CHAPTER_NEEDS[id][Math.min(4, year - 1)];
    const crisis = before.version === 16 ? crisisImpact(before, id, state.programmes, turn) : { loss: 0, need: 0, labels: [] };
    const need = Math.max(0, front.need + crisis.need + chapterNeed + seasonalNeed + external.reduce((sum, item) => sum + (item.need ?? 0), 0));
    front.incomingNeed = round(need);
    const linkLoss = Math.min(2.2, links.reduce((sum, link) => sum + link.loss, 0));
    const incidents = before.version >= 14 ? (state.incidents ?? []).filter(item => item.sector === id && item.status !== 'resolved') : [];
    const incidentLoss = incidents.reduce((sum, item) => {
      const spec = PRESSURE_INCIDENTS[item.id];
      return sum + (item.status === 'contained' ? spec.containedLoss : spec.capacityLoss);
    }, 0);
    const effectiveCapacity = Math.max(.5, front.capacity * (1 - front.fatigue / 300) - linkLoss - incidentLoss - crisis.loss + external.reduce((sum, item) => sum + (item.capacity ?? 0), 0));
    const added = need - effectiveCapacity;
    front.effectiveCapacity = round(effectiveCapacity);
    front.backlog = round(Math.max(0, front.backlog + added));
    const fatigueChange = added > .2 ? Math.min(2.8, .5 + added * .35 + Math.max(0, front.backlog / front.capacity - 1) * .3) : added < -.2 ? -2.5 : -.7;
    front.fatigue = round(limit(front.fatigue + fatigueChange, 0, 70));
    front.lastChange = round(front.backlog - old.backlog);
    front.pressure = pressureOf(front); front.pressureChange = round(front.pressure - old.pressure);
    front.stage = stageOf(front.pressure);
    front.trend = front.pressureChange > .35 ? 'worsening' : front.pressureChange < -.35 ? 'improving' : 'steady';
    delete front.nextRiskIn;
    const nextThreshold = [25, 45, 65, 85].find(threshold => threshold > front.pressure);
    if (nextThreshold !== undefined && front.pressureChange > .35) front.nextRiskIn = Math.max(1, Math.ceil((nextThreshold - front.pressure) / front.pressureChange));
    front.causes = front.causes.filter(cause => cause.kind !== 'link');
    if (before.version >= 14) {
      front.causes = front.causes.filter(cause => cause.kind !== 'incident');
      for (const label of crisis.labels) addCause(front, { kind: 'incident', turn: before.turn, direction: 'increase', label });
      for (const incident of incidents) {
        const spec = PRESSURE_INCIDENTS[incident.id];
        addCause(front, { kind: 'incident', turn: incident.startedTurn, direction: 'increase',
          label: `${spec.label}${incident.status === 'contained' ? ' en fonctionnement de secours' : ''} : −${(incident.status === 'contained' ? spec.containedLoss : spec.capacityLoss).toLocaleString('fr-FR')} unité de capacité effective par période (hypothèse de simulation).` });
      }
    }
    for (const link of links) {
      const origin = causalOrigin(previous.sectors[link.from], 'increase');
      addCause(front, { kind: 'link', turn: origin.turn, choice: origin.choice, direction: 'increase', label: link.label });
    }
    const origin = causalOrigin(front, front.pressureChange < 0 ? 'reduce' : 'increase');
    if (front.stage !== old.stage) record(id, `${PRESSURE_SECTORS[id].label} : ${STAGE_LABELS[front.stage]}`, `${PRESSURE_SECTORS[id].label} : ${STAGE_LABELS[front.stage]}. ${front.lastChange > 0 ? 'Les besoins dépassent les capacités ; le retard augmente.' : 'Les capacités permettent de réduire le retard.'}${links.length ? ` ${links[0].label}` : ''}`, 'world', origin.turn, front.pressureChange < 0 ? 2 : -2);
    else if (links.some(link => !old.causes.some(cause => cause.kind === 'link' && cause.label === link.label))) record(id, 'Une difficulté se répercute sur un autre service', links[0].label, 'world', causalOrigin(previous.sectors[links[0].from], 'increase').turn, -1);
    const disruption = limit((front.pressure - 60) / 40, 0, 1);
    if (disruption > 0) {
      result.effect.services = (result.effect.services ?? 0) - disruption * .35;
      result.effect.trust = (result.effect.trust ?? 0) - disruption * .18;
      result.unrest += disruption * .45; result.support -= disruption * .12; result.legitimacy -= disruption * .08;
    }
    if (old.stage === 'disrupted' || old.stage === 'crisis') {
      if (front.stage === 'stable' || front.stage === 'watch') {
        result.effect.trust = (result.effect.trust ?? 0) + .6;
        result.unrest -= .5;
      }
    }
  }

  // The report describes this committed period, after deliveries and every
  // sector have evolved. Published v14 quantities and accounting are unchanged.
  // Replace the original receipt so the short verdict and durable history agree.
  if (before.version >= 14 && action && waitingReceipt) {
    const old = previous.sectors[action.sector], front = state.sectors[action.sector];
    const number = (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(value);
    const waitingForFundedMeans = previous.programmes.some(item => item.sector === action.sector && item.status === 'preparing'
      && ((item.capacity ?? 0) > 0 || (item.need ?? 0) < 0 || (item.backlog ?? 0) < 0));
    const changesOrganisation = Boolean(action.capacity || action.need || action.backlog || action.fatigue);
    const label = changesOrganisation ? 'Organisation modifiée'
      : waitingForFundedMeans ? 'Attente des moyens déjà financés'
      : action.kind === 'defer' ? 'Report sans renfort nouveau' : 'Moyens maintenus';
    const delta = front.lastChange > 0 ? `+${number(front.lastChange)}` : number(front.lastChange);
    const stage = front.stage === old.stage ? STAGE_LABELS[front.stage]
      : `${STAGE_LABELS[old.stage]} → ${STAGE_LABELS[front.stage]}`;
    const detail = `${label}. ${PRESSURE_SECTORS[action.sector].label} : retard ${delta} unité${Math.abs(front.lastChange) === 1 ? '' : 's'} sur la période, ${number(front.backlog)} au total. ${stage}. Pression ${number(old.pressure)} → ${number(front.pressure)}/100 ; fatigue ${number(old.fatigue)} → ${number(front.fatigue)}/100.${front.pressure >= 100 && front.lastChange > 0 ? ' La jauge est plafonnée à 100, pas le retard.' : ''}`;
    const previousDetail = waitingReceipt.detail;
    waitingReceipt.title = label;
    waitingReceipt.detail = detail;
    state.lastDecision = [detail, ...state.lastDecision.filter(item => item !== previousDetail)];
    const messageIndex = result.messages.indexOf(previousDetail);
    if (messageIndex >= 0) result.messages[messageIndex] = detail;
  }

  // Expenses are annual rates integrated only over periods actually active.
  // Finite relief is forecast to its exact end, not carried to the end of each year.
  const disruption = annualDisruption(state);
  const activeTemporary = state.programmes.filter(item => item.status === 'active' && item.endsTurn !== undefined);
  const temporaryRate = activeTemporary.reduce((sum, item) => sum + (item.temporaryOperating ?? 0), 0);
  state.budget.accruedOperating = round(state.budget.accruedOperating + (disruption.operating + temporaryRate) / 6);
  state.budget.accruedRevenue = round(state.budget.accruedRevenue + disruption.revenue / 6);
  const yearEndTurn = year * 6;
  const temporaryForecast = activeTemporary.reduce((sum, item) => sum + (item.temporaryOperating ?? 0) * Math.max(0, Math.min(yearEndTurn, item.endsTurn! - 1) - turn) / 6, 0);
  state.budget.operating = round(state.budget.accruedOperating + disruption.operating * (6 - slot) / 6 + temporaryForecast);
  state.budget.revenue = round(state.budget.accruedRevenue + disruption.revenue * (6 - slot) / 6);
  result.unrest = round(result.unrest); result.support = round(result.support); result.legitimacy = round(result.legitimacy);
  for (const key of ['services', 'trust'] as const) if (result.effect[key] !== undefined) result.effect[key] = round(result.effect[key]!);
  return result;
}
