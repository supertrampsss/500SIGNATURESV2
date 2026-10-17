import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

// The realistic failure modes precede implementation in docs/mandats-presidency-contract.md.
// Browser clocks only advance elapsed time. Inputs are reconstructed through the public
// versioned decoder, never through imported balances or production-only testing hooks.
const KEY = '500signatures.mandats.v1';
const BASE = { version: 16, mode: 'national', seed: 0, ambition: 'equilibre', choices: [] };
const SECTORS = ['health', 'housing', 'transport', 'energy', 'education', 'administration'];
const PERIOD_MS = 15_000;
const moduleURL = new URL('../src/mandats/storage.ts', import.meta.url).href;
const cache = new Map();
function reconstruct(value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  if (!cache.has(raw)) cache.set(raw, JSON.parse(execFileSync(process.execPath,
    ['--experimental-strip-types', '--input-type=module', '-e',
      `import{decode}from${JSON.stringify(moduleURL)};let raw='';for await(const p of process.stdin)raw+=p;process.stdout.write(JSON.stringify(decode(raw)));`],
    { input: raw, encoding: 'utf8' })));
  return cache.get(raw);
}
async function rawSave(page) { return page.evaluate(key => localStorage.getItem(key), KEY); }
async function saved(page) {
  const raw = await rawSave(page); expect(raw).toBeTruthy(); return reconstruct(raw);
}
async function stopBrowserClock(page) {
  const initial = Date.now() + 1_000;
  await page.clock.install({ time: initial - 1_000 });
  await page.clock.pauseAt(initial);
}
async function ready(page) {
  await expect(page.locator('section[data-presidency]')).toBeVisible();
  await expect(page.locator('[data-presidency-clock]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
async function start(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stopBrowserClock(page);
  await page.goto('/mandats/');
  await page.getByRole('button', { name: /^Commencer/ }).click();
  await ready(page);
  expect((await saved(page)).version).toBe(16);
}
async function load(page, inputs = BASE) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stopBrowserClock(page);
  await page.goto('/mandats/');
  await importInputs(page, inputs);
}
async function importInputs(page, inputs) {
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'presidence-inputs.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(inputs)) });
  await ready(page);
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'true');
  expect((await saved(page)).choices).toEqual(inputs.choices);
  await page.clock.runFor(4_501); // Let the real import receipt clear while the country remains paused.
}
async function pause(page) {
  if (await page.locator('[data-presidency-clock]').getAttribute('data-paused') !== 'true')
    await page.locator('[data-action="presidency-pause"]').click();
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'true');
}
async function resume(page) {
  if (await page.locator('[data-presidency-clock]').getAttribute('data-paused') === 'true')
    await page.locator('[data-action="presidency-pause"]').click();
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'false');
}
async function periods(page, count = 1, speed = 1) {
  const before = await saved(page);
  await resume(page);
  // Allow the browser's 100 ms scheduling granularity, not an extra period.
  await page.clock.runFor(count * (PERIOD_MS / speed + 100) + 1);
  await expect(page.locator('section[data-presidency]')).toHaveAttribute('data-turn', String(Math.min(30, before.turn + count)));
  return saved(page);
}
async function closeSurface(page) {
  const fan = page.locator('[data-presidency-commands] [data-action="presidency-deselect"]');
  if (await fan.isVisible()) await fan.click();
  else await page.getByRole('dialog').getByRole('button', { name: 'Fermer et revenir au pays', exact: true }).click();
}
async function openFront(page, sector) {
  await page.locator(`[data-presidency-front="${sector}"]`).click();
  await page.clock.runFor(32); // Let the browser position the action fan on its next animation frame.
  await expect(page.locator('[data-presidency-order]').first()).toBeVisible();
}
async function order(page, sector, kind) {
  const before = await saved(page);
  await openFront(page, sector);
  const command = page.locator(`[data-presidency-order][data-order="live-pressure-${sector}-${kind}"]`);
  if (!(await command.isVisible())) await page.locator('.pr-sector-development summary').click();
  await expect(command).toBeEnabled();
  await command.evaluate(e => e.scrollIntoView({block:"center"}));
  await hitTarget(command);
  await command.click();
  await expect.poll(async () => JSON.parse(await rawSave(page)).choices.length).toBe(before.choices.length + 1);
  const after = await saved(page);
  expect(after.turn).toBe(before.turn);
  expect(after.choices.at(-1)).toBe(`live-pressure-${sector}-${kind}`);
  return after;
}
async function capture(page, info, label, game = undefined) {
  const state = game ?? await saved(page);
  const screenshot = info.outputPath(`${label}.png`);
  const inputs = info.outputPath(`${label}.json`);
  await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' });
  await writeFile(inputs, JSON.stringify({ url: page.url(), browser: info.project.name, viewport: page.viewportSize(), inputs: { version: state.version, mode: state.mode, seed: state.seed, ambition: state.ambition, choices: state.choices }, state }, null, 2));
  await info.attach(label, { path: screenshot, contentType: 'image/png' });
  await info.attach(`${label}-inputs-and-state`, { path: inputs, contentType: 'application/json' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
async function refuseStorage(page) {
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    window.__restorePresidencyStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function(name, value) {
      if (name === key) throw new DOMException('Stockage indisponible pendant le mandat', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, KEY);
}
async function hitTarget(locator) {
  await expect(locator).toBeInViewport({ ratio: 1 });
  expect(await locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return !!hit && (hit === element || element.contains(hit));
  })).toBe(true);
}

test('one minute without a click advances the country and pays real ministerial initiatives', async ({ page }, info) => {
  await start(page);
  const before = await saved(page);
  expect(before.turn).toBe(0);
  await capture(page, info, 'presidence-au-lancement', before);
  await page.clock.runFor(60_001);
  await expect(page.locator('section[data-presidency]')).toHaveAttribute('data-turn', '4');
  const after = await saved(page);
  expect(after.choices.filter(id => id === 'live-tick')).toHaveLength(4);
  expect(after.presidency.initiatives.some(item => item.cost > 0 && item.actor !== 'president')).toBe(true);
  expect(after.presidency.reserve).toBeLessThan(before.presidency.reserve);
  expect(after.presidency.spent).toBeGreaterThan(0);
  expect(after.pressure.budget.accruedOperating > 0 || after.finance.investment > before.finance.investment).toBe(true);
  expect(after.presidency.initiatives.filter(item => item.actor === 'government' && item.cost > 0).every(item => after.pressure.programmes.some(programme => programme.sourceChoice === item.choice))).toBe(true);
  expect(after.pressure).not.toEqual(before.pressure);
  await expect(page.locator('[data-presidency-feed]')).toBeVisible();
  await capture(page, info, 'une-minute-sans-clic', after);
});

test('all six fronts stay readable and clickable and an order takes two gestures without consuming time', async ({ page }, info) => {
  await load(page);
  const before = await saved(page);
  for (const sector of SECTORS) {
    const front = page.locator(`[data-presidency-front="${sector}"]`);
    await expect(front).toHaveAccessibleName(/\S/);
    await hitTarget(front);
    await front.click();
    await page.clock.runFor(32);
    await expect(page.locator('[data-presidency-order]').first()).toBeVisible();
    for (const command of await page.locator('[data-presidency-commands] [data-presidency-order]:visible').all()) {
      await command.evaluate(e => e.scrollIntoView({block:"center"}));
      if (await command.isDisabled()) await expect(command).toBeInViewport({ ratio: 1 });
      else await hitTarget(command);
    }
    if (sector === 'health') await capture(page, info, 'commandes-directes-ouvertes', before);
    await closeSurface(page);
    expect((await saved(page)).turn).toBe(0);
  }
  const after = await order(page, 'health', 'programme');
  expect(after.finance.investment).toBeGreaterThan(before.finance.investment);
  expect(after.presidency.reserve).toBeLessThan(before.presidency.reserve);
  const created = after.pressure.programmes.find(item => item.sourceChoice === 'live-pressure-health-programme');
  expect(created?.status).toBe('preparing');
  expect(created.deliveredTurn).toBeUndefined();
  expect(after.pressure.sectors.health.capacity).toBe(before.pressure.sectors.health.capacity);
  await expect(page.locator('[data-presidency-order]')).toHaveCount(0);
  await capture(page, info, 'ordre-direct-sans-avancer-le-calendrier', after);
  await openFront(page, 'health');
  const duplicate = page.locator('[data-presidency-order][data-order="live-pressure-health-programme"]');
  if (await duplicate.count()) await expect(duplicate).toBeDisabled();
  else await expect(duplicate).toHaveCount(0);
  expect((await saved(page)).finance.investment).toBe(after.finance.investment);
  await capture(page, info, 'commande-en-cours-non-refinancable');
});

test('temporary help waits for the clock then expires with one financing and real relief', async ({ page }, info) => {
  await load(page, { ...BASE, choices: ['live-autonomy'] });
  const before = await saved(page);
  let game = await order(page, 'health', 'relief');
  const funded = game.pressure.programmes.find(item => item.sourceChoice === 'live-pressure-health-relief');
  expect(funded?.status).toBe('preparing');
  expect(game.pressure.sectors.health.capacity).toBe(before.pressure.sectors.health.capacity);
  await page.clock.runFor(60_001);
  expect((await saved(page)).turn).toBe(0);
  game = await periods(page);
  let programme = game.pressure.programmes.find(item => item.id === funded.id);
  expect(programme.status).toBe('active');
  expect(programme.appliedCapacity).toBeGreaterThan(0);
  expect(game.pressure.sectors.health.capacity).toBeGreaterThan(before.pressure.sectors.health.capacity);
  await pause(page);
  await capture(page, info, 'renfort-effectivement-livre', game);
  game = await periods(page, programme.endsTurn - game.turn);
  await pause(page);
  programme = game.pressure.programmes.find(item => item.id === funded.id);
  expect(programme.status).toBe('completed');
  expect(game.pressure.sectors.health.capacity).toBe(before.pressure.sectors.health.capacity);
  expect(game.pressure.programmes.filter(item => item.sourceChoice === funded.sourceChoice)).toHaveLength(1);
  const control = reconstruct({ ...BASE, choices: ['live-autonomy', ...Array.from({ length: game.turn }, () => 'live-tick')] });
  expect(game.pressure.sectors.health.backlog).toBeLessThan(control.pressure.sectors.health.backlog);
  await capture(page, info, 'renfort-termine-et-comparaison-sans-intervention', game);
});

test('pause, speed and large menus control elapsed time without catch-up on return', async ({ page }, info) => {
  await load(page);
  const initialRaw = await rawSave(page);
  await page.clock.runFor(60_001);
  expect(await rawSave(page)).toBe(initialRaw);
  await resume(page);
  await page.locator('[data-action="presidency-panel"][data-panel="government"]').click();
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'true');
  await page.clock.runFor(120_001);
  expect((await saved(page)).turn).toBe(0);
  await capture(page, info, 'lecture-gouvernement-temps-suspendu');
  await closeSurface(page);
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'false');
  await page.clock.runFor(PERIOD_MS - 101);
  expect((await saved(page)).turn).toBe(0);
  await page.clock.runFor(202);
  expect((await saved(page)).turn).toBe(1);
  await pause(page);
  const speed = page.locator('[data-action="presidency-speed"][data-speed="2"]');
  await speed.click();
  await expect(speed).toHaveAttribute('aria-pressed', 'true');
  await periods(page, 2, 2);
  await pause(page);
  await capture(page, info, 'vitesse-deux-pays-trois-periodes');
});

