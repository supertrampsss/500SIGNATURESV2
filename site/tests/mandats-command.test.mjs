import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

// These realistic failure hypotheses were documented before the command HUD in
// docs/mandats-interface-rework.md. Imports contain legal inputs, never balances.
const KEY = '500signatures.mandats.v1';
const BASE = { version: 14, mode: 'national', seed: 0, ambition: 'equilibre', choices: [] };
const SECTORS = ['health', 'housing', 'transport', 'energy', 'education', 'administration'];
const NAMES = { health: 'Santé', housing: 'Logement', transport: 'Transports', energy: 'Énergie', education: 'Enseignement', administration: 'Démarches publiques' };
// Prefixes from the independently audited 0-equilibre-late-rescue trajectory.
// Reconstruct through storage.decode to reject illegal or obsolete inputs.
const ACCUMULATION = ['pol-wealth-hospital-package', 'pol-coalition-compromise', 'r01b', 'r02b', 'r03c', 'r04c', 'u01a', 'r05a', 'r06c', 'r07c'];
const RECOVERY = [...ACCUMULATION, 'n11-10-pressure-health-programme', 'n11-11-pressure-health-relief', 'pol-scandal-publish', 'pol-censure-withdraw', 'n11-14-pressure-health-programme', 'n11-15-pressure-health-relief', 'n11-16-pressure-education-programme', 'n11-17-pressure-education-relief', 'n11-18-pressure-health-programme', 'pol-censure-withdraw', 'n11-20-pressure-health-programme', 'n11-21-pressure-health-relief', 'n11-22-pressure-transport-programme', 'n11-23-pressure-transport-programme', 'n11-24-pressure-transport-relief', 'n11-25-pressure-housing-programme'];
const cache = new Map();
function decode(raw) {
  if (cache.has(raw)) return cache.get(raw);
  const module = new URL('../src/mandats/storage.ts', import.meta.url).href;
  const game = JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', `import{decode}from ${JSON.stringify(module)};let s='';for await(const c of process.stdin)s+=c;process.stdout.write(JSON.stringify(decode(s)));`], { input: raw, encoding: 'utf8' }));
  cache.set(raw, game); return game;
}
async function state(page) {
  const raw = await page.evaluate(key => localStorage.getItem(key), KEY);
  return decode(raw || JSON.stringify(BASE));
}
async function open(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/mandats/?mode=national&v=14&seed=0&ambition=equilibre');
  await expect(page.locator('[data-map-agenda]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
async function capture(page, info, label, game = undefined) {
  const path = info.outputPath(`${label}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await info.attach(label, { path, contentType: 'image/png' });
  const g = game || await state(page);
  const json = info.outputPath(`${label}.json`);
  await writeFile(json, JSON.stringify({ browser: info.project.name, viewport: page.viewportSize(), url: page.url(), inputs: { ...BASE, seed: g.seed, choices: g.choices }, turn: g.turn, pressure: g.pressure, politics: g.politics, finance: g.finance }, null, 2));
  await info.attach(`${label}-replay`, { path: json, contentType: 'application/json' });
}
async function expectHud(page, game, { clickable = true } = {}) {
  await expect(page.locator('[data-situation-dock]')).toBeVisible();
  for (const id of SECTORS) {
    const front = page.locator(`[data-situation-front="${id}"]`);
    const sector = game.pressure.sectors[id];
    await expect(front).toHaveCount(1);
    await expect(front).toBeInViewport({ ratio: 1 });
    await expect(front).toHaveAttribute('data-pressure-level', String(sector.pressure));
    await expect(front).toHaveAttribute('data-pressure-stage', sector.stage);
    await expect(front).toHaveAttribute('data-pressure-trend', sector.trend);
    await expect(front).toContainText(String(Math.round(sector.pressure)));
    await expect(front).toHaveAccessibleName(new RegExp(NAMES[id], 'i'));
    if (clickable) expect(await front.evaluate(element => {
      const r = element.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return Boolean(hit && (hit === element || element.contains(hit)));
    }), `Le front ${id} reçoit réellement le clic.`).toBe(true);
  }
  const execution = page.locator('[data-situation-execution]');
  await expect(execution).toBeInViewport({ ratio: 1 });
  for (const key of ['used', 'capacity', 'waiting']) await expect(execution).toHaveAttribute(`data-execution-${key}`, String(game.pressure.execution[key]));
  await expect(page.locator('[data-situation-news]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
async function returnToMap(page) {
  const close = page.locator('[data-action="map-close"]');
  if (await close.isVisible()) await close.click();
  else {
    const back = page.locator('[data-map-review] [data-action="view"][data-view="decision"]');
    if (await back.isVisible()) await back.click();
  }
  await expect(page.locator('[data-map-decision]')).toBeHidden();
  await expect(page.locator('[data-mandate-map]')).toBeVisible();
}
async function importInputs(page, choices) {
  const value = { ...BASE, choices };
  const expected = decode(JSON.stringify(value));
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: `mandat-${choices.length}-decisions.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await expect(page.locator('#mandats')).toHaveAttribute('data-turn', String(choices.length));
  expect((await state(page)).pressure).toEqual(expected.pressure);
  return expected;
}

test('six simultaneous sector fronts and real implementation resources are visible on the initial board', async ({ page }, info) => {
  await open(page);
  const initial = decode(JSON.stringify(BASE));
  await capture(page, info, 'centre-initial', initial);
  await expectHud(page, initial);
  await expect(page.locator('[data-mandate-map]')).toBeVisible();
  expect((await state(page)).choices).toEqual([]);
});

test('every HUD front opens its actual response or country review without advancing time', async ({ page }, info) => {
  await open(page);
  const initial = await state(page);
  await expectHud(page, initial);
  for (const id of SECTORS) {
    const front = page.locator(`[data-situation-front="${id}"]`);
    const action = await front.getAttribute('data-action');
    expect(['story-select', 'view']).toContain(action);
    if (action === 'story-select') await expect(front).toHaveAttribute('data-story-id', `pressure-${id}`);
    else await expect(front).toHaveAttribute('data-view', 'finance');
    await front.click();
    await expect(page.locator(action === 'story-select' ? '[data-map-decision]' : '[data-map-review]')).toBeVisible();
    await expectHud(page, initial);
    expect((await state(page)).pressure).toEqual(initial.pressure);
    expect((await state(page)).choices).toEqual([]);
    await returnToMap(page);
  }
  await page.locator('.map-game__footer [data-action="view"][data-view="finance"]').click();
  await expect(page.locator('[data-map-review]')).toBeVisible();
  await page.locator('.map-game__footer [data-action="view"][data-view="decision"]').click();
  await expect(page.locator('[data-map-agenda]')).toBeVisible();
  await expect(page.locator('[data-mandate-map]')).toBeVisible();
  expect((await state(page)).choices).toEqual([]);
  expect((await state(page)).pressure).toEqual(initial.pressure);
  await capture(page, info, 'six-fronts-inspectes');
});

test('a keyboard initiative saves once and exposes its real delivery work and cost without losing the HUD', async ({ page }, info) => {
  await open(page);
  await page.locator('[data-situation-front="health"]').click();
  const programme = page.locator('[data-action="choose"][data-choice$="-programme"]');
  await expect(programme).toBeVisible();
  const choice = await programme.getAttribute('data-choice');
  await programme.focus(); await programme.press('Enter');
  await expect(page.locator('#mandats')).toHaveAttribute('data-turn', '1');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-decision-verdict]')).toBeHidden();
  const game = await state(page);
  expect(game.choices).toEqual([choice]);
  await expectHud(page, game);
  await capture(page, info, 'initiative-enregistree');
  await page.locator('.map-game__footer [data-action="map-projects"]').click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  const created = game.pressure.programmes.find(item => item.sourceChoice === choice);
  expect(created).toBeDefined();
  const card = dialog.locator(`[data-pressure-programme="${created.id}"]`);
  await expect(card).toContainText(created.label);
  await expect(card).toContainText(/Échéance|mise en place|décision/i);
  await expect(card).toContainText(String(created.remainingWork));
  await capture(page, info, 'moyens-delais-reels');
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).click();
  expect((await state(page)).pressure).toEqual(game.pressure);
  await page.reload(); await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  expect((await state(page)).choices).toEqual([choice]);
  await expectHud(page, game);
});

test('legal accumulated and recovering trajectories update all six HUD readings and actual waiting resources', async ({ page }, info) => {
  await open(page);
  const accumulated = await importInputs(page, ACCUMULATION);
  expect(Object.values(accumulated.pressure.sectors).filter(front => ['strained', 'disrupted', 'crisis'].includes(front.stage)).length).toBeGreaterThanOrEqual(3);
  await expectHud(page, accumulated);
  await capture(page, info, 'plusieurs-fronts-sous-pression', accumulated);
  const recovered = await importInputs(page, RECOVERY);
  expect(recovered.pressure.sectors.health.pressure).toBeLessThan(accumulated.pressure.sectors.health.pressure);
  expect(recovered.pressure.sectors.health.trend).toBe('improving');
  expect(recovered.pressure.execution.waiting).toBeGreaterThan(0);
  await expectHud(page, recovered);
  await capture(page, info, 'reprise-et-attentes-reelles', recovered);
  const health = page.locator('[data-situation-front="health"]');
  const action = await health.getAttribute('data-action');
  await health.click();
  const opened = page.locator(action === 'story-select' ? '[data-map-decision]' : '[data-map-review]');
  await expect(opened).toBeVisible();
  await expect(opened).toContainText(/pression|retard|attente|capacité/i);
  await returnToMap(page);
  expect((await state(page)).pressure).toEqual(recovered.pressure);
});

test('floating command controls leave every real map marker, zoom and inspection usable without a decision', async ({ page }, info) => {
  await open(page);
  const initial = await state(page);
  await expectHud(page, initial);
  const markers = page.locator('[data-map-marker][data-action="story-select"]').filter({ visible: true });
  const ids = await markers.evaluateAll(elements => elements.map(element => element.dataset.mapMarker));
  expect(ids).toHaveLength(3);
  for (const id of ids) {
    // A real click must reach the pin. No force:true or DOM dispatch can hide
    // an agenda overlay intercepting its target.
    await page.locator(`[data-map-marker="${id}"]`).click();
    await expect(page.locator('[data-map-decision]')).toBeVisible();
    await returnToMap(page);
    expect((await state(page)).choices).toEqual([]);
    expect((await state(page)).pressure).toEqual(initial.pressure);
  }
  const local = ids.find(id => !id.startsWith('policy:') && !id.startsWith('institutional:'));
  expect(local, 'La carte comporte un dossier local à inspecter.').toBeTruthy();
  await page.locator(`[data-map-marker="${local}"]`).click();
  const inspect = page.locator('[data-map-decision] [data-action="map-inspect"]');
  await expect(inspect).toBeVisible();
  await inspect.click();
  if (info.project.name === 'desktop') {
    // Desktop can inspect alongside the open initiative menu. Phones return
    // from their central tactical menu before showing the place on the board.
    await expect(page.locator('[data-map-decision]')).toBeVisible();
    await returnToMap(page);
  } else {
    await expect(page.locator('[data-map-decision]')).toBeHidden();
    await expect(page.locator('[data-mandate-map]')).toBeVisible();
  }
  const toggle = page.locator('[data-map-toggle]');
  const expandable = await toggle.isVisible();
  if (expandable) {
    if (await toggle.getAttribute('aria-expanded') === 'true') {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    }
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expectHud(page, initial);
    await capture(page, info, 'plateau-deplie-et-reperes');
  }
  for (const camera of ['in', 'out', 'reset']) {
    const button = page.locator(`[data-action="map-camera"][data-camera="${camera}"]`);
    await expect(button).toBeVisible();
    await button.click();
  }
  if (expandable) {
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  }
  await expectHud(page, initial);
  expect((await state(page)).choices).toEqual([]);
  expect((await state(page)).turn).toBe(0);
  expect((await state(page)).pressure).toEqual(initial.pressure);
  await capture(page, info, 'reperes-camera-et-retour-pays');
});

test('late recovering map markers remain real click targets beside camera controls', async ({ page }, info) => {
  await open(page);
  const expected = await importInputs(page, RECOVERY);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ids = await page.locator('[data-map-marker][data-action="story-select"]').filter({ visible: true }).evaluateAll(elements => elements.map(element => element.dataset.mapMarker));
  expect(ids).toHaveLength(3);
  await capture(page, info, 'reperes-tardifs-avant-clic', expected);
  for (const id of ids) {
    await page.locator(`[data-map-marker="${id}"]`).click();
    await expect(page.locator('[data-map-decision]')).toBeVisible();
    await returnToMap(page);
    expect((await state(page)).choices).toEqual(RECOVERY);
    expect((await state(page)).pressure).toEqual(expected.pressure);
  }
  await capture(page, info, 'reperes-tardifs-inspectes', expected);
});

test('saved entry keeps its briefing and new-game action readable and can resume the actual game', async ({ page }, info) => {
  await open(page);
  await page.locator('[data-situation-front="health"]').click();
  const maintain = page.locator('[data-action="choose"][data-choice$="-maintain"]');
  const chosen = await maintain.getAttribute('data-choice');
  await maintain.click();
  await expect(page.locator('#mandats')).toHaveAttribute('data-turn', '1');
  const saved = await state(page);
  await page.goto('/mandats/');
  const entry = page.locator('.map-entry'); await expect(entry).toBeVisible();
  await capture(page, info, 'accueil-avec-sauvegarde', saved);
  const readability = await entry.evaluate(element => {
    const values = value => value.match(/[\d.]+/g)?.map(Number) || [];
    const luminance = color => color.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, index) => sum + v * [.2126, .7152, .0722][index], 0);
    const elements = [...element.querySelectorAll(':scope > p:not(.map-entry__kicker), :scope > button')];
    return elements.filter(target => target.getClientRects().length).map(target => {
      const style = getComputedStyle(target);
      let host = target, background;
      while (host) {
        const candidate = values(getComputedStyle(host).backgroundColor);
        if (candidate.length === 3 || candidate[3] >= .9) { background = candidate; break; }
        host = host.parentElement;
      }
      const foreground = values(style.color);
      const levels = [luminance(foreground), luminance(background || [255, 255, 255])].sort((a, b) => b - a);
      const ratio = (levels[0] + .05) / (levels[1] + .05);
      const large = parseFloat(style.fontSize) >= 24 || parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700;
      return { text: target.textContent.trim(), foreground: style.color, ratio, minimum: large ? 3 : 4.5 };
    });
  });
  const proof = info.outputPath('contraste-accueil-sauvegarde.json');
  await writeFile(proof, JSON.stringify(readability, null, 2));
  await info.attach('contraste-accueil-sauvegarde', { path: proof, contentType: 'application/json' });
  for (const reading of readability) expect(reading.ratio, `Le libellé « ${reading.text} » reste lisible.`).toBeGreaterThanOrEqual(reading.minimum);
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  await expect(page.locator('#mandats')).toHaveAttribute('data-turn', '1');
  expect((await state(page)).choices).toEqual([chosen]);
  expect((await state(page)).pressure).toEqual(saved.pressure);
  await expectHud(page, saved);
});


