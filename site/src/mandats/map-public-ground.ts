import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

type GroundPoint = { x: number; z: number };
type Polygon = GroundPoint[];
const cross = (a: GroundPoint, b: GroundPoint, p: GroundPoint) =>
  (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
const area = (polygon: Polygon) => polygon.reduce((sum, a, i) => {
  const b = polygon[(i + 1) % polygon.length];
  return sum + a.x * b.z - b.x * a.z;
}, 0) / 2;

function split(polygon: Polygon, a: GroundPoint, b: GroundPoint, direction: number) {
  const inside: Polygon = [], outside: Polygon = [],
    shore = Math.hypot(b.x - a.x, b.z - a.z) * .0015;
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length],
      dp = cross(a, b, p) * direction + shore,
      dq = cross(a, b, q) * direction + shore;
    (dp >= 0 ? inside : outside).push(p);
    if ((dp >= 0) !== (dq >= 0)) {
      const t = dp / (dp - dq), point = {
        x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t,
      };
      inside.push(point);
      outside.push(point);
    }
  }
  return { inside, outside };
}

function subtract(polygon: Polygon, water: Polygon) {
  const pieces: Polygon[] = [], direction = Math.sign(area(water));
  let remaining = polygon;
  for (let i = 0; i < water.length && remaining.length >= 3; i++) {
    const result = split(remaining, water[i], water[(i + 1) % water.length], direction);
    if (result.outside.length >= 3 && Math.abs(area(result.outside)) > 1e-12)
      pieces.push(result.outside);
    remaining = result.inside;
  }
  return pieces;
}

/** Public paving follows the submitted river triangles, including curved banks. */
export function publicGround(scene: Scene, origin: GroundPoint, outline: number[][]) {
  const original = outline.map(([x, z]) => ({ x, z }));
  let polygons: Polygon[] = [original];
  const water = scene.getMeshByName("landscape-rivers"),
    vertices = water?.getVerticesData("position"), indices = water?.getIndices();
  if (water && vertices && indices) {
    const world = water.computeWorldMatrix(true),
      minX = Math.min(...original.map(p => p.x)), maxX = Math.max(...original.map(p => p.x)),
      minZ = Math.min(...original.map(p => p.z)), maxZ = Math.max(...original.map(p => p.z));
    for (let i = 0; i < indices.length; i += 3) {
      const triangle = Array.from({ length: 3 }, (_, j) => {
        const index = indices[i + j] * 3,
          point = Vector3.TransformCoordinates(new Vector3(vertices[index], vertices[index + 1], vertices[index + 2]), world);
        return { x: point.x - origin.x, z: point.z - origin.z };
      });
      if (Math.abs(area(triangle)) < 1e-12 ||
        Math.max(...triangle.map(p => p.x)) < minX || Math.min(...triangle.map(p => p.x)) > maxX ||
        Math.max(...triangle.map(p => p.z)) < minZ || Math.min(...triangle.map(p => p.z)) > maxZ) continue;
      polygons = polygons.flatMap(polygon => subtract(polygon, triangle));
    }
  }
  const contains = (point: GroundPoint) => polygons.some(polygon => {
    const direction = Math.sign(area(polygon));
    return polygon.every((a, i) => cross(a, polygon[(i + 1) % polygon.length], point) * direction >= -1e-10);
  });
  return { polygons, contains };
}
