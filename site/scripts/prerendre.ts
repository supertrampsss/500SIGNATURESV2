/**
 * Le pré-rendu : une page réelle par analyse, lisible sans JavaScript.
 *
 * `rendu()` et `renduIndex()` (analyse-rendu.ts) sont des fonctions pures :
 * elles prennent une analyse et rendent une chaîne. Ce script n'est qu'un
 * appelant de plus, exécuté après `vite build` plutôt que dans le navigateur —
 * c'est tout ce que le pré-rendu ajoute, sans framework (docs/superpowers,
 * spec « L'arbitre rejouable », §7.1).
 *
 * Exécuté par `node --experimental-strip-types`, PAS par Vite : `import.meta.env`
 * (que Vite injecte au build) n'existe pas ici, donc `src/donnees.ts` — qui le
 * lit à son sommet — ne peut pas être importé comme module d'exécution. Seuls
 * ses types le sont ; les fichiers publiés sont lus ici avec un client `fetch`
 * minimal, à la même URL de base.
 *
 * Réseau indisponible pendant le build : le script ÉCHOUE plutôt que de
 * produire des pages sans catalogue ou sans liens vérifiés. Un build qui
 * publierait des pages en silence, sans avoir pu valider leurs liens de
 * simulateur, serait pire qu'un build qui s'arrête (voir plus bas,
 * `validerLiensSimulateur`).
 */

import { access, readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { rendu, renduIndex, type Analyse } from "../src/analyse-rendu.ts";
import { carteAnalyse, carteReperes, type DonneesAnalyse, type DonneesReperes } from "../src/carte-og.ts";
import { lirePolices, rasteriser } from "./rasteriser.ts";
import { permalien } from "../src/partage.ts";
import { decoder, type Volet, type VoletBareme, type EtatAtelier } from "../src/atelier.ts";
import { BASE_DONNEES, construireVolet } from "../src/simulateur-volets.ts";
import { echapper } from "../src/texte.ts";
import type { Indicateur } from "../src/donnees.ts";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE_SITE = path.resolve(ICI, "..");
const DIST = path.join(RACINE_SITE, "dist");
const DOSSIER_ANALYSES = path.join(RACINE_SITE, "analyses");

/** Même valeur de repli que `src/donnees.ts` — voir `BASE_DONNEES`
 *  (simulateur-volets.ts), qui la porte pour tout ce qui lit hors navigateur. */
const BASE = process.env.VITE_DONNEES_URL ?? BASE_DONNEES;

/* --------------------------------------------------------------------------
 * L'adresse de publication du site.
 * ----------------------------------------------------------------------- */

/**
 * L'adresse que le déploiement vérifie déjà à chaque publication.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI CETTE ADRESSE-LÀ, ET SUR QUELLE PREUVE
 * ─────────────────────────────────────────────────────────────────────────
 * `og:image` et `og:url` doivent être **absolues** : une adresse relative
 * n'est pas résolue par tous les robots, et la carte de lien part alors sans
 * image. Il faut donc un domaine — et un domaine inventé sur une image qui
 * circule serait un faux publié.
 *
 * `deploy.yml` ne donne que `--project-name=plateforme`. **Le déduire du nom
 * du projet donnerait `plateforme.pages.dev`, qui est faux** : Cloudflare a
 * attribué au projet le sous-domaine `plateforme-9sz`. Ce n'est pas une
 * supposition — la dernière étape du même workflow (`python -m plateforme.cors`)
 * rejoue à chaque déploiement la requête du navigateur avec l'en-tête
 * `Origin: https://plateforme-9sz.pages.dev` (défaut de `plateforme/cors.py`)
 * et échoue si le bucket ne l'autorise pas ; le README publie la même adresse.
 * C'est donc l'adresse dont ce dépôt dispose vraiment.
 *
 * Elle reste pour autant un **paramètre**, comme `VITE_DONNEES_URL` ci-dessus :
 * `SITE_URL` la remplace, et `deploy.yml` la pose une seule fois pour le
 * pré-rendu comme pour le contrôle CORS. Le jour où le site prend un domaine
 * propre, une ligne du workflow change — pas une constante enfouie dans un
 * script.
 */
export const ADRESSE_PUBLIEE = "https://plateforme-9sz.pages.dev";

/**
 * L'adresse du site, lue dans l'environnement, sans barre finale.
 *
 * Ce qui n'est pas une origine absolue est **refusé** plutôt que recollé :
 * `SITE_URL=/` ou `SITE_URL=plateforme-9sz.pages.dev` produiraient des
 * `og:image` que les robots ne résolvent pas, c'est-à-dire exactement le défaut
 * que les balises absolues existent pour éviter — et il ne se verrait qu'une
 * fois le lien partagé.
 */
export function adresseSite(env: Record<string, string | undefined>): string {
  const brute = (env.SITE_URL ?? ADRESSE_PUBLIEE).trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d+)?$/.test(brute)) {
    throw new Error(
      `SITE_URL doit être une origine absolue (« https://exemple.fr »), reçu « ${brute} » : ` +
        "une adresse relative dans og:image n'est pas résolue par les robots.",
    );
  }
  return brute;
}

