import { mapBaselinePosition, mapFinalFromBaseline, mapBaselineFromFinal } from "./map-camera-projection.ts";
import { MODEL_URLS } from "./map-model-revisions.ts";
import { LYON_SCHOOL_SITE } from "./map-public-sites.ts";
import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import Delaunator from "delaunator";
import earcut from "earcut";
import { FRANCE_OUTLINES } from "./map-geography.ts";
import { MAP_PLACES, mapPosition, mapCoordinates, mapSourcePosition, mapSourceCoordinates, mapAuthoredPosition, mapAuthoredCoordinates, mapAuthoredJacobian } from "./map-state.ts";
import { landMaterialTextures } from "./map-land-materials.ts";
import type { LandMaterialTextures } from "./map-land-materials.ts";
import { mountainSourceHeight, mountainFaceBand, mountainBreakLines, mountainFaceSurvey, mountainParentFaceSurvey } from "./map-land-crags.ts";
import { NATIONAL_FIELDS, VALLEY_FIELDS, NATIONAL_WOODS, MOUNTAIN_WOODS, CENTRAL_WOODS, CENTRAL_FIELD_EDGES, COMPOSED_COTEAUX, coteauSourceZ, coteauContour } from "./map-land-composition.ts";
import { NATIONAL_SETTLEMENTS } from "./map-city-national.ts";
import {
  cityEnvelopeFootprints,
  urbanFootprint,
  RURAL_SETTLEMENTS,
  AUTHORED_PROJECT_RESERVATIONS,
} from "./map-urban-plans.ts";
import { loadAssetKit } from "./map-asset-kit.ts";
import { geometryContactFrame, geometryProjectionVertices } from "./map-geometry-cache.ts";
import { surveyHarbour, harbourPolygonsOverlap, harbourPolygonContains } from "./map-city-port-plans.ts";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import {
  PARIS_TERRAIN_AREAS,
  PARIS_ORIGIN,
  parisAreaAt,
  parisPolygonContains,
  parisReplacesParcel,
  parisStreetClearance,
  parisRiverWeight,
} from "./map-paris-terrain.ts";

type Point = { x: number; z: number };
type Geometry = {
  positions: number[];
  indices: number[];
  colors: number[];
  uvs: number[];
};

const sourceOutlines = FRANCE_OUTLINES.map((outline) =>
  outline.slice(0, -1).map(([lon, lat]) => mapSourcePosition(lon, lat)),
);
const outlines = sourceOutlines.map(outline => outline.map(point => mapAuthoredPosition(point.x, point.z)));
// Only these private, immutable France contours use the ray index. Other
// parcel/river polygons keep their original full scan, including mutable ones.
const OUTLINE_RAY_STEP = .1;
function outlineRayIndex(polygon: Point[]) {
  const cells = new Map<number, number[]>(),
    minZ = Math.min(...polygon.map(point => point.z)),
    maxZ = Math.max(...polygon.map(point => point.z));
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if (a.z === b.z) continue; // A horizontal edge cannot cross the original ray.
    // This padding only selects candidates at floating grid boundaries. The
    // original strict Z test and X intersection below remain unchanged.
    const first = Math.floor((Math.min(a.z, b.z) - 1e-8) / OUTLINE_RAY_STEP),
      last = Math.floor((Math.max(a.z, b.z) + 1e-8) / OUTLINE_RAY_STEP);
    for (let cell = first; cell <= last; cell++) {
      const edges = cells.get(cell) ?? [];
      edges.push(i); cells.set(cell, edges);
    }
  }
  return { cells, minZ, maxZ };
}
// Initialize before any module-level terrain or river query, preserving order.
const outlineRayIndices = new WeakMap<Point[], ReturnType<typeof outlineRayIndex>>(
  [...sourceOutlines, ...outlines].map(polygon => [polygon, outlineRayIndex(polygon)] as const),
);
const schoolOrigin = mapPosition(MAP_PLACES[LYON_SCHOOL_SITE.town].lon, MAP_PLACES[LYON_SCHOOL_SITE.town].lat);
const surveyedFootprints = [
  ...cityEnvelopeFootprints().map(footprint => ({ ...footprint, schoolPlatform: false })),
  { x: schoolOrigin.x + LYON_SCHOOL_SITE.x, z: schoolOrigin.z + LYON_SCHOOL_SITE.z,
    halfW: LYON_SCHOOL_SITE.halfW, halfD: LYON_SCHOOL_SITE.halfD,
    rotation: 0, settlement: LYON_SCHOOL_SITE.town, localLevel: true, schoolPlatform: true },
].map((footprint) => ({
  ...footprint,
  cosine: Math.cos(footprint.rotation),
  sine: Math.sin(footprint.rotation),
}));
const sourceBounds = {
  minX: Math.min(...sourceOutlines.flat().map(({ x }) => x)), maxX: Math.max(...sourceOutlines.flat().map(({ x }) => x)),
  minZ: Math.min(...sourceOutlines.flat().map(({ z }) => z)), maxZ: Math.max(...sourceOutlines.flat().map(({ z }) => z)),
};
const parisBounds = {
  minX: Math.min(PARIS_ORIGIN.x - 1.80, ...PARIS_TERRAIN_AREAS.map(area => area.minX)),
  maxX: Math.max(PARIS_ORIGIN.x + 1.80, ...PARIS_TERRAIN_AREAS.map(area => area.maxX)),
  minZ: Math.min(PARIS_ORIGIN.z - 1.60, ...PARIS_TERRAIN_AREAS.map(area => area.minZ)),
  maxZ: Math.max(PARIS_ORIGIN.z + 1.60, ...PARIS_TERRAIN_AREAS.map(area => area.maxZ)),
};
const parisSector = (x: number, z: number) =>
  x > parisBounds.minX && x < parisBounds.maxX &&
  z > parisBounds.minZ && z < parisBounds.maxZ;
const composedWoods = [...NATIONAL_WOODS, ...MOUNTAIN_WOODS, ...CENTRAL_WOODS].map((wood) => {
  const sourcePolygon = wood.outline.map(([x, z]) => wood.geographic ? mapSourcePosition(x, z) : { x, z }),
    polygon = sourcePolygon.map(point => mapAuthoredPosition(point.x, point.z));
  const groups = wood.groups?.map(([x, z, rx, rz]) => ({ ...(wood.geographic ? mapSourcePosition(x, z) : { x, z }), rx, rz }));
  return { ...wood, polygon, sourcePolygon, groups,
    sourceMinX: Math.min(...sourcePolygon.map(point => point.x)), sourceMaxX: Math.max(...sourcePolygon.map(point => point.x)),
    sourceMinZ: Math.min(...sourcePolygon.map(point => point.z)), sourceMaxZ: Math.max(...sourcePolygon.map(point => point.z)),
    minX: Math.min(...polygon.map(point => point.x)),
    maxX: Math.max(...polygon.map(point => point.x)),
    minZ: Math.min(...polygon.map(point => point.z)),
    maxZ: Math.max(...polygon.map(point => point.z)),
  };
});
const largeCropCells = new Map<string, Point[][]>();
for (const field of NATIONAL_FIELDS) {
  const polygon = field.outline.map(([x, z]) => ({ x, z }));
  for (let x = Math.floor(Math.min(...polygon.map(p => p.x)) / .5); x <= Math.floor(Math.max(...polygon.map(p => p.x)) / .5); x++)
    for (let z = Math.floor(Math.min(...polygon.map(p => p.z)) / .5); z <= Math.floor(Math.max(...polygon.map(p => p.z)) / .5); z++) {
      const key = `${x}:${z}`, cell = largeCropCells.get(key) ?? [];
      cell.push(polygon); largeCropCells.set(key, cell);
    }
}
function largeCropAt(x: number, z: number) {
  const source = mapAuthoredCoordinates(x, z);
  return largeCropCells.get(`${Math.floor(source.x / .5)}:${Math.floor(source.z / .5)}`)?.some(polygon => contains(polygon, source.x, source.z)) ?? false;
}
const woodCells = new Map<string, typeof composedWoods>();
for (const wood of composedWoods)
  for (let x = Math.floor(wood.minX / 0.5); x <= Math.floor(wood.maxX / 0.5); x++)
    for (let z = Math.floor(wood.minZ / 0.5); z <= Math.floor(wood.maxZ / 0.5); z++) {
      const key = `${x}:${z}`, cell = woodCells.get(key) ?? [];
      cell.push(wood);
      woodCells.set(key, cell);
    }
function nationalWoodAt(x: number, z: number) {
  return woodCells.get(`${Math.floor(x / 0.5)}:${Math.floor(z / 0.5)}`)?.find(
    (wood) => x >= wood.minX && x <= wood.maxX && z >= wood.minZ && z <= wood.maxZ &&
      contains(wood.polygon, x, z) &&
      (wood.minHeight === undefined || landHeight(x, z) >= wood.minHeight) &&
      (wood.maxHeight === undefined || landHeight(x, z) <= wood.maxHeight),
  );
}
const composedBlocks = NATIONAL_SETTLEMENTS.flatMap(town => {
  const origin = mapPosition(town.lon, town.lat);
  return town.blocks.map(block => {
    const polygon = block.outline.map(([x, z]) => ({ x: origin.x + x, z: origin.z + z }));
    return { polygon, minX: Math.min(...polygon.map(p => p.x)), maxX: Math.max(...polygon.map(p => p.x)),
      minZ: Math.min(...polygon.map(p => p.z)), maxZ: Math.max(...polygon.map(p => p.z)) };
  });
});
const blockCells = new Map<string, typeof composedBlocks>();
for (const block of composedBlocks)
  for (let x = Math.floor(block.minX / 0.5); x <= Math.floor(block.maxX / 0.5); x++)
    for (let z = Math.floor(block.minZ / 0.5); z <= Math.floor(block.maxZ / 0.5); z++) {
      const key = `${x}:${z}`, cell = blockCells.get(key) ?? [];
      cell.push(block);
      blockCells.set(key, cell);
    }
function nationalBlockAt(x: number, z: number) {
  return blockCells.get(`${Math.floor(x / 0.5)}:${Math.floor(z / 0.5)}`)?.find(
    block => x >= block.minX && x <= block.maxX && z >= block.minZ && z <= block.maxZ && contains(block.polygon, x, z),
  );
}
const baselineRiverControls = (locations: number[][]) => locations.map(([lon, lat]) => mapBaselinePosition(lon, lat));
const rivers = [
  // Curved geographic paths, not straight city-to-city links.
  {
    width: 0.055,
    points: baselineRiverControls([
      [4.0, 47.8],
      [3.5, 48.35],
      [2.4, 48.82],
      [1.8, 49.03],
      [1.42, 49.28],
      [1.1, 49.44],
      [0.82, 49.46],
      [0.52, 49.44],
      [0.2, 49.45],
    ]),
  },
  {
    width: 0.06,
    points: baselineRiverControls([
      [4.05, 44.85],
      [3.9, 45.45],
      [3.15, 46.4],
      [2.7, 47.15],
      [2.45, 47.68],
      [1.9, 47.88],
      [1.48, 47.58],
      [0.75, 47.39],
      [-0.35, 47.4],
      [-1.15, 47.34],
      [-1.55, 47.22],
      [-2.1, 47.27],
    ]),
  },
  {
    width: 0.055,
    points: baselineRiverControls([
      [0.6, 42.85],
      [0.95, 43.1],
      [1.45, 43.6],
      [1.28, 44.02],
      [0.65, 44.3],
      [-0.03, 44.57],
      [-0.57, 44.84],
      [-0.67, 45.03],
      [-0.85, 45.35],
      [-1.08, 45.57],
    ]),
  },
  {
    width: 0.06,
    points: baselineRiverControls([
      [5.83, 46.13],
      [5.45, 45.95],
      [4.86, 45.78],
      [4.78, 45.31],
      [4.87, 44.92],
      [4.74, 44.5],
      [4.67, 44.05],
      [4.75, 43.68],
      [4.67, 43.4],
    ]),
  },
  {
    width: 0.032,
    points: baselineRiverControls([
      [2.8, 45.5],
      [2.3, 45.28],
      [1.4, 45.0],
      [0.85, 44.86],
      [0.12, 44.86],
      [-0.45, 44.98],
    ]),
  },
];
const riverPaths = rivers.map((river, index) => ({
  ...river,
  index,
  path: curvedPath(river.points).map(point => mapFinalFromBaseline(point.x, point.z)),
}));
// The headwater begins as a point and grows with travelled distance. Using
// distance rather than control-point index gives every watershed a gentle
// source, including the sections stretched by the eastern projection.
const riverDistances = riverPaths.map(river => {
  const distances = [0];
  for (let i = 1; i < river.path.length; i++)
    distances.push(distances[i - 1] + Math.hypot(
      river.path[i].x - river.path[i - 1].x, river.path[i].z - river.path[i - 1].z));
  return distances;
});
function riverSourceBlend(river: (typeof riverPaths)[number], index: number) {
  return smooth(clamp(riverDistances[river.index][index] / [.85, .90, .65, .72, .65][river.index]));
}

function contains(polygon: Point[], x: number, z: number) {
  const index = outlineRayIndices.get(polygon);
  if (index && Number.isFinite(x) && Number.isFinite(z)) {
    // Only Z bounds are used; no rounded X bound can change ray parity.
    if (z < index.minZ - 1e-8 || z > index.maxZ + 1e-8) return false;
    let hit = false;
    for (const i of index.cells.get(Math.floor(z / OUTLINE_RAY_STEP)) ?? []) {
      const a = polygon[i], b = polygon[i === 0 ? polygon.length - 1 : i - 1];
      if (
        a.z > z !== b.z > z &&
        x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x
      ) hit = !hit;
    }
    return hit;
  }
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.z > z !== b.z > z &&
      x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x
    )
      hit = !hit;
  }
  return hit;
}

export function landContains(x: number, z: number): boolean {
  return outlines.some((outline) => contains(outline, x, z));
}

function hash(x: number, z: number) {
  let value = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
function noise(x: number, z: number) {
  const ix = Math.floor(x),
    iz = Math.floor(z);
  const tx = smooth(x - ix),
    tz = smooth(z - iz);
  return mix(
    mix(hash(ix, iz), hash(ix + 1, iz), tx),
    mix(hash(ix, iz + 1), hash(ix + 1, iz + 1), tx),
    tz,
  );
}

function segmentDistance(x: number, z: number, a: Point, b: Point) {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz));
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}

function hill(
  x: number,
  z: number,
  cx: number,
  cz: number,
  sx: number,
  sz: number,
) {
  return Math.exp(-(((x - cx) / sx) ** 2 + ((z - cz) / sz) ** 2));
}

const borderCells = new Map<string, Array<{ a: Point; b: Point }>>();
for (const outline of sourceOutlines)
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      reach = 0.34;
    for (
      let x = Math.floor((Math.min(a.x, b.x) - reach) / 0.4);
      x <= Math.floor((Math.max(a.x, b.x) + reach) / 0.4);
      x++
    ) {
      for (
        let z = Math.floor((Math.min(a.z, b.z) - reach) / 0.4);
        z <= Math.floor((Math.max(a.z, b.z) + reach) / 0.4);
        z++
      ) {
        const key = `${x}:${z}`,
          cell = borderCells.get(key) ?? [];
        cell.push({ a, b });
        borderCells.set(key, cell);
      }
    }
  }
function borderDistance(x: number, z: number) {
  let distance = 0.34;
  for (const { a, b } of borderCells.get(
    `${Math.floor(x / 0.4)}:${Math.floor(z / 0.4)}`,
  ) ?? []) {
    distance = Math.min(distance, segmentDistance(x, z, a, b));
  }
  return distance;
}

