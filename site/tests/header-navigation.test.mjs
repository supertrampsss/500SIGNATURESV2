import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const ROUTES = [
  { path: '/accueil/', page: 'home' },
  { path: '/bilan/', page: 'france' },
  { path: '/territoire', page: 'territory' },
  { path: '/analyses/', page: 'dossiers' },
  { path: '/mandats/', page: 'mandats' },
];

const header = (page) => page.locator('header.entete');
const nav = (page) => header(page).locator('nav.entete__nav');
const menuButton = (page) => header(page).locator('button.fr-menu');
const socialLink = (page) => header(page).locator('.entete__actions .site-x-link');

async function waitForPage(page, route) {
  await page.goto(route.path, { waitUntil: 'domcontentloaded' });
  await expect(header(page)).toBeVisible();
  await expect(nav(page).locator('a[href="/bilan/"]')).toHaveText('France');
  await expect(nav(page).locator('a[href="/territoire"]')).toHaveText('Ville');
  await expect(nav(page).locator('a[href="/analyses/"]')).toHaveText('Dossiers');
  if (route.page === 'home') await expect(page.locator('.vue--accueil')).toBeVisible();
  if (route.page === 'france') await expect(page.locator('#vue-bilan .fr-page')).toBeVisible();
  if (route.page === 'territory') await expect(page.locator('.vue--territoire')).toBeVisible();
  if (route.page === 'dossiers') await expect(page.locator('body')).toHaveAttribute('data-page', 'editorial');
  if (route.page === 'mandats') await expect(page.locator('#mandats')).toBeVisible();
}

async function noHorizontalOverflow(page) {
  const size = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(size.document, `Header/page horizontal overflow: ${JSON.stringify(size)}`).toBeLessThanOrEqual(size.viewport + 1);
}

