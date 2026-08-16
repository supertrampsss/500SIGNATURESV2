/**
 * Le rendu d'une analyse : quatre étages, du plus rapide au plus profond.
 *
 * Une analyse (docs/analyses-schema.md) cite un chiffre couramment entendu et
 * l'oppose à une observation déjà publiée par le pipeline. Le rendu ne fait
 * jamais lui-même ce rapprochement : il affiche ce que le fichier déclare.
 *
 * 1. L'express — le chiffre cité, le chiffre publié, le verdict.
 * 2. Le détail — la phrase du verdict, les chiffres cités avec leurs
 *    exercices, les effets indirects (attribués, jamais calculés ici).
 * 3. L'interactif — le renvoi vers le simulateur, seulement quand un réglage
 *    existe pour le rejouer.
 * 4. La preuve — le chemin du chiffre jusqu'au fichier publié, la seule
 *    provenance déclarée par l'analyse elle-même (`sources`).
 *
 * Comme `etat.ts` et `analyses.ts`, ce module ne touche pas au DOM : chaque
 * fonction est pure, rend une chaîne, et c'est cette chaîne qui est testée.
 */

import { citable, type Citation } from "./citer.ts";
import type { Indicateur } from "./donnees.ts";
import { formater } from "./echelle.ts";
import { aplatir } from "./simulateur.ts";
import { libelleTheme } from "./themes.ts";
import { echapper } from "./texte.ts";

export type Cran = "exact" | "hors_perimetre" | "introuvable";

export type Confusion =
  | "ae_cp"
  | "brut_net"
  | "vote_execute"
  | "stock_flux"
  | "etat_apu"
  | "annuel_cumule"
  | "perimetre_geographique";

export type Registre =
  | "fait_comptable"
  | "donnee_officielle"
  | "resultat_simulation"
  | "estimation_externe"
  | "hypothese"
  | "interpretation";

export type TypeAnalyse =
  | "verification_chiffre"
  | "analyse_mesure"
  | "decryptage"
  | "comparaison"
  | "analyse_programme"
  | "mise_a_jour";

export type BudgetConcerne = "etat" | "secu" | "collectivites" | "bareme";

export type Source = { titre: string; url: string; consulte_le: string };

export type Analyse = {
  slug: string;
  titre: string;
  type: TypeAnalyse;
  publie_le: string;
  themes: string[];
  budgets_concernes: BudgetConcerne[];
  mise_en_avant: boolean;
  affirmation: {
    texte: string;
    auteur: string | null;
    date: string | null;
    source: Source;
  };
  verdict: {
    cran: Cran;
    confusion?: Confusion;
    phrase: string;
  };
  chiffres: {
    dit: string;
    observe?: {
      indicateur: string;
      niveau: string;
      code: string;
      periode: string;
      valeur: number;
    };
    /** Une grandeur déclarée en clair par l'analyse elle-même, quand
     *  `observe` est absent — docs/analyses-schema.md : obligatoire pour
     *  `resultat_simulation`, `hypothese`, `interpretation` (`observe` y est
     *  interdit) et pour `donnee_officielle`/`estimation_externe` quand
     *  l'auteur choisit de ne pas renseigner `observe`. Chaque chiffre porte
     *  ainsi toujours un nombre que le contrôle connaît, `observe.valeur` ou
     *  `valeur` — jamais aucun des deux. `null` et absent sont équivalents. */
    valeur?: number | null;
    registre: Registre;
    lecture: string;
  }[];
  hypotheses: string[];
  effets_indirects: { texte: string; auteur: string; source: Source }[];
  sources: Source[];
  simulateur: { budget: string; contrat: string; lecture: string };
  mises_a_jour: { date: string; quoi: string }[];
  verifie_contre: string;
};

/** Les trois crans du verdict — jamais un jugement de valeur, toujours un fait. */
export const LIBELLE_CRAN: Record<Cran, string> = {
  exact: "Le chiffre est celui des comptes",
  hors_perimetre: "Le chiffre existe, mais pas pour ce qu'il désigne",
  introuvable: "Aucune ligne publiée ne porte ce montant",
};

