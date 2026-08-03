/**
 * Le décryptage de conjoncture : l'inflation du mois, la croissance du
 * trimestre — la France au milieu de ses voisins, en courbes.
 *
 * La forme est celle de la pédagogie par le graphique : un chiffre en une
 * phrase, la courbe qui le met en perspective, l'avertissement de méthode qui
 * évite le contresens. **La doctrine tient** : uniquement des chiffres
 * officiels sourcés (Eurostat, définitions harmonisées), jamais d'opinion ni
 * de prévision — la courbe s'arrête au dernier point publié.
 *
 * Deux contresens sont désamorcés par écrit, parce qu'ils sont fréquents :
 * - l'IPCH n'est pas l'indice des prix de l'INSEE (pondérations différentes) ;
 * - la croissance est ici en glissement annuel, pas le « trimestre sur
 *   trimestre » des titres de presse — les deux chiffres coexistent et ne se
 *   comparent pas.
 *
 * L'infobulle et la fenêtre temporelle (5 ans / 10 ans / tout) sont câblées
 * ici ; le dessin lui-même vient de graphique.ts et reste une fonction pure.
 */

import type { Indicateur, Territoire } from "./donnees.ts";
import { dessiner, periodeAuPoint, periodeLisible, type Geometrie, type Serie } from "./graphique.ts";

export const INFLATION = "eurostat_inflation_ipch";
export const CROISSANCE = "eurostat_croissance_pib";

const FINE = "\u202f";

/** Pays comparés : la France en avant, trois voisins, la zone euro en repère. */
export const PAYS: { code: string; nom: string; couleur: string; accent?: boolean; pointille?: boolean }[] = [
  { code: "FR", nom: "France", couleur: "#0f1b2e", accent: true },
  { code: "DE", nom: "Allemagne", couleur: "#c56a4d" },
  { code: "IT", nom: "Italie", couleur: "#6e7d73" },
  { code: "ES", nom: "Espagne", couleur: "#b69b53" },
  { code: "EA20", nom: "Zone euro", couleur: "#8b93a0", pointille: true },
];

