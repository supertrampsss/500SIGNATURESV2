import {
  createCampaign,
  currentDecision,
  normalizeChapterTransition,
  selectOption,
} from "./campaign.ts";
import { resolveCrisis } from "./crises.ts";
import { confirmSelection } from "./effects.ts";
import { emitSimulatorV3Event } from "./events.ts";
import { advanceCampaign, advanceToVisiblePhase } from "./flow.ts";
import { renderSimulatorV3, type RenderSimulatorV3Options } from "./render.ts";
import { isCampaignState } from "./validation.ts";
import {
  restoreCampaign,
  saveCampaign,
  type StorageLike,
} from "./storage.ts";
import type { CampaignPhase, CampaignState, CrisisRule, MandateBaseline, Scenario } from "./types.ts";
import { buildMandateVerdictViewModel } from "./verdict.ts";
import {
  buildVerdictShare,
  offerVerdictShare,
  type VerdictShareChannels,
  type VerdictShareIssue,
} from "./verdict-share.ts";

export type SimulatorV3Host = {
  innerHTML: string;
  addEventListener(type: "click" | "keydown", listener: EventListener): void;
  removeEventListener(type: "click" | "keydown", listener: EventListener): void;
  scrollIntoView?(options?: ScrollIntoViewOptions): void;
  querySelector?(selector: string): {
    textContent: string | null;
    focus?(options?: FocusOptions): void;
  } | null;
};

export type SimulatorV3Dependencies = {
  baseline: MandateBaseline;
  storage?: StorageLike;
  navigate?: (path: string) => void;
  eventTarget?: EventTarget;
  now?: () => Date;
  crisisRules?: readonly CrisisRule[];
  shareChannels?: VerdictShareChannels;
  currentUrl?: () => string;
  /** A read-only historical state selected before mounting (not replayed). */
  initialState?: CampaignState;
  /** Keeps the surrounding site chrome aligned with the current scene. */
  onPhaseChange?: (phase: CampaignPhase | null) => void;
};

type ActionNode = {
  dataset: DOMStringMap & {
    v3Action?: string;
    decisionId?: string;
    optionId?: string;
    resolutionId?: string;
  };
};

const V3_UNDO_STORAGE_KEY = "simulateur-v3-undo";

function unavailableStorage(): StorageLike {
  return {
    getItem: () => { throw new Error("Storage unavailable"); },
    setItem: () => { throw new Error("Storage unavailable"); },
    removeItem: () => { throw new Error("Storage unavailable"); },
  };
}

function defaultStorage(): StorageLike {
  try {
    return typeof localStorage === "undefined" ? unavailableStorage() : localStorage;
  } catch {
    return unavailableStorage();
  }
}

function defaultNavigate(path: string): void {
  if (typeof window !== "undefined") window.location.assign(path);
}

function defaultCurrentUrl(): string {
  return typeof window === "undefined" ? "/simulateur?version=3" : window.location.href;
}

function defaultShareChannels(): VerdictShareChannels {
  return {
    partager: typeof navigator !== "undefined" && typeof navigator.share === "function"
      ? (payload) => navigator.share(payload)
      : undefined,
    copier: typeof navigator !== "undefined" && navigator.clipboard
      ? (value) => navigator.clipboard.writeText(value)
      : undefined,
    proposer: typeof window !== "undefined" && typeof window.prompt === "function"
      ? (message, value) => { window.prompt(message, value); }
      : undefined,
  };
}

function shareStatus(issue: VerdictShareIssue): string {
  if (issue === "partagé") return "Partage ouvert.";
  if (issue === "copié") return "Verdict copié.";
  if (issue === "proposé") return "Texte prêt à copier.";
  if (issue === "indisponible") return "Le partage n'est pas disponible sur ce navigateur.";
  return "";
}

function inferredPhaseBeforePause(state: CampaignState, scenario: Scenario): CampaignPhase {
  const position = scenario.chapters
    .slice(0, state.chapterIndex)
    .reduce((sum, chapter) => sum + chapter.decisionIds.length, 0)
    + state.decisionIndex;
  return state.decisions.length > position ? "decision_result" : "decision";
}

