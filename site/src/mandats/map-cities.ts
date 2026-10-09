import { mapBaselinePosition, mapFinalFromBaseline, mapBaselineFromFinal } from "./map-camera-projection.ts";
import { MODEL_URLS } from "./map-model-revisions.ts";
import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { MAP_PLACES, mapPosition, mapCoordinates } from "./map-state.ts";
import type { MapPlace } from "./map-state.ts";
import { landContains, landHeight, riverContains } from "./map-landscape.ts";
import { publicGround } from "./map-public-ground.ts";
import { LYON_SCHOOL_SITE, publicEsplanadeOutline, publicEsplanadePlot, publicEsplanadePoint } from "./map-public-sites.ts";
import { createCityMaterials, createCityTransportMaterials } from "./map-city-materials.ts";
import { CityGeometry as Geometry, createCityMesh } from "./map-city-geometry.ts";
import { buildHarbour, buildPowerPlant, buildWindTurbines } from "./map-city-infrastructure.ts";
import { surveyHarbour, harbourPolygonsOverlap } from "./map-city-port-plans.ts";
import { buildRailNetwork, RAIL_ROUTES } from "./map-city-rail.ts";
import { loadAssetKit } from "./map-asset-kit.ts";
import type { AssetKit } from "./map-asset-kit.ts";
import { PARIS_BLOCKS, PARIS_CATHEDRAL_SITE, PARIS_SPACES, PARIS_STREETS, PARIS_TREES, parisBuildingFootprint, parisBuiltContains } from "./map-city-paris.ts";
import type { ParisBuilding } from "./map-city-paris.ts";
import { NATIONAL_SETTLEMENTS, nationalBuildingFootprint } from "./map-city-national.ts";
import type { NationalBuilding } from "./map-city-national.ts";
import { URBAN_PLANS, RURAL_SETTLEMENTS, AUTHORED_PROJECT_RESERVATIONS } from "./map-urban-plans.ts";
import type { UrbanRegion } from "./map-urban-plans.ts";

