import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

// Failure hypotheses were documented before implementation in
// docs/mandats-pressure-validation.md. Every decision below is a real UI click.
const KEY = '500signatures.mandats.v1';
const SEED = 0;
const decodedInputs = new Map();
const entries = new WeakMap();

function decode(raw) {
  if (decodedInputs.has(raw)) return decodedInputs.get(raw);
  const module = new URL('../src/mandats/storage.ts', import.meta.url).href;
  const game = JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e',
    `import {decode} from ${JSON.stringify(module)};let raw='';for await(const chunk of process.stdin)raw+=chunk;process.stdout.write(JSON.stringify(decode(raw)));`],
  { input: raw, encoding: 'utf8' }));
  decodedInputs.set(raw, game);
  return game;
}
async function stored(page) {
  const raw = await page.evaluate(key => localStorage.getItem(key), KEY);
  const entry = entries.get(page);
  if (!raw) {
    // A deep-link preview deliberately preserves the local save until its first
    // decision. This is the public entry input, never an injected game state.
    if (entry && !entry.adopted) return decode(entry.input);
    throw new Error('La sauvegarde adoptée par une vraie décision a disparu.');
  }
  if (entry) entry.adopted = true;
  return decode(raw);
}
async function open(page, seed = SEED) {
  entries.set(page, { adopted: false, input: JSON.stringify({ version: 14, mode: 'national', seed, ambition: 'equilibre', choices: [] }) });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/mandats/?mode=national&v=14&seed=${seed}&ambition=equilibre`);
  await expect(page.locator('[data-pressure-board]')).toBeVisible();
}
async function nextChapter(page) {
  const button = page.locator('[data-action="next-year"]');
  if (await button.count()) await button.click();
}
async function select(page, id) {
  await nextChapter(page);
  const selector = `[data-action="story-select"][data-story-id="${id}"]`;
  let visible = page.locator(selector).filter({ visible: true });
  if (!(await visible.count())) {
    const containers = page.locator('details').filter({ has: page.locator(selector) });
    for (const container of await containers.all()) {
      if (!(await container.evaluate(element => element.open))) await container.locator(':scope > summary').click();
    }
    visible = page.locator(selector).filter({ visible: true });
  }
  await visible.first().click();
  await expect(page.locator('[data-map-decision]')).toBeVisible();
}
async function choose(page, id) {
  const previousTurn = Number(await page.locator('#mandats').getAttribute('data-turn'));
  expect(Number.isInteger(previousTurn)).toBe(true);
  const selector = `[data-action="choose"][data-choice="${id}"]:not([disabled]),[data-action="choose"][data-choice$="-${id}"]:not([disabled])`;
  const button = page.locator(selector);
  await expect(button).toHaveCount(1);
  await button.click();
  await expect.poll(async () => (await stored(page)).turn).toBe(previousTurn + 1);
  await expect(page.locator('#mandats')).toHaveAttribute('data-turn', String(previousTurn + 1));
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-decision-verdict]')).toBeHidden();
  const game = await stored(page);
  const rendered = await page.locator('[data-pressure-front]').evaluateAll(fronts => Object.fromEntries(fronts.map(front => [front.dataset.pressureFront, Number(front.dataset.pressureLevel)])));
  if (Object.keys(rendered).length) expect(rendered).toEqual(Object.fromEntries(Object.entries(game.pressure.sectors).map(([id, sector]) => [id, sector.pressure])));
  return game;
}
async function clearPoliticalCrisis(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const g = await stored(page);
    if (!g.politics.pendingCrisis) return;
    const front = page.locator('[data-action="story-select"][data-story-id^="institutional:"]').first();
    await expect(front).toBeVisible(); await front.click();
    const candidates = page.locator('[data-action="choose"]');
    const safe = candidates.filter({ hasText: /Publier|Négocier|Former|Reconstruire|Accepter|Retirer/ }).first();
    const button = await safe.count() ? safe : candidates.first();
    await choose(page, await button.getAttribute('data-choice'));
    await nextChapter(page);
  }
  expect((await stored(page)).politics.pendingCrisis).toBeUndefined();
}
async function maintain(page, sector = 'health') {
  await clearPoliticalCrisis(page);
  await select(page, `pressure-${sector}`);
  return choose(page, 'maintain');
}
async function evidence(page, info, label) {
  const game = await stored(page);
  const file = info.outputPath(`${label}.json`);
  await writeFile(file, JSON.stringify({ seed: game.seed, version: game.version, choices: game.choices,
    browser: info.project.name, viewport: info.project.use.viewport,
    pressure: game.pressure, finance: game.finance, politics: game.politics,
    projects: game.narrative.projects, ledgers: game.history.map(turn => ({ year: turn.year, closed: turn.closed, ledger: turn.ledger })) }, null, 2));
  await info.attach(`${label}-replay`, { path: file, contentType: 'application/json' });
  const screenshot = info.outputPath(`${label}.png`);
  await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' });
  await info.attach(label, { path: screenshot, contentType: 'image/png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  return game;
}

test('six persistent fronts, full costs and mobile navigation stay readable without spending a period', async ({ page }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await open(page);
  const before = await stored(page);
  const details = page.locator('details').filter({ has: page.locator('[data-pressure-front]') });
  if (await details.count() && !(await details.first().evaluate(element => element.open))) await details.first().locator('summary').click();
  for (const id of ['health', 'housing', 'transport', 'energy', 'education', 'administration']) {
    const front = page.locator(`[data-pressure-front="${id}"]`);
    await expect(front).toBeVisible();
    await expect(front).toHaveAttribute('data-pressure-stage', /.+/);
    await expect(front).toHaveAttribute('data-pressure-level', /\d/);
  }
  await select(page, 'pressure-health');
  expect(await page.locator('[data-action="choose"]').count()).toBeGreaterThanOrEqual(4);
  await expect(page.locator('[data-action="choose"][data-choice$="-relief"]')).toContainText(/M€|Md€|million/);
  const mapToggle = page.locator('[data-map-toggle]');
  if (await mapToggle.isVisible()) {
    await mapToggle.click(); await expect(mapToggle).toHaveAttribute('aria-expanded', 'true');
    await mapToggle.click(); await expect(mapToggle).toHaveAttribute('aria-expanded', 'false');
  }
  for (const action of ['map-government', 'map-projects']) {
    const button = page.locator(`[data-action="${action}"]`).first();
    await expect(button).toBeVisible(); await button.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
  }
  const after = await evidence(page, info, 'six-fronts-et-choix-chiffres');
  expect(after.turn).toBe(before.turn); expect(after.pressure).toEqual(before.pressure);
  expect(after.finance).toEqual(before.finance); expect(errors).toEqual([]);
});

test('neglect accumulates, a voted programme waits for delivery, and reload/export/import preserve its actual history', async ({ page }, info) => {
  await open(page);
  const initial = await stored(page);
  let game;
  for (let count = 0; count < 4; count++) game = await maintain(page);
  expect(game.pressure.sectors.health.backlog).toBeGreaterThan(initial.pressure.sectors.health.backlog);
  expect(game.pressure.sectors.health.pressure).toBeGreaterThan(initial.pressure.sectors.health.pressure);
  await evidence(page, info, 'retards-accumules');
  let funded;
  for (let attempt = 0; attempt < 3 && !funded; attempt++) {
    await clearPoliticalCrisis(page); await select(page, 'pressure-health');
    const previous = await stored(page); game = await choose(page, 'programme');
    const created = game.pressure.programmes.find(p => p.sourceChoice === game.choices.at(-1));
    if (game.history.at(-1).vote?.passed === false) expect(created).toBeUndefined();
    else {
      expect(created).toBeDefined(); expect(created.status).toBe('preparing');
      expect(game.pressure.sectors.health.capacity).toBe(previous.pressure.sectors.health.capacity);
      funded = created;
    }
  }
  expect(funded).toBeDefined();
  await expect(page.locator('[data-pressure-receipt]')).toBeVisible();
  const beforeReload = await stored(page);
  await page.reload();
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  expect((await stored(page)).pressure).toEqual(beforeReload.pressure);
  expect((await stored(page)).finance).toEqual(beforeReload.finance);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.getByRole('button', { name: 'Exporter la sauvegarde', exact: true }).click();
  const exported = await download;
  const path = info.outputPath('mandat-reel-v14.json'); await exported.saveAs(path);
  expect(decode(await readFile(path, 'utf8')).pressure).toEqual(beforeReload.pressure);
  // Import the exact UI export. It contains inputs, never injected balances.
  await page.locator('input[type="file"]').setInputFiles(path);
  expect((await stored(page)).pressure).toEqual(beforeReload.pressure);
  expect((await stored(page)).choices).toEqual(beforeReload.choices);
  await evidence(page, info, 'programme-finance-et-recharge');
  for (let count = 0; count < 6; count++) {
    game = await maintain(page, 'administration');
    if (game.pressure.programmes.find(p => p.id === funded.id)?.status !== 'preparing') break;
  }
  const outcome = game.pressure.programmes.find(p => p.id === funded.id);
  expect(outcome.sourceChoice).toBe(funded.sourceChoice);
  expect(outcome.sourceTurn).toBe(funded.sourceTurn);
  await evidence(page, info, 'echeance-apres-financement');
});

test('prepared offline game retains the same pressures and can advance one actual period', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'android-chromium', 'One complete service-worker lifecycle; all four projects cover the same rules.');
  await open(page); await maintain(page);
  const before = await stored(page);
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.getByRole('button', { name: 'Préparer le jeu hors connexion', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('prêt hors connexion', { timeout: 45_000 });
  await context.setOffline(true);
  try {
    await page.reload(); await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
    expect((await stored(page)).pressure).toEqual(before.pressure);
    await expect(page.locator('[data-pressure-board]')).toBeVisible();
    await expect.poll(() => page.locator('[data-map-illustration]').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    const after = await maintain(page);
    expect(after.turn).toBe(before.turn + 1);
    await evidence(page, info, 'pression-hors-connexion');
  } finally { await context.setOffline(false); }
});

test('a complete five-year UI campaign closes five budgets and can replay a causal decision', async ({ page }, info) => {
  test.setTimeout(360_000);
  test.skip(info.project.name !== 'desktop-chromium', 'One complete campaign; the other projects inspect the same pressure decision and persistence flows.');
  await open(page);
  const before = await stored(page);
  let game = before;
  while (game.turn < 30 && !game.politics.ending) {
    await clearPoliticalCrisis(page);
    game = await stored(page);
    if (game.turn >= 30 || game.politics.ending) break;
    const sectors = Object.entries(game.pressure.sectors).sort((a, b) => b[1].pressure - a[1].pressure);
    await select(page, `pressure-${sectors[0][0]}`);
    let button;
    for (const kind of ['programme', 'relief', 'delegate', 'maintain']) {
      const direct = page.locator(`[data-action="choose"][data-choice$="-${kind}"]:not([disabled])`);
      if (await direct.count()) { button = direct; break; }
    }
    expect(button).toBeDefined();
    game = await choose(page, await button.getAttribute('data-choice'));
    if ([6, 12, 18, 24].includes(game.turn)) await evidence(page, info, `fin-annee-${game.turn / 6}`);
  }
  expect(game.turn).toBe(30);
  expect(game.history.filter(turn => turn.closed)).toHaveLength(5);
  expect(game.finance.debt).toBe(game.history.at(-1).ledger.debt);
  expect(game.pressure).toBeDefined();
  await expect(page.locator('[data-map-result]')).toBeVisible();
  await evidence(page, info, 'cinq-ans-pression-et-comptes');
  await page.getByRole('button', { name: 'Rejouer un tournant du mandat', exact: true }).click();
  const causal = page.locator('[data-action="branch-replay"]').first();
  const replayTurn = Number(await causal.getAttribute('data-turn'));
  await causal.click();
  const branch = await stored(page);
  expect(branch.turn).toBe(replayTurn);
  expect(branch.choices).toEqual(game.choices.slice(0, replayTurn));
  expect(branch.pressure).toEqual(decode(JSON.stringify({ version: 14, mode: 'national', ambition: 'equilibre', seed: before.seed, choices: game.choices.slice(0, replayTurn) })).pressure);
  await evidence(page, info, 'retour-au-tournant-causal');
});

test('a delivered student agreement restores the capacity removed by its own school reform', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'One real authored/social/sector interaction; other projects cover common rendering and persistence.');
  await open(page);
  const baseline = await stored(page);
  await select(page, 'education-lycees');
  let game = await choose(page, 'regrouper');
  expect(game.history.at(-1).vote.passed).toBe(true);
  const movement = game.social.movements.find(item => item.actor === 'lyceens');
  expect(movement.sourceChoice).toBe(game.choices[0]);
  const reduced = game.pressure.sectors.education.capacity;
  expect(reduced).toBeLessThan(baseline.pressure.sectors.education.capacity);
  await select(page, movement.id);
  game = await choose(page, 'suspendre');
  expect(game.history.at(-1).vote.passed).toBe(true);
  expect(game.social.movements.find(item => item.id === movement.id).commitment.status).toBe('pending');
  expect(game.pressure.sectors.education.capacity).toBe(reduced);
  await evidence(page, info, 'suspension-votee-moyens-attendus');
  for (let count = 0; count < 3; count++) {
    game = await maintain(page, 'energy');
    if (game.social.movements.find(item => item.id === movement.id).commitment.status !== 'pending') break;
  }
  expect(game.social.movements.find(item => item.id === movement.id).commitment.status).toBe('kept');
  expect(game.pressure.sectors.education.capacity).toBe(baseline.pressure.sectors.education.capacity);
  expect(game.pressure.programmes.find(item => item.socialMovementId === movement.id).status).toBe('completed');
  await evidence(page, info, 'suspension-livree-capacite-retablie');
});

test('Ma partie opens playable alternative decisions and preserves the original mandate', async ({ page }, info) => {
  await open(page);
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Comparer une autre stratégie', exact: true })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
  await select(page, 'pressure-health');
  const original = await choose(page, 'maintain');
  const originalRaw = await page.evaluate(key => localStorage.getItem(key), KEY);
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.getByRole('button', { name: 'Comparer une autre stratégie', exact: true }).click();
  await expect(page.locator('.map-replay')).toBeVisible();
  await expect(page.locator('[data-action="branch-replay"]').filter({ visible: true })).toHaveCount(1);
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe(originalRaw);
  await evidence(page, info, 'comparaison-decisions-reelles');
  const returnToMandate = page.getByRole('button', { name: 'Revenir à mon mandat', exact: true });
  await expect(returnToMandate).toBeVisible();
  await returnToMandate.click();
  await expect(page.locator('[data-map-result]')).toHaveCount(0);
  expect((await stored(page)).choices).toEqual(original.choices);
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.getByRole('button', { name: 'Comparer une autre stratégie', exact: true }).click();
  await page.locator('[data-action="branch-replay"]').first().click();
  expect((await stored(page)).turn).toBe(0);
  const alternative = page.locator('[data-action="choose"][data-choice$="-relief"]');
  await expect(alternative).toBeVisible();
  const branch = await choose(page, await alternative.getAttribute('data-choice'));
  expect(branch.choices).not.toEqual(original.choices);
  await page.getByRole('button', { name: 'État du pays', exact: true }).click();
  const comparison = page.locator('details').filter({ has: page.locator('[data-action="restore-origin"]') });
  if (!(await comparison.evaluate(element => element.open))) await comparison.locator(':scope > summary').click();
  await page.getByRole('button', { name: 'Retrouver mon mandat d’origine', exact: true }).click();
  expect((await stored(page)).choices).toEqual(original.choices);
  expect((await stored(page)).pressure).toEqual(original.pressure);
  await evidence(page, info, 'comparaison-origine-retrouvee');
});

test('an active incident is visibly urgent when selected on the map', async ({ page }, info) => {
  await open(page, 1);
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'port-actif-v14.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ version: 14, mode: 'national', seed: 1, ambition: 'equilibre',
      choices: Array.from({ length: 10 }, (_, turn) => `n11-${turn}-pressure-administration-maintain`) })) });
  const before = await stored(page);
  expect(before.pressure.incidents.find(incident => incident.id === 'port-bloque').status).toBe('active');
  await select(page, 'port-bloque');
  await expect(page.locator('[data-map-marker="port-bloque"]')).toHaveClass(/map-tone--red/);
  await expect(page.locator('[data-map-incident]')).toBeVisible();
  await expect(page.locator('[data-map-incident]')).toContainText('1,6');
  await expect(page.locator('[data-map-incident]')).toContainText('hypothèse');
  expect((await stored(page)).turn).toBe(before.turn);
  await evidence(page, info, 'incident-actif-visible');
});

for (const blockedKey of ['500signatures.mandats.branch-reference.v1', '500signatures.mandats.branch-active.v1']) {
  test(`an unavailable ${blockedKey} cannot replace the saved mandate with a replay prefix`, async ({ page }, info) => {
    await open(page);
    await select(page, 'pressure-health');
    const original = await choose(page, 'maintain');
    const raw = await page.evaluate(key => localStorage.getItem(key), KEY);
    await page.evaluate(blocked => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === blocked) throw new DOMException('Quota de stockage atteint.', 'QuotaExceededError');
        return setItem.call(this, key, value);
      };
    }, blockedKey);
    await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
    await page.getByRole('button', { name: 'Comparer une autre stratégie', exact: true }).click();
    await page.locator('[data-action="branch-replay"]').first().click();
    await expect(page.locator('#notice')).toContainText('conserver le mandat d’origine');
    expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe(raw);
    expect((await stored(page)).choices).toEqual(original.choices);
    await page.getByRole('button', { name: 'Revenir à mon mandat', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
    expect((await stored(page)).choices).toEqual(original.choices);
    expect((await stored(page)).pressure).toEqual(original.pressure);
    const waiting = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
    await page.getByRole('button', { name: 'Exporter la sauvegarde', exact: true }).click();
    const download = await waiting;
    const path = info.outputPath('mandat-conserve-malgre-quota.json');
    await download.saveAs(path);
    expect(decode(await readFile(path, 'utf8')).choices).toEqual(original.choices);
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
    await evidence(page, info, 'origine-conservee-malgre-quota');
  });
}

test('a refused origin restoration keeps the branch and its recoverable archive after reload', async ({ page }, info) => {
  await open(page);
  await maintain(page, 'health');
  const original = await maintain(page, 'housing');
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.getByRole('button', { name: 'Comparer une autre stratégie', exact: true }).click();
  await page.locator('[data-action="branch-replay"]').first().click();
  await select(page, 'pressure-health');
  const branch = await choose(page, 'relief');
  expect(branch.choices).not.toEqual(original.choices);
  const raw = await page.evaluate(key => localStorage.getItem(key), KEY);
  const markerKey = '500signatures.mandats.branch-active.v1';
  const marker = await page.evaluate(key => localStorage.getItem(key), markerKey);
  await page.evaluate(blocked => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === blocked) throw new DOMException('Quota de stockage atteint.', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  }, KEY);
  async function restore() {
    await page.getByRole('button', { name: 'État du pays', exact: true }).click();
    const comparison = page.locator('details').filter({ has: page.locator('[data-action="restore-origin"]') });
    if (!(await comparison.evaluate(element => element.open))) await comparison.locator(':scope > summary').click();
    await page.getByRole('button', { name: 'Retrouver mon mandat d’origine', exact: true }).click();
  }
  await restore();
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe(raw);
  expect(await page.evaluate(key => localStorage.getItem(key), markerKey)).toBe(marker);
  await expect(page.locator('#mandats')).toHaveAttribute('data-turn', String(branch.turn));
  await expect(page.locator('#notice')).toContainText('restaurer');
  await evidence(page, info, 'restauration-refusee-branche-conservee');
  await page.reload();
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  expect((await stored(page)).choices).toEqual(branch.choices);
  await restore();
  expect((await stored(page)).choices).toEqual(original.choices);
  expect((await stored(page)).pressure).toEqual(original.pressure);
  await evidence(page, info, 'origine-retrouvee-apres-quota');
});

for (const blockedKey of ['500signatures.mandats.branch-active.v1', KEY]) {
  test(`a refused branch from a shared result preserves the saved branch original when ${blockedKey} fails`, async ({ page }, info) => {
    await open(page);
    await maintain(page, 'health');
    const original = await maintain(page, 'housing');
    async function branch() {
      await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
      await page.getByRole('button', { name: 'Comparer une autre stratégie', exact: true }).click();
      await page.locator('[data-action="branch-replay"]').first().click();
    }
    await branch();
    await select(page, 'pressure-health');
    const alternative = await choose(page, 'relief');
    const keys = [KEY, '500signatures.mandats.branch-reference.v1', '500signatures.mandats.branch-active.v1'];
    async function snapshot() {
      return page.evaluate(keys => keys.map(key => localStorage.getItem(key)), keys);
    }
    const before = await snapshot();
    const legacy = JSON.parse(await readFile(new URL('./fixtures/mandats-v13-compatibility.json', import.meta.url), 'utf8'));
    const shared = legacy.cases.find(item => item.name === 'rupture21').input;
    await page.goto(`/mandats/#result=${encodeURIComponent(JSON.stringify(shared))}`);
    await expect(page.locator('#mandats')).toHaveAttribute('data-turn', String(shared.choices.length));
    expect(await snapshot()).toEqual(before);
    await page.evaluate(blocked => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === blocked) throw new DOMException('Quota de stockage atteint.', 'QuotaExceededError');
        return setItem.call(this, key, value);
      };
    }, blockedKey);
    await branch();
    expect(await snapshot()).toEqual(before);
    await expect(page.locator('#notice')).toContainText('conserver le mandat d’origine');
    await page.goto('/mandats/');
    await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
    expect((await stored(page)).choices).toEqual(alternative.choices);
    await page.getByRole('button', { name: 'État du pays', exact: true }).click();
    const comparison = page.locator('details').filter({ has: page.locator('[data-action="restore-origin"]') });
    if (!(await comparison.evaluate(element => element.open))) await comparison.locator(':scope > summary').click();
    await page.getByRole('button', { name: 'Retrouver mon mandat d’origine', exact: true }).click();
    expect((await stored(page)).choices).toEqual(original.choices);
    expect((await stored(page)).pressure).toEqual(original.pressure);
    await evidence(page, info, 'origine-locale-protegee-du-resultat-partage');
  });
}

