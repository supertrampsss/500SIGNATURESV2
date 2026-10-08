import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreateTube } from "@babylonjs/core/Meshes/Builders/tubeBuilder";
import { CreatePolygon } from "@babylonjs/core/Meshes/Builders/polygonBuilder";
import "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Rendering/edgesRenderer";
import "@babylonjs/core/Meshes/instancedMesh";
import earcut from "earcut";
import Delaunator from "delaunator";
import { FRANCE_OUTLINES } from "./map-geography.ts";
import { MAP_PLACES, mapPosition, mapState } from "./map-state.ts";
import type { MapPlace, MandateMapState } from "./map-state.ts";
import type { Game } from "./types.ts";

const outlines = FRANCE_OUTLINES.map((points) =>
  points.map(([lon, lat]) => mapPosition(lon, lat)),
);
function inside(x: number, z: number): boolean {
  return outlines.some((points) => {
    let hit = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i],
        b = points[j];
      if (
        a.z > z !== b.z > z &&
        x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x
      )
        hit = !hit;
    }
    return hit;
  });
}
function elevation(x: number, z: number) {
  const hill = (
    cx: number,
    cz: number,
    sx: number,
    sz: number,
    height: number,
  ) => Math.exp(-(((x - cx) / sx) ** 2 + ((z - cz) / sz) ** 2)) * height;
  return (
    0.22 +
    hill(3.05, -0.65, 0.8, 2.1, 1.1) +
    hill(0.2, -3.9, 1.9, 0.38, 0.52) +
    hill(0.65, -0.75, 1.0, 1.3, 0.4) +
    hill(2.9, 2.1, 0.35, 0.8, 0.32) +
    hill(4.7, -4.4, 0.33, 0.55, 0.65) +
    Math.sin(x * 3.4 + z * 1.8) * Math.cos(z * 3.7) * 0.045
  );
}
function random(seed: number) {
  let state = (seed ^ 0x4c51c8b5) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function mount(host: HTMLElement, initial: MandateMapState, light: boolean) {
  const canvas = host.querySelector<HTMLCanvasElement>("[data-map-canvas]")!;
  const engine = new Engine(
    canvas,
    true,
    {
      preserveDrawingBuffer: false,
      stencil: true,
      powerPreference: "low-power",
      failIfMajorPerformanceCaveat: false,
    },
    true,
  );
  engine.setHardwareScalingLevel(
    Math.max(1, host.clientWidth / 720, window.devicePixelRatio / 1.2),
  );
  canvas.tabIndex = -1;
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString("#152B36FF");
  scene.ambientColor = Color3.FromHexString("#25342A");
  scene.skipPointerMovePicking = true;
  const camera = new ArcRotateCamera(
    "country-camera",
    -Math.PI / 2,
    0.55,
    22,
    new Vector3(0.4, 0.15, 0.05),
    scene,
  );
  camera.fov = 0.62;
  camera.lowerRadiusLimit = 1.6;
  camera.upperRadiusLimit = 28;
  camera.lowerBetaLimit = 0.18;
  camera.upperBetaLimit = 1.15;
  camera.wheelPrecision = 65;
  camera.pinchPrecision = 110;
  camera.panningSensibility = 140;
  camera.inertia = 0.68;
  camera.attachControl(canvas, true);
  const sky = new HemisphericLight("sky", new Vector3(-0.2, 1, 0.2), scene);
  sky.intensity = 0.7;
  sky.groundColor = Color3.FromHexString("#254047");
  const sun = new DirectionalLight("sun", new Vector3(0.5, -1, 0.65), scene);
  sun.intensity = 0.8;
  sun.diffuse = Color3.FromHexString("#FFDFC0");
  const material = (name: string, hex: string) => {
    const value = new StandardMaterial(name, scene);
    value.diffuseColor = Color3.FromHexString(hex);
    value.specularColor = new Color3(0.04, 0.05, 0.04);
    return value;
  };
  const earth = material("earth", "#CFD8B7"),
    shore = material("limestone", "#AB9F7D"),
    water = material("sea", "#183B4B");
  const wall = material("warm-stone", "#DCCBB0"),
    slate = material("slate", "#485663"),
    terracotta = material("terracotta", "#A97458"),
    windows = material("windows", "#274654");
  const grass = material("park", "#6B845C"),
    pine = material("pine", "#2B5040"),
    leaf = material("leaf", "#527851"),
    trunk = material("tree-trunk", "#62513C");
  const road = material("road", "#AAA38A"),
    river = material("river", "#4D8D9C"),
    coral = material("gathering", "#CB725E"),
    mint = material("new-service", "#73C6A0"),
    steel = material("crane", "#D3B466");
  const sea = CreateGround("sea", { width: 60, height: 60 }, scene);
  sea.position.y = -0.04;
  sea.material = water;
  const makeMesh = (
    name: string,
    positions: number[],
    indices: number[],
    colors?: number[],
  ) => {
    const mesh = new Mesh(name, scene),
      data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = [];
    VertexData.ComputeNormals(positions, indices, data.normals);
    if (colors) data.colors = colors;
    data.applyToMesh(mesh);
    return mesh;
  };
  for (const [index, outline] of outlines.entries()) {
    const shape = outline.slice(0, -1).map(({ x, z }) => new Vector3(x, 0, z));
    const base = CreatePolygon(
      `country-base-${index}`,
      { shape, depth: 0.32, sideOrientation: Mesh.DOUBLESIDE },
      scene,
      earcut,
    );
    base.position.y = 0.1;
    base.material = shore;
    const positions: number[] = [],
      colors: number[] = [],
      points: Array<[number, number]> = [];
    const cell = 0.23;
    const minX = Math.min(...outline.map((p) => p.x)),
      maxX = Math.max(...outline.map((p) => p.x)),
      minZ = Math.min(...outline.map((p) => p.z)),
      maxZ = Math.max(...outline.map((p) => p.z));
    for (const { x, z } of outline.slice(0, -1)) points.push([x, z]);
    for (let x = minX + cell; x < maxX - cell / 2; x += cell)
      for (let z = minZ + cell; z < maxZ - cell / 2; z += cell) {
        if (!inside(x, z)) continue;
        points.push([x, z]);
      }
    const triangles = Delaunator.from(points).triangles,
      indices: number[] = [];
    for (let i = 0; i < triangles.length; i += 3) {
      const a = triangles[i],
        b = triangles[i + 1],
        c = triangles[i + 2],
        p = points[a],
        q = points[b],
        r = points[c];
      if (!inside((p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3)) continue;
      const winding =
        (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
      indices.push(a, ...(winding > 0 ? [b, c] : [c, b]));
    }
    for (const [x, z] of points) {
      const y = elevation(x, z);
      positions.push(x, y, z);
      const c =
        y > 1
          ? new Color3(0.84, 0.84, 0.76)
          : y > 0.65
            ? new Color3(0.56, 0.62, 0.47)
            : new Color3(
                0.48 + 0.04 * Math.sin(x * 1.8),
                0.59 + 0.03 * Math.sin(z * 1.3),
                0.4,
              );
      colors.push(c.r, c.g, c.b, 1);
    }
    const terrain = makeMesh(`terrain-${index}`, positions, indices, colors);
    terrain.material = earth;
  }
  const toPath = (coords: number[][], offset = 0.02) =>
    coords.map(([lon, lat]) => {
      const { x, z } = mapPosition(lon, lat);
      return new Vector3(x, elevation(x, z) + offset, z);
    });
  const waterways = [
    [
      [4.48, 45.98],
      [4.84, 45.76],
      [4.83, 45.2],
      [4.8, 44.55],
      [4.7, 44.08],
      [4.62, 43.7],
      [4.84, 43.42],
    ],
    [
      [3.9, 47.35],
      [2.78, 47.64],
      [1.98, 47.88],
      [1.24, 47.39],
      [0.67, 47.38],
      [-0.55, 47.36],
      [-1.55, 47.22],
      [-2.2, 47.25],
    ],
    [
      [4.09, 48.65],
      [3.0, 48.58],
      [2.35, 48.86],
      [1.35, 49.12],
      [1.1, 49.44],
      [0.7, 49.51],
      [0.13, 49.49],
    ],
    [
      [1.38, 43.6],
      [0.81, 44.06],
      [0.06, 44.43],
      [-0.58, 44.84],
      [-0.86, 45.15],
      [-1.08, 45.56],
    ],
  ];
  waterways.forEach((coords, index) => {
    const mesh = CreateTube(
      `river-${index}`,
      { path: toPath(coords), radius: 0.025, tessellation: 5 },
      scene,
    );
    mesh.material = river;
  });
  const roots = new Map<MapPlace, TransformNode>();
  const box = (
    name: string,
    width: number,
    height: number,
    depth: number,
    mat: StandardMaterial,
    parent?: TransformNode,
    x = 0,
    y = height / 2,
    z = 0,
  ) => {
    const mesh = CreateBox(name, { width, height, depth }, scene);
    mesh.position.set(x, y, z);
    mesh.material = mat;
    if (parent) mesh.parent = parent;
    return mesh;
  };
  const building = (
    name: string,
    parent: TransformNode,
    x: number,
    z: number,
    width = 0.16,
    height = 0.2,
    depth = 0.14,
    south = false,
  ) => {
    box(name, width, height, depth, wall, parent, x, height / 2, z);
    const roof = CreateCylinder(
      name + "-roof",
      { diameter: width * 1.42, height: depth, tessellation: 3 },
      scene,
    );
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.set(x, height + 0.035, z);
    roof.material = south ? terracotta : slate;
    roof.parent = parent;
    box(
      name + "-windows",
      width * 0.64,
      0.045,
      0.004,
      windows,
      parent,
      x,
      height * 0.65,
      z - depth / 2 - 0.003,
    );
  };
  const rng = random(71);
  for (const [name, place] of Object.entries(MAP_PLACES)) {
    const { x, z } = mapPosition(place.lon, place.lat),
      root = new TransformNode("city-" + name, scene);
    root.position.set(x, elevation(x, z) + 0.04, z);
    roots.set(name as MapPlace, root);
    box("square-" + name, 0.9, 0.015, 0.76, road, root, 0, 0.008, 0);
    const count = name === "paris" ? 26 : 12;
    for (let i = 0; i < count; i++) {
      const bx = (rng() - 0.5) * 0.9,
        bz = (rng() - 0.5) * 0.76;
      building(
        `${name}-house-${i}`,
        root,
        bx,
        bz,
        0.1 + rng() * 0.07,
        0.12 + rng() * 0.17,
        0.09 + rng() * 0.08,
        place.lat < 46,
      );
    }
    if (name === "paris") {
      const tower = new TransformNode("paris-tower", scene);
      tower.parent = root;
      tower.position.set(0.12, 0, 0);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          const leg = box(
            "tower-leg",
            0.033,
            0.8,
            0.033,
            slate,
            tower,
            sx * 0.07,
            0.4,
            sz * 0.07,
          );
          leg.rotation.z = sx * 0.1;
          leg.rotation.x = -sz * 0.1;
        }
      box("tower-level", 0.24, 0.045, 0.24, slate, tower, 0, 0.26, 0);
      box("tower-level", 0.13, 0.035, 0.13, slate, tower, 0, 0.55, 0);
      box("tower-spire", 0.035, 0.2, 0.035, slate, tower, 0, 0.86, 0);
    } else {
      building(name + "-civic", root, 0, 0, 0.24, 0.25, 0.18, place.lat < 46);
      box(name + "-bell-tower", 0.08, 0.47, 0.08, wall, root, -0.1, 0.235, 0);
    }
  }
  const routePairs: Array<[MapPlace, MapPlace]> = [
    ["paris", "lille"],
    ["paris", "rennes"],
    ["rennes", "nantes"],
    ["nantes", "bordeaux"],
    ["bordeaux", "toulouse"],
    ["toulouse", "montpellier"],
    ["montpellier", "marseille"],
    ["marseille", "lyon"],
    ["lyon", "paris"],
    ["paris", "strasbourg"],
  ];
  const vehicles: Array<{ mesh: Mesh; path: Vector3[]; phase: number }> = [];
  routePairs.forEach(([from, to], index) => {
    const a = MAP_PLACES[from],
      b = MAP_PLACES[to],
      coords = Array.from({ length: 18 }, (_, i) => [
        a.lon + ((b.lon - a.lon) * i) / 17,
        a.lat + ((b.lat - a.lat) * i) / 17,
      ]);
    const path = toPath(coords, 0.035);
    const line = CreateTube(
      "route-" + index,
      { path, radius: 0.017, tessellation: 4 },
      scene,
    );
    line.material = road;
    for (let i = 0; i < 2; i++) {
      const car = box(
        "vehicle-" + index + "-" + i,
        0.038,
        0.03,
        0.075,
        i ? wall : slate,
      );
      vehicles.push({ mesh: car, path, phase: rng() });
    }
  });
  const treeTemplate = CreateCylinder(
    "pine-template",
    { diameterBottom: 0.11, diameterTop: 0, height: 0.25, tessellation: 5 },
    scene,
  );
  treeTemplate.material = pine;
  treeTemplate.setEnabled(false);
  const leafyTemplate = CreateSphere(
    "leaf-template",
    { diameter: 0.14, segments: 5 },
    scene,
  );
  leafyTemplate.material = leaf;
  leafyTemplate.setEnabled(false);
  for (let index = 0; index < 720; index++) {
    const x = -5.8 + rng() * 11.9,
      z = -5.1 + rng() * 10.5;
    if (
      !inside(x, z) ||
      elevation(x, z) > 1.25 ||
      [...roots.values()].some(
        (root) => Math.hypot(root.position.x - x, root.position.z - z) < 0.52,
      )
    )
      continue;
    const evergreen = index % 3 !== 0,
      tree = (evergreen ? treeTemplate : leafyTemplate).createInstance(
        "tree-" + index,
      );
    tree.position.set(x, elevation(x, z) + (evergreen ? 0.12 : 0.15), z);
    tree.scaling.scaleInPlace(0.7 + rng() * 0.7);
    if (!evergreen) {
      const stem = CreateCylinder(
        "trunk-" + index,
        { diameter: 0.02, height: 0.13, tessellation: 4 },
        scene,
      );
      stem.position.set(x, elevation(x, z) + 0.055, z);
      stem.material = trunk;
    }
  }
  for (let i = 0; i < 70; i++) {
    const x = -3.5 + rng() * 5.2,
      z = -3 + rng() * 6;
    if (!inside(x, z) || elevation(x, z) > 0.6) continue;
    const field = box(
      "field-" + i,
      0.22 + rng() * 0.25,
      0.014,
      0.13 + rng() * 0.15,
      i % 3 ? grass : shore,
      undefined,
      x,
      elevation(x, z) + 0.01,
      z,
    );
    field.rotation.y = rng() * 0.35;
  }
  // Static objects share materials and become a small number of draw calls.
  // City transform nodes remain available for state-dependent projects and crowds.
  const moving = new Set(vehicles.map((vehicle) => vehicle.mesh));
  for (const mat of [
    wall,
    slate,
    terracotta,
    windows,
    road,
    grass,
    shore,
    trunk,
  ]) {
    const meshes = scene.meshes.filter(
      (mesh): mesh is Mesh =>
        mesh instanceof Mesh &&
        mesh.material === mat &&
        !moving.has(mesh) &&
        !mesh.instances.length &&
        mesh !== treeTemplate &&
        mesh !== leafyTemplate,
    );
    if (meshes.length > 1)
      Mesh.MergeMeshes(meshes, true, true, undefined, false, false);
  }
  for (const mesh of scene.meshes)
    if (!moving.has(mesh as Mesh)) mesh.freezeWorldMatrix();
  for (const mat of scene.materials) mat.freeze();
  type Person = {
    root: TransformNode;
    phase: number;
    start: Vector3;
    index: number;
  };
  const groups = new Map<
    string,
    { root: TransformNode; people: Person[]; fingerprint: string }
  >();
  const projectGroups = new Map<
    string,
    { root: TransformNode; status: string; crane?: TransformNode }
  >();
  let state = initial,
    lightMode = light,
    paused = light || matchMedia("(prefers-reduced-motion: reduce)").matches,
    clock = 0,
    disposed = false,
    lastFrame = 0,
    renderedFrames = 0,
    measurementStart = performance.now();
  type CameraPose = {
    target: Vector3;
    alpha: number;
    beta: number;
    radius: number;
  };
  let overview: CameraPose | undefined,
    cameraTween:
      { from: CameraPose; to: CameraPose; start: number } | undefined;
  const pose = (): CameraPose => ({
    target: camera.target.clone(),
    alpha: camera.alpha,
    beta: camera.beta,
    radius: camera.radius,
  });
  function setPose(value: CameraPose) {
    camera.target.copyFrom(value.target);
    camera.alpha = value.alpha;
    camera.beta = value.beta;
    camera.radius = value.radius;
  }
  function travel(to: CameraPose) {
    camera.inertialAlphaOffset = 0;
    camera.inertialBetaOffset = 0;
    camera.inertialRadiusOffset = 0;
    if (paused) {
      cameraTween = undefined;
      setPose(to);
      render();
    } else cameraTween = { from: pose(), to, start: performance.now() };
  }
  const interruptCamera = () => {
    cameraTween = undefined;
  };
  canvas.addEventListener("pointerdown", interruptCamera);
  const rebuildMovements = () => {
    const ids = new Set(state.movements.map((item) => item.id));
    for (const [id, group] of groups)
      if (!ids.has(id)) {
        group.root.dispose(false, false);
        groups.delete(id);
      }
    for (const movement of state.movements) {
      const fingerprint = movement.stage;
      const old = groups.get(movement.id);
      if (old?.fingerprint === fingerprint) continue;
      old?.root.dispose(false, false);
      const root = new TransformNode("movement-" + movement.id, scene);
      root.parent = roots.get(movement.placeOnMap)!;
      root.position.set(0.02, 0, -0.42);
      const people: Person[] = [];
      const count =
        movement.stage === "strike" ? 30 : movement.stage === "march" ? 22 : 12;
      for (let i = 0; i < count; i++) {
        const person = new TransformNode("person-" + i, scene);
        person.parent = root;
        const start = new Vector3(
          ((i % 8) - 3.5) * 0.055,
          0,
          Math.floor(i / 8) * 0.07,
        );
        person.position.copyFrom(start);
        box(
          "coat",
          0.024,
          0.052,
          0.018,
          i % 3 ? slate : coral,
          person,
          0,
          0.045,
          0,
        );
        const head = CreateSphere(
          "head",
          { diameter: 0.028, segments: 4 },
          scene,
        );
        head.position.y = 0.086;
        head.material = wall;
        head.parent = person;
        box("leg", 0.008, 0.025, 0.008, slate, person, -0.007, 0.012, 0);
        box("leg", 0.008, 0.025, 0.008, slate, person, 0.007, 0.012, 0);
        if (i % 7 === 0) {
          box("placard", 0.058, 0.037, 0.006, wall, person, 0.028, 0.117, 0);
          box("pole", 0.005, 0.07, 0.005, trunk, person, 0.028, 0.09, 0);
        }
        people.push({
          root: person,
          phase: rng() * Math.PI * 2,
          start,
          index: i,
        });
      }
      groups.set(movement.id, { root, people, fingerprint });
    }
  };
  const rebuildProjects = () => {
    const ids = new Set(state.projects.map((item) => item.id));
    for (const [id, value] of projectGroups)
      if (!ids.has(id)) {
        value.root.dispose(false, false);
        projectGroups.delete(id);
      }
    for (const project of state.projects) {
      const old = projectGroups.get(project.id);
      if (old?.status === project.status) continue;
      old?.root.dispose(false, false);
      const root = new TransformNode("project-" + project.id, scene);
      root.parent = roots.get(project.placeOnMap)!;
      const offset =
        [...project.id].reduce((n, char) => n + char.charCodeAt(0), 0) % 3;
      root.position.set(-0.32 + offset * 0.23, 0, 0.5 + offset * 0.14);
      let crane: TransformNode | undefined;
      if (project.status === "funded" || project.status === "blocked") {
        box("foundation", 0.25, 0.018, 0.21, shore, root);
        box(
          "construction",
          0.2,
          0.16,
          0.17,
          project.status === "blocked" ? slate : wall,
          root,
          0,
          0.08,
          0,
        );
        crane = new TransformNode("crane", scene);
        crane.parent = root;
        crane.position.x = -0.15;
        box("crane-mast", 0.025, 0.48, 0.025, steel, crane, 0, 0.24, 0);
        box("crane-arm", 0.32, 0.018, 0.018, steel, crane, 0.08, 0.45, 0);
      } else if (project.status === "delivered") {
        building("delivered-" + project.kind, root, 0, 0, 0.24, 0.28, 0.22);
        box("active-service", 0.05, 0.08, 0.01, mint, root, 0, 0.16, -0.115);
      } else box("closed-site", 0.23, 0.035, 0.2, shore, root);
      projectGroups.set(project.id, {
        root,
        status: project.status,
        crane: project.status === "funded" ? crane : undefined,
      });
    }
  };
  function update(next: MandateMapState, isLight: boolean) {
    state = next;
    lightMode = isLight;
    paused = isLight || matchMedia("(prefers-reduced-motion: reduce)").matches;
    host.dataset.turn = String(next.turn);
    host.dataset.movements = String(next.movements.length);
    host.dataset.projects = String(next.projects.length);
    host.dataset.motion = paused ? "reduced" : "active";
    rebuildMovements();
    rebuildProjects();
    render();
  }
  function projectMarkers() {
    const viewport = camera.viewport.toGlobal(
        engine.getRenderWidth(),
        engine.getRenderHeight(),
      ),
      width = host.clientWidth,
      height = host.clientHeight,
      placed = mapObstacles(host);
    for (const marker of [...state.markers, ...state.tracking]) {
      const element = [
        ...host.querySelectorAll<HTMLElement>("[data-map-marker]"),
      ].find((item) => item.dataset.mapMarker === marker.id);
      if (!element) continue;
      const root = roots.get(marker.place)!;
      const projected = Vector3.Project(
        root.position.add(new Vector3(0, 0.28, 0)),
        Matrix.Identity(),
        scene.getTransformMatrix(),
        viewport,
      );
      const x = (projected.x / engine.getRenderWidth()) * width,
        y = (projected.y / engine.getRenderHeight()) * height;
      const point = placeMarker(host, element, { x, y }, placed);
      const left = `${Math.round(point.x)}px`,
        top = `${Math.round(point.y)}px`;
      if (element.style.left !== left) element.style.left = left;
      if (element.style.top !== top) element.style.top = top;
    }
  }
  function render() {
    if (disposed || document.hidden) return;
    if (host.dataset.renderer === "fallback") {
      placeFallbackMarkers(host, state);
      return;
    }
    const start = performance.now();
    scene.render();
    projectMarkers();
    host.dataset.renderMs = String(Math.round(performance.now() - start));
  }
  const loop = () => {
    const now = performance.now();
    if (document.hidden || now - lastFrame < 32) return;
    const delta = Math.min(0.07, (now - lastFrame) / 1000);
    lastFrame = now;
    if (paused && !cameraTween) {
      camera.update();
      if (!camera.hasMoved) return;
    }
    if (cameraTween) {
      const { from, to, start } = cameraTween,
        t = Math.min(1, (now - start) / 450),
        blend = t * t * (3 - 2 * t);
      setPose({
        target: Vector3.Lerp(from.target, to.target, blend),
        alpha: from.alpha + (to.alpha - from.alpha) * blend,
        beta: from.beta + (to.beta - from.beta) * blend,
        radius: from.radius + (to.radius - from.radius) * blend,
      });
      if (t === 1) cameraTween = undefined;
    }
    if (!paused) {
      clock += delta;
      for (const vehicle of vehicles) {
        const t =
            ((clock * 0.019 + vehicle.phase) % 1) * (vehicle.path.length - 1),
          i = Math.floor(t);
        vehicle.mesh.position.copyFrom(
          Vector3.Lerp(
            vehicle.path[i],
            vehicle.path[Math.min(i + 1, vehicle.path.length - 1)],
            t - i,
          ),
        );
        vehicle.mesh.rotation.y = Math.atan2(
          vehicle.path[Math.min(i + 1, vehicle.path.length - 1)].x -
            vehicle.path[i].x,
          vehicle.path[Math.min(i + 1, vehicle.path.length - 1)].z -
            vehicle.path[i].z,
        );
      }
      for (const group of groups.values())
        for (const person of group.people) {
          person.root.position.x =
            person.start.x + Math.sin(clock * 0.65 + person.phase) * 0.007;
          person.root.position.z =
            person.start.z + Math.sin(clock * 0.42 + person.phase) * 0.018;
          person.root.rotation.y = Math.sin(clock * 0.5 + person.phase) * 0.18;
        }
      for (const group of projectGroups.values())
        if (group.crane) group.crane.rotation.y = Math.sin(clock * 0.12) * 0.6;
    }
    render();
    renderedFrames++;
    if (now - measurementStart > 2000) {
      const fps = Math.round(
        (renderedFrames * 1000) / (now - measurementStart),
      );
      host.dataset.fps = String(fps);
      if (!paused && fps < 14 && engine.getHardwareScalingLevel() < 1.75) {
        engine.setHardwareScalingLevel(1.75);
        engine.resize();
      }
      renderedFrames = 0;
      measurementStart = now;
    }
  };
  const onVisibility = () => {
    lastFrame = performance.now();
    if (!document.hidden) {
      engine.resize();
      render();
    }
  };
  const onMotion = () => {
    paused = lightMode || media.matches;
    host.dataset.motion = paused ? "reduced" : "active";
    render();
  };
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onMotion);
  const resize = new ResizeObserver(() => {
    engine.resize();
    render();
  });
  resize.observe(host);
  document.addEventListener("visibilitychange", onVisibility);
  const onLost = (event: Event) => {
    event.preventDefault();
    engine.stopRenderLoop(loop);
    host.dataset.renderer = "fallback";
    placeFallbackMarkers(host, state);
    host.querySelector<HTMLElement>("[data-map-status]")!.textContent =
      "La carte reste accessible. Recharger rétablit la vue 3D.";
  };
  canvas.addEventListener("webglcontextlost", onLost);
  update(initial, light);
  scene.executeWhenReady(() => {
    if (!disposed) {
      host.dataset.renderer = "babylon";
      host.querySelector<HTMLElement>("[data-map-status]")!.textContent = "";
      render();
    }
  });
  engine.runRenderLoop(loop);
  return {
    update,
    camera(action: string) {
      cameraTween = undefined;
      if (action === "in") camera.radius = Math.max(1.6, camera.radius - 2);
      else if (action === "out")
        camera.radius = Math.min(28, camera.radius + 2);
      else {
        travel(
          overview ?? {
            target: new Vector3(0.4, 0.15, 0.05),
            alpha: -Math.PI / 2,
            beta: 0.55,
            radius: 22,
          },
        );
        overview = undefined;
        host.dataset.inspection = "";
      }
      render();
    },
    inspect(place: MapPlace) {
      const city = roots.get(place);
      if (!city) return;
      overview ??= pose();
      host.dataset.inspection = place;
      travel({
        target: city.position.add(new Vector3(0, 0.15, 0)),
        alpha: -Math.PI / 2 + 0.35,
        beta: 0.95,
        radius: 3.8,
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      resize.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      media.removeEventListener("change", onMotion);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("pointerdown", interruptCamera);
      engine.stopRenderLoop(loop);
      scene.dispose();
      engine.dispose();
    },
  };
}
type MarkerBox = { x: number; y: number; width: number; height: number };
function mapObstacles(host: HTMLElement): MarkerBox[] {
  const controls = host.querySelector<HTMLElement>(".map-camera");
  if (!controls) return [];
  const bounds = host.getBoundingClientRect(),
    rectangle = controls.getBoundingClientRect();
  return [
    {
      x: rectangle.x - bounds.x + rectangle.width / 2,
      y: rectangle.y - bounds.y + rectangle.height / 2,
      width: rectangle.width,
      height: rectangle.height,
    },
  ];
}
function placeMarker(
  host: HTMLElement,
  element: HTMLElement,
  origin: { x: number; y: number },
  placed: MarkerBox[],
) {
  const width = element.offsetWidth,
    height = element.offsetHeight;
  const marginX = Math.min(host.clientWidth / 2, width / 2 + 8),
    marginY = Math.min(host.clientHeight / 2, height / 2 + 8);
  origin = {
    x: Math.max(marginX, Math.min(host.clientWidth - marginX, origin.x)),
    y: Math.max(marginY, Math.min(host.clientHeight - marginY, origin.y)),
  };
  const candidates: MarkerBox[] = [];
  for (const dx of [0, 1, -1, 2, -2])
    for (const dy of [0, 1, -1, 2, -2, 3, -3])
      candidates.push({
        x: Math.max(
          marginX,
          Math.min(host.clientWidth - marginX, origin.x + dx * (width + 12)),
        ),
        y: Math.max(
          marginY,
          Math.min(host.clientHeight - marginY, origin.y + dy * (height + 12)),
        ),
        width,
        height,
      });
  candidates.sort(
    (a, b) =>
      (a.x - origin.x) ** 2 +
      (a.y - origin.y) ** 2 -
      (b.x - origin.x) ** 2 -
      (b.y - origin.y) ** 2,
  );
  const point =
    candidates.find((candidate) =>
      placed.every(
        (previous) =>
          Math.abs(previous.x - candidate.x) >=
            (previous.width + width) / 2 + 6 ||
          Math.abs(previous.y - candidate.y) >=
            (previous.height + height) / 2 + 6,
      ),
    ) ?? candidates[0];
  placed.push(point);
  return point;
}
function placeFallbackMarkers(host: HTMLElement, state: MandateMapState): void {
  const width = host.clientWidth,
    height = host.clientHeight,
    scale = Math.min(width / 1000, height / 920),
    placed = mapObstacles(host);
  for (const item of [...state.markers, ...state.tracking]) {
    const element = [
      ...host.querySelectorAll<HTMLElement>("[data-map-marker]"),
    ].find((marker) => marker.dataset.mapMarker === item.id);
    if (!element) continue;
    const position = mapPosition(
      MAP_PLACES[item.place].lon,
      MAP_PLACES[item.place].lat,
    );
    const x = (width - 1000 * scale) / 2 + (500 + position.x * 72) * scale,
      y = (height - 920 * scale) / 2 + (450 - position.z * 72) * scale;
    const point = placeMarker(host, element, { x, y }, placed);
    element.style.left = `${Math.round(point.x)}px`;
    element.style.top = `${Math.round(point.y)}px`;
  }
}
let controller: ReturnType<typeof mount> | undefined,
  activeHost: HTMLElement | undefined,
  fallbackResize: ResizeObserver | undefined,
  fallbackState: MandateMapState | undefined;
export function syncMandateMap(
  root: HTMLElement,
  game: Game | null,
  light: boolean,
): void {
  const host = root.querySelector<HTMLElement>("[data-mandate-map]");
  if (!host) {
    controller?.dispose();
    fallbackResize?.disconnect();
    fallbackResize = undefined;
    controller = undefined;
    activeHost = undefined;
    return;
  }
  if (controller && activeHost === host) {
    controller.update(mapState(game), light);
    return;
  }
  if (activeHost === host && host.dataset.renderer === "fallback") {
    fallbackState = mapState(game);
    placeFallbackMarkers(host, fallbackState);
    host.dataset.movements = String(fallbackState.movements.length);
    return;
  }
  controller?.dispose();
  fallbackResize?.disconnect();
  fallbackResize = undefined;
  controller = undefined;
  activeHost = host;
  try {
    controller = mount(host, mapState(game), light);
  } catch (error) {
    host.dataset.renderError =
      error instanceof Error ? error.message : String(error);
    host.dataset.renderer = "fallback";
    host.querySelector<HTMLElement>("[data-map-status]")!.textContent =
      "Vue légère. Les sujets et les décisions restent accessibles.";
    fallbackState = mapState(game);
    placeFallbackMarkers(host, fallbackState);
    fallbackResize = new ResizeObserver(() => {
      if (fallbackState) placeFallbackMarkers(host, fallbackState);
    });
    fallbackResize.observe(host);
  }
}
export function moveMapCamera(action: string): void {
  controller?.camera(action);
}
export function inspectMapPlace(place: string): void {
  if (Object.hasOwn(MAP_PLACES, place)) controller?.inspect(place as MapPlace);
}
if (typeof window !== "undefined")
  window.addEventListener("pagehide", () => {
    controller?.dispose();
    fallbackResize?.disconnect();
    fallbackResize = undefined;
    controller = undefined;
    activeHost = undefined;
  });
