import { test, expect } from '@playwright/test';

// Mandats nouvelle formule : parcours réel d'une première année, sans horloge.
// Mouvement réduit pour que les transitions ne rallongent pas le parcours ; les
// mêmes règles s'appliquent avec les animations.
const HOME = '/mandats/jouer/';

async function sansDebordement(page) {
  // Comparer à la fenêtre configurée : un débordement élargit innerWidth sur mobile (dézoom).
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largeur, 'aucun débordement horizontal').toBeLessThanOrEqual(page.viewportSize().width + 1);
}

async function avancer(page) {
  await sansDebordement(page);
  if (await page.locator('#e-fin.ouvert').count()) return 'fin';
  if (await page.locator('#e-budget.ouvert').count()) { await page.locator('#b-voter').click(); return 'budget'; }
  if (await page.locator('#e-evt.ouvert').count()) {
    // Clavier : l'écran plein cadre défile seul sur les petits téléphones.
    const action = page.locator('#evt-actions button').last();
    await action.focus();
    await page.keyboard.press('Enter');
    return 'evenement';
  }
  const dossier = page.locator('.dossier:not(.signe):not(.reforme)').first();
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
  await expect(page.locator('.dossier:not(.reforme)')).toHaveCount(2);
  await expect(page.locator('.dossier.reforme')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Clore/ })).toHaveCount(0);

  const vus = new Set();
  for (let pas = 0; pas < 80; pas += 1) {
    const etat = await avancer(page);
    vus.add(etat);
    if (etat === 'fin') break;
    if ((await page.locator('#date').textContent()) === 'Année 2 · Hiver' && vus.has('budget')) break;
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
  await expect(page.locator('#pointage')).toContainText('pour');
  // Coûts et effets différés visibles avant le vote, comme dans le catalogue.
  await expect(page.locator('.consequences-reforme .puce').first()).toBeVisible();
  const avant = await page.locator('#pointage b').first().textContent();
  const centristes = page.locator('.option.nego[data-a="centre"]');
  await centristes.click();
  await expect(centristes).toHaveAttribute('aria-pressed', 'true');
  // Le capital politique se dépense : un jeton de moins, et l'hémicycle se met à jour.
  await expect(page.locator('#jetons')).toContainText('2 / 3');
  await expect(page.locator('#pointage .hemi circle')).not.toHaveCount(0);
  const annonce = await page.locator('#pointage b').first().textContent();
  expect(Number(annonce)).toBeGreaterThan(Number(avant));
  await page.getByRole('button', { name: 'Présenter au vote' }).click();
  await expect(page.locator('#e-evt')).toHaveClass(/ouvert/);
  // Le résultat reprend exactement le pointage annoncé.
  await expect(page.locator('#e-evt')).toContainText(`${annonce} voix pour`);
  await expect(page.locator('#evt-sur')).toHaveText('Assemblée nationale');
  await page.locator('#evt-actions button').last().click();
  await expect(page.getByRole('button', { name: 'Réforme présentée ce trimestre' })).toBeDisabled();
});

test('une partie en cours se reprend après rechargement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(HOME);
  await page.getByRole('button', { name: /Majorité relative/ }).click();
  const titre = await page.locator('.dossier .t').first().innerText();
  await avancer(page);
  await expect(page.locator('.dossier.signe')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: /Reprendre mon mandat/ }).click();
  await expect(page.locator('#e-intro')).not.toHaveClass(/ouvert/);
  await expect(page.locator('.dossier.signe')).toHaveCount(1);
  await expect(page.locator('.dossier.signe .t')).toHaveText(titre);
  await expect(page.locator('#date')).toHaveText('Année 1 · Hiver');
});
