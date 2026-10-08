import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import Delaunator from "delaunator";
import { FRANCE_OUTLINES } from "./map-geography.ts";
import { MAP_PLACES, mapPosition } from "./map-state.ts";

type Point = { x: number; z: number };
type Geometry = {
  positions: number[];
  indices: number[];
  colors: number[];
  uvs: number[];
};

const outlines = FRANCE_OUTLINES.map((outline) =>
  outline.slice(0, -1).map(([lon, lat]) => mapPosition(lon, lat)),
);
const cities = Object.values(MAP_PLACES).map(({ lon, lat }) =>
  mapPosition(lon, lat),
);
const smallSettlements = [
  [-4.49, 48.39], [-1.62, 49.64], [-3.83, 48.58], [-1.15, 46.16],
  [0.69, 47.39], [1.91, 47.9], [4.03, 49.26], [6.18, 49.12],
  [5.04, 47.32], [6.02, 47.24], [6.13, 45.9], [3.08, 45.78],
  [1.26, 45.83], [1.53, 45.16], [0.62, 44.2], [-0.37, 43.3],
  [2.89, 42.7], [7.26, 43.7],
].map(([lon, lat]) => mapPosition(lon, lat));
const bounds = {
  minX: Math.min(...outlines.flat().map(({ x }) => x)),
  maxX: Math.max(...outlines.flat().map(({ x }) => x)),
  minZ: Math.min(...outlines.flat().map(({ z }) => z)),
  maxZ: Math.max(...outlines.flat().map(({ z }) => z)),
};
const range = (coords: number[][]) =>
  coords.map(([lon, lat]) => mapPosition(lon, lat));
const alps = range([
  [6.5, 46.25], [6.8, 45.7], [6.5, 45.1], [6.4, 44.5], [7.15, 44.05],
]);
const pyrenees = range([
  [-1.8, 43.2], [-0.6, 42.95], [0.5, 42.78], [1.55, 42.65], [2.5, 42.43],
]);
const corsica = range([[8.97, 42.65], [9.12, 42.3], [9.05, 41.75]]);
const jura = range([[6.15, 46.6], [6.55, 47.0], [7.03, 47.45]]);
const rivers = [
  // Curved geographic paths, not straight city-to-city links.
  { width: 0.026, points: range([[4.0, 47.8], [3.5, 48.35], [2.4, 48.82], [1.8, 49.03], [1.42, 49.28], [1.1, 49.44], [0.82, 49.46], [0.52, 49.44], [0.2, 49.45]]) },
  { width: 0.029, points: range([[4.05, 44.85], [3.9, 45.45], [3.15, 46.4], [2.7, 47.15], [2.45, 47.68], [1.9, 47.88], [1.48, 47.58], [0.75, 47.39], [-0.35, 47.4], [-1.15, 47.34], [-1.55, 47.22], [-2.1, 47.27]]) },
  { width: 0.026, points: range([[0.6, 42.85], [0.95, 43.1], [1.45, 43.6], [1.28, 44.02], [0.65, 44.3], [-0.03, 44.57], [-0.57, 44.84], [-0.67, 45.03], [-0.85, 45.35], [-1.08, 45.57]]) },
  { width: 0.027, points: range([[5.83, 46.13], [5.45, 45.95], [4.86, 45.78], [4.78, 45.31], [4.87, 44.92], [4.74, 44.5], [4.67, 44.05], [4.75, 43.68], [4.67, 43.4]]) },
  { width: 0.016, points: range([[2.8, 45.5], [2.3, 45.28], [1.4, 45.0], [0.85, 44.86], [0.12, 44.86], [-0.45, 44.98]]) },
];

function contains(polygon: Point[], x: number, z: number) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.z > z) !== (b.z > z) &&
        x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) hit = !hit;
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
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
function noise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const tx = smooth(x - ix), tz = smooth(z - iz);
  return mix(
    mix(hash(ix, iz), hash(ix + 1, iz), tx),
    mix(hash(ix, iz + 1), hash(ix + 1, iz + 1), tx), tz,
  );
}

function segmentDistance(x: number, z: number, a: Point, b: Point) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz));
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}

function ridgeDistance(x: number, z: number, points: Point[]) {
  let distance = Infinity;
  for (let i = 1; i < points.length; i++) {
    distance = Math.min(distance, segmentDistance(x, z, points[i - 1], points[i]));
  }
  return distance;
}

function hill(x: number, z: number, cx: number, cz: number, sx: number, sz: number) {
  return Math.exp(-(((x - cx) / sx) ** 2 + ((z - cz) / sz) ** 2));
}

