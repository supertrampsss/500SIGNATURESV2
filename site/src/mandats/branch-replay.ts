import { choicesFor, decide, domainFor, replayGame, startingGame, isFinished } from "./engine.ts";
import { annualDeficit } from "./national-deficit.ts";
import { artForDossier } from "./cinema-art.ts";
import { decode, encode, MAX_SAVE_BYTES } from "./storage.ts";
import { focusForRecordedDecision, narrativeTurningPoints } from "./narrative-outcomes.ts";
import { PRESIDENCY_JOURNAL_LIMIT } from "./presidency-engine.ts";
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
    if (!Number.isInteger(candidate.turn) || !Array.isArray(candidate.choices) ||
      (candidate.version === 16 ? candidate.turn < 0 || candidate.turn > 30 || candidate.choices.length > PRESIDENCY_JOURNAL_LIMIT || candidate.turn !== candidate.choices.filter(id => id === "live-tick").length : candidate.turn !== candidate.choices.length) ||
      !Array.isArray(candidate.history) || candidate.choices.length !== candidate.history.length) return null;
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

/** Legacy: decision index. V16: journal index before a President's order. */
export function createBranch(game: Game, turn: number, storage?: StorageWriter): Game {
  const original = canonicalGame(game);
  if (!original || !Number.isInteger(turn) || turn < 0 || turn >= original.choices.length ||
    (original.version === 16 ? original.choices[turn] === "live-tick" : original.choices.length !== original.turn)) {
    throw new Error("Ce choix ne peut pas être rejoué depuis cette partie.");
  }
  const branch = original.version === 16 ? replayGame(original, original.choices.slice(0, turn)) : focusForRecordedDecision(original, turn);
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
  return turn > 0 ? periodRecord(game, turn)?.metrics : startingGame(game).metrics;
}

/** V16 history also records orders; only clock snapshots compare elapsed time. */
function periodRecord(game: Game, period: number) {
  return game.version === 16 ? game.history.filter((_, index) => game.choices[index] === "live-tick")[period - 1] : game.history[period - 1];
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
  const deficitAt = (game: Game) => progress > 0 ? periodRecord(game, progress)?.ledger.deficit ?? annualDeficit(game) : annualDeficit(startingGame(game));
  const financialRow = a.mode === "national"
    ? `<li><span>Déficit annuel</span><strong>${escapeHtml(point.format(Math.round((deficitAt(a) - deficitAt(b)) * 10) / 10))} Md€</strong></li>`
    : "";
  const title = isFinished(a) && isFinished(b) && a.turn === b.turn
    ? "Écart aux deux héritages simulés"
    : `Écart au même point du mandat (${progress} ${a.version === 16 ? "périodes" : "décisions"})`;
  return `<aside class="branch-comparison" aria-label="Comparaison avec la trajectoire d’origine"><h3>${escapeHtml(title)}</h3><p>Écarts au même stade de la trajectoire d’origine.</p><ul>${rows}${financialRow}</ul></aside>`;
}

