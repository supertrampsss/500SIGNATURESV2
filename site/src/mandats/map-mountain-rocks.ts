import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Meshes/instancedMesh";
import { mountainFaceSurvey } from "./map-land-crags.ts";
import { landContains, riverContains } from "./map-landscape.ts";

type Point = { x: number; z: number };
type Face = { polygon: Point[]; heights: number[]; area: number; alpine: boolean };
type Geometry = { positions: number[]; indices: number[]; colors: number[]; uvs: number[] };
const STEP = .20;
function random(a: number, b: number) {
  let n = Math.imul(a + 101, 374761393) ^ Math.imul(b + 17, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function overlapping(a: Point[], b: Point[]) {
  for (const polygon of [a, b]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length], nx = p.z - q.z, nz = q.x - p.x;
    let lowA = Infinity, highA = -Infinity, lowB = Infinity, highB = -Infinity;
    for (const v of a) { const s = v.x * nx + v.z * nz; lowA = Math.min(lowA, s); highA = Math.max(highA, s); }
    for (const v of b) { const s = v.x * nx + v.z * nz; lowB = Math.min(lowB, s); highB = Math.max(highB, s); }
    if (highA <= lowB + 1e-10 || highB <= lowA + 1e-10) return false;
  }
  return true;
}
function bounds(polygon: Point[]) {
  return { minX: Math.min(...polygon.map(p => p.x)), maxX: Math.max(...polygon.map(p => p.x)),
    minZ: Math.min(...polygon.map(p => p.z)), maxZ: Math.max(...polygon.map(p => p.z)) };
}
function insert<T>(cells: Map<string, T[]>, polygon: Point[], value: T) {
  const b = bounds(polygon);
  for (let x = Math.floor(b.minX / STEP); x <= Math.floor(b.maxX / STEP); x++)
    for (let z = Math.floor(b.minZ / STEP); z <= Math.floor(b.maxZ / STEP); z++) {
      const key = `${x}:${z}`, cell = cells.get(key) ?? []; cell.push(value); cells.set(key, cell);
    }
}
function candidates<T>(cells: Map<string, T[]>, polygon: Point[]) {
  const b = bounds(polygon), result = new Set<T>();
  for (let x = Math.floor(b.minX / STEP); x <= Math.floor(b.maxX / STEP); x++)
    for (let z = Math.floor(b.minZ / STEP); z <= Math.floor(b.maxZ / STEP); z++)
      for (const value of cells.get(`${x}:${z}`) ?? []) result.add(value);
  return result;
}
function hull(points: Point[]) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.z - b.z), lower: Point[] = [], upper: Point[] = [],
    cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  for (const p of sorted) { while (lower.length > 1 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0) lower.pop(); lower.push(p); }
  for (const p of [...sorted].reverse()) { while (upper.length > 1 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0) upper.pop(); upper.push(p); }
  lower.pop(); upper.pop(); return [...lower, ...upper];
}
function triangleHeight(face: Face, point: Point) {
  const [a, b, c] = face.polygon,
    d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
  if (Math.abs(d) < 1e-12) return undefined;
  const u = ((b.z - c.z) * (point.x - c.x) + (c.x - b.x) * (point.z - c.z)) / d,
    v = ((c.z - a.z) * (point.x - c.x) + (a.x - c.x) * (point.z - c.z)) / d,
    w = 1 - u - v;
  if (Math.min(u, v, w) < -1e-7) return undefined;
  return u * face.heights[0] + v * face.heights[1] + w * face.heights[2];
}
function rockGeometry(variant: number) {
  const body: Geometry = { positions: [], indices: [], colors: [], uvs: [] },
    snow: Geometry = { positions: [], indices: [], colors: [], uvs: [] },
    palette = ["#8D8980", "#A69983", "#AFA188", "#7F888B", "#AAA494", "#998D7C"],
    color = Color3.FromHexString(palette[variant]);
  for (let ring = 0; ring < 4; ring++) for (let i = 0; i < 8; i++) {
    const a = Math.PI * 2 * i / 8 + (random(i, variant + 31) - .5) * .09,
      radius = (.94 + random(i, variant + 41) * .12) * [1, .97, .78, .43][ring],
      offsetX = ring > 1 ? (random(variant, 77) - .5) * .16 : 0,
      offsetZ = ring > 1 ? (random(variant, 91) - .5) * .14 : 0,
      y = ring === 0 ? 0 : [0, .25, .65, .94][ring] + (random(i * 17 + ring, variant + 11) - .5) * .10,
      tone = .94 + random(i * 7 + ring, variant + 79) * .12;
    body.positions.push(Math.cos(a) * radius + offsetX, y, Math.sin(a) * radius + offsetZ);
    body.colors.push(color.r * tone, color.g * tone, color.b * tone, 1);
    body.uvs.push(i / 8, y * .70);
  }
  const snowy = (a: number, b: number, c: number) => {
    const first = snow.positions.length / 3;
    for (const id of [a, b, c]) {
      snow.positions.push(body.positions[id * 3], body.positions[id * 3 + 1] + .012, body.positions[id * 3 + 2]);
      snow.colors.push(.955, .968, .987, 1); snow.uvs.push(body.uvs[id * 2], body.uvs[id * 2 + 1]);
    }
    snow.indices.push(first, first + 1, first + 2);
  };
  for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8, a = ring * 8 + i, b = ring * 8 + j, c = (ring + 1) * 8 + j, d = (ring + 1) * 8 + i;
    // Babylon LH normals use (a - b) × (c - b); wind the outer skin accordingly.
    body.indices.push(a, b, c, a, c, d);
    if (ring === 2 && (i + variant * 3) % 8 < 5) { snowy(a, b, c); snowy(a, c, d); }
  }
  for (let i = 1; i < 7; i++) {
    body.indices.push(0, i + 1, i, 24, 24 + i, 24 + i + 1);
    if ((i + variant) % 5 !== 0) snowy(24, 24 + i, 24 + i + 1);
  }
  return { body, snow, footprint: hull(Array.from({ length: 32 }, (_, i) =>
    ({ x: body.positions[i * 3], z: body.positions[i * 3 + 2] }))) };
}

