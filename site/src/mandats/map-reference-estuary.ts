import type { NationalSettlement } from "./map-city-national.ts";

/** Remove the small riverbank farm from the shared authored plan so the
 * Rhône's marine mouth can open without carving beneath a foundation. */
export function recomposeReferenceEstuary(town: NationalSettlement): NationalSettlement {
  if (town.name !== "marseille") return town;
  return { ...town, blocks: town.blocks.map(block => ({ ...block,
    buildings: block.buildings.filter(house => house.id !== "marseille-ilot-0-tissu14-2016"),
  })) };
}
