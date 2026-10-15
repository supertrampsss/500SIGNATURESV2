import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

// Realistic failures were recorded first in docs/mandats-incidents-validation.md.
const KEY = '500signatures.mandats.v1';
const VERSION = Number(process.env.MANDATS_INCIDENT_VERSION ?? 14);
const cache = new Map();
async function stored(page) {
  const raw = await page.evaluate(key => localStorage.getItem(key), KEY);
  if (!raw) throw new Error('La sauvegarde adoptée a disparu.');
  if (!cache.has(raw)) {
    const module = new URL('../src/mandats/storage.ts', import.meta.url).href;
    cache.set(raw, JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e',
      `import{decode}from${JSON.stringify(module)};let raw='';for await(const c of process.stdin)raw+=c;process.stdout.write(JSON.stringify(decode(raw)));`], { input: raw, encoding: 'utf8' })));
  }
  return cache.get(raw);
}
async function importInputs(page, inputs) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/mandats/');
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'port-avant-crise.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(inputs)) });
  await expect(page.locator('#mandats')).toHaveAttribute('data-turn', String(inputs.choices.length));
}
async function importPort(page) {
  await importInputs(page, { version: VERSION, mode: 'national', seed: 1, ambition: 'equilibre',
    choices: Array.from({ length: 9 }, (_, turn) => `n11-${turn}-pressure-administration-maintain`) });
}
async function openFront(page, id) {
  const next = page.locator('[data-action="next-year"]');
  if (await next.count()) await next.click();
  const selector = `[data-action="story-select"][data-story-id="${id}"]`;
  let button = page.locator(selector).filter({ visible: true });
  if (!(await button.count())) {
    for (const details of await page.locator('details').filter({ has: page.locator(selector) }).all()) {
      if (!(await details.evaluate(element => element.open))) await details.locator(':scope > summary').click();
    }
    button = page.locator(selector).filter({ visible: true });
  }
  await button.first().click();
}
async function choose(page, suffix) {
  const before = await stored(page);
  await page.locator(`[data-action="choose"][data-choice="${suffix}"]:not([disabled]),[data-action="choose"][data-choice$="-${suffix}"]:not([disabled])`).click();
  await expect(page.locator('#mandats')).toHaveAttribute('data-turn', String(before.turn + 1));
  await page.keyboard.press('Escape');
  return stored(page);
}
async function maintain(page) { await openFront(page, 'pressure-administration'); return choose(page, 'maintain'); }
async function evidence(page, info, name) {
  const game = await stored(page);
  const path = info.outputPath(`${name}.json`);
  await writeFile(path, JSON.stringify({ version: game.version, seed: game.seed, choices: game.choices, pressure: game.pressure,
    projects: game.narrative.projects, votes: game.politics.votes, viewport: info.project.use.viewport }, null, 2));
  await info.attach(name, { path, contentType: 'application/json' });
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}

test('an ignored active port persists, feeds the transport backlog, and survives reload without time passing', async ({ page }, info) => {
  await importPort(page);
  const before = await stored(page);
  await openFront(page, 'port-bloque');
  expect((await stored(page)).pressure).toEqual(before.pressure);
  let game;
  for (let count = 0; count < 6; count++) game = await maintain(page);
  const incident = game.pressure.incidents?.find(item => item.id === 'port-bloque');
  expect(incident).toMatchObject({ status: 'active' });
  expect(game.narrative.retiredEvents ?? []).not.toContain('port-bloque');
  expect(game.pressure.sectors.transport.causes.some(cause => cause.kind === 'incident')).toBe(true);
  await openFront(page, 'port-bloque');
  await expect(page.locator('[data-map-incident]')).toBeVisible();
  await expect(page.locator('[data-map-incident]')).toContainText('Crise active');
  await expect(page.locator('[data-map-incident]')).toContainText(/1,6.*hypothèse de simulation/);
  const saved = await stored(page);
  await page.reload(); await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  expect((await stored(page)).pressure).toEqual(saved.pressure);
  expect((await stored(page)).turn).toBe(saved.turn);
  await evidence(page, info, 'port-ignore-persistant');
});

