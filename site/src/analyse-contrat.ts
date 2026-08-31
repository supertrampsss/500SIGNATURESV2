/**
 * Contrat des dossiers longs fondés sur des séries et des instantanés.
 *
 * Les quatre dossiers historiques restent valides sans ce contrat. Dès qu'un
 * dossier long est déclaré, chaque preuve nomme toutefois sa propre source et
 * chaque lien est vérifié ici avant que le rendu puisse l'utiliser. Aucun
 * renderer n'a donc à deviner une provenance dans l'ordre de `sources`.
 */

export type SourceAnalyse = {
  id: string;
  titre: string;
  url: string;
  consulteLe: string;
};

export type ObservationAnalyse = {
  period: string;
  value: number;
  qualityFlags?: string[];
};

export type SerieAnalyse = {
  id: string;
  libelle: string;
  unit: string;
  definition: string;
  sourceId: string;
  observations: ObservationAnalyse[];
};

/** Sans `seriesId`, une preuve est un instantané autonome. */
export type PreuveAnalyse = {
  id: string;
  libelle: string;
  value: number;
  unit: string;
  period: string;
  definition: string;
  sourceId: string;
  seriesId?: string;
  comparableGroup?: string;
  qualityFlags?: string[];
};

export type AxeAnalyse = {
  id: string;
  unit: string;
  seriesIds: string[];
};

export type TypeVisualisationAnalyse = "line" | "bar" | "timeline" | "snapshot_table";

export type VisualisationAnalyse = {
  id: string;
  type: TypeVisualisationAnalyse;
  titre: string;
  /** Résumé textuel obligatoire pour que la figure ne soit jamais la seule lecture. */
  resume: string;
  seriesIds?: string[];
  preuveIds?: string[];
  /** Obligatoires dès qu'une figure mêle plusieurs unités. */
  axes?: AxeAnalyse[];
};

export type SectionAnalyse = {
  /** Identifiant stable, utilisé comme ancre et dans le sommaire. */
  id: string;
  titre: string;
  paragraphes: string[];
  preuveIds?: string[];
  visualisationIds?: string[];
};

export type DossierAnalyse = {
  chapo: string;
  /** Liste ordonnée d'ancres. Absente, le rendu peut omettre le sommaire. */
  sommaire?: string[];
  series: SerieAnalyse[];
  preuves: PreuveAnalyse[];
  visualisations: VisualisationAnalyse[];
  sections: SectionAnalyse[];
  limitations: string[];
};

export type DossierAnalyseValide = {
  dossier: DossierAnalyse;
  sources: readonly SourceAnalyse[];
  sourceParId: ReadonlyMap<string, SourceAnalyse>;
  serieParId: ReadonlyMap<string, SerieAnalyse>;
  preuveParId: ReadonlyMap<string, PreuveAnalyse>;
  visualisationParId: ReadonlyMap<string, VisualisationAnalyse>;
  sectionParId: ReadonlyMap<string, SectionAnalyse>;
};

const FORME_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TYPES_VISUALISATION = new Set<TypeVisualisationAnalyse>([
  "line",
  "bar",
  "timeline",
  "snapshot_table",
]);

function objet(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function chaine(
  value: unknown,
  chemin: string,
  erreurs: string[],
): value is string {
  if (typeof value !== "string" || !value.trim()) {
    erreurs.push(`${chemin} doit être une chaîne non vide`);
    return false;
  }
  return true;
}

function idStable(value: unknown, chemin: string, erreurs: string[]): value is string {
  if (!chaine(value, chemin, erreurs)) return false;
  if (!FORME_ID.test(value)) {
    erreurs.push(`${chemin} doit être une ancre stable en minuscules ASCII`);
    return false;
  }
  return true;
}

function nombre(value: unknown, chemin: string, erreurs: string[]): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    erreurs.push(`${chemin} doit être un nombre fini`);
    return false;
  }
  return true;
}

function listeNonVide(value: unknown, chemin: string, erreurs: string[]): unknown[] {
  if (!Array.isArray(value) || !value.length) {
    erreurs.push(`${chemin} doit être une liste non vide`);
    return [];
  }
  return value;
}

