/**
 * Carte des finances locales. L'état de l'écran vit dans l'URL : tout ce qui
 * est affiché est partageable tel quel (docs/04).
 */

import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

import * as donnees from "./donnees.ts";
import type { Indicateur, Jeu, Territoire } from "./donnees.ts";
import { afficherFiche, positionDansGroupe } from "./fiche.ts";
import { afficherBudgetEtat, exercicesDisponibles } from "./etat.ts";
import { afficherCentEuros } from "./cent-euros.ts";
import { afficherQuestions } from "./questions.ts";
import { rendu as apercuRendu, resumer } from "./apercu.ts";
import { afficherComparateur, type Entree, MAXIMUM } from "./comparateur.ts";
import { enCsv, nomDeFichier, telecharger, type LigneExport } from "./export.ts";
import { afficherNational } from "./national.ts";
import { afficherFonctions } from "./fonctions.ts";
import { afficherConjoncture } from "./conjoncture.ts";
import { afficherSecu } from "./secu.ts";
import {
  expressionCouleur,
  formater,
  noteEchelle,
  parHabitantAUnSens,
  populationDeReference,
  quantiles,
} from "./echelle.ts";
import { niveauPourZoom } from "./mailles.ts";
import "./style.css";

/** Les cinq départements d'outre-mer sont dans les données et dans les tuiles,
 *  mais la carte s'ouvrait sur un cadrage figé de la métropole : 129 communes
 *  françaises étaient introuvables autrement qu'en faisant glisser la carte à
 *  travers l'Atlantique. Une carte de la France qui n'a pas de Guadeloupe n'est
 *  pas une carte de la France.
 *
 *  Bornes géographiques, pas centres : elles cadrent le territoire quelle que
 *  soit la taille du conteneur. */
const VUES: Record<string, { nom: string; bornes: [[number, number], [number, number]] }> = {
  metropole: { nom: "France métropolitaine", bornes: [[-5.3, 41.3], [9.7, 51.2]] },
  guadeloupe: { nom: "Guadeloupe", bornes: [[-61.85, 15.8], [-60.95, 16.55]] },
  martinique: { nom: "Martinique", bornes: [[-61.25, 14.35], [-60.75, 14.9]] },
  guyane: { nom: "Guyane", bornes: [[-54.7, 2.0], [-51.5, 5.85]] },
  reunion: { nom: "La Réunion", bornes: [[55.2, -21.42], [55.9, -20.85]] },
  mayotte: { nom: "Mayotte", bornes: [[44.95, -13.05], [45.35, -12.6]] },
};

/** Le préfixe de code dit dans quelle vue se trouve un territoire. */
const VUE_PAR_PREFIXE: Record<string, string> = {
  "971": "guadeloupe",
  "972": "martinique",
  "973": "guyane",
  "974": "reunion",
  "976": "mayotte",
};

export function vueDuCode(code: string): string {
  return VUE_PAR_PREFIXE[code.slice(0, 3)] ?? "metropole";
}

/** Zoom à partir duquel le liseré d'une maille devient lisible, et sa largeur.
 *  Plus la maille est fine, plus le trait doit attendre : à l'échelle du pays,
 *  un contour par commune efface la donnée qu'il est censé délimiter. */
const LISERE: Record<string, number[]> = {
  regions: [3, 0.3, 5, 0.6, 9, 1.2],
  departements: [4.5, 0, 6, 0.4, 10, 1],
  epcis: [5, 0, 7, 0.35, 10.5, 0.9],
  communes: [7, 0, 8.5, 0.3, 12, 0.8],
};

/** Expression MapLibre, sortie du littéral de calque : son type d'union ne
 *  survit pas à l'inférence, comme pour `expressionCouleur`. */
function largeurLisere(couche: string): unknown {
  return ["interpolate", ["linear"], ["zoom"], ...LISERE[couche]];
}

const COUCHES: Record<string, string> = {
  commune: "communes",
  epci: "epcis",
  departement: "departements",
  region: "regions",
};

