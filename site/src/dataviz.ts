/** Primitives éditoriales légères pour les graphiques du BILAN France. */

type Formateur = (valeur: number) => string;

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function moins(texte: string): string {
  return texte.replace(/^-/, "−");
}

function enteteSvg(titre: string, description: string): string {
  return `<title>${echapper(titre)}</title><desc>${echapper(description)}</desc>`;
}

export function tableauAccessible(libelle: string, tableau: string): string {
  return `<details class="dataviz__donnees">
    <summary>${echapper(libelle)}</summary>
    <div class="dataviz__tableau">${tableau}</div>
  </details>`;
}

export function graphiqueEcart(options: {
  titre: string;
  description: string;
  points: readonly { periode: string; haut: number; bas: number }[];
  noms: readonly [string, string];
  formater: Formateur;
}): string {
  const points = options.points.filter((p) => Number.isFinite(p.haut) && Number.isFinite(p.bas));
  if (points.length < 2) return "";
  const largeur = 720;
  const hauteur = 300;
  const marge = { x: 42, haut: 24, bas: 38 };
  const valeurs = points.flatMap((p) => [p.haut, p.bas]);
  const brutMin = Math.min(...valeurs);
  const brutMax = Math.max(...valeurs);
  const respiration = (brutMax - brutMin || Math.abs(brutMax) || 1) * 0.08;
  const min = brutMin - respiration;
  const max = brutMax + respiration;
  const x = (i: number) => marge.x + (i / (points.length - 1)) * (largeur - marge.x * 2);
  const y = (v: number) => marge.haut + ((max - v) / (max - min)) * (hauteur - marge.haut - marge.bas);
  const chemin = (cle: "haut" | "bas") => points
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[cle]).toFixed(1)}`)
    .join(" ");
  const zone = [
    ...points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.haut).toFixed(1)}`),
    ...[...points].reverse().map((p, ri) => {
      const i = points.length - 1 - ri;
      return `L${x(i).toFixed(1)},${y(p.bas).toFixed(1)}`;
    }),
    "Z",
  ].join(" ");
  const dernier = points[points.length - 1]!;
  const graduations = points
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i === 0 || i === points.length - 1 || i % Math.max(1, Math.ceil(points.length / 6)) === 0)
    .map(({ p, i }) => `<text class="dataviz__axe" x="${x(i).toFixed(1)}" y="286" text-anchor="middle">${echapper(p.periode)}</text>`)
    .join("");
  return `<figure class="dataviz dataviz--ecart">
    <svg viewBox="0 0 ${largeur} ${hauteur}" role="img">
      <title>${echapper(options.titre)}</title>
      <desc>${echapper(options.description)}</desc>
      <path class="dataviz__zone" d="${zone}" />
      <path class="dataviz__ligne dataviz__ligne--haut" d="${chemin("haut")}" />
      <path class="dataviz__ligne dataviz__ligne--bas" d="${chemin("bas")}" />
      ${graduations}
      <text class="dataviz__etiquette dataviz__etiquette--haut" x="676" y="${(y(dernier.haut) - 8).toFixed(1)}" text-anchor="end">${echapper(options.noms[0])} ${echapper(options.formater(dernier.haut))}</text>
      <text class="dataviz__etiquette dataviz__etiquette--bas" x="676" y="${(y(dernier.bas) + 18).toFixed(1)}" text-anchor="end">${echapper(options.noms[1])} ${echapper(options.formater(dernier.bas))}</text>
    </svg>
  </figure>`;
}

