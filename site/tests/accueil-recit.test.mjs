import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

// Published data, kept independent from the renderer and its calculation helper.
const publication = JSON.parse(await readFile(new URL('./fixtures/editorial-publication.json', import.meta.url), 'utf8'));
const recettes = publication.pays.FR.series.eurostat_apu_recettes;
const depenses = publication.pays.FR.series.eurostat_apu_depenses;
const annee = Object.keys(recettes).filter(year => /^\d{4}$/.test(year) && recettes[year] > 0 && Number.isFinite(depenses[year])).sort().at(-1);
const annual = { year: annee, receipts: recettes[annee], expenses: depenses[annee] };
const ratio = annual.expenses / annual.receipts * 100;
const gap = (annual.expenses - annual.receipts) / annual.receipts * 100;
const fr = value => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
const compactText = text => text.replace(/[\s\u00a0\u202f]/g, '');
const remoteData = /https:\/\/[^/]+\.r2\.dev\//;
const expectedVersions = new WeakMap();
const navigationEvents = new WeakMap();

test.afterEach(async ({ page }, info) => {
  const events = navigationEvents.get(page);
  if (!events) return;
  const path = info.outputPath('navigation-events.json');
  await writeFile(path, JSON.stringify(events, null, 2));
  await info.attach('navigation-events', { path, contentType: 'application/json' });
});

async function servePublication(page, { version = `${publication.publication}-recit`, pays = publication.pays, failCountries = false, countryGate } = {}) {
  if (!failCountries) expectedVersions.set(page, version);
  await page.route(remoteData, async route => {
    const path = new URL(route.request().url()).pathname;
    if (failCountries && path.endsWith('/territoires/pays/tous.json')) return route.abort();
    if (countryGate && path.endsWith('/territoires/pays/tous.json')) await countryGate;
    let body;
    if (path === '/data/derniere.json') body = { version };
    else if (path === '/geo/derniere.json') body = { cle: 'geo/test.pmtiles', version: 'test' };
    else if (path.endsWith('/manifeste.json')) body = { version, jeux: publication.jeux };
    else if (path.endsWith('/indicateurs.json')) body = publication.indicateurs;
    else if (path.endsWith('/recherche.json')) body = publication.recherche;
    else if (path.endsWith('/territoires/pays/tous.json')) body = pays;
    else if (path.endsWith('/territoires/region/tous.json')) body = publication.regions;
    else if (path.endsWith('/territoires/departement/tous.json')) body = publication.departements;
    else if (/\/territoires\/commune\/(33|75)\.json$/.test(path)) body = publication.communes;
    else if (/\/territoires\/(commune|region|departement)\/index\.json$/.test(path)) body = publication[`index_${path.split('/').at(-2)}`];
    else if (path.endsWith('/comparaisons.json')) body = { criteres: [], groupes: {} };
    await route.fulfill({ status: body ? 200 : 404, contentType: 'application/json', body: JSON.stringify(body ?? {}) });
  });
}

async function activate(locator, info) {
  if (info.project.use.hasTouch) await locator.tap();
  else await locator.click();
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'aucun débordement horizontal').toBeLessThanOrEqual(1);
}

async function entirelyVisible(locator) {
  await locator.scrollIntoViewIfNeeded();
  const bounds = await locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    const point = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: innerWidth, height: innerHeight,
      receivesPointer: point === element || element.contains(point) };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width + 1);
  expect(bounds.top).toBeGreaterThanOrEqual(-1);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height + 1);
  expect(bounds.receivesPointer, 'la commande visible reçoit effectivement le clic').toBe(true);
}

async function evidence(page, info, name, details = {}) {
  const image = info.outputPath(`${name}.png`);
  await page.screenshot({ path: image, animations: 'disabled' });
  await info.attach(name, { path: image, contentType: 'image/png' });
  const report = info.outputPath(`${name}.json`);
  await writeFile(report, JSON.stringify({ phase: process.env.MANDATS_RECIT_PHASE ?? 'after', project: info.project.name,
    viewport: page.viewportSize(), url: page.url(), ...details }, null, 2));
  await info.attach(`${name}-observations`, { path: report, contentType: 'application/json' });
}

async function openHome(page) {
  await page.goto('/');
  await expect(page.locator('#vue-accueil .accueil-story [data-recit]')).toBeVisible();
  if (expectedVersions.has(page)) await expect(page.locator('#vue-accueil')).toHaveAttribute('data-publication', expectedVersions.get(page));
  await expect(page.locator('#recit-sources')).not.toHaveAttribute('open');
  await page.evaluate(() => document.fonts.ready);
}

