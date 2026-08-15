/**
 * Le pré-rendu : ce qu'il ANNONCE et ce qu'il PEINT.
 *
 * Trois garanties, et chacune protège un défaut qui ne se voit qu'une fois le
 * lien partagé, c'est-à-dire trop tard :
 *
 * 1. **l'image porte du texte** — resvg ne connaît aucune police système, et
 *    une carte sans fonte sort à la bonne taille, non vide, et muette
 *    (scripts/rasteriser.ts). Le contrôle porte donc sur les pixels de la carte
 *    de l'analyse **réellement publiée**, jamais d'une fixture courte : les
 *    titres réels sont longs, et c'est sur eux que la mise en page casse ;
 * 2. **les adresses sont absolues** — une `og:image` relative n'est pas résolue
 *    par tous les robots, et la carte de lien part sans image ;
 * 3. **le build rougit** quand une page annonce une image absente — une page
 *    qui annonce ce qu'elle n'a pas est pire que pas d'annonce.
 *
 * Ce fichier importe `prerendre.ts` comme un module : le pré-rendu ne
 * s'exécute que lancé en programme, garde posée au bas de ce fichier-là.
 */

import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import type { Analyse } from "../src/analyse-rendu.ts";
import { GEOMETRIE, LARGEUR, carteAnalyse } from "../src/carte-og.ts";
import type { Indicateur } from "../src/donnees.ts";
import { echapper } from "../src/texte.ts";
import { lirePolices, peindre, type Peinture } from "./rasteriser.ts";
import {
  ADRESSE_PUBLIEE,
  adresseSite,
  donneesCarteAnalyse,
  donneesCarteSite,
  injecter,
  titreDuGabarit,
  validerImagesAnnoncees,
} from "./prerendre.ts";

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE_SITE = path.resolve(ICI, "..");

/** Les analyses publiées, telles que le build les lit. Le test suit le dépôt :
 *  une analyse ajoutée demain est éprouvée sans qu'on y revienne. */
async function analysesPubliees(): Promise<Analyse[]> {
  const dossier = path.join(RACINE_SITE, "analyses");
  const fichiers = (await readdir(dossier)).filter((f) => f.endsWith(".json"));
  return Promise.all(
    fichiers.map(async (f) => JSON.parse(await readFile(path.join(dossier, f), "utf8")) as Analyse),
  );
}

/**
 * Un catalogue qui déclare en euros les indicateurs qu'une analyse observe.
 *
 * C'est ce que le vrai catalogue dit de ceux que le dépôt publie aujourd'hui —
 * le pré-rendu, lui, le lit sur le réseau, ce qu'un test ne fait pas.
 */
function catalogueEnEuros(analyses: readonly Analyse[]): Indicateur[] {
  return analyses.flatMap((analyse) =>
    analyse.chiffres
      .filter((chiffre) => chiffre.observe)
      .map((chiffre) => ({ id: chiffre.observe!.indicateur, unite: "EUR" }) as Indicateur),
  );
}

/* --------------------------------------------------------------------------
 * 1. L'image porte du texte, et il tient dans le cadre
 * ----------------------------------------------------------------------- */

const FONTES = await lirePolices();

/**
 * Les colonnes encrées, sous le bandeau du haut.
 *
 * Le bandeau est un aplat pleine largeur : compté avec le reste, il déclarerait
 * toutes les colonnes encrées et le contrôle des marges ne dirait plus rien.
 */
function colonnesEncrees(peinture: Peinture): boolean[] {
  const portees = new Array<boolean>(peinture.largeur).fill(false);
  for (let y = 16; y < peinture.hauteur; y += 1) {
    for (let x = 0; x < peinture.largeur; x += 1) {
      if (peinture.pixels[(y * peinture.largeur + x) * 4] < 200) portees[x] = true;
    }
  }
  return portees;
}

/** Les couleurs distinctes : une carte muette n'a que ses aplats, une carte
 *  peinte en a des dizaines de nuances (même mesure que rasteriser.test.ts). */
function couleurs(peinture: Peinture): number {
  const vues = new Set<string>();
  for (let i = 0; i < peinture.pixels.length; i += 4) vues.add(peinture.pixels.slice(i, i + 4).join(","));
  return vues.size;
}

