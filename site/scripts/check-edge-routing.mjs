/** Vérification HTTP du build dans le runtime Cloudflare local, puis arrêt du serveur. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import http from 'node:http';

const port=4189;
const artifacts=new URL('../edge-artifacts/',import.meta.url);
await mkdir(artifacts,{recursive:true});
const server=spawn('npx',['--yes','wrangler@4.147.0','pages','dev','dist','--ip','127.0.0.1','--port',String(port),'--inspector-port','9298','--compatibility-date','2026-10-04','--show-interactive-dev-session=false'],{
  cwd:new URL('../',import.meta.url),detached:true,stdio:['ignore','pipe','pipe'],
  env:{...process.env,WRANGLER_SEND_METRICS:'false'},
});
let serverLog='';
server.stdout.on('data',data=>{serverLog+=data;});
server.stderr.on('data',data=>{serverLog+=data;});
const results=[];
const get=(path,host='500signatures.fr')=>new Promise((resolve,reject)=>{
  const request=http.get({host:'127.0.0.1',port,path,headers:{Host:host}},response=>{
    let body='';response.setEncoding('utf8');
    response.on('data',data=>{body+=data;});
    response.on('end',()=>resolve({status:response.statusCode,location:response.headers.location??null,headers:response.headers,body}));
  });
  request.setTimeout(5000,()=>request.destroy(new Error('HTTP local : délai dépassé')));
  request.on('error',reject);
});
let failure;
try {
  const deadline=Date.now()+120000;
  while(true){
    try{await get('/');break;}catch(error){
      if(server.exitCode!==null || Date.now()>deadline)throw new Error('Cloudflare local ne démarre pas : '+error.message);
      await new Promise(resolve=>setTimeout(resolve,500));
    }
  }
  const sitemap=await readFile(new URL('../dist/sitemap.xml',import.meta.url),'utf8');
  const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
  assert.ok(urls.length>0,'Sitemap publié vide');
  for(const url of urls){
    const path=new URL(url).pathname;
    const www=await get(path,'www.500signatures.fr');
    results.push({host:'www.500signatures.fr',path,status:www.status,location:www.location});
    assert.equal(www.status,301,path);
    assert.equal(www.location,url,path);
    const main=await get(path);
    results.push({host:'500signatures.fr',path,status:main.status});
    assert.equal(main.status,200,path);
    assert.equal(main.headers['x-content-type-options'],'nosniff',path);
    assert.ok(main.body.includes(url),path+' : canonique absente');
  }
  // Les anciennes pages sont supprimées (31 octobre 2026) : ni page, ni redirection.
  for(const path of ['/bilan/','/territoire/','/analyses/','/sources/','/accueil/','/mandats/jouer/','/simulateur/']){
    const response=await get(path);
    results.push({host:'500signatures.fr',path,status:response.status,location:response.location});
    assert.equal(response.status,404,path);
    assert.match(response.body,/noindex/i,path);
  }
  const asset=await get('/analytics-consent.js');
  assert.equal(asset.status,200,'Script de consentement statique conservé');
  assert.equal(asset.headers['x-content-type-options'],'nosniff');
  console.log(`Cloudflare local : ${urls.length} pages, redirections www, anciennes adresses en 404 et script statique conformes.`);
} catch(error){failure=error;process.exitCode=1;console.error(error);}
finally {
  await writeFile(new URL('http.json',artifacts),JSON.stringify({checkedAt:new Date().toISOString(),runtime:'Wrangler 4.147.0 local',port,success:!failure,error:failure?.message,results},null,2));
  await writeFile(new URL('server.log',artifacts),serverLog);
  try{process.kill(-server.pid,'SIGTERM');}catch{/* Le serveur est déjà arrêté. */}
}
