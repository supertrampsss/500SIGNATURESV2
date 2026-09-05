import { DOMAINS, replay } from "./engine.ts";
import type { Ambition, Game, Mode } from "./types.ts";
import { validateCityBaseline } from './cities.ts';
import type { CityBaseline } from './cities.ts';
export const STORAGE_KEY = "500signatures.mandats.v1";
export const MAX_SAVE_BYTES = 65536;
export function encode(g: Game): string { return JSON.stringify({ version: g.version, mode: g.mode, seed: g.seed, choices: g.choices, ...(g.version !== 1 ? { ambition: g.ambition ?? "equilibre" } : {}),...(g.version===3&&g.city?{city:g.city}:{}) }); }
export function decode(raw: string): Game {
  if (new TextEncoder().encode(raw).length > MAX_SAVE_BYTES) throw new Error("La sauvegarde dépasse la taille autorisée.");
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== "object") throw new Error("Sauvegarde invalide.");
  const v = data as Record<string, unknown>;
  if ((v.version !== 1 && v.version !== 2 && v.version !== 3) || typeof v.mode !== "string" || !Object.hasOwn(DOMAINS, v.mode) || !Array.isArray(v.choices) || !v.choices.every(x => typeof x === "string" && x.length<=64) || typeof v.seed !== "number") throw new Error("Version ou format de sauvegarde non pris en charge.");
  if (v.version !== 1 && !["equilibre", "services", "resilience"].includes(v.ambition as string)) throw new Error("Priorité du mandat invalide.");
  if(v.city!==undefined&&(v.version!==3||!validateCityBaseline(v.city)))throw new Error('Instantané communal invalide.');
  return replay(v.mode as Mode, v.seed, v.choices, v.version, v.ambition as Ambition,v.city as CityBaseline|undefined);
}
export function save(g: Game, storage: Pick<Storage, "setItem">): boolean {
  try { storage.setItem(STORAGE_KEY, encode(g)); return true; } catch { return false; }
}