/** Ce que chaque confusion nomme précisément, pour l'afficher à l'écran — un
 *  cran `hors_perimetre` n'est jamais laissé à expliquer sans elle. */
export const LIBELLE_CONFUSION: Record<Confusion, string> = {
  ae_cp: "Autorisations d'engagement confondues avec des crédits de paiement",
  brut_net: "Montant brut confondu avec un montant net",
  vote_execute: "Ce qui a été voté confondu avec ce qui a été exécuté",
  stock_flux: "Une grandeur de stock confondue avec une grandeur de flux",
  etat_apu: "Le périmètre de l'État confondu avec celui des administrations publiques",
  annuel_cumule: "Un montant annuel confondu avec un montant cumulé sur plusieurs exercices",
  perimetre_geographique: "Deux périmètres géographiques différents confondus",
};

/** Le genre de page, jamais un jugement : le site nomme ce qu'il a fait du
 *  chiffre, pas ce qu'il en pense. */
export const LIBELLE_TYPE: Record<TypeAnalyse, string> = {
  verification_chiffre: "Vérification d'un chiffre",
  analyse_mesure: "Analyse d'une mesure",
  decryptage: "Décryptage",
  comparaison: "Comparaison",
  analyse_programme: "Analyse d'un programme",
  mise_a_jour: "Mise à jour",
};

/** Les quatre budgets qu'une analyse peut concerner — les mêmes que ceux que
 *  le simulateur sait régler. */
export const LIBELLE_BUDGET: Record<BudgetConcerne, string> = {
  etat: "Budget de l'État",
  secu: "Sécurité sociale",
  collectivites: "Collectivités locales",
  bareme: "Impôt sur le revenu",
};

const LIBELLE_REGISTRE: Record<Registre, string> = {
  fait_comptable: "Écriture comptable publiée",
  donnee_officielle: "Donnée officielle",
  resultat_simulation: "Résultat du simulateur",
  estimation_externe: "Estimation externe",
  hypothese: "Hypothèse",
  interpretation: "Interprétation",
};

/** Un lien vers une source, échappé de bout en bout. */
function lienSource(source: Source): string {
  return `<a href="${echapper(source.url)}" target="_blank" rel="noopener">${echapper(
    source.titre,
  )}</a> <span class="analyse-rendu__consulte">(consulté le ${echapper(source.consulte_le)})</span>`;
}

/** L'unité d'un indicateur cité, lue dans le catalogue — jamais dans l'analyse :
 *  le fichier d'analyse ne porte pas d'unité, c'est le catalogue qui fait foi. */
function uniteDe(catalogue: Indicateur[], id: string): string {
  return catalogue.find((i) => i.id === id)?.unite ?? "EUR";
}

/**
 * La commande « citer » d'un chiffre observé (spec §13).
 *
 * Elle n'est posée que là où les cinq éléments d'une citation existent au
 * moment du rendu, et trois d'entre eux manquent régulièrement :
 *
 * - **`observe`**, donc l'exercice. Un chiffre de registre `hypothese`,
 *   `interpretation` ou `resultat_simulation` n'en porte jamais
 *   (docs/analyses-schema.md) : il a une valeur, aucune date. Le citer
 *   reviendrait à copier un nombre nu — la capture d'écran floue sous une
 *   autre forme, en plus commode.
 * - **la source**, prise dans `analyse.sources` — la provenance que l'analyse
 *   déclare elle-même, celle que l'étage « preuve » liste sous « Fichier
 *   publié ». Jamais `affirmation.source`, qui est la source de la
 *   *déclaration* citée, pas celle du chiffre des comptes. La carte de partage
 *   s'autorisait ce repli, au motif que son pied couvre l'image entière : il ne
 *   la couvre pas, il suit à quatre lignes une rangée intitulée « Chiffre des
 *   comptes ». Le repli est parti (`donneesCarteAnalyse`, scripts/prerendre.ts)
 *   et la règle est la même partout — une citation comme une image nomment la
 *   source de *ce* chiffre-là.
 * - **l'unité**, lue dans le catalogue. Un indicateur que le catalogue ne
 *   déclare pas n'a pas d'unité de repli ici : `formater` peindrait un taux ou
 *   un effectif en millions d'euros, et la citation partirait fausse.
 *
 * La charge utile part en attribut `data-`, composée par ce module : `main.ts`
 * la relit telle quelle plutôt que de gratter la page rendue, où le montant a
 * déjà perdu son unité et son millésime sa forme.
 *
 * `adresse` est le permalien absolu de la page — une citation circule hors du
 * site, un chemin relatif n'y mène plus. Sans elle, pas de commande.
 */
