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

import {
  sourceDePreuve,
  validerDossierAnalyse,
  type DossierAnalyse,
  type DossierAnalyseValide,
  type PreuveAnalyse,
  type SerieAnalyse,
  type SourceAnalyse,
  type VisualisationAnalyse,
} from "./analyse-contrat.ts";
import { citable, type Citation } from "./citer.ts";
import type { Indicateur } from "./donnees.ts";
import { formater, formaterValeurAnalyse, libelleUniteAnalyse } from "./echelle.ts";
import { lienSource, sourceIdPourUrl, type IndexSources } from "./registre-sources.ts";
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

/**
 * Le libellé éditorial que les nouveaux dossiers affichent en premier.
 *
 * Il reste distinct du `Cran`, qui est le constat factuel du fichier source :
 * une qualification peut évoluer côté interface sans changer les quatre JSON
 * publiés ni leur contrat de contrôle.
 */
export type QualificationVerdict =
  | "confirme"
  | "ordre_grandeur"
  | "contexte_manquant"
  | "perimetre_trompeur"
  | "non_demontre"
  | "contredit";

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

export type Source = { id?: string; titre: string; url: string; consulte_le: string };

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
  /** Absent sur les dossiers historiques ; présent, ce contenu suit le
   *  contrat strict de `analyse-contrat.ts`. */
  dossier?: DossierAnalyse;
};

/**
 * Adapte les sources historiques au contrat long seulement quand celui-ci est
 * présent. Les anciens JSON n'ont pas d'identifiant de source et n'en ont pas
 * besoin ; un nouveau dossier, lui, échoue si l'un d'eux manque.
 */
export function contratDossierAnalyse(analyse: Analyse): DossierAnalyseValide | null {
  if (analyse.dossier === undefined) return null;
  const sources: SourceAnalyse[] = analyse.sources.map((source) => ({
    id: source.id ?? "",
    titre: source.titre,
    url: source.url,
    consulteLe: source.consulte_le,
  }));
  return validerDossierAnalyse(analyse.dossier, sources);
}

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

/** Les six verdicts stables de l'interface éditoriale. */
export const LIBELLE_QUALIFICATION: Record<QualificationVerdict, string> = {
  confirme: "Confirmé",
  ordre_grandeur: "Ordre de grandeur correct",
  contexte_manquant: "Contexte manquant",
  perimetre_trompeur: "Périmètre trompeur",
  non_demontre: "Non démontré",
  contredit: "Contredit",
};

function assertNever(valeur: never): never {
  throw new Error(`Valeur de verdict non prise en charge : ${String(valeur)}`);
}

/**
 * Chaque confusion du contrat existant a une qualification distincte et
 * stable. Le `switch` reste délibérément exhaustif : ajouter une confusion au
 * schéma impose de décider de son libellé, plutôt que de la faire glisser
 * silencieusement dans une qualification générique.
 */
function qualificationConfusion(confusion: Confusion): QualificationVerdict {
  switch (confusion) {
    case "ae_cp":
    case "vote_execute":
      return "contexte_manquant";
    case "brut_net":
      return "ordre_grandeur";
    case "stock_flux":
    case "annuel_cumule":
      return "contredit";
    case "etat_apu":
    case "perimetre_geographique":
      return "perimetre_trompeur";
    default:
      return assertNever(confusion);
  }
}

/**
 * Dérive un verdict de lecture à partir du constat déjà contrôlé par le
 * pipeline. La prose libre de `verdict.phrase` n'est jamais interrogée : elle
 * explique le verdict, elle ne doit pas modifier sa classification.
 */
export function qualificationVerdict(analyse: Analyse): QualificationVerdict {
  switch (analyse.verdict.cran) {
    case "exact":
      return "confirme";
    case "introuvable":
      return "non_demontre";
    case "hors_perimetre": {
      const confusion = analyse.verdict.confusion;
      if (!confusion) {
        throw new Error("Un verdict hors_perimetre doit préciser sa confusion");
      }
      return qualificationConfusion(confusion);
    }
    default:
      return assertNever(analyse.verdict.cran);
  }
}

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
function lienPrimaire(source: Source): string {
  return `<a href="${echapper(source.url)}" target="_blank" rel="noopener">${echapper(
    source.titre,
  )}</a> <span class="analyse-rendu__consulte">(consulté le ${echapper(source.consulte_le)})</span>`;
}

/** Le document primaire reste cité ; le registre ajoute son chemin vérifiable. */
function lienRegistre(source: Source, indexSources?: IndexSources): string {
  const id = indexSources ? sourceIdPourUrl(indexSources, source.url) : undefined;
  return id ? ` <a class="analyse-rendu__registre-source" href="${lienSource(id)}">Voir dans le registre</a>` : "";
}

/** L'unité d'un indicateur cité, lue dans le catalogue — jamais dans l'analyse :
 *  le fichier d'analyse ne porte pas d'unité, c'est le catalogue qui fait foi. */
function uniteDe(catalogue: Indicateur[], id: string): string {
  return catalogue.find((i) => i.id === id)?.unite ?? "EUR";
}

