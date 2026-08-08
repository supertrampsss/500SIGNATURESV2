/**
 * Graphique de séries temporelles multi-pays, écrit à la main en SVG.
 *
 * C'est la pièce maîtresse des décryptages : la pédagogie passe par la
 * courbe, pas par un tableau de chiffres. Les exigences qui ont mené à
 * l'écrire plutôt qu'à importer une bibliothèque :
 *
 * - **l'axe zéro est un repère moral autant que graphique** — une croissance
 *   négative doit se voir passer sous la ligne, jamais être noyée dans une
 *   échelle tronquée qui dramatise ou minimise ;
 * - **un point manquant casse la ligne** : relier deux valeurs par-dessus un
 *   trou inventerait une donnée. Le segment s'interrompt, c'est l'honnêteté
 *   du tracé ;
 * - l'échelle est calculée sur des pas « ronds » (0,5 — 1 — 2 — 5…), jamais
 *   ajustée pour faire paraître une pente plus forte qu'elle n'est ;
 * - tout le rendu est une fonction pure chaîne → chaîne, testable sans DOM.
 *
 * L'interactivité (infobulle, curseur, période) vit dans le bloc appelant :
 * ici on ne produit que le dessin et sa géométrie, pour que l'appelant sache
 * convertir une position de pointeur en période.
 */

export type Point = [string, number];

export type Serie = {
  nom: string;
  couleur: string;
  points: Point[];
  /** La série mise en avant (la France) : trait plus épais. */
  accent?: boolean;
  /** Les agrégats (zone euro) : pointillés, ils ne sont pas un pays. */
  pointille?: boolean;
};

export type Geometrie = {
  largeur: number;
  hauteur: number;
  gauche: number;
  droite: number;
  haut: number;
  bas: number;
  periodes: string[];
};

const MARGES = { gauche: 46, droite: 14, haut: 14, bas: 26 };

/**
 * Le dessin d'un téléphone n'est pas celui d'un écran large réduit.
 *
 * Les tailles de texte du graphique sont en **unités du viewBox**, pas en
 * pixels CSS : le SVG est mis à l'échelle par sa largeur, et la feuille de
 * style ne peut rien y faire. Deux conséquences, deux corrections.
 *
 * D'abord, quarante-six unités de marge à gauche prennent six pour cent d'un
 * dessin de 720 et onze pour cent d'un dessin de 340 : sur un téléphone, la
 * gouttière des étiquettes mange la courbe. Elles se resserrent.
 *
 * Ensuite, douze unités de texte se rendent à douze pixels **quand le dessin
 * est affiché à la largeur qu'on lui a donnée** — c'est le contrat de
 * `largeur`. Sur un dessin étroit, la marge d'erreur est mince : une unité de
 * plus met les étiquettes au-dessus du plancher de lisibilité sans changer le
 * rendu des écrans larges.
 */
const MARGES_ETROITES = { gauche: 34, droite: 10, haut: 12, bas: 24 };

/** En deçà, le dessin est celui d'un téléphone (40rem moins les gouttières). */
export const LARGEUR_ETROITE = 480;

export function typographieDuDessin(largeur: number): {
  marges: typeof MARGES;
  corps: number;
} {
  return largeur < LARGEUR_ETROITE
    ? { marges: MARGES_ETROITES, corps: 13 }
    : { marges: MARGES, corps: 12 };
}

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** « 2025-12 » → « décembre 2025 », « 2026-Q2 » → « 2ᵉ trimestre 2026 ». */
export function periodeLisible(periode: string): string {
  const trimestre = periode.match(/^(\d{4})-Q([1-4])$/);
  if (trimestre) {
    const rang = trimestre[2] === "1" ? "1ᵉʳ" : `${trimestre[2]}ᵉ`;
    return `${rang} trimestre ${trimestre[1]}`;
  }
  const mois = periode.match(/^(\d{4})-(\d{2})$/);
  if (mois) {
    const nom = new Date(Number(mois[1]), Number(mois[2]) - 1, 1).toLocaleDateString("fr-FR", {
      month: "long",
    });
    return `${nom} ${mois[1]}`;
  }
  return periode;
}

/** Pas « rond » le plus proche pour viser environ `cible` graduations. */
export function pasArrondi(amplitude: number, cible = 4): number {
  const brut = amplitude / cible || 1;
  const base = 10 ** Math.floor(Math.log10(brut));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (base * m >= brut) return base * m;
  }
  return base * 10;
}

/**
 * Graduations de l'axe vertical, bornes comprises.
 *
 * Le zéro est inclus quand il est à portée (à moins d'une amplitude du bord) :
 * une inflation entre 2 et 12 % se lit depuis zéro, c'est le niveau qui parle.
 * Mais on ne l'impose pas de force — pour une série entre 96 et 102, l'étirer
 * jusqu'à zéro écraserait toute l'information dans un trait plat.
 */
