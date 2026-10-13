import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";

/** Grain belongs to the mineral volumes; it never paints foliage or buildings. */
class MiniatureMineral extends MaterialPluginBase {
  constructor(material: StandardMaterial, private readonly snow: boolean,
    private readonly coastal: boolean) {
    super(material, "mandats-weathered-mineral", 200, {}, true, true);
    this.doNotSerialize = true;
  }

  override getClassName() { return "MandatsWeatheredMineral"; }

  // The two rock surfaces share their shader code. A per-material constant
  // selects the existing coastal formula without compiling a second program.
  override getUniforms() {
    return {
      ubo: [{ name: "miniatureCoastal", size: 1, type: "float" }],
      fragment: "#ifndef UNIFORMBUFFERS\nuniform float miniatureCoastal;\n#endif",
    };
  }

  override bindForSubMesh(buffer: UniformBuffer) {
    buffer.updateFloat("miniatureCoastal", this.coastal ? 1 : 0);
  }

  override getCustomCode(shaderType: string) {
    if (shaderType !== "fragment") return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `
        float miniatureMineralHash(vec2 p) {
          vec3 h = fract(vec3(p.xyx) * .1031);
          h += dot(h, h.yzx + 33.33);
          return fract((h.x + h.y) * h.z);
        }
        float miniatureMineralNoise(vec2 p) {
          vec2 c = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(miniatureMineralHash(c), miniatureMineralHash(c + vec2(1.0, 0.0)), f.x),
            mix(miniatureMineralHash(c + vec2(0.0, 1.0)), miniatureMineralHash(c + vec2(1.0)), f.x), f.y);
        }
      `,
      CUSTOM_FRAGMENT_BEFORE_LIGHTS: `
        vec2 mineralPlane = vec2(vPositionW.x * .73 + vPositionW.z * .32,
          vPositionW.y * 1.4 + vPositionW.z * .17);
        float mineralBroad = miniatureMineralNoise(mineralPlane * 13.0);
        float mineralGrain = miniatureMineralNoise(mineralPlane * 61.0);
        float mineralWarp = miniatureMineralNoise(mineralPlane * 24.0 + vec2(13.0, 7.0));
        float mineralBed = sin(vPositionW.y * 139.0 + vPositionW.z * 13.0 + mineralWarp * 5.0);
        float mineralJoint = smoothstep(.91, .997, mineralBed) *
          smoothstep(.38, .65, mineralBroad);
        baseColor.rgb *= ${this.snow ? ".91 + mineralBroad * .12 + mineralGrain * .04" : ".78 + mineralBroad * .27 + mineralGrain * .09"};
        ${this.snow ? `
          float mineralScarp = (1.0 - smoothstep(.28, .68, abs(normalW.y))) *
            smoothstep(.42, .66, mineralBroad + mineralWarp * .15);
          vec3 mineralExposed = mix(vec3(.38, .37, .34), vec3(.66, .63, .55), mineralBroad);
          // Ground vertex colours already retain the exposed rock between
          // neves. Keep this smaller grain from turning snowy faces grey again.
          baseColor.rgb = mix(baseColor.rgb, mineralExposed, mineralScarp * .12);
          // Thin fissures and inclined exposed ribs stay on the real surface,
          // giving broad neves a smaller scale without separate floating rocks.
          float mineralSnowRib = smoothstep(.60, .85, mineralWarp) *
            (1.0 - smoothstep(.63, .96, abs(normalW.y))) * .15;
          baseColor.rgb = mix(baseColor.rgb, mineralExposed, mineralSnowRib);
          float mineralFissure = smoothstep(.93, .998,
            sin((vPositionW.x * .73 + vPositionW.z * .41) * 67.0 +
              vPositionW.y * 31.0 + mineralWarp * 4.0)) *
            smoothstep(.43, .66, mineralBroad) *
            (1.0 - smoothstep(.80, .98, abs(normalW.y)));
          baseColor.rgb *= 1.0 - mineralFissure * .14;
        ` : `
          float mineralCrease = smoothstep(.94, .998,
            sin(mineralPlane.x * 43.0 - mineralPlane.y * 21.0 + mineralWarp * 3.0)) *
            smoothstep(.44, .67, mineralBroad);
          if (miniatureCoastal > .5) {
            float mineralVertical = smoothstep(.94, .998,
              sin(vPositionW.x * 87.0 + vPositionW.z * 61.0 +
                mineralWarp * 5.5 + vPositionW.y * 11.0)) *
              smoothstep(.46, .70, mineralBroad);
            baseColor.rgb *= 1.0 - max(mineralJoint * .18, mineralVertical * .36);
          } else {
            baseColor.rgb *= 1.0 - max(mineralJoint * .17, mineralCrease * .16);
          }
        `}
      `,
    };
  }
}

export function prepareMineralSurface(material: StandardMaterial, snow = false, coastal = false) {
  if (!material.pluginManager?.getPlugin("mandats-weathered-mineral"))
    new MiniatureMineral(material, snow, coastal);
}

/** Fine soil variation stays attached to the real ground when the camera moves. */
class MiniatureSoil extends MaterialPluginBase {
  constructor(material: StandardMaterial) {
    super(material, "mandats-meadow-soil", 200, {}, true, true);
    this.doNotSerialize = true;
  }

  override getClassName() { return "MandatsMeadowSoil"; }

  override getCustomCode(shaderType: string) {
    if (shaderType !== "fragment") return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `
        float miniatureSoilHash(vec2 p) {
          vec3 h = fract(vec3(p.xyx) * .1031);
          h += dot(h, h.yzx + 33.33);
          return fract((h.x + h.y) * h.z);
        }
        float miniatureSoilNoise(vec2 p) {
          vec2 c = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(miniatureSoilHash(c), miniatureSoilHash(c + vec2(1.0, 0.0)), f.x),
            mix(miniatureSoilHash(c + vec2(0.0, 1.0)), miniatureSoilHash(c + vec2(1.0)), f.x), f.y);
        }
      `,
      CUSTOM_FRAGMENT_BEFORE_LIGHTS: `
        float soilPatch = miniatureSoilNoise(vPositionW.xz * 8.0);
        float soilGrain = miniatureSoilNoise(vPositionW.xz * 119.0);
        float soilStubble = miniatureSoilNoise(vPositionW.xz * vec2(57.0, 93.0));
        baseColor.rgb *= .83 + soilPatch * .22 + soilGrain * .12;
        baseColor.rgb = mix(baseColor.rgb, baseColor.rgb * vec3(1.06, .96, .79),
          smoothstep(.62, .84, soilStubble) * .22);
      `,
    };
  }
}

export function prepareMeadowSurface(material: StandardMaterial) {
  if (!material.pluginManager?.getPlugin("mandats-meadow-soil"))
    new MiniatureSoil(material);
}
