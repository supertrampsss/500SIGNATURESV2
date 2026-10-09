import { mapSourcePosition as mapPosition, mapAuthoredPosition, mapAuthoredCoordinates } from "./map-state.ts";
import Delaunator from "delaunator";

type SculptedPoint = readonly [number, number, number];
type SculptedMassif = { boundary: readonly SculptedPoint[]; points: readonly SculptedPoint[] };

// Surveyed rock planes, with high shoulders, split arêtes and low valley heads.
// These heights form one triangulated ground surface, never stacked peak meshes.
const sculptedMassifs: readonly SculptedMassif[] = [
  {
    boundary: [[5.02,46.35,0],[6.18,46.38,0],[6.88,46.03,0],[7.18,45.44,0],
      [7.58,44.45,0],[7.18,43.63,0],[6.50,43.54,0],[5.54,44.05,0],[4.98,44.65,0],[4.91,45.42,0]],
    points: [
      // Northern cirques and divided white shoulders.
      [5.42,46.08,.12],[5.76,46.14,.28],[6.07,46.16,.48],[6.30,46.08,.67],
      [6.42,45.97,.80],[6.59,46.04,.47],[6.73,45.91,.30],[6.12,45.92,.58],
      [5.75,45.90,.30],[5.42,45.83,.12],[6.33,45.79,.44],[6.55,45.80,.62],
      [6.73,45.69,.26],[6.09,45.75,.36],[5.72,45.69,.25],[5.34,45.62,.08],
      // Vanoise branches: a broad ledge crosses the crest; the col cuts its end.
      [6.37,45.57,.76],[6.56,45.51,.60],[6.11,45.54,.52],[5.84,45.50,.36],
      [5.44,45.40,.13],[6.29,45.38,.34],[6.56,45.31,.38],[6.75,45.36,.18],
      [5.98,45.30,.25],[5.68,45.21,.17],[5.22,45.15,.04],
      // Écrins: two intersecting ridges, split into buttresses rather than a wall.
      [5.92,45.10,.79],[6.12,45.07,.62],[6.31,45.15,.56],[6.45,45.04,.71],
      [6.67,45.09,.31],[5.64,45.06,.45],[5.40,44.94,.16],[5.94,44.90,.47],
      [6.24,44.92,.31],[6.51,44.88,.46],[6.72,44.85,.22],[5.74,44.83,.30],
      [5.56,44.73,.14],[6.15,44.71,.73],[6.36,44.69,.54],[6.57,44.66,.62],
      [6.83,44.61,.28],[5.92,44.65,.52],[5.74,44.48,.25],[6.20,44.53,.35],
      [6.47,44.49,.29],[6.74,44.46,.45],[6.97,44.48,.16],
      // Southern mineral spurs turn outward above the wooded valleys.
      [6.41,44.32,.64],[6.63,44.27,.50],[6.86,44.29,.58],[7.06,44.20,.27],
      [6.08,44.34,.34],[5.91,44.26,.14],[6.40,44.10,.31],[6.74,44.04,.44],
      [6.99,43.98,.53],[7.12,43.86,.22],[6.53,43.88,.19],[6.20,44.03,.11],
      // Short rock breaks sit within those large faces at a second scale.
      [6.23,46.01,.64],[6.19,45.97,.43],[6.48,45.91,.63],[6.53,45.88,.39],
      [6.25,45.57,.59],[6.21,45.54,.39],[6.51,45.60,.59],[6.57,45.63,.41],
      [5.80,45.11,.57],[5.77,45.08,.38],[6.20,45.12,.64],[6.23,45.09,.44],
      [6.04,44.72,.64],[6.00,44.68,.39],[6.44,44.72,.60],[6.48,44.75,.40],
      [6.55,44.34,.53],[6.59,44.37,.36],[6.79,44.12,.46],[6.84,44.15,.31],
      // Paired crest shoulders and recessed couloirs give each buttress a
      // broad inclined roof, a broken front and a low saddle between groups.
      [6.30,46.02,.75],[6.35,45.98,.77],[6.38,45.92,.59],
      [6.14,46.00,.51],[6.13,45.94,.30],[5.98,45.96,.40],
      [6.53,45.97,.48],[6.56,45.94,.28],[6.66,45.86,.24],
      [6.34,45.59,.73],[6.40,45.51,.70],[6.44,45.48,.43],
      [6.16,45.62,.52],[6.11,45.60,.31],[6.13,45.45,.29],
      [6.29,45.44,.23],[6.62,45.45,.29],[6.61,45.57,.48],
      [5.86,45.13,.72],[5.96,45.05,.74],[5.85,45.02,.50],
      [5.79,44.99,.26],[6.07,45.01,.43],[6.18,45.00,.26],
      [6.38,45.04,.66],[6.46,44.98,.64],[6.40,44.92,.36],
      [6.08,44.75,.67],[6.17,44.65,.64],[6.13,44.60,.33],
      [5.88,44.69,.45],[5.86,44.63,.27],[6.32,44.62,.30],
      [6.54,44.63,.56],[6.60,44.59,.48],[6.59,44.55,.25],
      [6.36,44.36,.58],[6.44,44.25,.57],[6.38,44.20,.31],
      [6.18,44.27,.26],[6.74,44.28,.50],[6.76,44.23,.28],
      [6.95,44.04,.49],[7.03,43.96,.46],[6.97,43.91,.27],
    ],
  },
  {
    boundary: [[-1.68,43.34,0],[-.92,43.63,0],[.08,43.57,0],[1.10,43.48,0],
      [2.28,43.31,0],[2.82,42.76,0],[2.53,42.22,0],[1.43,42.30,0],[.22,42.39,0],[-.88,42.57,0]],
    points: [
      // Lower Atlantic end and three separated, wider white cirques.
      [-1.23,43.21,.10],[-.94,43.14,.17],[-.63,43.31,.22],[-.62,42.95,.25],
      [-.27,43.28,.29],[-.18,43.06,.57],[-.10,42.91,.70],[.11,42.88,.47],
      [.18,43.17,.24],[.36,43.28,.18],[.50,43.05,.43],[.67,42.86,.77],
      [.83,42.77,.49],[.94,43.04,.35],[1.05,43.25,.18],[1.28,43.14,.29],
      [1.44,42.85,.65],[1.61,42.72,.58],[1.81,42.70,.38],[1.92,43.02,.24],
      [2.08,42.85,.36],[2.22,42.62,.42],[2.43,42.73,.23],[2.51,42.99,.09],
      // Branching northern valleys and tilted shelves below each crest.
      [-.49,43.18,.17],[-.40,43.03,.35],[-.13,43.18,.40],[.09,43.05,.28],
      [.37,42.96,.30],[.53,43.15,.27],[.71,43.11,.41],[.96,42.88,.24],
      [1.19,42.88,.29],[1.36,43.04,.37],[1.68,43.01,.25],[1.80,42.86,.29],
      [2.10,42.66,.25],[2.34,42.90,.15],
      // Small fractured ledges belong to the shared survey, not loose cones.
      [-.21,42.98,.54],[-.25,42.96,.34],[.58,42.91,.60],[.54,42.88,.37],
      [.78,42.92,.52],[.83,42.95,.34],[1.47,42.94,.49],[1.42,42.97,.31],
      [1.69,42.81,.46],[1.73,42.84,.29],[2.17,42.74,.35],[2.21,42.77,.21],
      // Short tilted shoulders, deep valley mouths and jagged rock aprons.
      [-.25,42.91,.64],[-.05,42.93,.65],[-.01,42.98,.42],
      [-.32,43.00,.40],[-.36,43.04,.24],[-.15,43.11,.31],
      [.16,42.94,.37],[.23,42.99,.20],[.28,43.07,.16],
      [.56,42.85,.68],[.72,42.84,.72],[.76,42.89,.50],
      [.65,42.96,.42],[.62,43.01,.25],[.42,43.04,.22],
      [.88,42.95,.28],[1.04,42.99,.18],[1.15,43.04,.17],
      [1.38,42.88,.59],[1.48,42.80,.60],[1.54,42.86,.53],
      [1.32,42.95,.38],[1.28,43.00,.22],[1.50,43.03,.21],
      [1.64,42.90,.36],[1.64,42.95,.20],[1.80,42.96,.18],
      [2.01,42.83,.30],[2.06,42.90,.21],[2.20,42.78,.33],
      [2.31,42.70,.33],[2.34,42.75,.18],
    ],
  },
];

