import { annualDeficit } from './national-deficit.ts';
import type { NarrativeChoice, NarrativeEvent, NarrativeEventRecord, NarrativeProject, NarrativePromise, NarrativeState } from './narrative-types.ts';
import { clamp } from './types.ts';
import type { Choice, Effect, Game } from './types.ts';

export type NarrativeResolution = { state: NarrativeState; consequences: string[]; effect: Effect };
const deliveryDefaults: Record<string, Effect> = {
  hospital: { services: 3, assets: 2 },
  industry: { assets: 2, cohesion: 2 },
  energy: { resilience: 3, assets: 2 },
  housing: { services: 2, cohesion: 2, assets: 2 },
  integrity: { trust: 3 },
};
const personBlocs: Record<string, string[]> = {
  samira: ['social'], luc: ['regional'], ines: ['reformist', 'conservative'], claire: ['presidential'],
};

/** Delivery affects the services actually available, never credits already voted. */
function mergeDelivery(target: Effect, source: Effect) {
  for (const key of ['services', 'assets', 'resilience', 'trust', 'cohesion'] as const) {
    if (source[key]) target[key] = (target[key] ?? 0) + source[key]!;
  }
  if (source.society) for (const key of Object.keys(source.society) as Array<keyof NonNullable<Effect['society']>>) {
    target.society ??= {};
    target.society[key] = (target.society[key] ?? 0) + (source.society[key] ?? 0);
  }
}
function decisionWeight(choice: Choice, after: Game): number {
  if (after.politics?.ending && after.politics.ending.kind !== 'term_complete') return 12;
  if (after.history.at(-1)?.vote?.kind === 'censure') return 8;
  if (after.history.at(-1)?.vote?.kind === 'election') return 9;
  const budget = Math.abs(choice.effect.revenue ?? 0) + Math.abs(choice.effect.operating ?? 0) + Math.abs(choice.effect.investment ?? 0);
  return Math.min(7, 1 + budget / 5 + Math.abs(choice.effect.services ?? 0) / 2);
}
function promiseBaseline(promise: NonNullable<NarrativeChoice['promise']>, before: Game): number {
  if (promise.keepWhen === 'deficit_lower') return annualDeficit(before);
  if (promise.keepWhen === 'coalition_stable') return before.politics?.legitimacy ?? 0;
  return before.metrics.services;
}
function promiseAchieved(promise: NarrativePromise, state: NarrativeState, after: Game, effect: Effect): boolean {
  if (promise.targetProject || promise.keepWhen === 'project_delivered') {
    return state.projects.some(project => project.id === promise.targetProject && project.status === 'delivered');
  }
  if (promise.keepWhen === 'programme_executed') {
    return promise.funded === true && (after.society?.publicStaff ?? 50) >= 35 && after.politics?.cabinet !== 'fallen';
  }
  if (promise.keepWhen === 'deficit_lower') return annualDeficit(after) < (promise.baseline ?? annualDeficit(after));
  if (promise.keepWhen === 'coalition_stable') return after.politics?.cabinet === 'stable' && !after.politics.pendingCrisis;
  return after.metrics.services + (effect.services ?? 0) > (promise.baseline ?? after.metrics.services);
}
function deliveryObstacle(project: NarrativeProject, after: Game): string | null {
  if (after.politics?.cabinet === 'fallen') return 'Le gouvernement doit être reformé avant de valider la mise en service.';
  if (after.finance.cash < 0) return 'La trésorerie disponible ne permet pas de terminer le programme.';
  const capacity = project.kind === 'hospital' ? 45 : 40;
  if (after.metrics.services < capacity) return `Les équipes ne peuvent pas absorber la mise en service : capacité ${Math.round(after.metrics.services)}/100, minimum ${capacity}.`;
  if ((after.society?.publicStaff ?? 50) < 35) return 'Les services chargés de l’exécution manquent d’agents disponibles.';
  return null;
}

