import type { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";

export interface CityMaterials {
  stone: StandardMaterial;
  pale: StandardMaterial;
  sand: StandardMaterial;
  brick: StandardMaterial;
  pink: StandardMaterial;
  slate: StandardMaterial;
  tile: StandardMaterial;
  ochreTile: StandardMaterial;
  glass: StandardMaterial;
  timber: StandardMaterial;
  copper: StandardMaterial;
  steel: StandardMaterial;
  cream: StandardMaterial;
  pavement: StandardMaterial;
  asphalt: StandardMaterial;
  markings: StandardMaterial;
  quay: StandardMaterial;
  paint: StandardMaterial;
  red: StandardMaterial;
  sail: StandardMaterial;
}

type Surface = { shade: number; height: number };
type SurfaceSampler = (x: number, y: number) => Surface;
type SurfaceTextures = { color: DynamicTexture; normal: DynamicTexture };

const SIZE = 256;
const TAU = Math.PI * 2;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const edge = (position: number, period: number) => Math.min(position % period, period - position % period);

function grain(x: number, y: number, seed: number) {
  let value = Math.imul(x + seed * 13, 374761393) ^ Math.imul(y + seed * 23, 668265263);
  value = Math.imul(value ^ value >>> 13, 1274126177);
  return ((value ^ value >>> 16) >>> 0) / 4294967295 - 0.5;
}

/** A very low contrast, periodic surface variation; it stays quiet at map scale. */
function patina(x: number, y: number, seed: number) {
  return Math.sin(TAU * (x * 3 + y) / SIZE + seed) * 0.009
    + Math.cos(TAU * (y * 5 - x * 2) / SIZE + seed * 0.7) * 0.006
    + grain(x, y, seed) * 0.013;
}

const limestone: SurfaceSampler = (x, y) => {
  const row = Math.floor(y / 32);
  const shifted = (x + row % 2 * 32) % SIZE;
  const block = Math.floor(shifted / 64);
  const distance = Math.min(edge(y, 32), edge(shifted, 64));
  const joint = clamp(distance / 1.3, 0, 1);
  const weathering = Math.cos(TAU * (x + y * 2) / SIZE) * 0.008;
  return {
    shade: 0.90 + joint * 0.064 + grain(block, row, 41) * 0.010
      + patina(x, y, 7) + weathering,
    height: 0.43 + joint * 0.064 + patina(x, y, 12) * 0.24,
  };
};

const brickwork: SurfaceSampler = (x, y) => {
  const row = Math.floor(y / 16);
  const shifted = (x + row % 2 * 16) % SIZE;
  const column = Math.floor(shifted / 32);
  const distance = Math.min(edge(y, 16), edge(shifted, 32));
  const joint = clamp(distance / 1.1, 0, 1);
  return {
    shade: 0.89 + joint * 0.067 + grain(column, row, 53) * 0.020
      + patina(x, y, 17),
    height: 0.43 + joint * 0.068 + patina(x, y, 3) * 0.35,
  };
};

const slateRoof: SurfaceSampler = (x, y) => {
  const row = Math.floor(y / 16);
  const shifted = (x + row % 2 * 16) % SIZE;
  const column = Math.floor(shifted / 32);
  const verticalJoint = clamp(edge(shifted, 32) / 1.15, 0, 1);
  const course = (y % 16) / 16;
  const bottomLip = clamp(edge(y, 16) / 1.3, 0, 1);
  return {
    shade: 0.88 + bottomLip * 0.058 + verticalJoint * 0.029
      + course * 0.014 + grain(column, row, 79) * 0.018 + patina(x, y, 29),
    height: 0.43 + bottomLip * 0.052 + verticalJoint * 0.024
      + course * 0.036 + patina(x, y, 31) * 0.12,
  };
};

const clayRoof: SurfaceSampler = (x, y) => {
  const row = Math.floor(y / 32);
  const column = Math.floor(x / 16);
  // Rounded channels give the tiles their character without painted dark stripes.
  const round = 0.5 + Math.cos(TAU * (x % 16) / 16) * 0.5;
  const course = clamp(edge(y, 32) / 1.6, 0, 1);
  return {
    shade: 0.91 + round * 0.037 + course * 0.028
      + grain(column, row, 97) * 0.017 + patina(x, y, 43),
    height: 0.43 + round * 0.087 + course * 0.033
      + patina(x, y, 47) * 0.13,
  };
};

function texture(scene: Scene, name: string) {
  const value = new DynamicTexture(name, { width: SIZE, height: SIZE }, scene, true,
    Texture.TRILINEAR_SAMPLINGMODE);
  value.wrapU = Texture.WRAP_ADDRESSMODE;
  value.wrapV = Texture.WRAP_ADDRESSMODE;
  value.anisotropicFilteringLevel = 4;
  value.hasAlpha = false;
  return value;
}

function surfaceTextures(scene: Scene, name: string, sample: SurfaceSampler): SurfaceTextures {
  const color = texture(scene, `city-${name}-color`);
  const normal = texture(scene, `city-${name}-normal`);
  const colorContext = color.getContext();
  const normalContext = normal.getContext();
  const colorImage = colorContext.getImageData(0, 0, SIZE, SIZE);
  const normalImage = normalContext.getImageData(0, 0, SIZE, SIZE);
  const heights = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const point = sample(x, y);
    const offset = (y * SIZE + x) * 4;
    const shade = Math.round(clamp(point.shade, 0.82, 1) * 255);
    colorImage.data[offset] = shade;
    colorImage.data[offset + 1] = shade;
    colorImage.data[offset + 2] = shade;
    colorImage.data[offset + 3] = 255;
    heights[y * SIZE + x] = point.height;
  }
  const height = (x: number, y: number) => heights[((y + SIZE) % SIZE) * SIZE + (x + SIZE) % SIZE];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const nx = (height(x - 1, y) - height(x + 1, y)) * 3.2;
    const ny = (height(x, y - 1) - height(x, y + 1)) * 3.2;
    const inverseLength = 1 / Math.sqrt(nx * nx + ny * ny + 1);
    const offset = (y * SIZE + x) * 4;
    normalImage.data[offset] = Math.round((nx * inverseLength * 0.5 + 0.5) * 255);
    normalImage.data[offset + 1] = Math.round((ny * inverseLength * 0.5 + 0.5) * 255);
    normalImage.data[offset + 2] = Math.round((inverseLength * 0.5 + 0.5) * 255);
    normalImage.data[offset + 3] = 255;
  }
  colorContext.putImageData(colorImage, 0, 0);
  normalContext.putImageData(normalImage, 0, 0);
  normal.gammaSpace = false;
  normal.level = 0.28;
  color.update(false);
  normal.update(false);
  return { color, normal };
}