function commandeCiter(
  chiffre: Analyse["chiffres"][number],
  analyse: Analyse,
  catalogue: Indicateur[],
  adresse: string,
): string {
  const observe = chiffre.observe;
  const source = analyse.sources[0];
  if (!observe || !source) return "";
  const citation: Citation = {
    libelle: chiffre.lecture,
    valeur: observe.valeur,
    unite: catalogue.find((i) => i.id === observe.indicateur)?.unite ?? "",
    id: observe.indicateur,
    source: source.titre,
    millesime: observe.periode,
    permalien: adresse,
  };
  if (!citable(citation)) return "";
  return ` <button type="button" class="citer" data-citer="${echapper(
    JSON.stringify(citation),
  )}">Citer ce chiffre</button>`;
}

/** Étage 1 : le chiffre cité face au chiffre publié, et le verdict. */
function express(analyse: Analyse, catalogue: Indicateur[], adresse: string): string {
  const { affirmation, verdict } = analyse;
  const attribution =
    affirmation.auteur !== null
      ? `<p class="analyse-rendu__attribution">— ${echapper(affirmation.auteur)}${
          affirmation.date ? `, ${echapper(affirmation.date)}` : ""
        }</p>`
      : "";
  const chiffresCites = analyse.chiffres
    .map((chiffre) => {
      if (!chiffre.observe) {
        // Critical (revision finale) : l'étage 1 n'affiche plus jamais `dit`
        // seul. Sans `observe`, le contrôle exige désormais une `valeur`
        // déclarée (docs/analyses-schema.md) — elle s'affiche ici à côté de
        // `dit`, sous le nom du registre, exactement comme l'étage 2 le fait
        // déjà (`detail()` ci-dessous) : un `dit` nu, sans rien que le site
        // ait lui-même vérifié à côté, laissait un chiffre non cadré porter
        // seul la page.
        const registre = echapper(LIBELLE_REGISTRE[chiffre.registre]);
        const valeurDeclaree =
          chiffre.valeur != null
            ? `<strong>${formater(chiffre.valeur, "EUR", false)}</strong> `
            : "";
        return `<li>${registre} — ${valeurDeclaree}cité comme « ${echapper(chiffre.dit)} »</li>`;
      }
      const unite = uniteDe(catalogue, chiffre.observe.indicateur);
      const montant = formater(chiffre.observe.valeur, unite, false, chiffre.observe.indicateur);
      // `dit` s'affiche toujours ici, jamais seulement en repli : c'est la
      // juxtaposition du chiffre couramment cité et du chiffre publié qui
      // fait l'étage 1. Sans elle, `dit` ne survit que par coïncidence,
      // quand `affirmation.texte` recopie les mêmes mots arrondis.
      return `<li>${echapper(chiffre.lecture)} — cité comme « ${echapper(
        chiffre.dit,
      )} », publié : <strong>${montant}</strong> (exercice ${echapper(
        chiffre.observe.periode,
      )})${commandeCiter(chiffre, analyse, catalogue, adresse)}</li>`;
    })
    .join("");
  const confusion =
    verdict.cran === "hors_perimetre" && verdict.confusion
      ? `<p class="analyse-rendu__confusion">${echapper(LIBELLE_CONFUSION[verdict.confusion])}</p>`
      : "";
  return `<section class="analyse-rendu__express">
    <h3>L'express</h3>
    <blockquote class="analyse-rendu__affirmation">${echapper(affirmation.texte)}</blockquote>
    ${attribution}
    <p class="analyse-rendu__source">${lienSource(affirmation.source)}</p>
    <ul class="analyse-rendu__chiffres-cites">${chiffresCites}</ul>
    <p class="analyse-rendu__verdict analyse-rendu__verdict--${echapper(verdict.cran)}">${
      LIBELLE_CRAN[verdict.cran]
    }</p>
    ${confusion}
  </section>`;
}

