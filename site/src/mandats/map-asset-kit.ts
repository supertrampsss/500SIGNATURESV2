import type { Scene } from "@babylonjs/core/scene";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Material } from "@babylonjs/core/Materials/material";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@babylonjs/loaders/glTF/glTFFileLoader";
import "@babylonjs/core/Meshes/instancedMesh";

type AssetTone = { key: string; tint: readonly [number, number, number] };
export type AssetKit = {
  names: string[];
  bounds(name: string): { width: number; height: number; depth: number };
  instantiate(name: string, parent?: TransformNode, tone?: AssetTone): {
    root: TransformNode;
    meshes: AbstractMesh[];
  };
  dispose(): void;
};

const kits = new WeakMap<Scene, Map<string, Promise<AssetKit>>>();
const architecturalKits = new Set([
  "/mandats/models/architecture.glb",
  "/mandats/models/paris.glb",
  "/mandats/models/cathedrale.glb",
]);

// The current prefiltered daylight has a green-heavy upward irradiance.
// Rebalance both diffuse irradiance and specular radiance through the existing
// PBR reflectionColor uniform, leaving stone/slate atlas pixels untouched.
// The mean comes from lighting/prefilter-report.json (six axial directions).
const architecturalDaylightMean = new Color3(.6904249668877601, .6548215501790223, .5549155640500457),
  architecturalDaylightTint = new Color3(1.18, .98, .98),
  daylightLuminance = (value: Color3) => value.r * .2126 + value.g * .7152 + value.b * .0722,
  architecturalDaylightBalance = architecturalDaylightTint.scale(
    daylightLuminance(architecturalDaylightMean) /
      daylightLuminance(architecturalDaylightMean.multiply(architecturalDaylightTint)));

/** Authored local models share geometry and materials across the miniature. */
export function loadAssetKit(scene: Scene, url: string): Promise<AssetKit> {
  if (!url.startsWith("/mandats/models/") || !url.split("?")[0].endsWith(".glb"))
    return Promise.reject(new Error("The model kit must be a local GLB."));
  if (scene.isDisposed) return Promise.reject(new Error("Scene disposed."));
  let cache = kits.get(scene);
  if (!cache) { cache = new Map(); kits.set(scene, cache); }
  const existing = cache.get(url);
  if (existing) return existing;
  const loading = load(scene, url);
  cache.set(url, loading);
  void loading.catch(() => { if (cache?.get(url) === loading) cache.delete(url); });
  return loading;
}

