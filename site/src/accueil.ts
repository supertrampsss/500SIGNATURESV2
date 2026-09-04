/**
 * L'accueil : cinq blocs, dans l'ordre de la spec §8.
 *
 * Le site ouvrait sur sa carte. Une carte ne dit pas ce que fait le site — elle
 * suppose qu'on le sait déjà. L'accueil pose le message principal, puis en
 * donne la preuve tout de suite : un verdict, un simulateur, un territoire.
 *
 * 1. Le verdict du moment — la dernière analyse mise en avant, au format
 *    carte-verdict : le chiffre annoncé, son auteur et sa date, le chiffre des
 *    comptes, le cran, la source.
 * 2. Vérifiez par vous-même — une porte vers le simulateur, jamais le
 *    simulateur lui-même : les contraintes existantes, et le lien qui les ouvre.
 * 3. Et chez vous ? — le champ de recherche du site, avec un exemple vivant.
 * 4. Les analyses récentes — les cartes des analyses déjà publiées.
 * 5. La bande de confiance — ce que le site publie, qui le produit, et où
 *    l'on va vérifier.
 *
 * Comme les autres renderers éditoriaux, ce module ne touche pas au
 * DOM : chaque fonction est pure, reçoit des données déjà résolues, rend une
 * chaîne, et c'est cette chaîne qui est testée. Aucune E/S, aucun réseau,
 * aucune horloge — y compris pour le tirage au sort du bloc 3, qui **reçoit**
 * sa source d'aléa au lieu de l'appeler : une fonction qui tire elle-même n'est
 * pas testable, et le trou qu'elle peut afficher est à l'endroit le plus
 * visible du site.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE CET ÉCRAN N'ÉCRIT JAMAIS
 * ─────────────────────────────────────────────────────────────────────────
 * Aucun montant par habitant : le par-habitant ne s'affiche que dans les
 * tableaux dépliés (règle d'affichage du projet), et `formater` est donc
 * toujours appelé ici avec `parHabitant` à faux. Aucun classement, aucun score,
 * aucune somme de budgets : les analyses se rangent par date de publication —
 * jamais par montant, ce qui ordonnerait des grandeurs que rien ne compare — et
 * un seul territoire est montré à la fois, jamais deux mis en regard. Aucune
 * réserve qui s'excuse : ce qui change la lecture d'un chiffre se dit avec lui,
 * dans sa ligne, jamais en avertissement après.
 */

import { LIBELLE_CONFUSION, LIBELLE_CRAN, type Analyse, type Source } from "./analyse-rendu.ts";
import type { Indicateur, Territoire } from "./donnees.ts";
import { formater, MENTION_MILLIONS } from "./echelle.ts";
import { coucheEvolution, formaterVariation, modeVariation } from "./evolution-carte.ts";
import { CONTRATS } from "./mission.ts";
import { echapper } from "./texte.ts";
import { traduire } from "./traductions.ts";

/**
 * Le message principal du site, arrêté à la conception (spec §8).
 *
 * Il vivait dans `scripts/prerendre.ts`, qui le peint sur la carte de partage
 * du simulateur. C'est l'accueil qui le pose à l'écran : la constante habite
 * donc ici, et le pré-rendu la lit. L'import inverse — `src/` lisant un script
 * de build — aurait fait entrer `node:fs` dans le module graphe du navigateur,
 * et une seconde rédaction du même message aurait fini par en dire autre chose.
 */
export const MESSAGE_PRINCIPAL =
  "Les chiffres du débat budgétaire, recalculés sur les comptes publiés — et rejouables.";

/** L'ancre du champ de recherche de territoire, celui de l'en-tête du site
 *  (`index.html`). L'accueil n'en construit pas un second : deux champs qui
 *  cherchent dans le même index sans partager leur état est un défaut que ce
 *  projet a déjà nommé et retiré une fois. */
const ANCRE_RECHERCHE = "/territoire#recherche";

/** La page autonome qui porte méthode et registre, à l'adresse historique. */
const CHEMIN_SOURCES = "/sources/";

