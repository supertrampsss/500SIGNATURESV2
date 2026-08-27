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
import { fileURLToPath } from "node:url";

import { CHIFFRES_EXEMPLE, MESSAGE_PRINCIPAL } from "../src/accueil.ts";
import { rendu, renduIndex, type Analyse } from "../src/analyse-rendu.ts";
import { IMAGE_SCENARIO } from "../src/apercu-scenario.ts";
import { GEOMETRIE, LARGEUR, carteAnalyse, carteSection } from "../src/carte-og.ts";
import type {
  BudgetEtat,
  DepensesFiscales,
  Indicateur,
  Territoire,
} from "../src/donnees.ts";
import { formater } from "../src/echelle.ts";
import { renduNavigation } from "../src/navigation.ts";
import { permalien } from "../src/partage.ts";
import { indexerSources } from "../src/registre-sources.ts";
import { CHEMINS } from "../src/routes.ts";
import { echapper } from "../src/texte.ts";
import { lirePolices, peindre, rasteriser, type Peinture } from "./rasteriser.ts";
import {
  ADRESSE_PUBLIEE,
  ALEA_PRERENDU,
  HOTE,
  adresseSite,
  adressesPubliees,
  corpsAccueil,
  donneesCarteAnalyse,
  ecrireCartes,
  ecrireIndexation,
  donneesCarteSection,
  injecterAccueil,
  injecterAnnonce,
  injecterMethode,
  injecterRegistre,
  injecterReperes,
  marqueDuGabarit,
  planDuSite,
  robotsDuSite,
  sections,
  validerImageDuScenario,
  validerIndexation,
  injecter,
  descriptionDuGabarit,
  titreDuGabarit,
  validerImagesAnnoncees,
} from "./prerendre.ts";

const ICI = path.dirname(fileURLToPath(import.meta.url));
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
});

test("2 ter. la carte reçoit tous les chiffres publiés que le verdict oppose", async () => {
  const [analyse] = await analysesPubliees();
  const publies = analyse.chiffres.filter((chiffre) => chiffre.observe);
  assert.ok(
    publies.length > 1,
    "l'analyse publiée n'oppose qu'un chiffre : le contrôle ne prouverait rien",
  );
  const donnees = donneesCarteAnalyse(analyse, catalogueEnEuros([analyse]), "exemple.test");
  // Tous, dans l'ordre déclaré, et aucun de plus : ne peindre que le premier
  // faisait partir l'image de « deux chiffres publiés, deux sens » avec le seul
  // des deux qui CONCORDE avec le chiffre annoncé, sous un verdict qui dit
  // l'inverse.
  assert.deepEqual(
    [donnees.observe, ...(donnees.opposes ?? []).map((oppose) => oppose.valeur)],
    publies.map((chiffre) => chiffre.observe!.valeur),
  );
  assert.deepEqual(
    (donnees.opposes ?? []).map((oppose) => oppose.lecture),
    publies.slice(1).map((chiffre) => chiffre.lecture),
  );
  // Et ils sont peints. Les montants attendus sont produits en APPELANT
  // `formater` : le séparateur est une espace fine insécable, qu'on ne peut pas
  // taper de mémoire sans se tromper.
  const svg = carteAnalyse(donnees);
  for (const chiffre of publies) {
    const montant = formater(chiffre.observe!.valeur, "EUR", false);
    assert.ok(svg.includes(echapper(montant)), `${montant} n'est pas peint sur la carte`);
    // Et la phrase qui le nomme, ENTIÈRE. « Les crédits votés : l'autorisation
    // donnée par le Parlement en loi de… » perdait « de finances », c'est-à-dire
    // ce qui la distingue de « les crédits consommés » peints juste dessous.
    assert.ok(
      svg.includes(echapper(chiffre.lecture)),
      `la phrase qui nomme ce chiffre est coupée : ${chiffre.lecture}`,
    );
  }
});

