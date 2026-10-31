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

/** Rien n'est rogné : les grands chiffres tiennent dans leur carte, les noms des barres dans leur ligne. */
async function lisible(page) {
  const debords = await page.evaluate(() => [...document.querySelectorAll('.est-courante .etape__gros, .viz.on .barre-l .n, .viz.on .barre-l b, .viz.on .tuile:not([hidden]) span:not([hidden]), .viz.on .kpi b')]
    .filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1).map(el => `${el.className}: ${el.textContent}`));
  expect(debords, 'aucun texte rogné').toEqual([]);
}

async function preuve(page, info, nom, details = {}) {
  const image = info.outputPath(`${nom}.png`);
  // Les transitions finies sont menées à leur état final : on photographie ce que lit le lecteur.
  await page.screenshot({ path: image, animations: 'disabled' });
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
    ['[data-tableau="paie"][data-k="4"]', 'paie', 'salaire'],
  ]) {
    if (!await page.locator(`.etape${selecteur}`).count()) continue;
    const etape = await lire(page, selecteur);
    await expect(page.locator('[data-recit]')).toHaveAttribute('data-tableau', tableau);
    await expect(page.locator(`[data-rail="${chapitre}"]`)).toHaveClass(/actif/);
    await sansDebordement(page);
    await lisible(page);
    await preuve(page, info, `recit-${tableau}`, { titre: await etape.locator('.etape__titre').innerText() });
  }
  // Les sources sont réunies en pied de page, pas répétées sous chaque chiffre ;
  // aucune étape n'affiche « 0 » faute de donnée.
  await expect(page.locator('.etape__source')).toHaveCount(0);
  for (const valeur of await page.locator('.etape__gros:not([data-direct])').evaluateAll(els => els.map(e => Number(e.dataset.valeur)))) {
    expect(Number.isFinite(valeur) && valeur !== 0).toBe(true);
  }
  // Le compteur en direct grandit sans sortir de sa carte.
  const direct = await lire(page, ':has([data-direct])');
  await page.waitForTimeout(400);
  await lisible(page);
  // Le chiffre copié est le chiffre lu, pas les rouleaux de l'animation.
  const copie = await page.locator('.etape[data-tableau="dette"]').first().evaluate(async el => {
    el.scrollIntoView({ block: 'center' }); dispatchEvent(new Event('scroll'));
    await new Promise(r => setTimeout(r, 300));
    const gros = el.querySelector('.etape__gros'); const sel = getSelection(); const r = document.createRange(); r.selectNodeContents(gros); sel.removeAllRanges(); sel.addRange(r);
    return sel.toString();
  });
  expect(copie).not.toMatch(/0123456789/);
  expect(direct).toBeTruthy();
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
  test.setTimeout(120_000);
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
  const dette = page.locator('[data-ville-etapes] .etape[data-sujet="dette"]');
  if (await dette.count()) {
    expect(Number(await dette.locator('.etape__gros').getAttribute('data-valeur'))).toBeCloseTo(bordeaux.ofgl_encours_dette[derniere(bordeaux.ofgl_encours_dette)] / 1e6, 6);
  }
  // Le détail de la commune : postes, missions, associations, impôts, sécurité, portrait.
  const sujets = await etapes.evaluateAll(els => els.map(el => el.dataset.sujet));
  for (const s of ['recettes', 'depenses', 'missions', 'associations', 'reste', 'dette', 'investissement', 'foncier', 'securite', 'portrait']) expect(sujets).toContain(s);
  await expect(etapes.first()).not.toContainText(/fonctionnement/i);
  for (let i = 0; i < await etapes.count(); i++) {
    await etapes.nth(i).evaluate(el => { el.scrollIntoView({ block: 'center' }); dispatchEvent(new Event('scroll')); });
    await expect(etapes.nth(i)).toHaveClass(/est-courante/);
    await page.waitForTimeout(300);
    await sansDebordement(page);
    await lisible(page);
    const sujet = sujets[i];
    if (sujet === 'securite') await expect(page.locator('[data-viz="ville"] .barre-l em').first()).toBeAttached();
    if (['recettes', 'missions', 'securite', 'portrait', 'investissement'].includes(sujet)) await preuve(page, info, `ville-${sujet}`);
  }
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

test('Salaires se lit comme le récit, et la confidentialité partage l’en-tête', async ({ page }, info) => {
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  await servir(page);
  await page.goto('/salaires/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Votre salaire, vu par votre employeur.');
  await expect(page.locator('.entete__nav a[aria-current="page"]')).toHaveText('Salaires');
  await expect(page.locator('.recit--actif')).toBeVisible();
  for (const [selecteur, tableau, nom] of [['[data-tableau="paie"][data-k="2"]', 'paie', 'salaires-paie'], ['[data-tableau="barres"][data-chapitre="depense"]', 'barres', 'salaires-depense'], ['[data-tableau="barres"][data-chapitre="ministeres"]', 'barres', 'salaires-ministeres'], ['[data-tableau="courbes"]', 'courbes', 'salaires-courbes']]) {
    if (!await page.locator(`.etape${selecteur}`).count()) continue;
    await lire(page, selecteur);
    await expect(page.locator('[data-recit]')).toHaveAttribute('data-tableau', tableau);
    await page.waitForTimeout(300);
    await sansDebordement(page);
    await lisible(page);
    await preuve(page, info, nom);
  }
  await expect(page.locator('.etape[data-tableau="paie"][data-k="4"]').first()).toContainText('52,80');
  await expect(page.locator('.etape__source')).toHaveCount(0);
  expect(erreurs).toEqual([]);
  await page.goto('/confidentialite/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vos données, simplement.');
  await sansDebordement(page);
});