/** Historical decisions remain selectable even when their old option is no longer actionable. */
export function renderReplaySelection(game: Game): string {
  const g = canonicalGame(game);
  if (!g || g.mode !== "national" || g.version < 9) return "";
  if (g.version === 16) return presidencyReplaySelection(g);
  if (g.turn === 0) return "";
  const causal = g.version >= 11 ? narrativeTurningPoints(g, 3).map(point => point.index) : [];
  const selected = [...new Set(causal.length ? causal : [0, Math.floor((g.turn - 1) / 2), g.turn - 1])];
  const card = (index: number, compact = false) => {
    const turn = g.history[index]!;
    const before = focusForRecordedDecision(g, index);
    const dossier = domainFor(before).dossiers[index];
    const actual = dossier?.choices.find(c => c.id === turn.choice);
    const art = index === g.history.length - 1 ? artForDossier("Héritage", index, g.history.length) : artForDossier(dossier?.category ?? "Chapitre", index, g.history.length);
    const content = `${g.version>=12?"":`<img src="${escapeHtml(art.src)}" alt="${escapeHtml(art.alt)}" loading="lazy">`}<span class="replay-card__body"><span class="replay-card__eyebrow">ANNÉE ${turn.year} · DÉCISION ${index + 1}</span><strong class="replay-card__title">${escapeHtml(dossier?.title ?? turn.title)}</strong>${!compact ? `<span class="replay-card__story">${escapeHtml(g.version>=12?(dossier?.story??turn.event).split(/(?<=[.!?])\s+/)[0]:dossier?.story??turn.event)}</span>` : ""}<span class="replay-card__original">Choix d’origine : <strong>${escapeHtml(actual?.title ?? turn.title)}</strong></span><span class="replay-card__cta">Reprendre avant cette décision</span></span>`;
    return `<button type="button" class="replay-card${compact ? " replay-card--compact" : ""}" data-action="branch-replay" data-turn="${index}" aria-label="Reprendre avant l’année ${turn.year}, décision ${index + 1} : ${escapeHtml(dossier?.title ?? turn.title)}">${content}</button>`;
  };
  const cards = selected.map(index => card(index)).join("");
  const remaining = g.history.map((_, index) => index).filter(index => !selected.includes(index)).map(index => card(index, true)).join("");
  const v11 = g.version >= 11;
  return `<section class="replay-selection" aria-labelledby="replay-selection-title"><header class="replay-selection__header"><span>${v11 ? 'DÉCISIONS MARQUANTES' : 'RELIRE VOTRE MANDAT'}</span><h1 id="replay-selection-title">${v11 ? 'Rejouer un tournant.' : 'Où tout aurait pu changer ?'}</h1><p>${v11 ? 'Ces décisions sont reliées aux événements qui ont réellement marqué votre partie.' : 'Reprenez avant une décision et explorez une autre trajectoire.'}</p><p class="replay-selection__archive">Votre mandat d’origine reste conservé.</p></header><div class="replay-selection__grid">${cards}</div><details class="replay-selection__all"><summary>Toutes mes décisions (${g.turn})</summary><div>${remaining}</div></details><button type="button" class="replay-selection__back" data-action="show-result">${isFinished(g) ? "Revenir à mon héritage" : "Revenir à mon mandat"}</button></section>`;
}

/** Orders and automatic periods are different entries in the v16 journal.
 * Rebuild it once to retain authentic titles, including repeated priorities and
 * rejected laws, even after their initiatives leave the live government's feed. */
