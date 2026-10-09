// Bake the existing deterministic surface recipe; no engine or scene is created.
// Run from the repository root after `npm ci --prefix site`:
// node tools/mandats-assets/generate-land-textures.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, '../..');
const dependencyRoot = process.env.MANDATS_BAKE_DEPENDENCY_ROOT ?? repository;
const requireDependency = createRequire(join(dependencyRoot, 'site/package.json'));
const ts = requireDependency('typescript');
const { Texture } = await import(pathToFileURL(join(dependencyRoot,
  'site/node_modules/@babylonjs/core/Materials/Textures/texture.js')));
const recipePath = join(here, 'land-texture-recipe.ts');
const source = await readFile(recipePath, 'utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const recorded = [];
const RawTexture = {
  CreateRGBATexture(rgba, width, height, _scene, generateMipMaps, invertY, samplingMode) {
    const record = { rgba, width, height, generateMipMaps, invertY, samplingMode };
    recorded.push(record);
    return Object.assign(record, { gammaSpace: true, level: 1,
      uScale: 1, vScale: 1, wrapU: Texture.CLAMP_ADDRESSMODE,
      wrapV: Texture.CLAMP_ADDRESSMODE, anisotropicFilteringLevel: 4 });
  },
};
const recipeModule = { exports: {} };
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
const recipeRequire = name => {
  if (name === '@babylonjs/core/Materials/Textures/rawTexture') return { RawTexture };
  if (name === '@babylonjs/core/Materials/Textures/texture') return { Texture };
  throw new Error(`Unexpected recipe dependency: ${name}`);
};
new Function('require', 'exports', 'module', compiled)(
  recipeRequire, recipeModule.exports, recipeModule);
const maps = recipeModule.exports.landMaterialTextures(undefined);
if (Object.keys(maps).length !== recorded.length || recorded.length !== 8)
  throw new Error('The recipe must return all eight recorded surface maps.');

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1
    ? 0xedb88320 ^ value >>> 1 : value >>> 1;
  return value >>> 0;
});
function chunk(type, bytes) {
  const tag = Buffer.from(type), body = Buffer.concat([tag, bytes]);
  let crc = 0xffffffff;
  for (const byte of body) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
  const header = Buffer.alloc(4), footer = Buffer.alloc(4);
  header.writeUInt32BE(bytes.length); footer.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([header, body, footer]);
}
function png(record) {
  const { rgba, width, height } = record, row = width * 4;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // Straight-alpha RGBA8, no colour/profile chunks.
  const scanlines = Buffer.alloc(height * (row + 1));
  for (let y = 0; y < height; y++) {
    scanlines[y * (row + 1)] = 0;
    scanlines.set(rgba.subarray(y * row, (y + 1) * row), y * (row + 1) + 1);
  }
  const compressed = deflateSync(scanlines, { level: 9 });
  const decoded = inflateSync(compressed), reconstructed = Buffer.alloc(rgba.length);
  for (let y = 0; y < height; y++) {
    if (decoded[y * (row + 1)] !== 0) throw new Error('Unexpected PNG filter.');
    reconstructed.set(decoded.subarray(y * (row + 1) + 1,
      (y + 1) * (row + 1)), y * row);
  }
  if (!reconstructed.equals(Buffer.from(rgba))) throw new Error('PNG pixels differ.');
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

const directory = join(repository, 'site/src/mandats/textures');
await mkdir(directory, { recursive: true });
const manifest = { recipe: 'tools/mandats-assets/land-texture-recipe.ts',
  recipeSha256: sha(source), format: 'RGBA8 PNG; IHDR/IDAT/IEND only',
  noSceneOrEngineCreated: true, textures: [] };
for (const [key, record] of Object.entries(maps)) {
  if (record.generateMipMaps !== true || record.invertY !== false ||
    record.samplingMode !== Texture.TRILINEAR_SAMPLINGMODE)
    throw new Error(`Unexpected upload settings for ${key}.`);
  const bytes = png(record), file = `${record.name}.png`;
  await writeFile(join(directory, file), bytes);
  if (process.env.MANDATS_BAKE_RAW_DIRECTORY) {
    await mkdir(process.env.MANDATS_BAKE_RAW_DIRECTORY, { recursive: true });
    await writeFile(join(process.env.MANDATS_BAKE_RAW_DIRECTORY, `${record.name}.rgba`), record.rgba);
  }
  manifest.textures.push({ key, name: record.name,
    file: `site/src/mandats/textures/${file}`, width: record.width, height: record.height,
    rgbaSha256: sha(record.rgba), pngSha256: sha(bytes), pngBytes: bytes.length,
    generateMipMaps: record.generateMipMaps, invertY: record.invertY,
    samplingMode: record.samplingMode, gammaSpace: record.gammaSpace,
    level: record.level, uScale: record.uScale, vScale: record.vScale,
    wrapU: record.wrapU, wrapV: record.wrapV,
    anisotropicFilteringLevel: record.anisotropicFilteringLevel });
}
await writeFile(join(here, 'land-textures.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ recipeSha256: manifest.recipeSha256, textures: manifest.textures.length,
  rgbaBytes: recorded.reduce((sum, map) => sum + map.rgba.byteLength, 0),
  pngBytes: manifest.textures.reduce((sum, map) => sum + map.pngBytes, 0) }));