const SITE = adresseSite(process.env);

/**
 * L'adresse telle qu'une carte la peint : l'hôte seul.
 *
 * Le pied d'une carte réserve un tiers de sa largeur à l'adresse. L'URL entière
 * n'y tenait pas et sortait coupée — « https://plateforme-9sz.pages.… » — soit
 * une adresse fausse sur une image qui circule, pour huit caractères de schéma
 * que personne ne lit. C'est aussi la forme que `carte-og.ts` attend : son
 * champ `site` est un hôte, pas un lien.
 */
export const HOTE = new URL(SITE).host;

async function lireJson<T>(url: string): Promise<T> {
  let reponse: Response;
  try {
    reponse = await fetch(url);
  } catch (cause) {
    const racine = cause instanceof Error && cause.cause instanceof Error ? cause.cause : cause;
    const detail = racine instanceof Error ? racine.message : String(racine);
    throw new Error(`${url} injoignable : ${detail}`);
  }
  if (!reponse.ok) throw new Error(`${url} indisponible (${reponse.status})`);
  return (await reponse.json()) as T;
}

/* --------------------------------------------------------------------------
 * Les volets du simulateur, construits à la demande — seulement pour les
 * budgets qu'une analyse référence réellement dans son `simulateur.budget`.
 * ----------------------------------------------------------------------- */

// `construireVolet` vient de simulateur-volets.ts, importé plus haut : ce
// script ne peut pas importer `main.ts` lui-même (il charge MapLibre et appelle
// `demarrer()` au chargement du module, ce qui suppose un DOM), mais il
// construit les mêmes volets que l'atelier interactif et que la fonction
// d'aperçu, avec le même code.

/** Les clés de volet qu'une chaîne encodée référence — même syntaxe que
 *  `decoder()` (atelier.ts) : `<volet>/<code>:<valeur>`, jointes par `,`. */
function clesReferencees(budget: string): string[] {
  const cles = new Set<string>();
  for (const morceau of budget.split(",")) {
    const barre = morceau.indexOf("/");
    if (barre > 0) cles.add(morceau.slice(0, barre));
  }
  return [...cles];
}

/** Vrai si l'état décodé ouvre au moins un réglage — un budget touché, ou une
 *  tranche de barème qui s'écarte de son départ. Un lien qui décode vers un
 *  état vide n'ouvrirait rien : un bouton « Rejouer » mort. */
function ouvreUnReglage(etat: EtatAtelier, volets: readonly Volet[]): boolean {
  for (const table of etat.budgets.values()) {
    if (table.size > 0) return true;
  }
  for (const [cle, taux] of etat.baremes) {
    const volet = volets.find((v): v is VoletBareme => v.genre === "bareme" && v.cle === cle);
    if (!volet) continue;
    for (const [borne, valeur] of taux) {
      if ((volet.depart.get(borne) ?? 0) !== valeur) return true;
    }
  }
  return false;
}

/**
 * Valide chaque lien de simulateur déclaré par une analyse contre le vrai
 * `decoder()`, chargé avec les fichiers publiés. Un lien qui décode vers
 * aucun réglage fait échouer le build — un bouton « Rejouer » qui n'ouvre
 * rien est pire que pas de bouton.
 */
