import type { NarrativeChoice, NarrativeEvent, NarrativeFamily } from './narrative-types.ts';
import type { PressureChoice, PressureFront, PressureSectorId } from './pressure-types.ts';
import type { Game } from './types.ts';
import { PRESSURE_ASSUMPTION_NOTE, PRESSURE_DOSSIERS } from './pressure-content.ts';
import { isPressureRecovery, pressureRecoveryPlan } from './pressure-recovery.ts';

export type PressureAgendaFront = { event: NarrativeEvent; family: NarrativeFamily };
const number = (value: number): string => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
const money = (value: number): string => `${number(value)} Md€`;
const stageLabel: Record<PressureFront['stage'], string> = {
  stable: 'Marge disponible', watch: 'Vigilance', strained: 'Sous tension', disrupted: 'Service perturbé', crisis: 'Crise active',
};
const period = (turn: number): string => {
  if (turn >= 30) return 'fin du mandat';
  const months = ['janvier–février', 'mars–avril', 'mai–juin', 'juillet–août', 'septembre–octobre', 'novembre–décembre'];
  return `${months[turn % 6]}, année ${Math.floor(turn / 6) + 1}`;
};
const withPressure = (choice: NarrativeChoice, pressure: PressureChoice): NarrativeChoice => ({ ...choice, pressure });