/** L'unité publiée reste visible même lorsque le formateur choisit une échelle
 * plus lisible (M€ pour les grandes masses, % pour un taux). */
function libelleUnite(unite: string): string {
  switch (unite) {
    case "EUR":
      return "euros";
    case "percent":
    case "rate":
      return "pourcentage";
    case "count":
      return "nombre";
    case "mwh":
      return "mégawattheures";
    case "m2":
      return "mètres carrés";
    default:
      return unite;
  }
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

/** La conclusion du dossier précède les chiffres : elle donne le niveau de
 * certitude et le constat contrôlé avant toute explication méthodologique. */
function verdictDuDossier(analyse: Analyse): string {
  const { verdict } = analyse;
  const qualification = qualificationVerdict(analyse);
  const confusion =
    verdict.cran === "hors_perimetre" && verdict.confusion
      ? `<p class="analyse-rendu__confusion">${echapper(LIBELLE_CONFUSION[verdict.confusion])}</p>`
      : "";
  return `<section class="dossier-preuve__verdict">
    <p class="dossier-preuve__eyebrow">Verdict</p>
    <h2>${echapper(LIBELLE_QUALIFICATION[qualification])}</h2>
    <p class="analyse-rendu__verdict analyse-rendu__verdict--${echapper(verdict.cran)}">${
      LIBELLE_CRAN[verdict.cran]
    }</p>
    <p class="analyse-rendu__phrase">${echapper(verdict.phrase)}</p>
    ${confusion}
  </section>`;
}

/** Étage 1 : le chiffre cité face au chiffre publié, et le verdict. */
function express(
  analyse: Analyse,
  catalogue: Indicateur[],
  adresse: string,
  indexSources?: IndexSources,
): string {
  const { affirmation } = analyse;
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
  return `<section class="analyse-rendu__express dossier-preuve__confrontation">
    <h2>Confronter l'affirmation aux comptes</h2>
    <p class="dossier-preuve__intro">Affirmation contrôlée</p>
    <blockquote class="analyse-rendu__affirmation">${echapper(affirmation.texte)}</blockquote>
    ${attribution}
    <p class="analyse-rendu__source">${lienPrimaire(affirmation.source)}${lienRegistre(
      affirmation.source,
      indexSources,
    )}</p>
    <ul class="analyse-rendu__chiffres-cites">${chiffresCites}</ul>
  </section>`;
}

/** Étage 2 : la phrase du verdict, les chiffres avec leurs exercices en
 *  colonnes, les effets indirects — distincts des chiffres calculés. */
function detail(analyse: Analyse, catalogue: Indicateur[]): string {
  const exercices = [
    ...new Set(analyse.chiffres.map((c) => c.observe?.periode).filter((p): p is string => !!p)),
  ].sort();

  const uniteDuChiffre = (chiffre: Analyse["chiffres"][number]) =>
    chiffre.observe ? uniteDe(catalogue, chiffre.observe.indicateur) : "EUR";
  const unites = [...new Set(analyse.chiffres.map(uniteDuChiffre))];

  const lignes = analyse.chiffres
    .map((chiffre) => {
      const observe = chiffre.observe;
      const classe = `analyse-rendu__chiffre analyse-rendu__chiffre--${echapper(chiffre.registre)}`;
      const unite = uniteDuChiffre(chiffre);
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
              const montant = formater(observe.valeur, unite, false, observe.indicateur);
              return `<td class="${classe}">${montant}</td>`;
            })
            .join("");
      return `<tr>
        <th scope="row">${echapper(chiffre.lecture)}
          <span class="analyse-rendu__registre">${echapper(LIBELLE_REGISTRE[chiffre.registre])}</span>
          <span class="analyse-rendu__unite">Unité publiée : ${echapper(libelleUnite(unite))}</span>
        </th>
        ${cellules}
      </tr>`;
    })
    .join("");

  // L'unité reste au plus près du tableau. Une analyse peut comparer une masse
  // en euros et une part du PIB : la légende énumère donc les unités publiées
  // au lieu de faire passer toutes les lignes pour des millions d'euros.
  const legende = `<caption>Unités publiées : ${unites.map(libelleUnite).map(echapper).join(" ; ")}.</caption>`;

  // Un exercice par colonne : sur une analyse à plusieurs millésimes, le
  // tableau déborde de la carte, et c'est lui qui défile — jamais la page
  // entière (même règle que `.analyses__defilement`).
  const tableau = `<div class="analyse-rendu__defilement" tabindex="0"><table class="analyse-rendu__tableau">
    ${legende}
    <thead><tr><th scope="col">Chiffre</th>${exercices
      .map((e) => `<th scope="col">${echapper(e)}</th>`)
      .join("")}${exercices.length ? "" : "<th scope=\"col\">Valeur</th>"}</tr></thead>
    <tbody>${lignes}</tbody>
  </table></div>`;

  return `<section class="analyse-rendu__detail dossier-preuve__donnees">
    <h2>Les données utiles</h2>
    ${tableau}
  </section>`;
}

/** Étage 3 : le renvoi vers le simulateur. Un bouton qui n'ouvrirait aucun
 *  réglage serait un lien mort — sans `budget`, il n'y a pas de bouton. */
