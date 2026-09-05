import { nationalSceneState } from './national-scene-state.ts';
import { worldArt } from './world.ts';
import type { WorldOptions } from './world.ts';
import type { Game } from './types.ts';
import { escape as e } from './sharing.ts';
export function nationalScene(g: Game, opts: WorldOptions = {}): string {
  const state = nationalSceneState(g, !!opts.inherited);
  const pending = state.projects.filter(p => p.state === 'planned').length;
  const delivered = state.projects.filter(p => p.state === 'delivered').length;
  return `<section class="national-world" aria-label="Maquette de la France, simulation"><div class="national-stage" data-national-scene data-state="fallback">${worldArt('national')}<div class="national-scene-label"><span>FRANCE</span><small>${opts.inherited ? 'Au début du mandat' : `Année ${state.year}`}</small></div><span class="national-model-label">Maquette fictive</span></div><div class="national-world-controls"><span>${pending || delivered ? `${pending} en cours · ${delivered} livrés` : state.turn === 0 ? 'Votre mandat commence' : 'Aucun nouveau projet financé'}</span><button class="text-button" data-action="world-view" aria-pressed="${!!opts.inherited}">${opts.inherited ? 'Voir maintenant' : 'Avant / maintenant'}</button></div><nav class="national-areas" aria-label="Profils du territoire">${state.areas.map(a => `<button data-action="area" data-area="${e(a.id)}">${e(g.areas.find(v => v.id === a.id)!.name)}</button>`).join('')}</nav><p class="national-world-note">Les bâtiments illustrent le jeu, pas des chantiers réels.</p></section>`;
}
type Controller = ReturnType<typeof import('./national-scene-renderer.ts')['createNationalRenderer']>;
let controller: Controller | undefined;
let loading: Promise<typeof import('./national-scene-renderer.ts')> | undefined;
let generation = 0;
let unavailable = false;
let current: { root: HTMLElement; game: Game | null; opts: WorldOptions } | undefined;
let resizeTimer: ReturnType<typeof setTimeout> | undefined;
const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
async function mount(): Promise<void> {
  const request = ++generation;
  controller?.suspend();
  const context = current;
  if (!context || context.game?.mode !== 'national') { controller?.dispose(); controller = undefined; return; }
  if (unavailable || context.opts.light) return;
  const host = [...context.root.querySelectorAll<HTMLElement>('[data-national-scene]')].find(el => el.getBoundingClientRect().width > 0);
  if (!host) return;
  try {
    loading ??= import('./national-scene-renderer.ts');
    const renderer = await loading;
    if (request !== generation || !host.isConnected) return;
    controller ??= renderer.createNationalRenderer(host);
    controller.attach(host, nationalSceneState(context.game, !!context.opts.inherited, !!motion?.matches));
    if (host.querySelector('canvas') && host.dataset.state !== 'unavailable') host.dataset.state = 'ready';
  } catch {
    unavailable = true;
    loading = undefined;
    host.dataset.state = 'fallback';
    controller?.dispose(); controller = undefined;
  }
}
export function syncNationalScene(root: HTMLElement, game: Game | null, opts: WorldOptions): void {
  current = { root, game, opts };
  void mount();
}
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => void mount(), 150); });
  motion?.addEventListener('change', () => void mount());
  window.addEventListener('pagehide', () => { generation++; controller?.dispose(); controller = undefined; });
  window.addEventListener('pageshow', () => { if (current) void mount(); });
}