test('failed saving on an expanded board keeps the export warning visible and the in-memory decisions recoverable', async ({ page }, info) => {
  await open(page);
  await page.locator('[data-situation-front="health"]').click();
  await page.locator('[data-action="choose"][data-choice$="-maintain"]').click();
  await expect(page.locator('#mandats')).toHaveAttribute('data-turn', '1');
  await page.keyboard.press('Escape');
  const original = await state(page);
  const toggle = page.locator('[data-map-toggle]');
  if (await toggle.isVisible()) await toggle.click();
  else {
    await page.locator('[data-situation-front="health"]').click();
    await page.locator('[data-action="map-inspect"]').click();
    await page.locator('.map-game__footer [data-action="view"][data-view="decision"]').click();
  }
  await expect(page.locator('[data-mandate-map]')).toHaveAttribute('data-expanded', 'true');
  // Desktop inspection zooms into Rennes; priority pins can legitimately be
  // outside that view. Use the public overview before opening a real pin.
  await page.locator('[data-action="map-camera"][data-camera="reset"]').click();
  await expect(page.locator('[data-mandate-map]')).toHaveAttribute('data-expanded', 'true');
  const marker = page.locator('[data-map-marker][data-action="story-select"]').filter({ visible: true }).first();
  await marker.click();
  const second = page.locator('[data-action="choose"]:not([disabled])').first();
  const secondChoice = await second.getAttribute('data-choice');
  await page.evaluate(key => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Espace indisponible pendant la sauvegarde', 'QuotaExceededError');
      return originalSetItem.call(this, name, value);
    };
  }, KEY);
  await second.click();
  await expect(page.locator('#mandats')).toHaveAttribute('data-turn', '2');
  await page.keyboard.press('Escape');
  const notice = page.locator('#notice');
  const warning = { visible: await notice.isVisible(), text: await notice.textContent() };
  const screenshot = info.outputPath('alerte-stockage-sur-plateau-deplie.png');
  await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' });
  await info.attach('alerte-stockage-sur-plateau-deplie', { path: screenshot, contentType: 'image/png' });
  expect((await state(page)).choices).toEqual(original.choices);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.getByRole('button', { name: 'Exporter la sauvegarde', exact: true }).click();
  const exported = await download;
  const path = info.outputPath('deux-decisions-en-memoire.json'); await exported.saveAs(path);
  const memory = decode(await readFile(path, 'utf8'));
  expect(memory.choices).toEqual([...original.choices, secondChoice]);
  expect(memory.turn).toBe(2);
  const proof = info.outputPath('stockage-refuse-et-export-reel.json');
  await writeFile(proof, JSON.stringify({ browser: info.project.name, viewport: page.viewportSize(), warning, savedChoices: original.choices, memoryChoices: memory.choices }, null, 2));
  await info.attach('stockage-refuse-et-export-reel', { path: proof, contentType: 'application/json' });
  expect(warning.text).toMatch(/export/i);
  expect(warning.visible, 'Une alerte de sauvegarde doit rester visible quand le poste agenda est masqué.').toBe(true);
});

test('short compact screen keeps all four persistent navigation controls fully reachable', async ({ page }, info) => {
  test.skip(info.project.name !== 'compact', 'One focused 320 × 568 journey complements all four regular viewport projects.');
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page);
  const original = await state(page);
  const footer = page.locator('.map-game__footer');
  const country = footer.locator('[data-action="view"][data-view="decision"]');
  await expect(country).toBeInViewport({ ratio: 1 }); await country.click();
  for (const action of ['map-government', 'map-projects']) {
    const button = footer.locator(`[data-action="${action}"]`);
    await expect(button).toBeInViewport({ ratio: 1 }); await button.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
  }
  const balance = footer.locator('[data-action="view"][data-view="finance"]');
  await expect(balance).toBeInViewport({ ratio: 1 }); await balance.click();
  await expect(page.locator('[data-map-review]')).toBeVisible();
  await expect(country).toBeInViewport({ ratio: 1 }); await country.click();
  await expect(page.locator('[data-map-agenda]')).toBeVisible();
  expect((await state(page)).choices).toEqual(original.choices);
  expect((await state(page)).pressure).toEqual(original.pressure);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await capture(page, info, 'navigation-320-par-568');
});