const courante = page => page.locator('.histoire__etape.est-courante');
const indexCourant = page => courante(page).getAttribute('data-i').then(Number);

/** Advance with the visible Next control (or the keyboard) until a step matching `selector` is current. */
async function chooseStep(page, selector, info, { keyboard = false } = {}) {
  const target = Number(await page.locator(`.histoire__etape${selector}`).first().getAttribute('data-i'));
  const precedent = page.locator('.histoire__prec');
  while (await indexCourant(page) > target) await precedent.click({ force: true });
  while (await indexCourant(page) < target) {
    if (keyboard) await page.keyboard.press('ArrowRight');
    else if (info.project.use.hasTouch) await page.locator('.histoire__suiv').tap({ force: true });
    else await page.locator('.histoire__suiv').click({ force: true });
  }
  await expect(courante(page)).toHaveAttribute('data-i', String(target));
  // La dernière étape se lit dans son panneau final, avec l’appel au jeu.
  const titre = selector.includes('final') ? page.locator('.histoire__final-titre') : courante(page).locator('.histoire__titre');
  await expect(titre).toBeInViewport();
  return courante(page);
}

const valeurAffichee = (page, selector) => page.locator(`.histoire__etape${selector} .histoire__gros`).first().getAttribute('data-valeur').then(Number);

test('l’histoire raconte les comptes publiés, étape par étape, jusqu’au jeu', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await servePublication(page);
  await openHome(page);
  await expect(page.locator('.histoire')).toHaveClass(/histoire--active/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  const total = await page.locator('.histoire__etape').count();
  expect(total).toBeGreaterThan(10);
  if (!info.project.use.isMobile) {
    // Un cran de molette avance d’une étape quand la scène occupe l’écran sous l’en-tête.
    await page.mouse.move(400, 400);
    await page.mouse.wheel(0, 120);
    await expect(courante(page)).toHaveAttribute('data-i', '1');
    await page.locator('.histoire__prec').click({ force: true });
    await expect(courante(page)).toHaveAttribute('data-i', '0');
  }
  // Les montants affichés sont ceux de la publication, sans arrondi caché.
  expect(await valeurAffichee(page, '[data-tableau="carte"][data-k="1"]')).toBeCloseTo(annual.expenses / 1e9, 6);
  expect(await valeurAffichee(page, '[data-tableau="billets"]')).toBeCloseTo(annual.receipts / 1e9, 6);
  expect(await valeurAffichee(page, '[data-tableau="ecart"][data-k="0"]')).toBeCloseTo(annual.receipts / 1e9, 6);
  expect(await valeurAffichee(page, '[data-tableau="ecart"][data-k="1"]:not(:has([data-direct]))')).toBeCloseTo((annual.expenses - annual.receipts) / 1e9, 6);
  for (const [selector, name] of [['[data-tableau="billets"]', 'recettes'], ['[data-tableau="ecart"][data-k="1"]', 'ecart'], ['[data-tableau="arbre"]', 'arbre'], ['[data-tableau="pieces"]', 'salaire'], ['[data-tableau="commune"]', 'commune']]) {
    // La répartition des dépenses n'existe que si la publication la fournit.
    if (!await page.locator(`.histoire__etape${selector}`).count()) continue;
    const step = await chooseStep(page, selector, info, { keyboard: name === 'arbre' });
    await expect(page.locator('.histoire')).toHaveAttribute('data-tableau', selector.match(/"([a-z]+)"/)[1]);
    await expect(page.locator('.histoire__compteur')).toContainText(`/ ${total}`);
    await noOverflow(page);
    await evidence(page, info, `histoire-${name}`, { annual, displayed: await step.locator('.histoire__titre').innerText() });
  }
  const champ = page.locator('#histoire-commune');
  await expect(champ).toBeVisible();
  const ville = page.locator('.histoire__villes a').first();
  await expect(ville).toHaveAttribute('href', /\/territoire\/\?niveau=commune&territoire=\d+/);
  await entirelyVisible(ville);
  await chooseStep(page, '[data-tableau="final"]', info);
  const jouer = page.locator('.histoire__cta');
  await expect(jouer).toHaveAttribute('href', '/mandats/jouer/');
  await entirelyVisible(jouer);
  await evidence(page, info, 'histoire-final');
  await expect(page.locator('.histoire__suiv')).toContainText('Recommencer');
  await page.locator('.histoire__suiv').click({ force: true });
  await expect(courante(page)).toHaveAttribute('data-i', '0');
  await expect(page.locator('#recit-sources')).toContainText(annual.year);
  expect(errors).toEqual([]);
});