function liste(value: unknown, chemin: string, erreurs: string[]): unknown[] {
  if (!Array.isArray(value)) {
    erreurs.push(`${chemin} doit être une liste`);
    return [];
  }
  return value;
}

function listeChaines(
  value: unknown,
  chemin: string,
  erreurs: string[],
  nonVide = false,
): string[] {
  const elements = nonVide ? listeNonVide(value, chemin, erreurs) : liste(value, chemin, erreurs);
  const resultat: string[] = [];
  elements.forEach((element, index) => {
    if (chaine(element, `${chemin}[${index}]`, erreurs)) resultat.push(element);
  });
  return resultat;
}

function listeIds(
  value: unknown,
  chemin: string,
  erreurs: string[],
  nonVide = false,
): string[] {
  const ids = listeChaines(value, chemin, erreurs, nonVide);
  ids.forEach((id, index) => idStable(id, `${chemin}[${index}]`, erreurs));
  const vus = new Set<string>();
  ids.forEach((id, index) => {
    if (vus.has(id)) erreurs.push(`${chemin}[${index}] porte l'identifiant dupliqué « ${id} »`);
    vus.add(id);
  });
  return ids;
}

function flags(value: unknown, chemin: string, erreurs: string[]): string[] {
  if (value === undefined) return [];
  const resultat = listeChaines(value, chemin, erreurs);
  const vus = new Set<string>();
  resultat.forEach((flag, index) => {
    if (vus.has(flag)) erreurs.push(`${chemin}[${index}] duplique le flag « ${flag} »`);
    vus.add(flag);
  });
  return resultat;
}

function memesFlags(a: readonly string[] = [], b: readonly string[] = []): boolean {
  return [...a].sort().join("\u0000") === [...b].sort().join("\u0000");
}

function dateIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function indexer<T extends { id: string }>(
  elements: readonly T[],
  chemin: string,
  erreurs: string[],
): Map<string, T> {
  const index = new Map<string, T>();
  elements.forEach((element, position) => {
    if (index.has(element.id)) {
      erreurs.push(`${chemin}[${position}].id porte l'identifiant dupliqué « ${element.id} »`);
    } else {
      index.set(element.id, element);
    }
  });
  return index;
}

function verifierSources(value: unknown, erreurs: string[]): SourceAnalyse[] {
  const resultat: SourceAnalyse[] = [];
  for (const [index, element] of listeNonVide(value, "sources", erreurs).entries()) {
    const chemin = `sources[${index}]`;
    if (!objet(element)) {
      erreurs.push(`${chemin} doit être un objet`);
      continue;
    }
    const valide = idStable(element.id, `${chemin}.id`, erreurs)
      && chaine(element.titre, `${chemin}.titre`, erreurs)
      && chaine(element.url, `${chemin}.url`, erreurs)
      && chaine(element.consulteLe, `${chemin}.consulteLe`, erreurs);
    if (typeof element.url === "string") {
      try {
        const url = new URL(element.url);
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          erreurs.push(`${chemin}.url doit utiliser HTTP ou HTTPS`);
        }
      } catch {
        erreurs.push(`${chemin}.url doit être une URL absolue`);
      }
    }
    if (typeof element.consulteLe === "string" && !dateIso(element.consulteLe)) {
      erreurs.push(`${chemin}.consulteLe doit être une date ISO valide`);
    }
    if (valide) resultat.push(element as SourceAnalyse);
  }
  return resultat;
}

function verifierSeries(value: unknown, erreurs: string[]): SerieAnalyse[] {
  const resultat: SerieAnalyse[] = [];
  for (const [index, element] of liste(value, "series", erreurs).entries()) {
    const chemin = `series[${index}]`;
    if (!objet(element)) {
      erreurs.push(`${chemin} doit être un objet`);
      continue;
    }
    const observations: ObservationAnalyse[] = [];
    const periodes = new Set<string>();
    for (const [rang, observation] of listeNonVide(
      element.observations,
      `${chemin}.observations`,
      erreurs,
    ).entries()) {
      const cheminObservation = `${chemin}.observations[${rang}]`;
      if (!objet(observation)) {
        erreurs.push(`${cheminObservation} doit être un objet`);
        continue;
      }
      const period = observation.period;
      const periodValide = chaine(period, `${cheminObservation}.period`, erreurs);
      const valeurValide = nombre(observation.value, `${cheminObservation}.value`, erreurs);
      flags(observation.qualityFlags, `${cheminObservation}.qualityFlags`, erreurs);
      if (periodValide) {
        if (periodes.has(period)) {
          erreurs.push(`${cheminObservation}.period duplique la période « ${period} »`);
        }
        periodes.add(period);
      }
      if (periodValide && valeurValide) observations.push(observation as ObservationAnalyse);
    }
    const valide = idStable(element.id, `${chemin}.id`, erreurs)
      && chaine(element.libelle, `${chemin}.libelle`, erreurs)
      && chaine(element.unit, `${chemin}.unit`, erreurs)
      && chaine(element.definition, `${chemin}.definition`, erreurs)
      && idStable(element.sourceId, `${chemin}.sourceId`, erreurs);
    if (valide && observations.length) resultat.push(element as unknown as SerieAnalyse);
  }
  return resultat;
}

