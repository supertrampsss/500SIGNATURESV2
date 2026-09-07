import { calendarFor, domainFor } from './engine.ts';
import type { Effect, Game } from './types.ts';
import { annualDeficit } from './national-deficit.ts';

const number = (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
const signed = (value: number) => `${value > 0 ? '+' : '−'}${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Math.abs(value))}`;

type Impact = { label: string; direction: 'up' | 'down' | 'neutral' };
const metricLabels: [keyof Pick<Effect, 'services' | 'cohesion' | 'resilience' | 'trust' | 'assets'>, string][] = [
  ['services', 'Services'], ['cohesion', 'Cohésion'], ['resilience', 'Résilience'], ['trust', 'Confiance'], ['assets', 'Équipements'],
];

/** A short, factual trace of the committed measure. Never more than three items. */
export function nationalDecisionImpact(game: Game): Impact[] {
  if (!game.turn) return [];
  const dossier = domainFor(game).dossiers[game.turn - 1];
  const choice = dossier?.choices.find(item => item.id === game.history.at(-1)?.choice);
  if (!choice) return [];
  const result: Impact[] = [];
  const push = (label: string, value: number, positiveWhenHigher = true) => result.push({
    label,
    direction: value === 0 ? 'neutral' : (value > 0) === positiveWhenHigher ? 'up' : 'down',
  });
  if (game.version >= 6) {
    const delta = (choice.effect.operating ?? 0) + (choice.effect.investment ?? 0) - (choice.effect.revenue ?? 0);
    if (delta) push(`Déficit ${signed(delta)} Md€ cette année`, delta, false);
  } else {
    if (choice.effect.revenue) push(`Recettes ${signed(choice.effect.revenue)} Md€/an`, choice.effect.revenue);
    if (choice.effect.operating) push(`Dépenses ${signed(choice.effect.operating)} Md€/an`, choice.effect.operating, false);
    if (choice.effect.investment) push(`Investissement ${signed(choice.effect.investment)} Md€`, choice.effect.investment);
  }
  if (choice.effect.repayment) push(`Remboursement ${signed(choice.effect.repayment)} Md€`, choice.effect.repayment);
  for (const [key, label] of metricLabels) {
    const value = choice.effect[key];
    if (value) push(`${label} ${signed(value)}`, value);
  }
  if (choice.delayed && result.length < 3) {
    const year = (game.history.at(-1)?.year ?? calendarFor(game).year) + choice.delayed.after;
    const event = choice.delayed.effect.revenue ? (choice.delayed.effect.revenue > 0 ? 'Recette prévue' : 'Fin de recette') : 'Livraison prévue';
    result.push({ label: `${event} · année ${year}`, direction: 'neutral' });
  }
  return result.slice(0, 3).length ? result.slice(0, 3) : [{ label: 'Trajectoire maintenue', direction: 'neutral' }];
}

/** National scope stays visible while the scene illustrates everyday consequences. */
export function nationalMandateHeading(game: Game): string {
  const calendar = calendarFor(game);
  return `<div class="mobile-mandate-context france-mandate-context"><span>Gouverner la France<small>Simulation · ${domainFor(game).turns} décisions</small></span><strong>Année ${calendar.year}/${calendar.years}</strong></div>`;
}

export function nationalCommandPulse(game: Game): string {
  const impact = nationalDecisionImpact(game);
  const deficit = annualDeficit(game);
  const initial = domainFor(game).settle(domainFor(game).initial().finance).deficit;
  const last = game.history.at(-1);
  const year = last?.year ?? 1;
  const amount = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Math.abs(deficit));
  return `<dl class="national-command-pulse" aria-label="État du pays dans la simulation">${impact.length ? `<div class="national-decision-impact" aria-live="polite"><dt>Effet de la mesure</dt><dd>${impact.map(item => `<span data-direction="${item.direction}">${item.label}</span>`).join('')}</dd></div>` : ''}${game.version >= 6 ? `<div class="national-deficit" aria-live="polite"><dt>${deficit < -.000001 ? 'Excédent annuel' : 'Déficit annuel'}</dt><dd>${amount} <small>Md€</small><small class="deficit-context">Année ${year}${last?.closed ? ' clôturée' : ' · budget prévu'}</small><small class="deficit-context">Départ : ${number(initial)} Md€ · Objectif : 0</small></dd></div>` : `<div><dt>Dette publique</dt><dd>${number(game.finance.debt)} <small>Md€</small></dd></div>`}<div><dt>Services publics</dt><dd>${number(game.metrics.services)}<small>/100</small></dd></div></dl>`;
}
