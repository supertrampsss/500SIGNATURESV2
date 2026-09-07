import { clamp } from './types.ts';
import type { Game, Society } from './types.ts';

export const SOCIETY_LABELS: Record<keyof Society, string> = {
  workers: 'Actifs', pensioners: 'Retraités', vulnerable: 'Ménages modestes',
  businesses: 'Entreprises', newcomers: 'Nouveaux résidents', publicStaff: 'Agents publics',
};
export const initialSociety = (): Society => ({
  workers: 65, pensioners: 65, vulnerable: 60, businesses: 65, newcomers: 60, publicStaff: 65,
});

/** Indices of material conditions in a fictional scenario, never opinion polls. */
export function applySociety(g: Game, changes?: Partial<Society>): void {
  if (!g.society || !changes) return;
  for (const key of Object.keys(SOCIETY_LABELS) as (keyof Society)[]) {
    g.society[key] = clamp(g.society[key] + (changes[key] ?? 0));
  }
}

/** Recurring social consequences cannot be removed by skipping their follow-up card. */
export function socialYearEnd(g: Game): { messages: string[]; operating: number; revenue: number; trust: number } {
  const result = { messages: [] as string[], operating: 0, revenue: 0, trust: 0 };
  if (!g.society) return result;
  if (g.society.vulnerable < 35 || g.society.newcomers < 30) {
    result.operating += 2; result.trust -= 2;
    result.messages.push('Précarité : les prises en charge d’urgence ajoutent 2 Md€/an de charges dans le scénario.');
  }
  if (g.society.workers < 35 || g.society.publicStaff < 30) {
    result.revenue -= 2; result.trust -= 2;
    result.messages.push('Tensions au travail : les perturbations réduisent les recettes de 2 Md€/an dans le scénario.');
  }
  if (g.society.businesses < 30) {
    result.revenue -= 2;
    result.messages.push('Activité fragilisée : les recettes diminuent de 2 Md€/an dans le scénario.');
  }
  return result;
}