type Point = [number, number, number];
type GroundPoint = { x: number; z: number };
type Roof = "gable" | "hip" | "mansard" | "flat" | "cross";
type Plot = { x: number; z: number; halfX: number; halfZ: number; halfW?: number; halfD?: number; angle?: number };

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Authored buildings share their geometry; roads and public spaces are batched. */
export async function buildCities(scene: Scene): Promise<{
  roots: Map<MapPlace, TransformNode>;
  meshes: AbstractMesh[];
  vehicles: Array<{ mesh: Mesh; path: Vector3[]; phase: number }>;
}> {
  const [kit, greenery, parisKit, cathedralKit] = await Promise.all([
    loadAssetKit(scene, MODEL_URLS.architecture),
    loadAssetKit(scene, MODEL_URLS.vegetation),
    loadAssetKit(scene, MODEL_URLS.paris),
    loadAssetKit(scene, MODEL_URLS.cathedrale),
  ]);
  if (scene.isDisposed) return { roots: new Map(), meshes: [], vehicles: [] };
  const meshes: AbstractMesh[] = [],
    roots = new Map<MapPlace, TransformNode>(),
    vehicles: Array<{ mesh: Mesh; path: Vector3[]; phase: number }> = [],
    bridgeDecks: Array<{ x: number; z: number; angle: number; length: number; y: number }> = [],
    localStreets: Array<{ start: GroundPoint; end: GroundPoint; halfWidth: number }> = [],
    rng = random(729381);

  const cityMaterials = createCityMaterials(scene),
    transportMaterials = createCityTransportMaterials(scene, cityMaterials);
  const { stone, pale, brick, slate, glass, timber, steel, cream, pavement, quay, paint, red } = cityMaterials;

  let serial = 0;
  const record = (mesh: Mesh, mat: StandardMaterial, parent?: TransformNode) => {
    mesh.material = mat;
    mesh.parent = parent ?? null;
    mesh.isPickable = false;
    meshes.push(mesh);
    return mesh;
  };
  const geometry = (name: string, shape: Geometry, mat: StandardMaterial, parent?: TransformNode) => {
    return record(createCityMesh(scene, `${name}-${serial++}`, shape, mat, parent), mat, parent);
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
    node.position.set(x, landHeight(root.position.x + x, root.position.z + z) + 0.009 - root.position.y, z);
    node.rotation.y = angle;
    return node;
  };
  const onLand = (root: TransformNode, x: number, z: number, margin = 0) => {
    return [[0, 0], [-margin, -margin], [-margin, margin], [margin, -margin], [margin, margin]].every(([dx, dz]) => landContains(root.position.x + x + dx, root.position.z + z + dz));
  };

  for (const [name, place] of Object.entries(MAP_PLACES)) {
    const point = mapPosition(place.lon, place.lat), root = new TransformNode(`city-${name}`, scene);
    root.position.set(point.x, landHeight(point.x, point.z) + .012, point.z);
    roots.set(name as MapPlace, root);
  }
  const roof = (parent: TransformNode, width: number, depth: number, base: number, height: number, style: Roof, mat: StandardMaterial): void => {
    const w = width / 2 + 0.004,
      d = depth / 2 + 0.004,
      shape = new Geometry();
    if (style === "cross") {
      roof(parent, width, depth, base, height, "gable", mat);
      const cross = new TransformNode("cross-gabled-roof", scene);
      cross.parent = parent;
      cross.rotation.y = Math.PI / 2;
      roof(cross, depth, width * 0.55, base, height * 0.94, "gable", mat);
      return;
    } else if (style === "flat") {
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
      if (w > d) {
        const ridge = Math.max(0.002, w - d * 0.8);
        shape.quad([-w, base, -d], [-ridge, base + height, 0], [ridge, base + height, 0], [w, base, -d]);
        shape.quad([w, base, d], [ridge, base + height, 0], [-ridge, base + height, 0], [-w, base, d]);
        shape.triangle([-w, base, d], [-ridge, base + height, 0], [-w, base, -d]);
        shape.triangle([w, base, -d], [ridge, base + height, 0], [w, base, d]);
      } else {
        const ridge = Math.max(0.002, d - w * 0.8);
        shape.quad([-w, base, -d], [-w, base, d], [0, base + height, ridge], [0, base + height, -ridge]);
        shape.quad([0, base + height, -ridge], [0, base + height, ridge], [w, base, d], [w, base, -d]);
        shape.triangle([-w, base, -d], [0, base + height, -ridge], [w, base, -d]);
        shape.triangle([w, base, d], [0, base + height, ridge], [-w, base, d]);
      }
    }
    geometry("roof", shape, mat, parent);
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
  const road = (name: string, points: GroundPoint[], width: number, local = false, protectParis = false) => {
    const national = name.startsWith("national-road-");
    // Stay inside the surveyed .021 half-width while retaining a visible pale
    // shoulder on either side of the miniature's national roads.
    const shoulder = national ? .008 : .004;
    const path = national ? smooth(points, 12).map(point => mapFinalFromBaseline(point.x, point.z)) : smooth(points, local ? 5 : 12),
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
        leftA = edge(a, b, -1, width + shoulder, 0.010),
        rightA = edge(a, b, 1, width + shoulder, 0.010),
        leftB = edge(b, next, -1, width + shoulder, 0.010),
        rightB = edge(b, next, 1, width + shoulder, 0.010),
        lane = [edge(a, b, -1, width, 0.012), edge(a, b, 1, width, 0.012), edge(b, next, 1, width, 0.012), edge(b, next, -1, width, 0.012)] as const,
        stripeWidth = national ? .0025 : .0015,
        stripe = [edge(a, b, -1, stripeWidth, 0.013), edge(a, b, 1, stripeWidth, 0.013), edge(b, next, 1, stripeWidth, 0.013), edge(b, next, -1, stripeWidth, 0.013)] as const;
      // Coastlines are hard boundaries. A route never bridges an inlet by accident.
      const valid = [a, b, { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }].every(p => landContains(p.x, p.z)) && [leftA, rightA, leftB, rightB, ...lane, ...stripe].every(p => landContains(p[0], p[2]));
      const paris = roots.get("paris")!.position;
      const authoredCity = protectParis && [a, b, { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 },
        ...[leftA, rightA, leftB, rightB].map(point => ({ x: point[0], z: point[2] }))]
        .some(point => parisBuiltContains(point.x - paris.x, point.z - paris.z));
      if (!valid || authoredCity) {
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
      geometry(`${name}-shoulders`, paving, national ? transportMaterials.cream : local ? transportMaterials.pavement : transportMaterials.quay);
      geometry(`${name}-carriageway`, surface, local ? transportMaterials.pavement : transportMaterials.asphalt);
      if (paintwork.positions.length) geometry(`${name}-markings`, paintwork, transportMaterials.markings);
    }
    return runs;
  };
  const street = (root: TransformNode, points: Array<[number, number]>, width = 0.025) => {
    const controls = points.map(([x, z]) => ({ x: root.position.x + x, z: root.position.z + z })),
      path = smooth(controls, 5);
    for (let i = 1; i < path.length; i++)
      localStreets.push({ start: path[i - 1], end: path[i], halfWidth: width / 2 + .005 });
    road("city-street", controls, width, true, root.name !== "city-paris");
  };

  const factory = (root: TransformNode, x: number, z: number, old = false) => {
    if (!onLand(root, x, z, 0.235)) return;
    const node = located("factory", root, x, z),
      panes = new Geometry();
    node.scaling.setAll(1.45);
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

  const school = (root: TransformNode) => {
    const site = LYON_SCHOOL_SITE,
      levels = Array.from({ length: 9 }, (_, i) => Array.from({ length: 9 }, (_, j) =>
        landHeight(root.position.x + site.x + (i / 8 - .5) * site.buildingWidth,
          root.position.z + site.z + (j / 8 - .5) * site.buildingDepth))).flat(),
      footprint = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => ({
        x: root.position.x + site.x + x * site.buildingWidth / 2,
        z: root.position.z + site.z + z * site.buildingDepth / 2 })),
      rendered = renderedFootprintLevels(footprint),
      highest = Math.max(...levels, ...rendered), lowest = Math.min(...levels, ...rendered),
      floor = highest + .003,
      node = located("public-school", root, site.x, site.z),
      glazing = new Geometry(), details = new Geometry(), flag = new Geometry(), whiteFlag = new Geometry(), redFlag = new Geometry();
    node.position.y = floor - root.position.y;
    node.metadata = { schoolSite: true, surveyedMinimum: lowest, surveyedMaximum: highest,
      renderedGroundMinimum: rendered.length ? Math.min(...rendered) : null,
      renderedGroundMaximum: rendered.length ? Math.max(...rendered) : null };
    if (highest - lowest > .010) {
      const height = floor - lowest + .001;
      box("school-stone-footing", site.buildingWidth, height, site.buildingDepth, stone,
        node, 0, -height / 2, 0);
    }
    box("school-stone", 0.3, 0.143, 0.134, stone, node, 0, 0.0715, 0);
    roof(node, 0.312, 0.144, 0.143, 0.052, "hip", slate);
    for (let floor = 0; floor < 2; floor++)
      for (let column = 0; column < 7; column++) {
        const x = -0.12 + column * 0.04, y = 0.036 + floor * 0.058;
        glazing.box(x, y, 0.069, 0.018, 0.031, 0.003);
        details.box(x, y + 0.02, 0.071, 0.024, 0.006, 0.009);
      }
    glazing.box(0, 0.024, 0.071, 0.036, 0.045, 0.004);
    details.box(0, 0.067, 0, 0.305, 0.005, 0.14);
    details.box(0, 0.146, 0, 0.313, 0.008, 0.148);
    geometry("school-glazing", glazing, glass, node);
    geometry("school-cornices", details, cream, node);
    cylinder("school-flagpole", 0.003, 0.17, steel, node, -0.13, 0.085, 0.106, 0.003, 6);
    flag.quad([-0.13, 0.141, 0.106], [-0.13, 0.169, 0.106], [-0.112, 0.166, 0.108], [-0.112, 0.138, 0.108]);
    whiteFlag.quad([-0.112, 0.138, 0.108], [-0.112, 0.166, 0.108], [-0.094, 0.171, 0.109], [-0.094, 0.143, 0.109]);
    redFlag.quad([-0.094, 0.143, 0.109], [-0.094, 0.171, 0.109], [-0.076, 0.167, 0.108], [-0.076, 0.139, 0.108]);
    geometry("school-blue-flag", flag, steel, node);
    geometry("school-white-flag", whiteFlag, cityMaterials.sail, node);
    geometry("school-red-flag", redFlag, red, node);
  };

  const esplanade = (root: TransformNode, town: string) => {
    const surface = new Geometry(), furniture = new Geometry(), feet = new Geometry(),
      outline = publicEsplanadeOutline(town),
      ground = Math.max(...outline.map(([x, z]) => landHeight(root.position.x + x, root.position.z + z))) + 0.016;
    if (outline.some(([x, z]) => !landContains(root.position.x + x, root.position.z + z))) return;
    const paving = publicGround(scene, root.position, outline),
      crowdPositions: GroundPoint[] = [],
      safe = (point: GroundPoint) => paving.contains(point) &&
        !riverContains(root.position.x + point.x, root.position.z + point.z, .027);
    for (const polygon of paving.polygons) {
      const a = polygon[0];
      for (let i = 1; i < polygon.length - 1; i++) {
        const b = polygon[i], c = polygon[i + 1], y = ground - root.position.y;
        const ax = Math.fround(a.x), az = Math.fround(a.z),
          bx = Math.fround(b.x), bz = Math.fround(b.z),
          cx = Math.fround(c.x), cz = Math.fround(c.z);
        if (Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax)) < 1e-10) continue;
        surface.triangle([a.x, y, a.z], [b.x, y, b.z], [c.x, y, c.z]);
      }
    }
    for (let i = 0; i < 30; i++) {
      const point = publicEsplanadePoint(town, .02 + ((i % 8) - 3.5) * .055 * .72,
        -.42 + Math.floor(i / 8) * .07 * .72);
      if (safe(point)) crowdPositions.push(point);
    }
    for (let z = -.412; z <= -.277 && crowdPositions.length < 30; z += .025)
      for (let x = -.157; x <= .18 && crowdPositions.length < 30; x += .028) {
        const point = publicEsplanadePoint(town, x, z);
        if (safe(point) && crowdPositions.every(p => Math.hypot(p.x - point.x, p.z - point.z) >= .022))
          crowdPositions.push(point);
      }
    root.metadata = { ...(root.metadata ?? {}), crowdGroundY: ground + .003, crowdPositions };
    for (const sx of [-0.21, 0.245]) {
      const wet = town === "ajaccio"
        ? [-.015, .015].some(dx => [-.036, .036].some(dz => {
          const point = publicEsplanadePoint(town, sx + dx, -.32 + dz);
          return riverContains(root.position.x + point.x, root.position.z + point.z, .008);
        }))
        : [-.015, .015].some(dx => [-.036, .036].some(dz =>
          riverContains(root.position.x + sx + dx, root.position.z - .32 + dz, .008)));
      if (wet) continue;
      const y = ground - root.position.y;
      furniture.box(sx, y + 0.025, -0.32, 0.025, 0.004, 0.068);
      furniture.box(sx + (sx < 0 ? -0.01 : 0.01), y + 0.039, -0.32, 0.004, 0.028, 0.068);
      for (const z of [-0.34, -0.3]) feet.box(sx, y + 0.012, z, 0.013, 0.024, 0.004);
    }
    if (town === "ajaccio") for (const shape of [furniture, feet])
      for (let i = 0; i < shape.positions.length; i += 3) {
        const point = publicEsplanadePoint(town, shape.positions[i], shape.positions[i + 2]);
        shape.positions[i] = point.x; shape.positions[i + 2] = point.z;
      }
    const plaza = geometry("public-esplanade", surface, pavement, root);
    plaza.metadata = { ...plaza.metadata, castsShadow: false, authoredPublicGround: true };
    geometry("public-benches", furniture, timber, root);
    geometry("bench-legs", feet, steel, root);
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
    geometry("bridge-deck", deck, transportMaterials.asphalt, node);
  };


  const parisGeographic = ([x, z]: [number, number]): [number, number] => {
    const origin = mapPosition(MAP_PLACES.paris.lon, MAP_PLACES.paris.lat),
      coordinates = mapCoordinates(origin.x + x, origin.z + z);
    return [coordinates.lon, coordinates.lat];
  };
  const roadAnchor = (place: MapPlace): [number, number] => place === "paris"
    ? parisGeographic([.02, -.58]) : [MAP_PLACES[place].lon, MAP_PLACES[place].lat];
  const routes: Array<{ from: MapPlace; to: MapPlace; via: Array<[number, number]> }> = [
    { from: "paris", to: "lille", via: [...[[.25, -.58], [.51, -.37], [.75, -.03], [1.30, .03], [1.56, .45], [1.61, 1.18], [1.27, 1.79], [.90, 2.05]].map(point => parisGeographic(point as [number, number])), [2.92, 50.22]] },
    { from: "paris", to: "rouen", via: [[-.28, -.54], [-.77, -.46], [-1.05, -.13], [-1.23, .28], [-1.04, .50]].map(point => parisGeographic(point as [number, number])) },
    { from: "rouen", to: "rennes", via: [[0.53, 49.14], [-0.13, 48.85], [-0.8, 48.41]] },
    { from: "paris", to: "rennes", via: [...[[-.43, -.54], [-.79, -.57], [-1.10, -.66]].map(point => parisGeographic(point as [number, number])), [0.2, 48.23], [-0.57, 48.17]] },
    { from: "rennes", to: "nantes", via: [[-1.77, 47.78], [-1.74, 47.52]] },
    { from: "nantes", to: "bordeaux", via: [[-1.06, 46.72], [-0.67, 46.24], [-0.57, 45.61]] },
    { from: "bordeaux", to: "toulouse", via: [[-0.12, 44.58], [0.56, 44.23], [1.02, 43.97]] },
    { from: "toulouse", to: "montpellier", via: [[1.94, 43.42], [2.44, 43.27], [3.02, 43.28], [3.48, 43.49]] },
    { from: "montpellier", to: "marseille", via: [[4.19, 43.73], [4.65, 43.72], [5.09, 43.61]] },
    { from: "marseille", to: "lyon", via: [[5.24, 43.75], [4.87, 44.26], [4.8, 44.89], [4.88, 45.38]] },
    { from: "lyon", to: "paris", via: [[4.44, 46.22], [3.68, 46.84], [3.14, 47.52],
      ...[[.08, -1.10], [.15, -.75], [.30, -.54], [.19, -.58]].map(point => parisGeographic(point as [number, number]))] },
    { from: "paris", to: "strasbourg", via: [...[[.25, -.58], [.52, -.48], [.86, -.20], [1.07, -.05]].map(point => parisGeographic(point as [number, number])), [3.46, 48.82], [4.66, 48.69], [5.78, 48.7], [6.83, 48.76]] },
    { from: "lyon", to: "strasbourg", via: [[5.22, 46.39], [5.75, 47.15], [6.39, 47.65], [7.37, 48.12]] },
  ];

  const transportCorridors = routes.flatMap(route => {
    const path = smooth([roadAnchor(route.from), ...route.via, roadAnchor(route.to)]
      .map(([lon, lat]) => mapBaselinePosition(lon, lat)), 12).map(point => mapFinalFromBaseline(point.x, point.z));
    return path.slice(1).map((end, index) => ({ start: path[index], end }));
  });
  const intersectsCorridors = (plot: Plot, corridors: Array<{ start: GroundPoint; end: GroundPoint; halfWidth?: number }>, precise = false) => {
    for (const corridor of corridors) {
      let { start, end } = corridor;
      const margin = corridor.halfWidth ?? .021;
      let minX = plot.x - plot.halfX - margin, maxX = plot.x + plot.halfX + margin,
        minZ = plot.z - plot.halfZ - margin, maxZ = plot.z + plot.halfZ + margin;
      if (Math.max(start.x, end.x) < minX || Math.min(start.x, end.x) > maxX ||
          Math.max(start.z, end.z) < minZ || Math.min(start.z, end.z) > maxZ) continue;
      if (precise) {
        const c = Math.cos(plot.angle ?? 0), s = Math.sin(plot.angle ?? 0),
          local = (point: GroundPoint) => ({ x: (point.x - plot.x) * c + (point.z - plot.z) * s,
            z: -(point.x - plot.x) * s + (point.z - plot.z) * c });
        start = local(start); end = local(end);
        minX = -(plot.halfW ?? plot.halfX) - margin; maxX = -minX;
        minZ = -(plot.halfD ?? plot.halfZ) - margin; maxZ = -minZ;
      }
      let enter = 0, leave = 1;
      const dx = end.x - start.x, dz = end.z - start.z;
      for (const [p, q] of [[-dx, start.x - minX], [dx, maxX - start.x],
        [-dz, start.z - minZ], [dz, maxZ - start.z]]) {
        if (Math.abs(p) < .000001) { if (q < 0) { enter = 2; break; } }
        else if (p < 0) enter = Math.max(enter, q / p);
        else leave = Math.min(leave, q / p);
      }
      if (enter <= leave && enter <= 1 && leave >= 0) return true;
    }
    return false;
  };
  const intersectsRoad = (plot: Plot, precise = false) => intersectsCorridors(plot, transportCorridors, precise);

  const families: Record<UrbanRegion, string[]> = {
    paris: kit.names.filter(name => name.startsWith("maison_paris")),
    north: kit.names.filter(name => name.startsWith("maison_brique")),
    breton: kit.names.filter(name => name.startsWith("maison_ardoise") || name.startsWith("maison_pierre")),
    alsace: kit.names.filter(name => name.startsWith("maison_alsace")),
    stone: kit.names.filter(name => name.startsWith("maison_pierre") || name.startsWith("maison_ardoise")),
    south: kit.names.filter(name => name.startsWith("maison_sud")),
  };
  const regionalHeight: Record<UrbanRegion, number> = {
    paris: 1.24, north: 1.21, breton: 1.19, alsace: 1.24, stone: 1.22, south: 1.19,
  };
  if (Object.values(families).some(family => !family.length))
    throw new Error("The architecture library has an incomplete regional family.");

  // Frontages are composed before choosing a house. Actual waterways, slopes,
  // public spaces and transport corridors determine each buildable footprint.
  const occupied: Plot[] = [];
  const counts: Record<string, number> = {};
  const usedArchetypes = new Set<string>();
  let candidates = 0, coastal = 0, waterside = 0, reserved = 0, overlaps = 0, roadside = 0, steep = 0;
  const cathedral = cathedralKit.bounds("cathedrale_paris"),
    cathedralSite = PARIS_CATHEDRAL_SITE,
    cathedralScale = cathedralSite.width / cathedral.width,
    cathedralW = cathedral.width * cathedralScale / 2 + .010,
    cathedralD = cathedral.depth * cathedralScale / 2 + .010,
    cathedralCos = Math.abs(Math.cos(cathedralSite.angle)), cathedralSin = Math.abs(Math.sin(cathedralSite.angle)),
    cathedralPlot = { x: cathedralSite.x, z: cathedralSite.z,
      halfX: cathedralCos * cathedralW + cathedralSin * cathedralD,
      halfZ: cathedralSin * cathedralW + cathedralCos * cathedralD,
      halfW: cathedralW, halfD: cathedralD, angle: -cathedralSite.angle };
  const specialSites: Partial<Record<MapPlace, Plot[]>> = {
    paris: [cathedralPlot],
    lyon: [{ x: LYON_SCHOOL_SITE.x, z: LYON_SCHOOL_SITE.z,
      halfX: LYON_SCHOOL_SITE.publicHalfW, halfZ: LYON_SCHOOL_SITE.publicHalfD }, { x: -.42, z: .57, halfX: .14, halfZ: .15 }],
    lille: [{ x: -.70, z: -.65, halfX: .21, halfZ: .15 }, { x: -.48, z: .13, halfX: .08, halfZ: .08 }],
    rennes: [{ x: .37, z: .47, halfX: .16, halfZ: .10 }],
    toulouse: [{ x: -.35, z: .51, halfX: .20, halfZ: .10 }],
  };
  const stationSites: Partial<Record<MapPlace, [number, number]>> = {
    paris: [.83, -.15], lyon: [.75, -.10], lille: [.45, -.60], nantes: [.66, -.39], bordeaux: [.64, .46],
  };
  const railCorridors = RAIL_ROUTES.flatMap(([from, to, via]) => {
    const stop = (town: MapPlace) => {
      const place = MAP_PLACES[town], position = mapPosition(place.lon, place.lat), offset = stationSites[town]!;
      return { x: position.x + offset[0], z: position.z + offset[1] };
    };
    const path = smooth([mapBaselineFromFinal(stop(from).x, stop(from).z), ...via.map(([lon, lat]) => mapBaselinePosition(lon, lat)), mapBaselineFromFinal(stop(to).x, stop(to).z)], 20).map(point => mapFinalFromBaseline(point.x, point.z));
    return path.slice(1).map((end, i) => ({ start: path[i], end, halfWidth: .026 }));
  });
  const allPublicPlots = [...roots.entries()].flatMap(([town, root]) => {
    const sites = [...specialSites[town] ?? [], publicEsplanadePlot(town)];
    const station = stationSites[town];
    if (station) sites.push({ x: station[0] - .05, z: station[1], halfX: .11, halfZ: .19 });
    return sites.map(site => ({ ...site, x: root.position.x + site.x, z: root.position.z + site.z }));
  });
  const harbourReservations = ["brest", "nantes", "marseille", "ajaccio"].flatMap(place => {
    const settlement = NATIONAL_SETTLEMENTS.find(town => town.name === place);
    if (!settlement) return [];
    return surveyHarbour(place, mapPosition(settlement.lon, settlement.lat))?.landReservations ?? [];
  });
  const collides = (a: Plot, b: Plot, gap = .001) => {
    if (Math.abs(a.x - b.x) >= a.halfX + b.halfX + gap ||
        Math.abs(a.z - b.z) >= a.halfZ + b.halfZ + gap) return false;
    const aa = a.angle ?? 0, ba = b.angle ?? 0;
    for (const axis of [aa, aa + Math.PI / 2, ba, ba + Math.PI / 2]) {
      const distance = Math.abs((a.x - b.x) * Math.cos(axis) + (a.z - b.z) * Math.sin(axis)),
        radiusA = (a.halfW ?? a.halfX) * Math.abs(Math.cos(aa - axis)) +
          (a.halfD ?? a.halfZ) * Math.abs(Math.sin(aa - axis)),
        radiusB = (b.halfW ?? b.halfX) * Math.abs(Math.cos(ba - axis)) +
          (b.halfD ?? b.halfZ) * Math.abs(Math.sin(ba - axis));
      if (distance >= radiusA + radiusB + gap) return false;
    }
    return true;
  };

  const fixedProjectPlots = Object.entries(AUTHORED_PROJECT_RESERVATIONS).flatMap(([town, sites]) => {
    const root = roots.get(town as MapPlace)!;
    return sites!.map(site => ({ x: root.position.x + site.x, z: root.position.z + site.z,
      halfX: .21, halfZ: .20 }));
  });
  const allAuthoredHousePlots: Array<Plot & { id: string }> = [
    ...PARIS_BLOCKS.flatMap(block => block.buildings.map(house => {
      const origin = roots.get("paris")!.position, c = Math.abs(Math.cos(house.angle)), s = Math.abs(Math.sin(house.angle));
      return { id: house.id, x: origin.x + house.x + Math.sin(house.angle) * (house.footprintOffset ?? 0),
        z: origin.z + house.z + Math.cos(house.angle) * (house.footprintOffset ?? 0),
        halfX: (c * house.width + s * house.depth) / 2, halfZ: (s * house.width + c * house.depth) / 2,
        halfW: house.width / 2, halfD: house.depth / 2, angle: -house.angle };
    })),
    ...NATIONAL_SETTLEMENTS.flatMap(town => {
      const origin = mapPosition(town.lon, town.lat);
      return town.blocks.flatMap(block => block.buildings.map(house => {
        const c = Math.abs(Math.cos(house.angle)), s = Math.abs(Math.sin(house.angle));
        return { id: house.id, x: origin.x + house.x + Math.sin(house.angle) * house.footprintOffset,
          z: origin.z + house.z + Math.cos(house.angle) * house.footprintOffset,
          halfX: (c * house.width + s * house.depth) / 2, halfZ: (s * house.width + c * house.depth) / 2,
          halfW: house.width / 2, halfD: house.depth / 2, angle: -house.angle };
      }));
    }),
  ];

  const baseHousePlots = allAuthoredHousePlots.filter(plot => !plot.id.includes("-tissu14-"));

  const parisConflicts = new Map<string, string[]>();
  const gardenTerrainCells = new Map<string, Point[][]>();
  for (const mesh of scene.meshes.filter(mesh => mesh.name.startsWith("landscape-terrain-"))) {
    const positions = mesh.getVerticesData("position"), indices = mesh.getIndices();
    if (!positions || !indices) continue;
    for (let i = 0; i < indices.length; i += 3) {
      const triangle: Point[] = [0, 1, 2].map(j => {
        const k = indices[i + j] * 3; return [positions[k], positions[k + 1], positions[k + 2]];
      }),
        minX = Math.min(...triangle.map(p => p[0])), maxX = Math.max(...triangle.map(p => p[0])),
        minZ = Math.min(...triangle.map(p => p[2])), maxZ = Math.max(...triangle.map(p => p[2]));
      for (let x = Math.floor(minX / .10); x <= Math.floor(maxX / .10); x++)
        for (let z = Math.floor(minZ / .10); z <= Math.floor(maxZ / .10); z++) {
          const key = `${x}:${z}`, cell = gardenTerrainCells.get(key) ?? [];
          cell.push(triangle); gardenTerrainCells.set(key, cell);
        }
    }
  }
  // Retaining foundations cover the actual rendered terrain as well as the
  // analytic ground survey. Planar triangle extrema occur at clipped vertices.
  const renderedFootprintLevels = (outline: GroundPoint[]): number[] => {
    const polygon = [...outline], signedArea = polygon.reduce((sum, p, i) => {
      const q = polygon[(i + 1) % polygon.length]; return sum + p.x * q.z - q.x * p.z;
    }, 0);
    if (signedArea < 0) polygon.reverse();
    const minX = Math.min(...polygon.map(p => p.x)), maxX = Math.max(...polygon.map(p => p.x)),
      minZ = Math.min(...polygon.map(p => p.z)), maxZ = Math.max(...polygon.map(p => p.z)),
      triangles = new Set<Point[]>(), levels: number[] = [];
    for (let x = Math.floor(minX / .10); x <= Math.floor(maxX / .10); x++)
      for (let z = Math.floor(minZ / .10); z <= Math.floor(maxZ / .10); z++)
        for (const triangle of gardenTerrainCells.get(`${x}:${z}`) ?? []) triangles.add(triangle);
    for (const triangle of triangles) {
      let clipped = triangle.map(p => [...p] as Point);
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
  };
  const placeHouse = (root: TransformNode, town: string, region: UrbanRegion,
    x: number, z: number, angle: number, width: number, index: number,
    frontage?: { normalX: number; normalZ: number; side: number; streetWidth: number; maxDepth: number },
    authored?: (Omit<ParisBuilding, "model"> & { model: string; footprintOffset?: number; national?: boolean }) & { kit: AssetKit; block: string }) => {
    candidates++;
    const family = families[region];
    const rural = !roots.has(town as MapPlace),
      farm = region === "breton" || region === "north" ? "ferme_02" : "ferme_01",
      name = authored?.model ?? (rural && index % 8 === 3 && kit.names.includes(farm) ? farm :
        !rural && index % 11 === 5 && ["south", "stone"].includes(region) && kit.names.includes("boutique_01") ? "boutique_01" :
          family[(index + Math.floor(rng() * family.length)) % family.length]),
      sourceKit = authored?.kit ?? kit;
    const bounds = sourceKit.bounds(name), scale = width / bounds.width,
      naturalDepth = bounds.depth * scale,
      depth = authored?.depth ?? (roots.has(town as MapPlace) ? Math.min(naturalDepth, frontage?.maxDepth ?? .105) : naturalDepth),
      halfX = (Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * depth) / 2,
      halfZ = (Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * depth) / 2;
    if (frontage) {
      const offset = depth / 2 + frontage.streetWidth / 2 + .003;
      x += frontage.normalX * offset * frontage.side;
      z += frontage.normalZ * offset * frontage.side;
    }
    const centreX = x + Math.sin(angle) * (authored?.footprintOffset ?? 0),
      centreZ = z + Math.cos(angle) * (authored?.footprintOffset ?? 0),
      worldX = root.position.x + centreX, worldZ = root.position.z + centreZ;
    const authoredFootprint = authored?.national ? nationalBuildingFootprint(authored as NationalBuilding) : authored &&
      parisBuildingFootprint({ ...authored, model: "immeuble_paris_01" });
    const survey = authored ? [...authoredFootprint!, [centreX, centreZ] as const].map(([px, pz]) => ({
      x: root.position.x + px, z: root.position.z + pz,
    })) : [[0, 0], [-halfX, -halfZ], [-halfX, halfZ], [halfX, -halfZ], [halfX, halfZ]]
      .map(([dx, dz]) => ({ x: worldX + dx, z: worldZ + dz }));
    if (survey.some(point => !landContains(point.x, point.z))) { coastal++; return; }
    if ((!authored || authored.national) && survey.some(point => parisBuiltContains(point.x - roots.get("paris")!.position.x,
      point.z - roots.get("paris")!.position.z))) { reserved++; return; }
    // Test the real footprint rather than a large exclusion circle. River banks
    // keep continuous street frontages alongside the water.
    if (survey.some(point => riverContains(point.x, point.z, .006))) { waterside++; return; }
    const localPlot = { x: centreX, z: centreZ, halfX, halfZ, halfW: width / 2, halfD: depth / 2, angle: -angle }, place = town as MapPlace;
    if (roots.has(place)) {
      const forecourt: Plot = publicEsplanadePlot(place);
      const station = stationSites[place];
      if (collides(localPlot, forecourt) || (specialSites[place] ?? []).some(site => collides(localPlot, site)) ||
          station && collides(localPlot, { x: station[0] - .05, z: station[1], halfX: .10, halfZ: .18 })) {
        reserved++; return;
      }
    }
    const plot = { ...localPlot, x: worldX, z: worldZ };
    if (authored && town === "paris" && fixedProjectPlots.some(other => collides(plot, other, .020))) { reserved++; return; }
    if (authored?.id.includes("-tissu14-") &&
        (baseHousePlots.some(other => collides(plot, other, -.004)) ||
          fixedProjectPlots.some(other => collides(plot, other, .020)))) { reserved++; return; }
    if (authored && allPublicPlots.some(space => collides(plot, space))) { reserved++; return; }
    if (authored?.national && harbourReservations.some(polygon => harbourPolygonsOverlap(polygon, survey.slice(0, 4)))) {
      reserved++; return;
    }
    const national = intersectsRoad(plot, !!authored),
      rail = !!authored && intersectsCorridors(plot, railCorridors, true),
      local = !!authored && intersectsCorridors(plot, localStreets, true);
    if (national || rail || local) {
      if (authored) parisConflicts.set(authored.id, [national ? "national" : "", rail ? "rail" : "", local ? "local" : ""].filter(Boolean));
      roadside++; return;
    }
    if (occupied.some(other => collides(plot, other, -.004))) { overlaps++; return; }
    const levels = (authored ? survey : survey.slice(1)).map(point => landHeight(point.x, point.z)),
      highest = Math.max(...levels), lowest = Math.min(...levels), grade = highest - lowest;
    // Stone river quarters can use a short surveyed retaining footing. Rural
    // slopes keep the smaller limit so mountain silhouettes stay unoccupied.
    const gradeLimit = authored?.national && !rural ? .045 : .035;
    if (grade > gradeLimit || !authored && rural && highest > .62) { steep++; return; }
    occupied.push(plot);
    const asset = sourceKit.instantiate(name, root, authored && !authored.national
      ? { key: "paris-warm-cut-stone", tint: [1, .965, .89] } : undefined);
    // Eligibility retains the validated corner-and-centre survey. The actual
    // footing also checks the interior: bilinear terrain may rise between
    // those points even when a street parcel's outer grade is acceptable.
    const footingLevels = authored ? Array.from({ length: 9 }, (_, i) =>
      Array.from({ length: 9 }, (_, j) => landHeight(
        survey[0].x + (survey[1].x - survey[0].x) * i / 8 + (survey[3].x - survey[0].x) * j / 8,
        survey[0].z + (survey[1].z - survey[0].z) * i / 8 + (survey[3].z - survey[0].z) * j / 8,
      ))).flat() : levels,
      c = Math.cos(angle), sn = Math.sin(angle),
      physicalFootprint = [[-width / 2, -depth / 2], [width / 2, -depth / 2],
        [width / 2, depth / 2], [-width / 2, depth / 2]].map(([u, v]) => ({
          x: worldX + u * c + v * sn, z: worldZ - u * sn + v * c,
        })),
      renderedLevels = renderedFootprintLevels(physicalFootprint),
      footingHighest = Math.max(...footingLevels, ...renderedLevels),
      footingLowest = Math.min(...footingLevels, ...renderedLevels),
      footingGrade = footingHighest - footingLowest;
    // The stone footing follows the house alone. It fills a surveyed slope,
    // without paving an entire lot or leaving a building floating over a valley.
    const floor = footingHighest + .003;
    if (footingGrade > .010 || footingHighest > highest + .001) {
      const foundation = located("house-footing", root, centreX, centreZ, angle);
      foundation.position.y = floor - root.position.y;
      foundation.metadata = { houseFooting: true, frontage: authored?.id, town,
        surveyedMinimum: footingLowest, surveyedMaximum: footingHighest,
        renderedGroundMinimum: renderedLevels.length ? Math.min(...renderedLevels) : null,
        renderedGroundMaximum: renderedLevels.length ? Math.max(...renderedLevels) : null };
      box("house-stone-footing", width * .98, footingGrade + .004, depth * .98, stone, foundation,
        0, -(footingGrade + .004) / 2, 0);
    }
    asset.root.position.set(x, floor - root.position.y, z);
    asset.root.rotation.y = angle;
    asset.root.scaling.setAll(scale);
    // Authored heights express each address's role directly: low ancillary
    // roofs, ordinary houses and occasional taller street accents. All national
    // models retain their individually surveyed footprint and floor.
    const typeHeight = name.startsWith("ferme") ? 1.15 : name === "boutique_01" ? 1.23 :
      regionalHeight[region] - (rural ? .015 : 0),
      heightFactor = Math.max(1.15, Math.min(1.25, typeHeight + [-.01, .015, -.005, .01][index % 4]));
    asset.root.scaling.y = authored ? authored.height / bounds.height : scale * heightFactor;
    asset.root.scaling.z *= depth / naturalDepth;
    asset.root.metadata = { ...asset.root.metadata, town, domestic: true,
      heightFactor: authored ? authored.height / (bounds.height * scale) : heightFactor,
      ...(authored ? { authoredParis: !authored.national, authoredNational: !!authored.national,
        block: authored.block, frontage: authored.id } : {}) };
    meshes.push(...asset.meshes);
    counts[town] = (counts[town] ?? 0) + 1;
    usedArchetypes.add(name);
    return true;
  };

  const parisRoot = roots.get("paris")!;
  for (const route of PARIS_STREETS)
    street(parisRoot, route.points.map(point => [...point] as [number, number]), route.width);
  const parisReport: Array<{ id: string; block: string; accepted: boolean; reason?: string; corridors?: string[] }> = [];
  const rejectionCounts = () => ({ coastal, waterside, reserved, overlaps, roadside, steep });
  for (const block of PARIS_BLOCKS) for (const [index, building] of block.buildings.entries()) {
    const before = rejectionCounts(),
      accepted = !!placeHouse(parisRoot, "paris", "paris", building.x, building.z, building.angle,
        building.width, index, undefined, { ...building, block: block.id,
          kit: parisKit.names.includes(building.model) ? parisKit : kit }),
      after = rejectionCounts(), reason = Object.keys(after).find(key => after[key as keyof typeof after] > before[key as keyof typeof before]);
    parisReport.push({ id: building.id, block: block.id, accepted, ...(reason ? { reason } : {}),
      ...(parisConflicts.has(building.id) ? { corridors: parisConflicts.get(building.id) } : {}) });
  }
  for (const space of PARIS_SPACES) {
    if (space.kind !== "court" && space.kind !== "square") continue;
    const points = space.outline.map(([x, z]) => ({ x: parisRoot.position.x + x, z: parisRoot.position.z + z }));
    if (points.some(point => !landContains(point.x, point.z) || riverContains(point.x, point.z, .008))) continue;
    const centre = { x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      z: points.reduce((sum, point) => sum + point.z, 0) / points.length }, shape = new Geometry(),
      vertex = (point: GroundPoint): Point => [point.x, landHeight(point.x, point.z) + .009, point.z];
    const signedArea = points.reduce((sum, point, i) => {
      const next = points[(i + 1) % points.length];
      return sum + point.x * next.z - next.x * point.z;
    }, 0);
    // createCityMesh reverses triangle indices for Babylon. Clockwise input
    // gives the final courtyard faces upward normals instead of black paving.
    if (signedArea > 0) points.reverse();
    for (let i = 0; i < points.length; i++) shape.triangle(vertex(centre), vertex(points[i]), vertex(points[(i + 1) % points.length]));
    const court = geometry(`paris-${space.id}`, shape, pavement);
    court.metadata = { ...court.metadata, castsShadow: false, authoredParisGround: true };
  }

  const gardenGrassNorth = new StandardMaterial("garden-grass-north", scene),
    gardenGrassSouth = new StandardMaterial("garden-grass-south", scene);
  gardenGrassNorth.diffuseColor = Color3.FromHexString("#62764D");
  gardenGrassSouth.diffuseColor = Color3.FromHexString("#748249");
  gardenGrassNorth.specularColor = gardenGrassSouth.specularColor = Color3.Black();
  const ruralRoots: TransformNode[] = [], settlementRoots = new Map<string, TransformNode>(),
    nationalReport: Array<{ id: string; town: string; block: string; accepted: boolean; reason?: string; corridors?: string[] }> = [];
  for (const settlement of NATIONAL_SETTLEMENTS) {
    let root = roots.get(settlement.name as MapPlace);
    if (!root) {
      const point = mapPosition(settlement.lon, settlement.lat);
      root = new TransformNode(`village-${settlement.name}`, scene);
      root.position.set(point.x, landHeight(point.x, point.z) + .012, point.z);
      ruralRoots.push(root);
    }
    settlementRoots.set(settlement.name, root);
    for (const route of settlement.streets ?? [])
      street(root, route.points.map(point => [...point] as [number, number]), route.width);
    for (const block of settlement.blocks) for (const [index, building] of block.buildings.entries()) {
      const before = rejectionCounts(), accepted = !!placeHouse(root, settlement.name, settlement.region,
        building.x, building.z, building.angle, building.width, index, undefined,
        { ...building, national: true, block: block.id, kit }), after = rejectionCounts(),
        reason = Object.keys(after).find(key => after[key as keyof typeof after] > before[key as keyof typeof before]);
      nationalReport.push({ id: building.id, town: settlement.name, block: block.id, accepted,
        ...(reason ? { reason } : {}), ...(parisConflicts.has(building.id) ? { corridors: parisConflicts.get(building.id) } : {}) });
    }
    // Tiny native-ground gardens reuse the actual terrain triangle surface.
    for (const garden of settlement.gardens ?? []) {
      const world = garden.outline.map(([x, z]) => ({ x: root!.position.x + x, z: root!.position.z + z })),
        cx = root.position.x + garden.x, cz = root.position.z + garden.z,
        footprint: Plot = { x: cx, z: cz, halfX: garden.width / 2, halfZ: garden.depth / 2,
          halfW: garden.width / 2, halfD: garden.depth / 2, angle: -garden.angle };
      if (world.some(point => !landContains(point.x, point.z) || riverContains(point.x, point.z, .006)) ||
          intersectsRoad(footprint) || intersectsCorridors(footprint, railCorridors, true) ||
          intersectsCorridors(footprint, localStreets, true) ||
          occupied.some(plot => collides(plot, footprint, .004)) ||
          fixedProjectPlots.some(plot => collides(plot, footprint, .015)) ||
          allPublicPlots.some(plot => collides(plot, footprint, .004)) ||
          harbourReservations.some(polygon => harbourPolygonsOverlap(polygon, world))) continue;
      const signedArea = world.reduce((sum, p, i) => {
        const next = world[(i + 1) % world.length]; return sum + p.x * next.z - next.x * p.z;
      }, 0);
      if (signedArea < 0) world.reverse();
      const shape = new Geometry(), minX = Math.min(...world.map(p => p.x)), maxX = Math.max(...world.map(p => p.x)),
        minZ = Math.min(...world.map(p => p.z)), maxZ = Math.max(...world.map(p => p.z)),
        triangles = new Set<Point[]>();
      for (let x = Math.floor(minX / .10); x <= Math.floor(maxX / .10); x++)
        for (let z = Math.floor(minZ / .10); z <= Math.floor(maxZ / .10); z++)
          for (const triangle of gardenTerrainCells.get(`${x}:${z}`) ?? []) triangles.add(triangle);
      for (const triangle of triangles) {
        let polygon = triangle.map(p => [...p] as Point);
        for (let edge = 0; edge < world.length && polygon.length; edge++) {
          const a = world[edge], b = world[(edge + 1) % world.length],
            side = (p: Point) => (b.x - a.x) * (p[2] - a.z) - (b.z - a.z) * (p[0] - a.x),
            clipped: Point[] = [];
          for (let i = 0; i < polygon.length; i++) {
            const p = polygon[i], q = polygon[(i + 1) % polygon.length], sp = side(p), sq = side(q);
            if (sp >= -1e-10) clipped.push(p);
            if ((sp < 0) !== (sq < 0)) {
              const t = sp / (sp - sq);
              clipped.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
            }
          }
          polygon = clipped;
        }
        if (polygon.length < 3) continue;
        const area = polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length];
          return sum + p[0] * q[2] - q[0] * p[2]; }, 0);
        if (Math.abs(area) < 1e-12) continue;
        if (area > 0) polygon.reverse();
        const vertex = (p: Point): Point => [p[0], p[1] + .002, p[2]];
        for (let i = 1; i < polygon.length - 1; i++)
          shape.triangle(vertex(polygon[0]), vertex(polygon[i]), vertex(polygon[i + 1]));
      }
      if (!shape.positions.length) continue;
      const mesh = geometry(`national-garden-${garden.id}`, shape,
        settlement.region === "south" ? gardenGrassSouth : gardenGrassNorth);
      mesh.metadata = { ...mesh.metadata, castsShadow: false, authoredNationalGarden: true, town: settlement.name,
        garden: garden.id, nativeTriangleGround: true };
    }
    // Small threshold aprons and connected venelles belong to the actual roofs.
    // The land between them stays visible instead of becoming one beige plate.
    for (const block of settlement.blocks) {
      const shape = new Geometry(),
        houses = block.buildings.filter(house => nationalReport.some(report => report.id === house.id && report.accepted)),
        doors: GroundPoint[] = [];
      const pave = (polygon: GroundPoint[]) => {
        if (polygon.some(point => !landContains(point.x, point.z) || riverContains(point.x, point.z, .009))) return;
        const signedArea = polygon.reduce((sum, point, i) => {
          const next = polygon[(i + 1) % polygon.length];
          return sum + point.x * next.z - next.x * point.z;
        }, 0);
        if (signedArea > 0) polygon.reverse();
        const centre = { x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
          z: polygon.reduce((sum, point) => sum + point.z, 0) / polygon.length },
          vertex = (point: GroundPoint): Point => [point.x, landHeight(point.x, point.z) + .009, point.z];
        for (let i = 0; i < polygon.length; i++)
          shape.triangle(vertex(centre), vertex(polygon[i]), vertex(polygon[(i + 1) % polygon.length]));
      };
      for (const house of houses) {
        const c = Math.cos(house.angle), s = Math.sin(house.angle),
          cx = root.position.x + house.x + s * house.footprintOffset,
          cz = root.position.z + house.z + c * house.footprintOffset,
          point = (x: number, z: number) => ({ x: cx + c * x + s * z, z: cz - s * x + c * z }),
          width = house.width / 2, depth = house.depth / 2;
        pave([point(-width - .006, depth + .002), point(width + .006, depth + .002),
          point(width + .006, depth + .017), point(-width - .006, depth + .017)]);
        doors.push(point(0, depth + .019));
      }
      const links = doors.flatMap((a, i) => doors.slice(i + 1).map((b, offset) => ({
        a, b, from: i, to: i + 1 + offset, distance: Math.hypot(a.x - b.x, a.z - b.z),
      }))).filter(link => link.distance < .48).sort((a, b) => a.distance - b.distance),
        groups = doors.map((_, i) => i);
      for (const link of links) {
        if (groups[link.from] === groups[link.to]) continue;
        const corridor = [{ start: link.a, end: link.b, halfWidth: .006 }],
          samples = Array.from({ length: 12 }, (_, i) => ({
            x: link.a.x + (link.b.x - link.a.x) * i / 11,
            z: link.a.z + (link.b.z - link.a.z) * i / 11,
          }));
        if (allAuthoredHousePlots.some(plot => intersectsCorridors(plot, corridor, true)) ||
            fixedProjectPlots.some(plot => intersectsCorridors(plot, corridor, true)) ||
            allPublicPlots.some(plot => intersectsCorridors(plot, corridor, true)) ||
            samples.some(point => !landContains(point.x, point.z) || riverContains(point.x, point.z, .012))) continue;
        const nx = -(link.b.z - link.a.z) / link.distance * .006,
          nz = (link.b.x - link.a.x) / link.distance * .006;
        pave([{ x: link.a.x + nx, z: link.a.z + nz }, { x: link.a.x - nx, z: link.a.z - nz },
          { x: link.b.x - nx, z: link.b.z - nz }, { x: link.b.x + nx, z: link.b.z + nz }]);
        localStreets.push({ start: link.a, end: link.b, halfWidth: .006 });
        const previous = groups[link.to], replacement = groups[link.from];
        for (let i = 0; i < groups.length; i++) if (groups[i] === previous) groups[i] = replacement;
      }
      if (shape.positions.length) {
        const court = geometry(`national-court-${block.id}`, shape, pavement);
        court.metadata = { ...court.metadata, castsShadow: false, authoredNationalGround: true, town: settlement.name };
      }
    }
  }

  const placeMonument = (name: string, town: MapPlace, x: number, z: number, scale: number, angle = 0, sourceKit = kit) => {
    if (!sourceKit.names.includes(name)) return;
    const root = roots.get(town)!, asset = sourceKit.instantiate(name, root, town === "paris"
      ? { key: "paris-cathedral-stone", tint: [1, .985, .945] } : undefined),
      bounds = sourceKit.bounds(name), footprint = parisBuildingFootprint({ id: name, model: "immeuble_paris_01",
        x, z, angle, width: bounds.width * scale, depth: bounds.depth * scale, height: bounds.height * scale }),
      levels = name === "cathedrale_paris" ? Array.from({ length: 9 }, (_, i) =>
        Array.from({ length: 9 }, (_, j) => landHeight(
          root.position.x + footprint[0][0] + (footprint[1][0] - footprint[0][0]) * i / 8 + (footprint[3][0] - footprint[0][0]) * j / 8,
          root.position.z + footprint[0][1] + (footprint[1][1] - footprint[0][1]) * i / 8 + (footprint[3][1] - footprint[0][1]) * j / 8,
        ))).flat() : footprint.map(([px, pz]) => landHeight(root.position.x + px, root.position.z + pz)),
      ground = Math.max(landHeight(root.position.x + x, root.position.z + z), ...levels),
      floor = ground + (name === "cathedrale_paris" ? .003 : .008);
    asset.root.position.set(x, floor - root.position.y, z);
    asset.root.scaling.setAll(scale);

    asset.root.rotation.y = angle;
    asset.root.metadata = { ...asset.root.metadata, town, monument: true };
    if (name === "cathedrale_paris") {
      const footingHeight = floor - Math.min(...levels) + .002,
        footing = located("cathedral-stone-footing", root, x, z, angle);
      footing.position.y = floor - root.position.y;
      box("cathedral-retaining-footing", bounds.width * scale * .98, footingHeight,
        bounds.depth * scale * .98, stone, footing, 0, -footingHeight / 2, 0);
      const minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
      for (const mesh of asset.meshes) {
        mesh.computeWorldMatrix(true);
        const bounds = mesh.getBoundingInfo().boundingBox;
        for (let axis = 0; axis < 3; axis++) {
          minimum[axis] = Math.min(minimum[axis], bounds.minimumWorld.asArray()[axis]);
          maximum[axis] = Math.max(maximum[axis], bounds.maximumWorld.asArray()[axis]);
        }
      }
      root.metadata = { ...root.metadata, landmarkBounds: { minimum, maximum } };
    }
    meshes.push(...asset.meshes);
  };
  placeMonument("cathedrale_paris", "paris", cathedralSite.x, cathedralSite.z, cathedralScale, cathedralSite.angle, cathedralKit);
  placeMonument("beffroi_nord", "lille", -.48, .13, .135, .03);
  placeMonument("mairie_sud", "toulouse", -.35, .51, .16, -.03);
  placeMonument("mairie_sud", "lyon", -.42, .57, .12, .06);
  factory(roots.get("lille")!, -.70, -.65, true);
  hospital(roots.get("rennes")!, .37, .47);
  school(roots.get("lyon")!);
  for (const [town, root] of roots) esplanade(root, town);

  const planted: Plot[] = [], treeCounts: Record<string, number> = {};
  const surroundingTrees = scene.transformNodes.filter(node => node.metadata?.authoredAsset &&
    ["oak", "beech", "pine", "cypress", "olive", "orchard"].includes(node.metadata?.asset)).map(node => {
      node.computeWorldMatrix(true);
      const position = node.getAbsolutePosition();
      return { x: position.x, z: position.z, halfX: .025, halfZ: .025 };
    });
  const treeCorridors = [...localStreets, ...railCorridors];
  const blocksTree = (x: number, z: number) => treeCorridors.some(({ start, end, halfWidth }) => {
    const dx = end.x - start.x, dz = end.z - start.z,
      lengthSquared = dx * dx + dz * dz;
    const progress = Math.max(0, Math.min(1, ((x - start.x) * dx + (z - start.z) * dz) / Math.max(lengthSquared, .000001)));
    return Math.hypot(x - start.x - progress * dx, z - start.z - progress * dz) < halfWidth + .014;
  });
  const ruralRegions = new Map<string, UrbanRegion>(RURAL_SETTLEMENTS.map(town => [town.name, town.region]));
  const plantTownTree = (root: TransformNode, town: string, x: number, z: number, height: number, model?: string) => {
    const worldX = root.position.x + x, worldZ = root.position.z + z;
    const trunkPlot: Plot = { x: worldX, z: worldZ, halfX: .015, halfZ: .015 };
    if (!landContains(worldX, worldZ) || riverContains(worldX, worldZ, .02) ||
        intersectsRoad(trunkPlot) || blocksTree(worldX, worldZ) ||
        harbourReservations.some(polygon => harbourPolygonsOverlap(polygon, [
          { x: worldX - .035, z: worldZ - .035 }, { x: worldX + .035, z: worldZ - .035 },
          { x: worldX + .035, z: worldZ + .035 }, { x: worldX - .035, z: worldZ + .035 },
        ])) ||
        fixedProjectPlots.some(plot => collides(plot, trunkPlot, .035)) ||
        occupied.some(plot => collides(plot, trunkPlot, .008)) ||
        surroundingTrees.some(plot => collides(plot, trunkPlot, .012)) ||
        planted.some(plot => collides(plot, { ...trunkPlot, halfX: .04, halfZ: .04 }))) return;
    const station = stationSites[town as MapPlace];
    if (station && collides({ x, z, halfX: .035, halfZ: .035 },
      { x: station[0] - .05, z: station[1], halfX: .11, halfZ: .19 })) return;
    if (roots.has(town as MapPlace) &&
        (collides({ x, z, halfX: .02, halfZ: .02 }, { x: .02, z: -.36, halfX: .24, halfZ: .14 }) ||
        (specialSites[town as MapPlace] ?? []).some(site => collides({ x, z, halfX: .035, halfZ: .035 }, site)))) return;
    if (["tours", "orleans", "caen", "reims", "dijon"].includes(town) &&
        Math.hypot(x - .28, z - .16) < .085) return;
    const regional = URBAN_PLANS[town as MapPlace]?.region ?? ruralRegions.get(town);
    const name = model ?? (regional === "south" ? (rng() > .5 ? "cypress" : "olive") : rng() > .5 ? "oak" : "beech");
    const asset = greenery.instantiate(name, root), bounds = greenery.bounds(name);
    asset.root.position.set(x, landHeight(worldX, worldZ) + .002 - root.position.y, z);
    asset.root.rotation.y = rng() * Math.PI * 2;
    asset.root.scaling.setAll(height / bounds.height);
    if (name === "pine") {
      asset.root.scaling.x *= .58;
      asset.root.scaling.z *= .58;
    }
    meshes.push(...asset.meshes);
    planted.push(trunkPlot);
    treeCounts[town] = (treeCounts[town] ?? 0) + 1;
  };
  for (const tree of PARIS_TREES) plantTownTree(parisRoot, "paris", tree.x, tree.z, tree.height, tree.model);
  for (const settlement of NATIONAL_SETTLEMENTS) {
    const root = settlementRoots.get(settlement.name)!;
    for (const tree of settlement.trees) plantTownTree(root, settlement.name, tree.x, tree.z, tree.height, tree.model);
  }

  const marseille = roots.get("marseille")!, ajaccio = roots.get("ajaccio")!;
  meshes.push(...buildHarbour(scene, marseille, "marseille", cityMaterials));
  meshes.push(...buildHarbour(scene, roots.get("nantes")!, "nantes", cityMaterials));
  meshes.push(...buildHarbour(scene, ajaccio, "ajaccio", cityMaterials));
  const brest = ruralRoots.find(root => root.name === "village-brest");
  if (brest) meshes.push(...buildHarbour(scene, brest, "brest", cityMaterials));
  const rhonePlant = mapPosition(4.9, 44.6), lorrainePlant = mapPosition(5.82, 48.9);
  meshes.push(...buildPowerPlant(scene, new Vector3(rhonePlant.x, 0, rhonePlant.z), cityMaterials));
  meshes.push(...buildPowerPlant(scene, new Vector3(lorrainePlant.x, 0, lorrainePlant.z), cityMaterials));
  meshes.push(...buildWindTurbines(scene, [mapPosition(-4.76, 48.12), mapPosition(-4.99, 48.25),
    mapPosition(-5.18, 48.14), mapPosition(4.55, 44.48), mapPosition(4.4, 44.53)]
    .map(point => new Vector3(point.x, 0, point.z)), cityMaterials));
  const railway = buildRailNetwork(scene, cityMaterials, stationSites, kit, transportMaterials);
  meshes.push(...railway.meshes);
  vehicles.push(...railway.vehicles);

  for (const [town, x, z, angle, length] of [
    ["paris", .543, -.318, .62, .16], ["rouen", -.06, .012, .16, .16],
    ["nantes", .012, 0, .07, .17], ["bordeaux", .004, 0, .06, .17],
    ["toulouse", .007, 0, .12, .16], ["lyon", .025, .02, .15, .17],
  ] as Array<[MapPlace, number, number, number, number]>)
    bridge(roots.get(town)!, x, z, angle, length);
  // Geographic bends run through inland corridors. Sampling terrain on both
  // road edges keeps the network grounded and rejects accidental coastal cuts.


  const carShape = new Geometry();
  const networkPaths: Vector3[][] = [];
  carShape.box(0, 0.012, 0, 0.022, 0.014, 0.048);
  carShape.box(0, 0.023, -0.003, 0.02, 0.01, 0.025);
  for (const [index, route] of routes.entries()) {
    const points = [roadAnchor(route.from), ...route.via, roadAnchor(route.to)].map(([lon, lat]) => mapBaselinePosition(lon, lat)),
      runs = road(`national-road-${index}`, points, 0.033);
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

  // Each village reaches an existing road from an outside edge of its compact
  // block. A lane cannot cut through a roof, public site, harbour or river.
  const settlementLanes: Array<{ town: string; start: GroundPoint; end: GroundPoint }> = [];
  for (const settlement of NATIONAL_SETTLEMENTS) {
    const root = settlementRoots.get(settlement.name)!;
    for (const block of settlement.blocks) {
      const centre = { x: block.outline.reduce((sum, point) => sum + point[0], 0) / block.outline.length,
        z: block.outline.reduce((sum, point) => sum + point[1], 0) / block.outline.length },
        candidates: Array<{ start: GroundPoint; end: GroundPoint; distance: number }> = [];
      for (let i = 0; i < block.outline.length; i++) {
        const a = block.outline[i], b = block.outline[(i + 1) % block.outline.length];
        for (const point of [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]]) {
          const dx = point[0] - centre.x, dz = point[1] - centre.z, length = Math.max(.001, Math.hypot(dx, dz)),
            start = { x: root.position.x + point[0] + dx / length * .025,
              z: root.position.z + point[1] + dz / length * .025 };
          for (const path of networkPaths) for (const end of path) {
            const distance = Math.hypot(end.x - start.x, end.z - start.z);
            if (distance > 1.1 || distance < .035) continue;
            candidates.push({ start, end, distance });
          }
        }
      }
      candidates.sort((a, b) => a.distance - b.distance);
      const lane = candidates.find(({ start, end }) => {
        const corridor = [{ start, end, halfWidth: .016 }],
          samples = Array.from({ length: 15 }, (_, i) => ({ x: start.x + (end.x - start.x) * i / 14,
            z: start.z + (end.z - start.z) * i / 14 }));
        if (samples.some(point => !landContains(point.x, point.z) || riverContains(point.x, point.z, .011)) ||
            occupied.some(plot => intersectsCorridors(plot, corridor, true)) ||
            fixedProjectPlots.some(plot => intersectsCorridors(plot, corridor, true)) ||
            planted.some(plot => intersectsCorridors({ ...plot, halfX: .025, halfZ: .025 }, corridor, true)) ||
            surroundingTrees.some(plot => intersectsCorridors(plot, corridor, true)) ||
            allPublicPlots.some(plot => intersectsCorridors(plot, corridor, true))) return false;
        const dx = end.x - start.x, dz = end.z - start.z, length = Math.hypot(dx, dz), nx = -dz / length * .009, nz = dx / length * .009,
          ribbon = [{ x: start.x + nx, z: start.z + nz }, { x: start.x - nx, z: start.z - nz },
            { x: end.x - nx, z: end.z - nz }, { x: end.x + nx, z: end.z + nz }];
        return !harbourReservations.some(polygon => harbourPolygonsOverlap(polygon, ribbon));
      });
      if (!lane) continue;
      road(`settlement-lane-${block.id}`, [lane.start, lane.end], .012, true, true);
      localStreets.push({ start: lane.start, end: lane.end, halfWidth: .012 });
      settlementLanes.push({ town: settlement.name, start: lane.start, end: lane.end });
    }
  }

  const publicSpaces = [...roots.entries()].flatMap(([town, root]) => {
    const sites = [...specialSites[town] ?? []];
    const station = stationSites[town];
    if (station) sites.push({ x: station[0] - .05, z: station[1], halfX: .11, halfZ: .19 });
    return [...sites, { x: .02, z: -.36, halfX: .24, halfZ: .14 }].map(site => ({
      ...site, x: site.x + root.position.x, z: site.z + root.position.z,
    }));
  });
  // Preserve the actual riverside and cloister shapes when surveying work
  // parcels. Their bounding rectangles can extend into a dry reserved site.
  const parisPublicPolygons = PARIS_SPACES.map(space => space.outline.map(([x, z]) => ({
    x: parisRoot.position.x + x, z: parisRoot.position.z + z,
  })));
  const nationalPublicPolygons = NATIONAL_SETTLEMENTS.flatMap(settlement => {
    const origin = settlementRoots.get(settlement.name)!.position;
    return [...settlement.blocks, ...settlement.gardens ?? []].map(space => space.outline.map(([x, z]) => ({
      x: origin.x + x, z: origin.z + z,
    })));
  });
  for (const plant of [rhonePlant, lorrainePlant])
    publicSpaces.push({ x: plant.x + .14, z: plant.z, halfX: .42, halfZ: .24 });
  for (const [town, root] of roots) {
    const sites: Array<{ x: number; z: number; y: number }> = [];
    const trees = scene.transformNodes.filter(node => node.metadata?.authoredAsset &&
      ["oak", "beech", "pine", "cypress", "olive", "orchard"].includes(node.metadata?.asset));
    const vegetation = trees.map(node => {
      node.computeWorldMatrix(true);
      const position = node.getAbsolutePosition();
      return { x: position.x, z: position.z, halfX: .04, halfZ: .04 };
    });
    const candidates: Array<{ x: number; z: number; y: number; score: number; reservationIndex: number }> = [];
    // Compact quarters leave fewer empty parcels beside their centre. Survey
    // the surrounding real terrain as well, keeping the full construction
    // footprint clear of every town, transport corridor and harbour.
    const siteDirections = 60, seedSites = [
      ...AUTHORED_PROJECT_RESERVATIONS[town]?.map(site => [site.x, site.z]) ?? [],
      ...town === "rouen" ? [[-.85, -1], [-1.65, -.65], [.85, 1.80]] :
        town === "montpellier" ? [[-.80, 1.25]] : [],
    ],
      searchPoints = [...seedSites.map(([x, z]) => ({ x, z })), ...[.20, .35, .50, .65, .80, .95, 1.10, 1.25, 1.40, 1.55, 1.70, 1.85, 2.0].flatMap(distance =>
        Array.from({ length: siteDirections }, (_, i) => ({ x: Math.cos(i * Math.PI * 2 / siteDirections) * distance,
          z: Math.sin(i * Math.PI * 2 / siteDirections) * distance })))];
    for (const { x, z } of searchPoints) {
      const distance = Math.hypot(x, z),
        plot: Plot = { x: root.position.x + x, z: root.position.z + z, halfX: .21, halfZ: .20 },
        survey = [-1, -.5, 0, .5, 1].flatMap(dx => [-1, -.5, 0, .5, 1].map(dz => ({
          x: plot.x + dx * plot.halfX, z: plot.z + dz * plot.halfZ,
        })));
      if (survey.some(point => !landContains(point.x, point.z) || riverContains(point.x, point.z, .025)) ||
          occupied.some(house => collides(plot, house, .012)) ||
          publicSpaces.some(space => collides(plot, space, .016)) || intersectsRoad(plot) ||
          intersectsCorridors(plot, railCorridors, true) || intersectsCorridors(plot, localStreets, true)) continue;
      const projectFootprint = [[-plot.halfX, -plot.halfZ], [plot.halfX, -plot.halfZ],
        [plot.halfX, plot.halfZ], [-plot.halfX, plot.halfZ]].map(([x, z]) => ({ x: plot.x + x, z: plot.z + z }));
      if (harbourReservations.some(polygon => harbourPolygonsOverlap(polygon, projectFootprint)) ||
          parisPublicPolygons.some(polygon => harbourPolygonsOverlap(polygon, projectFootprint)) ||
          nationalPublicPolygons.some(polygon => harbourPolygonsOverlap(polygon, projectFootprint))) continue;
      const levels = survey.map(point => landHeight(point.x, point.z)),
        variation = Math.max(...levels) - Math.min(...levels);
      if (variation > .065) continue;
      const nearbyTrees = vegetation.filter(tree => collides(plot, tree)).length;
      candidates.push({ x, z, y: Math.max(...levels) + .012,
        score: nearbyTrees * .05 + variation * 2 + distance * .10,
        reservationIndex: AUTHORED_PROJECT_RESERVATIONS[town]?.findIndex(site =>
          Math.abs(site.x - x) < 1e-9 && Math.abs(site.z - z) < 1e-9) ?? -1 });
    }
    candidates.sort((a, b) => (a.reservationIndex < 0 ? Infinity : a.reservationIndex) -
      (b.reservationIndex < 0 ? Infinity : b.reservationIndex) || a.score - b.score);
    const maximumSites = AUTHORED_PROJECT_RESERVATIONS[town]?.length ?? 3;
    for (const candidate of candidates) {
      if (sites.length >= maximumSites) break;
      if (sites.some(site => Math.hypot(site.x - candidate.x, site.z - candidate.z) < .50)) continue;
      sites.push({ x: candidate.x, z: candidate.z, y: candidate.y });
      if (sites.length === 3) break;
    }
    root.metadata = { ...root.metadata, projectSites: sites, projectSiteTown: town };
  }

  scene.metadata = { ...(scene.metadata ?? {}), authoredParis: {
    blocks: PARIS_BLOCKS.map(block => block.id), placements: parisReport,
    footprints: PARIS_BLOCKS.flatMap(block => block.buildings.filter(building =>
      parisReport.some(report => report.id === building.id && report.accepted)).map(building => ({
        id: building.id, block: block.id, outline: parisBuildingFootprint(building), height: building.height,
      }))),
  }, authoredNational: { placements: nationalReport, lanes: settlementLanes }, authoredUrban: {
    houses: Object.values(counts).reduce((sum, count) => sum + count, 0),
    towns: counts, candidates, coastal, waterside, reserved, overlaps, roadside, steep,
    archetypes: usedArchetypes.size, usedArchetypes: [...usedArchetypes].sort(),
    townTrees: planted.length, treesByTown: treeCounts,
  } };
  return { roots, meshes, vehicles };
}
