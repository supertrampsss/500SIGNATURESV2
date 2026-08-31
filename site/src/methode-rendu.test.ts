/**
 * La grille de verdicts est du texte de référence, pas un calcul : elle rend
 * public ce que `docs/analyses-schema.md` documente en prose et que le
 * contrôle déterministe (`pipeline/plateforme/controle_analyses.py`) applique
 * en code. Un désaccord entre la page et le contrôle serait pire qu'une page
 * absente — donc le test qui suit ne recopie pas les trois listes fermées
 * (`CRANS`, `CONFUSIONS`, `REGISTRES`) à la main : il les lit dans le fichier
 * Python lui-même et les compare, champ par champ, à ce que la grille rend.
 * Une copie tapée dans ce fichier de test aurait pu diverger du contrôle sans
 * qu'aucun test ne le remarque ; lire le fichier ne le peut pas.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { Jeu } from "./donnees.ts";
import { formater } from "./echelle.ts";
import { renduGrille, renduMethode, renduRegistre, renduSources, renduSourcesEtMethode, TITRES_METHODE } from "./methode-rendu.ts";
import type { FicheSource } from "./registre-sources.ts";

/** Une des trois listes fermées de `controle_analyses.py`, lue dans le
 *  fichier Python lui-même — jamais recopiée. `nomVariable` doit être ancré
 *  en début de ligne (`^NOM = {`) pour ne pas confondre `REGISTRES` avec
 *  `REGISTRES_A_SOURCER` ou `REGISTRES_OBSERVE_INTERDIT`, qui partagent le
 *  même préfixe. */
function ensemblePython(nomVariable: string): Set<string> {
  const source = readFileSync(
    new URL("../../pipeline/plateforme/controle_analyses.py", import.meta.url),
    "utf8",
  );
  const motif = new RegExp(`^${nomVariable} = \\{([\\s\\S]*?)\\}`, "m");
  const bloc = source.match(motif)?.[1];
  if (!bloc) {
    throw new Error(
      `Bloc Python "${nomVariable}" introuvable dans controle_analyses.py — le contrôle a changé de forme.`,
    );
  }
  return new Set([...bloc.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]!));
}

/** Les identifiants `<code>…</code>` rendus dans un conteneur de la grille —
 *  la même grille que `renduGrille()` publie, jamais une recopie de sa
 *  structure interne. */
function ensembleGrille(html: string, motifConteneur: RegExp): Set<string> {
  const conteneur = html.match(motifConteneur)?.[0];
  if (!conteneur) throw new Error(`Conteneur "${motifConteneur}" introuvable dans la grille rendue.`);
  return new Set([...conteneur.matchAll(/<code>([a-z_]+)<\/code>/g)].map((m) => m[1]!));
}

test("les crans de la grille sont exactement CRANS de controle_analyses.py (finding F)", () => {
  const html = renduGrille();
  const rendus = ensembleGrille(html, /<dl class="methode-grille__crans">[\s\S]*?<\/dl>/);
  assert.deepEqual([...rendus].sort(), [...ensemblePython("CRANS")].sort());
});

test("les confusions de la grille sont exactement CONFUSIONS de controle_analyses.py (finding F)", () => {
  const html = renduGrille();
  const rendues = ensembleGrille(html, /<dl class="methode-grille__confusions">[\s\S]*?<\/dl>/);
  assert.deepEqual([...rendues].sort(), [...ensemblePython("CONFUSIONS")].sort());
});

test("les registres de la grille sont exactement REGISTRES de controle_analyses.py (finding F)", () => {
  // L'« Opinion » de la grille (septième point de la spec) n'a pas de valeur
  // dans `Registre` ni dans `REGISTRES` : elle est rendue en prose, sans
  // `<code>`, donc absente des deux ensembles comparés ici — voir le
  // commentaire sur `REGISTRES_INFO` dans methode-rendu.ts.
  const html = renduGrille();
  const rendus = ensembleGrille(html, /<ol class="methode-grille__registres">[\s\S]*?<\/ol>/);
  assert.deepEqual([...rendus].sort(), [...ensemblePython("REGISTRES")].sort());
});

