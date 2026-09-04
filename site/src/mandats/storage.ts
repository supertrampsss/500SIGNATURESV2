import { DOMAINS, replay } from "./engine.ts";
import type { Game, Mode } from "./types.ts";
export const STORAGE_KEY = "500signatures.mandats.v1";
export function encode(g: Game): string { return JSON.stringify({ version: 1, mode: g.mode, seed: g.seed, choices: g.choices }); }
export function decode(raw: string): Game {
  if (raw.length > 2048) throw new Error("La sauvegarde dépasse la taille autorisée.");
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== "object") throw new Error("Sauvegarde invalide.");
  const v = data as Record<string, unknown>;
  if (v.version !== 1 || typeof v.mode !== "string" || !Object.hasOwn(DOMAINS, v.mode) || !Array.isArray(v.choices) || !v.choices.every(x => typeof x === "string") || typeof v.seed !== "number") throw new Error("Version ou format de sauvegarde non pris en charge.");
  return replay(v.mode as Mode, v.seed, v.choices);
}
export function save(g: Game, storage: Pick<Storage, "setItem">): boolean {
  try { storage.setItem(STORAGE_KEY, encode(g)); return true; } catch { return false; }
}
