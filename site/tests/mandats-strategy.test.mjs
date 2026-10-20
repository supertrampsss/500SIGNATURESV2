import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Authored before the v17 implementation: docs/mandats-strategy-v17.md and the
// owner's October 19 acceptance brief. A browser clock changes elapsed time;
// saved legal inputs are decoded through the public importer, never by injecting
// balances, ministers, victories or a production test-only engine entry point.
const KEY = '500signatures.mandats.v1';
const BASE = { version: 17, mode: 'national', seed: 0, ambition: 'equilibre', choices: [] };
const SECTORS = ['health', 'housing', 'transport', 'energy', 'education', 'administration'];
const PERIOD_MS = 30_000;
const moduleURL = new URL('../src/mandats/storage.ts', import.meta.url).href;
const decoded = new Map();
const pageErrors = new WeakMap();
const sourceFiles = ['presidency-strategy-engine.ts', 'presidency-strategy-content.ts', 'presidency-strategy-types.ts',
  'engine.ts', 'pressure-engine.ts', 'storage.ts', 'presidency-api.ts', 'presidency-runtime.ts', 'presidency-view.ts'];
let sourceManifest;
async function sources() {
  if (!sourceManifest) sourceManifest = Promise.all(sourceFiles.map(async name => [name,
    createHash('sha256').update(await readFile(new URL(`../src/mandats/${name}`, import.meta.url))).digest('hex')]))
    .then(entries => Object.fromEntries(entries));
  return sourceManifest;
}

