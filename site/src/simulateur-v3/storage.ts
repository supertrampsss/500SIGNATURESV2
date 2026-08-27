import type { CampaignState, Scenario } from "./types.ts";
import { isCampaignState } from "./validation.ts";

export const V3_STORAGE_KEY = "simulateur-v3-campaign";
const V2_STORAGE_KEY = "tunnel-partie";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type RestoreResult =
  | { kind: "restored"; state: CampaignState }
  | { kind: "new" }
  | { kind: "v2_found" }
  | { kind: "invalid" };

export function saveCampaign(storage: StorageLike, state: CampaignState, now = new Date()): CampaignState {
  const saved = { ...state, savedAt: now.toISOString() };
  storage.setItem(V3_STORAGE_KEY, JSON.stringify(saved));
  return saved;
}

export function restoreCampaign(storage: StorageLike, scenario: Scenario): RestoreResult {
  const serialized = storage.getItem(V3_STORAGE_KEY);
  if (serialized === null) return hasV2Campaign(storage) ? { kind: "v2_found" } : { kind: "new" };

  try {
    const parsed: unknown = JSON.parse(serialized);
    return isCampaignState(parsed, scenario) ? { kind: "restored", state: parsed } : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}

export function clearCampaign(storage: StorageLike): void {
  storage.removeItem(V3_STORAGE_KEY);
}

function hasV2Campaign(storage: StorageLike): boolean {
  const serialized = storage.getItem(V2_STORAGE_KEY);
  if (serialized === null) return false;
  try {
    const parsed: unknown = JSON.parse(serialized);
    return typeof parsed === "object" && parsed !== null && (parsed as { version?: unknown }).version === 2;
  } catch {
    return false;
  }
}