function unflattenedHeight(x: number, z: number) {
  // Ridged noise gives narrow crests and valleys; no isolated smooth cones.
  const ridge = 1 - Math.abs(noise(x * 5.2 + 19, z * 5.2 + 7) * 2 - 1);
  const detail = noise(x * 14.5 + 2, z * 14.5 + 51);
  const rough = 0.44 + ridge ** 1.8 * 0.47 + detail * 0.15;
  const alpine = Math.exp(-((ridgeDistance(x, z, alps) / 0.6) ** 2)) * 1.06;
  const pyrenean = Math.exp(-((ridgeDistance(x, z, pyrenees) / 0.32) ** 2)) * 0.7;
  const island = Math.exp(-((ridgeDistance(x, z, corsica) / 0.29) ** 2)) * 0.62;
  const jurassic = Math.exp(-((ridgeDistance(x, z, jura) / 0.26) ** 2)) * 0.28;
  const massif = hill(x, z, 0.47, -1.22, 1.03, 1.35) * 0.33;
  const vosges = hill(x, z, 3.13, 1.49, 0.32, 0.8) * 0.27;
  const armorican = hill(x, z, -3.08, 1.6, 1.35, 0.67) * 0.08;
  const lowland = 0.024 * noise(x * 3.1 + 31, z * 3.1 + 17) +
    0.017 * noise(x * 9.4, z * 9.4);
  return Math.min(1.28, 0.15 + lowland +
    (alpine + pyrenean + island + jurassic + massif + vosges + armorican) * rough);
}

const cityLevels = cities.map((city) => unflattenedHeight(city.x, city.z));

export function landHeight(x: number, z: number): number {
  let height = unflattenedHeight(x, z);
  // All buildings and moving actors share this same surveyed plateau.
  for (let i = 0; i < cities.length; i++) {
    const distance = Math.hypot(x - cities[i].x, z - cities[i].z);
    if (distance < 0.5) {
      const blend = 1 - smooth(clamp((distance - 0.36) / 0.14));
      height = mix(height, cityLevels[i], blend);
    }
  }
  return height;
}

function cityDistance(x: number, z: number) {
  let distance = Infinity;
  for (const city of cities) distance = Math.min(distance, Math.hypot(city.x - x, city.z - z));
  return distance;
}

function smallSettlementDistance(x: number, z: number) {
  let distance = Infinity;
  for (const point of smallSettlements) distance = Math.min(distance, Math.hypot(point.x - x, point.z - z));
  return distance;
}

function geometry(): Geometry {
  return { positions: [], indices: [], colors: [], uvs: [] };
}

function vertex(data: Geometry, x: number, y: number, z: number, color: Color3) {
  const index = data.positions.length / 3;
  data.positions.push(x, y, z);
  data.colors.push(color.r, color.g, color.b, 1);
  data.uvs.push((x - bounds.minX) / (bounds.maxX - bounds.minX),
    (z - bounds.minZ) / (bounds.maxZ - bounds.minZ));
  return index;
}

function triangle(data: Geometry, a: number, b: number, c: number) {
  data.indices.push(a, b, c);
}

function colorMix(a: Color3, b: Color3, amount: number) {
  return Color3.Lerp(a, b, clamp(amount));
}

function terrainColor(x: number, z: number) {
  const y = landHeight(x, z);
  const grain = noise(x * 5.5 + 3, z * 5.5 + 44);
  const north = Color3.FromHexString("#768A60");
  const meadow = Color3.FromHexString("#5C794F");
  const ochre = Color3.FromHexString("#98956C");
  let color = colorMix(north, meadow, grain * 0.75);
  color = colorMix(color, ochre, clamp((-z - 1.1) / 4) * 0.5);
  const slope = Math.hypot(
    landHeight(x + 0.035, z) - landHeight(x - 0.035, z),
    landHeight(x, z + 0.035) - landHeight(x, z - 0.035),
  ) / 0.07;
  const mineral = colorMix(Color3.FromHexString("#73756B"),
    Color3.FromHexString("#A6A48B"), noise(x * 25.7 + 15, z * 25.7 + 32));
  const rockAmount = clamp((y - 0.38) * 1.7 + (slope - 0.48) * 0.52);
  color = colorMix(color, mineral, rockAmount);
  color = color.scale(1 - rockAmount * 0.07 +
    rockAmount * (noise(x * 46.3 + 9, z * 46.3 + 6) - 0.5) * 0.1);
  const snowline = 0.86 + noise(x * 9.1, z * 9.1) * 0.09;
  if (y > snowline) color = colorMix(color, Color3.FromHexString("#DDE5DC"),
    clamp((y - snowline) / 0.14) * clamp(1.25 - slope * 0.4));
  return color;
}