test('les sources se consultent au clavier et au toucher sans perdre la lecture', async ({ page, browserName }, info) => {
  await servePublication(page);
  await openHome(page);
  await chooseStep(page, '[data-tableau="ecart"]', info);
  const trigger = page.locator('[data-recit-source]');
  await entirelyVisible(trigger);
  const before = await page.evaluate(() => ({ scroll: scrollY, step: document.querySelector('.histoire__etape.est-courante').dataset.i }));
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.locator('#recit-sources');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true);
  if (browserName !== 'webkit' || !info.project.use.isMobile) {
    await page.mouse.move(2, page.viewportSize().height / 2);
    await page.mouse.wheel(0, 700);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  } else {
    // Playwright cannot dispatch mouse wheels in mobile WebKit. Its source
    // journey still verifies modal focus/touch and the real root scroll lock.
    await expect(page.locator('html')).toHaveCSS('overflow-y', 'hidden');
  }
  expect(await page.evaluate(() => scrollY), 'le fond ne défile pas derrière les sources').toBeCloseTo(before.scroll, 0);
  await expect(dialog).toContainText(annual.year);
  const totals = compactText(await dialog.locator('.recit-source-accounts').innerText());
  for (const amount of [annual.receipts, annual.expenses, annual.receipts - annual.expenses]) expect(totals).toContain(compactText(fr(amount)));
  for (let index = 0; index < 9; index++) {
    await page.keyboard.press('Tab');
    // Native dialogs may yield one Tab stop to browser chrome (activeElement
    // becomes body). No background link may receive focus, and the next Tab
    // must return to a real source control.
    const focus = await dialog.evaluate(element => ({ inside: element.contains(document.activeElement), browser: document.activeElement === document.body }));
    expect(focus.inside || focus.browser, 'aucune commande derrière les sources ne reçoit le focus').toBe(true);
    if (focus.browser) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(before.scroll, 0);
  await expect(courante(page)).toHaveAttribute('data-i', before.step);

  await activate(trigger, info);
  await entirelyVisible(dialog.locator('[data-recit-close]'));
  await evidence(page, info, 'recit-sources', { readingPosition: before });
  await activate(dialog.locator('[data-recit-close]'), info);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(before.scroll, 0);
  await activate(trigger, info);
  const detail = dialog.getByRole('link', { name: 'Lire le détail des dépenses', exact: true });
  await entirelyVisible(detail);
  await activate(detail, info);
  await expect(page).toHaveURL(/\/bilan\/#france-sorties$/);
  await expect(page.locator('#vue-bilan')).toBeVisible();
  await noOverflow(page);
});

test('les destinations restent accessibles directement depuis le menu partagé', async ({ page }, info) => {
  const events = [];
  navigationEvents.set(page, events);
  await page.exposeFunction('recordRecitNavigation', value => events.push(value));
  await page.addInitScript(() => {
    const record = (kind, target) => window.recordRecitNavigation({ kind, target,
      time: performance.now(), url: location.href, menu: document.querySelector('.entete')?.dataset.frMenu,
      publication: document.querySelector('#vue-accueil')?.dataset.publication });
    document.addEventListener('click', event => record('click', event.target?.closest('button,a')?.getAttribute('aria-label') ?? event.target?.textContent?.trim()), true);
    new MutationObserver(changes => changes.forEach(change => record('attribute', change.attributeName)))
      .observe(document, { subtree: true, attributes: true, attributeFilter: ['data-fr-menu', 'data-publication'] });
  });
  await servePublication(page);
  await openHome(page);
  const navigation = page.getByRole('navigation', { name: 'Navigation principale', exact: true });
  for (const destination of [
    { name: 'France', path: '/bilan/', visible: '#vue-bilan' },
    { name: 'Ville', path: '/territoire/', visible: '#vue-territoire' },
    { name: 'Accueil', path: '/', visible: '[data-recit]' },
    { name: 'Salaires', path: '/salaires/', visible: '.salaires' },
    { name: 'Mandats', path: '/mandats/jouer/', visible: '#e-intro' },
  ]) {
    const link = navigation.getByRole('link', { name: destination.name, exact: true });
    if (!await link.isVisible()) {
      const menu = page.getByRole('button', { name: 'Ouvrir le menu', exact: true });
      await activate(menu, info);
      await expect(page.getByRole('button', { name: 'Fermer le menu', exact: true })).toHaveAttribute('aria-expanded', 'true');
    }
    await expect(link).toHaveAttribute('href', destination.path);
    await entirelyVisible(link);
    await activate(link, info);
    await expect(page).toHaveURL(new RegExp(`${destination.path.replaceAll('/', '\\/')}$`));
    await expect(page.locator(destination.visible)).toBeVisible();
    if (destination.name === 'Accueil') {
      await expect(page.locator('#vue-accueil')).toHaveAttribute('data-publication', expectedVersions.get(page));
    }
    if (destination.name !== 'Mandats') {
      // Native destinations first expose the SSR links, then enhance the
      // compact menu. Observe that completed enhancement before the next tap.
      await expect(page.locator('.fr-menu[data-menu-bound="true"]')).toBeAttached();
    }
    await noOverflow(page);
  }
  await activate(page.getByRole('link', { name: 'Retour au site', exact: true }), info);
  await expect(page).toHaveURL(/https?:\/\/[^/]+\/$/);
  await expect(page.locator('[data-recit]')).toBeVisible();
  await evidence(page, info, 'recit-retour-des-outils');
});

test('la navigation Suivant ferme les sources et laisse la recherche de ville utilisable', async ({ page }, info) => {
  await servePublication(page);
  await openHome(page);
  const cityLink = page.locator('#navigation-principale a[href="/territoire/"]');
  if (!await cityLink.isVisible()) await activate(page.getByRole('button', { name: 'Ouvrir le menu', exact: true }), info);
  await activate(cityLink, info);
  await expect(page.locator('#vue-territoire')).toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-recit]')).toBeVisible();
  await activate(page.locator('[data-recit-source]'), info);
  await expect(page.locator('#recit-sources')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#vue-territoire')).toBeVisible();
  await expect(page.locator('dialog:modal')).toHaveCount(0);
  const search = page.getByRole('combobox', { name: 'Rechercher une ville', exact: true });
  await search.fill('Bordeaux');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('Bordeaux');
  await noOverflow(page);
  await evidence(page, info, 'recit-sources-navigation-suivant');
});

test('la première visite conserve un choix de mesure d’audience accessible', async ({ page }, info) => {
  await servePublication(page);
  await page.goto('/');
  await expect(page.locator('[data-recit]')).toBeVisible();
  const consent = page.getByRole('region', { name: 'Mesure d’audience', exact: true });
  await expect(consent).toBeVisible();
  const refusal = consent.getByRole('button', { name: 'Refuser', exact: true });
  await noOverflow(page);
  await evidence(page, info, 'recit-premiere-visite', {
    consentBounds: await consent.boundingBox(),
    headingBounds: await page.locator('.histoire__etape.est-courante .histoire__titre').boundingBox(),
  });
  await entirelyVisible(refusal);
  await evidence(page, info, 'recit-choix-audience');
  await activate(refusal, info);
  await expect(consent).toHaveCount(0);
});

test('un lien direct vers les sources ouvre le même document consultable', async ({ page }, info) => {
  await servePublication(page);
  await page.goto('/#recit-sources');
  await expect(page.locator('[data-recit]')).toHaveAttribute('data-enhanced', 'true');
  const dialog = page.locator('#recit-sources');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true);
  await expect(dialog).toContainText(annual.year);
  await entirelyVisible(dialog.locator('[data-recit-close]'));
  await activate(dialog.locator('[data-recit-close]'), info);
  await expect(page.locator('#vue-accueil')).toHaveAttribute('data-publication', expectedVersions.get(page));
  await expect(dialog).not.toBeVisible();
  await expect(page).not.toHaveURL(/#recit-sources$/);
  await chooseStep(page, '[data-tableau="billets"]', info);
  await evidence(page, info, 'recit-lien-direct-sources');
});

test('une nouvelle publication arrivée pendant la lecture attend la fermeture des sources', async ({ page }, info) => {
  let releaseCountries;
  const countryGate = new Promise(resolve => { releaseCountries = resolve; });
  const version = `${publication.publication}-retardee`;
  const pays = structuredClone(publication.pays);
  pays.FR.series.eurostat_apu_recettes = { '2030': 1000 };
  pays.FR.series.eurostat_apu_depenses = { '2030': 1050 };
  await servePublication(page, { version, pays, countryGate });
  await page.goto('/');
  await expect(page.locator('[data-recit]')).toHaveAttribute('data-enhanced', 'true');
  const oldPublication = await page.locator('#vue-accueil').getAttribute('data-publication');
  const trigger = page.locator('[data-recit-source]');
  await activate(trigger, info);
  const dialog = page.locator('#recit-sources');
  await expect(dialog).toBeVisible();
  const oldContents = await dialog.innerText();
  const loaded = page.waitForResponse(response => response.url().endsWith('/territoires/pays/tous.json'));
  releaseCountries();
  await (await loaded).finished();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true);
  expect(await dialog.innerText()).toBe(oldContents);
  await expect(page.locator('#vue-accueil')).toHaveAttribute('data-publication', oldPublication);
  await activate(dialog.locator('[data-recit-close]'), info);
  await expect(page.locator('#vue-accueil')).toHaveAttribute('data-publication', version);
  expect(await valeurAffichee(page, '[data-tableau="carte"][data-k="1"]')).toBeCloseTo(1050 / 1e9, 9);
  await expect(trigger).toBeFocused();
  await expect(dialog).not.toBeVisible();
  await evidence(page, info, 'recit-publication-differee', { synthetic: true, before: oldPublication, after: version });
});

