/**
 * Le montage de l'accueil à la racine du site.
 *
 * `accueil.ts` est éprouvé chez lui : ses cinq blocs sont des fonctions pures,
 * et `accueil.test.ts` les prend une par une. Ce fichier-ci éprouve ce que la
 * pureté ne peut pas dire — **où** la page s'accroche et **ce que ses liens
 * ouvrent** :
 *
 * 1. `/` rend l'accueil ;
 * 2. `/territoire` rend toujours la carte, et aucun lien déjà partagé ne change
 *    de destination ;
 * 3. le champ de recherche du bloc 3 est celui du site, jamais un second ;
 * 4. le lien de l'exemple vivant ouvre réellement la fiche du territoire.
 *
 * `main.ts` importe MapLibre : il ne s'importe pas dans un test sans navigateur,
 * et c'est sa source qui est lue — le motif de `vues.test.ts` et
 * `interface.test.ts`. Ce qui peut être éprouvé pour de vrai l'est : `routes.ts`
 * et `accueil.ts` sont importés et exécutés, et la source de `main.ts` ne sert
 * qu'à vérifier que le montage se branche bien sur eux.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { renduChezVous, type ExempleTerritoire } from "./accueil.ts";
import { CHEMINS, estAccueil, vueDepuisAdresse } from "./routes.ts";

const MAIN = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const PAGE = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const BALISES = PAGE.replace(/<!--[\s\S]*?-->/g, "");

/* --------------------------------------------------------------------------
 * 1. `/` rend l'accueil
 * ----------------------------------------------------------------------- */

test("la racine rend l'accueil, et l'accueil n'est pas une vue de l'application", () => {
  assert.equal(estAccueil("/", ""), true);
  assert.equal(estAccueil("", ""), true);
  // La racine reste libre dans la table des vues : l'accueil est une page, pas
  // une vue de l'application monoécran (décision D-L4-a). L'y inscrire ferait
  // deux chemins pour une même chose, et `cheminDeVue` en composerait un.
  assert.equal(vueDepuisAdresse("/", ""), null);
  assert.ok(!Object.values(CHEMINS).includes("/"));
  assert.ok(!("accueil" in CHEMINS));
});

test("`basculerVue` montre l'accueil à la racine et le masque partout ailleurs", () => {
  assert.match(
    MAIN,
    /: estAccueil\(location\.pathname, location\.hash\)\s*\? "accueil"\s*: "territoire";/,
  );
  assert.match(MAIN, /\$\("vue-accueil"\)\.hidden = vue !== "accueil";/);
  assert.match(MAIN, /if \(vue === "accueil"\) void peindreAccueil\(\);/);
  // Le cadre existe dans la page, vide : c'est `peindreAccueil` qui l'écrit,
  // une fois le catalogue et le manifeste arrivés.
  assert.match(BALISES, /<div class="vue vue--accueil" id="vue-accueil" hidden><\/div>/);
});

test("l'accueil ne peint qu'une fois le catalogue et les producteurs connus", () => {
  // Peint plus tôt, il annoncerait « 0 indicateurs publiés » et une liste de
  // producteurs vide : deux affirmations fausses à l'endroit le plus lu du site.
  const corps = MAIN.slice(
    MAIN.indexOf("async function peindreAccueil"),
    MAIN.indexOf("function brancherAppelRecherche"),
  );
  assert.ok(corps.length > 200, "corps de peindreAccueil introuvable");
  assert.match(corps, /await publiee;/);
  assert.match(corps, /producteurs: jeux\.map\(\(jeu\) => jeu\.producteur\)/);
  // Et la promesse ne se résout qu'une fois le catalogue complet, dérivés
  // compris.
  assert.match(
    MAIN,
    /catalogue = \[\.\.\.catalogue, \.\.\.indicateursDerives\(catalogue\)\];[\s\S]{0,300}?resoudrePubliee\(\);/,
  );
});

test("le tirage de l'exemple se fait au montage, jamais dans le rendu", () => {
  // `accueil.ts` reçoit son aléa (accueil.test.ts, n° 30) : c'est ici qu'il est
  // tiré, et nulle part ailleurs.
  assert.match(MAIN, /alea: Math\.random\(\)/);
});

/* --------------------------------------------------------------------------
 * 2. `/territoire` rend toujours la carte
 * ----------------------------------------------------------------------- */

