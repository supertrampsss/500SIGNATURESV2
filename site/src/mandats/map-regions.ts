import type { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MAP_REGION_LINES } from "./map-region-geography.ts";
import { landContains, landHeight } from "./map-landscape.ts";
import { mapPosition } from "./map-state.ts";

/** Fine interior boundaries follow the same surveyed soil as the miniature. */
export function buildRegionBoundaries(scene: Scene): Mesh[] {
  const positions: number[] = [], indices: number[] = [];
  for (const line of MAP_REGION_LINES) {
    for (let i = 1; i < line.length; i++) {
      const a = mapPosition(...line[i - 1]), b = mapPosition(...line[i]);
      const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
      if (length < .00001) continue;
      const nx = -dz / length * .0035, nz = dx / length * .0035;
      const steps = Math.max(1, Math.ceil(length / .025));
      for (let step = 0; step < steps; step++) {
        const t0 = step / steps, t1 = (step + 1) / steps;
        const points = [[t0, -1], [t1, -1], [t1, 1], [t0, 1]].map(([t, side]) => ({
          x: a.x + dx * t + nx * side, z: a.z + dz * t + nz * side,
        }));
        if (points.some(p => !landContains(p.x, p.z))) continue;
        const base = positions.length / 3;
        for (const p of points) positions.push(p.x, landHeight(p.x, p.z) + .014, p.z);
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
  }
  const mesh = new Mesh("country-region-boundaries", scene), data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = [];
  VertexData.ComputeNormals(positions, indices, data.normals);
  data.applyToMesh(mesh);
  const material = new StandardMaterial("country-region-boundaries", scene);
  material.diffuseColor = Color3.FromHexString("#E8DEBD");
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;
  mesh.material = material;
  mesh.isPickable = false;
  mesh.metadata = { castsShadow: false };
  return [mesh];
}