test('a shared dilemma offers comparison only after an actual choice and preserves the local original meanwhile', async ({ page }, info) => {
  await open(page);
  await maintain(page, 'health');
  const original = await maintain(page, 'housing');
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.getByRole('button', { name: 'Comparer une autre stratégie', exact: true }).click();
  await page.locator('[data-action="branch-replay"]').first().click();
  await select(page, 'pressure-health');
  const alternative = await choose(page, 'relief');
  const keys = [KEY, '500signatures.mandats.branch-reference.v1', '500signatures.mandats.branch-active.v1'];
  const before = await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), keys);
  const shared = { version: 14, mode: 'national', seed: 1, ambition: 'equilibre', choices: ['n11-0-pressure-health-maintain'] };
  const url = `/mandats/#dilemma=${encodeURIComponent(JSON.stringify(shared))}`;
  await page.goto(url);
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Comparer une autre stratégie', exact: true })).toHaveCount(0);
  expect(await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), keys)).toEqual(before);
  await page.goto('/mandats/');
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  expect((await stored(page)).choices).toEqual(alternative.choices);
  await page.getByRole('button', { name: 'État du pays', exact: true }).click();
  const comparison = page.locator('details').filter({ has: page.locator('[data-action="restore-origin"]') });
  if (!(await comparison.evaluate(element => element.open))) await comparison.locator(':scope > summary').click();
  await page.getByRole('button', { name: 'Retrouver mon mandat d’origine', exact: true }).click();
  expect((await stored(page)).choices).toEqual(original.choices);
  await page.goto(url);
  await select(page, 'pressure-housing');
  const adopted = await choose(page, 'maintain');
  expect(adopted.seed).toBe(shared.seed);
  expect(adopted.turn).toBe(2);
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Comparer une autre stratégie', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
  await evidence(page, info, 'comparaison-apres-adoption-reelle');
});