type RockTriangle = { x: number[]; z: number[]; h: number[]; inverse: number; band: number; slope: number; normalX: number; normalZ: number };
const rockCells = new Map<string, RockTriangle[]>();
const baselineRockCells = new Map<string, RockTriangle[]>();
const rockEdges: Array<{ a: { x: number; z: number }; b: { x: number; z: number } }> = [];
// Each cirque replaces a broad primary tip with a branched ridge: unequal
// summits in front/behind one another, recessed cols and a low valley mouth.
// These are control points of the ground itself, not decorative peak objects.
const dividedCirques = [
  { part: 0, lon: 6.34, lat: 45.98, height: .80, angle: -.32, reach: 1.00 },
  { part: 0, lon: 6.36, lat: 45.55, height: .76, angle: .34, reach: .91 },
  { part: 0, lon: 5.92, lat: 45.08, height: .79, angle: -.49, reach: 1.08 },
  { part: 0, lon: 6.43, lat: 45.02, height: .71, angle: .48, reach: .91 },
  { part: 0, lon: 6.13, lat: 44.70, height: .73, angle: -.20, reach: 1.02 },
  { part: 0, lon: 6.55, lat: 44.63, height: .62, angle: .41, reach: .86 },
  { part: 0, lon: 6.42, lat: 44.29, height: .64, angle: -.38, reach: .94 },
  { part: 0, lon: 6.87, lat: 44.25, height: .58, angle: .52, reach: .89 },
  { part: 0, lon: 6.98, lat: 43.98, height: .53, angle: -.16, reach: .82 },
  { part: 1, lon: -.11, lat: 42.96, height: .70, angle: -.26, reach: 1.07 },
  { part: 1, lon: .66, lat: 42.88, height: .77, angle: .31, reach: 1.09 },
  { part: 1, lon: 1.46, lat: 42.85, height: .65, angle: -.34, reach: 1.08 },
].map(cirque => ({ ...cirque, ...mapPosition(cirque.lon, cirque.lat) }));