async function validerLiensSimulateur(analyses: readonly Analyse[], racineDonnees: string): Promise<void> {
  const aValider = analyses
    .map((analyse) => ({ analyse, budget: analyse.simulateur.budget }))
    .filter((x) => x.budget !== "");
  if (!aValider.length) return;

  const cles = new Set<string>();
  for (const { budget } of aValider) for (const cle of clesReferencees(budget)) cles.add(cle);

  const volets = await Promise.all(
    [...cles].map((cle) =>
      construireVolet(cle, <T,>(chemin: string) => lireJson<T>(`${racineDonnees}/${chemin}`)),
    ),
  );

  for (const { analyse, budget } of aValider) {
    const etat = decoder(budget, volets);
    if (!ouvreUnReglage(etat, volets)) {
      throw new Error(
        `L'analyse "${analyse.slug}" porte un lien de simulateur qui n'ouvre aucun réglage ` +
          `(simulateur.budget = "${budget}").`,
      );
    }
  }
}

/* --------------------------------------------------------------------------
 * Les images de partage, rasterisées au build.
 *
 * Une par analyse, plus une carte du site qui sert de repli à toute page sans
 * image propre. Les analyses sont celles que `chargerAnalyses` a lues et que
 * le contrôle déterministe (`python -m plateforme.controle_analyses`, avant le
 * build dans deploy.yml) a validées : même flux et même garantie que le
 * pré-rendu HTML — aucune image ne porte un chiffre que le contrôle n'a pas vu.
 * ----------------------------------------------------------------------- */

/** Le chemin, dans le site, de la carte de repli. */
const IMAGE_SITE = "/carte.png";

/** L'unité que le catalogue déclare pour un indicateur, ou `null` quand il ne
 *  le connaît pas — jamais un repli sur « EUR », qui peindrait un taux ou un
 *  effectif en montant. */
function uniteCataloguee(catalogue: readonly Indicateur[], id: string): string | null {
  return catalogue.find((indicateur) => indicateur.id === id)?.unite ?? null;
}

/**
 * Ce qu'une analyse donne à peindre : son titre, son premier chiffre, son cran,
 * sa source et le millésime de ce chiffre.
 *
 * Le premier chiffre, et lui seul : une carte porte au plus trois rangées, et
 * c'est celui que l'étage « express » de la page met en tête (analyse-rendu.ts).
 *
 * Le chiffre des comptes n'est peint **que** si le catalogue déclare son
 * indicateur en euros : `carteAnalyse` le formate en millions d'euros, et un
 * taux passé là deviendrait un montant. Sinon la rangée disparaît — le cran dit
 * le reste, et `carteAnalyse` prévoit ce cas.
 *
 * Le millésime est l'**exercice** du chiffre, pas la date de publication de
 * l'analyse : c'est la date que le lecteur d'une image cherche. Une analyse qui
 * n'en déclare aucun fait rougir le build plutôt que partir avec un millésime
 * plausible — une image circule seule, et une date inventée dessus ne se
 * rattrape pas.
 *
 * La source est `sources[0]`, et **rien d'autre**. `affirmation.source` a tenu
 * ce rôle en repli : c'est la source de la DÉCLARATION mise en cause, pas celle
 * du chiffre des comptes qu'on lui oppose. Peinte sous une rangée intitulée
 * « Chiffre des comptes », à quatre lignes de là, elle attribuerait le chiffre
 * publié à qui l'a contesté — et sur une image qui circule seule, rien ne
 * viendrait le corriger. `analyse-rendu.ts` refuse déjà ce repli pour l'étage
 * « preuve », `citer.ts` pour un nombre copié : la carte n'avait aucune raison
 * de s'en autoriser une exception, et le pied qui la justifiait ne couvre pas
 * la rangée, il la suit.
 *
 * Une analyse sans source fait donc rougir le build. Le cas est **déjà**
 * impossible en amont — `controle_analyses` rejette `sources: []` (« sources :
 * champ obligatoire vide », sortie 1) et `deploy.yml` lance le contrôle avant
 * le build : ce qui suit est une seconde serrure sur la même porte, pas une
 * branche qu'on attend. Une porte à deux serrures vaut mieux qu'une porte dont
 * la seconde ouvre sur autre chose.
 */
