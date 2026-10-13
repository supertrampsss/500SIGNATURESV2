import { installBakedHeightSurvey } from "./map-height-survey.ts";
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { LandMaterialTextures } from "./map-land-materials.ts";
import { prepareMineralSurface, prepareMeadowSurface } from "./map-mineral-material.ts";
import { TERRAIN_SURVEY_URL } from "./map-terrain-revision.ts";

type View = { offset: number; count: number; type: "f64" | "f32" | "u32" };
type MaterialRecord = {
  name: string; diffuse: number[]; ambient: number[]; emissive: number[]; specular: number[];
  specularPower: number; backFaceCulling: boolean; alpha: number;
  diffuseTexture?: keyof LandMaterialTextures; bumpTexture?: keyof LandMaterialTextures;
};
export type LandscapeArchive = {
  version: 1;
  heightSurvey?: { minimumX: number; minimumZ: number; width: number; height: number; samples: number; values: View };
  materials: MaterialRecord[];
  meshes: Array<{ name: string; material: string; metadata: Record<string, unknown> | null;
    positions: View; normals: View; colors: View; uvs: View; indices: View; bands?: View }>;
  orchards: Array<{ x: number; z: number }>;
};

/** The archive contains real indexed geometry, never a view or a scene image. */
export async function loadLandscapeSurvey(scene: Scene, textures: LandMaterialTextures) {
  const response = await fetch(TERRAIN_SURVEY_URL);
  if (!response.ok || !response.body) throw new Error("Terrain survey unavailable.");
  // Static hosts may serve this file with Content-Encoding: gzip. Fetch has
  // already decoded that response; hosts without the header return gzip bytes.
  const downloaded = await response.arrayBuffer(), magic = new Uint8Array(downloaded, 0, Math.min(2, downloaded.byteLength));
  const buffer = magic[0] === 0x1f && magic[1] === 0x8b
    ? await new Response(new Blob([downloaded]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()
    : downloaded;
  const headerLength = new DataView(buffer).getUint32(0, true);
  if (headerLength < 2 || headerLength + 4 > buffer.byteLength) throw new Error("Invalid terrain archive.");
  const header: LandscapeArchive = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength)));
  if (header.version !== 1) throw new Error("Unsupported terrain archive.");
  if (scene.isDisposed) return { meshes: [], colorTargets: [], orchards: [] };
  const start = Math.ceil((headerLength + 4) / 8) * 8;
  const read = (view: View) => {
    const at = start + view.offset, size = view.type === "f64" ? 8 : 4;
    if (view.offset < 0 || view.count < 0 || at + view.count * size > buffer.byteLength)
      throw new Error("Invalid terrain buffer view.");
    return view.type === "f64" ? Array.from(new Float64Array(buffer, at, view.count)) :
      view.type === "u32" ? new Uint32Array(buffer, at, view.count) : new Float32Array(buffer, at, view.count);
  };
  const floats = (view: View) => {
    if (view.type === "u32") throw new Error("Invalid floating terrain attribute.");
    return read(view) as number[] | Float32Array;
  };
  const integers = (view: View) => {
    if (view.type !== "u32") throw new Error("Invalid indexed terrain attribute.");
    return read(view) as Uint32Array;
  };
  if (header.heightSurvey) {
    const record = header.heightSurvey, view = record.values;
    if (view.type !== "f64" || view.offset < 0 || view.count < 0 ||
        start + view.offset + view.count * 8 > buffer.byteLength)
      throw new Error("Invalid height survey buffer.");
    installBakedHeightSurvey({ minimumX: record.minimumX, minimumZ: record.minimumZ,
      width: record.width, height: record.height,
      // Keep only the numeric grid when a scene is disposed, not the whole land archive.
      values: new Float64Array(new Float64Array(buffer, start + view.offset, view.count)) });
  }
  const materials = new Map<string, StandardMaterial>();
  for (const record of header.materials) {
    const material = new StandardMaterial(record.name, scene);
    material.diffuseColor = Color3.FromArray(record.diffuse);
    material.ambientColor = Color3.FromArray(record.ambient);
    material.emissiveColor = Color3.FromArray(record.emissive);
    material.specularColor = Color3.FromArray(record.specular);
    material.specularPower = record.specularPower;
    material.backFaceCulling = record.backFaceCulling; material.alpha = record.alpha;
    if (record.diffuseTexture) material.diffuseTexture = textures[record.diffuseTexture];
    if (record.bumpTexture) material.bumpTexture = textures[record.bumpTexture];
    if (["landscape-ground", "landscape-crops"].includes(record.name)) prepareMeadowSurface(material);
    if (["landscape-mineral-ground", "landscape-cliffs"].includes(record.name))
      prepareMineralSurface(material, false, record.name === "landscape-cliffs");
    materials.set(record.name, material);
  }
  const meshes: Mesh[] = [], colorTargets: Array<{ mesh: Mesh; surveys?: Map<number, { band: number }> }> = [];
  for (const record of header.meshes) {
    const mesh = new Mesh(record.name, scene), data = new VertexData();
    // Keep the archive's exact GPU arrays instead of expanding every scalar
    // into a boxed JavaScript number before uploading the same float32 value.
    data.positions = floats(record.positions); data.normals = floats(record.normals);
    data.colors = floats(record.colors); data.uvs = floats(record.uvs); data.indices = integers(record.indices);
    data.applyToMesh(mesh);
    mesh.material = materials.get(record.material)!;
    mesh.metadata = record.metadata; mesh.receiveShadows = true; mesh.isPickable = false;
    meshes.push(mesh);
    if (["landscape-terrain-0", "landscape-terrain-mineral-0", "landscape-terrain-coastal-0"].includes(record.name)) {
      const surveys = record.bands ? new Map<number, { band: number }>() : undefined;
      if (record.bands) {
        const bands = integers(record.bands);
        for (let i = 0; i < bands.length; i++) if (bands[i] !== 0xffffffff) surveys!.set(i, { band: bands[i] });
      }
      colorTargets.push({ mesh, surveys });
    }
  }
  scene.metadata = { ...scene.metadata, bakedTerrain: { meshes: meshes.length, bytes: buffer.byteLength,
    heightSamples: header.heightSurvey?.samples ?? 0 } };
  return { meshes, colorTargets, orchards: header.orchards };
}
