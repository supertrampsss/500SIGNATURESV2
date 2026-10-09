import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MAP_PLACES, mapPosition } from "./map-state.ts";
import { AUTHORED_PROJECT_RESERVATIONS } from "./map-urban-plans.ts";

type Point = { x: number; z: number };
export type MineralFractureFace = {
  mesh: AbstractMesh; polygon: Point[]; heights: number[];
  band: number; alpine: boolean;
};
type Sample = Point & { y: number; frozen: boolean; bands: Set<number>; depth: number; layered: boolean };
type Bedding = { x: number; z: number; nx: number; ny: number; nz: number; count: number;
  dx: number; dz: number; width: number; joint: number; phase: number; slope: number };

// The existing .026 mineral grid supplies all vertices. No new triangle,
// height-field query, GLB scan or per-face scan of the full obstacle list.
const MAX_FACES = 70_000;
const MAX_COORDINATES = 160_000;
const MAX_LOCAL_CANDIDATES = 256;
const MAX_FACE_CELLS = 64;
const MAX_BARRIER_TESTS = 500_000;
const MAX_BUFFER_VERTICES = 210_000;
const MAX_PUBLIC_TRIANGLES = 12_000;
const MAX_ADDED_INDEX_REFERENCES = 32_000;

function key(p: Point) { return `${p.x}:${p.z}`; }
function edgeKey(a: string, b: string) { return a < b ? `${a}|${b}` : `${b}|${a}`; }
function fraction(value: number) { return value - Math.floor(value); }
function random(a: number, b: number) {
  let n = Math.imul(a + 43, 374761393) ^ Math.imul(b + 173, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function extent(polygon: Point[]) {
  return { minX: Math.min(...polygon.map(p => p.x)), maxX: Math.max(...polygon.map(p => p.x)),
    minZ: Math.min(...polygon.map(p => p.z)), maxZ: Math.max(...polygon.map(p => p.z)) };
}
// Include touching edges, unlike the placement test: a whole contact triangle
// must stay byte-identical even if its occupied polygon only touches a corner.
function touching(a: Point[], b: Point[]) {
  for (const polygon of [a, b]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length], nx = p.z - q.z, nz = q.x - p.x;
    let lowA = Infinity, highA = -Infinity, lowB = Infinity, highB = -Infinity;
    for (const v of a) { const s = v.x * nx + v.z * nz; lowA = Math.min(lowA, s); highA = Math.max(highA, s); }
    for (const v of b) { const s = v.x * nx + v.z * nz; lowB = Math.min(lowB, s); highB = Math.max(highB, s); }
    if (highA < lowB - 1e-10 || highB < lowA - 1e-10) return false;
  }
  return true;
}

/** Cut exposed mineral faces only after every original rock has been seated.
 * The caller supplies its already-built spatial obstacle index and exact rock
 * hulls. An exceeded work budget leaves the complete original terrain intact.
 */
export function fractureMineralTerrain(
  scene: Scene, faces: MineralFractureFace[], barriers: Map<string, Point[][]>,
  rockFootprints: Point[][], step: number,
) {
  const report = { version: 37, status: "skipped", reason: "", sourceTriangles: faces.length,
    barrierTests: 0, protectedTriangles: 0, frozenCoordinates: 0, movedCoordinates: 0, layeredCoordinates: 0,
    maximumDepth: 0, originalVertices: 0, outputVertices: 0,
    addedTriangles: 0, addedVertices: 0, queriedHeights: 0, scannedGLBs: 0 };
  const skip = (reason: string) => {
    report.reason = reason; scene.metadata = { ...scene.metadata, mineralFractures: report };
  };
  if (scene.isDisposed || !faces.length) return skip("No live mineral surface");
  if (faces.length > MAX_FACES || !(step > 0)) return skip("Face/index work budget");
  const meshes = [...new Set(faces.map(face => face.mesh))];
  // Production terrain is in world coordinates before static batching. Refuse
  // another transform rather than guessing at a contact or changing its frame.
  for (const mesh of meshes) if (mesh.parent || mesh.position.x || mesh.position.y || mesh.position.z ||
    mesh.rotation.x || mesh.rotation.y || mesh.rotation.z || mesh.rotationQuaternion ||
    mesh.scaling.x !== 1 || mesh.scaling.y !== 1 || mesh.scaling.z !== 1)
    return skip("Unexpected terrain transform");

  let addedReferences = 0;
  const register = (polygon: Point[]) => {
    const b = extent(polygon), minX = Math.floor(b.minX / step), maxX = Math.floor(b.maxX / step),
      minZ = Math.floor(b.minZ / step), maxZ = Math.floor(b.maxZ / step),
      cells = (maxX - minX + 1) * (maxZ - minZ + 1);
    if (!Number.isFinite(cells) || cells > MAX_FACE_CELLS ||
      addedReferences + cells > MAX_ADDED_INDEX_REFERENCES) return false;
    addedReferences += cells;
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      const cellKey = `${x}:${z}`, cell = barriers.get(cellKey) ?? [];
      cell.push(polygon); barriers.set(cellKey, cell);
    }
    return true;
  };
  for (const polygon of rockFootprints) {
    const cx = polygon.reduce((sum, p) => sum + p.x / polygon.length, 0),
      cz = polygon.reduce((sum, p) => sum + p.z / polygon.length, 0);
    if (!register(polygon.map(p => {
      const dx = p.x - cx, dz = p.z - cz, length = Math.hypot(dx, dz) || 1,
        scale = 1.025 + .006 / length;
      return { x: cx + dx * scale, z: cz + dz * scale };
    }))) return skip("Added rock-index work budget");
  }
  // Empty project sites are protected too, using the same effective authored
  // centres as the terrain and city builders, even before they contain a model.
  for (const [town, sites] of Object.entries(AUTHORED_PROJECT_RESERVATIONS)) {
    const place = MAP_PLACES[town as keyof typeof MAP_PLACES], origin = mapPosition(place.lon, place.lat);
    for (const site of sites!) if (!register([
      { x: origin.x + site.x - .25, z: origin.z + site.z - .24 },
      { x: origin.x + site.x + .25, z: origin.z + site.z - .24 },
      { x: origin.x + site.x + .25, z: origin.z + site.z + .24 },
      { x: origin.x + site.x - .25, z: origin.z + site.z + .24 },
    ])) return skip("Added project-index work budget");
  }
  let publicTriangles = 0;
  for (const mesh of scene.meshes) if (mesh.metadata?.authoredPublicGround) {
    const positions = mesh.getVerticesData("position"), indices = mesh.getIndices();
    if (!positions || !indices) continue;
    publicTriangles += indices.length / 3;
    if (publicTriangles > MAX_PUBLIC_TRIANGLES) return skip("Public-ground work budget");
    const matrix = mesh.computeWorldMatrix(true);
    for (let i = 0; i < indices.length; i += 3) if (!register([0, 1, 2].map(j => {
      const p = Vector3.TransformCoordinates(Vector3.FromArray(positions, indices[i + j] * 3), matrix);
      return { x: p.x, z: p.z };
    }))) return skip("Added public-ground index work budget");
  }

  const points = new Map<string, Sample>(), edges = new Map<string, { a: string; b: string; count: number }>(),
    beds = new Map<number, Bedding>(), faceKeys = new Map<MineralFractureFace, string[]>();
  for (const face of faces) {
    const keys = face.polygon.map(key); faceKeys.set(face, keys);
    for (const [i, p] of face.polygon.entries()) {
      let point = points.get(keys[i]);
      if (!point) {
        point = { ...p, y: face.heights[i], frozen: false, bands: new Set(), depth: 0, layered: false };
        points.set(keys[i], point);
      }
      if (!Number.isFinite(p.x + p.z + face.heights[i])) return skip("Nonfinite mineral coordinate");
      // Equal XZ need not mean equal Y in a layered geological input. Preserve
      // every copy and its own old normal, without abandoning unrelated faces.
      if (Math.abs(point.y - face.heights[i]) > 1e-7) {
        if (!point.layered) report.layeredCoordinates++;
        point.layered = true; point.frozen = true;
      }
      point.bands.add(face.band);
      const a = keys[i], b = keys[(i + 1) % 3], edge = edgeKey(a, b), previous = edges.get(edge);
      if (previous) previous.count++; else edges.set(edge, { a, b, count: 1 });
    }
    if (points.size > MAX_COORDINATES) return skip("Coordinate work budget");
    const [a, b, c] = face.polygon, [ay, by, cy] = face.heights,
      abx = a.x - b.x, aby = ay - by, abz = a.z - b.z,
      cbx = c.x - b.x, cby = cy - by, cbz = c.z - b.z,
      nx = aby * cbz - abz * cby, ny = abz * cbx - abx * cbz, nz = abx * cby - aby * cbx,
      length = Math.hypot(nx, ny, nz), frame = beds.get(face.band) ??
        { x: 0, z: 0, nx: 0, ny: 0, nz: 0, count: 0, dx: 0, dz: 0, width: 0, joint: 0, phase: 0, slope: 0 };
    if (!(length > 1e-12) || !(ny > 0)) return skip("Invalid existing mineral winding");
    frame.x += (a.x + b.x + c.x) / 3; frame.z += (a.z + b.z + c.z) / 3;
    frame.nx += nx / length; frame.ny += ny / length; frame.nz += nz / length; frame.count++;
    beds.set(face.band, frame);

    // Lower mineral slopes remain untouched and spend no obstacle queries.
    const highFace = Math.min(...face.heights) >= .34 &&
      face.heights.reduce((sum, height) => sum + height / 3, 0) >= .42;
    if (!highFace) {
      report.protectedTriangles++;
      for (const pointKey of keys) points.get(pointKey)!.frozen = true;
      continue;
    }
    const bounds = extent(face.polygon), candidates = new Set<Point[]>(),
      minX = Math.floor(bounds.minX / step), maxX = Math.floor(bounds.maxX / step),
      minZ = Math.floor(bounds.minZ / step), maxZ = Math.floor(bounds.maxZ / step);
    let protectedFace = (maxX - minX + 1) * (maxZ - minZ + 1) > MAX_FACE_CELLS;
    if (!protectedFace) {
      search: for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++)
        for (const polygon of barriers.get(`${x}:${z}`) ?? []) {
          candidates.add(polygon);
          if (candidates.size > MAX_LOCAL_CANDIDATES) { protectedFace = true; break search; }
        }
    }
    if (!protectedFace) for (const polygon of candidates) {
      if (++report.barrierTests > MAX_BARRIER_TESTS) return skip("Local obstacle work budget");
      if (touching(face.polygon, polygon)) { protectedFace = true; break; }
    }
    if (protectedFace) {
      report.protectedTriangles++;
      for (const pointKey of keys) points.get(pointKey)!.frozen = true;
    }
  }
  for (const edge of edges.values()) if (edge.count !== 2) {
    points.get(edge.a)!.frozen = true; points.get(edge.b)!.frozen = true;
  }
  // Preserve the original geological edges as well as the external mineral
  // boundary. Fractures cut inside those rock planes, never their silhouettes.
  for (const point of points.values()) if (point.bands.size !== 1) point.frozen = true;
  for (const [band, frame] of beds) {
    frame.x /= frame.count; frame.z /= frame.count;
    const length = Math.hypot(frame.nx, frame.nz);
    frame.dx = length > 1e-8 ? -frame.nx / length : Math.cos(.35);
    frame.dz = length > 1e-8 ? -frame.nz / length : Math.sin(.35);
    frame.slope = length / frame.ny;
    frame.width = .072 + random(band, 31) * .018;
    frame.joint = .095 + random(band, 37) * .030;
    frame.phase = random(band, 43);
  }
  const local = (p: Point, frame: Bedding) => {
    const x = p.x - frame.x, z = p.z - frame.z;
    return { along: x * frame.dx + z * frame.dz, across: -x * frame.dz + z * frame.dx };
  };
  for (const point of points.values()) {
    if (point.frozen) { report.frozenCoordinates++; continue; }
    const band = point.bands.values().next().value!, frame = beds.get(band)!, p = local(point, frame),
      bed = fraction(p.along / frame.width + frame.phase),
      // Short steep cuts meet broader inclined beds. This is directional
      // relief, not random boulder placement or one pit per render triangle.
      ledge = bed < .17 ? bed / .17 : bed < .49 ? 1 - (bed - .17) / .32 * .66 : (1 - bed) / .51 * .34,
      joint = Math.max(0, 1 - Math.abs(fraction(p.across / frame.joint + frame.phase +
        Math.sin(p.along * 11 + frame.phase * 5) * .16) - .52) / .18),
      altitude = Math.max(0, Math.min(1, (point.y - .30) / .18)),
      slope = Math.max(0, Math.min(1, (frame.slope - .18) / .65));
    point.depth = (.018 + random(band, 47) * .020) * (.72 * ledge + .28 * joint) * altitude * slope;
    if (point.depth > 1e-6) report.movedCoordinates++;
    report.maximumDepth = Math.max(report.maximumDepth, point.depth);
  }
  if (!report.movedCoordinates) return skip("No unoccupied fracture coordinates");

  const normalSums = new Map<string, { x: number; y: number; z: number }>();
  for (const face of faces) {
    const current = faceKeys.get(face)!.map(pointKey => points.get(pointKey)!), [a, b, c] = current,
      [ay, by, cy] = face.heights,
      abx = a.x - b.x, aby = ay - a.depth - by + b.depth, abz = a.z - b.z,
      cbx = c.x - b.x, cby = cy - c.depth - by + b.depth, cbz = c.z - b.z,
      nx = aby * cbz - abz * cby, ny = abz * cbx - abx * cbz, nz = abx * cby - aby * cbx,
      length = Math.hypot(nx, ny, nz);
    // Same LH cross product and per-face normalization as ComputeNormals.
    if (!(length > 1e-12) || !(ny > 0)) return skip("Invalid sculpted winding");
    for (const point of current) {
      if (point.frozen || point.depth <= 1e-6) continue;
      const pointKey = `${key(point)}|${face.band}`, sum = normalSums.get(pointKey) ?? { x: 0, y: 0, z: 0 };
      sum.x += nx / length; sum.y += ny / length; sum.z += nz / length; normalSums.set(pointKey, sum);
    }
  }
  const output: Array<{ mesh: AbstractMesh; positions: number[]; normals: number[] }> = [];
  for (const mesh of meshes) {
    const original = mesh.getVerticesData("position"), oldNormals = mesh.getVerticesData("normal");
    if (!original || !oldNormals) return skip("Missing original mineral attribute");
    report.originalVertices += original.length / 3;
    if (report.originalVertices > MAX_BUFFER_VERTICES) return skip("Buffer vertex work budget");
    const positions = Array.from(original), normals = Array.from(oldNormals);
    for (let i = 0; i < positions.length; i += 3) {
      const pointKey = key({ x: positions[i], z: positions[i + 2] }), point = points.get(pointKey);
      if (!point || point.frozen || point.depth <= 1e-6) continue;
      const band = point.bands.values().next().value!,
        normal = normalSums.get(`${pointKey}|${band}`), length = normal ? Math.hypot(normal.x, normal.y, normal.z) : 0;
      if (!normal || !(length > 0) || !Number.isFinite(length)) return skip("Invalid fracture normal");
      positions[i + 1] -= point.depth;
      normals[i] = normal.x / length; normals[i + 1] = normal.y / length; normals[i + 2] = normal.z / length;
    }
    output.push({ mesh, positions, normals });
  }
  // Commit only after every bounded preparation step succeeds. All contact
  // triangles keep their original XYZ/normals. Indices, colours and UV buffers
  // are not rewritten at all, and no vertex or triangle is added.
  for (const { mesh, positions, normals } of output) {
    mesh.setVerticesData("position", positions, false);
    mesh.setVerticesData("normal", normals, false);
    mesh.refreshBoundingInfo({});
  }
  report.outputVertices = report.originalVertices;
  report.status = "applied"; report.reason = "Exposed existing geological faces only";
  scene.metadata = { ...scene.metadata, mineralFractures: report };
}
