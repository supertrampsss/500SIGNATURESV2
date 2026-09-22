import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const PAGES = [
  { slug: 'accueil', path: '/accueil/', vue: 'accueil', heading: 'Comprendre aujourd’hui' },
  { slug: 'france', path: '/bilan/', vue: 'bilan', heading: 'Les comptes' },
  { slug: 'villes', path: '/territoire', vue: 'territoire', heading: 'Comprendre la France' },
  { slug: 'ville-bordeaux', path: '/territoire?niveau=commune&territoire=33063', vue: 'territoire', heading: 'Bordeaux' },
  { slug: 'dossiers', path: '/analyses/', vue: null, heading: 'Dossiers' },
  { slug: 'sources', path: '/sources/', vue: null, heading: 'Sources et méthode' },
];

const NAVIGATION = [
  ['Accueil', '/accueil/'],
  ['France', '/bilan/'],
  ['Villes', '/territoire'],
  ['Dossiers', '/analyses/'],
  ['Mandats', '/mandats/'],
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('theme', 'clair');
    } catch {
      // Le thème clair est aussi demandé par emulateMedia ci-dessous.
    }
  });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
});

async function stabiliser(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(150);
}

async function ecrireJson(testInfo, nom, valeur) {
  const chemin = testInfo.outputPath(nom);
  await mkdir(dirname(chemin), { recursive: true });
  await writeFile(chemin, JSON.stringify(valeur, null, 2), 'utf8');
  await testInfo.attach(nom, { path: chemin, contentType: 'application/json' });
  return chemin;
}

async function capturer(page, testInfo, nom) {
  const chemin = testInfo.outputPath(nom);
  await mkdir(dirname(chemin), { recursive: true });
  await page.screenshot({ path: chemin, fullPage: true, animations: 'disabled' });
  await testInfo.attach(nom, { path: chemin, contentType: 'image/png' });
  return chemin;
}

for (const pageCible of PAGES) {
  test(`${pageCible.slug} : capture et audit visuel`, async ({ page }, testInfo) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(String(error)));

    const reponse = await page.goto(pageCible.path, { waitUntil: 'domcontentloaded' });
    await stabiliser(page);

    const audit = await page.evaluate(() => {
      const visible = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };

      const resume = (selecteur) => {
        const element = Array.from(document.querySelectorAll(selecteur))
          .find((candidate) => candidate instanceof HTMLElement && visible(candidate));
        if (!(element instanceof HTMLElement)) return null;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          selector: selecteur,
          text: element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          display: style.display,
          position: style.position,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          color: style.color,
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
          x: Math.round(rect.x * 100) / 100,
          y: Math.round(rect.y * 100) / 100,
          visible: visible(element),
        };
      };

      const largeur = document.documentElement.clientWidth;
      const debordements = document.documentElement.scrollWidth > largeur + 1
        ? Array.from(document.querySelectorAll('body *'))
            .filter((element) => {
              if (!(element instanceof HTMLElement) || !visible(element)) return false;
              const rect = element.getBoundingClientRect();
              return rect.left < -1 || rect.right > largeur + 1;
            })
            .slice(0, 40)
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                tag: element.tagName.toLowerCase(),
                id: element.id,
                className: element.className,
                left: Math.round(rect.left * 100) / 100,
                right: Math.round(rect.right * 100) / 100,
                width: Math.round(rect.width * 100) / 100,
              };
            })
        : [];

      return {
        url: location.href,
        title: document.title,
        theme: document.documentElement.dataset.theme ?? null,
        vue: document.body.dataset.vue ?? null,
        viewport: { width: innerWidth, height: innerHeight },
        document: {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          clientHeight: document.documentElement.clientHeight,
          scrollHeight: document.documentElement.scrollHeight,
        },
        styles: {
          body: resume('body'),
          header: resume('.entete'),
          brand: resume('.entete__wordmark'),
          h1: resume('h1'),
          primaryPanel: resume('.fr-panel, .accueil__apercu, .territoire-recherche'),
        },
        navigation: Array.from(document.querySelectorAll('.entete__nav a')).map((element) => ({
          text: element.textContent?.trim() ?? '',
          href: element.getAttribute('href'),
          current: element.getAttribute('aria-current'),
          visible: visible(element),
          color: getComputedStyle(element).color,
          backgroundColor: getComputedStyle(element).backgroundColor,
        })),
        debordements,
      };
    });

    audit.http = {
      status: reponse?.status() ?? null,
      ok: reponse?.ok() ?? null,
    };
    audit.consoleErrors = consoleErrors;
    audit.pageErrors = pageErrors;

    await ecrireJson(testInfo, `${pageCible.slug}-audit.json`, audit);
    await capturer(page, testInfo, `${pageCible.slug}-full.png`);

    expect.soft(audit.http.ok, `${pageCible.path} doit répondre en succès HTTP`).toBe(true);
    if (pageCible.vue !== null) {
      expect.soft(audit.vue, `${pageCible.path} doit monter la bonne vue`).toBe(pageCible.vue);
    }
    expect.soft(audit.styles.h1?.text ?? '', 'le titre principal doit être visible').toContain(pageCible.heading);
    expect.soft(
      audit.document.scrollWidth,
      `débordement horizontal : ${JSON.stringify(audit.debordements)}`,
    ).toBeLessThanOrEqual(audit.document.clientWidth + 1);
  });
}

