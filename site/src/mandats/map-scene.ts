import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { SSAO2RenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/instancedMesh";
import { FRANCE_OUTLINES } from "./map-geography.ts";
import { MAP_PLACES, mapPosition, mapSourcePosition, mapState } from "./map-state.ts";
import { COUNTRY_REFERENCE_POSE } from "./map-camera-projection.ts";
import { buildLandscape, landHeight, landContains } from "./map-landscape.ts";
import { buildCities } from "./map-cities.ts";
import { buildMountainRocks } from "./map-mountain-rocks.ts";
import { buildMapContext } from "./map-context.ts";
import { buildMapWater } from "./map-water.ts";
import { buildRegionBoundaries } from "./map-regions.ts";
import { MODEL_URLS } from "./map-model-revisions.ts";
import type { MapPlace, MandateMapState } from "./map-state.ts";
import type { Game } from "./types.ts";

const outlines = FRANCE_OUTLINES.map((points) =>
  points.map(([lon, lat]) => mapPosition(lon, lat)),
);
// Calibrated against the confirmed miniature, then fitted to the actual local
// terrain, quays and boats. The same view is used on entry and Vue France.
const COUNTRY_ALPHA = -Math.PI / 2 + COUNTRY_REFERENCE_POSE.alphaOffset;
const COUNTRY_BETA = COUNTRY_REFERENCE_POSE.beta;
// Native desktop20 distance retained after fitting the real miniature.
const COUNTRY_DESKTOP_RADIUS = 13.446687929333342;
const COUNTRY_COVERAGE = 0.995;
function random(seed: number) {
  let state = (seed ^ 0x4c51c8b5) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
// Balance colour at the old photometric power. Warm miniature sunlight must
// not become a general exposure increase or turn every roof into a highlight.
function balancedIlluminant(hex: string, previous: string) {
  const color = Color3.FromHexString(hex), reference = Color3.FromHexString(previous),
    luminance = (value: Color3) => value.r * .2126 + value.g * .7152 + value.b * .0722;
  return color.scale(luminance(reference) / luminance(color));
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
  let resolutionSignature = "";
  let canResize = () => true;
  function resolution() {
    // Babylon divides the CSS size by this value. A dense screen needs a
    // smaller factor, never the old DPR multiplier that blurred the scene.
    const pixelBudget = 2_600_000;
    const width = host.clientWidth, height = host.clientHeight,
      deviceDensity = window.devicePixelRatio || 1;
    if (!width || !height) return false;
    const signature = `${width}:${height}:${deviceDensity}:${quality}`;
    if (signature === resolutionSignature) return false;
    if (!canResize()) return false;
    const cssPixels = width * height;
    const density = Math.max(1, Math.min(deviceDensity, 2,
      Math.sqrt(pixelBudget / cssPixels)));
    engine.setHardwareScalingLevel(Math.min(1, quality / density));
    engine.resize();
    host.dataset.resolution = `${engine.getRenderWidth()}x${engine.getRenderHeight()}`;
    resolutionSignature = signature;
    return true;
  }
  resolution();
  canvas.tabIndex = -1;
  host.setAttribute("aria-busy", "true");
  const scene = new Scene(engine);
  const cleanup: Array<() => void> = [];
  const release = () => { while (cleanup.length) cleanup.pop()!(); };
  try {
    scene.clearColor = Color4.FromHexString("#08233DFF");
    scene.ambientColor = Color3.FromHexString("#596879");
    scene.skipPointerMovePicking = true;
    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    scene.imageProcessingConfiguration.contrast = 1.10;
    scene.imageProcessingConfiguration.exposure = 1.25;
    // The authored PBR stone, slate, iron and glass need diffuse irradiance
    // and prefiltered reflections as well as the direct miniature sunlight.
    // Prepare these offline; no panorama conversion runs on the player's GPU.
    const lighting = new Promise<void>((resolve, reject) => {
      scene.environmentTexture = new CubeTexture(MODEL_URLS.daylight, scene, {
        prefiltered: true, forcedExtension: ".env", createPolynomials: true,
        onLoad: resolve,
        onError: (message, error) => reject(error ?? new Error(message ?? "Lighting unavailable")),
      });
    });
    scene.environmentIntensity = 0.35;
    const camera = new ArcRotateCamera(
      "country-camera", COUNTRY_ALPHA, COUNTRY_BETA, COUNTRY_DESKTOP_RADIUS,
      new Vector3(...COUNTRY_REFERENCE_POSE.target), scene,
    );
    camera.fov = COUNTRY_REFERENCE_POSE.fov;
    camera.mode = Camera.PERSPECTIVE_CAMERA;
    function updateProjection() {
      const width = engine.getRenderWidth(), height = engine.getRenderHeight();
      const scale = Math.min(width / COUNTRY_REFERENCE_POSE.width,
        height / COUNTRY_REFERENCE_POSE.height);
      // Fit the same miniature into each canvas while retaining its genuine
      // near/far scale progression. Native zoom still changes the radius.
      camera.fov = 2 * Math.atan(Math.tan(COUNTRY_REFERENCE_POSE.fov / 2) *
        (height / COUNTRY_REFERENCE_POSE.height) / Math.max(scale, .0001));
    }
    camera.minZ = 0.1;
    camera.maxZ = 90;
    camera.lowerRadiusLimit = 1.6;
    camera.upperRadiusLimit = 36;
    camera.lowerBetaLimit = 0.28;
    camera.upperBetaLimit = 1.15;
    camera.wheelPrecision = 65;
    camera.pinchPrecision = 110;
    camera.panningSensibility = 1000;
    camera.inertia = 0.68;
    camera.attachControl(canvas, true);
    let contactShadows: SSAO2RenderingPipeline | undefined;
    function updateContactShadows() {
      const wanted = host.clientWidth > 820 && engine.webGLVersion === 2 &&
        SSAO2RenderingPipeline.IsSupported;
      if (!wanted && contactShadows) {
        contactShadows.dispose(true);
        contactShadows = undefined;
      } else if (wanted && !contactShadows) {
        contactShadows = new SSAO2RenderingPipeline("miniature-contact", scene,
          { ssaoRatio: .5, blurRatio: 1 }, [camera], true);
        contactShadows.radius = .12;
        contactShadows.totalStrength = .6;
        contactShadows.base = .05;
        contactShadows.maxZ = 35;
        contactShadows.epsilon = .003;
        contactShadows.samples = 8;
        contactShadows.textureSamples = 1;
        contactShadows.bilateralSamples = 4;
      }
      host.dataset.contactShadows = String(!!contactShadows);
    }
    updateContactShadows();
    cleanup.push(() => { contactShadows?.dispose(true); contactShadows = undefined; });
    const sky = new HemisphericLight("sky", new Vector3(0, 1, -.35), scene);
    sky.intensity = 0.27;
    sky.diffuse = Color3.FromHexString("#CCDDF1");
    // A stone/soil bounce below the hemisphere, rather than a second blue sky.
    sky.groundColor = balancedIlluminant("#817A6D", "#788797");
    const sun = new DirectionalLight("sun", new Vector3(0.55, -1.2, 0.7), scene);
    sun.position.set(-9, 16, -11);
    sun.intensity = 1.80;
    sun.diffuse = balancedIlluminant("#FFE7CA", "#FFF1DD");
    sun.shadowFrustumSize = 19;
    sun.shadowMinZ = 1;
    sun.shadowMaxZ = 38;
    const shadows = new ShadowGenerator(host.clientWidth > 820 ? 2048 : 1024, sun);
    shadows.usePercentageCloserFiltering = true;
    // One hardware-filtered sample keeps miniature shadows crisp without
    // repeating four depth lookups at every pixel of a dense display.
    shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
    shadows.bias = 0.0003;
    shadows.normalBias = 0.012;
    shadows.setDarkness(0.14);
    const shadowMap = shadows.getShadowMap()!;
    shadowMap.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    function frameShadows(target?: Vector3) {
      sun.shadowFrustumSize = target ? 6 : 19;
      if (target) sun.position.copyFrom(target.subtract(sun.direction.scale(12)));
      else sun.position.set(-9, 16, -11);
      shadowMap.resetRefreshCounter();
    }
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
      coral = material("gathering", "#C72239"),
      mint = material("new-service", "#2788CC"),
      steel = material("crane", "#D3B466");
    const water = buildMapWater(scene);
    let roots = new Map<MapPlace, TransformNode>();
    let vehicles: Awaited<ReturnType<typeof buildCities>>["vehicles"] = [];
    let sceneryReady = false;
    let pendingInspection: MapPlace | undefined;
    let vegetation: Array<{ root: TransformNode; x: number; z: number }> = [];
    const clearedTrees = new Set<TransformNode>();
    const scenery = Promise.all([
      buildLandscape(scene), buildCities(scene), buildMapContext(scene), lighting,
      buildRegionBoundaries(scene),
    ]);
    function finishScenery(staticGeometry: AbstractMesh[]) {
      const batches: AbstractMesh[] = [];
      const compatible = new Map<string, Mesh[]>();
      const record = (mesh: AbstractMesh, castsShadow = true) => {
        mesh.isPickable = false;
        // Instances inherit this flag from their shared source mesh.
        if (mesh instanceof Mesh) mesh.receiveShadows = true;
        mesh.freezeWorldMatrix();
        if (castsShadow) shadows.addShadowCaster(mesh, false);
        batches.push(mesh);
      };
      for (const mesh of staticGeometry) {
        if (mesh.isDisposed()) continue;
        // Keep the shared geometry and instancing of imported models. Merging
        // an authored kit expands every house and destroys its GPU instances.
        if (!(mesh instanceof Mesh) || mesh.metadata?.assetInstance || mesh.metadata?.assetTemplate) {
          if (!mesh.metadata?.assetTemplate) record(mesh, mesh.metadata?.castsShadow !== false);
          continue;
        }
        const key = `${mesh.material?.uniqueId}:${mesh.getVerticesDataKinds().sort().join(",")}:${mesh.metadata?.castsShadow !== false}`;
        const meshes = compatible.get(key) ?? [];
        meshes.push(mesh);
        compatible.set(key, meshes);
      }
      for (const meshes of compatible.values()) {
        const combined = meshes.length > 1
          ? Mesh.MergeMeshes(meshes, true, true, undefined, false, false)
          : meshes[0];
        if (combined) record(combined,
          !meshes.every(mesh => mesh.name.startsWith("context-") ||
            mesh.metadata?.castsShadow === false));
      }
      for (const mat of scene.materials)
        if (mat !== water.mesh.material) mat.freeze();
      host.dataset.landscape = "diorama";
      host.dataset.staticBatches = String(compatible.size);
      host.dataset.staticInstances = String(batches.filter(mesh => mesh.metadata?.assetInstance).length);
      const urban = scene.metadata?.authoredUrban;
      if (urban) host.dataset.authoredHouses = String(urban.houses);
    }
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
      adaptiveStill = false,
      paused = light || matchMedia("(prefers-reduced-motion: reduce)").matches,
      clock = 0,
      disposed = false,
      lastFrame = 0,
      renderedFrames = 0,
      measurementStart = performance.now();
    let renderFrame: number | undefined;
    let gpuContext = engine.webGLVersion === 2 ? canvas.getContext("webgl2") : null;
    let gpuFence: WebGLSync | null = null;
    let gpuRetryTimer: ReturnType<typeof setTimeout> | undefined;
    let pendingRender = false, pendingResize = false;
    let applyPendingResize = () => {};
    function gpuReady() {
      if (!gpuContext || !gpuFence) return true;
      if (gpuContext.isContextLost()) return false;
      // A zero timeout only checks completion; it never waits for the GPU.
      const status = gpuContext.clientWaitSync(gpuFence, 0, 0);
      if (status === gpuContext.TIMEOUT_EXPIRED) return false;
      gpuContext.deleteSync(gpuFence);
      gpuFence = null;
      // If syncs are unavailable, retain the existing WebGL1 render path.
      if (status === gpuContext.WAIT_FAILED) gpuContext = null;
      return true;
    }
    function retryGpuWork() {
      if (gpuRetryTimer !== undefined || disposed || document.hidden ||
        host.dataset.renderer === "fallback") return;
      // Retry independently of animation frames, including a queued resize.
      gpuRetryTimer = setTimeout(() => {
        gpuRetryTimer = undefined;
        if (disposed || document.hidden || host.dataset.renderer === "fallback") return;
        if (!gpuReady()) {
          retryGpuWork();
          return;
        }
        if (pendingResize) {
          pendingResize = false;
          applyPendingResize();
        }
        if (pendingRender) render();
      }, 16);
    }
    function clearGpuWork() {
      if (renderFrame !== undefined) cancelAnimationFrame(renderFrame);
      renderFrame = undefined;
      if (gpuRetryTimer !== undefined) clearTimeout(gpuRetryTimer);
      gpuRetryTimer = undefined;
      if (gpuContext && gpuFence) gpuContext.deleteSync(gpuFence);
      gpuFence = null;
      pendingRender = pendingResize = false;
      host.dataset.renderPending = "false";
    }
    canResize = () => {
      if (disposed || host.dataset.renderer === "fallback") return false;
      if (gpuReady()) return true;
      pendingResize = true;
      retryGpuWork();
      return false;
    };
    function requestRender() {
      pendingRender = true;
      host.dataset.renderPending = "true";
      if (pendingResize || !gpuReady()) {
        retryGpuWork();
        return;
      }
      if (renderFrame !== undefined) return;
      renderFrame = requestAnimationFrame(() => {
        renderFrame = undefined;
        render();
      });
    }
    cleanup.push(clearGpuWork);
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
      new Vector3(x, landHeight(x,z) + .08, z), new Vector3(x, -.1, z),
    ]));
    function fitCountry() {
      frameShadows();
      camera.alpha = COUNTRY_ALPHA;
      camera.beta = COUNTRY_BETA;
      camera.target.set(...COUNTRY_REFERENCE_POSE.target);
      camera.radius = COUNTRY_DESKTOP_RADIUS;
      for (let iteration = 0; iteration < 6; iteration++) {
        updateProjection();
        camera.getViewMatrix(true);
        camera.getProjectionMatrix(true);
        scene.updateTransformMatrix(true);
        const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
        const projected = countryPoints.map(point => Vector3.Project(point,
          Matrix.Identity(), scene.getTransformMatrix(), viewport));
        const halfWidth = engine.getRenderWidth() / 2,
          halfHeight = engine.getRenderHeight() / 2;
        // Keep the calibrated target and depth progression. Smaller viewports
        // need more distance, while desktop keeps the reference composition.
        let ratio = 0;
        for (const point of projected) ratio = Math.max(ratio,
          Math.abs(point.x - halfWidth) / (halfWidth * COUNTRY_COVERAGE),
          Math.abs(point.y - halfHeight) / (halfHeight * COUNTRY_COVERAGE));
        if (ratio <= 1.001) break;
        camera.radius = Math.min(36, camera.radius * ratio);
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
      let changed = false;
      const ids = new Set(state.movements.map((item) => item.id));
      for (const [id, group] of groups)
        if (!ids.has(id)) {
          group.root.dispose(false, false);
          groups.delete(id);
          changed = true;
        }
      for (const movement of state.movements) {
        const fingerprint = movement.stage;
        const old = groups.get(movement.id);
        if (old?.fingerprint === fingerprint) continue;
        changed = true;
        old?.root.dispose(false, false);
        const root = new TransformNode("movement-" + movement.id, scene);
        const city = roots.get(movement.placeOnMap)!;
        const crowdGroundY = typeof city.metadata?.crowdGroundY === "number"
          ? city.metadata.crowdGroundY
          : landHeight(city.position.x + .02, city.position.z - .42) + .01;
        root.parent = city;
        root.position.set(.02, crowdGroundY - city.position.y, -.42);
        root.scaling.setAll(0.72);
        const people: Person[] = [];
        const count =
          movement.stage === "strike" ? 30 : movement.stage === "march" ? 22 : 12;
        for (let i = 0; i < count; i++) {
          const person = new TransformNode("person-" + i, scene);
          person.parent = root;
          const position = city.metadata?.crowdPositions?.[i],
            start = new Vector3(
              position ? (position.x - .02) / .72 : ((i % 8) - 3.5) * .055,
              0,
              position ? (position.z + .42) / .72 : Math.floor(i / 8) * .07,
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
      return changed;
    };
    const disposeProject = (root: TransformNode) => {
      for (const child of root.getChildMeshes()) shadows.removeShadowCaster(child, false);
      root.dispose(false, false);
    };
    const batchProject = (parent: TransformNode) => {
      const compatible = new Map<string, Mesh[]>();
      for (const child of parent.getChildMeshes(true)) {
        if (!(child instanceof Mesh)) continue;
        const key = `${child.material?.uniqueId}:${child.getVerticesDataKinds().sort().join(",")}`;
        const meshes = compatible.get(key) ?? [];
        meshes.push(child);
        compatible.set(key, meshes);
      }
      for (const meshes of compatible.values()) {
        if (meshes.length < 2) continue;
        // These parts are direct children expressed in the same local space.
        // Merge there so rotating a crane still moves its whole lattice.
        for (const mesh of meshes) {
          mesh.parent = null;
          mesh.computeWorldMatrix(true);
        }
        const combined = Mesh.MergeMeshes(meshes, true, true, undefined, false, false);
        if (combined) {
          combined.parent = parent;
          combined.receiveShadows = true;
          combined.isPickable = false;
        } else for (const mesh of meshes) mesh.parent = parent;
      }
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
        const previous = old && !old.root.metadata?.unplaced ? {
          x: old.root.position.x, z: old.root.position.z,
          y: old.root.position.y + (old.root.parent as TransformNode).position.y - .008,
        } : undefined;
        if (old) disposeProject(old.root);
        changed = true;
        const root = new TransformNode("project-" + project.id, scene);
        root.parent = roots.get(project.placeOnMap)!;
        const offset = [...project.id].reduce((n, char) => n + char.charCodeAt(0), 0);
        const city = roots.get(project.placeOnMap)!;
        const surveyed: Array<{ x: number; z: number; y?: number }> = city.metadata?.projectSites ?? [];
        // Four compact modules fit within each surveyed .42 by .40 parcel,
        // including the complete rotating crane. Never invent an unsurveyed
        // location when a city already contains several recorded projects.
        const slots = surveyed.flatMap(site => [-.105, .105].flatMap(dx =>
          [-.095, .095].map(dz => ({ x: site.x + dx, z: site.z + dz, y: site.y }))));
        const sites = slots.length ? [...slots.slice(offset % slots.length),
          ...slots.slice(0, offset % slots.length)] : [];
        if (previous) sites.unshift(previous);
        const footprint = (point: {x: number; z: number}) => [-.101, 0, .101].flatMap(dx =>
          [-.080, 0, .080].map(dz => ({x: city.position.x + point.x + dx,
            z: city.position.z + point.z + dz})));
        const available = (point: { x: number; z: number }) =>
          [...projectGroups].every(([id, group]) => id === project.id ||
            group.root.metadata?.unplaced || group.root.parent !== city ||
            Math.abs(group.root.position.x - point.x) > .202 ||
            Math.abs(group.root.position.z - point.z) > .160);
        const point = sites.find(point => available(point) &&
          footprint(point).every(p => landContains(p.x, p.z)));
        if (!point) {
          // The saved project and its HTML tracking remain accessible. A
          // missing surveyed parcel must not place a fake building in water.
          root.metadata = { unplaced: true };
          projectGroups.set(project.id, { root, status: project.status });
          continue;
        }
        const levels = footprint(point).map(p => landHeight(p.x, p.z));
        const floor = Math.max(point.y ?? 0, ...levels) + .008;
        root.position.set(point.x, floor - city.position.y, point.z);
        const projectScale = .38;
        root.scaling.setAll(projectScale);
        // A solid retaining foundation reaches the actual ground, rather than
        // suspending a thin slab above a sloping parcel.
        const foundation = (floor - Math.min(...levels) + .004) / projectScale;
        box("project-ground-support", .43, foundation, .42, shore, root,
          -.03, -foundation / 2, 0);
        let crane: TransformNode | undefined;
        if (project.status === "funded" || project.status === "blocked") {
          box("foundation", 0.25, 0.018, 0.21, shore, root);
          const structure = project.status === "blocked" ? slate : wall;
          for (const floor of [.055, .115, .175]) {
            box("construction-slab", .2, .012, .17, structure, root, 0, floor, 0);
            for (const x of [-.086, 0, .086])
              for (const z of [-.071, .071])
                box("construction-frame", .009, .055, .009, structure, root,
                  x, floor - .025, z);
          }
          for (const z of [-.125, .125])
            box("site-barrier", .29, .042, .005, steel, root, .01, .024, z);
          box("site-cabin", .055, .045, .039, slate, root, .17, .025, .04);
          box("site-supplies", .032, .026, .035, wall, root, .17, .013, -.033);
          crane = new TransformNode("crane", scene);
          crane.parent = root;
          crane.position.x = -0.15;
          for (const x of [-.011, .011])
            for (const z of [-.011, .011])
              box("crane-mast", .006, .48, .006, steel, crane, x, .24, z);
          for (let rung = 1; rung < 8; rung++)
            box("crane-mast-rung", .029, .005, .029, steel, crane, 0, rung * .06, 0);
          box("crane-arm", .36, .007, .023, steel, crane, .08, .45, 0);
          box("crane-arm-top", .36, .005, .023, steel, crane, .08, .478, 0);
          for (let strut = 0; strut < 8; strut++)
            box("crane-arm-strut", .005, .028, .022, steel, crane,
              -.085 + strut * .047, .464, 0);
          box("crane-counterweight", .042, .027, .04, slate, crane, -.092, .434, 0);
          box("crane-cab", .027, .032, .029, slate, crane, .025, .43, .02);
          box("crane-cable", .002, .21, .002, slate, crane, .205, .343, 0);
          box("crane-hook", .013, .012, .009, steel, crane, .205, .235, 0);
        } else if (project.status === "delivered") {
          building("delivered-" + project.kind, root, 0, 0, 0.24, 0.28, 0.22);
          box("active-service", 0.05, 0.08, 0.01, mint, root, 0, 0.16, -0.115);
        } else box("closed-site", 0.23, 0.035, 0.2, shore, root);
        if (crane) batchProject(crane);
        batchProject(root);
        for (const child of root.getChildMeshes())
          if (!crane || project.status !== "funded" || !child.isDescendantOf(crane))
            shadows.addShadowCaster(child, false);
        projectGroups.set(project.id, {
          root,
          status: project.status,
          crane: project.status === "funded" ? crane : undefined,
        });
      }
      const footprints = [...projectGroups.values()].filter(group =>
        !group.root.metadata?.unplaced && ["funded", "blocked", "delivered"].includes(group.status)).map(group => {
          group.root.computeWorldMatrix(true);
          return group.root.getAbsolutePosition();
        });
      for (const tree of vegetation) {
        const clear = footprints.some(point => Math.abs(point.x - tree.x) < .110 &&
          Math.abs(point.z - tree.z) < .085);
        if (clear === clearedTrees.has(tree.root)) continue;
        tree.root.setEnabled(!clear);
        if (clear) clearedTrees.add(tree.root);
        else clearedTrees.delete(tree.root);
        changed = true;
      }
      host.dataset.renderedProjects = String([...projectGroups.values()]
        .filter(group => !group.root.metadata?.unplaced).length);
      host.dataset.unplacedProjects = String([...projectGroups.values()]
        .filter(group => group.root.metadata?.unplaced).length);
      if (changed) shadowMap.resetRefreshCounter();
      return changed;
    };
    function update(next: MandateMapState, isLight: boolean) {
      state = next;
      lightMode = isLight;
      paused = adaptiveStill || isLight || matchMedia("(prefers-reduced-motion: reduce)").matches;
      host.dataset.turn = String(next.turn);
      host.dataset.movements = String(next.movements.length);
      host.dataset.projects = String(next.projects.length);
      host.dataset.motion = paused ? "reduced" : "active";
      if (host.dataset.renderer === "fallback") {
        placeFallbackMarkers(host, state);
        return;
      }
      if (!sceneryReady) {
        placeFallbackMarkers(host, state);
        return;
      }
      const movementsChanged = rebuildMovements();
      const projectsChanged = rebuildProjects();
      // Selecting a subject changes HTML markers, not the miniature. Avoid
      // blocking each consultation on an identical GPU frame. Real crowd or
      // construction changes still render the latest saved state once.
      if (host.dataset.renderer === "babylon" && (movementsChanged || projectsChanged))
        requestRender();
      projectMarkers();
    }
    function projectMarkers() {
      const viewport = camera.viewport.toGlobal(
          engine.getRenderWidth(),
          engine.getRenderHeight(),
        ),
        width = host.clientWidth,
        height = host.clientHeight,
        placed = mapObstacles(host);
      for (const label of host.querySelectorAll<HTMLElement>("[data-map-label]")) {
        const { x, z } = mapPosition(Number(label.dataset.lon), Number(label.dataset.lat));
        const y = label.dataset.labelKind === "sea" ? -.04 :
          label.dataset.labelKind === "island" ? landHeight(x, z) + .04 : .2;
        const projected = Vector3.Project(new Vector3(x, y, z), Matrix.Identity(),
          scene.getTransformMatrix(), viewport);
        const left = projected.x / engine.getRenderWidth() * width,
          top = projected.y / engine.getRenderHeight() * height;
        const outside = projected.z < 0 || projected.z > 1 ||
          camera.radius < countryOverview.radius * .6;
        label.hidden = outside;
        if (outside) continue;
        // Check the entire label, not only its geographic anchor. Its true
        // location stays intact when panning; an offscreen name disappears.
        const halfWidth = label.offsetWidth / 2, halfHeight = label.offsetHeight / 2;
        label.hidden = left - halfWidth < 8 || left + halfWidth > width - 8 ||
          top - halfHeight < 8 || top + halfHeight > height - 8;
        if (label.hidden) continue;
        label.style.left = `${Math.round(left)}px`;
        label.style.top = `${Math.round(top)}px`;
      }
      for (const marker of [...state.markers, ...state.tracking]) {
        const element = [
          ...host.querySelectorAll<HTMLElement>("[data-map-marker]"),
        ].find((item) => item.dataset.mapMarker === marker.id);
        if (!element) continue;
        const root = roots.get(marker.place)!;
        // A national policy concerns the whole country. Its visual anchor is
        // the centre of France, while institutional subjects remain in Paris.
        const anchor = marker.id.startsWith("policy:")
          ? new Vector3(0, landHeight(0, 0) + 0.015, 0)
          : root.position.add(new Vector3(0, 0.015, 0));
        const projected = Vector3.Project(
          anchor,
          Matrix.Identity(),
          scene.getTransformMatrix(),
          viewport,
        );
        const x = (projected.x / engine.getRenderWidth()) * width,
          y = (projected.y / engine.getRenderHeight()) * height;
        // Clamping distant towns to the inspection's edge gave them false
        // positions. Their subjects remain available in the agenda and Bilan.
        element.hidden = projected.z < 0 || projected.z > 1 ||
          x < 0 || x > width || y < 0 || y > height;
        if (element.hidden) continue;
        const point = placeMarker(host, element, { x, y }, placed);
        const left = `${Math.round(point.x)}px`,
          top = `${Math.round(point.y)}px`;
        if (element.style.left !== left) element.style.left = left;
        if (element.style.top !== top) element.style.top = top;
      }
    }
    function render() {
      if (disposed || document.hidden || !sceneryReady) return;
      if (renderFrame !== undefined) {
        cancelAnimationFrame(renderFrame);
        renderFrame = undefined;
      }
      if (host.dataset.renderer === "fallback") {
        placeFallbackMarkers(host, state);
        return;
      }
      pendingRender = true;
      host.dataset.renderPending = "true";
      // Keep one GPU frame in flight and redraw the latest state afterwards.
      // Apply any new CSS/DPR size before submitting that next frame.
      if (pendingResize || !gpuReady()) {
        retryGpuWork();
        return;
      }
      pendingRender = false;
      const start = performance.now();
      updateProjection();
      scene.render();
      if (gpuContext && !gpuContext.isContextLost()) {
        gpuFence = gpuContext.fenceSync(gpuContext.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (gpuFence) gpuContext.flush();
        else gpuContext = null;
      }
      projectMarkers();
      host.dataset.activeTriangles = String(Math.round(scene.getActiveIndices() / 3));
      host.dataset.activeMeshes = String(scene.getActiveMeshes().length);
      host.dataset.cameraRadius = String(Math.round(camera.radius * 100) / 100);
      host.dataset.renderMs = String(Math.round(performance.now() - start));
      host.dataset.renderPending = "false";
      renderedFrames++;
    }
    const loop = () => {
      const now = performance.now();
      if (disposed || !sceneryReady || host.dataset.renderer !== "babylon" ||
        document.hidden || now - lastFrame < 32) return;
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
      if (now - measurementStart > 3000 && renderedFrames > 0) {
        const fps = Math.round(
          (renderedFrames * 1000) / (now - measurementStart),
        );
        host.dataset.fps = String(fps);
        if (!paused && fps < 5) {
          // A renderer that cannot sustain the miniature must keep decisions
          // responsive. Preserve sharp geometry and redraw on state/camera
          // changes, instead of continuously queuing decorative GPU frames.
          adaptiveStill = true;
          paused = true;
          host.dataset.motion = "reduced";
          host.dataset.quality = "still";
        } else if (!paused && fps < 14) {
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
      paused = adaptiveStill || lightMode || media.matches;
      host.dataset.motion = paused ? "reduced" : "active";
      render();
    };
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    media.addEventListener("change", onMotion);
    cleanup.push(() => media.removeEventListener("change", onMotion));
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    applyPendingResize = () => {
      // The persistent host briefly leaves the document when a subject
      // changes. Measure it only after layout, with a drawable CSS size.
      if (disposed || !host.isConnected || !host.clientWidth || !host.clientHeight) return;
      if (!resolution()) return;
      updateContactShadows();
      if (!cameraTouched && !overview) {
        const from = cameraTween ? pose() : undefined;
        fitCountry();
        countryOverview = pose();
        if (from) {
          setPose(from);
          travel(countryOverview);
        }
      }
      requestRender();
    };
    const resizeMap = () => {
      if (resizeTimer !== undefined || disposed || host.dataset.renderer === "fallback") return;
      resizeTimer = setTimeout(() => {
        resizeTimer = undefined;
        applyPendingResize();
      }, 0);
    };
    const resize = new ResizeObserver(resizeMap);
    resize.observe(host);
    window.addEventListener("resize", resizeMap, { passive: true });
    // A busy GPU can delay resize events and animation frames while ordinary
    // tasks keep running. Observe actual CSS/DPR changes independently; sizing
    // runs once per change and the expensive redraw stays frame-coalesced.
    const sizeWatch = setInterval(() => {
      if (!disposed && host.isConnected && !document.hidden &&
        host.dataset.renderer !== "fallback") resizeMap();
    }, 250);
    cleanup.push(() => {
      resize.disconnect();
      window.removeEventListener("resize", resizeMap);
      clearInterval(sizeWatch);
      if (resizeTimer !== undefined) clearTimeout(resizeTimer);
    });
    document.addEventListener("visibilitychange", onVisibility);
    cleanup.push(() => document.removeEventListener("visibilitychange", onVisibility));
    const onLost = (event: Event) => {
      event.preventDefault();
      clearGpuWork();
      engine.stopRenderLoop(loop);
      host.dataset.renderer = "fallback";
      host.setAttribute("aria-busy", "false");
      placeFallbackMarkers(host, state);
      host.querySelector<HTMLElement>("[data-map-status]")!.textContent =
        "La carte reste accessible. Recharger rétablit la vue 3D.";
    };
    canvas.addEventListener("webglcontextlost", onLost);
    cleanup.push(() => canvas.removeEventListener("webglcontextlost", onLost));
    update(initial, light);
    void scenery.then(([landscape, cities, context, , regions]) => {
      if (disposed || host.dataset.renderer === "fallback") return;
      roots = cities.roots;
      vehicles = cities.vehicles;
      // Quays and boats extend beyond the geographic coastline. Fit their real
      // world bounds before static batching disposes the original meshes.
      for (const mesh of cities.meshes) {
        if (mesh.metadata?.assetTemplate || mesh.isDisposed()) continue;
        mesh.computeWorldMatrix(true);
        // A diagonal route's axis-aligned box has empty corners far beyond
        // its rendered hull. Fit its real vertices while retaining model bounds.
        const positions = mesh instanceof Mesh && /^(national-road-|railway-)/.test(mesh.name)
          ? mesh.getVerticesData("position") : null;
        if (positions?.length) {
          const world = mesh.getWorldMatrix();
          for (let index = 0; index < positions.length; index += 3)
            countryPoints.push(Vector3.TransformCoordinates(
              Vector3.FromArray(positions, index), world));
        } else countryPoints.push(...mesh.getBoundingInfo().boundingBox.vectorsWorld
          .map(point => point.clone()));
      }
      if (!cameraTouched && !overview) {
        fitCountry();
        countryOverview = pose();
      }
      const river = landscape.meshes.find(mesh => mesh.name === "landscape-rivers");
      if (river instanceof Mesh) water.coverRiver(river);
      const boatWash = water.boatWash(scene.transformNodes.filter(node =>
        node.metadata?.harbourVessel));
      vegetation = scene.transformNodes.filter(node => node.metadata?.authoredAsset &&
        ["oak", "beech", "pine", "cypress", "olive", "orchard"].includes(node.metadata.asset))
        .map(root => {
          root.computeWorldMatrix(true);
          const position = root.getAbsolutePosition();
          return { root, x: position.x, z: position.z };
        });
      const rocks = buildMountainRocks(scene);
      host.dataset.mountainRocks = String(scene.metadata?.mountainRocks?.count ?? 0);
      const moving = new Set<AbstractMesh>(vehicles.map(vehicle => vehicle.mesh));
      finishScenery([...landscape.meshes, ...cities.meshes, ...context.meshes, ...regions, boatWash, ...rocks]
        .filter(mesh => !moving.has(mesh)));
      sceneryReady = true;
      update(state, lightMode);
      if (pendingInspection) inspect(pendingInspection);
      scene.executeWhenReady(() => {
        if (disposed || host.dataset.renderer === "fallback") return;
        measurementStart = performance.now();
        renderedFrames = 0;
        shadowMap.resetRefreshCounter();
        host.dataset.renderer = "babylon";
        host.setAttribute("aria-busy", "false");
        host.querySelector<HTMLElement>("[data-map-status]")!.textContent = "";
        render();
      });
    }).catch(() => {
      if (disposed || host.dataset.renderer === "fallback") return;
      clearGpuWork();
      engine.stopRenderLoop(loop);
      host.dataset.renderer = "fallback";
      host.setAttribute("aria-busy", "false");
      placeFallbackMarkers(host, state);
      host.querySelector<HTMLElement>("[data-map-status]")!.textContent =
        "La carte reste accessible. Recharger rétablit la vue 3D.";
    });
    engine.runRenderLoop(loop);
    cleanup.push(() => engine.stopRenderLoop(loop));
    function inspect(place: MapPlace) {
      if (host.dataset.renderer === "fallback") return;
      pendingInspection = place;
      const city = roots.get(place);
      if (!city) return;
      overview ??= pose();
      host.dataset.inspection = place;
      frameShadows(city.position);
      let destination: CameraPose = {
        target: city.position.add(new Vector3(0, 0.15, 0)),
        alpha: -Math.PI / 2 + 0.35,
        beta: 1.0,
        radius: 3.8,
      };
      const bounds = city.metadata?.landmarkBounds;
      if (Array.isArray(bounds?.minimum) && Array.isArray(bounds?.maximum) &&
        bounds.minimum.length === 3 && bounds.maximum.length === 3 &&
        bounds.minimum.every(Number.isFinite) && bounds.maximum.every(Number.isFinite)) {
        const minimum = Vector3.FromArray(bounds.minimum),
          maximum = Vector3.FromArray(bounds.maximum),
          before = pose(), points: Vector3[] = [];
        destination.target = minimum.add(maximum).scale(.5);
        for (const x of [minimum.x, maximum.x])
          for (const y of [minimum.y, maximum.y])
            for (const z of [minimum.z, maximum.z]) points.push(new Vector3(x, y, z));
        // Fit the actual monument, including its spires, at the current
        // aspect ratio. Its national scale never depends on this close view.
        setPose(destination);
        updateProjection();
        const width = engine.getRenderWidth(), height = engine.getRenderHeight(),
          viewport = camera.viewport.toGlobal(width, height);
        for (let attempt = 0; attempt < 6; attempt++) {
          scene.updateTransformMatrix(true);
          let ratio = 1;
          for (const point of points) {
            const pixel = Vector3.Project(point, Matrix.Identity(), scene.getTransformMatrix(), viewport);
            ratio = Math.max(ratio, Math.abs(pixel.x - width / 2) / (width * .42),
              Math.abs(pixel.y - height / 2) / (height * .42));
          }
          if (ratio <= 1.001) break;
          camera.radius = Math.min(36, camera.radius * ratio);
        }
        destination = pose();
        setPose(before);
      }
      travel(destination);
    }
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
          pendingInspection = undefined;
          cameraTouched = false;
          host.dataset.inspection = "";
        }
        render();
      },
      inspect,
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
  // The visual ring, rather than the centre of the complete icon and label,
  // locates the saved subject on the ground. CSS adapts its exact dimensions
  // for ordinary, urgent and small tracking pins on each screen size.
  const anchor = element.querySelector<HTMLElement>("[data-map-anchor]");
  if (anchor) origin = {
    x: origin.x + width / 2 - anchor.offsetLeft - anchor.offsetWidth / 2,
    y: origin.y + height / 2 - anchor.offsetTop - anchor.offsetHeight / 2,
  };
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
  for (const label of host.querySelectorAll<HTMLElement>("[data-map-label]")) label.hidden = true;
  const width = host.clientWidth,
    height = host.clientHeight,
    scale = Math.min(width / 1000, height / 920),
    placed = mapObstacles(host);
  for (const item of [...state.markers, ...state.tracking]) {
    const element = [
      ...host.querySelectorAll<HTMLElement>("[data-map-marker]"),
    ].find((marker) => marker.dataset.mapMarker === item.id);
    if (!element) continue;
    element.hidden = false;
    const position = item.id.startsWith("policy:") ? { x: 0, z: 0 } :
      mapSourcePosition(MAP_PLACES[item.place].lon, MAP_PLACES[item.place].lat);
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
type PendingMapMount = {
  host: HTMLElement; state: MandateMapState; light: boolean;
  cameraActions: string[]; inspection?: MapPlace;
};
let pendingMapMount: PendingMapMount | undefined,
  mapMountTimer: ReturnType<typeof setTimeout> | undefined;
function cancelMapMount(): void {
  if (mapMountTimer !== undefined) clearTimeout(mapMountTimer);
  mapMountTimer = undefined;
  pendingMapMount = undefined;
}
export function syncMandateMap(
  root: HTMLElement,
  game: Game | null,
  light: boolean,
): void {
  const host = root.querySelector<HTMLElement>("[data-mandate-map]");
  if (!host) {
    cancelMapMount();
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
  if (!game) {
    // The entry has no adopted mandate. Keep its existing SVG preview responsive
    // instead of constructing and compiling a full country behind Reprendre.
    cancelMapMount();
    controller?.dispose();
    fallbackResize?.disconnect();
    fallbackResize = undefined;
    controller = undefined;
    activeHost = host;
    host.dataset.renderer = "preview";
    host.setAttribute("aria-busy", "false");
    host.querySelector<HTMLElement>("[data-map-status]")!.textContent = "";
    return;
  }
  if (pendingMapMount?.host === host) {
    pendingMapMount.state = mapState(game);
    pendingMapMount.light = light;
    placeFallbackMarkers(host, pendingMapMount.state);
    return;
  }
  if (activeHost === host && host.dataset.renderer === "fallback") {
    fallbackState = mapState(game);
    placeFallbackMarkers(host, fallbackState);
    host.dataset.movements = String(fallbackState.movements.length);
    return;
  }
  cancelMapMount();
  controller?.dispose();
  fallbackResize?.disconnect();
  fallbackResize = undefined;
  controller = undefined;
  activeHost = host;
  const pending: PendingMapMount = { host, state: mapState(game), light, cameraActions: [] };
  pendingMapMount = pending;
  host.dataset.renderer = "loading";
  host.setAttribute("aria-busy", "true");
  host.querySelector<HTMLElement>("[data-map-status]")!.textContent = "La carte se prépare.";
  placeFallbackMarkers(host, pending.state);
  // Finish the input handler and its saved HTML state before starting the
  // synchronous country construction. Read the latest state when this runs.
  mapMountTimer = setTimeout(() => {
    mapMountTimer = undefined;
    if (pendingMapMount !== pending) return;
    pendingMapMount = undefined;
    if (activeHost !== host || !host.isConnected) return;
    try {
      controller = mount(host, pending.state, pending.light);
      for (const action of pending.cameraActions) controller.camera(action);
      if (pending.inspection) controller.inspect(pending.inspection);
    } catch (error) {
      host.dataset.renderError =
        error instanceof Error ? error.message : String(error);
      host.dataset.renderer = "fallback";
      host.setAttribute("aria-busy", "false");
      host.querySelector<HTMLElement>("[data-map-status]")!.textContent =
        "Vue légère. Les sujets et les décisions restent accessibles.";
      fallbackState = pending.state;
      placeFallbackMarkers(host, fallbackState);
      fallbackResize = new ResizeObserver(() => {
        if (fallbackState) placeFallbackMarkers(host, fallbackState);
      });
      fallbackResize.observe(host);
    }
  }, 0);
}
export function moveMapCamera(action: string): void {
  if (controller) controller.camera(action);
  else pendingMapMount?.cameraActions.push(action);
}
export function inspectMapPlace(place: string): void {
  if (!Object.hasOwn(MAP_PLACES, place)) return;
  if (controller) controller.inspect(place as MapPlace);
  else if (pendingMapMount) pendingMapMount.inspection = place as MapPlace;
}
if (typeof window !== "undefined")
  window.addEventListener("pagehide", () => {
    cancelMapMount();
    controller?.dispose();
    fallbackResize?.disconnect();
    fallbackResize = undefined;
    controller = undefined;
    activeHost = undefined;
  });
