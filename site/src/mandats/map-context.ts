import { MODEL_URLS } from "./map-model-revisions.ts";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import Delaunator from "delaunator";
import { MAP_CONTEXT_COUNTRIES } from "./map-context-geography.ts";
import { FRANCE_OUTLINES } from "./map-geography.ts";
import { mapSourcePosition as mapPosition, mapAuthoredPosition } from "./map-state.ts";
import { landContains, landHeight } from "./map-landscape.ts";
import { loadAssetKit } from "./map-asset-kit.ts";

type Point = { x: number; z: number };
// Surrounding geometry is sampled in the bounded source frame, then projected.
function frenchContains(x: number, z: number) {
  const point = mapAuthoredPosition(x, z); return landContains(point.x, point.z);
}
function frenchHeight(x: number, z: number) {
  const point = mapAuthoredPosition(x, z); return landHeight(point.x, point.z);
}
type Edge = { a: Point; b: Point };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (n: number) => n * n * (3 - 2 * n);
const rings = MAP_CONTEXT_COUNTRIES.flatMap((country) =>
  country.outlines.map((outline) => ({
    country: country.name,
    points: outline.slice(0, -1).map(([lon, lat]) => mapPosition(lon, lat)),
  })),
)
  .filter((ring) => ring.points.length >= 3)
  .map((ring) => ({
    ...ring,
    minX: Math.min(...ring.points.map((p) => p.x)),
    maxX: Math.max(...ring.points.map((p) => p.x)),
    minZ: Math.min(...ring.points.map((p) => p.z)),
    maxZ: Math.max(...ring.points.map((p) => p.z)),
  }));
const franceRings = FRANCE_OUTLINES.map((ring) =>
  ring.slice(0, -1).map(([lon, lat]) => mapPosition(lon, lat)),
);
const franceBounds = {
  minX: Math.min(...franceRings.flat().map((p) => p.x)),
  maxX: Math.max(...franceRings.flat().map((p) => p.x)),
  minZ: Math.min(...franceRings.flat().map((p) => p.z)),
  maxZ: Math.max(...franceRings.flat().map((p) => p.z)),
};
function contains(p: Point, ring: ReadonlyArray<Point>) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j],
      dx = b.x - a.x,
      dz = b.z - a.z;
    const cross = dx * (p.z - a.z) - dz * (p.x - a.x);
    if (
      Math.abs(cross) < 1e-8 &&
      p.x >= Math.min(a.x, b.x) - 1e-8 &&
      p.x <= Math.max(a.x, b.x) + 1e-8 &&
      p.z >= Math.min(a.z, b.z) - 1e-8 &&
      p.z <= Math.max(a.z, b.z) + 1e-8
    )
      return true;
    if (
      a.z > p.z !== b.z > p.z &&
      p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x
    )
      inside = !inside;
  }
  return inside;
}
function contextContains(point: Point) {
  return rings.some(
    (ring) =>
      point.x >= ring.minX &&
      point.x <= ring.maxX &&
      point.z >= ring.minZ &&
      point.z <= ring.maxZ &&
      contains(point, ring.points),
  );
}
function hash(x: number, z: number) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function noise(x: number, z: number) {
  const ix = Math.floor(x),
    iz = Math.floor(z),
    tx = smooth(x - ix),
    tz = smooth(z - iz);
  return mix(
    mix(hash(ix, iz), hash(ix + 1, iz), tx),
    mix(hash(ix, iz + 1), hash(ix + 1, iz + 1), tx),
    tz,
  );
}
function segmentDistance(x: number, z: number, a: Point, b: Point) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    length = dx * dx + dz * dz;
  const t = length > 0 ? clamp(((x - a.x) * dx + (z - a.z) * dz) / length) : 0;
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}
function edgeIndex(edges: Edge[], reach: number) {
  const cells = new Map<string, Edge[]>();
  for (const edge of edges) {
    for (
      let x = Math.floor((Math.min(edge.a.x, edge.b.x) - reach) / 0.4);
      x <= Math.floor((Math.max(edge.a.x, edge.b.x) + reach) / 0.4);
      x++
    ) {
      for (
        let z = Math.floor((Math.min(edge.a.z, edge.b.z) - reach) / 0.4);
        z <= Math.floor((Math.max(edge.a.z, edge.b.z) + reach) / 0.4);
        z++
      ) {
        const key = `${x}:${z}`,
          cell = cells.get(key) ?? [];
        cell.push(edge);
        cells.set(key, cell);
      }
    }
  }
  return cells;
}
const franceEdges = franceRings.flatMap((ring) =>
  ring.map((a, i) => ({ a, b: ring[(i + 1) % ring.length] })),
);
const frontierCells = edgeIndex(franceEdges, 0.7);
const seaEdges: Edge[] = [];
for (const ring of rings)
  for (let i = 0; i < ring.points.length; i++) {
    const a = ring.points[i],
      b = ring.points[(i + 1) % ring.points.length],
      length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 1e-6) continue;
    const center = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 },
      nx = -(b.z - a.z) / length,
      nz = (b.x - a.x) / length;
    const one = { x: center.x + nx * 0.07, z: center.z + nz * 0.07 },
      other = { x: center.x - nx * 0.07, z: center.z - nz * 0.07 };
    const outside = contains(one, ring.points) ? other : one;
    if (!frenchContains(outside.x, outside.z) && !contextContains(outside))
      seaEdges.push({ a, b });
  }
