import * as THREE from 'three';
import type { NationalSceneState } from './national-scene-state.ts';

type Point = readonly [number, number];
type Batch = { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[] };
const AREAS: Record<string, Point> = {
  metropoles: [0.55, -1.45], industrie: [2.08, -0.38], rural: [-0.75, 1.05], littoraux: [-2.0, 0.18],
};
const OUTLINE: Point[] = [
  [-2.52, -1.72], [-1.67, -1.55], [-1.40, -2.18], [-0.72, -2.05], [-0.02, -2.73],
  [0.53, -2.68], [0.92, -2.19], [1.65, -2.05], [2.17, -1.51], [2.74, -1.34],
  [2.49, -0.42], [2.79, 0.25], [2.55, 0.86], [2.85, 1.28], [2.50, 1.78],
  [1.85, 1.91], [1.34, 1.58], [0.87, 2.17], [0.27, 2.43], [-0.61, 2.23],
  [-1.33, 1.87], [-1.78, 1.57], [-1.76, 0.82], [-1.99, 0.25], [-1.98, -0.36],
  [-2.39, -0.77], [-3.15, -0.98], [-3.29, -1.42], [-2.83, -1.43],
];
const inside = (x: number, z: number): boolean => {
  let result = false;
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const a = OUTLINE[i], b = OUTLINE[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
};

/** A schematic, locally generated landscape. No map tiles, assets or third-party requests. */
export function createNationalRenderer(initialHost: HTMLElement): {
  attach(host: HTMLElement, state: NationalSceneState): void;
  suspend(): void;
  dispose(): void;
} {
  const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x102e35);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;';
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x102e35, 18, 35);
  const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 65);
  const target = new THREE.Vector3(0, 0.2, 0);
  let host = initialHost;
  let state: NationalSceneState | undefined;
  let disposed = false;
  let lost = false;
  let active = true;
  let visible = true;
  let frame = 0;
  let lastFrame = 0;
  let yaw = 0.05;
  let dragX: number | undefined;
  let seed = 47;
  const random = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const geometry = <T extends THREE.BufferGeometry>(value: T): T => { geometries.add(value); return value; };
  const material = (color: number, roughness = 0.87): THREE.MeshStandardMaterial => {
    const value = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 }); materials.add(value); return value;
  };
  const box = geometry(new THREE.BoxGeometry(1, 1, 1));
  const cone = geometry(new THREE.ConeGeometry(1, 1, 7));
  const pyramid = geometry(new THREE.ConeGeometry(1, 1, 4));
  const cylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 10));
  const roof = geometry(new THREE.BufferGeometry());
  roof.setAttribute('position', new THREE.Float32BufferAttribute([
    -.5, 0, -.5, .5, 0, -.5, 0, 1, -.5, -.5, 0, .5, 0, 1, .5, .5, 0, .5,
    -.5, 0, -.5, 0, 1, -.5, 0, 1, .5, -.5, 0, -.5, 0, 1, .5, -.5, 0, .5,
    .5, 0, -.5, .5, 0, .5, 0, 1, .5, .5, 0, -.5, 0, 1, .5, 0, 1, -.5,
  ], 3));
  roof.computeVertexNormals();
  const stone = material(0xd8cdb1), paleStone = material(0xe5dbc5), slate = material(0x4f6363);
  const terracotta = material(0x966954), dark = material(0x29464a), glazing = material(0x638b8e, .37);
  const woodland = material(0x385b49), pine = material(0x2d5146), earth = material(0x8e9270);
  const cropColors = [0x8b9974, 0xa4aa7e, 0x768f70, 0xb0ab7e].map(c => material(c));
  const roadMaterial = material(0xc4bda6), railMaterial = material(0x49615a), metal = material(0x81918a);
  const snow = material(0xd9ddd2), mountain = material(0x939a8d), amber = material(0xe1b679);
  const blue = material(0x416f7c), waterMaterial = material(0x173d44, .46);
  const batches = new Map<string, Batch>();
  const transform = new THREE.Object3D();
  const put = (key: string, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number,
    sx: number, sy: number, sz: number, rotation = 0): void => {
    transform.position.set(x, y, z); transform.rotation.set(0, rotation, 0); transform.scale.set(sx, sy, sz); transform.updateMatrix();
    let batch = batches.get(key); if (!batch) { batch = { geometry: geo, material: mat, matrices: [] }; batches.set(key, batch); }
    batch.matrices.push(transform.matrix.clone());
  };
  const segment = (key: string, mat: THREE.Material, a: Point, b: Point, width: number, y = .575): void => {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    put(key, box, mat, (a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, width, .013, Math.hypot(dx, dz), Math.atan2(dx, dz));
  };
  const outline = new THREE.Shape();
  OUTLINE.forEach(([x, z], i) => i === 0 ? outline.moveTo(x, -z) : outline.lineTo(x, -z));
  outline.closePath();
  const landGeometry = geometry(new THREE.ExtrudeGeometry(outline, { depth: .5, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .045, bevelThickness: .035, curveSegments: 1 }));
  landGeometry.rotateX(-Math.PI / 2);
  const land = new THREE.Mesh(landGeometry, [material(0x7f9579), earth]);
  land.castShadow = true; land.receiveShadow = true; scene.add(land);
  const water = new THREE.Mesh(geometry(new THREE.PlaneGeometry(80, 80)), waterMaterial);
  water.rotation.x = -Math.PI / 2; water.position.y = -.09; water.receiveShadow = true; scene.add(water);
  // Fine coastal shelf gives the terrain a readable edge without luminous outlines.
  const shelf = new THREE.Mesh(landGeometry, material(0x49716b)); shelf.scale.set(1.035, .3, 1.035); shelf.position.y = -.04; scene.add(shelf);
  const towns: Point[] = [[.5, -1.5], [1.8, .7], [-1.15, 1.0], [.4, 1.65], [1.95, 1.6], [-1.5, -.75], [1.95, -.9], [.7, -2.1], [-.3, -.25], [-2.4, -1.2]];
  const isTown = (x: number, z: number): boolean => towns.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < .43);
  for (let x = -2.6; x < 2.5; x += .3) for (let z = -2.3; z < 2; z += .28) {
    if (!inside(x - .16, z - .16) || !inside(x + .16, z + .16) || isTown(x, z) || (x > 1.65 && z > .1)) continue;
    const c = Math.floor(random() * cropColors.length);
    put(`field-${c}`, box, cropColors[c], x, .544, z, .26, .012, .24, .025);
    if (random() < .4) segment('hedgerow', woodland, [x - .13, z - .12], [x + .13, z - .12], .018, .563);
  }
  for (const [i, town] of towns.entries()) {
    const count = i === 0 ? 49 : 20;
    for (let j = 0; j < count; j++) {
      const x = town[0] + (random() - .5) * .63, z = town[1] + (random() - .5) * .55;
      if (!inside(x, z)) continue;
      const height = .075 + random() * (i === 0 ? .24 : .115), w = .055 + random() * .04;
      const r = Math.floor(random() * 4) * Math.PI / 2;
      put('buildings', box, stone, x, .555 + height / 2, z, w, height, w * 1.5, r);
      put(i > 1 ? 'terracotta-roofs' : 'slate-roofs', roof, i > 1 ? terracotta : slate, x, .555 + height, z, w * 1.1, .045, w * 1.62, r);
      // Keep roofs grouped by material rather than creating a draw call per house.
      if (j % 3 === 0) put('windows', box, glazing, x, .59 + height / 2, z + w * .76, w * .5, .025, .006);
    }
    const [x, z] = town;
    put('civic-buildings', box, paleStone, x, .66, z, .2, .21, .13);
    put('civic-roofs', roof, slate, x, .765, z, .22, .07, .15);
    put('civic-doors', box, dark, x, .6, z + .068, .025, .09, .007);
    segment('streets', roadMaterial, [x - .35, z + .12], [x + .35, z + .12], .026);
    if (i > 0) segment('roads', roadMaterial, towns[0], town, .022);
  }
  // Distinct strategic infrastructure, schematic rather than geolocated individual facilities.
  segment('rail', railMaterial, [.65, -1.43], [1.83, .68], .015, .589);
  for (let i = 0; i < 58; i++) {
    const t = i / 58; put('sleepers', box, dark, .65 + 1.18 * t, .587, -1.43 + 2.11 * t, .044, .006, .009, -.51);
  }
  for (let i = 0; i < 245; i++) {
    const x = random() * 5.6 - 2.8, z = random() * 4.7 - 2.4;
    if (!inside(x, z) || isTown(x, z) || (x > 1.65 && z > .1)) continue;
    const h = .09 + random() * .15;
    put('trunks', cylinder, earth, x, .59, z, .009, .10, .009);
    put(i % 2 ? 'trees' : 'pines', cone, i % 2 ? woodland : pine, x, .6 + h / 2, z, h * .3, h, h * .3);
  }
  for (let i = 0; i < 17; i++) {
    const x = 1.9 + random() * .58, z = .18 + random() * 1.08, h = .25 + random() * .62;
    put('alps', cone, mountain, x, .54 + h / 2, z, .20 + random() * .11, h, .23);
    if (h > .55) put('snowcaps', cone, snow, x, .54 + h * .91, z, .073, h * .23, .065);
  }
  for (let i = 0; i < 8; i++) put('pyrenees', cone, mountain, -.55 + i * .21, .69, 2.04 - i * .02, .2, .3 + random() * .15, .16);
  // A civic campus and hospital read as places rather than floating interface symbols.
  put('school-wing', box, paleStone, -.9, .62, .93, .24, .14, .10);
  put('school-roof', roof, terracotta, -.9, .69, .93, .26, .05, .12);
  put('school-court', box, roadMaterial, -.9, .553, 1.04, .23, .012, .10);
  put('hospital', box, paleStone, .31, .665, -1.26, .24, .23, .15);
  put('hospital-glass', box, glazing, .31, .69, -1.18, .19, .045, .006);
  put('hospital-mark-v', box, blue, .31, .80, -1.18, .014, .054, .006);
  put('hospital-mark-h', box, blue, .31, .80, -1.18, .054, .014, .006);
  put('paris-tower-base', pyramid, metal, .04, .69, -1.54, .10, .3, .10, Math.PI / 4);
  put('paris-tower-top', pyramid, metal, .04, .91, -1.54, .035, .3, .035, Math.PI / 4);
  put('paris-tower-deck', box, metal, .04, .76, -1.54, .13, .018, .13);
  const ix = 1.95, iz = -.57;
  for (let i = 0; i < 4; i++) {
    put('factory', box, metal, ix + (i % 2) * .17, .62, iz + Math.floor(i / 2) * .18, .14, .17, .13);
    put('factory-roof', roof, slate, ix + (i % 2) * .17, .705, iz + Math.floor(i / 2) * .18, .15, .045, .14);
  }
  put('chimneys', cylinder, stone, ix + .25, .78, iz -.09, .025, .48, .025);
  put('chimneys', cylinder, stone, ix + .33, .73, iz -.09, .02, .38, .02);
  for (let i = 0; i < 5; i++) {
    const x = -.4 + i * .22, z = -.9;
    put('turbine-towers', cylinder, paleStone, x, .71, z, .012, .35, .012);
    put('turbine-hubs', box, paleStone, x, .89, z, .04, .035, .05);
    // Static rotor avoids continuous GPU use on phones and with reduced motion.
    put('turbine-blades', box, paleStone, x, .89, z + .026, .018, .29, .012);
    put('turbine-crossblades', box, paleStone, x, .89, z + .026, .22, .015, .012);
  }
  for (let i = 0; i < 4; i++) {
    const x = .35 + i * .27, z = .65;
    put('pylons', pyramid, metal, x, .68, z, .055, .27, .055, Math.PI / 4);
    put('pylon-arms', box, metal, x, .8, z, .17, .015, .025);
    if (i < 3) segment('power-lines', dark, [x, z], [x + .27, z], .006, .794);
  }
  for (let i = 0; i < 3; i++) {
    put('quays', box, roadMaterial, -2.0 - i * .105, .54, -.18, .06, .035, .32);
    put('boats', box, paleStone, -2.04 - i * .105, .04, .08 + i * .07, .032, .03, .13);
  }
  put('corsica', cone, earth, 3.15, .06, 2.43, .15, .34, .35, .2);
  for (const batch of batches.values()) {
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    batch.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  }
  batches.clear();
  scene.add(new THREE.HemisphereLight(0xd4e4e0, 0x53644e, 2.25));
  const sun = new THREE.DirectionalLight(0xffe2ae, 3.1); sun.position.set(-5, 10, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -5; sun.shadow.camera.right = 5;
  sun.shadow.camera.top = 5; sun.shadow.camera.bottom = -5; sun.shadow.camera.near = 1; sun.shadow.camera.far = 25;
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .035; scene.add(sun);
  const fill = new THREE.DirectionalLight(0xb9d1df, 1.1); fill.position.set(4, 4, -5); scene.add(fill);
  const areaSurfaces = Object.entries(AREAS).map(([id, position]) => {
    const serviceMaterial = material(0xd8cdb1), parkMaterial = material(0x668364);
    const building = new THREE.Mesh(box, serviceMaterial);
    building.position.set(position[0] - .16, .63, position[1] + .04); building.scale.set(.10, .17, .095);
    building.castShadow = true; building.receiveShadow = true; scene.add(building);
    const park = new THREE.Mesh(box, parkMaterial);
    park.position.set(position[0] - .21, .55, position[1] + .13); park.scale.set(.12, .013, .09); park.receiveShadow = true; scene.add(park);
    return { id, serviceMaterial, parkMaterial };
  });
  const projects = new THREE.Group(); scene.add(projects);
  const focusRing = new THREE.Mesh(geometry(new THREE.RingGeometry(.30, .315, 48)), amber);
  focusRing.rotation.x = -Math.PI / 2; focusRing.position.y = .56; scene.add(focusRing);
  const projectMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number): void => {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true; mesh.receiveShadow = true; projects.add(mesh);
  };
  function updateProjects(next: NationalSceneState): void {
    projects.clear();
    for (const surface of areaSurfaces) {
      const area = next.areas.find(item => item.id === surface.id);
      if (!area) continue;
      surface.serviceMaterial.color.set(0x9b9581).lerp(new THREE.Color(0xe5dbc5), Math.max(0, Math.min(1, area.services / 100)));
      surface.parkMaterial.color.set(0x969477).lerp(new THREE.Color(0x53795a), Math.max(0, Math.min(1, area.resilience / 100)));
    }
    // The bounded layer represents actual campaign projects, never anticipated delivery.
    next.projects.slice(-8).forEach(project => {
      const p = AREAS[project.area] ?? [0, .15];
      // Stable identifiers keep projects fixed when focus or the visible project list changes.
      let hash = 2166136261;
      for (const character of project.id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
      const x = p[0] + .16 + (hash % 4) * .15, z = p[1] + .15 + (Math.floor(hash / 4) % 4) * .14;
      const title = project.title.toLocaleLowerCase('fr');
      const kind = /école|scolair|éducati/.test(title) ? 'school'
        : /hôpital|hospital|santé|soins/.test(title) ? 'health'
        : /ferroviaire|rail|train/.test(title) ? 'rail'
        : /énergi|efficacité/.test(title) ? 'energy' : 'programme';
      if (project.state === 'delivered') {
        if (kind === 'school' || kind === 'health') {
          projectMesh(box, paleStone, x, .625, z, .19, .16, .10);
          if (kind === 'school') {
            projectMesh(roof, terracotta, x, .705, z, .205, .045, .12);
            projectMesh(box, roadMaterial, x, .554, z + .10, .18, .012, .09);
          } else {
            projectMesh(box, blue, x, .698, z + .054, .012, .052, .005);
            projectMesh(box, blue, x, .698, z + .054, .052, .012, .005);
          }
          projectMesh(box, glazing, x, .645, z + .058, .11, .024, .005);
        } else if (kind === 'energy') {
          // Efficiency means improved installations, not an invented power station.
          projectMesh(box, metal, x, .604, z, .16, .10, .10);
          projectMesh(box, glazing, x, .604, z + .054, .14, .072, .006);
          projectMesh(cylinder, stone, x + .055, .68, z, .014, .07, .014);
        } else if (kind === 'rail') {
          projectMesh(box, roadMaterial, x, .56, z, .26, .025, .08);
          projectMesh(box, metal, x, .578, z - .024, .26, .012, .009);
          projectMesh(box, metal, x, .578, z + .024, .26, .012, .009);
        } else {
          // A programme marker makes no claim that an unspecified investment built a facility.
          projectMesh(cylinder, paleStone, x, .565, z, .069, .035, .069);
          projectMesh(box, amber, x, .623, z, .055, .085, .015);
          projectMesh(box, dark, x, .625, z + .009, .03, .008, .003);
        }
      } else {
        projectMesh(box, earth, x, .56, z, .16, .025, .14);
        for (const dx of [-.075, .075]) for (const dz of [-.06, .06]) projectMesh(box, amber, x + dx, .66, z + dz, .01, .2, .01);
        projectMesh(box, amber, x, .75, z, .17, .01, .015);
        projectMesh(box, project.state === 'risk' ? terracotta : blue, x, .605, z, .13, .065, .11);
      }
    });
    const p = AREAS[next.focus];
    focusRing.visible = Boolean(p);
    if (p) focusRing.position.set(p[0], .56, p[1]);
  }
  function resize(): void {
    if (disposed) return;
    const rect = host.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, rect.width < 700 ? 1.5 : 2));
    renderer.setSize(rect.width, rect.height, false);
    const aspect = rect.width / rect.height, halfHeight = Math.max(3.05, 3.8 / aspect);
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
    draw();
  }
  function draw(): void {
    if (disposed || !active || !visible || document.hidden) return;
    camera.position.set(Math.sin(yaw) * 10, 10.2, Math.cos(yaw) * 10);
    camera.lookAt(target); renderer.render(scene, camera);
  }
  function schedule(): void {
    if (frame || disposed || !active || !visible || document.hidden) return;
    frame = requestAnimationFrame((time) => { frame = 0; if (time - lastFrame >= 33) { lastFrame = time; draw(); } else schedule(); });
  }
  function pointerDown(event: PointerEvent): void {
    // Touch remains native vertical scrolling. The full scene needs no gesture to understand.
    if (event.pointerType !== 'mouse' || event.button !== 0 || state?.reducedMotion) return;
    dragX = event.clientX; canvas.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent): void {
    if (dragX === undefined) return;
    yaw = Math.max(-.38, Math.min(.38, yaw + (event.clientX - dragX) * .003)); dragX = event.clientX; schedule();
  }
  function pointerUp(): void { dragX = undefined; }
  function contextLost(event: Event): void {
    event.preventDefault(); lost = true; active = false; host.dataset.sceneState = 'unavailable'; host.dataset.state = 'unavailable';
    canvas.style.visibility = 'hidden'; if (frame) cancelAnimationFrame(frame); frame = 0;
  }
  function visibilityChange(): void { if (document.hidden) { if (frame) cancelAnimationFrame(frame); frame = 0; } else draw(); }
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('webglcontextlost', contextLost); document.addEventListener('visibilitychange', visibilityChange);
  const observer = new ResizeObserver(resize); observer.observe(host);
  const intersection = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); if (visible) draw(); }); intersection.observe(host);
  host.append(canvas); resize();
  return {
    attach(nextHost, nextState) {
      if (disposed || lost) return;
      if (nextHost !== host) { observer.unobserve(host); intersection.unobserve(host); host = nextHost; host.append(canvas); observer.observe(host); intersection.observe(host); }
      state = nextState; active = true; visible = true;
      if (nextState.reducedMotion) yaw = .05;
      updateProjects(nextState); resize();
    },
    suspend() { active = false; if (frame) cancelAnimationFrame(frame); frame = 0; },
    dispose() {
      if (disposed) return; disposed = true; if (frame) cancelAnimationFrame(frame);
      observer.disconnect(); intersection.disconnect();
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('webglcontextlost', contextLost); document.removeEventListener('visibilitychange', visibilityChange);
      scene.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
      geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
      sun.shadow.dispose(); renderer.dispose(); canvas.remove();
    },
  };
}