test('refused clock and order saves pause and preserve the last durable country', async ({ page }, info) => {
  await load(page, { ...BASE, choices: ['live-autonomy'] });
  const before = await saved(page), raw = await rawSave(page);
  await refuseStorage(page);
  await resume(page);
  await page.clock.runFor(PERIOD_MS + 101);
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'true');
  expect(await rawSave(page)).toBe(raw);
  await expect(page.locator('section[data-presidency]')).toHaveAttribute('data-turn', String(before.turn));
  expect((await saved(page)).pressure).toEqual(before.pressure);
  await expect(page.locator('[data-live-feedback][data-failure="true"]')).toBeVisible();
  await expect(page.locator('[data-live-feedback]')).toContainText(/sauvegard|stockage|enregistr/i);
  await page.clock.runFor(60_001);
  expect(await rawSave(page)).toBe(raw);
  await capture(page, info, 'echec-stockage-conserve-la-partie-durable');
  await page.evaluate(() => window.__restorePresidencyStorage());
  await periods(page);
  await pause(page);
  expect((await saved(page)).turn).toBe(1);
  await capture(page, info, 'temps-repris-apres-retablissement-stockage');
  const durable = await rawSave(page), fundedBefore = await saved(page);
  const visibleReserve = await page.locator('[data-live-reserve]').innerText();
  await refuseStorage(page);
  await openFront(page, 'health');
  await page.locator('.pr-sector-development summary').click();
  await page.locator('[data-presidency-order][data-order="live-pressure-health-programme"]').click();
  expect(await rawSave(page)).toBe(durable);
  expect((await saved(page)).finance).toEqual(fundedBefore.finance);
  expect((await saved(page)).pressure.programmes).toEqual(fundedBefore.pressure.programmes);
  await expect(page.locator('[data-live-reserve]')).toHaveText(visibleReserve);
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'true');
  await capture(page, info, 'ordre-non-enregistre-aucune-depense-publiee');
  await page.evaluate(() => window.__restorePresidencyStorage());
});