export function donneesCarteAnalyse(
  analyse: Analyse,
  catalogue: readonly Indicateur[],
  site: string,
): DonneesAnalyse {
  const chiffre = analyse.chiffres[0];
  if (!chiffre) {
    throw new Error(`L'analyse "${analyse.slug}" ne porte aucun chiffre : rien à peindre sur une carte.`);
  }
  const exercice =
    chiffre.observe?.periode ??
    analyse.chiffres
      .map((autre) => autre.observe?.periode)
      .filter((periode): periode is string => !!periode)
      .sort()
      .pop();
  if (!exercice) {
    throw new Error(
      `L'analyse "${analyse.slug}" ne déclare aucun exercice : sa carte de partage circulerait ` +
        "en affirmant un chiffre sans millésime.",
    );
  }
  const enEuros =
    chiffre.observe !== undefined &&
    uniteCataloguee(catalogue, chiffre.observe.indicateur) === "EUR";
  // La provenance déclarée par l'analyse elle-même — la même que l'étage
  // « preuve » de la page cite (analyse-rendu.ts), jamais un champ du
  // catalogue que le rendu ne peut pas vérifier, et jamais la source de la
  // déclaration mise en cause (voir la docstring).
  const source = analyse.sources[0];
  if (!source) {
    throw new Error(
      `L'analyse "${analyse.slug}" ne déclare aucune source : sa carte de partage circulerait ` +
        "en attribuant le chiffre des comptes à qui l'a contesté.",
    );
  }
  return {
    titre: analyse.titre,
    dit: chiffre.dit,
    observe: enEuros ? chiffre.observe!.valeur : null,
    // Ce que ce chiffre-là désigne, dans les mots de l'analyse. La page en
    // dispose de plusieurs façons ; l'image n'a que cette phrase pour dire
    // lequel des chiffres publiés elle montre.
    lecture: chiffre.lecture,
    cran: analyse.verdict.cran,
    source: { titre: source.titre, millesime: exercice },
    site,
  };
}

/**
 * La carte du site : ce que voit un lecteur à qui l'on partage une page qui n'a
 * pas d'image propre.
 *
 * Rien n'y est inventé. Le titre est celui que le gabarit porte déjà — les mots
 * du site, pas une accroche écrite pour l'occasion. La source est le fichier
 * d'indicateurs que ce build vient de lire, et sa date la **version** de
 * publication qu'il a lue.
 *
 * « Version », et pas « millésime » : cette carte ne peint aucun chiffre, donc
 * aucun exercice. Ce qui la date est la publication dont elle parle, et
 * « millésime 2026-08-11T0807 » aurait dit sur cette image le mot que la carte
 * d'à côté emploie pour l'exercice 2025 d'une ligne de comptes.
 *
 * La ligne d'unité ne dit **pas** « Montants en millions d'euros » : cette
 * carte ne peint aucun montant, et annoncer une unité qu'aucun nombre ne porte
 * serait faux — c'est la règle que `carteFiche` applique déjà quand aucun de
 * ses chiffres n'est en euros. Elle dit ce que sont les données du site, dans
 * les mots que le sous-titre de `index.html` emploie déjà — recopiés, faute
 * d'une balise qui les porte comme le `<title>` porte le titre.
 *
 * La nature empruntée est celle du repère, la seule des cinq qui porte un titre
 * seul, sans corps. Le chapeau lira donc « Repère » — écart consigné dans le
 * rapport de la tâche : `carte-og.ts` publie cinq natures d'objet partageable,
 * et le site lui-même n'en est pas une.
 */
export function donneesCarteSite(titreSite: string, version: string, site: string): DonneesReperes {
  return {
    titre: titreSite,
    unite: "Données officielles, territoire par territoire",
    source: { titre: "Indicateurs publiés", millesime: version, datation: "version" },
    site,
  };
}

/** Le titre du gabarit — celui que Vite a construit. Une balise `<title>`
 *  renommée fait rougir ici plutôt que de peindre une carte sans titre. */
export function titreDuGabarit(shell: string): string {
  const titre = shell.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
  if (!titre) throw new Error("Le gabarit ne porte pas de <title> : la carte du site n'a rien à peindre.");
  return titre;
}

/** La description du gabarit : les mots par lesquels le site se présente déjà.
 *  L'attribut est écrit sur plusieurs lignes dans `index.html`, d'où le motif
 *  qui traverse les retours. */