function verifierPreuves(value: unknown, erreurs: string[]): PreuveAnalyse[] {
  const resultat: PreuveAnalyse[] = [];
  for (const [index, element] of listeNonVide(value, "preuves", erreurs).entries()) {
    const chemin = `preuves[${index}]`;
    if (!objet(element)) {
      erreurs.push(`${chemin} doit être un objet`);
      continue;
    }
    const valide = idStable(element.id, `${chemin}.id`, erreurs)
      && chaine(element.libelle, `${chemin}.libelle`, erreurs)
      && nombre(element.value, `${chemin}.value`, erreurs)
      && chaine(element.unit, `${chemin}.unit`, erreurs)
      && chaine(element.period, `${chemin}.period`, erreurs)
      && chaine(element.definition, `${chemin}.definition`, erreurs)
      && idStable(element.sourceId, `${chemin}.sourceId`, erreurs);
    if (element.seriesId !== undefined) idStable(element.seriesId, `${chemin}.seriesId`, erreurs);
    if (element.comparableGroup !== undefined) {
      idStable(element.comparableGroup, `${chemin}.comparableGroup`, erreurs);
    }
    flags(element.qualityFlags, `${chemin}.qualityFlags`, erreurs);
    if (valide) resultat.push(element as unknown as PreuveAnalyse);
  }
  return resultat;
}

function verifierVisualisations(value: unknown, erreurs: string[]): VisualisationAnalyse[] {
  const resultat: VisualisationAnalyse[] = [];
  for (const [index, element] of listeNonVide(value, "visualisations", erreurs).entries()) {
    const chemin = `visualisations[${index}]`;
    if (!objet(element)) {
      erreurs.push(`${chemin} doit être un objet`);
      continue;
    }
    const valide = idStable(element.id, `${chemin}.id`, erreurs)
      && chaine(element.titre, `${chemin}.titre`, erreurs)
      && chaine(element.resume, `${chemin}.resume`, erreurs);
    if (typeof element.type !== "string" || !TYPES_VISUALISATION.has(element.type as TypeVisualisationAnalyse)) {
      erreurs.push(`${chemin}.type doit être line, bar, timeline ou snapshot_table`);
    }
    const seriesIds = element.seriesIds === undefined
      ? []
      : listeIds(element.seriesIds, `${chemin}.seriesIds`, erreurs);
    const preuveIds = element.preuveIds === undefined
      ? []
      : listeIds(element.preuveIds, `${chemin}.preuveIds`, erreurs);
    if (!seriesIds.length && !preuveIds.length) {
      erreurs.push(`${chemin} doit référencer au moins une série ou une preuve`);
    }
    if (element.axes !== undefined) {
      for (const [rang, axe] of listeNonVide(element.axes, `${chemin}.axes`, erreurs).entries()) {
        const cheminAxe = `${chemin}.axes[${rang}]`;
        if (!objet(axe)) {
          erreurs.push(`${cheminAxe} doit être un objet`);
          continue;
        }
        idStable(axe.id, `${cheminAxe}.id`, erreurs);
        chaine(axe.unit, `${cheminAxe}.unit`, erreurs);
        listeIds(axe.seriesIds, `${cheminAxe}.seriesIds`, erreurs, true);
      }
    }
    if (valide) resultat.push(element as unknown as VisualisationAnalyse);
  }
  return resultat;
}