function interactif(analyse: Analyse): string {
  const { simulateur } = analyse;
  if (!simulateur.budget) {
    return `<section class="analyse-rendu__interactif">
      <h2>L'interactif</h2>
      <p class="analyse-rendu__lecture-simulateur">${echapper(simulateur.lecture)}</p>
    </section>`;
  }
  const parametres = new URLSearchParams({ budget: simulateur.budget });
  if (simulateur.contrat) parametres.set("contrat", simulateur.contrat);
  const lien = `/simulateur?${parametres.toString()}`;
  return `<section class="analyse-rendu__interactif">
    <h2>L'interactif</h2>
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

  return `<section class="analyse-rendu__preuve dossier-preuve__chemin">
    <h2>Le chemin de preuve</h2>
    ${chemins}
  </section>`;
}

/** Réserves et conséquences attribuées sont séparées des mesures publiées. */
function limites(analyse: Analyse): string {
  const hypotheses = analyse.hypotheses.length
    ? `<ul class="analyse-rendu__hypotheses">${analyse.hypotheses
        .map((hypothese) => `<li>${echapper(hypothese)}</li>`)
        .join("")}</ul>`
    : "";
  const effets = analyse.effets_indirects.length
    ? `<ul class="analyse-rendu__effets-indirects">${analyse.effets_indirects
        .map(
          (effet) => `<li class="analyse-rendu__effet-indirect">${echapper(
            effet.texte,
          )} — ${echapper(effet.auteur)} (${lienPrimaire(effet.source)})</li>`,
        )
        .join("")}</ul>`
    : "";
  const contenu = hypotheses || effets || "<p>Aucune réserve spécifique n'est déclarée pour ce dossier.</p>";
  return `<section class="dossier-preuve__limites">
    <h2>Limites et réserves</h2>
    ${contenu}
  </section>`;
}

/** Les citations primaires restent accessibles indépendamment du chemin
 * synthétique : elles permettent de retrouver le document d'origine. */
function sources(analyse: Analyse, indexSources?: IndexSources): string {
  const uniques = analyse.sources.filter((source, index, liste) =>
    liste.findIndex((candidate) => candidate.url.trim() === source.url.trim()) === index
  );
  const fichiers = uniques.length
    ? `<ul class="analyse-rendu__fichiers">${uniques
        .map((s) => `<li>${lienPrimaire(s)}${lienRegistre(s, indexSources)}</li>`)
        .join("")}</ul>`
    : "<p>Aucune source primaire n'est déclarée.</p>";
  return `<section class="dossier-preuve__sources">
    <h2>Sources et reproduction</h2>
    <p class="analyse-rendu__fichier-publie">Fichier publié</p>
    ${fichiers}
  </section>`;
}

/* --------------------------------------------------------------------------
 * Dossiers longs : chaque valeur reste attachée à son unité, sa définition et
 * sa source locale. Ce chemin ne lit aucun chiffre du catalogue historique.
 * ----------------------------------------------------------------------- */

function sourceHistorique(source: SourceAnalyse): Source {
  return {
    id: source.id,
    titre: source.titre,
    url: source.url,
    consulte_le: source.consulteLe,
  };
}

function lienSourceDossier(source: SourceAnalyse, indexSources?: IndexSources): string {
  const historique = sourceHistorique(source);
  return `${lienPrimaire(historique)}${lienRegistre(historique, indexSources)}`;
}

function dateFrancaise(dateIso: string): string {
  const correspondance = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  if (!correspondance) return dateIso;
  const mois = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ];
  const numeroMois = Number(correspondance[2]);
  const libelleMois = mois[numeroMois - 1];
  if (!libelleMois) return dateIso;
  return `${Number(correspondance[3])} ${libelleMois} ${correspondance[1]}`;
}

/** Une preuve longue connaît sa source par identifiant. Aucun ordre de liste
 * ne participe à l'attribution de la citation. */
function commandeCiterPreuve(
  preuve: PreuveAnalyse,
  contrat: DossierAnalyseValide,
  adresse: string,
): string {
  const source = sourceDePreuve(contrat, preuve.id);
  const citation: Citation = {
    libelle: preuve.libelle,
    valeur: preuve.value,
    unite: preuve.unit,
    id: preuve.seriesId ?? preuve.id,
    source: source.titre,
    millesime: preuve.period,
    permalien: adresse,
  };
  if (!citable(citation)) return "";
  return ` <button type="button" class="citer" data-citer="${echapper(
    JSON.stringify(citation),
  )}">Citer ce chiffre</button>`;
}

function signauxQualite(flags: readonly string[] | undefined): string {
  if (!flags?.length) return "";
  return `<ul class="analyse-longue__qualite" aria-label="Signaux de qualité">${flags
    .map((flag) => `<li>${echapper(flag)}</li>`)
    .join("")}</ul>`;
}

function texteSignauxQualite(flags: readonly string[] | undefined): string {
  return flags?.length ? flags.map(echapper).join(", ") : "Aucun signal déclaré";
}

