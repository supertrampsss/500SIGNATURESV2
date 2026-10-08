import type { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import Delaunator from "delaunator";
import { MAP_CONTEXT_COUNTRIES } from "./map-context-geography.ts";
import { FRANCE_OUTLINES } from "./map-geography.ts";
import { mapPosition } from "./map-state.ts";

type Point = { x: number; z: number };
const franceRings = FRANCE_OUTLINES.map(ring =>
  ring.slice(0, -1).map(([lon, lat]) => mapPosition(lon, lat)),
);
const franceBounds = {
  minimumX: Math.min(...franceRings.flat().map(point => point.x)),
  maximumX: Math.max(...franceRings.flat().map(point => point.x)),
  minimumZ: Math.min(...franceRings.flat().map(point => point.z)),
  maximumZ: Math.max(...franceRings.flat().map(point => point.z)),
};

function hash(x: number, z: number): number {
  let value = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function noise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const smooth = (value: number) => value * value * (3 - 2 * value);
  const tx = smooth(x - ix), tz = smooth(z - iz);
  const mix = (a: number, b: number, ratio: number) => a + (b - a) * ratio;
  return mix(
    mix(hash(ix, iz), hash(ix + 1, iz), tx),
    mix(hash(ix, iz + 1), hash(ix + 1, iz + 1), tx),
    tz,
  );
}

function franceDistance(x: number, z: number): number {
  const dx = Math.max(franceBounds.minimumX - x, 0, x - franceBounds.maximumX);
  const dz = Math.max(franceBounds.minimumZ - z, 0, z - franceBounds.maximumZ);
  if (Math.hypot(dx, dz) > 0.7) return 0.7;
  let distance = 0.7;
  for (const ring of franceRings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const sx = b.x - a.x, sz = b.z - a.z;
      const squared = sx * sx + sz * sz;
      const ratio = squared > 0
        ? Math.max(0, Math.min(1, ((x - a.x) * sx + (z - a.z) * sz) / squared))
        : 0;
      distance = Math.min(distance, Math.hypot(x - a.x - sx * ratio, z - a.z - sz * ratio));
    }
  }
  return distance;
}

function contains(point: Point, ring: ReadonlyArray<Point>): boolean {
  let result = false;
  for (let i = 0, previous = ring.length - 1; i < ring.length; previous = i++) {
    const a = ring[previous], b = ring[i];
    const dx = b.x - a.x, dz = b.z - a.z;
    const cross = dx * (point.z - a.z) - dz * (point.x - a.x);
    if (
      Math.abs(cross) < 1e-8 &&
      point.x >= Math.min(a.x, b.x) - 1e-8 &&
      point.x <= Math.max(a.x, b.x) + 1e-8 &&
      point.z >= Math.min(a.z, b.z) - 1e-8 &&
      point.z <= Math.max(a.z, b.z) + 1e-8
    ) return true;
    if (
      (a.z > point.z) !== (b.z > point.z) &&
      point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x
    ) result = !result;
  }
  return result;
}

function contextHeight(x: number, z: number): number {
  const hill = (cx: number, cz: number, sx: number, sz: number, height: number) =>
    height * Math.exp(-(((x - cx) / sx) ** 2 + ((z - cz) / sz) ** 2));
  // These small undulations belong to the miniature, not to simulation data.
  const alpine = mapPosition(9, 46.4);
  const british = mapPosition(-3.5, 53.2);
  const iberian = mapPosition(-3.4, 41);
  const relief =
    0.022 + noise(x * 1.25 + 4, z * 1.25 + 18) * 0.075 +
    noise(x * 4.1 + 32, z * 4.1 + 7) * 0.036;
  const ridge = (1 - Math.abs(noise(x * 8.5 + 31, z * 8.5 + 9) * 2 - 1)) ** 2;
  const highlands =
    hill(alpine.x, alpine.z, 2.1, 0.9, 0.19) * (0.45 + ridge * 0.55) +
    hill(british.x, british.z, 1.2, 1.5, 0.086) +
    hill(iberian.x, iberian.z, 2.8, 1.4, 0.075);
  // Lower the actual frontier, preserving land continuity without overlapping France.
  const frontier = Math.max(0, Math.min(1, (franceDistance(x, z) - 0.3) / 0.35));
  return Math.min(0.3, 0.03 + (relief + highlands) * frontier);
}

