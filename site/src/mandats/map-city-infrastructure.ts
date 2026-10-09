import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CityGeometry, createCityMesh } from "./map-city-geometry.ts";
import type { CityMaterials } from "./map-city-materials.ts";
import { landContains, landHeight } from "./map-landscape.ts";
import { mapAuthoredPosition } from "./map-state.ts";
import { surveyHarbour, harbourStation, harbourPolygonsOverlap } from "./map-city-port-plans.ts";
import type { HarbourPoint } from "./map-city-port-plans.ts";

function toolkit(scene: Scene, meshes: Mesh[]) {
  let serial = 0;
  const save = (mesh: Mesh, material: StandardMaterial, parent?: TransformNode) => {
    mesh.material = material;
    mesh.parent = parent ?? null;
    mesh.isPickable = false;
    meshes.push(mesh);
    return mesh;
  };
  const box = (name: string, x: number, y: number, z: number, width: number, height: number, depth: number, material: StandardMaterial, parent?: TransformNode) => {
    const mesh = CreateBox(`${name}-${serial++}`, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    return save(mesh, material, parent);
  };
  const cylinder = (name: string, x: number, y: number, z: number, diameter: number, height: number, top: number, material: StandardMaterial, parent?: TransformNode) => {
    const mesh = CreateCylinder(`${name}-${serial++}`, { diameterBottom: diameter, diameterTop: top, height, tessellation: 16 }, scene);
    mesh.position.set(x, y, z);
    return save(mesh, material, parent);
  };
  const shape = (name: string, data: CityGeometry, material: StandardMaterial, parent?: TransformNode) => {
    const mesh = createCityMesh(scene, `${name}-${serial++}`, data, material, parent);
    meshes.push(mesh);
    return mesh;
  };
  const warehouse = (parent: TransformNode, x: number, z: number, material: StandardMaterial, materials: CityMaterials) => {
    const node = new TransformNode("dock-warehouse", scene);
    node.parent = parent;
    node.position.set(x, 0, z);
    box("warehouse-walls", 0, 0.058, 0, 0.2, 0.116, 0.12, material, node);
    const roof = new CityGeometry(), panes = new CityGeometry(), stonework = new CityGeometry();
    roof.quad([-0.106, 0.116, -0.065], [-0.106, 0.116, 0.065], [0, 0.167, 0.065], [0, 0.167, -0.065]);
    roof.quad([0, 0.167, -0.065], [0, 0.167, 0.065], [0.106, 0.116, 0.065], [0.106, 0.116, -0.065]);
    roof.triangle([-0.106, 0.116, -0.065], [0, 0.167, -0.065], [0.106, 0.116, -0.065]);
    roof.triangle([0.106, 0.116, 0.065], [0, 0.167, 0.065], [-0.106, 0.116, 0.065]);
    for (let i = 0; i < 4; i++) {
      const px = -0.072 + i * 0.048;
      panes.box(px, 0.05, -0.061, 0.023, 0.075, 0.003);
      stonework.box(px, 0.092, -0.063, 0.033, 0.006, 0.008);
    }
    stonework.box(0, 0.118, 0, 0.21, 0.006, 0.13);
    shape("warehouse-roof", roof, materials.slate, node);
    shape("warehouse-glazing", panes, materials.glass, node);
    shape("warehouse-details", stonework, materials.cream, node);
  };
  return { box, cylinder, shape, warehouse };
}

export function buildHarbour(scene: Scene, root: TransformNode, place: string, materials: CityMaterials): Mesh[] {
  const meshes: Mesh[] = [], plan = surveyHarbour(place, root.position);
  if (!plan) return meshes;
  const tool = toolkit(scene, meshes), node = new TransformNode(`port-${place}`, scene);
  // The quay, land contact and hull clearance share world coordinates. The
  // adjoining town can have a different scale without breaking their contact.
  node.metadata = { harbour: place, plan, castsShadow: false };
  const finish = (name: string, color: string, specular: number) => {
    const existing = scene.getMaterialByName(name);
    if (existing instanceof StandardMaterial) return existing;
    const material = new StandardMaterial(name, scene);
    material.diffuseColor = Color3.FromHexString(color);
    material.specularColor = new Color3(specular, specular, specular);
    material.specularPower = 48;
    return material;
  };
  const gold = finish("harbour-golden-iron", "#DBA344", .22), navy = finish("harbour-navy-hull", "#22485B", .15);
  let quayStone = scene.getMaterialByName("harbour-pale-masonry") as StandardMaterial | null;
  if (!quayStone) {
    quayStone = new StandardMaterial("harbour-pale-masonry", scene);
    // DynamicTexture clones have no uploaded canvas; share the ready surfaces.
    quayStone.diffuseTexture = materials.stone.diffuseTexture;
    quayStone.bumpTexture = materials.stone.bumpTexture;
    quayStone.specularPower = materials.stone.specularPower;
    quayStone.diffuseColor = Color3.FromHexString("#C9BFA5");
    quayStone.specularColor = new Color3(.065, .061, .055);
  }
  const stonework = new CityGeometry(), pavement = new CityGeometry(), edge = new CityGeometry(), iron = new CityGeometry(), joints = new CityGeometry();
  const prism = (outline: HarbourPoint[], heights: number[], target: CityGeometry) => {
    const top = outline.map((p, i): [number, number, number] => [p.x, heights[i], p.z]);
    const signed = outline.reduce((sum, a, i) => {
      const b = outline[(i + 1) % outline.length]; return sum + a.x * b.z - b.x * a.z;
    }, 0);
    if (signed > 0) top.reverse();
    if (top.length === 3) target.triangle(top[0], top[1], top[2]);
    else target.quad(top[0], top[1], top[2], top[3]);
    for (let i = 0; i < top.length; i++) {
      const a = top[i], b = top[(i + 1) % top.length];
      target.quad([a[0], -.114, a[2]], [b[0], -.114, b[2]], b, a);
    }
  };
  for (let i = 1; i < plan.stations.length; i++) {
    const a = plan.stations[i - 1], b = plan.stations[i];
    prism(plan.quayPolygons[i - 1], [a.height, b.height, b.height, a.height], stonework);
    const paving = plan.quayPolygons[i - 1].map((point, index): [number, number, number] => [point.x, (index === 0 || index === 3 ? a.height : b.height) + .0015, point.z]);
    const pavingSign = paving.reduce((sum, p, i) => sum + p[0] * paving[(i + 1) % 4][2] - paving[(i + 1) % 4][0] * p[2], 0);
    if (pavingSign > 0) paving.reverse();
    pavement.quad(paving[0], paving[1], paving[2], paving[3]);
    const shoreEdge = plan.quayPolygons[i - 1];
    edge.beam([shoreEdge[3].x, a.height + .002, shoreEdge[3].z], [shoreEdge[2].x, b.height + .002, shoreEdge[2].z], .0045);
    if (i % 5 === 1) {
      const point = shoreEdge[3];
      joints.beam([point.x, -.079, point.z], [point.x, a.height + .001, point.z], .0025);
    }
    if (i % 3 === 1) {
      const point = harbourStation(plan, (a.distance + b.distance) / 2, plan.apronDepth - .013);
      iron.box(point.x, point.height + .008, point.z, .009, .016, .009);
      iron.box(point.x, point.height + .016, point.z, .016, .003, .009);
    }
  }
  for (const polygon of plan.coastalJoins) {
    const closest = plan.stations.reduce((best, point) => Math.hypot(point.x - polygon[0].x, point.z - polygon[0].z) < Math.hypot(best.x - polygon[0].x, best.z - polygon[0].z) ? point : best);
    prism(polygon, polygon.map(() => closest.height), stonework);
    const triangle = polygon.map((p): [number, number, number] => [p.x, closest.height + .0016, p.z]);
    const sign = (triangle[1][0] - triangle[0][0]) * (triangle[2][2] - triangle[0][2]) - (triangle[1][2] - triangle[0][2]) * (triangle[2][0] - triangle[0][0]);
    if (sign > 0) triangle.reverse();
    pavement.triangle(triangle[0], triangle[1], triangle[2]);
  }
  let jettyPolygon = plan.stations.length - 1;
  const jettyLevel = harbourStation(plan, 0).height - .006;
  for (const jetty of plan.jetties) for (let i = 1; i < jetty.points.length; i++) {
    prism(plan.quayPolygons[jettyPolygon++], [jettyLevel, jettyLevel, jettyLevel, jettyLevel], stonework);
    const a = jetty.points[i - 1], b = jetty.points[i];
    edge.beam([a.x, jettyLevel + .001, a.z], [b.x, jettyLevel + .001, b.z], jetty.width * .60);
  }
  const access = new CityGeometry();
  for (let i = 1; i < plan.access.length; i++) {
    const a = plan.access[i - 1], b = plan.access[i], distance = Math.hypot(b.x - a.x, b.z - a.z);
    if (distance < .0001) continue;
    const count = Math.max(1, Math.ceil(distance / .018)), dx = (b.x - a.x) / distance, dz = (b.z - a.z) / distance;
    for (let step = 0; step < count; step++) {
      const corners = [step / count, (step + 1) / count].flatMap(t => [-1, 1].map(side => ({
        x: a.x + (b.x - a.x) * t - dz * .018 * side, z: a.z + (b.z - a.z) * t + dx * .018 * side,
      })));
      if (corners.some(p => !landContains(p.x, p.z))) continue;
      const vertices = corners.map((p): [number, number, number] => [p.x, landHeight(p.x, p.z) + .014, p.z]);
      access.quad(vertices[0], vertices[1], vertices[3], vertices[2]);
    }
  }
  tool.shape(`${place}-coastal-quay`, stonework, quayStone, node);
  tool.shape(`${place}-waterfront-paving`, pavement, materials.cream, node);
  tool.shape(`${place}-quay-block-joints`, joints, materials.stone, node);
  tool.shape(`${place}-quay-coping`, edge, materials.cream, node);
  tool.shape(`${place}-bollards`, iron, navy, node);
  if (access.indices.length) tool.shape(`${place}-coastal-access`, access, materials.pavement, node);

  // One narrow landing touches surveyed dry ground. The visible steps start
  // outside the coast, so their descent does not bury them inside the terrain.
  const shore = harbourStation(plan, 0), landing = harbourStation(plan, 0, -.035),
    top = Math.max(landHeight(landing.x, landing.z), landHeight(shore.x, shore.z)) + .014,
    stairAngle = Math.atan2(shore.nx, shore.nz), stairs = new TransformNode(`${place}-harbour-stairs`, scene),
    steps = new CityGeometry(), handrails = new CityGeometry();
  stairs.parent = node;
  stairs.position.set(shore.x, 0, shore.z);
  stairs.rotation.y = stairAngle;
  steps.box(0, top / 2 - .055, -.015, .042, top + .110, .040);
  const stairCount = 6;
  for (let step = 0; step < stairCount; step++) {
    const fraction = step / (stairCount - 1), level = top + (shore.height + .0015 - top) * fraction,
      z = .006 + step * .0065;
    steps.box(0, (level - .110) / 2, z, .042, level + .110, .0070);
  }
  for (const side of [-1, 1]) {
    handrails.beam([side * .020, top + .018, -.027], [side * .020, top + .018, .006], .0018);
    handrails.beam([side * .020, top + .018, .006], [side * .020, shore.height + .020, .039], .0018);
  }
  tool.shape(`${place}-coastal-access-stairs`, steps, quayStone, stairs);
  tool.shape(`${place}-coastal-access-handrails`, handrails, materials.steel, stairs);
  stairs.metadata = { harbourLanding: true, support: "surveyed-land-and-quay", top, deck: shore.height,
    ground: [landing.x, landHeight(landing.x, landing.z), landing.z], footprint: plan.stairsFootprints[0] };

  const crane = (fraction: number, height: number, small = false) => {
    const point = harbourStation(plan, fraction * plan.frontage, plan.apronDepth * .54), tower = new TransformNode(`${place}-golden-crane`, scene);
    const steel = new CityGeometry(), cables = new CityGeometry(), cab = new CityGeometry(), glass = new CityGeometry();
    tower.parent = node; tower.position.set(point.x, point.height, point.z); tower.rotation.y = Math.atan2(point.nx, point.nz);
    const foot = small ? .016 : .027, mast = height * .80, reach = small ? .12 : .245;
    for (const side of [-1, 1]) {
      for (const z of [-.024, .024]) steel.box(side * foot, -.002, z, small ? .008 : .012, .016, small ? .008 : .012);
      steel.beam([side * foot, .005, -.024], [side * foot * .5, mast, -.004], .006);
      steel.beam([side * foot, .005, .024], [side * foot * .5, mast, .018], .006);
      steel.beam([side * foot * .5, mast, -.052], [side * foot * .5, mast, reach], .005);
      steel.beam([side * foot * .5, mast, -.004], [side * foot * .32, height, .016], .005);
      cables.beam([side * foot * .32, height, .016], [side * foot * .5, mast, reach - .009], .0014);
      cables.beam([side * foot * .32, height, .016], [side * foot * .5, mast, -.052], .0014);
      for (let level = 0; level < 4; level++) {
        const y0 = .016 + level * (mast - .016) / 4, y1 = .016 + (level + 1) * (mast - .016) / 4;
        steel.beam([side * foot * .80, y0, -.017], [side * foot * .60, y1, .016], .0019);
        steel.beam([side * foot * .80, y0, .017], [side * foot * .60, y1, -.009], .0019);
      }
      for (let section = 0; section < 5; section++) {
        const z0 = -.042 + section * (reach + .04) / 5, z1 = -.042 + (section + 1) * (reach + .04) / 5;
        steel.beam([side * foot * .5, mast - .012, z0], [side * foot * .5, mast + .008, z1], .0016);
      }
    }
    steel.beam([-foot * .6, mast - .010, .005], [foot * .6, mast - .010, .005], .005);
    cables.beam([0, mast, reach * .78], [0, .060, reach * .78], .0013); cables.box(0, .056, reach * .78, .009, .008, .008);
    cab.box(0, mast - .018, .038, .035, .029, .031);
    glass.box(0, mast - .011, .054, .026, .015, .0015); glass.box(.018, mast - .011, .038, .0015, .015, .022);
    tool.shape("crane-golden-lattice", steel, gold, tower); tool.shape("crane-cables-hook", cables, navy, tower);
    tool.shape("crane-cabin", cab, gold, tower); tool.shape("crane-glass", glass, materials.glass, tower);
  };
  const cranePositions = place === "ajaccio" ? [.32] : place === "brest" ? [-.13, .27] : [-.29, .025, .31];
  cranePositions.forEach((fraction, index) => crane(fraction, place === "ajaccio" ? .225 : place === "brest" ? .36 + index * .03 : .415 - index * .027, place === "ajaccio"));

  const warehouse = (spec: (typeof plan.warehouses)[number], wall: StandardMaterial, roofMaterial: StandardMaterial) => {
    const { point, angle, width, depth, height } = spec;
    const building = new TransformNode(`${place}-waterfront-store`, scene);
    building.parent = node; building.position.set(point.x, height, point.z); building.rotation.y = angle;
    const walls = new CityGeometry(), roof = new CityGeometry(), detail = new CityGeometry(), glazing = new CityGeometry();
    const h = place === "ajaccio" ? .070 : .098, rise = place === "marseille" || place === "ajaccio" ? .030 : .042;
    const foundation = height - Math.min(...spec.footprint.map(p => landHeight(p.x, p.z))) + .004;
    detail.box(0, -foundation / 2, 0, width + .004, foundation, depth + .004);
    walls.box(0, h / 2, 0, width, h, depth);
    const x = width / 2 + .005, z = depth / 2 + .005;
    roof.quad([-x, h, -z], [-x, h, z], [0, h + rise, z], [0, h + rise, -z]);
    roof.quad([0, h + rise, -z], [0, h + rise, z], [x, h, z], [x, h, -z]);
    walls.triangle([-width / 2, h, depth / 2], [width / 2, h, depth / 2], [0, h + rise, depth / 2]);
    walls.triangle([width / 2, h, -depth / 2], [-width / 2, h, -depth / 2], [0, h + rise, -depth / 2]);
    for (let bay = 0; bay < 3; bay++) {
      const bx = (bay - 1) * width * .28;
      glazing.box(bx, h * .44, depth / 2 + .0008, width * .16, h * .64, .0015);
      for (const side of [-1, 1]) detail.box(bx + side * width * .09, h * .44, depth / 2 + .003, .005, h * .69, .007);
      detail.box(bx, h * .80, depth / 2 + .003, width * .19, .006, .008); detail.box(bx, h * .43, depth / 2 + .005, width * .16, .002, .003);
    }
    detail.box(0, h + .001, 0, width + .009, .005, depth + .009);
    tool.shape("waterfront-store-masonry", walls, wall, building); tool.shape("waterfront-store-roof", roof, roofMaterial, building);
    tool.shape("waterfront-store-openings", glazing, materials.glass, building); tool.shape("waterfront-store-stonework", detail, materials.cream, building);
  };
  plan.warehouses.forEach((spec, index) => warehouse(spec,
    place === "ajaccio" ? materials.sand : place === "marseille" ? materials.pale : index === 1 && place === "nantes" ? materials.brick : materials.stone,
    place === "ajaccio" ? materials.tile : place === "marseille" ? index === 1 ? materials.ochreTile : materials.tile : materials.slate));

  const occupied: HarbourPoint[][] = [...plan.quayPolygons, ...plan.coastalJoins], vessels: Array<{ name: string; footprint: HarbourPoint[]; position: number[] }> = [];
  const boat = (name: string, fraction: number, offset: number, length: number, beam: number, kind: "cargo" | "ferry" | "sail" | "fishing", heading = 0, offshore?: HarbourPoint) => {
    const outline = [[-.34, -.50], [-.50, -.35], [-.50, .24], [-.27, .43], [0, .53], [.27, .43], [.50, .24], [.50, -.35], [.34, -.50]];
    let pose: ReturnType<typeof harbourStation> | undefined, footprint: HarbourPoint[] = [], angle = 0;
    for (let attempt = 0; attempt < 13; attempt++) {
      const point = harbourStation(plan, fraction * plan.frontage, offset + attempt * .022);
      if (offshore) {
        const projected = mapAuthoredPosition(offshore.x, offshore.z);
        point.x = projected.x; point.z = projected.z;
      }
      angle = Math.atan2(point.tx, point.tz) + heading;
      const c = Math.cos(angle), s = Math.sin(angle);
      footprint = outline.map(([x, z]) => ({ x: point.x + c * x * (beam + .006) + s * z * (length + .006), z: point.z - s * x * (beam + .006) + c * z * (length + .006) }));
      const shoreHit = footprint.some((a, i) => {
        const b = footprint[(i + 1) % footprint.length];
        return Array.from({ length: 6 }, (_, j) => j / 5).some(t => landContains(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t));
      });
      if (shoreHit || occupied.some(polygon => harbourPolygonsOverlap(polygon, footprint))) continue;
      pose = point; break;
    }
    if (!pose) return;
    occupied.push(footprint);
    const ship = new TransformNode(`${place}-${name}`, scene);
    ship.parent = node; ship.position.set(pose.x, -.080, pose.z); ship.rotation.y = angle;
    ship.metadata = { harbourVessel: kind, footprint, waterLevel: -.080 };
    vessels.push({ name, footprint, position: ship.position.asArray() });
    const hull = new CityGeometry(), lower = new CityGeometry(), deck = new CityGeometry(), trim = new CityGeometry(), cabin = new CityGeometry(), windows = new CityGeometry(), rigs = new CityGeometry();
    const large = kind === "cargo" || kind === "ferry", freeboard = large ? .036 : .024, sections = [[-.50, .34], [-.35, .50], [.24, .50], [.43, .27], [.53, .012]];
    for (let i = 1; i < sections.length; i++) {
      const [az, aw] = sections[i - 1], [bz, bw] = sections[i];
      for (const side of [-1, 1]) {
        const ax = side * aw * beam, bx = side * bw * beam;
        const a: [number, number, number] = [ax, freeboard, az * length], b: [number, number, number] = [bx, freeboard, bz * length];
        const floorA: [number, number, number] = [ax * .76, -.022, az * length], floorB: [number, number, number] = [bx * .76, -.022, bz * length];
        if (side < 0) lower.quad(a, floorA, floorB, b); else lower.quad(b, floorB, floorA, a);
        const stripeA: [number, number, number] = [ax * .97, .008, az * length], stripeB: [number, number, number] = [bx * .97, .008, bz * length];
        if (side < 0) hull.quad(a, stripeA, stripeB, b); else hull.quad(b, stripeB, stripeA, a);
        trim.beam(a, b, large ? .0026 : .0018);
        if (large && kind === "ferry") for (let step = 0; step < 3; step++) {
          const t = (step + .5) / 3;
          windows.box(ax + (bx - ax) * t, freeboard * .60, (az + (bz - az) * t) * length, .0017, .005, .009);
        }
      }
      deck.quad([-aw * beam, freeboard, az * length], [-bw * beam, freeboard, bz * length], [bw * beam, freeboard, bz * length], [aw * beam, freeboard, az * length]);
      lower.quad([-aw * beam * .76, -.022, az * length], [aw * beam * .76, -.022, az * length], [bw * beam * .76, -.022, bz * length], [-bw * beam * .76, -.022, bz * length]);
    }
    const bow = beam * .012, bowZ = length * .53;
    lower.quad([bow * .76, -.022, bowZ], [bow * .97, .008, bowZ], [-bow * .97, .008, bowZ], [-bow * .76, -.022, bowZ]);
    hull.quad([-bow, freeboard, bowZ], [-bow * .97, .008, bowZ], [bow * .97, .008, bowZ], [bow, freeboard, bowZ]);
    hull.quad([beam * .34, freeboard, -length * .50], [beam * .34 * .97, .008, -length * .50], [-beam * .34 * .97, .008, -length * .50], [-beam * .34, freeboard, -length * .50]);
    lower.quad([-beam * .34 * .76, -.022, -length * .50], [-beam * .34 * .97, .008, -length * .50], [beam * .34 * .97, .008, -length * .50], [beam * .34 * .76, -.022, -length * .50]);
    if (large) {
      cabin.box(0, freeboard + .028, -length * .30, beam * .77, .056, length * .20);
      cabin.box(0, freeboard + .062, -length * .245, beam * .92, .019, length * .105);
      windows.box(0, freeboard + .064, -length * .190, beam * .78, .011, .0015);
      for (const side of [-1, 1]) {
        windows.box(side * beam * .39, freeboard + .033, -length * .30, .0015, .019, length * .135);
        trim.beam([side * beam * .41, freeboard + .076, -length * .36], [side * beam * .41, freeboard + .076, -length * .19], .0017);
      }
      cabin.box(0, freeboard + .005, -length * .245, beam * .98, .009, length * .31);
      rigs.beam([0, freeboard + .072, -length * .23], [0, freeboard + .127, -length * .23], .002);
      rigs.beam([-.018, freeboard + .115, -length * .23], [.018, freeboard + .115, -length * .23], .0015);
      const funnel = new CityGeometry(); funnel.box(-beam * .13, freeboard + .065, -length * .37, beam * .18, .045, length * .052);
      tool.shape("ship-funnel", funnel, materials.red, ship);
      if (kind === "ferry") {
        cabin.box(0, freeboard + .025, length * .068, beam * .81, .050, length * .39);
        cabin.box(0, freeboard + .053, length * .067, beam * .90, .005, length * .41);
        for (const side of [-1, 1]) for (let i = 0; i < 6; i++) windows.box(side * beam * .412, freeboard + .032, (-.082 + i * .054) * length, .0015, .012, length * .031);
        trim.beam([-beam * .40, freeboard + .064, -length * .12], [-beam * .40, freeboard + .064, length * .26], .0017);
        trim.beam([beam * .40, freeboard + .064, -length * .12], [beam * .40, freeboard + .064, length * .26], .0017);
      } else {
        const cargo = new CityGeometry(), cargoBlue = new CityGeometry();
        for (let row = 0; row < 3; row++) for (let column = 0; column < 2; column++) {
          const x = (column - .5) * beam * .35, z = (-.10 + row * .14) * length;
          (row % 2 ? cargoBlue : cargo).box(x, freeboard + .012 + (row === 1 ? .018 : 0), z, beam * .31, row === 1 ? .052 : .033, length * .12);
          trim.box(x, freeboard + .032 + (row === 1 ? .032 : 0), z, beam * .30, .0015, length * .115);
        }
        tool.shape("cargo-red-freight", cargo, materials.red, ship); tool.shape("cargo-blue-freight", cargoBlue, navy, ship);
      }
    } else {
      cabin.box(0, freeboard + .011, -length * .12, beam * .58, .022, length * .25);
      windows.box(0, freeboard + .014, length * .012, beam * .47, .011, .0012);
      if (kind === "sail") {
        const canvas = new CityGeometry(), mastHeight = length * 1.28;
        rigs.beam([0, freeboard, 0], [0, freeboard + mastHeight, 0], .0018);
        rigs.beam([0, freeboard + .025, -.018], [0, freeboard + .025, -length * .36], .0014);
        canvas.triangle([0, freeboard + .025, -length * .34], [0, freeboard + mastHeight, 0], [0, freeboard + .025, 0]);
        canvas.triangle([.001, freeboard + .028, length * .42], [.001, freeboard + mastHeight * .78, .006], [.001, freeboard + .028, .006]);
        tool.shape("yacht-double-canvas", canvas, materials.sail, ship);
        rigs.beam([0, freeboard + mastHeight, 0], [0, freeboard, length * .42], .0007);
      } else {
        rigs.beam([0, freeboard + .024, -length * .13], [0, freeboard + .090, -length * .13], .002);
        rigs.beam([-beam * .37, freeboard + .009, length * .23], [beam * .37, freeboard + .009, length * .23], .002);
        trim.box(0, freeboard + .005, length * .16, beam * .40, .010, length * .17);
      }
    }
    tool.shape("ship-submerged-hull", lower, materials.red, ship); tool.shape("ship-painted-hull", hull, kind === "fishing" ? navy : materials.paint, ship);
    tool.shape("ship-deck", deck, materials.timber, ship); tool.shape("ship-cabin", cabin, materials.paint, ship);
    tool.shape("ship-gunwales", trim, materials.cream, ship); tool.shape("ship-windows", windows, materials.glass, ship); tool.shape("ship-rigging", rigs, navy, ship);
  };
  if (place === "ajaccio") {
    boat("island-ferry", .13, .185, .248, .065, "ferry"); boat("fishing-boat", -.17, .113, .112, .041, "fishing");
    boat("marina-yacht", -.28, .185, .124, .038, "sail", .26); boat("offshore-yacht", .32, .420, .155, .043, "sail", -.42);
  } else if (place === "brest") {
    boat("atlantic-cargo", .06, .170, .353, .083, "cargo"); boat("tug", -.33, .119, .137, .048, "fishing", -.10);
    boat("offshore-yacht", .37, .365, .156, .045, "sail", -.31); boat("outer-yacht", -.34, .480, .137, .040, "sail", .54);
    // Authored Atlantic sailing points stay inside the existing westward
    // diorama extent, keeping the national camera's mainland framing intact.
    boat("atlantic-sail-north", 0, 0, .153, .043, "sail", .65, { x: -5.23, z: 1.31 });
    boat("atlantic-sail-centre", 0, 0, .148, .041, "sail", -.40, { x: -4.83, z: .53 });
    boat("atlantic-sail-south", 0, 0, .161, .044, "sail", .27, { x: -4.34, z: -.38 });
  } else if (place === "nantes") {
    boat("estuary-cargo", -.08, .186, .395, .089, "cargo"); boat("coaster", .33, .358, .275, .069, "cargo", .08);
    boat("harbour-tug", -.36, .115, .122, .045, "fishing"); boat("sailing-yacht", -.29, .445, .145, .043, "sail", .53);
  } else {
    boat("mediterranean-cargo", .10, .265, .395, .088, "cargo"); boat("mediterranean-ferry", .21, .284, .358, .090, "ferry", .06);
    boat("pilot-boat", .36, .138, .125, .044, "fishing"); boat("sailing-yacht", -.34, .551, .157, .044, "sail", .35);
    boat("outer-yacht", .36, .577, .140, .040, "sail", -.43);
  }
  const lastJetty = plan.jetties[0].points.at(-1)!, light = new TransformNode(`${place}-harbour-lighthouse`, scene);
  light.parent = node; light.position.set(lastJetty.x, jettyLevel, lastJetty.z);
  const lighthouseHeight = place === "ajaccio" ? .133 : .176;
  tool.cylinder("harbour-light-tower", 0, lighthouseHeight / 2, 0, .029, lighthouseHeight, .022, materials.paint, light);
  tool.cylinder("harbour-light-band", 0, lighthouseHeight * .70, 0, .025, .018, .024, materials.red, light);
  tool.cylinder("harbour-light-gallery", 0, lighthouseHeight, 0, .037, .006, .037, navy, light);
  tool.cylinder("harbour-light-lantern", 0, lighthouseHeight + .011, 0, .021, .018, .021, materials.glass, light);
  tool.cylinder("harbour-light-roof", 0, lighthouseHeight + .026, 0, .032, .016, .002, materials.red, light);
  node.metadata.vessels = vessels;
  for (const mesh of meshes) {
    mesh.receiveShadows = true;
    mesh.metadata = { ...mesh.metadata, harbour: place, castsShadow: !mesh.name.includes("quay") && !mesh.name.includes("paving") && !mesh.name.includes("access") };
  }
  return meshes;
}

export function buildPowerPlant(scene: Scene, origin: Vector3, materials: CityMaterials): Mesh[] {
  const meshes: Mesh[] = [], tool = toolkit(scene, meshes);
  if ([[0, 0], [-0.26, -0.23], [-0.26, 0.23], [0.54, -0.23], [0.54, 0.23]].some(([x, z]) => !landContains(origin.x + x, origin.z + z))) return meshes;
  const node = new TransformNode("power-station", scene);
  node.position.set(origin.x, landHeight(origin.x, origin.z) + 0.013, origin.z);
  tool.warehouse(node, 0.0, -0.13, materials.pale, materials);
  const coolingTower = (x: number, z: number) => {
    const shape = new CityGeometry(), height = 0.34;
    for (let band = 0; band < 14; band++) {
      const t0 = band / 14, t1 = (band + 1) / 14,
        radius = (t: number) => 0.051 + 0.079 * (t - 0.57) ** 2,
        r0 = radius(t0), r1 = radius(t1);
      for (let side = 0; side < 24; side++) {
        const a = side * Math.PI * 2 / 24, b = (side + 1) * Math.PI * 2 / 24;
        shape.quad([x + Math.cos(a) * r0, t0 * height, z + Math.sin(a) * r0], [x + Math.cos(a) * r1, t1 * height, z + Math.sin(a) * r1], [x + Math.cos(b) * r1, t1 * height, z + Math.sin(b) * r1], [x + Math.cos(b) * r0, t0 * height, z + Math.sin(b) * r0]);
      }
    }
    tool.shape("cooling-tower", shape, materials.cream, node);
    tool.cylinder("cooling-tower-rim", x, height, z, 0.138, 0.011, 0.138, materials.stone, node);
    tool.cylinder("cooling-tower-interior", x, height - 0.002, z, 0.12, 0.003, 0.12, materials.glass, node);
  };
  coolingTower(-0.17, 0.06);
  coolingTower(0.075, 0.08);
  const pipes = new CityGeometry(), fences = new CityGeometry();
  for (let i = 0; i < 5; i++) {
    pipes.beam([-0.17, 0.015 + i * 0.009, 0.07], [-0.045, 0.015 + i * 0.009, -0.12], 0.005);
    fences.box(0.22, 0.02, -0.12 + i * 0.049, 0.013, 0.04, 0.013);
  }
  fences.box(0.22, 0.031, -0.01, 0.003, 0.003, 0.26);
  tool.shape("station-pipes", pipes, materials.steel, node);
  tool.shape("station-fences", fences, materials.steel, node);
  const solar = new CityGeometry(), feet = new CityGeometry();
  for (let row = 0; row < 4; row++)
    for (let column = 0; column < 5; column++) {
      const px = 0.27 + column * 0.049, pz = -0.19 + row * 0.064;
      solar.quad([px, 0.023, pz], [px, 0.048, pz + 0.043], [px + 0.039, 0.048, pz + 0.043], [px + 0.039, 0.023, pz]);
      feet.box(px + 0.02, 0.018, pz + 0.024, 0.003, 0.036, 0.003);
    }
  tool.shape("solar-modules", solar, materials.glass, node);
  tool.shape("solar-supports", feet, materials.steel, node);
  return meshes;
}

export function buildWindTurbines(scene: Scene, points: Vector3[], materials: CityMaterials): Mesh[] {
  const meshes: Mesh[] = [], tool = toolkit(scene, meshes);
  for (const [index, point] of points.entries()) {
    const node = new TransformNode("wind-turbine", scene), offshore = !landContains(point.x, point.z), blades = new CityGeometry();
    node.position.set(point.x, offshore ? -0.035 : landHeight(point.x, point.z), point.z);
    tool.cylinder("turbine-base", 0, 0.024, 0, 0.043, 0.048, 0.034, materials.cream, node);
    tool.cylinder("turbine-mast", 0, 0.214, 0, 0.018, 0.38, 0.012, materials.paint, node);
    tool.box("turbine-nacelle", 0, 0.405, 0, 0.023, 0.022, 0.046, materials.paint, node);
    for (let blade = 0; blade < 3; blade++) {
      const a = blade * Math.PI * 2 / 3 + index * 0.31, b = a + 0.03,
        tipX = Math.sin(a) * 0.18, tipY = 0.405 + Math.cos(a) * 0.18,
        shoulderX = Math.sin(b) * 0.052, shoulderY = 0.405 + Math.cos(b) * 0.052;
      blades.triangle([-0.003, 0.405, -0.026], [shoulderX - 0.005, shoulderY, -0.026], [tipX, tipY, -0.026]);
      blades.triangle([0.003, 0.405, -0.026], [tipX, tipY, -0.026], [shoulderX + 0.005, shoulderY, -0.026]);
    }
    tool.shape("turbine-blades", blades, materials.sail, node);
  }
  return meshes;
}
