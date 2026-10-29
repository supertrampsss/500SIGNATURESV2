import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

// Failure hypotheses were recorded in docs/mandats-desk.md before these tests.
// Import public replay inputs through the actual UI; do not inject balances.
const KEY = '500signatures.mandats.v1';
const BASE = { version: 17, mode: 'national', seed: 0, ambition: 'equilibre', choices: [] };
const storageURL = new URL('../src/mandats/storage.ts', import.meta.url).href;
const ledgerURL = new URL('../src/mandats/presidency-api.ts', import.meta.url).href;
const cache = new Map();
function reconstruct(raw) {
  if (!cache.has(raw)) {
    cache.set(raw, JSON.parse(execFileSync(process.execPath,
      ['--experimental-strip-types', '--input-type=module', '-e',
        `import {decode} from ${JSON.stringify(storageURL)}; import {presidencyLedger} from ${JSON.stringify(ledgerURL)}; let raw=''; for await (const part of process.stdin) raw+=part; const game=decode(raw); process.stdout.write(JSON.stringify({game,ledger:presidencyLedger(game)}));`],
      { input: raw, encoding: 'utf8' })));
  }
  return cache.get(raw);
}
async function saved(page) {
  const raw = await page.evaluate(key => localStorage.getItem(key), KEY);
  expect(raw).toBeTruthy();
  return { raw, ...reconstruct(raw) };
}
async function importGame(page, inputs = BASE) {
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'bureau-du-pouvoir.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(inputs)),
  });
  await expect(page.locator('.presidency--desk')).toBeVisible();
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'true');
  await page.clock.runFor(4_501);
  await expect.poll(() => page.locator('[data-presidency-art]').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
}
async function load(page, inputs = BASE) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.pauseAt(Date.now());
  await page.goto('/mandats/');
  await importGame(page, inputs);
}
async function reachable(locator, scroll = false) {
  if (scroll) await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeInViewport({ ratio: 1 });
  expect(await locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return Boolean(hit && (hit === element || element.contains(hit)));
  })).toBe(true);
}
async function indicators(page, state) {
  const deficit = page.locator('[data-live-deficit]');
  const confidence = page.locator('[data-live-confidence]');
  await expect(deficit).toBeVisible();
  await expect(confidence).toBeVisible();
  expect(Number(await deficit.getAttribute('data-value'))).toBeCloseTo(state.ledger.deficit, 7);
  expect(Number(await confidence.getAttribute('data-value'))).toBe(state.game.metrics.trust);
  // Also inspect rendered text. An accurate hidden attribute cannot conceal a mockup number.
  const number = async locator => Number((await locator.innerText()).replace(/\s/g, '').replace(',', '.').match(/-?\d+(?:\.\d+)?/)?.[0]);
  expect(Math.abs(await number(deficit) - state.ledger.deficit)).toBeLessThanOrEqual(.51);
  expect(Math.abs(await number(confidence) - state.game.metrics.trust)).toBeLessThanOrEqual(.51);
}
async function readableCommand(command) {
  // A long phone dossier can legitimately require scrolling. Every decision
  // term and its explicit action must be reachable in the real scroll surface.
  for (const part of await command.locator('strong, [data-order-cost], [data-order-annual], [data-order-delay], [data-order-effect], .pr-command__cta').all())
    await reachable(part, true);
  return command.locator('.pr-command__cta');
}
async function mapTargets(page) {
  const country = await page.locator('.pr-country').boundingBox();
  expect(country).toBeTruthy();
  const boxes = [];
  for (const target of await page.locator('.pr-country .pr-pin:visible').all()) {
    await reachable(target);
    const box = await target.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(country.x - 1);
    expect(box.y).toBeGreaterThanOrEqual(country.y - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(country.x + country.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(country.y + country.height + 1);
    for (const other of boxes) {
      const overlapWidth = Math.min(box.x + box.width, other.x + other.width) - Math.max(box.x, other.x);
      const overlapHeight = Math.min(box.y + box.height, other.y + other.height) - Math.max(box.y, other.y);
      expect(overlapWidth <= 1 || overlapHeight <= 1, 'Visible map targets must not cover one another').toBe(true);
    }
    boxes.push(box);
  }
  // In a low map, the real six sector shortcuts remain the reliable entry path.
  for (const front of await page.locator('[data-presidency-front]').all()) await reachable(front);
}
async function capture(page, info, name) {
  const state = await saved(page);
  const screenshot = info.outputPath(`${name}.png`);
  const replay = info.outputPath(`${name}.json`);
  await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' });
  await writeFile(replay, JSON.stringify({
    browser: info.project.name, viewport: page.viewportSize(), url: page.url(),
    inputs: JSON.parse(state.raw), game: state.game, ledger: state.ledger,
  }, null, 2));
  await info.attach(name, { path: screenshot, contentType: 'image/png' });
  await info.attach(`${name}-replay`, { path: replay, contentType: 'application/json' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

test('the presidential desk shows the saved country and its accounts after an actual investment', async ({ page }, info) => {
  await load(page);
  const initial = await saved(page);
  await indicators(page, initial);
  await expect(page.locator('[data-presidency-art]')).toHaveAttribute('src', '/mandats/art/desk-france.webp');
  for (const panel of ['reforms', 'government', 'balance'])
    await reachable(page.locator(`.pr-navigation [data-panel="${panel}"]`));
  await mapTargets(page);
  await capture(page, info, 'bureau-au-debut-du-mandat');

  await page.locator('[data-presidency-front="health"]').click();
  const order = page.locator('[data-presidency-commands] [data-order="s17-health-capacity"]');
  await expect(order).toBeEnabled();
  const action = await readableCommand(order);
  await capture(page, info, 'dossier-sante-investissement-accessible');
  await action.click();
  await expect.poll(async () => (await saved(page)).game.choices.length).toBe(initial.game.choices.length + 1);
  const invested = await saved(page);
  expect(invested.game.turn).toBe(initial.game.turn);
  expect(invested.game.choices.at(-1)).toBe('s17-health-capacity');
  expect(invested.game.presidency.reserve).toBeLessThan(initial.game.presidency.reserve);
  expect(invested.game.finance.investment).toBeGreaterThan(initial.game.finance.investment);
  await indicators(page, invested);

  await page.locator('.pr-navigation [data-panel="balance"]').click();
  const balance = page.locator('[data-presidency-panel="balance"]');
  await expect(balance).toBeVisible();
  const accounts = balance.locator('[data-account="deficit"]');
  // The annual account may use an explicit disclosure; open it as a player would.
  if (!await accounts.isVisible()) await balance.locator('[data-live-disclosure="accounts"] > summary').click();
  await reachable(accounts, true);
  expect(Number(await accounts.getAttribute('data-value'))).toBeCloseTo(invested.ledger.deficit, 7);
  expect((await saved(page)).game.turn).toBe(initial.game.turn);
  await capture(page, info, 'bilan-du-mandat-en-cours');
  await balance.getByRole('button', { name: 'Fermer et revenir au pays', exact: true }).click();

  const otherInputs = { ...BASE, seed: 7, choices: ['live-autonomy', ...Array(10).fill('live-tick')] };
  await importGame(page, otherInputs);
  const other = await saved(page);
  await indicators(page, other);
  expect(other.ledger.deficit).not.toBe(initial.ledger.deficit);
  await mapTargets(page);
  await capture(page, info, 'bureau-autre-trajectoire-reelle');

  // An explicitly opened activity history must retain delivered consequences,
  // even though the desk's compact news feed omits those long descriptions.
  await importGame(page, { ...BASE, choices: ['s17-health-capacity', 'live-tick', 'live-tick'] });
  await page.locator('.pr-navigation [data-panel="government"]').click();
  await page.locator('[data-presidency-panel="government"] [data-live-disclosure="activity"] > summary').click();
  const delivered = page.locator('[data-presidency-panel="government"] .pr-strategy-activity .pr-feed__detail').filter({ hasText: 'Capacité' });
  expect(await delivered.count()).toBeGreaterThan(0);
  for (const detail of await delivered.all()) {
    await expect(detail).toBeVisible();
    await reachable(detail, true);
  }
  await capture(page, info, 'consequences-livrees-au-gouvernement');
});

test('a keyboard decision keeps focus in the phone dossier and returns to its sector on close', async ({ page }) => {
  test.skip(page.viewportSize().width > 650, 'The phone dossier hides the map; desktop keeps both surfaces available.');
  await load(page);
  const before = await saved(page);
  const front = page.locator('[data-presidency-front="health"]');
  await front.focus();
  await page.keyboard.press('Enter');
  const order = page.locator('[data-presidency-commands] [data-order="s17-health-capacity"]');
  await expect(order).toBeFocused();
  await page.keyboard.press('Enter');
  await page.clock.runFor(601);
  expect((await saved(page)).game.choices).toEqual([...before.game.choices, 's17-health-capacity']);
  const close = page.getByRole('button', { name: 'Fermer les commandes', exact: true });
  await expect(close).toBeFocused();
  await expect(page.locator('.pr-country')).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(front).toBeFocused();
  await reachable(front);
  await expect(page.locator('.pr-country')).toBeVisible();
});

test('suggested decisions and national reforms avoid redundant opening clicks', async ({ page }, info) => {
  await load(page);
  if (page.viewportSize().width > 650) {
    const fan = page.locator('[data-presidency-commands]');
    await expect(fan).toBeVisible();
    await expect(page.locator('[data-live-briefing]')).toBeHidden();
    const sector = await fan.locator('[data-strategy-sector]').getAttribute('data-strategy-sector');
    // Selecting the dossier already on the desk must not accidentally close it.
    await page.locator(`[data-presidency-front="${sector}"]`).click();
    await expect(fan).toBeVisible();
    const before = await saved(page);
    const decision = fan.locator('[data-presidency-order]:enabled').first();
    const id = await decision.getAttribute('data-order');
    const action = await readableCommand(decision);
    await action.click();
    expect((await saved(page)).game.choices).toEqual([...before.game.choices, id]);
    expect((await saved(page)).game.turn).toBe(before.game.turn);
  } else {
    await expect(page.locator('[data-live-fan]')).toBeHidden();
    await expect(page.locator('.pr-country')).toBeVisible();
  }
  await page.locator('.pr-navigation [data-panel="reforms"]').click();
  const panel = page.locator('[data-presidency-panel="reforms"]');
  await expect(panel.locator('[data-live-reform][open]')).toHaveCount(1);
  await expect(panel.locator('[data-live-reform^="strategy-"]')).toHaveCount(0);
  await expect(panel.locator('.pr-strategy-sector-links [data-sector]')).toHaveCount(6);
  const choice = panel.locator('[data-live-reform][open] [data-presidency-order]:enabled').first();
  const id = await choice.getAttribute('data-order');
  const action = await readableCommand(choice);
  const before = await saved(page);
  await capture(page, info, 'reforme-directement-accessible');
  await action.click();
  expect((await saved(page)).game.choices).toEqual([...before.game.choices, id]);
  expect((await saved(page)).game.turn).toBe(before.game.turn);
});

test('a crisis dossier keeps its last response and reform folder reachable while reading pauses the country', async ({ page }, info) => {
  await load(page, { ...BASE, choices: ['live-autonomy', ...Array(10).fill('live-tick')] });
  const before = await saved(page);
  expect(before.game.pressure.sectors.health.stage).toBe('crisis');
  await page.locator('[data-action="presidency-pause"]').click();
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'false');
  await page.locator('[data-presidency-front="health"]').click();
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'false');
  await page.locator('[data-live-disclosure="primary-health"] > summary').click();
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'true');
  const choices = page.locator('[data-presidency-commands] [data-presidency-order][data-order^="s17-"]:enabled');
  await expect(choices).toHaveCount(4);
  for (const choice of await choices.all()) await readableCommand(choice);
  await page.clock.runFor(60_001);
  expect((await saved(page)).raw).toBe(before.raw);
  await capture(page, info, 'dernier-arbitrage-crise-accessible');

  const reforms = page.locator('.pr-navigation [data-panel="reforms"]');
  await reachable(reforms);
  await reforms.click();
  await expect(page.locator('[data-presidency-panel="reforms"]')).toBeVisible();
  const firstReform = page.locator('[data-live-reform][open]');
  await expect(firstReform).toHaveCount(1);
  const lastAnswer = firstReform.locator('[data-presidency-order]').last();
  await readableCommand(lastAnswer);
  await capture(page, info, 'reforme-ouverte-depuis-le-dossier');
  await page.clock.runFor(60_001);
  expect((await saved(page)).raw).toBe(before.raw);
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer et revenir au pays', exact: true }).click();
  await expect(page.locator('[data-presidency-clock]')).toHaveAttribute('data-paused', 'false');
  expect((await saved(page)).game.turn).toBe(before.game.turn);
});
