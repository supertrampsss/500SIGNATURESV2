import { calendarFor, domainFor, storyAgenda, storyPhase } from './engine.ts';
import { icon } from './icons.ts';
import { artForDossier } from './cinema-art.ts';
import { annualDeficit } from './national-deficit.ts';
import { NARRATIVE_FICTION_NOTE, NARRATIVE_PLACES } from './narrative-content.ts';
import type { Game } from './types.ts';
import type { NarrativeProject, NarrativeProjectStatus, NarrativePromise } from './narrative-types.ts';

const escape = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]!));

const placeName = (id: string): string => NARRATIVE_PLACES.find(place => place.id === id)?.name ?? id;

const PROJECT_STATUS: Record<NarrativeProjectStatus, string> = {
  funded: 'Financé', blocked: 'Bloqué', delivered: 'Livré', withdrawn: 'Abandonné',
};
const PROMISE_STATUS = { active: 'En cours', kept: 'Tenue', broken: 'Non tenue' } as const;
const CONTEXT_LABEL = { coalition: 'Coalition fragile', hospital: 'Hôpital prioritaire', redress: 'Redressement' } as const;
const ART_BY_KEY: Record<string, string> = {
  office: '/mandats/art/office.webp', school: '/mandats/art/school.webp', hospital: '/mandats/art/hospital.webp',
  nation: '/mandats/art/nation.webp', chapter: '/mandats/art/chapter.webp', legacy: '/mandats/art/legacy.webp',
  energy: '/mandats/art/energy.webp', parliament: '/mandats/art/parliament.webp', council: '/mandats/art/council.webp',
  rupture: '/mandats/art/rupture.webp',
};

function sceneKind(category: string, title: string, summary: string, art: string | undefined) {
  const text = `${category} ${title} ${summary}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
  if (/negociation|coalition|accord|amendement/.test(text)) return 'negotiation';
  if (/assemblee|parlement|scrutin|censure|gouvernement/.test(text)) return 'parliament';
  if (/crise|urgence|rupture/.test(text)) return 'crisis';
  if (/terrain|territoire|quartier|region|local/.test(text)) return 'terrain';
  if (art === 'parliament' || art === '/mandats/art/parliament.webp') return 'parliament';
  return 'dossier';
}

function sceneArt(game: Game, stage: 'agenda' | 'decision' | 'result') {
  const agenda = storyAgenda(game);
  const focus = game.narrative?.focus;
  const item = stage === 'result' ? undefined : agenda.find(entry => entry.id === focus) ?? agenda[0];
  const turn = Math.min(game.turn, Math.max(0, domainFor(game).dossiers.length - 1));
  const dossier = stage === 'result'
    ? game.history.at(-1)?.dossier ?? domainFor(game).dossiers[Math.max(0, turn - 1)]
    : domainFor(game).dossiers[turn];
  const category = stage === 'result' ? dossier?.category ?? item?.category ?? 'Chapitre' : item?.category ?? dossier?.category ?? 'Chapitre';
  const mapped = artForDossier(category, turn, domainFor(game).turns);
  const submittedArt = item?.art;
  const src = ART_BY_KEY[submittedArt ?? ''] ?? (Object.values(ART_BY_KEY).includes(submittedArt ?? '') ? submittedArt! : mapped.src);
  const sceneTitle = `${category} · ${CONTEXT_LABEL[game.narrative?.context ?? 'coalition']}`;
  const subject = stage === 'result' ? game.history.at(-1)?.title ?? dossier?.title ?? '' : item?.title ?? dossier?.title ?? '';
  const summary = stage === 'result' ? game.narrative?.lastConsequences.join(' ') ?? '' : item?.summary ?? dossier?.story ?? '';
  const kind = sceneKind(category, subject, summary, submittedArt);
  const normalizedSceneText = `${category} ${subject}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
  const sceneSrc = kind === 'negotiation' || kind === 'parliament' ? ART_BY_KEY.parliament
    : kind === 'crisis' ? (/energie|energet|industrie/.test(normalizedSceneText) ? ART_BY_KEY.energy : ART_BY_KEY.rupture)
    : kind === 'terrain' ? ART_BY_KEY.nation : src;
  const statusProject = [...(game.narrative?.projects ?? [])].reverse().find(project => project.status === 'delivered' || project.status === 'blocked' || project.status === 'funded' || project.status === 'withdrawn');
  return { src: sceneSrc, alt: mapped.alt, mood: mapped.mood, title: sceneTitle, category, kind, statusProject };
}