function renduPreuveLongue(
  preuve: PreuveAnalyse,
  contrat: DossierAnalyseValide,
  adresse: string,
  indexSources?: IndexSources,
): string {
  const source = sourceDePreuve(contrat, preuve.id);
  return `<article class="analyse-longue__preuve" id="preuve-${echapper(
    preuve.id,
  )}" data-preuve-id="${echapper(preuve.id)}">
    <h3>${echapper(preuve.libelle)}</h3>
    <p class="analyse-longue__valeur"><strong>${echapper(
      formaterValeurAnalyse(preuve.value, preuve.unit),
    )}</strong> <span>${echapper(libelleUniteAnalyse(preuve.unit))}</span></p>
    <p class="analyse-longue__periode">Période : ${echapper(preuve.period)}</p>
    <p class="analyse-longue__definition">${echapper(preuve.definition)}</p>
    ${signauxQualite(preuve.qualityFlags)}
    <p class="analyse-longue__source">Source : ${lienSourceDossier(
      source,
      indexSources,
    )}${commandeCiterPreuve(preuve, contrat, adresse)}</p>
  </article>`;
}

function unitesVisualisation(
  visualisation: VisualisationAnalyse,
  contrat: DossierAnalyseValide,
): Map<string, { series: SerieAnalyse[]; preuves: PreuveAnalyse[] }> {
  const groupes = new Map<string, { series: SerieAnalyse[]; preuves: PreuveAnalyse[] }>();
  const groupe = (unite: string) => {
    const existant = groupes.get(unite);
    if (existant) return existant;
    const nouveau = { series: [] as SerieAnalyse[], preuves: [] as PreuveAnalyse[] };
    groupes.set(unite, nouveau);
    return nouveau;
  };
  for (const id of visualisation.seriesIds ?? []) {
    const serie = contrat.serieParId.get(id);
    if (serie) groupe(serie.unit).series.push(serie);
  }
  for (const id of visualisation.preuveIds ?? []) {
    const preuve = contrat.preuveParId.get(id);
    if (preuve) groupe(preuve.unit).preuves.push(preuve);
  }
  return groupes;
}

function axesVisualisation(
  visualisation: VisualisationAnalyse,
  contrat: DossierAnalyseValide,
): string {
  if (visualisation.axes?.length) {
    return `<dl class="analyse-longue__axes">${visualisation.axes
      .map((axe, index) => {
        const noms = axe.seriesIds
          .map((id) => contrat.serieParId.get(id)?.libelle ?? id)
          .map(echapper)
          .join(" ; ");
        return `<div data-axis-id="${echapper(axe.id)}"><dt>Axe ${index + 1}</dt><dd>${echapper(
          libelleUniteAnalyse(axe.unit),
        )} : ${noms}</dd></div>`;
      })
      .join("")}</dl>`;
  }

  const groupes = unitesVisualisation(visualisation, contrat);
  if (groupes.size === 1) {
    const [unite] = groupes.keys();
    return `<p class="analyse-longue__unite-figure">Unité : ${echapper(
      libelleUniteAnalyse(unite!),
    )}</p>`;
  }
  // Les instantanés peuvent mêler des unités sans porter d'axes au contrat.
  // Le rendu crée alors un groupe nommé par unité, jamais un axe implicite.
  return `<dl class="analyse-longue__axes">${[...groupes.entries()]
    .map(([unite, contenu], index) => {
      const noms = [...contenu.series, ...contenu.preuves]
        .map((element) => element.libelle)
        .map(echapper)
        .join(" ; ");
      return `<div data-axis-id="unite-${index + 1}"><dt>Échelle ${index + 1}</dt><dd>${echapper(
        libelleUniteAnalyse(unite),
      )} : ${noms}</dd></div>`;
    })
    .join("")}</dl>`;
}

function lignesFigureSeries(
  visualisation: VisualisationAnalyse,
  contrat: DossierAnalyseValide,
  indexSources?: IndexSources,
): string {
  return (visualisation.seriesIds ?? [])
    .flatMap((id) => {
      const serie = contrat.serieParId.get(id);
      if (!serie) return [];
      const source = contrat.sourceParId.get(serie.sourceId)!;
      return serie.observations.map(
        (observation) => `<tr>
          <th scope="row">${echapper(serie.libelle)}</th>
          <td>${echapper(observation.period)}</td>
          <td>${echapper(formaterValeurAnalyse(observation.value, serie.unit))}</td>
          <td>${echapper(libelleUniteAnalyse(serie.unit))}</td>
          <td>${echapper(serie.definition)}</td>
          <td>${lienSourceDossier(source, indexSources)}</td>
          <td>${texteSignauxQualite(observation.qualityFlags)}</td>
        </tr>`,
      );
    })
    .join("");
}

function lignesFigurePreuves(
  visualisation: VisualisationAnalyse,
  contrat: DossierAnalyseValide,
  indexSources?: IndexSources,
): string {
  return (visualisation.preuveIds ?? [])
    .map((id) => {
      const preuve = contrat.preuveParId.get(id)!;
      const source = sourceDePreuve(contrat, id);
      return `<tr>
        <th scope="row">${echapper(preuve.libelle)}</th>
        <td>${echapper(preuve.period)}</td>
        <td>${echapper(formaterValeurAnalyse(preuve.value, preuve.unit))}</td>
        <td>${echapper(libelleUniteAnalyse(preuve.unit))}</td>
        <td>${echapper(preuve.definition)}</td>
        <td>${lienSourceDossier(source, indexSources)}</td>
        <td>${texteSignauxQualite(preuve.qualityFlags)}</td>
      </tr>`;
    })
    .join("");
}

