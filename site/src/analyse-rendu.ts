/** Dossiers : introduction, développement illustré, conclusion, sources et date. */
import {validerDossierAnalyse, type DossierAnalyse, type DossierAnalyseValide, type SourceAnalyse, type VisualisationAnalyse} from "./analyse-contrat.ts";
import {graphiqueAnalyse} from "./analyse-graphiques.ts";
import type {Indicateur} from "./donnees.ts";
import {libelleUniteAnalyse, valeurEtUniteAnalyse} from "./echelle.ts";
import type {IndexSources} from "./registre-sources.ts";
import {aplatir} from "./simulateur.ts";
import {libelleTheme} from "./themes.ts";
import {echapper} from "./texte.ts";
export type Cran = "exact" | "hors_perimetre" | "introuvable";

export type Confusion =
  | "ae_cp"
  | "brut_net"
  | "vote_execute"
  | "stock_flux"
  | "etat_apu"
  | "annuel_cumule"
  | "perimetre_geographique"
  | "gros_detail"
  | "panier_partiel"
  | "indicateur_partiel";

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
  gros_detail: "Un prix de gros de l'électricité confondu avec une facture de détail",
  panier_partiel: "Le prix d'un sous-panier confondu avec une dépense totale",
  indicateur_partiel: "Un indicateur partiel confondu avec un concept plus large",
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
    case "gros_detail":
    case "panier_partiel":
    case "indicateur_partiel":
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


function figureDossier(v: VisualisationAnalyse, contrat: DossierAnalyseValide): string {
  const graphique = graphiqueAnalyse(v, contrat);
  const valeurs = (v.preuveIds ?? []).map(id => contrat.preuveParId.get(id)!);
  const tableau = !graphique && valeurs.length ? `<div class="analyse-longue__defilement" tabindex="0" role="region" aria-label="${echapper(v.titre)}"><table class="analyse-longue__tableau"><caption>${echapper(v.titre)}</caption><thead><tr><th scope="col">Indicateur</th><th scope="col">Période</th><th scope="col">Valeur</th></tr></thead><tbody>${valeurs.map(p => `<tr><th scope="row">${echapper(p.libelle)}</th><td>${echapper(p.period)}</td><td>${echapper(valeurEtUniteAnalyse(p.value,p.unit))}</td></tr>`).join("")}</tbody></table></div>` : "";
  const unites = [...new Set((v.seriesIds ?? []).map(id => contrat.serieParId.get(id)!.unit))];
  return `<figure class="analyse-longue__figure" id="figure-${echapper(v.id)}"><figcaption><h3>${echapper(v.titre)}</h3><p>${echapper(v.resume)}</p>${unites.length ? `<p class="analyse-longue__unite-figure">${unites.map(u => echapper(libelleUniteAnalyse(u))).join(" · ")}</p>` : ""}</figcaption>${graphique || tableau}</figure>`;
}

function piedDossier(analyse: Analyse): string {
  const liens = new Map(analyse.sources.map(s=>[s.url,s]));
  const derniere = analyse.mises_a_jour.at(-1)?.date;
  const modification = derniere !== analyse.publie_le ? derniere : undefined;
  return `<footer class="analyse-longue__sources" id="sources"><h2>Sources</h2><ol>${[...liens.values()].map(s=>`<li><a href="${echapper(s.url)}" target="_blank" rel="noopener">${echapper(s.titre)}</a></li>`).join("")}</ol><p class="dossier-date">Publié le <time datetime="${echapper(analyse.publie_le)}">${echapper(dateFrancaise(analyse.publie_le))}</time>${modification ? ` · Mis à jour le <time datetime="${echapper(modification)}">${echapper(dateFrancaise(modification))}</time>` : ""}</p></footer>`;
}

