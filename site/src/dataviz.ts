import { timeChart } from "./chart-studio.ts";
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
  return `<div class="dataviz dataviz--ecart" data-chart-system="lieflat">${timeChart({
    title: options.titre, description: options.description, unit: "Milliards d'euros courants", gap: true,
    series: [
      { name: options.noms[0], values: Object.fromEntries(options.points.map(p => [p.periode, p.haut])) },
      { name: options.noms[1], values: Object.fromEntries(options.points.map(p => [p.periode, p.bas])) },
    ], format: options.formater,
  })}</div>`;
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
  let offset=0;
  const cells=segments.map((segment,i)=>{
    const end=offset+segment.valeur/total*100;
    let rectangles='';
    for(let cell=Math.floor(offset);cell<Math.min(100,Math.ceil(end));cell++){
      const from=Math.max(offset,cell)-cell, to=Math.min(end,cell+1)-cell;
      rectangles+=`<rect data-waffle-part="${i}" class="dataviz__segment--${i%6}" x="${cell%10*22+from*18}" y="${Math.floor(cell/10)*22}" width="${Math.max(0,to-from)*18}" height="18"/>`;
    }
    offset=end;return rectangles;
  }).join('');
  const legende=segments.map((segment,i)=>`<button type="button" class="waffle-key" data-waffle-key="${i}" aria-pressed="false"><span class="dataviz__puce dataviz__segment--${i%6}" aria-hidden="true"></span><span>${echapper(segment.libelle)}</span><strong>${echapper(options.formater(segment.valeur))}</strong></button>`).join('');
  return `<figure class="dataviz dataviz--composition" data-chart-system="lieflat" aria-label="${echapper(`${options.titre}. ${options.description}`)}">
    <figcaption><strong>${echapper(options.titre)}</strong></figcaption>
    <div class="dataviz__pile" aria-hidden="true">${barre}</div>
    <div class="waffle-layout"><div><svg class="waffle" viewBox="0 0 220 220" role="img" aria-label="Composition du total en 100 cases, une case pour un pour cent">${cells}</svg><p class="waffle-caption">1 case = 1 % du total</p></div><div>${legende}</div></div>
  </figure>`;
}

export function barresClassees(options: {
  titre: string;
  description: string;
  lignes: readonly { libelle: string; valeur: number }[];
  formater: Formateur;
  accent?: string;
  titreVisible?: boolean;
}): string {
  const lignes = options.lignes
    .filter((ligne) => Number.isFinite(ligne.valeur) && ligne.valeur >= 0)
    .sort((a, b) => b.valeur - a.valeur);
  if (!lignes.length) return "";
  const maximum = Math.max(...lignes.map((ligne) => ligne.valeur), 1);
  const rangs = lignes.map((ligne) => {
    const largeur = (ligne.valeur / maximum) * 100;
    const valeur = options.formater(ligne.valeur);
    return `<li aria-label="${echapper(`${ligne.libelle} : ${valeur}`)}">
      <span class="dataviz__barres-libelle">${echapper(ligne.libelle)}</span>
      <span class="dataviz__barres-rail" aria-hidden="true"><span style="width:${largeur.toFixed(2)}%"></span></span>
      <strong>${echapper(valeur)}</strong>
    </li>`;
  }).join("");
  return `<figure class="dataviz dataviz--barres" data-chart-system="lieflat" aria-label="${echapper(`${options.titre}. ${options.description}`)}"${
    options.accent ? ` style="--dataviz-accent:${echapper(options.accent)}"` : ""
  }>
    ${options.titreVisible === false ? "" : `<figcaption><strong>${echapper(options.titre)}</strong></figcaption>`}
    <ol>${rangs}</ol>
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
  return `<figure class="dataviz dataviz--halteres" data-chart-system="lieflat" aria-label="${echapper(`${options.titre}. ${options.description}`)}">
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
  const libellesLongs = points.some((point) => point.periode.length > 12);
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
  return `<figure class="dataviz dataviz--solde${libellesLongs ? " dataviz--solde-long" : ""}" data-chart-system="lieflat" aria-label="${echapper(`${options.titre}. ${options.description}`)}">
    <figcaption><strong>${echapper(options.titre)}</strong></figcaption><ol>${barres}</ol>
  </figure>`;
}

/** Comparaison d'un même indicateur entre pays ou territoires.
 * Un point sur une seule échelle se lit mieux qu'un nuage à deux axes quand
 * la question porte sur un ratio unique : les lignes sont triées, la France
 * reste accentuée et la valeur demeure lisible à 390 px. */
export function pointsComparatifs(options: {
  titre: string;
  description: string;
  points: readonly { libelle: string; valeur: number; accent?: boolean }[];
  formater: Formateur;
}): string {
  const points = options.points.filter((p) => Number.isFinite(p.valeur)).sort((a, b) => b.valeur - a.valeur);
  if (points.length < 2) return "";
  const valeurs = points.map((p) => p.valeur);
  const amplitude = Math.max(...valeurs) - Math.min(...valeurs);
  const marge = amplitude || Math.max(Math.abs(valeurs[0]!), 1) * 0.08;
  const min = Math.min(...valeurs) - marge;
  const max = Math.max(...valeurs) + marge;
  const position = (valeur: number) => ((valeur - min) / (max - min || 1)) * 100;
  const lignes = points.map((point) => {
    const valeur = options.formater(point.valeur);
    return `<li class="dataviz__point-rang${point.accent ? " dataviz__point-rang--accent" : ""}" aria-label="${echapper(`${point.libelle} : ${valeur}`)}">
      <span class="dataviz__point-nom">${echapper(point.libelle)}</span>
      <span class="dataviz__point-rail" aria-hidden="true"><span style="left:${position(point.valeur).toFixed(2)}%"></span></span>
      <strong>${echapper(valeur)}</strong>
    </li>`;
  }).join("");
  return `<figure class="dataviz dataviz--points" data-chart-system="lieflat" aria-label="${echapper(`${options.titre}. ${options.description}`)}">
    <figcaption><strong>${echapper(options.titre)}</strong></figcaption>
    <ol>${lignes}</ol>
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
  return `<figure class="dataviz dataviz--nuage" data-chart-system="lieflat">
    <svg viewBox="0 0 ${largeur} ${hauteur}" role="img">${enteteSvg(options.titre, options.description)}
      <line class="dataviz__axe-ligne" x1="${marges.gauche}" y1="${hauteur - marges.bas}" x2="${largeur - marges.droite}" y2="${hauteur - marges.bas}" />
      <line class="dataviz__axe-ligne" x1="${marges.gauche}" y1="${marges.haut}" x2="${marges.gauche}" y2="${hauteur - marges.bas}" />
      ${diagonale}${marques}
      <text class="dataviz__titre-axe" x="${largeur / 2}" y="405" text-anchor="middle">${echapper(options.axeX)}</text>
      <text class="dataviz__titre-axe" transform="translate(18 ${hauteur / 2}) rotate(-90)" text-anchor="middle">${echapper(options.axeY)}</text>
    </svg>
  </figure>`;
}
