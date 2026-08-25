/**
 * Le registre des sources est construit au build à partir des contrats déjà
 * publiés. Il ne complète aucune métadonnée à l'intuition : les champs qui ne
 * sont pas déclarés par le manifeste, le catalogue ou une analyse restent
 * absents de la fiche.
 */

import type { Analyse, Registre } from "./analyse-rendu.ts";
import type { Indicateur, Jeu } from "./donnees.ts";

export type StatutSource = "publie" | "provisoire" | "estimation" | "regle_jeu";

/** Les trois pages qui peuvent effectivement consommer une publication. */
export type ContexteSource = "national" | "territoires" | "simulateur";

export type FicheSource = {
  /** Identifiant déterministe : seul contrat de lien profond vers /sources/. */
  id: string;
  nom: string;
  statut: StatutSource;
  institution: string;
  /** Publication primaire, sans fragment de lecture. */
  url: string;
  serie?: string;
  millesime?: string;
  perimetre?: string;
  unite?: string;
  transformation?: string;
  formule?: string;
  verifieLe?: string;
  pages: string[];
  /** Séries servies par cette publication, pour relier l'écran à cette fiche. */
  indicateurs?: string[];
  /** Même série, source réellement publiée pour chacune de ses mailles. */
  indicateursParNiveau?: Record<string, string[]>;
};

/**
 * Les deux accès au registre. Ils sont construits depuis ses fiches, jamais
 * depuis un slug recopié dans un renderer : l'ancre affichée est donc toujours
 * celle d'une carte réellement écrite dans /sources/.
 */
export type IndexSources = {
  parIndicateur: ReadonlyMap<string, string>;
  parIndicateurNiveau: ReadonlyMap<string, string>;
  parUrl: ReadonlyMap<string, string>;
};

type EntreeRegistre = {
  jeux: readonly Jeu[];
  indicateurs: readonly Indicateur[];
  analyses: readonly Analyse[];
};

type Accumulateur = {
  cle: string;
  jeu?: Jeu;
  analyses: Analyse[];
};

const ORDRE_STATUT: Record<StatutSource, number> = {
  publie: 0,
  provisoire: 1,
  estimation: 2,
  regle_jeu: 3,
};

/** Les ancres sont des repères de lecture, jamais une nouvelle publication. */
function sansFragment(url: string): string {
  return url.trim().split("#", 1)[0] ?? "";
}

/** L'URL intérieure d'une fiche exacte du registre, avec son ancre échappée. */
export function lienSource(id: string): string {
  return `/sources/#${encodeURIComponent(id)}`;
}

/** Recompose les index de lecture à partir des fiches rendues par le registre. */
export function indexerSources(fiches: readonly FicheSource[]): IndexSources {
  const parIndicateur = new Map<string, string>();
  const parIndicateurNiveau = new Map<string, string>();
  const parUrl = new Map<string, string>();
  for (const fiche of fiches) {
    const url = sansFragment(fiche.url);
    if (url) parUrl.set(url, fiche.id);
    for (const indicateur of fiche.indicateurs ?? []) {
      parIndicateur.set(indicateur, fiche.id);
    }
    for (const [niveau, indicateurs] of Object.entries(fiche.indicateursParNiveau ?? {})) {
      for (const indicateur of indicateurs) {
        parIndicateurNiveau.set(`${indicateur}\u0000${niveau}`, fiche.id);
      }
    }
  }
  return { parIndicateur, parIndicateurNiveau, parUrl };
}

/** Une source déclarée peut garder son fragment de lecture ; la carte, non. */
export function sourceIdPourUrl(index: IndexSources, url: string): string | undefined {
  return index.parUrl.get(sansFragment(url));
}

/** Un indicateur ne choisit jamais son ancre : le registre lui a déjà attribuée. */
export function sourceIdPourIndicateur(
  index: IndexSources,
  indicateur: string,
  niveau?: string,
): string | undefined {
  return (niveau ? index.parIndicateurNiveau.get(`${indicateur}\u0000${niveau}`) : undefined)
    ?? index.parIndicateur.get(indicateur);
}

/**
 * Un slug ASCII, stable sous les accents. Il ne sert pas à reconstruire une
 * URL : une fiche le fournit une fois, les renderers le consomment tel quel.
 */
function slug(texte: string): string {
  const simplifie = texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return simplifie || "source";
}