const coastCells = edgeIndex(seaEdges, 0.45);
function edgeDistance(
  cells: Map<string, Edge[]>,
  x: number,
  z: number,
  maximum: number,
) {
  let distance = maximum;
  for (const { a, b } of cells.get(
    `${Math.floor(x / 0.4)}:${Math.floor(z / 0.4)}`,
  ) ?? []) {
    distance = Math.min(distance, segmentDistance(x, z, a, b));
  }
  return distance;
}
function hill(
  x: number,
  z: number,
  lon: number,
  lat: number,
  rx: number,
  rz: number,
  height: number,
) {
  const p = mapPosition(lon, lat);
  return height * Math.exp(-(((x - p.x) / rx) ** 2 + ((z - p.z) / rz) ** 2));
}
const ranges = [
  {
    width: 0.34,
    height: 0.44,
    crests: [1, .66, .94, .60, .84],
    points: [
      [7.2, 46.05],
      [8.05, 46.5],
      [8.95, 46.72],
      [9.9, 46.6],
      [10.5, 46.2],
    ],
  },
  {
    width: 0.32,
    height: 0.3,
    crests: [.70, 1, .58, .88],
    points: [
      [7.5, 44.05],
      [7.6, 44.7],
      [7.3, 45.3],
      [7.5, 45.9],
    ],
  },
  {
    width: 0.33,
    height: 0.3,
    crests: [.68, .91, .60, 1, .75],
    points: [
      [-1.3, 42.65],
      [-0.5, 42.45],
      [0.5, 42.3],
      [1.5, 42.32],
      [2.4, 42.18],
    ],
  },
  {
    width: 0.46,
    height: 0.2,
    crests: [.72, 1, .63],
    points: [
      [7.7, 48.2],
      [8.25, 48.65],
      [8.65, 49.15],
    ],
  },
  {
    width: 0.35,
    height: 0.23,
    crests: [.67, 1, .61, .94, .71],
    points: [
      [4.0, 50.1],
      [4.45, 50.35],
      [4.9, 50.22],
      [5.28, 50.38],
      [5.7, 50.0],
    ],
  },
  {
    width: 0.31,
    height: 0.18,
    crests: [.76, 1, .65, .91, .59, .82],
    points: [[-4.35,50.88],[-3.68,51.04],[-2.83,50.86],[-2.13,51.06],[-1.26,50.99],[-.48,51.12]],
  },
  {
    width: 0.27,
    height: 0.22,
    crests: [.70, .94, .60, 1, .67],
    points: [[6.72,49.85],[7.21,49.74],[7.56,49.99],[8.05,49.60],[8.52,49.72]],
  },
].map((range) => ({
  ...range,
  points: range.points.map(([lon, lat]) => mapPosition(lon, lat)),
}));
function contextHeight(x: number, z: number) {
  const rolling =
    noise(x * 1.85 + 4, z * 1.73 + 18) * 0.105 +
    noise(x * 5.1 + 31, z * 4.7 + 7) * 0.055;
  let watershed = 0;
  for (const range of ranges) {
    for (let i = 1; i < range.points.length; i++) {
      const a = range.points[i - 1], b = range.points[i], dx = b.x - a.x, dz = b.z - a.z,
        along = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)),
        height = range.height * mix(range.crests[i - 1], range.crests[i], along),
        distance = segmentDistance(x, z, a, b);
      watershed = Math.max(watershed, Math.max(0, 1 - distance / (range.width * 1.7)) * height);
    }
  }
  const uplands =
    hill(x, z, -3.7, 52.5, 0.85, 1.2, 0.24) +
    hill(x, z, -3.5, 50.8, 0.9, 0.5, 0.1) +
    hill(x, z, -3.1, 41.1, 2.1, 1.2, 0.12);
  const ridge = 1 - Math.abs(noise(x * 7.3 + 31, z * 6.5 + 9) * 2 - 1);
  let height = -0.025 + rolling + uplands + watershed * (0.73 + ridge * 0.27);
  const shore = edgeDistance(coastCells, x, z, 0.45);
  height = mix(-0.033, height, smooth(clamp(shore / 0.28)));
  const distance = edgeDistance(frontierCells, x, z, 0.7);
  // The shared French survey is only needed within the frontier's blend band.
  // Looking it up across Britain, Spain and Italy fills an unrelated fine grid.
  if (distance >= 0.6) return height;
  const continuity =
    Math.exp(-((distance / 0.3) ** 2)) * smooth(clamp((0.6 - distance) / 0.1));
  return mix(height, frenchHeight(x, z) - 0.012, continuity);
}
function forestAmount(x: number, z: number) {
  return (
    noise(x * 1.7 + 3, z * 1.65 + 13) * 0.68 +
    noise(x * 4.9 + 8, z * 4.6 + 3) * 0.24 +
    hill(x, z, 8.05, 48.7, 0.55, 0.9, 0.25) +
    hill(x, z, 5.1, 50.15, 1.0, 0.6, 0.24) +
    hill(x, z, -2.8, 50.98, 1.8, 0.5, 0.38) +
    hill(x, z, 7.5, 49.65, 0.9, 0.7, 0.28)
  );
}