test("aucune vue existante ne bouge : la carte reste à /territoire", () => {
  assert.equal(CHEMINS.territoire, "/territoire");
  assert.equal(vueDepuisAdresse("/territoire", ""), "territoire");
  assert.equal(estAccueil("/territoire", ""), false);
  for (const chemin of Object.values(CHEMINS)) {
    assert.equal(estAccueil(chemin, ""), false, chemin);
  }
});

test("un lien déjà partagé ne change pas de destination", () => {
  // Les liens d'avant les chemins portent la vue dans le fragment : la racine
  // ne les avale pas, elle les laisse résoudre vers leur vue.
  for (const [fragment, vue] of [
    ["#carte", "territoire"],
    ["#donnees", "territoire"],
    ["#decryptages", "reperes"],
    ["#analyses", "detail"],
    ["#methode", "methode"],
  ]) {
    assert.equal(vueDepuisAdresse("/", fragment), vue, fragment);
    assert.equal(estAccueil("/", fragment), false, fragment);
  }
  // Une ancre interne, elle, ne nomme aucune vue : la racine reste l'accueil.
  assert.equal(estAccueil("/", "#bloc-etat"), true);
  // Et une adresse inconnue retombe sur la carte, pas sur l'accueil : c'est ce
  // que la seconde branche du repli dit.
  assert.equal(estAccueil("/inconnue", ""), false);
});

/* --------------------------------------------------------------------------
 * 3. Le champ de recherche du bloc 3 est celui du site
 * ----------------------------------------------------------------------- */

test("il n'y a qu'un champ de recherche, et l'accueil vise celui-là", () => {
  // Un seul `input` de recherche dans la page, celui de l'en-tête.
  assert.equal(BALISES.match(/id="recherche"/g)?.length, 1);
  // Et un seul câblage, sur ce champ-là : l'accueil n'en construit pas un
  // second, et n'en câble pas un second.
  assert.equal(MAIN.match(/brancherRecherche\(/g)?.length, 2); // la déclaration et l'appel
  assert.match(
    MAIN,
    /brancherRecherche\(\$<HTMLInputElement>\("recherche"\), \$<HTMLUListElement>\("suggestions"\)\)/,
  );
});

test("« Chercher ma commune » donne le curseur au champ du site", () => {
  // Le lien porte `#recherche`. Laissé au navigateur, il défile vers un champ
  // déjà à l'écran sans y poser le curseur : l'appel promet une recherche et ne
  // la commence pas.
  const corps = MAIN.slice(
    MAIN.indexOf("function brancherAppelRecherche"),
    MAIN.indexOf("function basculerVue"),
  );
  assert.ok(corps.length > 200, "corps de brancherAppelRecherche introuvable");
  assert.match(corps, /closest\('a\[href="#recherche"\]'\)/);
  assert.match(corps, /\$<HTMLInputElement>\("recherche"\)/);
  assert.match(corps, /champ\.focus\(\);/);
  // Un écouteur délégué, posé une fois sur le cadre que rien ne remplace —
  // même motif que `brancherPartage`, `brancherScenarios` et
  // `brancherCitations`. C'est l'intérieur du cadre que `peindreAccueil`
  // réécrit, jamais le cadre.
  assert.match(corps, /cadre\.addEventListener\("click"/);
  assert.doesNotMatch(corps, /innerHTML/);
});

/* --------------------------------------------------------------------------
 * 4. Le lien de l'exemple vivant ouvre la fiche
 * ----------------------------------------------------------------------- */

/** Un exemple de la forme exacte que `exemplesTerritoires` (main.ts) produit :
 *  la maille est celle des régions, le code celui de la Nouvelle-Aquitaine. */
const EXEMPLE: ExempleTerritoire = {
  nom: "Nouvelle-Aquitaine",
  code: "75",
  niveau: "region",
  chiffres: [
    {
      libelle: "Recettes de fonctionnement",
      unite: "EUR",
      id: "ofgl_recettes_fonctionnement",
      exercice: "2025",
      valeur: 3_800_000_000,
      precedent: { exercice: "2024", valeur: 3_600_000_000 },
    },
  ],
};

/** Le lien que le bloc 3 écrit pour son exemple. */
function lienDeLExemple(): URL {
  const html = renduChezVous(EXEMPLE);
  const href = html.match(/href="(\/territoire[^"]*)"/)?.[1];
  assert.ok(href, "le lien de l'exemple est introuvable dans le bloc rendu");
  // Une origine quelconque : seuls le chemin et les paramètres sont en cause.
  return new URL(href, "https://exemple.test");
}

test("le lien de l'exemple mène au chemin de la carte, pas à une adresse composée à la main", () => {
  const lien = lienDeLExemple();
  assert.equal(lien.pathname, CHEMINS.territoire);
  // Et ce chemin ouvre bien la vue territoire — pas l'accueil, pas un repli.
  assert.equal(vueDepuisAdresse(lien.pathname, ""), "territoire");
  assert.equal(estAccueil(lien.pathname, ""), false);
});

test("le lien de l'exemple porte les deux paramètres que lireUrl lit, sous leurs noms", () => {
  const lien = lienDeLExemple();
  assert.equal(lien.searchParams.get("niveau"), "region");
  assert.equal(lien.searchParams.get("territoire"), "75");
  // Ce sont ces deux noms-là que `lireUrl` lit — le second devient la sélection.
  assert.match(MAIN, /niveau: niveauConnu\(p\.get\("niveau"\)\),/);
  assert.match(MAIN, /selection: p\.get\("territoire"\),/);
  // Un paramètre de plus serait un paramètre que personne ne lit.
  assert.deepEqual([...lien.searchParams.keys()].sort(), ["niveau", "territoire"]);
});

test("la maille de l'exemple est une couche de la carte : niveauConnu la garde", () => {
  const lien = lienDeLExemple();
  // `niveauConnu` ne garde que les mailles de `COUCHES` ; toute autre est
  // ramenée à « region » sans un mot, et l'exemple ouvrirait la fiche d'un
  // territoire que le lien ne nommait pas.
  assert.match(MAIN, /function niveauConnu[^}]*demande in COUCHES/s);
  const couches = MAIN.slice(
    MAIN.indexOf("const COUCHES: Record<string, string> = {"),
    MAIN.indexOf("type Etat = {"),
  );
  assert.match(couches, new RegExp(`\\b${lien.searchParams.get("niveau")}: "`));
  // Et c'est bien cette maille-là que le montage écrit dans l'exemple.
  assert.match(MAIN, /const MAILLE_EXEMPLE = "region";/);
  assert.match(MAIN, /niveau: MAILLE_EXEMPLE,/);
  // Une maille hors carte demanderait `maille=` en plus, que l'exemple n'écrit
  // pas : la fiche resterait muette au rechargement.
  assert.equal(lien.searchParams.get("maille"), null);
});