/** Étage 2 : la phrase du verdict, les chiffres avec leurs exercices en
 *  colonnes, les effets indirects — distincts des chiffres calculés. */
function detail(analyse: Analyse, catalogue: Indicateur[]): string {
  const exercices = [
    ...new Set(analyse.chiffres.map((c) => c.observe?.periode).filter((p): p is string => !!p)),
  ].sort();

  const lignes = analyse.chiffres
    .map((chiffre) => {
      const observe = chiffre.observe;
      const classe = `analyse-rendu__chiffre analyse-rendu__chiffre--${echapper(chiffre.registre)}`;
      // Une ligne sans `observe` (interprétation, hypothèse, résultat du
      // simulateur) n'a rien à ranger sous un exercice précis : elle tient
      // une seule cellule, étalée sur les colonnes d'exercice quand il y en a
      // plusieurs. Sans cette branche, la ligne produisait une cellule vide
      // par exercice publié par les *autres* lignes, et `dit` disparaissait
      // dès qu'une seule ligne du tableau portait une observation.
      //
      // Une `valeur` déclarée (docs/analyses-schema.md, révision « observe
      // interdit n'est pas valeur interdite ») s'affiche à côté de `dit`,
      // comme `observe` le fait à l'étage 1 — le site l'énonce lui-même, ce
      // n'est pas une observation du pipeline, donc jamais dans une colonne
      // d'exercice.
      const cellules = !observe
        ? `<td class="${classe}"${
            exercices.length > 1 ? ` colspan="${exercices.length}"` : ""
          }>${
            chiffre.valeur != null
              ? `${formater(chiffre.valeur, "EUR", false)} <span class="analyse-rendu__dit">(dit « ${echapper(
                  chiffre.dit,
                )} »)</span>`
              : echapper(chiffre.dit)
          }</td>`
        : exercices
            .map((exercice) => {
              if (observe.periode !== exercice) return "<td></td>";
              const unite = uniteDe(catalogue, observe.indicateur);
              const montant = formater(observe.valeur, unite, false, observe.indicateur);
              return `<td class="${classe}">${montant}</td>`;
            })
            .join("");
      return `<tr>
        <th scope="row">${echapper(chiffre.lecture)}
          <span class="analyse-rendu__registre">${echapper(LIBELLE_REGISTRE[chiffre.registre])}</span>
        </th>
        ${cellules}
      </tr>`;
    })
    .join("");

  // Les incertitudes se disent dans la légende du tableau, avec les chiffres
  // — jamais dans un bloc de réserve après eux (voir CLAUDE.md). L'unité s'y
  // dit aussi, toujours : c'est la page la plus exposée du site à la confusion
  // milliards/millions, avec « environ X milliards » et « Y M€ » côte à côte
  // (même convention qu'`exercices.ts` et `analyses.ts`).
  const hypotheses = analyse.hypotheses.map((h) => echapper(h)).join(" ");
  const legende = `<caption>Montants en millions d'euros.${hypotheses ? ` ${hypotheses}` : ""}</caption>`;

  // Un exercice par colonne : sur une analyse à plusieurs millésimes, le
  // tableau déborde de la carte, et c'est lui qui défile — jamais la page
  // entière (même règle que `.analyses__defilement`).
  const tableau = `<div class="analyse-rendu__defilement"><table class="analyse-rendu__tableau">
    ${legende}
    <thead><tr><th scope="col">Chiffre</th>${exercices
      .map((e) => `<th scope="col">${echapper(e)}</th>`)
      .join("")}${exercices.length ? "" : "<th scope=\"col\">Valeur</th>"}</tr></thead>
    <tbody>${lignes}</tbody>
  </table></div>`;

  const effets = analyse.effets_indirects.length
    ? `<ul class="analyse-rendu__effets-indirects">${analyse.effets_indirects
        .map(
          (effet) => `<li class="analyse-rendu__effet-indirect">${echapper(
            effet.texte,
          )} — ${echapper(effet.auteur)} (${lienSource(effet.source)})</li>`,
        )
        .join("")}</ul>`
    : "";

  return `<section class="analyse-rendu__detail">
    <h3>Le détail</h3>
    <p class="analyse-rendu__phrase">${echapper(analyse.verdict.phrase)}</p>
    ${tableau}
    ${effets}
  </section>`;
}