test('temporary reserves expire, then an adopted agreement waits for delivery before closing the disruption', async ({ page }, info) => {
  await importPort(page); await openFront(page, 'port-bloque');
  let game = await choose(page, 'reserves');
  expect(game.history.at(-1).vote?.passed).toBe(true);
  expect(game.pressure.incidents.find(item => item.id === 'port-bloque').status).toBe('contained');
  await openFront(page, 'port-bloque');
  await expect(page.locator('[data-map-incident]')).toContainText('Secours opérationnel');
  await expect(page.locator('[data-map-incident]')).toContainText(/0,4.*hypothèse de simulation/);
  await expect(page.locator('[data-action="choose"][data-choice$="-reserves"]')).toHaveCount(0);
  game = await maintain(page);
  expect(game.pressure.incidents.find(item => item.id === 'port-bloque').status).toBe('contained');
  game = await maintain(page);
  expect(game.pressure.incidents.find(item => item.id === 'port-bloque').status).toBe('active');
  await openFront(page, 'port-bloque'); game = await choose(page, 'accord');
  expect(game.history.at(-1).vote?.passed).toBe(true);
  expect(game.pressure.incidents.find(item => item.id === 'port-bloque').status).toBe('active');
  await openFront(page, 'port-bloque');
  await expect(page.locator('[data-action="choose"][data-choice$="-accord"]')).toHaveCount(0);
  game = await maintain(page);
  expect(game.pressure.incidents.find(item => item.id === 'port-bloque').status).toBe('resolved');
  expect(game.pressure.sectors.transport.backlog).toBeGreaterThan(0);
  await evidence(page, info, 'accord-port-livre');
});

test('a blocked cyber restoration survives a rejected repair, and abandoning it cancels capacity without curing the attack', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'The four projects cover incident reading and persistence; desktop follows both political branches.');
  const inputs = { version: VERSION, mode: 'national', seed: 0, ambition: 'equilibre', choices: [
    'pol-wealth-hospital-package', 'pol-coalition-compromise',
    ...Array.from({ length: 10 }, (_, index) => `n11-${index + 2}-pressure-administration-maintain`),
    'pol-scandal-publish', 'pol-censure-withdraw', 'n11-14-pressure-administration-maintain',
    'n11-15-cyber-hopital-restaurer', 'n11-16-pressure-administration-maintain', 'n11-17-pressure-administration-maintain',
  ] };
  await importInputs(page, inputs);
  let before = await stored(page);
  expect(before.narrative.projects.find(project => project.id === 'cyber-restauration').status).toBe('blocked');
  expect(before.pressure.incidents.find(item => item.id === 'cyber-hopital').status).toBe('active');
  const followup = await page.locator('[data-action="story-select"][data-story-id^="suivi-"]').first().getAttribute('data-story-id');
  await openFront(page, followup);
  const repair = await page.locator('[data-action="choose"][data-choice*="-reprendre-"]').getAttribute('data-choice');
  let game = await choose(page, repair);
  expect(game.history.at(-1).vote?.passed).toBe(false);
  expect(game.narrative.projects.find(project => project.id === 'cyber-restauration').status).toBe('blocked');
  expect(game.pressure.incidents.find(item => item.id === 'cyber-hopital').status).toBe('active');
  expect(game.pressure.sectors.health.capacity).toBe(before.pressure.sectors.health.capacity);
  await evidence(page, info, 'reprise-cyber-rejetee');

  // Import the same legal inputs to compare the alternative vote at that point.
  await importInputs(page, inputs); before = await stored(page);
  await openFront(page, followup);
  const abandon = await page.locator('[data-action="choose"][data-choice*="-abandonner-"]').getAttribute('data-choice');
  game = await choose(page, abandon);
  expect(game.history.at(-1).vote?.passed).toBe(true);
  expect(game.narrative.projects.find(project => project.id === 'cyber-restauration').status).toBe('withdrawn');
  expect(game.pressure.programmes.find(programme => programme.projectId === 'cyber-restauration').status).toBe('cancelled');
  expect(game.pressure.incidents.find(item => item.id === 'cyber-hopital').status).toBe('active');
  expect(game.pressure.sectors.health.capacity).toBe(before.pressure.sectors.health.capacity);
  await evidence(page, info, 'restauration-abandonnee-crise-presente');
});
