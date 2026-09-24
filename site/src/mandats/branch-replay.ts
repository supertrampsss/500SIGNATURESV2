import { domainFor, replayGame, startingGame } from "./engine.ts";
import { annualDeficit } from "./national-deficit.ts";
import { decode, encode, MAX_SAVE_BYTES } from "./storage.ts";
import type { Game } from "./types.ts";

/** Kept apart from the active save, progression counters, and imported scenarios. */
export const BRANCH_REFERENCE_KEY = "500signatures.mandats.branch-reference.v1";
const MAX_REFERENCE_BYTES = 70_000;

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;
const canonicalCache = new WeakMap<object, { encoded: string; game: Game }>();

function canonicalGame(value: unknown): Game | null {
  try {
    if (!value || typeof value !== "object") return null;
    const candidate = value as Game;
    if (!Number.isInteger(candidate.turn) || !Array.isArray(candidate.choices) || candidate.turn !== candidate.choices.length ||
      !Array.isArray(candidate.history) || candidate.turn !== candidate.history.length) return null;
    const encoded = encode(candidate);
    if (new TextEncoder().encode(encoded).length > MAX_SAVE_BYTES) return null;
    const cached = canonicalCache.get(candidate);
    if (cached?.encoded === encoded) return cached.game;
    const replayed = decode(encoded);
    if (replayed.turn !== candidate.turn || replayed.version !== candidate.version || replayed.mode !== candidate.mode ||
      replayed.seed !== candidate.seed || replayed.ambition !== candidate.ambition ||
      JSON.stringify(replayed.choices) !== JSON.stringify(candidate.choices)) return null;
    canonicalCache.set(candidate, { encoded, game: replayed });
    return replayed;
  } catch {
    return null;
  }
}

/** Replay from the beginning through the decisions before `turn` (zero based). */
export function createBranch(game: Game, turn: number, storage?: StorageWriter): Game {
  const original = canonicalGame(game);
  if (!original || !Number.isInteger(turn) || turn < 0 || turn >= original.turn || original.choices.length !== original.turn) {
    throw new Error("Ce choix ne peut pas être rejoué depuis cette partie.");
  }
  const branch = replayGame(original, original.choices.slice(0, turn));
  if (storage) saveBranchReference(storage, original);
  return branch;
}

/** Store a compact, replay-validated snapshot without changing the active save. */
export function saveBranchReference(storage: StorageWriter, game: Game): boolean {
  const canonical = canonicalGame(game);
  if (!canonical) return false;
  try {
    const raw = JSON.stringify({ schema: 1, game: encode(canonical) });
    if (new TextEncoder().encode(raw).length > MAX_REFERENCE_BYTES) return false;
    storage.setItem(BRANCH_REFERENCE_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

/** Malformed, oversized, stale, or unsupported snapshots are ignored safely. */
export function readBranchReference(storage: StorageReader): Game | null {
  try {
    const raw = storage.getItem(BRANCH_REFERENCE_KEY);
    if (!raw || new TextEncoder().encode(raw).length > MAX_REFERENCE_BYTES) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const envelope = parsed as Record<string, unknown>;
    if (envelope.schema !== 1 || typeof envelope.game !== "string" || envelope.game.length > MAX_SAVE_BYTES) return null;
    const game = decode(envelope.game);
    return canonicalGame(game);
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function stateAt(game: Game, turn: number) {
  return turn > 0 ? game.history[turn - 1]?.metrics : startingGame(game).metrics;
}

const point = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, signDisplay: "always" });

/** Optional, factual comparison of recorded metrics at equal decision progress. */
export function comparisonMarkup(current: Game, reference: Game): string {
  const a = canonicalGame(current), b = canonicalGame(reference);
  if (!a || !b || a.version !== b.version || a.mode !== b.mode || a.seed !== b.seed ||
    a.ambition !== b.ambition || JSON.stringify(a.city) !== JSON.stringify(b.city)) return "";
  const progress = Math.min(a.turn, b.turn);
  const left = stateAt(a, progress), right = stateAt(b, progress);
  if (!left || !right) return "";
  const rows = ([
    ["Services", left.services, right.services],
    ["Cohésion", left.cohesion, right.cohesion],
    ["Résilience", left.resilience, right.resilience],
    ["Confiance", left.trust, right.trust],
  ] as const).map(([label, value, historic]) => {
    const delta = Math.round((value - historic) * 10) / 10;
    return `<li><span>${label}</span><strong>${escapeHtml(point.format(delta))} points</strong></li>`;
  }).join("");
  const deficitAt = (game: Game) => progress > 0 ? game.history[progress - 1]?.ledger.deficit ?? annualDeficit(game) : annualDeficit(startingGame(game));
  const financialRow = a.mode === "national"
    ? `<li><span>Déficit annuel</span><strong>${escapeHtml(point.format(Math.round((deficitAt(a) - deficitAt(b)) * 10) / 10))} Md€</strong></li>`
    : "";
  const title = a.turn === b.turn && a.turn === domainFor(a).turns
    ? "Écart au résultat d’origine"
    : `Écart au même point du mandat (${progress} décisions)`;
  return `<aside class="branch-comparison" aria-label="Comparaison avec la trajectoire d’origine"><h3>${escapeHtml(title)}</h3><p>Écarts au même stade de la trajectoire d’origine.</p><ul>${rows}${financialRow}</ul></aside>`;
}