/** Étage 3 : le renvoi vers le simulateur. Un bouton qui n'ouvrirait aucun
 *  réglage serait un lien mort — sans `budget`, il n'y a pas de bouton. */
function interactif(analyse: Analyse): string {
  const { simulateur } = analyse;
  if (!simulateur.budget) {
    return `<section class="analyse-rendu__interactif">
      <h3>L'interactif</h3>
      <p class="analyse-rendu__lecture-simulateur">${echapper(simulateur.lecture)}</p>
    </section>`;
  }
  const parametres = new URLSearchParams({ budget: simulateur.budget });
  if (simulateur.contrat) parametres.set("contrat", simulateur.contrat);
  const lien = `/simulateur?${parametres.toString()}`;
  return `<section class="analyse-rendu__interactif">
    <h3>L'interactif</h3>
    <p class="analyse-rendu__lecture-simulateur">${echapper(simulateur.lecture)}</p>
    <a class="analyse-rendu__bouton" href="${lien}">Rejouer le calcul</a>
    <a class="analyse-rendu__bouton" href="${lien}">Créer mon alternative</a>
  </section>`;
}

/** Étage 4 : le chemin du chiffre jusqu'au fichier publié — une suite
 *  cliquable, pas une affirmation qu'il faudrait croire sur parole.
 *
 *  Le jeu de données n'est plus lu dans le catalogue (`indicateur.jeu` +
 *  manifeste) : le pipeline classe encore certains indicateurs sous une
 *  entrée de registre approximative, faute d'entrée dédiée (voir le
 *  commentaire dans `execution_missions.py`) — pour les crédits de la
 *  Défense, le PLRG par mission se retrouvait ainsi attribué à la situation
 *  mensuelle budgétaire par nature, publiée sous « Fichier publié » avec la
 *  bonne source : la même page portait deux provenances contradictoires pour
 *  les deux mêmes montants. Tant que le registre ne garantit pas une entrée
 *  correcte par indicateur, la preuve ne cite que ce que l'analyse déclare
 *  elle-même (`analyse.sources`, listées une fois sous « Fichier publié ») —
 *  jamais un champ que le rendu ne peut pas vérifier.
 *
 *  `version` est le millésime des fichiers publiés que le pré-rendu a
 *  effectivement lus pour construire cette page (`chargerPublication()`,
 *  scripts/prerendre.ts) — jamais `analyse.verifie_contre`, que le contrôle
 *  ne persiste pas et qui reste vide dans tout fichier committé : un pas
 *  toujours vide n'aurait jamais pu s'afficher. */
function preuve(analyse: Analyse, catalogue: Indicateur[], version = ""): string {
  const chemins = analyse.chiffres
    .filter((c) => c.observe)
    .map((chiffre) => {
      const observe = chiffre.observe!;
      const indicateur = catalogue.find((i) => i.id === observe.indicateur);
      const unite = indicateur?.unite ?? "EUR";
      const montant = formater(observe.valeur, unite, false, observe.indicateur);
      const etapes = [
        version ? `Millésime : ${echapper(version)}` : null,
        `Indicateur : ${echapper(indicateur?.libelle ?? observe.indicateur)}`,
        `Territoire : ${echapper(observe.niveau)} ${echapper(observe.code)}`,
        `Période : ${echapper(observe.periode)}`,
        `Valeur : ${montant}`,
      ].filter((e): e is string => e !== null);
      return `<ol class="analyse-rendu__chemin">${etapes.map((e) => `<li>${e}</li>`).join("")}</ol>`;
    })
    .join("");

  const hypotheses = analyse.hypotheses.length
    ? `<ul class="analyse-rendu__hypotheses">${analyse.hypotheses
        .map((h) => `<li>${echapper(h)}</li>`)
        .join("")}</ul>`
    : "";

  const fichiers = analyse.sources.length
    ? `<ul class="analyse-rendu__fichiers">${analyse.sources
        .map((s) => `<li>${lienSource(s)}</li>`)
        .join("")}</ul>`
    : "";

  return `<section class="analyse-rendu__preuve">
    <h3>La preuve</h3>
    ${chemins}
    ${hypotheses}
    <p class="analyse-rendu__fichier-publie">Fichier publié</p>
    ${fichiers}
  </section>`;
}