/** Le contrat garde les références des données ; le lecteur suit un article continu. */
export function rendu(analyse: Analyse, _catalogue: Indicateur[], _version = "", _adresse = "", _indexSources?: IndexSources): string {
  const contrat = contratDossierAnalyse(analyse);
  let corps: string;
  if (contrat) {
    const figuresVues = new Set<string>();
    const sections = contrat.dossier.sections.map(section=>{
      const figures = (section.visualisationIds ?? []).filter(id=>!figuresVues.has(id)).map(id=>{
        figuresVues.add(id); return figureDossier(contrat.visualisationParId.get(id)!,contrat);
      }).join("");
      return `<section class="analyse-longue__section" id="${echapper(section.id)}"><h2>${echapper(section.titre)}</h2><div class="analyse-longue__prose">${section.paragraphes.map(p=>`<p>${echapper(p)}</p>`).join("")}</div>${figures}</section>`;
    });
    const restantes = contrat.dossier.visualisations.filter(v=>!figuresVues.has(v.id)).map(v=>figureDossier(v,contrat)).join("");
    const chrono = contrat.dossier.chronologie;
    const calendrier = chrono ? `<figure class="analyse-longue__figure"><figcaption><h3>${echapper(chrono.titre)}</h3></figcaption><ol class="dossier-chronologie">${chrono.etapes.map(e=>`<li><strong>${echapper(e.date)}</strong><p>${echapper(e.texte)}</p></li>`).join("")}</ol></figure>` : "";
    // Les figures non affectées prennent place après le premier développement.
    corps = sections.map((s,i)=>s+(i===0 ? restantes+calendrier : "")).join("");
  } else {
    // Compatibilité des imports historiques ; les dossiers du site ont tous un développement rédigé.
    corps = `<section class="analyse-longue__section"><h2>Les données publiées</h2>${analyse.chiffres.map(c=>`<p>${echapper(c.lecture)}</p>`).join("")}</section><section class="analyse-longue__section"><h2>Conclusion</h2><p>${echapper(analyse.verdict.phrase)}</p></section>`;
  }
  return `<article class="analyse-rendu analyse-rendu--long dossier-journal" data-slug="${echapper(analyse.slug)}"><nav class="analyse-longue__fil" aria-label="Retour aux dossiers"><a href="/analyses/">Dossiers</a></nav><header class="analyse-longue__entete"><p class="analyse-longue__meta">${echapper(analyse.themes.map(t=>libelleTheme(t).replace("Comparaisons européennes","Europe")).join(" · "))}</p><h1 class="analyse-rendu__titre">${echapper(analyse.titre)}</h1><p class="analyse-longue__chapo">${echapper(contrat?.dossier.chapo ?? analyse.affirmation.texte)}</p></header>${corps}${piedDossier(analyse)}</article>`;
}
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

export function renduIndex(analyses: Analyse[], _catalogue: Indicateur[]): string {
  const triees = [...analyses].sort((a, b) => b.publie_le.localeCompare(a.publie_le));
  const lignes = triees
    .map((a) => {
      const carte = carteDeLAnalyse(a);
      const qualification = qualificationVerdict(a);
      const sujets = a.themes.map(t=>libelleTheme(t).replace("Comparaisons européennes","Europe")).join(" · ");
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
        <p class="dossier-index__meta"><span>${echapper(sujets)}</span></p>
        <h2 class="dossier-index__titre"><a class="dossier-index__lien" href="/analyses/${echapper(a.slug)}/">${echapper(a.titre)}</a></h2>
        <p class="dossier-index__affirmation">${echapper(a.dossier?.chapo ?? a.affirmation.texte)}</p>
        <span class="dossier-index__ouvrir" aria-hidden="true">Lire le dossier</span>
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
               autocomplete="off" placeholder="Énergie, défense, logement…" />
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
      <div><p class="analyses-index__eyebrow">France · Europe · International</p>
      <h1 id="analyses-titre">Dossiers</h1>
      <p class="analyses-index__chapo">Politique française, Europe, relations internationales. Les sujets du débat public, expliqués avec des faits et des chiffres.</p></div>

    </header>
    ${barre}
    <ul class="analyse-rendu__index" id="analyses-index">${lignes}</ul>
  </section>`;
}