function renduVisualisationLongue(
  visualisation: VisualisationAnalyse,
  contrat: DossierAnalyseValide,
  niveauTitre: 2 | 3,
  indexSources?: IndexSources,
): string {
  const identifiant = echapper(visualisation.id);
  const Titre = `h${niveauTitre}`;
  const lignes = `${lignesFigureSeries(visualisation, contrat, indexSources)}${lignesFigurePreuves(
    visualisation,
    contrat,
    indexSources,
  )}`;
  return `<figure class="analyse-longue__figure analyse-longue__figure--${echapper(
    visualisation.type,
  )}" id="figure-${identifiant}" aria-labelledby="figure-${identifiant}-titre" aria-describedby="figure-${identifiant}-resume">
    <figcaption>
      <${Titre} id="figure-${identifiant}-titre">${echapper(visualisation.titre)}</${Titre}>
      <p id="figure-${identifiant}-resume">${echapper(visualisation.resume)}</p>
    </figcaption>
    ${axesVisualisation(visualisation, contrat)}
    <div class="analyse-longue__defilement" tabindex="0" role="region" aria-label="Données de la figure ${echapper(
      visualisation.titre,
    )}">
      <table class="analyse-longue__tableau">
        <caption>Données de la figure : ${echapper(visualisation.titre)}</caption>
        <thead><tr>
          <th scope="col">Série ou preuve</th>
          <th scope="col">Période</th>
          <th scope="col">Valeur</th>
          <th scope="col">Unité</th>
          <th scope="col">Définition</th>
          <th scope="col">Source</th>
          <th scope="col">Qualité</th>
        </tr></thead>
        <tbody>${lignes}</tbody>
      </table>
    </div>
  </figure>`;
}

function renduSommaireLong(contrat: DossierAnalyseValide): string {
  const ids = contrat.dossier.sommaire ?? contrat.dossier.sections.map((section) => section.id);
  const sections = ids.map((id) => contrat.sectionParId.get(id)!);
  const liens = [
    ...sections.map(
      (section) => `<li><a href="#${echapper(section.id)}">${echapper(section.titre)}</a></li>`,
    ),
    '<li><a href="#limites">Limites</a></li>',
    '<li><a href="#methode">Méthode</a></li>',
    '<li><a href="#donnees-completes">Données complètes</a></li>',
    '<li><a href="#sources">Sources</a></li>',
  ].join("");
  return `<nav class="analyse-longue__sommaire" aria-label="Sommaire">
    <h2>Sommaire</h2>
    <ol>${liens}</ol>
  </nav>`;
}

function renduSectionsLongues(
  contrat: DossierAnalyseValide,
  adresse: string,
  preuvesRendues: Set<string>,
  visualisationsRendues: Set<string>,
  indexSources?: IndexSources,
): string {
  return contrat.dossier.sections
    .map((section) => {
      const preuves = (section.preuveIds ?? [])
        .map((id) => {
          const preuve = contrat.preuveParId.get(id)!;
          if (preuvesRendues.has(id)) {
            return `<li><a href="#preuve-${echapper(id)}">${echapper(preuve.libelle)}</a></li>`;
          }
          preuvesRendues.add(id);
          return `<li class="analyse-longue__preuve-integree">${renduPreuveLongue(
            preuve,
            contrat,
            adresse,
            indexSources,
          )}</li>`;
        })
        .join("");
      const visualisations = (section.visualisationIds ?? [])
        .map((id) => {
          if (visualisationsRendues.has(id)) return "";
          visualisationsRendues.add(id);
          return renduVisualisationLongue(
            contrat.visualisationParId.get(id)!,
            contrat,
            3,
            indexSources,
          );
        })
        .join("");
      return `<section class="analyse-longue__section" id="${echapper(section.id)}">
        <h2>${echapper(section.titre)}</h2>
        <div class="analyse-longue__prose">${section.paragraphes
          .map((paragraphe) => `<p>${echapper(paragraphe)}</p>`)
          .join("")}</div>
        ${preuves ? `<ul class="analyse-longue__renvois">${preuves}</ul>` : ""}
        ${visualisations}
      </section>`;
    })
    .join("");
}

function renduPreuvesComplementaires(
  contrat: DossierAnalyseValide,
  adresse: string,
  preuvesRendues: Set<string>,
  indexSources?: IndexSources,
): string {
  const restantes = contrat.dossier.preuves.filter((preuve) => !preuvesRendues.has(preuve.id));
  if (!restantes.length) return "";
  restantes.forEach((preuve) => preuvesRendues.add(preuve.id));
  return `<section class="analyse-longue__complements">
    <h2>Preuves complémentaires</h2>
    <div class="analyse-longue__preuves">${restantes
      .map((preuve) => renduPreuveLongue(preuve, contrat, adresse, indexSources))
      .join("")}</div>
  </section>`;
}

