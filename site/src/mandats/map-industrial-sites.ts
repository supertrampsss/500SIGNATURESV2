import { mapPosition } from "./map-state.ts";

/** One survey for scenery, river clearance, vegetation and building reservations. */
export const POWER_STATION_SITES = [
  { id: "rhone", lon: 5.55, lat: 44.15 },
  { id: "lorraine", lon: 6.8, lat: 48.8 },
] as const;

export function powerStationFootprints() {
  return POWER_STATION_SITES.map(site => {
    const origin = mapPosition(site.lon, site.lat);
    return { id: site.id, x: origin.x + .22, z: origin.z,
      halfW: .50, halfD: .23, rotation: 0, cosine: 1, sine: 0 };
  });
}
