import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import type { Scene } from "@babylonjs/core/scene";
import { FRANCE_OUTLINES } from "./map-geography.ts";
import { mapPosition } from "./map-state.ts";

const coast = FRANCE_OUTLINES.flatMap((outline) =>
  outline.map(([lon, lat]) => mapPosition(lon, lat)),
);

/** Local geometry and shaders also work from the player's offline cache. */
export function buildMapWater(scene: Scene) {
  const mesh = new Mesh("country-sea", scene);
  const positions: number[] = [], indices: number[] = [], shore: number[] = [];
  const divisions = 128, size = 36;
  for (let row = 0; row <= divisions; row++) {
    for (let column = 0; column <= divisions; column++) {
      const x = (column / divisions - 0.5) * size;
      const z = (row / divisions - 0.5) * size;
      positions.push(x, -0.08, z);
      let distance = 9;
      for (const point of coast)
        distance = Math.min(distance, Math.hypot(point.x - x, point.z - z));
      shore.push(Math.min(1, distance / 0.65));
      if (row < divisions && column < divisions) {
        const a = row * (divisions + 1) + column, b = a + divisions + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new VertexData();
  geometry.positions = positions;
  geometry.indices = indices;
  geometry.applyToMesh(mesh);
  mesh.setVerticesData("shore", shore, false, 1);
  mesh.isPickable = false;
  const material = new ShaderMaterial("sea-surface", scene, {
    vertexSource: `
      precision highp float;
      attribute vec3 position;
      attribute float shore;
      uniform mat4 worldViewProjection;
      uniform float time;
      varying vec3 seaPosition;
      varying float coastDepth;
      void main(void) {
        vec3 p = position;
        p.y += (sin(p.x * 9.0 + p.z * 4.0 + time * .45)
          + sin(p.x * 3.0 - p.z * 8.0 - time * .32)) * .004;
        seaPosition = p;
        coastDepth = shore;
        gl_Position = worldViewProjection * vec4(p, 1.0);
      }`,
    fragmentSource: `
      precision highp float;
      uniform float time;
      uniform vec3 eye;
      varying vec3 seaPosition;
      varying float coastDepth;
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
      void main(void) {
        vec2 p = seaPosition.xz;
        float depth = smoothstep(.0, .92, coastDepth);
        float broad = noise(p * .35);
        vec3 deep = mix(vec3(.023, .080, .119), vec3(.043, .142, .194), broad);
        vec3 color = mix(vec3(.104, .292, .317), deep, depth);
        float wave = noise(vec2(p.x * 4.0 + p.y, p.y * 24.0 + time * .04));
        color += vec3(.025, .046, .061) * (wave - .5);
        float crest = pow(wave, 12.0);
        color += vec3(.28, .35, .35) * crest * .26;
        vec3 normal = normalize(vec3(cos(p.x * 9.0 + p.y * 4.0 + time * .45) * .035,
          1.0, cos(p.x * 3.0 - p.y * 8.0 - time * .32) * .035));
        vec3 towardEye = normalize(eye - seaPosition);
        float reflection = pow(max(0.0, dot(reflect(normalize(vec3(.55, -1.2, .7)), normal), towardEye)), 48.0);
        color += vec3(.65, .52, .36) * reflection * (.16 + crest * .35);
        float foam = (1.0 - smoothstep(.04, .20, coastDepth)) *
          smoothstep(.5, .9, noise(p * 13.0 + vec2(time * .025, 0.0)));
        color = mix(color, vec3(.40, .55, .52), foam * .38);
        gl_FragColor = vec4(color, 1.0);
      }`,
  }, {
    attributes: ["position", "shore"],
    uniforms: ["worldViewProjection", "time", "eye"],
  });
  material.setFloat("time", 0);
  material.onBindObservable.add(() => {
    if (scene.activeCamera) material.setVector3("eye", scene.activeCamera.globalPosition);
  });
  material.backFaceCulling = false;
  mesh.material = material;
  return { mesh, advance: (seconds: number) => material.setFloat("time", seconds) };
}