test('export, reload and import rebuild the same government while an explicit v15 stays v15', async ({ page }, info) => {
  await load(page);
  await order(page, 'health', 'programme');
  await periods(page, 3);
  await pause(page);
  const original = await saved(page);
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  const exportEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter la sauvegarde', exact: true }).click();
  const download = await exportEvent;
  const exportPath = await download.path();
  const exported = await readFile(exportPath, 'utf8');
  await writeFile(info.outputPath('presidence-v16-export.json'), exported);
  const inputs = JSON.parse(exported);
  expect(inputs.choices).toEqual(original.choices);
  expect(inputs).not.toHaveProperty('finance');
  expect(inputs).not.toHaveProperty('presidency');
  expect(reconstruct(exported)).toEqual(original);
  await page.reload();
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  await ready(page);
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'true');
  expect(await saved(page)).toEqual(original);
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  const old = { ...BASE, version: 15, choices: ['n11-0-pressure-health-maintain'] };
  await page.locator('input[type="file"]').setInputFiles({ name: 'mandat-historique-v15.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(old)) });
  await expect(page.locator('section[data-presidency]')).toHaveCount(0);
  expect(await saved(page)).toEqual(reconstruct(old));
  await capture(page, info, 'ancienne-partie-v15-conservee');
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'presidence-v16-export.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
  await ready(page);
  expect(await saved(page)).toEqual(original);
  await capture(page, info, 'presidence-reconstruite-depuis-export', original);
});

test('a hidden browser tab suspends the country and returning never catches up the elapsed minutes', async ({ page }, info) => {
  await load(page);
  await resume(page);
  // Headless browsers keep background pages visible even after bringToFront.
  // Inject only the browser visibility signal, not any production clock/engine API.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'true');
  const before = await rawSave(page);
  await page.clock.runFor(180_001);
  expect(await rawSave(page)).toBe(before);
  await page.evaluate(() => {
    delete document.hidden;
    delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect((await saved(page)).turn).toBe(0);
  await resume(page);
  await page.clock.runFor(PERIOD_MS - 101);
  expect((await saved(page)).turn).toBe(0);
  await page.clock.runFor(202);
  expect((await saved(page)).turn).toBe(1);
  await pause(page);
  await capture(page, info, 'retour-onglet-sans-rattrapage');
});

test('a shared mandate never overwrites the private country or starts its clock before explicit adoption', async ({ page }, info) => {
  await load(page, { ...BASE, choices: ['live-priority-health', 'live-tick'] });
  const privateRaw = await rawSave(page);
  await page.goto('/mandats/?mode=national&v=16&seed=7&ambition=equilibre');
  await ready(page);
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'true');
  await page.clock.runFor(60_001);
  expect(await rawSave(page)).toBe(privateRaw);
  const play = page.getByRole('button', { name: 'Jouer ce mandat', exact: true });
  await expect(play).toBeVisible();
  await play.click();
  const adopted = await saved(page);
  expect(adopted.seed).toBe(7);
  expect(adopted.choices).toEqual([]);
  await page.clock.runFor(PERIOD_MS + 101);
  expect((await saved(page)).turn).toBe(1);
  await pause(page);
  await capture(page, info, 'defi-adopte-explicitement');
});

test('a standing priority changes which ministry actually invests without repeatedly asking the president', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'The four formats cover clock and commands; desktop compares two complete priority trajectories.');
  await load(page);
  const outcomes = {};
  for (const sector of ['health', 'education']) {
    if (sector !== 'health') await importInputs(page, BASE);
    await page.locator('[data-action="presidency-panel"][data-panel="priorities"]').click();
    await page.locator(`[data-presidency-priority="${sector}"]`).click();
    const instructed = await saved(page);
    expect(instructed.turn).toBe(0);
    expect(instructed.presidency.priority).toBe(sector);
    if (await page.locator('[data-presidency-panel]').isVisible()) await closeSurface(page);
    const after = await periods(page);
    await pause(page);
    const initiated = after.presidency.initiatives.find(item => item.actor === 'government' && item.cost > 0);
    expect(initiated?.sector).toBe(sector);
    expect(after.pressure.programmes.some(programme => programme.sourceChoice === initiated.choice)).toBe(true);
    outcomes[sector] = { inputs: JSON.parse(await rawSave(page)), initiative: initiated, state: after };
    await capture(page, info, `priorite-${sector}-initiative-reelle`, after);
  }
  expect(outcomes.health.initiative.choice).not.toBe(outcomes.education.initiative.choice);
  await writeFile(info.outputPath('deux-priorites-deux-trajectoires.json'), JSON.stringify(outcomes, null, 2));
});