/* --------------------------------------------------------------------------
 * Bloc 1 — Le verdict du moment
 * ----------------------------------------------------------------------- */

/**
 * L'analyse que l'accueil met en tête.
 *
 * `mise_en_avant` est un champ **du schéma** (docs/analyses-schema.md, et le
 * contrôle `controle_analyses.py` l'exige booléen sur chaque fichier) : rien à
 * ajouter, rien à décider. La plus récente des analyses ainsi marquées passe
 * devant ; si aucune ne l'est, le repli est la plus récente tout court — une
 * page d'accueil sans verdict serait vide, et le champ dit « peut être mise en
 * avant », pas « est la seule affichable ».
 *
 * `null` seulement quand aucune analyse n'est publiée : le bloc disparaît alors
 * entièrement plutôt que d'afficher un cadre vide.
 */
export function analyseDuMoment(analyses: readonly Analyse[]): Analyse | null {
  const parDate = [...analyses].sort((a, b) => b.publie_le.localeCompare(a.publie_le));
  return parDate.find((a) => a.mise_en_avant) ?? parDate[0] ?? null;
}

/** Un lien vers une source, échappé de bout en bout — même forme que
 *  `analyse-rendu.ts`. */
function lienSource(source: Source): string {
  return `<a href="${echapper(source.url)}" target="_blank" rel="noopener">${echapper(
    source.titre,
  )}</a>`;
}

/**
 * Le chiffre des comptes de la carte-verdict : le premier chiffre observé dont
 * le catalogue déclare l'unité.
 *
 * Pas d'unité de repli. `analyse-rendu.ts` retombe sur `EUR` faute de mieux ;
 * ici, l'accueil peindrait un taux ou un effectif en millions d'euros à
 * l'endroit le plus lu du site. Sans unité déclarée, la carte montre le cran,
 * l'affirmation et sa source, et pas de montant — c'est déjà la règle de la
 * carte de partage (`donneesCarteAnalyse`, scripts/prerendre.ts).
 */
function chiffreDesComptes(
  analyse: Analyse,
  catalogue: readonly Indicateur[],
): { lecture: string; montant: string; periode: string } | null {
  for (const chiffre of analyse.chiffres) {
    const observe = chiffre.observe;
    if (!observe) continue;
    const unite = catalogue.find((i) => i.id === observe.indicateur)?.unite;
    if (!unite) continue;
    return {
      lecture: chiffre.lecture,
      montant: formater(observe.valeur, unite, false, observe.indicateur),
      periode: observe.periode,
    };
  }
  return null;
}

/**
 * Le verdict du moment, au format carte-verdict.
 *
 * Deux sources, et elles ne se remplacent pas : `affirmation.source` est celle
 * de la **déclaration** mise en cause, `sources[0]` celle du **chiffre des
 * comptes**. Les confondre attribuerait le chiffre publié à qui l'a contesté —
 * la faute que la carte de partage a corrigée (voir `donneesCarteAnalyse`).
 */
