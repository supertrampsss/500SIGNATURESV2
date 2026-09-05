import { calendarFor, domainFor, startingGame } from './engine.ts';
import { projects } from './world.ts';
import type { Game } from './types.ts';
export type NationalArea = 'metropoles' | 'industrie' | 'rural' | 'littoraux';
export type NationalSceneState = {
  turn: number; year: number; inherited: boolean; focus: NationalArea | 'national';
  areas: { id: string; services: number; resilience: number }[];
  projects: { id: string; area: string; state: 'planned' | 'delivered' | 'risk'; title: string }[];
  assets: number; reducedMotion: boolean;
};
export function nationalSceneState(game: Game, inherited = false, reducedMotion = false): NationalSceneState {
  const snapshot = inherited ? startingGame(game) : game;
  const dossier = domainFor(game).dossiers[game.turn];
  const area = dossier?.choices.map(c => c.delayed?.effect.area ?? c.effect.area).find(Boolean);
  const focus: NationalArea | 'national' = area === 'metropoles' || area === 'industrie' || area === 'rural' || area === 'littoraux' ? area : 'national';
  return { turn: snapshot.turn, year: calendarFor(snapshot).year, inherited, focus,
    areas: snapshot.areas.map(({ id, services, resilience }) => ({ id, services, resilience })),
    projects: inherited ? [] : projects(game), assets: snapshot.metrics.assets, reducedMotion };
}