test.beforeEach(async ({ page }) => {
  const errors = []; pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(async ({ page }, info) => {
  const errors = pageErrors.get(page) ?? [];
  if (errors.length) await info.attach('browser-javascript-errors', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors, 'The actual browser must not report unhandled JavaScript errors during the journey.').toEqual([]);
});

function reconstruct(value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  if (!decoded.has(raw)) decoded.set(raw, JSON.parse(execFileSync(process.execPath,
    ['--experimental-strip-types', '--input-type=module', '-e',
      `import{decode}from${JSON.stringify(moduleURL)};let raw='';for await(const p of process.stdin)raw+=p;process.stdout.write(JSON.stringify(decode(raw)));`],
    { input: raw, encoding: 'utf8' })));
  return decoded.get(raw);
}
async function rawSave(page) { return page.evaluate(key => localStorage.getItem(key), KEY); }
async function saved(page) {
  const raw = await rawSave(page); expect(raw).toBeTruthy();
  const state = reconstruct(raw); expect(state).toBeTruthy(); return state;
}
async function setup(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.pauseAt(Date.now());
}
async function ready(page, version = 17) {
  await expect(page.locator('section[data-presidency]')).toBeVisible();
  await expect(page.locator('section[data-presidency]')).toHaveAttribute('data-version', String(version));
  await expect(page.locator('[data-presidency-clock]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
async function start(page) {
  await setup(page);
  await page.goto('/mandats/');
  await page.getByRole('button', { name: /^Commencer/ }).click();
  await ready(page);
  expect((await saved(page)).version).toBe(17);
}
async function load(page, inputs = BASE) {
  await setup(page);
  await page.goto('/mandats/');
  await importInputs(page, inputs);
}
async function importInputs(page, inputs) {
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'mandat-inputs.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(inputs)) });
  await ready(page, inputs.version);
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'true');
  expect((await saved(page)).choices).toEqual(inputs.choices);
  await page.clock.runFor(4_501); // Dismiss the import receipt while time remains paused.
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
  await page.clock.runFor(count * (PERIOD_MS / speed + 100) + 1);
  await expect(page.locator('section[data-presidency]')).toHaveAttribute('data-turn', String(Math.min(30, before.turn + count)));
  return saved(page);
}
async function closeSurface(page) {
  const fan = page.locator('[data-live-fan] [data-action="presidency-deselect"]');
  if (await fan.isVisible()) await fan.click();
  else await page.getByRole('dialog').getByRole('button', { name: 'Fermer et revenir au pays', exact: true }).click();
}
async function openFront(page, sector) {
  // V17 deliberately keeps a sector open after an order so its real delivery
  // remains readable. Reopening that same control would otherwise toggle it shut.
  if (await page.locator(`[data-presidency-commands] [data-strategy-sector="${sector}"]`).isVisible()) return;
  await page.locator(`[data-presidency-front="${sector}"]`).click();
  await page.clock.runFor(32);
  await expect(page.locator('[data-presidency-commands]')).toBeVisible();
}
async function hitTarget(locator) {
  await expect(locator).toBeInViewport({ ratio: 1 });
  expect(await locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return !!hit && (hit === element || element.contains(hit));
  })).toBe(true);
}
async function activate(page, selector) {
  const command = page.locator(selector).first();
  await expect(command).toBeEnabled();
  await command.scrollIntoViewIfNeeded();
  await command.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
  await hitTarget(command);
  const before = await saved(page), id = await command.getAttribute('data-order');
  await command.click();
  await expect.poll(async () => JSON.parse(await rawSave(page)).choices.length).toBe(before.choices.length + 1);
  const after = await saved(page);
  expect(after.choices.at(-1)).toBe(id); expect(after.turn).toBe(before.turn);
  return after;
}
async function order(page, sector, kind) {
  await openFront(page, sector);
  return activate(page, `[data-presidency-order][data-order="s17-${sector}-${kind}"]`);
}
function terminal(game) { return game.turn >= 30 || Boolean(game.politics?.ending); }
async function cabinetAction(page, id) {
  await page.locator('[data-action="presidency-panel"][data-panel="government"]').click();
  const command = page.locator(`[data-presidency-panel="government"] [data-presidency-order][data-order="${id}"]`).first();
  const available = await command.count() && await command.isEnabled();
  const game = available ? await activate(page, `[data-presidency-panel="government"] [data-presidency-order][data-order="${id}"]`) : null;
  await closeSurface(page);
  return game;
}
// A bounded player policy uses advertised service stocks, inherited workload
// and already financed delivery. It does not buy a network on a calendar date
// or count a temporary reinforcement as permanent future capacity.
function futureMargin(game, sector) {
  const front = game.pressure.sectors[sector], state = game.presidency.strategy, local = state.sectors[sector];
  let capacity = front.capacity, need = front.need + Math.max(0, local.demandForecast.at(-1) - local.appliedDemand);
  for (const programme of game.pressure.programmes.filter(item => item.sector === sector)) {
    if (programme.duration && programme.status === 'active') {
      capacity -= programme.appliedCapacity ?? 0; need -= programme.appliedNeed ?? 0;
    } else if (!programme.duration && programme.status === 'preparing') {
      capacity += programme.capacity ?? 0; need += programme.need ?? 0;
    }
  }
  for (const commitment of state.commitments.filter(item => item.status === 'preparing')) {
    for (const link of commitment.spillovers.filter(item => item.sector === sector)) {
      capacity += link.capacity ?? 0; need += link.need ?? 0;
    }
  }
  return capacity - need - Math.max(0, front.incomingNeed - front.need);
}
function policyWanted(game, policy) {
  const state = game.presidency.strategy;
  const score = sector => game.pressure.sectors[sector].pressure + 6 * Math.max(0, -futureMargin(game, sector));
  const ranked = [...SECTORS].sort((a, b) => score(b) - score(a));
  const preparingTeams = state.commitments.filter(item => item.status === 'preparing').reduce((sum, item) => sum + item.teams, 0);
  const emergencies = [], networks = [], foundations = [];
  for (const sector of ranked) {
    const front = game.pressure.sectors[sector], current = state.sectors[sector], margin = futureMargin(game, sector);
    if (front.backlog > 30) emergencies.push({ sector, kind: 'recovery' });
    if (current.phase === 'conflict' || front.fatigue > 55) emergencies.push({ sector, kind: 'agreement' });
    if (preparingTeams >= game.pressure.execution.capacity && front.pressure < 60) continue;
    const transformed = current.transformations.some(item => item.kind === 'capacity' || item.kind === 'organisation'
      || item.kind === 'legislation' && (item.capacity > 0 || item.need < 0));
    if (transformed && (margin < .5 || front.pressure >= 40)) networks.push({ sector, kind: 'network' });
    if (margin < 0 || front.pressure > 45) foundations.push({ sector, kind: policy === 'organisation' ? 'organisation' : 'capacity' });
  }
  return [...emergencies, ...foundations.filter(item => game.pressure.sectors[item.sector].pressure >= 60), ...networks, ...foundations];
}
async function policyCommands(page, policy) {
  let game = await saved(page);
  if (policy === 'inaction' || (policy === 'late-correction' && game.turn < 8)) return game;
  for (let count = 0; count < 2; count++) {
    let issued = false, needsCompromise = false, needsCredits = false;
    const wanted = policyWanted(game, policy).filter(({ sector, kind }) =>
      !game.presidency.strategy.commitments.some(item => item.choice === `s17-${sector}-${kind}`));
    for (const { sector, kind } of wanted) {
      await openFront(page, sector);
      const command = page.locator(`[data-presidency-order][data-order="s17-${sector}-${kind}"]`);
      if (await command.count() && await command.isEnabled()) {
        game = await activate(page, `[data-presidency-order][data-order="s17-${sector}-${kind}"]`);
        issued = true;
      } else if (await command.count()) {
          // Conditions remain available on demand. Consult the real disclosure
          // before reading a blocked action's advertised engagement, as a player
          // does; innerText is empty inside a closed HTML details element.
          const locked = page.locator(`[data-live-disclosure="locked-${sector}"]`);
          if (await locked.count() && !(await locked.evaluate(element => element.open))) {
            await locked.locator(':scope > summary').scrollIntoViewIfNeeded();
            await locked.locator(':scope > summary').click();
          }
          const reason = await command.locator('.pr-command__unavailable').textContent() ?? '';
          needsCompromise ||= /compromis politique|gouvernement/.test(reason);
          const cost = command.locator('[data-order-cost]');
          await cost.scrollIntoViewIfNeeded(); await expect(cost).toBeVisible();
          const number = (await cost.innerText()).match(/\d+(?:[,.]\d+)?/);
          needsCredits ||= /disponibles.*nécessaires/.test(reason)
            && Boolean(number && Number(number[0].replace(',', '.')) > game.presidency.reserve + 1e-8);
      }
      if (issued) break;
    }
    // Keep one inspection surface through the candidate list instead of closing
    // and reopening it after every unavailable option. Saved orders are unchanged.
    if (await page.locator('[data-live-fan] [data-action="presidency-deselect"]').isVisible()) await closeSurface(page);
    // A President negotiates or requests financing when a real desired
    // orientation is blocked. These are saved orders within the same two-order
    // period budget, never automatic credits or a hidden winning trajectory.
    if (!issued && needsCompromise) {
      const negotiated = await cabinetAction(page, 's17-coalition-pact');
      if (negotiated) { game = negotiated; issued = true; }
    }
    if (!issued && needsCredits) {
      const voted = await cabinetAction(page, 'live-credits');
      if (voted) { game = voted; issued = true; }
    }
    if (!issued) break;
  }
  return game;
}
async function playMandate(page, info, policy, label) {
  let game = await saved(page);
  const periodsPlayed = [];
  // Use the public speed control for the complete campaigns, and stop the
  // country while reading and planning. The three-minute opening stays at ×1.
  await pause(page);
  await page.locator('[data-action="presidency-speed"][data-speed="4"]').click();
  await expect(page.locator('[data-action="presidency-speed"][data-speed="4"]')).toHaveAttribute('aria-pressed', 'true');
  while (!terminal(game)) {
    const firstJournalIndex = game.choices.length;
    game = await policyCommands(page, policy);
    game = await periods(page, 1, 4); await pause(page); resourceBounds(game);
    periodsPlayed.push({ period: game.turn, phase: game.presidency.strategy.phase,
      speed: 4, planningPaused: true,
      orders: game.choices.slice(firstJournalIndex).filter(id => id !== 'live-tick'),
      reserve: game.presidency.reserve, teams: game.pressure.execution,
      sectors: Object.fromEntries(SECTORS.map(id => [id, { pressure: game.pressure.sectors[id].pressure,
        backlog: game.pressure.sectors[id].backlog, phase: game.presidency.strategy.sectors[id].phase }])) });
    if ([6, 18, 30].includes(game.turn) || terminal(game)) await capture(page, info, `${label}-periode-${game.turn}`, game);
  }
  await writeFile(info.outputPath(`${label}-progression.json`), JSON.stringify(periodsPlayed, null, 2));
  return game;
}
async function capture(page, info, label, game = undefined) {
  const state = game ?? await saved(page);
  const screenshot = info.outputPath(`${label}.png`), file = info.outputPath(`${label}.json`);
  const durable = await rawSave(page);
  // The browser clock is already frozen. Leave the country's running state and
  // stamp untouched, preserving even the remainder between scheduled ticks.
  await page.screenshot({ path: screenshot, fullPage: true, animations: 'allow', timeout: 45_000 });
  expect(await rawSave(page)).toBe(durable);
  await writeFile(file, JSON.stringify({ url: page.url(), project: info.project.name, viewport: page.viewportSize(),
    evidence: 'Agent browser journey, not an external human playtest', sources: await sources(), inputs: {
      version: state.version, mode: state.mode, seed: state.seed, ambition: state.ambition, choices: state.choices }, state }, null, 2));
  await info.attach(label, { path: screenshot, contentType: 'image/png' });
  await info.attach(`${label}-legal-inputs-and-state`, { path: file, contentType: 'application/json' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
async function refuseStorage(page) {
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    window.__restoreStrategyStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Stockage indisponible pendant le mandat', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, KEY);
}
function resourceBounds(game) {
  const { presidency: p, pressure } = game;
  expect(p.reserve).toBeGreaterThanOrEqual(-1e-8);
  expect(p.spent).toBeGreaterThanOrEqual(0);
  expect(p.reserve + p.spent).toBeCloseTo(p.authorised, 6);
  expect(pressure.execution.used).toBeGreaterThanOrEqual(0);
  expect(pressure.execution.used).toBeLessThanOrEqual(pressure.execution.capacity + 1e-8);
  for (const programme of pressure.programmes) expect(programme.remainingWork).toBeGreaterThanOrEqual(-1e-8);
}

test('three opening minutes reveal a working government, real costs and a comprehensible objective without cabinet setup', async ({ page }, info) => {
  await start(page);
  const before = await saved(page);
  expect(before.turn).toBe(0);
  await expect(page.locator('[data-live-objective]')).toBeVisible();
  await expect(page.locator('[data-strategy-phase]')).toBeVisible();
  await expect(page.locator('[data-live-objective]')).toContainText(/objectif|mandat|services/i);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(Object.values(before.pressure.sectors).filter(front => front.pressure >= 75).length).toBeLessThanOrEqual(2);
  resourceBounds(before);
  await capture(page, info, 'lancement-pays-constitue', before);
  await page.clock.runFor(60_001);
  const minute = await saved(page);
  expect(minute.turn).toBe(2);
  expect(minute.presidency.initiatives.some(item => item.actor === 'government' && item.cost > 0)).toBe(true);
  expect(minute.presidency.spent).toBeGreaterThan(before.presidency.spent);
  expect(minute.pressure).not.toEqual(before.pressure);
  resourceBounds(minute);
  await capture(page, info, 'une-minute-sans-clic-ministres-au-travail', minute);
  await page.clock.runFor(120_001);
  const three = await saved(page);
  expect(three.turn).toBe(6);
  expect(three.choices.every(id => id === 'live-tick')).toBe(true);
  resourceBounds(three);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-live-headline]')).toBeVisible();
  await capture(page, info, 'trois-minutes-autonomie-et-causes', three);
});

test('six fronts expose cost, delay and consequences before a two-gesture order and keep the map reachable', async ({ page }, info) => {
  await load(page);
  const before = await saved(page);
  for (const sector of SECTORS) {
    const front = page.locator(`[data-presidency-front="${sector}"]`);
    await expect(front).toHaveAccessibleName(/pression/i);
    await hitTarget(front); await front.click(); await page.clock.runFor(32);
    const firstAvailable = page.locator('[data-presidency-commands] [data-presidency-order][data-order^="s17-"]:not([disabled]):visible').first();
    await hitTarget(firstAvailable); // A common action is reachable without an extra scroll/disclosure gesture.
    if (sector === 'health') await capture(page, info, 'sante-commandes-et-effets-avant-engagement');
    const locked = page.locator(`[data-live-disclosure="locked-${sector}"]`);
    if (await locked.count()) {
      await locked.locator(':scope > summary').scrollIntoViewIfNeeded();
      await locked.locator(':scope > summary').click();
    }
    const commands = page.locator('[data-presidency-commands] [data-presidency-order]');
    expect(await commands.count()).toBeGreaterThan(0);
    for (const command of await commands.all()) {
      await command.scrollIntoViewIfNeeded();
      await expect(command.locator('[data-order-cost]')).toHaveText(/\S/);
      await expect(command.locator('[data-order-delay]')).toHaveText(/\S/);
      await expect(command.locator('[data-order-effect]')).toHaveText(/\S/);
      if (await command.isEnabled()) await hitTarget(command);
    }
    await closeSurface(page);
    expect(await saved(page)).toEqual(before);
  }
  await expect(page.locator('[data-action="presidency-panel"][data-panel="reforms"]')).toBeVisible();
  await page.locator('[data-action="presidency-panel"][data-panel="reforms"]').click();
  await expect(page.locator('[data-live-reform]').first()).toBeVisible();
  await capture(page, info, 'reformes-accessibles-avec-conditions');
  await closeSurface(page);
  await openFront(page, 'health');
  const priority = page.locator('[data-presidency-order][data-order="live-priority-health"]');
  await priority.scrollIntoViewIfNeeded();
  await priority.focus(); await page.keyboard.press('Enter');
  const instructed = await saved(page);
  expect(instructed.turn).toBe(0); expect(instructed.presidency.priority).toBe('health');
  expect(instructed.choices).toEqual(['live-priority-health']);
  await capture(page, info, 'priorite-persistante-clavier');
});

test('a structural order engages shared finite resources once, waits for actual teams and survives a double activation', async ({ page }, info) => {
  await load(page);
  const before = await saved(page);
  await openFront(page, 'health');
  const command = page.locator('[data-presidency-order][data-order="s17-health-capacity"]');
  await expect(command).toBeEnabled(); await command.scrollIntoViewIfNeeded(); await hitTarget(command);
  if (info.project.name === 'desktop') await command.dblclick({ delay: 20 });
  else {
    // A native WebKit double tap sends two click events whose detail is both 1.
    // Reuse the physical coordinates after the first render, as a finger does.
    const box = await command.boundingBox(); expect(box).toBeTruthy();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.touchscreen.tap(x, y); await page.touchscreen.tap(x, y);
  }
  const funded = await saved(page);
  expect(funded.turn).toBe(0);
  expect(funded.choices.filter(id => id === 's17-health-capacity')).toHaveLength(1);
  const commitment = funded.presidency.strategy.commitments.find(item => item.choice === 's17-health-capacity');
  expect(commitment).toBeTruthy(); expect(commitment.cost).toBeGreaterThan(0);
  expect(commitment.status).toBe('preparing');
  expect(funded.presidency.reserve).toBeCloseTo(before.presidency.reserve - commitment.cost, 6);
  expect(funded.presidency.spent).toBeCloseTo(before.presidency.spent + commitment.cost, 6);
  expect(funded.pressure.sectors.health.capacity).toBe(before.pressure.sectors.health.capacity);
  expect(funded.presidency.strategy.sectors.health.transformations).toHaveLength(0);
  resourceBounds(funded);
  await capture(page, info, 'engagement-unique-equipes-et-livraison-attendue', funded);
  let delivered = funded;
  for (let i = 0; i < 4; i++) {
    delivered = await periods(page); resourceBounds(delivered);
  }
  await pause(page);
  const actual = delivered.presidency.strategy.commitments.find(item => item.choice === commitment.choice);
  expect(actual.status).toBe('delivered'); expect(actual.deliveredPeriod).toBeGreaterThan(0);
  expect(delivered.pressure.sectors.health.capacity).toBeGreaterThan(before.pressure.sectors.health.capacity);
  await openFront(page, 'health');
  const duplicate = page.locator('[data-presidency-order][data-order="s17-health-capacity"]');
  if (await duplicate.count()) await expect(duplicate).toBeDisabled();
  expect((await saved(page)).choices.filter(id => id === 's17-health-capacity')).toHaveLength(1);
  await capture(page, info, 'capacite-durable-effectivement-en-service', delivered);
});

test('pause, menus, speed and tab visibility preserve time without a return catch-up', async ({ page }, info) => {
  await load(page);
  const before = await rawSave(page);
  await page.clock.runFor(180_001); expect(await rawSave(page)).toBe(before);
  await resume(page);
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'true');
  await page.clock.runFor(180_001); expect(await rawSave(page)).toBe(before);
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'false');
  await page.clock.runFor(PERIOD_MS - 101); expect((await saved(page)).turn).toBe(0);
  await page.clock.runFor(202); expect((await saved(page)).turn).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'true');
  const hidden = await rawSave(page); await page.clock.runFor(180_001);
  expect(await rawSave(page)).toBe(hidden);
  await page.evaluate(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
  expect((await saved(page)).turn).toBe(1);
  await page.locator('[data-action="presidency-speed"][data-speed="4"]').click();
  const accelerated = await periods(page, 2, 4); await pause(page);
  const normal = reconstruct({ ...BASE, choices: Array(3).fill('live-tick') });
  expect(accelerated).toEqual(normal);
  await capture(page, info, 'pause-vitesse-retour-onglet-etat-identique', accelerated);
});

test('a rejected save never publishes a country change or consumes resources and recovery resumes from the durable state', async ({ page }, info) => {
  await load(page);
  const before = await saved(page), raw = await rawSave(page);
  await refuseStorage(page); await resume(page); await page.clock.runFor(PERIOD_MS + 101);
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'true');
  expect(await rawSave(page)).toBe(raw);
  await expect(page.locator('section[data-presidency]')).toHaveAttribute('data-turn', String(before.turn));
  await expect(page.locator('[data-live-feedback][data-failure="true"]')).toContainText(/sauvegard|stockage|enregistr/i);
  await capture(page, info, 'quota-pays-durable-conserve');
  await page.evaluate(() => window.__restoreStrategyStorage());
  const resumed = await periods(page); await pause(page); expect(resumed.turn).toBe(1);
  const durable = await rawSave(page);
  await refuseStorage(page); await openFront(page, 'health');
  await page.locator('[data-presidency-order][data-order="live-priority-health"]').click();
  expect(await rawSave(page)).toBe(durable); expect(await saved(page)).toEqual(resumed);
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'true');
  await capture(page, info, 'ordre-non-enregistre-aucune-ressource-consommee');
  await page.evaluate(() => window.__restoreStrategyStorage());
});