function verifierSections(value: unknown, erreurs: string[]): SectionAnalyse[] {
  const resultat: SectionAnalyse[] = [];
  for (const [index, element] of listeNonVide(value, "sections", erreurs).entries()) {
    const chemin = `sections[${index}]`;
    if (!objet(element)) {
      erreurs.push(`${chemin} doit être un objet`);
      continue;
    }
    const valide = idStable(element.id, `${chemin}.id`, erreurs)
      && chaine(element.titre, `${chemin}.titre`, erreurs);
    listeChaines(element.paragraphes, `${chemin}.paragraphes`, erreurs, true);
    if (element.preuveIds !== undefined) {
      listeIds(element.preuveIds, `${chemin}.preuveIds`, erreurs);
    }
    if (element.visualisationIds !== undefined) {
      listeIds(element.visualisationIds, `${chemin}.visualisationIds`, erreurs);
    }
    if (valide) resultat.push(element as unknown as SectionAnalyse);
  }
  return resultat;
}

function exigerReference<T>(
  id: string,
  index: ReadonlyMap<string, T>,
  chemin: string,
  erreurs: string[],
): void {
  if (!index.has(id)) erreurs.push(`${chemin} référence « ${id} », introuvable`);
}

function verifierAxes(
  visualisation: VisualisationAnalyse,
  position: number,
  serieParId: ReadonlyMap<string, SerieAnalyse>,
  erreurs: string[],
): void {
  const chemin = `visualisations[${position}]`;
  const seriesIds = visualisation.seriesIds ?? [];
  const series = seriesIds
    .map((id) => serieParId.get(id))
    .filter((serie): serie is SerieAnalyse => serie !== undefined);
  const unites = new Set(series.map((serie) => serie.unit));
  if (unites.size > 1 && !visualisation.axes?.length) {
    erreurs.push(`${chemin}.axes est obligatoire pour plusieurs unités`);
    return;
  }
  if (!visualisation.axes) return;

  const axesVus = new Set<string>();
  const affectations = new Map<string, number>();
  visualisation.axes.forEach((axe, rang) => {
    const cheminAxe = `${chemin}.axes[${rang}]`;
    if (axesVus.has(axe.id)) erreurs.push(`${cheminAxe}.id duplique l'axe « ${axe.id} »`);
    axesVus.add(axe.id);
    axe.seriesIds.forEach((serieId, index) => {
      if (!seriesIds.includes(serieId)) {
        erreurs.push(`${cheminAxe}.seriesIds[${index}] référence « ${serieId} » hors de la visualisation`);
        return;
      }
      affectations.set(serieId, (affectations.get(serieId) ?? 0) + 1);
      const serie = serieParId.get(serieId);
      if (serie && axe.unit !== serie.unit) {
        erreurs.push(`${cheminAxe}.unit vaut « ${axe.unit} » au lieu de « ${serie.unit} » pour « ${serieId} »`);
      }
    });
  });
  seriesIds.forEach((serieId) => {
    const compte = affectations.get(serieId) ?? 0;
    if (compte !== 1) {
      erreurs.push(`${chemin}.axes doit affecter « ${serieId} » exactement une fois, reçu ${compte}`);
    }
  });
}

function lever(erreurs: string[]): never {
  throw new Error(`Contrat d'analyse invalide :\n- ${erreurs.join("\n- ")}`);
}

/**
 * Valide un dossier long et construit ses index de résolution.
 *
 * `undefined` est le format historique : il est volontairement accepté sans
 * exiger d'identifiant aux anciennes sources. Toute autre valeur active le
 * contrat strict et échoue avant rendu au moindre lien orphelin.
 */
