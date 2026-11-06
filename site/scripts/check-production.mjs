/** Contrôle HTTP public après déploiement : pages du plan du site, canoniques, anciennes adresses supprimées. */
const origin = new URL(process.env.SITE_URL ?? 'https://500signatures.fr').origin;
const failures = [];
const titles = new Set();
const get = url => fetch(url, {redirect:'manual', signal:AbortSignal.timeout(15000)});
const sitemap = await (await get(origin+'/sitemap.xml')).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
if(!urls.length) failures.push('sitemap.xml vide');
for(const url of urls){
  const response = await get(url);
  const html = await response.text();
  if(response.status!==200) failures.push(`${url} : HTTP ${response.status}`);
  else if(!html.includes(`rel="canonical" href="${url}"`)) failures.push(`${url} : canonique absente`);
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  if(!title || titles.has(title)) failures.push(`${url} : titre absent ou dupliqué`);
  if(title) titles.add(title);
  if(!/<meta\s+name="description"\s+content="[^"]+"/i.test(html)) failures.push(`${url} : description absente`);
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  if(headings.length!==1 || !headings[0][1].replace(/<[^>]+>/g,'').trim()) failures.push(`${url} : titre principal absent ou multiple`);
  if(/noindex/i.test(response.headers.get('x-robots-tag') ?? '') || /<meta[^>]+name="robots"[^>]+content="[^"]*\bnoindex\b/i.test(html)) failures.push(`${url} : indexation interdite`);
}
const recit = await (await get(origin+'/')).text();
if(!recit.includes('etape__gros')) failures.push('/ : le récit publié ne porte aucun chiffre');
try {
  const website = JSON.parse(recit.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? '{}');
  if(website['@type']!=='WebSite' || website.name!=='500 Signatures' || website.url!==origin+'/') failures.push('/ : identité WebSite absente ou incohérente');
} catch { failures.push('/ : données structurées invalides'); }
const robots = await get(origin+'/robots.txt');
if(robots.status!==200 || !(await robots.text()).includes(`Sitemap: ${origin}/sitemap.xml`)) failures.push('robots.txt : sitemap absent ou inaccessible');
// Paramètre unique : on vérifie le déploiement lui-même, pas une copie gardée par le cache du domaine.
const jeton = Date.now().toString(36);
for(const path of ['/bilan/','/territoire/','/analyses/','/mandats/jouer/']){
  const response = await get(`${origin}${path}?verification=${jeton}`);
  if(response.status!==404) failures.push(`${path} : HTTP ${response.status}, 404 attendu`);
}
if(failures.length){ console.error(failures.join('\n')); process.exit(1); }
console.log(`Production : ${urls.length} pages indexables avec titre, description, H1 et canonique ; identité WebSite et sitemap conformes ; anciennes adresses supprimées.`);