test('a shared preview stays read-only until adoption and keeps the private government intact', async ({ page }, info) => {
  await load(page, { ...BASE, choices: ['live-priority-health', 'live-tick'] });
  const privateRaw = await rawSave(page);
  await page.goto('/mandats/?mode=national&v=17&seed=7&ambition=equilibre'); await ready(page);
  await page.clock.runFor(180_001); expect(await rawSave(page)).toBe(privateRaw);
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'true');
  await page.getByRole('button', { name: 'Jouer ce mandat', exact: true }).click();
  expect((await saved(page)).seed).toBe(7);
  const game = await periods(page); await pause(page);
  expect(game.choices).toEqual(['live-tick']);
  await capture(page, info, 'defi-v17-adopte-explicitement', game);
});

test('export, reload, v16 import and causal replay preserve their own versioned inputs', async ({ page }, info) => {
  test.skip(!['desktop', 'mobile'].includes(info.project.name), 'Desktop and touch cover the same importer/replay; all four formats cover the live strategy board.');
  await load(page, { ...BASE, choices: ['live-priority-health'] });
  await periods(page, 3); await pause(page);
  const original = await saved(page);
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter la sauvegarde', exact: true }).click();
  const exported = await readFile(await (await event).path(), 'utf8');
  await writeFile(info.outputPath('mandat-v17-export.json'), exported);
  expect(JSON.parse(exported)).not.toHaveProperty('finance'); expect(reconstruct(exported)).toEqual(original);
  await page.reload(); await page.getByRole('button', { name: 'Reprendre', exact: true }).click(); await ready(page);
  expect(await saved(page)).toEqual(original);
  const old = { ...BASE, version: 16, seed: 47, choices: Array(3).fill('live-tick') };
  await importInputs(page, old); expect(await saved(page)).toEqual(reconstruct(old));
  await capture(page, info, 'v16-historique-conservee');
  await importInputs(page, JSON.parse(exported)); expect(await saved(page)).toEqual(original);
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'mandat-incompatible.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...BASE, version: 99 })) });
  await expect(page.getByRole('dialog').getByRole('status')).toContainText(/invalide|incompatible|impossible|reconnue|non pris en charge/i);
  expect(await saved(page)).toEqual(original);
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.getByRole('button', { name: 'Rejouer un ordre et comparer', exact: true }).click();
  await expect(page.locator('.presidency-replay')).toBeVisible();
  expect(await saved(page)).toEqual(original);
  const branch = page.locator('[data-action="branch-replay"]').first();
  const index = Number(await branch.getAttribute('data-turn')); await branch.click(); await ready(page);
  const branched = await saved(page);
  expect(branched).toEqual(reconstruct({ ...BASE, choices: original.choices.slice(0, index) }));
  await capture(page, info, 'replay-v17-prefixe-causal', branched);
});

