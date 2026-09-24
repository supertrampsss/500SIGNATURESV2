import { test, expect } from '@playwright/test';

const SAVE_KEY = '500signatures.mandats.v1';
const board = (page) => page.locator('.mandate-board[data-mandate-board]');
const turns = (page) => page.locator('.mandate-board [data-board-decision] .choice[data-action="choose"]:not([disabled])');

async function noHorizontalOverflow(page) {
  const sizes = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
    offenders: [...document.querySelectorAll('body *')]
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          tag: node.tagName.toLowerCase(),
          id: node.id || undefined,
          className: typeof node.className === 'string' ? node.className : undefined,
          left: Math.round(rect.left * 10) / 10,
          right: Math.round(rect.right * 10) / 10,
          width: Math.round(rect.width * 10) / 10,
        };
      })
      .filter((rect) => rect.width > 0 && (rect.left < -1 || rect.right > document.documentElement.clientWidth + 1))
      .slice(0, 8),
  }));
  expect(sizes.document, `Horizontal overflow: ${JSON.stringify(sizes.offenders)}`).toBeLessThanOrEqual(sizes.viewport + 1);
}

async function beginDefault(page) {
  await page.goto('/mandats/');
  await page.getByRole('button', { name: 'Gouverner la France' }).click();
  await expect(board(page)).toBeVisible();
  await expect(board(page).locator('[data-board-hud]')).toBeVisible();
  await expect(board(page).locator('[data-board-scene]')).toBeVisible();
  await expect(board(page).locator('[data-board-decision]')).toBeVisible();
  await expect(board(page).locator('[data-board-feedback]')).toHaveCount(1);
  await expect(board(page).locator('.campaign-position')).toContainText('Année 1');
  const nestedControls = await board(page).evaluate((root) =>
    [...root.querySelectorAll('button')].filter((button) =>
      button.querySelector('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).length,
  );
  expect(nestedControls).toBe(0);
}

async function capture(page, info, label) {
  const path = info.outputPath(`${label}-${info.project.name}.png`);
  await page.locator('img[src^="/mandats/art/"]').evaluateAll((images) => {
    for (const image of images) image.loading = 'eager';
  });
  await expect.poll(() => page.locator('img[src^="/mandats/art/"]').evaluateAll((images) =>
    images.every((image) => image.complete && image.naturalWidth > 0),
  )).toBe(true);
  const scroll = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), scroll);
  await info.attach(`${label}-${info.project.name}`, { path, contentType: 'image/png' });
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

async function finishAnnualRecap(page, year, info) {
  await expect(page.locator('.year-recap')).toBeVisible();
  await expect(page.locator('.year-recap')).toContainText(`ANNÉE ${year}`);
  if (year === 5) {
    const resultButton = page.locator('.year-recap [data-action="show-result"]');
    await expect(resultButton).toBeVisible();
    const resultBox = await resultButton.boundingBox();
    expect(resultBox).not.toBeNull();
    expect(resultBox.height).toBeGreaterThanOrEqual(44);
    if (info.project.use.viewport?.width === 390) {
      expect(resultBox.y + resultBox.height).toBeLessThanOrEqual(info.project.use.viewport.height + 60);
    }
    await resultButton.click();
    await expect(page.locator('.result.v9-result')).toBeVisible();
  } else {
    await page.locator('.year-recap [data-action="next-year"]').click();
    await expect(page.locator('.living-briefing')).toBeVisible();
    await capture(page, info, `year-briefing-${year + 1}`);
    const startYear = page.locator('.living-briefing [data-action="start-year"]');
    await expect(startYear).toBeVisible();
    expect((await startYear.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await startYear.click();
    await expect(board(page)).toBeVisible();
    await expect(board(page)).toHaveAttribute('data-year', String(year + 1));
  }
}

test('default v9 board completes the five-year route and can replay a chosen turn', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/mandats/');
  await capture(page, test.info(), 'campaign-entry');
  await beginDefault(page);
  const sceneIdentity = await board(page).locator('[data-board-scene]').evaluate((node) => {
    node.dataset.testIdentity = 'stable-board-scene';
    return true;
  });
  expect(sceneIdentity).toBe(true);
  let crisisCaptured = false;
  await capture(page, test.info(), 'first-decision');

  for (let turn = 0; turn < 30; turn += 1) {
    const expectedCount = turn + 1;
    if (turn > 0 && turn % 6 === 0) {
      await board(page).locator('[data-board-scene]').evaluate((node) => { node.dataset.testIdentity = 'stable-board-scene'; });
    }
    await pick(page, turn, expectedCount);
    if (turn === 0) {
    await expect(board(page).locator('[data-board-feedback]')).toBeVisible();
    await capture(page, test.info(), 'after-first-decision');
    await page.getByRole('button', { name: 'Bilan', exact: true }).click();
    await expect(page.locator('.finance-panel')).toBeVisible();
    await capture(page, test.info(), 'first-decision-bilan');
    await page.getByRole('button', { name: 'Décider', exact: true }).click();
    await expect(board(page)).toBeVisible();
  }
    const save = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
    expect(save.choices).toHaveLength(expectedCount);
    expect(save.version).toBe(9);
    expect(save.ambition).toBe('equilibre');
    if (!crisisCaptured && await board(page).locator('.crisis-dossier').count()) {
      await capture(page, test.info(), 'crisis-decision');
      crisisCaptured = true;
    }
    await noHorizontalOverflow(page);
    if (expectedCount % 6 === 0) {
      await expect(page.locator('.year-recap')).toBeVisible();
      const recapAction = page.locator('.year-recap [data-action="next-year"], .year-recap [data-action="show-result"]').first();
      await expect(recapAction).toBeVisible();
      expect((await recapAction.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await noHorizontalOverflow(page);
      await capture(page, test.info(), `year-recap-${expectedCount / 6}`);
      await finishAnnualRecap(page, expectedCount / 6, test.info());
    } else if (expectedCount < 30) {
      await expect(board(page)).toBeVisible();
      await expect(board(page).locator('[data-board-scene]')).toHaveAttribute('data-test-identity', 'stable-board-scene');
    }
  }

  await expect(page.locator('.result.v9-result')).toBeVisible();
  await expect(page.locator('.result [data-action="open-replay-selection"]')).toBeInViewport({ ratio: 1 });
  await noHorizontalOverflow(page);
  await capture(page, test.info(), 'result');
  await expect(page.locator('.living-result h1')).toHaveText(/Vous avez changé\s+le paysage\./);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).choices.length, SAVE_KEY)).toBe(30);

  const originalRaw = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  const original = JSON.parse(originalRaw);
  await page.locator('.result [data-action="open-replay-selection"]').click();
  await expect(page.locator('.replay-selection')).toBeVisible();
  await expect(page.locator('.replay-card')).toHaveCount(30);
  await capture(page, test.info(), 'replay-selection');
  const branch = page.locator('.replay-card [data-action="branch-replay"][data-turn]').first();
  await expect(branch).toBeVisible();
  const replayTurn = Number(await branch.getAttribute('data-turn'));
  await branch.click();
  await expect(board(page)).toBeVisible();
  const replaySave = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  expect(replaySave.choices).toHaveLength(replayTurn);
  await expect(board(page).locator('[data-board-decision]')).toBeVisible();
  // The branch starts immediately before the archived choice; choose a different
  // available measure so the comparison represents a changed trajectory.
  const availableIds = await turns(page).evaluateAll((buttons) => buttons.map((button) => button.dataset.choice));
  const changedId = availableIds.find((id) => id !== original.choices[replayTurn]);
  expect(changedId).toBeTruthy();
  const changedChoice = board(page).locator(`[data-board-decision] [data-action="choose"][data-choice="${changedId}"]`);
  await expect(changedChoice).toBeVisible();
  await changedChoice.click();
  await expect(board(page).locator('.trajectory-comparison')).toBeVisible();
  await expect(board(page).locator('.trajectory-comparison')).toContainText('Mandat d’origine');
  await capture(page, test.info(), 'trajectory-comparison');
  await page.reload();
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  await expect(board(page).locator('.trajectory-comparison')).toBeVisible();
  await board(page).locator('[data-action="restore-origin"]').click();
  await expect(page.locator('.result.v9-result')).toBeVisible();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVE_KEY)).toEqual(original);
  expect(await page.evaluate(() => localStorage.getItem('500signatures.mandats.branch-reference.v1'))).toBeNull();
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