function presidencyReplaySelection(game: Game): string {
  const orders: Array<{ index: number; period: number; title: string; detail: string }> = [];
  let before = startingGame(game);
  for (const [index, id] of game.choices.entries()) {
    const after = decide(before, id);
    if (id !== "live-tick") {
      const initiative = after.presidency?.initiatives.filter(item => item.actor === "president" && item.choice === id).at(-1);
      const choice = initiative ? undefined : choicesFor(before).find(item => item.id === id);
      orders.push({ index, period: before.turn, title: initiative?.title ?? choice?.title ?? "Ordre présidentiel",
        detail: initiative?.detail ?? choice?.description ?? "Consigne enregistrée dans votre mandat." });
    }
    before = after;
  }
  const selected = new Set(orders.length ? [orders[0]!.index, orders[Math.floor((orders.length - 1) / 2)]!.index, orders.at(-1)!.index] : []);
  const card = (order: typeof orders[number], compact = false) => `<button type="button" class="replay-card${compact ? " replay-card--compact" : ""}" data-action="branch-replay" data-turn="${order.index}" aria-label="Reprendre avant la période ${order.period + 1} : ${escapeHtml(order.title)}"><span class="replay-card__body"><span class="replay-card__eyebrow">ANNÉE ${Math.min(5, Math.floor(order.period / 6) + 1)} · PÉRIODE ${order.period + 1}</span><strong class="replay-card__title">${escapeHtml(order.title)}</strong>${compact ? "" : `<span class="replay-card__story">${escapeHtml(order.detail)}</span>`}<span class="replay-card__cta">Reprendre avant cet ordre</span></span></button>`;
  const featured = orders.filter(order => selected.has(order.index)).map(order => card(order)).join("");
  const remaining = orders.filter(order => !selected.has(order.index)).map(order => card(order, true)).join("");
  return `<section class="replay-selection" aria-labelledby="replay-selection-title"><header class="replay-selection__header"><span>VOS ORDRES PRÉSIDENTIELS</span><h1 id="replay-selection-title">Changer le cap.</h1><p>Reprenez avant un de vos ordres. Les périodes déjà écoulées et les initiatives des ministres sont conservées jusqu’à ce point.</p><p class="replay-selection__archive">Votre mandat d’origine reste conservé.</p></header>${orders.length ? `<div class="replay-selection__grid">${featured}</div>${remaining ? `<details class="replay-selection__all"><summary>Les autres ordres (${orders.length - selected.size})</summary><div>${remaining}</div></details>` : ""}` : "<p>Aucun ordre présidentiel enregistré dans ce mandat.</p>"}<button type="button" class="replay-selection__back" data-action="show-result">${isFinished(game) ? "Revenir à mon héritage" : "Revenir à mon mandat"}</button></section>`;
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
  const originalDeficit = progress ? periodRecord(b, progress)?.ledger.deficit ?? annualDeficit(b) : annualDeficit(startingGame(b));
  const newDeficit = progress ? periodRecord(a, progress)?.ledger.deficit ?? annualDeficit(a) : annualDeficit(startingGame(a));
  const cards = [...metrics.map(([label, x, y]) => row(label, x, y)), row("Déficit annuel", originalDeficit, newDeficit, " Md€")].join("");
  const closed = isFinished(a);
  const progressLabel = a.version === 16 ? `Période ${progress} / ${domainFor(a).turns} · indicateurs enregistrés au même nombre de périodes écoulées.` : `Décision ${progress} / ${domainFor(a).turns} · indicateurs observés au même nombre de décisions.`;
  const canReplay = a.version !== 16 || a.choices.some(id => id !== "live-tick");
  return `<section class="trajectory-comparison" aria-labelledby="trajectory-comparison-title"><header><span>COMPARAISON À LA MÊME ÉTAPE</span><h1 id="trajectory-comparison-title">Un choix. Deux trajectoires.</h1><p>${progressLabel}${a.politics?.ending && a.politics.ending.kind !== "term_complete" ? ` Mandat interrompu : ${escapeHtml(a.politics.ending.title)}.` : ""}</p></header><div class="trajectory-comparison__columns"><section class="trajectory-panel trajectory-panel--origin"><h2>Mandat d’origine</h2><p>${escapeHtml(progress ? periodRecord(b, progress)?.title ?? "État initial" : "État initial")}</p></section><section class="trajectory-panel trajectory-panel--new"><h2>Nouvelle trajectoire</h2><p>${escapeHtml(progress ? periodRecord(a, progress)?.title ?? "État initial" : "État initial")}</p></section></div><div class="trajectory-comparison__metrics">${cards}</div><p class="trajectory-comparison__note">Écarts calculés à partir des indicateurs et comptes enregistrés dans la simulation.</p><div class="trajectory-comparison__actions">${!closed || canReplay ? `<button type="button" data-action="${closed ? "open-replay-selection" : "continue-branch"}">${closed ? a.version === 16 ? "Rejouer un autre ordre" : "Rejouer une autre décision" : "Continuer la simulation"}</button>` : ""}<button type="button" data-action="restore-origin">Retrouver mon mandat d’origine</button></div></section>`;
}
