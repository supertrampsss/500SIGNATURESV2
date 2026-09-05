/** Inactive launch boundaries. No network, credentials, analytics SDK or publishing method. */
export type Consent = { analytics: boolean; advertising: boolean };
export const DEFAULT_CONSENT: Consent = { analytics: false, advertising: false };
export const ANALYTICS_EVENTS = ["mode_selected", "onboarding_completed", "first_decision", "game_completed", "replay_started", "mode_switched", "share_initiated"] as const;
export function analyticsAllowed(consent: Consent): boolean { return consent.analytics === true; }
export function adAllowed(path: string, consent: Consent, experiment: boolean): boolean {
  if (!experiment || !consent.advertising) return false;
  // Explicit future editorial allowlist. Anything else, including Mandats and methodology, is protected.
  return /^\/comprendre\/[a-z0-9-]+\/$/.test(path) || /^\/rapports\/[a-z0-9-]+\/$/.test(path);
}
export type ListeningCandidate = { id: string; accountId: string; threadId: string; sourceIds: string[]; relevance: number; question: number; answerability: number; usefulness: number; sensitive: boolean; crisis: boolean; partisan: boolean; optedOut: boolean };
export type DraftDecision = { state: "discard" | "human-review"; reason: string };
export function triage(c: ListeningCandidate, paused = true): DraftDecision {
  if (paused) return { state: "discard", reason: "Pilot paused by default." };
  if (c.optedOut || c.sensitive || c.crisis || c.partisan) return { state: "discard", reason: "Excluded context or opt-out." };
  const values = [c.relevance, c.question, c.answerability, c.usefulness];
  const maxima = [3, 2, 3, 2];
  if (values.some((v, i) => !Number.isFinite(v) || v < 0 || v > maxima[i]) || !c.sourceIds.length) return { state: "discard", reason: "Invalid scoring or missing approved sources." };
  return values.reduce((a, b) => a + b, 0) >= 8 ? { state: "human-review", reason: "Drafting permitted; publication requires human action." } : { state: "discard", reason: "Insufficient incremental usefulness." };
}
export type ProvenanceKind = "observed" | "derived" | "assumption" | "scenario" | "decision" | "outcome";
export type Provenance = { kind: ProvenanceKind; sourceURL?: string; producer?: string; license?: string; referencePeriod?: string; publicationDate?: string; retrievedAt?: string; geographyVintage?: string; unit: string; perimeter: string; formula?: string; inputIds?: string[]; version: string };
export function validateProvenance(p: Provenance): boolean {
  if (!p.unit || !p.perimeter || !p.version) return false;
  if (p.kind === "observed") return !!(p.sourceURL?.startsWith("https://") && p.producer && p.license && p.referencePeriod && p.retrievedAt);
  if (p.kind === "derived") return !!(p.formula && p.inputIds?.length);
  return ["assumption", "scenario", "decision", "outcome"].includes(p.kind);
}