// Observe the actual HTML node before the module executes. A successful hydration
// must bind the existing publication, not replace it or wait for the data network.
async function observePublishedStory(page) {
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      const story = document.querySelector('#vue-accueil .accueil-story');
      if (!story || window.__publishedStory) return;
      window.__publishedStory = story;
      window.__publishedTitles = [...story.querySelectorAll('.histoire__gros')].map(element => element.dataset.valeur);
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  });
}

for (const condition of ['same-publication', 'unavailable-manifest', 'unavailable-countries']) {
  test(`le récit HTML reste interactif : ${condition}`, async ({ page }, info) => {
    const response = await page.request.get('/');
    expect(response.ok()).toBe(true);
    const stamp = (await response.text()).match(/id="vue-accueil"[^>]*data-publication="([^"]+)"/)?.[1];
    expect(stamp, 'la publication du HTML est identifiée').toBeTruthy();
    await observePublishedStory(page);
    if (condition === 'unavailable-manifest') await page.route(remoteData, route => route.abort());
    else await servePublication(page, { version: condition === 'same-publication' ? stamp : `${stamp}-new`, failCountries: condition === 'unavailable-countries' });
    await openHome(page);
    await chooseStep(page, '[data-tableau="billets"]', info);
    await activate(page.locator('[data-recit-source]'), info);
    await expect(page.locator('#recit-sources')).toBeVisible();
    if (condition === 'unavailable-manifest') await expect(page.locator('.recit-publication-note')).toContainText('Les comptes de la publication affichée restent consultables');
    await page.keyboard.press('Escape');
    const preserved = await page.evaluate(() => ({
      sameNode: window.__publishedStory === document.querySelector('#vue-accueil .accueil-story'),
      before: window.__publishedTitles,
      after: [...document.querySelectorAll('#vue-accueil .histoire__gros')].map(element => element.dataset.valeur),
    }));
    expect(preserved.sameNode).toBe(true);
    expect(preserved.after).toEqual(preserved.before);
    await noOverflow(page);
    await evidence(page, info, `recit-${condition}`, preserved);
  });
}