/** Geographic surroundings, kept below the brighter playable France terrain. */
export function buildMapContext(scene: Scene): { meshes: Mesh[] } {
  const positions: number[] = [], indices: number[] = [], colors: number[] = [], uvs: number[] = [];
  const sidePositions: number[] = [], sideIndices: number[] = [], sideColors: number[] = [];
  const forestPositions: number[] = [], forestIndices: number[] = [], forestColors: number[] = [];
  const trunkPositions: number[] = [], trunkIndices: number[] = [], trunkColors: number[] = [];

  const cone = (
    x: number, z: number, base: number, radius: number, height: number,
    trunk = false,
  ) => {
    const vertices = trunk ? trunkPositions : forestPositions;
    const faces = trunk ? trunkIndices : forestIndices;
    const vertexColors = trunk ? trunkColors : forestColors;
    const offset = vertices.length / 3;
    const sides = 6;
    const tint = hash(Math.round(x * 91), Math.round(z * 83)) * 0.035;
    for (let i = 0; i < sides; i++) {
      const angle = i * Math.PI * 2 / sides;
      vertices.push(x + Math.cos(angle) * radius, base, z + Math.sin(angle) * radius);
      vertexColors.push(...(trunk ? [0.13, 0.105, 0.08, 1] : [0.065 + tint, 0.13 + tint, 0.09 + tint, 1]));
    }
    vertices.push(x, base + height, z);
    vertexColors.push(...(trunk ? [0.16, 0.13, 0.1, 1] : [0.13 + tint, 0.195 + tint, 0.145 + tint, 1]));
    for (let i = 0; i < sides; i++) faces.push(offset + i, offset + (i + 1) % sides, offset + sides);
  };

  MAP_CONTEXT_COUNTRIES.forEach((country, countryIndex) => {
    let trees = 0;
    for (const coordinates of country.outlines) {
      const ring = coordinates.slice(0, -1).map(([lon, lat]) => mapPosition(lon, lat));
      if (ring.length < 3) continue;
      const points = [...ring];
      const minimumX = Math.min(...ring.map(point => point.x));
      const maximumX = Math.max(...ring.map(point => point.x));
      const minimumZ = Math.min(...ring.map(point => point.z));
      const maximumZ = Math.max(...ring.map(point => point.z));
      const spacing = 0.17;
      for (let x = minimumX + spacing / 2; x < maximumX; x += spacing) {
        for (let z = minimumZ + spacing / 2; z < maximumZ; z += spacing) {
          const point = { x, z };
          if (!contains(point, ring)) continue;
          points.push(point);
          if (
            trees < 42 &&
            franceDistance(x, z) > 0.3 &&
            noise(x * 1.8 + 3, z * 1.8 + 13) > 0.6 &&
            hash(Math.round(x * 90), Math.round(z * 90)) > 0.79
          ) {
            const jitterX = (hash(Math.round(x * 121), Math.round(z * 111)) - 0.5) * 0.06;
            const jitterZ = (hash(Math.round(x * 75), Math.round(z * 71)) - 0.5) * 0.06;
            const treeX = x + jitterX, treeZ = z + jitterZ;
            if (!contains({ x: treeX, z: treeZ }, ring) || franceDistance(treeX, treeZ) <= 0.3) continue;
            const base = contextHeight(treeX, treeZ);
            const height = 0.12 + hash(Math.round(x * 73), Math.round(z * 63)) * 0.05;
            cone(treeX, treeZ, base, 0.014, height * 0.36, true);
            cone(treeX, treeZ, base + height * 0.15, 0.051, height * 0.65);
            cone(treeX, treeZ, base + height * 0.41, 0.039, height * 0.59);
            trees++;
          }
        }
      }

      const offset = positions.length / 3;
      for (const point of points) {
        const height = contextHeight(point.x, point.z);
        positions.push(point.x, height, point.z);
        const variation =
          noise(point.x * 2.1 + 7, point.z * 2.1 + 39) * 0.048;
        const forest = noise(point.x * 1.8 + 3, point.z * 1.8 + 13) > 0.6;
        const tint = (countryIndex % 3) * 0.005;
        colors.push(
          (forest ? 0.125 : 0.19) + variation + tint,
          (forest ? 0.18 : 0.235) + variation + tint,
          (forest ? 0.145 : 0.205) + variation + tint,
          1,
        );
        uvs.push(point.x * 0.31, point.z * 0.31);
      }
      const triangles = Delaunator.from(points, point => point.x, point => point.z).triangles;
      for (let i = 0; i < triangles.length; i += 3) {
        const a = triangles[i], b = triangles[i + 1], c = triangles[i + 2];
        const p = points[a], q = points[b], r = points[c];
        const centroid = { x: (p.x + q.x + r.x) / 3, z: (p.z + q.z + r.z) / 3 };
        if (!contains(centroid, ring)) continue;
        // Reject long triangles crossing an inlet or the outside of a concave coast.
        if (![[p, q], [q, r], [r, p]].every(([start, end]) =>
          contains({ x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 }, ring),
        )) continue;
        const winding = (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
        indices.push(offset + a, ...(winding > 0 ? [offset + b, offset + c] : [offset + c, offset + b]));
      }

      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const index = sidePositions.length / 3;
        sidePositions.push(
          a.x, contextHeight(a.x, a.z), a.z,
          b.x, contextHeight(b.x, b.z), b.z,
          b.x, -0.12, b.z,
          a.x, -0.12, a.z,
        );
        sideIndices.push(index, index + 1, index + 2, index, index + 2, index + 3);
        for (let vertex = 0; vertex < 4; vertex++) {
          const shade = vertex < 2 ? 0.135 : 0.085;
          sideColors.push(shade, shade + 0.018, shade + 0.02, 1);
        }
      }
    }
  });

  const material = new StandardMaterial("context-dark-stone", scene);
  material.diffuseColor = Color3.White();
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;
  const textureSize = 128;
  const pixels = new Uint8Array(textureSize * textureSize * 4);
  for (let y = 0; y < textureSize; y++) {
    for (let x = 0; x < textureSize; x++) {
      const shade = 193 + noise(x * 0.085, y * 0.085) * 35 + hash(x, y) * 25;
      const offset = (y * textureSize + x) * 4;
      pixels.set([shade, shade, shade, 255], offset);
    }
  }
  const texture = RawTexture.CreateRGBATexture(pixels, textureSize, textureSize, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  texture.name = "context-local-earth-grain";
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  material.diffuseTexture = texture;
  const vegetation = new StandardMaterial("context-forest", scene);
  vegetation.diffuseColor = Color3.White();
  vegetation.specularColor = Color3.Black();
  vegetation.backFaceCulling = false;
  const build = (
    name: string, vertices: number[], faces: number[], vertexColors: number[],
    surfaceUvs?: number[],
  ) => {
    const mesh = new Mesh(name, scene);
    const data = new VertexData();
    data.positions = vertices;
    data.indices = faces;
    data.normals = [];
    data.colors = vertexColors;
    if (surfaceUvs) data.uvs = surfaceUvs;
    VertexData.ComputeNormals(vertices, faces, data.normals);
    data.applyToMesh(mesh);
    mesh.material = surfaceUvs ? material : vegetation;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.freezeWorldMatrix();
    return mesh;
  };
  const meshes = [
    build("context-surface", positions, indices, colors, uvs),
    build("context-cliffs", sidePositions, sideIndices, sideColors),
    build("context-forest", forestPositions, forestIndices, forestColors),
    build("context-trunks", trunkPositions, trunkIndices, trunkColors),
  ];
  return { meshes };
}
