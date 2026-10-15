import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const KEY = '500signatures.mandats.v1';
const version = Number(process.env.MANDATS_SOCIAL_RETRY_VERSION ?? 14);
const prefix = [
  'n11-0-education-lycees-regrouper', 'r01a', 'r02a', 'pol-censure-withdraw',
  'r03a', 'r04a', 'u02a', 'r05a', 'r06a',
  'n11-9-mvt-lyceens-0-suspendre',
  'n11-10-pressure-energy-maintain', 'n11-11-pressure-energy-maintain',
];

function engine(script, input) {
  const module = new URL('../src/mandats/engine.ts', import.meta.url).href;
  const storage = new URL('../src/mandats/storage.ts', import.meta.url).href;
  return JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e',
    `import {decode,encode} from ${JSON.stringify(storage)}; import {replay,decide,selectStoryAgenda,choicesFor} from ${JSON.stringify(module)}; let raw=''; for await(const c of process.stdin)raw+=c; const input=JSON.parse(raw); ${script}`,
  ], { input: JSON.stringify(input), encoding: 'utf8' }));
}

async function stored(page) {
  const raw = await page.evaluate(key => localStorage.getItem(key), KEY);
  expect(raw).toBeTruthy();
  return engine('process.stdout.write(JSON.stringify(decode(input)));', raw);
}