test('sans JavaScript les trois explications et les sources se lisent en continu', async ({ browser, baseURL }, info) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: info.project.use.viewport,
    isMobile: Boolean(info.project.use.isMobile), hasTouch: Boolean(info.project.use.hasTouch) });
  const page = await context.newPage();
  try {
    await page.goto('/');
    const etapes = page.locator('.histoire__etape');
    expect(await etapes.count()).toBeGreaterThan(10);
    for (const index of [0, 3, 8]) {
      const step = etapes.nth(index);
      await step.scrollIntoViewIfNeeded();
      await expect(step.locator('.histoire__titre')).toBeVisible();
      expect(await step.evaluate(element => getComputedStyle(element).position)).not.toMatch(/sticky|fixed|absolute/);
    }
    await expect(page.locator('.histoire__bas, .histoire__haut')).toHaveCount(2);
    await expect(page.locator('.histoire__bas')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Commencer mon mandat', exact: true })).toHaveAttribute('href', '/mandats/jouer/');
    const dialog = page.locator('#recit-sources');
    await expect(dialog).toHaveAttribute('open', '');
    expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(false);
    await expect(dialog).toHaveCSS('position', 'static');
    const detail = dialog.getByRole('link', { name: 'Lire le détail des dépenses', exact: true });
    await entirelyVisible(detail);
    await noOverflow(page);
    await evidence(page, info, 'recit-sans-javascript');
    await detail.click();
    await expect(page).toHaveURL(/\/bilan\/#france-sorties$/);
  } finally {
    await context.close();
  }
});

