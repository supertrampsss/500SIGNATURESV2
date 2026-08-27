import {
  advanceAfterResult,
  clearSelection,
  createCampaign,
  selectOption,
} from "./campaign.ts";
import { confirmSelection } from "./effects.ts";
import { emitSimulatorV3Event } from "./events.ts";
import { renderSimulatorV3 } from "./render.ts";
import {
  restoreCampaign,
  saveCampaign,
  type StorageLike,
} from "./storage.ts";
import type { CampaignPhase, CampaignState, Scenario } from "./types.ts";

export type SimulatorV3Host = {
  innerHTML: string;
  addEventListener(type: "click", listener: EventListener): void;
  removeEventListener(type: "click", listener: EventListener): void;
};

export type SimulatorV3Dependencies = {
  storage?: StorageLike;
  navigate?: (path: string) => void;
  eventTarget?: EventTarget;
  now?: () => Date;
};

type ActionNode = {
  dataset: DOMStringMap & {
    v3Action?: string;
    decisionId?: string;
    optionId?: string;
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

function inferredPhaseBeforePause(state: CampaignState): CampaignPhase {
  const position = state.chapterIndex * 12 + state.decisionIndex;
  return state.decisions.length > position ? "decision_result" : "decision";
}

export function mountSimulatorV3(
  host: SimulatorV3Host,
  scenario: Scenario,
  dependencies: SimulatorV3Dependencies = {},
): () => void {
  const storage = dependencies.storage ?? defaultStorage();
  const navigate = dependencies.navigate ?? defaultNavigate;
  const now = dependencies.now ?? (() => new Date());
  const restored = restoreCampaign(storage, scenario);
  const v2Found = restored.kind === "v2_found";
  let state = restored.kind === "restored" ? restored.state : createCampaign(scenario);
  let phaseBeforePause: CampaignPhase | undefined = state.phase === "pause"
    ? inferredPhaseBeforePause(state)
    : undefined;

  const render = () => {
    host.innerHTML = renderSimulatorV3(state, scenario, { v2Found });
  };

  const persistAndRender = () => {
    state = saveCampaign(storage, state, now());
    render();
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

    if (action === "start" && state.phase === "intro") {
      state = { ...state, phase: "chapter_intro" };
      emit({ type: "campaign_started" });
      persistAndRender();
      return;
    }

    if (action === "open-chapter" && state.phase === "chapter_intro") {
      state = advanceAfterResult(state, scenario);
      emit({ type: "decision_viewed", chapter: state.chapterIndex + 1, position: state.decisions.length + 1 });
      persistAndRender();
      return;
    }

    if (action === "select" && state.phase === "decision") {
      const decisionId = node.dataset.decisionId;
      const optionId = node.dataset.optionId;
      if (!decisionId || !optionId) return;
      state = selectOption(state, scenario, decisionId, optionId);
      render();
      return;
    }

    if (action === "cancel" && state.phase === "decision") {
      state = clearSelection(state);
      render();
      return;
    }

    if (action === "confirm" && state.phase === "decision" && state.pendingSelection) {
      state = confirmSelection(state, scenario);
      emit({
        type: "decision_confirmed",
        chapter: state.chapterIndex + 1,
        position: state.decisions.length,
      });
      persistAndRender();
      return;
    }

    if (action === "continue" && ["decision_result", "council", "chapter_verdict"].includes(state.phase)) {
      state = advanceAfterResult(state, scenario);
      if (state.phase === "decision") {
        emit({ type: "decision_viewed", chapter: state.chapterIndex + 1, position: state.decisions.length + 1 });
      }
      persistAndRender();
      return;
    }

    if (action === "pause" && state.phase !== "pause") {
      phaseBeforePause = state.phase;
      state = { ...state, phase: "pause" };
      persistAndRender();
      return;
    }

    if (action === "resume" && state.phase === "pause") {
      state = { ...state, phase: phaseBeforePause ?? inferredPhaseBeforePause(state) };
      emit({ type: "campaign_resumed", chapter: state.chapterIndex + 1, position: state.decisions.length + 1 });
      persistAndRender();
    }
  };

  host.addEventListener("click", onClick);
  render();

  return () => {
    host.removeEventListener("click", onClick);
  };
}