async function importJourney(page, info, input, label) {
  const fixture = info.outputPath(`${label}.json`);
  await writeFile(fixture, JSON.stringify(input, null, 2));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/mandats/?mode=national&v=${input.version}&seed=${input.seed}&ambition=equilibre`);
  await expect(page.locator('[data-map-agenda]')).toBeVisible();
  await page.getByRole('button', { name: 'Ma partie', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.locator('#mandats')).toHaveAttribute('data-turn', String(input.choices.length));
}

function waitingBudget(input) {
  return engine(`const g=decode(JSON.stringify(input)); const focused=selectStoryAgenda(g,'pressure-energy'); const choice=choicesFor(focused).find(c=>c.id.endsWith('-maintain')); process.stdout.write(JSON.stringify(decide(focused,choice.id)));`, input).finance.operating;
}

test('a broken social agreement reuses its indexed funding before asking for more credit', async ({ page }, info) => {
  test.setTimeout(180_000);
  test.skip(info.project.name === 'iphone-webkit', 'The compact and desktop paths cover this long accounting journey; WebKit covers social delivery in the existing suite.');
  const input = { version, mode: 'national', seed: 0, ambition: 'equilibre', choices: prefix };
  await importJourney(page, info, input, 'accord-social-entrees');
  const before = await stored(page);
  expect(before.social.movements.find(item => item.id === 'mvt-lyceens-0').commitment.status).toBe('broken');
  const unchangedCapacity = before.pressure.sectors.education.capacity;
  const counterfactual = engine(`const g=decode(JSON.stringify(input)); const focused=selectStoryAgenda(g,'pressure-energy'); const choice=choicesFor(focused).find(c=>c.id.endsWith('-maintain')); process.stdout.write(JSON.stringify(decide(focused,choice.id)));`, input);
  const front = page.locator('[data-action="story-select"][data-story-id="mvt-lyceens-0"]').filter({ visible: true }).first();
  await front.click();
  const suspension = page.locator('[data-action="choose"][data-choice$="-suspendre"]');
  await expect(suspension).toContainText('0 € de crédit nouveau');
  await expect(suspension).toContainText('déjà engagés');
  await expect(page.locator('[data-action="choose"][data-choice$="-financer"]')).toContainText('0,35');
  const beforeScreenshot = info.outputPath('accord-social-reprise.png');
  await page.screenshot({ path: beforeScreenshot, fullPage: true, animations: 'disabled' });
  await info.attach('accord déjà financé et autre réponse distincte', { path: beforeScreenshot, contentType: 'image/png' });
  await suspension.click();
  await expect(page.locator('#mandats')).toHaveAttribute('data-turn', '13');
  await page.keyboard.press('Escape');
  const after = await stored(page);
  expect(after.history.at(-1).vote.passed).toBe(true);
  expect(after.finance.operating).toBeCloseTo(counterfactual.finance.operating, 8);
  expect(after.pressure.sectors.education.capacity).toBe(unchangedCapacity);
  expect(after.social.movements.find(item => item.id === 'mvt-lyceens-0').commitment.status).toBe('pending');
  expect(after.pressure.programmes.filter(item => item.socialMovementId === 'mvt-lyceens-0').map(item => item.status)).toEqual(['cancelled', 'preparing']);
  const raw = await page.evaluate(key => localStorage.getItem(key), KEY);
  const reloadedInput = engine('process.stdout.write(JSON.stringify(JSON.parse(encode(decode(input)))));', raw);
  expect(reloadedInput).toEqual({ ...input, choices: after.choices });
  await page.reload();
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  expect(await stored(page)).toEqual(after);
  const final = info.outputPath('accord-social-reprise-resultat.json');
  await writeFile(final, JSON.stringify({ input, before, after, counterfactual }, null, 2));
  await info.attach('comptes et engagements avant après', { path: final, contentType: 'application/json' });
});

test('a different social response keeps its own costs and the earlier unused agreement', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'The separate fiscal agreement is checked once; the common retry journey covers narrow viewports.');
  const input = { version, mode: 'national', seed: 0, ambition: 'equilibre', choices: prefix };
  await importJourney(page, info, input, 'accord-different-entrees');
  const before = await stored(page);
  const expectedOperating = waitingBudget(input) + 0.25;
  await page.locator('[data-action="story-select"][data-story-id="mvt-lyceens-0"]').filter({ visible: true }).first().click();
  const pilot = page.locator('[data-action="choose"][data-choice$="-tester"]');
  await expect(pilot).toContainText('0,25');
  await pilot.click();
  await expect(page.locator('#mandats')).toHaveAttribute('data-turn', '13');
  const after = await stored(page);
  expect(after.history.at(-1).vote.passed).toBe(true);
  expect(after.finance.operating).toBeCloseTo(expectedOperating, 8);
  const movement = after.social.movements.find(item => item.id === 'mvt-lyceens-0');
  expect(movement.funding.suspendre).toEqual(before.social.movements.find(item => item.id === movement.id).funding.suspendre);
  expect(movement.funding.tester.annualOperating).toBe(0.25);
  expect(after.pressure.sectors.education.capacity).toBe(before.pressure.sectors.education.capacity);
  const result = info.outputPath('accord-different-resultat.json');
  await writeFile(result, JSON.stringify({ input, before, after, expectedOperating }, null, 2));
  await info.attach('accord différent sans transfert fictif', { path: result, contentType: 'application/json' });
});

test('a rejected alternative social agreement preserves existing credit without financing the new response', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'This actual rejected ballot runs once.');
  const input = { version, mode: 'national', seed: 0, ambition: 'equilibre', choices: prefix };
  await importJourney(page, info, input, 'accord-rejete-entrees');
  const before = await stored(page);
  const previous = before.social.movements.find(item => item.id === 'mvt-lyceens-0');
  const expectedOperating = waitingBudget(input);
  await page.locator('[data-action="story-select"][data-story-id="mvt-lyceens-0"]').filter({ visible: true }).first().click();
  const redeploy = page.locator('[data-action="choose"][data-choice$="-financer"]');
  await expect(redeploy).toContainText('0,35');
  await redeploy.click();
  await expect(page.locator('#mandats')).toHaveAttribute('data-turn', '13');
  const after = await stored(page);
  const movement = after.social.movements.find(item => item.id === previous.id);
  expect(after.history.at(-1).vote.passed).toBe(false);
  expect(after.finance.operating).toBeCloseTo(expectedOperating, 8);
  expect(movement.funding).toEqual(previous.funding);
  expect(movement.commitment).toEqual(previous.commitment);
  expect(after.pressure.programmes.some(item => item.sourceTurn === before.turn)).toBe(false);
  expect(after.pressure.sectors.education.capacity).toBe(before.pressure.sectors.education.capacity);
  const result = info.outputPath('accord-rejete-resultat.json');
  await writeFile(result, JSON.stringify({ input, before, after, expectedOperating }, null, 2));
  await info.attach('accord rejeté sans nouveau financement', { path: result, contentType: 'application/json' });
});

test('a more expensive renewed social agreement only votes its missing annual credit', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'This second seeded accounting journey runs once.');
  const input = { version, mode: 'national', seed: 1, ambition: 'equilibre', choices: [
    'n11-0-education-lycees-regrouper', 'r01a', 'pol-censure-vote', 'r02a',
    ...Array.from({ length: 14 }, (_, index) => `n11-${index + 4}-pressure-energy-maintain`),
    'n11-18-mvt-agents-3-financer', 'n11-19-pressure-energy-maintain', 'n11-20-pressure-energy-maintain',
  ] };
  await importJourney(page, info, input, 'accord-augmente-entrees');
  const before = await stored(page);
  const prior = before.social.movements.find(item => item.id === 'mvt-agents-3');
  expect(prior.commitment.status).toBe('broken');
  const expectedOperating = waitingBudget(input);
  const offered = engine(`const g=decode(JSON.stringify(input)); const focused=selectStoryAgenda(g,'mvt-agents-3'); process.stdout.write(JSON.stringify(choicesFor(focused).find(c=>c.id.endsWith('-financer'))));`, input);
  expect(offered.effect.operating).toBeGreaterThan(0);
  expect(offered.effect.operating).toBeLessThan(prior.funding.financer.annualOperating);
  await page.locator('[data-action="story-select"][data-story-id="mvt-agents-3"]').filter({ visible: true }).first().click();
  const recruitment = page.locator('[data-action="choose"][data-choice$="-financer"]');
  await expect(recruitment).toContainText('crédit supplémentaire');
  await expect(recruitment).toContainText('déjà engagés');
  const screenshot = info.outputPath('accord-augmente.png');
  await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' });
  await info.attach('crédits existants et supplément', { path: screenshot, contentType: 'image/png' });
  await recruitment.click();
  await expect(page.locator('#mandats')).toHaveAttribute('data-turn', '22');
  const after = await stored(page);
  expect(after.history.at(-1).vote.passed).toBe(true);
  expect(after.finance.operating).toBeCloseTo(expectedOperating + offered.effect.operating, 8);
  expect(after.pressure.sectors.administration.capacity).toBe(before.pressure.sectors.administration.capacity);
  const next = after.social.movements.find(item => item.id === prior.id);
  expect(next.commitment.status).toBe('pending');
  expect(next.funding.financer.annualOperating).toBeCloseTo(prior.funding.financer.annualOperating + offered.effect.operating, 8);
  const result = info.outputPath('accord-augmente-resultat.json');
  await writeFile(result, JSON.stringify({ input, before, after, offered, expectedOperating }, null, 2));
  await info.attach('supplément voté et capacité en attente', { path: result, contentType: 'application/json' });
});