test('the prepared strategy remains playable offline and delivers a real ministerial intervention', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'mobile', 'One real service-worker lifecycle; every format covers saved state and autonomous delivery.');
  await load(page);
  const before = await saved(page);
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.getByRole('dialog').locator('summary').filter({ hasText: 'Jouer hors connexion' }).click();
  await page.getByRole('button', { name: 'Préparer le jeu hors connexion', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('prêt hors connexion', { timeout: 45_000 });
  const illustration = await page.locator('[data-presidency-art]').evaluate(image => new URL(image.currentSrc).pathname);
  const cached = await page.evaluate(async () => {
    const keys = (await caches.keys()).filter(key => key.startsWith('mandats-offline-'));
    return (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(request => new URL(request.url).pathname)))).flat();
  });
  expect(cached).toContain(illustration);
  await context.setOffline(true);
  try {
    await page.reload(); await page.getByRole('button', { name: 'Reprendre', exact: true }).click(); await ready(page);
    expect(await saved(page)).toEqual(before);
    await expect.poll(() => page.locator('[data-presidency-art]').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    const delivered = await periods(page, 4); await pause(page);
    expect(delivered.presidency.initiatives.some(item => item.actor === 'government' && item.cost > 0)).toBe(true);
    expect(delivered.pressure.programmes.some(item => item.deliveredTurn !== undefined)).toBe(true);
    resourceBounds(delivered);
    await capture(page, info, 'strategie-livraison-reelle-hors-connexion', delivered);
  } finally { await context.setOffline(false); }
});