type PlainShoulder = { width: number; height: number; points: readonly (readonly [number, number])[] };
// Connected watersheds frame the actual cultivated basins. Their changing
// crest and terraced flanks belong to the terrain sampled by crops and roads.
const plainShoulders: readonly PlainShoulder[] = [
  { width: .67, height: .13, points: [[-4.77,1.66],[-4.13,1.77],[-3.42,1.71],[-2.82,1.88]] },
  { width: .81, height: .17, points: [[-2.46,2.78],[-1.82,2.89],[-1.09,2.81],[-.55,3.07]] },
  { width: .72, height: .14, points: [[-.65,3.77],[-.04,3.85],[.62,4.16],[1.04,4.02]] },
  { width: .91, height: .18, points: [[1.11,2.98],[1.68,2.70],[2.27,2.39],[2.62,1.94]] },
  { width: .73, height: .15, points: [[-2.71,.64],[-2.04,.79],[-1.34,.57],[-.66,.38]] },
  { width: 1.04, height: .22, points: [[-.38,-.40],[.13,-.55],[.69,-.27],[1.26,-.08]] },
  { width: .81, height: .17, points: [[-1.96,-.73],[-1.43,-.93],[-.98,-1.28],[-.39,-1.40]] },
  { width: .89, height: .20, points: [[-2.05,-2.23],[-1.48,-2.15],[-.78,-2.22],[-.16,-1.93]] },
  { width: .68, height: .14, points: [[1.31,-.85],[1.61,-1.36],[1.54,-1.91],[1.79,-2.43]] },
  { width: .79, height: .16, points: [[.66,-2.75],[1.19,-2.85],[1.77,-2.67],[2.26,-2.58]] },
  { width: .58, height: .12, points: [[-2.38,-3.05],[-1.69,-3.22],[-.92,-3.29],[-.12,-3.51]] },
  { width: .61, height: .11, points: [[3.04,-1.23],[3.13,-1.76],[3.41,-2.24],[3.66,-2.59]] },
];
const centralValleys = [
  [[-.54,-1.21],[-.19,-1.23],[.15,-1.26],[.49,-1.31],[.92,-1.42]],
  [[-.48,-1.61],[-.12,-1.60],[.25,-1.55],[.60,-1.60],[1.03,-1.70]],
] as const;
function centralCultivatedRelief(sx: number, sz: number) {
  const margin = Math.min(sx + .62, 1.10 - sx, sz + 1.82, -.92 - sz);
  if (margin <= 0) return 0;
  let floor = 0, flank = 0;
  for (const valley of centralValleys) {
    let distance = Infinity;
    for (let i = 1; i < valley.length; i++) {
      const [ax, az] = valley[i - 1], [bx, bz] = valley[i],
        dx = bx - ax, dz = bz - az,
        t = clamp(((sx - ax) * dx + (sz - az) * dz) / (dx * dx + dz * dz));
      distance = Math.min(distance, Math.hypot(sx - ax - dx * t, sz - az - dz * t));
    }
    floor = Math.max(floor, .055 * (1 - smooth(clamp(distance / .13))));
    if (distance > .10 && distance < .43) {
      const ledge = clamp((distance - .10) / .33);
      flank = Math.max(flank, .105 * Math.sin(Math.PI * ledge));
    }
  }
  return (flank - floor) * smooth(clamp(margin / .13));
}
const constructionReservations = Object.entries(AUTHORED_PROJECT_RESERVATIONS).flatMap(([town, sites]) => {
  const place = MAP_PLACES[town as keyof typeof MAP_PLACES], origin = mapPosition(place.lon, place.lat);
  return sites!.map(site => ({ x: origin.x + site.x, z: origin.z + site.z,
    halfW: .235, halfD: .225, rotation: 0, cosine: 1, sine: 0 }));
});
// Width follows real foundations and reserved works, not town envelopes.
// These extra service rectangles are the physical sites in map-cities and
// map-city-infrastructure. Bridge end supports keep their existing spans.
const riverStructureFootprints = [
  ...surveyedFootprints,
  ...constructionReservations,
  ...[
    ["lille", -.70, -.65, .19, .19],
    ["rennes", .37, .47, .14, .075],
    [LYON_SCHOOL_SITE.town, LYON_SCHOOL_SITE.x, LYON_SCHOOL_SITE.z,
      LYON_SCHOOL_SITE.halfW, LYON_SCHOOL_SITE.halfD],
    [LYON_SCHOOL_SITE.town, LYON_SCHOOL_SITE.riverWidthAnchor.x, LYON_SCHOOL_SITE.riverWidthAnchor.z,
      LYON_SCHOOL_SITE.halfW, LYON_SCHOOL_SITE.halfD],
  ].map(([town, x, z, halfW, halfD]) => {
    const place = MAP_PLACES[town as keyof typeof MAP_PLACES], origin = mapPosition(place.lon, place.lat);
    return { x: origin.x + Number(x), z: origin.z + Number(z), halfW: Number(halfW), halfD: Number(halfD), rotation: 0, cosine: 1, sine: 0 };
  }),
  ...[[4.9, 44.6], [5.82, 48.9]].map(([lon, lat]) => {
    const origin = mapPosition(lon, lat);
    return { x: origin.x + .14, z: origin.z, halfW: .40, halfD: .23, rotation: 0, cosine: 1, sine: 0 };
  }),
  ...([
    ["paris", .543, -.318, .62, .16], ["rouen", -.06, .012, .16, .16],
    ["nantes", .012, 0, .07, .17], ["bordeaux", .004, 0, .06, .17],
    ["toulouse", .007, 0, .12, .16], ["lyon", .025, .02, .15, .17],
  ] as Array<[keyof typeof MAP_PLACES, number, number, number, number]>).flatMap(([town, x, z, angle, length]) => {
    const place = MAP_PLACES[town], origin = mapPosition(place.lon, place.lat), sine = Math.sin(angle), cosine = Math.cos(angle);
    return [-1, 1].map(side => ({ x: origin.x + x + sine * length * .45 * side,
      z: origin.z + z + cosine * length * .45 * side, halfW: .0335, halfD: .009,
      rotation: -angle, cosine, sine: -sine }));
  }),
];
const riverStructureCells = new Map<string, typeof riverStructureFootprints>();
for (const footprint of riverStructureFootprints) {
  const halfX = Math.abs(footprint.cosine) * footprint.halfW + Math.abs(footprint.sine) * footprint.halfD,
    halfZ = Math.abs(footprint.sine) * footprint.halfW + Math.abs(footprint.cosine) * footprint.halfD;
  for (let x = Math.floor((footprint.x - halfX) / .5); x <= Math.floor((footprint.x + halfX) / .5); x++)
    for (let z = Math.floor((footprint.z - halfZ) / .5); z <= Math.floor((footprint.z + halfZ) / .5); z++) {
      const key = `${x}:${z}`, cell = riverStructureCells.get(key) ?? [];
      cell.push(footprint); riverStructureCells.set(key, cell);
    }
}
function riverOriginalWidth(river: (typeof riverPaths)[number], point: Point, mouth: number) {
  const multiplier = .57 + mouth * .58;
  return river.index === 0
    ? river.width * multiplier + (.075 - river.width * multiplier) * parisRiverWeight(point.x, point.z)
    : river.width * multiplier;
}
function riverStructureDistance(a: Point, b: Point, footprint: (typeof riverStructureFootprints)[number]) {
  const local = (point: Point) => ({
    x: (point.x - footprint.x) * footprint.cosine + (point.z - footprint.z) * footprint.sine,
    z: -(point.x - footprint.x) * footprint.sine + (point.z - footprint.z) * footprint.cosine,
  });
  const p = local(a), q = local(b), hx = footprint.halfW, hz = footprint.halfD;
  // Slab intersection, including a segment passing through a rectangle while
  // both end points remain outside it.
  let lo = 0, hi = 1;
  for (const [origin, delta, half] of [[p.x, q.x - p.x, hx], [p.z, q.z - p.z, hz]]) {
    if (Math.abs(delta) < 1e-12) { if (Math.abs(origin) > half) { lo = 2; break; } }
    else { const t0 = (-half - origin) / delta, t1 = (half - origin) / delta;
      lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1)); }
  }
  if (lo <= hi && lo <= 1 && hi >= 0) return 0;
  const pointDistance = (point: Point) => Math.hypot(Math.max(0, Math.abs(point.x) - hx), Math.max(0, Math.abs(point.z) - hz));
  return Math.min(pointDistance(p), pointDistance(q),
    ...[[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([x, z]) => segmentDistance(x, z, p, q)));
}
const riverWidthProfiles = riverPaths.map(river => {
  const widths = river.path.map((point, i) => {
    const mouth = i / river.path.length,
      original = riverOriginalWidth(river, point, mouth),
      target = [.235, .210, .215, .185, .125][river.index] * (.73 + mouth * .27) +
        (river.index === 0 ? .025 * parisRiverWeight(point.x, point.z) : 0);
    return Math.max(original, target) * riverSourceBlend(river, i);
  });
  for (let i = 1; i < river.path.length; i++) {
    const a = river.path[i - 1], b = river.path[i], nearby = new Set<(typeof riverStructureFootprints)[number]>();
    for (let x = Math.floor((Math.min(a.x, b.x) - .22) / .5); x <= Math.floor((Math.max(a.x, b.x) + .22) / .5); x++)
      for (let z = Math.floor((Math.min(a.z, b.z) - .22) / .5); z <= Math.floor((Math.max(a.z, b.z) + .22) / .5); z++)
        for (const footprint of riverStructureCells.get(`${x}:${z}`) ?? []) nearby.add(footprint);
    const clearance = Math.min(Infinity, ...[...nearby].map(footprint => riverStructureDistance(a, b, footprint))),
      // The wet edge, visible bank and carved soil remain outside the padded
      // foundation or works rectangle. Legacy bridge defects are not widened.
      limit = Math.max(0, 2 * (clearance - .040));
    for (const index of [i - 1, i])
      widths[index] = Math.max(
        riverOriginalWidth(river, river.path[index], index / river.path.length) * riverSourceBlend(river, index),
        Math.min(widths[index], limit));
  }
  // A Lipschitz envelope broadens the river gradually after a bridge or house;
  // it only lowers widths, so it cannot defeat the physical clearance cap.
  for (let i = 1; i < widths.length; i++)
    widths[i] = Math.min(widths[i], widths[i - 1] + .35 * Math.hypot(river.path[i].x - river.path[i - 1].x, river.path[i].z - river.path[i - 1].z));
  for (let i = widths.length - 2; i >= 0; i--)
    widths[i] = Math.min(widths[i], widths[i + 1] + .35 * Math.hypot(river.path[i + 1].x - river.path[i].x, river.path[i + 1].z - river.path[i].z));
  return widths;
});
function riverSurveyWidth(river: (typeof riverPaths)[number], index: number) {
  return riverWidthProfiles[river.index][index];
}
const riverSections = riverPaths.map(river => river.path.map((center, index) => {
  const a = river.path[Math.max(0, index - 1)], b = river.path[Math.min(river.path.length - 1, index + 1)],
    length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { center, nx: (b.z - a.z) / length, nz: -(b.x - a.x) / length,
    width: riverSurveyWidth(river, index), distance: riverDistances[river.index][index],
    bank: (.012 + parisRiverWeight(center.x, center.z) * .004) * riverSourceBlend(river, index) };
}));
type RiverSegment = { a: Point; b: Point; widthA: number; widthB: number; mouth: number; water: Point[]; rendered: boolean };
const riverCells = new Map<string, RiverSegment[]>();
const riverQueryCandidates = new Map<string, readonly RiverSegment[]>();
const riverQueryBounds = new WeakMap<RiverSegment, { minX: number; maxX: number; minZ: number; maxZ: number }>();
for (const river of riverPaths) {
  const sections = riverSections[river.index];
  for (let i = 1; i < sections.length; i++) {
    const a = sections[i - 1], b = sections[i], edge = (section: typeof a, side: number) => ({
      x: section.center.x + section.nx * side * section.width / 2,
      z: section.center.z + section.nz * side * section.width / 2,
    });
    const segment: RiverSegment = { a: a.center, b: b.center, widthA: a.width, widthB: b.width,
      mouth: i / river.path.length, water: [edge(a, -1), edge(b, -1), edge(b, 1), edge(a, 1)],
      rendered: landContains(a.center.x, a.center.z) && landContains(b.center.x, b.center.z) },
      reach = Math.max(a.width, b.width) / 2 + .04;
    for (let x = Math.floor((Math.min(a.center.x, b.center.x) - reach) / .25); x <= Math.floor((Math.max(a.center.x, b.center.x) + reach) / .25); x++)
      for (let z = Math.floor((Math.min(a.center.z, b.center.z) - reach) / .25); z <= Math.floor((Math.max(a.center.z, b.center.z) + reach) / .25); z++) {
        const key = `${x}:${z}`, cell = riverCells.get(key) ?? [];
        cell.push(segment); riverCells.set(key, cell);
      }
  }
}
function riverSegmentWidth(segment: RiverSegment, x: number, z: number) {
  const dx = segment.b.x - segment.a.x, dz = segment.b.z - segment.a.z,
    t = clamp(((x - segment.a.x) * dx + (z - segment.a.z) * dz) / (dx * dx + dz * dz));
  return mix(segment.widthA, segment.widthB, t);
}

function constructionReservationContains(x: number, z: number, margin: number) {
  return constructionReservations.some(site =>
    Math.abs(x - site.x) < site.halfW + margin && Math.abs(z - site.z) < site.halfD + margin);
}
const lowlandProtection = [
  ...surveyedFootprints,
  ...NATIONAL_SETTLEMENTS.flatMap(town => {
    const origin = mapPosition(town.lon, town.lat);
    return (town.streets ?? []).flatMap(street => street.points.slice(1).map((b, i) => {
      const a = street.points[i], dx = b[0] - a[0], dz = b[1] - a[1], rotation = Math.atan2(dz, dx);
      return { x: origin.x + (a[0] + b[0]) / 2, z: origin.z + (a[1] + b[1]) / 2,
        halfW: Math.hypot(dx, dz) / 2 + .016, halfD: street.width / 2 + .016,
        rotation, cosine: Math.cos(rotation), sine: Math.sin(rotation) };
    }));
  }),
  ...constructionReservations,
  ...[...Object.values(MAP_PLACES), ...RURAL_SETTLEMENTS].map(place => ({ ...mapPosition(place.lon, place.lat),
    halfW: .10, halfD: .10, rotation: 0, cosine: 1, sine: 0 })),
];
const lowlandProtectionCells = new Map<string, typeof lowlandProtection>();
for (const footprint of lowlandProtection) {
  const halfX = Math.abs(footprint.cosine) * footprint.halfW + Math.abs(footprint.sine) * footprint.halfD + .40,
    halfZ = Math.abs(footprint.sine) * footprint.halfW + Math.abs(footprint.cosine) * footprint.halfD + .40;
  for (let x = Math.floor((footprint.x - halfX) / .50); x <= Math.floor((footprint.x + halfX) / .50); x++)
    for (let z = Math.floor((footprint.z - halfZ) / .50); z <= Math.floor((footprint.z + halfZ) / .50); z++) {
      const key = `${x}:${z}`, cell = lowlandProtectionCells.get(key) ?? [];
      cell.push(footprint); lowlandProtectionCells.set(key, cell);
    }
}

type CultivatedValleySide = readonly (readonly [number, number])[];
// Sections use the existing final river frame: a field keeps the same outline
// and projection while its floor, benches and watershed become real ground.
const cultivatedValleyProfiles: Array<{ river: number; sides: [CultivatedValleySide, CultivatedValleySide] }> = [
  { river: 1, sides: [
    [[0,0],[.16,0],[.31,.035],[.46,.042],[.71,.125],[.83,.133],[1.01,.162],[1.39,0]],
    [[0,0],[.15,0],[.32,.056],[.52,.061],[.79,.155],[.92,.163],[1.16,.214],[1.65,0]],
  ] },
  { river: 3, sides: [
    [[0,0],[.16,0],[.32,.052],[.48,.056],[.74,.158],[.88,.162],[1.13,.216],[1.67,0]],
    [[0,0],[.15,0],[.31,.035],[.48,.040],[.78,.112],[.96,.115],[1.20,.154],[1.61,0]],
  ] },
];
type CultivatedValleySegment = {
  a: Point; b: Point; distance: number; length: number; widthA: number; widthB: number;
  profile: (typeof cultivatedValleyProfiles)[number]; total: number;
};
const cultivatedValleyCells = new Map<string, CultivatedValleySegment[]>();
for (const profile of cultivatedValleyProfiles) {
  const sections = riverSections[profile.river],
    total = sections[sections.length - 1].distance;
  for (let i = 1; i < sections.length; i++) {
    const a = sections[i - 1], b = sections[i],
      length = Math.hypot(b.center.x - a.center.x, b.center.z - a.center.z);
    if (length === 0) continue;
    const segment = { a: a.center, b: b.center, distance: a.distance, length,
      widthA: a.width, widthB: b.width, profile, total },
      reach = Math.max(...profile.sides.map(side => side[side.length - 1][0])) +
        Math.max(a.width, b.width) / 2;
    for (let x = Math.floor((Math.min(a.center.x, b.center.x) - reach) / .5);
      x <= Math.floor((Math.max(a.center.x, b.center.x) + reach) / .5); x++)
      for (let z = Math.floor((Math.min(a.center.z, b.center.z) - reach) / .5);
        z <= Math.floor((Math.max(a.center.z, b.center.z) + reach) / .5); z++) {
        const key = `${x}:${z}`, cell = cultivatedValleyCells.get(key) ?? [];
        cell.push(segment); cultivatedValleyCells.set(key, cell);
      }
  }
}
function cultivatedValleyProfile(x: number, z: number) {
  const nearest = new Map<number, { segment: CultivatedValleySegment; t: number; distance: number; signed: number }>();
  for (const segment of cultivatedValleyCells.get(`${Math.floor(x / .5)}:${Math.floor(z / .5)}`) ?? []) {
    const dx = segment.b.x - segment.a.x, dz = segment.b.z - segment.a.z,
      t = clamp(((x - segment.a.x) * dx + (z - segment.a.z) * dz) / (segment.length * segment.length)),
      distance = Math.hypot(x - segment.a.x - dx * t, z - segment.a.z - dz * t);
    if (distance >= (nearest.get(segment.profile.river)?.distance ?? Infinity)) continue;
    nearest.set(segment.profile.river, { segment, t, distance,
      signed: ((x - segment.a.x) * dz - (z - segment.a.z) * dx) / segment.length });
  }
  const parisDistance = Math.max(parisBounds.minX - x, x - parisBounds.maxX,
    parisBounds.minZ - z, z - parisBounds.maxZ, 0);
  let height = 0, influence = 0;
  for (const { segment, t, distance, signed } of nearest.values()) {
    const profile = segment.profile.sides[signed < 0 ? 0 : 1],
      shoreDistance = Math.max(0, distance - mix(segment.widthA, segment.widthB, t) / 2),
      outer = profile[profile.length - 1][0], crest = profile[profile.length - 2][0];
    if (shoreDistance >= outer) continue;
    const along = segment.distance + t * segment.length,
      fade = smooth(clamp(along / .70)) * smooth(clamp((segment.total - along) / 1.10)),
      weight = fade * (1 - smooth(clamp((shoreDistance - crest) / (outer - crest)))) *
        smooth(clamp(parisDistance / .18));
    if (weight <= influence) continue;
    let elevation = 0;
    for (let i = 1; i < profile.length; i++) {
      const a = profile[i - 1], b = profile[i];
      if (shoreDistance > b[0]) continue;
      elevation = mix(a[1], b[1], clamp((shoreDistance - a[0]) / (b[0] - a[0])));
      break;
    }
    // Slow longitudinal movement makes continuous ridges, not isolated humps.
    height = elevation * (.92 + .08 * Math.sin(along * .73 + segment.profile.river));
    influence = weight;
  }
  return { height, influence };
}
function cultivatedClearance(x: number, z: number) {
  let clearance = Infinity;
  for (const footprint of lowlandProtectionCells.get(`${Math.floor(x / .50)}:${Math.floor(z / .50)}`) ?? []) {
    const dx = x - footprint.x, dz = z - footprint.z,
      px = Math.abs(dx * footprint.cosine + dz * footprint.sine) - footprint.halfW,
      pz = Math.abs(-dx * footprint.sine + dz * footprint.cosine) - footprint.halfD;
    clearance = Math.min(clearance, Math.hypot(Math.max(0, px), Math.max(0, pz)) + Math.min(0, Math.max(px, pz)));
  }
  return clearance;
}
// These are vertices of the very same landscape mesh, not overlay contours.
// Each polyline follows one change of slope in the asymmetric valley section.
function cultivatedValleyBreakLines() {
  const lines: Point[][] = [];
  for (const profile of cultivatedValleyProfiles)
    for (let side = 0; side < 2; side++)
      for (const [distance] of profile.sides[side].slice(1, -1)) {
        const direction = side === 0 ? -1 : 1;
        lines.push(riverSections[profile.river].map(section => ({
          x: section.center.x + section.nx * direction * (section.width / 2 + distance),
          z: section.center.z + section.nz * direction * (section.width / 2 + distance),
        })));
      }
  return lines;
}

// Continuous cultivated faces replace the old diffuse shoulders only here.
// They share their exact source-frame contours with fields and wooded crests.
function composedCoteauProfile(sx: number, sz: number) {
  let height = 0, influence = 0;
  for (const coteau of COMPOSED_COTEAUX) {
    const first = coteau.spine[0][0], last = coteau.spine[coteau.spine.length - 1][0];
    if (sx <= first || sx >= last) continue;
    const offset = sz - coteauSourceZ(coteau, sx), section = coteau.section,
      low = section[0][0], high = section[section.length - 1][0];
    if (offset <= low || offset >= high) continue;
    const weight = smooth(clamp((sx - first) / .20)) * smooth(clamp((last - sx) / .20)) *
      smooth(clamp((offset - low) / .19)) * smooth(clamp((high - offset) / .19));
    if (weight <= influence) continue;
    for (let i = 1; i < section.length; i++) {
      const a = section[i - 1], b = section[i];
      if (offset > b[0]) continue;
      height = mix(a[1], b[1], clamp((offset - a[0]) / (b[0] - a[0])));
      break;
    }
    influence = weight;
  }
  return { height, influence };
}
function composedCoteauBreakLines() {
  return COMPOSED_COTEAUX.flatMap(coteau =>
    coteau.section.slice(1, -1).map(([offset]) =>
      coteauContour(coteau, offset).map(([x, z]) => mapAuthoredPosition(x, z))));
}

function cultivatedRelief(x: number, z: number, sx: number, sz: number, mineral: number) {
  if (mineral > .40 || borderDistance(sx, sz) < .09) return 0;
  const clearance = cultivatedClearance(x, z);
  if (clearance < .065 || riverContains(x, z, .055)) return 0;
  const protectedBlend = smooth(clamp((clearance - .065) / .14)),
    coastalBlend = smooth(clamp((borderDistance(sx, sz) - .09) / .18)),
    mineralBlend = 1 - smooth(clamp((mineral - .08) / .32));
  let shoulder = 0;
  for (const ridge of plainShoulders) for (let i = 1; i < ridge.points.length; i++) {
    const [ax, az] = ridge.points[i - 1], [bx, bz] = ridge.points[i], dx = bx - ax, dz = bz - az,
      t = clamp(((sx - ax) * dx + (sz - az) * dz) / (dx * dx + dz * dz)),
      distance = Math.hypot(sx - ax - dx * t, sz - az - dz * t) / ridge.width;
    if (distance >= 1) continue;
    const flank = distance < .24 ? 1 - distance * .36 : distance < .55 ?
      mix(.914, .55, smooth((distance - .24) / .31)) : mix(.55, 0, smooth((distance - .55) / .45)),
      crest = .86 + Math.sin((i - 1 + t) * 1.37 + ridge.height * 11) * .14;
    shoulder = Math.max(shoulder, flank * ridge.height * crest);
  }
  const cellX = Math.floor(x / .25), cellZ = Math.floor(z / .25);
  let valley = 0, riverDistance = Infinity;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++)
    for (const segment of riverCells.get(`${cellX + dx}:${cellZ + dz}`) ?? []) {
      const distance = segmentDistance(x, z, segment.a, segment.b) -
        riverSegmentWidth(segment, x, z) / 2;
      riverDistance = Math.min(riverDistance, distance);
      if (distance > .055 && distance < .30) valley = Math.max(valley,
        .045 * Math.sin(Math.PI * clamp((distance - .055) / .245)));
    }
  // A broad valley floor separates the river's unchanged banks from the
  // shoulders. Its outer terraces carry the very same crop and road meshes.
  const riverBlend = smooth(clamp((riverDistance - .13) / .22));
  const original = (shoulder * 1.18 * riverBlend - valley) * mineralBlend +
      centralCultivatedRelief(sx, sz) * 1.28 * riverBlend +
      (noise(sx * .82 + 41, sz * .93 + 17) - .45) * .035 * riverBlend * mineralBlend,
    section = cultivatedValleyProfile(x, z),
    influence = section.influence * smooth(clamp((borderDistance(sx, sz) - .27) / .15));
  const existing = mix(original, section.height * mineralBlend, influence),
    composed = parisAreaAt(x, z) ? { height: 0, influence: 0 } : composedCoteauProfile(sx, sz);
  return mix(existing, composed.height * mineralBlend, composed.influence) * protectedBlend * coastalBlend;
}

