import { mapBaselinePosition, mapFinalFromBaseline, mapBaselineFromFinal } from "./map-camera-projection.ts";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { AssetKit } from "./map-asset-kit.ts";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CityGeometry, createCityMesh } from "./map-city-geometry.ts";
import type { CityMaterials, CityTransportMaterials } from "./map-city-materials.ts";
import { MAP_PLACES, mapPosition, mapCoordinates } from "./map-state.ts";
import type { MapPlace } from "./map-state.ts";
import { landContains, landHeight, riverContains } from "./map-landscape.ts";

type Point = { x: number; z: number };
type Vehicle = { mesh: Mesh; path: Vector3[]; phase: number };

const parisWaypoint = ([x, z]: [number, number]) => {
  const origin = mapPosition(MAP_PLACES.paris.lon, MAP_PLACES.paris.lat),
    coordinates = mapCoordinates(origin.x + x, origin.z + z);
  return [coordinates.lon, coordinates.lat];
};

export const RAIL_ROUTES: Array<[MapPlace, MapPlace, number[][]]> = [
  // The capital's station approaches the eastern quarter, not the cathedral
  // nave. Beyond this composed sector the geographic Lille route continues.
  ["paris", "lille", [...[[1.34, -.10], [1.70, .20], [1.74, .85], [1.43, 1.70], [.75, 2.04]]
    .map(point => parisWaypoint(point as [number, number])), [3.09, 50.26]]],
  ["paris", "lyon", [[2.8, 48.01], [3.35, 47.37], [4.02, 46.68], [4.48, 46.04]]],
  ["paris", "nantes", [...[[.56, -.66], [.18, -.70], [-.16, -.65], [-.57, -.69], [-.97, -.69], [-1.18, -.90]]
    .map(point => parisWaypoint(point as [number, number])), [1.12, 48.1], [-0.04, 47.73], [-0.89, 47.43]]],
  ["nantes", "bordeaux", [[-0.75, 46.5], [-0.28, 45.71]]],
];

