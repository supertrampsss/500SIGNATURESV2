import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { Scene } from "@babylonjs/core/scene";

const grainUrl = new URL("./textures/land-leaf-grain.png", import.meta.url).href,
  pluginName = "mandats-canopy-grain", grains = new WeakMap<Scene, Texture>();

function canopyGrain(scene: Scene): Texture {
  const existing = grains.get(scene);
  if (existing) return existing;
  const texture = new Texture(grainUrl, scene, { invertY: false,
    samplingMode: Texture.TRILINEAR_SAMPLINGMODE });
  texture.name = "canopy-leaf-grain";
  texture.gammaSpace = false;
  texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.anisotropicFilteringLevel = 4;
  grains.set(scene, texture);
  scene.onDisposeObservable.addOnce(() => texture.dispose());
  return texture;
}

/** The same grain follows detailed/distant crowns and their tinted neighbours.
 * Green vertex colours select foliage; bark and mineral colours stay intact. */
class CanopyGrain extends MaterialPluginBase {
  private readonly grain: Texture;
  constructor(material: PBRMaterial) {
    super(material, pluginName, 210, {}, true, true);
    this.doNotSerialize = true;
    this.grain = canopyGrain(material.getScene());
  }
  override getClassName() { return "MandatsCanopyGrain"; }
  override getSamplers(samplers: string[]) { samplers.push("canopyGrainSampler"); }
  override getActiveTextures(textures: BaseTexture[]) { textures.push(this.grain); }
  override isReadyForSubMesh() { return this.grain.isReadyOrNotBlocking(); }
  override bindForSubMesh(buffer: UniformBuffer) { buffer.setTexture("canopyGrainSampler", this.grain); }
  override getCustomCode(shaderType: string) {
    if (shaderType !== "fragment") return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: "uniform sampler2D canopyGrainSampler;",
      CUSTOM_FRAGMENT_UPDATE_METALLICROUGHNESS: `
        float canopyMask = smoothstep(.015, .07, surfaceAlbedo.g - surfaceAlbedo.r) *
          smoothstep(.015, .07, surfaceAlbedo.g - surfaceAlbedo.b);
        #ifdef NORMAL
        vec3 canopyWeights = abs(vNormalW);
        #else
        vec3 canopyWeights = vec3(0.0, 1.0, 0.0);
        #endif
        canopyWeights /= max(canopyWeights.x + canopyWeights.y + canopyWeights.z, .001);
        vec3 canopyGrainValue = texture2D(canopyGrainSampler, vPositionW.zy * 3.6).rgb * canopyWeights.x +
          texture2D(canopyGrainSampler, vPositionW.xz * 3.6).rgb * canopyWeights.y +
          texture2D(canopyGrainSampler, vPositionW.xy * 3.6).rgb * canopyWeights.z;
        float canopyShade = dot(canopyGrainValue, vec3(.25, .5, .25));
        surfaceAlbedo *= mix(1.0, .85 + canopyShade * .32, canopyMask);
      `,
    };
  }
}

export function prepareCanopyMaterial(material: PBRMaterial) {
  if (!material.pluginManager?.getPlugin(pluginName)) new CanopyGrain(material);
}