type CoastalRockSample = { height: number; cover: number };
// Authored sea-facing tracts, in geographic degrees. Inland borders and the
// high northern cape stay outside these six supports and the camera is fixed.
const rockyCoastTracts = [
  { id: "bretagne", lon: [-5.05, -2.30], lat: [47.55, 48.88], height: .19, width: .29 },
  { id: "normandie", lon: [-1.88, .88], lat: [49.12, 49.78], height: .17, width: .25 },
  { id: "vendee", lon: [-2.20, -1.00], lat: [45.90, 47.40], height: .14, width: .23 },
  { id: "landes", lon: [-1.85, -.70], lat: [43.42, 45.76], height: .16, width: .26 },
  { id: "mediterranee", lon: [2.65, 7.30], lat: [43.00, 43.78], height: .21, width: .28 },
  { id: "corse-est", lon: [9.08, 9.60], lat: [41.50, 42.62], height: .15, width: .20 },
];
// Only XZ geometry is needed here. Passing the constant sampler deliberately
// avoids landHeight, which has not finished initialising its survey yet.
const coastalPortPlans = [
  { name: "brest", lon: -4.49, lat: 48.39 },
  ...["nantes", "marseille", "ajaccio"].map(name => {
    const { lon, lat } = MAP_PLACES[name as "nantes" | "marseille" | "ajaccio"];
    return { name, lon, lat };
  }),
].map(place => surveyHarbour(place.name, mapPosition(place.lon, place.lat), () => .14))
  .filter((plan): plan is NonNullable<typeof plan> => !!plan);
const coastalPortPolygons = coastalPortPlans.flatMap(plan => [
  ...plan.quayPolygons, ...plan.coastalJoins, ...plan.landReservations,
]);
const coastalPortCells = new Map<string, typeof coastalPortPolygons>();
for (const polygon of coastalPortPolygons) {
  for (let x = Math.floor((Math.min(...polygon.map(p => p.x)) - .24) / .5);
    x <= Math.floor((Math.max(...polygon.map(p => p.x)) + .24) / .5); x++)
    for (let z = Math.floor((Math.min(...polygon.map(p => p.z)) - .24) / .5);
      z <= Math.floor((Math.max(...polygon.map(p => p.z)) + .24) / .5); z++) {
      const key = `${x}:${z}`, cell = coastalPortCells.get(key) ?? [];
      cell.push(polygon); coastalPortCells.set(key, cell);
    }
}
// These are the five existing national road paths that can reach the coast.
// Their interpolation is the same baseline-then-final transport used by roads.
const coastalRoadControls = [
  [[1.1, 49.44], [.53, 49.14], [-.13, 48.85], [-.8, 48.41], [-1.68, 48.11]],
  [[-1.68, 48.11], [-1.77, 47.78], [-1.74, 47.52], [-1.55, 47.22]],
  [[-1.55, 47.22], [-1.06, 46.72], [-.67, 46.24], [-.57, 45.61], [-.58, 44.84]],
  [[1.44, 43.60], [1.94, 43.42], [2.44, 43.27], [3.02, 43.28], [3.48, 43.49], [3.88, 43.61]],
  [[3.88, 43.61], [4.19, 43.73], [4.65, 43.72], [5.09, 43.61], [5.37, 43.30]],
];
const coastTransportPath = (points: Point[], steps: number) => {
  const path: Point[] = [];
  for (let segment = 0; segment < points.length - 1; segment++) {
    const a = points[Math.max(0, segment - 1)], b = points[segment],
      c = points[segment + 1], d = points[Math.min(points.length - 1, segment + 2)];
    for (let step = 0; step < steps; step++) {
      const t = step / steps, t2 = t * t, t3 = t2 * t,
        value = (p0: number, p1: number, p2: number, p3: number) =>
          .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
      path.push(mapFinalFromBaseline(value(a.x, b.x, c.x, d.x), value(a.z, b.z, c.z, d.z)));
    }
  }
  const last = points.at(-1)!; path.push(mapFinalFromBaseline(last.x, last.z));
  return path;
};
const coastalRoadPaths = coastalRoadControls.map(points =>
  coastTransportPath(points.map(([lon, lat]) => mapBaselinePosition(lon, lat)), 12));
const coastalRailStops = [
  { town: "nantes", x: .66, z: -.39 }, { town: "bordeaux", x: .64, z: .46 },
].map(stop => {
  const town = MAP_PLACES[stop.town as "nantes" | "bordeaux"], origin = mapPosition(town.lon, town.lat);
  return mapBaselineFromFinal(origin.x + stop.x, origin.z + stop.z);
});
const coastalRailPath = coastTransportPath([coastalRailStops[0],
  mapBaselinePosition(-.75, 46.5), mapBaselinePosition(-.28, 45.71), coastalRailStops[1]], 20);
const coastalTransportSegments = [...coastalRoadPaths, coastalRailPath].flatMap(path =>
  path.slice(1).map((b, i) => ({ a: path[i], b })));
const coastalTransportCells = new Map<string, typeof coastalTransportSegments>();
for (const segment of coastalTransportSegments) {
  for (let x = Math.floor((Math.min(segment.a.x, segment.b.x) - .25) / .5);
    x <= Math.floor((Math.max(segment.a.x, segment.b.x) + .25) / .5); x++)
    for (let z = Math.floor((Math.min(segment.a.z, segment.b.z) - .25) / .5);
      z <= Math.floor((Math.max(segment.a.z, segment.b.z) + .25) / .5); z++) {
      const key = `${x}:${z}`, cell = coastalTransportCells.get(key) ?? [];
      cell.push(segment); coastalTransportCells.set(key, cell);
    }
}
function coastalRockProfile(x: number, z: number, sx: number, sz: number): CoastalRockSample {
  const empty = { height: 0, cover: 0 }, distance = borderDistance(sx, sz);
  if (distance > .29 || constructionReservationContains(x, z, .16) || riverContains(x, z, .17)) return empty;
  const { lon, lat } = mapSourceCoordinates(sx, sz);
  let strength = 0, height = 0, width = 0;
  for (const tract of rockyCoastTracts) {
    const along = smooth(clamp((lon - tract.lon[0]) / .23)) * smooth(clamp((tract.lon[1] - lon) / .23)),
      across = smooth(clamp((lat - tract.lat[0]) / .13)) * smooth(clamp((tract.lat[1] - lat) / .13)),
      support = along * across;
    if (support <= strength) continue;
    strength = support; height = tract.height; width = tract.width;
  }
  if (strength === 0 || distance > width) return empty;
  let clearance = urbanClearance(x, z);
  for (const footprint of lowlandProtectionCells.get(`${Math.floor(x / .5)}:${Math.floor(z / .5)}`) ?? []) {
    const dx = x - footprint.x, dz = z - footprint.z,
      px = Math.abs(dx * footprint.cosine + dz * footprint.sine) - footprint.halfW,
      pz = Math.abs(-dx * footprint.sine + dz * footprint.cosine) - footprint.halfD;
    clearance = Math.min(clearance, Math.hypot(Math.max(0, px), Math.max(0, pz)) + Math.min(0, Math.max(px, pz)));
  }
  for (const polygon of coastalPortCells.get(`${Math.floor(x / .5)}:${Math.floor(z / .5)}`) ?? []) {
    if (harbourPolygonContains(polygon, { x, z })) return empty;
    for (let i = 0; i < polygon.length; i++) clearance = Math.min(clearance,
      segmentDistance(x, z, polygon[i], polygon[(i + 1) % polygon.length]));
  }
  for (const segment of coastalTransportCells.get(`${Math.floor(x / .5)}:${Math.floor(z / .5)}`) ?? [])
    clearance = Math.min(clearance, segmentDistance(x, z, segment.a, segment.b) - .026);
  if (clearance <= .085) return empty;
  const protection = smooth(clamp((clearance - .085) / .14)),
    shelfEnd = width * .40,
    shelf = distance < shelfEnd ? 1 - distance / shelfEnd * .12 :
      .88 * (1 - smooth(clamp((distance - shelfEnd) / (width - shelfEnd)))),
    bed = .86 + noise(sx * 2.7 + 61, sz * 3.1 + 43) * .14,
    weight = strength * protection;
  return { height: height * shelf * bed * weight,
    cover: (1 - smooth(clamp((distance - .055) / .11))) * weight };
}

function unflattenedHeight(x: number, z: number) {
  const source = mapAuthoredCoordinates(x, z), sx = source.x, sz = source.z,
    massif = mountainSourceHeight(sx, sz),
    rolling = noise(sx * 1.18 + 27, sz * 1.34 + 6) * .024 +
      noise(sx * 4.7 + 11, sz * 4.1 + 19) * .006,
    armorican = hill(sx, sz, -3.1, 1.55, 1.4, .65) * .026,
    edge = smooth(clamp(borderDistance(sx, sz) / .30));
  // Houses, streets and works flatten this same surface in surveyedHeight.
  // The water is carved from it too. No former massif is mixed back into it.
  return .115 + rolling + armorican + massif * edge +
    cultivatedRelief(x, z, sx, sz, massif) + coastalRockProfile(x, z, sx, sz).height;
}

const settlementLevels = new Map<string, number>([
  ...Object.entries(MAP_PLACES).map(([name, { lon, lat }]) => {
    const point = mapPosition(lon, lat);
    return [name, unflattenedHeight(point.x, point.z)] as [string, number];
  }),
  ...RURAL_SETTLEMENTS.map(({ name, lon, lat }) => {
    const point = mapPosition(lon, lat);
    return [name, unflattenedHeight(point.x, point.z)] as [string, number];
  }),
  ...NATIONAL_SETTLEMENTS.map(({ name, lon, lat }) => {
    const point = mapPosition(lon, lat);
    return [name, unflattenedHeight(point.x, point.z)] as [string, number];
  }),
]);
const localFootprintLevels = new Map(
  surveyedFootprints.filter(footprint => footprint.localLevel).map(footprint =>
    [footprint, unflattenedHeight(footprint.x, footprint.z)] as const,
  ),
);
const surveyCells = new Map<string, typeof surveyedFootprints>();
for (const footprint of surveyedFootprints) {
  const reach = Math.hypot(footprint.halfW, footprint.halfD) + 0.22;
  for (
    let x = Math.floor((footprint.x - reach) / 0.5);
    x <= Math.floor((footprint.x + reach) / 0.5);
    x++
  ) {
    for (
      let z = Math.floor((footprint.z - reach) / 0.5);
      z <= Math.floor((footprint.z + reach) / 0.5);
      z++
    ) {
      const key = `${x}:${z}`,
        cell = surveyCells.get(key) ?? [];
      cell.push(footprint);
      surveyCells.set(key, cell);
    }
  }
}

function surveyedHeightBase(x: number, z: number) {
  let height = unflattenedHeight(x, z),
    strongest = 0,
    schoolPlatform = false,
    level = height;
  for (const footprint of surveyCells.get(
    `${Math.floor(x / 0.5)}:${Math.floor(z / 0.5)}`,
  ) ?? []) {
    const dx = x - footprint.x,
      dz = z - footprint.z;
    const px =
      Math.abs(dx * footprint.cosine + dz * footprint.sine) - footprint.halfW;
    const pz =
      Math.abs(-dx * footprint.sine + dz * footprint.cosine) - footprint.halfD;
    const distance =
      Math.hypot(Math.max(0, px), Math.max(0, pz)) +
      Math.min(0, Math.max(px, pz));
    const blend = 1 - smooth(clamp((distance + 0.012) / 0.18));
    if (blend > strongest) {
      strongest = blend;
      schoolPlatform = footprint.schoolPlatform;
      level = localFootprintLevels.get(footprint) ?? settlementLevels.get(footprint.settlement) ?? height;
    }
  }
  // Streets soften the local grade; a village cannot erase a whole watershed
  // or drag its mountain slope into a tall flat terrace at the border.
  height = mix(height, schoolPlatform ? level : clamp(level, height - 0.065, height + 0.065), strongest);
  const segments =
    riverCells.get(`${Math.floor(x / 0.25)}:${Math.floor(z / 0.25)}`) ?? [];
  let influence = 0,
    mouth = 0;
  for (const segment of segments) {
    const distance = segmentDistance(x, z, segment.a, segment.b);
    const physicalWidth = riverSegmentWidth(segment, x, z);
    const carve = 1 - smooth(clamp(
      (distance - physicalWidth * .40) / (physicalWidth * .10 + .025),
    ));
    if (carve > influence) {
      influence = carve;
      mouth = segment.mouth;
    }
  }
  height -= influence * 0.043;
  if (mouth > 0.968)
    height = mix(
      height,
      -0.09,
      smooth(clamp((mouth - 0.968) / 0.032)) * influence,
    );
  return height;
}

// Two river-quarter foundations use only their own authored rectangle.
// Their placement and all channel, road and project reservations stay fixed.
const toulouseTerraces = NATIONAL_SETTLEMENTS.filter(town => town.name === "toulouse").flatMap(town => {
  const origin = mapPosition(town.lon, town.lat);
  return town.blocks.flatMap(block => block.buildings.filter(house =>
    house.id === "toulouse-ilot-1-maison-1" || house.id === "toulouse-ilot-1-maison-2").map(house => {
      const cosine = Math.cos(house.angle), sine = Math.sin(house.angle),
        x = origin.x + house.x + sine * house.footprintOffset,
        z = origin.z + house.z + cosine * house.footprintOffset;
      return { id: house.id, x, z, cosine, sine, halfW: house.width / 2,
        halfD: house.depth / 2, level: surveyedHeightBase(x, z) };
    }));
});
function surveyedHeight(x: number, z: number) {
  const height = surveyedHeightBase(x, z);
  let strongest = 0, level = height;
  for (const terrace of toulouseTerraces) {
    const dx = x - terrace.x, dz = z - terrace.z,
      u = Math.abs(dx * terrace.cosine - dz * terrace.sine) - terrace.halfW,
      v = Math.abs(dx * terrace.sine + dz * terrace.cosine) - terrace.halfD,
      distance = Math.hypot(Math.max(0, u), Math.max(0, v)) + Math.min(0, Math.max(u, v)),
      blend = 1 - smooth(clamp((distance - .012) / .024));
    if (blend > strongest && !riverContains(x, z, .009)) {
      strongest = blend; level = terrace.level;
    }
  }
  return mix(height, level, strongest);
}

// Roads, buildings and actors sample precisely the same bilinear survey as the
// mesh. Caching the survey also avoids rebuilding dozens of watersheds per tree.
const heightGrid = new Map<number, Map<number, number>>();
const surveySpacing = 0.018;
function sampledHeight(ix: number, iz: number) {
  let column = heightGrid.get(ix);
  if (!column) { column = new Map(); heightGrid.set(ix, column); }
  let value = column.get(iz);
  if (value === undefined) {
    value = surveyedHeight(ix * surveySpacing, iz * surveySpacing);
    column.set(iz, value);
  }
  return value;
}
export function landHeight(x: number, z: number): number {
  const gx = x / surveySpacing,
    gz = z / surveySpacing,
    ix = Math.floor(gx),
    iz = Math.floor(gz);
  const tx = gx - ix,
    tz = gz - iz;
  return mix(
    mix(sampledHeight(ix, iz), sampledHeight(ix + 1, iz), tx),
    mix(sampledHeight(ix, iz + 1), sampledHeight(ix + 1, iz + 1), tx),
    tz,
  );
}

function urbanClearance(x: number, z: number) {
  return urbanFootprint(x, z);
}

function geometry(): Geometry {
  return { positions: [], indices: [], colors: [], uvs: [] };
}

function vertex(
  data: Geometry,
  x: number,
  y: number,
  z: number,
  color: Color3,
) {
  const index = data.positions.length / 3;
  data.positions.push(x, y, z);
  data.colors.push(color.r, color.g, color.b, 1);
  const source = mapAuthoredCoordinates(x, z);
  data.uvs.push(
    (source.x - sourceBounds.minX) / (sourceBounds.maxX - sourceBounds.minX),
    (source.z - sourceBounds.minZ) / (sourceBounds.maxZ - sourceBounds.minZ),
  );
  return index;
}

function triangle(data: Geometry, a: number, b: number, c: number) {
  data.indices.push(a, b, c);
}

function colorMix(a: Color3, b: Color3, amount: number) {
  return Color3.Lerp(a, b, clamp(amount));
}

// This temporary index owns numeric triangles only. It is discarded after the
// authored instances touch the same ground surfaces that the renderer draws.
function seatTreesOnRenderedGround(trees: AbstractMesh[], ground: Mesh[]) {
  const cells = new Map<string, number[][]>(), step = .12;
  for (const mesh of ground) {
    if (!mesh.name.startsWith("landscape-terrain-")) continue;
    const positions = mesh.getVerticesData("position"), indices = mesh.getIndices();
    if (!positions || !indices) continue;
    for (let i = 0; i < indices.length; i += 3) {
      const triangle = [indices[i], indices[i + 1], indices[i + 2]].flatMap(index =>
        [positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]]);
      for (let x = Math.floor(Math.min(triangle[0], triangle[3], triangle[6]) / step);
        x <= Math.floor(Math.max(triangle[0], triangle[3], triangle[6]) / step); x++)
        for (let z = Math.floor(Math.min(triangle[2], triangle[5], triangle[8]) / step);
          z <= Math.floor(Math.max(triangle[2], triangle[5], triangle[8]) / step); z++) {
          const key = `${x}:${z}`, cell = cells.get(key) ?? [];
          cell.push(triangle); cells.set(key, cell);
        }
    }
  }
  const heightAt = (x: number, z: number) => {
    let height = -Infinity;
    for (const p of cells.get(`${Math.floor(x / step)}:${Math.floor(z / step)}`) ?? []) {
      const denominator = (p[5] - p[8]) * (p[0] - p[6]) + (p[6] - p[3]) * (p[2] - p[8]);
      if (Math.abs(denominator) < 1e-12) continue;
      const a = ((p[5] - p[8]) * (x - p[6]) + (p[6] - p[3]) * (z - p[8])) / denominator,
        b = ((p[8] - p[2]) * (x - p[6]) + (p[0] - p[6]) * (z - p[8])) / denominator,
        c = 1 - a - b;
      if (Math.min(a, b, c) >= -1e-7) height = Math.max(height, a * p[1] + b * p[4] + c * p[7]);
    }
    return height;
  };
  const roots = new Set<TransformNode>();
  for (const mesh of trees) {
    let node = mesh.parent;
    while (node?.parent && node.parent.name !== "landscape-authored-vegetation") node = node.parent;
    if (node instanceof TransformNode && node.parent?.name === "landscape-authored-vegetation" &&
      node.metadata?.asset !== "rock") roots.add(node);
  }
  for (const root of roots) {
    const contacts = root.getChildMeshes().map(geometryContactFrame),
      baseY = Math.min(...contacts.map(contact => contact.minimumY)),
      foot = contacts.flatMap(contact => contact.below(baseY + .0001));
    let lowest = heightAt(root.position.x, root.position.z);
    if (!Number.isFinite(lowest)) lowest = Infinity;
    for (const point of foot) {
      const height = heightAt(point.x, point.z);
      if (Number.isFinite(height)) lowest = Math.min(lowest, height);
    }
    if (Number.isFinite(lowest)) root.position.y += lowest - baseY + .001;
  }
  cells.clear();
}

type AlpineColorTarget = { mesh: Mesh; surveys?: Map<number, NonNullable<ReturnType<typeof mountainFaceSurvey>>> };
type AlpineOccupiedCover = { contains: (x: number, z: number) => boolean;
  overlaps: (polygon: Point[]) => boolean; treeCount: number; cropTriangles: number };