function distinctTrie(valeurs: readonly (string | null | undefined)[]): string[] {
  return [...new Set(valeurs.filter((valeur): valeur is string => typeof valeur === "string" && Boolean(valeur.trim())))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
}

function premiereOuJoin(valeurs: readonly string[]): string | undefined {
  const distinctes = distinctTrie(valeurs);
  return distinctes.length ? distinctes.join(" · ") : undefined;
}

function estProvisoire(indicateur: Indicateur): boolean {
  const declaration = [indicateur.confiance, ...indicateur.badges]
    .join(" ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr-FR");
  return declaration.includes("provisoire");
}

function statutRegistre(registre: Registre): StatutSource {
  switch (registre) {
    case "fait_comptable":
    case "donnee_officielle":
      return "publie";
    case "estimation_externe":
      return "estimation";
    case "resultat_simulation":
    case "hypothese":
    case "interpretation":
      return "regle_jeu";
  }
}

function statutAnalyse(analyse: Analyse): StatutSource {
  const statuts = analyse.chiffres.map((chiffre) => statutRegistre(chiffre.registre));
  if (!statuts.length) return "publie";
  return statuts.sort((a, b) => ORDRE_STATUT[b] - ORDRE_STATUT[a])[0]!;
}

function dernierJour(valeurs: readonly string[]): string | undefined {
  const distinctes = distinctTrie(valeurs);
  return distinctes.length ? distinctes[distinctes.length - 1] : undefined;
}

/** Empreinte courte de l'URL canonique : le suffixe ne dépend jamais de l'ordre. */
function empreinteUrl(url: string): string {
  let empreinte = 0x811c9dc5;
  for (let index = 0; index < url.length; index += 1) {
    empreinte ^= url.charCodeAt(index);
    empreinte = Math.imul(empreinte, 0x01000193);
  }
  return (empreinte >>> 0).toString(36);
}

function idDe(accumulateur: Accumulateur): string {
  if (accumulateur.jeu) return `${slug(accumulateur.jeu.id)}-${empreinteUrl(accumulateur.cle)}`;
  const analyse = [...accumulateur.analyses].sort((a, b) => a.slug.localeCompare(b.slug, "fr"))[0];
  if (analyse) return `${slug(analyse.slug)}-${empreinteUrl(accumulateur.cle)}`;
  return `${slug(accumulateur.cle)}-${empreinteUrl(accumulateur.cle)}`;
}

function insererAccumulateur(
  parUrl: Map<string, Accumulateur>,
  cle: string,
  ajout: Partial<Accumulateur>,
): Accumulateur {
  const existant = parUrl.get(cle) ?? { cle, analyses: [] };
  if (ajout.jeu && (!existant.jeu || ajout.jeu.id.localeCompare(existant.jeu.id, "fr") < 0)) {
    existant.jeu = ajout.jeu;
  }
  if (ajout.analyses?.length) existant.analyses.push(...ajout.analyses);
  parUrl.set(cle, existant);
  return existant;
}

/** La publication d'un indicateur peut varier avec la maille qu'elle mesure. */
function jeuDuNiveau(indicateur: Indicateur, niveau: string): string {
  return indicateur.jeu_par_niveau?.[niveau] ?? indicateur.jeu;
}

/** Les niveaux réellement servis par un jeu, déduits du contrat du catalogue. */
function niveauxDuJeu(indicateur: Indicateur, jeu: string): string[] {
  return [...new Set([...(indicateur.niveaux ?? []), ...Object.keys(indicateur.jeu_par_niveau ?? {})])]
    .filter((niveau) => jeuDuNiveau(indicateur, niveau) === jeu)
    .sort((a, b) => a.localeCompare(b, "fr"));
}

function indicateursParNiveau(indicateurs: readonly Indicateur[], jeu: string): Record<string, string[]> {
  const parNiveau = new Map<string, string[]>();
  for (const indicateur of indicateurs) {
    for (const niveau of niveauxDuJeu(indicateur, jeu)) {
      const ids = parNiveau.get(niveau) ?? [];
      ids.push(indicateur.id);
      parNiveau.set(niveau, ids);
    }
  }
  return Object.fromEntries(
    [...parNiveau.entries()].map(([niveau, ids]) => [niveau, distinctTrie(ids)]),
  );
}

/**
 * Les usages ne sont pas déclaratifs : ils suivent la maille réellement
 * publiée et les contrats des analyses. Une source de pays peut servir le
 * bilan, une source locale le territoire, et seule une analyse qui expose un
 * réglage de budget peut conduire au simulateur.
 */
function usagesDuJeu(indicateurs: readonly Indicateur[]): string[] {
  const niveaux = indicateurs.flatMap((indicateur) => indicateur.niveaux ?? []);
  return [
    ...(niveaux.includes("pays") ? ["/bilan"] : []),
    ...(niveaux.some((niveau) => niveau !== "pays") ? ["/territoire"] : []),
  ];
}

function usagesDesAnalyses(analyses: readonly Analyse[]): string[] {
  return analyses.flatMap((analyse) => [
    `/analyses/${analyse.slug}/`,
    ...(analyse.simulateur.budget ? ["/simulateur"] : []),
  ]);
}

/** Contexte de lecture dérivé des mêmes chemins que les puces de la fiche. */
export function contextesDePages(pages: readonly string[]): ContexteSource[] {
  return [
    ...(pages.includes("/bilan") ? ["national" as const] : []),
    ...(pages.includes("/territoire") ? ["territoires" as const] : []),
    ...(pages.includes("/simulateur") ? ["simulateur" as const] : []),
  ];
}

/**
 * Agrège les publications primaires et les citations d'analyses qui les
 * réemploient. Une source citée sans jeu du manifeste reste visible, mais son
 * institution est explicitement inconnue plutôt que déduite de son URL.
 */
export function construireRegistre({ jeux, indicateurs, analyses }: EntreeRegistre): FicheSource[] {
  const parUrl = new Map<string, Accumulateur>();
  for (const jeu of jeux) {
    const cle = sansFragment(jeu.url);
    if (cle) insererAccumulateur(parUrl, cle, { jeu });
  }
  for (const analyse of analyses) {
    for (const source of analyse.sources) {
      const cle = sansFragment(source.url);
      if (cle) insererAccumulateur(parUrl, cle, { analyses: [analyse] });
    }
  }

  const fiches = [...parUrl.values()].map((accumulateur) => {
    const jeu = accumulateur.jeu;
    const indicateursDuJeu = jeu
      ? indicateurs.filter((indicateur) => niveauxDuJeu(indicateur, jeu.id).length).sort((a, b) => a.id.localeCompare(b.id, "fr"))
      : [];
    const niveauxIndicateurs = jeu ? indicateursParNiveau(indicateursDuJeu, jeu.id) : {};
    const sourceAnalyse = accumulateur.analyses
      .flatMap((analyse) => analyse.sources.filter((source) => sansFragment(source.url) === accumulateur.cle))
      .sort(
        (a, b) =>
          a.titre.localeCompare(b.titre, "fr") ||
          a.consulte_le.localeCompare(b.consulte_le, "fr") ||
          a.url.localeCompare(b.url, "fr"),
      );
    const statutJeu: StatutSource | undefined = jeu
      ? indicateursDuJeu.some(estProvisoire)
        ? "provisoire"
        : "publie"
      : undefined;
    const statuts: StatutSource[] = [
      ...(statutJeu ? [statutJeu] : []),
      ...accumulateur.analyses.map(statutAnalyse),
    ];
    const statut = statuts.sort((a, b) => ORDRE_STATUT[b] - ORDRE_STATUT[a])[0]!;
    const pages = distinctTrie([
      ...(jeu ? usagesDuJeu(indicateursDuJeu) : []),
      ...usagesDesAnalyses(accumulateur.analyses),
    ]);
    const formules = indicateursDuJeu.map((indicateur) => indicateur.formule);

    return {
      id: idDe(accumulateur),
      nom: jeu?.titre ?? sourceAnalyse[0]?.titre ?? "Publication sans titre",
      statut,
      institution: jeu?.producteur ?? "Institution non précisée",
      url: jeu ? sansFragment(jeu.url) : accumulateur.cle,
      serie: premiereOuJoin(indicateursDuJeu.map((indicateur) => indicateur.id)),
      millesime: premiereOuJoin(indicateursDuJeu.flatMap((indicateur) => indicateur.periodes)),
      perimetre: premiereOuJoin(Object.keys(niveauxIndicateurs)),
      unite: premiereOuJoin(indicateursDuJeu.map((indicateur) => indicateur.unite)),
      formule: premiereOuJoin(formules),
      verifieLe: dernierJour([
        ...(jeu ? [jeu.extraction] : []),
        ...sourceAnalyse.map((source) => source.consulte_le),
      ]),
      pages,
      indicateurs: indicateursDuJeu
        .filter((indicateur) => indicateur.jeu === jeu?.id)
        .map((indicateur) => indicateur.id),
      indicateursParNiveau: niveauxIndicateurs,
    } satisfies FicheSource;
  });

  return fiches.sort(
    (a, b) =>
      a.nom.localeCompare(b.nom, "fr") ||
      (a.millesime ?? "").localeCompare(b.millesime ?? "", "fr") ||
      a.id.localeCompare(b.id, "fr"),
  );
}

function texteRecherche(fiche: FicheSource): string {
  return [fiche.nom, fiche.institution, fiche.serie, fiche.perimetre]
    .filter((valeur): valeur is string => Boolean(valeur))
    .join(" ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr-FR");
}

/** Recherche sans accent, avec filtres de statut et de contexte optionnels. */
export function filtrerRegistre(
  fiches: readonly FicheSource[],
  requete: string,
  statut?: StatutSource,
  contexte?: ContexteSource,
): FicheSource[] {
  const termes = requete
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr-FR")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return fiches.filter(
    (fiche) =>
      (!statut || fiche.statut === statut) &&
      (!contexte || contextesDePages(fiche.pages).includes(contexte)) &&
      termes.every((terme) => texteRecherche(fiche).includes(terme)),
  );
}
