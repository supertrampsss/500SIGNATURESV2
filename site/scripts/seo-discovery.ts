/** Publish a reading guide from the final built corpus, without a second URL inventory. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const sitemap = await readFile(dist + 'sitemap.xml', 'utf8');
const addresses = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]!);
if (!addresses.length || new Set(addresses).size !== addresses.length) throw new Error('Corpus SEO vide ou dupliqué.');
const origin = new URL(addresses[0]!).origin;
const decode = (value: string) => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(?:39|x27);/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const pages = new Map<string, { url: string; title: string; description: string }>();
for (const address of addresses) {
  const url = new URL(address);
  if (url.origin !== origin || url.search || url.hash || !url.pathname.endsWith('/')) throw new Error(`Adresse non canonique dans le guide IA : ${address}`);
  const html = await readFile(dist + url.pathname.slice(1) + 'index.html', 'utf8');
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1];
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1];
  if (canonical !== address || !title || !description || /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html)) throw new Error(`Page impropre au guide IA : ${address}`);
  pages.set(url.pathname, { url: address, title: decode(title).replace(/\s+[|·]\s+(?:500\s*signatures|Mandats)$/i, ''), description: decode(description) });
}

const groups: Array<[string, (path: string) => boolean]> = [
  ['Choisir un usage', path => ['/', '/bilan/', '/territoire/', '/salaires/', '/analyses/', '/questions/', '/mandats/', '/mandats/comprendre/'].includes(path)],
  ['Dossiers : analyses et graphiques sourcés', path => path.startsWith('/analyses/')],
  ['Réponses aux questions du quotidien', path => path.startsWith('/questions/')],
  ['Repères pour comprendre les arbitrages', path => path.startsWith('/mandats/comprendre/')],
  ['Sources, règles et projet', () => true],
];
const remaining = new Map(pages);
let guide = '# 500 Signatures\n\n> Lire les comptes publics de la France et des communes, comprendre les chiffres du quotidien et jouer un mandat politique simulé. Accès gratuit.\n\nLes pages ci-dessous contiennent les explications, les sources et les périmètres. Pour citer un chiffre, conserver son unité, sa période et la source liée. Les données observées, les calculs dérivés et les hypothèses de simulation sont distingués. Les valeurs et conséquences de Mandats sont fictives.\n\n';
for (const [heading, accepts] of groups) {
  const selection = [...remaining].filter(([path]) => accepts(path));
  if (!selection.length) continue;
  guide += `## ${heading}\n\n`;
  for (const [path, page] of selection) {
    guide += `- [${page.title.replace(/[\[\]]/g, '')}](${page.url}): ${page.description}\n`;
    remaining.delete(path);
  }
  guide += '\n';
}
guide += `Plan du site : ${origin}/sitemap.xml\n`;
await writeFile(dist + 'llms.txt', guide, 'utf8');

// Site identity matches the public project and its existing contact links.
const homePath = dist + 'index.html';
const home = await readFile(homePath, 'utf8');
const identity = { '@context': 'https://schema.org', '@graph': [
  { '@type': 'Organization', '@id': origin + '/#organisation', name: '500 Signatures', url: origin + '/', sameAs: ['https://github.com/supertrampsss/500SIGNATURESV2', 'https://x.com/500signaturesfr'] },
  { '@type': 'WebSite', '@id': origin + '/#site', name: '500 Signatures', url: origin + '/', inLanguage: 'fr-FR', description: pages.get('/')!.description, publisher: { '@id': origin + '/#organisation' } },
] };
await writeFile(homePath, home.replace('</head>', `<script type="application/ld+json">${JSON.stringify(identity).replace(/</g, '\\u003c')}</script>\n</head>`), 'utf8');
console.log(`Guide IA : ${pages.size} pages canoniques publiées dans llms.txt.`);