function alpineGeologicalBand(band: number) {
  return (band >= 100000 && band < 120000) ||
    (band >= 200000 && band < 1480000) ||
    (band >= 2000000 && band < 7120000);
}
function alpineStoneFamily(band: number) {
  return band >= 2000000 && band < 7120000 ? 100000 + Math.floor((band - 2000000) / 256) :
    band >= 200000 && band < 1480000 ? 100000 + Math.floor((band - 200000) / 128) : band;
}

// Actual tree geometry and actually drawn crop triangles define occupied soil.
// The resulting spatial index contains numbers, never scene or mesh references.
function alpineOccupiedCover(trees: AbstractMesh[], fields: Mesh[]): AlpineOccupiedCover {
  const cells = new Map<string, Point[][]>(), step = .12;
  const register = (polygon: Point[]) => {
    if (polygon.length < 3) return;
    const xs = polygon.map(p => p.x), zs = polygon.map(p => p.z);
    for (let x = Math.floor(Math.min(...xs) / step); x <= Math.floor(Math.max(...xs) / step); x++)
      for (let z = Math.floor(Math.min(...zs) / step); z <= Math.floor(Math.max(...zs) / step); z++) {
        const key = `${x}:${z}`, cell = cells.get(key) ?? [];
        cell.push(polygon); cells.set(key, cell);
      }
  };
  const hull = (points: Point[]) => {
    points.sort((a, b) => a.x - b.x || a.z - b.z);
    const turn = (a: Point, b: Point, c: Point) =>
      (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
    const half = (list: Point[]) => {
      const result: Point[] = [];
      for (const point of list) {
        while (result.length > 1 && turn(result[result.length - 2], result[result.length - 1], point) <= 0) result.pop();
        result.push(point);
      }
      return result;
    };
    const lower = half(points), upper = half([...points].reverse());
    lower.pop(); upper.pop(); return [...lower, ...upper];
  };
  const roots = new Set<TransformNode>();
  for (const mesh of trees) {
    let node = mesh.parent;
    while (node?.parent && node.parent.name !== "landscape-authored-vegetation") node = node.parent;
    if (node instanceof TransformNode && node.parent?.name === "landscape-authored-vegetation" &&
      node.metadata?.woodland && alpineGeologicalBand(mountainFaceSurvey(node.position.x, node.position.z)?.band ?? 0)) roots.add(node);
  }
  for (const root of roots) {
    const points: Point[] = [];
    for (const mesh of root.getChildMeshes()) {
      for (const point of geometryProjectionVertices(mesh))
        points.push({ x: point.x, z: point.z });
    }
    register(hull(points));
  }
  let cropTriangles = 0;
  for (const mesh of fields) {
    if (mesh.name !== "landscape-agriculture") continue;
    const positions = mesh.getVerticesData("position"), indices = mesh.getIndices();
    if (!positions || !indices) continue;
    for (let i = 0; i < indices.length; i += 3) {
      const polygon = [indices[i], indices[i + 1], indices[i + 2]].map(index =>
        ({ x: positions[index * 3], z: positions[index * 3 + 2] })),
        x = polygon.reduce((sum, p) => sum + p.x, 0) / 3,
        z = polygon.reduce((sum, p) => sum + p.z, 0) / 3;
      if (!alpineGeologicalBand(mountainFaceSurvey(x, z)?.band ?? 0)) continue;
      register(polygon); cropTriangles++;
    }
  }
  return { treeCount: roots.size, cropTriangles,
    contains: (x, z) => cells.get(`${Math.floor(x / step)}:${Math.floor(z / step)}`)?.some(polygon => contains(polygon, x, z)) ?? false,
    overlaps: polygon => {
      const xs = polygon.map(p => p.x), zs = polygon.map(p => p.z), candidates = new Set<Point[]>();
      for (let x = Math.floor(Math.min(...xs) / step); x <= Math.floor(Math.max(...xs) / step); x++)
        for (let z = Math.floor(Math.min(...zs) / step); z <= Math.floor(Math.max(...zs) / step); z++)
          for (const occupied of cells.get(`${x}:${z}`) ?? []) candidates.add(occupied);
      return [...candidates].some(occupied => harbourPolygonsOverlap(occupied, polygon));
    } };
}

function recolorAlpineGround(scene: Scene, meshes: Mesh[], targets: AlpineColorTarget[], cover: AlpineOccupiedCover) {
  let snowSurface: StandardMaterial | undefined;
  for (const { mesh, surveys } of targets) {
    const positions = mesh.getVerticesData("position"), indices = mesh.getIndices(), colors = mesh.getVerticesData("color");
    if (!positions || !indices || !colors) continue;
    const protectedVertices = new Set<number>();
    // Protect full triangles wherever a real canopy or a real crop is present.
    // Their interpolated soil color stays intact, including at the actual feet.
    for (let i = 0; i < indices.length; i += 3) {
      const vertices = [indices[i], indices[i + 1], indices[i + 2]],
        polygon = vertices.map(index => ({ x: positions[index * 3], z: positions[index * 3 + 2] })),
        x = polygon.reduce((sum, p) => sum + p.x, 0) / 3,
        z = polygon.reduce((sum, p) => sum + p.z, 0) / 3;
      if (alpineGeologicalBand(mountainFaceSurvey(x, z)?.band ?? 0) && cover.overlaps(polygon))
        for (const vertex of vertices) protectedVertices.add(vertex);
    }
    let changed = false;
    for (let i = 0; i < positions.length / 3; i++) {
      if (protectedVertices.has(i)) continue;
      const x = positions[i * 3], z = positions[i * 3 + 2], face = surveys?.get(i);
      if (!alpineGeologicalBand((face ?? mountainFaceSurvey(x, z))?.band ?? 0)) continue;
      const color = terrainColor(x, z, face, cover);
      if (color.r === colors[i * 4] && color.g === colors[i * 4 + 1] && color.b === colors[i * 4 + 2]) continue;
      colors[i * 4] = color.r; colors[i * 4 + 1] = color.g; colors[i * 4 + 2] = color.b; changed = true;
    }
    if (changed) mesh.setVerticesData("color", colors, false, 4);
    if (!mesh.name.startsWith("landscape-terrain-mineral-")) continue;
    const bare: number[] = [], snowy: number[] = [];
    for (let i = 0; i < indices.length; i += 3) {
      const corners = [indices[i], indices[i + 1], indices[i + 2]],
        x = corners.reduce((sum, index) => sum + positions[index * 3], 0) / 3,
        z = corners.reduce((sum, index) => sum + positions[index * 3 + 2], 0) / 3,
        y = corners.reduce((sum, index) => sum + positions[index * 3 + 1], 0) / 3,
        source = mapAuthoredCoordinates(x, z),
        survey = mountainFaceSurvey(x, z),
        slope = Math.hypot(landHeight(x + .025, z) - landHeight(x - .025, z),
          landHeight(x, z + .025) - landHeight(x, z - .025)) / .05,
        mask = alpineSurfaceMask(x, z, y, survey, cover),
        amount = alpineSnowCover(source.x, source.z, y, slope, survey?.band ?? 0) * mask;
      const destination = !corners.some(index => protectedVertices.has(index)) &&
        amount >= .49 ? snowy : bare;
      destination.push(...corners);
    }
    if (!snowy.length) continue;
    snowSurface ??= material(scene, "landscape-snow", "#FFFFFF");
    snowSurface.specularColor = new Color3(.065, .075, .085);
    snowSurface.specularPower = 20;
    // The separate material omits the rock joints and coarse rock bump.
    // Positions and normals come directly from the actual surveyed terrain.
    const snowMesh = new Mesh(mesh.name.replace("mineral-", "snow-"), scene),
      data = new VertexData(), normals = mesh.getVerticesData("normal"),
      uvs = mesh.getVerticesData("uv"), snowGeometry = geometry(),
      snowNormals: number[] = [], remap = new Map<number, number>();
    for (const old of snowy) {
      let index = remap.get(old);
      if (index === undefined) {
        index = remap.size; remap.set(old, index);
        snowGeometry.positions.push(positions[old * 3], positions[old * 3 + 1], positions[old * 3 + 2]);
        // A selected snow face is snow, rather than its former ochre rock tint.
        // Physical light, terrain normals and shadows provide its blue grey shade.
        const source = mapAuthoredCoordinates(positions[old * 3], positions[old * 3 + 2]),
          tone = Color3.FromHexString("#F4F6F8").scale(.97 + noise(source.x * 7.1 + 5, source.z * 6.3 + 11) * .03);
        snowGeometry.colors.push(tone.r, tone.g, tone.b, 1);
        if (normals) snowNormals.push(normals[old * 3], normals[old * 3 + 1], normals[old * 3 + 2]);
        if (uvs) snowGeometry.uvs.push(uvs[old * 2], uvs[old * 2 + 1]);
      }
      snowGeometry.indices.push(index);
    }
    data.positions = snowGeometry.positions; data.indices = snowGeometry.indices;
    data.colors = snowGeometry.colors;
    if (normals) data.normals = snowNormals;
    if (uvs) data.uvs = snowGeometry.uvs;
    data.applyToMesh(snowMesh);
    snowMesh.material = snowSurface; snowMesh.receiveShadows = true;
    snowMesh.isPickable = false;
    mesh.setIndices(bare); meshes.push(snowMesh);
  }
}

// Local geological cover follows the authored Alpine survey. It has no effect
// on the elevations, parcels, forests or the other mountain ranges.
const alpineCropAreas = [...NATIONAL_FIELDS, ...VALLEY_FIELDS].map(field => {
  const polygon = field.outline.map(([x, z]) => ({ x, z }));
  return { polygon, minX: Math.min(...polygon.map(p => p.x)),
    maxX: Math.max(...polygon.map(p => p.x)),
    minZ: Math.min(...polygon.map(p => p.z)),
    maxZ: Math.max(...polygon.map(p => p.z)) };
}).filter(area => area.maxX >= 1.90 && area.minX <= 3.94 &&
  area.maxZ >= -3.20 && area.minZ <= -.12);

function alpineSurfaceMask(x: number, z: number, y: number,
  face?: ReturnType<typeof mountainFaceSurvey>, occupied?: AlpineOccupiedCover) {
  if (y <= (occupied ? .18 : .225)) return 0;
  const survey = face ?? mountainFaceSurvey(x, z), band = survey?.band ?? 0;
  // The fractured Vanoise faces retain their original massif through this
  // family range. A rectangular snow mask used to leave the east yellow.
  if (!alpineGeologicalBand(band)) return 0;
  if ((occupied ? occupied.contains(x, z) : !!nationalWoodAt(x, z)) || riverContains(x, z, .075) ||
    constructionReservationContains(x, z, .035)) return 0;
  const urban = smooth(clamp((urbanClearance(x, z) - .08) / .12));
  if (urban === 0) return 0;
  const source = mapAuthoredCoordinates(x, z);
  if (!occupied && alpineCropAreas.some(area => source.x >= area.minX && source.x <= area.maxX &&
    source.z >= area.minZ && source.z <= area.maxZ &&
    contains(area.polygon, source.x, source.z)) && nationalCropAvailable(x, z, .009)) return 0;
  const basal = smooth(clamp((mountainSourceHeight(source.x, source.z) - (occupied ? .01 : .025)) / (occupied ? .035 : .065))),
    rim = smooth(clamp((borderDistance(source.x, source.z) - .012) / .035)),
    altitude = smooth(clamp((y - (occupied ? .18 : .225)) / (occupied ? .08 : .095)));
  return basal * rim * altitude * urban;
}

// Shared irregular pasture units, expressed in the authored terrain frame.
// Their boundaries are surface colours on the real mesh, not a scene image.
const meadowTones = ["#7D9743", "#92A14C", "#AEB65D", "#9CAD52", "#BAC173"];
const stubbleTones = ["#BCA552", "#CDB567", "#D2BA63", "#AFAA58"];
function countrysideColor(sx: number, sz: number) {
  const width = .76, depth = .53, cx = Math.floor(sx / width), cz = Math.floor(sz / depth);
  let first = Infinity, second = Infinity, chosenX = 0, chosenZ = 0,
    nextX = 0, nextZ = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const ix = cx + dx, iz = cz + dz,
      x = (ix + .5 + (hash(ix * 7 + 19, iz * 11) - .5) * .74) * width,
      z = (iz + .5 + (hash(ix * 13, iz * 3 + 41) - .5) * .70) * depth,
      distance = ((sx - x) / width) ** 2 + ((sz - z) / depth) ** 2;
    if (distance < first) { second = first; nextX = chosenX; nextZ = chosenZ;
      first = distance; chosenX = ix; chosenZ = iz; }
    else if (distance < second) { second = distance; nextX = ix; nextZ = iz; }
  }
  const tone = (ix: number, iz: number) => {
    const palette = hash(ix + 107, iz * 9 + 27) < .30 ? stubbleTones : meadowTones;
    return Color3.FromHexString(palette[Math.floor(hash(ix * 17 + 1, iz * 13 + 3) * palette.length) % palette.length]);
  };
  // A narrow irregular edge avoids the same smooth gradient over all France.
  return colorMix(tone(chosenX, chosenZ), tone(nextX, nextZ),
    (1 - smooth(clamp((second - first) / .065))) * .30);
}

function terrainColor(x: number, z: number, face?: ReturnType<typeof mountainFaceSurvey>, occupied?: AlpineOccupiedCover) {
  const source = mapAuthoredCoordinates(x, z), sx = source.x, sz = source.z,
    y = landHeight(x, z), grain = noise(sx * 3.9 + 8, sz * 4.1 + 44),
    forest = forestAmount(x, z), area = parisAreaAt(x, z);
  if (area && !["garden", "field", "wood"].includes(area.kind)) {
    const palette = { urban: "#BCAF8B", court: "#D0BE99", square: "#D5C6A8",
      garden: "#91A05A", field: "#C9B66F", wood: "#4A613E" };
    return Color3.FromHexString(palette[area.kind]).scale(.95 + grain * .07);
  }
  if (nationalBlockAt(x, z)) return Color3.FromHexString("#CABB96").scale(.96 + grain * .06);
  let color = countrysideColor(sx, sz).scale(.97 + grain * .06);
  if (area?.kind === "field") color = colorMix(color, Color3.FromHexString("#CDB465"), .76);
  if (area?.kind === "garden") color = colorMix(color, Color3.FromHexString("#8FA44D"), .66);
  const forestCover = area?.kind === "wood" ? .90 : clamp((forest - .57) / .31) * .84;
  color = colorMix(color, Color3.FromHexString("#61733C"), forestCover);
  const left = landHeight(x - .025, z), right = landHeight(x + .025, z),
    front = landHeight(x, z - .025), back = landHeight(x, z + .025),
    slope = Math.hypot(right - left, back - front) / .05,
    massif = mountainSourceHeight(sx, sz),
    mask = alpineSurfaceMask(x, z, y, face, occupied),
    band = alpineStoneFamily(face?.band ?? mountainFaceBand(x, z)),
    family = hash(band, 37), warm = hash(band, 113),
    rock = colorMix(Color3.FromHexString("#747C7C"),
      Color3.FromHexString("#A9A493"), .18 + family * .63),
    stone = colorMix(rock, Color3.FromHexString("#A88C72"),
      smooth(clamp((warm - .29) / .56)) * .49),
    geology = smooth(clamp((massif - .13) / .31)),
    exposed = Math.max(mask * (.78 + .15 * smooth(clamp((slope - .45) / .85))),
      geology * smooth(clamp((slope - .38) / 1.05)) * (1 - forestCover * .75));
  color = colorMix(color, stone, exposed);
  const valleyShade = clamp((left + right + front + back - y * 4) * 2.1);
  color = color.scale(1 - valleyShade * .17);
  const covered = occupied ? occupied.contains(x, z) : !!nationalWoodAt(x, z),
    snow = covered || !alpineGeologicalBand(face?.band ?? mountainFaceBand(x, z)) ? 0 :
      alpineSnowCover(sx, sz, y, slope, face?.band ?? mountainFaceBand(x, z)) * mask;
  const coastal = coastalRockProfile(x, z, sx, sz);
  if (coastal.cover > 0 && !covered) {
    const shelfStone = colorMix(Color3.FromHexString("#B89B71"), Color3.FromHexString("#DACAA6"),
      noise(sx * 4.1 + 93, sz * 3.3 + 57));
    color = colorMix(color, shelfStone, coastal.cover * .78);
  }
  return colorMix(color, Color3.FromHexString("#F1F3F0"), snow);
}

// Broad irregular neves collect on the actual sculpted shelves and in
// couloirs. Rocky ridges remain visible between them, including at high altitude.
function alpineSnowCover(sx: number, sz: number, y: number, slope: number, band = 0) {
  const upperAlps = (band >= 100000 && band < 110000) ||
      (band >= 200000 && band < 1480000) || (band >= 2000000 && band < 4560000),
    snowlineNoise = noise(sx * 2.7 + 17, sz * 3.9 + 5),
    warp = (snowlineNoise - .5) * .58,
    drift = noise(sx * 7.2 + 31, sz * 6.6 + 19),
    channel = noise(sx * 11.8 + sz * 3.6 + warp + 8, sz * 2.7 - sx * 1.9 + 23),
    branch = noise(sx * 5.2 - sz * 8.1 + 41, sz * 2.0 + sx * .8 - warp + 29),
    altitude = smooth(clamp((y - .34 - snowlineNoise * .04) / .22)),
    shelf = 1 - smooth(clamp((slope - .32) / 1.30)),
    pocket = smooth(clamp((drift - (upperAlps ? .45 : .59)) / (upperAlps ? .22 : .16))),
    mainGully = smooth(clamp((channel - (upperAlps ? .33 : .53)) / (upperAlps ? .22 : .18))),
    sideGully = smooth(clamp((branch - (upperAlps ? .36 : .60)) / (upperAlps ? .22 : .17))) * (upperAlps ? .92 : .84),
    gullySlope = smooth(clamp((slope - .12) / .34)) *
      (1 - smooth(clamp((slope - (upperAlps ? 2.60 : 1.25)) / (upperAlps ? 1.80 : 1.30)))),
    // Broad Alpine neves whiten upper fronts; the other ranges keep their existing cover.
    rockRib = smooth(clamp((noise(sx * 5.7 - sz * 1.4 + 53,
      sz * 7.3 + sx * 2.1 + 61) - .64) / .18)),
    accumulation = Math.max(shelf * pocket, Math.max(mainGully, sideGully) * gullySlope);
  return altitude * accumulation * (1 - rockRib * .78);
}

function material(scene: Scene, name: string, hex: string) {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = Color3.FromHexString(hex);
  result.specularColor = new Color3(0.025, 0.029, 0.021);
  result.ambientColor = new Color3(0.16, 0.19, 0.13);
  return result;
}

function finish(
  scene: Scene,
  name: string,
  data: Geometry,
  surface: StandardMaterial,
  castsShadow = true,
) {
  const mesh = new Mesh(name, scene);
  const vertices = new VertexData();
  vertices.positions = data.positions;
  vertices.indices = data.indices;
  vertices.colors = data.colors;
  vertices.uvs = data.uvs;
  vertices.normals = [];
  VertexData.ComputeNormals(data.positions, data.indices, vertices.normals);
  vertices.applyToMesh(mesh);
  mesh.material = surface;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  if (!castsShadow) mesh.metadata = { castsShadow: false };
  return mesh;
}

function densify(points: Point[], step: number, closed = true) {
  const result: Point[] = [];
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    const divisions = Math.max(
      1,
      Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step),
    );
    for (let j = 0; j < divisions; j++)
      result.push({
        x: mix(a.x, b.x, j / divisions),
        z: mix(a.z, b.z, j / divisions),
      });
  }
  if (!closed) result.push(points[points.length - 1]);
  return result;
}