async function checkHeaderGeometry(page, viewportWidth, mobile) {
  const brand = header(page).locator('.entete__marque');
  const actions = header(page).locator('.entete__actions');
  const brandBox = await brand.boundingBox();
  const actionsBox = await actions.boundingBox();
  expect(brandBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  expect(brandBox.x).toBeLessThan(actionsBox.x);
  expect(actionsBox.x + actionsBox.width).toBeLessThanOrEqual(viewportWidth + 1);
  expect(Math.abs((brandBox.y + brandBox.height / 2) - (actionsBox.y + actionsBox.height / 2))).toBeLessThan(8);

  await expect(socialLink(page)).toBeVisible();
  const socialBox = await socialLink(page).boundingBox();
  expect(socialBox).not.toBeNull();
  expect(socialBox.x + socialBox.width).toBeLessThanOrEqual(viewportWidth + 1);
  if (mobile) {
    await expect(menuButton(page)).toBeVisible();
    const menuBox = await menuButton(page).boundingBox();
    expect(menuBox).not.toBeNull();
    expect(menuBox.width).toBeGreaterThanOrEqual(44);
    expect(menuBox.height).toBeGreaterThanOrEqual(44);
    expect(socialBox.width).toBeGreaterThanOrEqual(44);
    expect(socialBox.height).toBeGreaterThanOrEqual(44);
    expect(menuBox.x).toBeLessThan(socialBox.x);
    expect(Math.abs(menuBox.y - socialBox.y)).toBeLessThan(2);
  } else {
    await expect(menuButton(page)).toBeHidden();
    await expect(nav(page)).toBeVisible();
  }
}

async function capture(page, info, name) {
  const path = info.outputPath(`${name}-${info.project.name}.png`);
  await page.screenshot({ path, fullPage: false, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
  return path;
}

test('shared header works across public pages, viewports, and repeated SPA navigation', async ({ page }, info) => {
  // Failure cases covered here: brand/actions wrap or overflow at 320px; menu/X
  // controls shrink below a 44px touch target; a menu remains open after Escape,
  // an outside click, or navigation; and repeat SPA swaps duplicate header controls.
  test.setTimeout(120_000);
  const viewport = info.project.use.viewport;
  const mobile = viewport.width <= 700;
  const observedRoutes = [];

  for (const route of ROUTES) {
    await waitForPage(page, route);
    await checkHeaderGeometry(page, viewport.width, mobile);
    await noHorizontalOverflow(page);
    if (route.page === 'mandats' && mobile) {
      await expect(nav(page)).toBeHidden();
      await capture(page, info, 'header-mandats-closed');
      await menuButton(page).click();
      await expect(nav(page)).toBeVisible();
      await capture(page, info, 'header-mandats-open');
      await page.keyboard.press('Escape');
      await expect(nav(page)).toBeHidden();
    }
    observedRoutes.push({ ...route, pathname: new URL(page.url()).pathname });
  }

  // This fallback page imports the shared shell without the compact menu.
  const fallbackScreenshots = [];
  for (const path of ['/confidentialite/']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(header(page)).toBeVisible();
    await expect(nav(page)).toBeVisible();
    await expect(menuButton(page)).toHaveCount(0);
    await expect(nav(page).locator('a[href="/bilan/"]')).toHaveText('France');
    await expect(nav(page).locator('a[href="/territoire"]')).toHaveText('Ville');
    await expect(nav(page).locator('a[href="/analyses/"]')).toHaveText('Dossiers');
    await noHorizontalOverflow(page);
    fallbackScreenshots.push(await capture(page, info, `header-fallback-${path.replaceAll('/', '-') || 'root'}`));
    observedRoutes.push({ page: 'fallback', path, menu: 'absent', nav: 'visible' });
  }

  // Keep a closed/open pair from the actual home screen for visual review.
  await waitForPage(page, ROUTES[0]);
  if (mobile) {
    await expect(nav(page)).toBeHidden();
    const closedScreenshot = await capture(page, info, 'header-menu-closed');
    await menuButton(page).click();
    await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(nav(page)).toBeVisible();
    const openScreenshot = await capture(page, info, 'header-menu-open');
    await noHorizontalOverflow(page);

    await page.keyboard.press('Escape');
    await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(nav(page)).toBeHidden();
    await expect(menuButton(page)).toBeFocused();

    // A click outside the header closes the same open menu without navigating.
    await menuButton(page).click();
    await expect(nav(page)).toBeVisible();
    await page.mouse.click(viewport.width - 2, viewport.height - 2);
    await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(nav(page)).toBeHidden();

    // Repeated France ↔ Ville SPA swaps must keep one live control set and close
    // the menu on each link activation rather than accumulating handlers/nodes.
    for (const destination of ['France', 'Ville', 'France', 'Ville']) {
      await menuButton(page).click();
      await expect(nav(page)).toBeVisible();
      await nav(page).getByRole('link', { name: destination, exact: true }).click();
      const expectedPath = destination === 'France' ? '/bilan/' : '/territoire';
      await expect.poll(() => new URL(page.url()).pathname).toBe(expectedPath);
      await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(nav(page)).toBeHidden();
      await expect(header(page).locator('button.fr-menu')).toHaveCount(1);
      await expect(header(page).locator('.site-x-link')).toHaveCount(1);
      await expect(header(page).locator('nav.entete__nav')).toHaveCount(1);
      await checkHeaderGeometry(page, viewport.width, true);
      await noHorizontalOverflow(page);
    }

    // Dossiers is a real document link; its fresh header must start closed too.
    await menuButton(page).click();
    await nav(page).getByRole('link', { name: 'Dossiers', exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/analyses/');
    await expect(page.locator('body')).toHaveAttribute('data-page', 'editorial');
    await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(nav(page)).toBeHidden();
    await checkHeaderGeometry(page, viewport.width, true);
    await noHorizontalOverflow(page);
    observedRoutes.push({ page: 'spa-repeat', path: new URL(page.url()).pathname, destinations: ['France', 'Ville', 'France', 'Ville'] });

    const evidence = {
      project: info.project.name,
      browser: page.context().browser()?.version() ?? 'unknown',
      viewport,
      routes: observedRoutes,
      interactions: ['Escape closes and restores focus', 'outside click closes', 'France/Ville SPA links close menu', 'Dossiers native link reloads closed'],
      screenshots: [closedScreenshot, openScreenshot, ...fallbackScreenshots],
    };
    const evidencePath = info.outputPath(`header-navigation-inputs-${info.project.name}.json`);
    await writeFile(evidencePath, JSON.stringify(evidence, null, 2));
    await info.attach('header-navigation-repro-inputs', { path: evidencePath, contentType: 'application/json' });
  } else {
    await expect(nav(page)).toBeVisible();
    await expect(menuButton(page)).toBeHidden();
    const screenshot = await capture(page, info, 'header-desktop-navigation-visible');
    const evidence = {
      project: info.project.name,
      browser: page.context().browser()?.version() ?? 'unknown',
      viewport,
      routes: observedRoutes,
      desktop: 'primary links visible; compact menu button hidden',
      screenshots: [screenshot, ...fallbackScreenshots],
    };
    const evidencePath = info.outputPath(`header-navigation-inputs-${info.project.name}.json`);
    await writeFile(evidencePath, JSON.stringify(evidence, null, 2));
    await info.attach('header-navigation-repro-inputs', { path: evidencePath, contentType: 'application/json' });
  }
});