function projectLine(project: NarrativeProject) {
  const status = PROJECT_STATUS[project.status];
  const place = project.place ? ` · ${escape(placeName(project.place))}` : '';
  const note = project.note ? `<small>${escape(project.note)}</small>` : '';
  return `<li class="story-scene__project" data-project-status="${project.status}"><span class="story-scene__status">${escape(status)}</span><strong>${escape(project.label)}</strong><span class="story-scene__place">${place.replace(/^ · /, '')}</span>${note}</li>`;
}

function promiseLine(promise: NarrativePromise) {
  return `<li class="story-scene__promise" data-promise-status="${promise.status}"><span>${escape(PROMISE_STATUS[promise.status])}</span><strong>${escape(promise.label)}</strong></li>`;
}

function activity(game: Game) {
  const { promises = [], projects = [] } = game.narrative ?? {};
  const livePromises = promises.filter(promise => promise.status === 'active');
  const liveProjects = projects.filter(project => project.status === 'funded' || project.status === 'blocked');
  const delivered = projects.filter(project => project.status === 'delivered');
  const withdrawn = projects.filter(project => project.status === 'withdrawn');
  const recent = game.narrative?.events.slice(-2).reverse() ?? [];
  return `<section class="story-scene__section story-scene__activity" aria-labelledby="story-activity-heading">
    <h3 id="story-activity-heading">${icon('journal')} Activité du mandat</h3>
    <p>${game.turn} décision${game.turn > 1 ? 's' : ''} enregistrée${game.turn > 1 ? 's' : ''} · Année ${calendarFor(game).year} sur 5</p>
    ${recent.length ? `<ul class="story-scene__events">${recent.map(event => `<li><strong>${escape(event.title)}</strong><span>${escape(event.detail)}</span></li>`).join('')}</ul>` : '<p class="story-scene__quiet">Le mandat commence. Ses conséquences apparaîtront ici.</p>'}
  </section>
  <section class="story-scene__section story-scene__projects" aria-labelledby="story-projects-heading">
    <h3 id="story-projects-heading">Réalisations</h3>
    ${projects.length ? `<ul>${[...liveProjects, ...delivered, ...withdrawn].slice(-4).map(projectLine).join('')}</ul>` : '<p class="story-scene__quiet">Aucune réalisation inscrite pour le moment.</p>'}
  </section>
  <section class="story-scene__section story-scene__promises" aria-labelledby="story-promises-heading">
    <h3 id="story-promises-heading">Promesses</h3>
    ${promises.length ? `<ul>${promises.slice(-3).map(promiseLine).join('')}</ul>` : '<p class="story-scene__quiet">Aucune promesse de jeu à suivre.</p>'}
    ${livePromises.length ? `<span class="story-scene__count">${livePromises.length} engagement${livePromises.length > 1 ? 's' : ''} en cours</span>` : ''}
  </section>`;
}

function castAndPress(game: Game) {
  const relationships = game.narrative?.relationships.slice(-3) ?? [];
  const latest = game.narrative?.events.at(-1);
  return `<aside class="story-scene__rail" aria-label="Repères du scénario">
    <section class="story-scene__section story-scene__people" aria-labelledby="story-people-heading">
      <h3 id="story-people-heading">${icon('people')} Personnages fictifs</h3>
      ${relationships.length ? `<ul>${relationships.map(person => `<li><strong>${escape(person.name)}</strong><span>${escape(person.role)} · ${escape(person.stance)}</span></li>`).join('')}</ul>` : `<p class="story-scene__quiet">${escape(CONTEXT_LABEL[game.narrative?.context ?? 'coalition'])} · personnages du scénario à venir.</p>`}
    </section>
    <section class="story-scene__section story-scene__press" aria-labelledby="story-press-heading">
      <h3 id="story-press-heading">${icon('journal')} Presse fictive</h3>
      ${latest ? `<p class="story-scene__press-label">Scénario simulé · Année ${Math.max(1, Math.min(5, Math.floor(latest.turn / 6) + 1))}</p><strong>${escape(latest.title)}</strong><p>${escape(latest.detail)}</p>` : '<p class="story-scene__quiet">Les brèves fictives suivront les événements de votre partie.</p>'}
    </section>
  </aside>`;
}

function sceneDetails(game: Game) {
  const projects = game.narrative?.projects ?? [];
  const promises = game.narrative?.promises ?? [];
  const summary = projects.length || promises.length
    ? `Repères · ${projects.length} réalisation${projects.length === 1 ? '' : 's'} · ${promises.length} promesse${promises.length === 1 ? '' : 's'}`
    : 'Suivre mon mandat';
  return `<details class="story-scene__details">
    <summary>${escape(summary)}</summary>
    <div class="story-scene__details-grid"><div class="story-scene__main">${activity(game)}</div>${castAndPress(game)}</div>
    <p class="story-scene__fiction-note">${escape(NARRATIVE_FICTION_NOTE)}</p>
  </details>`;
}

