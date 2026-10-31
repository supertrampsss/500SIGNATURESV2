import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

// Le récit France est écrit au build avec la publication du moment ; la ville, elle,
// se charge dans le navigateur. Le fixture sert les comptes de Bordeaux et l'index de recherche.
const publication = JSON.parse(await readFile(new URL('./fixtures/publication.json', import.meta.url), 'utf8'));
const donnees = /https:\/\/[^/]+\.r2\.dev\//;
const bordeaux = publication.communes['33063'].series;
const derniere = serie => Object.keys(serie).filter(k => Number.isFinite(serie[k])).sort().at(-1);

async function servir(page) {
  await page.route(donnees, async route => {
    const chemin = new URL(route.request().url()).pathname;
    let corps;
    if (chemin === '/data/derniere.json') corps = { version: 'essai' };
    else if (chemin.endsWith('/recherche.json')) corps = publication.recherche;
    else if (/\/territoires\/commune\/(33|75)\.json$/.test(chemin)) corps = publication.communes;
    await route.fulfill({ status: corps ? 200 : 404, contentType: 'application/json', body: JSON.stringify(corps ?? {}) });
  });
  // Le choix d'audience est testé à part : ici, il ne recouvre pas le récit.
  await page.addInitScript(() => { try { localStorage.setItem('500signatures.audience.v1', JSON.stringify({ choice: 'refused', expires: Date.now() + 864e5 })); } catch {} });
}

async function sansDebordement(page) {
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largeur, 'aucun débordement horizontal').toBeLessThanOrEqual(page.viewportSize().width + 1);
}

async function preuve(page, info, nom, details = {}) {
  const image = info.outputPath(`${nom}.png`);
  await page.screenshot({ path: image });
  await info.attach(nom, { path: image, contentType: 'image/png' });
  const fichier = info.outputPath(`${nom}.json`);
  await writeFile(fichier, JSON.stringify({ projet: info.project.name, fenetre: page.viewportSize(), url: page.url(), ...details }, null, 2));
  await info.attach(`${nom}-observations`, { path: fichier, contentType: 'application/json' });
}

/** Fait défiler jusqu'à une étape et attend qu'elle pilote la scène. */
async function lire(page, selecteur) {
  const etape = page.locator(`.etape${selecteur}`).first();
  // Chrome sans écran peut différer l'événement de défilement jusqu'à la prochaine image :
  // on le signale explicitement après avoir déplacé la page.
  await etape.evaluate(el => { el.scrollIntoView({ block: 'center' }); dispatchEvent(new Event('scroll')); });
  await expect(etape).toHaveClass(/est-courante/);
  return etape;
}