export function barreEmpilee(options: {
  titre: string;
  description: string;
  segments: readonly { libelle: string; valeur: number }[];
  formater: Formateur;
}): string {
  const segments = options.segments.filter((s) => Number.isFinite(s.valeur) && s.valeur > 0);
  const total = segments.reduce((s, e) => s + e.valeur, 0);
  if (!total) return "";
  const barre = segments.map((segment, i) => {
    const part = (segment.valeur / total) * 100;
    return `<span class="dataviz__segment dataviz__segment--${i % 6}" style="width:${part.toFixed(3)}%" title="${echapper(segment.libelle)} : ${echapper(options.formater(segment.valeur))}"></span>`;
  }).join("");
  const legende = segments.map((segment, i) => `<li>
    <span class="dataviz__puce dataviz__segment--${i % 6}" aria-hidden="true"></span>
    <span>${echapper(segment.libelle)}</span><strong>${echapper(options.formater(segment.valeur))}</strong>
  </li>`).join("");
  return `<figure class="dataviz dataviz--composition" role="img" aria-label="${echapper(`${options.titre}. ${options.description}`)}">
    <div class="dataviz__pile" aria-hidden="true">${barre}</div>
    <figcaption><strong>${echapper(options.titre)}</strong><ul>${legende}</ul></figcaption>
  </figure>`;
}

export function halteres(options: {
  titre: string;
  description: string;
  lignes: readonly { libelle: string; avant: number; apres: number; detail?: string }[];
  noms: readonly [string, string];
  formater: Formateur;
}): string {
  const lignes = options.lignes.filter((l) => Number.isFinite(l.avant) && Number.isFinite(l.apres));
  if (!lignes.length) return "";
  const valeurs = lignes.flatMap((l) => [l.avant, l.apres]);
  const min = Math.min(...valeurs, 0);
  const max = Math.max(...valeurs);
  const echelle = (v: number) => ((v - min) / (max - min || 1)) * 100;
  const rangs = lignes.map((ligne) => {
    const a = echelle(ligne.avant);
    const b = echelle(ligne.apres);
    const gauche = Math.min(a, b);
    const largeur = Math.abs(a - b);
    const label = `${ligne.libelle} : ${options.noms[0]} ${options.formater(ligne.avant)}, ${options.noms[1]} ${options.formater(ligne.apres)}`;
    return `<li class="dataviz__haltere" aria-label="${echapper(label)}">
      <span class="dataviz__nom">${echapper(ligne.libelle)}${ligne.detail ? `<small class="recettes__note">${echapper(ligne.detail)}</small>` : ""}</span>
      <span class="dataviz__rail" aria-hidden="true">
        <span class="dataviz__liaison" style="left:${gauche.toFixed(2)}%;width:${largeur.toFixed(2)}%"></span>
        <span class="dataviz__borne dataviz__borne--avant" style="left:${a.toFixed(2)}%"></span>
        <span class="dataviz__borne dataviz__borne--apres" style="left:${b.toFixed(2)}%"></span>
      </span>
      <span class="dataviz__valeurs"><span>${echapper(options.formater(ligne.avant))}</span><strong>${echapper(options.formater(ligne.apres))}</strong></span>
    </li>`;
  }).join("");
  return `<figure class="dataviz dataviz--halteres" aria-label="${echapper(`${options.titre}. ${options.description}`)}">
    <figcaption><strong>${echapper(options.titre)}</strong><span><i class="dataviz__borne dataviz__borne--avant"></i>${echapper(options.noms[0])}<i class="dataviz__borne dataviz__borne--apres"></i>${echapper(options.noms[1])}</span></figcaption>
    <ol>${rangs}</ol>
  </figure>`;
}

export function barresSolde(options: {
  titre: string;
  description: string;
  points: readonly { periode: string; valeur: number }[];
  formater: Formateur;
}): string {
  const points = options.points.filter((p) => Number.isFinite(p.valeur));
  if (!points.length) return "";
  const max = Math.max(...points.map((p) => Math.abs(p.valeur)), 1);
  const barres = points.map((point) => {
    const largeur = (Math.abs(point.valeur) / max) * 50;
    const negative = point.valeur < 0;
    return `<li aria-label="${echapper(`${point.periode} : ${moins(options.formater(point.valeur))}`)}">
      <span>${echapper(point.periode)}</span>
      <span class="dataviz__solde-rail" aria-hidden="true"><span class="dataviz__barre dataviz__barre--${negative ? "negative" : "positive"}" style="${negative ? "right" : "left"}:50%;width:${largeur.toFixed(2)}%"></span></span>
      <strong>${echapper(moins(options.formater(point.valeur)))}</strong>
    </li>`;
  }).join("");
  return `<figure class="dataviz dataviz--solde" aria-label="${echapper(`${options.titre}. ${options.description}`)}">
    <figcaption><strong>${echapper(options.titre)}</strong></figcaption><ol>${barres}</ol>
  </figure>`;
}

