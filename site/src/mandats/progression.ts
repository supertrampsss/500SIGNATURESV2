import type { Ambition, Game } from "./types.ts";
import { isFinished } from "./engine.ts";

export const PROGRESSION_KEY = "500signatures.mandats.progression.v1";

export type MandateArchive = {
  seed: number;
  ambition: Ambition;
  completedAt: string;
  crises: number;
  outcome?: "completed" | "ended";
  endingTitle?: string;
  services: number;
  cohesion: number;
  trust: number;
  resilience: number;
};

export type MandateProgression = {
  completedRuns: number;
  endedRuns: number;
  seeds: number[];
  missions: Ambition[];
  crisesEncountered: number;
  archives: MandateArchive[];
};

const empty = (): MandateProgression => ({
  completedRuns: 0,
  endedRuns: 0,
  seeds: [],
  missions: [],
  crisesEncountered: 0,
  archives: [],
});

function safeArchive(value: unknown): value is MandateArchive {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Number.isInteger(v.seed) && typeof v.completedAt === "string"
    && ["equilibre","services","resilience"].includes(v.ambition as string)
    && (v.outcome === undefined || v.outcome === "completed" || v.outcome === "ended")
    && (v.endingTitle === undefined || typeof v.endingTitle === "string")
    && ["crises","services","cohesion","trust","resilience"].every(key => typeof v[key] === "number" && Number.isFinite(v[key]));
}

export function readProgression(storage: Pick<Storage, "getItem">): MandateProgression {
  try {
    const raw = storage.getItem(PROGRESSION_KEY);
    if (!raw || raw.length > 32000) return empty();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return empty();
    const v = parsed as Record<string, unknown>;
    const archives = Array.isArray(v.archives) ? v.archives.filter(safeArchive).slice(-8) : [];
    const seeds = Array.isArray(v.seeds) ? [...new Set(v.seeds.filter((x): x is number => Number.isInteger(x) && x >= 0 && x <= 9999))].slice(-32) : [];
    const missions = Array.isArray(v.missions) ? [...new Set(v.missions.filter((x): x is Ambition => ["equilibre","services","resilience"].includes(String(x))))] : [];
    return {
      completedRuns: Number.isInteger(v.completedRuns) && Number(v.completedRuns) >= 0 ? Number(v.completedRuns) : archives.filter(a => a.outcome !== "ended").length,
      endedRuns: Number.isInteger(v.endedRuns) && Number(v.endedRuns) >= 0 ? Number(v.endedRuns) : archives.filter(a => a.outcome === "ended").length,
      seeds,
      missions,
      crisesEncountered: Number.isInteger(v.crisesEncountered) && Number(v.crisesEncountered) >= 0 ? Number(v.crisesEncountered) : archives.reduce((sum,a)=>sum+a.crises,0),
      archives,
    };
  } catch {
    return empty();
  }
}

export function crisisCount(game: Game): number {
  return game.choices.filter(id => /^k\d+[abc]$/.test(id)).length;
}

export function recordCompletedMandate(storage: Pick<Storage, "getItem" | "setItem">, game: Game, now = new Date()): MandateProgression {
  const previous = readProgression(storage);
  if (game.version < 9 || game.mode !== "national" || !isFinished(game) || game.turn === 0) return previous;
  const crises = crisisCount(game);
  const archive: MandateArchive = {
    seed: game.seed,
    ambition: game.ambition ?? "equilibre",
    completedAt: now.toISOString(),
    crises,
    outcome: game.politics?.ending && game.politics.ending.kind !== "term_complete" ? "ended" : "completed",
    ...(game.politics?.ending && game.politics.ending.kind !== "term_complete" ? { endingTitle: game.politics.ending.title } : {}),
    services: Math.round(game.metrics.services),
    cohesion: Math.round(game.metrics.cohesion),
    trust: Math.round(game.metrics.trust),
    resilience: Math.round(game.metrics.resilience),
  };
  const next: MandateProgression = {
    completedRuns: previous.completedRuns + (archive.outcome === "completed" ? 1 : 0),
    endedRuns: previous.endedRuns + (archive.outcome === "ended" ? 1 : 0),
    seeds: [...new Set([...previous.seeds, game.seed])].slice(-32),
    missions: [...new Set([...previous.missions, archive.ambition])],
    crisesEncountered: previous.crisesEncountered + crises,
    archives: [...previous.archives, archive].slice(-8),
  };
  try { storage.setItem(PROGRESSION_KEY, JSON.stringify(next)); } catch {}
  return next;
}
