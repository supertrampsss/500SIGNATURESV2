import { test, expect } from '@playwright/test';

// Mandats nouvelle formule : parcours réel d'une première année, sans horloge.
// Mouvement réduit pour que les transitions ne rallongent pas le parcours ; les
// mêmes règles s'appliquent avec les animations.
const HOME = '/mandats/jouer/';

async function sansDebordement(page) {
  const [largeur, ecran] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(largeur).toBeLessThanOrEqual(ecran);
}

async function avancer(page) {
  if (await page.locator('#e-fin.ouvert').count()) return 'fin';
  if (await page.locator('#e-budget.ouvert').count()) { await page.locator('#b-voter').click(); return 'budget'; }
  if (await page.locator('#e-evt.ouvert').count()) { await page.locator('#evt-actions button').last().click(); return 'evenement'; }
  const dossier = page.locator('.dossier:not(.signe)').first();
  if (await dossier.count()) {
    await dossier.click();
    await expect(page.locator('#decision')).toHaveClass(/ouvert/);
    await page.locator('#d-options .option').last().click();
    await expect(page.locator('#decision')).not.toHaveClass(/ouvert/);
    await page.waitForTimeout(150);
    return 'dossier';
  }
  await page.waitForTimeout(100);
  return 'attente';
}

test('une première année se joue sans bouton de clôture, avec un budget voté', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const erreurs = [];
  page.on('pageerror', (erreur) => erreurs.push(erreur.message));
  await page.goto(HOME);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Cinq ans.');
  await expect(page.getByText('152,51', { exact: true })).toBeVisible();
  await sansDebordement(page);
  await page.getByRole('button', { name: /Majorité relative/ }).click();
  await expect(page.locator('#date')).toHaveText('Année 1 · Hiver');
  await expect(page.locator('.dossier')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /Clore/ })).toHaveCount(0);

  const vus = new Set();
  for (let pas = 0; pas < 80; pas += 1) {
    const etat = await avancer(page);
    vus.add(etat);
    if (etat === 'fin') break;
    if ((await page.locator('#date').innerText()) === 'Année 2 · Hiver' && vus.has('budget')) break;
  }
  expect(vus.has('budget')).toBe(true);
  await expect(page.locator('#date')).toHaveText('Année 2 · Hiver');
  await expect(page.locator('#journal li').first()).not.toHaveText('Le mandat commence.');
  await sansDebordement(page);
  expect(erreurs).toEqual([]);
});

test('une grande réforme passe devant l’Assemblée et laisse sa trace', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(HOME);
  await page.getByRole('button', { name: /Majorité absolue/ }).click();
  await page.getByRole('button', { name: 'Grandes réformes' }).click();
  const reforme = page.locator('#d-options .option').filter({ hasText: 'Supprimer la moitié des niches fiscales' });
  await expect(reforme).toContainText('Md€/an');
  await expect(reforme).toContainText('Pointage');
  await reforme.click();
  await expect(page.locator('#e-evt')).toHaveClass(/ouvert/);
  await expect(page.locator('#evt-sur')).toHaveText('Assemblée nationale');
  await page.locator('#evt-actions button').last().click();
  await expect(page.getByRole('button', { name: 'Réforme présentée ce trimestre' })).toBeDisabled();
});
