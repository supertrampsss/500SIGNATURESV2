import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

type Positions = NonNullable<ReturnType<AbstractMesh["getVerticesData"]>>;
type GeometryIndex = { positions: Positions; byHeight: number[]; projections: number[]; finite: boolean; buffer?: object | null; raw?: unknown; vertices: number };
const geometryIndices = new WeakMap<object, GeometryIndex>();

// Imported static kits share immutable geometry. Updatable buffers deliberately
// bypass this cache; a replaced buffer reference also rebuilds its index.
function indexFor(mesh: AbstractMesh): GeometryIndex | undefined {
  const source = (mesh as AbstractMesh & { sourceMesh?: Mesh }).sourceMesh ?? mesh as Mesh,
    buffer = source.getVertexBuffer?.("position"), raw = buffer?.getData(),
    updatable = buffer?.isUpdatable() ?? false,
    key = source.geometry,
    existing = key && !updatable ? geometryIndices.get(key) : undefined,
    vertices = source.getTotalVertices?.() ?? 0;
  // Strided GLB accessors can create a fresh float view on every call. Match
  // their actual vertex buffer and raw immutable data before extracting it.
  if (existing && buffer && existing.buffer === buffer && existing.raw === raw && existing.vertices === vertices) return existing;
  const positions = mesh.getVerticesData("position");
  if (!positions?.length) return undefined;
  if (existing?.positions === positions) return existing;
  const byHeight: number[] = [], projections: number[] = [], projected = new Set<string>();
  let finite = true;
  for (let i = 0; i < positions.length; i += 3) {
    finite &&= Number.isFinite(positions[i]) && Number.isFinite(positions[i + 1]) && Number.isFinite(positions[i + 2]);
    byHeight.push(i);
    const pair = `${positions[i]}:${positions[i + 2]}`;
    if (!projected.has(pair)) { projected.add(pair); projections.push(i); }
  }
  byHeight.sort((a, b) => positions[a + 1] - positions[b + 1] || a - b);
  const index = { positions, byHeight, projections, finite, buffer, raw, vertices };
  if (key && !updatable) geometryIndices.set(key, index);
  return index;
}

/** Actual lowest world vertex and ordered points below a world-space ceiling. */
export function geometryContactFrame(mesh: AbstractMesh) {
  const index = indexFor(mesh), matrix = mesh.computeWorldMatrix(true);
  if (!index) return { minimumY: Infinity, below: (_ceiling: number): Vector3[] => [] };
  const { positions } = index, m = matrix.m,
    world = (i: number) => Vector3.TransformCoordinates(Vector3.FromArray(positions, i), matrix),
    affine = m[3] === 0 && m[7] === 0 && m[11] === 0 && m[15] === 1,
    vertical = affine && m[1] === 0 && m[9] === 0 && m[5] !== 0 && index.finite && m.every(Number.isFinite);
  if (!vertical) {
    const vertices = index.byHeight.map((_i, n) => world(n * 3));
    return { minimumY: Math.min(...vertices.map(p => p.y)), below: (ceiling: number) => vertices.filter(p => p.y <= ceiling) };
  }
  const at = (n: number) => index.byHeight[m[5] > 0 ? n : index.byHeight.length - 1 - n],
    minimumY = world(at(0)).y;
  return {
    minimumY,
    below(ceiling: number) {
      let low = 0, high = index.byHeight.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (world(at(middle)).y <= ceiling) low = middle + 1;
        else high = middle;
      }
      const selected = Array.from({ length: low }, (_value, n) => at(n)).sort((a, b) => a - b);
      return selected.map(world);
    },
  };
}

/** Exact XZ input set for the caller's existing world-space convex hull. */
export function geometryProjectionVertices(mesh: AbstractMesh): Vector3[] {
  const index = indexFor(mesh), matrix = mesh.computeWorldMatrix(true);
  if (!index) return [];
  const { positions } = index, m = matrix.m,
    horizontal = m[3] === 0 && m[7] === 0 && m[11] === 0 && m[15] === 1 &&
      m[4] === 0 && m[6] === 0 && index.finite && m.every(Number.isFinite),
    indices = horizontal ? index.projections : Array.from({ length: positions.length / 3 }, (_value, i) => i * 3);
  // Keep every distinct projection, including collinear and interior points.
  // Pre-transform convex-hull reduction would alter floating-point boundary ties.
  return indices.map(i => Vector3.TransformCoordinates(Vector3.FromArray(positions, i), matrix));
}