export function validerDossierAnalyse(
  value: unknown,
  sourcesValue: unknown,
): DossierAnalyseValide | null {
  if (value === undefined) return null;
  const erreurs: string[] = [];
  if (!objet(value)) lever(["dossier doit être un objet"]);

  chaine(value.chapo, "chapo", erreurs);
  const sources = verifierSources(sourcesValue, erreurs);
  const series = verifierSeries(value.series, erreurs);
  const preuves = verifierPreuves(value.preuves, erreurs);
  const visualisations = verifierVisualisations(value.visualisations, erreurs);
  const sections = verifierSections(value.sections, erreurs);
  listeChaines(value.limitations, "limitations", erreurs, true);
  const sommaire = value.sommaire === undefined
    ? undefined
    : listeIds(value.sommaire, "sommaire", erreurs, true);

  const sourceParId = indexer(sources, "sources", erreurs);
  const serieParId = indexer(series, "series", erreurs);
  const preuveParId = indexer(preuves, "preuves", erreurs);
  const visualisationParId = indexer(visualisations, "visualisations", erreurs);
  const sectionParId = indexer(sections, "sections", erreurs);

  // Les vérifications relationnelles supposent des tableaux et chaînes déjà
  // contrôlés. S'arrêter ici sur une erreur de forme évite qu'un JSON hostile
  // ne transforme un diagnostic éditorial en TypeError opaque.
  if (erreurs.length) lever(erreurs);

  series.forEach((serie, index) => {
    exigerReference(serie.sourceId, sourceParId, `series[${index}].sourceId`, erreurs);
  });
  preuves.forEach((preuve, index) => {
    exigerReference(preuve.sourceId, sourceParId, `preuves[${index}].sourceId`, erreurs);
    if (!preuve.seriesId) return;
    const serie = serieParId.get(preuve.seriesId);
    if (!serie) {
      erreurs.push(`preuves[${index}].seriesId référence « ${preuve.seriesId} », introuvable`);
      return;
    }
    if (preuve.unit !== serie.unit) {
      erreurs.push(`preuves[${index}].unit vaut « ${preuve.unit} » au lieu de « ${serie.unit} »`);
    }
    if (preuve.sourceId !== serie.sourceId) {
      erreurs.push(`preuves[${index}].sourceId diffère de la source « ${serie.sourceId} » de sa série`);
    }
    const observation = serie.observations.find((candidate) => candidate.period === preuve.period);
    if (!observation) {
      erreurs.push(`preuves[${index}].period « ${preuve.period} » est absent de la série « ${serie.id} »`);
      return;
    }
    if (preuve.value !== observation.value) {
      erreurs.push(`preuves[${index}].value diffère de la valeur ${observation.value} publiée pour ${preuve.period}`);
    }
    if (!memesFlags(preuve.qualityFlags, observation.qualityFlags)) {
      erreurs.push(`preuves[${index}].qualityFlags diffère des flags de la série pour ${preuve.period}`);
    }
  });

  visualisations.forEach((visualisation, index) => {
    (visualisation.seriesIds ?? []).forEach((id, rang) =>
      exigerReference(id, serieParId, `visualisations[${index}].seriesIds[${rang}]`, erreurs)
    );
    (visualisation.preuveIds ?? []).forEach((id, rang) =>
      exigerReference(id, preuveParId, `visualisations[${index}].preuveIds[${rang}]`, erreurs)
    );
    verifierAxes(visualisation, index, serieParId, erreurs);
  });

  sections.forEach((section, index) => {
    (section.preuveIds ?? []).forEach((id, rang) =>
      exigerReference(id, preuveParId, `sections[${index}].preuveIds[${rang}]`, erreurs)
    );
    (section.visualisationIds ?? []).forEach((id, rang) =>
      exigerReference(id, visualisationParId, `sections[${index}].visualisationIds[${rang}]`, erreurs)
    );
  });
  sommaire?.forEach((id, index) =>
    exigerReference(id, sectionParId, `sommaire[${index}]`, erreurs)
  );

  if (erreurs.length) lever(erreurs);
  return {
    dossier: value as unknown as DossierAnalyse,
    sources,
    sourceParId,
    serieParId,
    preuveParId,
    visualisationParId,
    sectionParId,
  };
}

/** Résout la source exacte d'une preuve ; aucune provenance de repli. */
export function sourceDePreuve(
  contrat: DossierAnalyseValide,
  preuveId: string,
): SourceAnalyse {
  const preuve = contrat.preuveParId.get(preuveId);
  if (!preuve) throw new Error(`Preuve « ${preuveId} » introuvable dans le dossier validé`);
  const source = contrat.sourceParId.get(preuve.sourceId);
  if (!source) {
    throw new Error(`Source « ${preuve.sourceId} » introuvable pour la preuve « ${preuveId} »`);
  }
  return source;
}