test('insufficient credits disable the actual command and do not charge or duplicate any project', async ({ page }, info) => {
  await load(page);
  const initial = await saved(page);
  await openFront(page, 'housing');
  const expensive = page.locator('[data-presidency-order][data-order="live-pressure-housing-programme"]');
  await expect(expensive).toBeDisabled();
  await expect(expensive).toContainText(/crédits|6,4|7,18/i);
  expect((await saved(page)).choices).toEqual([]);
  await closeSurface(page);
  const after = await order(page, 'health', 'programme');
  expect(after.presidency.reserve).toBeLessThan(initial.presidency.reserve);
  await openFront(page, 'education');
  const unfunded = page.locator('[data-presidency-order][data-order="live-pressure-education-programme"]');
  await expect(unfunded).toBeDisabled();
  await expect(unfunded).toContainText(/crédits|engagement/i);
  expect((await saved(page)).finance).toEqual(after.finance);
  expect((await saved(page)).pressure.programmes).toEqual(after.pressure.programmes);
  await capture(page, info, 'credits-limites-commandes-refusees-sans-depense', after);
});

test('a parliamentary refusal grants no credits or spending and its real vote survives reloading', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'The four formats cover the financial envelope; desktop follows the separate rejected-vote branch.');
  await load(page, { ...BASE, seed: 7 });
  const initial = await saved(page);
  await page.locator('[data-action="presidency-panel"][data-panel="government"]').click();
  await page.locator('[data-presidency-order][data-order="live-credits"]').click();
  const after = await saved(page);
  expect(after.choices).toEqual(['live-credits']);
  expect(after.turn).toBe(0);
  expect(after.politics.lastVote.passed).toBe(false);
  expect(after.presidency.reserve).toBe(initial.presidency.reserve);
  expect(after.presidency.authorised).toBe(initial.presidency.authorised);
  expect(after.finance.investment).toBe(initial.finance.investment);
  expect(after.pressure.programmes).toEqual(initial.pressure.programmes);
  if (!await page.locator('[data-presidency-panel="government"]').isVisible())
    await page.locator('[data-action="presidency-panel"][data-panel="government"]').click();
  await expect(page.locator('[data-live-vote]')).toHaveAttribute('data-vote-passed', 'false');
  await capture(page, info, 'assemblee-refuse-aucun-credit-cree', after);
  await page.reload();
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  await ready(page);
  expect((await saved(page)).politics.lastVote).toEqual(after.politics.lastVote);
  expect((await saved(page)).presidency.reserve).toBe(initial.presidency.reserve);
});