export function descriptionDuGabarit(shell: string): string {
  const trouvee = shell.match(/<meta\s+name="description"[\s\S]*?content="([^"]*)"/)?.[1]?.trim();
  if (!trouvee) throw new Error("Le gabarit ne porte pas de description : sa carte de lien n'aurait rien à dire.");
  return trouvee;
}

/**
 * Écrit les images : une par analyse, plus la carte du site.
 *
 * La racine est un paramètre pour que le test écrive ailleurs que dans `dist` —
 * et qu'il éprouve ce chemin-ci, celui que le build emprunte, plutôt qu'une
 * rasterisation refaite pour l'occasion. Une carte peinte sans la fonte du
 * dépôt sort muette et de la bonne taille : seul un contrôle sur ce que le
 * build a réellement écrit l'attrape.
 */
export async function ecrireCartes(
  racine: string,
  analyses: readonly Analyse[],
  catalogue: readonly Indicateur[],
  version: string,
  shell: string,
): Promise<void> {
  // Les octets de la fonte, lus une fois : sans eux, resvg peint le fond et
  // pas une lettre, et le PNG sort à la bonne taille, non vide, et faux
  // (scripts/rasteriser.ts).
  const polices = await lirePolices();
  const ecrire = async (dossier: string, svg: string): Promise<void> => {
    await mkdir(dossier, { recursive: true });
    await writeFile(path.join(dossier, "carte.png"), await rasteriser(svg, polices));
  };
  for (const analyse of analyses) {
    await ecrire(
      path.join(racine, "analyses", analyse.slug),
      carteAnalyse(donneesCarteAnalyse(analyse, catalogue, HOTE)),
    );
  }
  await ecrire(racine, carteReperes(donneesCarteSite(titreDuGabarit(shell), version, HOTE)));
}

/* --------------------------------------------------------------------------
 * Les scénarios de référence : le budget voté, et les chiffrages que portent
 * les analyses déjà contrôlées.
 *
 * Écart de spec assumé — à consigner dans le rapport de la tâche 6 : la
 * spec §15.4 dit « le pipeline publie » ce fichier, mais §7.4 pose que les
 * analyses suivent leur flux propre et n'entrent jamais dans l'entrepôt. Les
 * deux ne peuvent pas tenir ensemble : les chiffrages viennent des analyses.
 * Le fichier est donc produit ici, au build, à partir des analyses déjà
 * contrôlées (`chargerAnalyses`, `validerLiensSimulateur`) — même flux, même
 * garantie, et l'entrepôt n'a pas à connaître un objet éditorial.
 * ----------------------------------------------------------------------- */

/** Une entrée du fichier de référence — même forme que celle lue par
 *  `main.ts` (dupliquée, pas partagée : ce script ne peut pas importer
 *  `main.ts`, voir l'en-tête du fichier). */
type EntreeReference = {
  titre: string;
  slug: string | null;
  lien: string | null;
  budget: string;
  contrat: string;
  exercice: string | null;
};

/** Le budget voté, tous réglages à zéro : le premier comparable qu'un
 *  lecteur trouve en ouvrant le simulateur. Ni slug ni lien — rien ne
 *  l'adosse à une analyse — et un exercice `null` : c'est le simulateur, à
 *  l'ouverture, qui sait sur quel millésime il tourne, pas ce fichier écrit
 *  une fois pour toutes au build. */
const ENTREE_NEUTRE: EntreeReference = {
  titre: "Budget voté",
  slug: null,
  lien: null,
  budget: "",
  contrat: "",
  exercice: null,
};

/**
 * Le fichier de référence : l'entrée neutre, plus une entrée par analyse dont
 * `simulateur.budget` porte un réglage. Rien n'est inventé : une analyse sans
 * réglage n'engendre aucune entrée.
 *
 * L'exercice de chaque entrée reste `null` : rien dans le schéma d'une
 * analyse (docs/analyses-schema.md) ne déclare sur quel millésime son réglage
 * de simulateur a été construit — `chiffres[].observe.periode` documente les
 * chiffres cités, pas le réglage lui-même, et rien ne relie fiablement l'un à
 * l'autre. Un exercice plausible mais faux serait pire qu'un exercice
 * manquant.
 */
