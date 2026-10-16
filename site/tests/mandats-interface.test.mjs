import { test, expect } from '@playwright/test';
import { writeFile, readFile } from 'node:fs/promises';

// The owner replaced the v14 first-full-card target with a tactical HUD. These
// unchanged visibility assertions protect explicit v13 legacy journeys. Original
// failure hypotheses precede these tests and the UI rework in
// docs/mandats-interface-rework.md. All game changes use public controls.
const KEY = '500signatures.mandats.v1';
const INPUTS = { version: 13, mode: 'national', seed: 0, ambition: 'equilibre', choices: [] };
const SECTORS = ['health', 'housing', 'transport', 'energy', 'education', 'administration'];

async function open(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/mandats/?mode=national&v=13&seed=0&ambition=equilibre');
  await expect(page.locator('[data-map-agenda]')).toBeVisible();
  await expect.poll(() => page.locator('[data-map-illustration]').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => document.fonts.ready);
}
async function inputs(page) {
  return page.evaluate(({ key, initial }) => JSON.parse(localStorage.getItem(key) || JSON.stringify(initial)), { key: KEY, initial: INPUTS });
}
async function capture(page, info, label) {
  const path = info.outputPath(`${label}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await info.attach(label, { path, contentType: 'image/png' });
  const pathInputs = info.outputPath(`${label}.json`);
  await writeFile(pathInputs, JSON.stringify({ browser: info.project.name, viewport: page.viewportSize(), url: page.url(), inputs: await inputs(page), geometry: await page.evaluate(() => {
    const rect = selector => { const element = document.querySelector(selector); if (!element) return null; const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, scrollTop: element.scrollTop }; };
    return { pageScrollY: window.scrollY, pageHeight: document.documentElement.scrollHeight, viewportHeight: innerHeight, agenda: rect('[data-map-agenda]'), subject: rect('[data-map-decision]'), title: rect('.map-subject h1'), firstAgenda: rect('.map-agenda [data-action="story-select"]'), firstChoice: rect('[data-action="choose"]'), footer: rect('.map-game__footer') };
  }) }, null, 2));
  await info.attach(`${label}-inputs`, { path: pathInputs, contentType: 'application/json' });
}
async function actionableWithoutScroll(locator) {
  await expect(locator).toBeVisible();
  // Verify both the complete card and a real unobstructed click point. A
  // Playwright click alone could silently scroll a hidden card into view.
  const result = await locator.evaluate(element => {
    const r = element.getBoundingClientRect();
    const footer = document.querySelector('.map-game__footer')?.getBoundingClientRect();
    const bottom = element.closest('.map-game__footer') ? innerHeight : Math.min(innerHeight, footer?.top ?? innerHeight);
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { fullyVisible: r.top >= 0 && r.bottom <= bottom + 1 && r.left >= 0 && r.right <= innerWidth + 1, receivesClick: Boolean(hit && (hit === element || element.contains(hit))), x, y };
  });
  expect(result.fullyVisible, 'La carte entière doit être lisible avant tout défilement.').toBe(true);
  expect(result.receivesClick, 'Le point de clic réel doit appartenir à la carte.').toBe(true);
  return result;
}
async function titlePrecedesPressure(panel) {
  expect(await panel.evaluate(element => {
    const heading = element.querySelector('h1'), pressure = element.querySelector('[data-pressure-board]');
    return Boolean(heading && (!pressure || heading.compareDocumentPosition(pressure) & Node.DOCUMENT_POSITION_FOLLOWING));
  }), 'Le sujet doit précéder les informations de pression secondaires dans l’ordre de lecture.').toBe(true);
}
function firstAgenda(page) {
  return page.locator('[data-map-agenda] .map-agenda [data-action="story-select"]').filter({ visible: true }).first();
}

test('agenda prioritises a real actionable subject before secondary pressure information', async ({ page }, info) => {
  await open(page);
  await capture(page, info, 'agenda');
  await titlePrecedesPressure(page.locator('[data-map-agenda]'));
  const point = await actionableWithoutScroll(firstAgenda(page));
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('[data-map-decision]')).toBeVisible();
  expect((await inputs(page)).choices).toEqual([]);
});

test('opening a subject exposes its first full choice inside the initial map panel', async ({ page }, info) => {
  await open(page);
  await firstAgenda(page).click();
  await expect(page.locator('[data-map-decision]')).toBeVisible();
  await capture(page, info, 'sujet-initial');
  await titlePrecedesPressure(page.locator('[data-map-decision]'));
  await actionableWithoutScroll(page.locator('[data-action="choose"]').first());
  if (info.project.name !== 'desktop') {
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), 'Le sujet doit défiler dans son panneau sans allonger le document.').toBe(true);
  }
  expect((await inputs(page)).choices).toEqual([]);
});

test('all six front details and main navigation remain inspectable without spending a decision', async ({ page }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await open(page);
  const before = await inputs(page);
  const details = page.locator('details').filter({ has: page.locator('[data-pressure-front]') }).first();
  await expect(details).toHaveCount(1);
  if (!(await details.evaluate(element => element.open))) await details.locator(':scope > summary').click();
  for (const sector of SECTORS) {
    const front = page.locator(`[data-pressure-front="${sector}"]`);
    await front.scrollIntoViewIfNeeded();
    await expect(front).toBeVisible();
    await expect(front).toHaveAttribute('data-pressure-level', /\d/);
    await expect(front).toContainText(/En attente|Besoins/);
  }
  await capture(page, info, 'six-fronts');
  if (await details.evaluate(element => element.open)) await details.locator(':scope > summary').click();
  for (const action of ['map-government', 'map-projects']) {
    const navigation = page.locator(`.map-game__footer [data-action="${action}"]`);
    await actionableWithoutScroll(navigation);
    await navigation.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await capture(page, info, action);
    await dialog.getByRole('button', { name: 'Fermer', exact: true }).click();
  }
  expect(await inputs(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test('internal scrolling, keyboard choice and imported-save notice preserve usable camera and navigation', async ({ page }, info) => {
  await open(page);
  await firstAgenda(page).click();
  const panel = page.locator('[data-map-decision]');
  const choices = panel.locator('[data-action="choose"]:not([disabled])');
  const last = choices.last();
  const choice = await last.getAttribute('data-choice');
  await last.focus();
  await expect(last).toBeFocused();
  await last.press('Enter');
  await expect(page.locator('#mandats')).toHaveAttribute('data-turn', '1');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-decision-verdict]')).toBeHidden();
  expect((await inputs(page)).choices).toEqual([choice]);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.getByRole('button', { name: 'Exporter la sauvegarde', exact: true }).click();
  const exported = await download;
  const path = info.outputPath('mandat-interface-reel.json');
  await exported.saveAs(path);
  const exportedInputs = JSON.parse(await readFile(path, 'utf8'));
  await page.locator('input[type="file"]').setInputFiles(path);
  await expect(page.locator('#notice')).toContainText(/import/i);
  await expect(page.getByRole('dialog')).toBeHidden();
  await capture(page, info, 'apres-import');
  const camera = page.getByRole('button', { name: 'Agrandir la carte', exact: true });
  await actionableWithoutScroll(camera);
  await camera.click();
  const nav = page.locator('.map-game__footer [data-action="map-projects"]');
  await actionableWithoutScroll(nav);
  await nav.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
  const after = await inputs(page);
  expect(after.choices).toEqual(exportedInputs.choices);
  expect(after.choices).toEqual([choice]);
  await capture(page, info, 'navigation-apres-import');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
