/**
 * Croiser deux indicateurs : nuage de points, droite des moindres carrés,
 * coefficient de Pearson — l'outil d'analyse, avec ses garde-fous écrits.
 *
 * Le r de Pearson mesure une relation **linéaire** entre deux variables. Il
 * ne dit rien de la causalité, il est sensible aux valeurs extrêmes (une
 * commune touristique pèse autant que cent autres), et un croisement de
 * millésimes différents se signale. Ces limites ne sont pas des notes de bas
 * de page : elles s'affichent à côté du chiffre, sinon le chiffre ment.
 */

export type PointNomme = { code: string; nom: string; x: number; y: number };

/** r de Pearson. `null` sous huit points : un coefficient sur une poignée de
 *  territoires est un dé à six faces, pas une mesure. */
export function pearson(points: { x: number; y: number }[]): number | null {
  const n = points.length;
  if (n < 8) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const p of points) {
    const dx = p.x - mx;
    const dy = p.y - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const denominateur = Math.sqrt(sxx) * Math.sqrt(syy);
  return denominateur ? sxy / denominateur : null;
}

/** Droite des moindres carrés y = a·x + b, ou `null` si x est constant. */
export function moindresCarres(
  points: { x: number; y: number }[],
): { a: number; b: number } | null {
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (const p of points) {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) * (p.x - mx);
  }
  if (!sxx) return null;
  const a = sxy / sxx;
  return { a, b: my - a * mx };
}

/** La force d'une corrélation, dite avec les mots de la statistique — jamais
 *  « bonne » ou « mauvaise », qui seraient des jugements. */
export function lectureDeR(r: number | null, n: number): string {
  if (r === null) {
    return `Trop peu de territoires communs (${n}) pour calculer une corrélation honnête.`;
  }
  const force =
    Math.abs(r) >= 0.7
      ? "forte"
      : Math.abs(r) >= 0.4
        ? "modérée"
        : Math.abs(r) >= 0.2
          ? "faible"
          : "quasi nulle";
  const sens = r >= 0 ? "positive" : "négative";
  return `Corrélation linéaire ${force} et ${sens}.`;
}

/** Jointure des deux jeux par code territoire, avec ramenage par habitant
 *  indicateur par indicateur — la même règle que la carte. */
export function joindre(
  xs: Record<string, number>,
  ys: Record<string, number>,
  noms: Record<string, string>,
  populations: Record<string, number>,
  parHabitantX: boolean,
  parHabitantY: boolean,
): PointNomme[] {
  const points: PointNomme[] = [];
  for (const [code, brutX] of Object.entries(xs)) {
    const brutY = ys[code];
    if (brutY === undefined) continue;
    const pop = populations[code];
    const x = parHabitantX ? (pop ? brutX / pop : NaN) : brutX;
    const y = parHabitantY ? (pop ? brutY / pop : NaN) : brutY;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    points.push({ code, nom: noms[code] ?? code, x, y });
  }
  return points;
}

/** Passage en logarithme décimal — seulement si tout est strictement positif,
 *  sinon on refuse plutôt que d'écarter en silence. */
export function enLog(points: PointNomme[]): PointNomme[] | null {
  if (points.some((p) => p.x <= 0 || p.y <= 0)) return null;
  return points.map((p) => ({ ...p, x: Math.log10(p.x), y: Math.log10(p.y) }));
}


/* ------------------------------------------------------------------ *
 * Matrice de corrélations : tous les indicateurs deux à deux.         *
 * ------------------------------------------------------------------ */

export type SerieCroisable = {
  id: string;
  libelle: string;
  /** Valeurs brutes par code territoire. */
  valeurs: Record<string, number>;
  /** Ramener par habitant avant de corréler ? (règle de la carte) */
  parHabitant: boolean;
};

export type Cellule = { i: number; j: number; r: number | null; n: number };

/**
 * Matrice symétrique des r de Pearson.
 *
 * Chaque paire est calculée sur **son propre** ensemble de territoires
 * communs : deux indicateurs de couverture différente (le taux de pauvreté
 * n'est diffusé que pour 2 482 communes) ne se corrèlent que là où les deux
 * existent. Le n de chaque cellule est donc porté avec elle — une matrice
 * qui l'oublierait ferait comparer des coefficients calculés sur des mondes
 * différents.
 */
export function matrice(
  series: SerieCroisable[],
  populations: Record<string, number>,
): Cellule[] {
  const cellules: Cellule[] = [];
  for (let i = 0; i < series.length; i++) {
    for (let j = 0; j <= i; j++) {
      const a = series[i];
      const b = series[j];
      const points = joindre(
        a.valeurs, b.valeurs, {}, populations, a.parHabitant, b.parHabitant,
      );
      cellules.push({ i, j, r: i === j ? 1 : pearson(points), n: points.length });
    }
  }
  return cellules;
}

/** Couleur d'une cellule : divergente, argile pour le négatif, nuit pour le
 *  positif, papier au milieu. L'intensité suit |r| — jamais une couleur
 *  saturée pour une corrélation faible. */
export function couleurCellule(r: number | null): string {
  if (r === null) return "transparent";
  const force = Math.min(1, Math.abs(r));
  return r >= 0
    ? `rgb(15 27 46 / ${(0.08 + force * 0.82).toFixed(3)})`
    : `rgb(197 106 77 / ${(0.08 + force * 0.82).toFixed(3)})`;
}

/** Les paires les plus corrélées, hors diagonale — ce que la matrice montre
 *  d'un coup d'œil, écrit en toutes lettres pour qui ne lit pas les couleurs. */
export function paires(
  cellules: Cellule[],
  series: SerieCroisable[],
  combien = 3,
): { a: string; b: string; r: number; n: number }[] {
  return cellules
    .filter((c) => c.i !== c.j && c.r !== null)
    .sort((x, y) => Math.abs(y.r as number) - Math.abs(x.r as number))
    .slice(0, combien)
    .map((c) => ({
      a: series[c.i].libelle,
      b: series[c.j].libelle,
      r: c.r as number,
      n: c.n,
    }));
}