test('five years close each annual account exactly once and the finished mandate stops the clock', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'The four formats cover elapsed time; desktop plays all thirty periods and the final annual closure.');
  await load(page, { ...BASE, choices: ['live-autonomy'] });
  await page.locator('[data-action="presidency-speed"][data-speed="4"]').click();
  const ended = await periods(page, 30, 4);
  expect(ended.turn).toBe(30);
  expect(ended.choices.filter(id => id === 'live-tick')).toHaveLength(30);
  expect(ended.history).toHaveLength(ended.choices.length);
  expect(ended.history.filter(item => item.closed)).toHaveLength(5);
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'true');
  await expect(page.locator('[data-presidency-panel="ending"]')).toBeVisible();
  const durable = await rawSave(page);
  await page.clock.runFor(60_001);
  expect(await rawSave(page)).toBe(durable);
  await capture(page, info, 'cinq-ans-comptes-clos-horloge-arretee', ended);
});

test('the prepared presidency reloads its real illustration and delivers a funded project offline', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'mobile', 'One actual service-worker lifecycle; all formats cover the same saved presidency.');
  await load(page, { ...BASE, choices: ['live-autonomy', 'live-pressure-health-programme'] });
  const before = await saved(page);
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.getByRole('dialog').locator('summary').filter({ hasText: 'Jouer hors connexion' }).click();
  await page.getByRole('button', { name: 'Préparer le jeu hors connexion', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('prêt hors connexion', { timeout: 45_000 });
  const cachedAssets = await page.evaluate(async () => {
    const keys = (await caches.keys()).filter(key => key.startsWith('mandats-offline-'));
    return Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(request => new URL(request.url).pathname)));
  });
  const illustrationPath = await page.locator('[data-presidency-art]').evaluate(image => new URL(image.currentSrc).pathname);
  expect(cachedAssets.flat()).toContain(illustrationPath);
  await writeFile(info.outputPath('assets-offline.json'), JSON.stringify({ illustrationPath, cachedAssets }, null, 2));
  await context.setOffline(true);
  try {
    await page.reload();
    await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
    await ready(page);
    expect(await saved(page)).toEqual(before);
    await expect.poll(() => page.locator('[data-presidency-art]').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    const delivered = await periods(page, 3);
    await pause(page);
    const programme = delivered.pressure.programmes.find(item => item.sourceChoice === 'live-pressure-health-programme');
    expect(programme.status).toBe('completed');
    expect(programme.deliveredTurn).toBe(3);
    expect(programme.appliedCapacity).toBeGreaterThan(0);
    expect(delivered.pressure.sectors.health.capacity).toBeGreaterThan(before.pressure.sectors.health.capacity);
    await capture(page, info, 'presidence-livraison-reelle-hors-connexion', delivered);
    const serviceBadge = page.locator('[data-live-pin="health"] [data-delivery-state]');
    await expect.soft(serviceBadge).toHaveAttribute('data-delivery-state', 'completed', { timeout: 2_000 });
    if (await serviceBadge.count()) await expect(serviceBadge).toHaveAccessibleName('Intervention en service');
    await page.locator('[data-action="presidency-panel"][data-panel="government"]').click();
    await capture(page, info, 'programme-permanent-toujours-en-service', delivered);
    const permanent = page.locator(`[data-live-programme="${programme.id}"]`);
    await expect.soft(permanent).toHaveAttribute('data-programme-state', 'completed', { timeout: 2_000 });
    if (await permanent.count()) await expect(permanent).toContainText('En service · capacité durable');
    expect((await saved(page)).pressure).toEqual(delivered.pressure);
  } finally { await context.setOffline(false); }
});

