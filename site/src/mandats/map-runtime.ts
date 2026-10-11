import { MAP_PLACES, mapState } from "./map-state.ts";
import type { MapPlace, MandateMapState } from "./map-state.ts";
import type { Game } from "./types.ts";
import { placeFallbackMarkers, watchPreviewImage } from "./map-marker-layout.ts";

type Runtime = typeof import("./map-scene.ts");
type PendingScene = {
  root: HTMLElement; host: HTMLElement; game: Game; light: boolean;
  state: MandateMapState; cameraActions: string[]; inspection?: MapPlace;
};
let runtime: Runtime | undefined, loading: Promise<Runtime> | undefined;
let pending: PendingScene | undefined, activeHost: HTMLElement | undefined;
let previewCleanup: ReturnType<typeof watchPreviewImage>;
let fallbackResize: ResizeObserver | undefined;
let fallbackState: MandateMapState | undefined;

function releaseLayout(): void {
  previewCleanup?.();
  previewCleanup = undefined;
  fallbackResize?.disconnect();
  fallbackResize = undefined;
  fallbackState = undefined;
}

/** Keep entry and explicit older games independent of the 3D module. */
export function syncMandateMap(root: HTMLElement, game: Game | null, light: boolean): void {
  if (runtime) {
    releaseLayout();
    pending = undefined;
    runtime.syncMandateMap(root, game, light);
    return;
  }
  const host = root.querySelector<HTMLElement>("[data-mandate-map]");
  if (!host || !game) {
    pending = undefined;
    if (activeHost !== host || fallbackResize) releaseLayout();
    activeHost = host ?? undefined;
    if (host) {
      host.dataset.renderer = "preview";
      host.setAttribute("aria-busy", "false");
      host.querySelector<HTMLElement>("[data-map-status]")!.textContent = "";
      previewCleanup ??= watchPreviewImage(host);
    }
    return;
  }
  if (pending?.host === host) {
    pending.root = root;
    pending.game = game;
    pending.light = light;
    pending.state = mapState(game);
    placeFallbackMarkers(host, pending.state);
    return;
  }
  if (activeHost === host && host.dataset.renderer === "fallback") {
    fallbackState = mapState(game);
    placeFallbackMarkers(host, fallbackState);
    host.dataset.movements = String(fallbackState.movements.length);
    return;
  }
  releaseLayout();
  activeHost = host;
  const request: PendingScene = {
    root, host, game, light, state: mapState(game), cameraActions: [],
  };
  pending = request;
  host.dataset.renderer = "loading";
  host.setAttribute("aria-busy", "true");
  host.querySelector<HTMLElement>("[data-map-status]")!.textContent = "La carte se prépare.";
  placeFallbackMarkers(host, request.state);
  loading ??= import("./map-scene.ts").then(module => {
    runtime = module;
    return module;
  }).catch(error => {
    loading = undefined;
    throw error;
  });
  void loading.then(module => {
    if (pending !== request || !host.isConnected) return;
    pending = undefined;
    releaseLayout();
    // The renderer receives the most recent saved game. It keeps its own
    // deferred mount and queues these actions until the canvas is available.
    module.syncMandateMap(request.root, request.game, request.light);
    for (const action of request.cameraActions) module.moveMapCamera(action);
    if (request.inspection) module.inspectMapPlace(request.inspection);
  }).catch(error => {
    if (pending !== request || !host.isConnected) return;
    pending = undefined;
    host.dataset.renderError = error instanceof Error ? error.message : String(error);
    host.dataset.renderer = "fallback";
    host.setAttribute("aria-busy", "false");
    host.querySelector<HTMLElement>("[data-map-status]")!.textContent =
      "Vue légère. Les sujets et les décisions restent accessibles.";
    fallbackState = request.state;
    placeFallbackMarkers(host, fallbackState);
    fallbackResize = new ResizeObserver(() => {
      if (fallbackState) placeFallbackMarkers(host, fallbackState);
    });
    fallbackResize.observe(host);
  });
}

export function moveMapCamera(action: string): void {
  if (runtime) runtime.moveMapCamera(action);
  else pending?.cameraActions.push(action);
}

export function inspectMapPlace(place: string): void {
  if (!Object.hasOwn(MAP_PLACES, place)) return;
  if (runtime) runtime.inspectMapPlace(place);
  else if (pending) pending.inspection = place as MapPlace;
}

if (typeof window !== "undefined") window.addEventListener("pagehide", () => {
  pending = undefined;
  releaseLayout();
  activeHost = undefined;
});