function material(scene: Scene, name: string, hex: string) {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = Color3.FromHexString(hex);
  result.specularColor = new Color3(0.025, 0.029, 0.021);
  result.ambientColor = new Color3(0.16, 0.19, 0.13);
  return result;
}

function finish(scene: Scene, name: string, data: Geometry, surface: StandardMaterial) {
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
  return mesh;
}

function groundTexture(scene: Scene) {
  const texture = new DynamicTexture("land-grain", { width: 512, height: 512 }, scene, true);
  const context = texture.getContext();
  const image = new ImageData(512, 512);
  for (let z = 0; z < 512; z++) for (let x = 0; x < 512; x++) {
    const tone = 200 + hash(x, z) * 35 + noise(x * 0.06, z * 0.06) * 20;
    const index = (z * 512 + x) * 4;
    image.data[index] = tone;
    image.data[index + 1] = tone + 2;
    image.data[index + 2] = tone - 5;
    image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  texture.anisotropicFilteringLevel = 4;
  texture.update(false);
  return texture;
}

function densify(points: Point[], step: number, closed = true) {
  const result: Point[] = [];
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const divisions = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step));
    for (let j = 0; j < divisions; j++) result.push({
      x: mix(a.x, b.x, j / divisions), z: mix(a.z, b.z, j / divisions),
    });
  }
  if (!closed) result.push(points[points.length - 1]);
  return result;
}

