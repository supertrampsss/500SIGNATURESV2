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

// Le message principal du site vit désormais dans `src/accueil.ts`, la page qui
// le pose à l'écran (spec §8). Il était ici, où la carte de partage du
// simulateur le peint : l'import inverse — l'accueil lisant un script de build
// — aurait fait entrer `node:fs` dans le module graphe du navigateur. Une seule
// rédaction, lue des deux côtés.
import {
  rendu as renduAccueil,
  exemplesTerritoires,
  MAILLE_EXEMPLE,
  MESSAGE_PRINCIPAL,
} from "../src/accueil.ts";
import { rendu, renduIndex, type Analyse } from "../src/analyse-rendu.ts";
import { indicateursDerives } from "../src/derives.ts";
// Les trois rendus de la page MÉTHODE : purs, sans DOM et sans `fetch`, comme
// `rendu()` et `renduAccueil` — c'est ce qui les rend appelables ici autant que
// dans le navigateur (`peindreMethode`, main.ts), avec le même code.
import { renduAttribution } from "../src/methode-rendu.ts";
// Les blocs de la page REPÈRES, purs eux aussi — exactement ceux des
// maquettes validées, un par chapitre plus la paire du chapitre 4. C'est le
// motif du dépôt, « rendu pur, sans DOM : c'est lui qui est testé » : rien
// n'est recomposé ici, ce sont les fonctions que `demarrer()` (main.ts)
// appelle, avec les mêmes fichiers.
import { rendu as renduTenable } from "../src/tenable.ts";
import { rendu as renduRecettesEtat } from "../src/recettes-etat.ts";
import {
  pont as pontPerimetre,
  reperes as reperesOuverture,
  synthese as syntheseOuverture,
} from "../src/ouverture.ts";
import { rendu as renduSecu } from "../src/secu.ts";
import { rendu as renduCentEurosApu } from "../src/cent-euros-apu.ts";
import { rendu as renduFonctions } from "../src/fonctions.ts";
import { rendu as renduEurope } from "../src/europe-comparaison.ts";
import { rendu as renduOuverture } from "../src/ouverture.ts";
import { rendu as renduRedistribution } from "../src/redistribution.ts";
import { renduConclusionsBilan } from "../src/national.ts";
import { carteAnalyse, carteSection, type DonneesAnalyse, type DonneesSection } from "../src/carte-og.ts";
import { lirePolices, rasteriser } from "./rasteriser.ts";
import { IMAGE_SCENARIO } from "../src/apercu-scenario.ts";
import { permalien } from "../src/partage.ts";
import { CHEMINS } from "../src/routes.ts";
import { decoder, type Volet, type VoletBareme, type EtatAtelier } from "../src/atelier.ts";
import { BASE_DONNEES, construireVolet, construireVolets } from "../src/simulateur-volets.ts";
import { echapper } from "../src/texte.ts";
import type {
  BudgetEtat,
  DepensesFiscales,
  Indicateur,
  Jeu,
  Manifeste,
  Territoire,
} from "../src/donnees.ts";

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
 * Chaque budget publié déclare-t-il le cadre qui le date ?
 *
 * `provenances()` (apercu-scenario.ts) refuse de composer un aperçu dès qu'un
 * budget touché n'a ni loi ni exercice — à raison : un cadre approché sur un
 * chiffre qui circule serait un faux. Mais ce refus est **muet**, et il tombe à
 * l'edge, sur des fichiers lus à la requête : une publication qui perdrait
 * `loi` ferait basculer tous les scénarios touchant ce budget vers un aperçu
 * générique, sans qu'aucun test ni aucune étape du déploiement ne le dise.
 *
 * Le build, lui, lit la publication versionnée. Il peut donc constater ce que
 * l'edge ne peut que subir, et rougir — plutôt que de laisser une dégradation
 * silencieuse s'installer sur le seul canal d'un scénario partagé (D-L3-b).
 *
 * Les six volets sont montés, pas seulement ceux qu'une analyse cite : un
 * scénario se partage sans qu'aucune analyse ne le mentionne, et c'est
 * précisément le cas que ce contrôle protège.
 */