test('two full presidential strategies succeed from the same country with different financial and service compromises', async ({ page }, info) => {
  test.setTimeout(300_000);
  test.skip(info.project.name !== 'desktop', 'Two full strategic campaigns; the four formats independently play autonomy, orders and delayed delivery.');
  await load(page);
  const outcomes = {};
  for (const policy of ['capacity', 'organisation']) {
    if (policy !== 'capacity') await importInputs(page, BASE);
    const ended = await playMandate(page, info, policy, `strategie-${policy}`);
    expect(ended.turn).toBe(30);
    expect(ended.history.filter(item => item.closed)).toHaveLength(5);
    await expect(page.locator('[data-strategy-verdict]')).toHaveAttribute('data-strategy-verdict', 'success');
    const transforms = Object.values(ended.presidency.strategy.sectors).flatMap(sector => sector.transformations);
    expect(transforms.filter(item => item.kind === policy).length).toBeGreaterThanOrEqual(3);
    expect(ended.choices.some(id => id.endsWith('-network'))).toBe(true);
    const durable = await rawSave(page); await page.clock.runFor(120_001); expect(await rawSave(page)).toBe(durable);
    outcomes[policy] = ended;
    await capture(page, info, `bilan-reussite-${policy}`, ended);
  }
  expect(outcomes.capacity.seed).toBe(outcomes.organisation.seed);
  expect(outcomes.capacity.presidency.spent).toBeGreaterThan(outcomes.organisation.presidency.spent);
  expect(outcomes.capacity.pressure.sectors).not.toEqual(outcomes.organisation.pressure.sectors);
  expect(outcomes.capacity.choices).not.toEqual(outcomes.organisation.choices);
  await writeFile(info.outputPath('deux-reussites-meme-depart-compromis-differents.json'), JSON.stringify(outcomes, null, 2));
});