/** Continuous wooded surroundings remain quieter than the playable miniature. */
export async function buildMapContext(
  scene: Scene,
): Promise<{ meshes: AbstractMesh[] }> {
  const positions: number[] = [],
    indices: number[] = [],
    colors: number[] = [],
    uvs: number[] = [];
  const borderPositions: number[] = [],
    borderIndices: number[] = [],
    borderColors: number[] = [];
  const palette = {
    forest: Color3.FromHexString("#314343"),
    clearing: Color3.FromHexString("#485054"),
    ridge: Color3.FromHexString("#6B6A61"),
    stone: Color3.FromHexString("#86877E"),
  };
  for (const ring of rings) {
    const points = [...ring.points],
      spacing = 0.12;
    for (
      let ix = Math.ceil(ring.minX / spacing);
      ix * spacing < ring.maxX;
      ix++
    ) {
      for (
        let iz = Math.ceil(ring.minZ / spacing);
        iz * spacing < ring.maxZ;
        iz++
      ) {
        const x = (ix + (hash(ix + 19, iz) - 0.5) * 0.35) * spacing,
          z = (iz + (hash(ix, iz + 37) - 0.5) * 0.35) * spacing;
        if (contains({ x, z }, ring.points)) points.push({ x, z });
      }
    }
    const offset = positions.length / 3;
    for (const point of points) {
      const height = contextHeight(point.x, point.z),
        forest = forestAmount(point.x, point.z);
      positions.push(point.x, height, point.z);
      let color = Color3.Lerp(
        palette.clearing,
        palette.forest,
        clamp((forest - 0.37) / 0.4),
      );
      color = Color3.Lerp(color, palette.ridge, clamp((height - 0.2) * 1.2));
      if (height > 0.38)
        color = Color3.Lerp(color, palette.stone, clamp((height - 0.38) * 2.1));
      color = color.scale(
        0.86 + noise(point.x * 13.1 + 7, point.z * 11.4 + 39) * 0.14,
      );
      colors.push(color.r, color.g, color.b, 1);
      uvs.push(point.x * 0.45, point.z * 0.45);
    }
    const triangles = Delaunator.from(
      points,
      (p) => p.x,
      (p) => p.z,
    ).triangles;
    for (let i = 0; i < triangles.length; i += 3) {
      const a = triangles[i],
        b = triangles[i + 1],
        c = triangles[i + 2],
        p = points[a],
        q = points[b],
        r = points[c];
      if (
        !contains(
          { x: (p.x + q.x + r.x) / 3, z: (p.z + q.z + r.z) / 3 },
          ring.points,
        )
      )
        continue;
      if (
        ![
          [p, q],
          [q, r],
          [r, p],
        ].every(([start, end]) =>
          contains(
            { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 },
            ring.points,
          ),
        )
      )
        continue;
      const winding = (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
      indices.push(
        offset + a,
        ...(winding > 0 ? [offset + b, offset + c] : [offset + c, offset + b]),
      );
    }
    for (let i = 0; i < ring.points.length; i++) {
      const a = ring.points[i],
        b = ring.points[(i + 1) % ring.points.length],
        length = Math.hypot(b.x - a.x, b.z - a.z);
      if (length < 1e-6) continue;
      const nx = (-(b.z - a.z) / length) * 0.004,
        nz = ((b.x - a.x) / length) * 0.004,
        steps = Math.max(1, Math.ceil(length / 0.1));
      for (let step = 0; step < steps; step++) {
        const p = {
            x: mix(a.x, b.x, step / steps),
            z: mix(a.z, b.z, step / steps),
          },
          q = {
            x: mix(a.x, b.x, (step + 1) / steps),
            z: mix(a.z, b.z, (step + 1) / steps),
          };
        const at = borderPositions.length / 3;
        borderPositions.push(
          p.x + nx,
          contextHeight(p.x, p.z) + 0.005,
          p.z + nz,
          q.x + nx,
          contextHeight(q.x, q.z) + 0.005,
          q.z + nz,
          q.x - nx,
          contextHeight(q.x, q.z) + 0.005,
          q.z - nz,
          p.x - nx,
          contextHeight(p.x, p.z) + 0.005,
          p.z - nz,
        );
        borderIndices.push(at, at + 2, at + 1, at, at + 3, at + 2);
        for (let corner = 0; corner < 4; corner++)
          borderColors.push(0.35, 0.41, 0.36, 1);
      }
    }
  }
  // The geographic neighbour borders sit lower than the French rim. Trace the
  // actual shared French frontier above both surfaces to keep its cream line visible.
  const frontierColor = Color3.FromHexString("#E4D9B7");
  for (const edge of franceEdges) {
    const { a, b } = edge, dx = b.x - a.x, dz = b.z - a.z,
      length = Math.hypot(dx, dz);
    if (length < 1e-6) continue;
    const centre = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 },
      sides = [-1, 1].map(side => ({ x: centre.x - dz / length * 0.035 * side,
        z: centre.z + dx / length * 0.035 * side })),
      neighbour = sides.find(point => !frenchContains(point.x, point.z));
    if (!neighbour || !contextContains(neighbour)) continue;
    const steps = Math.max(1, Math.ceil(length / 0.045)), nx = -dz / length * 0.008,
      nz = dx / length * 0.008,
      heightAt = (x: number, z: number) => Math.max(frenchHeight(x, z), contextHeight(x, z)) + 0.014;
    for (let step = 0; step < steps; step++) {
      const p = { x: mix(a.x, b.x, step / steps), z: mix(a.z, b.z, step / steps) },
        q = { x: mix(a.x, b.x, (step + 1) / steps), z: mix(a.z, b.z, (step + 1) / steps) },
        at = borderPositions.length / 3;
      borderPositions.push(p.x + nx, heightAt(p.x, p.z), p.z + nz,
        q.x + nx, heightAt(q.x, q.z), q.z + nz,
        q.x - nx, heightAt(q.x, q.z), q.z - nz,
        p.x - nx, heightAt(p.x, p.z), p.z - nz);
      borderIndices.push(at, at + 2, at + 1, at, at + 3, at + 2);
      for (let corner = 0; corner < 4; corner++) borderColors.push(frontierColor.r, frontierColor.g, frontierColor.b, 1);
    }
  }
  const surface = new StandardMaterial("context-wooded-earth", scene);
  surface.diffuseColor = Color3.White();
  surface.specularColor = Color3.Black();
  surface.ambientColor = new Color3(0.18, 0.21, 0.25);
  const size = 256,
    rgba = new Uint8Array(size * size * 4);
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) {
      const shade = 195 + noise(x * 0.085, z * 0.085) * 32 + hash(x, z) * 22;
      const at = (z * size + x) * 4;
      rgba.set([shade, shade + 2, shade - 3, 255], at);
    }
  const texture = RawTexture.CreateRGBATexture(
    rgba,
    size,
    size,
    scene,
    true,
    false,
    Texture.TRILINEAR_SAMPLINGMODE,
  );
  texture.name = "context-earth-grain";
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  surface.diffuseTexture = texture;
  const borderMaterial = new StandardMaterial(
    "context-country-boundaries",
    scene,
  );
  borderMaterial.diffuseColor = Color3.White();
  borderMaterial.specularColor = Color3.Black();
  borderMaterial.backFaceCulling = false;
  const build = (
    name: string,
    p: number[],
    i: number[],
    c: number[],
    material: StandardMaterial,
    uv?: number[],
  ) => {
    const mesh = new Mesh(name, scene),
      data = new VertexData();
    data.positions = p;
    data.indices = i;
    data.colors = c;
    data.normals = [];
    if (uv) data.uvs = uv;
    VertexData.ComputeNormals(p, i, data.normals);
    if (name === "context-surface") {
      // Use the already computed face survey, rather than four extra height
      // lookups per vertex, to expose mineral breaks in wooded surroundings.
      for (let v = 0; v < p.length / 3; v++) {
        const slope = 1 - Math.abs(data.normals[v * 3 + 1]);
        const amount =
          clamp((slope - 0.04) / 0.32) *
          clamp((p[v * 3 + 1] - 0.11) / 0.2) *
          0.77;
        const at = v * 4;
        const mineral = Color3.Lerp(
          new Color3(c[at], c[at + 1], c[at + 2]),
          palette.stone,
          amount,
        );
        c[at] = mineral.r;
        c[at + 1] = mineral.g;
        c[at + 2] = mineral.b;
      }
      // Only exposed inclined rock keeps separate face normals. The wooded
      // valleys retain their smooth ground; the surrounding ridges gain facets.
      const separate: number[] = [], separateColors: number[] = [], separateUvs: number[] = [], separateIndices: number[] = [];
      for (let at = 0; at < i.length; at += 3) {
        const ids = [i[at], i[at + 1], i[at + 2]],
          averageHeight = ids.reduce((sum, id) => sum + p[id * 3 + 1], 0) / 3,
          normalY = ids.reduce((sum, id) => sum + data.normals![id * 3 + 1], 0) / 3;
        if (averageHeight < .20 || normalY > .94) { separateIndices.push(...ids); continue; }
        for (const id of ids) {
          separateIndices.push(p.length / 3 + separate.length / 3);
          separate.push(p[id * 3], p[id * 3 + 1], p[id * 3 + 2]);
          separateColors.push(c[id * 4], c[id * 4 + 1], c[id * 4 + 2], c[id * 4 + 3]);
          if (uv) separateUvs.push(uv[id * 2], uv[id * 2 + 1]);
        }
      }
      p.push(...separate); c.push(...separateColors); if (uv) uv.push(...separateUvs);
      data.indices = separateIndices; data.normals = [];
      VertexData.ComputeNormals(p, separateIndices, data.normals);
    }
    for (let at = 0; at < p.length; at += 3) {
      const point = mapAuthoredPosition(p[at], p[at + 2]);
      p[at] = point.x; p[at + 2] = point.z;
    }
    data.normals = [];
    VertexData.ComputeNormals(p, data.indices!, data.normals);
    data.applyToMesh(mesh);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.freezeWorldMatrix();
    return mesh;
  };
  const meshes: AbstractMesh[] = [
    build("context-surface", positions, indices, colors, surface, uvs),
    build(
      "context-boundaries",
      borderPositions,
      borderIndices,
      borderColors,
      borderMaterial,
    ),
  ];
  const kit = await loadAssetKit(scene, MODEL_URLS.vegetation);
  if (scene.isDisposed) return { meshes: [] };
  const forestRoot = new TransformNode("context-authored-forests", scene),
    spacing = 0.096;
  let count = 0;
  for (
    let ix = Math.floor((franceBounds.minX - 1.4) / spacing);
    ix * spacing < franceBounds.maxX + 1.5;
    ix++
  ) {
    for (
      let iz = Math.floor((franceBounds.minZ - 1.3) / spacing);
      iz * spacing < franceBounds.maxZ + 2.2;
      iz++
    ) {
      const x = (ix + (hash(ix + 23, iz) - 0.5) * 0.8) * spacing,
        z = (iz + (hash(ix, iz + 41) - 0.5) * 0.8) * spacing;
      if (
        frenchContains(x, z) ||
        !contextContains({ x, z }) ||
        edgeDistance(frontierCells, x, z, 0.7) < 0.075 ||
        forestAmount(x, z) < 0.68
      )
        continue;
      const height = contextHeight(x, z),
        variant = hash(ix * 7, iz * 11);
      if (height < -0.02 || height > 0.56) continue;
      const name =
        height > 0.17 || variant > 0.18
          ? "pine"
          : variant > 0.4
            ? "beech"
            : "oak";
      const prefab = kit.instantiate(name, forestRoot, {
        key: "context",
        tint: [0.52, 0.54, 0.59],
      });
      const point = mapAuthoredPosition(x, z);
      prefab.root.position.set(point.x, height + 0.001, point.z);
      const extent = kit.bounds(name),
        scale = (0.18 + variant * 0.09) / Math.max(0.01, extent.height);
      prefab.root.scaling.setAll(scale);
      if (name === "pine") { prefab.root.scaling.x *= 0.54; prefab.root.scaling.z *= 0.54; }
      prefab.root.rotation.y = variant * Math.PI * 2;
      prefab.root.metadata = {
        ...prefab.root.metadata,
        region: "context",
        castsShadow: false,
      };
      for (const mesh of prefab.meshes)
        mesh.metadata = {
          ...mesh.metadata,
          region: "context",
          castsShadow: false,
        };
      meshes.push(...prefab.meshes);
      count++;
    }
  }
  forestRoot.metadata = {
    treeCount: count,
    contextVegetation: true,
    region: "context",
    castsShadow: false,
  };
  return { meshes };
}
