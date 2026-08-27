export type FamilleInsight =
  | "budget"
  | "fiscalite"
  | "generation"
  | "travail"
  | "logement"
  | "services"
  | "securite"
  | "environnement";

export type PreuveInsight = {
  indicateur: string;
  periode: string;
  valeur: number;
  libelle: string;
};

export type Insight = {
  id: string;
  famille: FamilleInsight;
  surtitre: string;
  titre: string;
  texte: string;
  reserve: string;
  /** Comparaison harmonisée au même exercice, uniquement quand Eurostat
   * publie la même série pour plusieurs voisins. */
  comparaison?: string;
  preuves: PreuveInsight[];
};

export type PointSerie = {
  periode: string;
  valeur: number;
};

export type VariationSerie = {
  de: string;
  a: string;
  depart: number;
  arrivee: number;
  delta: number;
  pourcentage: number;
};

type Serie = Record<string, number>;

function pointsFinis(serie?: Serie): PointSerie[] {
  if (!serie) return [];
  return Object.entries(serie)
    .filter((entree): entree is [string, number] => Number.isFinite(entree[1]))
    .sort(([periodeA], [periodeB]) => periodeA.localeCompare(periodeB))
    .map(([periode, valeur]) => ({ periode, valeur }));
}

export function derniere(serie?: Serie): PointSerie | null {
  return pointsFinis(serie).at(-1) ?? null;
}

export function periodeCommune(series: Array<Serie | undefined>): string | null {
  if (series.length === 0 || series.some((serie) => !serie)) return null;

  const [premiere, ...autres] = series.map((serie) =>
    new Set(pointsFinis(serie).map(({ periode }) => periode)),
  );
  const communes = [...premiere].filter((periode) =>
    autres.every((periodes) => periodes.has(periode)),
  );

  return communes.sort((a, b) => a.localeCompare(b)).at(-1) ?? null;
}

export function variation(serie?: Serie): VariationSerie | null {
  const points = pointsFinis(serie);
  if (points.length < 2) return null;

  const depart = points[0];
  const arrivee = points.at(-1)!;
  if (
    depart.valeur === 0 ||
    Math.sign(depart.valeur) !== Math.sign(arrivee.valeur)
  ) {
    return null;
  }

  const delta = arrivee.valeur - depart.valeur;
  return {
    de: depart.periode,
    a: arrivee.periode,
    depart: depart.valeur,
    arrivee: arrivee.valeur,
    delta,
    pourcentage: (delta / Math.abs(depart.valeur)) * 100,
  };
}

export function ecartRelatif(reference: number, observe: number): number | null {
  if (!Number.isFinite(reference) || !Number.isFinite(observe) || reference === 0) {
    return null;
  }
  return ((observe - reference) / Math.abs(reference)) * 100;
}