function buildGround(scene: Scene, meshes: Mesh[]) {
  const surface = material(scene, "landscape-ground", "#FFFFFF");
  surface.diffuseTexture = groundTexture(scene);
  const cliffMaterial = material(scene, "landscape-cliffs", "#FFFFFF");
  cliffMaterial.backFaceCulling = false;
  const stone = Color3.FromHexString("#A2977E");
  const rock = Color3.FromHexString("#6C7366");
  const pale = Color3.FromHexString("#CBC4A7");
  for (const [part, outline] of outlines.entries()) {
    const coast = densify(outline, 0.065);
    const points: Array<[number, number]> = coast.map(({ x, z }) => [x, z]);
    const minX = Math.min(...outline.map(({ x }) => x));
    const maxX = Math.max(...outline.map(({ x }) => x));
    const minZ = Math.min(...outline.map(({ z }) => z));
    const maxZ = Math.max(...outline.map(({ z }) => z));
    const spacing = 0.085;
    for (let ix = Math.ceil(minX / spacing); ix * spacing < maxX; ix++) {
      for (let iz = Math.ceil(minZ / spacing); iz * spacing < maxZ; iz++) {
        const x = (ix + (hash(ix, iz) - 0.5) * 0.5) * spacing;
        const z = (iz + (hash(ix + 67, iz - 19) - 0.5) * 0.5) * spacing;
        if (contains(outline, x, z)) points.push([x, z]);
      }
    }
    const terrain = geometry();
    for (const [x, z] of points) vertex(terrain, x, landHeight(x, z), z, terrainColor(x, z));
    const triangles = Delaunator.from(points).triangles;
    for (let i = 0; i < triangles.length; i += 3) {
      const a = triangles[i], b = triangles[i + 1], c = triangles[i + 2];
      const p = points[a], q = points[b], r = points[c];
      if (!contains(outline, (p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3)) continue;
      const winding = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
      const face = [a, winding > 0 ? b : c, winding > 0 ? c : b];
      const faceHeight = face.reduce((sum, index) => sum + terrain.positions[index * 3 + 1], 0) / 3;
      if (faceHeight > 0.6) {
        // Keep surveyed positions/UVs; separate only rocky faces so their normals
        // describe a ridge instead of smoothing the whole massif into a dome.
        const separate = face.map((index) => {
          const point = index * 3, tone = index * 4;
          return vertex(terrain, terrain.positions[point], terrain.positions[point + 1],
            terrain.positions[point + 2], new Color3(terrain.colors[tone],
              terrain.colors[tone + 1], terrain.colors[tone + 2]));
        });
        triangle(terrain, separate[0], separate[1], separate[2]);
      } else triangle(terrain, face[0], face[1], face[2]);
    }
    meshes.push(finish(scene, `landscape-terrain-${part}`, terrain, surface));
    const cliffs = geometry();
    const cliffLayers = 7;
    for (let i = 0; i <= coast.length; i++) {
      const p = coast[i % coast.length];
      const previous = coast[(i + coast.length - 1) % coast.length];
      const next = coast[(i + 1) % coast.length];
      const length = Math.hypot(next.x - previous.x, next.z - previous.z) || 1;
      const nx = (next.z - previous.z) / length, nz = -(next.x - previous.x) / length;
      const top = landHeight(p.x, p.z);
      for (let layer = 0; layer <= cliffLayers; layer++) {
        const t = layer / cliffLayers;
        const jag = (hash(i + 43, layer * 19) - 0.4) * 0.035 * Math.sin(t * Math.PI);
        const y = mix(top, -0.19, t);
        const shade = hash(Math.floor(i / 3), layer * 23);
        let color = colorMix(stone, rock, shade * 0.6);
        if (layer === 1 || layer === 4) color = colorMix(color, pale, 0.4);
        if (layer === 0) color = colorMix(color, terrainColor(p.x, p.z), 0.65);
        vertex(cliffs, p.x + nx * jag, y, p.z + nz * jag, color);
        if (i > 0 && layer > 0) {
          const d = i * (cliffLayers + 1) + layer;
          const a = d - cliffLayers - 2, b = d - cliffLayers - 1, c = d - 1;
          triangle(cliffs, a, b, c);
          triangle(cliffs, c, b, d);
        }
      }
    }
    meshes.push(finish(scene, `landscape-cliffs-${part}`, cliffs, cliffMaterial));
  }
}

function forestAmount(x: number, z: number) {
  const landes = hill(x, z, -2.13, -2.11, 0.51, 1.0) * 0.58;
  const ardennes = hill(x, z, 1.54, 3.52, 0.75, 0.55) * 0.55;
  const vosges = hill(x, z, 3.09, 1.51, 0.55, 0.85) * 0.5;
  const massif = hill(x, z, 0.45, -1.05, 0.9, 1.03) * 0.5;
  const alpine = hill(x, z, 2.95, -1.26, 0.62, 1.5) * 0.6;
  return noise(x * 2.9 + 74, z * 2.9 + 22) * 0.58 +
    noise(x * 8.3 + 1, z * 8.3 + 8) * 0.2 +
    Math.max(landes, ardennes, vosges, massif, alpine);
}

function clipHalfPlane(polygon: Point[], a: Point, b: Point) {
  const nx = b.x - a.x, nz = b.z - a.z;
  const boundary = (b.x * b.x + b.z * b.z - a.x * a.x - a.z * a.z) / 2;
  const result: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const dp = p.x * nx + p.z * nz - boundary;
    const dq = q.x * nx + q.z * nz - boundary;
    if (dp <= 0) result.push(p);
    if ((dp <= 0) !== (dq <= 0)) {
      const t = dp / (dp - dq);
      result.push({ x: mix(p.x, q.x, t), z: mix(p.z, q.z, t) });
    }
  }
  return result;
}

function fieldFan(data: Geometry, polygon: Point[], center: Point, color: Color3) {
  // Each irregular parcel follows the terrain, including its interior.
  const middle = vertex(data, center.x, landHeight(center.x, center.z) + 0.012, center.z, color);
  const border = densify(polygon, 0.07).map((p) => ({
    x: mix(p.x, center.x, 0.035), z: mix(p.z, center.z, 0.035),
  }));
  let previous: number[] = [];
  for (let ring = 1; ring <= 2; ring++) {
    const starts: number[] = [];
    for (const p of border) {
      const x = mix(center.x, p.x, ring / 2), z = mix(center.z, p.z, ring / 2);
      const variation = 0.93 + noise(x * 21.3 + 4, z * 21.3 + 12) * 0.14;
      starts.push(vertex(data, x, landHeight(x, z) + 0.012, z, color.scale(variation)));
    }
    for (let i = 0; i < starts.length; i++) {
      const next = (i + 1) % starts.length;
      if (ring === 1) triangle(data, middle, starts[i], starts[next]);
      else {
        triangle(data, previous[i], starts[i], starts[next]);
        triangle(data, previous[i], starts[next], previous[next]);
      }
    }
    previous = starts;
  }
}