export function graduations(min: number, max: number): number[] {
  const amplitude = max - min || 1;
  const bas = min > 0 && min <= amplitude ? 0 : min;
  const haut = max < 0 && -max <= amplitude ? 0 : max;
  const pas = pasArrondi(haut - bas || 1);
  // Les graduations doivent couvrir les données : un maximum au-dessus de la
  // dernière graduation sortirait du cadre, coupé sans prévenir.
  const premiere = Math.floor(bas / pas) * pas;
  const derniere = Math.ceil(haut / pas) * pas;
  const ticks: number[] = [];
  for (let v = premiere; v <= derniere + pas * 0.001; v += pas) {
    // les flottants dérivent (0,30000000000000004) : on arrondit au pas
    ticks.push(Math.round(v / pas) * pas);
  }
  return ticks;
}

/**
 * Indices des graduations de l'axe du temps : chaque début d'année, aminci
 * s'il y a plus de huit ans — un axe illisible n'informe personne.
 */
export function graduationsTemps(periodes: string[]): number[] {
  const debuts = periodes
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.endsWith("-01") || p.endsWith("Q1") || /^\d{4}$/.test(p))
    .map(({ i }) => i);
  if (debuts.length === 0) return periodes.length > 1 ? [0, periodes.length - 1] : [0];
  const pas = Math.ceil(debuts.length / 8);
  return debuts.filter((_, rang) => rang % pas === 0);
}

function chemins(
  points: Point[],
  periodes: string[],
  x: (i: number) => number,
  y: (v: number) => number,
): string {
  // Un trou dans la série ouvre un nouveau segment : jamais de pont inventé.
  const valeurs = new Map(points);
  const segments: string[][] = [[]];
  periodes.forEach((periode, i) => {
    const v = valeurs.get(periode);
    if (v === undefined) {
      if (segments[segments.length - 1].length) segments.push([]);
    } else {
      segments[segments.length - 1].push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    }
  });
  return segments
    .filter((s) => s.length > 1)
    .map((s) => `<polyline points="${s.join(" ")}" />`)
    .join("");
}

/**
 * Dessine le graphique. Rendu pur : mêmes séries, même chaîne.
 * La géométrie retournée permet à l'appelant de convertir un x de pointeur
 * en indice de période (interaction), sans re-calculer l'échelle.
 */
