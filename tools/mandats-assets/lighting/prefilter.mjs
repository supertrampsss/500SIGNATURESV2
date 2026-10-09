import { chromium } from '../../../site/node_modules/playwright/index.mjs';
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

// Start the site's Vite server first. This prepares an environment texture;
// it never runs or changes a game, and is not a browser validation of the map.
const origin = process.argv[2] ?? 'http://127.0.0.1:4179';
const source = new URL('./prefilter.html', import.meta.url).pathname;
const target = new URL('../../../site/public/mandats/models/daylight.env', import.meta.url);
const report = new URL('./prefilter-report.json', import.meta.url);
// Vite intentionally serves only the site root. Keep its allow list intact
// and stage the preparation page there for the lifetime of this command.
const staging = await mkdtemp(new URL('../../../site/.mandats-lighting-', import.meta.url).pathname);
let browser;
try {
  await copyFile(source, `${staging}/index.html`);
  await copyFile(new URL('./umhlanga_sunrise_1k.hdr', import.meta.url), `${staging}/umhlanga_sunrise_1k.hdr`);
  browser = await chromium.launch({ executablePath: process.env.MANDATS_CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', error => process.stderr.write(error.message + '\n'));
  const response = await page.goto(`${origin}/${basename(staging)}/index.html`, { waitUntil: 'domcontentloaded' });
  if (!response?.ok()) throw new Error(`Lighting preparation page: HTTP ${response?.status()}`);
  await page.waitForFunction(() => Boolean(window.lightingResult), undefined, { timeout: 60_000 });
  const bytes = await page.evaluate(() => window.lightingResult);
  if (!bytes?.length) throw new Error('The lighting prefilter returned no bytes.');
  const metadata = await page.evaluate(() => window.lightingMetadata);
  if (!metadata?.exportedHarmonics) throw new Error('The lighting prefilter returned no harmonics.');
  await writeFile(target, Buffer.from(bytes));
  await writeFile(report, JSON.stringify({ ...metadata, bytes: bytes.length }, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ bytes: bytes.length, source, target: target.pathname }) + '\n');
} finally {
  await browser?.close();
  await rm(staging, { recursive: true, force: true });
}