function dividedVertices(massif: SculptedMassif, part: number) {
  const localCirques = dividedCirques.filter(cirque => cirque.part === part);
  const vertices = [...massif.boundary, ...massif.points].map(([lon, lat, height]) => ({ ...mapPosition(lon, lat), height }))
    .filter(point => point.height < .32 || !localCirques.some(cirque =>
      Math.hypot((point.x - cirque.x) / (cirque.reach * .19),
        (point.z - cirque.z) / (cirque.reach * .21)) < 1));
  for (const [index, cirque] of localCirques.entries()) {
    const dx = Math.cos(cirque.angle), dz = Math.sin(cirque.angle), nx = -dz, nz = dx,
      alternate = index % 2 === 0 ? 1 : -1;
    const points = [
      // Connected crest arms have four different tips, not a radial fan.
      [-.060,.095,1.00], [.084,.048,.79], [.056,-.103,.87], [-.109,-.059,.68],
      // Deepened cols and a bent central ridge interrupt the skyline.
      [-.014,.038,.66], [.046,-.025,.57], [-.062,-.024,.51],
      // Rock shoulders extend into two open cirques and a narrow spur.
      [-.144,.108,.59], [.148,.071,.50], [.111,-.135,.39],
      [-.160,-.106,.31], [-.021,-.164,.30], [.171,-.044,.28],
      [-.100,.169,.52], [.032,.161,.46],
    ];
    for (const [u, v, relativeHeight] of points) vertices.push({
      x: cirque.x + cirque.reach * (dx * u + nx * v * alternate),
      z: cirque.z + cirque.reach * (dz * u + nz * v * alternate),
      height: cirque.height * relativeHeight,
    });
  }
  return vertices;
}

function indexRockFace(index: Map<string, RockTriangle[]>, triangle: RockTriangle) {
  for (let ix = Math.floor(Math.min(...triangle.x) / .24); ix <= Math.floor(Math.max(...triangle.x) / .24); ix++)
    for (let iz = Math.floor(Math.min(...triangle.z) / .24); iz <= Math.floor(Math.max(...triangle.z) / .24); iz++) {
      const key = `${ix}:${iz}`, cell = index.get(key) ?? [];
      cell.push(triangle); index.set(key, cell);
    }
}

