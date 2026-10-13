import { Scene } from "@babylonjs/core/scene";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
const earthUrl = new URL("./textures/context-earth-grain.png", import.meta.url).href;
const normalUrl = new URL("./textures/context-rock-granules-normal.png", import.meta.url).href;

// Same RGBA8 maps and upload settings as the former runtime recipe.
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

export function contextMaterialTextures(scene: Scene) {
  const earth = surfaceTexture(scene, "context-earth-grain", earthUrl);
  const rockNormal = surfaceTexture(scene, "context-rock-granules-normal", normalUrl, false, .24);
  return { earth, rockNormal };
}
