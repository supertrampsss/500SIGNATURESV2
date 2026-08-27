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
  | { kind: "invalid" }
  | { kind: "unavailable" };

type V2RestoreResult = Extract<RestoreResult, { kind: "new" | "v2_found" | "unavailable" }>;

export function saveCampaign(storage: StorageLike, state: CampaignState, now = new Date()): CampaignState {
  const saved = { ...state, savedAt: now.toISOString() };
  try {
    storage.setItem(V3_STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Saving is best-effort: an unavailable browser storage must not stop the campaign.
  }
  return saved;
}

export function restoreCampaign(storage: StorageLike, scenario: Scenario): RestoreResult {
  const v3 = readItem(storage, V3_STORAGE_KEY);
  if (v3.kind === "unavailable") return v3;
  if (v3.value === null) return restoreV2Handoff(storage);

  try {
    const parsed: unknown = JSON.parse(v3.value);
    return isCampaignState(parsed, scenario) ? { kind: "restored", state: parsed } : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}

export function clearCampaign(storage: StorageLike): void {
  try {
    storage.removeItem(V3_STORAGE_KEY);
  } catch {
    // Clearing is best-effort for the same reason as saving.
  }
}

function restoreV2Handoff(storage: StorageLike): V2RestoreResult {
  const v2 = readItem(storage, V2_STORAGE_KEY);
  if (v2.kind === "unavailable") return v2;
  if (v2.value === null) return { kind: "new" };
  try {
    const parsed: unknown = JSON.parse(v2.value);
    return typeof parsed === "object" && parsed !== null && (parsed as { version?: unknown }).version === 2
      ? { kind: "v2_found" }
      : { kind: "new" };
  } catch {
    return { kind: "new" };
  }
}

function readItem(storage: StorageLike, key: string): { kind: "value"; value: string | null } | { kind: "unavailable" } {
  try {
    return { kind: "value", value: storage.getItem(key) };
  } catch {
    return { kind: "unavailable" };
  }
}