test('a crisis leaves all four direct commands reachable and funded recovery creates real breathing room', async ({ page }, info) => {
  const inputs = { ...BASE, choices: ['live-autonomy', ...Array.from({ length: 10 }, () => 'live-tick')] };
  await load(page, inputs);
  const before = await saved(page);
  expect(before.pressure.sectors.health.stage).toBe('crisis');
  await openFront(page, 'health');
  await page.locator('.pr-sector-development summary').click();
  const commands = page.locator('.pr-sector-development [data-presidency-order]');
  await expect(commands).toHaveCount(4);
  for (const command of await commands.all()) { await command.evaluate(e => e.scrollIntoView({block:"center"})); await hitTarget(command); }
  await capture(page, info, 'crise-quatre-commandes-accessibles', before);
  await page.locator('[data-presidency-order][data-order="live-pressure-health-recovery"]').click();
  const funded = await saved(page);
  expect(funded.turn).toBe(before.turn);
  expect(funded.finance.investment).toBeGreaterThan(before.finance.investment);
  const preparing = funded.pressure.programmes.find(item => item.sourceChoice === 'live-pressure-health-recovery');
  expect(preparing?.status).toBe('preparing');
  expect(funded.pressure.sectors.health.capacity).toBe(before.pressure.sectors.health.capacity);
  const delivered = await periods(page, 4);
  await pause(page);
  expect(delivered.pressure.programmes.find(item => item.id === preparing.id).status).toBe('active');
  const control = reconstruct({ ...inputs, choices: [...inputs.choices, ...Array.from({ length: 4 }, () => 'live-tick')] });
  expect(delivered.pressure.sectors.health.backlog).toBeLessThan(control.pressure.sectors.health.backlog);
  await capture(page, info, 'rattrapage-livre-repit-effectif', delivered);
});
