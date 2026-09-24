import { domainFor, replayGame, startingGame } from "./engine.ts";
import { annualDeficit } from "./national-deficit.ts";
import { artForDossier } from "./cinema-art.ts";
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
const amount = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

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

/** Historical decisions remain selectable even when their old option is no longer actionable. */
export function renderReplaySelection(game: Game): string {
  const g = canonicalGame(game);
  if (!g || g.mode !== "national" || g.version < 9 || g.turn === 0) return "";
  const selected = [...new Set([0, Math.floor((g.turn - 1) / 2), g.turn - 1])];
  const card = (index: number, compact = false) => {
    const turn = g.history[index]!;
    const before = replayGame(g, g.choices.slice(0, index));
    const dossier = domainFor(before).dossiers[index];
    const actual = dossier?.choices.find(c => c.id === turn.choice);
    const art = index === g.history.length - 1 ? artForDossier("Héritage", index, g.history.length) : artForDossier(dossier?.category ?? "Chapitre", index, g.history.length);
    const content = `<img src="${escapeHtml(art.src)}" alt="${escapeHtml(art.alt)}" loading="lazy"><span class="replay-card__body"><span class="replay-card__eyebrow">ANNÉE ${turn.year} · DÉCISION ${index + 1}</span><strong class="replay-card__title">${escapeHtml(dossier?.title ?? turn.title)}</strong>${!compact ? `<span class="replay-card__story">${escapeHtml(dossier?.story ?? turn.event)}</span>` : ""}<span class="replay-card__original">Choix d’origine : <strong>${escapeHtml(actual?.title ?? turn.title)}</strong></span><span class="replay-card__cta">Reprendre avant cette décision</span></span>`;
    return `<button type="button" class="replay-card${compact ? " replay-card--compact" : ""}" data-action="branch-replay" data-turn="${index}" aria-label="Reprendre avant l’année ${turn.year}, décision ${index + 1} : ${escapeHtml(dossier?.title ?? turn.title)}">${content}</button>`;
  };
  const cards = selected.map(index => card(index)).join("");
  const remaining = g.history.map((_, index) => index).filter(index => !selected.includes(index)).map(index => card(index, true)).join("");
  return `<section class="replay-selection" aria-labelledby="replay-selection-title"><header class="replay-selection__header"><span>RELIRE VOTRE MANDAT</span><h1 id="replay-selection-title">Où tout aurait pu changer ?</h1><p>Reprenez avant une décision et explorez une autre trajectoire.</p><p class="replay-selection__archive">Votre mandat d’origine reste conservé.</p></header><div class="replay-selection__grid">${cards}</div><details class="replay-selection__all"><summary>Toutes mes décisions (${g.turn})</summary><div>${remaining}</div></details><button type="button" class="replay-selection__back" data-action="show-result">Revenir à mon héritage</button></section>`;
}

/** Full comparison at equal decision progress, with the original run on the left. */
export function renderTrajectoryComparison(current: Game, reference: Game): string {
  const a = canonicalGame(current), b = canonicalGame(reference);
  if (!a || !b || a.version !== b.version || a.mode !== b.mode || a.seed !== b.seed || a.ambition !== b.ambition || JSON.stringify(a.city) !== JSON.stringify(b.city)) return "";
  const progress = Math.min(a.turn, b.turn);
  const left = stateAt(b, progress), right = stateAt(a, progress);
  if (!left || !right) return "";
  const metrics = [["Services publics", left.services, right.services], ["Confiance", left.trust, right.trust]] as const;
  const row = (label: string, original: number, next: number, unit = "") => {
    const delta = Math.round((next - original) * 10) / 10;
    const min = unit === " Md€" ? Math.min(0, original, next) : 0;
    const max = unit === " Md€" ? Math.max(1, original, next) : 100;
    return `<div class="trajectory-row"><div class="trajectory-row__side"><strong>${escapeHtml(amount.format(original))}${unit}</strong><span>${escapeHtml(label)}</span><meter min="${min}" max="${max}" value="${original}"></meter></div><span class="trajectory-row__delta" aria-label="Écart nouvelle trajectoire moins mandat d’origine">${escapeHtml(point.format(delta))}${unit}</span><div class="trajectory-row__side trajectory-row__side--new"><strong>${escapeHtml(amount.format(next))}${unit}</strong><span>${escapeHtml(label)}</span><meter min="${min}" max="${max}" value="${next}"></meter></div></div>`;
  };
  const originalDeficit = progress ? b.history[progress - 1]?.ledger.deficit ?? annualDeficit(b) : annualDeficit(startingGame(b));
  const newDeficit = progress ? a.history[progress - 1]?.ledger.deficit ?? annualDeficit(a) : annualDeficit(startingGame(a));
  const cards = [...metrics.map(([label, x, y]) => row(label, x, y)), row("Déficit annuel", originalDeficit, newDeficit, " Md€")].join("");
  const closed = progress === domainFor(a).turns;
  return `<section class="trajectory-comparison" aria-labelledby="trajectory-comparison-title"><header><span>COMPARAISON À LA MÊME ÉTAPE</span><h1 id="trajectory-comparison-title">Un choix. Deux trajectoires.</h1><p>Décision ${progress} / ${domainFor(a).turns} · indicateurs observés au même nombre de décisions.</p></header><div class="trajectory-comparison__columns"><section class="trajectory-panel trajectory-panel--origin"><h2>Mandat d’origine</h2><p>${escapeHtml(progress ? b.history[progress - 1]?.title ?? "État initial" : "État initial")}</p></section><section class="trajectory-panel trajectory-panel--new"><h2>Nouvelle trajectoire</h2><p>${escapeHtml(progress ? a.history[progress - 1]?.title ?? "État initial" : "État initial")}</p></section></div><div class="trajectory-comparison__metrics">${cards}</div><p class="trajectory-comparison__note">Écarts calculés à partir des indicateurs et comptes enregistrés dans la simulation.</p><div class="trajectory-comparison__actions"><button type="button" data-action="${closed ? "open-replay-selection" : "continue-branch"}">${closed ? "Rejouer une autre décision" : "Continuer la simulation"}</button><button type="button" data-action="restore-origin">Retrouver mon mandat d’origine</button></div></section>`;
}
