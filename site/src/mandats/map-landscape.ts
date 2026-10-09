import { MODEL_URLS } from "./map-model-revisions.ts";
import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import Delaunator from "delaunator";
import { FRANCE_OUTLINES } from "./map-geography.ts";
import { MAP_PLACES, mapPosition, mapCoordinates, mapSourcePosition, mapAuthoredPosition, mapAuthoredCoordinates, mapAuthoredJacobian } from "./map-state.ts";
import { landMaterialTextures } from "./map-land-materials.ts";
import type { LandMaterialTextures } from "./map-land-materials.ts";
import { mountainSourceHeight, mountainBaselineSourceHeight, mountainFaceBand, mountainBreakLines, mountainFaceSurvey } from "./map-land-crags.ts";
import { NATIONAL_FIELDS, VALLEY_FIELDS, NATIONAL_WOODS, MOUNTAIN_WOODS, CENTRAL_WOODS, CENTRAL_FIELD_EDGES } from "./map-land-composition.ts";
import { NATIONAL_SETTLEMENTS } from "./map-city-national.ts";
import {
  cityEnvelopeFootprints,
  urbanFootprint,
  RURAL_SETTLEMENTS,
  AUTHORED_PROJECT_RESERVATIONS,
} from "./map-urban-plans.ts";
import { loadAssetKit } from "./map-asset-kit.ts";
import { surveyHarbour, harbourPolygonsOverlap } from "./map-city-port-plans.ts";
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
const surveyedFootprints = cityEnvelopeFootprints().map((footprint) => ({
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
const range = (coords: number[][]) =>
  coords.map(([lon, lat]) => mapPosition(lon, lat));
const rivers = [
  // Curved geographic paths, not straight city-to-city links.
  {
    width: 0.055,
    points: range([
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
    points: range([
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
    points: range([
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
    points: range([
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
    points: range([
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
  path: curvedPath(river.points),
}));
function riverSurveyWidth(
  river: (typeof riverPaths)[number],
  x: number,
  z: number,
  mouth: number,
) {
  if (river.index !== 0) return river.width;
  const multiplier = 0.57 + mouth * 0.58;
  return (
    river.width + (0.075 / multiplier - river.width) * parisRiverWeight(x, z)
  );
}
const riverCells = new Map<
  string,
  Array<{ a: Point; b: Point; width: number; mouth: number; seine: boolean }>
>();
for (const river of riverPaths) {
  for (let i = 1; i < river.path.length; i++) {
    const a = river.path[i - 1],
      b = river.path[i];
    const mouth = i / river.path.length;
    const segment = {
      a,
      b,
      width: riverSurveyWidth(river, (a.x + b.x) / 2, (a.z + b.z) / 2, mouth),
      mouth,
      seine: river.index === 0,
    };
    for (
      let x = Math.floor((Math.min(a.x, b.x) - 0.13) / 0.25);
      x <= Math.floor((Math.max(a.x, b.x) + 0.13) / 0.25);
      x++
    ) {
      for (
        let z = Math.floor((Math.min(a.z, b.z) - 0.13) / 0.25);
        z <= Math.floor((Math.max(a.z, b.z) + 0.13) / 0.25);
        z++
      ) {
        const key = `${x}:${z}`;
        const cell = riverCells.get(key) ?? [];
        cell.push(segment);
        riverCells.set(key, cell);
      }
    }
  }
}

function contains(polygon: Point[], x: number, z: number) {
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
  { x: PARIS_ORIGIN.x + .075, z: PARIS_ORIGIN.z + .375,
    halfW: 1.925, halfD: 1.725, rotation: 0, cosine: 1, sine: 0 },
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

function cultivatedRelief(x: number, z: number, sx: number, sz: number, mineral: number) {
  if (mineral > .21 || borderDistance(sx, sz) < .09) return 0;
  let clearance = Infinity;
  for (const footprint of lowlandProtectionCells.get(`${Math.floor(x / .50)}:${Math.floor(z / .50)}`) ?? []) {
    const dx = x - footprint.x, dz = z - footprint.z,
      px = Math.abs(dx * footprint.cosine + dz * footprint.sine) - footprint.halfW,
      pz = Math.abs(-dx * footprint.sine + dz * footprint.cosine) - footprint.halfD;
    clearance = Math.min(clearance, Math.hypot(Math.max(0, px), Math.max(0, pz)) + Math.min(0, Math.max(px, pz)));
  }
  if (clearance < .065 || riverContains(x, z, .055)) return 0;
  const protectedBlend = smooth(clamp((clearance - .065) / .32)),
    coastalBlend = smooth(clamp((borderDistance(sx, sz) - .09) / .18)),
    mineralBlend = 1 - smooth(clamp((mineral - .07) / .14));
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
        segment.width * (.57 + segment.mouth * .58) / 2;
      riverDistance = Math.min(riverDistance, distance);
      if (distance > .055 && distance < .30) valley = Math.max(valley,
        .045 * Math.sin(Math.PI * clamp((distance - .055) / .245)));
    }
  // A broad valley floor separates the river's unchanged banks from the
  // shoulders. Its outer terraces carry the very same crop and road meshes.
  const riverBlend = smooth(clamp((riverDistance - .13) / .22));
  return ((shoulder * riverBlend - valley) * mineralBlend +
    centralCultivatedRelief(sx, sz) * riverBlend) * protectedBlend * coastalBlend;
}

function unflattenedHeight(x: number, z: number) {
  const source = mapAuthoredCoordinates(x, z), sx = source.x, sz = source.z;
  // A single surface joins the valleys, wooded foothills and authored crests.
  const rolling =
    noise(sx * 1.18 + 27, sz * 1.34 + 6) * 0.024 +
    noise(sx * 4.7 + 11, sz * 4.1 + 19) * 0.009;
  const armorican = hill(sx, sz, -3.1, 1.55, 1.4, 0.65) * 0.026;
  const vosges = hill(sx, sz, 3.12, 1.54, 0.3, 0.7) * 0.14;
  const shoulder = smooth(clamp(borderDistance(sx, sz) / 0.3));
  const baseline = mountainBaselineSourceHeight(sx, sz);
  let mineralHeight = baseline;
  if (baseline > .30 && borderDistance(sx, sz) > .065 && !riverContains(x, z, .16)) {
    const inhabitedDistance = urbanClearance(x, z);
    const highGround = smooth(clamp((baseline - .30) / .18)),
      inhabitedMargin = smooth(clamp((inhabitedDistance - .08) / .12)),
      borderMargin = smooth(clamp((borderDistance(sx, sz) - .065) / .105));
    if (inhabitedMargin > 0) mineralHeight = mix(baseline, mountainSourceHeight(sx, sz),
      highGround * inhabitedMargin * borderMargin);
  }
  // The miniature has a thin rock rim. A watershed must descend through real
  // foothills before this edge instead of being sliced into a full-height wall.
  return (
    0.115 + rolling + armorican + (vosges + mineralHeight) * shoulder +
    cultivatedRelief(x, z, sx, sz, baseline)
  );
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

function surveyedHeight(x: number, z: number) {
  let height = unflattenedHeight(x, z),
    strongest = 0,
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
      level = localFootprintLevels.get(footprint) ?? settlementLevels.get(footprint.settlement) ?? height;
    }
  }
  // Streets soften the local grade; a village cannot erase a whole watershed
  // or drag its mountain slope into a tall flat terrace at the border.
  height = mix(height, clamp(level, height - 0.065, height + 0.065), strongest);
  const segments =
    riverCells.get(`${Math.floor(x / 0.25)}:${Math.floor(z / 0.25)}`) ?? [];
  let influence = 0,
    mouth = 0;
  for (const segment of segments) {
    const distance = segmentDistance(x, z, segment.a, segment.b);
    const oldCarve =
      1 -
      smooth(clamp((distance - segment.width * 0.28) / (segment.width * 0.85)));
    const physicalWidth = segment.width * (0.57 + segment.mouth * 0.58);
    const bankCarve =
      1 - smooth(clamp((distance - physicalWidth * 0.4) / 0.028));
    const carve = mix(
      oldCarve,
      bankCarve,
      segment.seine ? parisRiverWeight(x, z) : 0,
    );
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

function terrainColor(x: number, z: number, face?: ReturnType<typeof mountainFaceSurvey>) {
  const source = mapAuthoredCoordinates(x, z), sx = source.x, sz = source.z;
  const y = landHeight(x, z),
    grain = noise(sx * 3.9 + 8, sz * 4.1 + 44);
  const area = parisAreaAt(x, z);
  if (area) {
    const palette = {
      urban: "#B5AF91",
      court: "#C8BDA3",
      square: "#C9BFA8",
      garden: "#91A05A",
      field: "#C9B66F",
      wood: "#4A613E",
    };
    return Color3.FromHexString(palette[area.kind]).scale(0.93 + grain * 0.1);
  }
  if (nationalBlockAt(x, z)) return Color3.FromHexString("#C7B994").scale(0.94 + grain * 0.08);
  const southern = clamp((-sz - 1.0) / 3.0);
  let color = colorMix(
    Color3.FromHexString(parisSector(x, z) ? "#B5AF64" : "#C4B25E"),
    Color3.FromHexString(parisSector(x, z) ? "#9AA453" : "#A8A353"),
    grain,
  );
  color = colorMix(color, Color3.FromHexString("#C9AD70"), southern * 0.48);
  const forest = forestAmount(x, z);
  color = colorMix(
    color,
    Color3.FromHexString(parisSector(x, z) ? "#536C3B" : "#4E5934"),
    clamp((forest - 0.58) / 0.34) * 0.62,
  );
  const left = landHeight(x - 0.035, z),
    right = landHeight(x + 0.035, z),
    front = landHeight(x, z - 0.035),
    back = landHeight(x, z + 0.035);
  const slope = face?.slope ?? Math.hypot(right - left, back - front) / 0.07;
  const stratum =
    (y + sx * 0.055 + sz * 0.028 + noise(sx * 1.9 + 3, sz * 2.2 + 8) * 0.023) /
    0.047;
  const layer = Math.floor(stratum),
    fraction = stratum - layer;
  const discontinuity = clamp((0.13 - Math.min(fraction, 1 - fraction)) * 7);
  let mineral = colorMix(
    Color3.FromHexString("#707A81"),
    Color3.FromHexString("#BCBFBA"),
    face ? 0.16 + hash(face.band, 37) * 0.72 : noise(sx * 19 + 15, sz * 23 + 32) * 0.64 + hash(layer, 37) * 0.36,
  );
  if (face) mineral = colorMix(mineral, Color3.FromHexString("#C1B9A6"),
    hash(face.band, 113) * .26);
  const alpine = sx > 1.8 && sx < 3.8 && sz > -3.2 && sz < 0.35;
  const pyrenean = sx > -3.2 && sx < 0.7 && sz > -5.9 && sz < -3.2;
  const woodedTalus = clamp((0.59 - y) / 0.25) * clamp((forest - 0.64) * 3.2);
  const rockAmount =
    clamp((y - 0.34) * 2.9 + (slope - 0.48) * 0.68) * (1 - woodedTalus * 0.62);
  color = colorMix(color, mineral, rockAmount);
  // Broken, tilted strata belong to mineral faces, not to grass or the snow.
  const joint =
    discontinuity * clamp((noise(sx * 6.1 + 12, sz * 4.9 + 3) - 0.24) * 2);
  color = colorMix(
    color,
    Color3.FromHexString("#4C5A65"),
    joint * rockAmount * 0.74,
  );
  const occlusion = clamp((left + right + front + back - y * 4) * 2.7);
  color = color.scale(1 - occlusion * 0.26);
  const couloir = noise(sx * 16.1 + sz * 2.1 + 9, sz * 5.9 - sx * 2.8 + 17);
  const snowline = (alpine ? 0.43 : pyrenean ? 0.42 : 0.66) +
    noise(sx * 7.1, sz * 9.3) * (alpine || pyrenean ? 0.04 : 0.1);
  const highSnow = clamp((y - snowline) / 0.12);
  // Snow collects on inclined shelves and at the very highest tips. Steep
  // walls keep their mineral faces instead of becoming broad white curtains.
  const exposedCut = clamp((slope - .45) / 1.20) * (0.68 + joint * .22),
    shelf = 1 - smooth(clamp((slope - .20) / 1.25)),
    crestCap = clamp((y - .66) / .16),
    snowShelf = face ? .035 + shelf * .90 : .96,
    couloirCover = .60 + clamp((couloir - .35) / .36) * .40,
    snow = highSnow * Math.max(snowShelf * couloirCover * (1 - exposedCut * .35),
      crestCap * .96);
  return colorMix(color, Color3.FromHexString("#FFFFFF"), snow);
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

function buildGround(
  scene: Scene,
  meshes: Mesh[],
  textures: LandMaterialTextures,
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
  cliffMaterial.bumpTexture = textures.stoneNormal;
  const stone = Color3.FromHexString("#D7CCB6");
  const rock = Color3.FromHexString("#ADA997");
  const pale = Color3.FromHexString("#F2E8D2");
  for (const [part, outline] of outlines.entries()) {
    const sourceOutline = sourceOutlines[part],
      coast = densify(sourceOutline, 0.035).map(point => mapAuthoredPosition(point.x, point.z));
    const points: Array<[number, number]> = coast.map(({ x, z }) => [x, z]);
    const minX = Math.min(...sourceOutline.map(({ x }) => x));
    const maxX = Math.max(...sourceOutline.map(({ x }) => x));
    const minZ = Math.min(...sourceOutline.map(({ z }) => z));
    const maxZ = Math.max(...sourceOutline.map(({ z }) => z));
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
        const surveyWidth = riverSurveyWidth(
          river,
          p.x,
          p.z,
          i / river.path.length,
        );
        for (const side of [-0.85, -0.48, 0, 0.48, 0.85]) {
          const x = p.x + nx * surveyWidth * side,
            z = p.z + nz * surveyWidth * side;
          if (contains(outline, x, z)) points.push([x, z]);
        }
      }
    const terrain = geometry(), mineralTerrain = geometry();
    for (const [x, z] of points)
      vertex(terrain, x, landHeight(x, z), z, terrainColor(x, z));
    const triangles = Delaunator.from(points).triangles;
    const rockVertices = new Map<string, number>(),
      rockAxes = new Map<number, "x" | "y" | "z">();
    for (let i = 0; i < triangles.length; i += 3) {
      const a = triangles[i],
        b = triangles[i + 1],
        c = triangles[i + 2];
      const p = points[a],
        q = points[b],
        r = points[c];
      if (
        !contains(outline, (p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3)
      )
        continue;
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
        (centerY > 0.33 && slope > 0.83)) {
        const band = faceBand;
        let axis = rockAxes.get(band);
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
          rockAxes.set(band, axis);
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
            survey ? terrainColor(terrain.positions[position], terrain.positions[position + 2], survey) :
              new Color3(terrain.colors[tone], terrain.colors[tone + 1], terrain.colors[tone + 2]),
          );
          // One mapping per surveyed geological face keeps its tiny render
          // triangles continuous. Vertical walls retain their height in UVs.
          const source = mapAuthoredCoordinates(terrain.positions[position],
            terrain.positions[position + 2]);
          mineralTerrain.uvs[separate * 2] = (axis === "x" ? source.z : source.x) * 2.9;
          mineralTerrain.uvs[separate * 2 + 1] = (axis === "y" ? source.z :
            terrain.positions[position + 1]) * 2.9;
          rockVertices.set(key, separate);
          return separate;
        });
        triangle(mineralTerrain, corners[0], corners[1], corners[2]);
      } else triangle(terrain, face[0], face[1], face[2]);
    }
    meshes.push(finish(scene, `landscape-terrain-${part}`, terrain, surface));
    if (mineralTerrain.indices.length) meshes.push(finish(scene,
      `landscape-terrain-mineral-${part}`, mineralTerrain, mineralSurface));
    const cliffs = geometry(), cliffFaceGroups: string[] = [];
    const cliffLayers = 6;
    for (let i = 0; i <= coast.length; i++) {
      const p = coast[i % coast.length];
      const previous = coast[(i + coast.length - 1) % coast.length];
      const next = coast[(i + 1) % coast.length];
      const length = Math.hypot(next.x - previous.x, next.z - previous.z) || 1;
      const nx = (next.z - previous.z) / length,
        nz = -(next.x - previous.x) / length;
      const top = landHeight(p.x, p.z);
      const shelf = hash(Math.floor(i / 9) + 241, 63),
        notch = hash(Math.floor(i / 4) + 337, 19);
      const levels = [0, .12 + shelf * .11, .34 + notch * .10, .52 + shelf * .10,
        .69 + notch * .12, .86 + shelf * .08, 1];
      for (let layer = 0; layer <= cliffLayers; layer++) {
        const t = levels[layer];
        const jag =
          (hash(Math.floor(i / 2) + 43, layer * 19) - 0.45) *
          0.041 *
          Math.sin(t * Math.PI) +
          (layer > 0 && layer < cliffLayers ?
            (hash(Math.floor(i / 5) + 91, layer * 31) - .36) * .025 : 0);
        const y = mix(top, -0.105 - hash(Math.floor(i / 5), 71) * 0.024, t);
        const shade = hash(Math.floor(i / 3), layer * 23);
        let color = colorMix(stone, rock, shade * 0.6);
        if ((layer + Math.floor(i / 7)) % 4 === 1) color = colorMix(color, pale, 0.51);
        color = color.scale(0.96 + Math.sin(t * Math.PI) * 0.07);
        if (layer === 0) color = colorMix(color, terrainColor(p.x, p.z), 0.30);
        const cliffVertex = vertex(
          cliffs,
          p.x + nx * jag,
          y,
          p.z + nz * jag,
          color,
        );
        cliffs.uvs[cliffVertex * 2] = (i / coast.length) * 20;
        cliffs.uvs[cliffVertex * 2 + 1] = t * 2;
        if (i > 0 && layer > 0) {
          const d = i * (cliffLayers + 1) + layer;
          const a = d - cliffLayers - 2,
            b = d - cliffLayers - 1,
            c = d - 1;
          triangle(cliffs, a, c, b);
          triangle(cliffs, c, d, b);
          const group = `${Math.floor(i / 3)}:${Math.floor((layer - 1) / 2)}`;
          cliffFaceGroups.push(group, group);
        }
      }
    }
    const sculptedRim = geometry(), rimVertices = new Map<string, number>();
    for (let face = 0; face < cliffs.indices.length / 3; face++) {
      const corners = cliffs.indices.slice(face * 3, face * 3 + 3).map(original => {
        const key = `${original}:${cliffFaceGroups[face]}`, saved = rimVertices.get(key);
        if (saved !== undefined) return saved;
        const p = original * 3, c = original * 4,
          index = vertex(sculptedRim, cliffs.positions[p], cliffs.positions[p + 1], cliffs.positions[p + 2],
            new Color3(cliffs.colors[c], cliffs.colors[c + 1], cliffs.colors[c + 2]));
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

function cropRows(
  data: Geometry,
  polygon: Point[],
  center: Point,
  theta: number,
  spacing: number,
  color: Color3,
  lift = 0.017,
  available?: (x: number, z: number) => boolean,
) {
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
  const pasture = ["#8D9E54", "#799143", "#A3A361", "#839B4E"];
  const wheat = ["#C9B373", "#B8A05B", "#D3BE7A", "#A69C57"];
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
        color = Color3.FromHexString("#91A156");
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
      color = Color3.FromHexString(field.color), start = crops.indices.length,
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
      field.kind === "vines" ? 0.027 : 0.022, color.scale(field.kind === "vines" ? 0.59 : 0.68),
      0.008, (x, z) => available(x, z, 0.012));
    for (const edge of field.hedgedEdges ?? []) {
      let run: Point[] = [];
      const flush = () => { if (run.length > 1) hedge(hedges, run, 0.019); run = []; };
      for (const point of densify([polygon[edge], polygon[(edge + 1) % polygon.length]], 0.035, false)) {
        if (!available(point.x, point.z, 0.021)) { flush(); continue; }
        run.push(point);
      }
      flush();
    }
    if (field.infill && fieldIndex % 5 === 0) {
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
  const composedGold = ["#D1BA69", "#CAB575", "#B8A164"];
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
  cropMaterial.diffuseTexture = textures.earth;
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

export function riverContains(x: number, z: number, margin = 0): boolean {
  const cellX = Math.floor(x / 0.25),
    cellZ = Math.floor(z / 0.25);
  const radius = Math.ceil(Math.max(0, margin) / 0.25);
  for (let dx = -radius; dx <= radius; dx++)
    for (let dz = -radius; dz <= radius; dz++) {
      const segments = riverCells.get(`${cellX + dx}:${cellZ + dz}`) ?? [];
      if (
        segments.some(
          (segment) =>
            segmentDistance(x, z, segment.a, segment.b) <
            (segment.width * (0.57 + segment.mouth * 0.58)) / 2 + margin,
        )
      )
        return true;
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
        (wood.id.startsWith("bosquet-") && constructionReservationContains(x, z, .035)) ||
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
  const banks = geometry(),
    water = geometry();
  const bankColor = Color3.FromHexString("#AFA06B"),
    waterColor = Color3.FromHexString("#348EB4");
  const quad = (
    data: Geometry,
    points: Array<{ x: number; y: number; z: number }>,
    color: Color3,
    tones?: Color3[],
  ) => {
    const start = data.positions.length / 3;
    for (const [i, point] of points.entries()) vertex(data, point.x, point.y, point.z, tones?.[i] ?? color);
    const winding =
      (points[1].x - points[0].x) * (points[2].z - points[0].z) -
      (points[1].z - points[0].z) * (points[2].x - points[0].x);
    triangle(
      data,
      start,
      start + (winding > 0 ? 1 : 2),
      start + (winding > 0 ? 2 : 1),
    );
    triangle(
      data,
      start,
      start + (winding > 0 ? 2 : 3),
      start + (winding > 0 ? 3 : 2),
    );
  };
  for (const river of riverPaths) {
    const sections = river.path.map((center, i) => {
      const a = river.path[Math.max(0, i - 1)],
        b = river.path[Math.min(river.path.length - 1, i + 1)];
      const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const nx = (b.z - a.z) / length,
        nz = -(b.x - a.x) / length;
      const width =
        riverSurveyWidth(river, center.x, center.z, i / river.path.length) *
        (0.57 + (i / river.path.length) * 0.58);
      // On a steep upstream valley the opposite bed edge can sit above the
      // centre. Survey both edges so its continuous water ribbon stays exposed.
      const waterY = Math.max(
        landHeight(center.x, center.z) + 0.031,
        landHeight(center.x - nx * width / 2, center.z - nz * width / 2) + 0.010,
        landHeight(center.x + nx * width / 2, center.z + nz * width / 2) + 0.010,
      );
      const point = (side: number, outer: boolean) => {
        const distance =
          width / 2 +
          (outer ? 0.009 + parisRiverWeight(center.x, center.z) * 0.007 : 0);
        const x = center.x + nx * side * distance,
          z = center.z + nz * side * distance;
        return { x, z, y: outer ? landHeight(x, z) + 0.007 : waterY + 0.001 };
      };
      return {
        center,
        left: point(-1, false),
        right: point(1, false),
        leftBank: point(-1, true),
        rightBank: point(1, true),
        waterY,
      };
    });
    for (let i = 1; i < sections.length; i++) {
      const a = sections[i - 1],
        b = sections[i];
      if (
        !landContains(a.center.x, a.center.z) ||
        !landContains(b.center.x, b.center.z)
      )
        continue;
      quad(
        water,
        [
          { ...a.left, y: a.waterY },
          { ...b.left, y: b.waterY },
          { ...b.right, y: b.waterY },
          { ...a.right, y: a.waterY },
        ],
        waterColor,
      );
      // Banks are separate strips. A filled, raised bank quad would hide the water.
      const tone =
        river.index === 0
          ? Color3.Lerp(
              bankColor,
              Color3.FromHexString("#9EA16D"),
              parisRiverWeight(a.center.x, a.center.z),
            )
          : bankColor;
      const bankOuter = (point: { x: number; z: number }) => Color3.Lerp(tone, terrainColor(point.x, point.z), .72),
        bankWet = tone.scale(.87);
      quad(banks, [a.leftBank, b.leftBank, b.left, a.left], tone,
        [bankOuter(a.leftBank), bankOuter(b.leftBank), bankWet, bankWet]);
      quad(banks, [a.right, b.right, b.rightBank, a.rightBank], tone,
        [bankWet, bankWet, bankOuter(b.rightBank), bankOuter(a.rightBank)]);
    }
  }
  const bankSurface = material(scene, "landscape-riverbanks", "#FFFFFF");
  bankSurface.backFaceCulling = false;
  const waterSurface = material(scene, "landscape-riverwater", "#FFFFFF");
  waterSurface.specularColor = new Color3(0.22, 0.35, 0.36);
  waterSurface.specularPower = 72;
  meshes.push(finish(scene, "landscape-riverbanks", banks, bankSurface, false));
  meshes.push(finish(scene, "landscape-rivers", water, waterSurface, false));
}

/** Static, deterministic local geometry. No remote textures or scene-state effects. */
export async function buildLandscape(
  scene: Scene,
): Promise<{ meshes: AbstractMesh[] }> {
  const meshes: Mesh[] = [];
  const textures = landMaterialTextures(scene);
  buildGround(scene, meshes, textures);
  const orchards = buildFields(scene, meshes, textures);
  buildRivers(scene, meshes);
  const trees = await buildForests(scene, orchards);
  return { meshes: [...meshes, ...trees] };
}