async function validerCadresPublies(racineDonnees: string): Promise<void> {
  const volets = await construireVolets(<T,>(chemin: string) =>
    lireJson<T>(`${racineDonnees}/${chemin}`),
  );
  const sansCadre = volets
    .filter((volet) => volet.genre === "budget")
    .filter((volet) => !volet.budget.loi.trim() || !volet.budget.exercice.trim())
    .map((volet) => volet.cle);
  if (sansCadre.length) {
    throw new Error(
      `Ces budgets publiés ne déclarent pas le cadre qui les date (loi, exercice) : ` +
        `${sansCadre.join(", ")}. Tout scénario les touchant serait partagé sans provenance, ` +
        `et son aperçu se tairait sans que rien ne le signale (voir provenances, apercu-scenario.ts).`,
    );
  }
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

/** Le chemin, dans le site, de la carte du site — celle du gabarit, qui sert
 *  l'accueil et toutes les vues de l'application. Ce n'est plus un repli à tout
 *  faire : `/analyses/` et `/simulateur` ont chacun la leur, parce qu'une image
 *  qui annonce autre chose que le titre posé à côté d'elle dessert le lien
 *  qu'elle accompagne. */
const IMAGE_SITE = "/carte.png";

/** L'unité que le catalogue déclare pour un indicateur, ou `null` quand il ne
 *  le connaît pas — jamais un repli sur « EUR », qui peindrait un taux ou un
 *  effectif en montant. */
function uniteCataloguee(catalogue: readonly Indicateur[], id: string): string | null {
  return catalogue.find((indicateur) => indicateur.id === id)?.unite ?? null;
}

/**
 * Ce qu'une analyse donne à peindre : son titre, les chiffres publiés qu'elle
 * oppose, son cran, sa source et leur millésime.
 *
 * Le chiffre annoncé est celui du premier chiffre — celui que l'étage
 * « express » de la page met en tête (analyse-rendu.ts). Les montants publiés,
 * eux, ne se réduisent pas au premier : ne peindre que lui faisait partir
 * l'image de « deux chiffres publiés, deux sens » avec un seul des deux, sous
 * un verdict privé de ce contre quoi il juge. Ceux que la carte peut peindre
 * l'accompagnent donc (`opposes`, carte-og.ts).
 *
 * Un chiffre des comptes n'est peint **que** si le catalogue déclare son
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
  const observe = enEuros ? chiffre.observe!.valeur : null;
  // Les autres chiffres publiés que l'analyse oppose au premier. Sans le
  // premier peint, il n'y a rien à quoi les opposer : la carte reste celle
  // d'un chiffre unique, comme avant.
  //
  // Deux conditions, et la seconde n'est pas la même que la première : le
  // catalogue doit déclarer l'indicateur en euros — sinon un taux deviendrait
  // un montant — ET le chiffre doit porter l'EXERCICE que le pied annonce.
  // La carte ne peint qu'un millésime ; un montant d'un autre exercice y
  // serait daté faux, sur une image qui circule seule.
  //
  // Deux au plus : la bande du corps porte alors cinq rangées — le chiffre
  // annoncé, trois montants publiés, le cran — et `ordonnees()` y resserre le
  // pas à 44. Une de plus le descendrait sous le corps de la valeur.
  const opposes =
    observe === null
      ? []
      : analyse.chiffres
          .slice(1)
          .filter(
            (autre) =>
              autre.observe !== undefined &&
              autre.observe.periode === exercice &&
              uniteCataloguee(catalogue, autre.observe.indicateur) === "EUR",
          )
          .slice(0, 2)
          .map((autre) => ({ valeur: autre.observe!.valeur, lecture: autre.lecture }));
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
    observe,
    // Ce que ce chiffre-là désigne, dans les mots de l'analyse. La page en
    // dispose de plusieurs façons ; l'image n'a que cette phrase pour dire
    // lequel des chiffres publiés elle montre.
    lecture: chiffre.lecture,
    opposes,
    cran: analyse.verdict.cran,
    source: { titre: source.titre, millesime: exercice },
    site,
  };
}

/**
 * La carte d'une page du site — l'accueil, le simulateur, l'index des analyses.
 *
 * Rien n'y est inventé. Le titre et la phrase sont ceux que la page porte
 * déjà : les mots du site, jamais une accroche écrite pour l'occasion. La
 * source est le fichier d'indicateurs que ce build vient de lire, et sa date la
 * **version** de publication qu'il a lue.
 *
 * « Version », et pas « millésime » : ces cartes ne peignent aucun chiffre,
 * donc aucun exercice. Ce qui les date est la publication dont elles parlent,
 * et « millésime 2026-08-11T0807 » aurait dit sur ces images le mot que la
 * carte d'à côté emploie pour l'exercice 2025 d'une ligne de comptes.
 *
 * La nature est la **sixième** de `carte-og.ts`, et elle a été ajoutée pour
 * elles : les cinq premières sont des natures d'objet partageable — analyse,
 * scénario, comparaison, fiche, repère — et une page du site n'en est pas un.
 * La carte du site empruntait faute de mieux celle du repère, et partait donc
 * avec le chapeau « Repère », y compris sous le titre d'un scénario partagé.
 */
export function donneesCarteSection(
  nature: string,
  titre: string,
  phrase: string,
  version: string,
  site: string,
): DonneesSection {
  return {
    nature,
    titre,
    phrase,
    // La publication que ce build a lue : c'est d'elle que vient tout ce que
    // ces pages montrent, et c'est la seule provenance qu'une carte de section
    // puisse nommer sans rien inventer.
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
 * La marque du site : le `<h1>` de l'en-tête, « Où va l'argent public ».
 *
 * C'est le titre des cartes de section qui ne décrivent pas une page
 * pré-rendue — l'index des analyses, le simulateur. Ce que ces images-là nomment
 * est le site, pas la vue qu'on y ouvre : une carte de scénario partagé
 * intitulée « carte des finances locales » démentait le lien qu'elle
 * accompagnait, et c'est ce titre-ci qui a fermé ce défaut.
 *
 * Le `<title>` du gabarit dit désormais la même chose, pour la même raison — il
 * vaut pour cinq adresses, dont quatre ne sont pas la carte — et un test les tient
 * accordés (prerendre.test.ts). Les deux lectures restent séparées parce que
 * les deux endroits le sont : l'onglet et l'en-tête.
 */
export function marqueDuGabarit(shell: string): string {
  const marque = shell
    .match(/<div class="entete__marque">[\s\S]*?<h1>([\s\S]*?)<\/h1>/)?.[1]
    ?.trim();
  if (!marque) throw new Error("Le gabarit ne porte pas de marque : une carte de section n'a rien à peindre.");
  return marque;
}

/**
 * Les mots de l'index des analyses, écrits une fois.
 *
 * La page les porte en `<title>` et en description, son image les peint : deux
 * rédactions du même écran finiraient par en dire deux choses, et c'est
 * exactement le défaut que ce lot vient de corriger sur la carte du site.
 */
const PAGE_ANALYSES = {
  titre: "Analyses — Où va l'argent public",
  description: "Un chiffre couramment cité, opposé au chiffre publié : le verdict, le détail, la preuve.",
};

/**
 * Les mots de la page BILAN, écrits une fois.
 *
 * BILAN a absorbé REPÈRES, DÉTAIL et MÉTHODE le 17 août 2026 : quatre onglets
 * disaient « parcourez les données » et personne ne savait lequel ouvrir. La
 * description énumère ce que la page rend, dans l'ordre où elle le pose, et
 * rien de plus : aucune accroche écrite pour l'occasion, aucune réserve.
 *
 * Elle ne dit PAS l'unité des montants, et ce n'est pas un oubli. Cette phrase
 * est lue deux fois — en `<meta name="description">` et comme phrase de la
 * carte de partage — et une carte de section ne peint aucun chiffre :
 * `carteSection` (carte-og.ts) refuse la mention d'unité pour cette raison
 * exacte, « annoncer des millions d'euros sous une image qui n'en porte aucun
 * serait faux ». L'unité se dit là où les nombres sont, dans les légendes des
 * tableaux de la page.
 */
const PAGE_BILAN = {
  titre: "Bilan — Où va l'argent public",
  description:
    "La conjoncture, la dette publique et ses sous-secteurs, la France face à ses voisins " +
    "européens, 100 € du budget de l'État, la dépense publique par fonction, le solde de la " +
    "Sécurité sociale, les niches fiscales, et le classement des territoires.",
};

/**
 * Le chemin de la page BILAN, lu dans `routes.ts` plutôt que recopié.
 *
 * C'est la même table que le plan du site lit (`CHEMINS_DE_VUE`) : le document
 * est donc écrit exactement là où le plan l'annonce, et un chemin renommé
 * demain déplace les deux ensemble. Recopié ici, il aurait fait diverger le
 * plan et le disque — et `validerIndexation` aurait déclaré l'adresse morte.
 */
const CHEMIN_BILAN = CHEMINS.bilan;
const DOSSIER_BILAN = CHEMIN_BILAN.replace(/^\//, "");

/**
 * Les quatre cartes de section, et l'endroit où chacune est servie.
 *
 * Une page qui n'a pas d'objet à montrer porte l'image de sa section — et
 * jamais celle d'une autre. `/simulateur` est le cas qui a rendu la faute
 * visible : un scénario partagé arrivait sous une image intitulée « carte des
 * finances locales », chapeautée « Repère ». La carte du simulateur ne montre
 * aucun chiffre de ce scénario — elle ne peut pas les connaître (D-L3-b) —
 * mais elle ne dément pas son titre.
 *
 * L'adresse de l'image du simulateur vient d'`apercu-scenario.ts`, où la
 * fonction d'edge la lit pour l'annoncer : deux constantes se seraient
 * désaccordées, et un `og:image` mort ne se voit qu'une fois le lien partagé.
 */
export function sections(shell: string): { chemin: string; nature: string; titre: string; phrase: string }[] {
  const marque = marqueDuGabarit(shell);
  return [
    // L'accueil, et toutes les vues de l'application qui partagent le gabarit :
    // le titre et la description que le document porte réellement.
    { chemin: "", nature: "Le site", titre: titreDuGabarit(shell), phrase: descriptionDuGabarit(shell) },
    // L'index des analyses éditoriales. L'onglet ANALYSES a disparu de la barre
    // de navigation le 17 août 2026 — c'était une vue de tableaux, absorbée par
    // BILAN —, mais `/analyses/` est une autre chose : le sommaire des articles
    // que `chargerAnalyses` lit et que `controle_analyses` contrôle. Il reste
    // servi, reste au plan du site, et garde donc sa carte. La lui retirer
    // laissait un `og:image` mort — ce que `validerCartes` a refusé au build.
    { chemin: "analyses", nature: "Analyses", titre: marque, phrase: PAGE_ANALYSES.description },
    // Le simulateur ne déclare aucune phrase qui ne dépende des fichiers
    // publiés : le seul titre qu'il écrit à l'écran compte les budgets qu'il a
    // montés. Celle-ci n'est pas une accroche écrite pour remplir l'image,
    // c'est le message principal du site, arrêté à la conception (spec §8) et
    // que l'accueil pose en tête de page — le simulateur est ce que son dernier
    // mot désigne.
    //
    // Le gabarit porte désormais ce même message en description, et cette carte
    // ne se distingue donc de celle du site que par son chapeau. C'est bien : ce
    // sont deux entrées du même site, chacune à l'adresse que sa page annonce,
    // et non une image empruntée à l'autre.
    {
      chemin: path.dirname(IMAGE_SCENARIO).replace(/^\//, ""),
      nature: "Simulateur",
      titre: marque,
      phrase: MESSAGE_PRINCIPAL,
    },
    // BILAN a son document propre : elle a quitté le lot des adresses que le
    // gabarit sert, et la carte du site annonce l'ACCUEIL — chapeau « Le site »,
    // message principal en phrase. Sous un titre qui annonce la dette, les
    // 100 €, les niches et le classement des territoires, c'est l'accueil
    // qu'on aurait montré.
    {
      chemin: DOSSIER_BILAN,
      nature: "Bilan",
      titre: marque,
      phrase: PAGE_BILAN.description,
    },
  ];
}

/**
 * Écrit les images : une par analyse, plus une par section du site.
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
  for (const section of sections(shell)) {
    await ecrire(
      path.join(racine, section.chemin),
      carteSection(donneesCarteSection(section.nature, section.titre, section.phrase, version, HOTE)),
    );
  }
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

/* --------------------------------------------------------------------------
 * L'accueil, écrit dans le gabarit.
 * ----------------------------------------------------------------------- */

/**
 * Le tirage de l'exemple vivant, au build : le premier de la liste publiée.
 *
 * `tirerTerritoire` (accueil.ts) **reçoit** sa source d'aléa, elle ne l'appelle
 * pas — c'est ce qui rend le bloc éprouvable sur chaque tirage possible. Un
 * pré-rendu doit donc choisir, et ce choix vaut pour tout lecteur qui reçoit la
 * page avant que le paquet n'arrive.
 *
 * Zéro, donc le premier territoire **complet** de la liste, et cette liste sort
 * triée par code (`exemplesTerritoires`, accueil.ts) : le premier code de la
 * maille publiée. Ce n'est pas un choix éditorial — aucun classement, le projet
 * n'en fait aucun, aucune préférence pour une région plutôt qu'une autre, et
 * rien qui dépende de la taille des montants. C'est une règle qu'on peut
 * vérifier sur le fichier publié, ce qu'aucune préférence n'aurait été.
 *
 * Surtout, ce n'est pas un aléa refait à chaque build : deux constructions du
 * même dépôt donneraient alors deux pages, et le diff du site deviendrait
 * illisible — on ne saurait plus lire ce qu'un commit a changé.
 */
export const ALEA_PRERENDU = 0;

/**
 * L'accueil, composé sur la publication que ce build a lue.
 *
 * Le même appel que le navigateur fait (`peindreAccueil`, main.ts), avec les
 * mêmes données et la même fonction : `rendu()` est pure, et c'est tout ce que
 * le pré-rendu ajoute ici — l'avoir déjà appelée quand la page part.
 *
 * Y compris les indicateurs calculés, que le navigateur ajoute au catalogue
 * avant de peindre (`indicateursDerives`, derives.ts) : la bande de confiance
 * compte le catalogue qu'elle reçoit, et un pré-rendu qui en compterait un autre
 * ferait sauter le nombre d'un chiffre à l'autre le jour où le navigateur
 * repeint — la même phrase, deux comptes. Faut-il compter comme « publié » un
 * indicateur que le site calcule ? C'est une question éditoriale, et elle ne se
 * tranche pas en passant, dans un script de build : elle se tranche à un seul
 * endroit, pour les deux côtés.
 *
 * Ce catalogue-là ne sert qu'ici : les pages d'analyse reçoivent le catalogue
 * publié, tel qu'elles le recevaient.
 */
export function corpsAccueil(
  analyses: readonly Analyse[],
  catalogue: Indicateur[],
  regions: Record<string, Territoire>,
  producteurs: readonly string[],
): string {
  const complet = [...catalogue, ...indicateursDerives(catalogue)];
  return renduAccueil({
    analyses,
    catalogue: complet,
    territoires: exemplesTerritoires(regions, complet),
    alea: ALEA_PRERENDU,
    producteurs,
  });
}

/** Le cadre de l'accueil dans le gabarit, tel qu'`index.html` le pose. */
const CADRE_ACCUEIL = /<div class="vue vue--accueil" id="vue-accueil"([^>]*)><\/div>/;

/**
 * Pose l'accueil dans son cadre, avec la version de publication qui l'a écrit.
 *
 * Deux échecs plutôt qu'une page qui ment :
 *
 * 1. **le cadre a disparu** — renommé ou retiré, `String.replace` renverrait le
 *    gabarit inchangé et le build publierait une racine vide sans un mot ;
 * 2. **le cadre est replié** (`hidden`) — l'accueil serait alors écrit dans le
 *    document et servi à personne : ni au lecteur sans JavaScript, ni au robot
 *    qui n'en exécute pas. C'est exactement l'état d'avant ce pré-rendu, et il
 *    reviendrait sans que rien ne le dise.
 *
 * `data-publication` est ce qui accorde le serveur et le navigateur :
 * `peindreAccueil` (main.ts) compare cette valeur à la version qu'il lit dans
 * `derniere.json` et **ne repeint pas** tant qu'elles sont les mêmes. Sans elle,
 * le client réécrirait l'accueil une seconde après l'ouverture, avec un autre
 * tirage — l'exemple changerait sous les yeux du lecteur.
 */
export function injecterAccueil(shell: string, corps: string, version: string): string {
  const cadre = shell.match(CADRE_ACCUEIL);
  if (!cadre) {
    throw new Error(
      "injecterAccueil() : le gabarit ne porte plus le cadre de l'accueil " +
        "(<div id=\"vue-accueil\">) — la racine partirait vide.",
    );
  }
  if (/\bhidden\b/.test(cadre[1]!)) {
    throw new Error(
      "injecterAccueil() : le cadre de l'accueil est replié (hidden) — la page serait écrite " +
        "dans le document et servie à personne, ni au lecteur sans JavaScript ni au robot qui " +
        "n'en exécute pas.",
    );
  }
  return shell.replace(
    CADRE_ACCUEIL,
    () =>
      `<div class="vue vue--accueil" id="vue-accueil" data-publication="${echapper(version)}">\n` +
      `${corps}\n</div>`,
  );
}

/* --------------------------------------------------------------------------
 * La page MÉTHODE, écrite dans son cadre.
 *
 * C'est la page vers laquelle la bande de confiance de l'accueil renvoie. Servie
 * par le gabarit, elle partait vide : ni ses sources, ni sa méthode, ni sa
 * grille n'existaient dans le document, et un robot — ou un lecteur dont le
 * paquet n'arrive pas — trouvait au bout de ce lien de confiance un `<main>`
 * qui ne portait que l'accueil. Un lien de confiance qui ouvre une page vide
 * coûte plus que pas de lien.
 *
 * Elle se pré-rend parce que son contenu se calcule au build, entièrement :
 * `renduMethode()` et `renduGrille()` sont du texte de référence sans donnée
 * d'entrée, et `renduSources()` ne lit que le manifeste — le même fichier que
 * `chargerPublication` lit déjà. Rien n'y dépend d'un territoire choisi ni d'un
 * état d'atelier.
 *
 * Le document reste celui de l'application, PAS une page éditoriale : la
 * fraîcheur et le journal viennent de deux fichiers publiés que `peindreMethode`
 * (main.ts) va chercher à l'ouverture, et `data-page="editorial"` aurait arrêté
 * le paquet avant. Le pré-rendu remplit donc les trois cadres qu'il sait
 * remplir, replie les deux qu'il ne sait pas, et laisse le navigateur finir.
 * ----------------------------------------------------------------------- */

/**
 * L'ouverture d'un cadre du gabarit, avec son nom de balise et ses attributs.
 *
 * Un identifiant introuvable fait rougir plutôt que de laisser `String.replace`
 * renvoyer le gabarit inchangé — le défaut muet que `remplacer` ferme partout
 * ailleurs dans ce fichier.
 *
 * Le nom de balise est **lu**, pas supposé : les cadres de la méthode sont des
 * `<div>`, ceux de REPÈRES des `<article class="bloc">` et un `<nav>`. Refermer
 * en `</div>` un `<article>` aurait produit un document que le navigateur
 * répare en silence, en déplaçant ce qui suit.
 */
function ouvertureDuCadre(
  html: string,
  id: string,
): { balise: string; nom: string; attributs: string } {
  const trouve = html.match(new RegExp(`<([a-z]+)([^>]*\\sid="${id}"[^>]*)>`));
  if (!trouve) {
    throw new Error(
      `Le gabarit ne porte plus le cadre « ${id} » — la page partirait sans lui.`,
    );
  }
  return { balise: trouve[0], nom: trouve[1]!, attributs: trouve[2]! };
}

/** Écrit un corps dans un cadre du gabarit, qui doit être vide : un cadre déjà
 *  rempli signalerait deux rendus pour un même endroit, et l'un des deux
 *  serait perdu sans un mot. */
function remplirCadre(html: string, id: string, corps: string): string {
  const { balise, nom, attributs } = ouvertureDuCadre(html, id);
  const vide = `${balise}</${nom}>`;
  if (!html.includes(vide)) {
    throw new Error(
      `Le cadre « ${id} » du gabarit n'est plus vide — le pré-rendu écrirait par-dessus.`,
    );
  }
  return html.replace(vide, () => `<${nom}${attributs}>\n${corps}\n</${nom}>`);
}

/** Déplie un cadre. Un cadre replié serait écrit dans le document et servi à
 *  personne : ni au lecteur sans JavaScript, ni au robot qui n'en exécute pas
 *  — c'est le défaut d'avant ce pré-rendu, et `injecterAccueil` le nomme déjà. */
function deplierCadre(html: string, id: string): string {
  const { balise, nom, attributs } = ouvertureDuCadre(html, id);
  return html.replace(balise, () => `<${nom}${attributs.replace(/\s+hidden\b/, "")}>`);
}

/** Replie un cadre. `.bloc` est un cadre bordé, ombré : laissé déplié et vide,
 *  il se voit comme une case vide — la même règle que `peindreMethode` tient
 *  côté navigateur, où le retour du peintre commande la visibilité. */
function replierCadre(html: string, id: string): string {
  const { balise, nom, attributs } = ouvertureDuCadre(html, id);
  if (/\bhidden\b/.test(attributs)) return html;
  return html.replace(balise, () => `<${nom}${attributs} hidden>`);
}

/**
 * La page MÉTHODE, composée sur le manifeste que ce build a lu.
 *
 * Les mêmes appels que le navigateur fait (`peindreMethode`, main.ts), avec le
 * même manifeste et les mêmes fonctions — c'est tout ce que le pré-rendu ajoute
 * ici : les avoir déjà appelées quand la page part.
 *
 * Pas de `data-publication`, contrairement à l'accueil, et pour une raison
 * précise : l'accueil TIRE un exemple, et un second tirage côté navigateur
 * ferait changer le territoire sous les yeux du lecteur. Ici rien n'est tiré.
 * `renduMethode()` et `renduGrille()` sont constantes, et `renduSources()` rend
 * le manifeste — celui du build au départ, celui du serveur quand le paquet
 * arrive. Repeindre ne déplace donc rien, et quand les deux manifestes diffèrent
 * c'est le plus frais qui doit gagner.
 *
 * L'accueil, lui, est replié : le gabarit le sert déplié pour la racine, et un
 * document de `/methode` qui le porterait déplié montrerait l'accueil au-dessus
 * de la méthode jusqu'à ce que `basculerVue` tranche.
 */
export function injecterMethode(shell: string, jeux: readonly Jeu[]): string {
  const sources = renduAttribution(jeux);
  if (!sources) {
    throw new Error(
      "injecterMethode() : le manifeste ne déclare aucun jeu — la page vers laquelle la bande de " +
        "confiance de l'accueil renvoie partirait sans une seule source.",
    );
  }
  let html = shell;
  // Une seule ligne d'attribution, plus jamais des cadres : le propriétaire
  // les a refusés, vides puis remplis. Le gabarit la sert repliée — l'appli ne
  // la montre donc jamais — et ce document-ci, le seul à la porter, la remplit
  // puis la déplie.
  html = remplirCadre(html, "methode-sources", sources);
  html = deplierCadre(html, "methode-sources");
  // Les deux cadres que le build ne sait pas remplir : `fraicheur.json` et
  // `journal.json` sont publiés, et c'est `peindreMethode` qui va les chercher.
  // Repliés plutôt que laissés vides — voir `replierCadre`.
  // La fraîcheur et le journal des corrections ont disparu avec l'onglet
  // MÉTHODE : ils décrivaient le site, pas les comptes publics. Les sources,
  // elles, restent — la Licence Ouverte impose de citer les producteurs.
  html = deplierCadre(html, "vue-bilan");
  return replierCadre(html, "vue-accueil");
}

/* --------------------------------------------------------------------------
 * La page REPÈRES, écrite dans ses cadres.
 *
 * C'est le dernier écart de pré-rendu du site, et il tenait à une raison
 * technique, pas éditoriale : ses huit blocs étaient peints par des fonctions
 * qui recevaient un `HTMLElement` et le mutaient. Sept d'entre elles rendaient
 * déjà une chaîne (`rendu()`, testée sans DOM) et n'y touchaient qu'ensuite ;
 * la huitième — `afficherNational` — ne rendait rien du tout, et c'est elle
 * seule qui manquait. Ses deux rendus purs extraits, ce chemin-ci n'ajoute
 * qu'une chose : les avoir déjà appelés quand la page part.
 *
 * Le document reste celui de l'application, comme `/methode` et pour la même
 * raison : le paquet doit finir le travail. Le sommaire de la vue se construit
 * sur les blocs réellement peints, les dépliants gardent leur comportement.
 * Tout cela demande un navigateur — et tout cela est un SUPPLÉMENT à ce que
 * le pré-rendu écrit, jamais sa condition.
 * ----------------------------------------------------------------------- */

/**
 * La page REPÈRES, composée sur la publication que ce build a lue.
 *
 * Les mêmes appels que `demarrer()` fait (main.ts), dans le même ordre, avec
 * les mêmes fichiers. Deux fidélités méritent d'être dites, parce qu'elles ne
 * se devinent pas :
 *
 * 1. **Le catalogue est celui du navigateur**, indicateurs calculés compris :
 *    `demarrer()` ajoute `indicateursDerives` AVANT de peindre ces blocs, et
 *    trois d'entre eux filtrent sur « cet indicateur est-il publié ? ». Un
 *    pré-rendu qui lirait le catalogue brut ferait apparaître ou disparaître un
 *    bloc à l'arrivée du paquet.
 *
 * 2. **La liste est celle des maquettes validées, et rien d'autre.** La
 *    première mise en production gardait sept blocs hérités que la maquette ne
 *    montrait pas — conjoncture, pont budgétaire, niches, 100 € de l'État,
 *    fonctions, retraites, Europe — et la page livrée ne ressemblait plus à ce
 *    qui avait été validé. Leurs `rendu()` existent toujours ; aucun n'est
 *    appelé ici tant qu'une maquette ne leur a pas rendu une place.
 *
 * Un bloc dont la source n'est pas publiée est **replié**, jamais laissé vide :
 * `.bloc` est un cadre bordé, ombré, et une case vide se lit comme une panne —
 * la règle que `replierCadre` porte déjà pour la méthode.
 */
export function injecterReperes(
  shell: string,
  pays: Record<string, Territoire>,
  catalogue: Indicateur[],
  niches: DepensesFiscales,
  budget: BudgetEtat,
): string {
  // Les deux fichiers restent lus et passés ici : la signature ne bouge pas à
  // chaque maquette, et le jour où un bloc du budget revient, sa donnée est
  // déjà là. Aucun bloc actuel ne les lit.
  void niches;
  void budget;
  // Les blocs dont `demarrer()` lit le retour pour ouvrir la section
  // nationale — c'est-à-dire TOUS les blocs du gabarit : un chapitre porte
  // exactement les blocs de sa maquette (docstring, point 2). Un cadre oublié
  // ici reste déplié et VIDE dans le document servi, ce qui se lit comme une
  // panne ; le test « 15 quinquies » déduit la liste du gabarit plutôt que de
  // la reprendre à la main, parce qu'une liste écrite à la main ne pousse pas.
  const ouvrants: [string, string][] = [
    ["bloc-ouverture", renduOuverture(pays)],
    ["bloc-recettes-etat", renduRecettesEtat(pays, catalogue)],
    ["bloc-cent-euros-apu", renduCentEurosApu(pays)],
    ["bloc-fonctions", renduFonctions(pays, catalogue)],
    ["bloc-redistribution", renduRedistribution(pays, catalogue)],
    ["bloc-secu", renduSecu(pays, catalogue)],
    ["bloc-dette", renduTenable(pays, catalogue)],
    ["bloc-europe", renduEurope(pays)],
  ];
  if (!ouvrants.some(([, corps]) => corps !== "")) {
    throw new Error(
      "injecterReperes() : aucun bloc national ne s'écrit — la section resterait repliée et la " +
        "page partirait sur ses seules questions, c'est-à-dire exactement l'état d'avant ce pré-rendu.",
    );
  }

  let html = shell;
  for (const [id, corps] of Object.entries(renduConclusionsBilan(pays))) {
    html = remplirCadre(html, `conclusion-france-${id}`, corps);
  }
  for (const [id, corps] of ouvrants) {
    html = corps ? remplirCadre(html, id, corps) : replierCadre(html, id);
  }
  // Le pont entre les chapitres 1 et 2 : la phrase qui fait descendre d'un
  // étage (1 562 milliards pour l'ensemble, 380 pour l'État seul). Sans elle,
  // les deux chiffres d'encaissement se lisaient comme une contradiction.
  // Le gabarit sert le pont `hidden` (le repli SPA ne doit pas montrer un
  // paragraphe vide) : le remplir demande donc aussi de le déplier.
  const pont = pontPerimetre(pays);
  html = pont ? deplierCadre(remplirCadre(html, "pont-perimetre", pont), "pont-perimetre") : html;
  // La synthèse d'ouverture, même règle que le pont : servie repliée par le
  // gabarit, remplie puis dépliée ici pour le seul document de /bilan/.
  const syntheseBilan = syntheseOuverture(pays);
  html = syntheseBilan
    ? deplierCadre(remplirCadre(html, "bilan-synthese", syntheseBilan), "bilan-synthese")
    : html;
  // Les quatre repères d'ouverture, même règle : servis repliés, remplis puis
  // dépliés. Le pré-rendu remplit chaque cadre nommément — un cadre qu'on
  // ajoute au gabarit sans l'ajouter ici reste vide dans le document servi,
  // et ne se peuple qu'une fois l'application montée.
  const reperesBilan = reperesOuverture(pays);
  html = reperesBilan
    ? deplierCadre(remplirCadre(html, "bilan-reperes", reperesBilan), "bilan-reperes")
    : html;
  html = deplierCadre(html, "national");
  html = deplierCadre(html, "vue-bilan");
  // L'accueil replié, pour la raison qu'`injecterMethode` nomme : le gabarit le
  // sert déplié pour la racine, et ce document-ci le montrerait au-dessus des
  // repères jusqu'à ce que `basculerVue` tranche.
  return replierCadre(html, "vue-accueil");
}

/**
 * `String.replace` renvoie la chaîne INCHANGÉE quand le motif ne correspond à
 * rien — un `<title>` renommé dans le gabarit ferait ainsi disparaître
 * l'injection en silence, sans qu'aucun test ne le voie puisque la page
 * resterait un HTML valide. Ceci fait échouer le build à la place.
 */
function remplacer(nom: string, avant: string, apres: string): string {
  if (apres === avant) {
    throw new Error(
      `injecter() : le remplacement "${nom}" n'a rien changé — son motif ne correspond plus au gabarit.`,
    );
  }
  return apres;
}

/**
 * Ce qu'une page ANNONCE : son titre, sa description, sa canonique et ses
 * balises de partage. `echapper` (texte.ts) échappe `&<>"'` — donc valable
 * aussi bien en contenu de texte (le `<title>`) qu'en valeur d'attribut entre
 * guillemets doubles (`content="…"`, `href="…"`) : les deux contextes sont
 * couverts par le même échappement, jamais par une concaténation brute.
 *
 * Séparé du corps parce que deux sortes de pages en ont besoin. Une page
 * éditoriale remplace `<main>` entier (`injecter`, juste dessous) ; une vue
 * pré-rendue, elle, garde le document de l'application et n'écrit que dans son
 * cadre (`injecterMethode`) — mais toutes deux s'annoncent de la même façon, et
 * deux compositions de ces quatre balises auraient fini par en dire deux
 * choses.
 */
export function injecterAnnonce(shell: string, page: Partageable, site: string): string {
  // Remplaçants sous forme de fonction partout, jamais de chaîne : passée en
  // second argument de `replace`, une chaîne de remplacement interprète `$&`,
  // `$1`, `$$`… comme des motifs spéciaux — un titre ou une phrase de verdict
  // qui contiendrait un `$` littéral corromprait alors la page injectée.
  let html = shell;

  html = remplacer(
    "titre",
    html,
    html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${echapper(page.titre)}</title>`),
  );

  html = remplacer(
    "description",
    html,
    html.replace(
      /<meta\s+name="description"[\s\S]*?\/>/,
      () => `<meta name="description" content="${echapper(page.description)}" />`,
    ),
  );

  html = remplacer(
    "canonique",
    html,
    html.replace(
      "</head>",
      () => `  <link rel="canonical" href="${echapper(adresseCanonique(page, site))}" />\n  </head>`,
    ),
  );

  return remplacer("partage", html, injecterPartage(html, page, site));
}

/**
 * Injecte une page éditoriale dans le shell : ce qu'elle annonce, plus son
 * corps à la place de `<main>` entier.
 *
 * `data-page="editorial"` dit au paquet que ce document n'est pas l'application
 * monoécran : `basculerVue` s'arrête là, la carte et le panneau ne sont pas
 * montés, et la recherche de l'en-tête ouvre un territoire en suivant un lien
 * plutôt qu'en peignant un panneau qui n'existe pas (main.ts). Une vue
 * pré-rendue ne le porte PAS — son document reste celui de l'application.
 */
export function injecter(shell: string, page: Page, site: string): string {
  let html = injecterAnnonce(shell, page, site);

  html = remplacer(
    "data-page",
    html,
    html.replace(
      /<body([^>]*)>/,
      (_correspondance, attributs: string) => `<body${attributs} data-page="editorial">`,
    ),
  );

  return remplacer(
    "corps",
    html,
    html.replace(
      /(<main id="contenu">)[\s\S]*?(<\/main>)/,
      (_correspondance, ouverture: string, fermeture: string) => `${ouverture}\n${page.corps}\n${fermeture}`,
    ),
  );
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
  jeux: Jeu[];
  producteurs: string[];
  regions: Record<string, Territoire>;
  pays: Record<string, Territoire>;
  niches: DepensesFiscales;
  budget: BudgetEtat;
}> {
  const { version } = await lireJson<{ version: string }>(`${BASE}/data/derniere.json`);
  const racineDonnees = `${BASE}/data/${version}`;
  const catalogue = await lireJson<Indicateur[]>(`${racineDonnees}/indicateurs.json`);
  // Ce que l'accueil demande en plus du catalogue : les producteurs, qu'il
  // nomme dans sa bande de confiance, et le lot des régions, où il prend son
  // exemple vivant. Ce sont les deux mêmes fichiers que le navigateur charge
  // (`donnees.initialiser` et `donnees.territoires`), aux mêmes adresses — et
  // non un tirage plus court composé pour le build.
  //
  // Le manifeste sert aussi la page MÉTHODE, qui liste les jeux entiers —
  // producteur, titre, licence, date de lecture — et non leurs seuls
  // producteurs. Un seul chargement pour les deux pages : deux lectures du même
  // fichier auraient pu partir sur deux publications.
  const manifeste = await lireJson<Manifeste>(`${racineDonnees}/manifeste.json`);
  const regions = await lireJson<Record<string, Territoire>>(
    `${racineDonnees}/territoires/${MAILLE_EXEMPLE}/tous.json`,
  );
  // Les trois fichiers de la page REPÈRES, aux adresses que `donnees.ts` lit
  // (`territoires`, `depensesFiscales`, `budgetEtat`). `demarrer()` les charge
  // dans deux `try` séparés, pour qu'une publication amputée n'emporte pas la
  // carte avec elle ; ici, ils sont exigés. Ce script échoue plutôt que de
  // publier des pages en silence — c'est la règle de son en-tête, et une page
  // REPÈRES sans repères serait précisément le gabarit qu'elle remplace.
  const pays = await lireJson<Record<string, Territoire>>(
    `${racineDonnees}/territoires/pays/tous.json`,
  );
  const niches = await lireJson<DepensesFiscales>(`${racineDonnees}/depenses-fiscales.json`);
  const budget = await lireJson<BudgetEtat>(`${racineDonnees}/budget-etat.json`);
  return {
    catalogue,
    version,
    racineDonnees,
    jeux: manifeste.jeux,
    producteurs: manifeste.jeux.map((jeu) => jeu.producteur),
    regions,
    pays,
    niches,
    budget,
  };
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

/**
 * L'image que la fonction d'edge annonce pour un scénario partagé, contrôlée
 * elle aussi.
 *
 * Aucune page pré-rendue ne la déclare — c'est `poserApercu` qui la pose, dans
 * le document servi, au moment de la requête : `validerImagesAnnoncees` ne la
 * verrait donc jamais, et un `og:image` mort ne se voit qu'une fois le lien
 * partagé. Même garantie, même échec, sur le seul objet de ce lot qui n'a pas
 * de page.
 */
export async function validerImageDuScenario(racine: string): Promise<void> {
  const fichier = path.join(racine, IMAGE_SCENARIO.replace(/^\//, ""));
  try {
    await access(fichier);
  } catch {
    throw new Error(
      `La fonction d'edge annonce l'image « ${IMAGE_SCENARIO} », que le build n'a pas écrite ` +
        `(${fichier}) : tout scénario partagé partirait avec un aperçu cassé.`,
    );
  }
}

/* --------------------------------------------------------------------------
 * robots.txt et le plan du site.
 * ----------------------------------------------------------------------- */

/** Le plan du site, à l'adresse où les moteurs le cherchent. */
const PLAN_DU_SITE = "sitemap.xml";

/** Les chemins que `routes.ts` déclare, tels quels — sans barre finale ajoutée
 *  ni retirée : c'est la forme que le site écrit dans ses propres liens
 *  (`cheminDeVue`), et une seconde forme de la même adresse serait un doublon
 *  annoncé aux moteurs. */
const CHEMINS_DE_VUE = new Set(Object.values(CHEMINS));

/**
 * Les adresses que le site sert, et rien d'autre.
 *
 * Trois familles, et la liste se déduit entièrement du dépôt : la racine, que
 * l'accueil occupe (D-L4-a) ; les chemins de vues, lus dans `CHEMINS`
 * (routes.ts) plutôt que recopiés — une vue ajoutée demain entre dans le plan
 * sans qu'on y revienne ; l'index éditorial et chaque analyse pré-rendue.
 *
 * Rien n'y est écrit à la main, parce qu'un plan écrit à la main dérive à la
 * première page ajoutée — et une adresse morte dans un plan de site est un
 * signal de mauvaise qualité envoyé aux moteurs.
 */
export function adressesPubliees(analyses: readonly Analyse[]): string[] {
  return [
    "/",
    ...CHEMINS_DE_VUE,
    "/analyses/",
    ...analyses.map((analyse) => `/analyses/${analyse.slug}/`),
  ];
}

/**
 * `robots.txt`, composé sur `site`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI IL N'INTERDIT RIEN, ALORS QUE LE SITE PORTE ENCORE `noindex`
 * ─────────────────────────────────────────────────────────────────────────
 * `index.html` porte `noindex, nofollow` tant que le projet n'est pas annoncé
 * (décision D1), et ce fichier-ci ne le contredit pas : il en est la condition.
 * Un `Disallow: /` empêcherait les robots de **lire** la page, donc de lire la
 * balise qui leur demande de ne pas l'indexer — une adresse découverte par un
 * lien externe pourrait alors figurer dans les résultats sans son contenu,
 * c'est-à-dire exactement ce que la décision D1 veut éviter. C'est la balise
 * qui tient le site hors de l'index ; `robots.txt` la laisse être lue.
 *
 * Ce fichier ne dit donc rien de l'état d'annonce du projet, et c'est
 * volontaire : le jour où le `noindex` tombe (tâche 5), une ligne d'`index.html`
 * change et rien ici ne bouge. Un fichier qui décrirait cet état-là serait un
 * second endroit à corriger, et c'est ainsi que deux fichiers finissent par
 * dire deux choses.
 */
export function robotsDuSite(site: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${site}/${PLAN_DU_SITE}\n`;
}

/**
 * Le plan du site : une adresse absolue par page.
 *
 * Ni `lastmod`, ni `changefreq`, ni `priority`. Rien dans ce build ne date une
 * page — la version de publication date les *données*, pas le document — et
 * une date plausible mais fausse dans un plan de site est un chiffre inventé
 * comme un autre.
 */
export function planDuSite(site: string, adresses: readonly string[]): string {
  const lignes = adresses.map((adresse) => `  <url><loc>${echapper(`${site}${adresse}`)}</loc></url>`);
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${lignes.join("\n")}\n` +
    "</urlset>\n"
  );
}

export async function ecrireIndexation(
  racine: string,
  site: string,
  adresses: readonly string[],
): Promise<void> {
  await writeFile(path.join(racine, "robots.txt"), robotsDuSite(site), "utf8");
  await writeFile(path.join(racine, PLAN_DU_SITE), planDuSite(site, adresses), "utf8");
}

async function existe(fichier: string): Promise<boolean> {
  try {
    await access(fichier);
    return true;
  } catch {
    return false;
  }
}

async function lireOuEchouer(fichier: string, quoi: string): Promise<string> {
  try {
    return await readFile(fichier, "utf8");
  } catch {
    throw new Error(`Le build n'a pas écrit ${quoi} (${fichier}).`);
  }
}

/**
 * Le plan du site dit-il vrai ?
 *
 * Même motif que `validerImagesAnnoncees` : le contrôle lit **ce que le build a
 * écrit**, jamais la liste qui a servi à l'écrire — c'est la seule façon
 * d'attraper une adresse mal composée autant qu'une page manquante. Trois
 * choses s'y vérifient, et chacune protège un défaut muet :
 *
 * 1. **`robots.txt` mène au plan**, à l'adresse exacte où le build l'a posé.
 *    Un plan que rien n'annonce n'est lu par personne.
 *
 * 2. **Chaque adresse du plan répond.** Soit le build lui a écrit son
 *    `index.html`, soit c'est un chemin de vue et Cloudflare Pages y sert le
 *    gabarit — le repli qui ne tient que tant qu'aucun `404.html` n'existe
 *    (spec §7.2, décision 11). D'où le contrôle de cette absence **ici** :
 *    c'est ce plan-ci qui en dépend, et un `404.html` déposé demain ferait des
 *    chemins de vue servis par le repli autant d'adresses mortes.
 *
 * 3. **Chaque document déclare la bonne canonique, ou n'en déclare aucune.**
 *    Une page servie à une seule adresse du plan doit déclarer celle-là — c'est
 *    ce qu'une canonique est, et l'annoncer au plan sous une adresse tout en la
 *    déclarant sous une autre envoie deux signaux contraires. Un document servi
 *    à **plusieurs** adresses du plan, lui, ne peut en déclarer aucune : une
 *    canonique fixe y déclarerait les autres doublons de la première — le plan
 *    les annoncerait et le document les retirerait, dans le même souffle. Cette
 *    absence-là est donc une décision, et elle est gardée comme telle.
 *
 *    Ce compte-ci se lit sur le disque, jamais sur une liste : c'est ce qui l'a
 *    fait suivre tout seul quand `/methode` a reçu son propre document. Le
 *    gabarit servait six adresses et n'en déclarait aucune ; il en sert cinq et
 *    n'en déclare toujours aucune, et `/methode` — désormais seule à son
 *    fichier — doit déclarer la sienne. Aucune ligne de ce contrôle n'a changé,
 *    et c'est la preuve que le document et le plan disent la même chose.
 */
export async function validerIndexation(racine: string, site: string): Promise<void> {
  const prefixe = `${site}/`;

  const robots = await lireOuEchouer(path.join(racine, "robots.txt"), "robots.txt");
  const annonce = robots.match(/^Sitemap:[ \t]*(\S+)/m)?.[1];
  if (annonce !== `${site}/${PLAN_DU_SITE}`) {
    throw new Error(
      `robots.txt annonce le plan du site à « ${annonce ?? "(nulle part)"} » au lieu de ` +
        `« ${site}/${PLAN_DU_SITE} » : un plan que rien n'annonce n'est lu par personne.`,
    );
  }

  const plan = await lireOuEchouer(path.join(racine, PLAN_DU_SITE), PLAN_DU_SITE);
  const adresses = [...plan.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]!);
  if (!adresses.length) {
    throw new Error(`${PLAN_DU_SITE} ne liste aucune adresse : le plan n'annonce rien.`);
  }

  // Quel document sert quoi. Une même clé pour plusieurs adresses, c'est le
  // gabarit servi par le repli — et c'est ce que le contrôle des canoniques
  // (3) a besoin de savoir.
  const servies = new Map<string, string[]>();
  const replis: string[] = [];
  for (const adresse of adresses) {
    if (!adresse.startsWith(prefixe)) {
      throw new Error(
        `Le plan du site annonce « ${adresse} », qui n'est pas absolue sous ${site} : ` +
          "un plan de site se lit en adresses absolues, et celle-ci désignerait un autre domaine.",
      );
    }
    const chemin = adresse.slice(site.length);
    const propre = path.join(racine, chemin.replace(/^\//, ""), "index.html");
    let fichier = propre;
    if (!(await existe(propre))) {
      if (!CHEMINS_DE_VUE.has(chemin)) {
        throw new Error(
          `Le plan du site annonce « ${adresse} », que le build n'écrit pas (${propre}) et qui ` +
            "n'est pas un chemin de vue : une adresse morte dans un plan de site est un signal de " +
            "mauvaise qualité envoyé aux moteurs.",
        );
      }
      replis.push(adresse);
      fichier = path.join(racine, "index.html");
      if (!(await existe(fichier))) {
        throw new Error(
          `Le plan du site annonce « ${adresse} », servie par le gabarit, que le build n'a pas ` +
            `écrit (${fichier}).`,
        );
      }
    }
    servies.set(fichier, [...(servies.get(fichier) ?? []), adresse]);
  }

  if (replis.length && (await existe(path.join(racine, "404.html")))) {
    throw new Error(
      `Le build a écrit un 404.html : Cloudflare Pages cesse alors de servir le gabarit pour les ` +
        `chemins sans fichier, et ces adresses du plan meurent — ${replis.join(", ")}.`,
    );
  }

  for (const [fichier, adressesServies] of servies) {
    const html = await readFile(fichier, "utf8");
    const canonique = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
    if (adressesServies.length > 1) {
      if (canonique) {
        throw new Error(
          `${fichier} répond à ${adressesServies.length} adresses du plan (${adressesServies.join(", ")}) ` +
            `et en déclare une seule canonique (« ${canonique} ») : le plan annoncerait les autres, ` +
            "ce document les déclarerait doublons.",
        );
      }
      continue;
    }
    const attendue = adressesServies[0]!;
    if (canonique !== attendue) {
      throw new Error(
        `${fichier} est annoncée au plan sous « ${attendue} » et se déclare canonique sous ` +
          `« ${canonique ?? "(aucune)"} » : deux adresses pour une seule page.`,
      );
    }
  }
}

async function main(): Promise<void> {
  const shell = await readFile(path.join(DIST, "index.html"), "utf8");
  const analyses = await chargerAnalyses();
  const { catalogue, version, racineDonnees, jeux, producteurs, regions, pays, niches, budget } =
    await chargerPublication();

  await validerCadresPublies(racineDonnees);
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
    titre: PAGE_ANALYSES.titre,
    description: PAGE_ANALYSES.description,
    canonique: "/analyses/",
    // L'index n'a pas de chiffre à lui, mais il a une section : il porte la
    // carte des analyses, pas celle du site — qui annonce l'accueil.
    image: "/analyses/carte.png",
    corps: renduIndex(analyses, catalogue),
  };
  const htmlIndex = injecter(shell, pageIndex, SITE);
  await ecrirePage(path.join(DIST, "analyses"), htmlIndex);
  ecrites.push({ chemin: "analyses/index.html", html: htmlIndex });

  // Le gabarit lui-même : c'est lui que Cloudflare sert pour la racine et pour
  // toutes les vues de l'application.
  //
  // Il reçoit deux choses. **L'accueil**, écrit dans son cadre : la racine est
  // la première page qu'un moteur explore, et la première exploration fixe
  // l'impression qu'il met en cache. Peinte côté client seulement, elle ne
  // portait aucun mot du message principal pour qui n'exécute pas JavaScript.
  // Et **les balises du site**, sans lesquelles la carte du site serait une
  // image que rien ne désigne. Le reste du corps n'est pas touché :
  // l'application se monte dessus, et les vues qu'il sert encore —
  // `/territoire`, `/reperes`, `/detail`, `/simulateur` — restent vides tant que
  // le paquet ne les peint pas. `/methode`, elle, a son propre document, écrit
  // juste après.
  //
  // `/simulateur` part de ce document-là aussi, et c'est la fonction d'edge qui
  // y remplace le titre, la description et l'image par ceux du scénario
  // demandé (`poserApercu`, src/apercu-scenario.ts).
  const htmlSite = injecterPartage(
    injecterAccueil(shell, corpsAccueil(analyses, catalogue, regions, producteurs), version),
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

  // La page BILAN, à son propre chemin. Elle réunit ce que REPÈRES et MÉTHODE
  // écrivaient séparément : les huit cadres nationaux, puis les sources et la
  // grille de verdicts que la méthode portait. Deux documents s'écrivaient au
  // même endroit depuis la fusion des onglets — le second écrasait le premier,
  // et la page perdait ses sources sans qu'aucun contrôle ne le voie.
  //
  // Le catalogue est celui du navigateur, indicateurs calculés compris — voir
  // `injecterReperes`, point 1. `corpsAccueil` en compose un identique pour
  // lui-même ; le composer deux fois vaut mieux que de le passer d'une page à
  // l'autre, où l'on ne verrait plus lequel des deux catalogues chaque page lit.
  const htmlBilan = injecterAnnonce(
    injecterReperes(
      injecterMethode(shell, jeux),
      pays,
      [...catalogue, ...indicateursDerives(catalogue)],
      niches,
      budget,
    ),
    {
      titre: PAGE_BILAN.titre,
      description: PAGE_BILAN.description,
      canonique: CHEMIN_BILAN,
      image: `${CHEMIN_BILAN}/carte.png`,
    },
    SITE,
  );
  await ecrirePage(path.join(DIST, DOSSIER_BILAN), htmlBilan);
  ecrites.push({ chemin: `${DOSSIER_BILAN}/index.html`, html: htmlBilan });

  await validerImagesAnnoncees(DIST, ecrites, SITE);
  await validerImageDuScenario(DIST);

  // Après la dernière page rangée : le plan n'annonce que des adresses que le
  // build vient d'écrire, et le contrôle relit les fichiers, pas la liste.
  const adresses = adressesPubliees(analyses);
  await ecrireIndexation(DIST, SITE, adresses);
  await validerIndexation(DIST, SITE);

  console.log(
    `Pré-rendu : l'accueil dans dist/index.html, ${analyses.length} analyse(s), dist/analyses/index.html, ` +
      `dist/${DOSSIER_BILAN}/index.html, ` +
      `${analyses.length + sections(shell).length} carte(s) de partage, ` +
      `${adresses.length} adresse(s) au plan du site, sous ${SITE}.`,
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