test('le mouvement réduit et le retour arrière gardent les trois idées disponibles', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await servePublication(page);
  await openHome(page);
  const step = await chooseStep(page, '[data-tableau="pieces"]', info, { keyboard: true });
  await expect(step.locator('.histoire__titre .m').first()).toHaveCSS('opacity', '1');
  const avant = await indexCourant(page);
  await page.keyboard.press('ArrowLeft');
  await expect(courante(page)).toHaveAttribute('data-i', String(avant - 1));
  const mobile = info.project.use.viewport.width <= 844;
  if (mobile) await expect(page.locator('.histoire__suiv')).toBeVisible();
  await noOverflow(page);
  await evidence(page, info, 'recit-mouvement-reduit');
});

// Synthetic variants exercise honest wording when a future publication changes
// the balance. They are not presented as French historical accounts.
for (const variant of [
  { name: 'excedent', receipt: 1000, expense: 975, label: 'Excédent' },
  { name: 'equilibre', receipt: 1000, expense: 1000, label: 'Équilibre' },
]) {
  test(`une publication ${variant.name} ne garde pas le récit d’un déficit`, async ({ page }, info) => {
    const pays = structuredClone(publication.pays);
    pays.FR.series.eurostat_apu_recettes = { '2030': variant.receipt };
    pays.FR.series.eurostat_apu_depenses = { '2030': variant.expense };
    await servePublication(page, { pays });
    await openHome(page);
    await expect(page.locator('.histoire')).not.toContainText('Il manque');
    await expect(page.locator('[data-direct]')).toHaveCount(0);
    const step = await chooseStep(page, '[data-tableau="ecart"][data-k="1"]', info);
    await expect(step.locator('.histoire__lib')).toHaveText(variant.label);
    expect(await valeurAffichee(page, '[data-tableau="ecart"][data-k="1"]')).toBeCloseTo(Math.abs(variant.expense - variant.receipt) / 1e9, 12);
    const diagram = { receipts: variant.receipt, expenses: variant.expense };
    await noOverflow(page);
    await evidence(page, info, `recit-${variant.name}`, { synthetic: true, diagram });
  });
}

test('des comptes absents ne sont jamais présentés comme zéro euro', async ({ page }, info) => {
  const pays = structuredClone(publication.pays);
  delete pays.FR.series.eurostat_apu_recettes;
  delete pays.FR.series.eurostat_apu_depenses;
  await servePublication(page, { pays });
  // Exercise a build with no usable accounts, rather than discarding the valid
  // SSR accounts that the separate network-failure journeys must preserve.
  await page.route(/http:\/\/127\.0\.0\.1:4180\/$/, async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/<div class="recit-histoire" data-recit>[\s\S]*?<\/dialog><\/div>/, '');
    await route.fulfill({ response, body });
  });
  await page.goto('/');
  await expect(page.locator('[data-recit-empty]')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Les comptes publics, à portée de main.');
  await expect(page.locator('.recit-number, .recit-grid, .histoire__gros')).toHaveCount(0);
  await expect(page.locator('[data-recit-empty] a[href="/sources/"]')).toBeVisible();
  await noOverflow(page);
  await evidence(page, info, 'recit-comptes-absents');
});

test('la recherche de commune de l’histoire ouvre la fiche trouvée', async ({ page }, info) => {
  await servePublication(page);
  await openHome(page);
  await chooseStep(page, '[data-tableau="commune"]', info);
  const champ = page.locator('#histoire-commune');
  await champ.fill('Bordeaux');
  await champ.press('Enter');
  await expect(page).toHaveURL(/\/territoire\/\?niveau=commune&territoire=33063$/);
  await expect(page.locator('#vue-territoire')).toBeVisible();
});
