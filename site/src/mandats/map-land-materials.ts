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

type SurfaceGrain = {
  x: number; y: number; cosine: number; sine: number;
  length: number; width: number; bend: number; slender: boolean;
};
// Jittered, finite particles give clods and bent fibres a physical footprint.
// Their wrapped seeds make the albedo and its paired normal tile seamlessly.
function surfaceGrains(period: number, slenderFraction: number) {
  const seeds: SurfaceGrain[] = [];
  for (let y = 0; y < period; y++) for (let x = 0; x < period; x++) {
    const angle = hash(x + 43, y + 97) * Math.PI * 2,
      slender = hash(x + 211, y - 41) < slenderFraction;
    seeds.push({ x: .18 + hash(x + 137, y + 79) * .64,
      y: .18 + hash(x + 191, y + 17) * .64,
      cosine: Math.cos(angle), sine: Math.sin(angle), slender,
      length: slender ? .24 + hash(x + 251, y + 107) * .21 : .18 + hash(x + 71, y + 23) * .13,
      width: slender ? .034 + hash(x - 29, y + 67) * .025 : .14 + hash(x + 11, y + 181) * .13,
      bend: (hash(x + 307, y + 53) - .5) * (slender ? .38 : .07) });
  }
  const wrap = (value: number) => ((value % period) + period) % period;
  return (u: number, v: number) => {
    const x = u * period, y = v * period, ix = Math.floor(x), iy = Math.floor(y);
    let clods = 0, fibres = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx, cy = iy + dy, seed = seeds[wrap(cy) * period + wrap(cx)],
        px = x - cx - seed.x, py = y - cy - seed.y;
      if (Math.abs(px) > .56 || Math.abs(py) > .56) continue;
      const along = px * seed.cosine + py * seed.sine,
        across = -px * seed.sine + py * seed.cosine - seed.bend * along * along,
        distance = (along / seed.length) ** 2 + (across / seed.width) ** 2;
      if (distance >= 1) continue;
      const grain = (1 - distance) ** 2;
      if (seed.slender) fibres = Math.max(fibres, grain);
      else clods = Math.max(clods, grain);
    }
    return { clods, fibres };
  };
}

function soilSample() {
  const aggregates = surfaceGrains(41, .12), stems = surfaceGrains(61, .82);
  return (u: number, v: number) => {
    const aggregate = aggregates(u, v), stem = stems(u, v),
      clods = aggregate.clods + stem.clods * .28,
      fibres = stem.fibres + aggregate.fibres * .22,
      pores = periodicNoise(u * 29 + 7.1, v * 29 + 3.7, 29) - .5,
      micro = periodicNoise(u * 127 + 23.8, v * 127 + 51.1, 127) - .5;
    return {
      // The carrier preserves the existing parcel palette and mean tint.
      tone: 227.1 + (clods - .10) * 13 - (fibres - .012) * 9 + pores * 4 + micro * 2,
      height: .5 + clods * .11 - fibres * .027 + pores * .018 + micro * .034,
    };
  };
}

function mineralTextures(scene: Scene) {
  const size = 1024, heights = new Float32Array(size * size),
    tones = new Float32Array(size * size),
    chips = surfaceGrains(29, .13), joints = surfaceGrains(13, .47);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size,
      coarse = periodicNoise(u * 7 + 2.1, v * 7 + 4.7, 7),
      fine = periodicNoise(u * 127 + 8.3, v * 127 + 13.2, 127),
      chip = chips(u, v), joint = joints(u, v),
      // Finite joints change direction from one grain to another. They do not
      // connect into closed rings or two crossing families of regular stripes.
      fracture = joint.fibres,
      grain = hash(x, y) - .5, index = y * size + x;
    tones[index] = 246.65 + (fine - .5) * 10 + grain * 2 + (coarse - .5) * 9 -
      fracture * 25 + (chip.clods - .08) * 7;
    heights[index] = .5 + coarse * .09 + chip.clods * .033 -
      fracture * .059 + fine * .028 + grain * .003;
  }
  const rock = pixels(scene, "land-mineral-rock", size, (x, y) => {
    const tone = tones[y * size + x];
    return [tone, tone, tone];
  });
  rock.gammaSpace = true;
  const rockNormal = normal(scene, "land-mineral-normal", size, (x, y) =>
    heights[((y + size) % size) * size + (x + size) % size], 7);
  rockNormal.level = .40;
  return { rock, rockNormal };
}

export function landMaterialTextures(scene: Scene) {
  const soil = soilSample(), soilHeights = new Float32Array(1024 * 1024);
  const earth = pixels(scene, "land-earth-grain", 1024, (x, y) => {
    const { tone, height } = soil(x / 1024, y / 1024);
    soilHeights[y * 1024 + x] = height;
    return [tone, tone + 1, tone - 4];
  });
  earth.gammaSpace = true;
  const earthNormal = normal(scene, "land-earth-normal", 512, (x, y) =>
    soilHeights[((y * 2 + 1024) % 1024) * 1024 + (x * 2 + 1024) % 1024], 3.1);
  // The normals describe those same particles, at precisely the same UV scale.
  // Previously the albedo was at 1 and unrelated nonperiodic normals at 8.
  earth.uScale = earth.vScale = 4;
  earthNormal.uScale = earthNormal.vScale = 4;
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