function renduVisualisationsComplementaires(
  contrat: DossierAnalyseValide,
  visualisationsRendues: Set<string>,
  indexSources?: IndexSources,
): string {
  const restantes = contrat.dossier.visualisations.filter(
    (visualisation) => !visualisationsRendues.has(visualisation.id),
  );
  if (!restantes.length) return "";
  restantes.forEach((visualisation) => visualisationsRendues.add(visualisation.id));
  return `<section class="analyse-longue__complements">
    <h2>Visualisations complémentaires</h2>
    ${restantes
      .map((visualisation) => renduVisualisationLongue(visualisation, contrat, 3, indexSources))
      .join("")}
  </section>`;
}

function renduLimitesLongues(contrat: DossierAnalyseValide): string {
  return `<section class="analyse-longue__limites" id="limites">
    <h2>Ce que les données ne permettent pas de conclure</h2>
    <ul>${contrat.dossier.limitations
      .map((limitation) => `<li>${echapper(limitation)}</li>`)
      .join("")}</ul>
  </section>`;
}

function renduMethodeLongue(
  contrat: DossierAnalyseValide,
  version: string,
  indexSources?: IndexSources,
): string {
  const series = contrat.dossier.series
    .map((serie) => {
      const source = contrat.sourceParId.get(serie.sourceId)!;
      return `<div>
        <dt>${echapper(serie.libelle)}</dt>
        <dd>
          <p>${echapper(serie.definition)}</p>
          <p>Unité publiée : ${echapper(libelleUniteAnalyse(serie.unit))}.</p>
          <p>Source : ${lienSourceDossier(source, indexSources)}</p>
        </dd>
      </div>`;
    })
    .join("");
  const instantanes = contrat.dossier.preuves
    .filter((preuve) => !preuve.seriesId)
    .map((preuve) => {
      const source = sourceDePreuve(contrat, preuve.id);
      return `<div>
        <dt>${echapper(preuve.libelle)}</dt>
        <dd>
          <p>${echapper(preuve.definition)}</p>
          <p>Unité publiée : ${echapper(libelleUniteAnalyse(preuve.unit))}.</p>
          <p>Source : ${lienSourceDossier(source, indexSources)}</p>
        </dd>
      </div>`;
    })
    .join("");
  const millesime = version
    ? `<p class="analyse-longue__version">Version des données utilisées : ${echapper(version)}.</p>`
    : "";
  return `<section class="analyse-longue__methode" id="methode">
    <h2>Méthode et périmètre</h2>
    ${millesime}
    <dl>${series}${instantanes}</dl>
  </section>`;
}

function groupesSeriesParUnite(series: readonly SerieAnalyse[]): Map<string, SerieAnalyse[]> {
  const groupes = new Map<string, SerieAnalyse[]>();
  for (const serie of series) {
    const groupe = groupes.get(serie.unit) ?? [];
    groupe.push(serie);
    groupes.set(serie.unit, groupe);
  }
  return groupes;
}

function tableauSeriesCompletes(
  unite: string,
  series: readonly SerieAnalyse[],
  contrat: DossierAnalyseValide,
  indexSources?: IndexSources,
): string {
  const lignes = series
    .flatMap((serie) => {
      const source = contrat.sourceParId.get(serie.sourceId)!;
      return serie.observations.map(
        (observation) => `<tr>
          <th scope="row">${echapper(serie.libelle)}</th>
          <td>${echapper(observation.period)}</td>
          <td>${echapper(formaterValeurAnalyse(observation.value, serie.unit))}</td>
          <td>${echapper(serie.definition)}</td>
          <td>${lienSourceDossier(source, indexSources)}</td>
          <td>${texteSignauxQualite(observation.qualityFlags)}</td>
        </tr>`,
      );
    })
    .join("");
  return `<section class="analyse-longue__groupe-unite" data-unit="${echapper(unite)}">
    <h3>${echapper(libelleUniteAnalyse(unite))}</h3>
    <div class="analyse-longue__defilement" tabindex="0" role="region" aria-label="Séries en ${echapper(
      libelleUniteAnalyse(unite),
    )}">
      <table class="analyse-longue__tableau">
        <caption>Séries publiées en ${echapper(libelleUniteAnalyse(unite))}</caption>
        <thead><tr>
          <th scope="col">Série</th><th scope="col">Période</th><th scope="col">Valeur</th>
          <th scope="col">Définition</th><th scope="col">Source</th><th scope="col">Qualité</th>
        </tr></thead>
        <tbody>${lignes}</tbody>
      </table>
    </div>
  </section>`;
}