test('suspending operational government can leave a catastrophic failure and pressure is danger rather than achievement', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'One complete legal neglect campaign; four formats cover a functioning autonomous government without presidential orders.');
  // A functioning autonomous cabinet may finish mixed without presidential
  // clicks. This failure branch is the explicit decision to stop its initiatives,
  // followed by neglect; failure must follow actual damage, not absent clicks.
  await load(page, { ...BASE, seed: 47, choices: ['live-autonomy'] });
  const ended = await playMandate(page, info, 'inaction', 'delegation-suspendue-puis-inaction');
  expect(ended.choices).toEqual(['live-autonomy', ...Array(ended.turn).fill('live-tick')]);
  await expect(page.locator('[data-strategy-verdict]')).toHaveAttribute('data-strategy-verdict', 'failure');
  await expect(page.locator('[data-strategy-damages]')).toContainText(/\S/);
  await expect(page.locator('[data-strategy-retry]')).toContainText(/\S/);
  for (const sector of SECTORS)
    await expect(page.locator(`[data-presidency-panel="ending"] [data-strategy-pressure="${sector}"]`)).toHaveCount(1);
  await expect(page.locator('[data-presidency-panel="ending"]')).toContainText(/100 \/ 100 = pression maximale/);
  expect(Object.values(ended.pressure.sectors).some(front => front.pressure >= 90)).toBe(true);
  await expect(page.locator('[data-strategy-verdict]')).not.toContainText('Mandat achevé · cinq ans à la présidence');
  await capture(page, info, 'bilan-echec-et-pressions-sans-ambiguite', ended);
});