// A Delaunay face may straddle a concave shore even when its centre is at sea.
// Intersect only those rejected faces with the existing country polygon. The
// accepted terrain, surveyed heights and rendered cliff contour stay intact.
type ShorePoint = [number, number];
function rejectedShoreClipper(outline: Point[]) {
  const coordinates = outline.flatMap(point => [point.x, point.z]),
    indices = earcut(coordinates), step = .24,
    cells = new Map<string, number[]>(),
    countryFaces: Array<{ corners: ShorePoint[]; direction: number }> = [];
  const cross = (a: ShorePoint, b: ShorePoint, p: ShorePoint) =>
    (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  for (let i = 0; i < indices.length; i += 3) {
    const corners: ShorePoint[] = Array.from({ length: 3 }, (_, j) => {
      const point = outline[indices[i + j]];
      return [point.x, point.z];
    }), face = countryFaces.length;
    countryFaces.push({ corners, direction: Math.sign(cross(corners[0], corners[1], corners[2])) });
    for (let x = Math.floor(Math.min(...corners.map(p => p[0])) / step);
      x <= Math.floor(Math.max(...corners.map(p => p[0])) / step); x++)
      for (let z = Math.floor(Math.min(...corners.map(p => p[1])) / step);
        z <= Math.floor(Math.max(...corners.map(p => p[1])) / step); z++) {
        const key = `${x}:${z}`, cell = cells.get(key) ?? [];
        cell.push(face); cells.set(key, cell);
      }
  }
  return (p: ShorePoint, q: ShorePoint, r: ShorePoint) => {
    const candidates = new Set<number>(), result: ShorePoint[][] = [], source = [p, q, r];
    for (let x = Math.floor(Math.min(p[0], q[0], r[0]) / step);
      x <= Math.floor(Math.max(p[0], q[0], r[0]) / step); x++)
      for (let z = Math.floor(Math.min(p[1], q[1], r[1]) / step);
        z <= Math.floor(Math.max(p[1], q[1], r[1]) / step); z++)
        for (const face of cells.get(`${x}:${z}`) ?? []) candidates.add(face);
    for (const face of candidates) {
      const { corners, direction } = countryFaces[face];
      let polygon = source;
      for (let edge = 0; edge < 3 && polygon.length >= 3; edge++) {
        const a = corners[edge], b = corners[(edge + 1) % 3], clipped: ShorePoint[] = [];
        for (let i = 0; i < polygon.length; i++) {
          const start = polygon[i], end = polygon[(i + 1) % polygon.length],
            ds = cross(a, b, start) * direction, de = cross(a, b, end) * direction;
          if (ds >= 0) clipped.push(start);
          if ((ds >= 0) !== (de >= 0)) {
            const t = ds / (ds - de);
            clipped.push([start[0] + (end[0] - start[0]) * t,
              start[1] + (end[1] - start[1]) * t]);
          }
        }
        polygon = clipped;
      }
      if (polygon.length >= 3) result.push(polygon);
    }
    return result;
  };
}

function buildGround(
  scene: Scene,
  meshes: Mesh[],
  textures: LandMaterialTextures,
  colorTargets: AlpineColorTarget[],
) {
  const surface = material(scene, "landscape-ground", "#FFFFFF");
  surface.diffuseTexture = textures.earth;
  surface.bumpTexture = textures.earthNormal;
  const mineralSurface = material(scene, "landscape-mineral-ground", "#FFFFFF");
  mineralSurface.diffuseTexture = textures.rock;
  mineralSurface.bumpTexture = textures.rockNormal;
  mineralSurface.specularColor = new Color3(.035, .040, .046);
  const cliffMaterial = material(scene, "landscape-cliffs", "#FFFFFF");
  cliffMaterial.backFaceCulling = false;
  cliffMaterial.diffuseTexture = textures.rock;
  // This map describes sparse vertical joints and small chipped surfaces at
  // the existing rim UV scale. The larger broken beds remain actual geometry.
  cliffMaterial.bumpTexture = textures.coastNormal;
  cliffMaterial.emissiveColor = new Color3(.038, .029, .018);
  cliffMaterial.specularColor = new Color3(.018, .015, .011);
  cliffMaterial.specularPower = 20;
  const stone = Color3.FromHexString("#E3D2AB");
  const brown = Color3.FromHexString("#C4A478");
  const rock = Color3.FromHexString("#B2B0A0");
  const pale = Color3.FromHexString("#F0E2C7");
  for (const [part, outline] of outlines.entries()) {
    const sourceOutline = sourceOutlines[part],
      coast = densify(sourceOutline, 0.035).map(point => mapAuthoredPosition(point.x, point.z));
    const points: Array<[number, number]> = coast.map(({ x, z }) => [x, z]);
    const minX = Math.min(...sourceOutline.map(({ x }) => x));
    const maxX = Math.max(...sourceOutline.map(({ x }) => x));
    const minZ = Math.min(...sourceOutline.map(({ z }) => z));
    const maxZ = Math.max(...sourceOutline.map(({ z }) => z));
    // Survey the mineral replat on this shared mesh, rather than adding rocks
    // over a flat coastline. The geographic coast itself remains unchanged.
    const sourceCoast = densify(sourceOutline, .070),
      winding = Math.sign(sourceOutline.reduce((sum, p, i) => {
        const q = sourceOutline[(i + 1) % sourceOutline.length]; return sum + p.x * q.z - q.x * p.z;
      }, 0)) || 1;
    for (let i = 0; i < sourceCoast.length; i++) {
      const p = sourceCoast[i], a = sourceCoast[(i + sourceCoast.length - 1) % sourceCoast.length],
        b = sourceCoast[(i + 1) % sourceCoast.length], length = Math.hypot(b.x - a.x, b.z - a.z) || 1,
        nx = (b.z - a.z) / length * -winding, nz = -(b.x - a.x) / length * -winding;
      for (const inward of [.065, .115, .185, .255]) {
        const sx = p.x + nx * inward, sz = p.z + nz * inward;
        if (!contains(sourceOutline, sx, sz)) continue;
        const point = mapAuthoredPosition(sx, sz);
        if (coastalRockProfile(point.x, point.z, sx, sz).height > .008) points.push([point.x, point.z]);
      }
    }
    const spacing = 0.055;
    for (let ix = Math.ceil(minX / spacing); ix * spacing < maxX; ix++) {
      for (let iz = Math.ceil(minZ / spacing); iz * spacing < maxZ; iz++) {
        const x = (ix + (hash(ix, iz) - 0.5) * 0.5) * spacing;
        const z = (iz + (hash(ix + 67, iz - 19) - 0.5) * 0.5) * spacing;
        if (contains(sourceOutline, x, z)) {
          const point = mapAuthoredPosition(x, z); points.push([point.x, point.z]);
        }
      }
    }
    // Fine samples on the watersheds preserve ledges and cols without spending
    // this density on the broad, nearly flat cereal basins.
    const detailSpacing = 0.026;
    for (
      let ix = Math.ceil(minX / detailSpacing);
      ix * detailSpacing < maxX;
      ix++
    ) {
      for (
        let iz = Math.ceil(minZ / detailSpacing);
        iz * detailSpacing < maxZ;
        iz++
      ) {
        const x = (ix + (hash(ix + 71, iz) - 0.5) * 0.35) * detailSpacing;
        const z = (iz + (hash(ix, iz + 43) - 0.5) * 0.35) * detailSpacing;
        if (contains(sourceOutline, x, z)) {
          if (mountainSourceHeight(x, z) > 0.13) {
            const point = mapAuthoredPosition(x, z); points.push([point.x, point.z]);
          }
        }
      }
    }
    for (const edge of mountainBreakLines()) {
      const count = Math.max(1, Math.ceil(Math.hypot(edge.b.x - edge.a.x, edge.b.z - edge.a.z) / 0.034));
      for (let i = 0; i <= count; i++) {
        const x = mix(edge.a.x, edge.b.x, i / count), z = mix(edge.a.z, edge.b.z, i / count);
        if (contains(outline, x, z)) points.push([x, z]);
      }
    }
    for (const line of cultivatedValleyBreakLines())
      for (const point of densify(line, .050, false)) {
        if (!contains(outline, point.x, point.z) || cultivatedClearance(point.x, point.z) < .21 ||
          riverContains(point.x, point.z, .055)) continue;
        const source = mapAuthoredCoordinates(point.x, point.z);
        if (borderDistance(source.x, source.z) <= .27 || mountainSourceHeight(source.x, source.z) > .40 ||
          cultivatedValleyProfile(point.x, point.z).influence < .02) continue;
        points.push([point.x, point.z]);
      }
    // The large Touraine/Berry faces get real shared crests and terrace seams.
    // No overlay contour or extra mesh substitutes for this terrain silhouette.
    for (const line of composedCoteauBreakLines())
      for (const point of densify(line, .045, false)) {
        if (!contains(outline, point.x, point.z) || cultivatedClearance(point.x, point.z) < .21 ||
          riverContains(point.x, point.z, .055) || constructionReservationContains(point.x, point.z, .035)) continue;
        const source = mapAuthoredCoordinates(point.x, point.z);
        if (borderDistance(source.x, source.z) <= .27 || mountainSourceHeight(source.x, source.z) > .40 ||
          composedCoteauProfile(source.x, source.z).influence < .02) continue;
        points.push([point.x, point.z]);
      }
    // River beds need their own vertices; a coarse triangle spanning both banks
    // otherwise rises over the water even when the mathematical height is cut.
    for (const river of riverPaths)
      for (let i = 0; i < river.path.length; i++) {
        const p = river.path[i],
          previous = river.path[Math.max(0, i - 1)],
          next = river.path[Math.min(river.path.length - 1, i + 1)];
        const length =
          Math.hypot(next.x - previous.x, next.z - previous.z) || 1;
        const nx = (next.z - previous.z) / length,
          nz = -(next.x - previous.x) / length;
        const width = riverSurveyWidth(river, i),
          bank = riverSections[river.index][i].bank;
        for (const distance of [-width / 2 - .030, -width / 2 - bank,
          -width / 2, -width * .40, 0, width * .40, width / 2,
          width / 2 + bank, width / 2 + .030]) {
          const x = p.x + nx * distance, z = p.z + nz * distance;
          if (contains(outline, x, z)) points.push([x, z]);
        }
      }

    const terrain = geometry(), mineralTerrain = geometry(), shoreTerrain = geometry(),
      clipRejected = rejectedShoreClipper(outline);
    for (const [x, z] of points)
      vertex(terrain, x, landHeight(x, z), z, terrainColor(x, z));
    const triangles = Delaunator.from(points).triangles;
    const rockVertices = new Map<string, number>(),
      mineralSurveys = new Map<number, NonNullable<ReturnType<typeof mountainFaceSurvey>>>(),
      rockAxes = new Map<number, "x" | "y" | "z">();
    for (let i = 0; i < triangles.length; i += 3) {
      const a = triangles[i],
        b = triangles[i + 1],
        c = triangles[i + 2];
      const p = points[a],
        q = points[b],
        r = points[c];
      if (!contains(outline, (p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3)) {
        const denominator = (q[1] - r[1]) * (p[0] - r[0]) +
          (r[0] - q[0]) * (p[1] - r[1]);
        if (Math.abs(denominator) < 1e-12) continue;
        for (const polygon of clipRejected(p, q, r)) {
          const corners = polygon.map(([x, z]) => {
            const u = ((q[1] - r[1]) * (x - r[0]) + (r[0] - q[0]) * (z - r[1])) / denominator,
              v = ((r[1] - p[1]) * (x - r[0]) + (p[0] - r[0]) * (z - r[1])) / denominator,
              y = u * terrain.positions[a * 3 + 1] + v * terrain.positions[b * 3 + 1] +
                (1 - u - v) * terrain.positions[c * 3 + 1];
            return vertex(shoreTerrain, x, y, z, new Color3(
              u * terrain.colors[a * 4] + v * terrain.colors[b * 4] + (1 - u - v) * terrain.colors[c * 4],
              u * terrain.colors[a * 4 + 1] + v * terrain.colors[b * 4 + 1] + (1 - u - v) * terrain.colors[c * 4 + 1],
              u * terrain.colors[a * 4 + 2] + v * terrain.colors[b * 4 + 2] + (1 - u - v) * terrain.colors[c * 4 + 2],
            ));
          });
          for (let corner = 1; corner + 1 < corners.length; corner++) {
            const p = polygon[0], q = polygon[corner], r = polygon[corner + 1],
              winding = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
            if (Math.abs(winding) < 1e-12) continue;
            triangle(shoreTerrain, corners[0], corners[winding > 0 ? corner : corner + 1],
              corners[winding > 0 ? corner + 1 : corner]);
          }
        }
        continue;
      }
      const winding =
        (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
      const face = [a, winding > 0 ? b : c, winding > 0 ? c : b];
      const centerX = (p[0] + q[0] + r[0]) / 3,
        centerZ = (p[1] + q[1] + r[1]) / 3;
      const centerY = landHeight(centerX, centerZ);
      const survey = centerY > .24 ? mountainFaceSurvey(centerX, centerZ) : undefined,
        faceBand = survey?.band ?? (centerY > .33 ? mountainFaceBand(centerX, centerZ) : 0),
        slope = centerY > .33 && !survey ? Math.hypot(
          landHeight(centerX + 0.025, centerZ) - landHeight(centerX - 0.025, centerZ),
          landHeight(centerX, centerZ + 0.025) - landHeight(centerX, centerZ - 0.025)) / 0.05 : 0;
      if ((faceBand >= 100000 && centerY > 0.24) ||
        (centerY > 0.33 && slope > 0.83 &&
          mountainSourceHeight(mapAuthoredCoordinates(centerX, centerZ).x,
            mapAuthoredCoordinates(centerX, centerZ).z) > .15)) {
        const band = faceBand, parent = mountainParentFaceSurvey(centerX, centerZ),
          uvBand = parent?.band ?? band;
        let axis = rockAxes.get(uvBand) ?? parent?.uvAxis;
        if (axis === undefined) {
          const normalY = survey ? 1 / Math.hypot(survey.slope, 1) : 1;
          let normalX = Math.abs(survey?.normalX ?? 0),
            normalZ = Math.abs(survey?.normalZ ?? 0);
          if (!survey) {
            const source = mapAuthoredCoordinates(centerX, centerZ),
              height = (x: number, z: number) => {
                const point = mapAuthoredPosition(x, z);
                return landHeight(point.x, point.z);
              };
            normalX = Math.abs(height(source.x + .025, source.z) -
              height(source.x - .025, source.z)) / .05;
            normalZ = Math.abs(height(source.x, source.z + .025) -
              height(source.x, source.z - .025)) / .05;
          }
          axis = normalX > Math.max(normalY, normalZ) ? "x" :
            normalZ > normalY ? "z" : "y";
          rockAxes.set(uvBand, axis);
        }
        const corners = face.map((index) => {
          const key = `${index}:${band}`,
            saved = rockVertices.get(key);
          if (saved !== undefined) return saved;
          const position = index * 3,
            tone = index * 4;
          const separate = vertex(
            mineralTerrain,
            terrain.positions[position],
            terrain.positions[position + 1],
            terrain.positions[position + 2],
            survey ? terrainColor(terrain.positions[position], terrain.positions[position + 2], mountainParentFaceSurvey(centerX, centerZ) ?? survey) :
              new Color3(terrain.colors[tone], terrain.colors[tone + 1], terrain.colors[tone + 2]),
          );
          // One mapping per surveyed geological face keeps its tiny render
          // triangles continuous. Vertical walls retain their height in UVs.
          const source = mapAuthoredCoordinates(terrain.positions[position],
            terrain.positions[position + 2]);
          mineralTerrain.uvs[separate * 2] = (axis === "x" ? source.z : source.x) * 2.9;
          mineralTerrain.uvs[separate * 2 + 1] = (axis === "y" ? source.z :
            terrain.positions[position + 1]) * 2.9;
          if (survey) mineralSurveys.set(separate, survey);
          rockVertices.set(key, separate);
          return separate;
        });
        triangle(mineralTerrain, corners[0], corners[1], corners[2]);
      } else triangle(terrain, face[0], face[1], face[2]);
    }
    const terrainMesh = finish(scene, `landscape-terrain-${part}`, terrain, surface);
    meshes.push(terrainMesh);
    if (part === 0) colorTargets.push({ mesh: terrainMesh });
    if (mineralTerrain.indices.length) {
      const mineralMesh = finish(scene, `landscape-terrain-mineral-${part}`, mineralTerrain, mineralSurface);
      meshes.push(mineralMesh);
      if (part === 0) colorTargets.push({ mesh: mineralMesh, surveys: mineralSurveys });
    }
    if (shoreTerrain.indices.length) {
      const shoreMesh = finish(scene, `landscape-terrain-coastal-${part}`, shoreTerrain, surface);
      meshes.push(shoreMesh);
      if (part === 0) colorTargets.push({ mesh: shoreMesh });
    }
    const cliffs = geometry(), cliffFaceGroups: string[] = [], cliffFaceBlocks: number[] = [],
      cliffColumnWeights: number[] = [];
    const cliffLayers = 6;
    // Warm, exposed beds are taken from the confirmed miniature's lit coastal
    // faces. These remain material colours, with the scene providing lighting.
    const coastalOchre = Color3.FromHexString("#E6AD7E"),
      coastalSandstone = Color3.FromHexString("#BE8A57"),
      coastalLimestone = Color3.FromHexString("#C3B9A2"),
      coastalIvory = Color3.FromHexString("#E4D1AB");
    // Contacts and survey heights stay fixed. Rock faces span different lengths
    // of coastline and break at its stronger corners instead of repeating ribs.
    const coastWinding = Math.sign(coast.reduce((area, point, index) => {
      const next = coast[(index + 1) % coast.length];
      return area + point.x * next.z - next.x * point.z;
    }, 0)) || 1;
    const coastArcs = [0];
    for (let i = 1; i <= coast.length; i++) {
      const p = coast[i % coast.length], previous = coast[i - 1];
      coastArcs.push(coastArcs[i - 1] + Math.hypot(p.x - previous.x, p.z - previous.z));
    }
    const coastBlocks: Array<{ start: number; end: number }> = [],
      segmentBlocks: number[] = [];
    for (let start = 0; start < coast.length;) {
      const block = coastBlocks.length,
        span = .095 + hash(block + part * 199, 503) * .20;
      let end = start + 1;
      while (end < coast.length &&
        (end - start < 2 || coastArcs[end] - coastArcs[start] < span)) {
        const a = coast[(end + coast.length - 1) % coast.length],
          b = coast[end], c = coast[(end + 1) % coast.length],
          ax = b.x - a.x, az = b.z - a.z, bx = c.x - b.x, bz = c.z - b.z,
          cosine = (ax * bx + az * bz) / (Math.hypot(ax, az) * Math.hypot(bx, bz) || 1);
        if (cosine < .80) break;
        end++;
      }
      coastBlocks.push({ start, end });
      for (let segment = start; segment < end; segment++) segmentBlocks[segment] = block;
      start = end;
    }
    // The existing columns are already <= .12 world unit apart. Separate
    // facade panels from the legacy blocks so protected geometry stays exact.
    const facadePanels: Array<{ start: number; end: number }> = [],
      segmentPanels: number[] = [];
    for (let start = 0; start < coast.length;) {
      const panel = facadePanels.length, span = .060 + hash(panel + part * 719, 1283) * .060;
      let end = start + 1;
      while (end < coast.length && coastArcs[end] - coastArcs[start] < span &&
        coastArcs[end + 1] - coastArcs[start] <= .120) {
        const a = coast[(end + coast.length - 1) % coast.length], b = coast[end],
          c = coast[(end + 1) % coast.length],
          ax = b.x - a.x, az = b.z - a.z, bx = c.x - b.x, bz = c.z - b.z;
        if ((ax * bx + az * bz) / (Math.hypot(ax, az) * Math.hypot(bx, bz) || 1) < .80) break;
        end++;
      }
      facadePanels.push({ start, end });
      for (let segment = start; segment < end; segment++) segmentPanels[segment] = panel;
      start = end;
    }
    const boundaryDepth = (block: number) =>
      .002 + hash((block % coastBlocks.length) + part * 97, 421) * .004;
    const boundaryJoint = (block: number) => {
      const seed = (block % coastBlocks.length) + part * 271;
      return hash(seed, 919) > .86 ? .002 + hash(seed, 937) * .004 : 0;
    };
    const exposedBedLevels = (block: number) => {
      const seed = (block % coastBlocks.length) + part * 397;
      return [0, .08 + hash(seed, 1201) * .065, .29 + hash(seed, 1213) * .06,
        .50 + hash(seed, 1223) * .07, .72 + hash(seed, 1231) * .07,
        .89 + hash(seed, 1237) * .035, 1];
    };
    const exposedBedJoint = (block: number) => {
      const seed = (block % coastBlocks.length) + part * 271;
      return hash(seed, 919) > .86 ? .010 + hash(seed, 937) * .016 : 0;
    };
    let coastArc = 0;
    for (let i = 0; i <= coast.length; i++) {
      const p = coast[i % coast.length];
      const previous = coast[(i + coast.length - 1) % coast.length];
      const next = coast[(i + 1) % coast.length];
      const length = Math.hypot(next.x - previous.x, next.z - previous.z) || 1;
      const nx = (next.z - previous.z) / length,
        nz = -(next.x - previous.x) / length;
      coastArc = coastArcs[i];
      const block = segmentBlocks[Math.min(i, coast.length - 1)],
        limits = coastBlocks[block],
        across = (coastArc - coastArcs[limits.start]) /
          (coastArcs[limits.end] - coastArcs[limits.start] || 1),
        faceCore = smooth(clamp(across / .22)) * smooth(clamp((1 - across) / .22)),
        family = hash(block + part * 211, 331),
        fracture = boundaryJoint(block) * (1 - smooth(clamp(across / .15))) +
          boundaryJoint(block + 1) * (1 - smooth(clamp((1 - across) / .15))),
        faceSetback = mix(boundaryDepth(block), boundaryDepth(block + 1), across),
        formation = hash(block + part * 109, 617),
        lean = (hash(block + part * 229, 631) - .5) * .006 *
          Math.sin(across * Math.PI * 2) * faceCore,
        profile = formation < .40 ? [0, .003, .003, .005, .020, .006, 0] :
          formation < .72 ? [0, .008, .028, .007, .038, .014, 0] :
          [0, .004, .010, .025, .013, .003, 0];
      const top = landHeight(p.x, p.z), source = mapAuthoredCoordinates(p.x, p.z),
        rimWeight = coastalRockProfile(p.x, p.z, source.x, source.z).cover,
        bedLeft = exposedBedLevels(block), bedRight = exposedBedLevels(block + 1),
        brokenJoint = exposedBedJoint(block) * (1 - smooth(clamp(across / .13))) +
          exposedBedJoint(block + 1) * (1 - smooth(clamp((1 - across) / .13))),
        brokenProfile = formation < .40 ? [0, .003, .010, .028, .029, .014, 0] :
          formation < .72 ? [0, .004, .026, .029, .010, .009, 0] :
            [0, .003, .006, .008, .032, .013, 0];
      // The existing coast's protected port, river, urban and works margins
      // also suppress this under-face sculpture. No new support is introduced.
      cliffColumnWeights.push(rimWeight);
      const shelf = hash(Math.floor(i / 9) + 241, 63),
        notch = hash(Math.floor(i / 4) + 337, 19);
      const levels = [0, .12 + shelf * .11, .34 + notch * .10, .52 + shelf * .10,
        .69 + notch * .12, .86 + shelf * .08, 1];
      for (let layer = 0; layer <= cliffLayers; layer++) {
        const t = mix(levels[layer], mix(bedLeft[layer], bedRight[layer], clamp(across)), rimWeight);
        // The old top and bottom coordinates, including their tiny offsets,
        // stay exact. Every new shoulder retreats into the existing island.
        const contactJag =
          (hash(Math.floor(i / 2) + 43, layer * 19) - 0.45) *
          0.041 * Math.sin(t * Math.PI),
          shoulder = mix([0, .005, .009, .008, .013, .006, 0][layer], profile[layer], faceCore),
          retreat = Math.min(.045, Math.max(0, faceSetback + shoulder + fracture + lean)) *
            Math.sin(t * Math.PI),
          bedContact = Math.min(1, t / .33) * Math.min(1, (1 - t) / .14),
          brokenShoulder = mix([0, .003, .008, .009, .014, .007, 0][layer],
            brokenProfile[layer], faceCore),
          brokenRetreat = Math.min(.060, Math.max(0,
            faceSetback * bedContact + brokenShoulder +
            brokenJoint * smooth(clamp((t - .14) / .35)) * Math.sin(t * Math.PI) +
            lean * 1.6)),
          jag = layer === 0 || layer === cliffLayers ? contactJag :
            -coastWinding * mix(retreat, brokenRetreat, rimWeight);
        const y = mix(top, -0.105 - hash(Math.floor(i / 5), 71) * 0.024, t);
        const familyStone = family < .52 ? stone : family < .82 ? brown : rock,
          lightFace = hash(block + part * 53, 811),
          sediment = hash(block + part * 283, layer < 3 ? 1013 : 1021);
        let color = colorMix(familyStone, pale,
          lightFace > .68 ? .12 + (lightFace - .68) * .60 : .025);
        // Mineral families and broken beds vary the paint. A continuous bright
        // cap would look like a drawn outline around the grass instead of rock.
        color = color.scale(.96 + sediment * .04);
        if (layer === 0) color = terrainColor(p.x, p.z);
        const cliffVertex = vertex(
          cliffs,
          p.x + nx * jag,
          y,
          p.z + nz * jag,
          color,
        );
        cliffs.uvs[cliffVertex * 2] = coastArc * .75;
        cliffs.uvs[cliffVertex * 2 + 1] = y * .75;
        if (i > 0 && layer > 0) {
          const d = i * (cliffLayers + 1) + layer;
          const a = d - cliffLayers - 2,
            b = d - cliffLayers - 1,
            c = d - 1;
          triangle(cliffs, a, c, b);
          triangle(cliffs, c, d, b);
          const faceBlock = segmentBlocks[i - 1],
            faceFormation = hash(faceBlock + part * 109, 617),
            capLayer = faceFormation < .40 ? 1 : faceFormation < .72 ? 3 : 2,
            footLayer = faceFormation < .40 ? 5 : faceFormation < .72 ? 4 : 3,
            protectedGroup = layer <= capLayer ? "cap" : layer <= footLayer ? "wall" : "foot",
            rockGroup = layer === 1 ? "cap" : faceFormation < .40 ?
              layer === 2 ? "shoulder" : layer <= 4 ? "wall" : "foot" :
              faceFormation < .72 ? layer <= 3 ? "upper-wall" : layer <= 5 ? "lower-wall" : "foot" :
                layer <= 4 ? "wall" : "foot",
            active = Math.max(cliffColumnWeights[i - 1], rimWeight) > 0,
            panel = segmentPanels[i - 1],
            group = active ? `${faceBlock}:panel-${panel}:${rockGroup}` : `${faceBlock}:${protectedGroup}`;
          cliffFaceGroups.push(group, group);
          cliffFaceBlocks.push(active ? panel : faceBlock, active ? panel : faceBlock);
        }
      }
    }
    // Every triangle that can meet the sea keeps ALL its coordinates. The
    // sea peaks at -.072; even the lowest mutable bed stays above -.064.
    const fixedWetVertices = new Set<number>();
    for (let face = 0; face < cliffs.indices.length; face += 3) {
      const corners = cliffs.indices.slice(face, face + 3);
      if (corners.some(index => cliffs.positions[index * 3 + 1] <= -.055))
        for (const index of corners) fixedWetVertices.add(index);
    }
    const dryPositions = cliffs.positions.slice();
    for (let column = 0; column <= coast.length; column++) {
      const weight = cliffColumnWeights[column];
      if (weight === 0) continue;
      const p = coast[column % coast.length], a = coast[(column + coast.length - 1) % coast.length],
        b = coast[(column + 1) % coast.length], length = Math.hypot(b.x - a.x, b.z - a.z) || 1,
        nx = (b.z - a.z) / length, nz = -(b.x - a.x) / length,
        panel = segmentPanels[Math.min(column, coast.length - 1)], limits = facadePanels[panel],
        across = clamp((coastArcs[column] - coastArcs[limits.start]) /
          (coastArcs[limits.end] - coastArcs[limits.start] || 1)),
        left = panel + part * 827, right = (panel + 1) % facadePanels.length + part * 827,
        clearance = Math.min(Math.hypot(p.x - a.x, p.z - a.z), Math.hypot(b.x - p.x, b.z - p.z)),
        inwardLimit = Math.min(.016, clearance * .16),
        first = column * (cliffLayers + 1) * 3,
        last = first + cliffLayers * 3,
        topY = dryPositions[first + 1], bottomY = dryPositions[last + 1];
      for (let layer = 1; layer < cliffLayers; layer++) {
        const index = column * (cliffLayers + 1) + layer, at = index * 3;
        if (fixedWetVertices.has(index)) continue;
        const above = dryPositions[at - 2],
          below = dryPositions[at + 4], y = dryPositions[at + 1],
          step = mix(hash(left, 1291 + layer * 17), hash(right, 1291 + layer * 17), across),
          opening = mix(hash(left, 1301 + layer * 19), hash(right, 1301 + layer * 19), across),
          shift = Math.min(.009, Math.max(0, Math.min(above - y, y - below) * .12)) *
            (step * 2 - 1) * weight,
          inward = inwardLimit * (.15 + opening * .85) * weight;
        // Straight columns give the miniature its vertical rock thickness.
        // Only dry internal beds move, within the original top/bottom outline;
        // the existing cover also excludes ports, rivers, houses and works.
        const contactT = clamp((topY - y) / (topY - bottomY || 1)),
          lineX = mix(dryPositions[first], dryPositions[last], contactT),
          lineZ = mix(dryPositions[first + 2], dryPositions[last + 2], contactT),
          leftJoint = (1 - smooth(clamp(across / .24))) *
            (.005 + hash(left, 1451) * .009),
          rightJoint = (1 - smooth(clamp((1 - across) / .24))) *
            (.005 + hash(right, 1451) * .009),
          chip = hash(left, 1459 + layer * 23) > .78 ?
            .003 + hash(left, 1463 + layer * 29) * .006 : 0,
          faceRetreat = Math.min(clearance * .24, .024,
            .0025 + opening * .004 + leftJoint + rightJoint + chip),
          verticality = .82 * weight,
          oldX = dryPositions[at] - coastWinding * nx * inward,
          oldZ = dryPositions[at + 2] - coastWinding * nz * inward;
        cliffs.positions[at] = mix(oldX, lineX - coastWinding * nx * faceRetreat, verticality);
        cliffs.positions[at + 1] = y + shift;
        cliffs.positions[at + 2] = mix(oldZ, lineZ - coastWinding * nz * faceRetreat, verticality);
      }
    }
    const sculptedRim = geometry(), rimVertices = new Map<string, number>();
    for (let face = 0; face < cliffs.indices.length / 3; face++) {
      const sourceCorners = cliffs.indices.slice(face * 3, face * 3 + 3),
        dryFace = sourceCorners.every(index => !fixedWetVertices.has(index)) &&
          sourceCorners.some(index => cliffColumnWeights[Math.floor(index / (cliffLayers + 1))] > 0),
        bed = Math.max(...sourceCorners.map(index => index % (cliffLayers + 1))),
        // Separate each exposed bed's normals. Smoothing over several beds
        // produced broad diagonal planks instead of short chipped rock faces.
        group = `${cliffFaceGroups[face]}${dryFace ? `:bed-${bed}` : ""}`,
        corners = sourceCorners.map(original => {
        const key = `${original}:${group}`, saved = rimVertices.get(key);
        if (saved !== undefined) return saved;
        const p = original * 3, c = original * 4, layer = original % (cliffLayers + 1),
          column = Math.floor(original / (cliffLayers + 1)), faceBlock = cliffFaceBlocks[face],
          family = hash(faceBlock + part * 211, 331),
          bedColor = family < .35 ? coastalOchre : family < .86 ? coastalSandstone : coastalLimestone,
          exposedColor = colorMix(bedColor, coastalIvory,
            .04 + hash(faceBlock + part * 53, 811) * .14),
          // A face belongs to a surveyed block, not to its neighbour's column.
          // Sparse sediment variation never draws a continuous bright cap.
          color = layer === 0 ? new Color3(cliffs.colors[c], cliffs.colors[c + 1], cliffs.colors[c + 2]) :
            colorMix(new Color3(cliffs.colors[c], cliffs.colors[c + 1], cliffs.colors[c + 2]),
              exposedColor.scale(.89 + hash(faceBlock + part * 283, 1471 + layer * 31) * .11),
              cliffColumnWeights[column]),
          index = vertex(sculptedRim, cliffs.positions[p], cliffs.positions[p + 1], cliffs.positions[p + 2], color);
        sculptedRim.uvs[index * 2] = cliffs.uvs[original * 2];
        sculptedRim.uvs[index * 2 + 1] = cliffs.uvs[original * 2 + 1];
        rimVertices.set(key, index);
        return index;
      });
      triangle(sculptedRim, corners[0], corners[1], corners[2]);
    }
    meshes.push(finish(scene, `landscape-cliffs-${part}`, sculptedRim, cliffMaterial));
  }
}

function forestAmount(x: number, z: number) {
  const source = mapAuthoredCoordinates(x, z), sx = source.x, sz = source.z;
  const landes = hill(sx, sz, -2.13, -2.11, 0.51, 1.0) * 0.58;
  const ardennes = hill(sx, sz, 1.54, 3.52, 0.75, 0.55) * 0.55;
  const vosges = hill(sx, sz, 3.09, 1.51, 0.55, 0.85) * 0.5;
  const massif = hill(sx, sz, 0.45, -1.05, 0.9, 1.03) * 0.5;
  const alpine = hill(sx, sz, 2.95, -1.26, 0.62, 1.5) * 0.6;
  const pyrenean = hill(sx, sz, -0.35, -3.06, 1.6, 0.42) * 0.63;
  const legacy = (
    noise(sx * 2.9 + 74, sz * 2.9 + 22) * 0.58 +
    noise(sx * 8.3 + 1, sz * 8.3 + 8) * 0.2 +
    Math.max(landes, ardennes, vosges, massif, alpine, pyrenean)
  );
  if (parisSector(x, z)) return legacy;
  const wood = nationalWoodAt(x, z);
  if (!wood) return legacy * 0.23;
  const groups = wood.groups;
  if (!groups?.length) return 0.94;
  let density = 0;
  for (const group of groups) density = Math.max(density,
    clamp(1 - Math.hypot((sx - group.x) / group.rx, (sz - group.z) / group.rz)));
  return Math.max(legacy * 0.23, 0.49 + density * 0.62);
}

function fieldFan(
  data: Geometry,
  polygon: Point[],
  center: Point,
  color: Color3,
  lift = 0.011,
) {
  // Authored outlines may have either winding; every ground fan faces upward.
  const signedArea = polygon.reduce((area, point, i) => {
    const next = polygon[(i + 1) % polygon.length];
    return area + point.x * next.z - next.x * point.z;
  }, 0);
  if (signedArea < 0) polygon = [...polygon].reverse();
  const middle = vertex(
    data,
    center.x,
    landHeight(center.x, center.z) + lift,
    center.z,
    color,
  );
  const border = densify(polygon, 0.07).map((p) => ({
    x: mix(p.x, center.x, 0.025),
    z: mix(p.z, center.z, 0.025),
  }));
  let previous: number[] = [];
  for (let ring = 1; ring <= 2; ring++) {
    const current: number[] = [];
    for (const p of border) {
      const x = mix(center.x, p.x, ring / 2),
        z = mix(center.z, p.z, ring / 2);
      const variation = 0.95 + noise(x * 25.3 + 4, z * 25.3 + 12) * 0.1;
      current.push(
        vertex(data, x, landHeight(x, z) + lift, z, color.scale(variation)),
      );
    }
    for (let i = 0; i < current.length; i++) {
      const next = (i + 1) % current.length;
      if (ring === 1) triangle(data, middle, current[i], current[next]);
      else {
        triangle(data, previous[i], current[i], current[next]);
        triangle(data, previous[i], current[next], previous[next]);
      }
    }
    previous = current;
  }
}

function strip(
  data: Geometry,
  path: Point[],
  width: number,
  color: Color3,
  offset: number,
) {
  const start = data.positions.length / 3;
  for (let i = 0; i < path.length; i++) {
    const previous = path[Math.max(0, i - 1)],
      next = path[Math.min(path.length - 1, i + 1)];
    const length = Math.hypot(next.x - previous.x, next.z - previous.z) || 1;
    const nx = (((next.z - previous.z) / length) * width) / 2;
    const nz = ((-(next.x - previous.x) / length) * width) / 2;
    for (const side of [-1, 1]) {
      const x = path[i].x + nx * side,
        z = path[i].z + nz * side;
      vertex(data, x, landHeight(x, z) + offset, z, color);
    }
    if (i > 0) {
      const a = start + (i - 1) * 2,
        b = a + 1,
        c = a + 2,
        d = a + 3;
      triangle(data, a, b, c);
      triangle(data, b, d, c);
    }
  }
}

// Curved centreline survey stays in the authored source frame. Every point is
// projected individually, so the eastern correction also bends the crop rows.
function sampleCropGuide(guide: readonly Point[]) {
  const path: Point[] = [];
  for (let i = 0; i < guide.length - 1; i++) {
    const a = guide[Math.max(0, i - 1)], b = guide[i], c = guide[i + 1],
      d = guide[Math.min(guide.length - 1, i + 2)],
      divisions = Math.max(1, Math.ceil(Math.hypot(c.x - b.x, c.z - b.z) / .018));
    for (let step = 0; step < divisions; step++) {
      const t = step / divisions, t2 = t * t, t3 = t2 * t,
        curve = (av: number, bv: number, cv: number, dv: number) => .5 * (
          2 * bv + (-av + cv) * t + (2 * av - 5 * bv + 4 * cv - dv) * t2 +
          (-av + 3 * bv - 3 * cv + dv) * t3);
      path.push({ x: curve(a.x, b.x, c.x, d.x), z: curve(a.z, b.z, c.z, d.z) });
    }
  }
  path.push(guide[guide.length - 1]);
  return path;
}

function guidedCropRows(data: Geometry, polygon: Point[], sourceGuide: readonly Point[],
  spacing: number, color: Color3, lift: number, available: (x: number, z: number) => boolean) {
  const guide = sampleCropGuide(sourceGuide),
    sourcePolygon = polygon.map(point => mapAuthoredCoordinates(point.x, point.z)),
    reach = Math.max(...sourcePolygon.map(point => Math.min(...guide.slice(1).map((b, i) =>
      segmentDistance(point.x, point.z, guide[i], b))))),
    rowLimit = Math.ceil(reach / spacing), width = spacing * .28;
  const approved = (point: Point) => contains(polygon, point.x, point.z) &&
    available(point.x, point.z) && !constructionReservationContains(point.x, point.z, .016);
  type Section = readonly [Point, Point, Point];
  const between = (a: Point, b: Point, t = .5) => ({ x: mix(a.x, b.x, t), z: mix(a.z, b.z, t) });
  const faceApproved = (a: Point, b: Point, c: Point) => approved({
    x: (a.x + b.x + c.x) / 3, z: (a.z + b.z + c.z) / 3,
  });
  for (let row = -rowLimit; row <= rowLimit; row++) {
    const sourcePath = guide.map((point, i) => {
      const a = guide[Math.max(0, i - 1)], b = guide[Math.min(guide.length - 1, i + 1)],
        length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      return { x: point.x - (b.z - a.z) / length * row * spacing,
        z: point.z + (b.x - a.x) / length * row * spacing };
    });
    const path = densify(sourcePath.map(point => mapAuthoredPosition(point.x, point.z)), .018, false);
    let run: Section[] = [];
    const flush = () => {
      if (run.length > 1) {
        const start = data.positions.length / 3;
        for (let i = 0; i < run.length; i++) {
          for (let side = 0; side < 3; side++) {
            const point = run[i][side];
            vertex(data, point.x, landHeight(point.x, point.z) + lift + (side === 1 ? .004 : 0),
              point.z, side === 1 ? color : color.scale(.93));
          }
          if (i > 0) {
            const a = start + (i - 1) * 3, b = a + 3;
            for (let side = 0; side < 2; side++) {
              triangle(data, a + side, a + side + 1, b + side);
              triangle(data, a + side + 1, b + side + 1, b + side);
            }
          }
        }
      }
      run = [];
    };
    for (let i = 0; i < path.length; i++) {
      const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)],
        length = Math.hypot(b.x - a.x, b.z - a.z) || 1,
        nx = (b.z - a.z) / length * width / 2, nz = -(b.x - a.x) / length * width / 2,
        point = path[i], section: Section = [
          { x: point.x - nx, z: point.z - nz }, point, { x: point.x + nx, z: point.z + nz },
        ];
      // Test the whole raised strip, including its shoulders and face centres.
      // A curved centreline alone is not sufficient beside a river or a house.
      if (!section.every(approved) || !approved(between(section[0], section[1])) ||
        !approved(between(section[1], section[2]))) { flush(); continue; }
      const previous = run[run.length - 1];
      if (previous && (!section.every((point, side) => approved(between(point, previous[side]))) ||
        ![0, 1].every(side => faceApproved(previous[side], previous[side + 1], section[side]) &&
          faceApproved(previous[side + 1], section[side + 1], section[side])))) flush();
      run.push(section);
    }
    flush();
  }
}

function cropRows(
  data: Geometry,
  polygon: Point[],
  center: Point,
  theta: number,
  spacing: number,
  color: Color3,
  lift = 0.017,
  available?: (x: number, z: number) => boolean,
  sourceGuide?: readonly Point[],
) {
  if (sourceGuide && sourceGuide.length > 1 && available) {
    guidedCropRows(data, polygon, sourceGuide, spacing, color, lift, available);
    return;
  }
  const dx = Math.cos(theta),
    dz = Math.sin(theta),
    nx = -dz,
    nz = dx;
  const projections = polygon.map(
    (p) => (p.x - center.x) * nx + (p.z - center.z) * nz,
  );
  for (
    let row = Math.ceil(Math.min(...projections) / spacing);
    row <= Math.floor(Math.max(...projections) / spacing);
    row++
  ) {
    const origin = {
      x: center.x + nx * row * spacing,
      z: center.z + nz * row * spacing,
    };
    const intersections: number[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length];
      const ex = b.x - a.x,
        ez = b.z - a.z,
        determinant = dx * ez - dz * ex;
      if (Math.abs(determinant) < 0.00001) continue;
      const rx = a.x - origin.x,
        rz = a.z - origin.z;
      const t = (rx * ez - rz * ex) / determinant,
        u = (rx * dz - rz * dx) / determinant;
      if (u >= 0 && u <= 1) intersections.push(t);
    }
    intersections.sort((a, b) => a - b);
    if (intersections.length < 2) continue;
    const first = intersections[0] + 0.01,
      last = intersections[intersections.length - 1] - 0.01;
    if (last <= first) continue;
    const path = densify(
        [
          { x: origin.x + dx * first, z: origin.z + dz * first },
          { x: origin.x + dx * last, z: origin.z + dz * last },
        ],
        available ? 0.025 : 0.075,
        false,
      );
    if (!available) strip(data, path, spacing * 0.14, color, lift);
    else {
      let run: Point[] = [];
      const flush = () => {
        if (run.length > 1) strip(data, run, spacing * 0.24, color, lift);
        run = [];
      };
      for (const point of path) {
        if (!available(point.x, point.z)) { flush(); continue; }
        const previous = run[run.length - 1];
        if (previous && !available((point.x + previous.x) / 2, (point.z + previous.z) / 2)) flush();
        run.push(point);
      }
      flush();
    }
  }
}

