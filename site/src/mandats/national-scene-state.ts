import { calendarFor, domainFor, startingGame } from './engine.ts';
import { projects } from './world.ts';
import type { Game } from './types.ts';
import type { VisualState } from './winter/scene.ts';
export type NationalArea = 'metropoles' | 'industrie' | 'rural' | 'littoraux';
export type NationalSceneState = {
  turn: number; year: number; inherited: boolean; focus: NationalArea | 'national';
  areas: { id: string; services: number; resilience: number }[];
  projects: { id: string; area: string; state: 'planned' | 'delivered' | 'risk'; title: string }[];
  assets: number; reducedMotion: boolean; visual: VisualState;
};
export function nationalSceneState(game: Game, inherited = false, reducedMotion = false): NationalSceneState {
  const snapshot = inherited ? startingGame(game) : game;
  const domain = domainFor(game);
  const lastDossier = snapshot.turn ? domain.dossiers[snapshot.turn - 1] : undefined;
  const lastChoice = lastDossier?.choices.find(choice => choice.id === snapshot.history.at(-1)?.choice);
  const dossier = domain.dossiers[snapshot.turn];
  const area = lastChoice?.delayed?.effect.area ?? lastChoice?.effect.area ?? dossier?.choices.map(c => c.delayed?.effect.area ?? c.effect.area).find(Boolean);
  const focus: NationalArea | 'national' = area === 'metropoles' || area === 'industrie' || area === 'rural' || area === 'littoraux' ? area : 'national';
  // Only committed, positive investment creates building work. A budget cut is
  // not a delivered project; the shared project feed also contains legacy risks.
  const funded = inherited ? [] : projects(game).filter(project => {
    const index = game.choices.indexOf(project.id);
    const choice = domainFor(game).dossiers[index]?.choices.find(c => c.id === project.id);
    return (choice?.effect.investment ?? 0) > 0;
  });
  const calendar = calendarFor(snapshot);
  const planned = funded.filter(p => p.state === 'planned').length;
  const delivered = funded.filter(p => p.state === 'delivered').length;
  const baseline = domain.initial().metrics;
  // A two-point change must be visible on a phone. The values remain anchored
  // to real game indices, but use the inherited state as the visual midpoint.
  const visualLevel = (value: number, inheritedValue: number) => Math.max(0, Math.min(1, .5 + (value - inheritedValue) / 16));
  const lastEffects = lastChoice ? Object.values(lastChoice.effect).filter((value): value is number => typeof value === 'number') : [];
  const positive = lastEffects.some(value => value > 0);
  const negative = lastEffects.some(value => value < 0);
  const tone: VisualState['tone'] = positive && negative ? 'mixed' : positive ? 'warm' : negative ? 'cool' : 'neutral';
  const visual: VisualState = {
    // Seasons only express progress through the playable year, never climate forecasts.
    season: calendar.slot <= 2 ? 'winter' : calendar.slot >= calendar.slots - 1 ? 'winter-return' : 'spring',
    warmth: visualLevel(snapshot.metrics.services, baseline.services),
    activity: visualLevel(snapshot.metrics.assets, baseline.assets),
    construction: planned > 0,
    renovated: delivered > 0,
    focus,
    tone,
    turn: snapshot.turn,
    caption: `Décor illustratif du mandat national. Services publics : ${Math.round(snapshot.metrics.services)} sur 100. État des équipements : ${Math.round(snapshot.metrics.assets)} sur 100. ${planned} investissements en cours, ${delivered} livrés dans le jeu. Les lumières et les déplacements illustrent ces indices, sans mesurer le chauffage ni l'emploi.`,
  };
  return { turn: snapshot.turn, year: calendar.year, inherited, focus,
    areas: snapshot.areas.map(({ id, services, resilience }) => ({ id, services, resilience })),
    projects: funded, assets: snapshot.metrics.assets, reducedMotion, visual };
}