test("1. la carte de chaque analyse publiée porte du texte peint, dans ses marges", async () => {
  const analyses = await analysesPubliees();
  assert.ok(analyses.length > 0, "aucune analyse publiée : le contrôle ne prouverait rien");
  const catalogue = catalogueEnEuros(analyses);

  for (const analyse of analyses) {
    const svg = carteAnalyse(donneesCarteAnalyse(analyse, catalogue, "exemple.test"));
    const peinte = await peindre(svg, FONTES);
    assert.ok(couleurs(peinte) > 30, `${analyse.slug} : la carte est muette, la fonte n'est pas peinte`);

    // Le titre réel de cette analyse fait deux lignes, et le modèle de largeur
    // est calibré sur cette fonte-là : le vérifier sur l'encre, pas sur le
    // modèle qui a servi à la mise en page.
    const portees = colonnesEncrees(peinte);
    const gauche = portees.indexOf(true);
    const droite = portees.lastIndexOf(true);
    assert.ok(gauche >= GEOMETRIE.MARGE, `${analyse.slug} : de l'encre à x=${gauche}, dans la marge gauche`);
    assert.ok(
      droite <= LARGEUR - GEOMETRIE.MARGE,
      `${analyse.slug} : de l'encre à x=${droite}, hors de la marge droite`,
    );
  }
});

test("2. la carte d'une analyse porte sa source et le millésime de son chiffre", async () => {
  const [analyse] = await analysesPubliees();
  const donnees = donneesCarteAnalyse(analyse, catalogueEnEuros([analyse]), "exemple.test");
  // Les deux viennent de l'analyse, pas d'une constante du script : la source
  // qu'elle déclare, et l'exercice du chiffre qu'elle oppose.
  assert.equal(donnees.source.titre, analyse.sources[0].titre);
  assert.equal(donnees.source.millesime, analyse.chiffres[0].observe?.periode);
  assert.equal(donnees.titre, analyse.titre);
  assert.equal(donnees.dit, analyse.chiffres[0].dit);
});

test("3. un chiffre qui n'est pas en euros n'est pas peint comme un montant", async () => {
  const [analyse] = await analysesPubliees();
  // Le même chiffre, déclaré en pourcentage par le catalogue : la carte le
  // formate en millions d'euros, donc la rangée disparaît — c'est le cran qui
  // porte la carte, pas un taux devenu montant.
  const taux = analyse.chiffres
    .filter((c) => c.observe)
    .map((c) => ({ id: c.observe!.indicateur, unite: "percent" }) as Indicateur);
  assert.equal(donneesCarteAnalyse(analyse, taux, "exemple.test").observe, null);
  // Et un catalogue qui ne connaît pas l'indicateur ne vaut pas « euros ».
  assert.equal(donneesCarteAnalyse(analyse, [], "exemple.test").observe, null);
});

/* --------------------------------------------------------------------------
 * 2. Les adresses annoncées
 * ----------------------------------------------------------------------- */

/** Le plus petit gabarit qui porte les cinq points d'injection. */
const GABARIT =
  '<!doctype html><html lang="fr"><head><title>Où va l\'argent public : titre d\'essai</title>' +
  '<meta name="description" content="" />\n  </head><body class="x"><main id="contenu"></main></body></html>';

const PAGE = {
  titre: "Un titre d'essai",
  description: "Une phrase d'essai.",
  canonique: "/analyses/essai/",
  image: "/analyses/essai/carte.png",
  corps: "<p>corps</p>",
};

test("4. les balises de partage portent des adresses absolues", () => {
  const html = injecter(GABARIT, PAGE, "https://exemple.test");
  const balise = (nom: string, attribut: string) =>
    html.match(new RegExp(`<meta ${attribut}="${nom}" content="([^"]*)"`))?.[1];

  assert.equal(balise("og:url", "property"), "https://exemple.test/analyses/essai/");
  assert.equal(balise("og:image", "property"), "https://exemple.test/analyses/essai/carte.png");
  // Les valeurs attendues sont produites par `echapper`, jamais tapées : la
  // page porte « Un titre d&#39;essai », et une chaîne recopiée à la main ne
  // dirait rien de l'échappement.
  assert.equal(balise("og:title", "property"), echapper(PAGE.titre));
  assert.equal(balise("og:description", "property"), echapper(PAGE.description));
  // `twitter:` s'écrit en `name`, `og:` en `property` : c'est ce que les deux
  // spécifications demandent, et un validateur strict ne lit pas l'autre.
  assert.equal(balise("twitter:card", "name"), "summary_large_image");

  for (const nom of ["og:url", "og:image"]) {
    const valeur = balise(nom, "property") ?? "";
    assert.ok(valeur.startsWith("https://"), `${nom} n'est pas absolue : « ${valeur} »`);
  }
});