export function renduVerdictDuMoment(
  analyse: Analyse | null,
  catalogue: readonly Indicateur[],
): string {
  if (!analyse) return "";
  const { affirmation, verdict } = analyse;
  const attribution =
    affirmation.auteur !== null
      ? `<p class="accueil__attribution">— ${echapper(affirmation.auteur)}${
          affirmation.date ? `, ${echapper(affirmation.date)}` : ""
        }</p>`
      : "";
  // « Ce qui a été dit » ne se dit que de quelqu'un.
  //
  // Un décryptage n'oppose aucune déclaration attribuée (docs/analyses-schema.md) :
  // son `affirmation.source` est alors une publication officielle, souvent celle-là
  // même qui porte le chiffre des comptes — dans l'analyse publiée, les deux sont
  // le même document, au caractère près. Le préfixe attribuait donc au PLRG une
  // affirmation que le PLRG n'a pas faite, et le montrait deux fois : une fois
  // comme ce qui a été dit, une fois comme la source de ce qui le dément.
  //
  // C'est la faute que le lot 3 a corrigée sur la carte de partage — peindre la
  // source d'une déclaration mise en cause comme celle des comptes. Sans auteur,
  // la source se pose nue, comme le fait la page d'analyse.
  const sourceDeclaration =
    affirmation.auteur !== null
      ? `<p class="accueil__source-declaration">Ce qui a été dit : ${lienSource(affirmation.source)}</p>`
      : `<p class="accueil__source-declaration">${lienSource(affirmation.source)}</p>`;
  const comptes = chiffreDesComptes(analyse, catalogue);
  const sourceComptes = analyse.sources[0];
  const rangeeComptes = comptes
    ? `<dt>Chiffre des comptes</dt>
        <dd>${echapper(comptes.lecture)} <strong>${comptes.montant}</strong>
          <span class="accueil__provenance">exercice ${echapper(comptes.periode)}${
            sourceComptes ? ` · ${lienSource(sourceComptes)}` : ""
          }</span>
        </dd>`
    : "";
  const confusion =
    verdict.cran === "hors_perimetre" && verdict.confusion
      ? `<p class="accueil__confusion">${echapper(LIBELLE_CONFUSION[verdict.confusion])}</p>`
      : "";
  const chiffreDit = analyse.chiffres[0]?.dit ?? "";
  const rangeeDit = chiffreDit
    ? `<dt>Chiffre annoncé</dt><dd>« ${echapper(chiffreDit)} »</dd>`
    : "";
  return `<section class="accueil__bloc accueil__bloc--verdict" aria-labelledby="accueil-verdict">
    <h3 id="accueil-verdict">Le verdict du moment</h3>
    <article class="accueil__carte-verdict" data-slug="${echapper(analyse.slug)}">
      <h4 class="accueil__titre-analyse">${echapper(analyse.titre)}</h4>
      <blockquote class="accueil__affirmation">${echapper(affirmation.texte)}</blockquote>
      ${attribution}
      ${sourceDeclaration}
      <dl class="accueil__chiffres">${rangeeDit}${rangeeComptes}</dl>
      <p class="accueil__cran accueil__cran--${echapper(verdict.cran)}">${
        LIBELLE_CRAN[verdict.cran]
      }</p>
      ${confusion}
      <a class="accueil__appel" href="/analyses/${echapper(analyse.slug)}/">Lire le verdict</a>
    </article>
  </section>`;
}

/* --------------------------------------------------------------------------
 * Bloc 2 — Vérifiez par vous-même
 * ----------------------------------------------------------------------- */

/**
 * La porte du simulateur : une phrase d'appel et les défis existants.
 *
 * Les défis (spec §10) sont les **contraintes** du simulateur, et le site n'en
 * connaît pas d'autres : `CONTRATS` (mission.ts) est la liste, importée plutôt
 * que recopiée — une seconde liste d'intitulés se désaccorderait de celle qui
 * verrouille réellement les lignes. Chaque contrainte ouvre le simulateur
 * déjà signée, avec le paramètre `contrat` que `lireUrl()` (main.ts) lit.
 *
 * Pas de simulateur embarqué : une porte. Et aucun montant ici — le déficit à
 * combler dépend des fichiers publiés, que ce bloc ne reçoit pas ; l'écrire de
 * mémoire serait un chiffre sans source à trois lignes du message principal.
 */
export function renduVerifiez(): string {
  const defis = CONTRATS.map(
    (contrat) =>
      `<li><a class="accueil__defi" href="/simulateur?contrat=${encodeURIComponent(
        contrat.cle,
      )}">${echapper(contrat.nom)}</a> <span class="accueil__defi-interdit">${echapper(
        contrat.interdit,
      )}</span></li>`,
  ).join("");
  return `<section class="accueil__bloc accueil__bloc--simulateur" aria-labelledby="accueil-simulateur">
    <h3 id="accueil-simulateur">Vérifiez par vous-même</h3>
    <p class="accueil__appel-simulateur">
      Le budget de l'État, celui de la Sécurité sociale et ceux des collectivités,
      ligne par ligne : refaites les arbitrages et voyez ce que chacun fait à son
      propre solde.
    </p>
    <ul class="accueil__defis">${defis}</ul>
    <a class="accueil__appel" href="/simulateur">Rejouer le calcul</a>
  </section>`;
}

