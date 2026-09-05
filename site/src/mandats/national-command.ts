import { calendarFor, domainFor } from './engine.ts';
import type { Game } from './types.ts';

const number = (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);

/** National scope stays visible while the scene illustrates everyday consequences. */
export function nationalMandateHeading(game: Game): string {
  const calendar = calendarFor(game);
  return `<div class="mobile-mandate-context france-mandate-context"><span>Gouverner la France<small>Simulation · ${domainFor(game).turns} décisions</small></span><strong>Année ${calendar.year}/${calendar.years}</strong></div>`;
}

export function nationalCommandPulse(game: Game): string {
  return `<dl class="national-command-pulse" aria-label="État du pays dans la simulation"><div><dt>Dette publique</dt><dd>${number(game.finance.debt)} <small>Md€</small></dd></div><div><dt>Services publics</dt><dd>${number(game.metrics.services)}<small>/100</small></dd></div></dl>`;
}