function sceneMetrics(game: Game) {
  const balance = annualDeficit(game);
  const balanceLabel = balance < 0 ? 'Excédent annuel' : balance > 0 ? 'Déficit annuel' : 'Équilibre annuel';
  const balanceValue = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Math.abs(balance));
  const coalitionSeats = game.narrative?.context === 'coalition' && game.politics
    ? game.politics.blocs.filter(bloc => bloc.inGovernment).reduce((sum, bloc) => sum + bloc.seats, 0)
    : null;
  const finalMetric = coalitionSeats === null
    ? { label: 'Confiance', value: `${Math.round(game.metrics.trust)}`, unit: '/100' }
    : { label: 'Appui parlementaire', value: `${coalitionSeats}`, unit: '/577 sièges' };
  return `<dl class="story-scene__metrics" aria-label="Repères chiffrés du scénario">
    <div class="story-scene__metric story-scene__metric--balance" aria-label="${escape(balanceLabel)} : ${escape(balanceValue)} milliards d’euros, un solde négatif correspond à un excédent et zéro à l’équilibre"><dt>${escape(balanceLabel)}</dt><dd>${escape(balanceValue)}<small>Md€</small></dd></div>
    <div class="story-scene__metric"><dt>Services</dt><dd>${Math.round(game.metrics.services)}<small>/100</small></dd></div>
    <div class="story-scene__metric"><dt>${escape(finalMetric.label)}</dt><dd>${escape(finalMetric.value)}<small>${escape(finalMetric.unit)}</small></dd></div>
  </dl>`;
}

/** Consequence strip for the pause between a resolved dossier and the next one. */
export function renderStoryOutcome(game: Game): string {
  if (game.version !== 11 || !game.narrative) return '';
  const consequences = game.narrative.lastConsequences;
  const latest = game.narrative.events.at(-1);
  const currentProjects = game.narrative.projects.filter(project => project.causeTurn === game.turn - 1 || project.startedTurn === game.turn - 1 || project.resolvedTurn === game.turn - 1);
  const projects = currentProjects.slice(-2).map(project => `<li data-project-status="${project.status}"><span>${escape(PROJECT_STATUS[project.status])}</span><strong>${escape(project.label)}</strong>${project.place ? `<small>${escape(placeName(project.place))}</small>` : ''}</li>`).join('');
  return `<section class="story-outcome" aria-label="Conséquences simulées">
    <div class="story-outcome__copy"><p class="story-outcome__label">${icon('check')} Effets inscrits dans le scénario</p>
      ${consequences.length ? `<ul>${consequences.map(item => `<li>${escape(item)}</li>`).join('')}</ul>` : `<p>${escape(latest?.detail ?? 'La décision est inscrite dans la trajectoire du scénario.')}</p>`}
    </div>${projects ? `<ul class="story-outcome__projects" aria-label="État des réalisations">${projects}</ul>` : ''}
  </section>`;
}

/** A compact, state-grounded scene that can precede agenda, decision, or result content. */
export function renderStoryScene(game: Game, requestedStage?: 'agenda' | 'decision' | 'result'): string {
  if (game.version < 11 || game.mode !== 'national' || !game.narrative) return '';
  const phase = storyPhase(game);
  const stage = requestedStage ?? (phase === 'agenda' ? 'agenda' : 'decision');
  const scene = sceneArt(game, stage);
  const leadConsequence = stage !== 'agenda' && game.turn > 0 ? game.narrative.lastConsequences.at(-1) : undefined;
  return `<section class="story-scene" data-stage="${stage}" data-scene-kind="${scene.kind}" aria-label="Scène du mandat national">
    <figure class="story-scene__visual" data-mood="${escape(scene.mood)}">
      <img class="story-scene__image" src="${escape(scene.src)}" alt="${escape(scene.alt)}" decoding="async" fetchpriority="high" draggable="false">
      <figcaption class="story-scene__caption"><span>${escape(scene.title)}</span><small class="story-scene__fiction-label">Scénario politique · fictif</small></figcaption>
      ${scene.statusProject ? `<span class="story-scene__stamp" data-project-status="${scene.statusProject.status}" aria-label="Réalisation ${escape(PROJECT_STATUS[scene.statusProject.status])} dans le scénario"><small>${escape(PROJECT_STATUS[scene.statusProject.status])} · scénario</small><strong>${escape(scene.statusProject.label)}</strong></span>` : ''}
    </figure>
    <div class="story-scene__body">
      ${sceneMetrics(game)}
      ${leadConsequence ? `<p class="story-scene__lead" aria-label="Conséquence la plus récente" title="${escape(leadConsequence)}">${icon('check')}<span>${escape(leadConsequence)}</span></p>` : ''}
      ${sceneDetails(game)}
    </div>
  </section>`;
}
