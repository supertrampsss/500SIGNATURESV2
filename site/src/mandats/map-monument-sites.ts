import { MAP_PLACES, mapPosition } from "./map-state.ts";
import type { MapPlace } from "./map-state.ts";
import { PARIS_CATHEDRAL_SITE } from "./map-city-paris.ts";

type MonumentSite = {
  town: MapPlace; model: "cathedrale_paris" | "beffroi_nord" | "mairie_sud";
  x: number; z: number; angle: number; width?: number; scale?: number;
};

/** Shared poses of the four large monuments, including their planting guards. */
export const MAJOR_MONUMENT_SITES: readonly MonumentSite[] = [
  { town: "paris", model: "cathedrale_paris", ...PARIS_CATHEDRAL_SITE },
  { town: "lille", model: "beffroi_nord", x: -.48, z: .13, scale: .135, angle: .03 },
  { town: "toulouse", model: "mairie_sud", x: -.35, z: .51, scale: .16, angle: -.03 },
  { town: "lyon", model: "mairie_sud", x: -.42, z: .57, scale: .12, angle: .06 },
];

type Bounds = { width: number; depth: number };

/** Conservative world envelopes use the actual loaded model dimensions. */
export function majorMonumentCanopyReservations(bounds: (site: MonumentSite) => Bounds) {
  return MAJOR_MONUMENT_SITES.map(site => {
    const extent = bounds(site), scale = site.width === undefined ? site.scale! : site.width / extent.width,
      origin = mapPosition(MAP_PLACES[site.town].lon, MAP_PLACES[site.town].lat),
      cosine = Math.abs(Math.cos(site.angle)), sine = Math.abs(Math.sin(site.angle));
    return { town: site.town, x: origin.x + site.x, z: origin.z + site.z,
      halfX: (cosine * extent.width + sine * extent.depth) * scale / 2,
      halfZ: (sine * extent.width + cosine * extent.depth) * scale / 2 };
  });
}
