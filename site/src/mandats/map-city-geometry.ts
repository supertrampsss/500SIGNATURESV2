import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";

export type CityPoint = [number, number, number];

/** Separate vertices preserve sharp miniature edges and provide real face UVs. */
export class CityGeometry {
  positions: number[] = [];
  indices: number[] = [];
  uvs: number[] = [];

  triangle(a: CityPoint, b: CityPoint, c: CityPoint) {
    const index = this.positions.length / 3;
    this.positions.push(...a, ...b, ...c);
    this.indices.push(index, index + 1, index + 2);
    this.uvs.push(0, 1, 0.5, 0, 1, 1);
  }

  quad(a: CityPoint, b: CityPoint, c: CityPoint, d: CityPoint) {
    const index = this.positions.length / 3;
    this.positions.push(...a, ...b, ...c, ...d);
    this.indices.push(index, index + 1, index + 2, index, index + 2, index + 3);
    this.uvs.push(0, 1, 0, 0, 1, 0, 1, 1);
  }

  box(x: number, y: number, z: number, width: number, height: number, depth: number) {
    const x0 = x - width / 2, x1 = x + width / 2,
      y0 = y - height / 2, y1 = y + height / 2,
      z0 = z - depth / 2, z1 = z + depth / 2;
    this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]);
    this.quad([x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]);
    this.quad([x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]);
    this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]);
    this.quad([x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]);
  }

  beam(a: CityPoint, b: CityPoint, size: number) {
    const start = new Vector3(...a), end = new Vector3(...b),
      direction = end.subtract(start).normalize(),
      side = Vector3.Cross(direction, Math.abs(direction.y) > 0.94 ? Vector3.Right() : Vector3.Up()).normalize().scale(size / 2),
      up = Vector3.Cross(side, direction).normalize().scale(size / 2),
      corner = (point: Vector3, sx: number, sy: number): CityPoint => {
        const value = point.add(side.scale(sx)).add(up.scale(sy));
        return [value.x, value.y, value.z];
      };
    const a0 = corner(start, -1, -1), a1 = corner(start, -1, 1),
      a2 = corner(start, 1, 1), a3 = corner(start, 1, -1),
      b0 = corner(end, -1, -1), b1 = corner(end, -1, 1),
      b2 = corner(end, 1, 1), b3 = corner(end, 1, -1);
    this.quad(a3, a2, a1, a0);
    this.quad(b0, b1, b2, b3);
    this.quad(a1, b1, b0, a0);
    this.quad(a2, b2, b1, a1);
    this.quad(a3, b3, b2, a2);
    this.quad(a0, b0, b3, a3);
  }
}

export function createCityMesh(scene: Scene, name: string, shape: CityGeometry, material: StandardMaterial, parent?: TransformNode): Mesh {
  const mesh = new Mesh(name, scene), data = new VertexData();
  data.positions = shape.positions;
  data.uvs = shape.uvs;
  data.indices = shape.indices.slice();
  // Clockwise front faces are Babylon's default left-handed convention.
  for (let i = 0; i < data.indices.length; i += 3) {
    const b = data.indices[i + 1];
    data.indices[i + 1] = data.indices[i + 2];
    data.indices[i + 2] = b;
  }
  data.normals = [];
  VertexData.ComputeNormals(shape.positions, data.indices, data.normals);
  data.applyToMesh(mesh);
  mesh.material = material;
  mesh.parent = parent ?? null;
  mesh.isPickable = false;
  return mesh;
}
