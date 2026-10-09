import { Scene } from "@babylonjs/core/scene";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";

// Local, repeating material grain. These are surface maps, not scene illustrations.
function hash(x: number, y: number) {
  let value = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}
function noise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const tx = fx * fx * (3 - 2 * fx),
    ty = fy * fy * (3 - 2 * fy);
  const top = hash(ix, iy) * (1 - tx) + hash(ix + 1, iy) * tx;
  const bottom = hash(ix, iy + 1) * (1 - tx) + hash(ix + 1, iy + 1) * tx;
  return top * (1 - ty) + bottom * ty;
}
function pixels(
  scene: Scene,
  name: string,
  size: number,
  paint: (x: number, y: number) => [number, number, number],
) {
  const rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const color = paint(x, y),
        index = (y * size + x) * 4;
      rgba[index] = Math.max(0, Math.min(255, Math.round(color[0])));
      rgba[index + 1] = Math.max(0, Math.min(255, Math.round(color[1])));
      rgba[index + 2] = Math.max(0, Math.min(255, Math.round(color[2])));
      rgba[index + 3] = 255;
    }
  const texture = RawTexture.CreateRGBATexture(
    rgba,
    size,
    size,
    scene,
    true,
    false,
    Texture.TRILINEAR_SAMPLINGMODE,
  );
  texture.name = name;
  texture.anisotropicFilteringLevel = 4;
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  return texture;
}
function normal(
  scene: Scene,
  name: string,
  size: number,
  height: (x: number, y: number) => number,
  amount: number,
) {
  const texture = pixels(scene, name, size, (x, y) => {
    const dx = (height(x - 1, y) - height(x + 1, y)) * amount;
    const dy = (height(x, y - 1) - height(x, y + 1)) * amount;
    const length = Math.hypot(dx, dy, 1);
    return [
      128 + (dx / length) * 127,
      128 + (dy / length) * 127,
      128 + 127 / length,
    ];
  });
  texture.level = 0.55;
  texture.gammaSpace = false;
  return texture;
}

function periodicNoise(x: number, y: number, period: number) {
  const ix = Math.floor(x), iy = Math.floor(y),
    fx = x - ix, fy = y - iy,
    tx = fx * fx * (3 - 2 * fx), ty = fy * fy * (3 - 2 * fy),
    wrap = (value: number) => ((value % period) + period) % period,
    a = hash(wrap(ix), wrap(iy)), b = hash(wrap(ix + 1), wrap(iy)),
    c = hash(wrap(ix), wrap(iy + 1)), d = hash(wrap(ix + 1), wrap(iy + 1));
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

function mineralTextures(scene: Scene) {
  const size = 1024, heights = new Float32Array(size * size),
    tones = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size,
      coarse = periodicNoise(u * 7 + 2.1, v * 7 + 4.7, 7),
      fine = periodicNoise(u * 127 + 8.3, v * 127 + 13.2, 127),
      warp = periodicNoise(u * 5 + 1.9, v * 5 + 3.1, 5) - .5,
      phase = (v * 9 + u * 2 + warp * .34) * Math.PI * 2,
      bedding = .5 + .5 * Math.sin(phase),
      seam = Math.max(0, 1 - Math.abs(Math.sin(phase)) * 9),
      fractureField = periodicNoise(u * 12 + warp * .8 + 7.1,
        v * 12 + warp * .8 + 2.4, 12),
      fracture = Math.max(0, 1 - Math.abs(fractureField - .48) / .018),
      grain = hash(x, y) - .5, index = y * size + x;
    // Sediment and local mineral joints vary the surface reflectance. They
    // contain no direction of illumination or baked scene shadow.
    tones[index] = 249 + (fine - .5) * 7 + grain * 2 + (coarse - .5) * 5 -
      seam * 19 - fracture * 45;
    heights[index] = .5 + coarse * .13 + bedding * .012 - seam * .034 -
      fracture * .11 + fine * .022 + grain * .004;
  }
  const rock = pixels(scene, "land-mineral-rock", size, (x, y) => {
    const tone = tones[y * size + x];
    return [tone, tone, tone];
  });
  rock.gammaSpace = true;
  const rockNormal = normal(scene, "land-mineral-normal", size, (x, y) =>
    heights[((y + size) % size) * size + (x + size) % size], 7);
  rockNormal.level = .48;
  return { rock, rockNormal };
}

export function landMaterialTextures(scene: Scene) {
  const earth = pixels(scene, "land-earth-grain", 1024, (x, y) => {
    const fibers =
      noise(x * 0.18, y * 0.035) * 0.30 +
      noise(x * 0.045, y * 0.058) * 0.30 +
      hash(x, y) * 0.40;
    const tone = 172 + fibers * 82;
    return [tone, tone + 2, tone - 6];
  });
  const earthNormal = normal(
    scene,
    "land-earth-normal",
    256,
    (x, y) => noise(x * 0.13, y * 0.13) * 0.55 + noise(x * 0.5, y * 0.5) * 0.22,
    1.6,
  );
  earthNormal.uScale = 8;
  earthNormal.vScale = 8;
  const leaves = pixels(scene, "land-leaf-grain", 256, (x, y) => {
    const clusters = noise(x * 0.11, y * 0.12);
    const tiny = noise(x * 0.6, y * 0.38);
    const vein = Math.max(0, 1 - Math.abs(Math.sin(x * 0.47 + y * 0.29)) * 4);
    const tone = 189 + clusters * 42 + tiny * 15 + vein * 8;
    return [tone - 3, tone + 5, tone - 5];
  });
  const leafNormal = normal(
    scene,
    "land-leaf-normal",
    256,
    (x, y) => noise(x * 0.18, y * 0.18) * 0.7 + noise(x * 0.75, y * 0.44) * 0.2,
    2.5,
  );
  const stoneNormal = normal(
    scene,
    "land-stone-normal",
    256,
    (x, y) => noise(x * 0.035, y * 0.4) * 0.5 + noise(x * 0.22, y * 0.29) * 0.4,
    2.3,
  );
  stoneNormal.uScale = 6;
  stoneNormal.vScale = 6;
  const { rock, rockNormal } = mineralTextures(scene);
  return { earth, earthNormal, leaves, leafNormal, stoneNormal, rock, rockNormal };
}
export type LandMaterialTextures = ReturnType<typeof landMaterialTextures>;
