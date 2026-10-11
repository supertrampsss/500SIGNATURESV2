type Point = [number, number, number];
type GroundPoint = { x: number; z: number };
export type GroundTriangles = { positions: ArrayLike<number>; indices: ArrayLike<number> };

/** Index actual rendered triangles without duplicating their vertex arrays.
 * Only triangles touching the requested foundation are expanded and clipped. */
export class GroundSurvey {
  private readonly cells = new Map<string, number[]>();
  private readonly first: number[] = [];
  private readonly meshForTriangle: Uint16Array;

  constructor(private readonly meshes: GroundTriangles[]) {
    if (meshes.length > 65535) throw new Error("Too many ground surveys.");
    this.meshForTriangle = new Uint16Array(meshes.reduce((sum, mesh) => sum + mesh.indices.length / 3, 0));
    let triangle = 0;
    for (let meshId = 0; meshId < meshes.length; meshId++) {
      const { positions, indices } = meshes[meshId];
      this.first.push(triangle);
      for (let at = 0; at < indices.length; at += 3, triangle++) {
        this.meshForTriangle[triangle] = meshId;
        const a = indices[at] * 3, b = indices[at + 1] * 3, c = indices[at + 2] * 3,
          minX = Math.floor(Math.min(positions[a], positions[b], positions[c]) / .10),
          maxX = Math.floor(Math.max(positions[a], positions[b], positions[c]) / .10),
          minZ = Math.floor(Math.min(positions[a + 2], positions[b + 2], positions[c + 2]) / .10),
          maxZ = Math.floor(Math.max(positions[a + 2], positions[b + 2], positions[c + 2]) / .10);
        for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
          const key = `${x}:${z}`, cell = this.cells.get(key) ?? [];
          cell.push(triangle); this.cells.set(key, cell);
        }
      }
    }
  }

  triangles(outline: GroundPoint[]): Point[][] {
    const minX = Math.min(...outline.map(p => p.x)), maxX = Math.max(...outline.map(p => p.x)),
      minZ = Math.min(...outline.map(p => p.z)), maxZ = Math.max(...outline.map(p => p.z)),
      triangles = new Set<number>();
    for (let x = Math.floor(minX / .10); x <= Math.floor(maxX / .10); x++)
      for (let z = Math.floor(minZ / .10); z <= Math.floor(maxZ / .10); z++)
        for (const triangle of this.cells.get(`${x}:${z}`) ?? []) triangles.add(triangle);
    return [...triangles].map(triangle => {
      const meshId = this.meshForTriangle[triangle], { positions, indices } = this.meshes[meshId],
        at = (triangle - this.first[meshId]) * 3;
      return [0, 1, 2].map(j => {
        const k = indices[at + j] * 3; return [positions[k], positions[k + 1], positions[k + 2]];
      }) as Point[];
    });
  }

  levels(outline: GroundPoint[]): number[] {
    const polygon = [...outline], signedArea = polygon.reduce((sum, p, i) => {
      const q = polygon[(i + 1) % polygon.length]; return sum + p.x * q.z - q.x * p.z;
    }, 0), levels: number[] = [];
    if (signedArea < 0) polygon.reverse();
    for (let clipped of this.triangles(polygon)) {
      // Extrema of a plane occur at the vertices of its clipped footprint.
      for (let edge = 0; edge < polygon.length && clipped.length; edge++) {
        const a = polygon[edge], b = polygon[(edge + 1) % polygon.length],
          side = (p: Point) => (b.x - a.x) * (p[2] - a.z) - (b.z - a.z) * (p[0] - a.x),
          next: Point[] = [];
        for (let i = 0; i < clipped.length; i++) {
          const p = clipped[i], q = clipped[(i + 1) % clipped.length], sp = side(p), sq = side(q);
          if (sp >= -1e-10) next.push(p);
          if ((sp < 0) !== (sq < 0)) {
            const t = sp / (sp - sq);
            next.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
          }
        }
        clipped = next;
      }
      levels.push(...clipped.map(p => p[1]));
    }
    return levels;
  }
}