test('an early transformation prevents escalation, opens a different national undertaking and retains its effects', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'One controlled prevention counterfactual; all four formats verify delivery and public conditions.');
  await load(page);
  const initial = await saved(page);
  await openFront(page, 'health');
  const locked = page.locator('[data-presidency-order][data-order="s17-health-network"]');
  await expect(locked).toBeDisabled(); await expect(locked).toContainText(/transformation|livr|préalable|service/i);
  await closeSurface(page);
  await order(page, 'health', 'capacity');
  const transformed = await periods(page, 4); await pause(page);
  const untouched = reconstruct({ ...BASE, choices: Array(4).fill('live-tick') });
  expect(transformed.pressure.sectors.health.pressure).toBeLessThan(untouched.pressure.sectors.health.pressure);
  expect(transformed.presidency.strategy.sectors.health.prevention).toBeGreaterThan(initial.presidency.strategy.sectors.health.prevention);
  await openFront(page, 'health');
  await expect(page.locator('[data-order="s17-health-capacity"]')).toBeDisabled();
  const network = page.locator('[data-presidency-order][data-order="s17-health-network"]');
  await expect(network).toBeEnabled();
  await expect(network.locator('[data-order-effect]')).toContainText(/transport|territ|réseau|soins/i);
  await capture(page, info, 'nouvel-arbitrage-apres-transformation', transformed);
  await activate(page, '[data-presidency-order][data-order="s17-health-network"]');
  const networkDelivered = await periods(page, 4); await pause(page);
  const health = networkDelivered.presidency.strategy.sectors.health;
  expect(health.transformations.some(item => item.kind === 'capacity')).toBe(true);
  expect(health.transformations.some(item => item.kind === 'network')).toBe(true);
  const withoutNetwork = reconstruct({ ...BASE, choices: ['s17-health-capacity', ...Array(8).fill('live-tick')] });
  expect(networkDelivered.pressure.sectors.transport.need).toBeLessThan(withoutNetwork.pressure.sectors.transport.need);
  expect(networkDelivered.pressure.sectors.health.capacity).toBeGreaterThan(initial.pressure.sectors.health.capacity);
  await capture(page, info, 'prevention-durable-et-lien-intersectoriel-reel', networkDelivered);
});

