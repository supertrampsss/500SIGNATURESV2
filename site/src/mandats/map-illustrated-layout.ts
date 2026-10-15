import type { MapPlace } from "./map-state.ts";

/** Positions in the approved illustration, excluding its header and side panel. */
export const ILLUSTRATED_MAP_SIZE = { width: 1268, height: 801 } as const;
export const ILLUSTRATED_MAP_PLACES: Readonly<Record<MapPlace, { x: number; y: number }>> = {
  paris: { x: .536, y: .285 },
  lyon: { x: .680599, y: .489388 },
  lille: { x: .609621, y: .112360 },
  rennes: { x: .27, y: .27 },
  nantes: { x: .239748, y: .369538 },
  bordeaux: { x: .28, y: .63 },
  toulouse: { x: .36, y: .79 },
  montpellier: { x: .52, y: .83 },
  marseille: { x: .728707, y: .759051 },
  strasbourg: { x: .84, y: .28 },
  rouen: { x: .40, y: .17 },
  ajaccio: { x: .94, y: .90 },
};
export const ILLUSTRATED_NATIONAL_ANCHOR = { x: .52, y: .52 } as const;