/** Rendu pur d'une analyse, sans DOM : c'est lui qui est testé.
 *
 *  `version` est le millésime des fichiers publiés que le pré-rendu a lus
 *  (`chargerPublication()`, scripts/prerendre.ts) — optionnel, parce que sans
 *  lui l'étage 4 reste complet et cohérent, seulement sans son pas
 *  « Millésime ». La tâche de pré-rendu passe le vrai millésime.
 *
 *  `adresse` est le permalien absolu de la page, composé par le pré-rendu avec
 *  `permalien()` (partage.ts) — le même que `og:url`. Sans elle, aucun chiffre
 *  n'offre la commande « citer » : ce qui est copié doit ramener au chiffre
 *  depuis n'importe où, et un chemin relatif ne ramène nulle part. */
export function rendu(
  analyse: Analyse,
  catalogue: Indicateur[],
  version = "",
  adresse = "",
): string {
  return `<article class="analyse-rendu" data-slug="${echapper(analyse.slug)}">
    <h2 class="analyse-rendu__titre">${echapper(analyse.titre)}</h2>
    ${express(analyse, catalogue, adresse)}
    ${detail(analyse, catalogue)}
    ${interactif(analyse)}
    ${preuve(analyse, catalogue, version)}
  </article>`;
}

/* --------------------------------------------------------------------------
 * L'index — spec §9.1.
 * ----------------------------------------------------------------------- */

/** Ce que le lecteur a réglé dans la barre. Une facette vide ne retranche
 *  rien : c'est « toutes ». */
export type CriteresIndex = {
  type?: string;
  theme?: string;
  budget?: string;
  recherche?: string;
};

/**
 * Ce qu'une carte porte pour être filtrée.
 *
 * Le rendu l'écrit dans les attributs `data-` de la carte et `main.ts` les
 * relit tels quels : la page est pré-rendue, le paquet n'a pas les analyses
 * sous la main, et une seconde règle de correspondance écrite côté DOM aurait
 * dérivé de celle que les tests vérifient. Une seule règle, deux appelants.
 *
 * `texte` est déjà aplati — sans accents ni casse — par `carteDeLAnalyse` :
 * l'aplatissement se fait une fois, au build, pas à chaque frappe.
 */
export type CarteIndex = {
  type: string;
  /** Les thèmes séparés par une espace, comme un `class` en porte plusieurs. */
  themes: string;
  budgets: string;
  texte: string;
};

export function carteDeLAnalyse(analyse: Analyse): CarteIndex {
  return {
    type: analyse.type,
    themes: analyse.themes.join(" "),
    budgets: analyse.budgets_concernes.join(" "),
    // Ce qu'une recherche doit atteindre : le titre, l'affirmation mise en
    // cause, la phrase du verdict, et de chaque chiffre le montant tel qu'il
    // circule et ce qu'il désigne. La carte n'affiche pas tout cela — on
    // cherche une analyse par ce qu'elle traite, pas par les quelques mots que
    // l'index a la place de montrer.
    texte: aplatir(
      [
        analyse.titre,
        analyse.affirmation.texte,
        analyse.verdict.phrase,
        ...analyse.chiffres.flatMap((c) => [c.dit, c.lecture]),
      ].join(" "),
    ),
  };
}

/**
 * La carte passe-t-elle les critères ?
 *
 * **Chaque mot compte, l'ordre non.** C'est la règle de `chercher()`
 * (simulateur.ts), et c'est celle du site : « aide sociale » doit trouver
 * « Aide à l'insertion sociale », que la contiguïté écartait. Les mots d'une
 * lettre ne filtrent rien et sont ignorés, comme là-bas.
 *
 * Et la liste ne tronque pas : une carte retenue reste visible, quel qu'en
 * soit le nombre.
 */
