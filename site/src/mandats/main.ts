import { syncNationalScene } from "./national-scene.ts";
import { icon } from "./icons.ts";
import "./game.css";
import "../styles/shared-design.css";
import "../styles/site-shell-v2.css";
import "./approved-decision-room.css";
import "./mandats-2026-rework.css";
import { decide, domainFor, startingGame, start } from "./engine.ts";
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
import { comparisonMarkup, createBranch, readBranchReference, renderReplaySelection, renderTrajectoryComparison, saveBranchReference } from "./branch-replay.ts";
import "./living-board.css";
import "./country-feedback.css";
import "./branch-replay.css";
import "./living-recaps.css";
import "./decision-motion.css";
import "./cinema-board.css";
import "./cinema-shell.css";

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
let g: Game | null = null, saved: Game | null = null, screen: Screen = "select", view: View = "decision", shared = false;
let progression = (() => { try { return readProgression(localStorage); } catch { return readProgression({getItem:()=>null}); } })();
const decisionTransition = createDecisionTransition();
let boardMotionTimer: number | undefined;
let hudAnimationFrame: number | undefined;
let hudAnimationTargets: Array<{ numberNode: Node; target: string; el: HTMLElement; metric?: HTMLElement }> = [];
let temporarilyDisabledChoices = new Map<HTMLButtonElement, boolean>();
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
function announce(message: string, quiet = false) {
  notice.classList.toggle("status-quiet",quiet);
  const activeNotice = dialog.open ? dialog.querySelector<HTMLElement>(".sheet-status") : notice;
  notice.textContent = "";
  if (activeNotice) activeNotice.textContent = message;
}
function adopt(game: Game) {
  announce("");
  ({ g, shared, inherited, screen, view } = localSession(game, history));
  planIds = null;
}
try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const candidate = decode(raw); saved = candidate.mode === "national" ? candidate : null; } } catch { announce("La sauvegarde locale est indisponible ou incompatible. Vous pouvez commencer une nouvelle partie."); }
function openEntry() {
  g = null; shared = false; inherited = false; screen = "select"; view = "decision"; planIds = null;
  try {
    ({ g, shared, inherited, screen, view } = entrySession(new URL(location.href)));
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
  branchReference = null;
  announce("");
  openEntry();
  if (g && saved && encode(g) === encode(saved)) attachBranchReference(g);
  render();
});
function render(focus = true, restoreScroll?: number) {
  clearBoardMotion();
  document.body.dataset.screen = screen;
  document.body.dataset.view = view;
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
  let markup = screen === "select" ? selection(saved, light, progression) : screen === "mandate" ? mandateSetup(g!, {light}) : screen === "briefing" ? yearBriefing(g!) : screen === "year" ? yearRecap(g!) : screen === "replay" ? renderReplaySelection(g!) : gameShell(g!, screen, view, shared, { light, inherited }, planIds ?? g!.choices);
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
    markup = withComparison.innerHTML;
  }
  if (branchReference && g && screen === "result") {
    const comparison = renderTrajectoryComparison(g, branchReference);
    if (comparison) {
      const resultTemplate = document.createElement("template");
      resultTemplate.innerHTML = markup;
      resultTemplate.content.querySelector<HTMLElement>(".result")?.insertAdjacentHTML("beforeend", comparison);
      markup = resultTemplate.innerHTML;
    }
  }
  const liveBoard = root.querySelector<HTMLElement>("[data-mandate-board]");
  if (liveBoard && screen === "play" && view === "decision" && g?.mode === "national" && g.version >= 9) {
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
  } else root.innerHTML = markup;
  syncNationalScene(root, g, { light, inherited });
  document.querySelector("#game-tools")!.removeAttribute("hidden");
  if (focus) {
    root.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    if (restoreScroll !== undefined) window.scrollTo({ top: restoreScroll, behavior: "instant" });
  }
}
function persist() {
  if (!g || shared) return;
  saved = g;
  try { if (!save(g, localStorage)) announce("Votre navigateur ne peut pas sauvegarder. Exportez la partie depuis le menu."); } catch { announce("Sauvegarde indisponible. Exportez votre partie depuis le menu."); }
}
function sheet(title: string, content: string) {
  const replacing = dialog.open;
  dialog.innerHTML = `<div class="sheet-heading"><h2 id="sheet-title">${escape(title)}</h2><button data-action="close" aria-label="Fermer">${icon("close")}</button></div><p class="sheet-status status" role="status" aria-live="polite"></p>${content}`;
  dialog.setAttribute("aria-labelledby", "sheet-title");
  dialog.removeAttribute("aria-label");
  if (!replacing) dialog.showModal();
  else (dialog.querySelector<HTMLElement>("textarea") ?? dialog.querySelector<HTMLElement>("button"))?.focus();
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
function sharingSheet() {
  if (!g) return;
  const model = cardModel(g, cardKind);
  sheet("Partager votre mandat", `<div class="card-kind-picker" role="group" aria-label="Type de carte">${([...(g.turn === domainFor(g).turns ? ["result"] : []), ...(g.turn ? ["decision"] : []), "challenge"] as CardKind[]).map(kind => `<button class="button" data-action="card-kind" data-kind="${kind}" aria-pressed="${kind === cardKind}">${({result:"Héritage",decision:"Décision",challenge:"Défi"})[kind]}</button>`).join("")}</div><p>${cardKind === "challenge" ? "Le défi contient le point de départ et les règles du jeu, sans votre parcours." : cardKind === "decision" ? "Le lien restitue les décisions antérieures pour replacer le destinataire devant ce dilemme. Votre carte décrit le choix effectué. Partagez le défi pour garder le parcours privé." : "Le lien de résultat permet de reconstruire vos décisions dans le jeu. Partagez le défi pour garder votre parcours privé."}</p><div class="share-preview">${cardSVG(g, cardKind, "landscape")}</div><div class="share-buttons"><button class="button primary" data-action="native-share">Partager ${cardKind === "decision" ? "le dilemme" : cardKind === "challenge" ? "le défi" : "le résultat"}</button><button class="button" data-action="copy-result">Copier le lien</button><button class="button" data-action="copy-description">Copier la description de l’image</button></div><h3>Télécharger la carte</h3><div class="format-buttons">${Object.entries(CARD_SIZES).map(([key,[w,h]])=>`<button class="button" data-action="png" data-format="${key}">${w} × ${h}</button>`).join("")}</div><section class="tool-section"><h3>Texte de la carte</h3><p>${escape(model.alt)}</p></section><p class="scope">Image créée sur votre appareil. Aucun envoi automatique. Les aperçus des réseaux restent génériques ; la carte téléchargée contient votre résultat.</p>`);
}
async function action(target: HTMLElement) {
  const a = target.dataset.action;
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
    const nextFocus = inDialog ? (root.querySelector<HTMLElement>('.game-tabs [data-action="tools"]') ?? document.querySelector<HTMLElement>("#game-tools")) : inPanel ? root.querySelector<HTMLElement>('[data-action="light-mode"]') : target;
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
  if (a === "open-plan" && g) { dialog.close(); screen = "play"; view = "plan"; render(); return; }
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
    g = start("national", freshSeed(), "equilibre", 9);
    clearBranchReference();
    // Equilibre is the default mission so new play starts with a decision.
    shared = false; inherited = false; screen = "play"; view = "decision"; planIds = null;
    clearEntryLink(history); track("mode_selected"); persist();
  }
  else if (a === "choose-mission" && g) {
    const ambition = target.dataset.ambition as Ambition;
    if (!["equilibre","services","resilience"].includes(ambition)) { announce("Mission inconnue."); return; }
    g = start("national", g.seed, ambition, 9);
    clearBranchReference();
    shared = false; inherited = false; screen = "briefing"; view = "decision"; planIds = null;
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
      const yearClosed = next.version >= 9 && next.history.at(-1)?.closed;
      adopt(next);
      if (yearClosed) screen = "year";
      announce(`Décision ${next.turn} prise. ${yearClosed ? "L’année est terminée." : next.turn === domainFor(next).turns ? "Votre bilan est prêt." : "Dossier suivant."}`, true);
      persist();
      if (next.turn === 1) track("first_decision");
      if (next.turn === domainFor(next).turns) {
        track("game_completed");
        try { progression = recordCompletedMandate(localStorage, next); } catch {}
      }
      decisionTransition.finish(token, () => {
        render(false);
        if (yearClosed) window.scrollTo({ top: 0, behavior: "instant" });
        else {
          const question = root.querySelector<HTMLElement>("[data-board-decision] h1");
          if (question) {
            const box = question.getBoundingClientRect();
            if (box.top < 12 || box.bottom > window.innerHeight - 24) {
              window.scrollTo({ top: Math.max(0, window.scrollY + box.top - 24), behavior: "instant" });
            }
          }
        }
        (root.querySelector<HTMLElement>("[data-mandate-board] [data-board-decision] h1, .dossier h1") ?? root.querySelector<HTMLElement>("h1"))?.focus({ preventScroll: true });
      }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 110);
      return;
    }
    const next = decide(g, target.dataset.choice!);
    const yearClosed = next.version >= 9 && next.history.at(-1)?.closed;
    adopt(next);
    if (yearClosed) screen = "year";
    announce(`Décision ${next.turn} prise. ${yearClosed ? "L’année est terminée." : next.turn === domainFor(next).turns ? "Votre bilan est prêt." : "Dossier suivant."}`,true);
    persist();
    if (next.turn === 1) track("first_decision");
    if (next.turn === domainFor(next).turns) {
      track("game_completed");
      try { progression = recordCompletedMandate(localStorage,next); } catch {}
    }
  }
  else if (a === "next-year" && g) { screen = "briefing"; view = "decision"; }
  else if (a === "start-year" && g) { screen = "play"; view = "decision"; }
  else if (a === "show-result" && g) { screen = "result"; view = "decision"; }
  else if (a === "view") { view = target.dataset.view as View; }
  else if (a === "new") { clearBranchReference(); inherited = false; screen = "select"; shared = false; g = null; planIds = null; clearEntryLink(history); }
  else if (a === "new-run") { clearBranchReference(); g = start("national", freshSeed(), "equilibre", 9); shared = false; inherited = false; screen = "play"; view = "decision"; planIds = null; clearEntryLink(history); persist(); }
  else if (a === "replay" && g) { clearBranchReference(); track("replay_started"); adopt(startingGame(g)); persist(); }
  else if (a === "open-replay-selection" && g) { screen = "replay"; view = "decision"; planIds = null; }
  else if (a === "restore-origin" && g) {
    if (branchReference) {
      const original = branchReference;
      branchReference = null; clearBranchReference();
      adopt(original);
      persist();
    } else screen = "result";
  }
  else if (a === "continue-branch" && g) { screen = "play"; view = "decision"; planIds = null; persist(); }
  else if ((a === "branch-replay" || a === "replay-branch") && g) {
    try {
      const source = g;
      const reference = branchReference && sameBranchScenario(branchReference, source) ? branchReference : source;
      g = createBranch(source, Number(target.dataset.turn));
      let archived = false;
      try { archived = saveBranchReference(localStorage, reference); } catch {}
      branchReference = reference;
      try {
        if (archived) localStorage.setItem(BRANCH_ACTIVE_KEY, JSON.stringify({ schema: 1, seed: g.seed, version: g.version, mode: g.mode, ambition: g.ambition, prefix: g.choices }));
        else localStorage.removeItem(BRANCH_ACTIVE_KEY);
      } catch {}
      shared = false; inherited = false; screen = "play"; view = "decision"; planIds = null;
      clearEntryLink(history);
      persist();
    } catch (error) { announce(error instanceof Error ? error.message : "Ce parcours ne peut pas être rejoué."); return; }
  }
  else if (a === "helper") { sheet("Votre mandat", "<p><strong>La France</strong> : fiscalité, services publics, énergie et dette, avec des effets à l’échelle de profils territoriaux. 30 décisions réparties en cinq chapitres annuels.</p><p>Le parcours est entièrement jouable sur téléphone, sans compte.</p>"); return; }
  else if (a === "method") { sheet("Comprendre les conséquences", `<p>Le mandat national part des comptes publics français. Les coûts des mesures, les effets sociaux et les trajectoires budgétaires sont des hypothèses de simulation documentées dans la méthode.</p><p>Les nouvelles parties comportent 30 décisions, six par année. Intérêts, dette et déficit sont comptabilisés une seule fois à chaque clôture annuelle. Les conséquences continuent d’exister même lorsqu’elles ne créent pas de nouvelle carte.</p><p>La mission choisie au départ change la lecture du bilan. Le résultat final reste multidimensionnel et n’attribue pas de note globale au gouvernement simulé.</p><a class="button" href="/mandats/methode/">Lire les règles et les sources</a>`); return; }
  else if (a === "tools") { sheet("Votre partie", `<p>La sauvegarde reste dans ce navigateur. Pour changer d'appareil, exportez puis importez le fichier.</p>${g && screen !== "mandate" ? `<button class="button" data-action="open-plan">Comparer une autre stratégie</button><button class="button" data-action="export">Exporter la sauvegarde</button>` : ""}<label class="button file-input">Importer une sauvegarde<input id="save-file" type="file" accept="application/json,.json"></label><button class="button" data-action="light-mode" aria-pressed="${light}">${light ? "Activer les animations" : "Réduire les animations"}</button><details><summary>Participer à la validation du jeu</summary><p>Enregistrez uniquement les étapes et leur date sur cet appareil, sans les décisions, scores, nom ou identifiant. Rien n’est envoyé. Export limité aux 30 derniers jours et à 500 événements. Désactiver efface ce journal.</p><button class="button" data-action="pilot-consent" aria-pressed="${pilotOn()}">Enregistrer les étapes de test</button><button class="button" data-action="pilot-export">Exporter mon journal de test</button></details><section class="tool-section"><h3>Installer et jouer hors connexion</h3><p>Sur iPhone : Partager puis Sur l’écran d’accueil. Sur Android : menu du navigateur puis Installer l’application. Le jeu fonctionne aussi dans votre navigateur.</p><button class="button" data-action="offline-prepare">Préparer le jeu hors connexion</button><button class="button" data-action="offline-update">Mettre à jour le jeu</button><button class="text-button" data-action="offline-remove">Supprimer la copie hors connexion</button><p>Le jeu et ses règles sont téléchargés. Les règles et les données du mandat sont conservées dans votre sauvegarde.</p></section><button class="text-button" data-action="new">Choisir un autre mandat</button>`); return; }
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
  render(true, a === "choose" ? actionScroll : newChapter ? 0 : undefined);
  if(a === "choose" && g?.mode === "national" && g.version >= 8 && matchMedia("(max-width:820px) and (min-height:501px)").matches) {
    const question=root.querySelector<HTMLElement>(".dossier");
    if(question && question.getBoundingClientRect().top < 0) window.scrollTo({top:window.scrollY+question.getBoundingClientRect().top-12,behavior:"instant"});
  }
}
document.addEventListener("click", event => {
  const target = (event.target as Element).closest<HTMLElement>("[data-action]");
  if (target?.dataset.action === "choose" && (event as MouseEvent).detail > 1) return;
  if (!target || (target as HTMLButtonElement).disabled) return;
  action(target).catch(err => announce(err instanceof Error ? err.message : "Cette action n'a pas pu aboutir."));
});
window.addEventListener("pagehide", () => {
  decisionTransition.cancel();
  clearBoardMotion();
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
  try { if (input.files[0].size > MAX_SAVE_BYTES) throw new Error("Fichier trop volumineux."); const imported = decode(await input.files[0].text()); clearBranchReference(); adopt(imported); dialog.close(); render(); announce("Partie importée et recalculée."); persist(); }
  catch (err) { announce(err instanceof Error ? err.message : "Import impossible."); }
});
render(false);
