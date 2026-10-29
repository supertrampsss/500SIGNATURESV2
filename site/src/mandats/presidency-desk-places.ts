import type { PressureSectorId } from './pressure-types.ts';

/** Percent anchors on the 1536 × 1024 desk illustration, not simulation data. */
export const DESK_PLACES: Record<PressureSectorId, { x: number; y: number }> = {
  health: { x: 63, y: 11 },
  housing: { x: 54, y: 24 },
  transport: { x: 65, y: 54 },
  energy: { x: 84, y: 28 },
  education: { x: 24, y: 31 },
  administration: { x: 26, y: 60 },
};