export function nuageComparatif(options: {
  titre: string;
  description: string;
  axeX: string;
  axeY: string;
  points: readonly { id: string; libelle: string; x: number; y: number; accent?: boolean }[];
  formater: Formateur;
  diagonale?: boolean;
}): string {
  const points = options.points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (points.length < 2) return "";
  const largeur = 720;
  const hauteur = 420;
  const marges = { gauche: 72, droite: 32, haut: 32, bas: 64 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const padX = (Math.max(...xs) - Math.min(...xs) || 1) * 0.16;
  const padY = (Math.max(...ys) - Math.min(...ys) || 1) * 0.16;
  const domaineCommun = options.diagonale ? [...xs, ...ys] : null;
  const minX = domaineCommun ? Math.min(...domaineCommun) - Math.max(padX, padY) : Math.min(...xs) - padX;
  const maxX = domaineCommun ? Math.max(...domaineCommun) + Math.max(padX, padY) : Math.max(...xs) + padX;
  const minY = domaineCommun ? minX : Math.min(...ys) - padY;
  const maxY = domaineCommun ? maxX : Math.max(...ys) + padY;
  const x = (v: number) => marges.gauche + ((v - minX) / (maxX - minX)) * (largeur - marges.gauche - marges.droite);
  const y = (v: number) => marges.haut + ((maxY - v) / (maxY - minY)) * (hauteur - marges.haut - marges.bas);
  const communMin = Math.max(minX, minY);
  const communMax = Math.min(maxX, maxY);
  const diagonale = options.diagonale && communMin < communMax
    ? `<line class="dataviz__equilibre" x1="${x(communMin).toFixed(1)}" y1="${y(communMin).toFixed(1)}" x2="${x(communMax).toFixed(1)}" y2="${y(communMax).toFixed(1)}" /><text class="dataviz__axe" x="${x(communMin).toFixed(1)}" y="${(y(communMin) - 8).toFixed(1)}">équilibre</text>`
    : "";
  const marques = points.map((point) => `<g class="dataviz__point${point.accent ? " dataviz__point--accent" : ""}" transform="translate(${x(point.x).toFixed(1)} ${y(point.y).toFixed(1)})">
    <circle r="${point.accent ? 8 : 5}"><title>${echapper(`${point.libelle}, ${options.axeX} ${options.formater(point.x)}, ${options.axeY} ${options.formater(point.y)}`)}</title></circle>
    <text x="10" y="4">${echapper(point.libelle)}</text>
  </g>`).join("");
  return `<figure class="dataviz dataviz--nuage">
    <svg viewBox="0 0 ${largeur} ${hauteur}" role="img">${enteteSvg(options.titre, options.description)}
      <line class="dataviz__axe-ligne" x1="${marges.gauche}" y1="${hauteur - marges.bas}" x2="${largeur - marges.droite}" y2="${hauteur - marges.bas}" />
      <line class="dataviz__axe-ligne" x1="${marges.gauche}" y1="${marges.haut}" x2="${marges.gauche}" y2="${hauteur - marges.bas}" />
      ${diagonale}${marques}
      <text class="dataviz__titre-axe" x="${largeur / 2}" y="405" text-anchor="middle">${echapper(options.axeX)}</text>
      <text class="dataviz__titre-axe" transform="translate(18 ${hauteur / 2}) rotate(-90)" text-anchor="middle">${echapper(options.axeY)}</text>
    </svg>
  </figure>`;
}
