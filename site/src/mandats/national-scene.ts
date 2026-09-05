import { sceneMarkup, mountScene } from './winter/scene.ts';
import { domainFor } from './engine.ts';
import { nationalSceneState } from './national-scene-state.ts';
import type { WorldOptions } from './world.ts';
import type { Game } from './types.ts';
import { escape as e } from './sharing.ts';

export function nationalScene(g: Game, opts: WorldOptions = {}): string {
  const state = nationalSceneState(g, !!opts.inherited);
  const pending = state.projects.filter(p => p.state === 'planned').length;
  const delivered = state.projects.filter(p => p.state === 'delivered').length;
  const topic = domainFor(g).dossiers[g.turn]?.category ?? 'Votre héritage';
  return `<section class="national-world" aria-label="La France au quotidien, scène illustrative du mandat"><div class="national-stage" data-national-scene data-state="fallback" data-focus="${state.focus}" data-year="${state.year}" data-turn="${state.turn}" data-planned="${pending}" data-delivered="${delivered}"><picture class="national-scene-poster"><source media="(max-width: 700px)" srcset="/mandats/art/winter-quarter-small.webp"><img src="/mandats/art/winter-quarter.webp" width="1536" height="1024" alt="Un quartier français illustré, avec des logements, des ateliers et un canal." decoding="async" fetchpriority="high"></picture><div class="national-scene-label"><span>La France au quotidien</span><small>${opts.inherited ? 'Au début du mandat' : e(topic)}</small></div><span class="national-model-label">Décor illustratif</span></div><div class="national-world-controls"><span>${pending || delivered ? `${pending} en cours · ${delivered} livrés` : state.turn === 0 ? 'Votre mandat commence' : 'Aucun nouveau projet financé'}</span><button class="text-button" data-action="world-view" aria-pressed="${!!opts.inherited}">${opts.inherited ? 'Voir maintenant' : 'Avant / maintenant'}</button></div><nav class="national-areas" aria-label="Profils du territoire">${state.areas.map(a => `<button data-action="area" data-area="${e(a.id)}">${e(g.areas.find(v => v.id === a.id)!.name)}</button>`).join('')}</nav><p class="national-world-note">Les bâtiments illustrent les investissements du jeu, pas des chantiers réels.</p></section>`;
}

type Controller = ReturnType<typeof mountScene>;
let controller: Controller | undefined;
let scene: HTMLElement | undefined;
let current: { root: HTMLElement; game: Game | null; opts: WorldOptions } | undefined;
let resizeTimer: ReturnType<typeof setTimeout> | undefined;

function dispose(): void {
  controller?.dispose();
  controller = undefined;
  scene?.remove();
  scene = undefined;
}

function mount(): void {
  controller?.setPaused(true);
  const context = current;
  if (!context || context.game?.mode !== 'national') { dispose(); return; }
  const host = [...context.root.querySelectorAll<HTMLElement>('[data-national-scene]')].find(el => el.getBoundingClientRect().width > 0);
  if (!host) return;
  try {
    if (!scene || !controller) {
      scene = document.createElement('div');
      scene.className = 'national-living-scene';
      scene.innerHTML = sceneMarkup();
      host.prepend(scene);
      controller = mountScene(scene);
    } else {
      // Move the same scene between render hosts. People keep walking and no
      // image or SVG is rebuilt when a decision replaces the surrounding UI.
      host.prepend(scene);
    }
    const state = nationalSceneState(context.game, !!context.opts.inherited);
    controller.update(state.visual);
    controller.setPaused(!!context.opts.light);
    host.querySelector('.national-scene-poster')?.remove();
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

export function syncNationalScene(root: HTMLElement, game: Game | null, opts: WorldOptions): void {
  current = { root, game, opts };
  mount();
}
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => mount(), 150); });
  window.addEventListener('pagehide', dispose);
  window.addEventListener('pageshow', () => { if (current) mount(); });
}