function curve(points: Point[]) {
  const result: Point[] = [];
  for (let segment = 0; segment < points.length - 1; segment++) {
    const a = points[Math.max(0, segment - 1)], b = points[segment],
      c = points[segment + 1], d = points[Math.min(points.length - 1, segment + 2)];
    for (let i = 0; i < 20; i++) {
      const t = i / 20, t2 = t * t, t3 = t2 * t,
        interpolate = (v0: number, v1: number, v2: number, v3: number) => 0.5 * (2 * v1 + (v2 - v0) * t + (2 * v0 - 5 * v1 + 4 * v2 - v3) * t2 + (-v0 + 3 * v1 - 3 * v2 + v3) * t3);
      result.push({ x: interpolate(a.x, b.x, c.x, d.x), z: interpolate(a.z, b.z, c.z, d.z) });
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

export function buildRailNetwork(scene: Scene, materials: CityMaterials, offsets: Partial<Record<MapPlace, [number, number]>>, kit: AssetKit, transport: CityTransportMaterials = materials,
  renderedLevels?: (footprint: Point[]) => number[]): { meshes: AbstractMesh[]; vehicles: Vehicle[] } {
  const meshes: AbstractMesh[] = [], vehicles: Vehicle[] = [], stops = new Map<MapPlace, Point>();
  const shape = (name: string, geometry: CityGeometry, material = materials.steel, parent?: TransformNode) => {
    const mesh = createCityMesh(scene, name, geometry, material, parent);
    meshes.push(mesh);
    return mesh;
  };
  for (const [place, [dx, dz]] of Object.entries(offsets) as Array<[MapPlace, [number, number]]>) {
    const geo = MAP_PLACES[place], point = mapPosition(geo.lon, geo.lat),
      position = { x: point.x + dx, z: point.z + dz };
    if (!landContains(position.x, position.z)) continue;
    stops.set(place, position);
    const root = new TransformNode(`rail-station-${place}`, scene);
    const levels = [[-.15, -.18], [-.15, .18], [.06, -.18], [.06, .18]]
      .map(([x, z]) => landHeight(position.x + x, position.z + z));
    root.position.set(position.x, Math.max(...levels) + .005, position.z);
    if (place === "paris") {
      // The glazed train hall belongs to the capital. Other towns have their
      // own regional passenger building instead of duplicating this landmark.
      root.scaling.setAll(.82);
      const walls = new CityGeometry(), roof = new CityGeometry(), glass = new CityGeometry(), details = new CityGeometry();
      walls.box(-0.092, 0.047, 0, 0.072, 0.094, 0.278);
      walls.box(-0.089, 0.079, -0.104, 0.088, 0.16, 0.053);
      for (let segment = 0; segment < 16; segment++) {
        const a = segment * Math.PI / 16, b = (segment + 1) * Math.PI / 16,
          x0 = Math.cos(a) * 0.058, x1 = Math.cos(b) * 0.058,
          y0 = 0.06 + Math.sin(a) * 0.068, y1 = 0.06 + Math.sin(b) * 0.068;
        roof.quad([x0, y0, -0.154], [x1, y1, -0.154], [x1, y1, 0.154], [x0, y0, 0.154]);
        for (const end of [-1, 1]) details.beam([x0, y0, end * 0.154], [x1, y1, end * 0.154], 0.004);
      }
      for (let i = 0; i < 6; i++) {
        const pz = -0.124 + i * 0.05;
        glass.box(-0.131, 0.045, pz, 0.002, 0.032, 0.025);
        details.beam([-0.053, 0.06, pz], [0.053, 0.06, pz], 0.003);
        details.beam([-0.051, 0.064, pz], [0, 0.127, pz], 0.003);
        details.beam([0, 0.127, pz], [0.051, 0.064, pz], 0.003);
      }
      details.box(-0.09, 0.097, 0, 0.077, 0.008, 0.284);
      details.box(0, 0.005, 0, 0.116, 0.01, 0.34);
      shape(`${place}-station-walls`, walls, materials.stone, root);
      shape(`${place}-station-canopy`, roof, materials.glass, root);
      shape(`${place}-station-window`, glass, materials.glass, root);
      shape(`${place}-station-ironwork`, details, materials.cream, root);
    } else {
      const buildings: Partial<Record<MapPlace, { model: string; width: number; depth: number; height: number }>> = {
        lille: { model: "maison_brique_02", width: .275, depth: .101, height: .132 },
        lyon: { model: "maison_pierre_02", width: .255, depth: .103, height: .140 },
        nantes: { model: "ferme_02", width: .265, depth: .102, height: .115 },
        bordeaux: { model: "maison_pierre_01", width: .278, depth: .108, height: .135 },
      };
      const building = buildings[place];
      if (!building) continue;
      const asset = kit.instantiate(building.model, root), bounds = kit.bounds(building.model);
      asset.root.position.set(-.093, .002, 0);
      // The authored entrance faces the working platform at x = 0.
      asset.root.rotation.y = Math.PI / 2;
      asset.root.scaling.set(building.width / bounds.width,
        building.height / bounds.height, building.depth / bounds.depth);
      asset.root.metadata = { ...asset.root.metadata, station: place };
      meshes.push(...asset.meshes);
      const platform = new CityGeometry(), furniture = new CityGeometry(), footing = new CityGeometry(),
        footingHeight = Math.max(...levels) - Math.min(...levels) + .007;
      // Only the building's masonry footprint fills the surveyed slope.
      // The passenger building sits directly above it, without a lot-sized pad.
      footing.box(-.093, -footingHeight / 2, 0, building.depth * .98, footingHeight, building.width * .98);
      platform.box(0, .004, 0, .11, .008, .34);
      furniture.box(.039, .022, -.105, .018, .006, .05);
      furniture.box(.044, .036, -.105, .004, .028, .05);
      for (const z of [-.12, -.09]) furniture.box(.039, .011, z, .012, .018, .004);
      shape(`${place}-station-platform`, platform, materials.quay, root);
      shape(`${place}-station-bench`, furniture, materials.timber, root);
      shape(`${place}-station-footing`, footing, materials.quay, root);
    }
  }

  type Crossing = { route: number; left: number; right: number; length: number; top: number;
    start: Point; end: Point; group?: BridgeGroup };
  type BridgeGroup = { crossings: Crossing[]; start: Point; end: Point; length: number;
    top: number; halfWidth: number; owner: number };
  const plans = RAIL_ROUTES.flatMap(([from, to, via], index) => {
    const start = stops.get(from), end = stops.get(to);
    if (!start || !end) return [];
    const points = curve([mapBaselineFromFinal(start.x, start.z), ...via.map(([lon, lat]) =>
      mapBaselinePosition(lon, lat)), mapBaselineFromFinal(end.x, end.z)])
      .map(point => mapFinalFromBaseline(point.x, point.z)),
      elevations = points.map(p => landHeight(p.x, p.z)), distances = [0], crossings: Crossing[] = [];
    for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] +
      Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
    for (let first = 1; first < points.length - 1; first++) {
      if (!riverContains(points[first].x, points[first].z, .012)) continue;
      let last = first;
      while (last + 1 < points.length - 1 && riverContains(points[last + 1].x, points[last + 1].z, .012)) last++;
      let left = first - 1, right = last + 1;
      while (left > 0 && distances[first] - distances[left] < .12) left--;
      while (right < points.length - 1 && distances[right] - distances[last] < .12) right++;
      const length = distances[right] - distances[left];
      if (length >= .12 && length <= 1.1 &&
        points.slice(left, right + 1).every(p => landContains(p.x, p.z)))
        crossings.push({ route: index, left, right, length,
          top: Math.max(elevations[left], elevations[right]) + .075,
          start: points[left], end: points[right] });
      first = last;
    }
    return [{ index, points, elevations, distances, crossings }];
  });
  const bridgeGroups: BridgeGroup[] = [];
  for (const crossing of plans.flatMap(plan => plan.crossings)) {
    const dx = crossing.end.x - crossing.start.x, dz = crossing.end.z - crossing.start.z,
      length = Math.hypot(dx, dz), ux = dx / length, uz = dz / length;
    const previous = bridgeGroups.find(group => {
      const gx = group.end.x - group.start.x, gz = group.end.z - group.start.z,
        gl = Math.hypot(gx, gz), along = (p: Point) =>
          ((p.x - crossing.start.x) * ux + (p.z - crossing.start.z) * uz),
        lateral = (p: Point) => Math.abs((p.x - crossing.start.x) * uz - (p.z - crossing.start.z) * ux),
        a = along(group.start), b = along(group.end);
      return Math.abs((gx * ux + gz * uz) / gl) > .92 &&
        Math.max(lateral(group.start), lateral(group.end)) < .055 &&
        Math.min(length, Math.max(a, b)) - Math.max(0, Math.min(a, b)) > .12;
    });
    if (previous) previous.crossings.push(crossing);
    else bridgeGroups.push({ crossings: [crossing], start: crossing.start, end: crossing.end,
      length, top: crossing.top, halfWidth: .025, owner: crossing.route });
  }
  for (const group of bridgeGroups) {
    const first = group.crossings[0], dx = first.end.x - first.start.x,
      dz = first.end.z - first.start.z, length = Math.hypot(dx, dz), ux = dx / length, uz = dz / length,
      ends = group.crossings.flatMap(c => [c.start, c.end]),
      along = ends.map(p => (p.x - first.start.x) * ux + (p.z - first.start.z) * uz),
      across = ends.map(p => -(p.x - first.start.x) * uz + (p.z - first.start.z) * ux),
      low = Math.min(...along), high = Math.max(...along),
      left = Math.min(...across), right = Math.max(...across), centre = (left + right) / 2;
    group.start = { x: first.start.x + ux * low - uz * centre,
      z: first.start.z + uz * low + ux * centre };
    group.end = { x: first.start.x + ux * high - uz * centre,
      z: first.start.z + uz * high + ux * centre };
    group.length = high - low;
    group.halfWidth = .025 + (right - left) / 2;
    group.top = Math.max(...group.crossings.map(c => c.top));
    for (const crossing of group.crossings) crossing.group = group;
  }
  const viaductReport: Array<{ route: number; routes: number[]; start: Point; end: Point;
    length: number; arches: number; width: number }> = [];
  for (const { index, points, elevations, distances, crossings } of plans) {
    const ballast = new CityGeometry(), tracks = new CityGeometry(), sleepers = new CityGeometry(),
      masonry = new CityGeometry(), runs: Vector3[][] = [];
    for (const crossing of crossings) {
      const { left, right, group } = crossing;
      if (!group) continue;
      for (let i = left; i <= right; i++) {
        const bank = Math.max(0, Math.min(1, (distances[i] - distances[left]) / .09,
          (distances[right] - distances[i]) / .09)), blend = bank * bank * (3 - 2 * bank);
        elevations[i] = Math.max(elevations[i], elevations[i] + (group.top - elevations[i]) * blend);
      }
      // Parallel Seine routes occupy one masonry bridge with a deck surveyed
      // across both tracks. They keep their own paths and articulated trains.
      if (group.owner !== index) continue;
      const length = group.length, halfWidth = group.halfWidth,
        arches = Math.max(1, Math.ceil((length - .12) / .16)),
        atDistance = (distance: number) => {
          const t = distance / length;
          return { x: group.start.x + (group.end.x - group.start.x) * t,
            z: group.start.z + (group.end.z - group.start.z) * t, y: group.top + .004 };
        }, archStart = .06, archEnd = length - .06;
      const deckStart = atDistance(archStart), deckEnd = atDistance(archEnd);
      masonry.beam([deckStart.x, deckStart.y - .007, deckStart.z],
        [deckEnd.x, deckEnd.y - .007, deckEnd.z], halfWidth * 2, .014);
      for (let arch = 0; arch < arches; arch++) {
        const a = atDistance(archStart + (archEnd - archStart) * arch / arches),
          b = atDistance(archStart + (archEnd - archStart) * (arch + 1) / arches),
          span = Math.hypot(b.x - a.x, b.z - a.z), nx = -(b.z - a.z) / span, nz = (b.x - a.x) / span,
          point = (t: number, y: number, side: number): [number, number, number] =>
            [a.x + (b.x - a.x) * t + nx * side, y, a.z + (b.z - a.z) * t + nz * side];
        for (let section = 0; section < 10; section++) {
          const t0 = section / 10, t1 = (section + 1) / 10,
            deck0 = a.y + (b.y - a.y) * t0 - .004, deck1 = a.y + (b.y - a.y) * t1 - .004,
            opening0 = deck0 - .064 + Math.sin(Math.PI * t0) * .052,
            opening1 = deck1 - .064 + Math.sin(Math.PI * t1) * .052;
          for (const side of [-halfWidth, halfWidth]) {
            const face = [point(t0, opening0, side), point(t0, deck0, side),
              point(t1, deck1, side), point(t1, opening1, side)];
            if (side < 0) face.reverse();
            masonry.quad(face[0], face[1], face[2], face[3]);
          }
          masonry.quad(point(t0, opening0, halfWidth), point(t1, opening1, halfWidth),
            point(t1, opening1, -halfWidth), point(t0, opening0, -halfWidth));
        }
        for (const end of arch === arches - 1 ? [a, b] : [a]) {
          const footprint = [-1, 1].flatMap(s => [-1, 1].map(t => ({
            x: end.x + nx * s * halfWidth + (b.x - a.x) / span * t * .009,
            z: end.z + nz * s * halfWidth + (b.z - a.z) / span * t * .009,
          }))), levels = [...footprint.map(p => landHeight(p.x, p.z)),
            ...(renderedLevels?.([footprint[0], footprint[1], footprint[3], footprint[2]]) ?? [])],
            low = Math.min(...levels) - .002, cap = end.y - .008;
          if (cap > low) {
            // Orient the rectangular pier inside the existing rail corridor.
            const bottom = footprint.map(p => [p.x, low, p.z] as [number, number, number]),
              upper = footprint.map(p => [p.x, cap, p.z] as [number, number, number]), order = [0, 2, 3, 1];
            for (let side = 0; side < 4; side++) {
              const i = order[side], j = order[(side + 1) % 4];
              masonry.quad(bottom[i], upper[i], upper[j], bottom[j]);
            }
            masonry.quad(upper[0], upper[1], upper[3], upper[2]);
          }
        }
      }
      viaductReport.push({ route: index, routes: group.crossings.map(c => c.route),
        start: group.start, end: group.end, length, arches, width: halfWidth * 2 });
    }
    let run: Vector3[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1],
        length = Math.max(0.0001, Math.hypot(b.x - a.x, b.z - a.z)),
        px = -(b.z - a.z) / length, pz = (b.x - a.x) / length,
        leftA: [number, number, number] = [a.x - px * 0.025, Math.max(elevations[i], landHeight(a.x - px * 0.025, a.z - pz * 0.025)) + 0.004, a.z - pz * 0.025],
        rightA: [number, number, number] = [a.x + px * 0.025, Math.max(elevations[i], landHeight(a.x + px * 0.025, a.z + pz * 0.025)) + 0.004, a.z + pz * 0.025],
        leftB: [number, number, number] = [b.x - px * 0.025, Math.max(elevations[i + 1], landHeight(b.x - px * 0.025, b.z - pz * 0.025)) + 0.004, b.z - pz * 0.025],
        rightB: [number, number, number] = [b.x + px * 0.025, Math.max(elevations[i + 1], landHeight(b.x + px * 0.025, b.z + pz * 0.025)) + 0.004, b.z + pz * 0.025];
      if ([leftA, rightA, leftB, rightB].some(point => !landContains(point[0], point[2]))) {
        if (run.length > 1) runs.push(run);
        run = [];
        continue;
      }
      ballast.quad(leftA, rightA, rightB, leftB);
      const floor = (p: [number, number, number]): [number, number, number] =>
        [p[0], landHeight(p[0], p[2]) - .002, p[2]];
      ballast.quad(floor(leftA), leftA, leftB, floor(leftB));
      ballast.quad(rightA, floor(rightA), floor(rightB), rightB);
      for (const side of [-1, 1]) tracks.beam([a.x + px * side * 0.01, elevations[i] + 0.014, a.z + pz * side * 0.01], [b.x + px * side * 0.01, elevations[i + 1] + 0.014, b.z + pz * side * 0.01], 0.006);
      if (i % 2 === 0) sleepers.beam([a.x - px * 0.018, elevations[i] + 0.008, a.z - pz * 0.018], [a.x + px * 0.018, elevations[i] + 0.008, a.z + pz * 0.018], 0.005);
      if (!run.length) run.push(new Vector3(a.x, elevations[i] + 0.017, a.z));
      run.push(new Vector3(b.x, elevations[i + 1] + 0.017, b.z));
    }
    if (run.length > 1) runs.push(run);
    if (!ballast.positions.length) continue;
    shape(`railway-${index}-ballast`, ballast, transport.cream);
    shape(`railway-${index}-tracks`, tracks, transport.steel);
    shape(`railway-${index}-sleepers`, sleepers, transport.timber);
    if (masonry.positions.length) shape(`railway-${index}-viaducts`, masonry, materials.cream);
    const path = runs.sort((a, b) => b.length - a.length)[0];
    if (!path || path.length < 4) continue;
    // Equal arc-length samples keep the articulated coaches together around
    // curves. Each car follows the real track, including reduced-motion poses.
    const lengths = [0];
    for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + Vector3.Distance(path[i - 1], path[i]));
    const totalLength = lengths.at(-1)!, railPath: Vector3[] = [],
      samples = Math.max(2, Math.ceil(totalLength / .018));
    let at = 1;
    for (let i = 0; i <= samples; i++) {
      const distance = totalLength * i / samples;
      while (at < path.length - 1 && lengths[at] < distance) at++;
      railPath.push(Vector3.Lerp(path[at - 1], path[at],
        (distance - lengths[at - 1]) / (lengths[at] - lengths[at - 1] || 1)));
    }
    for (let car = 0; car < 4; car++) {
      const coach = new CityGeometry(), colors: number[] = [],
        part = (draw: () => void, color: number[]) => {
          const start = coach.positions.length / 3; draw();
          for (let i = start; i < coach.positions.length / 3; i++) colors.push(...color, 1);
        }, blue = index % 2 ? [.035, .23, .48] : [.04, .16, .36];
      part(() => coach.box(0, .022, 0, .038, .033, .108), [.93, .92, .86]);
      part(() => coach.box(0, .043, 0, .037, .009, .105), blue);
      part(() => coach.box(0, .008, 0, .032, .011, .087), [.10, .12, .13]);
      for (const side of [-1, 1]) {
        part(() => coach.box(side * .0195, .030, 0, .0015, .012, .080), [.038, .10, .16]);
        part(() => coach.box(side * .020, .017, 0, .0015, .005, .099), blue);
      }
      if (car === 0) {
        part(() => coach.box(0, .028, .055, .036, .019, .018), blue);
        part(() => coach.box(0, .036, .065, .028, .010, .0015), [.035, .08, .12]);
      }
      const train = createCityMesh(scene, `train-${index}-car-${car}`, coach, materials.paint),
        phase = ((index * .239 + .18 - car * .119 / totalLength) % 1 + 1) % 1,
        progress = phase * (railPath.length - 1), segment = Math.floor(progress),
        forward = railPath[segment + 1].subtract(railPath[segment]);
      train.position.copyFrom(Vector3.Lerp(railPath[segment], railPath[segment + 1], progress - segment));
      train.rotation.y = Math.atan2(forward.x, forward.z);
      train.rotation.x = -Math.atan2(forward.y, Math.hypot(forward.x, forward.z));
      train.setVerticesData("color", colors);
      vehicles.push({ mesh: train, path: railPath, phase });
    }
  }
  scene.metadata = { ...scene.metadata, railwayViaducts: viaductReport };
  return { meshes, vehicles };
}
