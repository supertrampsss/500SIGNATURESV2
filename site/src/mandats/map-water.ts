import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { FRANCE_OUTLINES } from "./map-geography.ts";
import { mapPosition } from "./map-state.ts";
import { landContains } from "./map-landscape.ts";

type ShoreSegment = { ax: number; az: number; bx: number; bz: number };
const shoreCells = new Map<string, ShoreSegment[]>();
const coastlines = FRANCE_OUTLINES.map(outline => outline.map(([lon, lat]) => mapPosition(lon, lat)));
for (const points of coastlines) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const segment = { ax: a.x, az: a.z, bx: b.x, bz: b.z };
    for (let x = Math.floor((Math.min(a.x, b.x) - .7) / .75);
      x <= Math.floor((Math.max(a.x, b.x) + .7) / .75); x++) {
      for (let z = Math.floor((Math.min(a.z, b.z) - .7) / .75);
        z <= Math.floor((Math.max(a.z, b.z) + .7) / .75); z++) {
        const key = `${x}:${z}`, cell = shoreCells.get(key) ?? [];
        cell.push(segment);
        shoreCells.set(key, cell);
      }
    }
  }
}
function shoreDistance(x: number, z: number) {
  let distance = .65;
  for (const segment of shoreCells.get(`${Math.floor(x / .75)}:${Math.floor(z / .75)}`) ?? []) {
    const dx = segment.bx - segment.ax, dz = segment.bz - segment.az;
    const length = dx * dx + dz * dz;
    const t = length ? Math.max(0, Math.min(1,
      ((x - segment.ax) * dx + (z - segment.az) * dz) / length)) : 0;
    distance = Math.min(distance,
      Math.hypot(x - segment.ax - dx * t, z - segment.az - dz * t));
  }
  return distance;
}