test("2 quater. un chiffre d'un autre exercice n'est pas peint sous ce millésime", async () => {
  const [analyse] = await analysesPubliees();
  // La carte ne porte qu'un millésime — celui du premier chiffre. Un montant
  // d'un autre exercice peint dessous serait daté faux, sur une image qui
  // circule seule et que rien ne vient corriger.
  //
  // L'autre exercice se DÉDUIT du premier plutôt que d'être écrit « 2024 » :
  // écrit en dur, il ne différait du premier que tant que l'analyse qui ouvre
  // le dossier portait 2025, et le contrôle passait au vert sans rien vérifier
  // le jour où une analyse en 2024 est arrivée en tête.
  const premier = analyse.chiffres[0]!.observe!.periode;
  const autre = String(Number(premier) - 1);
  assert.notEqual(autre, premier);
  const autreExercice = {
    ...analyse,
    chiffres: analyse.chiffres.map((chiffre, i) =>
      i === 0 || !chiffre.observe
        ? chiffre
        : { ...chiffre, observe: { ...chiffre.observe, periode: autre } },
    ),
  };
  const donnees = donneesCarteAnalyse(autreExercice, catalogueEnEuros([analyse]), "exemple.test");
  assert.equal(donnees.source.millesime, analyse.chiffres[0].observe?.periode);
  assert.deepEqual(donnees.opposes, []);
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
  const toutes = sections(GABARIT);
  assert.deepEqual(
    toutes.map((s) => [s.chemin, s.nature]),
    [
      ["", "Le site"],
      // `/analyses/` n'est pas l'onglet ANALYSES, qui a quitté la barre de
      // navigation le 17 août 2026 : c'est le sommaire des articles
      // éditoriaux, toujours servi et toujours au plan du site. Il garde donc
      // sa carte — sans elle, son document annonçait un `og:image` que le
      // build n'écrivait plus.
      ["analyses", "Analyses"],
      ["simulateur", "Simulateur"],
      // BILAN a rejoint la liste en recevant son propre document : servie par
      // le gabarit, elle empruntait la carte du site — chapeau « Le site »,
      // phrase du message principal — sous un titre qui annonce la dette, les
      // 100 €, les niches et le classement des territoires.
      ["bilan", "Bilan"],
    ],
  );
  // **Les sections se retrouvent par leur nom, jamais par leur rang.** Une
  // section retirée décalait les rangs sans rien casser : les assertions
  // ci-dessous ont porté un temps sur BILAN sous un commentaire qui disait
  // « le simulateur », et les deux passaient parce que les deux portent la
  // marque en titre. Un test qui se trompe de sujet en silence ne tient rien.
  const parNature = (nature: string) => {
    const trouvee = toutes.find((s) => s.nature === nature);
    assert.ok(trouvee, `section ${nature} absente`);
    return trouvee;
  };
  // La section du simulateur est peinte À L'ENDROIT où la fonction d'edge
  // annonce l'image : deux chemins se seraient désaccordés en silence.
  assert.equal(path.posix.join("/", parNature("Simulateur").chemin, "carte.png"), IMAGE_SCENARIO);
  // Et celle de BILAN à l'endroit où son document annonce la sienne : le
  // chemin vient de `routes.ts`, jamais recopié.
  assert.equal(path.posix.join("/", parNature("Bilan").chemin), CHEMINS.bilan);

  // Le chapeau peint est celui de la section, jamais « Repère ». Il est lu sur
  // le SVG rendu, pas sur les données : c'est ce que le lecteur voit.
  for (const section of toutes) {
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
  assert.equal(parNature("Simulateur").titre, marqueDuGabarit(GABARIT));
  assert.notEqual(parNature("Simulateur").titre, titreDuGabarit(GABARIT));

  // Écrites, toutes : le contrôle des pages ne verrait pas celle du
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

test("7 ter. l'index et chaque dossier publié ont un h1 propre", async () => {
  const analyses = await analysesPubliees();
  assert.ok(analyses.length > 0, "aucun dossier publié");
  const index = renduIndex(analyses, catalogueEnEuros(analyses));
  assert.match(index, /<h1 id="analyses-titre">Dossiers de vérification<\/h1>/);
  for (const analyse of analyses) {
    const html = rendu(analyse, catalogueEnEuros([analyse]));
    assert.ok(html.includes(`<h1 class="analyse-rendu__titre">${echapper(analyse.titre)}</h1>`));
    assert.doesNotMatch(html, /<h2 class="analyse-rendu__titre">/);
  }
});

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
  assert.match(
    source,
    /corps: rendu\(analyse, catalogue, version, permalien\(SITE, canonique, \{\}\), indexSources\)/,
  );
});

test("8 ter. le dossier de preuve est servi avec sa canonique et ses métadonnées sociales", async () => {
  const [analyse] = await analysesPubliees();
  assert.ok(analyse, "aucune analyse publiée");
  const canonique = `/analyses/${analyse.slug}/`;
  const html = injecter(
    GABARIT,
    {
      ...PAGE,
      titre: analyse.titre,
      description: analyse.verdict.phrase,
      canonique,
      image: `/analyses/${analyse.slug}/carte.png`,
      corps: rendu(analyse, catalogueEnEuros([analyse]), "v-essai", permalien(SITE_ESSAI, canonique, {})),
    },
    SITE_ESSAI,
  );
  const dist = await mkdtemp(path.join(tmpdir(), "dossier-preuve-"));
  const fichier = path.join(dist, "analyses", analyse.slug, "index.html");
  await mkdir(path.dirname(fichier), { recursive: true });
  await writeFile(fichier, html);
  const servi = await readFile(fichier, "utf8");

  assert.match(servi, /dossier-preuve__verdict/);
  assert.match(servi, new RegExp(`<link rel="canonical" href="${SITE_ESSAI}${canonique}"`));
  assert.match(servi, new RegExp(`<meta property="og:url" content="${SITE_ESSAI}${canonique}"`));
  assert.match(servi, new RegExp(`<meta property="og:image" content="${SITE_ESSAI}${canonique}carte\\.png"`));
});

test("8 quater. Sources et méthode est pré-rendue avec sa canonique et son image propres", () => {
  const html = injecterRegistre(
    GABARIT,
    [{
      id: "jeu-essai",
      titre: "Jeu d'essai",
      producteur: "Producteur d'essai",
      licence: "Licence d'essai",
      url: "https://exemple.test/jeu",
      extraction: "2026-08-11T08:07:00Z",
    }],
    [{
      id: "source-essai",
      nom: "Publication d'essai",
      statut: "publie",
      institution: "Institution d'essai",
      url: "https://exemple.test/publication",
      pages: ["/bilan"],
    }],
    SITE_ESSAI,
  );
  assert.match(html, /data-page="editorial"/);
  assert.equal([...html.matchAll(/<main\b/g)].length, 1, "la page servie ne contient qu'un landmark main");
  assert.match(html, /<h1 id="sources-methode-titre">Sources et méthode<\/h1>/);
  assert.ok(html.indexOf('id="methode"') < html.indexOf('id="registre-sources-titre"'));
  assert.match(html, /registre-sources__fiche/);
  assert.match(html, /id="source-essai"/);
  assert.match(html, new RegExp(`<link rel="canonical" href="${SITE_ESSAI}/sources/"`));
  assert.match(html, new RegExp(`<meta property="og:image" content="${SITE_ESSAI}/sources/carte\\.png"`));
});

test("8 quinquies. les trois documents éditoriaux déclarent l'état qui laisse Simuler navigable", async () => {
  const [analyse] = await analysesPubliees();
  assert.ok(analyse, "aucun dossier publié");
  const shell = GABARIT_REEL;
  const documents = [
    ["/analyses/", injecter(shell, { ...PAGE, canonique: "/analyses/" }, SITE_ESSAI)],
    [
      `/analyses/${analyse.slug}/`,
      injecter(shell, { ...PAGE, canonique: `/analyses/${analyse.slug}/` }, SITE_ESSAI),
    ],
    ["/sources/", injecterRegistre(shell, [], [], SITE_ESSAI)],
  ] as const;

  for (const [chemin, html] of documents) {
    assert.match(html, /<body[^>]*data-page="editorial"/);
    assert.match(html, /id="navigation-principale"/);
    // Le nav est monté par le paquet après lecture de data-page : la sortie
    // reflète le lien clavier/souris réellement attendu pour chaque document.
    const navigation = renduNavigation(chemin, true);
    assert.match(navigation, /<a href="\/simulateur" data-vue="simuler">Simuler<\/a>/);
    assert.doesNotMatch(navigation, /href="\/simulateur"[^>]*aria-disabled/);
  }
});

/* --------------------------------------------------------------------------
 * 9. robots.txt et le plan du site
 * ----------------------------------------------------------------------- */

const SITE_ESSAI = "https://exemple.test";

/** Les chemins de vues du site. C'est `routes.ts` qui les déclare — le test lit
 *  la même table que le pré-rendu, jamais une copie. */
const CHEMINS_DE_VUE = new Set(Object.values(CHEMINS));

/**
 * Ceux d'entre eux que le repli SPA sert : le build ne leur écrit aucun
 * fichier, Cloudflare Pages y sert le gabarit.
 *
 * `/bilan` n'en est plus — elle a son propre document depuis qu'elle est
 * pré-rendue — et `/bilan` non plus, pour la même raison. Le `dist` d'essai
 * doit avoir la même forme que le vrai, sans quoi le contrôle des canoniques
 * n'y verrait jamais le cas d'une vue pré-rendue : il jugerait un gabarit à six
 * adresses là où la production en a quatre.
 */
const PAGES_PROPRES = new Set([CHEMINS.bilan, CHEMINS.bilan]);
const SERVIS_PAR_LE_REPLI = new Set([...CHEMINS_DE_VUE].filter((c) => !PAGES_PROPRES.has(c)));

/**
 * Un `dist` minimal : le gabarit, et une page par adresse qui en a une.
 *
 * Les pages sont composées par le build — `injecter` pour une page éditoriale,
 * `injecterAnnonce` pour une vue pré-rendue, exactement comme `main()` — et leur
 * canonique est donc celle que le build pose, pas une balise écrite ici.
 */
async function distEssai(adresses: readonly string[]): Promise<string> {
  const racine = await mkdtemp(path.join(tmpdir(), "indexation-"));
  await writeFile(path.join(racine, "index.html"), GABARIT);
  for (const adresse of adresses) {
    if (adresse === "/" || SERVIS_PAR_LE_REPLI.has(adresse)) continue;
    await mkdir(path.join(racine, adresse.replace(/^\//, "")), { recursive: true });
    const page = { ...PAGE, canonique: adresse };
    await writeFile(
      path.join(racine, adresse.replace(/^\//, ""), "index.html"),
      CHEMINS_DE_VUE.has(adresse)
        ? injecterAnnonce(GABARIT, page, SITE_ESSAI)
        : injecter(GABARIT, page, SITE_ESSAI),
    );
  }
  await ecrireIndexation(racine, SITE_ESSAI, adresses);
  return racine;
}

test("9. le plan du site liste la racine, les chemins de vues et les analyses publiées", async () => {
  const analyses = await analysesPubliees();
  const adresses = adressesPubliees(analyses);

  // La liste se déduit du dépôt : `CHEMINS` (routes.ts) et les analyses lues
  // sur le disque. Une vue ou une analyse ajoutée demain entre au plan sans
  // qu'on touche à ce test.
  assert.deepEqual(adresses, [
    "/",
    ...Object.values(CHEMINS),
    "/analyses/",
    "/sources/",
    ...analyses.map((analyse) => `/analyses/${analyse.slug}/`),
  ]);
  // Et rien d'autre : une adresse morte dans un plan de site est un signal de
  // mauvaise qualité envoyé aux moteurs.
  assert.equal(new Set(adresses).size, adresses.length, "le plan annonce deux fois la même adresse");
});

test("10. robots.txt et le plan lisent l'adresse du site, ils ne la portent pas en dur", () => {
  const adresses = ["/", "/bilan", "/analyses/"];
  const robots = robotsDuSite(SITE_ESSAI);
  const plan = planDuSite(SITE_ESSAI, adresses);

  assert.match(robots, /^Sitemap: https:\/\/exemple\.test\/sitemap\.xml$/m);
  // Le défaut à empêcher : une constante restée dans le fichier, qui publierait
  // l'adresse d'aujourd'hui sur le site de demain.
  assert.ok(!robots.includes(ADRESSE_PUBLIEE), "robots.txt porte une adresse en dur");
  assert.ok(!plan.includes(ADRESSE_PUBLIEE), "le plan du site porte une adresse en dur");

  const locs = [...plan.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, adresses.map((adresse) => `${SITE_ESSAI}${adresse}`));
  // Rien n'y est daté : la version de publication date les données, pas le
  // document, et une date plausible mais fausse est un chiffre inventé.
  assert.ok(!plan.includes("<lastmod>"), "le plan date des pages que rien ne date");

  // `robots.txt` n'interdit rien : c'est ce qui permet aux robots de LIRE le
  // `noindex` d'`index.html`, la balise qui tient le site hors de l'index tant
  // que le projet n'est pas annoncé (D1).
  assert.match(robots, /^Allow: \/$/m);
  assert.ok(!/^Disallow: \/$/m.test(robots), "robots.txt interdit la lecture du noindex");
});

test("11. le build rougit dès qu'une adresse du plan ne répond pas", async () => {
  const analyses = await analysesPubliees();
  const adresses = adressesPubliees(analyses);
  // Le contrôle doit vraiment emprunter la branche du repli : sans chemin de
  // vue au plan, il ne dirait rien du 404.html ni de la canonique du gabarit.
  assert.ok(adresses.some((a) => CHEMINS_DE_VUE.has(a)), "aucun chemin de vue au plan");

  // Tel que le build l'écrit, le plan passe.
  await validerIndexation(await distEssai(adresses), SITE_ESSAI);

  // Une page annoncée que le build n'écrit pas — le défaut que ce contrôle
  // existe pour attraper. Le plan l'annonce, `distEssai` ne l'écrit pas :
  // c'est `ecrireIndexation` qui compose le plan, pas le test.
  const manquante = await distEssai(adresses);
  await writeFile(
    path.join(manquante, "sitemap.xml"),
    planDuSite(SITE_ESSAI, [...adresses, "/analyses/inexistante/"]),
  );
  await assert.rejects(() => validerIndexation(manquante, SITE_ESSAI), /n'écrit pas/);

  // Une adresse d'un autre domaine : un plan de site se lit en adresses
  // absolues, et celle-ci désignerait un site tiers.
  const ailleurs = await distEssai(adresses);
  await writeFile(
    path.join(ailleurs, "sitemap.xml"),
    planDuSite(SITE_ESSAI, adresses).replace(`<loc>${SITE_ESSAI}/`, "<loc>/"),
  );
  await assert.rejects(() => validerIndexation(ailleurs, SITE_ESSAI), /n'est pas absolue/);

  // `robots.txt` qui mène ailleurs que là où le plan est posé : un plan que
  // rien n'annonce n'est lu par personne.
  const egare = await distEssai(adresses);
  await writeFile(path.join(egare, "robots.txt"), robotsDuSite("https://autre.test"));
  await assert.rejects(() => validerIndexation(egare, SITE_ESSAI), /un plan que rien n'annonce/);
});

test("11 bis. un 404.html tuerait les chemins de vues du plan, et le build le dit", async () => {
  const adresses = adressesPubliees(await analysesPubliees());
  const racine = await distEssai(adresses);
  await validerIndexation(racine, SITE_ESSAI);

  // Le repli SPA est ce qui fait répondre `/territoire`, `/bilan` et les
  // autres : Cloudflare Pages sert le gabarit pour tout chemin sans fichier
  // TANT QU'aucun 404.html n'existe (spec §7.2, décision 11). La règle était
  // écrite dans la spec et tenue par personne ; elle est tenue ici, parce que
  // c'est ce plan-ci qui en dépend.
  await writeFile(path.join(racine, "404.html"), "<html></html>");
  await assert.rejects(() => validerIndexation(racine, SITE_ESSAI), /404\.html/);
});

test("11 ter. chaque document annoncé déclare la bonne canonique, ou aucune", async () => {
  const analyses = await analysesPubliees();
  const adresses = adressesPubliees(analyses);

  // Une page servie à une seule adresse déclare celle-là. Annoncée au plan sous
  // une adresse et canonique sous une autre, elle enverrait deux signaux
  // contraires — c'est le défaut que le lot 3 a fermé sur les balises absolues.
  const detournee = await distEssai(adresses);
  await writeFile(
    path.join(detournee, "analyses", "index.html"),
    injecter(GABARIT, { ...PAGE, canonique: "/analyses/autre-chose/" }, SITE_ESSAI),
  );
  await assert.rejects(() => validerIndexation(detournee, SITE_ESSAI), /deux adresses pour une seule page/);

  // Le gabarit, lui, répond à plusieurs adresses du plan : la racine et les
  // chemins de vues que le repli sert. Une canonique fixe y déclarerait toutes
  // les autres doublons de la première — le plan les annoncerait, le document
  // les retirerait. Son absence est donc une décision, gardée comme telle.
  assert.ok(SERVIS_PAR_LE_REPLI.size > 0, "le gabarit ne sert plus qu'une adresse : il lui faudrait une canonique");
  const figee = await distEssai(adresses);
  await writeFile(
    path.join(figee, "index.html"),
    GABARIT.replace("</head>", `<link rel="canonical" href="${SITE_ESSAI}/" /></head>`),
  );
  await assert.rejects(() => validerIndexation(figee, SITE_ESSAI), /les déclarerait doublons/);
});

test("11 quater. le build appelle ce contrôle, et l'appelle après la dernière page", () => {
  // Troisième garde de ce fichier, et troisième test de branchement : les
  // tests 7 bis et 7 ter ont appris ici qu'une fonction éprouvée dont l'appel
  // est commenté laisse toute la suite verte.
  const source = sansCommentaires(readFileSync(new URL("./prerendre.ts", import.meta.url), "utf8"));
  const corps = source.slice(source.indexOf("async function main"));
  assert.ok(corps.length > 500, "main() introuvable dans scripts/prerendre.ts");
  assert.match(
    corps,
    /await ecrireIndexation\(DIST, SITE, adresses\);/,
    "main() n'écrit plus robots.txt ni le plan du site : les moteurs n'auraient rien à lire.",
  );
  assert.match(
    corps,
    /await validerIndexation\(DIST, SITE\);/,
    "main() n'appelle plus validerIndexation : le plan pourrait annoncer des pages absentes.",
  );
  // Écrit d'abord, relu ensuite : le contrôle porte sur les fichiers, pas sur
  // la liste qui a servi à les composer.
  assert.ok(
    corps.indexOf("await ecrireIndexation(") < corps.indexOf("await validerIndexation("),
    "le plan est contrôlé avant d'être écrit : le contrôle lirait le plan du build précédent.",
  );
  // Après la dernière page rangée : appelé plus tôt, le contrôle déclarerait
  // absentes des pages que le build s'apprête à écrire.
  assert.ok(
    corps.lastIndexOf("ecrites.push(") < corps.indexOf("await ecrireIndexation("),
    "le plan est écrit avant la dernière page : il annoncerait ce qui n'est pas encore là.",
  );
});

/* --------------------------------------------------------------------------
 * 12. L'accueil est SERVI, pas seulement écrit
 *
 * La racine est la première page qu'un moteur explore, et cette première
 * exploration fixe l'impression qu'il met en cache — c'est elle qu'on ne
 * rattrape pas. Peinte côté client seulement, elle ne portait aucun mot du
 * message principal pour qui n'exécute pas JavaScript : `<main>` s'y lisait sur
 * le squelette de la carte, « Voir sur la carte · Aucun territoire choisi ».
 * ----------------------------------------------------------------------- */

/** Le vrai gabarit du dépôt, celui que Vite copie dans `dist`. Les tests
 *  ci-dessous l'éprouvent LUI, pas une fixture : c'est son cadre d'accueil, son
 *  titre et sa description qui partent en production. */
const GABARIT_REEL = readFileSync(new URL("../index.html", import.meta.url), "utf8");

/**
 * Le texte de `<main>`, balises retirées — la mesure du relecteur.
 *
 * Les commentaires HTML partent d'abord : ce sont les seuls « mots » du gabarit
 * que personne ne lit, et les compter ferait passer une page vide pour une page
 * pleine.
 */
function texteDuMain(html: string): string {
  const main = html.match(/<main id="contenu">([\s\S]*?)<\/main>/)?.[1] ?? "";
  return main
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Le catalogue des trois séries de l'exemple vivant, en euros — ce que
 *  l'entrepôt en déclare. */
const CATALOGUE_EXEMPLE = CHIFFRES_EXEMPLE.map(
  (id) => ({ id, libelle: `Série ${id}`, unite: "EUR" }) as Indicateur,
);

/** Une région du lot publié, complète ou trouée selon `series`. */
function region(nom: string, series: Record<string, Record<string, number>>): Territoire {
  return { nom, parent: null, population: 1_000_000, drapeaux: {}, series };
}

const TROIS_SERIES = Object.fromEntries(
  CHIFFRES_EXEMPLE.map((id, rang) => [id, { "2024": 3_600_000_000 + rang, "2025": 3_800_000_000 + rang }]),
);

/**
 * Un lot dont la région au plus petit code est trouée, et dont les clés
 * arrivent dans le désordre.
 *
 * Les deux pièges dans un seul lot : « le premier » ne veut pas dire le premier
 * complet si l'on ne trie pas les éligibles, et il ne veut pas dire le premier
 * code si l'on s'en remet à l'ordre des clés — « 11 » passe devant « 01 » dans
 * tout objet JavaScript.
 */
const LOT_ESSAI: Record<string, Territoire> = {
  "11": region("Code plus grand, complet", TROIS_SERIES),
  "01": region("Plus petit code, troué", { [CHIFFRES_EXEMPLE[0]]: { "2025": 1_000_000_000 } }),
  "02": region("Plus petit code complet", TROIS_SERIES),
};

test("12. le gabarit sert l'accueil écrit, message principal compris, sans exécuter une ligne", async () => {
  const analyses = await analysesPubliees();
  const corps = corpsAccueil(analyses, CATALOGUE_EXEMPLE, LOT_ESSAI, ["INSEE", "OFGL"]);
  const html = injecterAccueil(GABARIT_REEL, corps, "v-essai");

  // Ce que `<main>` porte, balises retirées : le message principal du site, et
  // les trois appels à l'action. Sans JavaScript, sans réseau, sans rien.
  const texte = texteDuMain(html);
  assert.ok(texte.includes(echapper(MESSAGE_PRINCIPAL)), "le message principal n'est pas servi");
  for (const appel of ["Lire le verdict", "Rejouer le calcul", "Chercher ma commune"]) {
    assert.ok(texte.includes(appel), appel);
  }
  // Et il en reste beaucoup plus que les 203 signes du squelette de la carte.
  assert.ok(texte.length > 1000, `<main> ne porte que ${texte.length} signes de texte`);

  // Le cadre reste le cadre : `basculerVue` (main.ts) le montre et le masque
  // par son identifiant, et `brancherAppelRecherche` y délègue son écouteur.
  assert.match(html, /<div class="vue vue--accueil" id="vue-accueil" data-publication="v-essai">/);
});

test("12 bis. le pré-rendu sert les mêmes trois portes que l'accueil dynamique", async () => {
  const corps = corpsAccueil(await analysesPubliees(), CATALOGUE_EXEMPLE, LOT_ESSAI, ["INSEE", "OFGL"]);
  const portes = [
    ["Comprendre la France", "/bilan"],
    ["Explorer mon territoire", "/territoire"],
    ["Prendre les commandes", "/simulateur"],
  ] as const;
  const positions = portes.map(([libelle, href]) => {
    assert.match(corps, new RegExp(`class="accueil-porte[^\"]*" href="${href}"[\\s\\S]*?${libelle}`));
    return corps.indexOf(href);
  });
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test("12 ter. le tirage du pré-rendu est le premier territoire COMPLET de la liste publiée", () => {
  // Un choix, jamais un aléa refait à chaque build : deux constructions du même
  // dépôt donneraient deux pages, et le diff du site deviendrait illisible.
  assert.equal(ALEA_PRERENDU, 0);
  const corps = corpsAccueil([], CATALOGUE_EXEMPLE, LOT_ESSAI, ["INSEE"]);
  // Zéro désigne le premier ÉLIGIBLE — la région trouée afficherait un trou à
  // l'endroit le plus visible du site — dans l'ordre des CODES, et non dans
  // celui où JavaScript rend les clés d'un objet, où « 11 » passe devant « 01 ».
  assert.ok(corps.includes("Plus petit code complet"));
  assert.ok(!corps.includes("Plus petit code, troué"));
  assert.ok(!corps.includes("Code plus grand, complet"));
  // Et deux compositions de suite donnent la même page, au caractère près.
  assert.equal(corps, corpsAccueil([], CATALOGUE_EXEMPLE, LOT_ESSAI, ["INSEE"]));
});

test("12 ter. le pré-rendu rougit si le cadre disparaît ou repart replié", () => {
  // Deux défauts muets, et le second est celui d'avant ce pré-rendu : l'accueil
  // écrit dans le document et servi à personne.
  assert.throws(
    () => injecterAccueil(GABARIT_REEL.replace('id="vue-accueil"', 'id="vue-maison"'), "<p>x</p>", "v"),
    /la racine partirait vide/,
  );
  assert.throws(
    () =>
      injecterAccueil(
        GABARIT_REEL.replace('id="vue-accueil"', 'id="vue-accueil" hidden'),
        "<p>x</p>",
        "v",
      ),
    /servie à personne/,
  );
});

test("12 quater. le build écrit l'accueil dans le gabarit, et le gabarit seulement", () => {
  // Troisième garde de branchement de ce fichier : les tests 7 bis et 7 ter ont
  // appris ici qu'une fonction éprouvée dont l'appel est commenté laisse toute
  // la suite verte.
  const source = sansCommentaires(readFileSync(new URL("./prerendre.ts", import.meta.url), "utf8"));
  const corps = source.slice(source.indexOf("async function main"));
  assert.ok(corps.length > 500, "main() introuvable dans scripts/prerendre.ts");
  assert.match(
    corps,
    /injecterAccueil\(shell, corpsAccueil\(analyses, catalogue, regions, producteurs\), version\)/,
    "main() n'écrit plus l'accueil : la racine repartirait vide pour qui n'exécute pas JavaScript.",
  );
  // Le corps des cinq autres vues n'est pas touché : l'application se monte
  // dessus, et `injecter` — qui remplace `<main>` entier — reste réservé aux
  // pages éditoriales.
  assert.doesNotMatch(corps, /injecter\(shell, \{[\s\S]*?canonique: "\/"/);
});

/* --------------------------------------------------------------------------
 * 13. Le gabarit ne s'annonce plus comme une de ses vues
 * ----------------------------------------------------------------------- */

test("13. le gabarit ne s'annonce plus comme une de ses vues", () => {
  // Il répond à six adresses par le repli SPA : la racine, où l'accueil est
  // servi, et les cinq chemins de vues. Son titre et sa description valent donc
  // pour toutes — « carte des finances locales » décrivait la carte, qui a
  // quitté la racine pour `/territoire`.
  assert.equal(titreDuGabarit(GABARIT_REEL), marqueDuGabarit(GABARIT_REEL));
  // Et sa description est le message du site, arrêté à la conception (spec §8).
  // Un `<meta>` ne peut pas lire une constante : c'est cette égalité-ci qui
  // tient les deux rédactions accordées.
  assert.equal(descriptionDuGabarit(GABARIT_REEL), MESSAGE_PRINCIPAL);

  // La carte de partage de la racine peint ce que le document annonce : c'est
  // le même défaut, une image plus loin — `og:image` de `/` est `/carte.png`,
  // et son titre peint était « carte des finances locales ».
  const siteCarte = sections(GABARIT_REEL).find((s) => s.chemin === "");
  assert.ok(siteCarte, "le gabarit n'a plus de carte de section");
  assert.equal(siteCarte.titre, marqueDuGabarit(GABARIT_REEL));
  assert.equal(siteCarte.phrase, MESSAGE_PRINCIPAL);
  for (const mot of [siteCarte.titre, siteCarte.phrase, titreDuGabarit(GABARIT_REEL)]) {
    assert.ok(!/carte des finances locales/i.test(mot), `« ${mot} » nomme une vue que / n'ouvre plus`);
  }
});

/* --------------------------------------------------------------------------
 * 14. `/bilan` est SERVIE, pas seulement peinte
 *
 * C'est la page vers laquelle la bande de confiance de l'accueil renvoie. Servie
 * par le gabarit, elle partait vide : un robot — ou un lecteur dont le paquet
 * n'arrive pas — trouvait au bout de ce lien de confiance le `<main>` de
 * l'accueil, et pas une source. Un lien de confiance qui ouvre une page vide
 * coûte plus que pas de lien.
 * ----------------------------------------------------------------------- */

test("14. /bilan ne sert plus l'attribution ni la méthode", () => {
  const html = injecterMethode(GABARIT_REEL);
  assert.doesNotMatch(html, /methode-sources|bilan__attribution|methode-methode|methode-grille/);
});

test("14 bis. le bilan part déplié, et l'accueil replié", () => {
  const html = injecterMethode(GABARIT_REEL);

  // Déplié, sans quoi la page serait écrite dans le document et servie à
  // personne : ni au lecteur sans JavaScript, ni au robot qui n'en exécute pas.
  // C'est l'état d'avant ce pré-rendu, et il reviendrait sans un mot.
  assert.match(html, /<div class="vue" id="vue-bilan">/);
  assert.match(html, /<body class="plein-ecran" data-vue="bilan">/);
  // L'accueil replié : le gabarit le sert déplié pour la racine, et ce
  // document-ci montrerait l'accueil au-dessus de la méthode jusqu'à ce que
  // `basculerVue` tranche — le clignotement que ce document fait disparaître.
  assert.match(html, /<div class="vue vue--accueil" id="vue-accueil" hidden>/);
  assert.throws(
    () => injecterMethode(GABARIT_REEL.replace('id="vue-bilan"', 'id="vue-recette"')),
    /vue-bilan/,
  );
});

test("14 quater. le document de /bilan déclare sa canonique, le gabarit toujours aucune", async () => {
  const adresses = adressesPubliees(await analysesPubliees());
  // Le chemin de la méthode est bien au plan, et il n'est plus servi par le
  // repli : sans cela, ce test ne dirait rien de ce qu'il prétend garder.
  assert.ok(adresses.includes(CHEMINS.bilan), "/bilan n'est plus au plan du site");
  assert.ok(!SERVIS_PAR_LE_REPLI.has(CHEMINS.bilan), "/bilan est encore servie par le gabarit");

  // Tel que le build l'écrit, tout passe.
  await validerIndexation(await distEssai(adresses), SITE_ESSAI);

  // Seule à son fichier, elle doit déclarer SON adresse — c'est le compte que
  // le gabarit a perdu et qu'elle a gagné, et il se lit sur le disque, pas sur
  // une liste. Sans canonique, elle est annoncée au plan sous une adresse et
  // n'en déclare aucune.
  const muette = await distEssai(adresses);
  await writeFile(path.join(muette, CHEMINS.bilan.replace(/^\//, ""), "index.html"), GABARIT);
  await assert.rejects(() => validerIndexation(muette, SITE_ESSAI), /deux adresses pour une seule page/);

  // Et celle du gabarit y serait un doublon déclaré : le gabarit répond à la
  // racine, elle non.
  const empruntee = await distEssai(adresses);
  await writeFile(
    path.join(empruntee, CHEMINS.bilan.replace(/^\//, ""), "index.html"),
    injecterAnnonce(GABARIT, { ...PAGE, canonique: "/" }, SITE_ESSAI),
  );
  await assert.rejects(() => validerIndexation(empruntee, SITE_ESSAI), /deux adresses pour une seule page/);
});

test("14 quinquies. le build écrit cette page, et l'écrit avant le plan du site", () => {
  // Quatrième garde de branchement de ce fichier : les tests 7 bis et 7 ter ont
  // appris ici qu'une fonction éprouvée dont l'appel est commenté laisse toute
  // la suite verte.
  const source = sansCommentaires(readFileSync(new URL("./prerendre.ts", import.meta.url), "utf8"));
  const corps = source.slice(source.indexOf("async function main"));
  assert.ok(corps.length > 500, "main() introuvable dans scripts/prerendre.ts");
  assert.match(
    corps,
    /injecterAnnonce\(\s*injecterReperes\(\s*injecterMethode\(shell\),/,
    "main() n'écrit plus la page BILAN.",
  );
  assert.match(
    corps,
    /await ecrirePage\(path\.join\(DIST, DOSSIER_BILAN\), htmlBilan\);/,
    "main() ne range plus la page BILAN : le plan annoncerait une adresse que le gabarit sert.",
  );
  // Par `injecterAnnonce`, jamais par `injecter` : celui-ci remplace `<main>`
  // entier et pose `data-page="editorial"`, ce qui arrêterait le paquet avant
  // la fraîcheur et le journal — deux fichiers publiés que seul le navigateur
  // va chercher.
  assert.doesNotMatch(corps, /injecter\(shell, \{[\s\S]*?canonique: CHEMIN_BILAN/);
  // Rangée avant que le plan ne soit écrit et relu, comme toute autre page :
  // annoncée plus tôt, elle serait déclarée morte par son propre contrôle.
  const rangee = corps.indexOf("await ecrirePage(path.join(DIST, DOSSIER_BILAN)");
  const plan = corps.indexOf("await ecrireIndexation(");
  assert.ok(rangee > 0 && plan > rangee, "la page BILAN est écrite après le plan qui l'annonce");
});

/* --------------------------------------------------------------------------
 * 15. /bilan est SERVIE, pas seulement câblée
 *
 * C'était le dernier écart de pré-rendu du site, et son motif était technique :
 * `afficherNational` prenait deux `HTMLElement` et les mutait, donc rien de ce
 * bloc-là n'était appelable sous Node. Ses deux rendus purs extraits, le
 * chemin est le même que celui de `/bilan`.
 * ----------------------------------------------------------------------- */

/**
 * Les cadres de blocs du gabarit, dans l'ordre où il les pose — **lus dans le
 * gabarit**, jamais recopiés ici.
 *
 * La liste était écrite à la main, et une liste écrite à la main ne pousse
 * pas : trois cadres sont arrivés après elle — « 100 € de toutes les
 * administrations », la redistribution, les retraites — et sont restés
 * **dépliés et vides** dans le document servi en production, ce que `.bloc`
 * dessine comme un cadre bordé et ombré, c'est-à-dire comme une panne. Les
 * deux tests qui auraient dû le voir passaient au vert : ils ne regardaient
 * que les huit cadres qu'on avait pensé à leur nommer.
 *
 * C'est le geste que la garde des cadres défilants a déjà dû faire
 * (`interface.test.ts`), pour exactement la même raison.
 */
// Le gabarit ENTIER, et non une tranche : la section nationale contient
// désormais des `<section class="chapitre">`, si bien qu'une tranche bornée à
// la première `</section>` s'arrêtait au premier chapitre et ne voyait que
// deux cadres sur douze. Les `<article id="bloc-…">` n'existent nulle part
// ailleurs dans la page — le test suivant le vérifie par leur nombre.
const CADRES_REPERES = [
  ...GABARIT_REEL.matchAll(/<article[^>]*id="(bloc-[a-z0-9-]+)"/g),
].map((m) => m[1]);

test("15 quinquies. la liste des cadres se lit dans le gabarit, et elle n'est pas vide", () => {
  // Sans cette sonde, un gabarit remanié rendrait une liste vide et les deux
  // tests qui la parcourent passeraient en ne vérifiant rien.
  // Six cadres : un par chapitre, deux au chapitre 4 — exactement la maquette
  // validée, et rien d'hérité.
  assert.ok(CADRES_REPERES.length >= 6, `${CADRES_REPERES.length} cadre(s) lus dans le gabarit`);
  assert.equal(new Set(CADRES_REPERES).size, CADRES_REPERES.length, "un cadre est déclaré deux fois");
  assert.ok(CADRES_REPERES.includes("bloc-cent-euros-apu"), CADRES_REPERES.join(", "));
});

test("15 sexies. aucun cadre du gabarit n'est servi déplié et vide", () => {
  // La règle que la docstring d'`injecterReperes` porte, appliquée à TOUS les
  // cadres du gabarit et non aux seuls qu'on a pensé à nommer : chacun est
  // rempli, ou replié. C'est le contrôle qui manquait quand les trois cadres
  // neufs sont partis en production vides.
  const html = REPERES_ESSAI();
  for (const id of CADRES_REPERES) {
    const cadre = new RegExp(`<article[^>]*id="${id}"([^>]*)>([\\s\\S]*?)</article>`);
    const trouve = html.match(cadre);
    assert.ok(trouve, `« ${id} » a disparu du document`);
    const [, attributs, corps] = trouve;
    assert.ok(
      / hidden/.test(attributs) || corps.trim() !== "",
      `« ${id} » est servi déplié et vide : le lecteur voit un cadre bordé sans rien dedans`,
    );
  }
});

function territoireEssai(series: Record<string, Record<string, number>>): Territoire {
  return { nom: "", parent: null, population: null, drapeaux: {}, series };
}

/**
 * Un lot pays qui alimente les cinq blocs qui lisent des séries.
 *
 * Des valeurs d'essai, pas les valeurs publiées : ce test vérifie qu'un chiffre
 * DONNÉ ressort servi, et un montant réel recopié ici serait un chiffre de plus
 * à tenir à jour pour rien.
 */
const PAYS_ESSAI: Record<string, Territoire> = {
  FR: territoireEssai({
    eurostat_apu_recettes: { "2024": 1_000_000_000_000, "2025": 1_000_000_000_000 },
    eurostat_apu_depenses: { "2024": 1_060_000_000_000, "2025": 1_097_700_000_000 },
    eurostat_pib_montant: { "2024": 2_000_000_000_000, "2025": 2_100_000_000_000 },
    // La dette en TRIMESTRES : le bloc « Est-ce tenable ? » lit les fins
    // d'année de la série trimestrielle, comme la publication réelle.
    insee_dette_apu_montant: { "2024-Q4": 3_306_100_000_000, "2025-Q4": 3_400_000_000_000 },
    eurostat_taux_10_ans: { "2017": 0.81, "2025": 3.35 },
    insee_dette_apu_part_pib: { "2024": 113.0, "2025": 115.6 },
    insee_dette_etat_montant: { "2025": 2_800_000_000_000 },
    eurostat_dette_pib: { "2024": 113.0 },
    eurostat_deficit_pib: { "2024": -5.8 },
    eurostat_chomage: { "2024": 7.4 },
    eurostat_inflation_ipch: { "2025-05": 0.6, "2025-06": 0.9 },
    eurostat_depenses_publiques_pib: { "2024": 57.3 },
    eurostat_fonction_sante: { "2024": 8.9 },
    eurostat_secu_depenses_pib: { "2024": 26.2 },
    eurostat_secu_recettes_pib: { "2024": 25.9 },
    eurostat_secu_solde_pib: { "2024": -0.3 },
    depense_fiscale_totale: { "2024": 81_000_000_000 },
  }),
  DE: territoireEssai({ eurostat_dette_pib: { "2024": 62.5 } }),
};

const CATALOGUE_REPERES = [
  { id: "insee_dette_etat_montant", libelle: "Dette de l'État" },
  { id: "insee_dette_apu_montant", libelle: "Dette publique" },
  { id: "eurostat_taux_10_ans", libelle: "Taux d'emprunt à 10 ans" },
  { id: "eurostat_inflation_ipch", libelle: "Inflation" },
  { id: "eurostat_fonction_sante", libelle: "Santé" },
  { id: "eurostat_secu_solde_pib", libelle: "Solde des administrations de sécurité sociale" },
  { id: "depense_fiscale_totale", libelle: "Dépenses fiscales" },
] as Indicateur[];

const NICHES_ESSAI: DepensesFiscales = {
  exercices: ["2024", "2025"],
  realise: "2024",
  dispositifs: [
    {
      numero: "110201",
      libelle: "Crédit d'impôt d'essai",
      mission: "Mission d'essai",
      montants: { "2024": 7_000_000_000 },
    },
  ],
};

const BUDGET_ESSAI: BudgetEtat = {
  etapes: [{ cle: "execute", libelle: "Exécuté" }],
  lignes: [
    { libelle: "Total recettes nettes du budget général", cote: "recette", parent: null },
    { libelle: "Impôt sur le revenu", cote: "recette", parent: "Total recettes nettes du budget général" },
    { libelle: "Total dépenses nettes du budget général", cote: "depense", parent: null },
    { libelle: "Dépenses de personnel", cote: "depense", parent: "Total dépenses nettes du budget général" },
    { libelle: "Total prélèvements sur recettes", cote: "depense", parent: null },
  ].map((l) => ({ ...l, titre: null, agregat: false, indicateur: null })) as BudgetEtat["lignes"],
  exercices: {
    "2025": {
      execute: {
        solde: -124_205_673_501.55,
        solde_comptes_speciaux: null,
        solde_budgets_annexes: null,
        montants: {
          "Total recettes nettes du budget général": 380_000_000_000,
          "Impôt sur le revenu": 95_000_000_000,
          "Total dépenses nettes du budget général": 441_000_000_000,
          "Dépenses de personnel": 156_000_000_000,
          "Total prélèvements sur recettes": 69_000_000_000,
        },
      },
    },
  },
  quarantaine: {},
};

const REPERES_ESSAI = () =>
  injecterReperes(GABARIT_REEL, PAYS_ESSAI, CATALOGUE_REPERES, NICHES_ESSAI, BUDGET_ESSAI);

test("15. la source Europe pré-rendue résout vers une fiche effectivement servie", () => {
  const fiche = {
    id: "eurostat-comparaison",
    nom: "Eurostat — comparaison européenne",
    statut: "publie" as const,
    institution: "Eurostat",
    url: "https://exemple.test/eurostat",
    pages: ["/bilan"],
    indicateurs: ["eurostat_depenses_publiques_pib", "eurostat_prelevements_obligatoires_pib"],
  };
  const pays = {
    FR: territoireEssai({
      eurostat_depenses_publiques_pib: { "2024": 57.3 },
      eurostat_prelevements_obligatoires_pib: { "2024": 45.2 },
    }),
    DE: territoireEssai({
      eurostat_depenses_publiques_pib: { "2024": 49.4 },
      eurostat_prelevements_obligatoires_pib: { "2024": 40.7 },
    }),
    EU27_2020: territoireEssai({
      eurostat_depenses_publiques_pib: { "2024": 49.1 },
      eurostat_prelevements_obligatoires_pib: { "2024": 40.2 },
    }),
  };
  const bilan = injecterReperes(
    GABARIT_REEL,
    pays,
    CATALOGUE_REPERES,
    NICHES_ESSAI,
    BUDGET_ESSAI,
    indexerSources([fiche]),
  );
  const sources = injecterRegistre(GABARIT_REEL, [], [fiche], SITE_ESSAI);
  assert.match(bilan, /Source : <a href="\/sources\/#eurostat-comparaison">Eurostat<\/a>\./);
  assert.match(sources, /id="eurostat-comparaison"/);
});

test("15. le bilan servi enchaîne directement le verdict et les trois chapitres", () => {
  const html = REPERES_ESSAI();
  const ids = ["france-verdict", "france-entrees", "france-sorties", "france-dette"];
  const positions = ids.map((id) => html.indexOf(`id="${id}"`));
  assert.ok(positions.every((position) => position >= 0), "un chapitre du parcours manque au bilan");
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, "le parcours du bilan n'est plus dans l'ordre de lecture");
  assert.doesNotMatch(html, /bilan-portes/);
  assert.equal((html.match(/class="bilan-chapitre"/g) ?? []).length, 3);
  assert.doesNotMatch(html, /href="#france-entrees"/);
  assert.doesNotMatch(html, /href="#france-sorties"/);
  assert.doesNotMatch(html, /href="#france-dette"/);
  assert.doesNotMatch(html, /<strong>La dette et l'Europe<\/strong>/);
  assert.doesNotMatch(html, /href="#france-europe"/);
  assert.doesNotMatch(html, /bilan-guide__nav/);
  assert.doesNotMatch(html, /id="france-europe"/);
  const position = (id: string) => {
    const index = html.indexOf(`id="${id}"`);
    assert.ok(index >= 0, `${id} introuvable dans le bilan servi`);
    return index;
  };
  assert.ok(position("bloc-dette") < position("bloc-europe"));
  assert.ok(position("bloc-europe") < html.indexOf('href="/simulateur"'));
  assert.doesNotMatch(html, /id="france-verdict"[\s\S]*?class="ui-conclusion bilan-verdict"[\s\S]*?Pour 100 € encaissés/);
  assert.match(html, /id="france-entrees"[\s\S]*?class="ui-conclusion[^"]*"[\s\S]*?D'où vient l'argent/);
});

test("15 bis. le pré-rendu ne réintroduit aucun doublon du verdict", () => {
  assert.doesNotMatch(GABARIT_REEL, /id="bilan-synthese"|id="bilan-reperes"/);
  const html = REPERES_ESSAI();
  assert.doesNotMatch(html, /id="bilan-synthese"|id="bilan-reperes"/);
  assert.match(html, /<a class="bilan-guide__cta" href="\/simulateur">Passer au simulateur<\/a>/);
  const source = readFileSync(new URL("./prerendre.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /syntheseOuverture|reperesOuverture/);
});

test("15. /bilan sert ses blocs sans exécuter une ligne", () => {
  const html = REPERES_ESSAI();
  const texte = texteDuMain(html);

  // Ce que les deux blocs alimentés par ce fixture écrivent, dans les mots que
  // le module rend — jamais une chaîne tapée ici, qui ne dirait rien de ce que
  // la page écrit vraiment. Les quatre autres blocs n'ont pas leurs séries
  // dans ce fixture : le test « 15 ter » vérifie qu'ils partent repliés.
  for (const phrase of [
    "la charge de la dette va augmenter",
    "La Sécu est-elle en déficit ?",
  ]) {
    assert.ok(texte.includes(phrase), `« ${phrase} » n'est pas servi`);
  }

  // Un chiffre donné en entrée, ressorti formaté par le formateur commun : la
  // preuve que les blocs ont lu les séries et pas un repli. Lu sur le HTML et
  // non sur `texteDuMain`, qui ramène toute espace à l'espace ordinaire — les
  // séparateurs de `millions` sont des espaces fines insécables (test 14 bis).
  const detteMd = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(3400);
  assert.ok(/\u202f/.test(detteMd), `« ${detteMd} » sans séparateur : cette sonde ne prouverait rien`);
  assert.ok(html.includes(detteMd), `la dette publiée « ${detteMd} » n'est pas servie`);

  // Le seuil suit la mesure : 1 051 signes sur ce fixture, qui n'alimente que
  // deux des six blocs. Il a encore baissé après le 19 août — « qui la
  // porte » plié dans la réponse plutôt que répété dans une légende, le
  // graphique du taux d'emprunt retiré (déjà dans la réponse), le sommaire
  // du bilan retiré, et les trois légendes qui expliquaient un tableau au lieu
  // de le laisser parler (COFOG, seuils de décile, sous-secteur S1314) — et
  // c'est voulu : la page porte moins de texte qu'avant sans en dire moins,
  // les mêmes faits vivant en un seul endroit chacun.
  assert.ok(texte.length > 950, `<main> ne porte que ${texte.length} signes de texte`);
});

test("15 bis. la vue part dépliée, la section nationale ouverte, l'accueil replié", () => {
  const html = REPERES_ESSAI();

  // Dépliée, sans quoi la page serait écrite dans le document et servie à
  // personne : ni au lecteur sans JavaScript, ni au robot qui n'en exécute pas.
  assert.match(html, /<div class="vue" id="vue-bilan">/);
  // La section nationale est `hidden` dans le gabarit — c'est le retour des
  // peintres qui l'ouvre côté navigateur, et le pré-rendu doit l'ouvrir aussi.
  assert.match(html, /<section class="national" id="national">/);
  // L'accueil replié, sans quoi il s'afficherait au-dessus des repères jusqu'à
  // ce que `basculerVue` tranche.
  assert.match(html, /<div class="vue vue--accueil" id="vue-accueil" hidden>/);
  // Mais tous les cadres restent présents : `$` y renverrait `null`, et le
  // navigateur ne pourrait plus repeindre.
  for (const id of [...CADRES_REPERES, "national"]) {
    assert.ok(html.includes(`id="${id}"`), `le cadre « ${id} » a disparu du document`);
  }
  // Le document reste celui de l'application : `data-page="editorial"`
  // arrêterait le paquet avant les graphiques et le sélecteur d'exercice.
  assert.doesNotMatch(html, /data-page="editorial"/);
});

test("15 ter. un bloc sans source publiée est replié, jamais laissé vide", () => {
  // Un cadre déplié et vide se lit comme une panne. Le fixture alimente aussi
  // l'ouverture pour éprouver l'équation ; les peintres sans leurs séries
  // doivent tout de même partir repliés.
  const html = REPERES_ESSAI();
  for (const id of [
    "bloc-recettes-etat",
    "bloc-cent-euros-apu",
    "bloc-fonctions",
    "bloc-redistribution",
  ]) {
    assert.match(html, new RegExp(`id="${id}"[^>]* hidden>`), `« ${id} » est resté déplié et vide`);
  }
  // Les blocs qui ont leurs séries, eux, sont écrits — sans quoi ce test
  // passerait sur une page entièrement repliée sans rien prouver.
  assert.doesNotMatch(html, /id="bloc-dette"[^>]* hidden>/);
  assert.ok(texteDuMain(html).includes("la charge de la dette va augmenter"));
});

test("15 quater. le pré-rendu rougit plutôt que de servir une page sans repères", () => {
  // Trois cadres retirés, trois échecs — les mêmes défauts muets que
  // `injecterMethode` ferme, sur les cadres de cette page-ci.
  assert.throws(
    () => injecterReperes(GABARIT_REEL.replace('id="vue-bilan"', 'id="vue-jalons"'), PAYS_ESSAI, CATALOGUE_REPERES, NICHES_ESSAI, BUDGET_ESSAI),
    /vue-bilan/,
  );
  assert.throws(
    () => injecterReperes(GABARIT_REEL.replace('id="national"', 'id="hexagone"'), PAYS_ESSAI, CATALOGUE_REPERES, NICHES_ESSAI, BUDGET_ESSAI),
    /national/,
  );
  assert.throws(
    () =>
      injecterReperes(
        GABARIT_REEL.replace('id="bloc-dette"></article>', 'id="bloc-dette">déjà</article>'),
        PAYS_ESSAI,
        CATALOGUE_REPERES,
        NICHES_ESSAI,
        BUDGET_ESSAI,
      ),
    /n'est plus vide/,
  );
  // Et une publication sans une seule série nationale : la page partirait sur
  // vide, c'est-à-dire l'état d'avant ce pré-rendu.
  assert.throws(
    () =>
      injecterReperes(
        GABARIT_REEL,
        {},
        CATALOGUE_REPERES,
        { exercices: [], realise: null, dispositifs: [] },
        { etapes: [], lignes: [], exercices: {}, quarantaine: {} },
      ),
    /aucun bloc national ne s'écrit/,
  );
});

test("15 quinquies. le document de /bilan déclare sa canonique, le gabarit toujours aucune", async () => {
  const adresses = adressesPubliees(await analysesPubliees());
  // Le chemin est au plan, et il n'est plus servi par le repli : sans cela, ce
  // test ne dirait rien de ce qu'il prétend garder.
  assert.ok(adresses.includes(CHEMINS.bilan), "/bilan n'est plus au plan du site");
  assert.ok(!SERVIS_PAR_LE_REPLI.has(CHEMINS.bilan), "/bilan est encore servie par le gabarit");
  // Le gabarit en sert encore plusieurs : c'est ce qui lui vaut de n'en
  // déclarer aucune, et une page pré-rendue de plus ne doit pas le faire
  // tomber à une seule sans qu'on le voie.
  assert.ok(SERVIS_PAR_LE_REPLI.size > 1, "le gabarit ne sert plus qu'une adresse : il lui faudrait une canonique");

  await validerIndexation(await distEssai(adresses), SITE_ESSAI);

  // Seule à son fichier, elle doit déclarer SON adresse. Le message du
  // validateur nomme les deux adresses en cause.
  const muette = await distEssai(adresses);
  await writeFile(path.join(muette, CHEMINS.bilan.replace(/^\//, ""), "index.html"), GABARIT);
  await assert.rejects(() => validerIndexation(muette, SITE_ESSAI), /deux adresses pour une seule page/);
});

test("15 sexies. le build écrit cette page, et l'écrit avant le plan du site", () => {
  // Cinquième garde de branchement de ce fichier : une fonction éprouvée dont
  // l'appel est commenté laisse toute la suite verte (tests 7 bis et 7 ter).
  const source = sansCommentaires(readFileSync(new URL("./prerendre.ts", import.meta.url), "utf8"));
  const corps = source.slice(source.indexOf("async function main"));
  assert.ok(corps.length > 500, "main() introuvable dans scripts/prerendre.ts");
  assert.match(
    corps,
    /injecterAnnonce\(\s*injecterReperes\(/,
    "main() n'écrit plus la page BILAN : le chemin repartirait sur le gabarit vide.",
  );
  assert.match(
    corps,
    /await ecrirePage\(path\.join\(DIST, DOSSIER_BILAN\), htmlBilan\);/,
    "main() ne range plus la page BILAN : le plan annoncerait une adresse que le gabarit sert.",
  );
  // Le catalogue est celui du navigateur, indicateurs calculés compris : trois
  // blocs filtrent sur « cet indicateur est-il publié ? », et un pré-rendu qui
  // lirait le catalogue brut ferait apparaître ou disparaître un bloc à
  // l'arrivée du paquet.
  assert.match(corps, /injecterReperes\(\s*injecterMethode\(shell\),\s*pays,\s*\[\.\.\.catalogue, \.\.\.indicateursDerives\(catalogue\)\]/);
  // Sa propre carte de partage, jamais celle du site : celle-là a le chapeau
  // « Le site » et le message principal en phrase, et sous un titre qui annonce
  // la dette et les niches, c'est l'accueil qu'elle montrerait. Rien d'autre ne
  // l'attrape — `validerImagesAnnoncees` ne vérifie que l'EXISTENCE du fichier
  // annoncé, et `/carte.png` existe.
  assert.match(corps, /image: `\$\{CHEMIN_BILAN\}\/carte\.png`,/);
  // Et sa propre canonique. `validerIndexation` la refuserait à la
  // publication — mais il faut avoir lancé le build entier, réseau compris,
  // pour l'apprendre ; ici, une seconde suffit.
  assert.match(corps, /canonique: CHEMIN_BILAN,/);
  // Par `injecterAnnonce`, jamais par `injecter` : celui-ci pose
  // `data-page="editorial"`, qui arrêterait le paquet avant les graphiques.
  assert.doesNotMatch(corps, /injecter\(shell, \{[\s\S]*?canonique: CHEMIN_BILAN/);
  // Rangée avant que le plan ne soit écrit et relu, comme toute autre page.
  const rangee = corps.indexOf("await ecrirePage(path.join(DIST, DOSSIER_BILAN)");
  const plan = corps.indexOf("await ecrireIndexation(");
  assert.ok(rangee > 0 && plan > rangee, "la page BILAN est écrite après le plan qui l'annonce");
});