function hedge(data: Geometry, path: Point[], top = 0.032) {
  const start = data.positions.length / 3;
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)],
      b = path[Math.min(path.length - 1, i + 1)];
    const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = ((b.z - a.z) / length) * 0.013,
      nz = (-(b.x - a.x) / length) * 0.013;
    for (const side of [-1, 0, 1]) {
      const x = path[i].x + nx * side,
        z = path[i].z + nz * side;
      vertex(
        data,
        x,
        landHeight(x, z) + (side === 0 ? top : 0.009),
        z,
        Color3.FromHexString(side === 0 ? "#789448" : "#627C3D"),
      );
    }
    if (i > 0) {
      const a = start + (i - 1) * 3,
        b = a + 3;
      for (let side = 0; side < 2; side++) {
        triangle(data, a + side, a + side + 1, b + side);
        triangle(data, a + side + 1, b + side + 1, b + side);
      }
    }
  }
}

function clipField(polygon: Point[], center: Point, other: Point) {
  const nx = other.x - center.x,
    nz = other.z - center.z;
  const edge =
    (other.x * other.x +
      other.z * other.z -
      center.x * center.x -
      center.z * center.z) /
    2;
  const result: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length];
    const da = a.x * nx + a.z * nz - edge,
      db = b.x * nx + b.z * nz - edge;
    if (da <= 0) result.push(a);
    if (da < 0 !== db < 0) {
      const t = da / (da - db);
      result.push({ x: mix(a.x, b.x, t), z: mix(a.z, b.z, t) });
    }
  }
  return result;
}

