import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const dist = fileURLToPath(new URL('../dist/',import.meta.url));
const html = await readFile(dist+'mandats/index.html','utf8');
const entryAssets = [...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(m=>m[1]);
const core = ['/mandats/', '/mandats/methode/', '/mandats/manifest.webmanifest', '/mandats/icon-192.png', '/mandats/icon-512.png', ...entryAssets];
for (const asset of entryAssets) {
  const source = await readFile(dist+asset,'utf8');
  for (const m of source.matchAll(/(?:from\s*|import\s*)["']\.\/([^"']+\.js)["']/g)) core.push('/assets/'+m[1]);
  for (const m of source.matchAll(/url\(["']?(\/?(?:fonts|polices)\/[^)'" ]+)/g)) core.push('/'+m[1].replace(/^\//,''));
}
for (const name of await readdir(dist+'mandats/art')) if (name.endsWith('-768.webp')) core.push('/mandats/art/'+name);
const precache = [...new Set(core)];
const digest = createHash('sha256');
digest.update(await readFile(fileURLToPath(import.meta.url)));
for (const path of precache) digest.update(await readFile(dist+path.replace(/^\//,'')+(path.endsWith('/')?'index.html':'')));
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
 const key=gamePage?'/mandats/':methodPage?'/mandats/methode/':url.href;
 if(gamePage||methodPage){event.respondWith(fetch(request).catch(async()=>{const cached=await(await caches.open(CACHE)).match(key);return cached||new Response('Le jeu doit être préparé avec une connexion avant de jouer hors ligne.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}));return;}
 const lightArt=url.pathname.replace('-1536.webp','-768.webp');
 if(lightArt!==url.pathname&&URLS.has(new URL(lightArt,self.location.origin).href)){event.respondWith(fetch(request).catch(async()=>{const cached=await(await caches.open(CACHE)).match(lightArt);return cached||Response.error();}));return;}
 if(!URLS.has(url.href))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);return(await cache.match(key))||fetch(request);})());
});
`;
await writeFile(dist+'mandats/sw.js',worker);
console.log('Mandats hors connexion : '+precache.length+' ressources, version '+version);