test('accueil : le header et la page ont exactement la même largeur', async ({ page }) => {
  await page.goto('/accueil/');
  await stabiliser(page);
  const mesures=await page.evaluate(()=>{
    const header=document.querySelector('.entete')?.getBoundingClientRect();
    const accueil=document.querySelector('.accueil')?.getBoundingClientRect();
    return header&&accueil?{header:{left:header.left,right:header.right,width:header.width},accueil:{left:accueil.left,right:accueil.right,width:accueil.width}}:null;
  });
  expect(mesures).not.toBeNull();
  expect(Math.abs(mesures.header.width-mesures.accueil.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(mesures.header.left-mesures.accueil.left)).toBeLessThanOrEqual(1);
  await expect(page.locator('.story-trust__icon')).toHaveCount(3);
  await expect(page.locator('.story-hero .story-button')).toHaveCount(1);
  await expect(page.locator('.story-door b')).toHaveCount(0);
});

test('Bordeaux : les données complètes sont visibles et le détail annuel dupliqué a disparu', async ({ page }) => {
  await page.goto('/territoire?niveau=commune&territoire=33063');
  await stabiliser(page);
  await expect(page.getByRole('heading',{name:'Toutes les données du territoire',exact:true})).toBeVisible();
  await expect(page.locator('.territoire-donnees-completes')).toBeVisible();
  await expect(page.getByText('Voir le détail annuel',{exact:true})).toHaveCount(0);
  await expect(page.locator('.territoire-evolution-detail')).toHaveCount(0);
  await expect(page.locator('#detail .analyses__theme').first()).toBeVisible({timeout:10_000});
  await expect(page.locator('.insights--territoire .insights__grille')).toBeVisible();
});

test('navigation : contrat des destinations publiques depuis France', async ({ page }, testInfo) => {
  await page.goto('/bilan/', { waitUntil: 'domcontentloaded' });
  await stabiliser(page);

  const menu = page.locator('.fr-menu');
  if (await menu.isVisible()) await menu.click();

  const navigation = page.getByRole('navigation', { name: 'Navigation principale', exact: true });
  const observee = [];

  for (const [nom, href] of NAVIGATION) {
    const lien = navigation.getByRole('link', { name: nom, exact: true });
    const compte = await lien.count();
    const actuel = compte ? await lien.first().getAttribute('href') : null;
    const estVisible = compte ? await lien.first().isVisible() : false;
    observee.push({ nom, attendu: href, actuel, visible: estVisible });
    expect.soft(compte, `lien ${nom} présent`).toBe(1);
    expect.soft(actuel, `href de ${nom}`).toBe(href);
  }

  const marque = page.getByRole('link', { name: '500 Signatures, accueil', exact: true });
  expect.soft(await marque.getAttribute('href'), 'la marque revient à Accueil').toBe('/accueil/');

  await ecrireJson(testInfo, 'navigation-france.json', { navigation: observee });
  await capturer(page, testInfo, 'navigation-france.png');

  await marque.click();
  await expect.soft(page).toHaveURL(/\/accueil\/$/);
});