export function dessiner(
  series: Serie[],
  options: {
    largeur?: number;
    hauteur?: number;
    formater: (v: number) => string;
    titre: string;
  },
): { svg: string; geometrie: Geometrie } {
  const largeur = options.largeur ?? 720;
  const hauteur = options.hauteur ?? 300;
  const periodes = [...new Set(series.flatMap((s) => s.points.map(([p]) => p)))].sort();
  const valeurs = series.flatMap((s) => s.points.map(([, v]) => v));
  const { marges, corps } = typographieDuDessin(largeur);
  const geometrie: Geometrie = {
    largeur,
    hauteur,
    gauche: marges.gauche,
    droite: largeur - marges.droite,
    haut: marges.haut,
    bas: hauteur - marges.bas,
    periodes,
  };
  if (!periodes.length || !valeurs.length) return { svg: "", geometrie };

  const ticks = graduations(Math.min(...valeurs), Math.max(...valeurs));
  const vMin = ticks[0];
  const vMax = ticks[ticks.length - 1];
  const x = (i: number) =>
    periodes.length === 1
      ? (geometrie.gauche + geometrie.droite) / 2
      : geometrie.gauche + (i / (periodes.length - 1)) * (geometrie.droite - geometrie.gauche);
  const y = (v: number) =>
    geometrie.bas - ((v - vMin) / (vMax - vMin || 1)) * (geometrie.bas - geometrie.haut);

  const grille = ticks
    .map((t) => {
      const classe = t === 0 ? "graphique__zero" : "graphique__grille";
      return `<line class="${classe}" x1="${geometrie.gauche}" y1="${y(t).toFixed(1)}"
        x2="${geometrie.droite}" y2="${y(t).toFixed(1)}" />
      <text class="graphique__etiquette" font-size="${corps}"
        x="${geometrie.gauche - 6}" y="${(y(t) + 3.5).toFixed(1)}"
        text-anchor="end">${echapper(options.formater(t))}</text>`;
    })
    .join("");

  const axeTemps = graduationsTemps(periodes)
    .map((i) => {
      const annee = periodes[i].slice(0, 4);
      return `<text class="graphique__etiquette" font-size="${corps}" x="${x(i).toFixed(1)}"
        y="${hauteur - 8}" text-anchor="middle">${echapper(annee)}</text>`;
    })
    .join("");

  const courbes = series
    .map((s) => {
      const classes = [
        "graphique__serie",
        s.accent ? "graphique__serie--accent" : "",
        s.pointille ? "graphique__serie--pointille" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<g class="${classes}" stroke="${echapper(s.couleur)}">${chemins(
        s.points,
        periodes,
        x,
        y,
      )}</g>`;
    })
    .join("");

  // La série mise en avant est annotée : son plus haut, son plus bas et son
  // dernier point portent leur valeur — le lecteur n'a plus à interroger la
  // courbe pour savoir jusqu'où elle est montée.
  const accent = series.find((s) => s.accent);
  let annotations = "";
  if (accent && accent.points.length >= 3) {
    const indexPeriode = new Map(periodes.map((p, i) => [p, i]));
    const points = accent.points
      .filter(([p]) => indexPeriode.has(p))
      .map(([p, v]) => ({ i: indexPeriode.get(p) as number, v }));
    const haut2 = points.reduce((a, b) => (b.v > a.v ? b : a));
    const bas2 = points.reduce((a, b) => (b.v < a.v ? b : a));
    const dernier = points[points.length - 1];
    const marques = new Map<number, { v: number; role: string }>();
    marques.set(haut2.i, { v: haut2.v, role: "haut" });
    if (!marques.has(bas2.i)) marques.set(bas2.i, { v: bas2.v, role: "bas" });
    if (!marques.has(dernier.i)) marques.set(dernier.i, { v: dernier.v, role: "dernier" });
    annotations = [...marques.entries()]
      .map(([i, { v, role }]) => {
        const cx = x(i);
        const cy = y(v);
        const versLaFin = cx > geometrie.droite - 52;
        const texte = echapper(options.formater(v));
        const posX = role === "dernier" && !versLaFin ? cx + 7 : cx;
        const ancre =
          role === "dernier" && !versLaFin ? "start" : versLaFin ? "end" : "middle";
        const posY = role === "bas" ? cy + 16 : role === "haut" ? cy - 7 : cy - 8;
        return `<circle class="graphique__point" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}"
          r="3" fill="${echapper(accent.couleur)}" />
        <text class="graphique__valeur" font-size="${corps}" x="${(role === "dernier" && !versLaFin
          ? posX
          : versLaFin
            ? cx - 4
            : posX
        ).toFixed(1)}" y="${posY.toFixed(1)}" text-anchor="${ancre}">${texte}</text>`;
      })
      .join("");
    // L'aire sous la courbe de la série accent, à peine teintée : elle ancre
    // la France sans écraser les voisins. Un trou casse l'aire comme la ligne.
    const segments: { i: number; v: number }[][] = [[]];
    periodes.forEach((periode, i) => {
      const point = points.find((pt) => pt.i === i);
      const valeurs2 = new Map(accent.points);
      const v = valeurs2.get(periode);
      void point;
      if (v === undefined) {
        if (segments[segments.length - 1].length) segments.push([]);
      } else {
        segments[segments.length - 1].push({ i, v });
      }
    });
    const aire = segments
      .filter((seg) => seg.length > 1)
      .map((seg) => {
        const dessus = seg.map(({ i, v }) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
        const basGauche = `${x(seg[0].i).toFixed(1)},${geometrie.bas}`;
        const basDroit = `${x(seg[seg.length - 1].i).toFixed(1)},${geometrie.bas}`;
        return `<polygon class="graphique__aire" points="${basGauche} ${dessus.join(" ")} ${basDroit}" />`;
      })
      .join("");
    annotations = aire + annotations;
  }

  const debut = periodeLisible(periodes[0]);
  const fin = periodeLisible(periodes[periodes.length - 1]);
  const resume = `${options.titre}, de ${debut} à ${fin}. ${series
    .map((s) => {
      const dernier = s.points[s.points.length - 1];
      return dernier ? `${s.nom} : ${options.formater(dernier[1])}` : s.nom;
    })
    .join(" ; ")}.`;

  const svg = `<svg viewBox="0 0 ${largeur} ${hauteur}" class="graphique__dessin" role="img"
    aria-label="${echapper(resume)}">
    ${grille}${axeTemps}${annotations}${courbes}
  </svg>`;
  return { svg, geometrie };
}

/** Indice de la période la plus proche d'une abscisse (en unités du viewBox). */
export function periodeAuPoint(geometrie: Geometrie, xAbs: number): number {
  const n = geometrie.periodes.length;
  if (n < 2) return 0;
  const part = (xAbs - geometrie.gauche) / (geometrie.droite - geometrie.gauche);
  return Math.max(0, Math.min(n - 1, Math.round(part * (n - 1))));
}