function strip(data: Geometry, path: Point[], width: number, color: Color3, offset: number) {
  const start = data.positions.length / 3;
  for (let i = 0; i < path.length; i++) {
    const previous = path[Math.max(0, i - 1)], next = path[Math.min(path.length - 1, i + 1)];
    const length = Math.hypot(next.x - previous.x, next.z - previous.z) || 1;
    const nx = (next.z - previous.z) / length * width / 2;
    const nz = -(next.x - previous.x) / length * width / 2;
    for (const side of [-1, 1]) {
      const x = path[i].x + nx * side, z = path[i].z + nz * side;
      vertex(data, x, landHeight(x, z) + offset, z, color);
    }
    if (i > 0) {
      const a = start + (i - 1) * 2, b = a + 1, c = a + 2, d = a + 3;
      triangle(data, a, b, c);
      triangle(data, b, d, c);
    }
  }
}

function clipLine(polygon: Point[], nx: number, nz: number, boundary: number) {
  const result: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const dp = p.x * nx + p.z * nz - boundary;
    const dq = q.x * nx + q.z * nz - boundary;
    if (dp <= 0) result.push(p);
    if ((dp <= 0) !== (dq <= 0)) {
      const t = dp / (dp - dq);
      result.push({ x: mix(p.x, q.x, t), z: mix(p.z, q.z, t) });
    }
  }
  return result;
}

function splitParcels(polygon: Point[], seed: number) {
  let pieces = [polygon];
  const orientation = hash(seed, 97) * Math.PI;
  for (let round = 0; round < 2; round++) {
    const next: Point[][] = [];
    for (let part = 0; part < pieces.length; part++) {
      const current = pieces[part];
      if (round > 0 && hash(seed + part * 17, 51) < 0.25) {
        next.push(current);
        continue;
      }
      const angle = orientation + round * Math.PI / 2 + (hash(seed, part + 17) - 0.5) * 0.4;
      const nx = Math.cos(angle), nz = Math.sin(angle);
      const projections = current.map((point) => point.x * nx + point.z * nz);
      const boundary = mix(Math.min(...projections), Math.max(...projections), 0.32 + hash(seed + part, round + 56) * 0.35);
      const left = clipLine(current, nx, nz, boundary);
      const right = clipLine(current, -nx, -nz, -boundary);
      if (left.length >= 3) next.push(left);
      if (right.length >= 3) next.push(right);
    }
    pieces = next;
  }
  return pieces;
}

function ribbon(data: Geometry, a: Point, b: Point, width: number, color: Color3, offset: number) {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  if (length < 0.0001) return;
  const nx = (b.z - a.z) / length * width / 2;
  const nz = -(b.x - a.x) / length * width / 2;
  const points = [
    { x: a.x + nx, z: a.z + nz }, { x: b.x + nx, z: b.z + nz },
    { x: b.x - nx, z: b.z - nz }, { x: a.x - nx, z: a.z - nz },
  ];
  const start = data.positions.length / 3;
  for (const p of points) vertex(data, p.x, landHeight(p.x, p.z) + offset, p.z, color);
  triangle(data, start, start + 1, start + 2);
  triangle(data, start, start + 2, start + 3);
}

