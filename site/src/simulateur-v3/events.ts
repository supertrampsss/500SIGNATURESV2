export type SimulatorV3Event =
  | { type: "campaign_started" }
  | { type: "decision_viewed"; chapter: number; position: number }
  | { type: "analysis_opened"; chapter: number; position: number }
  | { type: "decision_confirmed"; chapter: number; position: number }
  | { type: "campaign_resumed"; chapter: number; position: number }
  | { type: "crisis_triggered"; crisisId: string }
  | { type: "concession_selected"; crisisId: string; resolutionId: string }
  | { type: "chapter_completed"; chapter: number }
  | { type: "campaign_completed" }
  | { type: "verdict_shared" }
  | { type: "campaign_restarted" };

export function emitSimulatorV3Event(detail: SimulatorV3Event, target?: EventTarget): void {
  const eventTarget = target ?? (typeof document === "undefined" ? undefined : document);
  if (!eventTarget) return;

  eventTarget.dispatchEvent(new CustomEvent<SimulatorV3Event>("simulateur-v3:evenement", { detail }));
}