/* --------------------------------------------------------------------------
 * Bloc 3 — Et chez vous ?
 * ----------------------------------------------------------------------- */

/** Un chiffre de l'exemple vivant. `valeur` est `null` quand la série ne
 *  publie rien pour ce territoire : c'est ce cas-là que le tirage écarte, et
 *  il doit donc pouvoir se représenter. `precedent` porte l'exercice publié
 *  d'avant, quand il existe — la variation se dit alors, en points pour un
 *  taux (`modeVariation`). */
export type ChiffreTerritoire = {
  libelle: string;
  /** L'unité déclarée par le catalogue pour cette série. */
  unite: string;
  /** L'identifiant de la série : lui seul distingue un agrégat d'une valeur
   *  unitaire, que l'unité `EUR` confond (`formater`, echelle.ts). */
  id?: string;
  exercice: string;
  valeur: number | null;
  precedent: { exercice: string; valeur: number } | null;
};

export type ExempleTerritoire = {
  nom: string;
  /** Le code et la maille du territoire, tels que l'adresse du site les porte
   *  (`territoire` et `niveau`, `lireUrl()` dans main.ts) : sans eux, l'exemple
   *  nomme un territoire sans mener à sa fiche. */
  code: string;
  niveau: string;
  chiffres: readonly ChiffreTerritoire[];
};

/**
 * Les trois séries de l'exemple vivant : ce qui entre, ce qui sort, ce qui
 * reste dû.
 *
 * Trois agrégats en euros que `formater` rend en millions — jamais par
 * habitant, le par-habitant ne s'affichant que dans les tableaux dépliés. Ce
 * sont trois faits d'un même exercice, pas un jugement : aucun des trois ne se
 * lit comme une note, et le bloc n'en met aucun en regard d'un autre territoire.
 */
export const CHIFFRES_EXEMPLE = [
  "ofgl_recettes_fonctionnement",
  "ofgl_depenses_fonctionnement",
  "ofgl_encours_dette",
] as const;

/**
 * La maille de l'exemple : la région.
 *
 * C'est une maille de la carte (`COUCHES`, main.ts), donc `niveauConnu` la garde
 * et le lien de l'exemple — `/territoire?niveau=region&territoire=…` — ouvre
 * bien la fiche, sans paramètre `maille`. Et son lot tient dans un fichier que
 * la carte charge de toute façon pour ses comparaisons, là où celui des
 * départements pèse sept fois plus : au premier écran du site, la différence se
 * voit.
 */
export const MAILLE_EXEMPLE = "region";

/**
 * Les territoires candidats à l'exemple, avec leurs trous.
 *
 * Le dernier exercice publié de chaque série, et celui d'avant pour la
 * variation : l'un et l'autre lus sur la série elle-même, jamais sur un
 * calendrier. Les trous restent — `tirerTerritoire` écarte les territoires
 * incomplets, et c'est là que cette règle est éprouvée.
 *
 * Une série absente du catalogue n'a pas d'unité déclarée : aucun exemple n'est
 * alors montrable, et le bloc tombe sur le champ de recherche seul plutôt que
 * de peindre un montant sans unité au premier écran du site.
 *
 * Cette fonction vit ici, avec le bloc qu'elle sert, et non dans le montage :
 * le navigateur (`main.ts`) et le pré-rendu (`scripts/prerendre.ts`) peignent
 * le même accueil, et deux constructions de la même liste finiraient par
 * montrer deux exemples différents à la même adresse.
 *
 * La liste sort **triée par code**, et c'est une décision, pas une commodité :
 * le pré-rendu prend le premier territoire complet (`ALEA_PRERENDU`,
 * scripts/prerendre.ts), et « le premier » ne peut pas vouloir dire « celui que
 * JavaScript rend en tête ». Les clés d'un objet JSON ne reviennent pas dans
 * l'ordre du fichier : celles qui sont des entiers passent devant, en ordre
 * croissant — « 11 » avant « 01 ». L'accueil du site aurait ainsi dépendu d'une
 * règle du langage plutôt que d'une règle écrite, et aurait changé de région le
 * jour où les codes d'une maille cessent d'être des entiers.
 */
