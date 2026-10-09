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
import { fractureMineralTerrain, type MineralFractureFace } from "./map-mineral-fractures.ts";

type Point = { x: number; z: number };
type Face = MineralFractureFace & { area: number };
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
    palette = ["#AA947B", "#B59D80", "#C0AA8B", "#7B8289", "#9F8E7B", "#A18B73"],
    color = Color3.FromHexString(palette[variant]),
    angles = [-.10, .88, 2.07, 3.33, 4.36, 5.47],
    radii = [1.02, .91, 1.05, .88, .99, .86],
    shoulderRadii = [.76, .86, .72, .83, .68, .89],
    shoulderLevels = [.28, .43, .32, .41, .26, .38],
    upperRadii = [.44, .64, .55, .61, .43, .54],
    upperLevels = [.53, .65, .62, .57, .68, .56],
    phase = (random(variant, 201) - .5) * .46,
    leanX = (random(variant, 203) - .5) * .18,
    leanZ = (random(variant, 207) - .5) * .14,
    rotate = (x: number, z: number) => ({ x: x * Math.cos(phase) - z * Math.sin(phase),
      z: x * Math.sin(phase) + z * Math.cos(phase) });
  const vertex = (x: number, y: number, z: number, tone: number) => {
    const p = rotate(x, z);
    body.positions.push(p.x, y, p.z);
    body.colors.push(color.r * tone, color.g * tone, color.b * tone, 1);
    body.uvs.push((p.x + 1.1) / 2.2, y * .70);
  };
  // Unequal sides, independently stepped shoulders and a leaning upper rim.
  // These are geological wedges; there is no concentric rounded crown.
  for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 6; i++) {
    const corner = (i + variant) % 6,
      radius = ring === 0 ? radii[i] : ring === 1 ? shoulderRadii[corner] : upperRadii[corner],
      y = ring === 0 ? 0 : (ring === 1 ? shoulderLevels[corner] : upperLevels[corner]) +
        (random(i + ring * 19, variant + 211) - .5) * .045,
      x = Math.cos(angles[i]) * radius + (ring === 0 ? 0 : leanX * (ring === 1 ? .45 : 1)),
      z = Math.sin(angles[i]) * radius + (ring === 0 ? 0 : leanZ * (ring === 1 ? .45 : 1));
    vertex(x, y, z, .94 + random(i + ring * 7, variant + 223) * .12);
  }
  // A short, off-centre two-point crest makes broad oblique facets without a needle.
  vertex(leanX + .235, [.99, .92, 1, .95, .98, .94][variant], leanZ + .055, 1.02);
  vertex(leanX - .205, [.87, 1, .88, .99, .91, .98][variant], leanZ - .045, .97);
  const snowy = (a: number, b: number, c: number, face: number) => {
    if ((face + variant * 3) % 8 === 2 || (face + variant * 3) % 8 === 7) return;
    const p = [a, b, c].map(id => ({ x: body.positions[id * 3], y: body.positions[id * 3 + 1],
      z: body.positions[id * 3 + 2] })),
      ab = { x: p[0].x - p[1].x, y: p[0].y - p[1].y, z: p[0].z - p[1].z },
      cb = { x: p[2].x - p[1].x, y: p[2].y - p[1].y, z: p[2].z - p[1].z },
      nx = ab.y * cb.z - ab.z * cb.y, ny = ab.z * cb.x - ab.x * cb.z,
      nz = ab.x * cb.y - ab.y * cb.x;
    if (ny / Math.hypot(nx, ny, nz) < .24) return;
    const line = .49 + random(face, variant + 227) * .07,
      patch: Array<{ x: number; y: number; z: number }> = [];
    // Clip the actual facet by local altitude, then expose a narrow stone border.
    for (let i = 0; i < p.length; i++) {
      const first = p[i], last = p[(i + 1) % p.length];
      if (first.y >= line) patch.push(first);
      if ((first.y >= line) !== (last.y >= line)) {
        const t = (line - first.y) / (last.y - first.y);
        patch.push({ x: first.x + (last.x - first.x) * t, y: line,
          z: first.z + (last.z - first.z) * t });
      }
    }
    if (patch.length < 3) return;
    const centre = patch.reduce((sum, v) => ({ x: sum.x + v.x / patch.length,
      y: sum.y + v.y / patch.length, z: sum.z + v.z / patch.length }), { x: 0, y: 0, z: 0 }),
      inset = .94 + random(face, variant + 229) * .04,
      first = snow.positions.length / 3;
    for (const v of patch) {
      const x = centre.x + (v.x - centre.x) * inset, y = centre.y + (v.y - centre.y) * inset,
        z = centre.z + (v.z - centre.z) * inset;
      snow.positions.push(x, y + .012, z); snow.colors.push(.985, .985, .975, 1);
      snow.uvs.push((x + 1.1) / 2.2, y * .70);
    }
    for (let i = 1; i < patch.length - 1; i++) snow.indices.push(first, first + i, first + i + 1);
  };
  // Split only the upper facets into shallow broken ledges. Every old edge
  // and the closed supporting base remain intact; the new point lies below
  // the old facet, inside its original convex envelope and XZ footprint.
  const brokenFacet = (a: number, b: number, c: number, face: number, crest: boolean) => {
    const points = [a, b, c].map(id => ({ x: body.positions[id * 3],
      y: body.positions[id * 3 + 1], z: body.positions[id * 3 + 2] })),
      ab = { x: points[0].x - points[1].x, y: points[0].y - points[1].y, z: points[0].z - points[1].z },
      cb = { x: points[2].x - points[1].x, y: points[2].y - points[1].y, z: points[2].z - points[1].z },
      nx = ab.y * cb.z - ab.z * cb.y, ny = ab.z * cb.x - ab.x * cb.z,
      nz = ab.x * cb.y - ab.y * cb.x,
      upward = ny / Math.hypot(nx, ny, nz),
      x = points.reduce((sum, p) => sum + p.x / 3, 0),
      z = points.reduce((sum, p) => sum + p.z / 3, 0),
      averageY = points.reduce((sum, p) => sum + p.y / 3, 0),
      cut = upward > .06 ? (crest ? .075 : .008) + random(face, variant + 239) * (crest ? .035 : .010) : 0,
      y = Math.max(Math.min(...points.map(p => p.y)) + .008, averageY - cut),
      middle = body.positions.length / 3;
    body.positions.push(x, y, z);
    for (let channel = 0; channel < 3; channel++) body.colors.push(
      [a, b, c].reduce((sum, id) => sum + body.colors[id * 4 + channel] / 3, 0));
    body.colors.push(1); body.uvs.push((x + 1.1) / 2.2, y * .70);
    for (const [i, [u, v]] of [[a, b], [b, c], [c, a]].entries()) {
      body.indices.push(u, v, middle); snowy(u, v, middle, face * 3 + i);
    }
  };
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6, a = ring * 6 + i, b = ring * 6 + j,
      c = (ring + 1) * 6 + j, d = (ring + 1) * 6 + i;
    // Babylon LH: exterior normals are (a - b) × (c - b).
    if (ring === 0) body.indices.push(a, b, c, a, c, d);
    else {
      brokenFacet(a, b, c, 20 + i * 2, false);
      brokenFacet(a, c, d, 21 + i * 2, false);
    }
  }
  for (let i = 1; i < 5; i++) body.indices.push(0, i + 1, i);
  const roof = [[18, 12, 13], [18, 13, 14], [18, 14, 19], [19, 14, 15],
    [19, 15, 16], [19, 16, 17], [19, 17, 18], [18, 17, 12]];
  for (const [i, [a, b, c]] of roof.entries()) {
    brokenFacet(a, b, c, 100 + i, true);
  }
  return { body, snow, footprint: hull(Array.from({ length: body.positions.length / 3 }, (_, i) =>
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
      const face = { mesh, band,
        polygon, heights: world.map(p => p.y), area, alpine };
      faces.push(face); insert(mineral, polygon, face);
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
      snowy = y + height * .70 > (face.alpine ? .44 : .36) &&
        random(i, 179) > (face.alpine ? .08 : .24);
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
  // Sculpt only unoccupied ground after all original stone/snow seats exist.
  fractureMineralTerrain(scene, faces, barriers, placements.map(p => p.footprint), STEP);
  mineral.clear(); barriers.clear();
  return output;
}
