import { Scene } from "@babylonjs/core/scene";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
const earthUrl = new URL("./textures/land-earth-grain.png", import.meta.url).href;
const earthNormalUrl = new URL("./textures/land-earth-normal.png", import.meta.url).href;
const cropsUrl = new URL("./textures/land-crop-stalks.png", import.meta.url).href;
const leavesUrl = new URL("./textures/land-leaf-grain.png", import.meta.url).href;
const leafNormalUrl = new URL("./textures/land-leaf-normal.png", import.meta.url).href;
const stoneNormalUrl = new URL("./textures/land-stone-normal.png", import.meta.url).href;
const rockUrl = new URL("./textures/land-mineral-rock.png", import.meta.url).href;
const rockNormalUrl = new URL("./textures/land-mineral-normal.png", import.meta.url).href;
const coastNormalUrl = new URL("./textures/land-coastal-normal.png", import.meta.url).href;

// Byte-identical surface maps baked by tools/mandats-assets/generate-land-textures.mjs.
// Texture loading remains blocking for the existing scene.executeWhenReady gate.
function surfaceTexture(
  scene: Scene, name: string, url: string, gammaSpace = true,
  level = 1, uScale = 1, vScale = uScale,
) {
  const texture = new Texture(url, scene, {
    noMipmap: false,
    invertY: false,
    samplingMode: Texture.TRILINEAR_SAMPLINGMODE,
    format: 5, // Same RGBA8 format as RawTexture.CreateRGBATexture.
    useSRGBBuffer: false,
    gammaSpace,
  });
  texture.name = name;
  texture.anisotropicFilteringLevel = 4;
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.level = level;
  texture.uScale = uScale;
  texture.vScale = vScale;
  return texture;
}

export function landMaterialTextures(scene: Scene) {
  const earth = surfaceTexture(scene, "land-earth-grain", earthUrl, true, 1, 8);
  const crops = surfaceTexture(scene, "land-crop-stalks", cropsUrl, true, 1, 8);
  const earthNormal = surfaceTexture(scene, "land-earth-normal", earthNormalUrl, false, .55, 8);
  const leaves = surfaceTexture(scene, "land-leaf-grain", leavesUrl);
  const leafNormal = surfaceTexture(scene, "land-leaf-normal", leafNormalUrl, false, .55);
  const stoneNormal = surfaceTexture(scene, "land-stone-normal", stoneNormalUrl, false, .55, 6);
  const rock = surfaceTexture(scene, "land-mineral-rock", rockUrl);
  const rockNormal = surfaceTexture(scene, "land-mineral-normal", rockNormalUrl, false, .40);
  const coastNormal = surfaceTexture(scene, "land-coastal-normal", coastNormalUrl, false, .36);
  return { earth, earthNormal, crops, leaves, leafNormal, stoneNormal, rock, rockNormal, coastNormal };
}
export type LandMaterialTextures = ReturnType<typeof landMaterialTextures>;
