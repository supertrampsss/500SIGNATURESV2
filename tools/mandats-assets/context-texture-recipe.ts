import { Scene } from "@babylonjs/core/scene";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (n: number) => n * n * (3 - 2 * n);
function hash(x: number, z: number) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function periodicMaterialNoise(x: number, z: number, period: number) {
  const ix = Math.floor(x), iz = Math.floor(z), tx = smooth(x - ix), tz = smooth(z - iz),
    wrap = (value: number) => ((value % period) + period) % period;
  return mix(
    mix(hash(wrap(ix), wrap(iz)), hash(wrap(ix + 1), wrap(iz)), tx),
    mix(hash(wrap(ix), wrap(iz + 1)), hash(wrap(ix + 1), wrap(iz + 1)), tx),
    tz,
  );
}

/** Exact deterministic context maps, baked outside the live game. */
export function contextMaterialTextures(scene: Scene) {
  const size = 512, rgba = new Uint8Array(size * size * 4),
    relief = new Float32Array(size * size), normals = new Uint8Array(size * size * 4);
  // Fractured mineral planes, rather than rounded noise lobes. Each local
  // plate covers about .097 source units; these are material normals only.
  const platePeriod = 23, plates = new Float32Array(platePeriod * platePeriod * 5),
    plateIndex = (x: number, z: number) => (((z % platePeriod + platePeriod) % platePeriod) *
      platePeriod + (x % platePeriod + platePeriod) % platePeriod) * 5;
  for (let z = 0; z < platePeriod; z++) for (let x = 0; x < platePeriod; x++) {
    const at = plateIndex(x, z);
    plates[at] = .18 + hash(x * 7 + 83, z * 11 + 17) * .64;
    plates[at + 1] = .18 + hash(x * 13 + 31, z * 5 + 71) * .64;
    plates[at + 2] = hash(x * 19 + 53, z * 17 + 29);
    plates[at + 3] = hash(x * 23 + 11, z * 13 + 47) - .5;
    plates[at + 4] = hash(x * 11 + 97, z * 19 + 3) - .5;
  }
  const platePlane = (at: number, x: number, z: number) => (plates[at + 2] - .5) * .10 +
    (x * plates[at + 3] + z * plates[at + 4]) * .75;
  function mineralSample(u: number, v: number) {
    const sx = u * platePeriod, sz = v * platePeriod, ix = Math.floor(sx), iz = Math.floor(sz);
    let first = Infinity, second = Infinity, firstAt = 0, secondAt = 0,
      firstX = 0, firstZ = 0, secondX = 0, secondZ = 0;
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
      const cx = ix + ox, cz = iz + oz, at = plateIndex(cx, cz),
        dx = sx - cx - plates[at], dz = sz - cz - plates[at + 1], distance = dx * dx + dz * dz;
      if (distance < first) {
        second = first; secondAt = firstAt; secondX = firstX; secondZ = firstZ;
        first = distance; firstAt = at; firstX = dx; firstZ = dz;
      } else if (distance < second) {
        second = distance; secondAt = at; secondX = dx; secondZ = dz;
      }
    }
    const gap = Math.sqrt(second) - Math.sqrt(first),
      middle = periodicMaterialNoise(u * 47 + 4.6, v * 47 + 17.7, 47),
      fine = periodicMaterialNoise(u * 127 + 41.5, v * 127 + 11.3, 127),
      blend = .5 + .5 * smooth(clamp(gap / .14)),
      slab = mix(platePlane(secondAt, secondX, secondZ), platePlane(firstAt, firstX, firstZ), blend),
      mineral = mix(plates[secondAt + 2], plates[firstAt + 2], blend),
      // Weathering interrupts the joints, avoiding a continuous paving grid.
      joint = (1 - smooth(clamp(gap / .085))) * smooth(clamp((middle - .28) / .44)),
      chips = smooth(clamp((fine - .60) / .30));
    return {
      relief: .5 + slab - joint * .085 + (middle - .5) * .02 + (fine - .5) * .028,
      shade: 226 + (mineral - .5) * 26 + (fine - .5) * 24 + chips * 9 - joint * 20,
    };
  }
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    const sample = mineralSample(x / size, z / size),
      shade = Math.max(0, Math.min(255, sample.shade)),
      at = (z * size + x) * 4;
    // Albedo describes mineral/soil variation, never a painted highlight.
    // Inclined slabs and broken joints respond to the scene's actual sunlight.
    relief[z * size + x] = sample.relief;
    rgba.set([shade, shade + 1, Math.max(0, shade - 3), 255], at);
  }
  const heightAt = (x: number, z: number) => relief[
    ((z + size) % size) * size + (x + size) % size];
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    const rawX = (heightAt(x - 1, z) - heightAt(x + 1, z)) * 8,
      rawZ = (heightAt(x, z - 1) - heightAt(x, z + 1)) * 8,
      attenuation = Math.max(1, Math.hypot(rawX, rawZ) / 1.1),
      dx = rawX / attenuation, dz = rawZ / attenuation,
      length = Math.hypot(dx, dz, 1), at = (z * size + x) * 4;
    normals.set([128 + dx / length * 127, 128 + dz / length * 127,
      128 + 127 / length, 255], at);
  }
  const materialTexture = (name: string, data: Uint8Array) => {
    const texture = RawTexture.CreateRGBATexture(data, size, size, scene, true, false,
      Texture.TRILINEAR_SAMPLINGMODE);
    texture.name = name;
    texture.anisotropicFilteringLevel = 4;
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    return texture;
  };
  const earth = materialTexture("context-earth-grain", rgba);
  const rockNormal = materialTexture("context-rock-granules-normal", normals);
  rockNormal.gammaSpace = false;
  rockNormal.level = .24;
  return { earth, rockNormal };
}
