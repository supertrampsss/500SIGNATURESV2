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
      CUSTOM_FRAGMENT_DEFINITIONS: `
        float cathedralStoneHash(vec2 p) {
          vec3 h = fract(vec3(p.xyx) * .1031);
          h += dot(h, h.yzx + 33.33);
          return fract((h.x + h.y) * h.z);
        }
      `,
      // Babylon 9.30: both variables are in reflectivityBlock after the ORM
      // texture has supplied metallicRoughness.r, before its baseColor/lighting.
      CUSTOM_FRAGMENT_UPDATE_METALLICROUGHNESS: `
        float cathedralY = dot(surfaceAlbedo, vec3(.2126, .7152, .0722));
        float cathedralStone = smoothstep(.14, .30, cathedralY) *
          smoothstep(.018, .075, surfaceAlbedo.r - surfaceAlbedo.b) *
          (1.0 - smoothstep(.02, .08, metallicRoughness.r));
        vec3 cathedralWarm = surfaceAlbedo * vec3(1.14, 1.0, .68);
        cathedralWarm *= cathedralY /
          max(dot(cathedralWarm, vec3(.2126, .7152, .0722)), .001);
        surfaceAlbedo = mix(surfaceAlbedo, cathedralWarm, cathedralStone);
        #ifdef NORMAL
        vec3 cathedralNormal = abs(vNormalW);
        #else
        vec3 cathedralNormal = vec3(1.0, 0.0, 0.0);
        #endif
        // Small ashlar courses belong to the existing stone surface. The
        // atlas and metal channel keep slate, windows and iron outside them.
        float cathedralCourse = vPositionW.y * 82.0;
        float cathedralRow = floor(cathedralCourse);
        float cathedralAlong = mix(vPositionW.x, vPositionW.z,
          cathedralNormal.x / max(cathedralNormal.x + cathedralNormal.z, .001)) * 46.0;
        cathedralAlong += mod(cathedralRow, 2.0) * .5;
        float cathedralBed = 1.0 - smoothstep(.025, .10,
          min(fract(cathedralCourse), 1.0 - fract(cathedralCourse)));
        float cathedralJoint = 1.0 - smoothstep(.025, .09,
          min(fract(cathedralAlong), 1.0 - fract(cathedralAlong)));
        float cathedralBlock = cathedralStoneHash(vec2(floor(cathedralAlong), cathedralRow));
        float cathedralWall = 1.0 - smoothstep(.68, .90, cathedralNormal.y);
        surfaceAlbedo *= 1.0 - cathedralStone * cathedralWall *
          (max(cathedralBed * .13, cathedralJoint * .10) + (1.0 - cathedralBlock) * .055);
      `,
    };
  }
}

/** Applied only to the cathedral originals and their manually copied variants. */
export function prepareCathedralLimestone(material: PBRMaterial) {
  if (!material.pluginManager?.getPlugin(pluginName))
    new CathedralLimestone(material);
}
