import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MODEL_URLS } from '../src/mandats/map-model-revisions.ts';
const dist = fileURLToPath(new URL('../dist/',import.meta.url));
const html = await readFile(dist+'mandats/index.html','utf8') + await readFile(dist+'mandats/france/hiver/index.html','utf8');
const entryAssets = [...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(m=>m[1]);
const brandAssets = [...html.matchAll(/src="(\/brand\/[^" ]+)"/g)].map(m=>m[1]);
// These editorial images appear in the national game and its replay journey.
// Keep the full-resolution illustration set opt-in with the game cache; the
// generated service worker is only installed when the player requests offline use.
const cinemaArt = ['office', 'school', 'hospital', 'nation', 'chapter', 'legacy', 'energy', 'parliament', 'council', 'rupture']
  .map(name => `/mandats/art/${name}.webp`);
const core = [...brandAssets, '/mandats/', '/mandats/france/hiver/', '/mandats/art/winter-quarter-small.webp', '/mandats/art/winter-quarter.webp', ...cinemaArt, '/mandats/methode/', '/mandats/manifest.webmanifest', '/mandats/icon-192.png', '/mandats/icon-512.png', ...entryAssets];
// Follow the game's dependencies, including Babylon's local shader chunks.
const visited = new Set<string>();
for (let i=0; i<entryAssets.length; i++) {
  const asset=entryAssets[i];
  if(visited.has(asset))continue;
  visited.add(asset);
  const source = await readFile(dist+asset,'utf8');
  for (const m of source.matchAll(/(?:from\s*|import\s*)["']\.\/([^"']+\.js)["']/g)) { const path='/assets/'+m[1]; core.push(path); if(!visited.has(path))entryAssets.push(path); }
  for (const m of source.matchAll(/import\(["']\.\/([^"']+\.js)["']\)/g)) { const path='/assets/'+m[1]; core.push(path); if(!visited.has(path))entryAssets.push(path); }
  // Procedural surface PNGs are content-hashed Vite imports in these chunks.
  for (const m of source.matchAll(/["'](\/assets\/[^"']+\.(?:png|webp|jpe?g))["']/g)) core.push(m[1]);
  for (const m of source.matchAll(/url\(["']?(\/?(?:fonts|polices|mandats\/fonts)\/[^)'" ]+)/g)) core.push('/'+m[1].replace(/^\//,''));
}
for (const name of await readdir(dist+'mandats/art')) if (name.endsWith('-768.webp')) core.push('/mandats/art/'+name);
// The authored GLB kits embed their materials. Include any neighbouring local
// buffers and textures too, so the same 3D scene loads after an offline restart.
async function collectModels(directory: string): Promise<void> {
  for (const entry of await readdir(dist + directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await collectModels(path);
    else if (entry.isFile() && /\.(?:glb|gltf|bin|env|png|webp|jpe?g|ktx2|json)$/i.test(entry.name))
      core.push(Object.values(MODEL_URLS).find(url => url.split('?')[0] === '/' + path) ?? '/' + path);
  }
}
await collectModels('mandats/models');
const precache = [...new Set(core)];
const digest = createHash('sha256');
digest.update(await readFile(fileURLToPath(import.meta.url)));
for (const path of precache) {
  const pathname = path.split('?')[0];
  digest.update(await readFile(dist+pathname.replace(/^\//,'')+(pathname.endsWith('/')?'index.html':'')));
}
const version = digest.digest('hex').slice(0,16);
const worker = `/* Game-only, opt-in offline cache. Generated from built assets. */
const CACHE='mandats-offline-${version}';
const CORE=${JSON.stringify(precache)};
const URLS=new Set(CORE.map(path=>new URL(path,self.location.origin).href));
self.addEventListener('install',event=>event.waitUntil((async()=>{try{await(await caches.open(CACHE)).addAll(CORE);}catch(error){await caches.delete(CACHE);throw error;}})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=(await caches.keys()).filter(key=>key.startsWith('mandats-offline-'));for(const key of keys.slice(0,-2))if(key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 const gamePage=url.pathname==='/mandats/'||url.pathname==='/mandats/index.html';
 const methodPage=url.pathname==='/mandats/methode/'||url.pathname==='/mandats/methode/index.html';
 const winterPage=url.pathname==='/mandats/france/hiver/'||url.pathname==='/mandats/france/hiver/index.html';
 const key=winterPage?'/mandats/france/hiver/':gamePage?'/mandats/':methodPage?'/mandats/methode/':url.href;
 if(gamePage||methodPage||winterPage){event.respondWith(fetch(request).catch(async()=>{const cached=await(await caches.open(CACHE)).match(key);return cached||new Response('Le jeu doit être préparé avec une connexion avant de jouer hors ligne.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}));return;}
 const lightArt=url.pathname.replace('-1536.webp','-768.webp');
 if(lightArt!==url.pathname&&URLS.has(new URL(lightArt,self.location.origin).href)){event.respondWith(fetch(request).catch(async()=>{const cached=await(await caches.open(CACHE)).match(lightArt);return cached||Response.error();}));return;}
 if(!URLS.has(url.href))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);return(await cache.match(key))||fetch(request);})());
});
`;
await writeFile(dist+'mandats/sw.js',worker);
console.log('Mandats hors connexion : '+precache.length+' ressources, version '+version);