export function exemplesTerritoires(
  paquet: Record<string, Territoire>,
  catalogue: readonly Indicateur[],
): ExempleTerritoire[] {
  const series: Indicateur[] = [];
  for (const id of CHIFFRES_EXEMPLE) {
    const indicateur = catalogue.find((i) => i.id === id);
    if (!indicateur) return [];
    series.push(indicateur);
  }
  return Object.entries(paquet)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, territoire]) => ({
      nom: territoire.nom,
      code,
      niveau: MAILLE_EXEMPLE,
      chiffres: series.map((indicateur): ChiffreTerritoire => {
        const serie = territoire.series[indicateur.id] ?? {};
        const exercices = Object.keys(serie).sort();
        const dernier = exercices[exercices.length - 1];
        const avant = exercices[exercices.length - 2];
        return {
          libelle: traduire(indicateur.libelle),
          unite: indicateur.unite,
          id: indicateur.id,
          exercice: dernier ?? "",
          valeur: dernier === undefined ? null : serie[dernier],
          precedent: avant === undefined ? null : { exercice: avant, valeur: serie[avant] },
        };
      }),
    }));
}

/** Un territoire n'est montrable que si ses trois chiffres sont publiés. Un
 *  seul manquant afficherait un trou à l'endroit le plus visible du site. */
function complet(territoire: ExempleTerritoire): boolean {
  return (
    territoire.chiffres.length === 3 &&
    territoire.chiffres.every((c) => c.valeur !== null && Number.isFinite(c.valeur))
  );
}

/**
 * Le territoire de l'exemple vivant, tiré au sort **parmi les seuls complets**.
 *
 * `alea` est attendu dans [0, 1[ — `Math.random()` chez l'appelant, une valeur
 * fixe dans les tests. La fonction ne l'appelle jamais elle-même : un tirage
 * qui se fait tout seul ne se teste pas, et c'est précisément la garantie
 * « jamais un territoire incomplet » qu'il faut pouvoir éprouver sur chaque
 * tirage possible. Les bornes sont ramenées dans la liste plutôt que de rendre
 * `undefined` sur `alea` valant exactement 1.
 *
 * `null` quand aucun territoire complet n'est disponible : le bloc montre alors
 * le champ de recherche seul, sans exemple — jamais un exemple à trous.
 */
export function tirerTerritoire(
  territoires: readonly ExempleTerritoire[],
  alea: number,
): ExempleTerritoire | null {
  const eligibles = territoires.filter(complet);
  if (eligibles.length === 0) return null;
  const rang = Math.floor((Number.isFinite(alea) ? alea : 0) * eligibles.length);
  return eligibles[Math.min(eligibles.length - 1, Math.max(0, rang))]!;
}

/**
 * La variation d'un chiffre depuis l'exercice publié précédent.
 *
 * Le calcul et l'écriture sont délégués à `evolution-carte.ts` : un taux varie
 * en **points**, jamais en pourcentage, et les taux publiés pour mille que
 * l'écran montre en pourcentage suivent la même conversion. Recopier la règle
 * ici la ferait diverger — elle a déjà été corrigée une fois, où elle peignait
 * un taux dix fois trop grand.
 *
 * `coucheEvolution` porte aussi le garde-fou du dénominateur nul : une série
 * qui partait de zéro ne produit pas de variation infinie, elle n'en produit
 * aucune.
 */
function renduVariation(chiffre: ChiffreTerritoire): string {
  const precedent = chiffre.precedent;
  if (!precedent || chiffre.valeur === null) return "";
  const mode = modeVariation(chiffre.unite);
  const evolution = coucheEvolution(
    { t: precedent.valeur },
    { t: chiffre.valeur },
    mode,
  )["t"];
  if (!evolution) return "";
  return ` <span class="accueil__variation">${formaterVariation(
    evolution.variation,
    chiffre.unite,
    mode,
  )} depuis ${echapper(precedent.exercice)}</span>`;
}