export function mountSimulatorV3(
  host: SimulatorV3Host,
  scenario: Scenario,
  dependencies: SimulatorV3Dependencies,
): () => void {
  if (dependencies.initialState && !isCampaignState(dependencies.initialState, scenario)) {
    throw new Error("Initial simulator state is invalid for this scenario");
  }
  const storage = dependencies.storage ?? defaultStorage();
  const navigate = dependencies.navigate ?? defaultNavigate;
  const now = dependencies.now ?? (() => new Date());
  const crisisRules = dependencies.crisisRules ?? [];
  const shareChannels = dependencies.shareChannels ?? defaultShareChannels();
  const currentUrl = dependencies.currentUrl ?? defaultCurrentUrl;
  const restored = dependencies.initialState
    ? { kind: "restored" as const, state: dependencies.initialState }
    : restoreCampaign(storage, scenario);
  const v2Found = restored.kind === "v2_found";
  const restartRequired = restored.kind === "restart_required";
  let saveFailed = restored.kind === "unavailable";
  let state = advanceToVisiblePhase(normalizeChapterTransition(
    restored.kind === "restored" ? restored.state : createCampaign(scenario, dependencies.baseline),
    scenario,
  ), scenario, crisisRules);
  let phaseBeforePause: CampaignPhase | undefined = state.phase === "pause"
    ? state.pausedFrom ?? inferredPhaseBeforePause(state, scenario)
    : undefined;
  let pauseView: RenderSimulatorV3Options["pauseView"] = "menu";
  let detailOptionId: string | undefined;
  let returnFocusToDetailTrigger: string | undefined;
  let previousDecisionState: CampaignState | undefined;
  try {
    const serializedUndo = storage.getItem(V3_UNDO_STORAGE_KEY);
    const candidate = serializedUndo ? JSON.parse(serializedUndo) : undefined;
    if (candidate && isCampaignState(candidate, scenario) && candidate.decisions.length + 1 === state.decisions.length) {
      previousDecisionState = candidate;
    }
  } catch {
    previousDecisionState = undefined;
  }

  const render = (resetScene = false) => {
    dependencies.onPhaseChange?.(state.phase);
    host.innerHTML = renderSimulatorV3(state, scenario, {
      v2Found,
      restartRequired,
      crisisRules,
      pauseView,
      saveFailed,
      detailOptionId,
      canUndo: previousDecisionState !== undefined,
    });
    if (detailOptionId) {
      host.querySelector?.(".simulateur-v3__detail-panel")?.focus?.({ preventScroll: true });
    } else if (returnFocusToDetailTrigger) {
      const optionId = returnFocusToDetailTrigger;
      returnFocusToDetailTrigger = undefined;
      host.querySelector?.(`[data-v3-detail-trigger="${optionId}"]`)?.focus?.({ preventScroll: true });
    }
    if (!resetScene) return;
    host.scrollIntoView?.({ block: "start" });
    host.querySelector?.(".simulateur-v3__stage h1")?.focus?.({ preventScroll: true });
  };

  const observableStorage: StorageLike = {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => {
      try {
        storage.setItem(key, value);
        saveFailed = false;
      } catch (error) {
        saveFailed = true;
        throw error;
      }
    },
    removeItem: (key) => storage.removeItem(key),
  };

  const persistAndRender = (resetScene = false) => {
    state = saveCampaign(observableStorage, state, now());
    render(resetScene);
  };

  const emit = (detail: Parameters<typeof emitSimulatorV3Event>[0]) => {
    emitSimulatorV3Event(detail, dependencies.eventTarget);
  };

  const advanceToNextScene = (previousPhase: CampaignPhase) => {
    detailOptionId = undefined;
    returnFocusToDetailTrigger = undefined;
    state = advanceToVisiblePhase(state, scenario, crisisRules);
    if (state.phase === "decision") {
      emit({ type: "decision_viewed", chapter: state.chapterIndex + 1, position: state.decisions.length + 1 });
    }
    if (state.phase === "crisis" && previousPhase !== "crisis" && state.activeCrisis) {
      emit({ type: "crisis_triggered", crisisId: state.activeCrisis.ruleId });
    }
    if (state.phase === "chapter_intro") emit({ type: "chapter_completed", chapter: state.chapterIndex });
    if (state.phase === "verdict") emit({ type: "campaign_completed" });
    persistAndRender(true);
  };

  const onClick: EventListener = (event) => {
    const target = event.target as { closest?: (selector: string) => ActionNode | null } | null;
    const node = target?.closest?.("[data-v3-action]");
    const action = node?.dataset.v3Action;
    if (!action) return;

    if (action === "quit") {
      navigate("/bilan");
      return;
    }

    if (action === "share-verdict" && state.phase === "verdict") {
      const view = buildMandateVerdictViewModel(state, scenario, crisisRules);
      const share = buildVerdictShare(view, currentUrl());
      void offerVerdictShare(share, shareChannels).then((issue) => {
        const status = host.querySelector?.(".simulateur-v3__verdict-share-status");
        if (status) status.textContent = shareStatus(issue);
        if (["partagé", "copié", "proposé"].includes(issue)) emit({ type: "verdict_shared" });
      });
      return;
    }

    if (action === "start" && state.phase === "intro") {
      state = advanceToVisiblePhase({ ...state, phase: "chapter_intro" }, scenario, crisisRules);
      emit({ type: "campaign_started" });
      if (state.phase === "decision") {
        emit({ type: "decision_viewed", chapter: state.chapterIndex + 1, position: state.decisions.length + 1 });
      }
      persistAndRender(true);
      return;
    }

    if (action === "open-chapter" && state.phase === "chapter_intro") {
      state = advanceToVisiblePhase(advanceCampaign(state, scenario, crisisRules), scenario, crisisRules);
      if (state.phase === "decision") {
        emit({ type: "decision_viewed", chapter: state.chapterIndex + 1, position: state.decisions.length + 1 });
      }
      persistAndRender(true);
      return;
    }

    if (action === "select" && state.phase === "decision") {
      const decisionId = node.dataset.decisionId;
      const optionId = node.dataset.optionId;
      if (!decisionId || !optionId) return;
      previousDecisionState = structuredClone(state);
      try {
        storage.setItem(V3_UNDO_STORAGE_KEY, JSON.stringify(previousDecisionState));
      } catch {
        // The in-memory snapshot still keeps Return usable in this tab.
      }
      state = confirmSelection(selectOption(state, scenario, decisionId, optionId), scenario);
      emit({
        type: "decision_confirmed",
        chapter: state.chapterIndex + 1,
        position: state.decisions.length,
      });
      advanceToNextScene("decision_result");
      return;
    }

    if (action === "undo" && previousDecisionState) {
      state = previousDecisionState;
      previousDecisionState = undefined;
      detailOptionId = undefined;
      returnFocusToDetailTrigger = undefined;
      try {
        storage.removeItem(V3_UNDO_STORAGE_KEY);
      } catch {
        // Local persistence is optional; the state has already been restored.
      }
      persistAndRender(true);
      return;
    }

    if (action === "open-details" && state.phase === "decision") {
      const optionId = node.dataset.optionId;
      const available = currentDecision(state, scenario)
        ?.options.some((option) => option.id === optionId && option.displayCopy !== undefined);
      if (!optionId || !available) return;
      detailOptionId = optionId;
      returnFocusToDetailTrigger = undefined;
      render();
      return;
    }

    if (action === "close-details" && detailOptionId) {
      returnFocusToDetailTrigger = detailOptionId;
      detailOptionId = undefined;
      render();
      return;
    }

    if (action === "keep-details-open" && detailOptionId) return;

    if (action === "continue" && ["decision_result", "delayed_event", "council"].includes(state.phase)) {
      const previousPhase = state.phase;
      advanceToNextScene(previousPhase);
      return;
    }

    if (action === "resolve-crisis" && state.phase === "crisis") {
      const resolutionId = node.dataset.resolutionId;
      if (!resolutionId || !state.activeCrisis) return;
      const crisisId = state.activeCrisis.ruleId;
      state = resolveCrisis(state, crisisRules, resolutionId);
      emit({ type: "concession_selected", crisisId, resolutionId });
      state = advanceToVisiblePhase(state, scenario, crisisRules);
      if (state.phase === "decision") {
        emit({ type: "decision_viewed", chapter: state.chapterIndex + 1, position: state.decisions.length + 1 });
      }
      persistAndRender(true);
      return;
    }

    if (action === "pause" && state.phase !== "intro" && state.phase !== "pause" && state.phase !== "verdict") {
      phaseBeforePause = state.phase;
      pauseView = "menu";
      state = { ...state, phase: "pause", pausedFrom: state.phase };
      persistAndRender(true);
      return;
    }

    if (action === "journal" && state.phase === "pause") {
      pauseView = "journal";
      render(true);
      return;
    }

    if (action === "ask-restart" && state.phase === "pause") {
      pauseView = "restart";
      render(true);
      return;
    }

    if (action === "back-pause" && state.phase === "pause") {
      pauseView = "menu";
      render(true);
      return;
    }

    if (action === "restart") {
      state = createCampaign(scenario, dependencies.baseline, state.seed + 1);
      phaseBeforePause = undefined;
      pauseView = "menu";
      previousDecisionState = undefined;
      try { storage.removeItem(V3_UNDO_STORAGE_KEY); } catch { /* optional storage */ }
      emit({ type: "campaign_restarted" });
      persistAndRender(true);
      return;
    }

    if (action === "resume" && state.phase === "pause") {
      const resumedPhase = phaseBeforePause ?? state.pausedFrom ?? inferredPhaseBeforePause(state, scenario);
      const { pausedFrom: _pausedFrom, ...withoutPauseMarker } = state;
      state = { ...withoutPauseMarker, phase: resumedPhase };
      pauseView = "menu";
      emit({ type: "campaign_resumed", chapter: state.chapterIndex + 1, position: state.decisions.length + 1 });
      persistAndRender(true);
    }
  };

  const onKeydown: EventListener = (event) => {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key !== "Escape" || !detailOptionId) return;
    keyboardEvent.preventDefault();
    returnFocusToDetailTrigger = detailOptionId;
    detailOptionId = undefined;
    render();
  };

  host.addEventListener("click", onClick);
  host.addEventListener("keydown", onKeydown);
  render(true);

  return () => {
    host.removeEventListener("click", onClick);
    host.removeEventListener("keydown", onKeydown);
    dependencies.onPhaseChange?.(null);
  };
}
