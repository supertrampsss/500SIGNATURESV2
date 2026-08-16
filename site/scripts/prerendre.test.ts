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
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { rendu, type Analyse } from "../src/analyse-rendu.ts";
import { IMAGE_SCENARIO } from "../src/apercu-scenario.ts";
import { GEOMETRIE, LARGEUR, carteAnalyse, carteSection } from "../src/carte-og.ts";
import type { Indicateur } from "../src/donnees.ts";
import { permalien } from "../src/partage.ts";
import { echapper } from "../src/texte.ts";
import { lirePolices, peindre, rasteriser, type Peinture } from "./rasteriser.ts";
import {
  ADRESSE_PUBLIEE,
  HOTE,
  adresseSite,
  donneesCarteAnalyse,
  ecrireCartes,
  donneesCarteSection,
  marqueDuGabarit,
  sections,
  validerImageDuScenario,
  injecter,
  descriptionDuGabarit,
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

/** Le plus petit gabarit qui porte les cinq points d'injection. */
const GABARIT =
  '<!doctype html><html lang="fr"><head><title>Où va l\'argent public : titre d\'essai</title>' +
  '<meta\n      name="description"\n      content="Une description d\'essai."\n    />\n  </head><body class="x">' +
  // La marque, telle que l'en-tête du vrai gabarit la porte : c'est le titre
  // des cartes de section qui ne décrivent pas une page pré-rendue.
  '<header class="entete"><div class="entete__marque"><h1>Où va l\'argent public</h1>' +
  '<p class="sous-titre">Sous-titre d\'essai</p></div></header>' +
  '<main id="contenu"></main></body></html>';

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

test("1 bis. le build écrit ces cartes-là, peintes avec la fonte du dépôt", async () => {
  // Le test précédent peint son propre SVG : il ne dit rien de ce que le build
  // ÉCRIT. Sans ce contrôle-ci, un `rasteriser(svg, [])` dans le pré-rendu
  // publiait des cartes muettes sans faire rougir un seul test — sabotage
  // essayé, sept tests verts.
  const racine = await mkdtemp(path.join(tmpdir(), "cartes-"));
  const analyses = await analysesPubliees();
  const catalogue = catalogueEnEuros(analyses);
  await ecrireCartes(racine, analyses, catalogue, "2026-08-11T0807", GABARIT);

  const attendues: [string, string][] = [
    ...analyses.map(
      (analyse) =>
        [
          path.join("analyses", analyse.slug, "carte.png"),
          carteAnalyse(donneesCarteAnalyse(analyse, catalogue, HOTE)),
        ] as [string, string],
    ),
    ...sections(GABARIT).map(
      (section) =>
        [
          path.join(section.chemin, "carte.png"),
          carteSection(
            donneesCarteSection(section.nature, section.titre, section.phrase, "2026-08-11T0807", HOTE),
          ),
        ] as [string, string],
    ),
  ];

  for (const [chemin, svg] of attendues) {
    const ecrite = await readFile(path.join(racine, chemin));
    const attendue = Buffer.from(await rasteriser(svg, FONTES));
    // Comparé en bloc, jamais octet à octet : `deepEqual` sur soixante mille
    // octets compose un diff que personne ne lit et que le rapporteur met une
    // minute à imprimer.
    assert.ok(
      ecrite.equals(attendue),
      `${chemin} n'est pas la carte de cet objet, peinte avec la fonte du dépôt ` +
        `(${ecrite.length} octets écrits, ${attendue.length} attendus)`,
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
  // Et ce que ce chiffre-là désigne, dans les mots de l'analyse : c'est la
  // seule phrase dont l'image dispose pour dire LEQUEL des chiffres publiés
  // elle montre. La citation de la même donnée la portait déjà ; l'image, non.
  assert.equal(donnees.lecture, analyse.chiffres[0].lecture);
  assert.ok(donnees.lecture.trim(), "l'analyse publiée ne déclare pas de lecture");
  assert.ok(carteAnalyse(donnees).includes(echapper(donnees.lecture)));
});

test("2 bis. sans source déclarée, la carte ne se rabat pas sur celle de la déclaration", async () => {
  const [analyse] = await analysesPubliees();
  const catalogue = catalogueEnEuros([analyse]);
  // `controle_analyses` rejette déjà `sources: []` avant le build : ce cas
  // n'arrive pas, et c'est précisément pourquoi le repli qui vivait ici ne
  // rougissait jamais. Il peignait la source de la DÉCLARATION mise en cause
  // sous une rangée « Chiffre des comptes », sur une image qui circule seule.
  const sansSource = { ...analyse, sources: [] };
  assert.throws(
    () => donneesCarteAnalyse(sansSource, catalogue, "exemple.test"),
    /ne déclare aucune source/,
  );
  // Et le titre de la déclaration ne se retrouve nulle part sur la carte quand
  // l'analyse en déclare une autre : ce serait la même faute, en silence.
  const contestee = {
    ...analyse,
    affirmation: {
      ...analyse.affirmation,
      source: { titre: "Déclaration d'essai", url: "", consulte_le: "" },
    },
  };
  const donnees = donneesCarteAnalyse(contestee, catalogue, "exemple.test");
  assert.equal(donnees.source.titre, analyse.sources[0].titre);
  assert.ok(!carteAnalyse(donnees).includes("Déclaration d'essai"));
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

  // Le canonique dit la même adresse qu'`og:url`, et il la dit absolue : c'est
  // ce qu'un canonique est — l'adresse unique d'un contenu, celle qui reste
  // juste quand la page est recopiée ailleurs. Relatif à côté de balises
  // absolues, il déclarait la même page sous deux adresses.
  const canonique = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  assert.equal(canonique, balise("og:url", "property"));
  assert.equal(canonique, "https://exemple.test/analyses/essai/");
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

test("6. les mots d'une carte de section sont ceux du gabarit, sa date celle du build", () => {
  const titre = titreDuGabarit(GABARIT);
  assert.equal(titre, "Où va l'argent public : titre d'essai");
  assert.equal(marqueDuGabarit(GABARIT), "Où va l'argent public");
  const donnees = donneesCarteSection("Le site", titre, descriptionDuGabarit(GABARIT), "2026-08-11T0807", "exemple.test");
  assert.equal(donnees.titre, titre);
  assert.equal(donnees.source.millesime, "2026-08-11T0807");
  // Et cette date-là se dit « version » : cette carte ne peint aucun chiffre,
  // donc aucun exercice. Le mot « millésime » y désignerait une publication
  // là où la carte d'à côté le donne à l'exercice 2025 d'une ligne de comptes.
  assert.equal(donnees.source.datation, "version");
  assert.throws(() => titreDuGabarit("<html><head></head></html>"), /pas de <title>/);
  assert.throws(() => marqueDuGabarit("<html><body></body></html>"), /pas de marque/);
  // La description du gabarit sert la carte de lien du site : elle est écrite
  // sur plusieurs lignes dans `index.html`, et un motif qui ne traverse pas les
  // retours la lirait vide.
  assert.equal(descriptionDuGabarit(GABARIT), "Une description d'essai.");
  assert.throws(() => descriptionDuGabarit("<html><head></head></html>"), /pas de description/);
});

test("6 bis. chaque section a son image, et aucune ne dément le titre posé à côté", async () => {
  // Le défaut, vérifié en production : un scénario partagé arrivait avec
  // `og:title` = « « Mon budget » — un scénario du simulateur » et une image
  // dont le chapeau peint était « Repère » et le titre « Où va l'argent
  // public : carte des finances locales ». Les plateformes montrent l'image en
  // grand, le titre dessous — le lecteur voyait une carte des finances locales
  // annoncée comme un scénario. Même effet sur `/analyses/`.
  const trois = sections(GABARIT);
  assert.deepEqual(
    trois.map((s) => [s.chemin, s.nature]),
    [
      ["", "Le site"],
      ["analyses", "Analyses"],
      ["simulateur", "Simulateur"],
    ],
  );
  // La section du simulateur est peinte À L'ENDROIT où la fonction d'edge
  // annonce l'image : deux chemins se seraient désaccordés en silence.
  assert.equal(path.join("/", trois[2].chemin, "carte.png"), IMAGE_SCENARIO);

  // Le chapeau peint est celui de la section, jamais « Repère ». Il est lu sur
  // le SVG rendu, pas sur les données : c'est ce que le lecteur voit.
  for (const section of trois) {
    const svg = carteSection(
      donneesCarteSection(section.nature, section.titre, section.phrase, "2026-08-11T0807", HOTE),
    );
    const lu = [...svg.matchAll(/>([^<]*)<\/text>/g)].map((m) => m[1]);
    assert.ok(lu.includes(echapper(section.nature)), `${section.nature} : chapeau absent`);
    assert.ok(!lu.includes("Repère"), `${section.nature} : la nature du repère est encore empruntée`);
    // Et aucune ne prétend montrer des montants qu'elle n'a pas.
    assert.ok(!lu.some((t) => t.includes("millions d'euros")), section.nature);
  }
  // Le titre du simulateur est la marque, pas le titre du gabarit : celui-ci
  // nomme la vue d'accueil, et l'écrire sur l'image d'un scénario partagé
  // rouvrirait le démenti.
  assert.equal(trois[2].titre, marqueDuGabarit(GABARIT));
  assert.notEqual(trois[2].titre, titreDuGabarit(GABARIT));

  // Écrites, toutes les trois : le contrôle des pages ne verrait pas celle du
  // simulateur, qu'aucune page pré-rendue ne déclare.
  const racine = await mkdtemp(path.join(tmpdir(), "sections-"));
  await assert.rejects(() => validerImageDuScenario(racine), /n'a pas écrite/);
  await ecrireCartes(racine, await analysesPubliees(), [], "2026-08-11T0807", GABARIT);
  await validerImageDuScenario(racine);
});

test("6 ter. l'index des analyses annonce sa propre image, pas celle du site", () => {
  // La page d'index portait `/carte.png` : le lecteur voyait l'accueil sous un
  // titre qui annonce les analyses. Les mots de la page et ceux de son image
  // viennent maintenant de la même source (`PAGE_ANALYSES`).
  const source = readFileSync(new URL("./prerendre.ts", import.meta.url), "utf8");
  const index = source.slice(source.indexOf("const pageIndex"), source.indexOf("const htmlIndex"));
  assert.ok(index.length > 100, "pageIndex introuvable dans scripts/prerendre.ts");
  assert.match(index, /image: "\/analyses\/carte\.png"/);
  assert.match(index, /titre: PAGE_ANALYSES\.titre/);
  assert.match(index, /description: PAGE_ANALYSES\.description/);
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

/**
 * Le source du pré-rendu, ses commentaires retirés.
 *
 * Les commentaires de ligne ne sont retirés que **pleine ligne** : les
 * gabarits d'adresse du fichier portent des `//` qu'on ne veut pas confondre
 * avec du code mis en sommeil. Un appel commenté, lui, l'est toujours en tête
 * de ligne — c'est comme cela qu'on le met en sommeil.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

test("7 bis. le build appelle ce contrôle, et l'appelle après la dernière page", () => {
  // `validerImagesAnnoncees` est éprouvée par le test 7 ; son BRANCHEMENT ne
  // l'était pas. L'appel commenté, la suite entière restait verte — et c'est
  // la seule garde qui empêche de publier une page annonçant une image
  // absente, un défaut qui ne se voit qu'une fois le lien partagé.
  //
  // Le contrôle se lit sur le source plutôt que sur une exécution : `main()`
  // lit l'entrepôt publié, et une garde de build ne vaut pas qu'on branche le
  // réseau dans la suite de tests. Même parti que `scripts/deploiement.test.ts`
  // sur le workflow, et que le test 8 bis ci-dessous.
  const source = sansCommentaires(readFileSync(new URL("./prerendre.ts", import.meta.url), "utf8"));
  const corps = source.slice(source.indexOf("async function main"));
  assert.ok(corps.length > 500, "main() introuvable dans scripts/prerendre.ts");
  assert.match(
    corps,
    /await validerImagesAnnoncees\(DIST, ecrites, SITE\);/,
    "main() n'appelle plus validerImagesAnnoncees : une page annonçant une image absente partirait sans bruit.",
  );
  // Après la dernière page rangée, jamais avant : appelé au milieu, le
  // contrôle laisserait passer tout ce que le build écrit ensuite — à
  // commencer par le gabarit du site lui-même, qui est poussé en dernier.
  assert.ok(
    corps.lastIndexOf("ecrites.push(") < corps.indexOf("await validerImagesAnnoncees("),
    "le contrôle des images passe avant la dernière page écrite : ce qui suit n'est pas contrôlé.",
  );
});

test("7 ter. le build appelle aussi le contrôle de l'image du scénario", () => {
  // Le même défaut que le test 7 bis vient de fermer, sur la garde sœur —
  // éprouvée, elle aussi, mais dont l'appel ne tenait à rien : commenté, la
  // suite entière restait verte.
  //
  // Elle protège l'`og:image` de TOUT scénario partagé, et c'est le seul objet
  // du lot qui n'a pas de page : `validerImagesAnnoncees` parcourt les pages
  // écrites, elle ne voit donc jamais l'image que la fonction d'edge annonce.
  // Sans cet appel, un `og:image` mort partirait sur chaque lien de scénario,
  // et ne se verrait qu'une fois le lien partagé.
  const source = sansCommentaires(readFileSync(new URL("./prerendre.ts", import.meta.url), "utf8"));
  const corps = source.slice(source.indexOf("async function main"));
  assert.ok(corps.length > 500, "main() introuvable dans scripts/prerendre.ts");
  assert.match(
    corps,
    /await validerImageDuScenario\(DIST\);/,
    "main() n'appelle plus validerImageDuScenario : un og:image mort partirait sur chaque scénario partagé.",
  );
  // Après l'écriture des cartes de section, dont elle vérifie l'une : appelée
  // avant, elle contrôlerait un fichier que le build n'a pas encore posé.
  assert.ok(
    corps.indexOf("ecrireCartes(") < corps.indexOf("await validerImageDuScenario("),
    "le contrôle de l'image du scénario passe avant que les cartes soient écrites.",
  );
});

/* --------------------------------------------------------------------------
 * 8. Une citation ramène à la page qui la porte
 * ----------------------------------------------------------------------- */

test("8. le permalien d'une citation est celui que la page annonce en og:url", async () => {
  const site = "https://exemple.test";
  const [analyse] = await analysesPubliees();
  assert.ok(analyse);
  const canonique = `/analyses/${analyse.slug}/`;
  // Le pré-rendu compose cette adresse une fois, avec `permalien()` (partage.ts)
  // plutôt qu'en recollant deux chaînes, et la donne au rendu.
  const adresse = permalien(site, canonique, {});
  const corps = rendu(analyse, catalogueEnEuros([analyse]), "v-essai", adresse);
  const html = injecter(GABARIT, { ...PAGE, canonique, corps }, site);

  const ogUrl = html.match(/<meta property="og:url" content="([^"]*)"/)?.[1];
  assert.equal(adresse, ogUrl);
  // Et c'est bien cette adresse-là que les boutons portent : une citation qui
  // ramènerait ailleurs que sur la page d'où elle vient n'est pas vérifiable.
  const charges = [...html.matchAll(/data-citer="([^"]*)"/g)];
  assert.ok(charges.length > 0, "aucune commande « citer » sur une analyse sourcée");
  for (const [, brute] of charges) {
    const citation = JSON.parse(brute!.replace(/&quot;/g, '"').replace(/&#39;/g, "'")) as {
      permalien: string;
    };
    assert.equal(citation.permalien, ogUrl);
  }
});

test("8 bis. le pré-rendu passe ce permalien au rendu, il ne le recolle pas", () => {
  // Le défaut serait invisible sur cette analyse-ci et fatal sur la première
  // qui porterait un paramètre : `permalien()` existe pour que les caractères
  // d'une adresse ne coupent jamais celle-ci en deux.
  const source = readFileSync(new URL("./prerendre.ts", import.meta.url), "utf8");
  assert.match(source, /corps: rendu\(analyse, catalogue, version, permalien\(SITE, canonique, \{\}\)\)/);
});