test('a delayed presidential correction offers a real recovery window without resetting acquired damage', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'One recoverable late branch; the model audit repeats seeds and independently explores irrecoverable endings.');
  await load(page, { ...BASE, choices: Array(8).fill('live-tick') });
  const delayed = await saved(page);
  expect(delayed.politics?.ending).toBeUndefined();
  let corrected = delayed;
  for (let i = 0; i < 6 && !terminal(corrected); i++) {
    await policyCommands(page, 'late-correction');
    corrected = await periods(page); resourceBounds(corrected);
  }
  await pause(page);
  const withoutCorrection = reconstruct({ ...BASE, choices: Array(corrected.turn).fill('live-tick') });
  const backlog = game => Object.values(game.pressure.sectors).reduce((sum, front) => sum + front.backlog, 0);
  expect(backlog(corrected)).toBeLessThan(backlog(withoutCorrection));
  expect(corrected.presidency.strategy.commitments.some(item => item.sourcePeriod >= 8 && item.status === 'delivered')).toBe(true);
  expect(corrected.presidency.spent).toBeGreaterThan(delayed.presidency.spent);
  expect(corrected.choices.slice(0, delayed.choices.length)).toEqual(delayed.choices);
  expect(corrected.presidency.strategy.initialBacklog).toBe(delayed.presidency.strategy.initialBacklog);
  await capture(page, info, 'correction-tardive-couteuse-mais-utile', corrected);
});

test('capture keeps the installed browser clock frozen and the durable country unchanged',async({page},info)=>{
 await start(page);
 const before=await page.evaluate(()=>({date:Date.now(),performance:performance.now()}));
 const durable=await rawSave(page);
 await page.evaluate(()=>{window.captureTimerFired=false;setTimeout(()=>window.captureTimerFired=true,1);});
 await capture(page,info,'clock-capture-regression');
 expect(await page.evaluate(()=>({date:Date.now(),performance:performance.now()}))).toEqual(before);
 expect(await page.evaluate(()=>window.captureTimerFired)).toBe(false);
 expect(await rawSave(page)).toBe(durable);
 await page.clock.runFor(1);
 expect(await page.evaluate(()=>window.captureTimerFired)).toBe(true);
});
