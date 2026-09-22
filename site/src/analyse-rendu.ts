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
/** Les valeurs distinctes d'une facette, triées par leur libellé. */
function valeursDistinctes(
  brutes: string[],
  libelleDe: (valeur: string) => string,
): { valeur: string; libelle: string }[] {
  return [...new Set(brutes)]
    .map((valeur) => ({ valeur, libelle: libelleDe(valeur) }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
}

/** Pont minimal utilisé par la page France pour afficher son lien éditorial. */
export function renduDossierVedette(analyses: readonly Analyse[]): string {
  const analyse = analyses.find((a) => a.slug === "groenland-accord-securite-europe") ?? analyses[0];
  if (!analyse) return "";
  const chapo = analyse.dossier?.chapo ?? analyse.affirmation.texte;
  return `<article class="bilan-dossier" aria-labelledby="bilan-dossier-title">
    <div class="bilan-dossier__texte">
      <p class="bilan-dossier__surtitre">Pour aller plus loin</p>
      <h2 id="bilan-dossier-title">Un dossier pour éclairer les chiffres</h2>
      <p class="bilan-dossier__titre">${echapper(analyse.titre)}</p>
      <p class="bilan-dossier__chapo">${echapper(chapo)}</p>
      <a class="bilan-dossier__lire" href="/analyses/${echapper(analyse.slug)}/">Lire le dossier</a>
    </div>
  </article>`;
}

const IMAGES_INDEX: Record<string,string> = {
  "groenland-accord-securite-europe": "/dossiers/groenland.jpg",
  "championne-du-monde-prelevements-2024": "/france/fiscalite.jpg",
  "la-depense-publique-baisse-2024": "/france/budget.jpg",
  "defense-europe-depenses-2024": "/france/assemblee.jpg",
  "defense-credits-votes-consommes-2025": "/france/justice.jpg",
  "age-achat-residence-principale": "/france/logement.jpg",
  "retraites-premier-poste-2024": "/france/retraites.jpg",
  "fournitures-scolaires-prix-1990-2025": "/france/services.jpg",
  "satisfaction-vie-france-2010-2024": "/france/travail.jpg",
};

function dateDossier(iso:string):string {
  const date=new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"});
}

function etiquetteDossier(a:Analyse):string {
  const theme=a.themes[0];
  return theme ? libelleTheme(theme).replace("Comparaisons européennes","Europe") : "Analyse";
}

function carteDossierV2(a:Analyse):string {
  const carte=carteDeLAnalyse(a);
  const image=IMAGES_INDEX[a.slug];
  const chapo=a.dossier?.chapo ?? a.affirmation.texte;
  return `<li class="dossier-v2-card" data-dossier-card data-type="${echapper(carte.type)}" data-themes="${echapper(carte.themes)}" data-budgets="${echapper(carte.budgets)}" data-texte="${echapper(carte.texte)}">
    ${image ? `<img class="dossier-v2-card__image" src="${image}" alt="" width="640" height="360" loading="lazy">` : ""}
    <div class="dossier-v2-card__corps">
      <p class="dossier-v2-card__theme">${echapper(etiquetteDossier(a))}</p>
      <h2><a href="/analyses/${echapper(a.slug)}/">${echapper(a.titre)}</a></h2>
      <p>${echapper(chapo)}</p>
      <footer><time datetime="${echapper(a.publie_le)}">${echapper(dateDossier(a.publie_le))}</time><span>${echapper(a.themes.map(libelleTheme).join(" · "))}</span></footer>
    </div>
  </li>`;
}

export function renduIndex(analyses: Analyse[], _catalogue: Indicateur[]): string {
  const triees=[...analyses].sort((a,b)=>b.publie_le.localeCompare(a.publie_le));
  const vedette=triees.find((a)=>a.slug==="groenland-accord-securite-europe") ?? triees[0];
  const autres=triees.filter((a)=>a!==vedette);
  const visuelles=autres.filter((a)=>IMAGES_INDEX[a.slug]).slice(0,8);
  const secondaires=autres.filter((a)=>!visuelles.includes(a));
  const themes=valeursDistinctes(triees.flatMap((a)=>a.themes),libelleTheme).slice(0,7);
  const filtres=triees.length<2 ? "" : `<div class="dossiers-v2__filtres"><button type="button" data-analyse-theme="" aria-pressed="true">Tous les dossiers</button>${themes.map((t)=>`<button type="button" data-analyse-theme="${echapper(t.valeur)}" aria-pressed="false">${echapper(t.libelle.replace("Comparaisons européennes","Europe"))}</button>`).join("")}<label><span class="visuellement-cache">Rechercher un dossier</span><span class="dossiers-v2__search-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></span><input id="analyses-recherche-v2" type="search" placeholder="Rechercher un dossier"></label></div>`;
  const carteVedette=vedette ? carteDeLAnalyse(vedette) : null;
  const vedetteHtml=vedette && carteVedette ? `<article class="dossiers-v2__vedette" data-dossier-card data-type="${echapper(carteVedette.type)}" data-themes="${echapper(carteVedette.themes)}" data-budgets="${echapper(carteVedette.budgets)}" data-texte="${echapper(carteVedette.texte)}">
      <img src="${IMAGES_INDEX[vedette.slug] ?? "/dossiers/groenland.jpg"}" alt="" width="840" height="470">
      <div><p class="dossiers-v2__eyebrow">Dossier à la une</p><h2><a href="/analyses/${echapper(vedette.slug)}/">${echapper(vedette.titre)}</a></h2><p>${echapper(vedette.dossier?.chapo ?? vedette.affirmation.texte)}</p><time datetime="${echapper(vedette.publie_le)}">${echapper(dateDossier(vedette.publie_le))}</time><a class="dossiers-v2__lire" href="/analyses/${echapper(vedette.slug)}/">Lire le dossier</a></div>
    </article>` : "";
  return `<section class="analyses-index dossiers-v2" aria-labelledby="analyses-titre">
    <header class="dossiers-v2__hero">
      <div><p class="dossiers-v2__eyebrow">Analyses et décryptages</p><h1 id="analyses-titre">Dossiers</h1><p class="dossiers-v2__lead">Des analyses sourcées pour aller plus loin que les chiffres.</p><p>Les dossiers approfondissent les grands enjeux publics à partir des données publiées et de sources identifiées.</p></div>
      <figure><img src="/dossiers/groenland.jpg" alt="Paysage du Groenland" width="900" height="520"><figcaption>Groenland · illustration du dossier</figcaption></figure>
    </header>
    ${filtres}
    ${vedetteHtml}
    <section class="dossiers-v2__liste-section"><div class="dossiers-v2__section-head"><h2>Les derniers dossiers</h2><p>Des analyses pour un débat plus serein.</p></div><ul class="dossiers-v2__grille" id="analyses-index">${visuelles.map(carteDossierV2).join("")}${secondaires.map(carteDossierV2).join("")}</ul></section>
    <section class="dossiers-v2__preuves"><div><strong>Des données fiables</strong><span>Sources publiques officielles</span></div><div><strong>Des analyses indépendantes</strong><span>Une approche factuelle et pédagogique</span></div><div><strong>Une information accessible</strong><span>Des sujets complexes, expliqués clairement</span></div></section>
  </section>`;
}