function clipBesideSettlement(polygon: Point[], center: Point) {
  const radius = Math.max(
    ...polygon.map((p) => Math.hypot(p.x - center.x, p.z - center.z)),
  );
  for (const footprint of surveyedFootprints) {
    const dx = center.x - footprint.x,
      dz = center.z - footprint.z;
    const lx = dx * footprint.cosine + dz * footprint.sine,
      lz = -dx * footprint.sine + dz * footprint.cosine;
    const px = Math.abs(lx) - footprint.halfW,
      pz = Math.abs(lz) - footprint.halfD;
    if (px > radius || pz > radius) continue;
    const side = px > pz ? Math.sign(lx) : Math.sign(lz);
    const nx = px > pz ? footprint.cosine * side : -footprint.sine * side;
    const nz = px > pz ? footprint.sine * side : footprint.cosine * side;
    const edge =
      nx * footprint.x +
      nz * footprint.z +
      (px > pz ? footprint.halfW : footprint.halfD) +
      0.006;
    const clipped: Point[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length];
      const da = a.x * nx + a.z * nz - edge,
        db = b.x * nx + b.z * nz - edge;
      if (da >= 0) clipped.push(a);
      if (da < 0 !== db < 0) {
        const t = da / (da - db);
        clipped.push({ x: mix(a.x, b.x, t), z: mix(a.z, b.z, t) });
      }
    }
    polygon = clipped;
    if (polygon.length < 3) return [];
  }
  return polygon;
}

const cropSurveys = new Map<number, Map<number, { ground: boolean; clearance: number }>>();
function nationalCropAvailable(x: number, z: number, margin: number) {
  let column = cropSurveys.get(x);
  if (!column) { column = new Map(); cropSurveys.set(x, column); }
  let survey = column.get(z);
  if (!survey) {
    const clearance = urbanClearance(x, z);
    let ground = clearance > .008 && landContains(x, z) &&
      !parisAreaAt(x, z) && !nationalWoodAt(x, z) && !nationalBlockAt(x, z);
    if (ground) ground = landHeight(x, z) < .46 && Math.hypot(
      landHeight(x + .018, z) - landHeight(x - .018, z),
      landHeight(x, z + .018) - landHeight(x, z - .018)) / .036 < .64;
    survey = { ground, clearance }; column.set(z, survey);
  }
  return survey.ground && survey.clearance > margin + .008 && !riverContains(x, z, margin);
}