test("arrivé sur ce lien, la sélection ouvre la fiche", () => {
  // Le dernier maillon : la sélection lue dans l'adresse est ce que `peindre`
  // ouvre, et `montrerFiche` charge le lot du territoire avant de peindre.
  assert.match(MAIN, /if \(etat\.selection\) \{\s*await montrerFiche\(etat\.selection\);/);
  assert.match(MAIN, /async function montrerFiche[^}]*chargerLotsNecessaires\(niveau, \[code\]\)/s);
  // La maille explicite du lien n'est pas écrasée par le cadrage d'ouverture :
  // `niveauAuto` est faux dès que l'adresse nomme une maille.
  assert.match(MAIN, /niveauAuto: !p\.get\("niveau"\),/);
});

/* --------------------------------------------------------------------------
 * Ce que le montage n'écrit pas
 * ----------------------------------------------------------------------- */

test("les trois séries de l'exemple sont des agrégats en euros, jamais un par-habitant", () => {
  const bloc = MAIN.slice(
    MAIN.indexOf("const CHIFFRES_EXEMPLE = ["),
    MAIN.indexOf("const MAILLE_EXEMPLE"),
  );
  assert.ok(bloc.length > 100, "CHIFFRES_EXEMPLE introuvable");
  for (const id of ["ofgl_recettes_fonctionnement", "ofgl_depenses_fonctionnement", "ofgl_encours_dette"]) {
    assert.ok(bloc.includes(id), id);
  }
  // Le montage ne fabrique aucun ratio : il passe la valeur publiée et son
  // unité déclarée, et `formater` fait le reste — sans dénominateur.
  const construction = MAIN.slice(
    MAIN.indexOf("function exemplesTerritoires"),
    MAIN.indexOf("let accueilPeint"),
  );
  assert.ok(construction.length > 200, "corps d'exemplesTerritoires introuvable");
  assert.doesNotMatch(construction, /population|parHabitant/);
  // L'unité vient du catalogue, jamais d'un repli : sans elle, aucun exemple
  // n'est montrable.
  assert.match(construction, /if \(!indicateur\) return \[\];/);
  assert.match(construction, /unite: indicateur\.unite,/);
});