type Etat = {
  theme: string;
  indicateur: string;
  /** Maille effectivement affichée. */
  niveau: string;
  /** La maille suit toujours le zoom (NIVEAU_PAR_ZOOM) : ce n'est plus un
   *  réglage. Un sélecteur de plus pour une règle que la carte applique
   *  d'elle-même n'était que du bruit. */
  niveauAuto: boolean;
  periode: string;
  declinaison: string;
  selection: string | null;
  comparaison: string[];
  vue: string;
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let carte: maplibregl.Map;
let catalogue: Indicateur[] = [];
let jeux: Jeu[] = [];
let etat: Etat;
let populations: Record<string, number> = {};
let entites: Record<string, Territoire> = {};
let groupes: donnees.Comparaisons | null = null;
let reperes: import("./reference.ts").References | null = null;
/** Départements, régions et pays chargés à part : ils servent de points de
 *  comparaison à n'importe quelle commune, y compris là où aucune médiane
 *  n'est publiable (délinquance sous secret de diffusion). Table séparée
 *  d'`entites` : mêler deux mailles fausserait noms et classements. */
let parents: Record<string, Territoire> = {};
/** Valeurs actuellement peintes, déjà ramenées par habitant si demandé : le
 *  survol et le palmarès lisent la même table que la couleur — jamais un
 *  recalcul parallèle qui pourrait diverger de la carte. */
let affichees: Record<string, number> = {};
/** Montants bruts de la couche : l'infobulle montre les deux lectures. */
let brutes: Record<string, number> = {};
let parHabitantAffiche = false;
let survole: string | null = null;
/** Ce que le bouton d'export téléchargera : toutes les lignes de la couche
 *  affichée, pas les 100 que montre le tableau, avec la déclinaison qui a
 *  servi à les calculer. */
let exportCourant: { lignes: LigneExport[]; parHabitant: boolean } = {
  lignes: [],
  parHabitant: false,
};

function lireUrl(): Etat {
  const p = new URLSearchParams(location.search);
  return {
    theme: p.get("theme") ?? "finances_locales",
    indicateur: p.get("indicateur") ?? "ofgl_depenses_fonctionnement",
    niveau: p.get("niveau") ?? "region",
    niveauAuto: true,
    // L'année n'est plus un choix : c'est toujours la plus récente publiée
    // pour l'indicateur et la maille regardés. L'affichage non plus — le
    // panneau montre désormais les deux lectures (par habitant ET total)
    // pour chaque mesure, le sélecteur ne servait plus qu'à choisir laquelle
    // colorait la carte, et « par habitant » est la seule comparable.
    periode: "",
    declinaison: "habitant",
    selection: p.get("territoire"),
    comparaison: (p.get("comparer") ?? "").split(",").filter(Boolean).slice(0, MAXIMUM),
    vue: p.get("vue") ?? "metropole",
  };
}

function ecrireUrl(): void {
  const p = new URLSearchParams({
    theme: etat.theme,
    indicateur: etat.indicateur,
    niveau: etat.niveau,
    periode: etat.periode,
  });
  if (etat.vue !== "metropole") p.set("vue", etat.vue);
  if (etat.selection) p.set("territoire", etat.selection);
  if (etat.comparaison.length) p.set("comparer", etat.comparaison.join(","));
  history.replaceState(null, "", `?${p}`);
}

async function chargerTerritoires(niveau: string, lot: string): Promise<void> {
  const paquet = await donnees.territoires(niveau, lot);
  entites = { ...entites, ...paquet };
  recalculerPopulations();
}

/** Les dénominateurs suivent l'exercice affiché : une dépense de 2022 se
 *  rapporte aux habitants de 2022, pas à ceux d'aujourd'hui. Recalculé à chaque
 *  chargement et à chaque changement de période, pour que la carte, le tableau
 *  et la fiche divisent tous par le même nombre. */
function recalculerPopulations(): void {
  populations = {};
  for (const [code, entite] of Object.entries(entites)) {
    const valeur = populationDeReference(entite, etat.periode).valeur;
    if (valeur) populations[code] = valeur;
  }
}

/** Les fiches communales sont réparties par département : on charge à la demande. */
async function chargerLotsNecessaires(niveau: string, codes: string[]): Promise<void> {
  if (niveau !== "commune") {
    await chargerTerritoires(niveau, "tous");
    return;
  }
  const lots = new Set(codes.map((code) => (code.startsWith("97") ? code.slice(0, 3) : code.slice(0, 2))));
  await Promise.all([...lots].map((lot) => chargerTerritoires("commune", lot).catch(() => {})));
}

function indicateurCourant(): Indicateur {
  return catalogue.find((i) => i.id === etat.indicateur) ?? catalogue[0];
}

/** Légende en rampe : une ligne de couleurs, les deux bornes, le reste en
 *  infobulle et dans un repli. La version en liste (sept lignes de fourchettes
 *  plus une note) mangeait un quart de la carte — trop pour une échelle. */
function majLegende(echelle: ReturnType<typeof quantiles>, parHabitant: boolean): void {
  const indicateur = indicateurCourant();
  $("legende").hidden = false;
  $("legende-titre").textContent = indicateur.libelle;
  const bornes = [...echelle.bornes];
  const lisible = (v: number) => formater(v, indicateur.unite, parHabitant);
  $("legende-echelle").innerHTML = echelle.couleurs
    .map((couleur, i) => {
      const bas = i === 0 ? null : bornes[i - 1];
      const haut = i < bornes.length ? bornes[i] : null;
      const texte =
        bas === null
          ? `moins de ${lisible(haut as number)}`
          : haut === null
            ? `${lisible(bas)} et plus`
            : `${lisible(bas)} – ${lisible(haut)}`;
      return `<li class="pastille" style="background:${couleur}" title="${texte}"></li>`;
    })
    .join("");
  $("legende-bornes").innerHTML = `<span>${
    bornes.length ? `&lt; ${lisible(bornes[0])}` : ""
  }</span><span>${etat.periode}${parHabitant ? " · par hab." : ""}</span><span>${
    bornes.length ? `&gt; ${lisible(bornes[bornes.length - 1])}` : ""
  }</span>`;
  $("legende-note").textContent = noteEchelle(indicateur.unite, parHabitant);
  // La pastille repliée : les mêmes couleurs, en dégradé, sur deux centimètres.
  // Elle suffit à lire la carte — foncé, beaucoup ; clair, peu — sans rien
  // recouvrir. Le détail attend le clic.
  $("legende-vignette").style.background = `linear-gradient(to bottom, ${echelle.couleurs.join(
    ", ",
  )})`;
  $("legende").title = `Légende — ${indicateur.libelle}`;
}

function majTableau(valeurs: Record<string, number>, parHabitant: boolean): void {
  const indicateur = indicateurCourant();
  const toutes = Object.entries(valeurs)
    .map(([code, brut]) => {
      const population = populations[code];
      const valeur = parHabitant && population ? brut / population : brut;
      return { code, nom: entites[code]?.nom ?? code, valeur, calculable: !parHabitant || !!population };
    })
    .filter((l) => l.calculable)
    .sort((a, b) => b.valeur - a.valeur);

  // Le tableau montre les 100 premiers ; l'export, lui, emporte tout — un
  // classement tronqué se lit, un fichier tronqué se réutilise de travers.
  exportCourant = {
    lignes: toutes.map(({ code, nom, valeur }) => ({ code, nom, valeur })),
    parHabitant,
  };
  const exporter = $<HTMLButtonElement>("exporter");
  exporter.hidden = toutes.length === 0;
  exporter.textContent = `Télécharger en CSV — ${toutes.length.toLocaleString("fr-FR")} territoire${
    toutes.length > 1 ? "s" : ""
  }`;

  const lignes = toutes.slice(0, 100);
  $("tableau-donnees").innerHTML = `
    <caption>${indicateur.libelle} — ${etat.periode}${parHabitant ? ", par habitant" : ""} · 100 premiers territoires</caption>
    <thead><tr><th scope="col">Territoire</th><th scope="col">Code</th><th scope="col">Valeur</th></tr></thead>
    <tbody>${lignes
      .map(
        (l) =>
          `<tr><td>${l.nom}</td><td>${l.code}</td><td>${formater(
            l.valeur,
            indicateur.unite,
            parHabitant,
          )}</td></tr>`,
      )
      .join("")}</tbody>`;
}

async function peindre(): Promise<void> {
  const parHabitant = etat.declinaison === "habitant" && parHabitantAUnSens(indicateurCourant());
  const valeurs = await donnees.valeursCarte(etat.indicateur, etat.niveau, etat.periode);
  await chargerLotsNecessaires(etat.niveau, Object.keys(valeurs));
  recalculerPopulations(); // la période a pu changer depuis le dernier chargement

  const echantillon = Object.entries(valeurs)
    .map(([code, brut]) => (parHabitant ? brut / (populations[code] ?? NaN) : brut))
    .filter(Number.isFinite);
  const echelle = quantiles(echantillon);

  for (const [niveau, couche] of Object.entries(COUCHES)) {
    const visible = niveau === etat.niveau;
    carte.setLayoutProperty(`remplissage-${couche}`, "visibility", visible ? "visible" : "none");
    carte.setLayoutProperty(`contour-${couche}`, "visibility", visible ? "visible" : "none");
  }
  carte.setPaintProperty(
    `remplissage-${COUCHES[etat.niveau]}`,
    "fill-color",
    expressionCouleur(valeurs, echelle, parHabitant, populations) as never,
  );

  majLegende(echelle, parHabitant);
  majTableau(valeurs, parHabitant);
  planifierEtiquettes();

  affichees = Object.fromEntries(
    Object.entries(valeurs)
      .map(([code, brut]) => [code, parHabitant ? brut / (populations[code] ?? NaN) : brut])
      .filter(([, v]) => Number.isFinite(v as number)),
  ) as Record<string, number>;
  parHabitantAffiche = parHabitant;
  brutes = valeurs;

  if (etat.selection) {
    await montrerFiche(etat.selection);
  } else {
    afficherApercu();
  }
}

/** Un dénominateur n'est pas un indicateur. La population de référence OFGL
 *  sert à calculer les montants par habitant — elle est expliquée dans
 *  « Sources et méthode », et affichée en série elle ne produisait qu'une
 *  ligne de plus, sous la population municipale, avec une comparaison au
 *  département qui ne disait que la différence de taille. */
const DENOMINATEURS = new Set(["ofgl_population_reference"]);

function indicateursDeLaFiche(niveau: string): Indicateur[] {
  return catalogue.filter((i) => i.niveaux?.includes(niveau) && !DENOMINATEURS.has(i.id));
}

/** L'indicateur qui ouvre la fiche nationale : la dette publique en % du PIB
 *  d'abord, parce que c'est la question qu'on pose en premier. Le premier de
 *  la liste effectivement publié l'emporte. */
const PHARE_NATIONAL = [
  "insee_dette_apu_part_pib",
  "etat_solde_budgetaire",
  "etat_depenses_nettes_bg",
  "eurostat_chomage",
];

/**
 * Tant que rien n'est sélectionné, le panneau montre **la France**.
 *
 * Il montrait jusqu'ici la dispersion de la couche affichée — médiane, quartiles
 * — c'est-à-dire une statistique sur des territoires plutôt qu'un territoire.
 * À l'ouverture du site, la bonne réponse à « où va l'argent public ? » est le
 * niveau national : dette, solde budgétaire, dépenses de l'État, comparaisons
 * européennes. On descend ensuite dans le détail en cliquant.
 *
 * Les mailles supérieures se chargent après la carte : tant qu'elles ne sont
 * pas là, l'aperçu de couche tient la place plutôt qu'un panneau vide.
 */
function afficherApercu(): void {
  const france = parents["FR"];
  const nationaux = indicateursDeLaFiche("pays");
  if (france && nationaux.length) {
    afficherFiche($("fiche"), {
      code: "FR",
      niveau: "pays",
      territoire: france,
      principal: PHARE_NATIONAL.find((id) => france.series[id]) ?? nationaux[0]?.id,
      // Aucune de ces séries n'est peinte sur la carte : la marquer « sur la
      // carte » dirait au lecteur d'y chercher quelque chose qui n'y est pas.
      marquerCarte: false,
      indicateurs: nationaux,
      libelleTheme,
      comparateurs: [],
      jeux,
      periode: etat.periode,
      parHabitant: etat.declinaison === "habitant",
      references: reperes,
    });
    return;
  }
  const noms = Object.fromEntries(
    Object.entries(entites).map(([code, entite]) => [code, entite.nom]),
  );
  const indicateur = indicateurCourant();
  // Le total France : seulement pour un indicateur qui s'additionne, et
  // calculé sur les montants bruts — additionner des « par habitant » de
  // 34 875 communes ne voudrait rien dire.
  const total = indicateur.sommable
    ? Object.values(brutes).reduce((somme, v) => (Number.isFinite(v) ? somme + v : somme), 0)
    : undefined;
  $("fiche").innerHTML = apercuRendu(
    resumer(affichees, noms),
    indicateur,
    etat.niveau,
    etat.periode,
    parHabitantAffiche,
    total,
  );
}

/* ------------------------------------------------------------------ *
 * Étiquettes des territoires : nos noms, en français, sans survol.     *
 * ------------------------------------------------------------------ */

/** Le fond de carte tiers n'écrit ses noms qu'à partir du zoom 8 — et en
 *  anglais en dessous, d'où le bridage. Résultat : la France entière était
 *  muette, on devait survoler chaque forme pour savoir ce qu'on regardait.
 *  Ces étiquettes-ci viennent de NOS tuiles : noms français du référentiel,
 *  posés au centre de chaque territoire visible.
 *
 *  Elles sont en HTML plutôt qu'en couche `symbol` : une couche de symboles
 *  exigerait un serveur de glyphes externe, quand le DOM nous donne la même
 *  typographie que le reste du site et se limite au nombre qu'on veut. */
const ETIQUETTES_MAXIMUM = 70;

let minuteurEtiquettes: number | undefined;
let essaisEtiquettes = 0;

/** `queryRenderedFeatures` ne voit que ce qui est **dessiné** : appelée dès
 *  la source chargée, elle renvoie zéro. On diffère donc la pose, et on
 *  réessaie tant que rien n'est trouvé — trois fois, pas plus : une carte
 *  vraiment vide (aucune tuile sur l'écran) ne doit pas boucler. */
function planifierEtiquettes(reinitialiser = true): void {
  if (reinitialiser) essaisEtiquettes = 0;
  window.clearTimeout(minuteurEtiquettes);
  minuteurEtiquettes = window.setTimeout(majEtiquettes, 260);
}

function majEtiquettes(): void {
  const couche = COUCHES[etat.niveau];
  const calque = $("etiquettes");
  if (!carte) return;
  // Les communes sont 34 875 : à leur échelle, le fond de carte écrit déjà
  // les noms de villes. On n'ajoute les nôtres que sur les mailles lisibles.
  const trop = etat.niveau === "commune" && carte.getZoom() < 9.5;
  if (trop) {
    calque.innerHTML = "";
    return;
  }
  let figures: maplibregl.MapGeoJSONFeature[] = [];
  try {
    figures = carte.queryRenderedFeatures({ layers: [`remplissage-${couche}`] });
  } catch {
    return; // couche pas encore prête
  }
  if (!figures.length && essaisEtiquettes < 3) {
    essaisEtiquettes += 1;
    planifierEtiquettes(false);
    return;
  }
  // Un territoire est découpé entre plusieurs tuiles : on réunit ses morceaux
  // pour placer une seule étiquette, au centre de son étendue visible.
  const etendues = new Map<string, { nom: string; xMin: number; xMax: number; yMin: number; yMax: number }>();
  for (const figure of figures) {
    const code = figure.properties?.code as string | undefined;
    if (!code) continue;
    // Les tuiles portent le code là où l'on attendait le libellé (« 28 » pour
    // la Normandie) : le nom vient du référentiel déjà chargé.
    const nom = entites[code]?.nom ?? (figure.properties?.nom as string | undefined);
    if (!nom || nom === code) continue;
    const anneaux =
      figure.geometry.type === "Polygon"
        ? figure.geometry.coordinates
        : figure.geometry.type === "MultiPolygon"
          ? figure.geometry.coordinates.flat()
          : [];
    for (const anneau of anneaux) {
      for (const [lng, lat] of anneau as [number, number][]) {
        const point = carte.project([lng, lat]);
        const actuel = etendues.get(code);
        if (!actuel) {
          etendues.set(code, { nom, xMin: point.x, xMax: point.x, yMin: point.y, yMax: point.y });
        } else {
          actuel.xMin = Math.min(actuel.xMin, point.x);
          actuel.xMax = Math.max(actuel.xMax, point.x);
          actuel.yMin = Math.min(actuel.yMin, point.y);
          actuel.yMax = Math.max(actuel.yMax, point.y);
        }
      }
    }
  }
  const cadre = $("carte").getBoundingClientRect();
  const marges = paddingCarte();
  // Les plus grands d'abord : quand deux noms se disputent la place, c'est
  // le territoire le plus visible qui garde le sien.
  const candidats = [...etendues.values()]
    .map((e) => ({
      nom: e.nom,
      x: (e.xMin + e.xMax) / 2,
      y: (e.yMin + e.yMax) / 2,
      taille: (e.xMax - e.xMin) * (e.yMax - e.yMin),
      largeur: e.xMax - e.xMin,
    }))
    .filter(
      (c) =>
        c.x > marges.left && c.x < cadre.width - marges.right &&
        c.y > marges.top && c.y < cadre.height - marges.bottom &&
        // un territoire réduit à quelques pixels ne porte pas son nom
        c.largeur > 34,
    )
    .sort((a, b) => b.taille - a.taille)
    .slice(0, ETIQUETTES_MAXIMUM);

  const poses: { x: number; y: number; demiLargeur: number }[] = [];
  const html: string[] = [];
  for (const c of candidats) {
    const demiLargeur = Math.min(c.nom.length * 3.4 + 6, 70);
    const chevauche = poses.some(
      (p) => Math.abs(p.x - c.x) < p.demiLargeur + demiLargeur && Math.abs(p.y - c.y) < 15,
    );
    if (chevauche) continue;
    poses.push({ x: c.x, y: c.y, demiLargeur });
    html.push(
      `<span class="etiquette" style="left:${c.x.toFixed(0)}px;top:${c.y.toFixed(0)}px">${
        c.nom.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch] as string)
      }</span>`,
    );
  }
  calque.innerHTML = html.join("");
}

/** Marges de cadrage : les surcouches (commandes à gauche, panneau à droite)
 *  recouvrent la carte — un cadrage qui les ignore cacherait la Bretagne
 *  derrière un formulaire. */
function paddingCarte(): { top: number; bottom: number; left: number; right: number } {
  const large = window.innerWidth > 960;
  if (large) {
    return { top: 40, bottom: 96, left: 24, right: Math.min(430, window.innerWidth * 0.32) };
  }
  // Téléphone : le tiroir couvre le bas de la carte. Cadrer sur le conteneur
  // entier, comme si tout était visible, plaçait la France sous le tiroir —
  // à l'écran il ne restait que le Grand Est et la Bourgogne. Le bas du
  // cadrage suit donc la position réelle du tiroir, plafonnée : quand il est
  // grand ouvert, on ne dézoome pas la carte jusqu'à l'absurde.
  const zone = $("carte").getBoundingClientRect();
  // Le cadrage initial est demandé à la construction de la carte, avant que la
  // mise en page soit posée : la hauteur mesurée valait alors zéro, le creux du
  // bas aussi, et la carte s'ouvrait sur le Sahara — la France hors champ,
  // au-dessus. Sur une zone qui n'a pas encore de taille, on s'en tient à des
  // valeurs fixes ; le vrai cadrage suit au chargement.
  if (zone.height < 200) return { top: 96, bottom: 96, left: 16, right: 16 };
  const tiroir = $("panneau").getBoundingClientRect();
  const couvert = Math.round(zone.bottom - tiroir.top) + 12;
  const bas = Math.min(Math.round(zone.height * 0.42), Math.max(96, couvert));
  return { top: 132, bottom: bas, left: 16, right: 16 };
}

/** Recadre la carte sur une vue déclarée. */
function cadrer(vue: string): void {
  const bornes = VUES[vue]?.bornes;
  if (bornes && carte) carte.fitBounds(bornes, { padding: paddingCarte(), duration: 800 });
}

/** Amène la carte là où se trouve le territoire choisi.
 *
 *  Sans cela, chercher « Fort-de-France » ouvrait sa fiche et laissait la carte
 *  sur la métropole : on lisait les chiffres d'un territoire qu'on ne voyait
 *  pas. Le recadrage n'a lieu que si la vue change — sinon il ferait sursauter
 *  la carte à chaque clic. */
function suivreLaSelection(code: string): void {
  const vue = vueDuCode(code);
  if (vue === etat.vue) return;
  etat.vue = vue;
  construireBarreCarte();
  cadrer(vue);
}

async function montrerFiche(code: string): Promise<void> {
  suivreLaSelection(code);
  await chargerLotsNecessaires(etat.niveau, [code]);
  const territoire = entites[code];
  if (!territoire) return;
  etat.selection = code;
  ecrireUrl();
  const quartiles =
    etat.niveau === "commune" && groupes
      ? groupes.groupes[etat.indicateur]?.[etat.periode]?.[
          groupes.criteres
            .map((c) => (territoire.drapeaux as Record<string, string>)?.[c] ?? "")
            .join("|")
        ]
      : undefined;
  const brut = territoire.series[etat.indicateur]?.[etat.periode];
  const parHabitant =
    brut !== undefined && territoire.population ? brut / territoire.population : undefined;

  // Rang du territoire dans la couche affichée : « 8 512ᵉ sur 34 772 » situe
  // un chiffre que sa seule valeur ne situe pas. Calculé sur les valeurs déjà
  // peintes — même tri, même dénominateur que la carte.
  const classement = Object.entries(affichees).sort(([, a], [, b]) => b - a);
  const position = classement.findIndex(([c]) => c === code);
  const rang =
    position >= 0 ? { position: position + 1, total: classement.length } : undefined;

  afficherFiche($("fiche"), {
    code,
    niveau: etat.niveau,
    territoire,
    principal: etat.indicateur,
    rang,
    comparaison: groupes
      ? positionDansGroupe(territoire, quartiles, parHabitant, groupes.criteres)
      : "",
    // Tous les thèmes, plus seulement celui de la carte : le panneau est
    // désormais le seul endroit où l'on choisit — il doit tout montrer.
    // Filtré sur le niveau : afficher « donnée non disponible » pour un
    // indicateur qui n'existe pas à ce niveau ferait passer une absence de
    // définition pour une absence de mesure.
    indicateurs: indicateursDeLaFiche(etat.niveau),
    libelleTheme,
    // De quoi comparer, même pour les jeux sous secret de diffusion où
    // aucune médiane communale n'est publiable : la valeur du département,
    // celle de la région, celle de la France. Ce sont des chiffres publiés,
    // pas des estimations.
    comparateurs:
      etat.niveau === "commune" || etat.niveau === "epci"
        ? [
            territoire.parent && parents[territoire.parent]
              ? { libelle: "son département", territoire: parents[territoire.parent] }
              : null,
            territoire.region && parents[territoire.region]
              ? { libelle: "sa région", territoire: parents[territoire.region] }
              : null,
            parents["FR"] ? { libelle: "la France", territoire: parents["FR"] } : null,
          ].filter(Boolean as unknown as (x: unknown) => boolean) as {
            libelle: string;
            territoire: Territoire;
          }[]
        : etat.niveau === "departement"
          ? [
              territoire.region && parents[territoire.region]
                ? { libelle: "sa région", territoire: parents[territoire.region] }
                : null,
              parents["FR"] ? { libelle: "la France", territoire: parents["FR"] } : null,
            ].filter(Boolean as unknown as (x: unknown) => boolean) as {
              libelle: string;
              territoire: Territoire;
            }[]
          : parents["FR"]
            ? [{ libelle: "la France", territoire: parents["FR"] }]
            : [],
    jeux,
    periode: etat.periode,
    parHabitant: etat.declinaison === "habitant",
    references: reperes,
  });
  $("panneau").classList.add("panneau--selection");
}

/**
 * Le tiroir mobile se saisit et s'agrandit, jusqu'au plein écran.
 *
 * Il était figé à 38 % de l'écran — 62 % une fois un territoire choisi — et
 * la fiche se lisait par une meurtrière, sous une carte qu'on ne regardait
 * plus. On peut désormais le tirer vers le haut jusqu'à couvrir la carte, et
 * le redescendre. Trois arrêts, parce qu'un tiroir libre se pose toujours de
 * travers : un aperçu, une moitié, le plein écran.
 *
 * Un simple appui bascule entre l'état courant et le plein écran — sur un
 * téléphone, tout ne se fait pas au glissement.
 */
function tiroirRedimensionnable(): void {
  const panneau = $("panneau");
  const poignee = $("panneau-poignee");
  const arrets = () => {
    const h = window.innerHeight;
    return [Math.round(h * 0.38), Math.round(h * 0.62), Math.round(h - 48)];
  };
  const poser = (hauteur: number) => panneau.style.setProperty("--tiroir", `${hauteur}px`);

  let depart = 0;
  let hauteurDepart = 0;
  let deplace = false;

  poignee.addEventListener("pointerdown", (evenement) => {
    const e = evenement as PointerEvent;
    if (window.innerWidth > 960) return;
    depart = e.clientY;
    hauteurDepart = panneau.getBoundingClientRect().height;
    deplace = false;
    panneau.classList.add("panneau--glisse");
    poignee.setPointerCapture(e.pointerId);
  });

  poignee.addEventListener("pointermove", (evenement) => {
    const e = evenement as PointerEvent;
    if (!poignee.hasPointerCapture(e.pointerId)) return;
    const delta = depart - e.clientY;
    if (Math.abs(delta) > 4) deplace = true;
    const bornes = arrets();
    poser(Math.max(120, Math.min(bornes[bornes.length - 1], hauteurDepart + delta)));
  });

  const relacher = (evenement: Event) => {
    const e = evenement as PointerEvent;
    if (!poignee.hasPointerCapture(e.pointerId)) return;
    poignee.releasePointerCapture(e.pointerId);
    panneau.classList.remove("panneau--glisse");
    const bornes = arrets();
    const haut = panneau.getBoundingClientRect().height;
    // Appui sans glissement : on bascule entre plein écran et aperçu, plutôt
    // que de ne rien faire — c'est le geste qu'on tente d'abord.
    if (!deplace) {
      poser(haut > bornes[1] ? bornes[0] : bornes[2]);
      return;
    }
    poser(bornes.reduce((a, b) => (Math.abs(b - haut) < Math.abs(a - haut) ? b : a)));
  };
  poignee.addEventListener("pointerup", relacher);
  poignee.addEventListener("pointercancel", relacher);

  // Rotation ou changement de taille : les arrêts changent, la hauteur figée
  // en pixels ne veut plus rien dire.
  window.addEventListener("resize", () => panneau.style.removeProperty("--tiroir"));
}

/** Ferme la sélection : le panneau revient à l'aperçu de la couche. */
function fermerPanneau(): void {
  etat.selection = null;
  ecrireUrl();
  $("panneau").classList.remove("panneau--selection");
  afficherApercu();
}

async function majComparateur(): Promise<void> {
  const section = $("comparateur");
  if (!etat.comparaison.length) {
    section.hidden = true;
    return;
  }
  await chargerLotsNecessaires(etat.niveau, etat.comparaison);
  const entrees: Entree[] = etat.comparaison
    .filter((code) => entites[code])
    .map((code) => ({ code, niveau: etat.niveau, territoire: entites[code] }));
  afficherComparateur(
    section,
    entrees,
    catalogue.filter((i) => i.theme === etat.theme && i.niveaux?.includes(etat.niveau)),
    etat.periode,
    etat.declinaison === "habitant",
  );
  section.hidden = false;
}

// Libellés des thèmes connus. Un thème absent de cette table n'est pas écarté :
// il est affiché sous une forme lisible. Filtrer sur une liste écrite en dur
// avait déjà fait disparaître des données parfaitement publiées.
const THEMES: Record<string, string> = {
  finances_locales: "Finances locales",
  revenus: "Revenus et pauvreté",
  population: "Population",
  emploi: "Emploi et chômage",
  entreprises: "Entreprises",
  fonctions: "Dépenses par fonction",
  securite_sociale: "Sécurité sociale",
  securite: "Sécurité",
  sante: "Santé",
  education: "Éducation",
  impots_locaux: "Impôts locaux",
  macro: "Conjoncture",
  dette: "Dette publique",
  budget_etat: "Budget de l'État",
  europe: "Comparaisons européennes",
};

function libelleTheme(theme: string): string {
  return THEMES[theme] ?? theme.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Seuls les thèmes cartographiables alimentent la carte : la dette et les
 *  comparaisons européennes n'existent qu'au niveau national. */
function themesCartographiables(): string[] {
  return [...new Set(catalogue.filter((i) => i.niveaux?.includes(etat.niveau)).map((i) => i.theme))];
}

/** Maille et territoire vivent sous la carte, en pilules : ce sont des
 *  réglages de cadrage, pas des questions posées au lecteur. */
function construireBarreCarte(): void {
  $("pilules-vue").innerHTML = Object.entries(VUES)
    .map(
      ([cle, v]) => `<button type="button" data-vue-carte="${cle}"
      class="pilule${cle === etat.vue ? " pilule--active" : ""}"
      aria-pressed="${cle === etat.vue}">${cle === "metropole" ? "Métropole" : v.nom}</button>`,
    )
    .join("");
}

function construireSelecteurs(): void {
  const disponibles = themesCartographiables();
  if (!disponibles.includes(etat.theme)) etat.theme = disponibles[0] ?? "finances_locales";

  const financiers = catalogue.filter(
    (i) => i.theme === etat.theme && i.niveaux?.includes(etat.niveau),
  );
  if (!financiers.some((i) => i.id === etat.indicateur)) {
    etat.indicateur = financiers[0]?.id ?? etat.indicateur;
  }

  // Périodes du niveau affiché, pas de l'indicateur tous niveaux confondus :
  // l'historique communal est plus court que celui des départements, et
  // proposer une année sans couche mènerait à un fichier absent.
  const fiche = indicateurCourant();
  const periodes = [
    ...(fiche.periodes_par_niveau?.[etat.niveau] ?? fiche.periodes ?? []),
  ]
    .sort()
    .reverse();
  // Toujours la plus récente : l'année n'est plus un réglage.
  etat.periode = periodes[0];
  construireBarreCarte();

}

async function choisirIndicateur(id: string): Promise<void> {
  const choisi = catalogue.find((i) => i.id === id);
  if (!choisi) return;
  // Un indicateur qui n'existe pas à la maille affichée ne se peint pas : les
  // séries nationales — budget de l'État, dette — n'ont pas de valeur par
  // commune. Sa fiche s'ouvre quand même, la carte reste sur ce qu'elle sait
  // montrer plutôt que de se vider.
  if (!choisi.niveaux?.includes(etat.niveau)) return;
  // Changer de thème remet l'année à la plus récente : un thème au millésime
  // court y laissait sinon le lecteur sans un mot.
  if (choisi.theme !== etat.theme) etat.periode = "";
  etat.theme = choisi.theme;
  etat.indicateur = id;
  construireSelecteurs();
  ecrireUrl();
  await peindre();
  // Le panneau se replace en haut : la mesure choisie devient le héros.
  $("volet-territoire").scrollTo({ top: 0, behavior: "smooth" });
}

function brancherCommandes(): void {
  $("pilules-vue").addEventListener("click", async (evenement) => {
    const bouton = (evenement.target as HTMLElement).closest<HTMLButtonElement>("[data-vue-carte]");
    const vue = bouton?.dataset.vueCarte;
    if (!vue) return;
    etat.vue = vue;
    cadrer(vue);
    construireBarreCarte();
    ecrireUrl();
  });

  // Le panneau est la seule commande : cliquer une ligne porte son indicateur
  // sur la carte.
  const surLigne = (evenement: Event) => {
    // L'onglet d'abord : il ne porte rien sur la carte, il change ce que la
    // fiche montre.
    const onglet = (evenement.target as HTMLElement).closest<HTMLElement>(
      ".onglets-themes [data-theme]",
    );
    if (onglet?.dataset.theme) {
      const voulu = onglet.dataset.theme;
      for (const bouton of document.querySelectorAll<HTMLElement>(".onglets-themes [data-theme]")) {
        bouton.setAttribute("aria-pressed", String(bouton.dataset.theme === voulu));
      }
      for (const section of document.querySelectorAll<HTMLElement>(".mesures [data-theme]")) {
        section.hidden = section.dataset.theme !== voulu;
      }
      onglet.scrollIntoView({ block: "nearest", inline: "center" });
      return;
    }
    // Ouvrir une mesure la porte sur la carte : le geste qui demande le détail
    // est le même que celui qui veut la voir peinte. Un bouton séparé faisait
    // deux clics pour une seule intention.
    const mesure = (evenement.target as HTMLElement).closest<HTMLElement>("[data-mesure]");
    if (mesure?.dataset.mesure) {
      // Refermer une mesure ne repeint rien : on ne change la carte qu'en
      // ouvrant, sinon un simple repli relancerait tout le rendu.
      if ((mesure as HTMLDetailsElement).open) return;
      void choisirIndicateur(mesure.dataset.mesure);
      return;
    }
    const ligne = (evenement.target as HTMLElement).closest<HTMLElement>("[data-indicateur]");
    if (ligne?.dataset.indicateur) void choisirIndicateur(ligne.dataset.indicateur);
  };
  $("fiche").addEventListener("click", surLigne);
  $("fiche").addEventListener("keydown", (evenement) => {
    if ((evenement as KeyboardEvent).key === "Enter") surLigne(evenement);
  });
  tiroirRedimensionnable();

  $("exporter").addEventListener("click", () => {
    const indicateur = indicateurCourant();
    const jeu = jeux.find((j) => j.id === indicateur.jeu);
    telecharger(
      enCsv(exportCourant.lignes, {
        indicateur: indicateur.libelle,
        unite: indicateur.unite,
        periode: etat.periode,
        niveau: etat.niveau,
        parHabitant: exportCourant.parHabitant,
        source: jeu ? `${jeu.producteur} — ${jeu.titre}` : indicateur.jeu,
      }),
      nomDeFichier(indicateur.libelle, etat.niveau, etat.periode),
    );
  });

  const champ = $<HTMLInputElement>("recherche");
  const liste = $<HTMLUListElement>("suggestions");
  champ.addEventListener("input", async () => {
    const requete = champ.value.trim().toLowerCase();
    if (requete.length < 2) {
      liste.hidden = true;
      return;
    }
    const index = await donnees.indexRecherche();
    const trouves = index
      .filter((e) => e.l === etat.niveau && (e.n.toLowerCase().startsWith(requete) || e.c === requete))
      .slice(0, 8);
    liste.hidden = trouves.length === 0;
    liste.innerHTML = trouves
      .map((e) => `<li><button type="button" data-code="${e.c}">${e.n} <span>${e.c}</span></button></li>`)
      .join("");
  });
  liste.addEventListener("click", async (evenement) => {
    const bouton = (evenement.target as HTMLElement).closest("button");
    if (!bouton) return;
    liste.hidden = true;
    champ.value = "";
    await montrerFiche(bouton.dataset.code as string);
  });
}

/** Trois vues — Carte, Décryptages, Données — au lieu d'un long défilement.
 *  Le lecteur choisit ce qu'il regarde ; on ne passe plus d'une carte plein
 *  écran à une pile de blocs sans transition. L'état vit dans le hash. */
const VUES_PAGE = ["carte", "decryptages", "donnees"] as const;

function basculerVue(): void {
  const demandee = location.hash.replace("#", "");
  const vue = (VUES_PAGE as readonly string[]).includes(demandee) ? demandee : "carte";
  document.body.dataset.vue = vue;
  document.querySelector<HTMLElement>(".atelier")!.hidden = vue !== "carte";
  $("vue-decryptages").hidden = vue !== "decryptages";
  $("vue-donnees").hidden = vue !== "donnees";
  document.querySelectorAll<HTMLAnchorElement>(".entete__nav a").forEach((a) => {
    if (a.dataset.vue === vue) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0 });
}

async function demarrer(): Promise<void> {
  window.addEventListener("hashchange", basculerVue);
  basculerVue();
  const manifeste = await donnees.initialiser();
  jeux = manifeste.jeux;
  catalogue = await donnees.indicateurs();
  etat = lireUrl();
  construireSelecteurs();
  afficherQuestions($("questions"));

  // Le jeu de données public est le même que celui de la carte : le lien pointe
  // vers le pointeur de version, porte d'entrée de tous les autres fichiers.
  $("telechargement").insertAdjacentHTML(
    "beforeend",
    ` <a href="${donnees.racinePubliee()}/derniere.json" rel="noreferrer">Accéder aux données</a>.`,
  );

  maplibregl.addProtocol("pmtiles", new Protocol().tile);
  // Le fond de carte donne le contexte que la choroplèthe seule n'a pas :
  // villes, routes, relief des côtes. Il vient d'un tiers (Carto, données
  // OpenStreetMap) — la donnée, elle, reste servie par nos fichiers. Deux
  // couches raster encadrent la choroplèthe : le terrain passe dessous, les
  // noms de villes repassent DESSUS pour rester lisibles sur la couleur. En
  // cas de panne du fond, la carte de données vit seule sur le fond uni.
  const carreaux = (variante: string) =>
    ["a", "b", "c", "d"].map(
      (s) => `https://${s}.basemaps.cartocdn.com/${variante}/{z}/{x}/{y}.png`,
    );
  carte = new maplibregl.Map({
    container: "carte",
    style: {
      version: 8,
      sources: {
        territoires: {
          type: "vector",
          url: `pmtiles://${donnees.urlTuiles()}`,
          // Le code INSEE devient l'identifiant de figure : c'est lui qui
          // porte l'état de survol.
          promoteId: "code",
        },
        "fond-terrain": {
          type: "raster",
          tiles: carreaux("light_nolabels"),
          tileSize: 256,
          maxzoom: 19,
          attribution: "© OpenStreetMap · © CARTO",
        },
        "fond-noms": {
          type: "raster",
          tiles: carreaux("light_only_labels"),
          tileSize: 256,
          // Jamais sous le zoom 8 : aux échelles nationales, ce fond écrit
          // les mers et les régions en anglais (« Bay of Biscay »,
          // « Brittany ») — au-delà, les noms sont les noms locaux, français.
          minzoom: 8,
          maxzoom: 19,
        },
      },
      layers: [
        { id: "fond", type: "background", paint: { "background-color": "#f2f4f6" } },
        {
          id: "terrain",
          type: "raster",
          source: "fond-terrain",
          paint: { "raster-saturation": -0.4, "raster-opacity": 0.9 },
        },
        ...Object.values(COUCHES).flatMap((couche) => [
          {
            id: `remplissage-${couche}`,
            type: "fill" as const,
            source: "territoires",
            "source-layer": couche,
            paint: {
              "fill-color": "#d9d9d9",
              // Légèrement translucide : le terrain respire sous la donnée,
              // et le territoire survolé se densifie.
              "fill-opacity": [
                "case",
                ["boolean", ["feature-state", "survol"], false],
                0.96,
                0.78,
              ] as never,
            },
          },
          {
            id: `contour-${couche}`,
            type: "line" as const,
            source: "territoires",
            "source-layer": couche,
            // Un trait de largeur fixe rendait la carte illisible : à l'échelle
            // nationale, le contour blanc de 34 772 communes couvre plus de
            // surface que leur remplissage, et la choroplèthe se lit comme du
            // bruit. Le trait n'apparaît donc qu'au zoom où la maille devient
            // assez grande pour le porter — d'autant plus tard que la maille
            // est fine.
            paint: {
              "line-color": "#ffffff",
              "line-width": largeurLisere(couche) as never,
            },
          },
        ]),
        {
          id: "noms",
          type: "raster",
          source: "fond-noms",
          minzoom: 8,
          paint: { "raster-opacity": 0.95 },
        },
      ],
    },
    bounds: VUES[etat.vue]?.bornes ?? VUES.metropole.bornes,
    fitBoundsOptions: { padding: paddingCarte() },
    attributionControl: {
      customAttribution: "IGN Admin Express · OFGL · Licence Ouverte 2.0",
    },
  });
  carte.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

  // La maille suit le zoom quand le mode automatique est actif. `zoomend` et
  // non `zoom` : repeindre à chaque image de l'animation rechargerait la
  // couche des dizaines de fois pour un seul geste.
  // Le zoom d'ouverture (France entière) doit donner sa maille tout de suite,
  // sinon la première peinture se fait en communes sur une vue nationale.
  carte.once("load", () => {
    // Re-cadrage une fois la mise en page posée : à la construction, la zone
    // de carte n'a pas encore sa hauteur et le tiroir pas encore la sienne.
    if (window.innerWidth <= 960) cadrer(etat.vue);
    if (!etat.niveauAuto) return;
    const voulu = niveauPourZoom(carte.getZoom());
    if (voulu !== etat.niveau) {
      etat.niveau = voulu;
      construireSelecteurs();
      ecrireUrl();
      void peindre();
    }
  });

  // Les étiquettes suivent le mouvement : elles sont posées en pixels.
  carte.on("moveend", majEtiquettes);
  carte.on("zoomend", majEtiquettes);
  // `idle` couvre le premier rendu : peindre() s'exécute avant que les tuiles
  // ne soient dessinées, et rien ne rappelait la pose des étiquettes.
  carte.on("idle", majEtiquettes);

  carte.on("zoomend", () => {
    if (!etat.niveauAuto) return;
    const voulu = niveauPourZoom(carte.getZoom());
    if (voulu === etat.niveau) return;
    etat.niveau = voulu;
    etat.selection = null;
    construireSelecteurs();
    ecrireUrl();
    void peindre();
  });
  // Poignée de diagnostic pour la vérification-écran automatisée : elle lit
  // l'état réel des couches au lieu de le déduire des pixels.
  Object.assign(window as object, {
    __carte: carte,
    __diag: () => ({ entites: Object.keys(entites).length, un: entites["28"], niveau: etat.niveau }),
  });

  const infobulle = $("infobulle");
  const eteindreSurvol = () => {
    if (survole) {
      for (const couche of Object.values(COUCHES)) {
        carte.setFeatureState(
          { source: "territoires", sourceLayer: couche, id: survole },
          { survol: false },
        );
      }
      survole = null;
    }
    infobulle.hidden = true;
    carte.getCanvas().style.cursor = "";
  };

  // JAMAIS l'événement `load` : il attend toutes les sources, y compris le
  // fond de carte tiers — un CDN lent, en panne ou bloqué par un bloqueur de
  // publicité laissait la carte grise et sourde pour toujours (constaté en
  // vérification d'écran hors ligne). La donnée ne dépend que du style : on
  // démarre dès qu'il est prêt, les tuiles se dessinent quand elles arrivent.
  const demarrerCarte = async () => {
    // Les gestionnaires d'abord : ils ne dépendent pas des données, et un
    // échec de chargement ne doit pas laisser une carte sourde en plus d'une
    // carte grise.
    brancherInteractionsCarte();
    // Un échec réseau se réessaie une fois, puis se dit — une promesse
    // rejetée qui disparaît sans trace est un mensonge d'interface.
    try {
      await peindre();
    } catch {
      try {
        await peindre();
      } catch {
        $("fiche").innerHTML =
          '<p class="erreur">Le chargement des valeurs a échoué. Recharger la page réessaiera.</p>';
      }
    }
  };
  if (carte.isStyleLoaded()) {
    void demarrerCarte();
  } else {
    carte.once("styledata", () => void demarrerCarte());
  }

  function brancherInteractionsCarte(): void {
    for (const couche of Object.values(COUCHES)) {
      carte.on("click", `remplissage-${couche}`, async (evenement) => {
        const code = evenement.features?.[0]?.properties?.code as string | undefined;
        if (code) await montrerFiche(code);
      });
      // Double-clic : on entre dans le territoire. En mode automatique, la
      // maille se raffine d'elle-même en arrivant — c'est le geste attendu
      // d'une carte, plus besoin de penser au sélecteur.
      carte.on("dblclick", `remplissage-${couche}`, (evenement) => {
        evenement.preventDefault();
        carte.easeTo({
          center: evenement.lngLat,
          zoom: Math.min(carte.getZoom() + 2.2, 12),
          duration: 700,
        });
      });
      // Le survol dit le nom et la valeur sans obliger à cliquer — la carte
      // répond sous le curseur, elle n'est plus une image qu'on interroge à
      // l'aveugle.
      carte.on("mousemove", `remplissage-${couche}`, (evenement) => {
        const figure = evenement.features?.[0];
        const code = figure?.properties?.code as string | undefined;
        if (!code) return;
        if (survole !== code) {
          eteindreSurvol();
          survole = code;
          carte.setFeatureState(
            { source: "territoires", sourceLayer: couche, id: code },
            { survol: true },
          );
        }
        carte.getCanvas().style.cursor = "pointer";
        const nom = (figure?.properties?.nom as string | undefined) ?? entites[code]?.nom ?? code;
        const valeur = affichees[code];
        const indicateur = indicateurCourant();
        // Les deux lectures d'un montant : celle de la carte en premier,
        // l'autre en dessous, plus discrète.
        const autre =
          valeur !== undefined && indicateur.unite === "EUR" && parHabitantAUnSens(indicateur)
            ? parHabitantAffiche
              ? `<span class="infobulle__autre">${formater(brutes[code], "EUR", false)} au total</span>`
              : populations[code]
                ? `<span class="infobulle__autre">${formater(
                    brutes[code] / populations[code],
                    "EUR",
                    true,
                  )} par habitant</span>`
                : ""
            : "";
        infobulle.innerHTML = `<strong>${nom}</strong>${
          valeur === undefined
            ? `<span>donnée non disponible</span>`
            : `<span>${formater(valeur, indicateur.unite, parHabitantAffiche)}</span>${autre}`
        }`;
        infobulle.hidden = false;
        const cadre = $("carte").getBoundingClientRect();
        const x = Math.min(evenement.point.x + 14, cadre.width - infobulle.offsetWidth - 10);
        const y = Math.max(evenement.point.y - infobulle.offsetHeight - 12, 8);
        infobulle.style.transform = `translate(${x}px, ${y}px)`;
      });
      carte.on("mouseleave", `remplissage-${couche}`, eteindreSurvol);
    }
  }

  $("panneau-fermer").addEventListener("click", fermerPanneau);

  brancherCommandes();

  donnees
    .comparaisons()
    .then((c) => {
      groupes = c;
    })
    .catch(() => {
      // Les groupes de comparaison ne sont pas publiés : la fiche reste complète.
    });

  // Bloc national : indépendant de la carte, il s'affiche dès que les séries
  // pays sont disponibles.
  try {
    const pays = await donnees.territoires("pays", "tous");
    // La conjoncture d'abord : c'est le pouls le plus récent, le lecteur qui
    // arrive « pour l'économie » doit la voir avant les stocks annuels.
    if (afficherConjoncture($("bloc-conjoncture"), pays, catalogue)) {
      $("national").hidden = false;
    }
    if (afficherNational($("bloc-dette"), $("bloc-europe"), pays, catalogue)) {
      $("national").hidden = false;
    }
    if (afficherFonctions($("bloc-fonctions"), pays, catalogue)) {
      $("national").hidden = false;
    }
    if (afficherSecu($("bloc-secu"), pays, catalogue)) {
      $("national").hidden = false;
    }
  } catch {
    // Les séries nationales ne sont pas encore publiées : la carte reste utile.
  }

  // Le budget de l'État a son propre fichier : il est chargé à part pour qu'une
  // publication sans lui n'empêche pas le reste de s'afficher.
  try {
    const budget = await donnees.budgetEtat();
    // « 100 € » d'abord : c'est la question que le lecteur se pose, le pont
    // détaillé vient ensuite pour celui qui veut vérifier.
    const dernier = exercicesDisponibles(budget)[0];
    if (dernier) afficherCentEuros($("bloc-cent-euros"), budget, dernier);
    if (afficherBudgetEtat($("bloc-etat"), budget)) {
      $("national").hidden = false;
    }
  } catch {
    // Budget de l'État non publié : le reste du bloc national tient debout.
  }

  await majComparateur();

  // « Sources et méthode » quitte la fiche pour la vue Données : c'est une
  // référence qu'on consulte, pas un bandeau qu'on subit à chaque clic.
  // Elle porte tout : d'où viennent les jeux, comment chaque indicateur est
  // défini et calculé, et ce qui rend deux territoires comparables.
  const parTheme = new Map<string, Indicateur[]>();
  for (const indicateur of catalogue) {
    parTheme.set(indicateur.theme, [...(parTheme.get(indicateur.theme) ?? []), indicateur]);
  }
  $("sources-contenu").innerHTML = `
    <h3 class="sources__titre">D'où viennent les chiffres</h3>
    ${jeux
      .map(
        (jeu) => `<article class="source">
          <h4>${jeu.titre}</h4>
          <p>${jeu.producteur} — ${jeu.licence}<br />
          Extraction du ${new Date(jeu.extraction).toLocaleDateString("fr-FR")} ·
          <a href="${jeu.url}" rel="noreferrer">fichier source</a></p>
        </article>`,
      )
      .join("")}
    <h3 class="sources__titre">Comment chaque indicateur est défini</h3>
    ${[...parTheme.entries()]
      .map(
        ([theme, liste]) => `<details class="repli">
          <summary>${libelleTheme(theme)} (${liste.length})</summary>
          <ul class="methodes">${liste
            .map(
              (i) => `<li><strong>${i.libelle}</strong> — ${i.definition}
                <br /><span class="technique">${i.definition_technique}</span>
                <br /><span class="formule">Calcul : ${i.formule}</span></li>`,
            )
            .join("")}</ul>
        </details>`,
      )
      .join("")}
    <h3 class="sources__titre">Ce qui rend deux territoires comparables</h3>
    <ul class="methodes">
      <li>Comparer deux territoires suppose la même année, la même unité et le
        même périmètre budgétaire.</li>
      <li>Les repères sont la médiane des territoires de même niveau — la moitié
        se situe en dessous. « Communes de la région » désigne l'ensemble des
        communes de cette région, jamais le budget du conseil régional, qui est
        une autre collectivité aux autres compétences.</li>
      <li>Les communes nouvelles portent l'historique de leurs communes
        d'origine, additionné sous le code actuel.</li>
      <li>Un établissement public territorial est inclus dans la Métropole du
        Grand Paris : ne pas additionner les deux.</li>
      <li>Les montants par habitant utilisent la population de référence de
        l'Observatoire des finances locales de l'exercice concerné, afin que
        nos ratios reproduisent exactement les siens.</li>
      <li>Un budget voté n'est pas une dépense réalisée : les montants publiés
        ici sont ceux des comptes exécutés, budgets principaux et annexes
        consolidés.</li>
    </ul>`;

  // Les repères se chargent à part : une publication qui n'en a pas doit laisser
  // la fiche s'afficher sans eux. Quand ils arrivent, la fiche ouverte est
  // redessinée — sinon les comparaisons manquaient au premier affichage.
  donnees
    .references()
    .then((r) => {
      reperes = r;
      if (etat.selection) void montrerFiche(etat.selection);
    })
    .catch(() => {});

  // Les mailles supérieures, pour comparer : quelques kilo-octets, chargés une
  // fois pour toutes.
  Promise.all([
    donnees.territoires("departement", "tous").catch(() => ({})),
    donnees.territoires("region", "tous").catch(() => ({})),
    donnees.territoires("pays", "tous").catch(() => ({})),
  ])
    .then(([dep, reg, pays]) => {
      parents = { ...dep, ...reg, ...(pays as Record<string, Territoire>) };
      // Le panneau d'accueil EST la fiche de la France : il ne peut donc
      // s'afficher qu'une fois la maille « pays » arrivée. Sans ce second
      // rendu, l'aperçu de couche restait à l'écran jusqu'au premier clic.
      if (etat.selection) void montrerFiche(etat.selection);
      else afficherApercu();
    })
    .catch(() => {});

}

demarrer().catch((erreur) => {
  $("fiche").innerHTML = `<p class="erreur">Les données n'ont pas pu être chargées : ${erreur.message}</p>`;
});
