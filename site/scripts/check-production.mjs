/** Contrôle HTTP public après déploiement : pages du plan du site, canoniques, anciennes adresses supprimées. */
const origin = new URL(process.env.SITE_URL ?? 'https://500signatures.fr').origin;
const failures = [];
const get = url => fetch(url, {redirect:'manual', signal:AbortSignal.timeout(15000)});
const sitemap = await (await get(origin+'/sitemap.xml')).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
if(!urls.length) failures.push('sitemap.xml vide');
for(const url of urls){
  const response = await get(url);
  const html = await response.text();
  if(response.status!==200) failures.push(`${url} : HTTP ${response.status}`);
  else if(!html.includes(`rel="canonical" href="${url}"`)) failures.push(`${url} : canonique absente`);
}
const recit = await (await get(origin+'/')).text();
if(!recit.includes('etape__gros')) failures.push('/ : le récit publié ne porte aucun chiffre');
// Paramètre unique : on vérifie le déploiement lui-même, pas une copie gardée par le cache du domaine.
const jeton = Date.now().toString(36);
for(const path of ['/bilan/','/territoire/','/analyses/','/mandats/jouer/']){
  const response = await get(`${origin}${path}?verification=${jeton}`);
  if(response.status!==404) failures.push(`${path} : HTTP ${response.status}, 404 attendu`);
}
if(failures.length){ console.error(failures.join('\n')); process.exit(1); }
console.log(`Production : ${urls.length} pages servies avec leur canonique, anciennes adresses supprimées.`);