test("les trois crans figurent avec leur formulation exacte", () => {
  const html = renduGrille();
  assert.match(html, /exact/);
  assert.match(html, /« Le chiffre est celui des comptes »/);
  assert.match(html, /hors_perimetre/);
  assert.match(html, /« Le chiffre existe, mais pas pour ce qu'il désigne »/);
  assert.match(html, /introuvable/);
  assert.match(html, /« Aucune ligne publiée ne porte ce montant »/);
});

test("aucun cran ne porte de jugement — la page le dit explicitement", () => {
  const html = renduGrille();
  assert.match(html, /trompeur/i);
  assert.match(html, /mensonger/i);
  assert.match(html, /exagéré/i);
  assert.match(html, /compare deux nombres et nomme ce qui les sépare/);
});

test("les neuf confusions figurent, chacune avec ce qu'elle désigne", () => {
  const html = renduGrille();
  const confusions = [
    "ae_cp",
    "brut_net",
    "vote_execute",
    "stock_flux",
    "etat_apu",
    "annuel_cumule",
    "perimetre_geographique",
    "gros_detail",
    "panier_partiel",
  ];
  for (const confusion of confusions) {
    assert.match(html, new RegExp(confusion), `${confusion} absente de la grille`);
  }
  // Chaque confusion nomme ce qu'elle désigne, pas seulement son identifiant :
  // un lecteur qui ne connaît pas le vocabulaire du schéma doit s'y retrouver.
  assert.match(html, /autorisations d.engagement/i);
  assert.match(html, /brut.*net/i);
  assert.match(html, /voté.*exécuté/i);
  assert.match(html, /stock.*flux/i);
  assert.match(html, /administrations publiques/i);
  assert.match(html, /cumul/i);
  assert.match(html, /territoriaux|géographiques/i);
  assert.match(html, /prix de gros.*facture de détail/i);
  assert.match(html, /sous-panier.*dépense totale/i);
});

test("le cran hors_perimetre est rattaché aux neuf confusions", () => {
  const html = renduGrille();
  assert.match(html, /hors_perimetre[\s\S]{0,400}(ae_cp|Les neuf confusions)/i);
});

test("les sept registres figurent, et le septième dit que l'opinion n'existe pas", () => {
  const html = renduGrille();
  const registres = [
    "fait_comptable",
    "donnee_officielle",
    "resultat_simulation",
    "estimation_externe",
    "hypothese",
    "interpretation",
  ];
  for (const registre of registres) {
    assert.match(html, new RegExp(registre), `${registre} absent de la grille`);
  }
  assert.match(html, /opinion/i);
  assert.match(html, /n'existe pas/);
  assert.match(html, /bonne.*mauvaise|mauvaise.*bonne/i);
  assert.match(html, /souhaitable/i);
});

test("le critère de choix des sujets est écrit, sans auteur ni orientation", () => {
  const html = renduGrille();
  assert.match(html, /circule largement/);
  assert.match(html, /touche une ligne/);
  assert.match(html, /(N|n)i l'auteur.*(N|n)i son orientation|orientation.*n'entrent/i);
  assert.match(html, /file des sujets est publique/);
  assert.match(html, /issues du dépôt/);
});

test("le rendu est pur : deux appels produisent la même chaîne", () => {
  assert.equal(renduGrille(), renduGrille());
});

test("le rendu ne prend aucune donnée en entrée", () => {
  assert.equal(renduGrille.length, 0);
});

/* ==========================================================================
 * Les sources
 *
 * Trois jeux **réellement enregistrés** dans le registre versionné du dépôt
 * (`infra/seed/dataset_registry.csv` et `source_registry.csv`), recopiés champ
 * par champ — producteur, titre, licence, adresse. Un test plus bas rouvre ces
 * deux fichiers et vérifie que chacun de ces champs s'y trouve : la règle
 * « aucune source inventée, même en fixture » cesse d'être une intention et
 * devient une assertion. Seule la date d'extraction est propre au test : c'est
 * l'horodatage d'une lecture, pas un millésime publié.
 * ======================================================================= */

const JEUX: Jeu[] = [
  {
    id: "ofgl-communes",
    titre: "Finances des communes (consolidee)",
    producteur: "OFGL",
    licence: "Licence Ouverte 2.0",
    url: "https://data.ofgl.fr/api/explore/v2.1/catalog/datasets/ofgl-base-communes-consolidee/records",
    extraction: "2026-08-10T04:12:00+00:00",
  },
  {
    id: "melodi-filosofi-cc",
    titre: "Filosofi 2 : niveau de vie et pauvreté à la commune",
    producteur: "INSEE",
    licence: "Licence Ouverte 2.0",
    url: "https://api.insee.fr/melodi/data/DS_FILOSOFI_CC",
    extraction: "2026-08-10T04:15:00+00:00",
  },
  {
    id: "ofgl-departements",
    titre: "Finances des départements",
    producteur: "OFGL",
    licence: "Licence Ouverte 2.0",
    url: "https://data.ofgl.fr/api/explore/v2.1/catalog/datasets/ofgl-base-departements-consolidee/records",
    extraction: "2026-08-10T04:13:00+00:00",
  },
];

/** Un fichier du dépôt, lu tel quel. */
function fichier(chemin: string): string {
  return readFileSync(new URL(chemin, import.meta.url), "utf8");
}

test("chaque jeu de la fixture existe dans le registre versionné du dépôt", () => {
  // La règle « ne jamais inventer une source » vaut aussi pour les fixtures :
  // un producteur, un titre ou une adresse inventés ici finiraient par être lus
  // comme la preuve que le rendu fonctionne sur du vrai.
  const jeux = fichier("../../infra/seed/dataset_registry.csv");
  const sources = fichier("../../infra/seed/source_registry.csv");
  for (const jeu of JEUX) {
    assert.ok(jeux.includes(`\n${jeu.id},`), `${jeu.id} absent du registre des jeux`);
    assert.ok(jeux.includes(`,${jeu.titre},`), `titre de ${jeu.id} absent du registre`);
    assert.ok(jeux.includes(`,${jeu.url},`), `adresse de ${jeu.id} absente du registre`);
    assert.ok(sources.includes(`,${jeu.producteur},`), `${jeu.producteur} absent du registre`);
    assert.ok(sources.includes(`,${jeu.licence},`), `licence de ${jeu.id} absente du registre`);
  }
});

test("les producteurs nommés sont exactement ceux des jeux reçus", () => {
  const html = renduSources(JEUX);
  const nommes = [...html.matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) => m[1]);
  // Groupés, et chacun une seule fois : deux jeux de l'OFGL font une entrée.
  assert.deepEqual(nommes, ["OFGL", "INSEE"]);
  // Un producteur du registre que ce manifeste ne porte pas n'apparaît pas :
  // la page nomme ce qui est publié, jamais ce que le dépôt sait faire.
  assert.doesNotMatch(html, /Eurostat|URSSAF|DINUM/);
});

test("la bibliographie est repliée, et son décompte reste lisible fermé", () => {
  // Mesurée au navigateur sur la publication du 18 août 2026, la liste des
  // producteurs faisait 5 210 px pour 19 283 px de page : un quart du bilan de
  // la France était une bibliographie dépliée. Elle reste dans le document —
  // la Licence Ouverte demande de citer les producteurs — mais pliée.
  const html = renduSources(JEUX);
  assert.match(html, /<details class="methode-sources__liste">/);
  // Pliée, pas retirée : la liste est bien à l'intérieur du pli.
  const pli = html.slice(html.indexOf("<details"), html.indexOf("</details>"));
  assert.match(pli, /<dl class="methode-sources__producteurs">/);
  // Et surtout pas `open` : le pli serait décoratif.
  assert.doesNotMatch(html, /<details[^>]+open/);
  // Le résumé dit ce qu'on ouvre. Le décompte est au-dessus du pli, dans
  // l'intro, et repris dans le résumé : fermé, la page dit toujours combien de
  // jeux elle cite.
  assert.match(html, new RegExp(`<summary>[^<]*${JEUX.length} jeux[^<]*</summary>`));
});

test("l'ordre est celui du manifeste : aucun tri, donc aucun palmarès", () => {
  // INSEE arrive après OFGL dans la fixture ; un tri alphabétique l'aurait mis
  // devant, et un tri par nombre de jeux aurait fait un classement des sources.
  const html = renduSources(JEUX);
  assert.ok(html.indexOf("OFGL") < html.indexOf("INSEE"));
});

test("chaque jeu mène à son fichier, avec sa licence et la date de lecture", () => {
  const html = renduSources(JEUX);
  for (const jeu of JEUX) {
    assert.ok(html.includes(`href="${jeu.url}"`), `lien manquant pour ${jeu.id}`);
    assert.ok(html.includes(jeu.titre), `titre manquant pour ${jeu.id}`);
  }
  assert.match(html, /Licence Ouverte 2\.0/);
  assert.match(html, /fichier lu le 10\/08\/2026/);
});

test("aucune adresse n'est écrite dans le module : elles viennent toutes du manifeste", () => {
  // La garantie porteuse de cette page. Une adresse en dur dans le module
  // serait une source que le manifeste ne porte pas — c'est-à-dire une source
  // que personne ne peut vérifier contre les fichiers publiés.
  const module = fichier("./methode-rendu.ts");
  const adresses = module.match(/https?:\/\/[^\s"'`)]+/g) ?? [];
  assert.deepEqual(adresses, []);
  // Et à l'inverse : tout `href` rendu est l'une des adresses reçues.
  const rendus = [...renduSources(JEUX).matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const attendus = new Set(JEUX.map((jeu) => jeu.url));
  for (const href of rendus) assert.ok(attendus.has(href!), `adresse inattendue : ${href}`);
  assert.equal(rendus.length, JEUX.length);
});

test("les décomptes passent par formater, séparateurs compris", () => {
  const html = renduSources(JEUX);
  assert.ok(html.includes(`${formater(JEUX.length, "count", false)} jeux de données`));
  assert.ok(html.includes(`${formater(2, "count", false)} producteurs`));
});

test("un manifeste vide ne rend rien du tout", () => {
  // Un cadre vide en tête de la page des sources se lit comme une panne.
  assert.equal(renduSources([]), "");
});

test("un seul jeu se dit au singulier", () => {
  const html = renduSources([JEUX[0]!]);
  assert.match(html, /1 jeu de données/);
  assert.match(html, /1 producteur\./);
});

test("les champs du manifeste sont échappés", () => {
  const html = renduSources([
    { ...JEUX[0]!, titre: '<script>x</script>', producteur: "A & B" },
  ]);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /A &amp; B/);
});

test("une date d'extraction illisible se rend telle quelle, jamais en « Invalid Date »", () => {
  const html = renduSources([{ ...JEUX[0]!, extraction: "date inconnue" }]);
  assert.doesNotMatch(html, /Invalid Date/);
  assert.match(html, /date inconnue/);
});

test("le rendu des sources est pur : deux appels produisent la même chaîne", () => {
  assert.equal(renduSources(JEUX), renduSources(JEUX));
});

/* ==========================================================================
 * La méthode
 * ======================================================================= */

/** Toute la page : c'est sur elle que portent les garanties de ton, pas sur un
 *  bloc pris à part. */
const PAGE = () => `${renduSources(JEUX)}${renduMethode()}${renduGrille()}`;

test("la méthode dit les deux flux, et que les analyses ne créent aucun chiffre", () => {
  const html = renduMethode();
  assert.match(html, /Les chiffres viennent des\s+fichiers de leurs producteurs/);
  assert.match(html, /Les analyses ne créent aucun chiffre/);
});

test("la méthode nomme le contrôle qui remplace la relecture, et sa commande", () => {
  const html = renduMethode();
  assert.match(html, /décision D11/);
  assert.match(html, /<code>python -m plateforme\.controle_analyses site\/analyses<\/code>/);
  assert.match(html, /avant chaque déploiement et après chaque publication/);
  assert.match(html, /sans tolérance/);
  assert.match(html, /garde contre l'invention/);
});

test("la méthode tient les règles d'affichage du site", () => {
  const html = renduMethode();
  assert.match(html, /millions\s+d'euros/);
  assert.match(html, /milliards\s+d'euros/);
  assert.match(html, /varie en points/);
  assert.match(html, /budgets ne s'additionnent pas/);
});

test("la méthode décrit le site tel qu'il est, pas tel qu'il fut", () => {
  // **Deux affirmations de cette page étaient devenues fausses**, et une page
  // de méthode qui décrit un autre site que celui qu'on lit est pire qu'une
  // page absente : elle donne au lecteur une garantie qu'il peut vérifier
  // fausse en un coup d'œil.
  const html = renduMethode();

  // 1. « Le site ne publie ni score composite, ni classement » — alors que la
  // fiche ouvre sur une note sur 20 et que le classement range par elle. Ce
  // que la phrase protégeait vraiment reste écrit : aucune comparaison d'un
  // échelon à l'autre, aucun indice sans dimension.
  assert.doesNotMatch(html, /ne publie ni score composite/);
  assert.match(html, /note\s+de gestion sur 20/);
  assert.match(html, /jamais d'un échelon à l'autre/);
  // Et ce que la note refuse, dit là où le lecteur vient chercher la méthode.
  assert.match(html, /ne juge ni\s+le niveau de dépense/);
  assert.match(html, /barème est propre\s+à chaque échelon/);

  // 2. « Tous les montants sont en millions d'euros » — alors que
  // `montantLisible` choisit l'échelle sur le montant et écrit « milliards
  // d'euros » en toutes lettres au-delà du millier de millions.
  assert.doesNotMatch(html, /Tous les montants sont en millions/);
  assert.match(html, /en toutes lettres/);
});

test("les intertitres de la page sont exactement la liste fermée du module", () => {
  // La garde structurelle contre la réserve qui s'excuse : les six blocs
  // retirés du site étaient tous annoncés par leur titre. Une section ajoutée
  // à cette page — quelle que soit sa prose — fait échouer ce test.
  const titres = [...PAGE().matchAll(/<h[23][^>]*>([^<]+)<\/h[23]>/g)].map((m) => m[1]!.trim());
  assert.deepEqual([...titres].sort(), [...TITRES_METHODE].sort());
});

test("aucun intertitre n'annonce une lacune", () => {
  // « Ce que ces chiffres ne disent pas », « Pourquoi ce n'est pas suivre son
  // impôt », « Limites » : la forme du titre suffisait à reconnaître ces blocs.
  for (const titre of TITRES_METHODE) {
    assert.doesNotMatch(
      titre,
      /\bne\b|\bpas\b|\bsans\b|limite|précaution|réserve|attention|pourquoi/i,
      `titre défensif : ${titre}`,
    );
  }
});

test("la page parle du site, jamais au lecteur", () => {
  // Une réserve qui s'excuse s'adresse presque toujours à quelqu'un : « gardez
  // à l'esprit », « ne vous fiez pas », « soyez prudent ». Le sujet de chaque
  // phrase de cette page est le site ou son pipeline.
  assert.doesNotMatch(PAGE(), /\bvous\b|\bvotre\b|\bvos\b|gardez|n'oubliez|soyez/i);
});

test("aucune réserve qui s'excuse", () => {
  const html = PAGE();
  assert.doesNotMatch(
    html,
    /ne garantit|ne prétend|ne saurait|fiabilité|inégale?s?\b|à prendre avec|avec (précaution|prudence)|sous réserve|méfi|approximat|imparfait|grossi[èe]r|ces chiffres ne|il convient de/i,
  );
});

test("le rendu de la méthode est pur et ne prend aucune donnée", () => {
  assert.equal(renduMethode(), renduMethode());
  assert.equal(renduMethode.length, 0);
});

test("le bilan ne porte plus le cadre d'attribution et la méthode reste éditoriale", () => {
  const gabarit = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(gabarit, /methode-sources|bilan__attribution/);
  const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
  assert.doesNotMatch(main, /methode-rendu/);
  assert.doesNotMatch(main, /methode-sources|methode-methode|methode-grille/);
});

test("la page Sources et méthode place la méthode avant le registre et garde les ancres des fiches", () => {
  // Ce test échouerait si la page redevenait un registre seul, si l'ordre des
  // deux documents était inversé, ou si l'identifiant de la fiche était perdu :
  // chacun de ces défauts casse un lien profond ou sa promesse éditoriale.
  const fiches: FicheSource[] = [{
    id: "source-essai",
    nom: "Publication d'essai",
    statut: "publie",
    institution: "Institution d'essai",
    url: "https://exemple.test/publication",
    pages: ["/bilan"],
  }];
  const html = renduSourcesEtMethode(JEUX, fiches);
  assert.match(html, /<section class="sources-methode" aria-labelledby="sources-methode-titre">/);
  assert.doesNotMatch(html, /<main\b/);
  assert.match(html, /<h1 id="sources-methode-titre">Sources et méthode<\/h1>/);
  assert.ok(html.indexOf('id="methode"') < html.indexOf('id="registre-sources-titre"'));
  assert.match(html, /id="source-essai"/);
  assert.ok(html.includes(JEUX[0]!.titre));
});

test("la page Sources et méthode descend de h1 à h2 puis h3", () => {
  const html = renduSourcesEtMethode(JEUX, []);
  assert.match(html, /<h1 id="sources-methode-titre">Sources et méthode<\/h1>[\s\S]*<h2>Les sources<\/h2>/);
  assert.match(html, /<h2>La méthode<\/h2>[\s\S]*<h3>Les chiffres, du fichier du producteur au fichier publié<\/h3>/);
  assert.match(html, /<h2>La grille de verdicts<\/h2>[\s\S]*<h3>Le verdict, en trois crans<\/h3>/);
  assert.doesNotMatch(html, /<h1[\s\S]*?<h3>Les sources<\/h3>/);
});

test("la page Sources regroupe les études officielles utilisées par les arbitrages", () => {
  const html = renduSourcesEtMethode(JEUX, []);

  assert.match(html, /id="sources-arbitrages"/);
  assert.match(html, /Études utilisées dans les arbitrages/);
  assert.match(html, /DGFiP/);
  assert.match(html, /DREES/);
  assert.match(html, /OCDE/);
  assert.match(html, /Cour des comptes/);
  assert.match(html, /Assemblée nationale/);
  assert.match(html, /https:\/\/www\.impots\.gouv\.fr\//);
  assert.match(html, /https:\/\/www\.insee\.fr\//);
  assert.match(html, /https:\/\/www\.oecd\.org\//);
});

test("les études officielles ont une liste éditoriale et une ancre dégagée de l'entête", () => {
  const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");

  assert.match(css, /\.methode-sources__arbitrages\s*\{[^}]*scroll-margin-top:\s*var\(--haut-ancre\)/s);
  assert.match(css, /\.methode-sources__arbitrages ul\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /\.methode-sources__arbitrages li\s*\{[^}]*grid-template-columns/s);
  assert.match(css, /@media \(max-width:\s*40rem\)[\s\S]*?\.methode-sources__arbitrages li/s);
});

test("le registre rend recherche filtres et fiches normalisées", () => {
  const fiches: FicheSource[] = [{
    id: "insee-deficit-2025",
    nom: "Déficit public 2025",
    statut: "publie",
    institution: "Insee",
    url: "https://insee.fr/source",
    serie: "deficit",
    millesime: "2025",
    perimetre: "Administrations publiques",
    unite: "EUR",
    formule: "recettes - dépenses",
    verifieLe: "2026-08-21",
    pages: ["/bilan", "/territoire", "/simulateur"],
  }];
  const html = renduRegistre(fiches);
  assert.match(html, /type="search"/);
  assert.match(html, /data-statut="publie"/);
  assert.match(html, /Insee/);
  assert.match(html, /Voir la publication/);
  assert.match(html, /Administrations publiques/);
  assert.match(html, /href="\/bilan"/);
  assert.match(html, /data-contextes="national territoires simulateur"/);
  assert.match(html, /id="registre-sources-contexte"/);
  assert.match(html, />National<\/option>/);
  assert.match(html, />Territoires<\/option>/);
  assert.match(html, />Simulateur<\/option>/);
  assert.match(html, /id="registre-sources-filtres" hidden/);
});