function buildFields(scene: Scene, meshes: Mesh[]) {
  const parcels = geometry(), furrows = geometry(), hedges = geometry();
  const sites: Point[] = [];
  const spacing = 0.36;
  for (let ix = Math.floor(bounds.minX / spacing); ix * spacing < bounds.maxX; ix++) {
    for (let iz = Math.floor(bounds.minZ / spacing); iz * spacing < bounds.maxZ; iz++) {
      sites.push({
        x: (ix + (hash(ix + 21, iz) - 0.5) * 0.88) * spacing,
        z: (iz + (hash(ix, iz + 78) - 0.5) * 0.88) * spacing,
      });
    }
  }
  const palette = ["#799153", "#A69C66", "#889951", "#9CA065", "#657F4B", "#B5A66B", "#8A8B61"]
    .map((hex) => Color3.FromHexString(hex));
  const furrowColor = Color3.FromHexString("#788154");
  const hedgeColor = Color3.FromHexString("#5C754C");
  for (let index = 0; index < sites.length; index++) {
    const center = sites[index];
    if (!landContains(center.x, center.z) || landHeight(center.x, center.z) > 0.35 ||
        cityDistance(center.x, center.z) < 0.55 || smallSettlementDistance(center.x, center.z) < 0.23 ||
        forestAmount(center.x, center.z) > 0.58) continue;
    let polygon: Point[] = [
      { x: center.x - spacing, z: center.z - spacing },
      { x: center.x + spacing, z: center.z - spacing },
      { x: center.x + spacing, z: center.z + spacing },
      { x: center.x - spacing, z: center.z + spacing },
    ];
    for (const neighbor of sites) {
      if (neighbor === center || Math.abs(neighbor.x - center.x) > spacing * 2.4 ||
          Math.abs(neighbor.z - center.z) > spacing * 2.4) continue;
      polygon = clipHalfPlane(polygon, center, neighbor);
      if (polygon.length < 3) break;
    }
    if (polygon.length < 3 || polygon.some(({ x, z }) => !landContains(x, z) || cityDistance(x, z) < 0.47 || smallSettlementDistance(x, z) < 0.19)) continue;
    const pieces = splitParcels(polygon, index);
    for (let part = 0; part < pieces.length; part++) {
      const parcel = pieces[part];
      const parcelCenter = {
        x: parcel.reduce((sum, point) => sum + point.x, 0) / parcel.length,
        z: parcel.reduce((sum, point) => sum + point.z, 0) / parcel.length,
      };
      const seed = index * 7 + part;
      const color = palette[Math.floor(hash(seed, 37) * palette.length) % palette.length];
      fieldFan(parcels, parcel, parcelCenter, color);
      // Only occasional hedges: the landscape must not become a polygon grid.
      for (let i = 0; i < parcel.length; i++) {
        if (hash(seed + i * 23, 63) < 0.84) continue;
        const a = parcel[i], b = parcel[(i + 1) % parcel.length];
        strip(hedges, densify([a, b], 0.075, false), 0.006, hedgeColor, 0.017);
      }
      // Fine parallel rows are local to one crop, not every visible parcel.
      if (hash(seed, 11) > 0.35) continue;
      const theta = hash(index, 97) * Math.PI + part % 2 * Math.PI / 2;
      const dx = Math.cos(theta), dz = Math.sin(theta);
      const nx = -dz, nz = dx;
      const projected = parcel.map((point) => (point.x - parcelCenter.x) * nx + (point.z - parcelCenter.z) * nz);
      const rowSpacing = 0.021 + hash(seed, 24) * 0.01;
      const firstRow = Math.ceil(Math.min(...projected) / rowSpacing);
      const lastRow = Math.floor(Math.max(...projected) / rowSpacing);
      for (let row = firstRow; row <= lastRow; row++) {
        const origin = { x: parcelCenter.x + nx * row * rowSpacing, z: parcelCenter.z + nz * row * rowSpacing };
        const intersections: number[] = [];
        for (let i = 0; i < parcel.length; i++) {
          const a = parcel[i], b = parcel[(i + 1) % parcel.length];
          const ex = b.x - a.x, ez = b.z - a.z;
          const determinant = dx * ez - dz * ex;
          if (Math.abs(determinant) < 0.00001) continue;
          const rx = a.x - origin.x, rz = a.z - origin.z;
          const t = (rx * ez - rz * ex) / determinant;
          const u = (rx * dz - rz * dx) / determinant;
          if (u >= 0 && u <= 1) intersections.push(t);
        }
        intersections.sort((a, b) => a - b);
        if (intersections.length < 2) continue;
        const first = intersections[0] + 0.012, last = intersections[intersections.length - 1] - 0.012;
        if (last <= first) continue;
        const points = densify([
          { x: origin.x + dx * first, z: origin.z + dz * first },
          { x: origin.x + dx * last, z: origin.z + dz * last },
        ], 0.075, false);
        strip(furrows, points, 0.0017, colorMix(furrowColor, color, 0.35), 0.019);
      }
    }
  }
  const surface = material(scene, "landscape-crops", "#FFFFFF");
  surface.backFaceCulling = false;
  surface.diffuseTexture = groundTexture(scene);
  meshes.push(finish(scene, "landscape-agriculture", parcels, surface));
  meshes.push(finish(scene, "landscape-crop-rows", furrows, surface));
  meshes.push(finish(scene, "landscape-hedgerows", hedges, surface));
}

function cone(data: Geometry, x: number, y: number, z: number, radius: number,
  height: number, color: Color3, sides = 7, twist = 0) {
  const start = data.positions.length / 3;
  for (let i = 0; i < sides; i++) {
    const angle = i / sides * Math.PI * 2 + twist;
    const shade = 0.92 + Math.cos(angle - 0.65) * 0.08;
    vertex(data, x + Math.cos(angle) * radius, y, z + Math.sin(angle) * radius, color.scale(shade));
  }
  const tip = vertex(data, x, y + height, z, color.scale(1.04));
  const bottom = vertex(data, x, y, z, color.scale(0.84));
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    triangle(data, start + i, start + next, tip);
    triangle(data, bottom, start + next, start + i);
  }
}