export function carteRetenue(carte: CarteIndex, criteres: CriteresIndex): boolean {
  if (criteres.type && carte.type !== criteres.type) return false;
  if (criteres.theme && !carte.themes.split(" ").includes(criteres.theme)) return false;
  if (criteres.budget && !carte.budgets.split(" ").includes(criteres.budget)) return false;
  const mots = aplatir((criteres.recherche ?? "").trim())
    .split(/\s+/)
    .filter((m) => m.length >= 2);
  return mots.every((mot) => carte.texte.includes(mot));
}

/** Les analyses que ces critères retiennent, dans l'ordre reçu. */
export function filtrerAnalyses(analyses: Analyse[], criteres: CriteresIndex): Analyse[] {
  return analyses.filter((analyse) => carteRetenue(carteDeLAnalyse(analyse), criteres));
}

/**
 * Une facette du filtre.
 *
 * **Elle ne s'affiche que si le corpus porte au moins deux valeurs
 * distinctes.** Une seule valeur, et le menu ne peut pas changer la liste :
 * quel que soit le réglage, les mêmes cartes restent. C'est du mobilier, et le
 * dépôt ne publie aujourd'hui qu'une analyse — trois menus à une entrée
 * auraient occupé le haut de la page pour ne rien pouvoir faire.
 */
function facette(
  nom: string,
  libelle: string,
  defaut: string,
  valeurs: { valeur: string; libelle: string }[],
): string {
  if (valeurs.length < 2) return "";
  const options = valeurs
    .map((v) => `<option value="${echapper(v.valeur)}">${echapper(v.libelle)}</option>`)
    .join("");
  return `<label class="analyses-filtres__label" for="analyses-${nom}">${echapper(libelle)}</label>
      <select class="pilule pilule--menu" id="analyses-${nom}" data-facette="${nom}">
        <option value="">${echapper(defaut)}</option>${options}
      </select>`;
}

