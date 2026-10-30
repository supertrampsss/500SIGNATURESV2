/** Contrats du montage : routes, recherche unique et conservation du HTML pré-rendu.
 * MapLibre exige un navigateur ; le montage de main.ts est donc vérifié à la
 * lecture du source, tandis que les routes et le rendu sont exécutés. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { rendu } from "./accueil.ts";
import { CHEMINS, estAccueil, vueDepuisAdresse } from "./routes.ts";

const MAIN = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const PRERENDU = readFileSync(new URL("../scripts/prerendre.ts", import.meta.url), "utf8");
const DONNEES = readFileSync(new URL("./donnees.ts", import.meta.url), "utf8");
const PAGE = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const BALISES = PAGE.replace(/<!--[\s\S]*?-->/g, "");

test("la racine rend l'accueil, et l'accueil n'est pas une vue de l'application", () => {
  assert.equal(estAccueil("/", ""), true);
  assert.equal(estAccueil("", ""), true);
  assert.equal(estAccueil("/accueil/", ""), true);
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
  // Le cadre existe dans la page, vide : c'est le pré-rendu qui l'écrit
  // (`injecterAccueil`, scripts/prerendre.ts), et `peindreAccueil` qui le
  // rafraîchit si la publication a bougé depuis le build.
  assert.match(BALISES, /<div class="vue vue--accueil" id="vue-accueil"><\/div>/);
});

test("le cadre de l'accueil est servi déplié, celui de la carte replié", () => {
  // C'est ce qui décide de ce qu'un lecteur SANS JavaScript reçoit à la racine.
  // Replié, l'accueil que le pré-rendu écrit serait dans le document et servi à
  // personne : la racine se lisait alors sur le squelette de la carte — « Voir
  // sur la carte », « Aucun territoire choisi » — où aucun mot du message
  // principal n'apparaît.
  assert.match(BALISES, /<div class="vue vue--accueil" id="vue-accueil"(?![^>]*\bhidden\b)/);
  // Et la carte part repliée, sans quoi les deux s'afficheraient l'une sous
  // l'autre avant que `basculerVue` ne tranche. Le gabarit sert six adresses :
  // la racine est celle qu'il doit servir juste sans rien exécuter.
  assert.match(BALISES, /<div class="vue vue--territoire" id="vue-territoire" hidden>/);
});

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
  //
  // REPÈRES, DÉTAIL et MÉTHODE ont fusionné dans BILAN le 17 août 2026. Ce que
  // ce test tient n'a pas changé — un lien partagé ne tombe pas sur une page
  // blanche —, mais la destination des trois est désormais la vue qui les a
  // absorbés. C'est exactement ce que la table `ALIAS` existe pour dire.
  for (const [fragment, vue] of [
    ["#carte", "territoire"],
    ["#donnees", "territoire"],
    ["#decryptages", "bilan"],
    ["#analyses", "bilan"],
    ["#methode", "bilan"],
    ["#reperes", "bilan"],
    ["#detail", "bilan"],
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

test("il n'y a qu'un champ de recherche, et l'accueil vise celui-là", () => {
  // Un seul `input` de recherche dans la page, celui de Territoires.
  assert.equal(BALISES.match(/id="recherche"/g)?.length, 1);
  // Et un seul câblage, sur ce champ-là : l'accueil n'en construit pas un
  // second, et n'en câble pas un second.
  assert.equal(MAIN.match(/brancherRecherche\(/g)?.length, 2); // la déclaration et l'appel
  assert.match(
    MAIN,
    /const champRecherche = document\.getElementById\("recherche"\)[\s\S]*?if \(champRecherche instanceof HTMLInputElement && suggestionsRecherche instanceof HTMLUListElement\) \{[\s\S]*?brancherRecherche\(champRecherche, suggestionsRecherche\)/,
  );
});

test("un lien territorial conserve sa sélection et ouvre sa fiche", () => {
  // Le dernier maillon : la sélection lue dans l'adresse est ce que `peindre`
  // ouvre, et `montrerFiche` charge le lot du territoire avant de peindre.
  assert.match(MAIN, /if \(etat\.selection\) \{\s*await montrerFiche\(etat\.selection\);/);
  assert.match(MAIN, /async function montrerFiche[^}]*chargerLotsNecessaires\(niveau, \[code\]\)/s);
  // La maille explicite du lien n'est pas écrasée par le cadrage d'ouverture :
  // `niveauAuto` est faux dès que l'adresse nomme une maille.
  assert.match(MAIN, /niveauAuto: !p\.get\("niveau"\),/);
});

test("l'accueil déjà écrit n'est pas repeint tant que la publication n'a pas bougé", () => {
  const corps = MAIN.slice(
    MAIN.indexOf("async function peindreAccueil"),
    MAIN.indexOf("function basculerVue"),
  );
  assert.ok(corps.length > 200, "corps de peindreAccueil introuvable");
  assert.ok(corps.length < MAIN.length, "la borne ne suit pas le point de départ");
  // La comparaison, et l'abandon de la peinture qui la suit.
  assert.match(corps, /cadre\.dataset\.publication === donnees\.version\(\)/);
  assert.match(corps, /accueilPeint = true;\s*return;/);
  // Les comptes d'une nouvelle publication viennent du lot national.
  assert.match(corps, /donnees\.territoires\("pays", "tous"\)/);
});

test("les deux côtés nomment le même attribut, et la même version", () => {
  // Le pré-rendu écrit `data-publication`, le navigateur lit `dataset.publication` :
  // deux noms qui se désaccorderaient feraient repeindre à chaque chargement,
  // sans qu'aucun test ne le voie — la page resterait juste, et changerait sous
  // les yeux du lecteur.
  assert.match(PRERENDU, /data-publication="\$\{echapper\(version\)\}"/);
  assert.match(MAIN, /cadre\.dataset\.publication/);
  // Et la version comparée est le même champ du même fichier des deux côtés :
  // `version` de `derniere.json`. Comparer à `Manifeste.version` ferait dépendre
  // cet accord d'une égalité entre deux fichiers que rien n'oblige à rester
  // égaux.
  assert.match(PRERENDU, /lireJson<\{ version: string \}>\(`\$\{BASE\}\/data\/derniere\.json`\)/);
  assert.match(DONNEES, /fetch\(`\$\{BASE\}\/data\/derniere\.json`\)/);
  assert.match(DONNEES, /versionLue = donnees\.version;/);
  assert.match(DONNEES, /export const version = \(\) => versionLue;/);
});

test("la porte Ville rejoint la recherche existante sans créer un autre champ", () => {
  const accueil = rendu({});
  assert.match(accueil, /href="\/territoire\/"/);
  assert.doesNotMatch(accueil, /<input\b/);
  assert.match(BALISES, /id="vue-territoire"[\s\S]*id="recherche"/);
});

test("le montage attend la publication avant de lire les comptes nationaux", () => {
  const montage = MAIN.slice(MAIN.indexOf("async function peindreAccueil"), MAIN.indexOf("function basculerVue"));
  const attente = montage.indexOf("await publiee;");
  const comptes = montage.indexOf('donnees.territoires("pays", "tous")');
  assert.ok(attente >= 0 && comptes > attente);
});
