import { NullEngine } from "../../site/node_modules/@babylonjs/core/Engines/nullEngine.js";
import { Scene } from "../../site/node_modules/@babylonjs/core/scene.js";
import { Texture } from "../../site/node_modules/@babylonjs/core/Materials/Textures/texture.js";
import { StandardMaterial } from "../../site/node_modules/@babylonjs/core/Materials/standardMaterial.js";
import { buildLandscapeSurvey, heightSurveySnapshot } from "../../site/src/mandats/map-landscape.ts";
import type { LandscapeArchive } from "../../site/src/mandats/map-landscape-cache.ts";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

const root = resolve(process.argv[2] ?? "."), path = (p: string) => resolve(root, p);
const sha = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const inputs = new Map<string, string>();
function recordSource(file: string) {
  const name = relative(root, file);
  if (inputs.has(name) || name.endsWith("map-terrain-revision.ts")) return;
  const source = readFileSync(file, "utf8"); inputs.set(name, sha(source));
  for (const match of source.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+\.ts)["']/g))
    recordSource(resolve(dirname(file), match[1]));
}
recordSource(path("site/src/mandats/map-landscape.ts"));
recordSource(path("tools/mandats-assets/bake-terrain.ts"));
inputs.set("site/node_modules/@babylonjs/core/package.json", sha(readFileSync(path("site/node_modules/@babylonjs/core/package.json"))));
const engine = new NullEngine(), scene = new Scene(engine);
try {
  const keys = ["earth", "crops", "earthNormal", "leaves", "leafNormal", "stoneNormal", "rock", "rockNormal", "coastNormal"] as const;
  const textures = Object.fromEntries(keys.map(key => {
    const texture = new Texture(null, scene); texture.name = key; return [key, texture];
  })) as Record<typeof keys[number], Texture>;
  const { meshes, colorTargets, orchards } = await buildLandscapeSurvey(scene, textures);
  const header: LandscapeArchive = { version: 1, meshes: [], materials: [], orchards };
  const chunks: Buffer[] = [], reports: object[] = []; let offset = 0;
  const view = (values: number[], type: "f64" | "f32" | "u32", missingCells = false) => {
    if (!values.every(value => Number.isFinite(value) || (missingCells && Number.isNaN(value))))
      throw new Error("Nonfinite terrain attribute.");
    const padding = (8 - offset % 8) % 8;
    if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding; }
    const array = type === "f64" ? new Float64Array(values) : type === "u32" ? new Uint32Array(values) : new Float32Array(values);
    const bytes = Buffer.from(array.buffer); chunks.push(bytes);
    const result = { offset, count: values.length, type }; offset += bytes.length; return result;
  };
  const materials = new Set<StandardMaterial>();
  for (const mesh of meshes) {
    const indices = Array.from(mesh.getIndices()!), original = mesh.getTotalVertices();
    if (indices.length % 3 || indices.some(i => !Number.isInteger(i) || i < 0 || i >= original))
      throw new Error("Invalid terrain indices.");
    const used = [...new Set(indices)].sort((a, b) => a - b), remap = new Map(used.map((id, i) => [id, i]));
    const attribute = (kind: string, stride: number) => {
      const data = mesh.getVerticesData(kind)!;
      return used.flatMap(id => Array.from(data.slice(id * stride, (id + 1) * stride)));
    };
    const material = mesh.material as StandardMaterial; materials.add(material);
    const surveys = colorTargets.find(target => target.mesh === mesh)?.surveys;
    const positions = attribute("position", 3);
    header.meshes.push({ name: mesh.name, material: material.name, metadata: mesh.metadata ?? null,
      positions: view(positions, "f32"), normals: view(attribute("normal", 3), "f32"),
      colors: view(attribute("color", 4), "f32"), uvs: view(attribute("uv", 2), "f32"),
      indices: view(indices.map(id => remap.get(id)!), "u32"),
      ...(surveys ? { bands: view(used.map(id => surveys.get(id)?.band ?? 0xffffffff), "u32") } : {}) });
    reports.push({ name: mesh.name, originalVertices: original, retainedVertices: used.length, triangles: indices.length / 3,
      maximumPositionRounding: positions.reduce((maximum, value) => Math.max(maximum, Math.abs(value - Math.fround(value))), 0) });
  }
  for (const material of materials) header.materials.push({ name: material.name,
    diffuse: material.diffuseColor.asArray(), ambient: material.ambientColor.asArray(),
    emissive: material.emissiveColor.asArray(), specular: material.specularColor.asArray(),
    specularPower: material.specularPower, alpha: material.alpha, backFaceCulling: material.backFaceCulling,
    ...(material.diffuseTexture ? { diffuseTexture: material.diffuseTexture.name as keyof typeof textures } : {}),
    ...(material.bumpTexture ? { bumpTexture: material.bumpTexture.name as keyof typeof textures } : {}) });
  const heightSurvey = heightSurveySnapshot();
  header.heightSurvey = { minimumX: heightSurvey.minimumX, minimumZ: heightSurvey.minimumZ,
    width: heightSurvey.width, height: heightSurvey.height, samples: heightSurvey.samples,
    values: view(Array.from(heightSurvey.values), "f64", true) };
  const json = Buffer.from(JSON.stringify(header)), start = Math.ceil((json.length + 4) / 8) * 8,
    prefix = Buffer.alloc(start); prefix.writeUInt32LE(json.length); json.copy(prefix, 4);
  const bytes = Buffer.concat([prefix, ...chunks]), compressed = gzipSync(bytes, { level: 9 }), digest = sha(compressed);
  writeFileSync(path("site/public/mandats/models/terrain-survey.bin.gz"), compressed);
  writeFileSync(path("site/public/mandats/models/terrain-survey.json"), JSON.stringify({
    format: "MANDATS indexed terrain archive v1, gzip", sha256: digest,
    uncompressedSha256: sha(bytes), compressedBytes: compressed.length, uncompressedBytes: bytes.length,
    materials: header.materials.length, orchards: orchards.length, meshes: reports,
    heightSurvey: { ...header.heightSurvey, values: undefined },
    sourceInputs: [...inputs].sort(([a], [b]) => a.localeCompare(b)).map(([file, sha256]) => ({ file, sha256 })),
    method: "Same canonical survey as development. Unused vertices removed; all attributes retain the float32 values actually uploaded to WebGL. Position rounding from the analytic double-precision survey is measured per mesh. No camera, state or image baked." }, null, 2) + "\n");
  writeFileSync(path("site/src/mandats/map-terrain-revision.ts"),
    `// Updated by tools/mandats-assets/bake-terrain.ts after a reproducible export.\nexport const TERRAIN_SURVEY_URL = "/mandats/models/terrain-survey.bin.gz?v=${digest.slice(0, 16)}";\n`);
  console.log(JSON.stringify({ sha256: digest, compressedBytes: compressed.length, uncompressedBytes: bytes.length, meshes: reports }));
} finally { scene.dispose(); engine.dispose(); }