/**
 * Shared architectural materials, created only when a real scene is built.
 * Four 256px colour/normal pairs are local and deterministic. Scene.dispose()
 * owns their lifetime; meshes never allocate individual materials or textures.
 */
export function createCityMaterials(scene: Scene): CityMaterials {
  const material = (name: string, hex: string) => {
    const value = new StandardMaterial(`city-${name}`, scene);
    value.diffuseColor = Color3.FromHexString(hex);
    value.specularColor = new Color3(0.04, 0.036, 0.03);
    value.specularPower = 28;
    return value;
  };
  const materials: CityMaterials = {
    stone: material("limestone", "#C8B895"),
    pale: material("pale-stucco", "#D9CDB4"),
    sand: material("ochre-stucco", "#DFC59C"),
    brick: material("brick", "#BB7B61"),
    pink: material("pink-brick", "#D49B80"),
    slate: material("slate-roofs", "#53616C"),
    tile: material("clay-roofs", "#B77452"),
    ochreTile: material("old-clay-roofs", "#C99063"),
    glass: material("glazing", "#315665"),
    timber: material("timber", "#6B5746"),
    copper: material("copper", "#8C9F8A"),
    steel: material("iron", "#637078"),
    cream: material("cornices", "#E0D2B2"),
    pavement: material("pavement", "#8E846B"),
    asphalt: material("asphalt", "#535D55"),
    markings: material("road-markings", "#C4B69A"),
    quay: material("quay-stone", "#91836C"),
    paint: material("ship-paint", "#F2EBDB"),
    red: material("red-details", "#B45440"),
    sail: material("canvas", "#F5EBD4"),
  };
  const stoneTextures = surfaceTextures(scene, "dressed-stone", limestone);
  const brickTextures = surfaceTextures(scene, "brickwork", brickwork);
  const slateTextures = surfaceTextures(scene, "slate", slateRoof);
  const clayTextures = surfaceTextures(scene, "clay", clayRoof);
  const finish = (surface: StandardMaterial, textures: SurfaceTextures) => {
    surface.diffuseTexture = textures.color;
    surface.bumpTexture = textures.normal;
  };
  finish(materials.stone, stoneTextures);
  finish(materials.quay, stoneTextures);
  finish(materials.brick, brickTextures);
  finish(materials.pink, brickTextures);
  finish(materials.slate, slateTextures);
  finish(materials.tile, clayTextures);
  finish(materials.ochreTile, clayTextures);
  materials.glass.specularColor = new Color3(0.34, 0.4, 0.43);
  materials.glass.specularPower = 96;
  materials.glass.emissiveColor = new Color3(0.012, 0.023, 0.029);
  materials.copper.specularColor = new Color3(0.21, 0.24, 0.18);
  materials.copper.specularPower = 64;
  materials.steel.specularColor = new Color3(0.23, 0.26, 0.28);
  materials.steel.specularPower = 72;
  materials.slate.specularColor = new Color3(0.08, 0.085, 0.09);
  materials.slate.specularPower = 48;
  materials.sail.backFaceCulling = false;
  return materials;
}
