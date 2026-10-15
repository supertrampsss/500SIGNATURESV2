import {
  PARIS_BLOCKS,
  PARIS_SPACES,
  PARIS_LAND_ZONES,
  PARIS_STREETS,
  PARIS_CATHEDRAL_SITE,
} from "./map-city-paris.ts";
import { MAP_PLACES, mapPosition } from "./map-state.ts";

type Point = { x: number; z: number };
export type ParisSoilKind =
  "urban" | "court" | "square" | "garden" | "field" | "wood";
export const PARIS_ORIGIN = mapPosition(
  MAP_PLACES.paris.lon,
  MAP_PLACES.paris.lat,
);
const cathedral = PARIS_CATHEDRAL_SITE;
const cathedralCos = Math.cos(cathedral.angle),
  cathedralSin = Math.sin(cathedral.angle);
const cathedralGround = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
].map(([sx, sz]) => {
  const x = sx * (cathedral.width / 2 + 0.012),
    z = sz * (cathedral.depth / 2 + 0.012);
  return [
    cathedral.x + x * cathedralCos + z * cathedralSin,
    cathedral.z - x * cathedralSin + z * cathedralCos,
  ] as const;
});
export const PARIS_TERRAIN_AREAS = [
  ...PARIS_SPACES,
  ...PARIS_BLOCKS.map((block) => ({
    id: block.id,
    kind: "urban" as const,
    outline: block.outline,
  })),
  {
    id: "sol-cathedrale",
    kind: "urban" as const,
    outline: cathedralGround,
  },
  ...PARIS_LAND_ZONES,
].map((area) => {
  const polygon = area.outline.map(([x, z]) => ({
    x: PARIS_ORIGIN.x + x,
    z: PARIS_ORIGIN.z + z,
  }));
  return {
    ...area,
    polygon,
    minX: Math.min(...polygon.map((p) => p.x)),
    maxX: Math.max(...polygon.map((p) => p.x)),
    minZ: Math.min(...polygon.map((p) => p.z)),
    maxZ: Math.max(...polygon.map((p) => p.z)),
  };
});
const areaBounds = {
  minX: Math.min(...PARIS_TERRAIN_AREAS.map(area => area.minX)),
  maxX: Math.max(...PARIS_TERRAIN_AREAS.map(area => area.maxX)),
  minZ: Math.min(...PARIS_TERRAIN_AREAS.map(area => area.minZ)),
  maxZ: Math.max(...PARIS_TERRAIN_AREAS.map(area => area.maxZ)),
};
const streetPoints = PARIS_STREETS.flatMap(street => street.points);
const streetBounds = {
  minX: PARIS_ORIGIN.x + Math.min(...streetPoints.map(point => point[0])) - .04,
  maxX: PARIS_ORIGIN.x + Math.max(...streetPoints.map(point => point[0])) + .04,
  minZ: PARIS_ORIGIN.z + Math.min(...streetPoints.map(point => point[1])) - .04,
  maxZ: PARIS_ORIGIN.z + Math.max(...streetPoints.map(point => point[1])) + .04,
};

export function parisPolygonContains(
  polygon: readonly Point[],
  x: number,
  z: number,
) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.z > z !== b.z > z &&
      x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x
    )
      inside = !inside;
  }
  return inside;
}

function distance(x: number, z: number, a: Point, b: Point) {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const t = Math.max(
    0,
    Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)),
  );
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}

export function parisAreaAt(x: number, z: number) {
  if (x < areaBounds.minX || x > areaBounds.maxX || z < areaBounds.minZ || z > areaBounds.maxZ)
    return undefined;
  return PARIS_TERRAIN_AREAS.find(
    (area) =>
      x >= area.minX &&
      x <= area.maxX &&
      z >= area.minZ &&
      z <= area.maxZ &&
      parisPolygonContains(area.polygon, x, z),
  );
}

/** Only authored occupation changes; no circular town pad or rectangular wipe. */
export function parisReplacesParcel(x: number, z: number, radius: number) {
  if (
    x < areaBounds.minX - radius || x > areaBounds.maxX + radius ||
    z < areaBounds.minZ - radius || z > areaBounds.maxZ + radius
  )
    return false;
  return PARIS_TERRAIN_AREAS.some((area) => {
    if (
      x < area.minX - radius ||
      x > area.maxX + radius ||
      z < area.minZ - radius ||
      z > area.maxZ + radius
    )
      return false;
    if (parisPolygonContains(area.polygon, x, z)) return true;
    return area.polygon.some(
      (a, i) =>
        distance(x, z, a, area.polygon[(i + 1) % area.polygon.length]) < radius,
    );
  });
}

export function parisStreetClearance(x: number, z: number) {
  if (x < streetBounds.minX || x > streetBounds.maxX || z < streetBounds.minZ || z > streetBounds.maxZ)
    return Infinity;
  let clearance = Infinity;
  for (const street of PARIS_STREETS)
    for (let i = 1; i < street.points.length; i++) {
      const [ax, az] = street.points[i - 1],
        [bx, bz] = street.points[i];
      clearance = Math.min(
        clearance,
        distance(
          x - PARIS_ORIGIN.x,
          z - PARIS_ORIGIN.z,
          { x: ax, z: az },
          { x: bx, z: bz },
        ) -
          street.width / 2,
      );
    }
  return clearance;
}

/** A local river transition joins the geographic Seine without changing others. */
export function parisRiverWeight(x: number, z: number) {
  const dx = Math.max(0, Math.abs(x - PARIS_ORIGIN.x) - 0.75),
    dz = Math.max(0, Math.abs(z - PARIS_ORIGIN.z) - 0.7);
  const t = Math.max(0, Math.min(1, Math.hypot(dx, dz) / 0.55));
  return 1 - t * t * (3 - 2 * t);
}
