import {
  advanceAfterResult,
  createCampaign,
  normalizeChapterTransition,
  selectOption,
} from "./campaign.ts";
import { resolveCrisis } from "./crises.ts";
import { confirmSelection } from "./effects.ts";
import { emitSimulatorV3Event } from "./events.ts";
import { advanceCampaign } from "./flow.ts";
import { renderSimulatorV3, type RenderSimulatorV3Options } from "./render.ts";
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
  addEventListener(type: "click", listener: EventListener): void;
  removeEventListener(type: "click", listener: EventListener): void;
  scrollIntoView?(options?: ScrollIntoViewOptions): void;
  querySelector?(selector: string): { textContent: string | null } | null;
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
};

type ActionNode = {
  dataset: DOMStringMap & {
    v3Action?: string;
    decisionId?: string;
    optionId?: string;
    resolutionId?: string;
  };
};

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

function resetScrollAfterBrowserRestore(host: SimulatorV3Host): void {
  if (typeof requestAnimationFrame === "undefined") return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => host.scrollIntoView?.({ block: "start" }));
  });
}

export function mountSimulatorV3(
  host: SimulatorV3Host,
  scenario: Scenario,
  dependencies: SimulatorV3Dependencies,
): () => void {
  const storage = dependencies.storage ?? defaultStorage();
  const navigate = dependencies.navigate ?? defaultNavigate;
  const now = dependencies.now ?? (() => new Date());
  const crisisRules = dependencies.crisisRules ?? [];
  const shareChannels = dependencies.shareChannels ?? defaultShareChannels();
  const currentUrl = dependencies.currentUrl ?? defaultCurrentUrl;
  const restored = restoreCampaign(storage, scenario);
  const v2Found = restored.kind === "v2_found";
  const restartRequired = restored.kind === "restart_required";
  let state = normalizeChapterTransition(
    restored.kind === "restored" ? restored.state : createCampaign(scenario, dependencies.baseline),
    scenario,
  );
  let phaseBeforePause: CampaignPhase | undefined = state.phase === "pause"
    ? state.pausedFrom ?? inferredPhaseBeforePause(state, scenario)
    : undefined;
  let pauseView: RenderSimulatorV3Options["pauseView"] = "menu";

  const render = (resetScroll = false) => {
    host.innerHTML = renderSimulatorV3(state, scenario, { v2Found, restartRequired, crisisRules, pauseView });
    if (resetScroll) host.scrollIntoView?.({ block: "start" });
  };

  const persistAndRender = (resetScroll = false) => {
    state = saveCampaign(storage, state, now());
    render(resetScroll);
  };

  const emit = (detail: Parameters<typeof emitSimulatorV3Event>[0]) => {
    emitSimulatorV3Event(detail, dependencies.eventTarget);
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
      state = { ...state, phase: "chapter_intro" };
      emit({ type: "campaign_started" });
      persistAndRender(true);
      return;
    }

    if (action === "open-chapter" && state.phase === "chapter_intro") {
      state = advanceAfterResult(state, scenario);
      emit({ type: "decision_viewed", chapter: state.chapterIndex + 1, position: state.decisions.length + 1 });
      persistAndRender(true);
      return;
    }

    if (action === "select" && state.phase === "decision") {
      const decisionId = node.dataset.decisionId;
      const optionId = node.dataset.optionId;
      if (!decisionId || !optionId) return;
      state = confirmSelection(selectOption(state, scenario, decisionId, optionId), scenario);
      emit({
        type: "decision_confirmed",
        chapter: state.chapterIndex + 1,
        position: state.decisions.length,
      });
      state = advanceCampaign(state, scenario, crisisRules);
      if (state.phase === "decision") {
        emit({ type: "decision_viewed", chapter: state.chapterIndex + 1, position: state.decisions.length + 1 });
      }
      if (state.phase === "crisis" && state.activeCrisis) {
        emit({ type: "crisis_triggered", crisisId: state.activeCrisis.ruleId });
      }
      if (state.phase === "chapter_intro") emit({ type: "chapter_completed", chapter: state.chapterIndex });
      if (state.phase === "verdict") emit({ type: "campaign_completed" });
      persistAndRender();
      return;
    }

    if (action === "continue" && ["decision_result", "delayed_event", "council"].includes(state.phase)) {
      const previousPhase = state.phase;
      state = advanceCampaign(state, scenario, crisisRules);
      if (state.phase === "decision") {
        emit({ type: "decision_viewed", chapter: state.chapterIndex + 1, position: state.decisions.length + 1 });
      }
      if (state.phase === "crisis" && previousPhase !== "crisis" && state.activeCrisis) {
        emit({ type: "crisis_triggered", crisisId: state.activeCrisis.ruleId });
      }
      if (state.phase === "chapter_intro") emit({ type: "chapter_completed", chapter: state.chapterIndex });
      if (state.phase === "verdict") emit({ type: "campaign_completed" });
      persistAndRender(true);
      return;
    }

    if (action === "resolve-crisis" && state.phase === "crisis") {
      const resolutionId = node.dataset.resolutionId;
      if (!resolutionId || !state.activeCrisis) return;
      const crisisId = state.activeCrisis.ruleId;
      state = resolveCrisis(state, crisisRules, resolutionId);
      emit({ type: "concession_selected", crisisId, resolutionId });
      state = advanceCampaign(state, scenario, crisisRules);
      if (state.phase === "decision") {
        emit({ type: "decision_viewed", chapter: state.chapterIndex + 1, position: state.decisions.length + 1 });
      }
      persistAndRender();
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

  host.addEventListener("click", onClick);
  render(true);
  resetScrollAfterBrowserRestore(host);

  return () => {
    host.removeEventListener("click", onClick);
  };
}