function entreesReference(analyses: readonly Analyse[]): EntreeReference[] {
  const depuisAnalyses = analyses
    .filter((a) => a.simulateur.budget !== "")
    .map((a) => ({
      titre: a.titre,
      slug: a.slug,
      lien: `/analyses/${a.slug}/`,
      budget: a.simulateur.budget,
      contrat: a.simulateur.contrat,
      exercice: null,
    }));
  return [ENTREE_NEUTRE, ...depuisAnalyses];
}

async function ecrireScenariosReference(analyses: readonly Analyse[]): Promise<void> {
  const dossier = path.join(DIST, "simulateur");
  await mkdir(dossier, { recursive: true });
  await writeFile(
    path.join(dossier, "scenarios-reference.json"),
    JSON.stringify(entreesReference(analyses)),
    "utf8",
  );
}

/* --------------------------------------------------------------------------
 * Le gabarit : le shell construit par Vite, réutilisé pour chaque page.
 * ----------------------------------------------------------------------- */

/** Ce qu'il faut d'une page pour composer sa carte de lien. */
type Partageable = {
  titre: string;
  description: string;
  canonique: string;
  /** Le chemin, dans le site, de l'image de partage de cette page. */
  image: string;
};

type Page = Partageable & { corps: string };

/**
 * L'adresse de référence d'une page, absolue.
 *
 * Une seule expression pour `og:url` et pour `<link rel="canonical">` : ce sont
 * deux façons de dire la même chose, et deux compositions divergeraient. Elle
 * est **absolue** aux deux endroits — `og:url` parce qu'un robot ne résout pas
 * toujours un chemin, et le canonique parce que c'est ce qu'un canonique est :
 * l'adresse unique d'un contenu, celle qui reste juste quand la page est
 * recopiée ailleurs. Le lot 3 posait des balises absolues à côté d'un canonique
 * relatif, hérité — la même page se déclarait alors sous deux adresses.
 */
function adresseCanonique(page: Partageable, site: string): string {
  return `${site}${page.canonique}`;
}

/**
 * Les balises que lisent les robots des plateformes pour composer la carte de
 * lien.
 *
 * `og:url` et `og:image` sont **absolues**, et c'est tout l'objet du paramètre
 * `site` : une adresse relative n'est pas résolue par tous les robots, et le
 * lien part alors sans image — un aperçu vide, qui est pire que pas d'aperçu.
 *
 * `og:` s'écrit en `property` (RDFa, ce qu'Open Graph demande) et `twitter:` en
 * `name` : recopier `property` partout est le raccourci habituel, et la carte
 * de X n'est plus lue par les validateurs stricts.
 */
function balisesPartage(page: Partageable, site: string): string {
  const og: [string, string][] = [
    ["og:title", page.titre],
    ["og:description", page.description],
    ["og:url", adresseCanonique(page, site)],
    ["og:image", `${site}${page.image}`],
  ];
  return (
    og.map(([nom, valeur]) => `  <meta property="${nom}" content="${echapper(valeur)}" />\n`).join("") +
    // La carte large : c'est le format des images de partage du site, 1200 × 630
    // (carte-og.ts). En `summary`, X rognerait la carte au carré, sur le titre.
    `  <meta name="twitter:card" content="summary_large_image" />\n`
  );
}

/** Pose les balises de partage juste avant `</head>`. Un gabarit qui n'en
 *  porterait pas fait rougir ici : une page qui perd ses balises en silence se
 *  partage sans aperçu, et rien d'autre ne le dirait. */
function injecterPartage(html: string, page: Partageable, site: string): string {
  const suivant = html.replace("</head>", () => `${balisesPartage(page, site)}  </head>`);
  if (suivant === html) throw new Error("injecterPartage() : le gabarit ne porte pas de </head>.");
  return suivant;
}

/**
 * Injecte une page dans le shell. `echapper` (texte.ts) échappe `&<>"'` — donc
 * valable aussi bien en contenu de texte (le `<title>`) qu'en valeur
 * d'attribut entre guillemets doubles (`content="…"`, `href="…"`) : les deux
 * contextes sont couverts par le même échappement, jamais par une
 * concaténation brute.
 */