/** Local geometry and shaders also work from the player's offline cache. */
export function buildMapWater(scene: Scene) {
  const mesh = new Mesh("country-sea", scene);
  const positions: number[] = [], indices: number[] = [], shore: number[] = [];
  // Concentrate vertices along the miniature's shore; the distant sea needs
  // no equally dense tessellation. Measuring segments preserves narrow bays.
  const coast = coastlines.flat();
  function axis(values: number[]) {
    const step = .08, start = Math.floor((Math.min(...values) - .75) / step) * step,
      end = Math.ceil((Math.max(...values) + .75) / step) * step;
    return [-30, start - 4,
      ...Array.from({ length: Math.round((end - start) / step) + 1 }, (_, i) => start + i * step),
      end + 4, 30];
  }
  const axisX = axis(coast.map(point => point.x)), axisZ = axis(coast.map(point => point.z)),
    columns = axisX.length - 1, rows = axisZ.length - 1;
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const x = axisX[column], z = axisZ[row];
      positions.push(x, -0.08, z);
      shore.push(shoreDistance(x, z) / .65);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column, b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new VertexData();
  geometry.positions = positions;
  geometry.indices = indices;
  geometry.colors = new Float32Array(positions.length / 3 * 4).fill(1);
  geometry.uvs = new Float32Array(positions.length / 3 * 2);
  geometry.normals = new Float32Array(positions.length);
  for (let index = 1; index < positions.length; index += 3) geometry.normals[index] = 1;
  geometry.applyToMesh(mesh);
  mesh.setVerticesData("shore", shore, false, 1);
  mesh.setVerticesData("channel", new Float32Array(shore.length), false, 1);
  mesh.isPickable = false;
  const material = new ShaderMaterial("sea-surface", scene, {
    vertexSource: `
      precision highp float;
      attribute vec3 position;
      attribute float shore;
      attribute float channel;
      attribute vec4 color;
      attribute vec2 uv;
      uniform mat4 worldViewProjection;
      uniform float time;
      varying vec3 seaPosition;
      varying float coastDepth;
      varying float riverChannel;
      varying vec3 waterTint;
      varying vec2 flow;
      void main(void) {
        vec3 p = position;
        p.y += (sin(p.x * 9.0 + p.z * 4.0 + time * .45)
          + sin(p.x * 3.0 - p.z * 8.0 - time * .32)) * .004 * (1.0 - channel * .75);
        seaPosition = p;
        coastDepth = shore;
        riverChannel = channel;
        waterTint = color.rgb;
        flow = uv;
        gl_Position = worldViewProjection * vec4(p, 1.0);
      }`,
    fragmentSource: `
      precision highp float;
      uniform float time;
      uniform vec3 eye;
      varying vec3 seaPosition;
      varying float coastDepth;
      varying float riverChannel;
      varying vec3 waterTint;
      varying vec2 flow;
      float hash(vec2 p) {
        vec3 h = fract(vec3(p.xyx) * .1031);
        h += dot(h, h.yzx + 33.33);
        return fract((h.x + h.y) * h.z);
      }
      float noise(vec2 p) {
        vec2 cell = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), f.x),
          mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), f.x), f.y);
      }
      float seaNoise(vec2 p) {
        float n = noise(p) * .56;
        p = mat2(.8, -.6, .6, .8) * p * 2.03;
        n += noise(p) * .28;
        p = mat2(.8, -.6, .6, .8) * p * 2.03;
        return n + noise(p) * .16;
      }
      void main(void) {
        vec2 p = seaPosition.xz;
        float broad = seaNoise(p * .45);
        // The reference sea has a navy blue body and small, local clear-water
        // pockets. A continuous cyan shelf used to extend .60 world unit out.
        vec3 deep = mix(vec3(.008, .137, .255), vec3(.039, .224, .365), broad);
        float coastPatch = noise(p * 4.7 + vec2(7.4, 13.1));
        float shelfWidth = mix(.10, .25, coastPatch);
        float shallows = (1.0 - smoothstep(.012, shelfWidth, coastDepth)) *
          smoothstep(.31, .75, coastPatch) * (1.0 - riverChannel);
        vec3 color = mix(deep, vec3(.016, .302, .427), shallows * .62);
        vec2 drift = vec2(time * .021, -time * .014);
        float wave = seaNoise(p * 23.0 + drift);
        // Several crossed ripples give the surface a fine grain instead of
        // the broad horizontal bands of the first water material.
        float rippleA = sin(dot(p, vec2(51.0, 19.0)) + time * .39);
        float rippleB = sin(dot(p, vec2(-23.0, 43.0)) - time * .28);
        color += vec3(.024, .039, .049) * (wave - .5);
        // The submitted river has a dark channel and brighter shallows.
        // Its longitudinal UVs follow the actual curved course.
        float current = .5 + .5 * sin(flow.y * 160.0 +
          noise(flow * vec2(17.0, 23.0)) * 1.5 - time * .18);
        float currentGlint = smoothstep(.86, .995, current) *
          smoothstep(.46, .79, noise(flow * vec2(41.0, 19.0)));
        color = mix(color, waterTint +
          vec3(.018, .031, .038) * (wave - .5) +
          vec3(.065, .085, .095) * currentGlint, riverChannel);
        vec3 normal = normalize(vec3(rippleA * .055 + (wave - .5) * .12,
          1.0, rippleB * .052 + (wave - .5) * .1));
        vec3 towardEye = normalize(eye - seaPosition);
        float reflection = pow(max(0.0, dot(reflect(normalize(vec3(.55, riverChannel > .5 ? -1.2 : -.80, .7)), normal), towardEye)), 48.0);
        color += vec3(.56, .69, .76) * reflection * (.12 + wave * .22);
        float flecks = smoothstep(.72, .88, noise(p * 108.0 + drift)) *
          smoothstep(.52, .76, wave);
        float crest = smoothstep(.89, .997, .5 + .5 * rippleA) *
          smoothstep(.62, .86, seaNoise(p * 15.0 + drift));
        // Calm open water keeps isolated glints instead of a field of bright
        // speckles. River tint/current and their existing flecks stay intact.
        color += vec3(.12, .18, .19) * flecks * (mix(.10, .2, riverChannel) + reflection * .9);
        color += vec3(.024, .039, .048) * crest * (1.0 - riverChannel);
        // Broken near-rock wash stays thin and retains the existing clock.
        // The coarse patch interrupts it; the moving fine noise draws surf.
        float wash = .5 + .5 * sin(coastDepth * 111.0 - time * .32 + coastPatch * 2.6);
        float foam = (1.0 - smoothstep(.011, .075, coastDepth)) *
          smoothstep(.50, .76, seaNoise(p * 27.0 + drift)) *
          smoothstep(.20, .62, coastPatch) * (.30 + wash * .70) * (1.0 - riverChannel);
        color = mix(color, vec3(.733, .824, .851), foam * .67);
        gl_FragColor = vec4(color, 1.0);
      }`,
  }, {
    attributes: ["position", "shore", "channel", "color", "uv"],
    uniforms: ["worldViewProjection", "time", "eye"],
  });
  material.setFloat("time", 0);
  material.onBindObservable.add(() => {
    if (scene.activeCamera) material.setVector3("eye", scene.activeCamera.globalPosition);
  });
  material.backFaceCulling = false;
  mesh.material = material;
  return {
    mesh,
    advance: (seconds: number) => material.setFloat("time", seconds),
    coverRiver(river: Mesh) {
      const previous = river.material;
      river.setVerticesData("shore", new Float32Array(river.getTotalVertices()).fill(.32), false, 1);
      river.setVerticesData("channel", new Float32Array(river.getTotalVertices()).fill(1), false, 1);
      river.material = material;
      previous?.dispose(false, false);
    },
    boatWash(boats: TransformNode[]) {
      const wash = new Mesh("sea-boat-wash", scene), data = new VertexData();
      const washPositions: number[] = [], washIndices: number[] = [], colors: number[] = [];
      for (const boat of boats) {
        boat.computeWorldMatrix(true);
        const center = boat.getAbsolutePosition();
        const direction = Vector3.TransformNormal(new Vector3(0, 0, 1),
          boat.getWorldMatrix());
        const scale = direction.length();
        direction.normalize();
        const sailboat = boat.metadata?.harbourVessel === "sail";
        const footprint = boat.metadata?.footprint as Array<{ x: number; z: number }>;
        const longitudinal = footprint.map(p =>
          (p.x - center.x) * direction.x + (p.z - center.z) * direction.z);
        const lateral = footprint.map(p =>
          (p.x - center.x) * direction.z - (p.z - center.z) * direction.x);
        const length = (Math.max(...longitudinal) - Math.min(...longitudinal)) * .85;
        const stern = -Math.min(...longitudinal);
        const beam = Math.max(...lateral) - Math.min(...lateral);
        for (const side of [-1, 1]) {
          for (let segment = 0; segment < 12; segment++) {
            const t0 = segment / 12, t1 = (segment + 1) / 12;
            const point = (t: number, edge: number) => {
              const trailing = stern + t * length;
              const lateral = side * (beam * .36 + t * length * .16 +
                edge * Math.min(.006 * scale, beam * .06));
              return new Vector3(center.x - direction.x * trailing + direction.z * lateral,
                -.065, center.z - direction.z * trailing - direction.x * lateral);
            };
            const vertices = [point(t0, -1), point(t1, -1), point(t1, 1), point(t0, 1)];
            if (vertices.some(p => landContains(p.x, p.z))) continue;
            const offset = washPositions.length / 3;
            for (let index = 0; index < vertices.length; index++) {
              const p = vertices[index], t = index === 0 || index === 3 ? t0 : t1;
              washPositions.push(p.x, p.y, p.z);
              colors.push(.8, .88, .84, (.6 - t * .48) * (sailboat ? .8 : 1));
            }
            washIndices.push(offset, offset + 2, offset + 1, offset, offset + 3, offset + 2);
          }
        }
      }
      data.positions = washPositions;
      data.indices = washIndices;
      data.colors = colors;
      data.normals = washPositions.map((_, index) => index % 3 === 1 ? 1 : 0);
      data.applyToMesh(wash);
      wash.hasVertexAlpha = true;
      const surface = new StandardMaterial("sea-boat-foam", scene);
      surface.diffuseColor = Color3.White();
      surface.emissiveColor = new Color3(.12, .15, .14);
      surface.specularColor = Color3.Black();
      surface.backFaceCulling = false;
      wash.material = surface;
      wash.metadata = { castsShadow: false };
      wash.isPickable = false;
      return wash;
    },
  };
}