async function load(scene: Scene, url: string): Promise<AssetKit> {
  const container = await LoadAssetContainerAsync(url, scene, {
    pluginExtension: ".glb",
  });
  if (scene.isDisposed) {
    container.dispose();
    throw new Error("Scene disposed during model loading.");
  }
  // The lower miniature sun restores StandardMaterial slope shading. PBR
  // already keeps HDR light, so retain its existing direct-light power.
  for (const material of container.materials) {
    if (material.getClassName() === "PBRMaterial")
      (material as PBRMaterial).directIntensity *= 1.80 / 0.95;
  }
  if (architecturalKits.has(url.split("?")[0])) {
    for (const material of container.materials) {
      if (material.getClassName() !== "PBRMaterial") continue;
      const surface = material as PBRMaterial;
      // PBR diffuse is normalized by pi; the landscape uses StandardMaterial.
      // Calibrate only the architectural surfaces, preserving their atlas and
      // ORM channels. Compensate direct specular so slate does not turn white.
      surface.reflectionColor = surface.reflectionColor.multiply(architecturalDaylightBalance);
      surface.directIntensity = 4.10;
      surface.environmentIntensity = 0.80;
      surface.specularIntensity = 0.5;
      surface.ambientTextureStrength = 0.75;
    }
  }
  let disposed = false, serial = 0;
  const distantSources = new Map<Mesh, Mesh>();
  const variants = new Map<string, {
    sources: Map<Mesh, Mesh>; materials: Map<Material, Material>;
  }>();
  function sourceFor(mesh: Mesh, tone?: AssetTone): Mesh {
    if (!tone) return mesh;
    const key = `${tone.key}:${tone.tint.join(",")}`;
    let variant = variants.get(key);
    if (!variant) {
      variant = { sources: new Map(), materials: new Map() };
      variants.set(key, variant);
    }
    const existing = variant.sources.get(mesh);
    if (existing) return existing;
    // An instance inherits its source material. A second disabled source keeps
    // the same geometry while giving surrounding forests their own palette.
    const source = new Mesh(`${tone.key}-${mesh.name}`, scene);
    mesh.geometry?.applyToMesh(source);
    // Variants must stay outside the prefab hierarchy. Adding one as a sibling
    // of its parts makes the next tree recursively duplicate those templates.
    source.parent = null;
    source.rotationQuaternion = Quaternion.Identity();
    mesh.computeWorldMatrix(true).decompose(source.scaling,
      source.rotationQuaternion, source.position);
    source.overrideMaterialSideOrientation = mesh.overrideMaterialSideOrientation;
    source.metadata = { ...mesh.metadata, assetTemplate: true };
    source.receiveShadows = true;
    source.setEnabled(false);
    if (mesh.material) {
      let material = variant.materials.get(mesh.material);
      if (!material) {
        const tint = new Color3(...tone.tint);
        // Copy the surface channels, not Babylon's serialized runtime state.
        // Cloning a bound PBR material invalidates thousands of submeshes.
        if (mesh.material.getClassName() === "PBRMaterial") {
          const original = mesh.material as PBRMaterial;
          const MaterialClass = original.constructor as new (name: string, scene: Scene) => PBRMaterial;
          const tinted = new MaterialClass(`${tone.key}-${original.name}`, scene);
          tinted.albedoColor = original.albedoColor.multiply(tint);
          tinted.metallic = original.metallic;
          tinted.roughness = original.roughness;
          tinted.directIntensity = original.directIntensity;
          tinted.environmentIntensity = original.environmentIntensity;
          tinted.reflectionColor = original.reflectionColor.clone();
          tinted.specularIntensity = original.specularIntensity;
          tinted.albedoTexture = original.albedoTexture;
          tinted.bumpTexture = original.bumpTexture;
          tinted.ambientTexture = original.ambientTexture;
          tinted.metallicTexture = original.metallicTexture;
          // glTF packs occlusion, roughness and metalness into R, G and B.
          // A fresh Babylon material otherwise interprets the same texture
          // with its own channel defaults, turning stone into dark metal.
          tinted.useRoughnessFromMetallicTextureAlpha = original.useRoughnessFromMetallicTextureAlpha;
          tinted.useRoughnessFromMetallicTextureGreen = original.useRoughnessFromMetallicTextureGreen;
          tinted.useMetallnessFromMetallicTextureBlue = original.useMetallnessFromMetallicTextureBlue;
          tinted.useAmbientOcclusionFromMetallicTextureRed = original.useAmbientOcclusionFromMetallicTextureRed;
          tinted.useAmbientInGrayScale = original.useAmbientInGrayScale;
          tinted.ambientTextureStrength = original.ambientTextureStrength;
          tinted.ambientTextureImpactOnAnalyticalLights = original.ambientTextureImpactOnAnalyticalLights;
          tinted.invertNormalMapX = original.invertNormalMapX;
          tinted.invertNormalMapY = original.invertNormalMapY;
          tinted.metallicF0Factor = original.metallicF0Factor;
          tinted.twoSidedLighting = original.twoSidedLighting;
          tinted.alpha = original.alpha;
          tinted.transparencyMode = original.transparencyMode;
          tinted.useAlphaFromAlbedoTexture = original.useAlphaFromAlbedoTexture;
          tinted.backFaceCulling = original.backFaceCulling;
          material = tinted;
        } else if (mesh.material instanceof StandardMaterial) {
          const original = mesh.material;
          const tinted = new StandardMaterial(`${tone.key}-${original.name}`, scene);
          tinted.diffuseColor = original.diffuseColor.multiply(tint);
          tinted.diffuseTexture = original.diffuseTexture;
          tinted.bumpTexture = original.bumpTexture;
          tinted.specularColor = original.specularColor.clone();
          tinted.backFaceCulling = original.backFaceCulling;
          material = tinted;
        } else {
          source.dispose();
          throw new Error(`Unsupported tinted material: ${mesh.material.name}`);
        }
        variant.materials.set(mesh.material, material);
      }
      source.material = material;
    }
    variant.sources.set(mesh, source);
    const distant = distantSources.get(mesh);
    if (distant) {
      source.useLODScreenCoverage = true;
      source.addLODLevel(.0012, sourceFor(distant, tone));
    }
    return source;
  }
  const nodes = [...container.transformNodes, ...container.meshes]
    .filter((node): node is TransformNode => node instanceof TransformNode);
  const roots = nodes.filter(node => node.name !== "__root__" &&
    (!node.parent || node.parent.name === "__root__"));
  const prefabs = new Map(roots.map(node => [node.name, node]));
  if (!prefabs.size) {
    container.dispose();
    throw new Error(`Empty model kit: ${url}`);
  }
  container.addAllToScene();
  const dimensions = new Map<string, { width: number; height: number; depth: number }>();
  for (const [name, prefab] of prefabs) {
    const children = [prefab, ...prefab.getChildMeshes()]
      .filter((node): node is Mesh => node instanceof Mesh && node.getTotalVertices() > 0);
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const mesh of children) {
      mesh.computeWorldMatrix(true);
      const box = mesh.getBoundingInfo().boundingBox;
      for (const [i, axis] of (["x", "y", "z"] as const).entries()) {
        min[i] = Math.min(min[i], box.minimumWorld[axis]);
        max[i] = Math.max(max[i], box.maximumWorld[axis]);
      }
    }
    dimensions.set(name, { width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] });
  }
  for (const mesh of container.meshes) {
    mesh.metadata = { ...mesh.metadata, assetTemplate: true };
    mesh.isPickable = false;
    // Instances inherit this setting from their source mesh; assigning it to
    // an individual instance has no effect in Babylon.
    mesh.receiveShadows = true;
    mesh.setEnabled(false);
  }
  for (const node of container.transformNodes) node.setEnabled(false);
  for (const [name, prefab] of prefabs) {
    if (name.endsWith("_distant")) continue;
    const distant = prefabs.get(name + "_distant");
    if (!distant) continue;
    const parts = (node: TransformNode) => [node, ...node.getChildMeshes()]
      .filter((part): part is Mesh => part instanceof Mesh && part.getTotalVertices() > 0);
    const lower = parts(distant);
    for (const part of parts(prefab)) {
      const low = lower.find(candidate => candidate.material === part.material);
      if (!low) continue;
      distantSources.set(part, low);
      // Screen coverage keeps detail tied to the visible model size across
      // desktop, phone, country view and native camera inspection.
      part.useLODScreenCoverage = true;
      part.addLODLevel(.0012, low);
    }
  }
  // A decorative library has no camera, scene lighting or game animation.
  for (const group of container.animationGroups) group.stop();
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cacheObserver.remove();
    for (const variant of variants.values()) {
      for (const source of variant.sources.values()) source.dispose(false, false);
      for (const material of variant.materials.values()) material.dispose(false, false);
    }
    variants.clear();
    container.dispose();
  };
  const cacheObserver = scene.onDisposeObservable.addOnce(() => {
    disposed = true;
    kits.delete(scene);
  });
  return {
    names: [...prefabs.keys()].filter(name => !name.endsWith("_distant")),
    bounds(name) {
      const bounds = dimensions.get(name);
      if (!bounds) throw new Error(`Unknown model ${name} in ${url}`);
      return bounds;
    },
    dispose,
    instantiate(name, parent, tone) {
      if (disposed || scene.isDisposed) throw new Error("Model kit disposed.");
      const source = prefabs.get(name);
      if (!source) throw new Error(`Unknown model ${name} in ${url}`);
      const root = new TransformNode(`asset-${name}-${serial++}`, scene);
      root.parent = parent ?? null;
      root.metadata = { authoredAsset: true, asset: name };
      const meshes: AbstractMesh[] = [];
      const duplicate = (node: TransformNode, targetParent: TransformNode,
        top: boolean): TransformNode => {
        const target = node instanceof Mesh && node.getTotalVertices() > 0
          ? sourceFor(node, tone).createInstance(`${node.name}-${serial++}`)
          : new TransformNode(`${node.name}-${serial++}`, scene);
        target.parent = targetParent;
        target.rotationQuaternion = Quaternion.Identity();
        if (top) {
          node.computeWorldMatrix(true).decompose(target.scaling,
            target.rotationQuaternion, target.position);
        } else {
          target.position.copyFrom(node.position);
          target.scaling.copyFrom(node.scaling);
          if (node.rotationQuaternion) target.rotationQuaternion.copyFrom(node.rotationQuaternion);
          else { target.rotationQuaternion = null; target.rotation.copyFrom(node.rotation); }
        }
        target.setEnabled(true);
        if (target instanceof TransformNode && "sourceMesh" in target) {
          const instance = target as AbstractMesh;
          instance.metadata = { authoredAsset: true, assetInstance: true, asset: name };
          instance.isPickable = false;
          instance.receiveShadows = true;
          meshes.push(instance);
        }
        for (const child of node.getChildren(undefined, true))
          if (child instanceof TransformNode) duplicate(child, target, false);
        return target;
      };
      duplicate(source, root, true);
      if (!meshes.length) { root.dispose(); throw new Error(`Model ${name} has no geometry.`); }
      return { root, meshes };
    },
  };
}
