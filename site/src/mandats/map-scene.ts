import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/instancedMesh";
import { FRANCE_OUTLINES } from "./map-geography.ts";
import { MAP_PLACES, mapPosition, mapState } from "./map-state.ts";
import { buildLandscape, landHeight, landContains } from "./map-landscape.ts";
import { buildCities } from "./map-cities.ts";
import { buildMapContext } from "./map-context.ts";
import { buildMapWater } from "./map-water.ts";
import type { MapPlace, MandateMapState } from "./map-state.ts";
import type { Game } from "./types.ts";

const outlines = FRANCE_OUTLINES.map((points) =>
  points.map(([lon, lat]) => mapPosition(lon, lat)),
);
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
    false,
  );
  let quality = 1;
  function resolution() {
    // Babylon divides the CSS size by this value. A dense screen needs a
    // smaller factor, never the old DPR multiplier that blurred the scene.
    const pixelBudget = 2_600_000;
    const cssPixels = Math.max(1, host.clientWidth * host.clientHeight);
    const density = Math.max(1, Math.min(window.devicePixelRatio || 1, 2,
      Math.sqrt(pixelBudget / cssPixels)));
    engine.setHardwareScalingLevel(Math.min(1, quality / density));
    engine.resize();
    host.dataset.resolution = `${engine.getRenderWidth()}x${engine.getRenderHeight()}`;
  }
  resolution();
  canvas.tabIndex = -1;
  const scene = new Scene(engine);
  const cleanup: Array<() => void> = [];
  const release = () => { while (cleanup.length) cleanup.pop()!(); };
  try {
    scene.clearColor = Color4.FromHexString("#10252DFF");
    scene.ambientColor = Color3.FromHexString("#17231C");
    scene.skipPointerMovePicking = true;
    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    scene.imageProcessingConfiguration.contrast = 1.12;
    scene.imageProcessingConfiguration.exposure = 1.45;
    const camera = new ArcRotateCamera(
      "country-camera", -Math.PI / 2 + 0.08, 0.78, 20,
      new Vector3(-0.12, 0.22, -0.22), scene,
    );
    camera.fov = 0.59;
    camera.minZ = 0.1;
    camera.maxZ = 90;
    camera.lowerRadiusLimit = 1.6;
    camera.upperRadiusLimit = 36;
    camera.lowerBetaLimit = 0.28;
    camera.upperBetaLimit = 1.15;
    camera.wheelPrecision = 65;
    camera.pinchPrecision = 110;
    camera.panningSensibility = 140;
    camera.inertia = 0.68;
    camera.attachControl(canvas, true);
    const sky = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
    sky.intensity = 0.43;
    sky.diffuse = Color3.FromHexString("#CCDCE0");
    sky.groundColor = Color3.FromHexString("#344137");
    const sun = new DirectionalLight("sun", new Vector3(0.55, -1.2, 0.7), scene);
    sun.position.set(-9, 16, -11);
    sun.intensity = 1.32;
    sun.diffuse = Color3.FromHexString("#FFD6AC");
    sun.shadowFrustumSize = 19;
    sun.shadowMinZ = 1;
    sun.shadowMaxZ = 38;
    const shadows = new ShadowGenerator(host.clientWidth > 820 ? 2048 : 1024, sun);
    shadows.usePercentageCloserFiltering = true;
    shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    shadows.bias = 0.00035;
    shadows.normalBias = 0.014;
    shadows.setDarkness(0.14);
    const shadowMap = shadows.getShadowMap()!;
    shadowMap.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    const material = (name: string, hex: string) => {
      const value = new StandardMaterial(name, scene);
      value.diffuseColor = Color3.FromHexString(hex);
      value.specularColor = new Color3(0.025, 0.025, 0.025);
      return value;
    };
    const shore = material("project-stone", "#968A6C"),
      wall = material("project-limestone", "#D9C9A7"),
      slate = material("coat-slate", "#384957"),
      windows = material("project-windows", "#25353A"),
      trunk = material("placard-wood", "#63513C"),
      coral = material("gathering", "#C9604C"),
      mint = material("new-service", "#73C6A0"),
      steel = material("crane", "#D3B466");
    const water = buildMapWater(scene);
    const landscape = buildLandscape(scene);
    const cities = buildCities(scene);
    const context = buildMapContext(scene);
    const { roots, vehicles } = cities;
    const moving = new Set(vehicles.map((vehicle) => vehicle.mesh));
    const staticGeometry = [...landscape.meshes, ...cities.meshes, ...context.meshes]
      .filter(mesh => !mesh.isDisposed() && !moving.has(mesh));
    const batches: Mesh[] = [];
    const compatible = new Map<string, Mesh[]>();
    for (const mesh of staticGeometry) {
      // Primitive builders and authored geometry do not all carry UVs or
      // vertex colors. Retain those attributes instead of discarding texture
      // detail just to merge two objects sharing their material.
      const key = `${mesh.material?.uniqueId}:${mesh.getVerticesDataKinds().sort().join(",")}`;
      const meshes = compatible.get(key) ?? [];
      meshes.push(mesh);
      compatible.set(key, meshes);
    }
    for (const meshes of compatible.values()) {
      const combined = meshes.length > 1
        ? Mesh.MergeMeshes(meshes, true, true, undefined, false, false)
        : meshes[0];
      if (combined) {
        combined.isPickable = false;
        combined.receiveShadows = true;
        combined.freezeWorldMatrix();
        // Neighboring countries are contextual scenery, not shadow casters
        // extending the country's shadow projection beyond its useful budget.
        if (!meshes.every(mesh => mesh.name.startsWith("context-")))
          shadows.addShadowCaster(combined, false);
        batches.push(combined);
      }
    }
    for (const mat of scene.materials)
      if (mat !== water.mesh.material) mat.freeze();
    host.dataset.landscape = "diorama";
    host.dataset.staticBatches = String(batches.length);
    const rng = random(71);
    const box = (
      name: string, width: number, height: number, depth: number,
      mat: StandardMaterial, parent?: TransformNode,
      x = 0, y = height / 2, z = 0,
    ) => {
      const mesh = CreateBox(name, { width, height, depth }, scene);
      mesh.position.set(x, y, z);
      mesh.material = mat;
      mesh.receiveShadows = true;
      mesh.isPickable = false;
      if (parent) mesh.parent = parent;
      return mesh;
    };
    const building = (
      name: string, parent: TransformNode, x: number, z: number,
      width = 0.16, height = 0.2, depth = 0.14,
    ) => {
      box(name, width, height, depth, wall, parent, x, height / 2, z);
      const roof = new Mesh(name + "-roof", scene), data = new VertexData();
      data.positions = [-width/2,0,-depth/2, width/2,0,-depth/2, 0,width*.28,-depth/2,
        -width/2,0,depth/2, width/2,0,depth/2, 0,width*.28,depth/2];
      data.indices = [0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3];
      for (let i = 0; i < data.indices.length; i += 3)
        [data.indices[i + 1], data.indices[i + 2]] = [data.indices[i + 2], data.indices[i + 1]];
      data.normals = [];
      VertexData.ComputeNormals(data.positions, data.indices, data.normals);
      data.applyToMesh(roof);
      roof.position.set(x, height, z);
      roof.material = slate;
      roof.parent = parent;
      roof.receiveShadows = true;
      for (const wx of [-0.27, 0, 0.27])
        box(name + "-window", width * .14, height * .2, .003, windows,
          parent, x + wx * width, height * .61, z - depth / 2 - .002);
    };
    // Shared body parts keep every saved crowd visible without one draw call
    // for each coat, face and leg. The transform nodes still carry its motion.
    const crowdTemplates = {
      coat: box("coat-template", .024, .052, .018, slate),
      coral: box("coral-template", .024, .052, .018, coral),
      head: CreateSphere("head-template", {diameter: .028, segments: 6}, scene),
      leg: box("leg-template", .008, .025, .008, slate),
      placard: box("placard-template", .058, .037, .006, wall),
      pole: box("pole-template", .005, .07, .005, trunk),
    };
    crowdTemplates.head.material = wall;
    for (const template of Object.values(crowdTemplates)) {
      template.position.setAll(0);
      template.setEnabled(false);
      template.isPickable = false;
    }
    function crowdPart(template: Mesh, parent: TransformNode, name: string,
      x: number, y: number, z = 0) {
      const instance = template.createInstance(name);
      instance.parent = parent;
      instance.position.set(x, y, z);
      instance.isPickable = false;
    }
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
    let cameraTouched = false;
    const countryPoints = outlines.flatMap(outline => outline.flatMap(({x,z}) => [
      new Vector3(x, landHeight(x,z) + .35, z), new Vector3(x, -.1, z),
    ]));
    function fitCountry() {
      camera.alpha = -Math.PI / 2 + .08;
      camera.beta = .78;
      camera.target.set(-.12, .22, -.22);
      camera.radius = 20;
      for (let iteration = 0; iteration < 6; iteration++) {
        camera.getViewMatrix(true);
        camera.getProjectionMatrix(true);
        scene.updateTransformMatrix(true);
        const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
        const projected = countryPoints.map(point => Vector3.Project(point,
          Matrix.Identity(), scene.getTransformMatrix(), viewport));
        const extentX = Math.max(...projected.map(p => p.x)) - Math.min(...projected.map(p => p.x));
        const extentY = Math.max(...projected.map(p => p.y)) - Math.min(...projected.map(p => p.y));
        const ratio = Math.max(extentX / (engine.getRenderWidth() * .89),
          extentY / (engine.getRenderHeight() * .83));
        const centerX = (Math.max(...projected.map(p => p.x)) + Math.min(...projected.map(p => p.x))) / 2;
        const centerY = (Math.max(...projected.map(p => p.y)) + Math.min(...projected.map(p => p.y))) / 2;
        const target = Vector3.Project(camera.target, Matrix.Identity(), scene.getTransformMatrix(), viewport);
        const centered = Vector3.Unproject(new Vector3(centerX, centerY, target.z),
          engine.getRenderWidth(), engine.getRenderHeight(), Matrix.Identity(),
          camera.getViewMatrix(), camera.getProjectionMatrix());
        camera.target.copyFrom(centered);
        camera.radius = Math.max(12, Math.min(36, camera.radius * ratio));
      }
    }
    fitCountry();
    let countryOverview = pose();
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
      cameraTouched = true;
      cameraTween = undefined;
    };
    canvas.addEventListener("pointerdown", interruptCamera);
    cleanup.push(() => canvas.removeEventListener("pointerdown", interruptCamera));
    canvas.addEventListener("wheel", interruptCamera, { passive: true });
    cleanup.push(() => canvas.removeEventListener("wheel", interruptCamera));
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
        root.scaling.setAll(0.72);
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
          crowdPart(i % 3 ? crowdTemplates.coat : crowdTemplates.coral,
            person, "coat", 0, .045);
          crowdPart(crowdTemplates.head, person, "head", 0, .086);
          crowdPart(crowdTemplates.leg, person, "leg", -.007, .012);
          crowdPart(crowdTemplates.leg, person, "leg", .007, .012);
          if (i % 7 === 0) {
            crowdPart(crowdTemplates.placard, person, "placard", .028, .117);
            crowdPart(crowdTemplates.pole, person, "pole", .028, .09);
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
    const disposeProject = (root: TransformNode) => {
      for (const child of root.getChildMeshes()) shadows.removeShadowCaster(child, false);
      root.dispose(false, false);
    };
    const rebuildProjects = () => {
      let changed = false;
      const ids = new Set(state.projects.map((item) => item.id));
      for (const [id, value] of projectGroups)
        if (!ids.has(id)) {
          disposeProject(value.root);
          projectGroups.delete(id);
          changed = true;
        }
      for (const project of state.projects) {
        const old = projectGroups.get(project.id);
        if (old?.status === project.status) continue;
        if (old) disposeProject(old.root);
        changed = true;
        const root = new TransformNode("project-" + project.id, scene);
        root.parent = roots.get(project.placeOnMap)!;
        const offset =
          [...project.id].reduce((n, char) => n + char.charCodeAt(0), 0) % 3;
        const city = roots.get(project.placeOnMap)!;
        const candidates = [{x: -.32 + offset * .23, z: .5 + offset * .14}];
        for (const distance of [.65, .85, .48])
          for (let direction = 0; direction < 12; direction++) {
            const angle = (direction / 12) * Math.PI * 2 + offset * .48;
            candidates.push({x: Math.cos(angle) * distance, z: Math.sin(angle) * distance});
          }
        const footprint = (point: {x: number; z: number}) => [-.18, .18].flatMap(dx =>
          [-.16, .16].map(dz => ({x: city.position.x + point.x + dx,
            z: city.position.z + point.z + dz})));
        const onLand = candidates.filter(point => footprint(point).every(p => landContains(p.x, p.z)));
        const point = onLand.find(point => {
          const levels = footprint(point).map(p => landHeight(p.x, p.z));
          return Math.max(...levels) - Math.min(...levels) < .045;
        }) ?? onLand[0] ?? {x: 0, z: 0};
        root.position.set(point.x,
          landHeight(city.position.x + point.x, city.position.z + point.z) + .015 - city.position.y,
          point.z);
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
        for (const child of root.getChildMeshes())
          if (!crane || !child.isDescendantOf(crane)) shadows.addShadowCaster(child, false);
        projectGroups.set(project.id, {
          root,
          status: project.status,
          crane: project.status === "funded" ? crane : undefined,
        });
      }
      if (changed) shadowMap.resetRefreshCounter();
    };
    function update(next: MandateMapState, isLight: boolean) {
      state = next;
      lightMode = isLight;
      paused = isLight || matchMedia("(prefers-reduced-motion: reduce)").matches;
      host.dataset.turn = String(next.turn);
      host.dataset.movements = String(next.movements.length);
      host.dataset.projects = String(next.projects.length);
      host.dataset.motion = paused ? "reduced" : "active";
      if (host.dataset.renderer === "fallback") {
        placeFallbackMarkers(host, state);
        return;
      }
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
      host.dataset.cameraRadius = String(Math.round(camera.radius * 100) / 100);
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
        water.advance(clock);
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
      if (now - measurementStart > 3000 && renderedFrames > 12) {
        const fps = Math.round(
          (renderedFrames * 1000) / (now - measurementStart),
        );
        host.dataset.fps = String(fps);
        if (!paused && fps < 14) {
          if (shadows.filteringQuality !== ShadowGenerator.QUALITY_LOW) {
            shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
            // Frozen materials must rebuild their shadow defines once when
            // the measured frame rate requires cheaper PCF filtering.
            for (const mat of scene.materials)
              if (mat !== water.mesh.material) mat.markDirty(true);
          } else if (quality < 1.25) {
            quality = Math.min(1.25, quality + .125);
            resolution();
          }
        }
        renderedFrames = 0;
        measurementStart = now;
      }
    };
    const onVisibility = () => {
      lastFrame = performance.now();
      if (!document.hidden) {
        resolution();
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
    cleanup.push(() => media.removeEventListener("change", onMotion));
    const resize = new ResizeObserver(() => {
      resolution();
      if (!cameraTouched && !overview) {
        const from = cameraTween ? pose() : undefined;
        fitCountry();
        countryOverview = pose();
        if (from) {
          setPose(from);
          travel(countryOverview);
        }
      }
      render();
    });
    resize.observe(host);
    cleanup.push(() => resize.disconnect());
    document.addEventListener("visibilitychange", onVisibility);
    cleanup.push(() => document.removeEventListener("visibilitychange", onVisibility));
    const onLost = (event: Event) => {
      event.preventDefault();
      engine.stopRenderLoop(loop);
      host.dataset.renderer = "fallback";
      placeFallbackMarkers(host, state);
      host.querySelector<HTMLElement>("[data-map-status]")!.textContent =
        "La carte reste accessible. Recharger rétablit la vue 3D.";
    };
    canvas.addEventListener("webglcontextlost", onLost);
    cleanup.push(() => canvas.removeEventListener("webglcontextlost", onLost));
    update(initial, light);
    scene.executeWhenReady(() => {
      if (!disposed && host.dataset.renderer !== "fallback") {
        measurementStart = performance.now();
        renderedFrames = 0;
        shadowMap.resetRefreshCounter();
        host.dataset.renderer = "babylon";
        host.querySelector<HTMLElement>("[data-map-status]")!.textContent = "";
        render();
      }
    });
    engine.runRenderLoop(loop);
    cleanup.push(() => engine.stopRenderLoop(loop));
    return {
      update,
      camera(action: string) {
        cameraTouched = true;
        cameraTween = undefined;
        if (action === "in") camera.radius = Math.max(1.6, camera.radius - 2);
        else if (action === "out")
          camera.radius = Math.min(36, camera.radius + 2);
        else {
          const from = pose();
          fitCountry();
          countryOverview = pose();
          setPose(from);
          travel(countryOverview);
          overview = undefined;
          cameraTouched = false;
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
        release();
        scene.dispose();
        engine.dispose();
      },
    };
  } catch (error) {
    release();
    scene.dispose();
    engine.dispose();
    throw error;
  }
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