/**
 * Le bloc « Et chez vous ? » : le champ de recherche de Territoires et un exemple.
 *
 * Le champ n'est pas construit ici : le lien ouvre celui de la page
 * Territoires. L'exemple est un territoire à la fois : trois chiffres
 * publiés, chacun avec son exercice, jamais deux territoires mis en regard, qui
 * seraient un classement à deux lignes.
 */
export function renduChezVous(territoire: ExempleTerritoire | null): string {
  const exemple = territoire
    ? `<figure class="accueil__exemple">
      <figcaption class="accueil__exemple-nom">
        <a href="/territoire?niveau=${encodeURIComponent(
          territoire.niveau,
        )}&territoire=${encodeURIComponent(territoire.code)}">${echapper(territoire.nom)}</a>
      </figcaption>
      <ul class="accueil__exemple-chiffres">${territoire.chiffres
        .map(
          (chiffre) => `<li>${echapper(chiffre.libelle)}
            <strong>${formater(chiffre.valeur!, chiffre.unite, false, chiffre.id)}</strong>
            <span class="accueil__provenance">exercice ${echapper(chiffre.exercice)}</span>${renduVariation(
              chiffre,
            )}</li>`,
        )
        .join("")}</ul>
    </figure>`
    : "";
  return `<section class="accueil__bloc accueil__bloc--territoire" aria-labelledby="accueil-territoire">
    <h3 id="accueil-territoire">Et chez vous ?</h3>
    <p class="accueil__appel-territoire">
      Les comptes de chaque commune, département et région, tels que leurs
      producteurs les publient.
    </p>
    ${exemple}
    <a class="accueil__appel" href="${ANCRE_RECHERCHE}">Chercher ma commune</a>
  </section>`;
}

/* --------------------------------------------------------------------------
 * Bloc 4 — Les analyses récentes
 * ----------------------------------------------------------------------- */

/** Le plafond du bloc : six cartes (spec §8). Au-delà, l'accueil devient
 *  l'index des analyses, qui existe déjà et a ses filtres. */
const CARTES_MAXIMUM = 6;

/**
 * Les analyses récentes, de la plus récente à la plus ancienne.
 *
 * L'ordre est celui des dates de publication — jamais celui des montants en
 * cause, qui rangerait des grandeurs que rien ne compare et ferait un
 * classement d'un fil éditorial.
 *
 * Celle du bloc 1 en est retirée : elle est juste au-dessus, et se relire deux
 * fois dans le même écran se lit comme un défaut d'affichage. Quand il ne reste
 * rien à lister, le bloc n'écrit rien du tout plutôt qu'un cadre vide.
 */
export function renduAnalysesRecentes(
  analyses: readonly Analyse[],
  exclu: string | null = null,
): string {
  const recentes = [...analyses]
    .filter((a) => a.slug !== exclu)
    .sort((a, b) => b.publie_le.localeCompare(a.publie_le))
    .slice(0, CARTES_MAXIMUM);
  if (recentes.length === 0) return "";
  const cartes = recentes
    .map(
      (a) => `<li class="accueil__carte-analyse">
        <a href="/analyses/${echapper(a.slug)}/">${echapper(a.titre)}</a>
        <span class="accueil__cran accueil__cran--${echapper(a.verdict.cran)}">${
          LIBELLE_CRAN[a.verdict.cran]
        }</span>
        <time datetime="${echapper(a.publie_le)}">${echapper(a.publie_le)}</time>
      </li>`,
    )
    .join("");
  return `<section class="accueil__bloc accueil__bloc--analyses" aria-labelledby="accueil-analyses">
    <h3 id="accueil-analyses">Les analyses récentes</h3>
    <ul class="accueil__analyses">${cartes}</ul>
  </section>`;
}

/* --------------------------------------------------------------------------
 * Bloc 5 — La bande de confiance
 * ----------------------------------------------------------------------- */

/**
 * Ce que le site publie, qui le produit, et où l'on va vérifier.
 *
 * Le nombre d'indicateurs est **compté sur le catalogue reçu**, jamais passé à
 * part : un nombre écrit à côté de la liste qu'il compte finit par ne plus la
 * compter.
 *
 * Les producteurs sont cités en toutes lettres, sans logo (décision D9) et sans
 * être réordonnés : l'ordre reçu est celui du manifeste, et trier ferait un
 * palmarès d'une liste de sources.
 */