function frontForSector(g: Game, sector: PressureSectorId): PressureAgendaFront | undefined {
  const state = g.pressure;
  if (!state) return undefined;
  const front = state.sectors[sector];
  const content = PRESSURE_DOSSIERS[sector];
  const programmes = state.programmes.filter(item => item.sector === sector);
  const preparing = programmes.filter(item => item.status === 'preparing');
  const addsSupport = (item: PressureChoice): boolean => (item.capacity ?? 0) > 0 || (item.need ?? 0) < 0 || (item.backlog ?? 0) < 0;
  const live = programmes.filter(item => item.status === 'active' || item.status === 'preparing');
  const reliefActive = live.some(item => item.kind === 'relief' && addsSupport(item));
  const delegationActive = live.some(item => item.kind === 'delegate' && item.duration && addsSupport(item));
  const supportPreparing = preparing.some(item => (g.version >= 15 || !item.duration) && addsSupport(item));
  const structuralPreparing = preparing.some(item => !item.duration && addsSupport(item) && item.label === content.programme.title);
  const title = front.stage === 'crisis' || front.stage === 'disrupted'
    ? content.crisisTitle : front.stage === 'stable' ? content.calmTitle : content.strainTitle;
  const incomingNeed = front.incomingNeed ?? front.need;
  const difference = incomingNeed - front.effectiveCapacity;
  const trend = front.lastChange > 0.05 ? `+${number(front.lastChange)}` : number(front.lastChange);
  const risk = front.nextRiskIn !== undefined && front.nextRiskIn > 0
    ? ` Au rythme actuel, prochain seuil de tension estimé dans ${front.nextRiskIn} période${front.nextRiskIn > 1 ? 's' : ''}, si les conditions restent identiques.` : '';
  const queue = preparing.length
    ? ` ${preparing.length} programme${preparing.length > 1 ? 's' : ''} en préparation ; les effets attendent leur réalisation et les équipes disponibles.` : '';
  const causes = front.causes.slice(-2).map(item => item.label).join(' ; ');
  const family: NarrativeFamily = {
    ...content.family,
    urgency: `${stageLabel[front.stage]} · ${front.trend === 'worsening' ? 's’aggrave' : front.trend === 'improving' ? 's’améliore' : 'stable'}`,
  };
  const choices: NarrativeChoice[] = [];
  const metadata = (kind: PressureChoice['kind'], label: string, values: Omit<PressureChoice, 'kind' | 'label' | 'sector'> = {}): PressureChoice => ({ kind, sector, label, ...values });

  if (!reliefActive) {
    const relief = content.relief;
    choices.push(withPressure({
      id: 'relief', title: relief.title, description: relief.description,
      cost: `${money(relief.operating)}/an pendant quatre mois, soit environ ${money(relief.operating / 3)} au total`,
      benefit: `Après mise en place, +${number(relief.capacity)} unités de capacité par période pendant deux périodes.`,
      sacrifice: relief.sacrifice,
      effect: { temporaryOperating: relief.operating },
      relationships: { social: 2, regional: 1 },
    }, metadata('relief', relief.title, { capacity: relief.capacity, duration: 2, fatigue: -6 })));
  }

  // Do not sell the same unfinished permanent programme again. A funded measure
  // already consumes the shared execution pool; another click cannot deliver it.
  if (!structuralPreparing && front.capacity < incomingNeed + 4) {
    const programme = content.programme;
    choices.push(withPressure({
      id: 'programme', title: programme.title, description: programme.description,
      cost: `${money(programme.investment)} d’investissement ponctuel et ${money(programme.operating)}/an`,
      benefit: `+${number(programme.capacity)} unités de capacité par période, au plus tôt après ${programme.delay * 2} mois ; charge de mise en œuvre : 2.`,
      sacrifice: `${programme.sacrifice}${g.turn + 1 + programme.delay > 30 ? ' La première mise en service estimée dépasse la fin de ce mandat.' : ''}`,
      effect: { investment: programme.investment, operating: programme.operating },
      relationships: { social: 3, regional: 2, reformist: 1 },
    }, metadata('programme', programme.title, { capacity: programme.capacity, delay: programme.delay, implementation: 2, fatigue: -8 })));
  }

  if (g.version >= 15 && (front.stage === 'disrupted' || front.stage === 'crisis')
    && !live.some(isPressureRecovery)) {
    const recovery = pressureRecoveryPlan(front, content);
    const title = `Plan de rattrapage : ${content.family.title}`;
    choices.push(withPressure({
      id: 'recovery', title,
      description: `Mobiliser une équipe temporaire dimensionnée à ${number(recovery.backlog)} unités du retard actuel, avec les besoins qui continuent d’arriver. Le programme prépare des moyens supplémentaires ; il n’efface pas la file à son financement.`,
      cost: `${money(recovery.investment)} d’investissement ponctuel et ${money(recovery.operating)}/an pendant huit mois, soit environ ${money(recovery.operating * recovery.duration / 6)} de fonctionnement au total`,
      benefit: `+${number(recovery.capacity)} unités de capacité par période pendant quatre périodes, au plus tôt après ${recovery.delay * 2} mois. Le retard diminue si la capacité effective dépasse les besoins entrants.`,
      sacrifice: `Charge de mise en œuvre : ${recovery.implementation} unité${recovery.implementation > 1 ? 's' : ''} par période pendant au moins ${recovery.delay} périodes, partagée avec les autres chantiers. Le renfort prend fin après huit mois ; les moyens durables restent à financer.${g.turn + 1 + recovery.delay > 30 ? ' La première mise en service estimée dépasse la fin de ce mandat.' : ''}`,
      effect: { investment: recovery.investment, temporaryOperating: recovery.operating },
      relationships: { social: 2, regional: 1 },
    }, metadata('programme', title, {
      capacity: recovery.capacity, duration: recovery.duration,
      delay: recovery.delay, implementation: recovery.implementation,
    })));
  }

  if (!delegationActive) {
    const delegate = content.delegate;
    choices.push(withPressure({
      id: 'delegate', title: delegate.title, description: delegate.description,
      cost: `${money(delegate.operating)}/an pendant six mois, soit ${money(delegate.operating / 2)} au total`,
      benefit: `Un relais de +${number(delegate.capacity)} unités de capacité par période pendant trois périodes, après une période de préparation.`,
      sacrifice: `${delegate.sacrifice}${g.turn + 2 > 30 ? ' Le relais ne sera pas opérationnel avant la fin de ce mandat.' : ''}`,
      effect: { temporaryOperating: delegate.operating },
      relationships: { reformist: 2, regional: 2 },
    }, metadata('delegate', delegate.title, { capacity: delegate.capacity, delay: 1, duration: 3, implementation: 1 })));
  }

  const waiting = difference > 0.05;
  choices.push(withPressure({
    id: 'maintain',
    title: supportPreparing ? 'Laisser avancer les mesures déjà financées' : waiting ? 'Reporter sans nouveau crédit' : 'Maintenir les moyens actuels',
    description: supportPreparing
      ? 'Conserver les engagements en cours et passer à la période suivante. Les délais réels dépendent encore des équipes et du gouvernement.'
      : 'Ne pas engager de moyen supplémentaire cette période. Les nouvelles demandes et les capacités existantes continuent d’évoluer.',
    cost: '0 € de crédit nouveau ; les engagements existants restent dus',
    benefit: 'Les crédits et la capacité de mise en œuvre restent disponibles pour d’autres priorités.',
    sacrifice: waiting
      ? `Si les besoins et les capacités de la dernière période restent identiques, environ ${number(difference)} unités supplémentaires restent en attente par période.`
      : 'La marge disponible reste exposée aux prochains événements ; aucun nouveau renfort n’est financé.',
    effect: {},
    political: { action: 'administrative' },
  }, metadata(waiting ? 'defer' : 'maintain', waiting ? 'Report sans crédit nouveau' : 'Maintien des moyens')));

  return {
    family,
    event: {
      id: `pressure-${sector}`, familyId: family.id, title,
      body: `${content.problem}\n\n${number(front.backlog)} unités en attente (${trend} à la dernière période). Dernière période : besoins entrants ${number(incomingNeed)} ; capacité effective ${number(front.effectiveCapacity)}.${risk}${queue}\n\n${content.consequence}${causes ? ` Causes récentes : ${causes}.` : ''}\n\n${PRESSURE_ASSUMPTION_NOTE} ${g.turn >= 29 ? 'Cette décision clôture le mandat.' : `Prochaine période après décision : ${period(g.turn + 1)}.`}`,
      choices,
    },
  };
}

/** All six fronts remain available. Priority sorting changes their order, never
 * deletes an unresolved need. Calendar advancement remains owned by the engine.
 */
export function pressureAgenda(g: Game): PressureAgendaFront[] {
  if (g.version < 13 || g.mode !== 'national' || !g.pressure || g.turn >= 30) return [];
  return (Object.keys(PRESSURE_DOSSIERS) as PressureSectorId[])
    .sort((a, b) => g.pressure!.sectors[b].pressure - g.pressure!.sectors[a].pressure || a.localeCompare(b))
    .flatMap(sector => { const front = frontForSector(g, sector); return front ? [front] : []; });
}

export function isPressureFront(event: Pick<NarrativeEvent, 'id'>): boolean {
  return event.id.startsWith('pressure-');
}
