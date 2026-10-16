import { MAP_PLACES, mapState } from "./map-state.ts";
import type { MapPlace, MandateMapState } from "./map-state.ts";
import type { Game } from "./types.ts";
import { mapObstacles, placeFallbackMarkers, placeMarker, placeMarkerSubjects } from "./map-marker-layout.ts";
import { ILLUSTRATED_MAP_PLACES, ILLUSTRATED_MAP_SIZE, ILLUSTRATED_NATIONAL_ANCHOR } from "./map-illustrated-layout.ts";

type Point = { x: number; y: number };
type MapController = ReturnType<typeof mountIllustration>;
const { width: artWidth, height: artHeight } = ILLUSTRATED_MAP_SIZE;
const maximumZoom = 4;
const interactive = "button, a, input, select, textarea, [contenteditable], [role=button]";
let controller: MapController | undefined;
let activeHost: HTMLElement | undefined;

const crowdDrawing = `<svg viewBox="0 0 44 40" aria-hidden="true" focusable="false"><ellipse cx="22" cy="35" rx="20" ry="4" fill="#112c3a" opacity=".3"/><g fill="#f0dbc0" stroke="#173445" stroke-width="1.1"><circle cx="12" cy="14" r="3.5"/><circle cx="23" cy="12" r="3.5"/><circle cx="33" cy="16" r="3.5"/></g><path d="M7 20h10v12H7Zm11-2h10v15H18Zm10 4h10v12H28Z" fill="#af2431" stroke="#741b2a"/><path d="M10 32v5m5-5v5m6-4v5m5-5v5m5-4v4m5-4v4" stroke="#183343" stroke-width="2"/><path d="M5 21V4h14v9H5" fill="#f9e9c9" stroke="#283a45" stroke-width="1.2"/></svg>`;
const workDrawing = `<svg viewBox="0 0 44 40" aria-hidden="true" focusable="false"><ellipse cx="22" cy="35" rx="20" ry="4" fill="#112c3a" opacity=".3"/><path d="M8 35V6h4v29M3 8h35M10 2l20 6M33 8v12" fill="none" stroke="#e5aa36" stroke-width="2.7" stroke-linejoin="round"/><path d="M17 35V22h19v13M22 22v13m9-13v13M17 27h19" fill="#e8d5ad" stroke="#685b47" stroke-width="1.3"/><path d="M31 20h4v4h-4" fill="#273b49"/></svg>`;
const deliveredDrawing = `<svg viewBox="0 0 44 40" aria-hidden="true" focusable="false"><ellipse cx="22" cy="35" rx="20" ry="4" fill="#112c3a" opacity=".3"/><path d="M7 35V15h30v20" fill="#e9d7b3" stroke="#776750" stroke-width="1.2"/><path d="m5 15 17-9 17 9" fill="#40566a" stroke="#263c4c" stroke-width="1.5"/><path d="M12 19h5v5h-5Zm15 0h5v5h-5ZM12 28h5v5h-5Zm15 0h5v5h-5Zm-8-2h6v9h-6Z" fill="#284a5c"/><circle cx="35" cy="9" r="7" fill="#2e7854" stroke="#fff0cf"/><path d="m32 9 2 2 4-4" fill="none" stroke="#fff0cf" stroke-width="1.8"/></svg>`;
const projectLabels = { funded: "Chantier", blocked: "Bloqué", delivered: "Livré", withdrawn: "Retiré" } as const;
const withdrawnDrawing = `<svg viewBox="0 0 44 40" aria-hidden="true" focusable="false"><path d="m4 30 18-7 18 7-18 7Z" fill="#b5b19d" stroke="#615d55" stroke-width="1.3" stroke-dasharray="3 2"/><circle cx="22" cy="17" r="10" fill="#f2e5cc" stroke="#6f6a61" stroke-width="2"/><path d="m17 12 10 10m0-10L17 22" stroke="#6f6a61" stroke-width="2"/></svg>`;
const blockedDrawing = workDrawing.replace("</svg>", `<circle cx="35" cy="10" r="7" fill="#a32a34" stroke="#fff0cf"/><path d="M31 10h8" stroke="#fff0cf" stroke-width="2"/></svg>`);

