import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Retain the original diffuse irradiance and every lower prefiltered image.
// This repack never decodes or resamples pixels, or runs a game/browser.
const source = new URL('./daylight-prefiltered-256.env', import.meta.url),
  target = new URL('../../../site/public/mandats/models/daylight.env', import.meta.url),
  bytes = await readFile(source), headerEnd = bytes.indexOf(0, 8),
  original = JSON.parse(bytes.subarray(8, headerEnd).toString()),
  originalWidth = original.width, skip = 6;
if (originalWidth !== 256 || original.specular.mipmaps.length !== 54)
  throw Error('Expected the retained 256px, nine-level prefiltered cube.');
const header = structuredClone(original), body = [], preservedImages = [];
header.width = originalWidth / 2;
header.specular.mipmaps = [];
let position = 0;
for (const [index, mip] of original.specular.mipmaps.slice(skip).entries()) {
  const image = bytes.subarray(headerEnd + 1 + mip.position, headerEnd + 1 + mip.position + mip.length);
  if (image.length !== mip.length) throw Error('Invalid retained mipmap range.');
  header.specular.mipmaps.push({ length: image.length, position });
  body.push(image); position += image.length;
  preservedImages.push({ originalIndex: index + skip, sha256: createHash('sha256').update(image).digest('hex'), bytes: image.length });
}
const compact = Buffer.concat([bytes.subarray(0, 8), Buffer.from(JSON.stringify(header)), Buffer.from([0]), ...body]);
await writeFile(target, compact);
const report = {
  method: 'Binary repack of the retained prefiltered cube. Original diffuse irradiance coefficients and all 48 retained PNG images are unchanged, byte for byte. Only the six finest 256px images are omitted; no pixel resampling, shader override or game/camera manipulation.',
  source: source.pathname, sourceSHA256: createHash('sha256').update(bytes).digest('hex'),
  targetSHA256: createHash('sha256').update(compact).digest('hex'),
  sourceBytes: bytes.length, targetBytes: compact.length, sourceWidth: originalWidth, width: header.width,
  irradianceUnchanged: JSON.stringify(header.irradiance) === JSON.stringify(original.irradiance),
  lodGenerationScale: header.specular.lodGenerationScale,
  // getLodFromAlphaG uses log2(cubeWidth)*scale. The retained first image
  // was level one: compensate for the halved width and the removed level.
  lodOffset: header.specular.lodGenerationScale - 1,
  preservedImages,
};
await writeFile(new URL('./compact-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ bytes: compact.length, width: header.width, images: preservedImages.length,
  irradianceUnchanged: report.irradianceUnchanged, sha256: report.targetSHA256 }));
