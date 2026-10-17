import { layoutPresidencyPins, updatePresidencyPins, presidencyClusterMarkup } from "./presidency-board-layout.ts";
import { presidencyFeedback } from "./presidency-engine.ts";
import { crisisEffects } from "./presidency-crisis-view.ts";
import { crisisSeverity, crisisSpec, presidencyCrises } from "./presidency-crises.ts";
import type { Game } from "./types.ts";
import type { PressureSectorId } from "./pressure-types.ts";
import { presidencyEventPins, presidencyEventFan, presidencyDate, presidencyFan, presidencyPanel, presidencyPins, presidencyReadings, presidencyResources, presidencyRoutes, presidencyShell, type PresidencyPanel } from "./presidency-view.ts";
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
  let selectedEvent: string | null = null;
  let selectedGroup: string[] | null = null;
  let panel: PresidencyPanel | null = null;
  let wholeMap = false;
  let disposed = false;
  let committing = false;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  let focusReturn: HTMLElement | null = null;
  let fanFrame = 0;
  let renderedSector: PressureSectorId | null = null;
  let renderedEvent: string | null = null;
  let renderedGroup: string | null = null;
  let sound = false;
  let audio: AudioContext | undefined;
  let lastBeat = 0;
  let lastEffectMarkup = "";
  let mapPan = 0;
  let layoutFrame = 0;
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
    const effects = crisisEffects(game);
    if (effects !== lastEffectMarkup) {
      slot("[data-live-crisis-effects]").innerHTML = effects;
      lastEffectMarkup = effects;
    }
    const crises = presidencyCrises(game).filter(c => c.status !== "resolved") ?? [];
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
    delete element.dataset.result;
    element.hidden = false;
    element.dataset.failure = String(failure);
    if (!failure) feedbackTimer = setTimeout(() => { element.hidden = true; }, 8_000);
  }

  function positionFan(): void {
    cancelAnimationFrame(fanFrame);
    fanFrame = requestAnimationFrame(() => {
      if (disposed) return;
      layoutPresidencyPins(host);
      if (!selected && !selectedEvent && !selectedGroup) return;
      const anchor = slot<HTMLElement>("[data-live-fan]");
      const country = slot<HTMLElement>(".pr-country").getBoundingClientRect();
      const pin = (selectedEvent ? [...host.querySelectorAll<HTMLElement>("[data-live-event-pin]")].find(el=>el.dataset.liveEventPin===selectedEvent) : host.querySelector<HTMLElement>(`[data-live-pin="${selected}"]`))?.getBoundingClientRect();
      const fan = anchor.firstElementChild?.getBoundingClientRect();
      if ((!pin && !selectedGroup) || !fan) return;
      const mobile = country.width <= 650;
      const preferredX = mobile ? (country.width - fan.width) / 2 : 20;
      const x = Math.max(8, Math.min(country.width - fan.width - 8, preferredX));
      const preferredY = country.height - fan.height - (mobile ? 5 : 20);
      const headerBottom = slot<HTMLElement>(".pr-header").getBoundingClientRect().bottom;
      const navTop = country.bottom;
      const minY = Math.max(8, headerBottom - country.top + 8);
      const maxY = Math.min(country.height, navTop - country.top) - fan.height - 8;
      const y = Math.max(minY, Math.min(maxY, preferredY));
      anchor.style.left = `${x}px`;
      anchor.style.top = `${y}px`;
    });
  }

  function drawFan(): void {
    const anchor = slot<HTMLElement>("[data-live-fan]");
    const groupKey=selectedGroup?.join("|") ?? null;
    const sameSector = (selected !== null && renderedSector === selected) || (selectedEvent !== null && renderedEvent === selectedEvent) || (groupKey !== null && renderedGroup === groupKey);
    const oldFan = anchor.querySelector<HTMLElement>(".pr-fan");
    const scroll = sameSector ? oldFan?.scrollTop ?? 0 : 0;
    const disclosureKey=(detail:HTMLDetailsElement)=>detail.dataset.liveDisclosure ?? detail.querySelector('summary')?.textContent ?? '';
    const openDetails=sameSector ? [...anchor.querySelectorAll<HTMLDetailsElement>('details[open]')].map(disclosureKey) : [];
    anchor.hidden = !selected && !selectedEvent && !selectedGroup;
    anchor.innerHTML = selectedGroup ? presidencyClusterMarkup(host,selectedGroup) : selectedEvent ? presidencyEventFan(game,selectedEvent) : selected ? presidencyFan(game, selected) : "";
    if(selectedEvent && !anchor.innerHTML) { selectedEvent=null; anchor.hidden=true; }
    renderedSector = selected; renderedEvent = selectedEvent;renderedGroup=groupKey;
    anchor.querySelectorAll<HTMLDetailsElement>('details').forEach(detail=>{detail.open=openDetails.includes(disclosureKey(detail));});
    const nextFan = anchor.querySelector<HTMLElement>(".pr-fan");
    if (nextFan) nextFan.scrollTop = scroll;
    if (selected || selectedEvent || selectedGroup) positionFan();
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
    const news = presidencyCrises(next).filter(c => !presidencyCrises(previous).some(old => old.id === c.id));
    const changes = presidencyCrises(next).filter(c => presidencyCrises(previous).some(old => old.id === c.id && (old.status !== c.status || old.spec !== c.spec)));
    if (news.length || changes.length) {
      slot<HTMLElement>("[data-live-announcement]").textContent = [...news.map(c => `${crisisSpec(c).title}. ${crisisSpec(c).cause}`), ...changes.map(c => `${crisisSpec(c).title} : ${c.status === "resolved" ? "incident levé" : c.status === "contained" ? "secours en service" : crisisSpec(c).cause}.`)].join(" ");
      if (news.length || changes.length) tone(true);
    }
    host.dataset.turn = String(game.turn);
    slot<HTMLElement>("[data-live-date]").textContent = presidencyDate(game);
    slot<HTMLElement>("[data-live-period]").textContent = `Période ${Math.min(30, game.turn + 1)} / 30`;
    slot("[data-live-resources]").innerHTML = presidencyResources(game);
    slot("[data-live-sectors]").innerHTML = presidencyReadings(game, selected);
    updatePresidencyPins(slot("[data-live-pins]"), presidencyPins(game, selected));
    slot("[data-live-links]").innerHTML = presidencyRoutes(game);

    updatePresidencyPins(slot("[data-live-event-pins]"), presidencyEventPins(game));

    slot<HTMLElement>("[data-live-headline]").textContent = game.presidency?.lastEvents.at(-1) ?? game.presidency?.initiatives.at(-1)?.title ?? "Le pays attend vos décisions.";
    drawCrises();
    drawFan();
    positionFan();
    host.dataset.ended = String(ended());
    if (ended() && panel !== "ending") {
      running = false;
      selected = null; selectedEvent = null;selectedGroup=null;
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
    const originEvent=selectedEvent, originSector=selected;
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
        const result = presidencyFeedback(next);
        if (result) {
          feedback(result.detail);
          const notice=slot<HTMLElement>('[data-live-feedback]');
          notice.dataset.result=result.status;
          const heading=document.createElement('strong');heading.textContent=result.title;
          const detail=document.createElement('span');detail.textContent=result.detail;
          notice.replaceChildren(heading,detail);
        } else feedback(next.presidency?.lastEvents.at(-1) ?? 'Consigne enregistrée.');
      } else if (latest && latest.id !== oldInitiative && latest.status === 'delivered') {
        feedback(latest.detail);
        slot<HTMLElement>('[data-live-feedback]').dataset.result='delivered';
      }
      if (id !== "live-tick" && (originSector || originEvent) && !panel) {
        selected = null;
        selectedEvent = null;
        slot("[data-live-sectors]").innerHTML = presidencyReadings(game, null);
        updatePresidencyPins(slot("[data-live-pins]"), presidencyPins(game, null));
        drawFan();
        positionFan();
        restoreBoardFocus(originEvent, originSector ?? focusSectorForOrder(id));
      }
    } catch (error) {
      pause();
      feedback(error instanceof Error ? error.message : "L’action n’a pas pu être enregistrée. Le temps est suspendu.", true);
    } finally { committing = false; }
  }

  function restoreBoardFocus(eventId: string | null, sector: string | null): void {
    layoutPresidencyPins(host);
    const eventPin=eventId ? [...host.querySelectorAll<HTMLElement>('[data-live-event-pin]')].find(el=>el.dataset.liveEventPin===eventId) : null;
    const sectorPin=sector ? host.querySelector<HTMLElement>(`[data-live-pin="${sector}"]`) : null;
    let target=eventPin ?? sectorPin;
    if(target?.hidden) target=[...host.querySelectorAll<HTMLElement>('[data-cluster-members]')].find(el=>(JSON.parse(el.dataset.clusterMembers!) as string[]).includes(target!.dataset.pinKey!)) ?? null;
    (target ?? (sector ? host.querySelector<HTMLElement>(`[data-presidency-front="${sector}"]`) : null) ?? host.querySelector<HTMLElement>('.pr-board-pin:not([hidden])') ?? slot<HTMLElement>('[data-action="presidency-menu"]')).focus({preventScroll:true});
  }
  function focusSectorForOrder(id: string): string {
    return presidencyCrises(game).find(c => id.startsWith(`live-crisis-${c.id}-`))?.sector ?? id.match(/^live-pressure-(health|housing|transport|energy|education|administration)-/)?.[1] ?? "health";
  }

  function focusMap(x:number): void {
    if(wholeMap || slot<HTMLElement>('.pr-country').clientWidth>650)return;
    const country=slot<HTMLElement>('.pr-country'),world=slot<HTMLElement>('.pr-world');
    const limit=Math.max(0,(world.offsetWidth-country.clientWidth)/2);
    mapPan=Math.max(-limit,Math.min(limit,world.offsetWidth*(.5-x/100)));
    host.style.setProperty('--pr-pan',`${mapPan}px`);positionFan();
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
    if(ended() && ['presidency-sector','presidency-event','presidency-pause'].includes(action ?? '')) {
      selected=null;selectedEvent=null;selectedGroup=null;panel='ending';drawFan();drawPanel();return;
    }
    if(target.dataset.clusterMembers) {
      selectedGroup=JSON.parse(target.dataset.clusterMembers);selected=null;selectedEvent=null;drawFan();positionFan();return;
    }
    if(['presidency-event','presidency-sector','presidency-deselect'].includes(action ?? '')) selectedGroup=null;
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
    } else if (action === "presidency-event") {
      selected=null; selectedEvent=selectedEvent===target.dataset.event ? null : target.dataset.event!;
      if(selectedEvent) focusMap(Number([...host.querySelectorAll<HTMLElement>("[data-live-event-pin]")].find(p=>p.dataset.liveEventPin===selectedEvent)?.dataset.mapX ?? 50));
      drawFan();positionFan();
      if(selectedEvent && event.detail===0) slot<HTMLElement>("[data-live-fan] button[data-order]:not(:disabled)")?.focus({preventScroll:true});
    } else if (action === "presidency-sector") {
      selectedEvent=null;
      selected = selected === target.dataset.sector ? null : target.dataset.sector as PressureSectorId;
      slot("[data-live-sectors]").innerHTML = presidencyReadings(game, selected);
      updatePresidencyPins(slot("[data-live-pins]"), presidencyPins(game, selected));
      if(selected) focusMap(Number(target.dataset.mapX ?? host.querySelector<HTMLElement>(`[data-live-pin="${selected}"]`)?.dataset.mapX ?? 50));
      drawFan();positionFan();
      if (selected && event.detail === 0) slot<HTMLElement>("[data-live-fan] button[data-order]:not(:disabled)")?.focus({ preventScroll: true });
    } else if (action === "presidency-deselect") {
      const previous = selected, previousEvent=selectedEvent;
      selected = null; selectedEvent=null;
      drawFan();
      slot("[data-live-sectors]").innerHTML = presidencyReadings(game, selected);
      updatePresidencyPins(slot("[data-live-pins]"), presidencyPins(game, selected));
      positionFan();restoreBoardFocus(previousEvent,previous);
    } else if (action === "presidency-order") {
      commit(target.dataset.order!);
    } else if (action === "presidency-mapview") {
      wholeMap = !wholeMap;
      host.dataset.wholeMap = String(wholeMap);
      target.setAttribute("aria-pressed", String(wholeMap));
      target.textContent = wholeMap ? "Vue rapprochée" : "Vue France";
      mapPan=0;host.style.setProperty("--pr-pan","0px");
      positionFan();
    } else if (action === "presidency-panel") {
      focusReturn = target;
      panel = target.dataset.panel as PresidencyPanel;
      selected = null; selectedEvent=null;
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
      else if (selected || selectedEvent || selectedGroup) {
        selectedGroup=null;
        const sector = selected, eventId=selectedEvent;
        selected = null; selectedEvent=null;
        drawFan();
        slot("[data-live-sectors]").innerHTML = presidencyReadings(game, selected);
        updatePresidencyPins(slot("[data-live-pins]"), presidencyPins(game, selected));
        restoreBoardFocus(eventId,sector);
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

  const country=slot<HTMLElement>('.pr-country');
  let drag: {id:number;x:number;pan:number} | null=null;
  function dragStart(event:PointerEvent): void {
    if(wholeMap || event.target instanceof Element && event.target.closest('button,.pr-fan'))return;
    drag={id:event.pointerId,x:event.clientX,pan:mapPan};country.setPointerCapture(event.pointerId);
  }
  function dragMove(event:PointerEvent): void {
    if(!drag || drag.id!==event.pointerId)return;
    const limit=Math.max(0,(slot<HTMLElement>('.pr-world').offsetWidth-country.clientWidth)/2);
    mapPan=Math.max(-limit,Math.min(limit,drag.pan+event.clientX-drag.x));
    host.style.setProperty('--pr-pan',`${mapPan}px`);
    cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(()=>layoutPresidencyPins(host));
  }
  function dragEnd(): void { drag=null; }
  country.addEventListener('pointerdown',dragStart);
  country.addEventListener('pointermove',dragMove);
  country.addEventListener('pointerup',dragEnd);
  country.addEventListener('pointercancel',dragEnd);
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
  focusMap(Number(host.querySelector<HTMLElement>("[data-crisis-id]")?.dataset.mapX ?? 50));
  return {
    update: refresh, pause, resume, isRunning: active,
    dispose() {
      if (disposed) return;
      disposed = true;
      clearInterval(timer);
      if (audio) void audio.close();
      clearTimeout(feedbackTimer);
      cancelAnimationFrame(fanFrame);
      cancelAnimationFrame(layoutFrame);
      country.removeEventListener("pointerdown",dragStart);
      country.removeEventListener("pointermove",dragMove);
      country.removeEventListener("pointerup",dragEnd);
      country.removeEventListener("pointercancel",dragEnd);
      resize.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      host.removeEventListener("click", onClick);
      host.removeEventListener("keydown", onKey);
    },
  };
}
