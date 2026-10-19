import type { Ambition, Game } from './types.ts';
import { presidencyCrises } from './presidency-crises.ts';

// These are explicit game objectives, not measurements of real French services.
export const PRESIDENCY_MISSIONS: Record<Ambition, { title: string; goal: string }> = {
  equilibre: {
    title: 'Tenir le budget',
    goal: 'Finir avec au moins 0,5 Md€ de crédits, sans service en crise grave ni incident actif.',
  },
  services: {
    title: 'Sauver les services',
    goal: 'Ramener la pression sanitaire sous 55/100, sans service en crise grave ni incident actif.',
  },
  resilience: {
    title: 'Prévenir les ruptures',
    goal: 'Ramener la pression énergétique sous 55/100 et terminer sans incident actif.',
  },
};
export function presidencyOutcome(game: Game): {
  status: 'victory' | 'incomplete' | 'defeat';
  title: string; explanation: string; goal: string;
} {
  const mission = PRESIDENCY_MISSIONS[game.ambition ?? 'equilibre'];
  const fronts = Object.values(game.pressure?.sectors ?? {});
  const severe = fronts.filter(front => front.pressure >= 75);
  const active = presidencyCrises(game).filter(crisis => crisis.status !== 'resolved');
  const interrupted = !!game.politics?.ending && game.politics.ending.kind !== 'term_complete';
  if (interrupted) return {
    status: 'defeat', title: 'Défaite : mandat interrompu', goal: mission.goal,
    explanation: game.politics?.ending?.reason ?? 'Le pouvoir a été interrompu avant le terme.',
  };
  const ok = game.ambition === 'services'
    ? (game.pressure?.sectors.health.pressure ?? Infinity) < 55 && severe.length === 0 && active.length === 0
    : game.ambition === 'resilience'
      ? (game.pressure?.sectors.energy.pressure ?? Infinity) < 55 && active.length === 0
      : (game.presidency?.reserve ?? -1) >= .5 && severe.length === 0 && active.length === 0;
  const explanation = [`${severe.length} service${severe.length>1?'s':''} en crise grave`,
    `${active.length} incident${active.length>1?'s':''} non résolu`,
    `${(game.presidency?.reserve ?? 0).toLocaleString('fr-FR', {maximumFractionDigits:1})} Md€ de crédits disponibles`].join(' · ');
  return { status: ok ? 'victory' : 'incomplete',
    title: ok ? 'Mandat réussi : objectif atteint' : 'Mandat achevé : objectif non atteint',
    explanation, goal: mission.goal };
}
