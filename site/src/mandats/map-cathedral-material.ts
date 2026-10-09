import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";

const pluginName = "mandats-cathedral-limestone";

// The cathedral shares one atlas/material across stone, slate, iron and glass.
// Adjust stone chroma before lighting, with three colour operations and no new
// texture, light or uniform. Dark/cool albedo and the actual metal channel keep
// the roof, windows and iron in their authored colours.
class CathedralLimestone extends MaterialPluginBase {
  constructor(material: PBRMaterial) {
    super(material, pluginName, 200, {}, true, true);
    this.doNotSerialize = true;
  }

  override getClassName() { return "MandatsCathedralLimestone"; }

  override getCustomCode(shaderType: string) {
    if (shaderType !== "fragment") return null;
    return {
      // Babylon 9.30: both variables are in reflectivityBlock after the ORM
      // texture has supplied metallicRoughness.r, before its baseColor/lighting.
      CUSTOM_FRAGMENT_UPDATE_METALLICROUGHNESS: `
        float cathedralY = dot(surfaceAlbedo, vec3(.2126, .7152, .0722));
        float cathedralStone = smoothstep(.22, .36, cathedralY) *
          smoothstep(.018, .075, surfaceAlbedo.r - surfaceAlbedo.b) *
          (1.0 - smoothstep(.02, .08, metallicRoughness.r));
        vec3 cathedralWarm = surfaceAlbedo * vec3(1.08, 1.0, .76);
        cathedralWarm *= cathedralY /
          max(dot(cathedralWarm, vec3(.2126, .7152, .0722)), .001);
        surfaceAlbedo = mix(surfaceAlbedo, cathedralWarm, cathedralStone);
      `,
    };
  }
}

/** Applied only to the cathedral originals and their manually copied variants. */
export function prepareCathedralLimestone(material: PBRMaterial) {
  if (!material.pluginManager?.getPlugin(pluginName))
    new CathedralLimestone(material);
}