function crown(data: Geometry, x: number, y: number, z: number, radius: number,
  height: number, color: Color3, twist: number) {
  const rings = 3, sides = 7;
  const start = data.positions.length / 3;
  for (let ring = 0; ring <= rings; ring++) {
    const latitude = ring / rings * Math.PI;
    for (let side = 0; side < sides; side++) {
      const angle = side / sides * Math.PI * 2 + twist;
      const lobes = 0.78 + hash(side * 7 + Math.floor(twist * 10), ring + 13) * 0.37;
      const r = Math.sin(latitude) * radius * lobes;
      const drift = Math.cos(latitude) * radius * 0.16;
      vertex(data, x + Math.cos(angle) * r + Math.cos(twist) * drift,
        y + Math.cos(latitude) * height / 2 + Math.sin(angle + twist) * height * 0.065,
        z + Math.sin(angle) * r + Math.sin(twist) * drift,
        color.scale(0.92 + Math.cos(angle - 0.7) * 0.09 + Math.cos(latitude) * 0.035));
      if (ring > 0) {
        const a = start + (ring - 1) * sides + side;
        const b = start + (ring - 1) * sides + (side + 1) % sides;
        const c = start + ring * sides + side;
        const d = start + ring * sides + (side + 1) % sides;
        triangle(data, a, c, b);
        triangle(data, b, c, d);
      }
    }
  }
}

function evergreen(data: Geometry, x: number, y: number, z: number, radius: number,
  height: number, color: Color3, twist: number) {
  const profile = [0.23, 0.78, 1, 0.71, 0.75, 0.43, 0.06];
  const heights = [0.13, 0.29, 0.42, 0.55, 0.7, 0.85, 0.99];
  const sides = 6, start = data.positions.length / 3;
  for (let ring = 0; ring < profile.length; ring++) {
    for (let side = 0; side < sides; side++) {
      const angle = side / sides * Math.PI * 2 + twist + ring * 0.12;
      const r = radius * profile[ring] * (0.77 + hash(side * 7 + Math.floor(twist * 100), ring * 17) * 0.38);
      const drift = heights[ring] * radius * 0.28;
      vertex(data, x + Math.cos(angle) * r + Math.cos(twist) * drift,
        y + height * heights[ring] + (hash(side + 82, ring + Math.floor(twist * 10)) - 0.5) * height * 0.075,
        z + Math.sin(angle) * r + Math.sin(twist) * drift,
        color.scale(0.9 + Math.cos(angle - 0.7) * 0.095 + ring * 0.012));
      if (ring > 0) {
        const a = start + (ring - 1) * sides + side;
        const b = start + (ring - 1) * sides + (side + 1) % sides;
        const c = start + ring * sides + side;
        const d = start + ring * sides + (side + 1) % sides;
        triangle(data, a, b, c);
        triangle(data, b, d, c);
      }
    }
  }
  const tip = vertex(data, x + Math.cos(twist) * radius * 0.28, y + height * 1.025,
    z + Math.sin(twist) * radius * 0.28, color.scale(1.035));
  const last = start + (profile.length - 1) * sides;
  for (let side = 0; side < sides; side++) triangle(data, last + side, last + (side + 1) % sides, tip);
}

function nearbyRiver(x: number, z: number) {
  return rivers.some(({ points }) => ridgeDistance(x, z, points) < 0.047);
}