export function injecter(shell: string, page: Page, site: string): string {
  // Remplaçants sous forme de fonction partout, jamais de chaîne : passée en
  // second argument de `replace`, une chaîne de remplacement interprète `$&`,
  // `$1`, `$$`… comme des motifs spéciaux — un titre ou une phrase de verdict
  // qui contiendrait un `$` littéral corromprait alors la page injectée.
  let html = shell;

  // `String.replace` renvoie la chaîne INCHANGÉE quand le motif ne correspond
  // à rien — un `<title>` renommé dans le gabarit ferait ainsi disparaître
  // l'injection en silence, sans qu'aucun test ne le voie puisque la page
  // resterait un HTML valide. `remplacer` fait échouer le build à la place.
  const remplacer = (nom: string, suivant: string): void => {
    if (suivant === html) {
      throw new Error(
        `injecter() : le remplacement "${nom}" n'a rien changé — son motif ne correspond plus au gabarit.`,
      );
    }
    html = suivant;
  };

  remplacer("titre", html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${echapper(page.titre)}</title>`));

  remplacer(
    "description",
    html.replace(
      /<meta\s+name="description"[\s\S]*?\/>/,
      () => `<meta name="description" content="${echapper(page.description)}" />`,
    ),
  );

  remplacer(
    "canonique",
    html.replace(
      "</head>",
      () => `  <link rel="canonical" href="${echapper(adresseCanonique(page, site))}" />\n  </head>`,
    ),
  );

  remplacer("partage", injecterPartage(html, page, site));

  remplacer(
    "data-page",
    html.replace(
      /<body([^>]*)>/,
      (_correspondance, attributs: string) => `<body${attributs} data-page="editorial">`,
    ),
  );

  remplacer(
    "corps",
    html.replace(
      /(<main id="contenu">)[\s\S]*?(<\/main>)/,
      (_correspondance, ouverture: string, fermeture: string) => `${ouverture}\n${page.corps}\n${fermeture}`,
    ),
  );

  return html;
}

/* --------------------------------------------------------------------------
 * Le programme.
 * ----------------------------------------------------------------------- */

/** La forme d'un slug valide : ce qui reste identique une fois passé dans une
 *  URL et dans un chemin de fichier. `analyse.slug` sert aux deux sans
 *  contrôle — les analyses sont un contenu du dépôt, pas une saisie externe,
 *  mais rien ne coûte à vérifier la forme plutôt qu'à la supposer. */
const FORME_SLUG = /^[a-z0-9-]+$/;

function validerSlug(analyse: Analyse): void {
  if (!FORME_SLUG.test(analyse.slug)) {
    throw new Error(`L'analyse "${analyse.titre}" porte un slug invalide : "${analyse.slug}".`);
  }
}

async function chargerAnalyses(): Promise<Analyse[]> {
  const fichiers = (await readdir(DOSSIER_ANALYSES)).filter((f) => f.endsWith(".json"));
  const analyses = await Promise.all(
    fichiers.map(async (fichier) => {
      const brut = await readFile(path.join(DOSSIER_ANALYSES, fichier), "utf8");
      return JSON.parse(brut) as Analyse;
    }),
  );
  for (const analyse of analyses) validerSlug(analyse);
  return analyses;
}

async function chargerPublication(): Promise<{
  catalogue: Indicateur[];
  version: string;
  racineDonnees: string;
}> {
  const { version } = await lireJson<{ version: string }>(`${BASE}/data/derniere.json`);
  const racineDonnees = `${BASE}/data/${version}`;
  const catalogue = await lireJson<Indicateur[]>(`${racineDonnees}/indicateurs.json`);
  return { catalogue, version, racineDonnees };
}

async function ecrirePage(dossier: string, html: string): Promise<void> {
  await mkdir(dossier, { recursive: true });
  await writeFile(path.join(dossier, "index.html"), html, "utf8");
}

/** Une page écrite, relue pour ce qu'elle ANNONCE. */
export type PageEcrite = { chemin: string; html: string };

/**
 * Fait échouer le build si une page annonce une image que `dist` ne porte pas
 * — même intention que `validerLiensSimulateur` : une page qui annonce ce
 * qu'elle n'a pas est pire que pas d'annonce du tout. Un `og:image` mort donne
 * une carte de lien vide, et cela ne se voit qu'une fois le lien partagé.
 *
 * Le contrôle lit **le HTML écrit**, pas les données qui ont servi à le
 * produire : c'est la seule façon d'attraper une balise mal composée autant
 * qu'un fichier manquant.
 */