function mountIllustration(host: HTMLElement, initial: MandateMapState, light: boolean) {
  const artboard = host.querySelector<HTMLElement>("[data-map-artboard]"),
    image = host.querySelector<HTMLImageElement>("[data-map-illustration]"),
    effects = host.querySelector<HTMLElement>("[data-map-effects]"),
    abort = new AbortController(), signal = abort.signal,
    reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)"),
    pointers = new Map<number, Point>();
  let state = initial, zoom = 1, centre = { x: .5, y: .5 },
    scale = 1, left = 0, top = 0, frame: number | undefined,
    ready = false, failed = false, disposed = false, effectsKey = "";
  let commandOverlays: Element[] = [];
  if (!host.hasAttribute("tabindex")) host.tabIndex = 0;
  host.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown ArrowLeft ArrowRight + - Home");
  host.dataset.renderer = "loading";
  host.dataset.renderPending = "true";
  host.setAttribute("aria-busy", "true");
  if (artboard) {
    artboard.style.width = `${artWidth}px`;
    artboard.style.height = `${artHeight}px`;
    artboard.style.transformOrigin = "0 0";
  }

  function projectMarkers() {
    if (failed) { placeFallbackMarkers(host, state); return; }
    const markers = new Map([...host.querySelectorAll<HTMLElement>("[data-map-marker]")]
      .map(element => [element.dataset.mapMarker, element])),
      urgent = new Set(state.markers.filter(item => item.urgent).map(item => item.id)),
      visibleIds = new Set([...state.markers, ...state.tracking].map(item => item.id)),
      placed = mapObstacles(host);
    // A visible focused button must never be hidden temporarily during layout:
    // doing so drops keyboard focus even if this same draw shows it again.
    for (const [id, element] of markers)
      if (!id || !visibleIds.has(id)) element.hidden = true;
    for (const item of [...state.markers, ...state.tracking].sort((a, b) =>
      Number(urgent.has(b.id)) - Number(urgent.has(a.id)))) {
      const element = markers.get(item.id);
      if (!element) continue;
      const anchor = item.id.startsWith("policy:") ? ILLUSTRATED_NATIONAL_ANCHOR : ILLUSTRATED_MAP_PLACES[item.place],
        x = left + anchor.x * artWidth * scale,
        y = top + anchor.y * artHeight * scale;
      element.hidden = x < 0 || y < 0 || x > host.clientWidth || y > host.clientHeight;
      if (!element.hidden) placeMarker(host, element, { x, y }, placed);
    }
    placeMarkerSubjects(host, placed);
  }

  function draw() {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    if (disposed || !host.isConnected) return;
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    scale = Math.min(width / artWidth, height / artHeight) * zoom;
    const reachX = Math.max(0, 1 - width / (artWidth * scale)) / 2,
      reachY = Math.max(0, 1 - height / (artHeight * scale)) / 2;
    centre.x = Math.max(.5 - reachX, Math.min(.5 + reachX, centre.x));
    centre.y = Math.max(.5 - reachY, Math.min(.5 + reachY, centre.y));
    left = width / 2 - centre.x * artWidth * scale;
    top = height / 2 - centre.y * artHeight * scale;
    if (artboard) artboard.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
    host.dataset.mapZoom = String(zoom);
    host.dataset.mapCentreX = String(centre.x);
    host.dataset.mapCentreY = String(centre.y);
    host.dataset.mapScale = String(scale);
    projectMarkers();
  }
  function scheduleDraw() {
    if (frame === undefined && !disposed) frame = requestAnimationFrame(draw);
  }
  function changeZoom(value: number, anchor: Point = { x: host.clientWidth / 2, y: host.clientHeight / 2 }) {
    if (failed) return;
    if (frame !== undefined) draw();
    const next = Math.max(1, Math.min(maximumZoom, value));
    if (next === zoom) return;
    const local = { x: (anchor.x - left) / (artWidth * scale), y: (anchor.y - top) / (artHeight * scale) },
      nextScale = scale * next / zoom;
    centre = { x: local.x - (anchor.x - host.clientWidth / 2) / (artWidth * nextScale),
      y: local.y - (anchor.y - host.clientHeight / 2) / (artHeight * nextScale) };
    zoom = next;
    draw();
  }
  function pan(dx: number, dy: number) {
    if (failed) return;
    centre.x -= dx / (artWidth * scale);
    centre.y -= dy / (artHeight * scale);
    scheduleDraw();
  }
  function camera(action: string) {
    if (action === "in") changeZoom(zoom * 1.3);
    else if (action === "out") changeZoom(zoom / 1.3);
    else {
      zoom = 1;
      centre = { x: .5, y: .5 };
      host.dataset.inspection = "";
      draw();
    }
  }
  function inspect(place: MapPlace) {
    if (failed) return;
    setExpanded(true);
    zoom = Math.max(zoom, 2.2);
    centre = { ...ILLUSTRATED_MAP_PLACES[place] };
    host.dataset.inspection = place;
    draw();
  }

  function setExpanded(expanded: boolean) {
    host.dataset.expanded = String(expanded);
    if (!expanded) host.dataset.inspection = "";
    const button = host.querySelector<HTMLButtonElement>("[data-map-toggle]");
    button?.setAttribute("aria-expanded", String(expanded));
    if (button) button.textContent = expanded ? "Replier la carte" : "Déplier la carte";
    scheduleDraw();
  }
  host.querySelector("[data-map-toggle]")?.addEventListener("click", () => {
    setExpanded(host.dataset.expanded !== "true");
  }, { signal });

  function rebuildEffects() {
    if (!effects) return;
    const key = JSON.stringify([state.movements, state.projects]);
    if (key === effectsKey) return;
    effectsKey = key;
    const fragments = document.createDocumentFragment(), occupied = new Map<MapPlace, number>();
    const add = (id: string, place: MapPlace, kind: string, label: string, description: string, drawing: string) => {
      const element = document.createElement("span"), caption = document.createElement("span"),
        anchor = ILLUSTRATED_MAP_PLACES[place], index = occupied.get(place) ?? 0,
        directionX = anchor.x > .78 ? -1 : 1,
        directionY = anchor.y > .74 ? -1 : 1;
      occupied.set(place, index + 1);
      element.className = `map-illustrated-effect map-illustrated-effect--${kind}`;
      element.dataset.mapEffect = id;
      element.dataset.effectPlace = place;
      element.dataset.effectStatus = kind;
      // Leave room for the complete drawing and its caption. Edge towns grow
      // inward rather than clamping several effects onto the same position.
      element.style.left = `${anchor.x * artWidth + directionX * (36 + index % 2 * 96)}px`;
      element.style.top = `${anchor.y * artHeight + 18 + directionY * Math.floor(index / 2) * 72}px`;
      element.setAttribute("role", "img");
      element.setAttribute("aria-label", `${description} · ${MAP_PLACES[place].name}`);
      element.title = `${description} · ${MAP_PLACES[place].name}`;
      element.innerHTML = drawing;
      caption.className = "map-illustrated-effect__label";
      caption.textContent = label;
      element.append(caption);
      fragments.append(element);
    };
    for (const movement of state.movements) add(movement.id, movement.placeOnMap, "movement", "Mobilisation",
      `${movement.demand} · mobilisation active`, crowdDrawing);
    for (const project of state.projects) add(project.id, project.placeOnMap, project.status,
      projectLabels[project.status], `${project.label} · ${projectLabels[project.status].toLowerCase()}`,
      project.status === "delivered" ? deliveredDrawing : project.status === "withdrawn" ? withdrawnDrawing :
        project.status === "blocked" ? blockedDrawing : workDrawing);
    effects.replaceChildren(fragments);
    host.dataset.renderedProjects = String(state.projects.length);
    host.dataset.unplacedProjects = "0";
  }
  function update(next: MandateMapState, reduced: boolean) {
    state = next;
    light = reduced;
    host.dataset.turn = String(state.turn);
    host.dataset.movements = String(state.movements.length);
    host.dataset.projects = String(state.projects.length);
    host.dataset.motion = reduced || reducedMotion.matches ? "reduced" : "active";
    for (const overlay of commandOverlays) resize.unobserve(overlay);
    commandOverlays = [...(host.closest(".map-game--command")?.querySelectorAll(":scope > .map-subject, :scope > .map-command-band, :scope > .map-situation-news, :scope > .map-situation-dock") ?? [])];
    for (const overlay of commandOverlays) resize.observe(overlay);
    rebuildEffects();
    draw();
  }
  function settle(ok: boolean) {
    if (disposed) return;
    ready = ok;
    failed = !ok;
    host.dataset.renderer = ok ? "illustrated" : "fallback";
    host.dataset.renderPending = "false";
    host.setAttribute("aria-busy", "false");
    const status = host.querySelector<HTMLElement>("[data-map-status]");
    if (status) status.textContent = ok ? "" : "Vue légère. Les sujets et les décisions restent accessibles.";
    if (ok) delete host.dataset.renderError;
    else host.dataset.renderError = "Illustration indisponible";
    draw();
  }
  if (image) {
    image.draggable = false;
    image.addEventListener("load", () => settle(image.naturalWidth > 0), { signal });
    image.addEventListener("error", () => settle(false), { signal });
  }
  reducedMotion.addEventListener("change", () => update(state, light), { signal });
  const localPointer = (event: PointerEvent): Point => {
    const rectangle = host.getBoundingClientRect();
    return { x: event.clientX - rectangle.left, y: event.clientY - rectangle.top };
  };
  host.addEventListener("pointerdown", event => {
    if (!ready || event.button !== 0 || (event.target instanceof Element && event.target.closest(interactive))) return;
    pointers.set(event.pointerId, localPointer(event));
    host.setPointerCapture(event.pointerId);
    host.dataset.dragging = "true";
    host.focus({ preventScroll: true });
    event.preventDefault();
  }, { signal });
  host.addEventListener("pointermove", event => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const point = localPointer(event), other = [...pointers].find(([id]) => id !== event.pointerId)?.[1];
    pointers.set(event.pointerId, point);
    if (other) {
      const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y),
        distance = Math.hypot(point.x - other.x, point.y - other.y),
        oldMiddle = { x: (previous.x + other.x) / 2, y: (previous.y + other.y) / 2 };
      if (oldDistance > 4) changeZoom(zoom * distance / oldDistance, oldMiddle);
      pan((point.x - previous.x) / 2, (point.y - previous.y) / 2);
    } else pan(point.x - previous.x, point.y - previous.y);
    event.preventDefault();
  }, { signal });
  const endPointer = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
    host.dataset.dragging = String(pointers.size > 0);
  };
  host.addEventListener("pointerup", endPointer, { signal });
  host.addEventListener("pointercancel", endPointer, { signal });
  host.addEventListener("lostpointercapture", endPointer, { signal });
  host.addEventListener("wheel", event => {
    if (!ready || (event.target instanceof Element && event.target.closest(interactive))) return;
    const rectangle = host.getBoundingClientRect(), delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1);
    changeZoom(zoom * Math.exp(-Math.max(-250, Math.min(250, delta)) * .002),
      { x: event.clientX - rectangle.left, y: event.clientY - rectangle.top });
    event.preventDefault();
  }, { passive: false, signal });
  host.addEventListener("keydown", event => {
    if (event.target !== host || event.altKey || event.ctrlKey || event.metaKey) return;
    const distance = event.shiftKey ? 96 : 48;
    if (event.key === "+" || event.key === "=") camera("in");
    else if (event.key === "-") camera("out");
    else if (event.key === "Home" || event.key === "0") camera("reset");
    else if (event.key === "ArrowLeft") pan(distance, 0);
    else if (event.key === "ArrowRight") pan(-distance, 0);
    else if (event.key === "ArrowUp") pan(0, distance);
    else if (event.key === "ArrowDown") pan(0, -distance);
    else return;
    event.preventDefault();
    event.stopPropagation();
  }, { signal });
  const resize = new ResizeObserver(scheduleDraw);
  resize.observe(host);
  // Font substitution changes label widths without resizing the map itself.
  // Reproject after late fonts (or their fallback) settle; never spend a turn.
  document.fonts.addEventListener("loadingdone", scheduleDraw, { signal });
  document.fonts.addEventListener("loadingerror", scheduleDraw, { signal });
  void document.fonts.ready.then(scheduleDraw);
  update(initial, light);
  if (!image || !artboard) settle(false);
  else if (image.complete) settle(image.naturalWidth > 0);
  return {
    update, camera, inspect,
    dispose() {
      disposed = true;
      abort.abort();
      resize.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
      pointers.clear();
    },
  };
}

/** State changes update HTML overlays while the retained illustration keeps its view. */
export function syncMandateMap(root: HTMLElement, game: Game | null, light: boolean): void {
  const host = root.querySelector<HTMLElement>("[data-mandate-map]");
  if (host !== activeHost) {
    controller?.dispose();
    controller = undefined;
    activeHost = host ?? undefined;
  }
  if (!host) return;
  const state = mapState(game);
  if (controller) controller.update(state, light);
  else controller = mountIllustration(host, state, light);
}

export function moveMapCamera(action: string): void {
  controller?.camera(action);
}

export function inspectMapPlace(place: string): void {
  if (Object.hasOwn(MAP_PLACES, place)) controller?.inspect(place as MapPlace);
}

if (typeof window !== "undefined") window.addEventListener("pagehide", event => {
  // A browser back-cache restores this same DOM and its listeners.
  if (event.persisted) return;
  controller?.dispose();
  controller = undefined;
  activeHost = undefined;
});
