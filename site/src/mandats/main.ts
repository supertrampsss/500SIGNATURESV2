import { syncNationalScene } from "./national-scene.ts";
import { icon } from "./icons.ts";
import "./game.css";
import "../styles/shared-design.css";
import "../styles/site-shell-v2.css";
import "./approved-decision-room.css";
import "./mandats-2026-rework.css";
import { decide, domainFor, startingGame, start, isFinished, choicesFor, selectStoryAgenda, storyContextOptions } from "./engine.ts";
import { pilotEnabled, readPilot, recordPilot, setPilotConsent } from "./telemetry.ts";
import { prepareOffline, removeOffline, updateOffline } from "./offline.ts";
import { cardModel, cardSVG, cardURL } from "./cards.ts";
import type { CardKind } from "./cards.ts";
import { clearEntryLink, entrySession, localSession } from "./session.ts";
import type { Ambition, Game } from "./types.ts";
import { gameShell, mandateSetup, selection, yearBriefing, yearRecap } from "./render.ts";
import type { Screen, View } from "./render.ts";
import { decode, encode, save, STORAGE_KEY, MAX_SAVE_BYTES } from "./storage.ts";
import { CARD_SIZES, challengeURL, escape } from "./sharing.ts";
import { readProgression, recordCompletedMandate } from "./progression.ts";
import { createDecisionTransition } from "./decision-transition.ts";
import { nationalSceneState } from "./national-scene-state.ts";
import { BRANCH_REFERENCE_KEY, comparisonMarkup, createBranch, readBranchReference, renderReplaySelection, renderTrajectoryComparison, saveBranchReference } from "./branch-replay.ts";
import "./living-board.css";
import "./country-feedback.css";
import "./branch-replay.css";
import "./living-recaps.css";
import "./decision-motion.css";
import "./cinema-board.css";
import "./cinema-shell.css";
import { voteSequenceMarkup } from "./politics-view.ts";
import { mountPoliticalMotion } from "./political-motion.ts";
import "./politics.css";
import "./narrative.css";
import "./social.css";
import "./decision-verdict.css";
import { showDecisionVerdict } from "./decision-verdict.ts";
import type { VoteRecord } from "./politics-types.ts";
import { mapEntry, mapReplay } from './map-view.ts';
import { mapGovernmentPanel, mapProjectsPanel } from './map-panels.ts';
import { syncMandateMap, moveMapCamera, inspectMapPlace } from './map-runtime.ts';
import { showMapDecisionVerdict } from './map-verdict.ts';
import './map-game.css';
import './map-interface.css';
import './map-pressure.css';
import './map-panels.css';
import './map-situation.css';
import './map-strategy.css';
import { mountPresidency } from './presidency-runtime.ts';
import './presidency.css';
import './presidency-crises.css';
import './presidency-reference.css';
import './presidency-board.css';
import './presidency-session.css';

