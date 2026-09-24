import { test, expect } from '@playwright/test';

const SAVE_KEY = '500signatures.mandats.v1';
const board = (page) => page.locator('.mandate-board[data-mandate-board]');
const turns = (page) => page.locator('.mandate-board [data-board-decision] .choice[data-action="choose"]:not([disabled])');

async function noHorizontalOverflow(page) {
  const sizes = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport + 1);
}

async function beginDefault(page) {
  await page.goto('/mandats/');
  await page.getByRole('button', { name: 'Gouverner la France' }).click();
  await expect(board(page)).toBeVisible();
  await expect(board(page).locator('[data-board-hud]')).toBeVisible();
  await expect(board(page).locator('[data-board-scene]')).toBeVisible();
  await expect(board(page).locator('[data-board-decision]')).toBeVisible();
  await expect(board(page).locator('[data-board-feedback]')).toBeVisible();
  await expect(board(page).locator('.campaign-position')).toContainText('Année 1');
  const nestedControls = await board(page).evaluate((root) =>
    [...root.querySelectorAll('button')].filter((button) =>
      button.querySelector('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).length,
  );
  expect(nestedControls).toBe(0);
}

async function capture(page, info, label) {
  await info.attach(`${label}-${info.project.name}`, {
    body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
    contentType: 'image/png',
  });
}

async function pick(page, index = 0, expectedTurn) {
  const available = turns(page);
  await expect(available.first()).toBeVisible();
  const count = await available.count();
  await available.nth(index % count).click();
  if (expectedTurn !== undefined) {
    await expect.poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).choices.length, SAVE_KEY)).toBe(expectedTurn);
    if (expectedTurn % 6 !== 0) {
      await expect(board(page)).toHaveAttribute('data-turn', String(expectedTurn));
      await expect(turns(page).first()).toBeEnabled();
    }
  }
}

async function finishAnnualRecap(page, year) {
  await expect(page.locator('.year-recap')).toBeVisible();
  await expect(page.locator('.year-recap')).toContainText(`ANNÉE ${year}`);
  if (year === 5) {
    await page.locator('.year-recap [data-action="show-result"]').click();
    await expect(page.locator('.result.v9-result')).toBeVisible();
  } else {
    await page.locator('.year-recap [data-action="next-year"]').click();
    await expect(board(page)).toBeVisible();
    await expect(board(page)).toHaveAttribute('data-year', String(year + 1));
  }
}

test('default v9 board completes the five-year route and can replay a chosen turn', async ({ page }) => {
  test.setTimeout(120_000);
  await beginDefault(page);
  const sceneIdentity = await board(page).locator('[data-board-scene]').evaluate((node) => {
    node.dataset.testIdentity = 'stable-board-scene';
    return true;
  });
  expect(sceneIdentity).toBe(true);
  await capture(page, test.info(), 'first-decision');

  for (let turn = 0; turn < 30; turn += 1) {
    const expectedCount = turn + 1;
    if (turn > 0 && turn % 6 === 0) {
      await board(page).locator('[data-board-scene]').evaluate((node) => { node.dataset.testIdentity = 'stable-board-scene'; });
    }
    await pick(page, turn, expectedCount);
    if (turn === 0) await capture(page, test.info(), 'after-first-decision');
    const save = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
    expect(save.choices).toHaveLength(expectedCount);
    expect(save.version).toBe(9);
    expect(save.ambition).toBe('equilibre');
    await noHorizontalOverflow(page);
    if (expectedCount % 6 === 0) {
      await capture(page, test.info(), 'year-recap');
      await finishAnnualRecap(page, expectedCount / 6);
    } else if (expectedCount < 30) {
      await expect(board(page)).toBeVisible();
      await expect(board(page).locator('[data-board-scene]')).toHaveAttribute('data-test-identity', 'stable-board-scene');
    }
  }

  await expect(page.locator('.result.v9-result')).toBeVisible();
  await capture(page, test.info(), 'result');
  await expect(page.locator('.living-result h1')).toHaveText('Votre mandat a changé le pays.');
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).choices.length, SAVE_KEY)).toBe(30);

  const branch = page.locator('.result [data-action="branch-replay"][data-turn]').first();
  await expect(branch).toBeVisible();
  const replayTurn = Number(await branch.getAttribute('data-turn'));
  await branch.click();
  await expect(board(page)).toBeVisible();
  const replaySave = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  expect(replaySave.choices).toHaveLength(replayTurn);
  await expect(board(page).locator('[data-board-decision]')).toBeVisible();
  await expect(board(page).locator('.branch-comparison')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  await expect(board(page).locator('.branch-comparison')).toBeVisible();
});

test('one choice is one turn, and a saved game resumes after reload', async ({ page }) => {
  await beginDefault(page);
  const choice = turns(page).first();
  await choice.dblclick();
  await expect.poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).choices.length, SAVE_KEY)).toBe(1);
  await expect(board(page)).toBeVisible();
  await page.reload();
  if (!(await board(page).isVisible())) {
    await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  }
  await expect(board(page)).toBeVisible();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).choices.length, SAVE_KEY)).toBe(1);
  await expect(board(page).locator('.campaign-position')).toContainText('décision 2/6');
});

test('reduced motion removes transition duration and both mobile widths fit', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await beginDefault(page);
  await pick(page, 0, 1);
  await expect(board(page)).toBeVisible();
  expect(await board(page).evaluate((node) => node.classList.contains('is-transitioning'))).toBe(false);
  const motion = await board(page).locator('.choice').first().evaluate((node) => getComputedStyle(node).transitionDuration);
  expect(motion.split(',').every((duration) => Number.parseFloat(duration) === 0)).toBe(true);
  await noHorizontalOverflow(page);
  const viewport = info.project.use.viewport;
  if (viewport.width <= 390) {
    const boxes = await Promise.all([
      board(page).locator('[data-board-hud]').boundingBox(),
      board(page).locator('[data-board-scene]').boundingBox(),
      board(page).locator('[data-board-decision]').boundingBox(),
      board(page).locator('[data-board-feedback]').boundingBox(),
    ]);
    for (const box of boxes) {
      expect(box).not.toBeNull();
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    }
  }
});