export const FENETRES: { cle: string; libelle: string; annees: number | null }[] = [
  { cle: "5", libelle: "5 ans", annees: 5 },
  { cle: "10", libelle: "10 ans", annees: 10 },
  { cle: "tout", libelle: "Tout", annees: null },
];

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** « +0,8 % » / « −0,2 % » : un taux de variation se lit signé. */
export function taux(valeur: number): string {
  const texte = valeur.toLocaleString("fr-FR", {
    signDisplay: "exceptZero",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${texte}${FINE}%`;
}

/** Les séries d'un indicateur pour les pays comparés, bornées à la fenêtre. */
export function extraireSeries(
  pays: Record<string, Territoire>,
  indicateur: string,
  annees: number | null,
): Serie[] {
  const toutes = PAYS.flatMap((p) => {
    const serie = pays[p.code]?.series?.[indicateur];
    if (!serie) return [];
    const points = Object.entries(serie).sort(([a], [b]) => a.localeCompare(b));
    return [{ ...p, points }];
  });
  if (annees === null) return toutes.map(({ nom, couleur, accent, pointille, points }) => ({ nom, couleur, accent, pointille, points }));
  const dernieres = toutes.flatMap((s) => s.points.map(([p]) => p)).sort();
  const fin = dernieres[dernieres.length - 1];
  if (!fin) return [];
  const depuis = `${Number(fin.slice(0, 4)) - annees}${fin.slice(4)}`;
  return toutes.map(({ nom, couleur, accent, pointille, points }) => ({
    nom,
    couleur,
    accent,
    pointille,
    points: points.filter(([p]) => p > depuis),
  }));
}

function dernierPoint(serie: Record<string, number> | undefined): [string, number] | null {
  if (!serie) return null;
  const periodes = Object.keys(serie).sort();
  const p = periodes[periodes.length - 1];
  return p ? [p, serie[p]] : null;
}

type Volet = {
  cle: string;
  indicateur: string;
  titre: string;
  phrase: (periode: string, fr: number, ea: number | undefined) => string;
  note: string;
};

/** « 1,3 % » sans signe : pour les phrases où le verbe porte déjà le sens. */
function sansSigne(valeur: number): string {
  return taux(Math.abs(valeur)).replace("+", "");
}

const VOLETS: Volet[] = [
  {
    cle: "inflation",
    indicateur: INFLATION,
    titre: "L'inflation, mois par mois",
    phrase: (periode, fr, ea) =>
      `En ${periodeLisible(periode)}, les prix ont ${fr >= 0 ? "augmenté" : "baissé"} de` +
      ` <strong>${sansSigne(fr)}</strong> sur un an en France` +
      (ea === undefined ? "." : `, contre ${taux(ea).replace("+", "")} dans la zone euro.`),
    note:
      "Indice des prix à la consommation <strong>harmonisé</strong> (IPCH), calculé pareil dans" +
      " toute l'Union pour permettre la comparaison. Ce n'est pas l'indice national de l'INSEE," +
      " dont les pondérations diffèrent : les deux chiffres coexistent sans se contredire.",
  },
  {
    cle: "croissance",
    indicateur: CROISSANCE,
    titre: "La croissance, trimestre par trimestre",
    phrase: (periode, fr, ea) =>
      `Au ${periodeLisible(periode)}, le produit intérieur brut français a ${
        fr >= 0 ? "progressé" : "reculé"
      } de <strong>${sansSigne(fr)}</strong> par rapport au même trimestre de l'année précédente` +
      (ea === undefined ? "." : ` (zone euro : ${taux(ea)}).`),
    note:
      "PIB en volume — hors effet des prix — comparé au <strong>même trimestre de l'année" +
      " précédente</strong>, corrigé des saisons. Les « +0,3 % » des titres de presse comparent" +
      " un trimestre au précédent : c'est un autre chiffre, les deux sont justes.",
  },
];

/** Rendu pur d'un volet (phrase, graphique, légende, fenêtres). */
export function renduVolet(
  volet: Volet,
  pays: Record<string, Territoire>,
  fenetre: number | null,
  largeur = 720,
): string {
  const france = dernierPoint(pays["FR"]?.series?.[volet.indicateur]);
  if (!france) return "";
  const [periode, valeurFr] = france;
  const zoneEuro = pays["EA20"]?.series?.[volet.indicateur]?.[periode];
  const series = extraireSeries(pays, volet.indicateur, fenetre);
  const { svg } = dessiner(series, { largeur, formater: taux, titre: volet.titre });
  if (!svg) return "";

  const legende = PAYS.filter((p) => pays[p.code]?.series?.[volet.indicateur])
    .map(
      (p) => `<span class="graphique__legende-item${p.pointille ? " graphique__legende-item--pointille" : ""}">
        <span class="graphique__puce" style="--serie:${p.couleur}"></span>${echapper(p.nom)}</span>`,
    )
    .join("");

  const boutons = FENETRES.map(
    (f) => `<button type="button" class="graphique__fenetre${
      (f.annees ?? null) === fenetre ? " graphique__fenetre--active" : ""
    }" data-fenetre="${f.cle}">${f.libelle}</button>`,
  ).join("");

  return `
    <h4 class="graphique__titre">${echapper(volet.titre)}</h4>
    <p class="bloc__complement">${volet.phrase(periode, valeurFr, zoneEuro)}</p>
    <div class="graphique" data-volet="${volet.cle}">
      <div class="graphique__commandes" role="group" aria-label="Fenêtre temporelle">${boutons}</div>
      <div class="graphique__cadre">${svg}<div class="graphique__infobulle" hidden></div></div>
      <p class="graphique__legende">${legende}</p>
    </div>
    <p class="avertissement">${volet.note} Source : Eurostat, dernière valeur publiée —
      jamais de prévision ici.</p>`;
}

/** Rendu pur du bloc entier ; chaîne vide si la conjoncture n'est pas publiée. */
export function rendu(
  pays: Record<string, Territoire>,
  catalogue: Indicateur[],
  fenetre: number | null = 5,
  largeur = 720,
): string {
  const publies = new Set(catalogue.map((i) => i.id));
  const volets = VOLETS.filter((v) => publies.has(v.indicateur))
    .map((v) => renduVolet(v, pays, fenetre, largeur))
    .filter(Boolean);
  if (!volets.length) return "";
  return `<h3>Où en est l'économie ?</h3>${volets.join("")}`;
}

/* ------------------------------------------------------------------ *
 * Interactivité : fenêtre temporelle, infobulle, redimensionnement.  *
 * ------------------------------------------------------------------ */

type EtatVolet = { fenetre: number | null; geometrie: Geometrie | null; series: Serie[] };

function attacherVolet(
  conteneur: HTMLElement,
  volet: Volet,
  pays: Record<string, Territoire>,
): void {
  const etat: EtatVolet = { fenetre: 5, geometrie: null, series: [] };
  const cadre = conteneur.querySelector<HTMLElement>(".graphique__cadre");
  const bulle = conteneur.querySelector<HTMLElement>(".graphique__infobulle");
  if (!cadre || !bulle) return;

  const redessiner = () => {
    const largeur = Math.max(320, Math.round(cadre.clientWidth || 720));
    etat.series = extraireSeries(pays, volet.indicateur, etat.fenetre);
    const { svg, geometrie } = dessiner(etat.series, {
      largeur,
      formater: taux,
      titre: volet.titre,
    });
    etat.geometrie = geometrie;
    const ancienne = cadre.querySelector("svg");
    if (ancienne) ancienne.outerHTML = svg;
    bulle.hidden = true;
  };

  conteneur.querySelectorAll<HTMLButtonElement>(".graphique__fenetre").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const choix = FENETRES.find((f) => f.cle === bouton.dataset.fenetre);
      etat.fenetre = choix ? choix.annees : 5;
      conteneur
        .querySelectorAll(".graphique__fenetre")
        .forEach((b) => b.classList.toggle("graphique__fenetre--active", b === bouton));
      redessiner();
    });
  });

  const surPointeur = (evenement: PointerEvent) => {
    const g = etat.geometrie;
    const dessin = cadre.querySelector("svg");
    if (!g || !dessin || !g.periodes.length) return;
    const zone = dessin.getBoundingClientRect();
    const xAbs = ((evenement.clientX - zone.left) / zone.width) * g.largeur;
    const indice = periodeAuPoint(g, xAbs);
    const periode = g.periodes[indice];
    const lignes = etat.series
      .map((s) => {
        const point = s.points.find(([p]) => p === periode);
        if (!point) return "";
        return `<span class="graphique__puce" style="--serie:${s.couleur}"></span>${echapper(
          s.nom,
        )}&nbsp;: ${echapper(taux(point[1]))}<br>`;
      })
      .filter(Boolean)
      .join("");
    if (!lignes) {
      bulle.hidden = true;
      return;
    }
    bulle.innerHTML = `<strong>${echapper(periodeLisible(periode))}</strong><br>${lignes}`;
    bulle.hidden = false;
    const relative = ((evenement.clientX - zone.left) / zone.width) * 100;
    bulle.style.left = `${Math.min(78, Math.max(2, relative))}%`;
  };
  cadre.addEventListener("pointermove", surPointeur);
  cadre.addEventListener("pointerdown", surPointeur);
  cadre.addEventListener("pointerleave", () => {
    bulle.hidden = true;
  });

  if (typeof ResizeObserver !== "undefined") {
    let derniere = 0;
    const observateur = new ResizeObserver(() => {
      const largeur = Math.round(cadre.clientWidth);
      // seuil de 24 px : redessiner à chaque pixel ferait clignoter l'infobulle
      if (Math.abs(largeur - derniere) > 24) {
        derniere = largeur;
        redessiner();
      }
    });
    observateur.observe(cadre);
  }
  redessiner();
}

export function afficherConjoncture(
  bloc: HTMLElement,
  pays: Record<string, Territoire>,
  catalogue: Indicateur[],
): boolean {
  const html = rendu(pays, catalogue);
  if (!html) return false;
  bloc.innerHTML = html;
  for (const volet of VOLETS) {
    const conteneur = bloc.querySelector<HTMLElement>(`[data-volet="${volet.cle}"]`);
    if (conteneur) attacherVolet(conteneur, volet, pays);
  }
  return true;
}