test("5. l'adresse du site est un paramètre, et elle doit être absolue", () => {
  // Le défaut est l'adresse que le déploiement vérifie déjà à chaque
  // publication (`plateforme.cors`, dernière étape de deploy.yml).
  assert.equal(adresseSite({}), ADRESSE_PUBLIEE);
  assert.match(ADRESSE_PUBLIEE, /^https:\/\/[a-z0-9.-]+$/);
  // La barre finale se retire : sans quoi les adresses porteraient « //analyses ».
  assert.equal(adresseSite({ SITE_URL: "https://exemple.test/" }), "https://exemple.test");
  assert.equal(adresseSite({ SITE_URL: "http://localhost:4173" }), "http://localhost:4173");
  // Ce qu'un robot ne résoudrait pas est refusé au lieu d'être recollé.
  for (const brute of ["/", "exemple.test", "//exemple.test", "https://", "n'importe quoi"]) {
    assert.throws(() => adresseSite({ SITE_URL: brute }), /origine absolue/, brute);
  }
});

test("6. le titre de la carte du site est celui du gabarit, et son millésime celui du build", () => {
  const titre = titreDuGabarit(GABARIT);
  assert.equal(titre, "Où va l'argent public : titre d'essai");
  const donnees = donneesCarteSite(titre, "2026-08-11T0807", "exemple.test");
  assert.equal(donnees.titre, titre);
  assert.equal(donnees.source.millesime, "2026-08-11T0807");
  // Aucun montant n'est peint sur cette carte : elle n'annonce donc pas des
  // millions d'euros.
  assert.ok(!donnees.unite.includes("millions d'euros"));
  assert.throws(() => titreDuGabarit("<html><head></head></html>"), /pas de <title>/);
});

/* --------------------------------------------------------------------------
 * 3. Le build rougit sur une image annoncée qui manque
 * ----------------------------------------------------------------------- */

test("7. une page qui annonce une image absente fait échouer le build", async () => {
  const racine = await mkdtemp(path.join(tmpdir(), "prerendre-"));
  const html = injecter(GABARIT, PAGE, "https://exemple.test");
  const page = { chemin: "analyses/essai/index.html", html };

  // L'image n'existe pas encore : le contrôle refuse de laisser publier.
  await assert.rejects(
    () => validerImagesAnnoncees(racine, [page], "https://exemple.test"),
    /n'a pas écrite/,
  );

  // Écrite, la même page passe — le contrôle regarde le fichier, pas l'intention.
  await mkdir(path.join(racine, "analyses", "essai"), { recursive: true });
  await writeFile(path.join(racine, "analyses", "essai", "carte.png"), "png d'essai");
  await validerImagesAnnoncees(racine, [page], "https://exemple.test");

  // Une adresse relative est refusée même quand le fichier existe : ce n'est
  // pas le fichier qui manquerait, c'est le robot qui ne le résoudrait pas.
  const relative = {
    chemin: page.chemin,
    html: html.replace(
      'content="https://exemple.test/analyses/essai/carte.png"',
      'content="/analyses/essai/carte.png"',
    ),
  };
  await assert.rejects(
    () => validerImagesAnnoncees(racine, [relative], "https://exemple.test"),
    /n'est pas absolue/,
  );

  // Et une page sans balise du tout ne passe pas pour une page sans problème.
  const sans = { chemin: page.chemin, html: html.replace(/<meta property="og:image"[^>]*>/, "") };
  await assert.rejects(
    () => validerImagesAnnoncees(racine, [sans], "https://exemple.test"),
    /ne porte pas de balise og:image/,
  );
});