/** Add real, grounded rock volumes only after the complete authored scenery exists. */
export function buildMountainRocks(scene: Scene): AbstractMesh[] {
  if (scene.isDisposed) return [];
  const mineral = new Map<string, Face[]>(), barriers = new Map<string, Point[][]>(), faces: Face[] = [];
  const terrain = scene.meshes.filter(m => /^landscape-terrain-(mineral|snow)-/.test(m.name));
  const blockedMeshes = scene.meshes.filter(m => m.name === "landscape-agriculture" ||
    m.name === "landscape-rivers" || /carriageway|ballast|road-.*shoulders/.test(m.name));
  for (const mesh of [...terrain, ...blockedMeshes]) {
    const positions = mesh.getVerticesData("position"), indices = mesh.getIndices(); if (!positions || !indices) continue;
    const matrix = mesh.computeWorldMatrix(true), isMineral = terrain.includes(mesh);
    for (let i = 0; i < indices.length; i += 3) {
      const world = [0, 1, 2].map(j => Vector3.TransformCoordinates(Vector3.FromArray(positions, indices[i + j] * 3), matrix)),
        polygon = world.map(p => ({ x: p.x, z: p.z })),
        area = Math.abs((polygon[1].x - polygon[0].x) * (polygon[2].z - polygon[0].z) -
          (polygon[2].x - polygon[0].x) * (polygon[1].z - polygon[0].z)) / 2;
      if (area < 1e-10) continue;
      if (!isMineral) { insert(barriers, polygon, polygon); continue; }
      const x = polygon.reduce((sum, p) => sum + p.x, 0) / 3,
        z = polygon.reduce((sum, p) => sum + p.z, 0) / 3,
        band = mountainFaceSurvey(x, z)?.band ?? 0,
        alpine = band >= 100000 && band < 110000 || band >= 2000000 && band < 4560000,
        pyrenean = band >= 110000 && band < 120000 || band >= 4560000 && band < 7120000;
      if (!alpine && !pyrenean) continue;
      const face = { polygon, heights: world.map(p => p.y), area, alpine }; faces.push(face); insert(mineral, polygon, face);
    }
  }
  const rectangles = (minX: number, maxX: number, minZ: number, maxZ: number) =>
    [{ x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }];
  for (const node of scene.transformNodes) {
    const plant = node.metadata?.authoredAsset && ["oak", "beech", "pine", "cypress", "olive", "orchard"].includes(node.metadata?.asset),
      building = node.metadata?.domestic || node.metadata?.monument || node.metadata?.schoolSite ||
        /^(factory-|hospital-|power-plant|station-)/.test(node.name);
    if (plant || building) {
      node.computeWorldMatrix(true); const b = node.getHierarchyBoundingVectors(), pad = plant ? .009 : .025,
        polygon = rectangles(b.min.x - pad, b.max.x + pad, b.min.z - pad, b.max.z + pad);
      if (polygon.every(p => Number.isFinite(p.x) && Number.isFinite(p.z))) insert(barriers, polygon, polygon);
    }
    if (Array.isArray(node.metadata?.projectSites)) for (const site of node.metadata.projectSites) {
      const polygon = rectangles(node.position.x + site.x - .25, node.position.x + site.x + .25,
        node.position.z + site.z - .24, node.position.z + site.z + .24); insert(barriers, polygon, polygon);
    }
  }
  const surfaceAt = (point: Point) => {
    let height = -Infinity;
    for (const face of mineral.get(`${Math.floor(point.x / STEP)}:${Math.floor(point.z / STEP)}`) ?? []) {
      const y = triangleHeight(face, point); if (y !== undefined) height = Math.max(height, y);
    }
    return height;
  };
  const stone = new StandardMaterial("mountain-rock-stone", scene), snow = new StandardMaterial("mountain-rock-snow", scene);
  stone.diffuseColor = snow.diffuseColor = Color3.White();
  stone.specularColor = new Color3(.024, .025, .026); stone.ambientColor = new Color3(.13, .14, .15);
  snow.specularColor = new Color3(.065, .075, .085); snow.specularPower = 20; snow.ambientColor = new Color3(.15, .17, .20);
  const designs = Array.from({ length: 6 }, (_, i) => rockGeometry(i)), output: AbstractMesh[] = [],
    templates = new Map<string, Mesh>(), placements: Array<{ x: number; z: number; radius: number; height: number; floor: number; groundMinimum: number; groundMaximum: number; alpine: boolean; snowy: boolean; footprint: Point[] }> = [];
  const template = (variant: number, snowy: boolean) => {
    const key = `${variant}:${snowy}`, found = templates.get(key); if (found) return found;
    const shape = snowy ? designs[variant].snow : designs[variant].body,
      mesh = new Mesh(`mountain-rock-${snowy ? "snow" : "stone"}-template-${variant}`, scene), data = new VertexData(), normals: number[] = [];
    VertexData.ComputeNormals(shape.positions, shape.indices, normals);
    data.positions = shape.positions; data.indices = shape.indices; data.normals = normals; data.colors = shape.colors; data.uvs = shape.uvs;
    data.applyToMesh(mesh); mesh.convertToFlatShadedMesh(); mesh.material = snowy ? snow : stone;
    // InstancedMesh inherits this flag from its shared source.
    mesh.receiveShadows = true;
    mesh.metadata = { assetTemplate: true, mountainRockTemplate: true }; mesh.isPickable = false; mesh.setEnabled(false);
    templates.set(key, mesh); output.push(mesh); return mesh;
  };
  const ranked = faces.map((face, i) => ({ face, i, priority: -Math.log(Math.max(1e-8, random(i, 103))) / face.area }))
    .sort((a, b) => a.priority - b.priority);
  let alpineCount = 0, pyreneanCount = 0;
  for (const { face, i } of ranked) {
    if (alpineCount >= 250 && pyreneanCount >= 55) break;
    if (face.alpine ? alpineCount >= 250 : pyreneanCount >= 55) continue;
    const x = face.polygon.reduce((sum, p) => sum + p.x, 0) / 3,
      z = face.polygon.reduce((sum, p) => sum + p.z, 0) / 3,
      y = surfaceAt({ x, z }); if (y < .31 || !Number.isFinite(y)) continue;
    const size = random(i, 137), radius = size < .18 ? .12 + random(i, 139) * .035 :
      size < .69 ? .065 + random(i, 149) * .035 : .036 + random(i, 151) * .024,
      variant = Math.floor(random(i, 157) * designs.length) % designs.length,
      levelsAround = [surfaceAt({ x: x - .014, z }), surfaceAt({ x: x + .014, z }),
        surfaceAt({ x, z: z - .014 }), surfaceAt({ x, z: z + .014 })],
      contour = levelsAround.every(Number.isFinite) ?
        Math.atan2(levelsAround[1] - levelsAround[0], levelsAround[3] - levelsAround[2]) : random(i, 163) * Math.PI * 2,
      angle = contour + (random(i, 163) - .5) * .70, c = Math.cos(angle), s = Math.sin(angle),
      scaleZ = .40 + random(i, 167) * .25,
      footprint = designs[variant].footprint.map(p => ({ x: x + radius * (p.x * c + p.z * scaleZ * s),
        z: z + radius * (-p.x * s + p.z * scaleZ * c) }));
    if (placements.some(p => Math.hypot(p.x - x, p.z - z) < (p.radius + radius) * .42)) continue;
    const samples = [...footprint, { x, z }, ...footprint.map((p, j) => ({
      x: (p.x + footprint[(j + 1) % footprint.length].x) / 2,
      z: (p.z + footprint[(j + 1) % footprint.length].z) / 2 }))];
    if (samples.some(p => !landContains(p.x, p.z) || riverContains(p.x, p.z, .035))) continue;
    const padded = footprint.map(p => ({ x: x + (p.x - x) * 1.10, z: z + (p.z - z) * 1.10 }));
    if ([...candidates(barriers, padded)].some(p => overlapping(p, padded))) continue;
    const levels = samples.map(surfaceAt); if (levels.some(h => !Number.isFinite(h))) continue;
    const lowest = Math.min(...levels), highest = Math.max(...levels),
      height = Math.max(radius * (.75 + random(i, 173) * .25), highest - lowest + .042);
    if (height > .24 || height > radius * 2.20) continue;
    const floor = lowest - .006,
      snowy = y + height * .70 > .51 && random(i, 179) > .22;
    for (const white of snowy ? [false, true] : [false]) {
      const instance = template(variant, white).createInstance(`mountain-rock-${white ? "snow" : "stone"}-${placements.length}`);
      instance.position.set(x, floor, z); instance.rotation.y = angle; instance.scaling.set(radius, height, radius * scaleZ);
      instance.isPickable = false; instance.setEnabled(true);
      // The closed stone volume casts the silhouette; its thin snow skin must not duplicate it.
      instance.metadata = { assetInstance: true, mountainRock: true, castsShadow: !white };
      output.push(instance);
    }
    placements.push({ x, z, radius, height, floor, groundMinimum: lowest, groundMaximum: highest, alpine: face.alpine, snowy, footprint });
    if (face.alpine) alpineCount++; else pyreneanCount++;
  }
  scene.metadata = { ...scene.metadata, mountainRocks: { count: placements.length, alpineCount, pyreneanCount,
    templates: templates.size, sourceTriangles: faces.length, placements,
    method: "Actual mineral triangles and full scenery footprints, grounded below the lowest true soil sample; shared rock/snow geometry." } };
  mineral.clear(); barriers.clear();
  return output;
}
