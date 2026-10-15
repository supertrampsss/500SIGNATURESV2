import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=new URL('../../',import.meta.url), sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(await readFile(new URL('site/public/mandats/models/terrain-survey.json',root),'utf8'));
for(const input of manifest.sourceInputs) {
 if(sha(await readFile(new URL(input.file,root)))!==input.sha256)
  throw Error(`Terrain survey is stale after ${input.file}. Run node tools/mandats-assets/bake-terrain.mjs from the repository root.`);
}
const bytes=await readFile(new URL('site/public/mandats/models/terrain-survey.bin.gz',root));
if(sha(bytes)!==manifest.sha256) throw Error('Terrain survey hash mismatch.');
const revision=await readFile(new URL('site/src/mandats/map-terrain-revision.ts',root),'utf8');
if(!revision.includes(`?v=${manifest.sha256.slice(0,16)}`)) throw Error('Terrain revision URL mismatch.');
console.log(`Terrain survey verified: ${manifest.meshes.length} real meshes, ${bytes.length} compressed bytes.`);