function buildForests(scene: Scene, meshes: Mesh[]) {
  const leaves = geometry(), trunks = geometry();
  const deep = Color3.FromHexString("#294735");
  const light = Color3.FromHexString("#597548");
  const bark = Color3.FromHexString("#756246");
  const spacing = 0.115;
  for (let ix = Math.floor(bounds.minX / spacing); ix * spacing < bounds.maxX; ix++) {
    for (let iz = Math.floor(bounds.minZ / spacing); iz * spacing < bounds.maxZ; iz++) {
      const x = (ix + (hash(ix, iz) - 0.5) * 0.94) * spacing;
      const z = (iz + (hash(ix + 53, iz) - 0.5) * 0.94) * spacing;
      const y = landHeight(x, z);
      const forest = forestAmount(x, z);
      if (forest < 0.58 || y > 0.93 || !landContains(x, z) ||
          cityDistance(x, z) < 0.55 || smallSettlementDistance(x, z) < 0.22 || nearbyRiver(x, z)) continue;
      const amount = forest > 0.85 ? 3 : forest > 0.71 ? 2 : 1;
      for (let tree = 0; tree < amount; tree++) {
        const tx = x + (hash(ix + tree * 31, iz + 46) - 0.5) * 0.105;
        const tz = z + (hash(ix + 67, iz + tree * 21) - 0.5) * 0.105;
        if (!landContains(tx, tz) || smallSettlementDistance(tx, tz) < 0.2) continue;
        const ground = landHeight(tx, tz);
        const variant = hash(ix * 7 + tree, iz * 3);
        const height = 0.11 + variant * 0.12;
        const radius = height * (0.18 + hash(ix + 87, iz + tree) * 0.07);
        const color = colorMix(deep, light, hash(ix + tree, iz + 37) * 0.85);
        cone(trunks, tx, ground, tz, radius * 0.18, height * 0.76, bark, 5);
        if (ground > 0.54 || (z > 1.6 && variant > 0.57) || variant > 0.89) {
          evergreen(leaves, tx, ground, tz, radius * 1.1, height, color, variant * Math.PI * 2);
        } else {
          const umbrella = z < -1.9 && variant > 0.44;
          const spread = umbrella ? 1.35 : 1;
          const rise = umbrella ? 0.63 : 1;
          const direction = variant * Math.PI * 2;
          crown(leaves, tx, ground + height * 0.69, tz, radius * 1.22 * spread,
            height * 0.54 * rise, color, direction);
          crown(leaves, tx + Math.cos(direction) * radius * 0.68,
            ground + height * 0.56, tz + Math.sin(direction) * radius * 0.68,
            radius * 0.92 * spread, height * 0.46 * rise, color.scale(0.98), direction + 1.2);
          crown(leaves, tx - Math.sin(direction) * radius * 0.63,
            ground + height * 0.75, tz + Math.cos(direction) * radius * 0.63,
            radius * 0.86 * spread, height * 0.43 * rise, color.scale(1.035), direction + 3.1);
        }
      }
    }
  }
  meshes.push(finish(scene, "landscape-forest-crowns", leaves, material(scene, "landscape-leaves", "#FFFFFF")));
  meshes.push(finish(scene, "landscape-forest-trunks", trunks, material(scene, "landscape-bark", "#FFFFFF")));
}

function curvedPath(points: Point[]) {
  const result: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)], b = points[i];
    const c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
    const count = Math.ceil(Math.hypot(c.x - b.x, c.z - b.z) / 0.045);
    for (let step = 0; step < count; step++) {
      const t = step / count, t2 = t * t, t3 = t2 * t;
      const axis = (key: "x" | "z") => 0.5 * ((2 * b[key]) +
        (-a[key] + c[key]) * t + (2 * a[key] - 5 * b[key] + 4 * c[key] - d[key]) * t2 +
        (-a[key] + 3 * b[key] - 3 * c[key] + d[key]) * t3);
      result.push({ x: axis("x"), z: axis("z") });
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

function buildRivers(scene: Scene, meshes: Mesh[]) {
  const banks = geometry(), water = geometry();
  const bankColor = Color3.FromHexString("#BAB393");
  const waterColor = Color3.FromHexString("#437B85");
  for (const river of rivers) {
    const path = curvedPath(river.points);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      if (!landContains(a.x, a.z) || !landContains(b.x, b.z)) continue;
      const width = river.width * (0.55 + i / path.length * 0.6);
      ribbon(banks, a, b, width + 0.013, bankColor, 0.022);
      ribbon(water, a, b, width, waterColor, 0.025);
    }
  }
  const bankSurface = material(scene, "landscape-riverbanks", "#FFFFFF");
  bankSurface.backFaceCulling = false;
  const waterSurface = material(scene, "landscape-riverwater", "#FFFFFF");
  waterSurface.specularColor = new Color3(0.18, 0.27, 0.26);
  waterSurface.specularPower = 58;
  waterSurface.backFaceCulling = false;
  meshes.push(finish(scene, "landscape-riverbanks", banks, bankSurface));
  meshes.push(finish(scene, "landscape-rivers", water, waterSurface));
}

/** Static, deterministic local geometry. No remote textures or scene-state effects. */
export function buildLandscape(scene: Scene): { meshes: Mesh[] } {
  const meshes: Mesh[] = [];
  buildGround(scene, meshes);
  buildFields(scene, meshes);
  buildForests(scene, meshes);
  buildRivers(scene, meshes);
  return { meshes };
}
