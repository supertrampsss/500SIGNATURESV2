import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { MAP_PLACES, mapPosition } from "./map-state.ts";
import type { MapPlace } from "./map-state.ts";
import { landContains, landHeight } from "./map-landscape.ts";

type Point = [number, number, number];
type GroundPoint = { x: number; z: number };
type Roof = "gable" | "hip" | "mansard" | "flat";
type Region = "paris" | "north" | "breton" | "alsace" | "stone" | "south";
type House = {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  angle?: number;
  region: Region;
  roof?: Roof;
  floors?: number;
  shop?: boolean;
};

/** Face vertices are deliberately separate: the miniature keeps crisp roof edges. */
class Geometry {
  positions: number[] = [];
  indices: number[] = [];

  triangle(a: Point, b: Point, c: Point) {
    const index = this.positions.length / 3;
    this.positions.push(...a, ...b, ...c);
    this.indices.push(index, index + 1, index + 2);
  }

  quad(a: Point, b: Point, c: Point, d: Point) {
    const index = this.positions.length / 3;
    this.positions.push(...a, ...b, ...c, ...d);
    this.indices.push(index, index + 1, index + 2, index, index + 2, index + 3);
  }

  box(x: number, y: number, z: number, width: number, height: number, depth: number) {
    const x0 = x - width / 2,
      x1 = x + width / 2,
      y0 = y - height / 2,
      y1 = y + height / 2,
      z0 = z - depth / 2,
      z1 = z + depth / 2;
    this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]);
    this.quad([x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]);
    this.quad([x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]);
    this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]);
    this.quad([x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]);
  }

  beam(a: Point, b: Point, size: number) {
    const start = new Vector3(...a),
      end = new Vector3(...b),
      direction = end.subtract(start).normalize(),
      side = Vector3.Cross(direction, Math.abs(direction.y) > 0.94 ? Vector3.Right() : Vector3.Up()).normalize().scale(size / 2),
      up = Vector3.Cross(side, direction).normalize().scale(size / 2);
    const corner = (point: Vector3, sx: number, sy: number): Point => {
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

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Static meshes are returned unmerged; map-scene batches them by material. */
export function buildCities(scene: Scene): {
  roots: Map<MapPlace, TransformNode>;
  meshes: Mesh[];
  vehicles: Array<{ mesh: Mesh; path: Vector3[]; phase: number }>;
} {
  const meshes: Mesh[] = [],
    roots = new Map<MapPlace, TransformNode>(),
    vehicles: Array<{ mesh: Mesh; path: Vector3[]; phase: number }> = [],
    bridgeDecks: Array<{ x: number; z: number; angle: number; length: number; y: number }> = [],
    rng = random(729381);

  const material = (name: string, color: string, rough = true) => {
    const value = new StandardMaterial(`city-${name}`, scene);
    value.diffuseColor = Color3.FromHexString(color);
    value.specularColor = rough ? new Color3(0.035, 0.03, 0.025) : new Color3(0.24, 0.28, 0.3);
    value.specularPower = 32;
    return value;
  };
  const stone = material("limestone", "#DCCDB5"),
    pale = material("pale-stucco", "#E4DCCC"),
    sand = material("ochre-stucco", "#C5AD84"),
    brick = material("brick", "#A7654B"),
    pink = material("pink-brick", "#C88E75"),
    slate = material("slate-roofs", "#414D59"),
    tile = material("clay-roofs", "#AA6045"),
    ochreTile = material("old-clay-roofs", "#BB7C52"),
    glass = material("glazing", "#284B58", false),
    timber = material("timber", "#57473B"),
    copper = material("copper", "#718A76"),
    steel = material("iron", "#58646B"),
    cream = material("cornices", "#EFE3CB"),
    pavement = material("pavement", "#A8A593"),
    asphalt = material("asphalt", "#5C6564"),
    markings = material("road-markings", "#DCD9BD"),
    quay = material("quay-stone", "#B1A78E"),
    paint = material("ship-paint", "#E7E3D5"),
    red = material("red-details", "#B65546"),
    sail = material("canvas", "#F2E9D1");
  glass.emissiveColor = new Color3(0.015, 0.028, 0.032);
  sail.backFaceCulling = false;

  let serial = 0;
  const record = (mesh: Mesh, mat: StandardMaterial, parent?: TransformNode) => {
    mesh.material = mat;
    mesh.parent = parent ?? null;
    mesh.isPickable = false;
    meshes.push(mesh);
    return mesh;
  };
  const geometry = (name: string, shape: Geometry, mat: StandardMaterial, parent?: TransformNode) => {
    const mesh = new Mesh(`${name}-${serial++}`, scene),
      data = new VertexData();
    data.positions = shape.positions;
    // Babylon's left-handed front faces use the opposite winding from the
    // conventional cross-product order used by the geometry helpers above.
    data.indices = shape.indices.slice();
    for (let i = 0; i < data.indices.length; i += 3) {
      const b = data.indices[i + 1];
      data.indices[i + 1] = data.indices[i + 2];
      data.indices[i + 2] = b;
    }
    data.normals = [];
    VertexData.ComputeNormals(shape.positions, data.indices, data.normals);
    data.applyToMesh(mesh);
    return record(mesh, mat, parent);
  };
  const box = (name: string, width: number, height: number, depth: number, mat: StandardMaterial, parent?: TransformNode, x = 0, y = 0, z = 0) => {
    const mesh = CreateBox(`${name}-${serial++}`, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    return record(mesh, mat, parent);
  };
  const cylinder = (name: string, diameter: number, height: number, mat: StandardMaterial, parent: TransformNode | undefined, x: number, y: number, z: number, top = diameter, sides = 10) => {
    const mesh = CreateCylinder(`${name}-${serial++}`, { diameterBottom: diameter, diameterTop: top, height, tessellation: sides }, scene);
    mesh.position.set(x, y, z);
    return record(mesh, mat, parent);
  };
  const located = (name: string, root: TransformNode, x: number, z: number, angle = 0) => {
    const node = new TransformNode(`${name}-${serial++}`, scene);
    node.parent = root;
    node.position.set(x, landHeight(root.position.x + x, root.position.z + z) + 0.012 - root.position.y, z);
    node.rotation.y = angle;
    return node;
  };
  const onLand = (root: TransformNode, x: number, z: number, margin = 0) => {
    return [[0, 0], [-margin, -margin], [-margin, margin], [margin, -margin], [margin, margin]].every(([dx, dz]) => landContains(root.position.x + x + dx, root.position.z + z + dz));
  };

  const reservations: Partial<Record<MapPlace, Array<[number, number, number, number]>>> = {
    paris: [[-0.27, 0.01, 0.105, 0.105], [0.29, 0, 0.077, 0.108], [-0.27, 0.27, 0.128, 0.072]],
    lille: [[-0.21, 0.04, 0.055, 0.055], [0.15, 0.28, 0.135, 0.093]],
    rennes: [[0.22, -0.02, 0.068, 0.09], [0.07, 0.29, 0.138, 0.07]],
    nantes: [[0.23, 0.045, 0.072, 0.09], [-0.24, 0.28, 0.128, 0.072]],
    bordeaux: [[0.24, -0.02, 0.128, 0.072], [-0.25, -0.3, 0.065, 0.085]],
    toulouse: [[0.1, 0.3, 0.128, 0.072], [-0.27, 0.04, 0.072, 0.098]],
    lyon: [[-0.31, 0.21, 0.085, 0.105], [0.28, -0.09, 0.128, 0.072]],
    strasbourg: [[0.2, 0, 0.09, 0.12]],
    rouen: [[0.22, 0.015, 0.085, 0.105]],
    montpellier: [[0.17, -0.02, 0.128, 0.072], [-0.17, 0.29, 0.072, 0.095]],
    marseille: [[0.27, 0.26, 0.072, 0.095]],
    ajaccio: [[0.14, -0.14, 0.055, 0.075]],
  };

  for (const [name, place] of Object.entries(MAP_PLACES)) {
    const point = mapPosition(place.lon, place.lat),
      root = new TransformNode(`city-${name}`, scene);
    root.position.set(point.x, landHeight(point.x, point.z) + 0.02, point.z);
    roots.set(name as MapPlace, root);
  }

  const roof = (parent: TransformNode, width: number, depth: number, base: number, height: number, style: Roof, mat: StandardMaterial) => {
    const w = width / 2 + 0.004,
      d = depth / 2 + 0.004,
      shape = new Geometry();
    if (style === "flat") {
      shape.box(0, base + 0.006, 0, width + 0.008, 0.012, depth + 0.008);
    } else if (style === "gable") {
      shape.quad([-w, base, -d], [-w, base, d], [0, base + height, d], [0, base + height, -d]);
      shape.quad([0, base + height, -d], [0, base + height, d], [w, base, d], [w, base, -d]);
      shape.triangle([-w, base, -d], [0, base + height, -d], [w, base, -d]);
      shape.triangle([w, base, d], [0, base + height, d], [-w, base, d]);
    } else if (style === "mansard") {
      const inset = Math.min(width, depth) * 0.14,
        wi = w - inset,
        di = d - inset,
        mid = base + height * 0.78;
      shape.quad([-w, base, -d], [-wi, mid, -di], [wi, mid, -di], [w, base, -d]);
      shape.quad([w, base, -d], [wi, mid, -di], [wi, mid, di], [w, base, d]);
      shape.quad([w, base, d], [wi, mid, di], [-wi, mid, di], [-w, base, d]);
      shape.quad([-w, base, d], [-wi, mid, di], [-wi, mid, -di], [-w, base, -d]);
      shape.quad([-wi, mid, -di], [-wi, mid, di], [wi, mid, di], [wi, mid, -di]);
    } else {
      const ridge = Math.max(0, d - w * 0.8);
      shape.quad([-w, base, -d], [-w, base, d], [0, base + height, ridge], [0, base + height, -ridge]);
      shape.quad([0, base + height, -ridge], [0, base + height, ridge], [w, base, d], [w, base, -d]);
      shape.triangle([-w, base, -d], [0, base + height, -ridge], [w, base, -d]);
      shape.triangle([w, base, d], [0, base + height, ridge], [-w, base, d]);
    }
    geometry("roof", shape, mat, parent);
  };

  const house = (root: TransformNode, spec: House) => {
    if (!onLand(root, spec.x, spec.z, Math.max(spec.width, spec.depth) * 0.58)) return;
    const place = root.name.slice(5) as MapPlace,
      angle = spec.angle ?? 0,
      halfX = (Math.abs(Math.cos(angle)) * spec.width + Math.abs(Math.sin(angle)) * spec.depth) / 2,
      halfZ = (Math.abs(Math.sin(angle)) * spec.width + Math.abs(Math.cos(angle)) * spec.depth) / 2;
    if ((reservations[place] ?? []).some(([x, z, width, depth]) => Math.abs(spec.x - x) < width + halfX && Math.abs(spec.z - z) < depth + halfZ)) return;
    const node = located("house", root, spec.x, spec.z, spec.angle),
      h = spec.height,
      w = spec.width,
      d = spec.depth,
      floors = spec.floors ?? Math.max(2, Math.round(h / 0.045)),
      southern = spec.region === "south",
      wallMaterial = spec.region === "north" ? brick : spec.region === "alsace" ? pale : spec.region === "south" ? (rng() > 0.55 ? pink : sand) : spec.region === "breton" ? (rng() > 0.6 ? pale : stone) : (rng() > 0.68 ? pale : stone),
      roofStyle = spec.roof ?? (spec.region === "paris" ? "mansard" : spec.region === "alsace" || spec.region === "north" ? "gable" : "hip"),
      roofMaterial = southern ? (rng() > 0.55 ? ochreTile : tile) : spec.region === "alsace" ? tile : slate;
    box("facade", w, h, d, wallMaterial, node, 0, h / 2, 0);
    roof(node, w, d, h, southern ? 0.022 : roofStyle === "gable" ? 0.044 : 0.034, roofStyle, roofMaterial);

    const glazing = new Geometry(),
      details = new Geometry(),
      shutters = new Geometry(),
      columns = Math.max(2, Math.round(w / 0.029)),
      windowWidth = Math.min(0.014, w / (columns * 1.9)),
      windowHeight = Math.min(0.021, h / (floors * 1.65));
    for (let floor = 0; floor < floors; floor++) {
      const y = ((floor + 0.52) * h) / floors;
      for (let column = 0; column < columns; column++) {
        const x = ((column + 0.5) * w) / columns - w / 2;
        for (const front of [-1, 1]) {
          const z = front * (d / 2 + 0.001);
          glazing.box(x, y, z, windowWidth, windowHeight, 0.002);
          details.box(x, y + windowHeight / 2 + 0.0018, z + front * 0.0007, windowWidth + 0.004, 0.0025, 0.003);
          if (southern) {
            shutters.box(x - windowWidth * 0.76, y, z + front * 0.001, 0.004, windowHeight + 0.002, 0.002);
            shutters.box(x + windowWidth * 0.76, y, z + front * 0.001, 0.004, windowHeight + 0.002, 0.002);
          }
          if (spec.region === "paris" && floor === 1) {
            details.box(x, y - windowHeight / 2 - 0.002, z + front * 0.003, windowWidth + 0.009, 0.003, 0.008);
            shutters.box(x, y - 0.001, z + front * 0.006, windowWidth + 0.008, 0.0015, 0.0015);
          }
        }
      }
      for (const side of [-1, 1]) {
        glazing.box(side * (w / 2 + 0.001), y, -d * 0.18, 0.002, windowHeight, windowWidth);
        glazing.box(side * (w / 2 + 0.001), y, d * 0.18, 0.002, windowHeight, windowWidth);
      }
      if (floor > 0 && (spec.region === "paris" || spec.region === "stone")) {
        details.box(0, (floor * h) / floors, 0, w + 0.003, 0.0025, d + 0.003);
      }
    }
    glazing.box(0, 0.014, -d / 2 - 0.0015, 0.014, 0.028, 0.003);
    details.box(0, h + 0.001, 0, w + 0.007, 0.004, d + 0.007);
    details.box(0, 0.004, 0, w + 0.003, 0.008, d + 0.003);
    if (spec.shop) {
      glazing.box(-w * 0.26, 0.019, -d / 2 - 0.0016, w * 0.24, 0.025, 0.003);
      glazing.box(w * 0.26, 0.019, -d / 2 - 0.0016, w * 0.24, 0.025, 0.003);
      details.box(0, 0.038, -d / 2 - 0.005, w * 0.86, 0.009, 0.018);
    }
    if (spec.region === "alsace" || spec.region === "breton") {
      const face = -d / 2 - 0.003;
      shutters.box(0, h / 2, face, 0.004, h, 0.003);
      shutters.box(-w / 2 + 0.005, h / 2, face, 0.004, h, 0.003);
      shutters.box(w / 2 - 0.005, h / 2, face, 0.004, h, 0.003);
      for (let floor = 1; floor < floors; floor++) {
        shutters.box(0, (floor * h) / floors, face, w, 0.004, 0.003);
        shutters.beam([-w / 2 + 0.006, ((floor - 0.72) * h) / floors, face], [w / 2 - 0.006, ((floor - 0.05) * h) / floors, face], 0.003);
      }
    }
    if (roofStyle === "mansard") {
      for (const x of [-w * 0.23, w * 0.23]) {
        details.box(x, h + 0.015, -d / 2 + 0.006, 0.015, 0.018, 0.012);
        glazing.box(x, h + 0.015, -d / 2 - 0.0005, 0.008, 0.012, 0.002);
      }
    }
    if (roofStyle !== "flat") details.box(w * 0.2, h + 0.033, d * 0.15, 0.012, 0.033, 0.014);
    geometry("windows-and-doors", glazing, glass, node);
    geometry("cornices-and-lintels", details, cream, node);
    if (shutters.positions.length) geometry("shutters-and-timber", shutters, southern ? copper : timber, node);
  };

  const smooth = (points: GroundPoint[], steps: number): GroundPoint[] => {
    const result: GroundPoint[] = [];
    for (let segment = 0; segment < points.length - 1; segment++) {
      const p0 = points[Math.max(0, segment - 1)],
        p1 = points[segment], p2 = points[segment + 1],
        p3 = points[Math.min(points.length - 1, segment + 2)];
      for (let step = 0; step < steps; step++) {
        const t = step / steps, t2 = t * t, t3 = t2 * t;
        const interpolate = (a: number, b: number, c: number, d: number) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        result.push({ x: interpolate(p0.x, p1.x, p2.x, p3.x), z: interpolate(p0.z, p1.z, p2.z, p3.z) });
      }
    }
    result.push(points[points.length - 1]);
    return result;
  };
  const road = (name: string, points: GroundPoint[], width: number, local = false) => {
    const path = smooth(points, local ? 5 : 12),
      paving = new Geometry(), surface = new Geometry(), paintwork = new Geometry(),
      runs: Vector3[][] = [];
    let run: Vector3[] = [];
    const vehiclePosition = (point: GroundPoint) => {
      let y = landHeight(point.x, point.z) + 0.035;
      for (const bridge of bridgeDecks) {
        const dx = point.x - bridge.x, dz = point.z - bridge.z,
          lateral = dx * Math.cos(bridge.angle) - dz * Math.sin(bridge.angle),
          longitudinal = dx * Math.sin(bridge.angle) + dz * Math.cos(bridge.angle);
        if (Math.abs(lateral) > 0.03 || Math.abs(longitudinal) > bridge.length / 2 + 0.04) continue;
        const ramp = Math.min(1, Math.max(0, (bridge.length / 2 + 0.04 - Math.abs(longitudinal)) / 0.04));
        y = Math.max(y, y + (bridge.y - y) * ramp);
      }
      return new Vector3(point.x, y, point.z);
    };
    const edge = (point: GroundPoint, next: GroundPoint, side: number, breadth: number, lift: number): Point => {
      const dx = next.x - point.x, dz = next.z - point.z,
        length = Math.max(0.0001, Math.hypot(dx, dz)),
        x = point.x - (dz / length) * side * breadth / 2,
        z = point.z + (dx / length) * side * breadth / 2;
      return [x, landHeight(x, z) + lift, z];
    };
    for (let index = 0; index < path.length - 1; index++) {
      const a = path[index], b = path[index + 1],
        following = path[Math.min(path.length - 1, index + 2)],
        next = following.x === b.x && following.z === b.z ? { x: b.x + b.x - a.x, z: b.z + b.z - a.z } : following,
        leftA = edge(a, b, -1, width + 0.012, 0.031),
        rightA = edge(a, b, 1, width + 0.012, 0.031),
        leftB = edge(b, next, -1, width + 0.012, 0.031),
        rightB = edge(b, next, 1, width + 0.012, 0.031),
        lane = [edge(a, b, -1, width, 0.033), edge(a, b, 1, width, 0.033), edge(b, next, 1, width, 0.033), edge(b, next, -1, width, 0.033)] as const,
        stripe = [edge(a, b, -1, 0.0015, 0.034), edge(a, b, 1, 0.0015, 0.034), edge(b, next, 1, 0.0015, 0.034), edge(b, next, -1, 0.0015, 0.034)] as const;
      // Coastlines are hard boundaries. A route never bridges an inlet by accident.
      const valid = [a, b, { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }].every(p => landContains(p.x, p.z)) && [leftA, rightA, leftB, rightB, ...lane, ...stripe].every(p => landContains(p[0], p[2]));
      if (!valid) {
        if (run.length > 1) runs.push(run);
        run = [];
        continue;
      }
      paving.quad(leftA, rightA, rightB, leftB);
      surface.quad(...lane);
      if (!local && index % 3 === 1) {
        paintwork.quad(...stripe);
      }
      if (!run.length) run.push(vehiclePosition(a));
      run.push(vehiclePosition(b));
    }
    if (run.length > 1) runs.push(run);
    if (surface.positions.length) {
      geometry(`${name}-shoulders`, paving, local ? pavement : quay);
      geometry(`${name}-carriageway`, surface, asphalt);
      if (paintwork.positions.length) geometry(`${name}-markings`, paintwork, markings);
    }
    return runs;
  };
  const street = (root: TransformNode, points: Array<[number, number]>, width = 0.025) => {
    road("city-street", points.map(([x, z]) => ({ x: root.position.x + x, z: root.position.z + z })), width, true);
  };

  const square = (root: TransformNode, x: number, z: number, radius: number) => {
    if (!onLand(root, x, z, radius)) return;
    const shape = new Geometry(), sides = 12,
      cx = root.position.x + x, cz = root.position.z + z,
      centre: Point = [cx, landHeight(cx, cz) + 0.018, cz];
    for (let i = 0; i < sides; i++) {
      const a = (i * Math.PI * 2) / sides,
        b = ((i + 1) * Math.PI * 2) / sides,
        p0x = cx + Math.cos(a) * radius, p0z = cz + Math.sin(a) * radius,
        p1x = cx + Math.cos(b) * radius, p1z = cz + Math.sin(b) * radius;
      shape.triangle(centre, [p1x, landHeight(p1x, p1z) + 0.018, p1z], [p0x, landHeight(p0x, p0z) + 0.018, p0z]);
    }
    geometry("town-square", shape, pavement);
    const node = located("fountain", root, x, z);
    cylinder("fountain-basin", radius * 0.34, 0.014, cream, node, 0, 0.007, 0, radius * 0.34, 16);
    cylinder("fountain-water", radius * 0.28, 0.002, glass, node, 0, 0.015, 0, radius * 0.28, 16);
    cylinder("fountain-stem", 0.014, 0.037, stone, node, 0, 0.026, 0, 0.014, 8);
    cylinder("fountain-cup", 0.045, 0.008, cream, node, 0, 0.044, 0, 0.045, 12);
  };

  const church = (root: TransformNode, x: number, z: number, scale = 1, gothic = false, twin = false) => {
    if (!onLand(root, x, z, 0.18 * scale)) return;
    const node = located("cathedral", root, x, z),
      walls = new Geometry(), panes = new Geometry(),
      w = 0.14 * scale, d = 0.26 * scale, h = 0.18 * scale;
    walls.box(0, h / 2, 0, w, h, d);
    walls.box(0, h * 0.37, d * 0.21, w * 1.66, h * 0.74, d * 0.26);
    for (const sx of [-1, 1])
      for (let i = 0; i < 5; i++) {
        const bz = (-0.39 + i * 0.19) * d;
        walls.box(sx * w * 0.54, h * 0.34, bz, 0.019 * scale, h * 0.68, 0.015 * scale);
        panes.box(sx * (w / 2 + 0.001), h * 0.57, bz, 0.002, 0.062 * scale, 0.021 * scale);
      }
    panes.box(0, 0.045 * scale, -d / 2 - 0.001, 0.034 * scale, 0.085 * scale, 0.002);
    geometry("cathedral-stone", walls, stone, node);
    geometry("cathedral-windows", panes, glass, node);
    roof(node, w + 0.006, d + 0.008, h, 0.062 * scale, "gable", slate);
    const towers = twin ? [-w * 0.43, w * 0.43] : [gothic ? -w * 0.38 : 0];
    for (const tx of towers) {
      const tower = new TransformNode("church-tower", scene);
      tower.parent = node;
      tower.position.set(tx, 0, -d * 0.39);
      box("bell-tower", 0.055 * scale, 0.28 * scale, 0.065 * scale, stone, tower, 0, 0.14 * scale, 0);
      const openings = new Geometry();
      for (const sx of [-1, 1]) openings.box(sx * 0.013 * scale, 0.24 * scale, -0.033 * scale, 0.01 * scale, 0.04 * scale, 0.003);
      geometry("belfry-openings", openings, glass, tower);
      box("tower-cornice", 0.063 * scale, 0.009, 0.073 * scale, cream, tower, 0, 0.277 * scale, 0);
      if (gothic) {
        cylinder("spire", 0.077 * scale, 0.21 * scale, slate, tower, 0, 0.384 * scale, 0, 0, 4);
        cylinder("spire-finial", 0.003, 0.026, copper, tower, 0, 0.498 * scale, 0, 0.003, 5);
      } else roof(tower, 0.062 * scale, 0.071 * scale, 0.282 * scale, 0.045 * scale, "hip", slate);
    }
  };

  const civic = (root: TransformNode, x: number, z: number, southern = false) => {
    if (!onLand(root, x, z, 0.15)) return;
    const node = located("civic-building", root, x, z),
      details = new Geometry(), panes = new Geometry();
    box("civic-main", 0.23, 0.095, 0.09, southern ? pink : stone, node, 0, 0.0475, 0);
    box("civic-wing", 0.05, 0.12, 0.11, southern ? pink : stone, node, -0.095, 0.06, 0);
    box("civic-wing", 0.05, 0.12, 0.11, southern ? pink : stone, node, 0.095, 0.06, 0);
    for (const side of [-1, 1]) {
      const wing = new TransformNode("civic-wing-roof", scene);
      wing.parent = node;
      wing.position.x = side * 0.095;
      roof(wing, 0.058, 0.117, 0.12, 0.027, "hip", southern ? tile : slate);
    }
    for (let i = 0; i < 7; i++) {
      const bx = (i - 3) * 0.03;
      details.box(bx, 0.034, -0.058, 0.005, 0.06, 0.009);
      panes.box(bx, 0.062, -0.046, 0.014, 0.037, 0.003);
    }
    details.box(0, 0.004, -0.058, 0.247, 0.008, 0.035);
    details.box(0, 0.011, -0.067, 0.25, 0.006, 0.02);
    details.box(0, 0.067, -0.058, 0.238, 0.007, 0.015);
    geometry("civic-columns-and-steps", details, cream, node);
    geometry("civic-windows", panes, glass, node);
    roof(node, 0.24, 0.096, 0.095, 0.032, "hip", southern ? tile : slate);
    box("civic-clock-house", 0.042, 0.039, 0.043, stone, node, 0, 0.124, 0);
    roof(node, 0.05, 0.05, 0.144, 0.022, "hip", copper);
  };

  const eiffel = (root: TransformNode) => {
    const node = located("eiffel", root, -0.27, 0.01),
      lattice = new Geometry(), decks = new Geometry(),
      levels = [{ y: 0, r: 0.09 }, { y: 0.21, r: 0.047 }, { y: 0.4, r: 0.024 }, { y: 0.63, r: 0.007 }];
    for (let level = 0; level < levels.length - 1; level++) {
      const a = levels[level], b = levels[level + 1];
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          lattice.beam([sx * a.r, a.y, sz * a.r], [sx * b.r, b.y, sz * b.r], level ? 0.006 : 0.01);
        }
      for (let band = 0; band < 4; band++) {
        const t0 = band / 4, t1 = (band + 1) / 4,
          y0 = a.y + (b.y - a.y) * t0, y1 = a.y + (b.y - a.y) * t1,
          r0 = a.r + (b.r - a.r) * t0, r1 = a.r + (b.r - a.r) * t1;
        for (const side of [-1, 1]) {
          lattice.beam([-r0, y0, side * r0], [r1, y1, side * r1], 0.0028);
          lattice.beam([r0, y0, side * r0], [-r1, y1, side * r1], 0.0028);
          lattice.beam([side * r0, y0, -r0], [side * r1, y1, r1], 0.0028);
          lattice.beam([side * r0, y0, r0], [side * r1, y1, -r1], 0.0028);
        }
      }
    }
    decks.box(0, 0.215, 0, 0.134, 0.012, 0.134);
    decks.box(0, 0.403, 0, 0.074, 0.01, 0.074);
    decks.box(0, 0.622, 0, 0.026, 0.017, 0.026);
    lattice.beam([0, 0.63, 0], [0, 0.713, 0], 0.005);
    geometry("eiffel-lattice", lattice, timber, node);
    geometry("eiffel-platforms", decks, steel, node);
  };

  const factory = (root: TransformNode, x: number, z: number, old = false) => {
    if (!onLand(root, x, z, 0.16)) return;
    const node = located("factory", root, x, z),
      panes = new Geometry();
    box("workshop", 0.25, 0.076, 0.15, old ? brick : pale, node, 0, 0.038, 0);
    for (let i = 0; i < 4; i++) {
      const roofNode = new TransformNode("sawtooth-bay", scene);
      roofNode.parent = node;
      roofNode.position.x = -0.094 + i * 0.063;
      roof(roofNode, 0.065, 0.157, 0.076, 0.035, "gable", steel);
      panes.box(roofNode.position.x, 0.067, -0.076, 0.04, 0.032, 0.003);
    }
    panes.box(0.09, 0.021, -0.077, 0.043, 0.038, 0.003);
    geometry("factory-glazing", panes, glass, node);
    cylinder("factory-chimney", 0.024, 0.24, old ? brick : steel, node, -0.105, 0.12, 0.067, 0.018, 10);
    cylinder("chimney-crown", 0.029, 0.008, cream, node, -0.105, 0.237, 0.067, 0.029, 10);
    box("loading-bay", 0.1, 0.023, 0.055, quay, node, 0.015, 0.0115, -0.098);
    box("warehouse-container", 0.055, 0.032, 0.027, red, node, 0.08, 0.035, -0.099);
    box("warehouse-container", 0.055, 0.032, 0.027, steel, node, 0.08, 0.066, -0.099);
  };

  const hospital = (root: TransformNode, x: number, z: number) => {
    if (!onLand(root, x, z, 0.15)) return;
    const node = located("hospital", root, x, z),
      panes = new Geometry(), sign = new Geometry();
    box("hospital-centre", 0.095, 0.13, 0.115, pale, node, 0, 0.065, 0);
    box("hospital-wing", 0.092, 0.083, 0.084, stone, node, -0.089, 0.0415, 0.014);
    box("hospital-wing", 0.092, 0.083, 0.084, stone, node, 0.089, 0.0415, 0.014);
    for (let floor = 0; floor < 3; floor++)
      for (let i = 0; i < 8; i++) panes.box(-0.116 + i * 0.033, 0.023 + floor * 0.026, -0.045, 0.018, 0.015, 0.003);
    panes.box(0, 0.083, -0.059, 0.076, 0.057, 0.003);
    geometry("hospital-glazing", panes, glass, node);
    sign.box(0, 0.124, -0.06, 0.027, 0.008, 0.004);
    sign.box(0, 0.124, -0.06, 0.008, 0.027, 0.004);
    geometry("hospital-cross", sign, red, node);
    roof(node, 0.101, 0.122, 0.13, 0.01, "flat", slate);
  };

  const belfry = (root: TransformNode, x: number, z: number) => {
    if (!onLand(root, x, z, 0.08)) return;
    const node = located("belfry", root, x, z),
      details = new Geometry(), panes = new Geometry();
    box("belfry-stone", 0.074, 0.235, 0.074, brick, node, 0, 0.1175, 0);
    for (let floor = 1; floor < 5; floor++) details.box(0, floor * 0.046, 0, 0.081, 0.005, 0.081);
    for (const face of [-1, 1]) panes.box(0, 0.198, face * 0.038, 0.031, 0.045, 0.003);
    details.box(0, 0.24, 0, 0.093, 0.013, 0.093);
    geometry("belfry-cornices", details, cream, node);
    geometry("belfry-openings", panes, glass, node);
    cylinder("belfry-crown", 0.076, 0.038, stone, node, 0, 0.265, 0, 0.046, 8);
    cylinder("belfry-spire", 0.062, 0.117, slate, node, 0, 0.342, 0, 0, 8);
  };

  const bridge = (root: TransformNode, x: number, z: number, angle: number, length = 0.17) => {
    if (!onLand(root, x, z, length / 2)) return;
    const node = located("river-bridge", root, x, z, angle),
      stonework = new Geometry(), ironwork = new Geometry(), deck = new Geometry();
    bridgeDecks.push({ x: root.position.x + x, z: root.position.z + z, angle, length, y: landHeight(root.position.x + x, root.position.z + z) + 0.073 });
    deck.box(0, 0.054, 0, 0.045, 0.008, length);
    for (const side of [-1, 1]) {
      stonework.box(side * 0.027, 0.045, 0, 0.009, 0.012, length);
      ironwork.box(side * 0.027, 0.068, 0, 0.003, 0.003, length);
      for (let i = 0; i < 7; i++) ironwork.box(side * 0.027, 0.06, (i / 6 - 0.5) * length, 0.003, 0.02, 0.003);
      for (let i = 0; i < 12; i++) {
        const a = Math.PI * i / 12, b = Math.PI * (i + 1) / 12,
          z0 = Math.cos(a) * length * 0.44, z1 = Math.cos(b) * length * 0.44,
          y0 = 0.018 + Math.sin(a) * 0.023, y1 = 0.018 + Math.sin(b) * 0.023;
        stonework.beam([side * 0.026, y0, z0], [side * 0.026, y1, z1], 0.012);
      }
    }
    stonework.box(0, 0.025, -length * 0.45, 0.067, 0.05, 0.018);
    stonework.box(0, 0.025, length * 0.45, 0.067, 0.05, 0.018);
    geometry("bridge-masonry", stonework, cream, node);
    geometry("bridge-rails", ironwork, steel, node);
    geometry("bridge-deck", deck, asphalt, node);
  };

  // Secondary settlements use a leaner facade mesh. They add inhabited routes
  // across the countryside without the detail cost of another large city.
  const cottage = (root: TransformNode, x: number, z: number, angle: number, region: Region, tall = false) => {
    if (!onLand(root, x, z, 0.04)) return;
    const ground = [[-0.035, -0.035], [-0.035, 0.035], [0.035, -0.035], [0.035, 0.035]].map(([dx, dz]) => landHeight(root.position.x + x + dx, root.position.z + z + dz));
    if (Math.max(...ground) - Math.min(...ground) > 0.04) return;
    const node = located("rural-house", root, x, z, angle),
      width = 0.036 + rng() * 0.013,
      depth = 0.051 + rng() * 0.013,
      height = tall ? 0.075 : 0.043 + rng() * 0.02,
      panes = new Geometry(), details = new Geometry(),
      southern = region === "south";
    box("rural-facade", width, height, depth, region === "north" ? brick : southern ? sand : stone, node, 0, height / 2, 0);
    roof(node, width, depth, height, southern ? 0.017 : 0.025, region === "breton" || region === "alsace" ? "gable" : "hip", southern || region === "alsace" ? tile : slate);
    for (let floor = 0; floor < 2; floor++) {
      const y0 = height * (0.22 + floor * 0.43), y1 = y0 + 0.012;
      for (const x0 of [-width * 0.31, width * 0.08]) {
        const x1 = x0 + 0.009, front = -depth / 2 - 0.001, back = depth / 2 + 0.001;
        panes.quad([x0, y0, front], [x0, y1, front], [x1, y1, front], [x1, y0, front]);
        panes.quad([x1, y0, back], [x1, y1, back], [x0, y1, back], [x0, y0, back]);
      }
    }
    panes.quad([-0.005, 0, -depth / 2 - 0.0015], [-0.005, 0.022, -depth / 2 - 0.0015], [0.005, 0.022, -depth / 2 - 0.0015], [0.005, 0, -depth / 2 - 0.0015]);
    details.box(0, height, 0, width + 0.005, 0.003, depth + 0.005);
    details.box(width * 0.2, height + 0.021, depth * 0.13, 0.008, 0.025, 0.009);
    if (region === "breton" || region === "alsace") {
      details.box(0, height / 2, -depth / 2 - 0.002, 0.002, height, 0.002);
      details.box(0, height * 0.5, -depth / 2 - 0.002, width, 0.003, 0.002);
    }
    geometry("rural-windows", panes, glass, node);
    geometry("rural-cornices", details, region === "alsace" ? timber : cream, node);
  };

  const rural = [
    { name: "brest", lon: -4.49, lat: 48.39, region: "breton" },
    { name: "cherbourg", lon: -1.62, lat: 49.64, region: "stone" },
    { name: "morlaix", lon: -3.83, lat: 48.58, region: "breton" },
    { name: "la-rochelle", lon: -1.15, lat: 46.16, region: "stone" },
    { name: "tours", lon: 0.69, lat: 47.39, region: "stone" },
    { name: "orleans", lon: 1.91, lat: 47.9, region: "stone" },
    { name: "reims", lon: 4.03, lat: 49.26, region: "stone" },
    { name: "metz", lon: 6.18, lat: 49.12, region: "north" },
    { name: "dijon", lon: 5.04, lat: 47.32, region: "stone" },
    { name: "besancon", lon: 6.02, lat: 47.24, region: "alsace" },
    { name: "annecy", lon: 6.13, lat: 45.9, region: "stone" },
    { name: "clermont", lon: 3.08, lat: 45.78, region: "stone" },
    { name: "limoges", lon: 1.26, lat: 45.83, region: "stone" },
    { name: "brive", lon: 1.53, lat: 45.16, region: "stone" },
    { name: "agen", lon: 0.62, lat: 44.2, region: "south" },
    { name: "pau", lon: -0.37, lat: 43.3, region: "south" },
    { name: "perpignan", lon: 2.89, lat: 42.7, region: "south" },
    { name: "nice", lon: 7.26, lat: 43.7, region: "south" },
  ] as const;
  const ruralRoots: TransformNode[] = [];
  for (const [index, place] of rural.entries()) {
    const point = mapPosition(place.lon, place.lat);
    if (!landContains(point.x, point.z)) continue;
    const root = new TransformNode(`village-${place.name}`, scene),
      angle = (index % 4 - 1.5) * 0.19,
      streetPoints: Array<[number, number]> = [[-0.15, -0.014], [0, 0], [0.16, 0.026]];
    root.position.set(point.x, landHeight(point.x, point.z) + 0.02, point.z);
    ruralRoots.push(root);
    street(root, streetPoints, 0.013);
    for (let i = 0; i < 6; i++) {
      const x = (i % 3 - 1) * 0.075,
        side = i < 3 ? -1 : 1,
        z = side * (0.046 + (i % 2) * 0.005) + x * 0.08;
      cottage(root, x, z, angle + (side < 0 ? Math.PI : 0), place.region, i === 1);
    }
    if (place.name === "reims" || place.name === "clermont") {
      church(root, 0.17, 0.083, 0.38, place.name === "clermont", place.name === "reims");
    } else if (place.name === "tours" || place.name === "orleans") {
      bridge(root, -0.125, 0.05, -Math.PI / 2, 0.16);
    } else if (place.name === "besancon" || place.name === "pau") {
      const fort = located("small-fort", root, 0.13, 0.11);
      cylinder("fort-tower", 0.05, 0.095, stone, fort, 0, 0.0475, 0, 0.05, 9);
      const battlements = new Geometry();
      for (let i = 0; i < 7; i++) {
        const a = i * Math.PI * 2 / 7;
        battlements.box(Math.cos(a) * 0.023, 0.101, Math.sin(a) * 0.023, 0.012, 0.019, 0.012);
      }
      geometry("fort-battlements", battlements, cream, fort);
      box("fort-wing", 0.093, 0.07, 0.057, stone, fort, -0.055, 0.035, 0.0);
      const wing = new TransformNode("fort-wing-roof", scene);
      wing.parent = fort;
      wing.position.x = -0.055;
      roof(wing, 0.1, 0.06, 0.07, 0.028, "hip", place.region === "south" ? tile : slate);
    } else if (place.name === "agen" || place.name === "brive" || place.name === "limoges") {
      const barn = located("country-barn", root, 0.14, 0.115), panes = new Geometry();
      box("barn-walls", 0.096, 0.046, 0.055, sand, barn, 0, 0.023, 0);
      roof(barn, 0.1, 0.06, 0.046, 0.027, "gable", tile);
      panes.box(0, 0.02, -0.029, 0.032, 0.04, 0.002);
      geometry("barn-doors", panes, timber, barn);
    } else {
      cottage(root, 0.13, 0.11, -0.14, place.region, true);
    }
  }

  // Street-aligned terraces have different profiles and scales, rather than a
  // repeated village tile. Their foundations follow the actual terrain surface.
  const terrace = (root: TransformNode, region: Region, points: Array<[number, number]>, count: number, side: number, width = 0.061, depth = 0.081) => {
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count,
        segment = Math.min(points.length - 2, Math.floor(t * (points.length - 1))),
        local = t * (points.length - 1) - segment,
        a = points[segment], b = points[segment + 1],
        dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz),
        x = a[0] + dx * local - (dz / length) * side * (depth / 2 + 0.025),
        z = a[1] + dz * local + (dx / length) * side * (depth / 2 + 0.025),
        angle = -Math.atan2(dz, dx) + (side > 0 ? 0 : Math.PI);
      house(root, { x, z, width: width * (0.9 + rng() * 0.18), depth, height: region === "paris" ? 0.146 + rng() * 0.046 : region === "north" ? 0.088 + rng() * 0.038 : region === "alsace" ? 0.093 + rng() * 0.037 : region === "south" ? 0.083 + rng() * 0.039 : 0.087 + rng() * 0.04, region, angle, shop: i % 4 === 1 });
    }
  };
  const quarter = (name: MapPlace, region: Region, streets: Array<Array<[number, number]>>, counts: number[], width = 0.061, depth = 0.079) => {
    const root = roots.get(name)!;
    for (let i = 0; i < streets.length; i++) {
      street(root, streets[i], region === "paris" ? 0.033 : 0.023);
      terrace(root, region, streets[i], counts[i], -1, width, depth);
      terrace(root, region, streets[i], counts[i], 1, width, depth);
    }
    return root;
  };

  const paris = quarter("paris", "paris", [
    [[-0.37, -0.26], [-0.08, -0.22], [0.3, -0.23]],
    [[-0.16, -0.06], [0.03, 0.015], [0.29, 0.09]],
    [[-0.2, 0.25], [0.07, 0.23], [0.34, 0.2]],
  ], [8, 6, 6], 0.077, 0.084);
  street(paris, [[-0.08, -0.36], [-0.03, -0.19], [0.01, 0.02], [0.03, 0.2], [0.04, 0.36]], 0.034);
  street(paris, [[-0.35, -0.29], [-0.34, -0.08], [-0.26, 0.11], [-0.23, 0.26]], 0.03);
  eiffel(paris);
  church(paris, 0.29, 0.0, 0.73, false, true);
  civic(paris, -0.27, 0.27);
  square(paris, -0.1, -0.045, 0.049);

  const lille = quarter("lille", "north", [
    [[-0.28, -0.16], [-0.02, -0.14], [0.24, -0.17]],
    [[-0.25, 0.13], [-0.07, 0.08], [0.12, 0.14]],
  ], [7, 5], 0.063, 0.075);
  street(lille, [[-0.08, -0.29], [-0.07, -0.06], [0.04, 0.07], [0.12, 0.24]]);
  factory(lille, 0.15, 0.28, true);
  belfry(lille, -0.21, 0.04);
  square(lille, -0.15, -0.055, 0.054);

  const rennes = quarter("rennes", "breton", [
    [[-0.25, -0.18], [-0.01, -0.13], [0.19, -0.22]],
    [[-0.27, 0.08], [-0.02, 0.055], [0.19, 0.13]],
  ], [6, 6], 0.056, 0.074);
  street(rennes, [[-0.09, -0.27], [-0.1, -0.08], [-0.07, 0.1], [0.03, 0.25]]);
  church(rennes, 0.22, -0.02, 0.66);
  hospital(rennes, 0.07, 0.29);
  square(rennes, -0.09, -0.015, 0.049);

  const nantes = quarter("nantes", "stone", [
    [[-0.24, -0.13], [-0.03, -0.15], [0.22, -0.08]],
    [[-0.24, 0.12], [-0.02, 0.1], [0.18, 0.17]],
  ], [6, 6], 0.055, 0.072);
  street(nantes, [[0, -0.26], [0.015, -0.01], [0.02, 0.25]]);
  church(nantes, 0.23, 0.045, 0.68, false, true);
  civic(nantes, -0.24, 0.28);
  square(nantes, -0.045, -0.025, 0.052);

  const bordeaux = quarter("bordeaux", "stone", [
    [[-0.25, -0.13], [-0.05, -0.14], [0.19, -0.19]],
    [[-0.24, 0.13], [-0.02, 0.13], [0.21, 0.08]],
    [[-0.15, 0.3], [0.015, 0.28], [0.23, 0.25]],
  ], [6, 6, 5], 0.06, 0.074);
  street(bordeaux, [[-0.015, -0.29], [-0.006, 0.04], [0.015, 0.36]]);
  civic(bordeaux, 0.24, -0.02);
  church(bordeaux, -0.25, -0.3, 0.62, false, true);
  square(bordeaux, -0.075, 0.015, 0.058);

  const toulouse = quarter("toulouse", "south", [
    [[-0.25, -0.19], [-0.025, -0.14], [0.21, -0.18]],
    [[-0.22, 0.12], [-0.04, 0.075], [0.19, 0.16]],
  ], [6, 6], 0.063, 0.074);
  street(toulouse, [[-0.03, -0.27], [-0.01, 0.02], [0.035, 0.29]]);
  civic(toulouse, 0.1, 0.3, true);
  church(toulouse, -0.27, 0.04, 0.7);
  square(toulouse, -0.025, -0.035, 0.053);

  const lyon = quarter("lyon", "stone", [
    [[-0.3, -0.16], [-0.14, -0.18], [0.095, -0.25]],
    [[-0.24, 0.06], [-0.075, 0.11], [0.22, 0.08]],
    [[-0.15, 0.27], [0.065, 0.26], [0.27, 0.2]],
  ], [5, 6, 5], 0.061, 0.076);
  street(lyon, [[0.02, -0.33], [0.02, -0.075], [0.04, 0.095], [0.035, 0.36]]);
  church(lyon, -0.31, 0.21, 0.76, false, true);
  civic(lyon, 0.28, -0.09);
  square(lyon, -0.105, -0.065, 0.052);

  const strasbourg = quarter("strasbourg", "alsace", [
    [[-0.25, -0.19], [-0.04, -0.12], [0.15, -0.2]],
    [[-0.27, 0.13], [-0.055, 0.09], [0.17, 0.16]],
  ], [6, 6], 0.054, 0.071);
  street(strasbourg, [[-0.04, -0.28], [-0.06, -0.06], [-0.04, 0.16], [0.02, 0.31]]);
  church(strasbourg, 0.2, 0.0, 0.9, true);
  square(strasbourg, -0.065, -0.04, 0.048);

  const rouen = quarter("rouen", "breton", [
    [[-0.26, -0.14], [-0.055, -0.15], [0.19, -0.09]],
    [[-0.22, 0.13], [-0.025, 0.11], [0.19, 0.18]],
  ], [6, 6], 0.057, 0.072);
  street(rouen, [[-0.04, -0.28], [-0.065, 0.04], [-0.015, 0.29]]);
  church(rouen, 0.22, 0.015, 0.78, true, true);
  square(rouen, -0.07, -0.025, 0.045);

  const montpellier = quarter("montpellier", "south", [
    [[-0.25, -0.13], [-0.09, -0.15], [0.11, -0.11]],
    [[-0.25, 0.11], [-0.055, 0.09], [0.16, 0.17]],
  ], [5, 5], 0.063, 0.074);
  street(montpellier, [[-0.06, -0.26], [-0.04, 0.04], [-0.02, 0.26]]);
  civic(montpellier, 0.17, -0.02, true);
  church(montpellier, -0.17, 0.29, 0.68);
  square(montpellier, -0.07, -0.015, 0.054);

  const marseille = quarter("marseille", "south", [
    [[-0.23, 0.18], [0.005, 0.14], [0.23, 0.16]],
    [[-0.2, 0.36], [0.0, 0.34], [0.2, 0.29]],
  ], [6, 5], 0.059, 0.073);
  street(marseille, [[-0.02, -0.07], [0.015, 0.14], [0.01, 0.4]]);
  church(marseille, 0.27, 0.26, 0.68);
  square(marseille, -0.015, 0.035, 0.052);

  const ajaccio = quarter("ajaccio", "south", [
    [[0.01, -0.23], [0.055, -0.065], [0.1, 0.1]],
    [[0.1, 0.04], [0.18, 0.16], [0.24, 0.24]],
  ], [5, 4], 0.046, 0.062);
  church(ajaccio, 0.14, -0.14, 0.53);

  const boat = (name: string, x: number, z: number, angle: number, scale: number, sailing: boolean) => {
    if (landContains(x, z)) return;
    const node = new TransformNode(name, scene), hull = new Geometry();
    node.position.set(x, -0.065, z);
    node.rotation.y = angle;
    node.scaling.setAll(scale);
    const low = -0.013, high = 0.023;
    hull.quad([-0.018, low, -0.052], [-0.028, high, -0.06], [0.028, high, -0.06], [0.018, low, -0.052]);
    hull.quad([-0.028, high, -0.06], [-0.018, low, -0.052], [-0.014, low, 0.034], [-0.029, high, 0.028]);
    hull.quad([0.028, high, -0.06], [0.029, high, 0.028], [0.014, low, 0.034], [0.018, low, -0.052]);
    hull.triangle([-0.029, high, 0.028], [-0.014, low, 0.034], [0, high + 0.005, 0.084]);
    hull.triangle([0.014, low, 0.034], [0.029, high, 0.028], [0, high + 0.005, 0.084]);
    hull.triangle([-0.014, low, 0.034], [0.014, low, 0.034], [0, high + 0.005, 0.084]);
    hull.quad([-0.028, high, -0.06], [-0.029, high, 0.028], [0.029, high, 0.028], [0.028, high, -0.06]);
    hull.triangle([-0.029, high, 0.028], [0, high + 0.005, 0.084], [0.029, high, 0.028]);
    geometry("boat-hull", hull, sailing ? cream : red, node);
    box("boat-cabin", 0.034, 0.025, 0.037, paint, node, 0, 0.034, -0.022);
    box("cabin-windows", 0.036, 0.009, 0.025, glass, node, 0, 0.043, -0.022);
    if (sailing) {
      cylinder("mast", 0.0035, 0.2, timber, node, 0, 0.122, 0.0, 0.0035, 5);
      const canvas = new Geometry();
      canvas.triangle([0.001, 0.057, 0.049], [0.001, 0.217, -0.001], [0.001, 0.057, -0.001]);
      canvas.triangle([-0.001, 0.057, -0.044], [-0.001, 0.161, -0.006], [-0.001, 0.057, -0.006]);
      geometry("boat-sails", canvas, sail, node);
    } else {
      box("fishing-boat-bridge", 0.025, 0.015, 0.026, paint, node, 0, 0.054, -0.025);
      cylinder("boat-antenna", 0.002, 0.05, steel, node, 0, 0.084, -0.018, 0.002, 5);
    }
  };

  const harbour = (root: TransformNode, place: string) => {
    // Find the nearest genuine shoreline, not a decorative water rectangle.
    let shore: { point: GroundPoint; outward: GroundPoint; distance: number } | undefined;
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 24) {
      const outward = { x: Math.cos(angle), z: Math.sin(angle) };
      let previous = { x: root.position.x, z: root.position.z };
      for (let distance = 0.04; distance < 0.95; distance += 0.025) {
        const point = { x: root.position.x + outward.x * distance, z: root.position.z + outward.z * distance };
        if (!landContains(point.x, point.z)) {
          if (!shore || distance < shore.distance) shore = { point: previous, outward, distance };
          break;
        }
        previous = point;
      }
    }
    if (!shore) return;
    const { point, outward } = shore,
      side = { x: -outward.z, z: outward.x },
      centre = { x: point.x + outward.x * 0.08, z: point.z + outward.z * 0.08 },
      node = new TransformNode(`harbour-${place}`, scene);
    node.position.set(centre.x, -0.012, centre.z);
    node.rotation.y = Math.atan2(outward.x, outward.z);
    const wall = new Geometry();
    // Narrow masonry fingers leave visible water between the berths.
    wall.box(-0.16, 0.006, 0.045, 0.027, 0.028, 0.22);
    wall.box(0.16, 0.006, 0.015, 0.027, 0.028, 0.16);
    wall.box(0.0, 0.01, -0.063, 0.36, 0.034, 0.04);
    const shoreLevel = landHeight(point.x, point.z) + 0.014 - node.position.y;
    for (let i = 0; i < 8; i++) {
      const t = i / 8,
        stepLevel = shoreLevel * (1 - t) + 0.03 * t;
      wall.box(0, stepLevel / 2, -0.082 - (1 - t) * 0.064, 0.032, stepLevel, 0.012);
    }
    geometry("harbour-quays", wall, quay, node);
    for (const sx of [-1, 1]) cylinder("dock-bollard", 0.014, 0.025, steel, node, sx * 0.12, 0.035, -0.056, 0.014, 7);
    const coastRoad = [
      { x: point.x + side.x * 0.26 - outward.x * 0.046, z: point.z + side.z * 0.26 - outward.z * 0.046 },
      { x: point.x - outward.x * 0.05, z: point.z - outward.z * 0.05 },
      { x: root.position.x, z: root.position.z },
    ];
    road("harbour-access", coastRoad, 0.025, true);
    for (let i = 0; i < 4; i++) {
      const offset = (i - 1.5) * 0.067,
        x = centre.x + side.x * offset + outward.x * (0.035 + (i % 2) * 0.055),
        z = centre.z + side.z * offset + outward.z * (0.035 + (i % 2) * 0.055);
      boat(`${place}-moored-boat`, x, z, Math.atan2(outward.x, outward.z), 0.75, i % 2 === 0);
    }
    boat(`${place}-offshore-sailboat`, centre.x + outward.x * 0.43 + side.x * 0.18, centre.z + outward.z * 0.43 + side.z * 0.18, Math.atan2(outward.x, outward.z) + 0.45, 1.02, true);
    const lighthousePoint = { x: point.x + side.x * 0.22 - outward.x * 0.018, z: point.z + side.z * 0.22 - outward.z * 0.018 };
    if (landContains(lighthousePoint.x, lighthousePoint.z)) {
      const light = new TransformNode("lighthouse", scene);
      light.position.set(lighthousePoint.x, landHeight(lighthousePoint.x, lighthousePoint.z), lighthousePoint.z);
      cylinder("lighthouse-tower", 0.046, 0.15, cream, light, 0, 0.075, 0, 0.033, 12);
      cylinder("lighthouse-band", 0.039, 0.021, red, light, 0, 0.116, 0, 0.036, 12);
      cylinder("lighthouse-gallery", 0.059, 0.008, steel, light, 0, 0.153, 0, 0.059, 12);
      cylinder("lighthouse-lantern", 0.033, 0.028, glass, light, 0, 0.17, 0, 0.033, 12);
      cylinder("lighthouse-cap", 0.051, 0.018, red, light, 0, 0.192, 0, 0, 12);
    }
  };
  harbour(marseille, "marseille");
  harbour(ajaccio, "ajaccio");
  const brest = ruralRoots.find(root => root.name === "village-brest");
  if (brest) harbour(brest, "brest");

  bridge(paris, 0.022, -0.036, 0.15, 0.18);
  bridge(rouen, -0.06, 0.012, 0.16, 0.16);
  bridge(nantes, 0.012, 0.0, 0.07, 0.17);
  bridge(bordeaux, 0.004, 0.0, 0.06, 0.17);
  bridge(toulouse, 0.007, 0.0, 0.12, 0.16);
  bridge(lyon, 0.025, 0.02, 0.15, 0.17);

  // Geographic bends run through inland corridors. Sampling terrain on both
  // road edges keeps the network grounded and rejects accidental coastal cuts.
  const routes: Array<{ from: MapPlace; to: MapPlace; via: Array<[number, number]> }> = [
    { from: "paris", to: "lille", via: [[2.5, 49.23], [2.75, 49.83], [2.92, 50.22]] },
    { from: "paris", to: "rouen", via: [[1.97, 49.06], [1.58, 49.19], [1.27, 49.33]] },
    { from: "rouen", to: "rennes", via: [[0.53, 49.14], [-0.13, 48.85], [-0.8, 48.41]] },
    { from: "paris", to: "rennes", via: [[1.55, 48.46], [0.2, 48.23], [-0.57, 48.17]] },
    { from: "rennes", to: "nantes", via: [[-1.77, 47.78], [-1.74, 47.52]] },
    { from: "nantes", to: "bordeaux", via: [[-1.06, 46.72], [-0.67, 46.24], [-0.57, 45.61]] },
    { from: "bordeaux", to: "toulouse", via: [[-0.12, 44.58], [0.56, 44.23], [1.02, 43.97]] },
    { from: "toulouse", to: "montpellier", via: [[1.94, 43.42], [2.44, 43.27], [3.02, 43.28], [3.48, 43.49]] },
    { from: "montpellier", to: "marseille", via: [[4.19, 43.73], [4.65, 43.72], [5.09, 43.61]] },
    { from: "marseille", to: "lyon", via: [[5.24, 43.75], [4.87, 44.26], [4.8, 44.89], [4.88, 45.38]] },
    { from: "lyon", to: "paris", via: [[4.44, 46.22], [3.68, 46.84], [3.14, 47.52], [2.62, 48.12]] },
    { from: "paris", to: "strasbourg", via: [[3.46, 48.82], [4.66, 48.69], [5.78, 48.7], [6.83, 48.76]] },
    { from: "lyon", to: "strasbourg", via: [[5.22, 46.39], [5.75, 47.15], [6.39, 47.65], [7.37, 48.12]] },
  ];

  const carShape = new Geometry();
  const networkPaths: Vector3[][] = [];
  carShape.box(0, 0.012, 0, 0.022, 0.014, 0.048);
  carShape.box(0, 0.023, -0.003, 0.02, 0.01, 0.025);
  for (const [index, route] of routes.entries()) {
    const from = MAP_PLACES[route.from], to = MAP_PLACES[route.to],
      points = [[from.lon, from.lat], ...route.via, [to.lon, to.lat]].map(([lon, lat]) => mapPosition(lon, lat)),
      runs = road(`national-road-${index}`, points, 0.027);
    networkPaths.push(...runs);
    const path = runs.sort((a, b) => b.length - a.length)[0];
    if (!path || path.length < 8) continue;
    for (let i = 0; i < 2; i++) {
      const mesh = geometry(`road-vehicle-${index}-${i}`, carShape, i ? paint : steel),
        phase = rng(), progress = phase * (path.length - 1),
        segment = Math.min(path.length - 2, Math.floor(progress));
      // Dynamic vehicles must not be absorbed into the static material batches.
      meshes.pop();
      mesh.position.copyFrom(Vector3.Lerp(path[segment], path[segment + 1], progress - segment));
      const forward = path[segment + 1].subtract(path[segment]);
      mesh.rotation.y = Math.atan2(forward.x, forward.z);
      const colors = Array.from({ length: mesh.getTotalVertices() }, (_, vertex) => vertex >= 24 && vertex < 40 ? [0.27, 0.38, 0.4, 1] : [1, 1, 1, 1]).flat();
      mesh.setVerticesData("color", colors);
      vehicles.push({ mesh, path, phase });
    }
  }

  for (const root of ruralRoots) {
    let closest: Vector3 | undefined, distance = Infinity;
    for (const path of networkPaths)
      for (const point of path) {
        const separation = Math.hypot(root.position.x - point.x, root.position.z - point.z);
        if (separation < distance) { distance = separation; closest = point; }
      }
    if (!closest || distance > 1.2 || distance < 0.09) continue;
    road("rural-connection", [
      { x: root.position.x, z: root.position.z },
      { x: root.position.x * 0.6 + closest.x * 0.4, z: root.position.z * 0.4 + closest.z * 0.6 },
      { x: closest.x, z: closest.z },
    ], 0.014, true);
  }

  return { roots, meshes, vehicles };
}
