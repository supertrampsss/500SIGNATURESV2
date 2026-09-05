/**
 * Optional real geography, deliberately outside the game engine and offline pack.
 * Buildings: OpenStreetMap via OpenFreeMap / OpenMapTiles. render_height may be
 * inferred by the tileset; it is never presented as a surveyed building height.
 * Source integration: https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/
 * Provider: https://openfreemap.org/quick_start/
 */
import type { Map as CityMap } from 'maplibre-gl';
import './city-map.css';

export interface CityMapLocation {
  code: string;
  name: string;
  /** Longitude, latitude from the verified commune centroid, never guessed. */
  center: readonly [number, number];
}

function usableLocation(city: CityMapLocation): boolean {
  return /^[0-9A-Z]{5}$/.test(city.code) && city.name.trim().length > 0 &&
    city.center.length === 2 && city.center.every(Number.isFinite) &&
    Math.abs(city.center[0]) <= 180 && Math.abs(city.center[1]) <= 85;
}

/** Mounts a launch card. MapLibre and network requests start only after a click. */
export function mountCityMap(container: HTMLElement, city: CityMapLocation, signal?: AbortSignal): () => void {
  const root = document.createElement('section');
  root.className = 'mandat-city-map';
  root.setAttribute('aria-label', `Carte de ${city.name}`);
  const title = document.createElement('h3');
  title.textContent = city.name;
  const note = document.createElement('p');
  note.className = 'mandat-city-map__note';
  note.textContent = 'Les rues et bâtiments de votre commune. Vue indicative, connexion nécessaire.';
  const launch = document.createElement('button');
  launch.type = 'button';
  launch.className = 'mandat-city-map__launch';
  launch.textContent = 'Explorer la ville en 3D';
  const canvas = document.createElement('div');
  canvas.className = 'mandat-city-map__canvas';
  canvas.hidden = true;
  const status = document.createElement('p');
  status.className = 'mandat-city-map__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const controls = document.createElement('div');
  controls.className = 'mandat-city-map__controls';
  controls.hidden = true;
  const attribution = document.createElement('p');
  attribution.className = 'mandat-city-map__source';
  attribution.innerHTML = '<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · © <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>. Hauteurs indicatives, parfois estimées. Les projets du jeu ne modifient pas ces données géographiques.';
  attribution.hidden = true;
  root.append(title, note, launch, canvas, controls, status, attribution);
  container.append(root);
  let map: CityMap | undefined;
  let disposed = false;
  let pending = false;
  let stage: 'idle' | 'module' | 'renderer' | 'tiles' | 'buildings' | 'ready' = 'idle';
  let threeD = true;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let observer: ResizeObserver | undefined;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stopMap = () => {
    if (timeout) clearTimeout(timeout);
    observer?.disconnect();
    observer = undefined;
    map?.remove();
    map = undefined;
    canvas.replaceChildren();
    canvas.hidden = true;
    controls.hidden = true;
    controls.replaceChildren();
  };
  const report = (error: unknown) => {
    // Local categorical diagnostic only, with no telemetry or raw exception text.
    const detail = error instanceof Error ? error.message : String(error);
    root.dataset.mapFailure = /webgl|gpu/i.test(detail) ? 'webgl-unavailable' : /content.security|csp|worker/i.test(detail) ? 'renderer-policy' : stage;
    console.warn(`[Mandats optional city map: ${root.dataset.mapFailure}]`);
  };
  const fallback = (message: string) => {
    stopMap();
    pending = false;
    launch.disabled = false;
    launch.hidden = false;
    launch.textContent = 'Réessayer la carte';
    status.textContent = message;
  };
  const button = (label: string, action: () => void) => {
    const control = document.createElement('button');
    control.type = 'button';
    control.textContent = label;
    control.addEventListener('click', action);
    controls.append(control);
    return control;
  };
  const explore = async () => {
    if (disposed || pending || map) return;
    if (!usableLocation(city)) {
      status.textContent = 'Le centre géographique de cette commune est indisponible. Le mandat reste jouable.';
      return;
    }
    if (!navigator.onLine) {
      status.textContent = 'Cette carte nécessite Internet. Votre mandat peut continuer sans elle.';
      return;
    }
    pending = true;
    delete root.dataset.mapFailure;
    stage = 'module';
    launch.disabled = true;
    status.textContent = 'Chargement des rues et bâtiments…';
    try {
      // Deliberately lazy: no mandatory WebGL, stylesheet or tile download at game start.
      const [{ default: maplibregl }] = await Promise.all([
        import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css'),
      ]);
      if (disposed) return;
      canvas.hidden = false;
      stage = 'renderer';
      map = new maplibregl.Map({
        container: canvas,
        style: 'https://tiles.openfreemap.org/styles/bright',
        center: [...city.center], zoom: 15.4, pitch: 48, bearing: -12,
        maxZoom: 18, minZoom: 10,
        attributionControl: false,
        cooperativeGestures: true,
        scrollZoom: false,
        canvasContextAttributes: { antialias: false },
      });
      stage = 'tiles';
      const activeMap = map;
      attribution.hidden = false;
      timeout = setTimeout(() => {
        if (!disposed && map === activeMap && pending) fallback('La carte ne répond pas. Continuez votre mandat ou réessayez avec une connexion stable.');
      }, 20000);
      activeMap.on('error', event => {
        if (!disposed && map === activeMap) report(event.error);
        if (!disposed && map === activeMap) status.textContent = 'Certaines données cartographiques sont indisponibles. Le mandat reste accessible.';
      });
      activeMap.once('load', () => {
        if (disposed || map !== activeMap) return;
        if (timeout) clearTimeout(timeout);
        try {
          stage = 'buildings';
          const firstLabel = activeMap.getStyle().layers.find(layer => layer.type === 'symbol');
          activeMap.addSource('mandat-buildings', { type: 'vector', url: 'https://tiles.openfreemap.org/planet' });
          activeMap.addLayer({
            id: 'mandat-buildings-3d', type: 'fill-extrusion', source: 'mandat-buildings',
            'source-layer': 'building', minzoom: 14,
            filter: ['all', ['!=', ['get', 'hide_3d'], true], ['has', 'render_height']],
            paint: {
              'fill-extrusion-color': '#b6b5a8',
              'fill-extrusion-height': ['max', 0, ['to-number', ['get', 'render_height'], 0]],
              'fill-extrusion-base': ['max', 0, ['to-number', ['get', 'render_min_height'], 0]],
              'fill-extrusion-opacity': 0.93,
            },
          }, firstLabel?.id);
          threeD = true;
          const dimension = button('Vue 3D', () => {
            threeD = !threeD;
            activeMap.setLayoutProperty('mandat-buildings-3d', 'visibility', threeD ? 'visible' : 'none');
            activeMap.easeTo({ pitch: threeD ? 48 : 0, bearing: threeD ? -12 : 0, duration: reducedMotion() ? 0 : 350 });
            dimension.textContent = threeD ? 'Vue 3D' : 'Vue 2D';
            dimension.setAttribute('aria-pressed', String(threeD));
          });
          dimension.setAttribute('aria-label', 'Activer la vue 3D');
          dimension.setAttribute('aria-pressed', 'true');
          button('Agrandir', () => activeMap.zoomIn({ duration: reducedMotion() ? 0 : 200 }));
          button('Réduire', () => activeMap.zoomOut({ duration: reducedMotion() ? 0 : 200 }));
          button('Recentrer', () => activeMap.easeTo({ center: [...city.center], zoom: 15.4, duration: reducedMotion() ? 0 : 350 }));
          button('Fermer la carte', () => {
            stopMap();
            launch.hidden = false;
            launch.disabled = false;
            launch.textContent = 'Explorer la ville en 3D';
            status.textContent = '';
            attribution.hidden = true;
            launch.focus();
          });
          pending = false;
          stage = 'ready';
          delete root.dataset.mapFailure;
          launch.hidden = true;
          controls.hidden = false;
          status.textContent = 'Carte ouverte. Les hauteurs et la couverture des bâtiments varient selon les données disponibles.';
          activeMap.getCanvas().setAttribute('aria-label', `Carte de ${city.name}. Flèches pour déplacer, boutons pour zoomer ou revenir en 2D.`);
          dimension.focus();
          observer = new ResizeObserver(() => activeMap.resize());
          observer.observe(canvas);
        } catch (error) {
          report(error);
          fallback('La vue 3D est indisponible sur cet appareil. Continuez avec les informations du territoire.');
        }
      });
    } catch (error) {
      if (!disposed) {
        report(error);
        fallback('La carte est indisponible sur cet appareil ou cette connexion. Votre mandat reste jouable.');
      }
    }
  };
  launch.addEventListener('click', explore);
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    signal?.removeEventListener('abort', cleanup);
    launch.removeEventListener('click', explore);
    stopMap();
    root.remove();
  };
  if (signal?.aborted) cleanup();
  else signal?.addEventListener('abort', cleanup, { once: true });
  return cleanup;
}