/** Pure, replayable resolution. The campaign applies the returned effects once. */
export function resolveNarrativeConsequences(before: Game, after: Game, choice: Choice, event?: NarrativeEvent): NarrativeResolution {
  if (!before.narrative) throw new Error('État narratif absent.');
  const state = structuredClone(before.narrative);
  const consequences: string[] = [];
  const effect: Effect = {};
  const turn = before.turn;
  const raw = event?.choices.find(candidate => `n11-${before.turn}-${event.id}-${candidate.id}` === choice.id);
  const record = after.history.at(-1);
  const adopted = !(record?.vote?.kind === 'law' && !record.vote.passed);
  const addEvent = (item: Omit<NarrativeEventRecord, 'id' | 'turn'>) => {
    state.events.push({ ...item, id: `${item.kind}-${turn}-${state.events.length}`, turn });
  };

  if (!adopted) {
    consequences.push('Le texte est rejeté. Aucun crédit ni projet de ce texte n’est engagé.');
    addEvent({ kind: 'rejected', title: 'Le texte ne passe pas', detail: choice.title, causeTurn: turn, weight: after.politics?.pendingCrisis ? -7 : -3 });
  } else {
    if (raw?.project) {
      const spec = raw.project;
      const existing = state.projects.find(project => project.id === spec.id);
      const action = spec.action ?? (spec.repair && existing ? 'repair' : 'fund');
      if (action === 'withdraw') {
        if (!existing || !['funded', 'blocked'].includes(existing.status)) throw new Error('Aucun chantier en cours ne peut être abandonné.');
        existing.status = 'withdrawn';
        existing.resolvedTurn = turn;
        existing.note = 'Le chantier est abandonné. Les crédits déjà dépensés ne sont pas récupérés.';
        consequences.push(`Chantier abandonné : ${existing.label}.`);
        addEvent({ kind: 'project', title: 'Le chantier est abandonné', detail: existing.label, causeTurn: turn, weight: -6 });
      } else if (action === 'repair') {
        if (!existing || existing.status !== 'blocked') throw new Error('Ce chantier n’a pas besoin de crédits de reprise.');
        existing.status = 'funded';
        existing.dueTurn = turn + Math.max(1, spec.dueAfter);
        existing.remediationChoice = choice.id;
        existing.note = `La reprise est financée. Nouvelle livraison attendue à la décision ${existing.dueTurn + 1}.`;
        consequences.push(`Reprise financée : ${existing.label}.`);
        addEvent({ kind: 'repair', title: 'Le chantier reprend', detail: existing.label, causeTurn: turn, weight: 5 });
      } else {
        if (existing && existing.status !== 'withdrawn') throw new Error('Ce programme est déjà engagé.');
        const funded = (choice.effect.investment ?? 0) > 0 || (choice.effect.operating ?? 0) > 0;
        const project: NarrativeProject = {
          id: spec.id, kind: spec.kind, label: spec.label, place: spec.place,
          status: funded ? 'funded' : 'blocked', startedTurn: turn,
          dueTurn: turn + Math.max(1, spec.dueAfter), sourceChoice: choice.id, causeTurn: turn,
          deliveryEffect: structuredClone(spec.deliveryEffect ?? deliveryDefaults[spec.kind] ?? { assets: 2 }),
          pressByStatus: spec.pressByStatus,
          note: funded ? `Crédits votés. Livraison attendue à la décision ${turn + Math.max(1, spec.dueAfter) + 1}.` : 'Le programme attend des crédits dédiés.',
        };
        state.projects = state.projects.filter(item => item.id !== spec.id);
        state.projects.push(project);
        consequences.push(funded ? `Financement voté : ${spec.label}. Ses bénéfices arriveront à la livraison.` : `Projet bloqué : ${spec.label} attend un financement.`);
      }
    }
    if (raw?.promise) {
      const spec = raw.promise;
      // A repeat statement never erases an already missed deadline.
      if (!state.promises.some(promise => promise.id === spec.id)) {
        state.promises.push({ id: spec.id, label: spec.label, status: 'active', causeTurn: turn,
          dueTurn: turn + Math.max(1, spec.dueAfter ?? 3), targetProject: spec.targetProject,
          keepWhen: spec.keepWhen ?? (spec.targetProject ? 'project_delivered' : 'services_improved'),
          funded: (choice.effect.operating ?? 0) > 0 || (choice.effect.investment ?? 0) > 0,
          baseline: promiseBaseline(spec, before) });
        consequences.push(`Engagement pris : ${spec.label}`);
      }
    }
    if (raw?.relationships) for (const person of state.relationships) {
      const delta = (personBlocs[person.id] ?? []).reduce((sum, bloc) => sum + (raw.relationships?.[bloc as keyof typeof raw.relationships] ?? 0), 0);
      if (!delta) continue;
      person.loyalty = clamp(person.loyalty + delta);
      person.lastTurn = turn;
      person.stance = delta > 0 ? 'soutient votre dernier arbitrage' : 'conteste votre dernier arbitrage';
    }
    if (choice.amendment) consequences.push(`Compromis adopté : ${choice.amendment.label}.`);
    if (raw?.press) consequences.push(raw.press);
    if (!raw) consequences.push(choice.benefit);
    addEvent({ kind: 'decision', title: event?.title ?? record?.dossier?.title ?? choice.title,
      detail: raw?.press ?? choice.benefit, causeTurn: turn, weight: decisionWeight(choice, after) });
  }

  // A due project is resolved even when today's unrelated bill is rejected.
  for (const project of state.projects.filter(item => item.status === 'funded' && item.dueTurn <= turn)) {
    const obstacle = deliveryObstacle(project, after);
    project.status = obstacle ? 'blocked' : 'delivered';
    project.resolvedTurn = turn;
    project.note = obstacle ?? 'Le programme est mis en service ; ses bénéfices sont désormais appliqués.';
    if (obstacle) project.failureTurn = turn;
    else {
      project.deliveredTurn = turn;
      mergeDelivery(effect, project.deliveryEffect ?? deliveryDefaults[project.kind] ?? { assets: 2 });
    }
    consequences.push(`${obstacle ? 'Livraison bloquée' : 'Mise en service'} : ${project.label}. ${project.note}`);
    addEvent({ kind: 'project', title: obstacle ? 'Le chantier se bloque' : 'Une réalisation ouvre ses portes',
      detail: project.label + '. ' + project.note, causeTurn: project.causeTurn ?? project.startedTurn, weight: obstacle ? -6 : 6 });
  }
  for (const promise of state.promises.filter(item => item.status === 'active')) {
    const cancelled = promise.targetProject && state.projects.some(project => project.id === promise.targetProject && project.status === 'withdrawn');
    if (!cancelled && (promise.dueTurn === undefined || promise.dueTurn > turn)) continue;
    const kept = !cancelled && promiseAchieved(promise, state, after, effect);
    promise.status = kept ? 'kept' : 'broken';
    promise.resolvedTurn = turn;
    effect.trust = (effect.trust ?? 0) + (kept ? 2 : -3);
    consequences.push(`${kept ? 'Engagement tenu' : 'Engagement non tenu'} : ${promise.label}`);
    addEvent({ kind: 'promise', title: kept ? 'Une promesse tenue' : 'L’engagement n’est pas tenu', detail: promise.label,
      causeTurn: promise.causeTurn ?? turn, weight: kept ? 4 : -5 });
  }
  state.lastConsequences = consequences;
  state.focus = undefined;
  return { state, consequences, effect };
}