const root = document.querySelector<HTMLElement>("#mandats")!;
const dialog = document.querySelector<HTMLDialogElement>("#details")!;
const notice = document.querySelector<HTMLElement>("#notice")!;
let inherited = false;
let planIds: string[] | null = null;
let cardKind: CardKind = "result";
function pilotOn() { try { return pilotEnabled(localStorage); } catch { return false; } }
function track(event: Parameters<typeof recordPilot>[1]) { try { recordPilot(localStorage,event,g?.mode ?? null); } catch {} }
let light = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ?? false;
try { light = localStorage.getItem("mandats.light") === "true" || light; } catch {}
let g: Game | null = null, saved: Game | null = null, screen: Screen = "select", view: View = "decision", shared = false, ephemeralChallenge = false;
let presidencyController: ReturnType<typeof mountPresidency> | undefined;
let presidencyControllerGame: Game | undefined;
let presidencyAutoplay = false;
let presidencySheetResume: ReturnType<typeof mountPresidency> | undefined;
let progression = (() => { try { return readProgression(localStorage); } catch { return readProgression({getItem:()=>null}); } })();
const decisionTransition = createDecisionTransition();
let boardMotionTimer: number | undefined;
let hudAnimationFrame: number | undefined;
let hudAnimationTargets: Array<{ numberNode: Node; target: string; el: HTMLElement; metric?: HTMLElement }> = [];
let temporarilyDisabledChoices = new Map<HTMLButtonElement, boolean>();
let activeVoteReveal: VoteRecord | null = null;
let decisionVerdict: ReturnType<typeof showDecisionVerdict>;
function clearDecisionVerdict() { decisionVerdict?.dispose(); decisionVerdict = undefined; }
function revealDecisionVerdict(game: Game) {
  clearDecisionVerdict();
  decisionVerdict = (game.version >= 12 ? showMapDecisionVerdict : showDecisionVerdict)(game, () => {
    decisionVerdict = undefined;
    root.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  });
}
let politicalMotionCleanup: (() => void) | undefined;
let branchReference: Game | null = null;
const BRANCH_ACTIVE_KEY = "500signatures.mandats.branch-active.v1";
function clearBranchReference() {
  branchReference = null;
  try { localStorage.removeItem(BRANCH_ACTIVE_KEY); } catch {}
}
function branchMarkerMatches(game: Game): boolean {
  try {
    const raw = localStorage.getItem(BRANCH_ACTIVE_KEY);
    if (!raw) return false;
    const marker = JSON.parse(raw) as { schema?: unknown; seed?: unknown; version?: unknown; mode?: unknown; ambition?: unknown; prefix?: unknown };
    return marker.schema === 1 && marker.seed === game.seed && marker.version === game.version && marker.mode === game.mode &&
      marker.ambition === game.ambition && Array.isArray(marker.prefix) && marker.prefix.every((id, i) => typeof id === "string" && game.choices[i] === id);
  } catch { return false; }
}
function attachBranchReference(game: Game) {
  const reference = branchMarkerMatches(game) ? readBranchReference(localStorage) : null;
  branchReference = reference && sameBranchScenario(reference, game) ? reference : null;
}
function sameBranchScenario(a: Game, b: Game): boolean {
  return a.mode === b.mode && a.version === b.version && a.seed === b.seed && a.ambition === b.ambition && JSON.stringify(a.city) === JSON.stringify(b.city);
}
function clearBoardMotion() {
  if (boardMotionTimer !== undefined) window.clearTimeout(boardMotionTimer);
  boardMotionTimer = undefined;
  if (hudAnimationFrame !== undefined) cancelAnimationFrame(hudAnimationFrame);
  hudAnimationFrame = undefined;
  for (const { numberNode, target, el, metric } of hudAnimationTargets) {
    numberNode.textContent = target;
    el.classList.remove("is-value-changing");
    metric?.classList.remove("is-changing");
  }
  hudAnimationTargets = [];
  const board = root.querySelector<HTMLElement>("[data-mandate-board]");
  board?.classList.remove("is-transitioning", "is-focus-response");
  board?.querySelectorAll(".is-value-changing, .is-arriving, [data-metric].is-changing").forEach(node => node.classList.remove("is-value-changing", "is-arriving", "is-changing"));
  board?.querySelectorAll<HTMLButtonElement>('[data-action="choose"]').forEach(button => button.classList.remove("is-committing"));
  temporarilyDisabledChoices.forEach((disabled, button) => { button.disabled = disabled; });
  temporarilyDisabledChoices.clear();
}
function animateHudValues(board: HTMLElement, oldValues: Map<string, string>) {
  const formatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
  const entries = [...board.querySelectorAll<HTMLElement>("[data-animated-value]")].flatMap(el => {
    const key = el.dataset.animatedValue ?? "";
    const numberNode = el.firstChild;
    const parse = (text: string) => Number(text.replace(/[\u00a0\u202f\s]/g, "").replace(",", ".").match(/-?\d+(?:\.\d+)?/)?.[0]);
    const from = parse(oldValues.get(key) ?? "");
    const to = parse(el.textContent ?? "");
    if (!numberNode || !Number.isFinite(from) || !Number.isFinite(to) || from === to) return [];
    return [{ el, numberNode, from, to, target: numberNode.textContent ?? "", metric: el.closest<HTMLElement>("[data-metric]") ?? undefined }];
  });
  if (!entries.length) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  hudAnimationTargets = entries;
  const start = performance.now();
  entries.forEach(({ el, metric }) => { el.classList.add("is-value-changing"); metric?.classList.add("is-changing"); });
  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / 400);
    const eased = 1 - (1 - t) ** 3;
    for (const { numberNode, from, to, target } of entries) {
      numberNode.textContent = t === 1 ? target : `${formatter.format(from + (to - from) * eased)} `;
    }
    if (t < 1) hudAnimationFrame = requestAnimationFrame(frame);
    else {
      entries.forEach(({ el, metric }) => { el.classList.remove("is-value-changing"); metric?.classList.remove("is-changing"); });
      hudAnimationTargets = [];
      hudAnimationFrame = undefined;
    }
  };
  hudAnimationFrame = requestAnimationFrame(frame);
}
function freshSeed(): number {
  try {
    const values = new Uint16Array(1);
    crypto.getRandomValues(values);
    return values[0] % 10000;
  } catch {
    return Date.now() % 10000;
  }
}
let noticeTimer: number | undefined;
function announce(message: string, quiet = false, tone: "info" | "success" | "error" = "info") {
  if (noticeTimer !== undefined) window.clearTimeout(noticeTimer);
  notice.classList.toggle("status-quiet",quiet);
  const activeNotice = dialog.open ? dialog.querySelector<HTMLElement>(".sheet-status") : notice;
  notice.textContent = "";
  if (activeNotice) { activeNotice.dataset.tone = tone; activeNotice.textContent = message; }
  if (tone === "success" && activeNotice === notice) noticeTimer = window.setTimeout(() => {
    if (notice.textContent === message) notice.textContent = "";
    noticeTimer = undefined;
  }, 4500);
}
function adopt(game: Game) {
  presidencyAutoplay = false;
  announce("");
  ({ g, shared, inherited, screen, view } = localSession(game, history));
  ephemeralChallenge = false;
  planIds = null;
}
try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const candidate = decode(raw); saved = candidate.mode === "national" ? candidate : null; } } catch { announce("La sauvegarde locale est indisponible ou incompatible. Vous pouvez commencer une nouvelle partie."); }
function openEntry() {
  presidencyController?.dispose(); presidencyController = undefined; presidencyControllerGame = undefined; presidencyAutoplay = false;
  g = null; shared = false; inherited = false; ephemeralChallenge = false; screen = "select"; view = "decision"; planIds = null;
  try {
    ({ g, shared, inherited, screen, view } = entrySession(new URL(location.href)));
    const entryUrl = new URL(location.href);
    ephemeralChallenge = !!g && !shared && (g.version === 16 || entryUrl.hash.startsWith("#dilemma=") || entryUrl.hash.startsWith("#challenge=") || (entryUrl.searchParams.has("mode") && entryUrl.searchParams.has("seed")));
    if (g?.version === 16 && saved && encode(g) === encode(saved)) ephemeralChallenge = false;
    if (g?.mode === "municipal") { g = null; shared = false; inherited = false; screen = "select"; view = "decision"; announce("Le mandat communal est temporairement indisponible."); }
  }
  catch (error) { announce(error instanceof Error ? error.message : "Lien invalide."); }
}
openEntry();
if (g && saved && encode(g) === encode(saved)) attachBranchReference(g);
window.addEventListener("hashchange", event => {
  // Ordinary in-page anchors (including the skip link) must not reset a game.
  if (![event.oldURL, event.newURL].some(url => /^#(result|dilemma|challenge)=/.test(new URL(url).hash))) return;
  if (dialog.open) dialog.close();
  decisionTransition.cancel();
  clearBoardMotion();
  activeVoteReveal = null;
  politicalMotionCleanup?.();
  politicalMotionCleanup = undefined;
  branchReference = null;
  announce("");
  openEntry();
  if (g && saved && encode(g) === encode(saved)) attachBranchReference(g);
  render();
});
function render(focus = true, restoreScroll?: number) {
  clearDecisionVerdict();
  clearBoardMotion();
  document.body.dataset.screen = screen;
  document.body.dataset.view = view;
  document.body.dataset.rework = String(!g || g.version >= 12);
  document.body.dataset.presidencyMode = String(g?.version === 16);
  if (g?.version === 16 && (screen === 'play' || screen === 'result') && view === 'decision') {
    document.body.dataset.art = 'cinema'; document.body.dataset.cinema = 'true'; document.body.dataset.mode = 'national';
    if (presidencyController && presidencyControllerGame === g) { presidencyController.update(g); return; }
    presidencyController?.dispose();
    presidencyControllerGame = g;
    presidencyController = mountPresidency(root, g, {
      autoplay: presidencyAutoplay && !ephemeralChallenge && !shared,
      preview: ephemeralChallenge,
      onAdopt: adoptPresidencyPreview,
      commit: commitPresidency,
      comparison: game => branchReference ? `<div class="pr-branch-review">${comparisonMarkup(game, branchReference)}<button data-action="restore-origin">Revenir au mandat d’origine</button></div>` : '',
      openMenu: () => {
        const trigger = document.createElement('button'); trigger.dataset.action = 'tools';
        void action(trigger).catch(error => announce(error instanceof Error ? error.message : 'Le menu ne peut pas être ouvert.'));
      },
    });
    syncMandateMap(root, null, light);
    syncNationalScene(root, null, { light, inherited: false });
    presidencyAutoplay = false;
    (root.querySelector<HTMLElement>('[data-live-notice-slot]') ?? root).append(notice);
    root.dataset.turn = String(g.turn); root.dataset.screen = screen;
    document.querySelector('#game-tools')?.setAttribute('hidden', '');
    return;
  }
  presidencyController?.dispose(); presidencyController = undefined; presidencyControllerGame = undefined;
  if (g?.version === 16 && screen === 'replay') {
    root.innerHTML = `<section class="presidency-replay"><header><strong>MANDATS</strong><span>Votre trajectoire · ${g.turn * 2} mois</span><button class="button" data-action="show-result">Revenir au pays</button></header><div class="presidency-replay__body">${renderReplaySelection(g)}</div></section>`;
    root.after(notice); root.dataset.screen = screen; root.dataset.turn = String(g.turn);
    syncMandateMap(root, null, light); syncNationalScene(root, null, { light, inherited: false });
    if (focus) root.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
    return;
  }
  // The cinematic shell is active throughout the national journey, including
  // the entry/selection screens. Scene focus remains a separate, data-driven hook.
  const nationalCinema = !g || g.mode === "national";
  document.body.dataset.art = nationalCinema ? "cinema" : "default";
  document.body.dataset.cinema = String(nationalCinema);
  const sceneState = g?.mode === "national" ? nationalSceneState(g, inherited) : null;
  document.body.dataset.scene = sceneState?.focus ?? (screen === "select" ? "selection" : screen);
  const lightControl = document.querySelector<HTMLElement>('.header-actions [data-action="light-mode"]');
  lightControl?.setAttribute("aria-pressed", String(light));
  if (lightControl) lightControl.textContent = light ? "Vue illustrée" : "Vue légère";
  document.body.dataset.mode = g?.mode ?? "selection";
  let markup = screen === "select" ? (!saved || saved.version >= 12 ? mapEntry(saved) : selection(saved, light, progression)) : screen === "mandate" ? mandateSetup(g!, {light}) : screen === "briefing" ? yearBriefing(g!) : screen === "year" ? ((g && g.version >= 11) ? gameShell(g!, screen, view, shared, { light, inherited }, planIds ?? g!.choices) : yearRecap(g!)) : screen === "replay" ? (g && g.version>=12 ? mapReplay(g,renderReplaySelection(g)) : renderReplaySelection(g!)) : gameShell(g!, screen, view, shared, { light, inherited }, planIds ?? g!.choices);
  if (ephemeralChallenge && (g && g.version >= 11) && markup.includes('class="story-flow')) {
    const challengeMarkup = document.createElement("template");
    challengeMarkup.innerHTML = markup;
    challengeMarkup.content.querySelector<HTMLElement>(".story-flow")?.insertAdjacentHTML("afterbegin", '<p class="story-flow__challenge-note" role="status">Dilemme partagé · votre partie sauvegardée reste intacte jusqu’à votre choix.</p>');
    markup = challengeMarkup.innerHTML;
  }
  if (branchReference && g && screen === "play" && view === "decision" && g.version >= 9 && g.mode === "national") {
    const withComparison = document.createElement("template");
    withComparison.innerHTML = markup;
    if (g.turn < domainFor(g).turns) {
      const feedback = withComparison.content.querySelector<HTMLElement>("[data-board-feedback]");
      const comparison = comparisonMarkup(g, branchReference);
      if (comparison && feedback) {
        if (feedback.classList.contains("board-feedback--welcome")) feedback.innerHTML = "";
        feedback.classList.remove("board-feedback--welcome");
        feedback.insertAdjacentHTML("beforeend", comparison);
      }
    } else if (g.turn === domainFor(g).turns) {
      const comparison = renderTrajectoryComparison(g, branchReference);
      if (comparison) withComparison.content.querySelector<HTMLElement>(".result")?.insertAdjacentHTML("beforeend", comparison);
    }
    markup = withComparison.innerHTML;
  }
  if (branchReference && g && screen === "play" && view === "finance" && g.version >= 9 && g.mode === "national") {
    const withComparison = document.createElement("template");
    withComparison.innerHTML = markup;
    const comparison = renderTrajectoryComparison(g, branchReference);
    withComparison.content.querySelector<HTMLElement>(".cinema-review > .game-tabs")?.insertAdjacentHTML("afterend", comparison);
    if (g.version >= 12 && comparison) withComparison.content.querySelector<HTMLElement>('[data-map-review]')?.insertAdjacentHTML('beforeend', `<details class="map-subject__details" open><summary>Comparer les deux trajectoires</summary>${comparison}</details>`);
    markup = withComparison.innerHTML;
  }
  if (branchReference && g && screen === "result") {
    const comparison = renderTrajectoryComparison(g, branchReference);
    if (comparison) {
      const resultTemplate = document.createElement("template");
      resultTemplate.innerHTML = markup;
      resultTemplate.content.querySelector<HTMLElement>(".result, [data-map-result]")?.insertAdjacentHTML("beforeend", g.version >= 12 ? `<details class="map-subject__details"><summary>Comparer les deux trajectoires</summary>${comparison}</details>` : comparison);
      markup = resultTemplate.innerHTML;
    }
  }
  if (activeVoteReveal) markup = voteSequenceMarkup(activeVoteReveal);
  if (g && g.version >= 12) markup = markup.replace(/[—–]/g, ' : ').replace(/[←→↗↘↔›‹]/g, '');
  const liveBoard = root.querySelector<HTMLElement>("[data-mandate-board]");
  if (root.querySelector('[data-mandate-map]') && markup.includes('data-mandate-map')) {
    const template = document.createElement('template');
    template.innerHTML = markup;
    const liveMap = root.querySelector<HTMLElement>('[data-mandate-map]')!;
    const freshMap = template.content.querySelector<HTMLElement>('[data-mandate-map]')!;
    const liveMarkers = liveMap.querySelector<HTMLElement>('[data-map-markers]')!;
    const freshMarkers = freshMap.querySelector<HTMLElement>('[data-map-markers]')!;
    liveMarkers.replaceChildren(...freshMarkers.childNodes);
    freshMap.replaceWith(liveMap);
    root.replaceChildren(template.content);
  } else if (!activeVoteReveal && liveBoard && screen === "play" && view === "decision" && g?.mode === "national" && g.version >= 9) {
    const template = document.createElement("template");
    template.innerHTML = markup;
    const nextBoard = template.content.querySelector<HTMLElement>("[data-mandate-board]");
    if (nextBoard) {
      const oldValues = new Map([...liveBoard.querySelectorAll<HTMLElement>("[data-animated-value]")].map(el => [el.dataset.animatedValue ?? "", el.textContent ?? ""]));
      // Keep the board and country scene host mounted between decisions.
      for (const selector of ["[data-board-hud]", "[data-board-decision]", "[data-board-feedback]", ".board-scene-caption"]) {
        const live = liveBoard.querySelector<HTMLElement>(selector);
        const fresh = nextBoard.querySelector<HTMLElement>(selector);
        if (live && fresh) {
          live.innerHTML = fresh.innerHTML;
          live.className = fresh.className;
          const label = fresh.getAttribute("aria-label");
          if (label === null) live.removeAttribute("aria-label"); else live.setAttribute("aria-label", label);
        }
      }
      const liveWorld = liveBoard.querySelector<HTMLElement>(".board-map .national-world");
      const freshWorld = nextBoard.querySelector<HTMLElement>(".board-map .national-world");
      // Keep the scene host (and the mounted country illustration) alive;
      // refresh its surrounding controls and labels from the new game state.
      if (liveWorld && freshWorld) {
        for (const selector of [".national-world-controls", ".national-areas", ".national-world-note"]) {
          const live = liveWorld.querySelector<HTMLElement>(selector);
          const fresh = freshWorld.querySelector<HTMLElement>(selector);
          if (live && fresh) live.innerHTML = fresh.innerHTML;
        }
        const freshStage = freshWorld.querySelector<HTMLElement>("[data-national-scene]");
        const liveStage = liveWorld.querySelector<HTMLElement>("[data-national-scene]");
        const label = freshStage?.querySelector<HTMLElement>(".national-scene-label small")?.textContent;
        const model = freshStage?.querySelector<HTMLElement>(".national-model-label")?.textContent;
        const liveLabel = liveStage?.querySelector<HTMLElement>(".national-scene-label small");
        const liveModel = liveStage?.querySelector<HTMLElement>(".national-model-label");
        if (label && liveLabel) liveLabel.textContent = label;
        if (model && liveModel) liveModel.textContent = model;
        const feedbackFields = ["[data-feedback-title]", "[data-feedback-copy]", "[data-feedback-progress-label]"];
        for (const selector of feedbackFields) {
          const live = liveStage?.querySelector<HTMLElement>(selector);
          const fresh = freshStage?.querySelector<HTMLElement>(selector);
          if (live && fresh) live.textContent = fresh.textContent;
        }
        const liveProgress = liveStage?.querySelector<HTMLElement>("[data-feedback-progress-bar]");
        const freshProgress = freshStage?.querySelector<HTMLElement>("[data-feedback-progress-bar]");
        if (liveProgress && freshProgress) liveProgress.style.width = freshProgress.style.width;
        const liveCountryFeedback = liveStage?.querySelector<HTMLElement>("[data-country-feedback]");
        const freshCountryFeedback = freshStage?.querySelector<HTMLElement>("[data-country-feedback]");
        if (liveCountryFeedback && freshCountryFeedback) liveCountryFeedback.dataset.focus = freshCountryFeedback.dataset.focus ?? "";
      }
      liveBoard.dataset.year = nextBoard.dataset.year ?? "";
      liveBoard.dataset.turn = String(g.turn);
      liveBoard.querySelectorAll<HTMLElement>("[data-metric]").forEach(metric => metric.classList.remove("is-changing"));
      animateHudValues(liveBoard, oldValues);
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        if (boardMotionTimer !== undefined) window.clearTimeout(boardMotionTimer);
        liveBoard.classList.add("is-transitioning");
        liveBoard.classList.add("is-focus-response");
        liveBoard.querySelector<HTMLElement>("[data-national-scene]")?.classList.add("is-focus-response");
        boardMotionTimer = window.setTimeout(() => {
          liveBoard.classList.remove("is-transitioning", "is-focus-response");
          liveBoard.querySelector<HTMLElement>("[data-national-scene]")?.classList.remove("is-focus-response");
          liveBoard.querySelectorAll(".is-value-changing, .is-arriving, [data-metric].is-changing").forEach(node => node.classList.remove("is-value-changing", "is-arriving", "is-changing"));
          boardMotionTimer = undefined;
        }, 450);
        liveBoard.querySelectorAll<HTMLElement>(".board-impact").forEach(item => item.classList.add("is-arriving"));
      } else liveBoard.classList.remove("is-transitioning", "is-focus-response");
    } else root.innerHTML = markup;
  } else if (!activeVoteReveal && (g && g.version >= 11) && g.mode === "national" && root.querySelector<HTMLElement>(".story-scene") && markup.includes('class="story-flow')) {
    const template = document.createElement("template");
    template.innerHTML = markup;
    const liveScene = root.querySelector<HTMLElement>(".story-scene");
    const freshScene = template.content.querySelector<HTMLElement>(".story-scene");
    if (liveScene && freshScene) {
      const previousImage = liveScene.querySelector<HTMLImageElement>(".story-scene__image");
      const previousSrc = previousImage?.getAttribute("src");
      liveScene.className = freshScene.className;
      liveScene.dataset.stage = freshScene.dataset.stage ?? "";
      liveScene.innerHTML = freshScene.innerHTML;
      const nextImage = liveScene.querySelector<HTMLImageElement>(".story-scene__image");
      if (previousImage && nextImage && previousSrc === nextImage.getAttribute("src")) nextImage.replaceWith(previousImage);
      freshScene.replaceWith(liveScene);
      root.replaceChildren(template.content);
    } else root.innerHTML = markup;
  } else root.innerHTML = markup;
  politicalMotionCleanup?.();
  politicalMotionCleanup = undefined;
  if (activeVoteReveal) {
    const record = activeVoteReveal;
    politicalMotionCleanup = mountPoliticalMotion(root, record, { onContinue: () => {
      if (activeVoteReveal?.id !== record.id) return;
      activeVoteReveal = null;
      politicalMotionCleanup?.();
      politicalMotionCleanup = undefined;
      render(true);
    } });
    const voteHeading = root.querySelector<HTMLElement>("[data-political-vote] h2");
    if (voteHeading) { voteHeading.tabIndex = -1; voteHeading.focus({ preventScroll: true }); }
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  syncNationalScene(root, g, { light, inherited });
  syncMandateMap(root, g, light);
  const noticeSlot = root.querySelector<HTMLElement>("[data-situation-notice-slot]") ?? root.querySelector<HTMLElement>("[data-map-notice-slot]");
  if (noticeSlot) noticeSlot.append(notice);
  else root.after(notice);
  root.dataset.turn = String(g?.turn ?? 0);
  root.dataset.screen = screen;
  document.querySelector("#game-tools")!.removeAttribute("hidden");
  if (focus) {
    root.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    if (restoreScroll !== undefined) window.scrollTo({ top: restoreScroll, behavior: "instant" });
  }
}
function persist() {
  if (!g || shared || ephemeralChallenge) return;
  if (g.version === 16) {
    try {
      if (!save(g, localStorage)) throw new Error('Stockage indisponible.');
      saved = g;
    } catch {
      presidencyAutoplay = false; presidencyController?.pause();
      announce('La sauvegarde est indisponible. Le temps est suspendu ; exportez la partie depuis le menu avant de quitter.', false, 'error');
    }
    return;
  }
  saved = g;
  try { if (!save(g, localStorage)) announce("Votre navigateur ne peut pas sauvegarder. Exportez la partie depuis le menu.", false, "error"); } catch { announce("Sauvegarde indisponible. Exportez votre partie depuis le menu.", false, "error"); }
}
/** Publish a live transition only after its journal is durably saved. */
function commitPresidency(id: string): Game | null {
  if (!g || g.version !== 16 || shared || ephemeralChallenge) return null;
  try {
    const next = decide(g, id);
    if (!save(next, localStorage)) throw new Error('La sauvegarde est indisponible. Le temps est suspendu et votre dernière partie enregistrée est conservée. Réessayez ou exportez-la depuis le menu.');
    g = next; saved = next; presidencyControllerGame = next;
    screen = isFinished(next) ? 'result' : 'play';
    root.dataset.turn = String(next.turn); root.dataset.screen = screen;
    if (isFinished(next)) {
      track('game_completed');
      try { progression = recordCompletedMandate(localStorage, next); } catch {}
    }
    announce('');
    return next;
  } catch (error) {
    presidencyController?.pause();
    announce(error instanceof Error ? error.message : 'Cet ordre n’a pas pu être enregistré. Le temps est suspendu.', false, 'error');
    return null;
  }
}
function adoptPresidencyPreview(): Game | null {
  if (!g || g.version !== 16 || !ephemeralChallenge) return null;
  try {
    if (!save(g, localStorage)) throw new Error('La sauvegarde est indisponible. Votre partie locale est conservée ; réessayez pour commencer ce mandat.');
    saved = g; ephemeralChallenge = false; shared = false;
    clearBranchReference(); clearEntryLink(history); announce('');
    return g;
  } catch (error) {
    announce(error instanceof Error ? error.message : 'Ce mandat ne peut pas être enregistré.', false, 'error');
    return null;
  }
}
function sheet(title: string, content: string) {
  if (!dialog.open) presidencySheetResume = presidencyController?.isRunning() ? presidencyController : undefined;
  presidencyController?.pause();
  const replacing = dialog.open;
  dialog.innerHTML = `<div class="sheet-heading"><h2 id="sheet-title">${escape(title)}</h2><button data-action="close" aria-label="Fermer">${(g?.version ?? 0)>=12?'Fermer':icon("close")}</button></div><p class="sheet-status status" role="status" aria-live="polite"></p>${content}`;
  dialog.setAttribute("aria-labelledby", "sheet-title");
  dialog.removeAttribute("aria-label");
  if (!replacing) dialog.showModal();
  else (dialog.querySelector<HTMLElement>("textarea") ?? dialog.querySelector<HTMLElement>("button"))?.focus();
}
dialog.addEventListener('close', () => {
  const paused = presidencySheetResume; presidencySheetResume = undefined;
  if (paused && presidencyController === paused) paused.resume();
});
function presidencyTools() {
  if (!g || g.version !== 16) return;
  const hasOrders = g.choices.some(id => id !== 'live-tick');
  sheet('Votre partie', `<p>Votre mandat est enregistré sur cet appareil. Le temps est suspendu pendant la lecture de ce menu.</p><div class="presidency-session-actions">${hasOrders && !ephemeralChallenge ? '<button class="button" data-action="open-plan">Rejouer un ordre et comparer</button>' : ''}<button class="button" data-action="export">Exporter la sauvegarde</button><label class="button file-input">Importer une sauvegarde<input id="save-file" type="file" accept="application/json,.json"></label><button class="button" data-action="share">Partager ${isFinished(g) ? 'mon mandat' : hasOrders ? 'un ordre' : 'ce défi'}</button></div><details><summary>Jouer hors connexion</summary><p>Préparez le jeu avec une connexion disponible. La simulation et vos sauvegardes restent ensuite sur cet appareil.</p><button class="button" data-action="offline-prepare">Préparer le jeu hors connexion</button><button class="button" data-action="offline-update">Mettre à jour le jeu</button><button class="text-button" data-action="offline-remove">Supprimer la copie hors connexion</button></details><a class="button" href="/mandats/methode/">Règles et méthode</a><button class="button" data-action="new">Choisir un autre mandat</button><a class="button" href="/">Retour au site</a>`);
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function copy(text: string, description = false) {
  try { await navigator.clipboard.writeText(text); announce(description ? "Description copiée." : "Lien copié."); }
  catch { sheet(description ? "Copier la description" : "Copier le lien", `<p>La copie automatique est indisponible. Sélectionnez le texte ci-dessous.</p><textarea readonly aria-label="${description ? "Description à copier" : "Lien à copier"}">${escape(text)}</textarea>`); }
}
async function png(format: keyof typeof CARD_SIZES) {
  if (!g) return;
  const svg = cardSVG(g, cardKind, format); const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = url; });
    const canvas = document.createElement("canvas"); [canvas.width, canvas.height] = CARD_SIZES[format];
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Export image indisponible.");
    ctx.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Export impossible.")), "image/png"));
    download(blob, `mandats-${g.mode}-${cardKind}-${format}.png`); announce("Carte téléchargée. Résultat de simulation fictive.");
  } finally { URL.revokeObjectURL(url); }
}
function shouldRevealPoliticalVote(game: Game, choiceId: string, vote?: VoteRecord): boolean {
  if (!vote || game.version >= 11) return false;
  if (vote.kind !== "law") return true;
  const choice = choicesFor(game).find(item => item.id === choiceId);
  // Keep full seat-by-seat reveals for authored political pivots; routine laws
  // still persist their real tally and appear in the political HUD.
  return choiceId.startsWith("pol-") || !!choice?.political?.commitment || !!choice?.political?.breakCommitment || !!choice?.political?.targetBloc;
}
function sharingSheet() {
  if (!g) return;
  if (g.version === 16 && cardKind === 'result' && !isFinished(g)) cardKind = g.choices.some(id => id !== 'live-tick') ? 'decision' : 'challenge';
  const model = cardModel(g, cardKind);
  sheet("Partager votre mandat", `<div class="card-kind-picker" role="group" aria-label="Type de carte">${([...(isFinished(g) ? ["result"] : []), ...((g.version === 16 ? g.choices.some(id => id !== 'live-tick') : g.turn > 0) ? ["decision"] : []), "challenge"] as CardKind[]).map(kind => `<button class="button" data-action="card-kind" data-kind="${kind}" aria-pressed="${kind === cardKind}">${({result:"Héritage",decision:"Décision",challenge:"Défi"})[kind]}</button>`).join("")}</div><p>${cardKind === "challenge" ? "Le défi contient le point de départ et les règles du jeu, sans votre parcours." : cardKind === "decision" ? "Le lien restitue les décisions antérieures pour replacer le destinataire devant ce dilemme. Votre carte décrit le choix effectué. Partagez le défi pour garder le parcours privé." : "Le lien de résultat permet de reconstruire vos décisions dans le jeu. Partagez le défi pour garder votre parcours privé."}</p><div class="share-preview">${cardSVG(g, cardKind, "landscape")}</div><div class="share-buttons"><button class="button primary" data-action="native-share">Partager ${cardKind === "decision" ? "le dilemme" : cardKind === "challenge" ? "le défi" : "le résultat"}</button><button class="button" data-action="copy-result">Copier le lien</button><button class="button" data-action="copy-description">Copier la description de l’image</button></div><h3>Télécharger la carte</h3><div class="format-buttons">${Object.entries(CARD_SIZES).map(([key,[w,h]])=>`<button class="button" data-action="png" data-format="${key}">${w} × ${h}</button>`).join("")}</div><section class="tool-section"><h3>Texte de la carte</h3><p>${escape(model.alt)}</p></section><p class="scope">Image créée sur votre appareil. Aucun envoi automatique. Les aperçus des réseaux restent génériques ; la carte téléchargée contient votre résultat.</p>`);
}
async function action(target: HTMLElement) {
  const a = target.dataset.action;
  if (a === 'tools' && g?.version === 16) { presidencyTools(); return; }
  if (a === 'map-camera') { moveMapCamera(target.dataset.camera ?? 'reset'); return; }
  if (a === 'map-inspect') {
    if (g && g.version >= 14 && g.mode === 'national' && g.narrative?.focus && matchMedia('(max-width: 820px)').matches) {
      // The phone initiative menu occupies the board; return to the actual map
      // before inspecting a place, without spending a decision.
      g = structuredClone(g); delete g.narrative!.focus; persist(); render(false);
    }
    inspectMapPlace(target.dataset.place ?? '');
    if (matchMedia('(max-width: 820px)').matches) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      root.querySelector<HTMLElement>('[data-map-marker][aria-pressed="true"]:not([hidden])')?.focus({ preventScroll: true });
    } else {
      // Inspecting the map keeps the subject open. Restore its heading after
      // the native click has scrolled a long subject to the location control.
      root.querySelector<HTMLElement>('[data-map-decision]')?.scrollTo({ top: 0, behavior: 'instant' });
    }
    return;
  }
  if (a === 'map-government' && g && g.version >= 12) { sheet('Gouvernement', mapGovernmentPanel(g)); return; }
  if (a === 'map-projects' && g && g.version >= 12) { sheet('Projets', mapProjectsPanel(g)); return; }
  if (a === 'map-track' && g) {
    const project=g.narrative?.projects.find(item=>item.id===target.dataset.trackId);
    const movement=g.social?.movements.find(item=>item.id===target.dataset.trackId);
    if(project)sheet(project.label,`<p>${escape(project.note)}</p><p>Consulter cet engagement ne fait pas avancer le mandat.</p>`);
    else if(movement?.commitment)sheet(movement.demand,`<p>Les moyens votés sont en préparation. Leur mise en place est attendue à la décision ${movement.commitment.dueTurn}.</p><p>La mobilisation reste active jusque-là.</p>`);
    return;
  }
  if (a === 'map-close' && g?.narrative) {
    g = structuredClone(g);delete g.narrative!.focus;persist();render(false);
    (root.querySelector<HTMLElement>('[data-map-marker]:not([hidden])') ??
      root.querySelector<HTMLElement>('[data-map-agenda] button, [data-map-agenda] h1'))?.focus({ preventScroll: true });return;
  }
  if (a === "dismiss-verdict") { decisionVerdict?.dismiss(); return; }
  if ((g?.version ?? 0) < 12 && decisionVerdict && (a === "choose" || a === "story-select")) return;
  if (decisionVerdict) clearDecisionVerdict();
  if (decisionTransition.locked) {
    if (a !== "new" && a !== "replay") return;
    decisionTransition.cancel();
  }
  const actionScroll = window.scrollY;
  if (a === "light-mode") {
    const inDialog = dialog.contains(target), inPanel = root.contains(target);
    light = !light;
    try { localStorage.setItem("mandats.light", String(light)); } catch {}
    if (dialog.open) dialog.close();
    render(false);
    const nextFocus = inDialog ? (root.querySelector<HTMLElement>('.map-game__header [data-action="tools"], .game-tabs [data-action="tools"]') ?? document.querySelector<HTMLElement>("#game-tools")) : inPanel ? root.querySelector<HTMLElement>('[data-action="light-mode"]') : target;
    nextFocus?.focus({ preventScroll: true });
    return;
  }
  if (a === "world-view") { inherited = !inherited; render(false); document.querySelector<HTMLElement>('[data-action="world-view"]')?.focus({ preventScroll: true }); return; }
  if (a === "pick-city" || a === "fictional-city") { announce("Le mandat communal est temporairement indisponible."); return; }
  if (a === "pilot-consent") { try { setPilotConsent(localStorage,!pilotEnabled(localStorage)); announce(pilotEnabled(localStorage) ? "Journal de test activé localement. Aucun envoi et aucune décision enregistrée." : "Journal de test désactivé et effacé."); target.setAttribute("aria-pressed",String(pilotEnabled(localStorage))); } catch { announce("Le stockage local est indisponible."); } return; }
  if (a === "pilot-export") { download(new Blob([JSON.stringify({version:1,events:readPilot(localStorage)},null,2)],{type:"application/json"}),"mandats-journal-test.json"); announce("Journal exporté sur votre appareil, sans envoi."); return; }
  if (a === "offline-prepare") { announce("Téléchargement du jeu pour jouer sans connexion…"); const result = await prepareOffline(); announce(result.update ? "Une mise à jour est prête. Utilisez Mettre à jour le jeu pour l’activer." : "Le jeu est prêt hors connexion. Votre navigateur peut libérer ce stockage ; exportez les parties importantes."); return; }
  if (a === "offline-update") { await updateOffline(); return; }
  if (a === "offline-remove") { await removeOffline(); announce("Copie hors connexion supprimée. Vos sauvegardes sont conservées."); return; }
  if (a === "plan-reset" && g) { planIds = [...g.choices]; render(); return; }
  if (a === "open-plan" && g) {
    if (ephemeralChallenge) { announce('Jouez un premier choix pour comparer les décisions de ce mandat.'); return; }
    dialog.close();
    if (g.mode === "national" && g.version >= 11) {
      screen = (g.version === 16 ? g.choices.length > 0 : g.turn > 0) ? "replay" : "play";
      view = "decision";
    } else { screen = "play"; view = "plan"; }
    render(); return;
  }
  if (a === "share-decision" && g) { cardKind = "decision"; sharingSheet(); return; }
  if (a === "card-kind" && g) { cardKind = target.dataset.kind as CardKind; sharingSheet(); dialog.querySelector<HTMLElement>(`[data-kind="${cardKind}"]`)?.focus(); return; }
  if (a === "copy-description" && g) { await copy(cardModel(g, cardKind).alt, true); return; }
  if (a === "area" && g) {
    const area = (inherited ? domainFor(g).initial().areas : g.areas).find(a => a.id === target.dataset.area);
    if (!area) return;
    const before = domainFor(g).initial().areas.find(a => a.id === area.id)!;
    const pending = g.pending.filter(p => p.effect.area === area.id);
    sheet(area.name, `<p class="eyebrow">${inherited ? "À LA PRISE DE FONCTIONS" : "ÉTAT DU TERRITOIRE"}</p><p>${escape(area.need)}</p><div class="area-detail"><div><span>Services</span><strong>${Math.round(area.services)}/100</strong><small>Héritage : ${before.services}/100</small></div><div><span>Résilience</span><strong>${Math.round(area.resilience)}/100</strong><small>Héritage : ${before.resilience}/100</small></div></div>${!inherited && pending.length ? `<h3>À la livraison</h3><ul>${pending.map(p => `<li>Année ${p.due + 1} : ${escape(p.label)}</li>`).join("")}</ul>` : ""}<p class="scope">Ces indices suivent les règles du mandat.</p>`);
    return;
  }
  if (a === "close") { dialog.close(); return; }
  if (a === "mode") {
    if (target.dataset.mode !== "national") { announce("Le mandat communal est temporairement indisponible."); return; }
    if (g) track("mode_switched");
    g = start("national", freshSeed(), "equilibre", 16); presidencyAutoplay = true;
    clearBranchReference();
    shared = false; inherited = false; ephemeralChallenge = false; screen = "play"; view = "decision"; planIds = null;
    clearEntryLink(history); track("mode_selected"); persist();
  }
  else if (a === "choose-mission" && g) {
    const ambition = target.dataset.ambition as Ambition;
    if (!["equilibre","services","resilience"].includes(ambition)) { announce("Mission inconnue."); return; }
    g = start("national", g.seed, ambition, g.version >= 16 ? 16 : g.version >= 15 ? 15 : g.version >= 14 ? 14 : g.version >= 13 ? 13 : g.version >= 12 ? 12 : g.version >= 11 ? 11 : g.version >= 10 ? 10 : 9);
    clearBranchReference();
    shared = false; inherited = false; screen = g.version === 16 ? 'play' : "briefing"; view = "decision"; planIds = null; presidencyAutoplay = g.version === 16;
    persist(); track("onboarding_completed");
  }
  else if (a === "resume" && saved) { if (saved.mode !== "national") { announce("Le mandat communal est temporairement indisponible."); return; } adopt(saved); attachBranchReference(g!); }
  else if (a === "choose" && g) {
    if (g.mode === "national" && g.version >= 9 && screen === "play" && view === "decision") {
      const token = decisionTransition.begin();
      if (token === null) return;
      temporarilyDisabledChoices = new Map([...root.querySelectorAll<HTMLButtonElement>('[data-action="choose"]')].map(button => [button, button.disabled]));
      target.classList.add("is-committing");
      root.querySelectorAll<HTMLButtonElement>('[data-action="choose"]').forEach(button => { button.disabled = true; });
      let next: Game;
      try { next = decide(g, target.dataset.choice!); }
      catch (error) {
        decisionTransition.cancel();
        target.classList.remove("is-committing");
        temporarilyDisabledChoices.forEach((disabled, button) => { button.disabled = disabled; });
        temporarilyDisabledChoices.clear();
        announce(error instanceof Error ? error.message : "Cette décision n’a pas pu être appliquée.");
        return;
      }
      const voteToReveal = next.version >= 10 && shouldRevealPoliticalVote(g, target.dataset.choice!, next.history.at(-1)?.vote) ? next.history.at(-1)!.vote! : null;
      const yearClosed = next.version >= 9 && next.history.at(-1)?.closed;
      adopt(next);
      const finished = isFinished(next);
      if (finished) screen = "result";
      else if (yearClosed) screen = "year";
      announce(`Décision ${next.turn} prise. ${finished ? "Votre mandat est terminé." : yearClosed ? "L’année est terminée." : "Dossier suivant."}`, true);
      persist();
      activeVoteReveal = voteToReveal;
      if (next.turn === 1) track("first_decision");
      if (finished) {
        track("game_completed");
        try { progression = recordCompletedMandate(localStorage, next); } catch {}
      }
      decisionTransition.finish(token, () => {
        render(false);
        if (yearClosed || next.version >= 11) window.scrollTo({ top: 0, behavior: "instant" });
        else {
          const question = root.querySelector<HTMLElement>("[data-board-decision] h1");
          if (question) {
            const box = question.getBoundingClientRect();
            if (box.top < 12 || box.bottom > window.innerHeight - 24) {
              window.scrollTo({ top: Math.max(0, window.scrollY + box.top - 24), behavior: "instant" });
            }
          }
        }
        if (next.version >= 11) revealDecisionVerdict(next);
        else (root.querySelector<HTMLElement>("[data-mandate-board] [data-board-decision] h1, .dossier h1") ?? root.querySelector<HTMLElement>("h1"))?.focus({ preventScroll: true });
      }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 110);
      return;
    }
    const next = decide(g, target.dataset.choice!);
    const voteToReveal = next.version >= 10 && shouldRevealPoliticalVote(g, target.dataset.choice!, next.history.at(-1)?.vote) ? next.history.at(-1)!.vote! : null;
    const yearClosed = next.version >= 9 && next.history.at(-1)?.closed;
    adopt(next);
    const finished = isFinished(next);
    if (finished) screen = "result";
    else if (yearClosed) screen = "year";
    announce(`Décision ${next.turn} prise. ${finished ? "Votre mandat est terminé." : yearClosed ? "L’année est terminée." : "Dossier suivant."}`,true);
    persist();
    activeVoteReveal = voteToReveal;
    if (next.turn === 1) track("first_decision");
    if (finished) {
      track("game_completed");
      try { progression = recordCompletedMandate(localStorage,next); } catch {}
    }
  }
  else if (a === "story-select" && (g && g.version >= 11) && g.mode === "national") {
    try { g = selectStoryAgenda(g, target.dataset.storyId ?? ""); screen = "play"; view = "decision"; persist(); }
    catch (error) { announce(error instanceof Error ? error.message : "Ce dossier n’est plus disponible."); return; }
  }
  else if (a === "start-context" && g === null) {
    const context = target.dataset.context;
    const option = storyContextOptions().find(item => item.context === context);
    if (!option) { announce("Ce contexte n’est plus disponible."); return; }
    clearBranchReference(); g = start("national", option.seed, "equilibre", 16); presidencyAutoplay = true; shared = false; inherited = false; ephemeralChallenge = false; screen = "play"; view = "decision"; planIds = null; clearEntryLink(history); persist();
  }
  else if (a === "next-year" && g) { screen = g.version >= 11 && g.mode === "national" ? "play" : "briefing"; view = "decision"; }
  else if (a === "start-year" && g) { screen = "play"; view = "decision"; }
  else if (a === "show-result" && g) { screen = isFinished(g) ? "result" : "play"; view = "decision"; }
  else if (a === "view") {
    view = target.dataset.view as View;
    if (g && g.version >= 14 && view === "decision" && target.closest(".map-game__footer") && g.narrative) {
      g = structuredClone(g); delete g.narrative!.focus; persist();
    }
    if (g && g.version >= 12 && screen === "replay") screen = isFinished(g) ? "result" : "play";
    if ((g && g.version >= 11) && g.mode === "national" && view === "finance" && screen === "year") screen = "play";
  }
  else if (a === "new") { clearBranchReference(); inherited = false; ephemeralChallenge = false; screen = "select"; shared = false; g = null; planIds = null; clearEntryLink(history); }
  else if (a === "new-run") { clearBranchReference(); g = start("national", freshSeed(), "equilibre", 16); presidencyAutoplay = true; shared = false; inherited = false; ephemeralChallenge = false; screen = "play"; view = "decision"; planIds = null; clearEntryLink(history); persist(); }
  else if (a === "replay" && g) { clearBranchReference(); track("replay_started"); adopt(startingGame(g)); presidencyAutoplay = g!.version === 16; persist(); }
  else if (a === "open-replay-selection" && g) { screen = "replay"; view = "decision"; planIds = null; }
  else if (a === "restore-origin" && g) {
    if (branchReference) {
      const original = branchReference;
      try {
        if (!save(original, localStorage)) throw new Error('Sauvegarde indisponible.');
      } catch {
        announce('Votre navigateur ne peut pas restaurer le mandat d’origine. Votre branche reste inchangée ; vous pourrez réessayer ou l’exporter.', false, 'error');
        return;
      }
      clearBranchReference();
      adopt(original);
      saved = original;
    } else screen = isFinished(g) ? "result" : "play";
  }
  else if (a === "continue-branch" && g) { screen = "play"; view = "decision"; planIds = null; persist(); }
  else if ((a === "branch-replay" || a === "replay-branch") && g) {
    if (ephemeralChallenge) { announce('Jouez un premier choix pour comparer les décisions de ce mandat.'); return; }
    try {
      const source = g;
      const reference = branchReference && sameBranchScenario(branchReference, source) ? branchReference : source;
      const branch = createBranch(source, Number(target.dataset.turn));
      const previousArchive = localStorage.getItem(BRANCH_REFERENCE_KEY);
      const previousMarker = localStorage.getItem(BRANCH_ACTIVE_KEY);
      let archived = false, marked = false;
      try {
        if (!saveBranchReference(localStorage, reference)) throw new Error('Archive indisponible.');
        archived = true;
        localStorage.setItem(BRANCH_ACTIVE_KEY, JSON.stringify({ schema: 1, seed: branch.seed, version: branch.version, mode: branch.mode, ambition: branch.ambition, prefix: branch.choices }));
        marked = true;
        if (!save(branch, localStorage)) throw new Error('Sauvegarde indisponible.');
      } catch {
        let restored = true;
        try {
          // Free the partial writes before reinstating the previous records,
          // which may belong to a local branch behind a shared preview.
          if (marked) localStorage.removeItem(BRANCH_ACTIVE_KEY);
          if (archived) localStorage.removeItem(BRANCH_REFERENCE_KEY);
          if (archived && previousArchive !== null) localStorage.setItem(BRANCH_REFERENCE_KEY, previousArchive);
          if (marked && previousMarker !== null) localStorage.setItem(BRANCH_ACTIVE_KEY, previousMarker);
        } catch { restored = false; }
        announce(restored
          ? 'Votre navigateur ne peut pas conserver le mandat d’origine. Votre partie reste inchangée ; exportez-la avant de la rejouer.'
          : 'Le rejeu n’a pas pu être enregistré. Le stockage est indisponible ; exportez votre partie avant de fermer cette page.', false, 'error');
        return;
      }
      g = branch;
      saved = branch;
      branchReference = reference;
      shared = false; inherited = false; screen = "play"; view = "decision"; planIds = null;
      clearEntryLink(history);
    } catch (error) { announce(error instanceof Error ? error.message : "Ce parcours ne peut pas être rejoué."); return; }
  }
  else if (a === "helper") { sheet("Votre mandat", "<p><strong>La France</strong> : fiscalité, services publics, énergie et dette, avec des effets à l’échelle de profils territoriaux. Le parcours peut compter jusqu’à 30 décisions sur cinq années, et une issue politique peut l’interrompre plus tôt.</p><p>Le parcours est entièrement jouable sur téléphone, sans compte.</p>"); return; }
  else if (a === "method") { sheet("Comprendre les conséquences", `<p>Le mandat national part des comptes publics français. Les coûts des mesures, les effets sociaux et les trajectoires budgétaires sont des hypothèses de simulation documentées dans la méthode.</p><p>Une partie comporte jusqu’à 30 décisions sur cinq années. Une issue politique peut interrompre le mandat plus tôt. Intérêts, dette et déficit sont comptabilisés une seule fois à chaque clôture annuelle. Les conséquences continuent d’exister même lorsqu’elles ne créent pas de nouvelle carte.</p><p>${(g && g.version >= 11)?"Le contexte choisi au départ donne une situation initiale au mandat; les décisions et leurs effets restent calculés par le moteur de simulation.":"La mission choisie au départ change la lecture du bilan."} Le résultat final reste multidimensionnel et n’attribue pas de note globale au gouvernement simulé.</p><a class="button" href="/mandats/methode/">Lire les règles et les sources</a>`); return; }
  else if (a === "tools") { sheet("Votre partie", `<p>La sauvegarde reste dans ce navigateur. Pour changer d'appareil, exportez puis importez le fichier.</p>${g && screen !== "mandate" ? `${!ephemeralChallenge && (g.version < 11 || g.turn > 0) ? `<button class="button" data-action="open-plan">Comparer une autre stratégie</button>` : ""}<button class="button" data-action="export">Exporter la sauvegarde</button>` : ""}<label class="button file-input">Importer une sauvegarde<input id="save-file" type="file" accept="application/json,.json"></label><button class="button" data-action="light-mode" aria-pressed="${light}">${light ? "Activer les animations" : "Réduire les animations"}</button><details><summary>Participer à la validation du jeu</summary><p>Enregistrez uniquement les étapes et leur date sur cet appareil, sans les décisions, scores, nom ou identifiant. Rien n’est envoyé. Export limité aux 30 derniers jours et à 500 événements. Désactiver efface ce journal.</p><button class="button" data-action="pilot-consent" aria-pressed="${pilotOn()}">Enregistrer les étapes de test</button><button class="button" data-action="pilot-export">Exporter mon journal de test</button></details><section class="tool-section"><h3>Installer et jouer hors connexion</h3><p>Sur iPhone : Partager puis Sur l’écran d’accueil. Sur Android : menu du navigateur puis Installer l’application. Le jeu fonctionne aussi dans votre navigateur.</p><button class="button" data-action="offline-prepare">Préparer le jeu hors connexion</button><button class="button" data-action="offline-update">Mettre à jour le jeu</button><button class="text-button" data-action="offline-remove">Supprimer la copie hors connexion</button><p>Le jeu et ses règles sont téléchargés. Les règles et les données du mandat sont conservées dans votre sauvegarde.</p></section><button class="text-button" data-action="new">Choisir un autre mandat</button><a class="button" href="/">Retour au site</a>`); return; }
  else if (a === "export" && g) { download(new Blob([encode(g)], { type: "application/json" }), `mandats-sauvegarde-v${g.version}.json`); return; }
  else if (a === "share" && g) { cardKind = "result"; sharingSheet(); return; }
  else if (a === "copy-result" && g) { await copy(cardURL(g, cardKind, location.origin)); return; }
  else if (a === "copy-challenge" && g) { await copy(challengeURL(g, location.origin)); return; }
  else if (a === "native-share" && g) {
    track("share_initiated"); const url = cardURL(g, cardKind, location.origin);
    if (navigator.share) { try { await navigator.share({ title: "Mon héritage · Mandats", text: cardModel(g, cardKind).alt, url }); } catch (err) { if (!(err instanceof Error && err.name === "AbortError")) await copy(url); } }
    else await copy(url);
    return;
  } else if (a === "png") { await png(target.dataset.format as keyof typeof CARD_SIZES); return; }
  else return;
  if (dialog.open) dialog.close();
  const newChapter = ["mode", "next-year", "start-year", "show-result", "new-run", "replay", "branch-replay", "resume", "open-replay-selection", "restore-origin"].includes(a ?? "");
  render(true, a === "choose" ? actionScroll : newChapter || a === "story-select" ? 0 : undefined);
  if(a === "choose" && g?.mode === "national" && g.version >= 8 && matchMedia("(max-width:820px) and (min-height:501px)").matches) {
    const question=root.querySelector<HTMLElement>(".dossier");
    if(question && question.getBoundingClientRect().top < 0) window.scrollTo({top:window.scrollY+question.getBoundingClientRect().top-12,behavior:"instant"});
  }
}
let lastAcceptedClickAction: string | null = null;
document.addEventListener("click", event => {
  const target = (event.target as Element).closest<HTMLElement>("[data-action]");
  if (!target || (target as HTMLButtonElement).disabled) return;
  const actionName = target.dataset.action;
  const canStartDuringTransition = !decisionTransition.locked || actionName === "new" || actionName === "replay";
  // Browsers increment click.detail across different touch targets too. Only suppress
  // a repeated choice after another choice was accepted; the first choice after the
  // entry action can otherwise arrive with detail > 1 and be lost.
  if (actionName === "choose" && (event as MouseEvent).detail > 1 && lastAcceptedClickAction === "choose" && canStartDuringTransition) return;
  if (canStartDuringTransition) lastAcceptedClickAction = actionName === "choose" ? "choose" : null;
  action(target).catch(err => announce(err instanceof Error ? err.message : "Cette action n'a pas pu aboutir."));
});
window.addEventListener("pagehide", () => {
  presidencyController?.pause();
  clearDecisionVerdict();
  decisionTransition.cancel();
  clearBoardMotion();
  activeVoteReveal = null;
  politicalMotionCleanup?.();
  politicalMotionCleanup = undefined;
});
window.addEventListener("pageshow", event => {
  if (event.persisted) render(false);
});
document.addEventListener("change", async event => {
  const input = event.target as HTMLInputElement;
  if (input.matches("[data-plan-year]") && g) {
    const year = Number(input.dataset.planYear);
    planIds = [...(planIds ?? g.choices)];
    planIds[year] = input.value;
    planIds = planIds.slice(0, year + 1);
    render(false);
    root.querySelector<HTMLElement>(`[data-plan-year="${year}"]`)?.focus();
    announce("Plan alternatif recalculé. Votre sauvegarde est intacte.");
    return;
  }
  if (input.id !== "save-file" || !input.files?.[0]) return;
  decisionTransition.cancel();
  try {
    if (input.files[0].size > MAX_SAVE_BYTES) throw new Error("Fichier trop volumineux.");
    const imported = decode(await input.files[0].text());
    if (imported.version === 16 && !save(imported, localStorage)) throw new Error('L’import ne peut pas être sauvegardé. Votre partie précédente est conservée.');
    clearBranchReference(); adopt(imported); dialog.close(); render();
    announce("Partie importée et recalculée.", false, "success"); persist();
  }
  catch (err) { announce(err instanceof Error ? err.message : "Import impossible."); }
});
render(false);