test('le récit se lit en défilant, de la facture jusqu’au jeu', async ({ page }, info) => {
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await servir(page);
  await page.goto('/');
  await expect(page.locator('.recit--actif')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Chaque année, la France');
  await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link')).toHaveText(['Récit', 'Salaires', 'Mandats']);
  // Le défilement reste celui du navigateur : aucune étape n'est masquée ou retenue.
  const total = await page.locator('.etape').count();
  expect(total).toBeGreaterThan(12);
  await expect(page.locator('.etape').first()).toHaveClass(/est-courante/);
  for (const [selecteur, tableau, chapitre] of [
    ['[data-tableau="billets"]', 'billets', 'recettes'],
    ['[data-tableau="ecart"][data-k="1"]', 'ecart', 'deficit'],
    ['[data-tableau="dette"]', 'dette', 'dette'],
    ['[data-tableau="arbre"]', 'arbre', 'argent'],
    ['[data-tableau="europe"]', 'europe', 'europe'],
    ['[data-tableau="pieces"]', 'pieces', 'salaire'],
  ]) {
    if (!await page.locator(`.etape${selecteur}`).count()) continue;
    const etape = await lire(page, selecteur);
    await expect(page.locator('[data-recit]')).toHaveAttribute('data-tableau', tableau);
    await expect(page.locator(`[data-rail="${chapitre}"]`)).toHaveClass(/actif/);
    await expect(etape.locator('.etape__source')).not.toBeEmpty();
    await sansDebordement(page);
    await preuve(page, info, `recit-${tableau}`, { titre: await etape.locator('.etape__titre').innerText() });
  }
  // Chaque chiffre porte sa source et son année ; aucune étape n'affiche « 0 » faute de donnée.
  for (const valeur of await page.locator('.etape__gros:not([data-direct])').evaluateAll(els => els.map(e => Number(e.dataset.valeur)))) {
    expect(Number.isFinite(valeur) && valeur !== 0).toBe(true);
  }
  // Le rail mène directement à un chapitre.
  await page.locator('[data-rail="mandats"]').click();
  await expect(page.locator('.etape[data-tableau="final"]')).toHaveClass(/est-courante/);
  const jouer = page.getByRole('link', { name: 'Commencer mon mandat' });
  await expect(jouer).toHaveAttribute('href', '/mandats/');
  await expect(jouer).toBeInViewport();
  await preuve(page, info, 'recit-mandats');
  await jouer.click();
  await expect(page).toHaveURL(/\/mandats\/$/);
  await expect(page.locator('#e-intro')).toBeVisible();
  expect(erreurs).toEqual([]);
});

test('votre ville s’insère dans le récit et se partage par son adresse', async ({ page }, info) => {
  await servir(page);
  await page.goto('/');
  await lire(page, '[data-tableau="ville"]');
  const champ = page.getByRole('combobox', { name: 'Rechercher une commune' });
  await champ.fill('Borde');
  await expect(page.getByRole('option', { name: /Bordeaux/ })).toBeVisible();
  await preuve(page, info, 'ville-suggestions');
  await page.getByRole('option', { name: /Bordeaux/ }).click();
  await expect(page).toHaveURL(/\?ville=33063$/);
  const etapes = page.locator('[data-ville-etapes] .etape');
  await expect(etapes.first()).toBeVisible();
  expect(await etapes.count()).toBeGreaterThanOrEqual(3);
  await expect(etapes.first().locator('.etape__titre')).toContainText('Bordeaux');
  // Les montants affichés sont ceux de la commune publiée.
  const recettes = Number(await etapes.first().locator('.etape__gros').getAttribute('data-valeur'));
  const annee = (await etapes.first().locator('.etape__lib').innerText()).match(/\d{4}/)[0];
  expect(recettes).toBeCloseTo(bordeaux.ofgl_recettes_fonctionnement[annee] / 1e6, 6);
  const dette = page.locator('[data-ville-etapes] .etape[data-k="4"]');
  if (await dette.count()) {
    expect(Number(await dette.locator('.etape__gros').getAttribute('data-valeur'))).toBeCloseTo(bordeaux.ofgl_encours_dette[derniere(bordeaux.ofgl_encours_dette)] / 1e6, 6);
  }
  for (let i = 0; i < await etapes.count(); i++) {
    await etapes.nth(i).evaluate(el => { el.scrollIntoView({ block: 'center' }); dispatchEvent(new Event('scroll')); });
    await expect(etapes.nth(i)).toHaveClass(/est-courante/);
    await sansDebordement(page);
  }
  await preuve(page, info, 'ville-bordeaux');
  // Une recherche sans résultat le dit.
  await lire(page, '[data-tableau="ville"]');
  await champ.fill('Zzzzz');
  await champ.press('Enter');
  await expect(page.locator('.ville-etat')).toHaveText('Aucune commune trouvée.');
  // Le lien partagé rouvre le récit sur la même ville, sans défiler à la place du lecteur.
  await page.goto('about:blank');
  await page.goto('/?ville=33063');
  await expect(page.locator('[data-ville-etapes] .etape').first()).toContainText('Bordeaux', { timeout: 30000 });
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('sans JavaScript, le récit et ses sources se lisent en continu', async ({ browser, baseURL }, info) => {
  const contexte = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: info.project.use.viewport, isMobile: Boolean(info.project.use.isMobile) });
  const page = await contexte.newPage();
  try {
    await page.goto('/');
    await expect(page.locator('.recit__scene')).toBeHidden();
    await expect(page.locator('.etape__gros').first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('#sources a').first()).toHaveAttribute('href', /^https:\/\//);
    await expect(page.getByRole('link', { name: 'Commencer mon mandat' })).toHaveAttribute('href', '/mandats/');
    await sansDebordement(page);
    await preuve(page, info, 'recit-sans-javascript');
  } finally { await contexte.close(); }
});

test('mouvement réduit : mêmes chiffres, sans animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await servir(page);
  await page.goto('/');
  const etape = await lire(page, '[data-tableau="ecart"]');
  const gros = etape.locator('.etape__gros');
  const attendu = Number(await gros.getAttribute('data-valeur')).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  await expect(gros).toContainText(attendu.replace(/\s/g, ' ').slice(0, 2));
  await expect(page.locator('.odo')).toHaveCount(0);
});

test('Salaires et confidentialité partagent l’en-tête du récit', async ({ page }) => {
  await page.goto('/salaires/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Du coût du travail au revenu reçu.');
  await expect(page.locator('.entete__nav a[aria-current="page"]')).toHaveText('Salaires');
  await expect(page.locator('#profil-resultat')).toHaveText('52,80 €');
  await sansDebordement(page);
  await page.goto('/confidentialite/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vos données, simplement.');
  await sansDebordement(page);
});
