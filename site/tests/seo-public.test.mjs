import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('SEO : le guide IA décrit exactement les pages canoniques réellement publiées', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'One HTTP audit of the shared built corpus.');
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const urls = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  const response = await request.get('/llms.txt');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/plain/);
  const guide = await response.text();
  const linked = [...guide.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(match => match[1]);
  expect([...linked].sort()).toEqual([...urls].sort());
  expect(new Set(linked).size).toBe(linked.length);
  const records = [];
  for (const url of urls) {
    const path = new URL(url).pathname;
    const result = await request.get(path, { maxRedirects: 0 });
    expect(result.status(), path).toBe(200);
    const html = await result.text();
    const metadata = await page.evaluate(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return { title: doc.title, description: doc.querySelector('meta[name="description"]')?.content,
        canonical: [...doc.querySelectorAll('link[rel="canonical"]')].map(link => link.getAttribute('href')),
        robots: doc.querySelector('meta[name="robots"]')?.content ?? '',
        schemas: [...doc.querySelectorAll('script[type="application/ld+json"]')].map(script => JSON.parse(script.textContent)),
        adScripts: [...doc.scripts].map(script => script.src).filter(src => /adsbygoogle|doubleclick/.test(src)) };
    }, html);
    expect(metadata.canonical, path).toEqual([url]);
    expect(metadata.title, path).toBeTruthy();
    expect(metadata.description, path).toBeTruthy();
    expect(metadata.robots, path).not.toContain('noindex');
    expect(result.headers()['x-robots-tag'] ?? '', path).not.toContain('noindex');
    expect(metadata.adScripts, path).toEqual([]);
    records.push({ url, status: result.status(), ...metadata });
  }
  expect(new Set(records.map(record => record.title)).size).toBe(records.length);
  const graph = records.find(record => new URL(record.url).pathname === '/').schemas.flatMap(schema => schema['@graph'] ?? []);
  expect(graph.find(entity => entity['@type'] === 'WebSite').url).toBe('https://500signatures.fr/');
  expect(graph.find(entity => entity['@type'] === 'Organization').sameAs).toContain('https://x.com/500signaturesfr');
  const path = info.outputPath('pages-et-guide-ia.json');
  await writeFile(path, JSON.stringify({ urls, guide, records }, null, 2));
  await info.attach('pages-et-guide-ia', { path, contentType: 'application/json' });
});

test('SEO : les aides d’usage restent accessibles sans JavaScript sur accueil et Ville', async ({ browser }, info) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: info.project.use.viewport,
    isMobile: Boolean(info.project.use.isMobile), hasTouch: Boolean(info.project.use.hasTouch) });
  const page = await context.newPage();
  try {
    for (const path of ['/', '/territoire/']) {
      await page.goto('http://127.0.0.1:4180' + path);
      await expect(page.locator('#navigation-principale a[href="/bilan/"]')).toBeVisible();
      await expect(page.locator('#navigation-principale a[href="/territoire/"]')).toBeVisible();
      await expect(page.locator('body')).toHaveAttribute('data-vue', path === '/' ? 'accueil' : 'territoire');
      const help = page.locator('.usage-faq:visible');
      await expect(help).toHaveCount(1);
      await expect(help).toBeVisible();
      const summary = help.locator('summary').first();
      await summary.focus();
      await page.keyboard.press('Enter');
      await expect(help.locator('details').first()).toHaveAttribute('open', '');
      await expect(help.locator('details').first().locator('p')).toBeVisible();
      const source = help.locator('a[href="/sources/"]').first();
      const sourceDetails = source.locator('xpath=ancestor::details');
      if (await sourceDetails.getAttribute('open') === null) await sourceDetails.locator('summary').click();
      await expect(source).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const image = info.outputPath((path === '/' ? 'accueil' : 'ville') + '-aide-sans-js.png');
      await help.screenshot({ path: image });
      await info.attach(path === '/' ? 'accueil-aide' : 'ville-aide', { path: image, contentType: 'image/png' });
      if (path === '/') await expect(page.locator('.story-door[href="/territoire/"]')).toBeVisible();
      else await expect(page.getByRole('combobox', { name: 'Rechercher une ville' })).toBeVisible();
    }
  } finally { await context.close(); }
});

test('SEO : le guide Mandats explique la campagne actuelle et ouvre le vrai jeu', async ({ page }, info) => {
  await page.goto('/mandats/comprendre/');
  await expect(page.getByRole('heading', { level: 1, name: 'Comment jouer à Mandats ?' })).toBeVisible();
  await expect(page.locator('.lead')).toContainText('30 décisions');
  await expect(page.locator('#mandats-questions')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('guide-mandats.png'), fullPage: true });
  await page.getByRole('link', { name: 'Commencer un mandat', exact: true }).click();
  await expect(page.locator('[data-mandate-map][data-renderer="illustrated"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Commencer un mandat', exact: true })).toBeVisible();
  await expect(page.locator('[data-map-canvas]')).toHaveCount(0);
});