function buildFields(
  scene: Scene,
  meshes: Mesh[],
  textures: LandMaterialTextures,
) {
  const crops = geometry(),
    rows = geometry(),
    lanes = geometry(),
    hedges = geometry(),
    orchards: Point[] = [];
  // Shared irregular parcel edges give coherent basins and bocage. The patchwork
  // covers lowland routes between settlements, not isolated islands in a lawn.
  const spacing = 0.29,
    depth = 0.19,
    centers = new Map<string, Point>();
  const minimumX = Math.floor(parisBounds.minX / spacing) - 1,
    maximumX = Math.ceil(parisBounds.maxX / spacing) + 1;
  const minimumZ = Math.floor(parisBounds.minZ / depth) - 1,
    maximumZ = Math.ceil(parisBounds.maxZ / depth) + 1;
  for (let ix = minimumX; ix <= maximumX; ix++)
    for (let iz = minimumZ; iz <= maximumZ; iz++) {
      if (hash(ix * 3 + 8, iz * 7 + 19) < 0.14) continue;
      const drift = (noise(ix * 0.31 + 8, iz * 0.36 + 9) - 0.5) * 0.22;
      centers.set(`${ix}:${iz}`, {
        x: (ix + (hash(ix + 37, iz) - 0.5) * 0.48) * spacing + drift,
        z: (iz + (hash(ix, iz + 87) - 0.5) * 0.37) * depth + drift * 0.34,
      });
    }
  const pasture = ["#5C8836", "#7A9D45", "#98B35B", "#688E39"];
  const wheat = ["#E6B54B", "#D3A13E", "#F1C45C", "#E6C165"];
  const vineyard = ["#A89A68", "#B5A071", "#8B945A", "#B5A96D"];
  let serial = 0;
  for (let ix = minimumX + 1; ix < maximumX; ix++)
    for (let iz = minimumZ + 1; iz < maximumZ; iz++) {
      const center = centers.get(`${ix}:${iz}`);
      if (!center) continue;
      // Paris 10 remains frozen; the rest of France uses composed long fields.
      if (!parisSector(center.x, center.z)) continue;
      if (
        !landContains(center.x, center.z) ||
        landHeight(center.x, center.z) > 0.46 ||
        urbanClearance(center.x, center.z) < 0.016 ||
        forestAmount(center.x, center.z) > 0.74
      )
        continue;
      let polygon: Point[] = [
        { x: center.x - 0.6, z: center.z - 0.6 },
        { x: center.x + 0.6, z: center.z - 0.6 },
        { x: center.x + 0.6, z: center.z + 0.6 },
        { x: center.x - 0.6, z: center.z + 0.6 },
      ];
      for (let dx = -2; dx <= 2; dx++)
        for (let dz = -2; dz <= 2; dz++) {
          if (!dx && !dz) continue;
          const other = centers.get(`${ix + dx}:${iz + dz}`);
          if (other) polygon = clipField(polygon, center, other);
        }
      if (polygon.length < 3) continue;
      polygon = polygon.map((p) => ({
        x: mix(p.x, center.x, 0.038),
        z: mix(p.z, center.z, 0.038),
      }));
      polygon = clipBesideSettlement(polygon, center);
      if (polygon.length < 3) continue;
      const radius = Math.max(
        ...polygon.map((p) => Math.hypot(p.x - center.x, p.z - center.z)),
      );
      if (
        riverContains(center.x, center.z, radius + 0.007) ||
        polygon.some(
          (p) => !landContains(p.x, p.z) || landHeight(p.x, p.z) > 0.5,
        )
      )
        continue;
      const { lon, lat } = mapCoordinates(center.x, center.z),
        seed = serial++;
      if (parisReplacesParcel(center.x, center.z, radius + 0.015)) continue;
      const western = lon < 0.5 && lat > 46.4;
      const vines = (lon > 3.2 && lat < 47.5) || (lat < 45.1 && lon < 1.0);
      const basin = noise(center.x * 1.3 + 12, center.z * 1.4 + 38);
      const kind = vines
        ? 2
        : western
          ? basin > 0.61
            ? 1
            : 0
          : basin > 0.3
            ? 1
            : 0;
      // Open pastures remain between crop basins; southern plots are drier and
      // sparser. Broad woodland blocks keep their organic edge against fields.
      if (
        (kind === 0 && hash(ix + 83, iz * 11) > 0.62) ||
        (vines && basin < 0.24)
      )
        continue;
      const palette = kind === 0 ? pasture : kind === 1 ? wheat : vineyard;
      let color = Color3.FromHexString(
        palette[
          Math.floor(hash(ix * 13, iz * 7) * palette.length) % palette.length
        ],
      );
      if (kind === 1 && hash(ix + 31, iz + 43) < 0.24)
        color = Color3.FromHexString("#7E9A49");
      if (kind === 2 && hash(ix + 52, iz + 21) < 0.31)
        color = Color3.FromHexString("#7B8D45");
      fieldFan(crops, polygon, center, color);
      const angle =
        (kind === 0 ? 0.22 : kind === 2 ? -0.4 : 0.09) +
        (noise(center.x * 0.7 + 8, center.z * 0.8 + 1) - 0.5) * 1.3;
      if (kind === 2 || (kind === 1 && hash(seed, 31) > 0.25)) {
        cropRows(
          rows,
          polygon,
          center,
          angle,
          kind === 2 ? 0.021 : 0.014,
          color.scale(kind === 2 ? 0.65 : 0.86),
        );
      }
      if (kind === 0) {
        if (hash(seed, 43) > 0.22)
          hedge(hedges, densify([polygon[0], polygon[1]], 0.043, false));
        if (hash(seed, 23) > 0.55)
          hedge(hedges, densify([polygon[1], polygon[2]], 0.043, false));
      }
      if (seed % 9 === 0)
        strip(
          lanes,
          densify([polygon[0], polygon[1]], 0.05, false),
          0.009,
          Color3.FromHexString("#BFB086"),
          0.014,
        );
      if (kind === 2 && seed % 11 === 0)
        for (let tree = 0; tree < 4; tree++) {
          const t = (tree + 1) / 5;
          orchards.push({
            x: mix(polygon[0].x, polygon[1].x, t),
            z: mix(polygon[0].z, polygon[1].z, t),
          });
        }
    }
  let nationalParcels = 0;
  for (const [fieldIndex, field] of [...NATIONAL_FIELDS, ...VALLEY_FIELDS].entries()) {
    const sourcePolygon = field.outline.map(([x, z]) => ({ x, z })),
      polygon = sourcePolygon.map(point => mapAuthoredPosition(point.x, point.z)),
      minX = Math.min(...sourcePolygon.map(p => p.x)), maxX = Math.max(...sourcePolygon.map(p => p.x)),
      minZ = Math.min(...sourcePolygon.map(p => p.z)), maxZ = Math.max(...sourcePolygon.map(p => p.z)),
      points = densify(sourcePolygon, 0.04).map(point => mapAuthoredPosition(point.x, point.z)),
      sourceCenter = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
      center = mapAuthoredPosition(sourceCenter.x, sourceCenter.z), jacobian = mapAuthoredJacobian(sourceCenter.x, sourceCenter.z),
      angle = Math.atan2(jacobian.zx * Math.cos(field.angle) + jacobian.zz * Math.sin(field.angle),
        jacobian.xx * Math.cos(field.angle) + jacobian.xz * Math.sin(field.angle));
    for (let x = minX + 0.023; x < maxX; x += 0.048)
      for (let z = minZ + 0.019; z < maxZ; z += 0.048)
        if (contains(sourcePolygon, x, z)) points.push(mapAuthoredPosition(x, z));
    const available = (x: number, z: number, margin: number) => nationalCropAvailable(x, z, margin) &&
      (!field.infill || !largeCropAt(x, z)),
      palette = field.kind === "pasture" ? ["#5C8836", "#7A9D45", "#98B35B", "#688E39"] :
        field.kind === "wheat" ? ["#E6B54B", "#F1C45C", "#E6C165", "#D3A13E"] :
        ["#A5A450", "#BAAA5B", "#9DAA48", "#B6AD60"],
      parcelTone = Color3.FromHexString(palette[(field.paletteSlot ?? fieldIndex) % palette.length]),
      authoredTone = Color3.FromHexString(field.color),
      // The authored cereal tones carry the warm harvest hue. Keeping only
      // 18 percent of them made ordinary fields converge towards dull olive.
      color = field.composedPalette
        ? field.kind === "wheat" ? colorMix(authoredTone, parcelTone, .40)
          : field.kind === "pasture" ? colorMix(authoredTone, parcelTone, .42) : authoredTone
        : colorMix(parcelTone, authoredTone, field.kind === "wheat" ? .72 : .18),
      start = crops.indices.length,
      triangulation = Delaunator.from(points, p => p.x, p => p.z).triangles;
    for (let i = 0; i < triangulation.length; i += 3) {
      const p = points[triangulation[i]], q = points[triangulation[i + 1]], r = points[triangulation[i + 2]],
        x = (p.x + q.x + r.x) / 3, z = (p.z + q.z + r.z) / 3,
        radius = Math.max(Math.hypot(p.x - x, p.z - z), Math.hypot(q.x - x, q.z - z), Math.hypot(r.x - x, r.z - z));
      if (!contains(polygon, x, z) || !available(x, z, radius + 0.009) ||
        ![p, q, r].every(p => available(p.x, p.z, 0.009))) continue;
      const winding = (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
      if (Math.abs(winding) < 1e-10) continue;
      const heights = [p, q, r].map(point => landHeight(point.x, point.z)),
        gx = ((heights[1] - heights[0]) * (r.z - p.z) - (heights[2] - heights[0]) * (q.z - p.z)) / winding,
        gz = ((q.x - p.x) * (heights[2] - heights[0]) - (r.x - p.x) * (heights[1] - heights[0])) / winding;
      if (Math.hypot(gx, gz) > .64) continue;
      const corners = [p, q, r].map(p => vertex(crops, p.x, landHeight(p.x, p.z) + 0.004, p.z,
        color.scale(0.96 + noise(p.x * 18.7, p.z * 20.1) * 0.08)));
      triangle(crops, corners[0], corners[winding > 0 ? 1 : 2], corners[winding > 0 ? 2 : 1]);
    }
    if (crops.indices.length === start) continue;
    nationalParcels++;
    if (field.kind !== "pasture") cropRows(rows, polygon, center, angle,
      field.rowGuide ? field.kind === "vines" ? .043 : .038 : field.kind === "vines" ? .027 : .022,
      color.scale(field.kind === "vines" ? .60 : .79),
      .008, (x, z) => available(x, z, .012), field.rowGuide?.map(([x, z]) => ({ x, z })));
    for (const edge of field.hedgedEdges ?? []) {
      let run: Point[] = [];
      const flush = () => { if (run.length > 1) hedge(hedges, run, 0.019); run = []; };
      for (const point of densify([polygon[edge], polygon[(edge + 1) % polygon.length]], 0.035, false)) {
        if (!available(point.x, point.z, 0.021)) { flush(); continue; }
        run.push(point);
      }
      flush();
    }
    if (field.infill && (field.paletteSlot ?? fieldIndex) % 5 === 0) {
      let run: Point[] = [];
      const flush = () => { if (run.length > 1) strip(lanes, run, .009,
        Color3.FromHexString("#D7C391"), .009); run = []; };
      for (const point of densify([polygon[1], polygon[2]], .025, false)) {
        if (!available(point.x, point.z, .013)) { flush(); continue; }
        run.push(point);
      }
      flush();
    }
  }
  for (const boundary of CENTRAL_FIELD_EDGES) {
    let run: Point[] = [];
    const flush = () => { if (run.length > 1) hedge(hedges, run, .052); run = []; };
    for (const point of densify(boundary.map(([x, z]) => mapAuthoredPosition(x, z)), .025, false)) {
      if (!landContains(point.x, point.z) || urbanClearance(point.x, point.z) < .045 ||
        riverContains(point.x, point.z, .055) || constructionReservationContains(point.x, point.z, .035) ||
        parisAreaAt(point.x, point.z)) { flush(); continue; }
      run.push(point);
    }
    flush();
  }
  const composedGold = ["#E4BC5D", "#D5AF56", "#C99F4B"];
  for (const [index, area] of PARIS_TERRAIN_AREAS.filter(
    (area) => area.kind === "field",
  ).entries()) {
    const polygon = area.polygon.filter((point) =>
      landContains(point.x, point.z),
    );
    if (polygon.length !== area.polygon.length || polygon.length < 3) continue;
    const center = {
      x: polygon.reduce((n, p) => n + p.x, 0) / polygon.length,
      z: polygon.reduce((n, p) => n + p.z, 0) / polygon.length,
    };
    const color = Color3.FromHexString(
      composedGold[index % composedGold.length],
    );
    fieldFan(crops, polygon, center, color, 0.004);
    const longEdge = polygon
      .map((a, i) => ({ a, b: polygon[(i + 1) % polygon.length] }))
      .sort(
        (a, b) =>
          Math.hypot(b.b.x - b.a.x, b.b.z - b.a.z) -
          Math.hypot(a.b.x - a.a.x, a.b.z - a.a.z),
      )[0];
    cropRows(
      rows,
      polygon,
      center,
      Math.atan2(longEdge.b.z - longEdge.a.z, longEdge.b.x - longEdge.a.x),
      0.018,
      color.scale(0.82),
      0.008,
    );
    hedge(hedges, densify([polygon[0], polygon[1]], 0.043, false));
  }
  const cropMaterial = material(scene, "landscape-crops", "#FFFFFF");
  cropMaterial.diffuseTexture = textures.crops;
  cropMaterial.bumpTexture = textures.earthNormal;
  cropMaterial.backFaceCulling = false;
  const rowMaterial = material(scene, "landscape-crop-detail", "#FFFFFF");
  rowMaterial.backFaceCulling = false;
  const cropMesh = finish(scene, "landscape-agriculture", crops, cropMaterial, false);
  cropMesh.metadata = { ...cropMesh.metadata, nationalParcels, composedParcels: true };
  meshes.push(cropMesh);
  meshes.push(finish(scene, "landscape-crop-rows", rows, rowMaterial, false));
  meshes.push(finish(scene, "landscape-farm-lanes", lanes, rowMaterial, false));
  const hedgeMaterial = material(scene, "landscape-hedges", "#FFFFFF");
  hedgeMaterial.diffuseTexture = textures.leaves;
  meshes.push(finish(scene, "landscape-hedges", hedges, hedgeMaterial));
  cropSurveys.clear();
  return orchards;
}

function riverCandidates(cellX: number, cellZ: number, radius: number): readonly RiverSegment[] {
  const key = `${cellX}:${cellZ}:${radius}`, cached = riverQueryCandidates.get(key);
  if (cached) return cached;
  // riverCells and the water polygons are populated once at module startup.
  // Keep their first-seen order, but avoid testing a shared segment per cell.
  const candidates: RiverSegment[] = [], seen = new Set<RiverSegment>();
  for (let dx = -radius; dx <= radius; dx++)
    for (let dz = -radius; dz <= radius; dz++)
      for (const segment of riverCells.get(`${cellX + dx}:${cellZ + dz}`) ?? [])
        if (!seen.has(segment)) { seen.add(segment); candidates.push(segment); }
  riverQueryCandidates.set(key, candidates);
  return candidates;
}
function riverWaterBounds(segment: RiverSegment) {
  let bounds = riverQueryBounds.get(segment);
  if (!bounds) {
    bounds = { minX: Math.min(...segment.water.map(p => p.x)), maxX: Math.max(...segment.water.map(p => p.x)),
      minZ: Math.min(...segment.water.map(p => p.z)), maxZ: Math.max(...segment.water.map(p => p.z)) };
    riverQueryBounds.set(segment, bounds);
  }
  return bounds;
}
export function riverContains(x: number, z: number, margin = 0): boolean {
  const cellX = Math.floor(x / .25), cellZ = Math.floor(z / .25),
    radius = Math.ceil(Math.max(0, margin) / .25), padding = Math.max(0, margin) + 1e-8;
  for (const segment of riverCandidates(cellX, cellZ, radius)) {
    // Read the live flag; the cache indexes geometry rather than query results.
    if (!segment.rendered) continue;
    const bounds = riverWaterBounds(segment);
    if (x < bounds.minX - padding || x > bounds.maxX + padding ||
      z < bounds.minZ - padding || z > bounds.maxZ + padding) continue;
    if (contains(segment.water, x, z)) return true;
    if (margin > 0 && segment.water.some((point, index) =>
      segmentDistance(x, z, point, segment.water[(index + 1) % segment.water.length]) < margin)) return true;
  }
  return false;
}

function nearbyRiver(x: number, z: number) {
  return riverContains(x, z, 0.024);
}

async function buildForests(scene: Scene, orchards: Point[]) {
  const kit = await loadAssetKit(scene, MODEL_URLS.vegetation);
  if (scene.isDisposed) return [];
  const meshes: AbstractMesh[] = [],
    forestRoot = new TransformNode("landscape-authored-vegetation", scene);
  const spacing = 0.15;
  let treeCount = 0,
    rockCount = 0;
  const plant = (
    name: string,
    x: number,
    z: number,
    height: number,
    angle: number,
  ) => {
    if (!kit.names.includes(name)) return;
    const prefab = kit.instantiate(name, forestRoot);
    prefab.root.position.set(x, landHeight(x, z) + 0.002, z);
    const extent = kit.bounds(name),
      scale = height / Math.max(0.01, extent.height);
    prefab.root.scaling.setAll(scale);
    prefab.root.rotation.y = angle;
    if (name === "rock") {
      const gx = (landHeight(x + 0.035, z) - landHeight(x - 0.035, z)) / 0.07;
      const gz = (landHeight(x, z + 0.035) - landHeight(x, z - 0.035)) / 0.07;
      const rotation = new Quaternion();
      Quaternion.FromUnitVectorsToRef(
        Vector3.Up(),
        new Vector3(-gx, 1, -gz).normalize(),
        rotation,
      );
      prefab.root.rotationQuaternion = rotation.multiply(
        Quaternion.RotationAxis(Vector3.Up(), angle),
      );
      prefab.root.position.y -= height * 0.16;
    }
    meshes.push(...prefab.meshes);
    if (name === "rock") rockCount++;
    else treeCount++;
    return prefab.root;
  };
  for (
    let ix = Math.floor(sourceBounds.minX / spacing);
    ix * spacing < sourceBounds.maxX;
    ix++
  ) {
    for (
      let iz = Math.floor(sourceBounds.minZ / spacing);
      iz * spacing < sourceBounds.maxZ;
      iz++
    ) {
      const point = mapAuthoredPosition((ix + (hash(ix + 11, iz) - 0.5) * 0.92) * spacing,
        (iz + (hash(ix + 53, iz) - 0.5) * 0.92) * spacing), { x, z } = point;
      if (!parisSector(x, z)) continue;
      if (
        !landContains(x, z) ||
        parisAreaAt(x, z) ||
        urbanClearance(x, z) < 0.04 ||
        nearbyRiver(x, z)
      )
        continue;
      const y = landHeight(x, z),
        forest = forestAmount(x, z);
      if (forest < 0.63 || y > 0.82) continue;
      const amount = forest > 0.87 ? 2 : 1;
      for (let tree = 0; tree < amount; tree++) {
        const tx = x + (hash(ix + tree * 31, iz + 46) - 0.5) * 0.105;
        const tz = z + (hash(ix + 67, iz + tree * 21) - 0.5) * 0.105;
        if (
          !landContains(tx, tz) ||
          parisAreaAt(tx, tz) ||
          urbanClearance(tx, tz) < 0.025 ||
          nearbyRiver(tx, tz)
        )
          continue;
        const ground = landHeight(tx, tz),
          variant = hash(ix * 7 + tree, iz * 3);
        if (ground > 0.84) continue;
        const southern = tz < -1.4;
        const name =
          ground > 0.4 || variant > 0.78
            ? "pine"
            : southern
              ? variant > 0.5
                ? "olive"
                : "cypress"
              : variant > 0.4
                ? "oak"
                : "beech";
        plant(name, tx, tz, 0.12 + variant * 0.12, variant * Math.PI * 2);
        if (ground > 0.42 && variant > 0.85)
          plant(
            "rock",
            tx + 0.028,
            tz - 0.018,
            0.027 + variant * 0.018,
            variant * 7,
          );
      }
    }
  }
  const woodlandCounts: Record<string, number> = {};
  const corsicaPort = surveyHarbour("ajaccio", mapPosition(MAP_PLACES.ajaccio.lon, MAP_PLACES.ajaccio.lat)),
    corsicaPortReservations = corsicaPort ? [...corsicaPort.landReservations,
      ...corsicaPort.quayPolygons, ...corsicaPort.coastalJoins] : [];
  for (const [index, wood] of composedWoods.entries()) {
    const planted: Point[] = [];
    for (let candidate = 0; candidate < wood.trees * 45 && planted.length < wood.trees; candidate++) {
      const group = wood.groups?.[candidate % wood.groups.length],
        angle = hash(candidate * 37 + 1291, index * 41 + 73) * Math.PI * 2,
        radius = Math.sqrt(hash(candidate * 71 + 2579, index * 29 + 187)),
        sx = group ? group.x + Math.cos(angle) * group.rx * radius : mix(wood.sourceMinX, wood.sourceMaxX, hash(candidate * 37 + 1291, index * 41 + 73)),
        sz = group ? group.z + Math.sin(angle) * group.rz * radius : mix(wood.sourceMinZ, wood.sourceMaxZ, hash(candidate * 71 + 2579, index * 29 + 187)),
        { x, z } = mapAuthoredPosition(sx, sz);
      const ground = landHeight(x, z);
      if (!contains(wood.polygon, x, z) || !landContains(x, z) || parisSector(x, z) ||
        ((wood.id.startsWith("bosquet-") || wood.id === "lisiere-loire-centre" ||
          wood.id === "bois-centre-sud" || wood.id === "lisiere-berry-bourbonnais" ||
          wood.id === "lisiere-champagne-ardenne" || wood.id === "lisiere-lorraine") &&
          constructionReservationContains(x, z, .035)) ||
        parisAreaAt(x, z) || nationalBlockAt(x, z) || urbanClearance(x, z) < 0.032 || nearbyRiver(x, z) ||
        ground < (wood.minHeight ?? -Infinity) || ground > (wood.maxHeight ?? 0.78) ||
        planted.some(p => Math.hypot(p.x - x, p.z - z) < (wood.minSpacing ?? 0.031))) continue;
      if (wood.maxSlope !== undefined) {
        const slope = Math.hypot(landHeight(x + .018, z) - landHeight(x - .018, z),
          landHeight(x, z + .018) - landHeight(x, z - .018)) / .036,
          trunk = [{ x: x - .020, z: z - .020 }, { x: x + .020, z: z - .020 },
            { x: x + .020, z: z + .020 }, { x: x - .020, z: z + .020 }];
        if (slope > wood.maxSlope || trunk.some(point => !landContains(point.x, point.z) ||
            urbanClearance(point.x, point.z) < .011 || riverContains(point.x, point.z, .009)) ||
          corsicaPortReservations.some(polygon => harbourPolygonsOverlap(polygon, trunk))) continue;
      }
      const variation = hash(candidate * 19 + 31, index * 17 + 419),
        name = wood.species ?? (variation < 0.88 ? "pine" : variation < 0.95 ? "cypress" : "beech"),
        height = candidate % 7 === 0 ? 0.145 + variation * 0.045 : 0.22 + variation * 0.085,
        root = plant(name, x, z, height, variation * Math.PI * 2);
      if (!(root instanceof TransformNode)) continue;
      if (wood.maxSlope !== undefined) root.position.y = Math.min(ground,
        landHeight(x - .010, z), landHeight(x + .010, z),
        landHeight(x, z - .010), landHeight(x, z + .010)) + .001;
      if (name === "pine") { root.scaling.x *= 0.52; root.scaling.z *= 0.52; }
      if (name === "cypress") { root.scaling.x *= 0.83; root.scaling.z *= 0.83; }
      root.metadata = { ...root.metadata, region: "france", woodland: wood.id };
      for (const mesh of root.getChildMeshes()) mesh.metadata = {
        ...mesh.metadata, region: "france", woodland: wood.id,
      };
      planted.push({ x, z });
    }
    woodlandCounts[wood.id] = planted.length;
  }
  // The reference's two compact woods replace dispersed generic trees here.
  // Authored polygons define the masses; no vegetation grid covers the city.
  for (const [index, area] of PARIS_TERRAIN_AREAS.filter(
    (area) => area.kind === "wood",
  ).entries()) {
    let accepted = 0;
    for (let candidate = 0; candidate < 700 && accepted < 68; candidate++) {
      const x = mix(
          area.minX,
          area.maxX,
          hash(candidate + 819, index * 53 + 7),
        ),
        z = mix(area.minZ, area.maxZ, hash(candidate + 937, index * 71 + 19));
      if (
        !parisPolygonContains(area.polygon, x, z) ||
        parisAreaAt(x, z)?.kind !== "wood" ||
        !landContains(x, z) ||
        nearbyRiver(x, z) ||
        parisStreetClearance(x, z) < 0.025
      )
        continue;
      const variant = hash(candidate * 13, index + 401);
      const name = variant > 0.21 ? "pine" : "cypress";
      const root = plant(
        name,
        x,
        z,
        0.21 + variant * 0.075,
        variant * Math.PI * 2,
      );
      if (root instanceof TransformNode) {
        root.scaling.x *= name === "pine" ? 0.52 : 0.83;
        root.scaling.z *= name === "pine" ? 0.52 : 0.83;
        root.metadata = {
          ...root.metadata,
          region: "paris",
          woodland: area.id,
        };
        for (const mesh of root.getChildMeshes())
          mesh.metadata = { ...mesh.metadata, region: "paris", woodland: area.id };
      }
      accepted++;
    }
  }
  // Local affleurements add real silhouettes to the integrated mountain faces;
  // they follow their normal and stay separate from the continuous survey.
  const rockSpacing = 0.12;
  for (
    let ix = Math.floor(sourceBounds.minX / rockSpacing);
    ix * rockSpacing < sourceBounds.maxX;
    ix++
  ) {
    for (
      let iz = Math.floor(sourceBounds.minZ / rockSpacing);
      iz * rockSpacing < sourceBounds.maxZ;
      iz++
    ) {
      const { x, z } = mapAuthoredPosition((ix + (hash(ix + 37, iz) - 0.5) * 0.7) * rockSpacing,
        (iz + (hash(ix, iz + 49) - 0.5) * 0.7) * rockSpacing);
      if (
        !landContains(x, z) ||
        urbanClearance(x, z) < 0.07 ||
        nearbyRiver(x, z)
      )
        continue;
      const y = landHeight(x, z),
        variant = hash(ix * 17, iz * 7);
      if (y < 0.49 || y > 1.15 || variant < 0.47 || mountainFaceBand(x, z) >= 100000) continue;
      const slope =
        Math.hypot(
          landHeight(x + 0.035, z) - landHeight(x - 0.035, z),
          landHeight(x, z + 0.035) - landHeight(x, z - 0.035),
        ) / 0.07;
      if (slope < 0.78) continue;
      plant("rock", x, z, 0.035 + variant * 0.043, variant * Math.PI * 2);
    }
  }
  for (const [index, point] of orchards.entries()) {
    if (
      urbanClearance(point.x, point.z) < 0.01 ||
      nearbyRiver(point.x, point.z)
    )
      continue;
    plant(
      "orchard",
      point.x,
      point.z,
      0.085 + hash(index, 52) * 0.023,
      hash(index, 8) * Math.PI * 2,
    );
  }
  forestRoot.metadata = { treeCount, rockCount, authoredVegetation: true, woodlandCounts };
  return meshes;
}

function curvedPath(points: Point[]) {
  const result: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)],
      b = points[i];
    const c = points[i + 1],
      d = points[Math.min(points.length - 1, i + 2)];
    const count = Math.ceil(Math.hypot(c.x - b.x, c.z - b.z) / 0.018);
    for (let step = 0; step < count; step++) {
      const t = step / count,
        t2 = t * t,
        t3 = t2 * t;
      const axis = (key: "x" | "z") =>
        0.5 *
        (2 * b[key] +
          (-a[key] + c[key]) * t +
          (2 * a[key] - 5 * b[key] + 4 * c[key] - d[key]) * t2 +
          (-a[key] + 3 * b[key] - 3 * c[key] + d[key]) * t3);
      result.push({ x: axis("x"), z: axis("z") });
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

function buildRivers(scene: Scene, meshes: Mesh[]) {
  const banks = geometry(), water = geometry();
  const bankColor = Color3.FromHexString("#C5B790"),
    deepWater = Color3.FromHexString("#185B82"),
    shallowWater = Color3.FromHexString("#35859F");
  const quad = (
    data: Geometry,
    points: Array<{ x: number; y: number; z: number }>,
    color: Color3,
    tones?: Color3[],
    uvs?: number[][],
  ) => {
    const start = data.positions.length / 3;
    for (const [i, point] of points.entries()) {
      vertex(data, point.x, point.y, point.z, tones?.[i] ?? color);
      if (uvs) {
        data.uvs[(start + i) * 2] = uvs[i][0];
        data.uvs[(start + i) * 2 + 1] = uvs[i][1];
      }
    }
    const winding =
      (points[1].x - points[0].x) * (points[2].z - points[0].z) -
      (points[1].z - points[0].z) * (points[2].x - points[0].x);
    triangle(data, start, start + (winding > 0 ? 1 : 2), start + (winding > 0 ? 2 : 1));
    triangle(data, start, start + (winding > 0 ? 2 : 3), start + (winding > 0 ? 3 : 2));
  };
  for (const river of riverPaths) {
    const sections = riverSections[river.index].map(({ center, nx, nz, width, bank, distance }) => {
      const waterY = Math.max(
        landHeight(center.x, center.z) + 0.031,
        landHeight(center.x - nx * width / 2, center.z - nz * width / 2) + 0.010,
        landHeight(center.x + nx * width / 2, center.z + nz * width / 2) + 0.010,
      );
      const point = (side: number, outer: boolean) => {
        const offset = width / 2 + (outer ? bank : 0);
        const x = center.x + nx * side * offset, z = center.z + nz * side * offset;
        return { x, z, y: outer ? landHeight(x, z) + 0.007 : waterY + 0.001 };
      };
      return { center, distance, left: point(-1, false), right: point(1, false),
        leftBank: point(-1, true), rightBank: point(1, true), waterY };
    });
    for (let i = 1; i < sections.length; i++) {
      const a = sections[i - 1], b = sections[i];
      if (!landContains(a.center.x, a.center.z) || !landContains(b.center.x, b.center.z)) continue;
      const across = (section: typeof a, t: number) => ({
        x: mix(section.left.x, section.right.x, t),
        y: section.waterY,
        z: mix(section.left.z, section.right.z, t),
      });
      const currentTone = (section: typeof a, across: number) => {
        const edge = Math.pow(Math.abs(across * 2 - 1), 2.8),
          reflection = .025 + .045 * noise(section.center.x * 2.1 + 8, section.center.z * 3.2 + 11);
        return Color3.Lerp(deepWater, shallowWater, edge * .82 + reflection);
      };
      // Three connected strips share the same wet outline as riverContains.
      // The dark channel and lighter shallows show depth without a flat blue fill.
      const crossSections = [0, .23, .77, 1];
      for (let band = 1; band < crossSections.length; band++) {
        const left = crossSections[band - 1], right = crossSections[band];
        quad(water, [across(a, left), across(b, left), across(b, right), across(a, right)], deepWater,
          [currentTone(a, left), currentTone(b, left), currentTone(b, right), currentTone(a, right)],
          [[left, a.distance * .72], [left, b.distance * .72],
            [right, b.distance * .72], [right, a.distance * .72]]);
      }
      const tone = river.index === 0
        ? Color3.Lerp(bankColor, Color3.FromHexString("#BCB797"), parisRiverWeight(a.center.x, a.center.z))
        : bankColor;
      const bankOuter = (point: { x: number; z: number }) => Color3.Lerp(tone, terrainColor(point.x, point.z), .48),
        bankWet = Color3.Lerp(tone, Color3.FromHexString("#576B66"), .46);
      quad(banks, [a.leftBank, b.leftBank, b.left, a.left], tone,
        [bankOuter(a.leftBank), bankOuter(b.leftBank), bankWet, bankWet]);
      quad(banks, [a.right, b.right, b.rightBank, a.rightBank], tone,
        [bankWet, bankWet, bankOuter(b.rightBank), bankOuter(a.rightBank)]);
    }
  }
  const bankSurface = material(scene, "landscape-riverbanks", "#FFFFFF");
  bankSurface.backFaceCulling = false;
  const waterSurface = material(scene, "landscape-riverwater", "#FFFFFF");
  waterSurface.specularColor = new Color3(.28, .36, .38);
  waterSurface.specularPower = 96;
  waterSurface.ambientColor = new Color3(.06, .08, .10);
  meshes.push(finish(scene, "landscape-riverbanks", banks, bankSurface, false));
  meshes.push(finish(scene, "landscape-rivers", water, waterSurface, false));
}

/** Static, deterministic local geometry. No remote textures or scene-state effects. */
export async function buildLandscape(
  scene: Scene,
): Promise<{ meshes: AbstractMesh[] }> {
  const meshes: Mesh[] = [], colorTargets: AlpineColorTarget[] = [];
  const textures = landMaterialTextures(scene);
  buildGround(scene, meshes, textures, colorTargets);
  const orchards = buildFields(scene, meshes, textures);
  buildRivers(scene, meshes);
  const trees = await buildForests(scene, orchards);
  if (!scene.isDisposed) {
    seatTreesOnRenderedGround(trees, meshes);
    recolorAlpineGround(scene, meshes, colorTargets, alpineOccupiedCover(trees, meshes));
  }
  colorTargets.length = 0;
  return { meshes: [...meshes, ...trees] };
}
