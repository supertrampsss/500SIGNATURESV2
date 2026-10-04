/** Contrôle HTTP public après déploiement. Aucune connexion ni donnée privée. */
const origin = new URL(process.env.SITE_URL ?? 'https://500signatures.fr').origin;
const publisherId = process.env.ADSENSE_PUBLISHER_ID;
const failures = [];
const pages = [];
const domainRedirects = [];
const get = url => fetch(url, {redirect:'manual', signal:AbortSignal.timeout(15000)});
const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1];
const canonical = html => [...html.matchAll(/<link\b[^>]*>/gi)]
  .map(m=>m[0]).filter(tag=>attribute(tag,'rel')==='canonical').map(tag=>attribute(tag,'href'));
const noindex = html => [...html.matchAll(/<meta\b[^>]*>/gi)].some(m=>
  /^(robots|googlebot)$/i.test(attribute(m[0],'name')??'') && /\bnoindex\b/i.test(attribute(m[0],'content')??''));
try {
  const sitemapResponse = await get(origin+'/sitemap.xml');
  if(sitemapResponse.status!==200) throw new Error(`sitemap.xml : HTTP ${sitemapResponse.status}`);
  const sitemap = await sitemapResponse.text();
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  if(!urls.length || new Set(urls).size!==urls.length) throw new Error('Sitemap vide ou dupliqué');
  if(publisherId) {
    if(!/^ca-pub-\d{16}$/.test(publisherId)) throw new Error('Identifiant AdSense attendu invalide');
    const adsResponse=await get(origin+'/ads.txt');
    const expected=`google.com, ${publisherId.slice(3)}, DIRECT, f08c47fec0942fa0`;
    if(adsResponse.status!==200 || !(await adsResponse.text()).split(/\r?\n/).some(line=>line.trim()===expected)) failures.push('ads.txt : compte AdSense absent ou incorrect');
    const homeResponse=await get(origin+'/');
    const homeHtml=await homeResponse.text();
    const account=[...homeHtml.matchAll(/<meta\b[^>]*>/gi)].map(m=>m[0]).find(tag=>attribute(tag,'name')==='google-adsense-account');
    if(!account || attribute(account,'content')!==publisherId) failures.push('Accueil : vérification AdSense absente ou incorrecte');
  }
  const robotsResponse = await get(origin+'/robots.txt');
  if(robotsResponse.status!==200 || !(await robotsResponse.text()).includes(`Sitemap: ${origin}/sitemap.xml`)) failures.push('robots.txt : sitemap non annoncé');
  for(let start=0;start<urls.length;start+=4) {
    await Promise.all(urls.slice(start,start+4).map(async url=>{
      const issues=[];
      try {
        const address=new URL(url);
        if(address.origin!==origin || address.search || address.hash) throw new Error('URL hors domaine ou paramétrée');
        const response=await get(url);
        const html=await response.text();
        if(response.status!==200) issues.push(`HTTP ${response.status}`);
        const canonicals=canonical(html);
        if(canonicals.length!==1 || canonicals[0]!==url) issues.push('Canonique différente ou absente');
        if(noindex(html)) issues.push('noindex');
        if(!/<title>[^<]+<\/title>/i.test(html) || !/<h1\b/i.test(html)) issues.push('Titre ou H1 absent');
        if(/<a\b[^>]*href=["']\/accueil\/?["']/i.test(html)) issues.push('Lien interne vers une ancienne adresse d’accueil');
        if(/<script\b[^>]*src=["'][^"']*(adsbygoogle|doubleclick)/i.test(html)) issues.push('Publicité chargée dans le HTML initial');
        if(response.headers.get('x-content-type-options')!=='nosniff') issues.push('En-tête nosniff absent');
        if(address.hostname==='500signatures.fr') {
          const alias=new URL(url);
          alias.hostname='www.500signatures.fr';
          const redirected=await get(alias);
          const location=redirected.headers.get('location');
          const valid=redirected.status===301 && location && new URL(location,alias).href===url;
          domainRedirects.push({url:alias.href,status:redirected.status,location,valid:Boolean(valid)});
          if(!valid) issues.push('www ne redirige pas directement en 301 vers cette page');
        }
      } catch(error) {issues.push(error.message);}
      pages.push({url,issues});
      failures.push(...issues.map(issue=>`${url} : ${issue}`));
    }));
  }
  const missing=await get(origin+'/__launch-audit-missing-page');
  if(missing.status!==404 || !noindex(await missing.text())) failures.push('La page inexistante ne répond pas 404/noindex');
  const legacy=await get(origin+'/simulateur');
  const destination=legacy.headers.get('location');
  if(![301,302,307,308].includes(legacy.status) || !destination || new URL(destination,origin).pathname!=='/mandats/') failures.push('Redirection historique /simulateur incorrecte');
  for(const path of ['/accueil','/accueil/']) {
    const response=await get(origin+path);
    const location=response.headers.get('location');
    if(response.status!==301 || !location || new URL(location,origin).href!==origin+'/') failures.push(`${path} : redirection canonique incorrecte`);
  }
  if(new URL(origin).hostname==='500signatures.fr') {
    const queryPath='/questions/hausse-prix-gaz/?utm_source=verification&lecture=gaz%20France';
    const response=await get('https://www.500signatures.fr'+queryPath);
    const location=response.headers.get('location');
    if(response.status!==301 || location!==origin+queryPath) failures.push('www : chemin ou paramètres perdus lors de la redirection');
  }
} catch(error) {failures.push(error.message);}
console.log(JSON.stringify({checkedAt:new Date().toISOString(),origin,checkedPages:pages.length,checkedDomainRedirects:domainRedirects.length,success:failures.length===0,failures,domainRedirects:domainRedirects.sort((a,b)=>a.url.localeCompare(b.url)),pages:pages.sort((a,b)=>a.url.localeCompare(b.url))},null,2));
if(failures.length) process.exitCode=1;