/** Les valeurs distinctes d'une facette, triées par leur libellé. */
function valeursDistinctes(
  brutes: string[],
  libelleDe: (valeur: string) => string,
): { valeur: string; libelle: string }[] {
  return [...new Set(brutes)]
    .map((valeur) => ({ valeur, libelle: libelleDe(valeur) }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
}

/**
 * Le chiffre en cause, sur une carte.
 *
 * **Le premier chiffre, jamais tous.** Une analyse peut en aligner cinq ; les
 * étaler sur une carte referait l'étage 1 dans l'index, et une liste de
 * verdicts qu'il faut lire en entier ne se parcourt plus. Le premier est celui
 * que l'analyse met en avant — l'ordre de `chiffres[]` est celui de sa
 * lecture — et le cran juste dessous dit ce qui le sépare du montant publié.
 * Le reste est à un clic.
 */
function chiffreEnCause(analyse: Analyse, catalogue: Indicateur[]): string {
  const chiffre = analyse.chiffres[0];
  if (!chiffre) return "";
  const dit = `Cité comme « ${echapper(chiffre.dit)} »`;
  if (chiffre.observe) {
    const unite = uniteDe(catalogue, chiffre.observe.indicateur);
    const montant = formater(chiffre.observe.valeur, unite, false, chiffre.observe.indicateur);
    return `<p class="analyse-rendu__index-chiffre">${dit}, publié : <strong>${montant}</strong> (exercice ${echapper(
      chiffre.observe.periode,
    )})</p>`;
  }
  // Sans observation publiée, le fichier déclare lui-même une valeur
  // (docs/analyses-schema.md) : elle s'affiche sous le nom de son registre,
  // exactement comme l'étage 1 le fait — un `dit` nu ne porte pas une carte.
  const registre = echapper(LIBELLE_REGISTRE[chiffre.registre]);
  const valeur =
    chiffre.valeur != null
      ? ` — ${registre} : <strong>${formater(chiffre.valeur, "EUR", false)}</strong>`
      : ` — ${registre}`;
  return `<p class="analyse-rendu__index-chiffre">${dit}${valeur}</p>`;
}

/**
 * L'index des analyses : la plus récente d'abord, les révisées marquées.
 *
 * La page est pré-rendue (scripts/prerendre.ts) et servie telle quelle : sans
 * JavaScript, toutes les cartes sont visibles et lisibles. La barre part donc
 * **repliée** — `main.ts` la déplie quand il l'a câblée. Un menu qui ne filtre
 * rien serait pire qu'absent.
 */
export function renduIndex(analyses: Analyse[], catalogue: Indicateur[]): string {
  const triees = [...analyses].sort((a, b) => b.publie_le.localeCompare(a.publie_le));
  const lignes = triees
    .map((a) => {
      const badge = a.mises_a_jour.length
        ? `<span class="analyse-rendu__badge-maj">Mise à jour</span>`
        : "";
      // Un cran `hors_perimetre` nomme toujours la confusion (spec §9.2) : la
      // règle vaut ici comme à l'étage 1. « Le chiffre existe, mais pas pour
      // ce qu'il désigne » sans dire ce qui est confondu demande au lecteur de
      // se méfier sans rien lui donner à lire autrement.
      const confusion =
        a.verdict.cran === "hors_perimetre" && a.verdict.confusion
          ? ` — <span class="analyse-rendu__index-confusion">${echapper(
              LIBELLE_CONFUSION[a.verdict.confusion],
            )}</span>`
          : "";
      const carte = carteDeLAnalyse(a);
      // Un lien de fragment (`#slug`) ne résout que si l'index et l'analyse
      // sont composés sur la même page — ce que ce module ne fait jamais :
      // `rendu()` produit un `<article>` par page, à son propre chemin
      // (tâche 4, `dist/analyses/<slug>/index.html`). C'est ce chemin réel
      // que l'index doit viser.
      return `<li class="analyse-rendu__index-ligne" data-type="${echapper(
        carte.type,
      )}" data-themes="${echapper(carte.themes)}" data-budgets="${echapper(
        carte.budgets,
      )}" data-cherche="${echapper(carte.texte)}">
        <p class="analyse-rendu__index-entete">
          <a href="/analyses/${echapper(a.slug)}/">${echapper(a.titre)}</a>
          <time datetime="${echapper(a.publie_le)}">${echapper(a.publie_le)}</time>
          ${badge}
        </p>
        ${chiffreEnCause(a, catalogue)}
        <p class="analyse-rendu__index-cran">${LIBELLE_CRAN[a.verdict.cran]}${confusion}</p>
      </li>`;
    })
    .join("");

  // Une barre ne peut rien réduire sous deux analyses — même raison que pour
  // une facette à valeur unique, un cran plus haut.
  const barre =
    triees.length < 2
      ? ""
      : `<div class="analyses-filtres" id="analyses-filtres" hidden>
      <label class="analyses-filtres__label" for="analyses-recherche">Chercher</label>
      <input class="analyses-filtres__champ" id="analyses-recherche" type="search"
             autocomplete="off" placeholder="Un mot du chiffre, du verdict ou du titre" />
      ${facette(
        "type",
        "Type",
        "Tous les types",
        valeursDistinctes(
          triees.map((a) => a.type),
          (v) => LIBELLE_TYPE[v as TypeAnalyse] ?? v,
        ),
      )}
      ${facette(
        "theme",
        "Thème",
        "Tous les thèmes",
        valeursDistinctes(
          triees.flatMap((a) => a.themes),
          libelleTheme,
        ),
      )}
      ${facette(
        "budget",
        "Budget",
        "Tous les budgets",
        valeursDistinctes(
          triees.flatMap((a) => a.budgets_concernes),
          (v) => LIBELLE_BUDGET[v as BudgetConcerne] ?? v,
        ),
      )}
      <p class="analyses-filtres__compte" role="status"></p>
    </div>`;

  // « Dire l'unité là où le nombre est gros » (CLAUDE.md). C'est la page où
  // la confusion est la plus facile : chaque carte met « environ 59,9
  // milliards d'euros » à côté de « 59 946 M€ », et lu vite, le second se lit
  // comme le premier. La ligne est un cadrage, pas une réserve : elle dit dans
  // quelle unité lire les chiffres, elle ne demande pas de s'en méfier.
  const unite = triees.length
    ? `<p class="analyse-rendu__index-unite">Montants en millions d'euros.</p>`
    : "";
  return `${barre}${unite}<ul class="analyse-rendu__index" id="analyses-index">${lignes}</ul>`;
}