function fracturedRockFace(triangle: RockTriangle) {
  if (triangle.band !== 100228 && triangle.band !== 100384) return [triangle];
  const top = triangle.h.indexOf(Math.max(...triangle.h)),
    left = (top + 1) % 3, right = (top + 2) % 3;
  const points = triangle.x.map((x, i) => ({ x, z: triangle.z[i], height: triangle.h[i] }));
  // Two existing Vanoise flanks receive shallow, irregular bedding cuts.
  // Every old corner and boundary height stays on its original plane. The
  // inset scarps and inclined shelves are part of the ground, never loose rocks.
  const rows = [
    [.24, 0], [.28, -.031], [.36, -.006],
    [.48, -.002], [.54, -.040], [.62, -.007],
    [.70, 0], [.76, -.036], [.84, 0],
  ];
  const columns = [0, .12, .38, .66, .88, 1],
    bends = [0, .006, -.009, .008, -.004, 0],
    depth = [0, .62, 1, .90, .52, 0],
    depthScale = triangle.band === 100228 ? 1.24 : 1;
  for (const [row, [distance, inset]] of rows.entries()) {
    for (const [column, across] of columns.entries()) {
      const along = distance + bends[column] * (row % 3 === 1 ? 1 : .55),
        weights = [1 - along, along * (1 - across), along * across],
        ids = [top, left, right];
      const value = (values: number[]) => weights.reduce((sum, weight, i) => sum + weight * values[ids[i]], 0);
      points.push({ x: value(triangle.x), z: value(triangle.z),
        height: value(triangle.h) + inset * depth[column] * depthScale });
    }
  }
  // Divide the unchanged lower edge too: one long peripheral triangle would
  // otherwise remain beneath the inset cuts. These samples add no relief.
  for (const across of [.12, .38, .66, .88]) {
    const value = (values: number[]) => values[left] * (1 - across) + values[right] * across;
    points.push({ x: value(triangle.x), z: value(triangle.z), height: value(triangle.h) });
  }
  const faces = Delaunator.from(points, point => point.x, point => point.z).triangles,
    result: RockTriangle[] = [], edges = new Set<string>();
  for (let face = 0; face < faces.length; face += 3) {
    const ids = Array.from(faces.slice(face, face + 3)), corners = ids.map(id => points[id]),
      x = corners.map(point => point.x), z = corners.map(point => point.z),
      h = corners.map(point => point.height),
      denominator = (z[1] - z[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (z[0] - z[2]);
    if (Math.abs(denominator) < 1e-12) continue;
    const gx = ((h[1] - h[0]) * (z[2] - z[0]) - (h[2] - h[0]) * (z[1] - z[0])) / denominator,
      gz = ((x[1] - x[0]) * (h[2] - h[0]) - (x[2] - x[0]) * (h[1] - h[0])) / denominator,
      length = Math.hypot(gx, 1, gz);
    result.push({ x, z, h, inverse: 1 / denominator,
      band: 200000 + (triangle.band - 100000) * 128 + face / 3,
      slope: Math.hypot(gx, gz), normalX: -gx / length, normalZ: -gz / length });
    for (let edge = 0; edge < 3; edge++) {
      const a = ids[edge], b = ids[(edge + 1) % 3], key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      if (edges.has(key)) continue;
      edges.add(key); rockEdges.push({ a: points[a], b: points[b] });
    }
  }
  return result;
}

for (const [part, massif] of sculptedMassifs.entries()) {
  const baseline = [...massif.boundary, ...massif.points].map(([lon, lat, height]) => ({ ...mapPosition(lon, lat), height }));
  const baselineFaces = Delaunator.from(baseline, point => point.x, point => point.z).triangles;
  for (let face = 0; face < baselineFaces.length; face += 3) {
    const points = Array.from(baselineFaces.slice(face, face + 3)).map(id => baseline[id]),
      x = points.map(point => point.x), z = points.map(point => point.z), h = points.map(point => point.height),
      denominator = (z[1] - z[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (z[0] - z[2]);
    if (Math.abs(denominator) < 1e-9) continue;
    indexRockFace(baselineRockCells, { x, z, h, inverse: 1 / denominator,
      band: 100000 + part * 10000 + face, slope: 0, normalX: 0, normalZ: 0 });
  }
  const vertices = dividedVertices(massif, part);
  const faces = Delaunator.from(vertices, point => point.x, point => point.z).triangles;
  const edges = new Set<string>();
  for (let face = 0; face < faces.length; face += 3) {
    const ids = Array.from(faces.slice(face, face + 3)), points = ids.map(id => vertices[id]);
    const x = points.map(point => point.x), z = points.map(point => point.z);
    const denominator = (z[1] - z[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (z[0] - z[2]);
    if (Math.abs(denominator) < 1e-9) continue;
    const h = points.map(point => point.height),
      gx = ((h[1] - h[0]) * (z[2] - z[0]) - (h[2] - h[0]) * (z[1] - z[0])) / denominator,
      gz = ((x[1] - x[0]) * (h[2] - h[0]) - (x[2] - x[0]) * (h[1] - h[0])) / denominator,
      length = Math.hypot(gx, 1, gz);
    const triangle: RockTriangle = { x, z, h, inverse: 1 / denominator,
      band: 100000 + part * 10000 + face, slope: Math.hypot(gx, gz), normalX: -gx / length, normalZ: -gz / length };
    for (const face of fracturedRockFace(triangle)) indexRockFace(rockCells, face);
    for (let edge = 0; edge < 3; edge++) {
      const a = ids[edge], b = ids[(edge + 1) % 3], key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      if (edges.has(key)) continue;
      edges.add(key); rockEdges.push({ a: vertices[a], b: vertices[b] });
    }
  }
}
function sculptedAt(x: number, z: number, index = rockCells) {
  for (const triangle of index.get(`${Math.floor(x / .24)}:${Math.floor(z / .24)}`) ?? []) {
    const a = ((triangle.z[1] - triangle.z[2]) * (x - triangle.x[2]) + (triangle.x[2] - triangle.x[1]) * (z - triangle.z[2])) * triangle.inverse;
    const b = ((triangle.z[2] - triangle.z[0]) * (x - triangle.x[2]) + (triangle.x[0] - triangle.x[2]) * (z - triangle.z[2])) * triangle.inverse;
    const c = 1 - a - b;
    if (a >= -1e-7 && b >= -1e-7 && c >= -1e-7)
      return { height: a * triangle.h[0] + b * triangle.h[1] + c * triangle.h[2],
        band: triangle.band, slope: triangle.slope, normalX: triangle.normalX, normalZ: triangle.normalZ };
  }
  return undefined;
}

/** Break-line samples let the render mesh follow the same geological faces. */
const projectedRockEdges = rockEdges.map(edge => ({ a: mapAuthoredPosition(edge.a.x, edge.a.z), b: mapAuthoredPosition(edge.b.x, edge.b.z) }));
export function mountainBreakLines() { return projectedRockEdges; }
/** The actual inclined rock plane also controls its mineral and snow cover. */
export function mountainFaceSurvey(x: number, z: number) {
  const source = mapAuthoredCoordinates(x, z);
  return sculptedAt(source.x, source.z);
}

/**
 * Authored ridge networks, expressed in geographic coordinates. Each line is a
 * connected watershed with shoulders, a changing crest and lateral branches.
 * It participates in the surveyed ground itself; no separate peaks sit on it.
 */
type RidgePoint = readonly [number, number, number];
type Ridge = { width: number; points: readonly RidgePoint[] };
const networks: readonly Ridge[] = [
  // Mont-Blanc, Vanoise, Écrins and Mercantour. Their offshoots point toward
  // valleys rather than forming parallel rows of individual cones.
  {
    width: 0.40,
    points: [
      [6.82, 45.87, 1.02],
      [6.54, 45.63, 0.61],
      [6.67, 45.42, 0.96],
      [6.53, 45.19, 0.59],
      [6.3, 44.98, 1.08],
      [6.48, 44.75, 0.58],
      [6.73, 44.48, 0.73],
      [7.02, 44.28, 0.74],
      [7.18, 44.09, 0.59],
    ],
  },
  {
    width: 0.34,
    points: [
      [6.54, 45.63, 0.72],
      [6.13, 45.75, 0.59],
      [5.96, 45.52, 0.36],
      [5.72, 45.4, 0.17],
    ],
  },
  {
    width: 0.36,
    points: [
      [6.3, 44.98, 0.93],
      [6.04, 45.2, 0.69],
      [5.85, 45.05, 0.42],
      [5.64, 44.83, 0.23],
    ],
  },
  {
    width: 0.30,
    points: [
      [6.3, 44.98, 0.88],
      [6.17, 44.64, 0.68],
      [5.89, 44.54, 0.44],
      [5.69, 44.35, 0.16],
    ],
  },
  {
    width: 0.29,
    points: [
      [6.73, 44.48, 0.74],
      [6.41, 44.36, 0.55],
      [6.18, 44.15, 0.37],
      [6.04, 43.93, 0.15],
    ],
  },
  {
    width: 0.19,
    points: [
      [6.82, 45.87, 1.0],
      [6.67, 46.08, 0.73],
      [6.46, 46.14, 0.34],
    ],
  },
  {
    width: 0.19,
    points: [
      [6.67, 45.42, 0.87],
      [6.91, 45.36, 0.62],
      [7.01, 45.24, 0.34],
    ],
  },
  // Pyrenean watershed and foothills separated by real broad passes.
  {
    width: 0.24,
    points: [
      [-1.58, 43.12, 0.10],
      [-1.14, 43.03, 0.18],
      [-0.67, 42.93, 0.36],
      [-0.18, 42.88, 0.84],
      [0.25, 42.83, 0.56],
      [0.61, 42.77, 0.97],
      [1.0, 42.71, 0.54],
      [1.52, 42.66, 0.85],
      [1.91, 42.58, 0.52],
      [2.33, 42.48, 0.45],
      [2.58, 42.43, 0.18],
    ],
  },
  {
    width: 0.16,
    points: [
      [-0.18, 42.88, 0.68],
      [0.0, 43.15, 0.42],
      [0.32, 43.22, 0.21],
    ],
  },
  {
    width: 0.15,
    points: [
      [0.61, 42.77, 0.78],
      [0.92, 42.98, 0.41],
      [1.23, 43.1, 0.16],
    ],
  },
  {
    width: 0.14,
    points: [
      [1.52, 42.66, 0.67],
      [1.71, 42.89, 0.38],
      [2.03, 42.94, 0.15],
    ],
  },
  // Jura has rounded limestone crests, not Alpine needles.
  {
    width: 0.21,
    points: [
      [5.78, 46.18, 0.19],
      [6.02, 46.4, 0.34],
      [6.25, 46.6, 0.43],
      [6.46, 46.86, 0.37],
      [6.78, 47.15, 0.28],
      [7.07, 47.42, 0.19],
    ],
  },
  // The central range branches around the Limagne valley.
  {
    width: 0.27,
    points: [
      [2.83, 45.79, 0.39],
      [2.85, 45.52, 0.43],
      [2.72, 45.24, 0.37],
      [2.61, 44.97, 0.3],
      [2.77, 44.7, 0.23],
    ],
  },
  {
    width: 0.25,
    points: [
      [3.52, 45.58, 0.31],
      [3.69, 45.25, 0.34],
      [3.67, 44.98, 0.3],
      [3.98, 44.64, 0.26],
    ],
  },
  {
    width: 0.27,
    points: [
      [3.67, 44.98, 0.3],
      [3.23, 44.78, 0.31],
      [2.9, 44.62, 0.27],
    ],
  },
  // Corsican spine, lower coastal shoulders.
  {
    width: 0.18,
    points: [
      [9.04, 42.65, 0.3],
      [8.96, 42.46, 0.53],
      [9.1, 42.3, 0.62],
      [9.04, 42.09, 0.45],
      [9.14, 41.83, 0.26],
    ],
  },
  {
    width: 0.13,
    points: [
      [8.96, 42.46, 0.49],
      [8.8, 42.3, 0.27],
      [8.73, 42.13, 0.12],
    ],
  },
];

type Segment = {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  ah: number;
  bh: number;
  width: number;
  length2: number;
  seed: number;
};
const cells = new Map<string, Segment[]>();
for (const [network, ridge] of networks.entries()) {
  if (network < 11) continue;
  for (let i = 1; i < ridge.points.length; i++) {
    const a = ridge.points[i - 1],
      b = ridge.points[i];
    const shiftLon = network < 7 ? -0.38 : 0;
    const p = mapPosition(a[0] + shiftLon, a[1]),
      q = mapPosition(b[0] + shiftLon, b[1]);
    const segment = {
      ax: p.x,
      az: p.z,
      bx: q.x,
      bz: q.z,
      ah: a[2] * (network >= 12 && network <= 14 ? 0.42 : 1),
      bh: b[2] * (network >= 12 && network <= 14 ? 0.42 : 1),
      width: ridge.width * (network >= 12 && network <= 14 ? 1.24 : 1),
      length2: (q.x - p.x) ** 2 + (q.z - p.z) ** 2,
      seed: network * 23 + i * 13,
    };
    const reach = ridge.width * 3;
    for (
      let x = Math.floor((Math.min(p.x, q.x) - reach) / 0.4);
      x <= Math.floor((Math.max(p.x, q.x) + reach) / 0.4);
      x++
    ) {
      for (
        let z = Math.floor((Math.min(p.z, q.z) - reach) / 0.4);
        z <= Math.floor((Math.max(p.z, q.z) + reach) / 0.4);
        z++
      ) {
        const key = `${x}:${z}`,
          cell = cells.get(key) ?? [];
        cell.push(segment);
        cells.set(key, cell);
      }
    }
  }
}
type DrainageSegment = {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  length2: number;
  depth: number;
  width: number;
};
const drainageCells = new Map<string, DrainageSegment[]>();
const drainages: Array<{
  depth: number;
  width: number;
  shiftLon?: number;
  shiftLat?: number;
  points: number[][];
}> = [
  {
    depth: 0.26,
    width: 0.076,
    points: [
      [6.73, 45.72],
      [6.38, 45.64],
      [6.08, 45.7],
      [5.92, 45.64],
    ],
  },
  {
    depth: 0.29,
    width: 0.088,
    points: [
      [6.64, 45.41],
      [6.33, 45.38],
      [6.03, 45.43],
      [5.86, 45.42],
    ],
  },
  {
    depth: 0.23,
    width: 0.069,
    points: [
      [6.29, 45.14],
      [6.03, 45.09],
      [5.81, 45.07],
      [5.67, 45.12],
    ],
  },
  {
    depth: 0.25,
    width: 0.082,
    points: [
      [6.53, 44.84],
      [6.34, 44.67],
      [6.23, 44.43],
      [6.07, 44.3],
    ],
  },
  {
    depth: 0.18,
    width: 0.061,
    points: [
      [6.72, 44.55],
      [6.52, 44.51],
      [6.35, 44.42],
      [6.2, 44.29],
    ],
  },
  // Broad northern valleys interrupt the Pyrenean faces before the low rim.
  {
    depth: 0.17,
    width: 0.087,
    shiftLon: 0,
    shiftLat: 0,
    points: [
      [-1.1, 43.07],
      [-1.12, 43.24],
      [-1.45, 43.43],
    ],
  },
  {
    depth: 0.22,
    width: 0.095,
    shiftLon: 0,
    shiftLat: 0,
    points: [
      [-0.15, 42.9],
      [-0.22, 43.1],
      [-0.55, 43.37],
    ],
  },
  {
    depth: 0.24,
    width: 0.09,
    shiftLon: 0,
    shiftLat: 0,
    points: [
      [0.65, 42.79],
      [0.72, 43.0],
      [0.9, 43.17],
    ],
  },
  {
    depth: 0.21,
    width: 0.1,
    shiftLon: 0,
    shiftLat: 0,
    points: [
      [1.53, 42.69],
      [1.34, 42.97],
      [1.15, 43.22],
    ],
  },
];
for (const drainage of drainages)
  for (let i = 1; i < drainage.points.length; i++) {
    const a = drainage.points[i - 1],
      b = drainage.points[i],
      p = mapPosition(
        a[0] + (drainage.shiftLon ?? -0.38),
        a[1] + (drainage.shiftLat ?? 0),
      ),
      q = mapPosition(
        b[0] + (drainage.shiftLon ?? -0.38),
        b[1] + (drainage.shiftLat ?? 0),
      );
    const segment = {
      ax: p.x,
      az: p.z,
      bx: q.x,
      bz: q.z,
      length2: (q.x - p.x) ** 2 + (q.z - p.z) ** 2,
      depth: drainage.depth,
      width: drainage.width,
    };
    const reach = drainage.width * 2.5;
    for (
      let x = Math.floor((Math.min(p.x, q.x) - reach) / 0.4);
      x <= Math.floor((Math.max(p.x, q.x) + reach) / 0.4);
      x++
    ) {
      for (
        let z = Math.floor((Math.min(p.z, q.z) - reach) / 0.4);
        z <= Math.floor((Math.max(p.z, q.z) + reach) / 0.4);
        z++
      ) {
        const key = `${x}:${z}`,
          cell = drainageCells.get(key) ?? [];
        cell.push(segment);
        drainageCells.set(key, cell);
      }
    }
  }

const clamp = (n: number) => Math.max(0, Math.min(1, n));

// Wide summit shoulders lead into broken faces. A narrow cap at each surveyed
// waypoint produced a necklace of needles rather than a connected massif.
const sectionDistances = [0, 0.10, 0.35, 0.52, 0.72, 1.15, 1.70];
const sectionHeights = [1, 0.85, 0.70, 0.58, 0.28, 0.12, 0];
function sectionAt(distance: number) {
  for (let band = 1; band < sectionDistances.length; band++) {
    if (distance > sectionDistances[band]) continue;
    const t =
      (distance - sectionDistances[band - 1]) /
      (sectionDistances[band] - sectionDistances[band - 1]);
    return {
      height:
        sectionHeights[band - 1] +
        (sectionHeights[band] - sectionHeights[band - 1]) * t,
      band,
    };
  }
  return { height: 0, band: 0 };
}
function ridgeSection(segment: Segment, x: number, z: number) {
  const dx = segment.bx - segment.ax,
    dz = segment.bz - segment.az;
  const along = ((x - segment.ax) * dx + (z - segment.az) * dz) / segment.length2,
    t = clamp(along),
    length = Math.sqrt(segment.length2);
  const side = (x - segment.ax) * dz - (z - segment.az) * dx;
  const width = segment.width * (side < 0 ? 0.78 : 1.22);
  // Linear section planes and diamond end buttresses meet along real ridges.
  // Euclidean end caps and noisy width modulation had produced smooth domes.
  const transverse = Math.abs(side) / length,
    end = Math.max(0, -along, along - 1) * length,
    normalized = (transverse + end * 0.85) / width;
  return { t, distance: normalized, side, section: sectionAt(normalized) };
}

/** A stable smoothing band preserves actual rock breaks in the terrain mesh. */
export function mountainFaceBand(x: number, z: number) {
  const source = mapAuthoredCoordinates(x, z); x = source.x; z = source.z;
  const sculpted = sculptedAt(x, z);
  if (sculpted) return sculpted.band;
  let strongest = 0,
    band = 0;
  for (const segment of cells.get(
    `${Math.floor(x / 0.4)}:${Math.floor(z / 0.4)}`,
  ) ?? []) {
    const sample = ridgeSection(segment, x, z);
    const strength =
      sample.section.height *
      (segment.ah + (segment.bh - segment.ah) * sample.t);
    if (strength > strongest) {
      strongest = strength;
      band =
        segment.seed * 32 +
        sample.section.band * 2 +
        (sample.side < 0 ? 0 : 1) +
        1;
    }
  }
  return band;
}

export function mountainHeight(x: number, z: number) {
  const source = mapAuthoredCoordinates(x, z);
  return mountainSourceHeight(source.x, source.z);
}

/** Sampling grids already in the authored frame avoid a redundant inverse. */
export function mountainSourceHeight(x: number, z: number) {
  const sculpted = sculptedAt(x, z);
  if (sculpted) return sculpted.height;
  const local =
    cells.get(`${Math.floor(x / 0.4)}:${Math.floor(z / 0.4)}`) ?? [];
  let crest = 0,
    shoulder = 0;
  for (const segment of local) {
    const sample = ridgeSection(segment, x, z),
      t = sample.t;
    const elevation = segment.ah + (segment.bh - segment.ah) * t;
    // The authored low waypoints are the cols; no repeating sinusoidal passes.
    const peak = sample.section.height * elevation;
    crest = Math.max(crest, peak);
    shoulder = Math.max(
      shoulder,
      Math.max(0, 1 - sample.distance / 2.35) * elevation * 0.20,
    );
  }
  const elevation = crest * 0.94 + shoulder;
  let valley = 0;
  for (const segment of drainageCells.get(
    `${Math.floor(x / 0.4)}:${Math.floor(z / 0.4)}`,
  ) ?? []) {
    const dx = segment.bx - segment.ax,
      dz = segment.bz - segment.az;
    const t = clamp(
      ((x - segment.ax) * dx + (z - segment.az) * dz) / segment.length2,
    );
    const distance = Math.hypot(
      x - segment.ax - dx * t,
      z - segment.az - dz * t,
    );
    const carve = Math.max(0, 1 - distance / segment.width) * segment.depth;
    valley = Math.max(valley, carve);
  }
  // Drainage divides the shoulders into connected faces and cols rather than
  // isolated rounded cones, while leaving a continuous valley floor.
  return (
    elevation - Math.min(elevation * 0.43, valley * clamp(elevation / 0.6))
  );
}

/** Exact previous survey for inhabited lowland and protected ground corridors. */
export function mountainBaselineSourceHeight(x: number, z: number) {
  return sculptedAt(x, z, baselineRockCells)?.height ?? mountainSourceHeight(x, z);
}

/** Signed clearance from the mineral zone; vegetation can fill lower valleys. */
export function cragClearance(x: number, z: number) {
  return 0.64 - mountainHeight(x, z);
}
