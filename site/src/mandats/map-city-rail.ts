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
import { landContains, landHeight } from "./map-landscape.ts";

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

export function buildRailNetwork(scene: Scene, materials: CityMaterials, offsets: Partial<Record<MapPlace, [number, number]>>, kit: AssetKit, transport: CityTransportMaterials = materials): { meshes: AbstractMesh[]; vehicles: Vehicle[] } {
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

  for (const [index, [from, to, via]] of RAIL_ROUTES.entries()) {
    const start = stops.get(from), end = stops.get(to);
    if (!start || !end) continue;
    const points = curve([mapBaselineFromFinal(start.x, start.z), ...via.map(([lon, lat]) => mapBaselinePosition(lon, lat)), mapBaselineFromFinal(end.x, end.z)]).map(point => mapFinalFromBaseline(point.x, point.z)),
      ballast = new CityGeometry(), tracks = new CityGeometry(), sleepers = new CityGeometry(), runs: Vector3[][] = [];
    let run: Vector3[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1],
        length = Math.max(0.0001, Math.hypot(b.x - a.x, b.z - a.z)),
        px = -(b.z - a.z) / length, pz = (b.x - a.x) / length,
        leftA: [number, number, number] = [a.x - px * 0.025, landHeight(a.x - px * 0.025, a.z - pz * 0.025) + 0.032, a.z - pz * 0.025],
        rightA: [number, number, number] = [a.x + px * 0.025, landHeight(a.x + px * 0.025, a.z + pz * 0.025) + 0.032, a.z + pz * 0.025],
        leftB: [number, number, number] = [b.x - px * 0.025, landHeight(b.x - px * 0.025, b.z - pz * 0.025) + 0.032, b.z - pz * 0.025],
        rightB: [number, number, number] = [b.x + px * 0.025, landHeight(b.x + px * 0.025, b.z + pz * 0.025) + 0.032, b.z + pz * 0.025];
      if ([leftA, rightA, leftB, rightB].some(point => !landContains(point[0], point[2]))) {
        if (run.length > 1) runs.push(run);
        run = [];
        continue;
      }
      ballast.quad(leftA, rightA, rightB, leftB);
      for (const side of [-1, 1]) tracks.beam([a.x + px * side * 0.01, landHeight(a.x, a.z) + 0.044, a.z + pz * side * 0.01], [b.x + px * side * 0.01, landHeight(b.x, b.z) + 0.044, b.z + pz * side * 0.01], 0.006);
      if (i % 2 === 0) sleepers.beam([a.x - px * 0.018, landHeight(a.x, a.z) + 0.037, a.z - pz * 0.018], [a.x + px * 0.018, landHeight(a.x, a.z) + 0.037, a.z + pz * 0.018], 0.005);
      if (!run.length) run.push(new Vector3(a.x, landHeight(a.x, a.z) + 0.047, a.z));
      run.push(new Vector3(b.x, landHeight(b.x, b.z) + 0.047, b.z));
    }
    if (run.length > 1) runs.push(run);
    if (!ballast.positions.length) continue;
    shape(`railway-${index}-ballast`, ballast, transport.cream);
    shape(`railway-${index}-tracks`, tracks, transport.steel);
    shape(`railway-${index}-sleepers`, sleepers, transport.timber);
    const path = runs.sort((a, b) => b.length - a.length)[0];
    if (!path || path.length < 4) continue;
    const coach = new CityGeometry();
    for (let car = 0; car < 3; car++) {
      coach.box(0, 0.02, (car - 1) * 0.073, 0.034, 0.027, 0.067);
      coach.box(0, 0.037, (car - 1) * 0.073, 0.033, 0.007, 0.064);
    }
    const train = createCityMesh(scene, `train-${index}`, coach, materials.paint), phase = (index * 0.239 + 0.18) % 1,
      progress = phase * (path.length - 1), segment = Math.floor(progress), forward = path[segment + 1].subtract(path[segment]);
    train.position.copyFrom(Vector3.Lerp(path[segment], path[segment + 1], progress - segment));
    train.rotation.y = Math.atan2(forward.x, forward.z);
    const colors = Array.from({ length: train.getTotalVertices() }, (_, vertex) => vertex % 48 < 16 ? [0.035, 0.30, 0.64, 1] : [1, 1, 1, 1]).flat();
    train.setVerticesData("color", colors);
    vehicles.push({ mesh: train, path, phase });
  }
  return { meshes, vehicles };
}