function tableauxInstantanes(
  contrat: DossierAnalyseValide,
  indexSources?: IndexSources,
): string {
  const groupes = new Map<string, PreuveAnalyse[]>();
  contrat.dossier.preuves
    .filter((preuve) => !preuve.seriesId)
    .forEach((preuve) => {
      const groupe = groupes.get(preuve.unit) ?? [];
      groupe.push(preuve);
      groupes.set(preuve.unit, groupe);
    });
  return [...groupes.entries()]
    .map(([unite, preuves]) => {
      const lignes = preuves
        .map((preuve) => {
          const source = sourceDePreuve(contrat, preuve.id);
          return `<tr>
            <th scope="row">${echapper(preuve.libelle)}</th>
            <td>${echapper(preuve.period)}</td>
            <td>${echapper(formaterValeurAnalyse(preuve.value, preuve.unit))}</td>
            <td>${echapper(preuve.definition)}</td>
            <td>${lienSourceDossier(source, indexSources)}</td>
            <td>${texteSignauxQualite(preuve.qualityFlags)}</td>
          </tr>`;
        })
        .join("");
      return `<section class="analyse-longue__groupe-unite" data-unit="${echapper(unite)}">
        <h3>Instantanés, ${echapper(libelleUniteAnalyse(unite))}</h3>
        <div class="analyse-longue__defilement" tabindex="0" role="region" aria-label="Instantanés en ${echapper(
          libelleUniteAnalyse(unite),
        )}">
          <table class="analyse-longue__tableau">
            <caption>Instantanés publiés en ${echapper(libelleUniteAnalyse(unite))}</caption>
            <thead><tr>
              <th scope="col">Preuve</th><th scope="col">Période</th><th scope="col">Valeur</th>
              <th scope="col">Définition</th><th scope="col">Source</th><th scope="col">Qualité</th>
            </tr></thead>
            <tbody>${lignes}</tbody>
          </table>
        </div>
      </section>`;
    })
    .join("");
}

function renduDonneesCompletes(
  contrat: DossierAnalyseValide,
  indexSources?: IndexSources,
): string {
  const series = [...groupesSeriesParUnite(contrat.dossier.series).entries()]
    .map(([unite, groupe]) => tableauSeriesCompletes(unite, groupe, contrat, indexSources))
    .join("");
  return `<section class="analyse-longue__donnees" id="donnees-completes">
    <h2>Données complètes</h2>
    ${series}
    ${tableauxInstantanes(contrat, indexSources)}
  </section>`;
}

function renduSourcesLongues(
  contrat: DossierAnalyseValide,
  indexSources?: IndexSources,
): string {
  return `<section class="analyse-longue__sources" id="sources">
    <h2>Sources</h2>
    <ol>${contrat.sources
      .map(
        (source) => `<li data-source-id="${echapper(source.id)}">${lienSourceDossier(
          source,
          indexSources,
        )}</li>`,
      )
      .join("")}</ol>
  </section>`;
}