export function renduBandeConfiance(
  catalogue: readonly Indicateur[],
  producteurs: readonly string[],
): string {
  const nombre = formater(catalogue.length, "count", false);
  const liste = [...new Set(producteurs)].map((p) => echapper(p)).join(" · ");
  return `<section class="accueil__bloc accueil__bloc--confiance" aria-labelledby="accueil-confiance">
    <h3 id="accueil-confiance">D'où viennent ces chiffres</h3>
    <p class="accueil__indicateurs">${nombre} indicateurs publiés, tirés des fichiers de leurs producteurs :</p>
    <p class="accueil__producteurs">${liste}</p>
    <p class="accueil__verifier">
      <a href="${CHEMIN_SOURCES}">La méthode</a> ·
      <a href="${CHEMIN_SOURCES}">D'où viennent ces chiffres</a>
    </p>
  </section>`;
}

/* --------------------------------------------------------------------------
 * La page
 * ----------------------------------------------------------------------- */

export type DonneesAccueil = {
  analyses: readonly Analyse[];
  catalogue: readonly Indicateur[];
  /** Les territoires candidats à l'exemple vivant, tels que l'appelant les a
   *  résolus — avec leurs trous, que `tirerTerritoire` écarte. */
  territoires: readonly ExempleTerritoire[];
  /** La source d'aléa du tirage, dans [0, 1[. Reçue, jamais appelée ici. */
  alea: number;
  /** Les producteurs des jeux publiés (`Jeu.producteur`, manifeste). */
  producteurs: readonly string[];
};

/** Les trois entrées de l'accueil : trois intentions distinctes, pas trois
 * variantes d'une même navigation. Elles restent sans donnée pour que le
 * premier écran soit immédiatement utile, y compris avant le chargement des
 * fichiers publiés. */
export function renduPortes(): string {
  return `<section class="accueil-portes" aria-labelledby="accueil-parcours">
    <h3 id="accueil-parcours">Choisissez votre parcours</h3>
    <div class="accueil-portes__grille">
      <a class="accueil-porte accueil-porte--france" href="/bilan">
        <strong>Comprendre la France</strong>
        <span>Lire l'équation nationale et les analyses publiées.</span>
      </a>
      <a class="accueil-porte accueil-porte--territoires" href="/territoire">
        <strong>Explorer mon territoire</strong>
        <span>Retrouver les comptes de ma commune, de mon département ou de ma région.</span>
      </a>
      <a class="accueil-porte accueil-porte--simuler" href="/simulateur">
        <strong>Prendre les commandes</strong>
        <span>Rejouer les arbitrages budgétaires, ligne par ligne.</span>
      </a>
    </div>
  </section>`;
}

/**
 * L'accueil entier : une promesse, trois portes, puis les preuves et contenus
 * de lecture. Les composants de détail restent ceux du premier lot : aucun
 * calcul ne vit dans la composition de parcours.
 */
export function rendu(donnees: DonneesAccueil): string {
  const enAvant = analyseDuMoment(donnees.analyses);
  return `<div class="accueil">
    <section class="accueil__ouverture">
      <h2 class="accueil__message">${echapper(MESSAGE_PRINCIPAL)}</h2>
      <p class="accueil__cadrage">${MENTION_MILLIONS}.</p>
      <p class="accueil__recherche"><a class="accueil__appel" href="${ANCRE_RECHERCHE}">Chercher un territoire</a></p>
    </section>
    ${renduPortes()}
    ${renduBandeConfiance(donnees.catalogue, donnees.producteurs)}
    ${renduVerdictDuMoment(enAvant, donnees.catalogue)}
    ${renduAnalysesRecentes(donnees.analyses, enAvant?.slug ?? null)}
    ${renduChezVous(tirerTerritoire(donnees.territoires, donnees.alea))}
    ${renduVerifiez()}
  </div>`;
}
