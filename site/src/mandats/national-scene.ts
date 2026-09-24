import { domainFor } from './engine.ts';
import { nationalSceneState } from './national-scene-state.ts';
import type { WorldOptions } from './world.ts';
import type { Game } from './types.ts';
import { escape as e } from './sharing.ts';
import { countryFeedback } from './country-feedback.ts';
import { artForGame, cinemaSceneMarkup } from './cinema-art.ts';

export function nationalScene(g: Game, opts: WorldOptions = {}): string {
  const state = nationalSceneState(g, !!opts.inherited);
  const pending = state.projects.filter(p => p.state === 'planned').length;
  const delivered = state.projects.filter(p => p.state === 'delivered').length;
  const topic = domainFor(g).dossiers[g.turn]?.category ?? 'Votre héritage';
  const art = artForGame(g, !!opts.inherited);
  const feedback = countryFeedback(g, state);
  return `<section class="national-world" aria-label="Scène des effets du mandat national"><div class="national-stage" data-national-scene data-art-src="${e(art.src)}" data-state="fallback" data-focus="${state.focus}" data-year="${state.year}" data-turn="${state.turn}" data-planned="${pending}" data-delivered="${delivered}">${cinemaSceneMarkup(art)}<div class="national-scene-label"><span>Effets territoriaux du mandat</span><small>${opts.inherited ? 'Au début du mandat' : e(topic)}</small></div><aside class="country-feedback" data-country-feedback aria-live="polite" aria-atomic="true"><strong data-feedback-title>${e(feedback.title)}</strong><span data-feedback-copy>${e(feedback.copy)}</span><div class="country-progress" data-feedback-progress role="group" aria-label="Avancement des projets financés"><span data-feedback-progress-label>${e(feedback.progress)}</span><span class="country-progress-track"><span data-feedback-progress-bar style="width:${feedback.progressPercent}%"></span></span></div></aside><span class="national-model-label">${opts.inherited || !state.turn ? 'Votre mandat commence' : `Décision ${state.turn} appliquée`}</span></div><div class="national-world-controls"><span>${pending || delivered ? `${pending} en cours · ${delivered} livrés` : state.turn === 0 ? 'Votre mandat commence' : 'Aucun nouveau projet financé'}</span><button class="text-button" data-action="world-view" aria-pressed="${!!opts.inherited}">${opts.inherited ? 'Voir maintenant' : 'Avant / maintenant'}</button></div><nav class="national-areas" aria-label="Profils du territoire">${state.areas.map(a => `<button data-action="area" data-area="${e(a.id)}">${e(g.areas.find(v => v.id === a.id)!.name)}</button>`).join('')}</nav><p class="national-world-note">${pending || delivered ? `${pending} en cours · ${delivered} projets livrés.` : 'Les profils territoriaux et projets financés sont suivis au fil du mandat.'}</p></section>`;
}

type Controller = ReturnType<typeof mountCinemaScene>;
let controller: Controller | undefined;
let scene: HTMLElement | undefined;
let current: { root: HTMLElement; game: Game | null; opts: WorldOptions } | undefined;
let resizeTimer: ReturnType<typeof setTimeout> | undefined;

function dispose(): void {
  controller?.dispose();
  controller = undefined;
  scene = undefined;
}

function mountCinemaScene(host: HTMLElement) {
  const stage = host.querySelector<HTMLElement>('[data-cinema-scene]');
  const image = host.querySelector<HTMLImageElement>('[data-cinema-art]');
  if (!stage || !image) throw new Error('Cinema scene must be rendered before mounting.');
  const sceneHost = host;
  const sceneStage = stage;
  const sceneImage = image;
  let activeTurn = Number(sceneHost.dataset.turn) || 0;
  function update(visual: ReturnType<typeof nationalSceneState>['visual'], art: ReturnType<typeof artForGame>): void {
    if (sceneImage.getAttribute('src') !== art.src) {
      sceneImage.src = art.src;
      sceneHost.dataset.artSrc = art.src;
      sceneStage.setAttribute('aria-label', art.alt);
      sceneStage.classList.remove('cinema-scene--changing');
      void sceneStage.offsetWidth;
      sceneStage.classList.add('cinema-scene--changing');
    }
    sceneStage.dataset.mood = art.mood;
    sceneStage.dataset.focus = visual.focus;
    sceneStage.dataset.tone = visual.tone;
    sceneStage.dataset.turn = String(visual.turn);
    sceneStage.dataset.warmth = String(visual.warmth);
    sceneStage.dataset.activity = String(visual.activity);
    sceneStage.dataset.construction = String(visual.construction);
    if (visual.turn > activeTurn) sceneStage.classList.add('cinema-scene--decision');
    activeTurn = visual.turn;
  }
  return { update, setPaused(value: boolean) { sceneStage.dataset.light = String(value); }, dispose() { sceneStage.classList.remove('cinema-scene--decision', 'cinema-scene--changing'); } };
}

function mount(): void {
  controller?.setPaused(true);
  const context = current;
  if (!context || context.game?.mode !== 'national') { dispose(); return; }
  const host = [...context.root.querySelectorAll<HTMLElement>('[data-national-scene]')].find(el => el.getBoundingClientRect().width > 0);
  if (!host) return;
  try {
    if (!controller || scene !== host) {
      controller?.dispose();
      scene = host;
      controller = mountCinemaScene(host);
    }
    const state = nationalSceneState(context.game, !!context.opts.inherited);
    updateCountryFeedback(host, countryFeedback(context.game, state));
    const art = artForGame(context.game, !!context.opts.inherited);
    controller.update(state.visual, art);
    controller.setPaused(!!context.opts.light);
    host.dataset.state = 'ready';
    host.dataset.light = String(!!context.opts.light);
    host.dataset.focus = state.focus;
    host.dataset.year = String(state.year);
    host.dataset.turn = String(state.turn);
    host.dataset.planned = String(state.projects.filter(p => p.state === 'planned').length);
    host.dataset.delivered = String(state.projects.filter(p => p.state === 'delivered').length);
  } catch {
    // Keep the readable picture and all game controls if enhancement fails.
    host.dataset.state = 'fallback';
    dispose();
  }
}

function updateCountryFeedback(host: HTMLElement, feedback: ReturnType<typeof countryFeedback>): void {
  const title = host.querySelector<HTMLElement>('[data-feedback-title]');
  const copy = host.querySelector<HTMLElement>('[data-feedback-copy]');
  const progress = host.querySelector<HTMLElement>('[data-feedback-progress-label]');
  const bar = host.querySelector<HTMLElement>('[data-feedback-progress-bar]');
  const panel = host.querySelector<HTMLElement>('[data-country-feedback]');
  if (!title || !copy || !progress || !bar || !panel) return;
  title.textContent = feedback.title;
  copy.textContent = feedback.copy;
  progress.textContent = feedback.progress;
  bar.style.width = `${feedback.progressPercent}%`;
  panel.dataset.focus = feedback.focus;
}

export function syncNationalScene(root: HTMLElement, game: Game | null, opts: WorldOptions): void {
  current = { root, game, opts };
  mount();
}
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => mount(), 150); });
  window.addEventListener('pagehide', dispose);
  window.addEventListener('pageshow', () => { if (current) mount(); });
}