function renduDossierLong(
  analyse: Analyse,
  contrat: DossierAnalyseValide,
  version: string,
  adresse: string,
  indexSources?: IndexSources,
): string {
  const preuvesReponse = contrat.dossier.preuves.slice(0, 3);
  const preuvesRendues = new Set(preuvesReponse.map((preuve) => preuve.id));
  const principale = contrat.dossier.visualisations[0]!;
  const visualisationsRendues = new Set([principale.id]);
  const sections = renduSectionsLongues(
    contrat,
    adresse,
    preuvesRendues,
    visualisationsRendues,
    indexSources,
  );
  return `<article class="analyse-rendu analyse-rendu--long" data-slug="${echapper(analyse.slug)}">
    <nav class="analyse-longue__fil" aria-label="Fil d’Ariane">
      <a href="/analyses/">Dossiers</a><span aria-hidden="true">›</span><span aria-current="page">${echapper(
        analyse.titre,
      )}</span>
    </nav>
    <header class="analyse-longue__entete">
      <p class="analyse-longue__meta"><span>${echapper(LIBELLE_TYPE[analyse.type])}</span><span>Publié le <time datetime="${echapper(
        analyse.publie_le,
      )}">${echapper(dateFrancaise(analyse.publie_le))}</time></span></p>
      <h1 class="analyse-rendu__titre">${echapper(analyse.titre)}</h1>
      <p class="analyse-longue__chapo">${echapper(contrat.dossier.chapo)}</p>
    </header>
    <section class="analyse-longue__reponse" aria-labelledby="reponse-30-secondes">
      <h2 id="reponse-30-secondes">Réponse en 30 secondes</h2>
      <div class="analyse-longue__preuves">${preuvesReponse
        .map((preuve) => renduPreuveLongue(preuve, contrat, adresse, indexSources))
        .join("")}</div>
    </section>
    ${renduSommaireLong(contrat)}
    ${renduVisualisationLongue(principale, contrat, 2, indexSources)}
    ${sections}
    ${renduPreuvesComplementaires(contrat, adresse, preuvesRendues, indexSources)}
    ${renduVisualisationsComplementaires(contrat, visualisationsRendues, indexSources)}
    ${renduLimitesLongues(contrat)}
    ${renduMethodeLongue(contrat, version, indexSources)}
    ${renduDonneesCompletes(contrat, indexSources)}
    ${renduSourcesLongues(contrat, indexSources)}
  </article>`;
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
  indexSources?: IndexSources,
): string {
  const contrat = contratDossierAnalyse(analyse);
  if (contrat) return renduDossierLong(analyse, contrat, version, adresse, indexSources);
  return `<article class="analyse-rendu" data-slug="${echapper(analyse.slug)}">
    <h1 class="analyse-rendu__titre">${echapper(analyse.titre)}</h1>
    ${verdictDuDossier(analyse)}
    ${express(analyse, catalogue, adresse, indexSources)}
    ${preuve(analyse, catalogue, version)}
    ${detail(analyse, catalogue)}
    ${limites(analyse)}
    ${sources(analyse, indexSources)}
    ${interactif(analyse)}
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
  return `<div class="analyses-filtres__groupe">
        <label class="analyses-filtres__label" for="analyses-${nom}">${echapper(libelle)}</label>
        <select class="pilule pilule--menu" id="analyses-${nom}" data-facette="${nom}">
          <option value="">${echapper(defaut)}</option>${options}
        </select>
      </div>`;
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
    return `<p class="analyse-rendu__index-chiffre dossier-index__chiffre">${dit}, publié : <strong>${montant}</strong> (exercice ${echapper(
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
  return `<p class="analyse-rendu__index-chiffre dossier-index__chiffre">${dit}${valeur}</p>`;
}

function fraicheurDe(analyse: Analyse): string {
  const derniereMiseAJour = analyse.mises_a_jour
    .map((miseAJour) => miseAJour.date)
    .sort((a, b) => b.localeCompare(a))[0];
  const publication = `<time datetime="${echapper(analyse.publie_le)}">${echapper(
    analyse.publie_le,
  )}</time>`;
  const miseAJour = derniereMiseAJour
    ? ` · Mise à jour le <time datetime="${echapper(derniereMiseAJour)}">${echapper(
        derniereMiseAJour,
      )}</time>`
    : "";
  return `<p class="dossier-index__fraicheur">Publié le ${publication}${miseAJour}</p>`;
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
      const qualification = qualificationVerdict(a);
      const sujets = a.themes.map(libelleTheme).join(" · ");
      const perimetre = a.budgets_concernes.map((budget) => LIBELLE_BUDGET[budget]).join(" · ");
      // Un lien de fragment (`#slug`) ne résout que si l'index et l'analyse
      // sont composés sur la même page — ce que ce module ne fait jamais :
      // `rendu()` produit un `<article>` par page, à son propre chemin
      // (tâche 4, `dist/analyses/<slug>/index.html`). C'est ce chemin réel
      // que l'index doit viser.
      return `<li class="analyse-rendu__index-ligne dossier-index" data-type="${echapper(
        carte.type,
      )}" data-themes="${echapper(carte.themes)}" data-budgets="${echapper(
        carte.budgets,
      )}" data-cherche="${echapper(carte.texte)}" data-theme="${echapper(
        carte.themes,
      )}" data-verdict="${echapper(qualification)}" data-perimetre="${echapper(
        carte.budgets,
      )}" data-texte="${echapper(carte.texte)}">
        <p class="dossier-index__meta"><span>${echapper(sujets)}</span><span>${echapper(perimetre)}</span></p>
        <h2 class="dossier-index__titre"><a class="dossier-index__lien" href="/analyses/${echapper(a.slug)}/">${echapper(a.titre)}</a></h2>
        <p class="dossier-index__affirmation">${echapper(a.affirmation.texte)}</p>
        ${chiffreEnCause(a, catalogue)}
        <p class="analyse-rendu__index-cran dossier-index__verdict"><strong>${echapper(
          LIBELLE_QUALIFICATION[qualification],
        )}</strong><span>${echapper(a.verdict.phrase)}</span><span class="dossier-index__precision">${LIBELLE_CRAN[
          a.verdict.cran
        ]}${confusion}</span></p>
        ${fraicheurDe(a)}
      </li>`;
    })
    .join("");

  // Une barre ne peut rien réduire sous deux analyses — même raison que pour
  // une facette à valeur unique, un cran plus haut.
  const barre =
    triees.length < 2
      ? ""
      : `<button class="analyses-filtres__bouton" id="analyses-filtres-bouton" type="button"
           aria-expanded="false" aria-controls="analyses-filtres" hidden>Filtrer les dossiers</button>
    <div class="analyses-filtres" id="analyses-filtres" data-ouvert="false" hidden>
      <div class="analyses-filtres__groupe analyses-filtres__groupe--recherche">
        <label class="analyses-filtres__label" for="analyses-recherche">Chercher</label>
        <input class="analyses-filtres__champ" id="analyses-recherche" type="search"
               autocomplete="off" placeholder="Un mot du chiffre, du verdict ou du titre" />
      </div>
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
      <div class="analyses-filtres__vide" id="analyses-etat-vide" hidden>
        <p>Aucun dossier ne correspond à ces filtres.</p>
        <button type="button" data-effacer-filtres>Effacer les filtres</button>
      </div>
    </div>`;

  return `<section class="analyses-index" aria-labelledby="analyses-titre">
    <header class="analyses-index__entete">
      <p class="analyses-index__eyebrow">Vérifier une affirmation</p>
      <h1 id="analyses-titre">Dossiers de vérification</h1>
      <p>Des affirmations confrontées aux comptes et aux publications qui les documentent.</p>
    </header>
    ${barre}
    <ul class="analyse-rendu__index" id="analyses-index">${lignes}</ul>
  </section>`;
}