export async function validerImagesAnnoncees(
  racine: string,
  pages: readonly PageEcrite[],
  site: string,
): Promise<void> {
  const prefixe = `${site}/`;
  for (const { chemin, html } of pages) {
    const annonce = html.match(/<meta property="og:image" content="([^"]*)"/)?.[1];
    if (!annonce) {
      throw new Error(`${chemin} ne porte pas de balise og:image : la page se partagerait sans aperçu.`);
    }
    if (!annonce.startsWith(prefixe)) {
      throw new Error(
        `${chemin} annonce l'image « ${annonce} », qui n'est pas absolue sous ${site} : ` +
          "tous les robots ne résolvent pas une adresse relative.",
      );
    }
    const fichier = path.join(racine, annonce.slice(prefixe.length));
    try {
      await access(fichier);
    } catch {
      throw new Error(
        `${chemin} annonce l'image « ${annonce} », que le build n'a pas écrite (${fichier}) : ` +
          "l'aperçu serait cassé.",
      );
    }
  }
}

async function main(): Promise<void> {
  const shell = await readFile(path.join(DIST, "index.html"), "utf8");
  const analyses = await chargerAnalyses();
  const { catalogue, version, racineDonnees } = await chargerPublication();

  await validerLiensSimulateur(analyses, racineDonnees);
  await ecrireScenariosReference(analyses);
  await ecrireCartes(DIST, analyses, catalogue, version, shell);

  const ecrites: PageEcrite[] = [];
  for (const analyse of analyses) {
    const canonique = `/analyses/${analyse.slug}/`;
    const page: Page = {
      titre: analyse.titre,
      description: analyse.verdict.phrase,
      canonique,
      image: `/analyses/${analyse.slug}/carte.png`,
      // Le permalien que porteront les citations de cette page : le même que
      // `og:url`, composé par `permalien()` plutôt que recollé à la main — la
      // règle du dépôt pour toute adresse qui sort du site.
      corps: rendu(analyse, catalogue, version, permalien(SITE, canonique, {})),
    };
    const html = injecter(shell, page, SITE);
    await ecrirePage(path.join(DIST, "analyses", analyse.slug), html);
    ecrites.push({ chemin: `analyses/${analyse.slug}/index.html`, html });
  }

  const pageIndex: Page = {
    titre: "Analyses — Où va l'argent public",
    description: "Un chiffre couramment cité, opposé au chiffre publié : le verdict, le détail, la preuve.",
    canonique: "/analyses/",
    // L'index n'a pas de chiffre à lui : il porte la carte du site.
    image: IMAGE_SITE,
    corps: renduIndex(analyses),
  };
  const htmlIndex = injecter(shell, pageIndex, SITE);
  await ecrirePage(path.join(DIST, "analyses"), htmlIndex);
  ecrites.push({ chemin: "analyses/index.html", html: htmlIndex });

  // Le gabarit lui-même reçoit les balises du site : c'est lui que Cloudflare
  // sert pour l'accueil et pour toutes les vues de l'application. Sans elles,
  // la carte du site serait une image que rien ne désigne — un repli qui ne
  // replie rien. Le corps n'est pas touché : l'application se monte dessus.
  const htmlSite = injecterPartage(
    shell,
    {
      titre: titreDuGabarit(shell),
      description: descriptionDuGabarit(shell),
      canonique: "/",
      image: IMAGE_SITE,
    },
    SITE,
  );
  await writeFile(path.join(DIST, "index.html"), htmlSite, "utf8");
  ecrites.push({ chemin: "index.html", html: htmlSite });

  await validerImagesAnnoncees(DIST, ecrites, SITE);

  console.log(
    `Pré-rendu : ${analyses.length} analyse(s), dist/analyses/index.html, ` +
      `${analyses.length + 1} carte(s) de partage sous ${SITE}.`,
  );
}

// Le pré-rendu ne s'exécute que lancé en programme : `scripts/prerendre.test.ts`
// importe ce module pour éprouver ses fonctions, et un import qui déclencherait
// le build entier — réseau compris — ne serait pas testable.
if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((erreur: unknown) => {
    console.error(erreur instanceof Error ? erreur.message : String(erreur));
    process.exit(1);
  });
}
