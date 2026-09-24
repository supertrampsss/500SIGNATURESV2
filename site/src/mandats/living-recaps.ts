import { annualDeficit } from './national-deficit.ts';
import { calendarFor, domainFor, startingGame } from './engine.ts';
import { escape as e } from './sharing.ts';
import type { Game, Metrics, Turn } from './types.ts';

const fmt = (value: number, digits = 1) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(value);
const delta = (value: number, digits = 1) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${fmt(Math.abs(value), digits)}`;
const chapters = ['Prise de fonctions', 'Premières conséquences', 'Le point de bascule', 'Les choix qui engagent', 'L’héritage'];
const closedAt = (g: Game, year: number) => [...g.history].reverse().find(turn => turn.closed && turn.year === year);
// annualDeficit is positive when spending exceeds revenue; a negative value is a surplus.
const balance = (value: number) => `${value < 0 ? 'Excédent' : 'Déficit'} ${fmt(Math.abs(value))} Md€`;
type Snapshot = { finance: Game['finance']; metrics: Metrics };

function changes(before: Snapshot, after: Snapshot, deficitBefore: number, deficitAfter: number) {
  const rows = [
    ['Solde annuel', balance(deficitBefore), balance(deficitAfter), `${delta(deficitAfter - deficitBefore)} Md€ de variation du déficit`],
    ['Dette publique', `${fmt(before.finance.debt)} Md€`, `${fmt(after.finance.debt)} Md€`, `${delta(after.finance.debt - before.finance.debt)} Md€`],
    ['PIB nominal', `${fmt(before.finance.gdp)} Md€`, `${fmt(after.finance.gdp)} Md€`, `${delta(after.finance.gdp - before.finance.gdp)} Md€`],
    ...(['services', 'trust', 'cohesion', 'resilience'] as const).map((key, index) => [
      ['Services', 'Confiance', 'Cohésion', 'Résilience'][index],
      `${Math.round(before.metrics[key])}/100`, `${Math.round(after.metrics[key])}/100`, `${delta(after.metrics[key] - before.metrics[key])} pts`,
    ]),
  ];
  return `<div class="living-country-grid" aria-label="Évolution des comptes et indicateurs">${rows.map(([label, from, to, change]) => `<div><span>${label}</span><strong>${from} → ${to}</strong><small>${change}</small></div>`).join('')}</div>`;
}
function yearEssentials(before: Snapshot, after: Snapshot, deficitBefore: number, deficitAfter: number) {
  const sameSide = (deficitBefore < 0) === (deficitAfter < 0);
  const financeLabel = sameSide ? deficitAfter < 0 ? 'Excédent' : 'Déficit' : 'Solde annuel';
  const financeValues = sameSide ? `${fmt(Math.abs(deficitBefore))} → ${fmt(Math.abs(deficitAfter))}` : `${balance(deficitBefore)} → ${balance(deficitAfter)}`;
  return `<div class="living-essentials">
    <div><span>${financeLabel}</span><strong>${financeValues}</strong><small>Md€ · ${delta(deficitAfter - deficitBefore)} Md€</small></div>
    <div><span>Services publics</span><strong>${Math.round(before.metrics.services)} → ${Math.round(after.metrics.services)}</strong><small>sur 100 · ${delta(after.metrics.services - before.metrics.services)} pts</small></div>
    <div><span>Confiance</span><strong>${Math.round(before.metrics.trust)} → ${Math.round(after.metrics.trust)}</strong><small>sur 100 · ${delta(after.metrics.trust - before.metrics.trust)} pts</small></div>
  </div>`;
}
function recapProgress(year: number, completedYears: number) {
  return `<ol class="living-recap__chapters" aria-label="Avancement du mandat, ${completedYears} année${completedYears > 1 ? 's' : ''} terminée${completedYears > 1 ? 's' : ''}">${chapters.map((chapter, index) => {
    const state = index < year ? 'is-done' : index === year ? 'is-next' : '';
    return `<li class="${state}" title="${e(chapter)}"><b>${index < year ? '✓' : index + 1}</b><small>A${index + 1}</small></li>`;
  }).join('')}</ol>`;
}
export function livingYearRecap(g: Game): string {
  const last = g.history.at(-1);
  if (!last?.closed) return '';
  const year = last.year;
  const initial = startingGame(g);
  const previous = closedAt(g, year - 1);
  const before: Snapshot = previous
    ? { finance: { ...initial.finance, debt: previous.ledger.debt, gdp: previous.ledger.gdp }, metrics: previous.metrics }
    : { finance: initial.finance, metrics: initial.metrics };
  const after: Snapshot = { finance: g.finance, metrics: g.metrics };
  const previousDeficit = previous?.ledger.deficit ?? annualDeficit(initial);
  const decisions = g.history.filter(turn => turn.year === year);
  const crises = decisions.filter(turn => /^k\d+[abc]$/.test(turn.choice)).length;
  const progress = calendarFor(g);
  const accomplishments = decisions.map(turn => e(turn.title)).join(' · ');

  return `<article class="year-recap living-recap living-recap--year v9-chapter-${year}">
    <header class="living-recap__hero">
      <div class="living-recap__brand"><strong>500</strong><span>Signatures</span><small>MANDATS</small></div>
      <p class="eyebrow">ANNÉE ${year} ACHEVÉE</p>
      <h1 tabindex="-1">Une année<br>de décisions.</h1>
      <p>${e(chapters[year - 1] ?? `Année ${year}`)} · ${decisions.length} décisions prises.</p>
      <span class="living-recap__seal" aria-label="Année ${year} sur 5"><strong>${year}</strong><span>/ 5</span></span>
      <div class="living-recap__diorama"><img src="/mandats/art/legacy.webp" alt="La France en miniature au coucher du soleil, sur les cinq pages du mandat"></div>
    </header>
    <section class="living-recap__changes">
      <p class="eyebrow">LES EFFETS DE L’ANNÉE</p>
      ${yearEssentials(before, after, previousDeficit, last.ledger.deficit)}
    </section>
    ${recapProgress(year, progress.completedYears)}
    <button class="button primary" data-action="${year < 5 ? 'next-year' : 'show-result'}">${year < 5 ? `Entrer dans l’année ${year + 1}` : 'Explorer mon bilan'}</button>
    <details class="living-details"><summary>Voir la dette, le PIB et les autres indicateurs</summary>${changes(before, after, previousDeficit, last.ledger.deficit)}</details>
    <details class="living-recap__accomplished"><summary>CE QUE VOUS AVEZ ACCOMPLI · ${decisions.length} décisions inscrites · ${crises} crise${crises === 1 ? '' : 's'} · ${g.pending.length} effet${g.pending.length === 1 ? '' : 's'} en attente</summary><p>${accomplishments}</p><span class="living-recap__scenario">Scénario #${g.seed}</span></details>
  </article>`;
}

/** Annual entry surface; used by render.ts after the recap advances to a new year. */
export function livingYearBriefing(g: Game): string {
  const calendar = calendarFor(g);
  const year = calendar.year;
  const dossier = domainFor(g).dossiers[g.turn];
  const deficit = annualDeficit(g);
  const debtRatio = g.finance.gdp ? g.finance.debt / g.finance.gdp * 100 : 0;
  const due = g.pending.filter(item => item.due === year - 1);
  return `<article class="living-briefing v9-chapter-${year}">
    <header class="living-briefing__hero"><p class="eyebrow">ANNÉE ${year} SUR 5</p><h1 tabindex="-1">${e(chapters[year - 1] ?? `Année ${year}`)}</h1><p>Les décisions prennent forme.</p></header>
    <section class="living-briefing__scene"><div class="living-briefing__miniature" role="img" aria-label="Paysage miniature de la France"></div><div class="living-briefing__paper"><p class="eyebrow">LE CHAPITRE QUI S’OUVRE</p><h2>${e(dossier?.title ?? 'Le prochain dossier vous attend.')}</h2><p>${e(dossier?.story ?? 'Vos décisions précédentes continuent d’agir sur le scénario.')}</p></div></section>
    <section class="living-briefing__state" aria-label="État du pays"><div><span>Déficit annuel</span><strong>${balance(deficit)}</strong></div><div><span>Dette / PIB</span><strong>${fmt(debtRatio)} %</strong></div><div><span>Services</span><strong>${Math.round(g.metrics.services)}/100</strong></div><div><span>Confiance</span><strong>${Math.round(g.metrics.trust)}/100</strong></div></section>
    ${due.length ? `<p class="living-briefing__due"><strong>Effets qui arrivent cette année :</strong> ${due.slice(0, 3).map(item => e(item.label)).join(' · ')}</p>` : ''}
    ${year >= 3 ? '<p class="living-briefing__warning">Certaines tensions accumulées peuvent déclencher un dossier de crise.</p>' : ''}
    <button class="button primary" data-action="start-year">Commencer l’année ${year}</button>
  </article>`;
}

type TurningPoint = { turn: Turn; index: number; effects: string; weight: number };
function turningPoints(g: Game) {
  const dossiers = domainFor(g).dossiers;
  const points: TurningPoint[] = [];
  g.history.forEach((turn, index) => {
    const choice = dossiers.flatMap(dossier => dossier.choices).find(item => item.id === turn.choice);
    if (!choice) return;
    const effect = choice.effect;
    const effects = [
      effect.services && `services ${delta(effect.services)} pts`, effect.trust && `confiance ${delta(effect.trust)} pts`,
      effect.cohesion && `cohésion ${delta(effect.cohesion)} pts`, effect.resilience && `résilience ${delta(effect.resilience)} pts`,
      effect.assets && `patrimoine ${delta(effect.assets)} pts`, effect.revenue && `recettes ${delta(effect.revenue)} Md€/an`,
      effect.operating && `charges ${delta(effect.operating)} Md€/an`, choice.delayed && `effet différé : ${choice.delayed.label}`,
    ].filter(Boolean).join(' · ');
    const weight = Math.abs(effect.revenue ?? 0) * 4 + Math.abs(effect.operating ?? 0) * 4 + Math.abs(effect.investment ?? 0) * 4 + Math.abs(effect.grants ?? 0) * 4
      + Math.abs(effect.services ?? 0) + Math.abs(effect.trust ?? 0) + Math.abs(effect.cohesion ?? 0) + Math.abs(effect.resilience ?? 0) + Math.abs(effect.assets ?? 0)
      + (choice.delayed ? Math.abs(choice.delayed.effect.operating ?? 0) * 4 + Math.abs(choice.delayed.effect.revenue ?? 0) * 4 + 3 : 0);
    points.push({ turn, index, effects, weight });
  });
  const selected = points.sort((a, b) => b.weight - a.weight).slice(0, 3).sort((a, b) => a.index - b.index);
  return selected.length ? `<ol class="living-turning-points">${selected.map(({ turn, index, effects }) => `<li>
    <span class="living-turning-points__year">ANNÉE ${turn.year} · DÉCISION ${index + 1}</span><h3>${e(turn.title)}</h3>
    ${effects ? `<p>${e(effects)}</p>` : ''}<button class="text-button" data-action="branch-replay" data-turn="${index}">Rejouer avant cette décision</button>
  </li>`).join('')}</ol>` : '<p>Les décisions du mandat sont conservées dans le journal.</p>';
}
function essentialResult(g: Game, start: Game, deficitStart: number, deficitEnd: number) {
  return `<div class="living-result__essentials" aria-label="Trois repères de fin de mandat">
    <div><span>Solde annuel</span><strong>${balance(deficitEnd)}</strong><small>Départ : ${balance(deficitStart)} · ${delta(deficitEnd - deficitStart)} Md€</small></div>
    <div><span>Services publics</span><strong>${Math.round(g.metrics.services)}/100</strong><small>Départ : ${Math.round(start.metrics.services)}/100 · ${delta(g.metrics.services - start.metrics.services)} pts</small></div>
    <div><span>Confiance</span><strong>${Math.round(g.metrics.trust)}/100</strong><small>Départ : ${Math.round(start.metrics.trust)}/100 · ${delta(g.metrics.trust - start.metrics.trust)} pts</small></div>
  </div>`;
}
function profileDetails(g: Game) {
  if (!g.society) return '';
  const labels = { workers: 'Salariés', pensioners: 'Retraités', vulnerable: 'Ménages modestes', businesses: 'Entreprises', newcomers: 'Nouveaux arrivants', publicStaff: 'Agents publics', affluent: 'Ménages aisés' };
  return `<details class="living-result__profiles"><summary>Voir les indices par profil</summary><div>${Object.entries(labels).map(([key, label]) => `<span>${label}<strong>${Math.round(g.society![key as keyof typeof labels])}/100</strong></span>`).join('')}</div></details>`;
}
export function livingResult(g: Game, shared = false): string {
  const start = startingGame(g);
  const deficitStart = annualDeficit(start);
  const deficitEnd = g.history.at(-1)?.ledger.deficit ?? annualDeficit(g);
  const actions = `<div class="result-actions living-result__actions">
    <button class="button primary" data-action="open-replay-selection">Et si j’avais choisi autrement ?</button>
    <button class="button" data-action="share">Partager mon héritage</button>
  </div>`;
  const moreActions = `<div class="result-actions living-result__more-actions">
    <button class="button" data-action="replay">Rejouer exactement ce défi</button>
    <button class="button" data-action="open-plan">Comparer une autre stratégie</button>
    <button class="button" data-action="new-run">Nouveau mandat</button>
  </div>`;

  return `<article class="result v9-result living-result">
    <header class="living-result__hero">
      <div class="living-recap__brand"><strong>500</strong><span>Signatures</span><small>MANDATS</small></div>
      <p class="eyebrow">${shared ? 'HÉRITAGE PARTAGÉ' : 'VOTRE MANDAT EST TERMINÉ'}</p>
      <h1 tabindex="-1">Vous avez changé<br>le paysage.</h1>
      <p>Votre cap : <strong>${e(({ equilibre: 'Rééquilibrer les comptes', services: 'Préserver les services publics', resilience: 'Renforcer la résilience' } as const)[g.ambition ?? 'equilibre'])}</strong>.</p>
      <div class="living-result__stamp"><strong>5 ans</strong><span>30 décisions</span></div>
      <div class="living-result__diorama"><img src="/mandats/art/legacy.webp" alt="Panorama miniature de la France sur les pages d’un livre ouvert"></div>
    </header>
    ${actions}
    <section class="living-result__comparison">
      <p class="eyebrow">DU POINT DE DÉPART À L’HÉRITAGE</p>
      <h2>Trois repères pour lire la trajectoire.</h2>
      ${essentialResult(g, start, deficitStart, deficitEnd)}
      <details class="living-details"><summary>Voir les comptes et les indicateurs détaillés</summary>
        <p>Montants en Md€ et indicateurs sur 100.</p>
        ${changes({ finance: start.finance, metrics: start.metrics }, { finance: g.finance, metrics: g.metrics }, deficitStart, deficitEnd)}
      </details>
      ${profileDetails(g)}
    </section>
    ${recapProgress(5, 5)}
    <details class="living-result__turning"><summary>TROIS DÉCISIONS À REJOUER</summary>${turningPoints(g)}</details>
    <section class="living-result__tension"><p class="eyebrow">CE QUI RESTE À SUIVRE</p><h2>Les engagements transmis</h2>${g.pending.length
      ? `<ul>${g.pending.map(item => `<li><strong>Échéance année ${item.due + 1}</strong> · ${e(item.label)}</li>`).join('')}</ul>`
      : '<p>Aucun effet différé en attente à la clôture. Services, confiance, cohésion et résilience restent des enjeux distincts.</p>'}</section>
    ${moreActions}
    <p class="living-result__scope">Simulation · scénario #${g.seed} · version ${g.version}.</p>
    <details class="living-result__journal"><summary>Journal du mandat · ${g.history.length} décisions</summary><ol>${g.history.map(turn => `<li><span>Année ${turn.year}</span><strong>${e(turn.title)}</strong>${turn.closed ? `<small>${e(turn.event)}</small>` : ''}</li>`).join('')}</ol></details>
  </article>`;
}
