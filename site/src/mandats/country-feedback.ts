import type { Game } from './types.ts';
import type { NationalSceneState } from './national-scene-state.ts';
import { domainFor, startingGame } from './engine.ts';

const areaNames: Record<NationalSceneState['focus'], string> = {
  national: 'France', metropoles: 'Métropoles', industrie: 'Industrie',
  rural: 'Territoires ruraux', littoraux: 'Littoraux',
};
const metrics = [
  ['services', 'Services publics'], ['assets', 'Équipements'],
  ['cohesion', 'Cohésion'], ['resilience', 'Résilience'], ['trust', 'Confiance'],
] as const;
const frenchNumber = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

function turnReaction(game: Game): string | undefined {
  const last = game.history.at(-1);
  if (!last) return undefined;
  const prior = game.history.at(-2)?.metrics;
  const baselineGame = prior ? undefined : startingGame(game);
  const baseline = prior ?? baselineGame!.metrics;
  for (const [key, label] of metrics) {
    const difference = Math.round((last.metrics[key] - baseline[key]) * 10) / 10;
    if (difference) return `${label} : ${difference > 0 ? '+' : '−'}${frenchNumber.format(Math.abs(difference))} point${Math.abs(difference) === 1 ? '' : 's'} ${prior ? 'depuis la décision précédente' : 'après cette décision'}.`;
  }
  const previousDeficit = game.history.at(-2)?.ledger.deficit ?? domainFor(game).settle(startingGame(game).finance).deficit;
  const deficitDelta = Math.round((last.ledger.deficit - previousDeficit) * 10) / 10;
  if (deficitDelta) {
    return `Déficit annuel : ${deficitDelta > 0 ? '+' : '−'}${frenchNumber.format(Math.abs(deficitDelta))} Md€ ${game.history.length > 1 ? 'depuis la décision précédente' : 'après cette décision'}.`;
  }
  return 'Pas de variation des indicateurs enregistrée après cette décision.';
}

export type CountryFeedback = {
  title: string;
  copy: string;
  progress: string;
  progressPercent: number;
  focus: NationalSceneState['focus'];
};

/** Readable scene feedback derived only from committed game state. */
export function countryFeedback(game: Game, state: NationalSceneState): CountryFeedback {
  const last = state.inherited ? undefined : game.history.at(-1);
  const projects = state.projects.filter(project => project.state !== 'risk');
  const delivered = projects.filter(project => project.state === 'delivered').length;
  const planned = projects.filter(project => project.state === 'planned');
  const completed = projects.length ? Math.round(delivered / projects.length * 100) : 0;
  const area = areaNames[state.focus];
  const title = state.inherited ? 'Point de départ' : last ? `Profil · ${area}` : 'Votre première décision attend';
  let copy: string;
  if (state.inherited) copy = 'Situation héritée au début du mandat.';
  else if (last) copy = turnReaction(game) ?? `Les indicateurs du profil ${area} sont suivis au fil des décisions.`;
  else copy = 'Choisissez une mesure pour suivre ses effets ici.';
  const next = planned.slice().sort((a, b) => a.due - b.due)[0];
  const progress = next
    ? `${delivered} sur ${projects.length} projets livrés · prochaine livraison prévue : ${next.title}, année ${next.due}`
    : projects.length
      ? `${delivered} sur ${projects.length} projets financés livrés`
      : state.inherited ? 'Repère initial · aucun projet engagé' : 'Aucun projet financé à suivre pour le moment';
  return { title, copy, progress, progressPercent: completed, focus: state.focus };
}
