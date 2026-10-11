import { build } from '../../site/node_modules/esbuild/lib/main.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root=fileURLToPath(new URL('../../', import.meta.url));
const temporary=await mkdtemp(join(tmpdir(),'mandats-terrain-'));
try {
 const bundle=join(temporary,'terrain.mjs');
 await build({entryPoints:[resolve(root,'tools/mandats-assets/bake-terrain.ts')],bundle:true,platform:'node',format:'esm',outfile:bundle});
 execFileSync(process.execPath,[bundle,root],{cwd:root,stdio:'inherit'});
} finally { await rm(temporary,{recursive:true,force:true}); }
