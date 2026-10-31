import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { GUIDES } from '../src/mandats/content/guides.ts';
import { escape as e } from '../src/mandats/sharing.ts';
const dist = fileURLToPath(new URL('../dist/',import.meta.url));
const html = await readFile(dist+'mandats/index.html','utf8');
const method = await readFile(dist+'mandats/methode/index.html','utf8');
const sharedHeader = method.match(/<header class="[^"]*\bsite-header\b[^"]*">[\s\S]*?<\/header>/)![0];
const themeScripts = [...method.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map(m=>m[0]).join('');
const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map(m=>m[0]).join('');
const origin = 'https://500signatures.fr';
function page(title:string,description:string,path:string,body:string,schema:unknown) { return `<!doctype html><html lang="fr" data-theme="clair"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="index,follow"><title>${e(title)} · Mandats</title><meta name="description" content="${e(description)}"><link rel="canonical" href="${origin+path}"><meta property="og:type" content="article"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="${origin+path}"><meta name="twitter:card" content="summary">${styles}${themeScripts}<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script></head><body><a class="skip-link" href="#lecture">Aller au contenu</a>${sharedHeader}<main class="method-content" id="lecture">${body}</main><footer class="site-footer"><a href="/mandats/">Jouer</a><a href="/mandats/methode/">Règles et confidentialité</a><span>Rédaction assistée par IA · Sources précisées dans chaque guide</span></footer></body></html>`; }
const indexPath='/mandats/comprendre/';
await mkdir(dist+indexPath,{recursive:true});
const indexTitle='Comment jouer à Mandats, le jeu de simulation politique ?';
const indexDescription='Mandats est un jeu gratuit : cinq ans, vingt trimestres, un budget à faire voter et la rue à tenir. Découvrez les règles et les repères de finances publiques.';
const indexBody=`<nav aria-label="Fil d’Ariane"><a href="/">Accueil</a> / <a href="/mandats/jouer/">Mandats</a></nav>
<p class="eyebrow">LE JEU ET LES REPÈRES</p><h1>Comment jouer à Mandats ?</h1>
<p class="lead">Mandats est un jeu gratuit de simulation politique : dirigez la France pendant cinq ans. Chaque trimestre, deux dossiers à trancher, une grande réforme à négocier si vous le souhaitez, et à l’automne un budget à faire voter.</p>
<p>Chaque choix a un coût affiché avant de décider : déficit, opinion, majorité, tension sociale, services publics. Les réformes se négocient avec les groupes de l’Assemblée, en dépensant votre capital politique. Un déficit hors de contrôle, la rue ou trois censures peuvent mettre fin au mandat avant son terme.</p>
<p><a class="button primary" href="/mandats/jouer/">Commencer un mandat</a> · <a href="/mandats/methode/">Lire les règles détaillées</a></p>
<section><h2>Comprendre ce qui change après un choix</h2><p>Une mesure peut produire un effet immédiat et engager des conséquences différées. Un projet financé reste à mettre en place ; une promesse peut être tenue ou manquer son échéance. Les votes et les contraintes politiques comptent aussi dans la suite du scénario.</p><p>Les montants, les scores et les réactions de Mandats sont des hypothèses de jeu. Pour consulter des données observées, utilisez les <a href="/bilan/">comptes de la France</a>, la <a href="/territoire/">recherche d’une commune</a> et les <a href="/analyses/">dossiers sourcés</a>.</p></section>
<section><h2>Repères de finances publiques</h2><p>Ces guides expliquent des notions utilisées dans les arbitrages. Chaque page précise son périmètre et renvoie aux sources. Les exemples municipaux concernent le scénario historique du jeu. Le mandat communal est actuellement indisponible ; la campagne nationale reste accessible.</p><div class="guide-list">${GUIDES.map(g=>`<article><p class="eyebrow">${g.mode==='municipal'?'FINANCES LOCALES':'FINANCES NATIONALES'}</p><h3><a href="${indexPath+g.slug}/">${e(g.title)}</a></h3><p>${e(g.summary)}</p></article>`).join('')}</div></section>
<section aria-labelledby="mandats-questions"><h2 id="mandats-questions">Questions sur le jeu</h2>
<h3>Combien de temps dure un mandat ?</h3><p>Cinq ans, soit vingt trimestres. Le temps n’avance que lorsque vous avez tranché les dossiers du trimestre : comptez une vingtaine de minutes pour un mandat complet. La mise sous tutelle, la rue ou trois censures peuvent l’interrompre.</p>
<h3>Faut-il créer un compte ou payer ?</h3><p>Le jeu est gratuit et accessible sans compte. Votre partie est sauvegardée dans le navigateur et reprend là où vous l’avez laissée.</p>
<h3>Peut-on jouer hors connexion ?</h3><p>Oui, après avoir préparé le jeu hors connexion depuis ses règles, avec une connexion disponible. La copie téléchargée et la sauvegarde restent sur votre appareil.</p>
<h3>Les résultats sont-ils une prévision politique ou économique ?</h3><p>Les résultats décrivent le scénario fictif du jeu. Les séries statistiques publiées dans France et les dossiers documentent des observations, avec leurs propres sources et périodes. Elles se lisent séparément des résultats simulés.</p>
<h3>Peut-on comprendre les règles sans JavaScript ?</h3><p>Cette présentation, les guides et la <a href="/mandats/methode/">méthodologie</a> restent lisibles sans JavaScript. La partie interactive nécessite son activation.</p></section>`;
await writeFile(dist+indexPath+'index.html',page(indexTitle,indexDescription,indexPath,indexBody,{'@context':'https://schema.org','@type':'CollectionPage',name:indexTitle,description:indexDescription,url:origin+indexPath,hasPart:GUIDES.map(g=>({'@type':'Article',name:g.title,url:origin+indexPath+g.slug+'/'}))}));
for(const guide of GUIDES){
 const path=indexPath+guide.slug+'/';await mkdir(dist+path,{recursive:true});
 const scenario = {href:'/mandats/jouer/',label:'Jouer un mandat national'};
 const disponibilite = guide.mode==='municipal' ? '<p>Le mandat communal est actuellement indisponible. Vous pouvez retrouver les arbitrages de la campagne nationale dans le jeu public.</p>' : '';
 const body=`<nav aria-label="Fil d’Ariane"><a href="/mandats/jouer/">Mandats</a> / <a href="${indexPath}">Comprendre</a></nav><p class="eyebrow">REPÈRES SOURCÉS · ${guide.mode==='municipal'?'VILLE':'PAYS'}</p><h1>${e(guide.title)}</h1><p class="lead">${e(guide.summary)}</p>${guide.sections.map(s=>`<section><h2>${e(s.title)}</h2>${s.paragraphs.map(p=>`<p>${e(p)}</p>`).join('')}</section>`).join('')}<h2>Sources et périmètre</h2><ul>${guide.sources.map(s=>`<li><a href="${e(s.url)}">${e(s.title)}</a>${s.date?` · ${s.date}`:''}</li>`).join('')}</ul><p>Aucun paramètre de Mandats n’est une observation statistique. Ces repères n’ont pas valeur de conseil financier ou juridique.</p>${disponibilite}<a class="button primary" href="${scenario.href}">${scenario.label}</a><h2>Pour poursuivre</h2><ul>${GUIDES.filter(g=>g.slug!==guide.slug).map(g=>`<li><a href="${indexPath+g.slug}/">${e(g.title)}</a></li>`).join('')}</ul>`;
 await writeFile(dist+path+'index.html',page(guide.title,guide.summary,path,body,{'@context':'https://schema.org','@type':'Article',headline:guide.title,description:guide.summary,datePublished:'2026-09-05',dateModified:'2026-09-05',mainEntityOfPage:origin+path,citation:guide.sources.map(s=>s.url)}));
}
// Publish the actual guide URLs in the sitemap after the pages exist.
const sitemapPath = dist+'sitemap.xml';
const sitemap = await readFile(sitemapPath, 'utf8');
const guidePaths = [indexPath, ...GUIDES.map(g=>indexPath+g.slug+'/')];
const entries = guidePaths.filter(p=>!sitemap.includes(`<loc>${origin+p}</loc>`))
  .map(p=>`  <url><loc>${origin+p}</loc></url>`).join('\n');
if (entries) await writeFile(sitemapPath,sitemap.replace('</urlset>',entries+'\n</urlset>'),'utf8');
console.log('Mandats : guides sourcés publiés et ajoutés au sitemap.');
