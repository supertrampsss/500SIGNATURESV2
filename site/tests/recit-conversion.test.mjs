import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const publication = JSON.parse(await readFile(new URL('./fixtures/publication.json', import.meta.url), 'utf8'));
const index = [...publication.recherche, { c: '99999', n: 'Bordeaux-Saint-Clair', l: 'commune', p: '76' }];

async function servir(page, erreurIndex = false) {
  let indexRequetes = 0;
  await page.addInitScript(() => localStorage.setItem('500signatures.audience.v1', JSON.stringify({ choice: 'refused', expires: Date.now() + 864e5 })));
  await page.route(/https:\/\/[^/]+\.r2\.dev\//, async route => {
    const chemin = new URL(route.request().url()).pathname;
    if (chemin.endsWith('/recherche.json') && erreurIndex && ++indexRequetes === 1) {
      await route.fulfill({ status: 503, body: '{}' }); return;
    }
    const corps = chemin === '/data/derniere.json' ? { version: 'essai' }
      : chemin.endsWith('/recherche.json') ? index
      : /\/territoires\/commune\/(33|75)\.json$/.test(chemin) ? publication.communes : undefined;
    await route.fulfill({ status: corps ? 200 : 404, contentType: 'application/json', body: JSON.stringify(corps ?? {}) });
  });
}

test('premier écran, sommaire mobile et explications restent accessibles', async ({ page }, info) => {
  await servir(page);
  await page.goto('/');
  await expect(page.locator('.recit--actif')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const acces = page.getByRole('link', { name: 'Voir les comptes de ma commune', exact: true });
  await expect(acces).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath('accueil-cro.png'), animations: 'disabled', scale: 'css' });
  for (const lien of await page.locator('[data-rail]').all()) await expect(lien).toHaveAccessibleName(/\S/);
  if (page.viewportSize().width <= 760) {
    await page.locator('.recit__sommaire summary').click();
    await expect(page.locator('[data-chapitre-lien="ville"]')).toBeVisible();
    await page.screenshot({ path: info.outputPath('sommaire-cro.png'), animations: 'disabled', scale: 'css' });
    await page.locator('[data-chapitre-lien="ville"]').click();
    await expect(page.locator('.recit__sommaire')).not.toHaveAttribute('open');
    await expect(page.getByRole('combobox', { name: 'Rechercher une commune' })).toBeInViewport();
  } else {
    await acces.click();
    await expect(page.getByRole('combobox', { name: 'Rechercher une commune' })).toBeInViewport();
  }
  await page.screenshot({ path: info.outputPath('commune-recherche.png'), animations: 'disabled', scale: 'css' });
  await page.goto('/salaires/');
  await expect(page.locator('.etape__desc').first()).toBeVisible();
  await expect(page.locator('.etape__desc').first()).toContainText('Célibataire, sans enfant');
  await page.locator('.etape__desc').first().scrollIntoViewIfNeeded();
  await expect(page.locator('.etape__desc').first()).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width + 1);
  await page.screenshot({ path: info.outputPath('salaires-profil-visible.png'), animations: 'disabled', scale: 'css' });
});

test('recherche postale, ponctuation, choix explicite et navigation clavier', async ({ page }, info) => {
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await servir(page);
  await page.goto('/#ville');
  const champ = page.getByRole('combobox', { name: 'Rechercher une commune' });
  await champ.fill('saint clair');
  await expect(page.getByRole('option', { name: /Bordeaux-Saint-Clair/ })).toBeVisible();
  await champ.fill('Borde');
  await expect(page.getByRole('option')).toHaveCount(2);
  await champ.press('Enter');
  await expect(page.locator('.ville-etat')).toContainText('Choisissez votre commune');
  await expect(page.locator('[data-ville-etapes] .etape')).toHaveCount(0);
  await expect(page).not.toHaveURL(/ville=\d/);
  await champ.press('ArrowDown');
  await champ.press('Enter');
  await expect(page.locator('[data-ville-etapes] .etape').first()).toContainText('Bordeaux');
  await page.goto('/#ville');
  await champ.fill('33000');
  await expect(page.getByRole('option', { name: /Bordeaux/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Voir les comptes', exact: true }).click();
  await expect(page).toHaveURL(/ville=33063/);
  await expect(page.locator('[data-ville-etapes] .etape').first()).toContainText('Bordeaux');
  expect(erreurs).toEqual([]);
  await page.locator('[data-ville-etapes] .etape').first().evaluate(el => { el.scrollIntoView({ block: 'center', behavior: 'instant' }); dispatchEvent(new Event('scroll')); });
  await expect(page.locator('[data-ville-etapes] .etape').first()).toHaveClass(/est-courante/);
  await page.screenshot({ path: info.outputPath('commune-code-postal.png'), animations: 'disabled', scale: 'css' });
});

test('une erreur réseau conserve la saisie et permet une vraie nouvelle tentative', async ({ page }) => {
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await servir(page, true);
  await page.goto('/#ville');
  const champ = page.getByRole('combobox', { name: 'Rechercher une commune' });
  await champ.fill('Bordeaux');
  await expect(page.getByRole('button', { name: 'Réessayer', exact: true })).toBeVisible();
  await expect(champ).toHaveValue('Bordeaux');
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await expect(page.getByRole('option')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Réessayer', exact: true })).toBeHidden();
  await page.getByRole('option', { name: 'Bordeaux 33', exact: true }).click();
  await expect(page.locator('[data-ville-etapes] .etape').first()).toContainText('Bordeaux');
  expect(erreurs).toEqual([]);
});
