import { crisisEffects } from "./presidency-crisis-view.ts";
import { crisisSeverity, crisisSpec } from "./presidency-crises.ts";
import type { Game } from "./types.ts";
import type { PressureSectorId } from "./pressure-types.ts";
import { crisisAlerts, presidencyDate, presidencyFan, presidencyFeed, presidencyPanel, presidencyPins, presidencyReadings, presidencyResources, presidencyRoutes, presidencyShell, type PresidencyPanel } from "./presidency-view.ts";
import { presidencyIcon } from "./presidency-icons.ts";

export const PRESIDENCY_PERIOD_MS = 15_000;
export type PresidencyOptions = {
  commit: (id: string) => Game | null;
  openMenu: () => void;
  autoplay?: boolean;
  preview?: boolean;
  onAdopt?: () => Game | null;
  comparison?: (game: Game) => string;
};

/** The illustration is mounted once. Only saved transitions replace state readings. */
export function mountPresidency(root: HTMLElement, initial: Game, options: PresidencyOptions): {
  dispose(): void; update(game: Game): void; pause(): void; resume(): void; isRunning(): boolean;
} {
  root.innerHTML = presidencyShell(initial);
  const host = root.querySelector<HTMLElement>("[data-presidency]")!;
  const slot = <T extends Element = HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
  let game = initial;
  let running = Boolean(options.autoplay && !options.preview && !document.hidden);
  let preview = Boolean(options.preview);
  let speed = 1;
  let progress = 0;
  let stamp = performance.now();
  let selected: PressureSectorId | null = null;
  let panel: PresidencyPanel | null = null;
  let wholeMap = false;
  let disposed = false;
  let committing = false;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  let focusReturn: HTMLElement | null = null;
  let fanFrame = 0;
  let sound = false;
  let audio: AudioContext | undefined;
  let lastBeat = 0;
  let lastEffectMarkup = "";
  let lastAlertMarkup = "";
  function updateCountdowns(): void {
    for (const element of host.querySelectorAll<HTMLElement>("[data-crisis-due]")) {
      const seconds = Math.max(0, Math.ceil(((Number(element.dataset.crisisDue) - game.turn) * PRESIDENCY_PERIOD_MS - progress) / (1000 * speed)));
      element.textContent = `${seconds} s`;
      element.setAttribute("aria-label", `${active() ? "Prochaine évolution" : "En pause, prochaine évolution"} dans ${seconds} secondes de jeu à cette vitesse`);
    }
  }
  function tone(urgent = false): void {
    if (!sound || !audio || !active() || audio.state !== "running") return;
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(urgent ? 220 : 130, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(80, audio.currentTime + .12);
    gain.gain.setValueAtTime(.025, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .16);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime + .18);
  }
  function drawCrises(): void {
    const effects = crisisEffects(game), alerts = crisisAlerts(game);
    if (effects !== lastEffectMarkup) {
      slot("[data-live-crisis-effects]").innerHTML = effects;
      lastEffectMarkup = effects;
    }
    if (alerts !== lastAlertMarkup) {
      const focused = document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>("[data-crisis-id]")?.dataset.crisisId : undefined;
      slot("[data-live-crisis-alerts]").innerHTML = alerts;
      lastAlertMarkup = alerts;
      if (focused) host.querySelector<HTMLElement>(`[data-crisis-id="${focused}"]`)?.focus({ preventScroll: true });
    }
    const crises = game.presidency?.crises?.filter(c => c.status !== "resolved") ?? [];
    host.dataset.crisisCount = String(crises.length);
    host.dataset.threat = String(Math.max(0, ...crises.map(c => crisisSeverity(c, game.turn))));
    updateCountdowns();
  }

  function ended(): boolean { return game.turn >= 30 || Boolean(game.politics?.ending); }
  function active(): boolean { return running && !panel && !preview && !ended() && !document.hidden; }

  function clock(): void {
    const paused = !active();
    const element = slot<HTMLElement>("[data-presidency-clock]");
    element.dataset.paused = String(paused);
    element.dataset.turn = String(game.turn);
    const toggle = slot<HTMLButtonElement>('[data-action="presidency-pause"]');
    toggle.innerHTML = presidencyIcon(paused ? "play" : "pause");
    toggle.setAttribute("aria-label", ended() ? "Mandat terminé" : paused ? "Démarrer le temps" : "Mettre le temps en pause");
    toggle.setAttribute("aria-pressed", String(!paused));
    toggle.disabled = ended();
    host.dataset.running = String(!paused);
    host.style.setProperty("--pr-motion-speed", String(speed));
    if (sound && audio) { if (paused) void audio.suspend(); else void audio.resume(); }
    updateCountdowns();
    host.dataset.preview = String(preview);
    slot<HTMLElement>("[data-live-status]").textContent = ended() ? "Terminé" : paused ? "En pause" : "En cours";
    slot<HTMLElement>("[data-live-progress]").style.width = `${progress / PRESIDENCY_PERIOD_MS * 100}%`;
    host.querySelectorAll<HTMLButtonElement>('[data-action="presidency-speed"]').forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.speed) === speed)));
  }

  function feedback(message: string, failure = false): void {
    clearTimeout(feedbackTimer);
    const element = slot<HTMLElement>("[data-live-feedback]");
    element.textContent = message;
    element.hidden = false;
    element.dataset.failure = String(failure);
    if (!failure) feedbackTimer = setTimeout(() => { element.hidden = true; }, 5_000);
  }

  function positionFan(): void {
    cancelAnimationFrame(fanFrame);
    fanFrame = requestAnimationFrame(() => {
      if (disposed || !selected) return;
      const anchor = slot<HTMLElement>("[data-live-fan]");
      const country = slot<HTMLElement>(".pr-country").getBoundingClientRect();
      const pin = host.querySelector<HTMLElement>(`[data-live-pin="${selected}"]`)?.getBoundingClientRect();
      const fan = anchor.firstElementChild?.getBoundingClientRect();
      if (!pin || !fan) return;
      const mobile = country.width <= 650;
      const preferredX = mobile ? (country.width - fan.width) / 2 : pin.right - country.left + 15;
      const x = Math.max(8, Math.min(country.width - fan.width - 8, preferredX));
      const preferredY = mobile ? pin.bottom - country.top + 8 : pin.top - country.top - 28;
      const headerBottom = slot<HTMLElement>(".pr-header").getBoundingClientRect().bottom;
      const navTop = slot<HTMLElement>(".pr-navigation").getBoundingClientRect().top;
      const minY = Math.max(8, headerBottom - country.top + 8);
      const maxY = Math.min(country.height, navTop - country.top) - fan.height - 8;
      const y = Math.max(minY, Math.min(maxY, preferredY));
      anchor.style.left = `${x}px`;
      anchor.style.top = `${y}px`;
    });
  }

  function drawFan(): void {
    const anchor = slot<HTMLElement>("[data-live-fan]");
    anchor.hidden = !selected;
    anchor.innerHTML = selected ? presidencyFan(game, selected) : "";
    if (selected) positionFan();
  }

  function drawPanel(keepPosition = false): void {
    const element = slot<HTMLElement>("[data-live-panel]");
    const body = element.querySelector<HTMLElement>(".pr-panel__body");
    const scroll = keepPosition ? body?.scrollTop ?? 0 : 0;
    const open = keepPosition ? [...element.querySelectorAll<HTMLDetailsElement>("details[open][data-live-reform], details[open][data-live-disclosure]")].map(detail => detail.dataset.liveReform ?? detail.dataset.liveDisclosure) : [];
    element.hidden = !panel;
    element.innerHTML = panel ? presidencyPanel(game, panel, options.comparison?.(game) ?? "") : "";
    if (panel) {
      element.querySelector<HTMLElement>(".pr-panel__body")!.scrollTop = scroll;
      element.querySelectorAll<HTMLDetailsElement>("details[data-live-reform], details[data-live-disclosure]").forEach(detail => { detail.open = open.includes(detail.dataset.liveReform ?? detail.dataset.liveDisclosure); });
      if (!keepPosition) element.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
    }
  }

  function refresh(next: Game): void {
    if (disposed) return;
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusOrder = activeElement?.dataset.order;
    const focusSector = activeElement?.dataset.sector;
    const previous = game;
    game = next;
    const news = (next.presidency?.crises ?? []).filter(c => !previous.presidency?.crises?.some(old => old.id === c.id));
    const changes = (next.presidency?.crises ?? []).filter(c => previous.presidency?.crises?.some(old => old.id === c.id && old.status !== c.status));
    if (news.length || changes.length) {
      slot<HTMLElement>("[data-live-announcement]").textContent = [...news.map(c => `${crisisSpec(c).title}. ${crisisSpec(c).cause}`), ...changes.map(c => `${crisisSpec(c).title} : ${c.status === "resolved" ? "incident levé" : c.status === "contained" ? "secours en service" : "reprise de la perturbation"}.`)].join(" ");
      if (news.length) tone(true);
    }
    host.dataset.turn = String(game.turn);
    slot<HTMLElement>("[data-live-date]").textContent = presidencyDate(game);
    slot<HTMLElement>("[data-live-period]").textContent = `Période ${Math.min(30, game.turn + 1)} / 30`;
    slot("[data-live-resources]").innerHTML = presidencyResources(game);
    slot("[data-live-sectors]").innerHTML = presidencyReadings(game, selected);
    slot("[data-live-pins]").innerHTML = presidencyPins(game, selected);
    slot("[data-live-links]").innerHTML = presidencyRoutes(game);
    slot("[data-live-feed]").innerHTML = presidencyFeed(game);
    drawCrises();
    drawFan();
    if (ended() && panel !== "ending") {
      running = false;
      selected = null;
      drawFan();
      panel = "ending";
      drawPanel();
    } else if (panel) drawPanel(true);
    if (focusOrder) [...host.querySelectorAll<HTMLElement>("[data-order]")].find(element => element.dataset.order === focusOrder && !element.matches(":disabled"))?.focus({ preventScroll: true });
    else if (focusSector) [...host.querySelectorAll<HTMLElement>("[data-presidency-front]")].find(element => element.dataset.sector === focusSector)?.focus({ preventScroll: true });
    clock();
  }

  function pause(): void { running = false; stamp = performance.now(); clock(); }
  function resume(): void {
    if (preview || ended() || document.hidden) return;
    running = true;
    stamp = performance.now();
    clock();
  }

  function commit(id: string): void {
    if (disposed || committing || ended()) return;
    if (preview) { feedback("Touchez « Jouer ce mandat » pour adopter cette partie."); return; }
    committing = true;
    const oldInitiative = game.presidency?.initiatives.at(-1)?.id;
    try {
      const next = options.commit(id);
      if (!next) {
        pause();
        feedback("Sauvegarde impossible. Le temps est suspendu ; votre dernière partie enregistrée est conservée.", true);
        return;
      }
      refresh(next);
      const existingFeedback = slot<HTMLElement>("[data-live-feedback]");
      if (existingFeedback.dataset.failure === "true") existingFeedback.hidden = true;
      const latest = next.presidency?.initiatives.at(-1);
      if (id !== "live-tick") {
        feedback(latest && latest.id !== oldInitiative ? `${latest.title}${latest.cost ? ` · ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(latest.cost)} Md€ engagés` : ""}` : next.presidency?.lastEvents.at(-1) ?? "Consigne enregistrée.");
      }
      if (id !== "live-tick" && selected && !panel) {
        selected = null;
        slot("[data-live-sectors]").innerHTML = presidencyReadings(game, null);
        slot("[data-live-pins]").innerHTML = presidencyPins(game, null);
        drawFan();
        slot<HTMLElement>(`[data-live-pin="${focusSectorForOrder(id)}"]`)?.focus({ preventScroll: true });
      }
    } catch {
      pause();
      feedback("L’action n’a pas pu être enregistrée. Le temps est suspendu.", true);
    } finally { committing = false; }
  }

  function focusSectorForOrder(id: string): string {
    return game.presidency?.crises?.find(c => id.startsWith(`live-crisis-${c.id}-`))?.sector ?? id.match(/^live-pressure-(health|housing|transport|energy|education|administration)-/)?.[1] ?? "health";
  }

  function closePanel(): void {
    if (!panel) return;
    panel = null;
    stamp = performance.now();
    drawPanel();
    clock();
    focusReturn?.focus({ preventScroll: true });
  }

  function onClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-action]") : null;
    if (!target || !host.contains(target) || target.matches(":disabled")) return;
    const action = target.dataset.action;
    if (action === "presidency-pause") {
      if (preview) { slot<HTMLButtonElement>('[data-action="presidency-adopt"]')?.focus(); return; }
      running ? pause() : resume();
    } else if (action === "presidency-sound") {
      sound = !sound;
      if (sound) {
        try { audio ??= new AudioContext(); if (active()) void audio.resume(); }
        catch { sound = false; feedback("Le son n’est pas disponible sur ce navigateur."); }
      } else if (audio) void audio.suspend();
      target.setAttribute("aria-pressed", String(sound));
      target.setAttribute("aria-label", sound ? "Désactiver les sons" : "Activer les sons");
      target.textContent = sound ? "Son actif" : "Son";
      if (sound) tone();
    } else if (action === "presidency-speed") {
      speed = Number(target.dataset.speed);
      stamp = performance.now();
      clock();
    } else if (action === "presidency-sector") {
      selected = selected === target.dataset.sector ? null : target.dataset.sector as PressureSectorId;
      slot("[data-live-sectors]").innerHTML = presidencyReadings(game, selected);
      slot("[data-live-pins]").innerHTML = presidencyPins(game, selected);
      drawFan();
      if (selected && event.detail === 0) slot<HTMLElement>("[data-live-fan] button[data-order]:not(:disabled)")?.focus({ preventScroll: true });
    } else if (action === "presidency-deselect") {
      const previous = selected;
      selected = null;
      drawFan();
      slot("[data-live-sectors]").innerHTML = presidencyReadings(game, selected);
      slot("[data-live-pins]").innerHTML = presidencyPins(game, selected);
      if (previous) slot<HTMLElement>(`[data-live-pin="${previous}"]`).focus({ preventScroll: true });
    } else if (action === "presidency-order") {
      commit(target.dataset.order!);
    } else if (action === "presidency-mapview") {
      wholeMap = !wholeMap;
      host.dataset.wholeMap = String(wholeMap);
      target.setAttribute("aria-pressed", String(wholeMap));
      target.textContent = wholeMap ? "Vue rapprochée" : "Vue France";
      positionFan();
    } else if (action === "presidency-panel") {
      focusReturn = target;
      panel = target.dataset.panel as PresidencyPanel;
      selected = null;
      drawFan();
      drawPanel();
      stamp = performance.now();
      clock();
    } else if (action === "presidency-close") closePanel();
    else if (action === "presidency-menu") options.openMenu();
    else if (action === "presidency-adopt") {
      const adopted = options.onAdopt?.();
      if (!adopted) { pause(); feedback("Cette partie n’a pas pu être enregistrée. Votre partie locale est conservée.", true); return; }
      preview = false;
      slot<HTMLElement>(".pr-preview")?.remove();
      refresh(adopted);
      resume();
    }
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      if (panel) { event.preventDefault(); closePanel(); }
      else if (selected) {
        const sector = selected;
        selected = null;
        drawFan();
        slot("[data-live-sectors]").innerHTML = presidencyReadings(game, selected);
        slot("[data-live-pins]").innerHTML = presidencyPins(game, selected);
        slot<HTMLElement>(`[data-live-pin="${sector}"]`)?.focus({ preventScroll: true });
      }
    }
    if (panel && event.key === "Tab") {
      const controls = [...slot("[data-live-panel]").querySelectorAll<HTMLElement>('button:not(:disabled), a[href], summary, [tabindex="0"]')].filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === slot("[data-live-panel]").querySelector("h2"))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }

  function visibility(): void { if (document.hidden) pause(); stamp = performance.now(); }
  const timer = setInterval(() => {
    const now = performance.now();
    const elapsed = Math.max(0, Math.min(500, now - stamp));
    stamp = now;
    if (!active()) return;
    progress += elapsed * speed;
    updateCountdowns();
    const threat = Number(host.dataset.threat ?? 0);
    if (sound && threat && now - lastBeat > 2400 / threat) { tone(threat > 1); lastBeat = now; }
    if (progress >= PRESIDENCY_PERIOD_MS) { progress = 0; commit("live-tick"); }
    slot<HTMLElement>("[data-live-progress]").style.width = `${progress / PRESIDENCY_PERIOD_MS * 100}%`;
  }, 100);

  host.addEventListener("click", onClick);
  host.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", visibility);
  const resize = new ResizeObserver(positionFan);
  resize.observe(slot(".pr-country"));
  const art = slot<HTMLImageElement>("[data-presidency-art]");
  art.addEventListener("error", () => { host.dataset.artFailed = "true"; }, { once: true });
  art.addEventListener("load", () => { host.dataset.artReady = "true"; }, { once: true });
  if (art.complete && art.naturalWidth) host.dataset.artReady = "true";
  if (preview) {
    const previewElement = document.createElement("aside");
    previewElement.className = "pr-preview";
    previewElement.innerHTML = '<span>Aperçu partagé · votre partie est conservée</span><button type="button" data-action="presidency-adopt">Jouer ce mandat</button>';
    host.append(previewElement);
  }
  refresh(initial);
  return {
    update: refresh, pause, resume, isRunning: active,
    dispose() {
      if (disposed) return;
      disposed = true;
      clearInterval(timer);
      if (audio) void audio.close();
      clearTimeout(feedbackTimer);
      cancelAnimationFrame(fanFrame);
      resize.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      host.removeEventListener("click", onClick);
      host.removeEventListener("keydown", onKey);
    },
  };
}
