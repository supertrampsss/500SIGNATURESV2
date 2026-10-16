import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

// Real failure hypotheses precede the implementation in docs/mandats-reports-reformes.md.
const KEY = '500signatures.mandats.v1';
const base = version => ({ version, mode: 'national', seed: 0, ambition: 'equilibre', choices: [] });
const reports = count => Array.from({ length: count }, (_, turn) => `n11-${turn}-pressure-health-maintain`);
const fmt = value => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value);
const cache = new Map();
function decode(inputs) {
  const raw = typeof inputs === 'string' ? inputs : JSON.stringify(inputs);
  if (!cache.has(raw)) {
    const module = new URL('../src/mandats/storage.ts', import.meta.url).href;
    cache.set(raw, JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e',
      `import{decode}from${JSON.stringify(module)};let s='';for await(const c of process.stdin)s+=c;process.stdout.write(JSON.stringify(decode(s)));`], { input: raw, encoding: 'utf8' })));
  }
  return cache.get(raw);
}
async function saved(page) {
  const raw = await page.evaluate(key => localStorage.getItem(key), KEY);
  expect(raw).toBeTruthy();
  return decode(raw);
}
async function load(page, inputs) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/mandats/');
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'mandat-reports.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(inputs)) });
  await expect(page.locator('#mandats')).toHaveAttribute('data-turn', String(inputs.choices.length));
  expect((await saved(page)).version).toBe(inputs.version);
  await page.evaluate(() => document.fonts.ready);
}
async function open(page, sector) { await page.locator(`[data-situation-front="${sector}"]`).click(); }
async function choose(page, suffix, { keepReceipt = false } = {}) {
  const before = await saved(page);
  await page.locator(`[data-action="choose"][data-choice$="${suffix}"]:not([disabled])`).click();
  await expect(page.locator('#mandats')).toHaveAttribute('data-turn', String(before.turn + 1));
  if (keepReceipt) await page.locator('[data-action="dismiss-verdict"]').focus();
  else await page.keyboard.press('Escape');
  return saved(page);
}
async function advance(page) { await open(page, 'administration'); return choose(page, '-maintain'); }
async function capture(page, info, name, game) {
  const image = info.outputPath(`${name}.png`), json = info.outputPath(`${name}.json`);
  await page.screenshot({ path: image, fullPage: true, animations: 'disabled' });
  await writeFile(json, JSON.stringify({ url: page.url(), viewport: page.viewportSize(), inputs: { ...base(game.version), seed: game.seed, choices: game.choices }, pressure: game.pressure, finance: game.finance, votes: game.politics?.votes }, null, 2));
  await info.attach(name, { path: image, contentType: 'image/png' });
  await info.attach(`${name}-inputs`, { path: json, contentType: 'application/json' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

test('national reforms stay directly reachable after sixteen reports and a real reform advances the agenda', async ({ page }, info) => {
  await load(page, { ...base(14), choices: reports(16) });
  const before = await saved(page);
  const access = page.locator('[data-national-policy-access]');
  await expect(access).toBeInViewport({ ratio: 1 });
  await expect(access).toContainText('Retraites');
  expect(await access.evaluate(el => !!el.closest('details'))).toBe(false);
  await capture(page, info, 'reformes-malgre-les-crises', before);
  await access.click();
  await expect(page.locator('[data-map-decision] h1')).toContainText('pensions');
  expect((await saved(page)).pressure).toEqual(before.pressure);
  expect((await saved(page)).choices).toEqual(before.choices);
  for (const front of await page.locator('[data-situation-front]').all()) await expect(front).toBeInViewport({ ratio: 1 });
  await page.locator('[data-action="map-close"]').click();
  expect((await saved(page)).turn).toBe(16);
  await access.click();
  const after = await choose(page, 'r01b');
  expect(after.choices.at(-1)).toBe('r01b');
  await expect(access).toContainText('Fonction publique');
  await capture(page, info, 'reforme-suivante-accessible', after);
});

test('three explicit reports show the actual accumulating backlog in the receipt and persistent news', async ({ page }, info) => {
  await load(page, base(14));
  const initial = await saved(page);
  for (let count = 0; count < 3; count++) {
    await open(page, 'health');
    const game = await choose(page, '-maintain', { keepReceipt: true });
    await expect(page.locator('[data-decision-verdict]')).toContainText(/retard.*\d|\d.*en attente/i);
    await expect(page.locator('[data-decision-verdict]')).toContainText(/Pression [\d,.]+ à [\d,.]+\/100/);
    await page.keyboard.press('Escape');
    const news = page.locator('[data-situation-news]');
    await expect(news).toBeVisible();
    await expect(news).toContainText(fmt(game.pressure.sectors.health.backlog));
    await expect(news).toContainText(/retard|attente/i);
    await expect(news).toHaveAttribute('data-report-backlog', String(game.pressure.sectors.health.backlog));
  }
  const after = await saved(page);
  expect(after.pressure.sectors.health.backlog).toBeGreaterThan(initial.pressure.sectors.health.backlog);
  expect(after.pressure.sectors.health.fatigue).toBeGreaterThan(initial.pressure.sectors.health.fatigue);
  await capture(page, info, 'reports-chiffres-et-persistants', after);
  await page.reload(); await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  expect((await saved(page)).pressure).toEqual(after.pressure);
  await expect(page.locator('[data-situation-news]')).toContainText(fmt(after.pressure.sectors.health.backlog));
});

test('v15 crisis recovery grows with the real backlog and does not exist in calm or published v14 rules', async ({ page }, info) => {
  await load(page, base(15)); await open(page, 'health');
  await expect(page.locator('[data-action="choose"][data-choice$="-recovery"]')).toHaveCount(0);
  await load(page, { ...base(14), choices: reports(10) }); await open(page, 'health');
  await expect(page.locator('[data-action="choose"][data-choice$="-recovery"]')).toHaveCount(0);
  await load(page, { ...base(15), choices: reports(10) }); await open(page, 'health');
  const early = page.locator('[data-action="choose"][data-choice$="-recovery"]');
  await expect(early).toBeVisible();
  const earlyCost = await early.locator('.map-choice__footer small').innerText();
  await load(page, { ...base(15), choices: reports(16) }); await open(page, 'health');
  const late = page.locator('[data-action="choose"][data-choice$="-recovery"]');
  await expect(late).toBeVisible();
  expect(await late.locator('.map-choice__footer small').innerText()).not.toBe(earlyCost);
  await capture(page, info, 'rattrapage-dimensionne-au-retard', await saved(page));
});

test('a funded crisis recovery waits for delivery, reduces backlog and expires without duplicate financing', async ({ page }, info) => {
  await load(page, { ...base(15), choices: reports(10) });
  const before = await saved(page);
  await open(page, 'health');
  let game = await choose(page, '-recovery');
  const recoveryId = game.choices.at(-1);
  expect(game.history.at(-1).vote?.passed).toBe(true);
  let programme = game.pressure.programmes.find(item => item.sourceChoice === recoveryId);
  expect(programme?.status).toBe('preparing');
  expect(programme.deliveredTurn).toBeUndefined();
  expect(game.pressure.sectors.health.capacity).toBe(before.pressure.sectors.health.capacity);
  await open(page, 'health');
  await expect(page.locator('[data-action="choose"][data-choice$="-recovery"]')).toHaveCount(0);
  await expect(page.locator('[data-action="choose"][data-choice$="-maintain"]')).toContainText('Laisser avancer');
  const delivery = programme.dueTurn;
  while (game.turn < delivery) game = await advance(page);
  programme = game.pressure.programmes.find(item => item.sourceChoice === recoveryId);
  expect(programme.status).toBe('active');
  expect(programme.appliedCapacity).toBeGreaterThan(0);
  const financed = game;
  await page.reload(); await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  expect((await saved(page)).pressure).toEqual(financed.pressure);
  await capture(page, info, 'rattrapage-livre-et-recharge', financed);
  while (game.turn < programme.endsTurn) game = await advance(page);
  const ended = game.pressure.programmes.find(item => item.sourceChoice === recoveryId);
  expect(ended.status).toBe('completed');
  expect(game.pressure.sectors.health.capacity).toBe(before.pressure.sectors.health.capacity);
  expect(game.pressure.programmes.filter(item => item.sourceChoice === recoveryId)).toHaveLength(1);
  const control = decode({ ...base(15), choices: [...reports(10), ...Array.from({ length: game.turn - 10 }, (_, i) => `n11-${10 + i}-pressure-administration-maintain`)] });
  expect(game.pressure.sectors.health.backlog).toBeLessThan(control.pressure.sectors.health.backlog);
  await capture(page, info, 'rattrapage-termine-et-controle', game);
});

test('waiting for an already funded programme reports its real progress without calling it neglect', async ({ page }, info) => {
  await load(page, base(15)); await open(page, 'health');
  let game = await choose(page, '-programme');
  expect(game.history.at(-1).vote?.passed).toBe(true);
  await open(page, 'health');
  await expect(page.locator('[data-action="choose"][data-choice$="-maintain"]')).toContainText('Laisser avancer');
  game = await choose(page, '-maintain', { keepReceipt: true });
  await expect(page.locator('[data-decision-verdict]')).toContainText(/financ|mise en|préparation/i);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-situation-news]')).toContainText('MISE EN ŒUVRE');
  await capture(page, info, 'attente-financee-explicite', game);
});

test('a rejected crisis recovery creates neither programme nor investment and reconstructs the same vote', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'The four formats cover recovery delivery; desktop follows its separate rejection branch.');
  await load(page, { ...base(15), seed: 7, choices: reports(16) });
  const before = await saved(page);
  await open(page, 'health');
  const after = await choose(page, '-recovery');
  expect(after.history.at(-1).vote?.passed).toBe(false);
  expect(after.pressure.programmes.some(item => item.sourceChoice === after.choices.at(-1))).toBe(false);
  expect(after.finance.investment).toBe(before.finance.investment);
  expect(after.pressure.sectors.health.capacity).toBe(before.pressure.sectors.health.capacity);
  await page.reload(); await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  expect((await saved(page)).pressure).toEqual(after.pressure);
  expect((await saved(page)).history.at(-1).vote).toEqual(after.history.at(-1).vote);
  await capture(page, info, 'rattrapage-rejete-sans-credit', after);
});

test('a compact crisis board leaves all three priority pins clickable beside the reform band', async ({ page }, info) => {
  test.skip(info.project.name !== 'compact', 'This regression concerns the constrained 320 px board; all formats cover reform access.');
  await load(page, { ...base(15), choices: reports(16) });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ids = await page.locator('[data-map-marker][data-action="story-select"]').filter({ visible: true }).evaluateAll(nodes => nodes.map(node => node.dataset.mapMarker));
  expect(ids).toHaveLength(3);
  await capture(page, info, 'trois-reperes-avant-vrais-clics', await saved(page));
  for (const id of ids) {
    const point = page.locator(`[data-map-marker="${id}"] .map-marker__point`);
    await expect(point).toBeVisible();
    expect(await point.evaluate(element => { const r = element.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!hit && (hit === element || element.contains(hit)); }), `${id} doit recevoir réellement le clic.`).toBe(true);
    await point.click();
    await expect(page.locator('[data-map-decision]')).toBeVisible();
    await page.locator('[data-action="map-close"]').click();
    await expect(page.locator('[data-mandate-map]')).toBeVisible();
    expect((await saved(page)).turn).toBe(16);
  }
  await capture(page, info, 'trois-reperes-inspectes-sans-tour', await saved(page));
});
