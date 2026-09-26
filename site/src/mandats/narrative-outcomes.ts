import { domainFor, narrativeElectionOutcome, narrativeObjectives, replayGame, startingGame } from './engine.ts';
import { annualDeficit } from './national-deficit.ts';
import { escape } from './sharing.ts';
import type { Game, Metrics, Turn } from './types.ts';
import type { NarrativeEventRecord, NarrativeProject, NarrativePromise, NarrativeRelationship } from './narrative-types.ts';
import type { NarrativeEpilogue } from './narrative-types.ts';
import { selectStoryAgenda, storyAgenda } from './narrative-engine.ts';
import { NARRATIVE_PLACES } from './narrative-content.ts';

const n = (value: number, digits = 1) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(value);
const signed = (value: number, digits = 1) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${n(Math.abs(value), digits)}`;
const e = escape;

export type OutcomeDimension = { id: string; label: string; start: number | string; end: number | string; change: string; unit?: string };
export type CausalTurningPoint = { event: NarrativeEventRecord; index: number; turn: Turn; decision: string };

/** Restores the eligible story focus for the recorded choice at a zero-based turn. */
export function focusForRecordedDecision(game: Game, index: number): Game {
  const prefix = replayGame(game, game.choices.slice(0, index));
  if (game.version !== 11 || !game.history[index]) return prefix;
  const choiceId = game.history[index]!.choice;
  return storyAgenda(prefix).map(item => selectStoryAgenda(prefix, item.id)).find(candidate => domainFor(candidate).dossiers[candidate.turn]?.choices.some(choice => choice.id === choiceId)) ?? prefix;
}

/** Dimensions stay separate; this is a factual before/after view, never a composite grade. */
export function narrativeDimensions(game: Game): OutcomeDimension[] {
  const initial = startingGame(game);
  const initialDeficit = annualDeficit(initial);
  const finalDeficit = game.history.at(-1)?.ledger.deficit ?? annualDeficit(game);
  const metrics: Array<[string, keyof Metrics]> = [
    ['Services publics', 'services'], ['Cohésion', 'cohesion'], ['Confiance', 'trust'],
    ['Résilience', 'resilience'], ['Patrimoine public', 'assets'],
  ];
  const rows: OutcomeDimension[] = metrics.map(([label, key]) => ({
    id: key, label, start: Math.round(initial.metrics[key]), end: Math.round(game.metrics[key]),
    change: `${signed(game.metrics[key] - initial.metrics[key])} pts`, unit: '/100',
  }));
  rows.unshift({ id: 'balance', label: 'Solde annuel', start: `${n(Math.abs(initialDeficit))} Md€ ${initialDeficit < 0 ? 'd’excédent' : 'de déficit'}`,
    end: `${n(Math.abs(finalDeficit))} Md€ ${finalDeficit < 0 ? 'd’excédent' : 'de déficit'}`,
    change: `${signed(finalDeficit - initialDeficit)} Md€ de variation du déficit` });
  rows.push({ id: 'debt', label: 'Dette publique', start: `${n(initial.finance.debt)} Md€`, end: `${n(game.finance.debt)} Md€`, change: `${signed(game.finance.debt - initial.finance.debt)} Md€` });
  if (game.society && initial.society) {
    const labels: Record<keyof NonNullable<Game['society']>, string> = { workers: 'Salariés', pensioners: 'Retraités', vulnerable: 'Ménages modestes', businesses: 'Entreprises', newcomers: 'Nouveaux arrivants', publicStaff: 'Agents publics', affluent: 'Ménages aisés' };
    for (const key of Object.keys(labels) as Array<keyof typeof labels>) rows.push({ id: `society-${key}`, label: labels[key], start: Math.round(initial.society[key]), end: Math.round(game.society[key]), change: `${signed(game.society[key] - initial.society[key])} pts`, unit: '/100' });
  }
  return rows;
}

/** Picks only recorded causal events, anchored to their actual zero-based decision. */
export function narrativeTurningPoints(game: Game, limit = 3): CausalTurningPoint[] {
  const events = game.narrative?.events ?? [];
  const candidates = events.filter(event => Number.isInteger(event.causeTurn) && event.causeTurn >= 0 && event.causeTurn < game.history.length && Number.isFinite(event.weight))
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)
      || Number(b.kind === 'project' || b.kind === 'promise') - Number(a.kind === 'project' || a.kind === 'promise')
      || Number(b.weight < 0) - Number(a.weight < 0)
      || a.causeTurn - b.causeTurn || a.id.localeCompare(b.id));
  const seen = new Set<number>();
  return candidates.filter(event => { if (seen.has(event.causeTurn)) return false; seen.add(event.causeTurn); return true; }).slice(0, Math.max(0, limit))
    .map(event => {
      const turn = game.history[event.causeTurn]!;
      const actualState = focusForRecordedDecision(game, event.causeTurn);
      const dossier = domainFor(actualState).dossiers[actualState.turn];
      const actual = dossier?.choices.find(choice => choice.id === turn.choice);
      return { event, index: event.causeTurn, turn, decision: actual?.title ?? turn.title };
    }).sort((a, b) => a.index - b.index);
}

export function narrativePromiseCounts(game: Game) {
  const promises = game.narrative?.promises ?? [];
  return { active: promises.filter(item => item.status === 'active').length, kept: promises.filter(item => item.status === 'kept').length, broken: promises.filter(item => item.status === 'broken').length };
}

export type NarrativeOutcome = {
  context: string; dimensions: OutcomeDimension[]; promises: NarrativePromise[]; projects: NarrativeProject[];
  relationships: NarrativeRelationship[]; events: NarrativeEventRecord[]; nextYear: number | null;
};
const contexts = { coalition: 'Coalition fragile', hospital: 'Hôpital prioritaire', redress: 'Redressement' } as const;
export function narrativeOutcome(game: Game): NarrativeOutcome | null {
  if (game.version !== 11 || !game.narrative) return null;
  const finished = game.turn >= 30 || !!game.politics?.ending;
  return {
    context: contexts[game.narrative.context], dimensions: narrativeDimensions(game), promises: game.narrative.promises,
    projects: game.narrative.projects, relationships: game.narrative.relationships, events: game.narrative.events,
    nextYear: finished ? null : Math.min(5, Math.floor(game.turn / 6) + 1),
  };
}

/** A compact statement for explicitly fictional, deterministic electoral epilogues. */
export function simulatedElectionEpilogue(game: Game): { label: string; headline: string; basis: string[]; fictive: string } | null {
  if (game.version !== 11 || !game.narrative || game.turn !== 30 || game.politics?.ending && game.politics.ending.kind !== 'term_complete') return null;
  const outcome: NarrativeEpilogue | null = narrativeElectionOutcome(game);
  if (!outcome || outcome.kind === 'transition') return null;
  return { label: `${outcome.governmentSeats} sièges au gouvernement`, headline: outcome.title,
    basis: [outcome.detail, `Légitimité du scénario : ${outcome.legitimacy}/100`, `Confiance du scénario : ${Math.round(game.metrics.trust)}/100`, ...(outcome.character ? [`Personnage fictif suivi : ${outcome.character}`] : [])],
    fictive: `${outcome.headline} Épilogue calculé à partir de vos décisions.` };
}

export function fictionalPressHeadline(game: Game): string | null {
  if (game.version !== 11 || !game.narrative || !game.history.length) return null;
  const lastEvent = [...game.narrative.events].sort((a, b) => b.turn - a.turn)[0];
  if (lastEvent) return `Presse fictive · « ${lastEvent.title} »`;
  const last = game.history.at(-1)!;
  return `Presse fictive · « ${last.title} »`;
}

export function narrativeOutcomeMarkup(game: Game): string {
  const result = narrativeOutcome(game);
  if (!result) return '';
  const points = narrativeTurningPoints(game);
  const projectLabels = { funded: 'Financé', blocked: 'Bloqué', delivered: 'Livré', withdrawn: 'Abandonné' } as const;
  const promiseLabels = { active: 'En cours', kept: 'Tenue', broken: 'Rompue' } as const;
  const epilogue = simulatedElectionEpilogue(game);
  const headline = fictionalPressHeadline(game);
  const objectives = narrativeObjectives(game);
  const priority = result.dimensions.filter(row => ['balance', 'services', 'trust'].includes(row.id));
  const details = result.dimensions.filter(row => !['balance', 'services', 'trust'].includes(row.id));
  return `<section class="narrative-outcome" aria-labelledby="narrative-outcome-title"><p class="eyebrow">BILAN DE VOTRE MANDAT · ${e(result.context)}</p><h2 id="narrative-outcome-title">Ce que votre mandat a changé.</h2>
    <div class="narrative-outcome__dimensions">${priority.map(row => `<div><span>${e(row.label)}</span><strong>${e(String(row.start))} à ${e(String(row.end))}${row.unit && typeof row.start === 'number' ? ` ${e(row.unit)}` : ''}</strong><small>${e(row.change)}</small></div>`).join('')}</div>
    <div class="narrative-outcome__story"><section><h3>Promesses</h3>${result.promises.length ? `<ul>${result.promises.map((item: NarrativePromise) => `<li><strong>${e(promiseLabels[item.status])}</strong> · ${e(item.label)}</li>`).join('')}</ul>` : '<p>Aucune promesse enregistrée.</p>'}</section>
    <section><h3>Projets</h3>${result.projects.length ? `<ul>${result.projects.map((item: NarrativeProject) => `<li><strong>${e(projectLabels[item.status])}</strong> · ${e(item.label)} · ${e(NARRATIVE_PLACES.find(place => place.id === item.place)?.name ?? item.place)}${item.note ? ` (${e(item.note)})` : ''}</li>`).join('')}</ul>` : '<p>Aucun projet enregistré.</p>'}</section>
    <section><h3>Interlocuteurs fictifs</h3>${result.relationships.length ? `<ul>${result.relationships.map((person: NarrativeRelationship) => `<li><strong>${e(person.name)}</strong>, ${e(person.role)} · ${e(person.stance)} · loyauté ${Math.round(person.loyalty)}/100</li>`).join('')}</ul>` : '<p>Aucun interlocuteur enregistré.</p>'}</section></div>
    ${objectives.length ? `<section class="narrative-outcome__objectives"><h3>Défi du contexte</h3><ul>${objectives.map(objective => `<li><strong>${objective.complete ? 'Atteint' : 'À poursuivre'}</strong> · ${e(objective.label)} <small>${e(objective.progress)}</small></li>`).join('')}</ul></section>` : ''}
    <details class="narrative-outcome__details"><summary>Voir les autres dimensions du bilan</summary><div class="narrative-outcome__dimensions">${details.map(row => `<div><span>${e(row.label)}</span><strong>${e(String(row.start))} à ${e(String(row.end))}${row.unit && typeof row.start === 'number' ? ` ${e(row.unit)}` : ''}</strong><small>${e(row.change)}</small></div>`).join('')}</div></details>
    ${points.length ? `<section class="narrative-outcome__turning"><h3>Rejouer les décisions marquantes</h3><ol>${points.map(({ event, index, turn, decision }) => `<li><span>ANNÉE ${turn.year} · DÉCISION ${index + 1}</span><h4>${e(event.title)}</h4><p>${e(event.detail)}</p><small>Choix adopté : ${e(decision)}</small><button class="text-button" data-action="branch-replay" data-turn="${index}">Rejouer avant ce tournant</button></li>`).join('')}</ol></section>` : '<p>Aucune décision marquante enregistrée dans cette partie.</p>'}
    ${headline ? `<p class="narrative-outcome__press">${e(headline)} <small>Personnages et presse fictifs · état du scénario.</small></p>` : ''}
    ${epilogue ? `<section class="narrative-outcome__election"><p class="eyebrow">ÉPILOGUE ÉLECTORAL SIMULÉ</p><h3>${e(epilogue.headline)}</h3><strong>${e(epilogue.label)}</strong><ul>${epilogue.basis.map(item => `<li>${e(item)}</li>`).join('')}</ul><p>${e(epilogue.fictive)}</p></section>` : ''}
  </section>`;
}
