/**
 * Carte des finances locales. L'état de l'écran vit dans l'URL : tout ce qui
 * est affiché est partageable tel quel (docs/04).
 */

import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

import * as donnees from "./donnees.ts";
import { IDS_DERIVES, indicateursDerives, seriesDerivees } from "./derives.ts";
import { traduire } from "./traductions.ts";
import type { Indicateur, Jeu, Territoire } from "./donnees.ts";
import {
  afficherFiche,
  groupeDeLaCommune,
  positionDansGroupe,
  valeurComparable,
} from "./fiche.ts";
import { afficherBudgetEtat, exercicesDisponibles } from "./etat.ts";
import { afficherCentEuros } from "./cent-euros.ts";
import { afficherQuestions } from "./questions.ts";
import { rendu as apercuRendu, resumer } from "./apercu.ts";
import { afficherComparateur, type Entree, MAXIMUM } from "./comparateur.ts";
import { enCsv, nomDeFichier, telecharger, type LigneExport } from "./export.ts";
import { afficherNational } from "./national.ts";
import { afficherFonctions } from "./fonctions.ts";
import { afficherConjoncture } from "./conjoncture.ts";
import { afficherNiches } from "./niches.ts";
import { afficherSecu } from "./secu.ts";
import {
  expressionCouleur,
  formater,
  noteEchelle,
  parHabitantAUnSens,
  populationDeReference,
  quantiles,
} from "./echelle.ts";
import {
  MAILLES_HORS_CARTE, NIVEAUX_RECHERCHABLES, niveauPourZoom, suggestions,
} from "./mailles.ts";
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
  communes: [7, 0, 8.5, 0.3, 12, 0.8],
};

/** Expression MapLibre, sortie du littéral de calque : son type d'union ne
 *  survit pas à l'inférence, comme pour `expressionCouleur`. */
function largeurLisere(couche: string): unknown {
  return ["interpolate", ["linear"], ["zoom"], ...LISERE[couche]];
}

const COUCHES: Record<string, string> = {
  commune: "communes",
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
  /** Maille du territoire ouvert, quand ce n'est pas celle de la carte.
   *
   *  Un arrondissement municipal n'a pas de couche de tuiles : sa fiche s'ouvre
   *  sans que la carte change de calque, sinon `peindre()` demanderait
   *  `remplissage-undefined`. `null` = la sélection est à la maille affichée. */
  maille: string | null;
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
let agregats: donnees.AgregatsNationaux | null = null;
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

/** La maille de la **carte** : elle doit avoir une couche de tuiles.
 *
 *  Le contrôle portait sur les mailles cherchables. Elles coïncidaient tant que
 *  toutes avaient une couche ; l'arrondissement municipal se cherche sans en
 *  avoir, et `?niveau=arrondissement_municipal` aurait fait peindre un calque
 *  inexistant. C'est `COUCHES` qui fait foi ici. */
function niveauConnu(demande: string | null): string {
  return demande && demande in COUCHES ? demande : "region";
}

/** La maille cherchable d'une sélection hors carte, sinon `null`. */
function mailleConnue(demande: string | null): string | null {
  return demande && MAILLES_HORS_CARTE.has(demande) && demande in NIVEAUX_RECHERCHABLES
    ? demande
    : null;
}

/** La maille du territoire ouvert : celle de la carte, sauf sélection hors carte. */
function niveauSelection(): string {
  return etat.maille ?? etat.niveau;
}

function lireUrl(): Etat {
  const p = new URLSearchParams(location.search);
  return {
    theme: p.get("theme") ?? "finances_locales",
    indicateur: p.get("indicateur") ?? "ofgl_depenses_fonctionnement",
    // Une maille inconnue est ramenée à la maille par défaut plutôt que prise
    // au mot. Des liens `?niveau=epci` ont circulé pendant les mois où
    // l'intercommunalité était publiée ; les honorer aujourd'hui ouvrirait une
    // carte sans couche et une fiche sans intitulé, sans qu'aucune erreur ne
    // le dise.
    niveau: niveauConnu(p.get("niveau")),
    // Le zoom ne commande la maille que si le lien n'en nomme aucune. Un lien
    // partagé porte `niveau=commune&territoire=33063` ; le laisser en automatique
    // faisait basculer la maille sur celle du cadrage d'ouverture — national,
    // donc régions — avant même que la fiche ne soit demandée. Le lot des
    // communes n'était alors pas chargé, `entites["33063"]` valait `undefined`,
    // et le panneau affichait « Choisissez un territoire » sans rien dire.
    // Quand elle apparaissait quand même, la fiche s'intitulait « Bordeaux —
    // Région » et se comparait à la médiane des régions de France.
    niveauAuto: !p.get("niveau"),
    // Un lien vers la fiche de Paris 1er porte `maille=arrondissement_municipal`
    // en plus de `niveau` : sans elle, le rechargement chercherait 75101 dans le
    // lot des communes du 75, ne l'y trouverait pas, et le panneau resterait
    // muet — le même défaut que celui décrit juste au-dessus.
    maille: mailleConnue(p.get("maille")),
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
  if (etat.maille) p.set("maille", etat.maille);
  if (etat.comparaison.length) p.set("comparer", etat.comparaison.join(","));
  history.replaceState(null, "", `?${p}`);
}

/** Les séries calculées rejoignent celles du territoire dès son chargement.
 *
 *  Les ajouter ici plutôt qu'à l'affichage garantit qu'elles existent partout où
 *  les autres existent : dans la fiche, mais aussi dans les mailles supérieures
 *  qui lui servent de comparaison. Sans cela, une commune aurait sa capacité de
 *  désendettement sans avoir celle de son département à côté. */
function enrichir(paquet: Record<string, Territoire>, niveau: string): Record<string, Territoire> {
  const sortie: Record<string, Territoire> = {};
  for (const [code, territoire] of Object.entries(paquet)) {
    // Le catalogue porte l'unité de compte de chaque série : c'est lui qui dit
    // si les composantes d'un agrégat comptent bien la même chose.
    const calculees = seriesDerivees(territoire.series, niveau, catalogue);
    sortie[code] = Object.keys(calculees).length
      ? { ...territoire, series: { ...territoire.series, ...calculees } }
      : territoire;
  }
  return sortie;
}

async function chargerTerritoires(niveau: string, lot: string): Promise<void> {
  const paquet = await donnees.territoires(niveau, lot);
  entites = { ...entites, ...enrichir(paquet, niveau) };
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

/**
 * Les associations subventionnées, chargées avec le département de la commune.
 *
 * Un lot par département, comme les fiches : cinquante-trois mille lignes en un
 * fichier feraient télécharger la France entière pour lire une commune. Un lot
 * absent — publication antérieure au fichier, département sans association
 * subventionnée — laisse le thème sur son seul agrégat plutôt que d'empêcher la
 * fiche de s'afficher.
 */
const associations: Record<string, donnees.SubventionsCommune> = {};
const lotsAssociations = new Set<string>();

async function chargerAssociations(code: string): Promise<void> {
  const lot = code.startsWith("97") ? code.slice(0, 3) : code.slice(0, 2);
  if (lotsAssociations.has(lot)) return;
  lotsAssociations.add(lot);
  try {
    Object.assign(associations, await donnees.subventions(lot));
  } catch {
    // Rien à dire : le thème garde son agrégat, qui ne dépend pas de ce fichier.
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
  $("legende-titre").textContent = traduire(indicateur.libelle);
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
  $("legende").title = `Légende : ${traduire(indicateur.libelle)}`;
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
  exporter.textContent = `Télécharger en CSV (${toutes.length.toLocaleString("fr-FR")} territoire${
    toutes.length > 1 ? "s" : ""
  })`;

  const lignes = toutes.slice(0, 100);
  $("tableau-donnees").innerHTML = `
    <caption>${traduire(indicateur.libelle)}, ${etat.periode}${parHabitant ? ", par habitant" : ""} · 100 premiers territoires</caption>
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
      peintSurCarte,
      agregats,
      inflation: parents["FR"]?.series?.eurostat_inflation_ipch,
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
    // Le creux de droite suit la largeur réelle du panneau : min(50rem, 60vw).
    // Réglé trop court, la France se dessinait à moitié derrière la fiche.
    return { top: 40, bottom: 96, left: 16, right: Math.min(760, window.innerWidth * 0.6) };
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
  // La maille de la fiche n'est pas toujours celle de la carte : un
  // arrondissement municipal se lit sans couche de tuiles.
  const niveau = niveauSelection();
  // Les deux en parallèle : la liste nominative ne doit pas retarder la fiche,
  // et son absence ne doit pas l'empêcher.
  await Promise.all([
    chargerLotsNecessaires(niveau, [code]),
    niveau === "commune" ? chargerAssociations(code) : Promise.resolve(),
  ]);
  const territoire = entites[code];
  if (!territoire) return;
  etat.selection = code;
  ecrireUrl();
  // La cascade : le groupe le plus fin qui existe pour cette commune, et les
  // critères qui l'ont défini — ils changent d'une commune à l'autre.
  const trouve =
    niveau === "commune" && groupes
      ? groupeDeLaCommune(
          territoire,
          groupes.groupes[etat.indicateur]?.[etat.periode],
          groupes.cascade ?? [groupes.criteres],
        )
      : undefined;
  const quartiles = trouve?.quartiles;
  // Ce qui se compare au groupe dépend de la grandeur : une dépense et un
  // nombre de logements se rapportent aux habitants, une médiane de revenus et
  // un taux se comparent tels qu'ils sont publiés. C'est la publication qui le
  // dit, indicateur par indicateur — le site n'a pas à le deviner.
  const base = groupes?.bases?.[etat.indicateur];
  const valeurComparee = valeurComparable(territoire, etat.indicateur, etat.periode, base);

  // Rang du territoire dans la couche affichée : « 8 512ᵉ sur 34 772 » situe
  // un chiffre que sa seule valeur ne situe pas. Calculé sur les valeurs déjà
  // peintes — même tri, même dénominateur que la carte.
  const classement = Object.entries(affichees).sort(([, a], [, b]) => b - a);
  const position = classement.findIndex(([c]) => c === code);
  const rang =
    position >= 0 ? { position: position + 1, total: classement.length } : undefined;

  afficherFiche($("fiche"), {
    niveau,
    territoire,
    principal: etat.indicateur,
    rang,
    comparaison: groupes
      ? positionDansGroupe(territoire, quartiles, valeurComparee, trouve?.criteres ?? [], base)
      : "",
    // Tous les thèmes, plus seulement celui de la carte : le panneau est
    // désormais le seul endroit où l'on choisit — il doit tout montrer.
    // Filtré sur le niveau : afficher « donnée non disponible » pour un
    // indicateur qui n'existe pas à ce niveau ferait passer une absence de
    // définition pour une absence de mesure.
    indicateurs: indicateursDeLaFiche(niveau),
    libelleTheme,
    // De quoi comparer, même pour les jeux sous secret de diffusion où
    // aucune médiane communale n'est publiable : la valeur du département,
    // celle de la région, celle de la France. Ce sont des chiffres publiés,
    // pas des estimations.
    comparateurs:
      niveau === "commune"
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
        : niveau === "departement"
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
    peintSurCarte,
    associations: associations[code],
    agregats,
    inflation: parents["FR"]?.series?.eurostat_inflation_ipch,
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
  etat.maille = null;
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
    catalogue.filter(
      (i) => i.theme === etat.theme && i.niveaux?.includes(etat.niveau) && !DENOMINATEURS.has(i.id),
    ),
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
  famille: "Familles et unions",
  logement: "Logement",
  professions: "Professions et catégories sociales",
  emploi: "Emploi et chômage",
  diplomes: "Diplômes de la population",
  entreprises: "Entreprises",
  secteurs_etablissements: "Établissements par secteur",
  secteurs_salaries: "Salariés par secteur",
  equipements: "Équipements et services",
  tourisme: "Hébergement touristique",
  elections: "Participation électorale",
  prenoms: "Prénoms",
  fonctions: "Dépenses par fonction",
  securite_sociale: "Sécurité sociale",
  securite: "Sécurité",
  sante: "Santé",
  education: "Éducation",
  impots_locaux: "Impôts locaux",
  macro: "Conjoncture",
  dette: "Dette publique",
  budget_etat: "Budget de l'État",
  depenses_fiscales: "Niches fiscales",
  energie: "Énergie",
  transports: "Transports",
  environnement: "Environnement",
  justice: "Justice",
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

/**
 * Cet indicateur a-t-il une couche à peindre, ici et maintenant ?
 *
 * Mêmes refus que `choisirIndicateur` — une série nationale n'existe pas par
 * commune, un indicateur reconstitué n'a pas de fichier de carte. Écrit à part
 * pour que la fiche puisse le demander *avant* de proposer le bouton : un
 * bouton qui ne fait rien est pire que pas de bouton.
 */
function peintSurCarte(indicateur: Indicateur): boolean {
  return !!indicateur.niveaux?.includes(etat.niveau) && !IDS_DERIVES.has(indicateur.id);
}

async function choisirIndicateur(id: string): Promise<void> {
  const choisi = catalogue.find((i) => i.id === id);
  if (!choisi) return;
  // Un indicateur qui n'existe pas à la maille affichée ne se peint pas : les
  // séries nationales — budget de l'État, dette — n'ont pas de valeur par
  // commune. Sa fiche s'ouvre quand même, la carte reste sur ce qu'elle sait
  // montrer plutôt que de se vider.
  if (!choisi.niveaux?.includes(etat.niveau)) return;
  // Un indicateur calculé n'a pas de couche à peindre : il est reconstitué
  // territoire par territoire, pas publié en fichier de carte. Sa fiche s'ouvre,
  // la carte garde ce qu'elle montrait — plutôt que de virer au gris faute de
  // fichier. La peindre demanderait de recalculer 34 772 ratios à chaque clic ;
  // c'est possible, ce n'est pas gratuit, et personne ne l'a demandé.
  if (IDS_DERIVES.has(id)) return;
  // Changer de thème remet l'année à la plus récente : un thème au millésime
  // court y laissait sinon le lecteur sans un mot.
  if (choisi.theme !== etat.theme) etat.periode = "";
  etat.theme = choisi.theme;
  etat.indicateur = id;
  construireSelecteurs();
  ecrireUrl();
  // La fiche est réécrite entièrement par `peindre`, et le panneau se replaçait
  // en haut par-dessus le marché — « la mesure choisie devient le héros ». On ne
  // choisit pas une mesure pour perdre sa place : ouvrir la douzième d'un thème
  // renvoyait à l'autre bout du panneau, la mesure ouverte hors de l'écran.
  //
  // Restaurer le nombre de pixels ne suffit pas : la mesure choisie s'ouvre et
  // le contenu au-dessus d'elle change de hauteur. C'est donc la mesure
  // elle-même qu'on épingle — on la remet à la hauteur d'écran où elle était
  // quand on l'a touchée.
  const volet = $("volet-territoire");
  const avant = document
    .querySelector<HTMLElement>(`[data-mesure="${CSS.escape(id)}"]`)
    ?.getBoundingClientRect().top;
  const position = volet.scrollTop;
  await peindre();
  volet.scrollTop = position;
  const apres = document
    .querySelector<HTMLElement>(`[data-mesure="${CSS.escape(id)}"]`)
    ?.getBoundingClientRect().top;
  if (avant !== undefined && apres !== undefined) volet.scrollTop += apres - avant;
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

  // Une seule bulle de définition ouverte à la fois, et rien qui traîne après
  // un nouveau rendu de la fiche.
  const fermerDefinitions = (): void => {
    for (const bulle of document.querySelectorAll<HTMLElement>(".mesure__definition")) {
      bulle.hidden = true;
    }
    for (const bouton of document.querySelectorAll<HTMLElement>("[data-info]")) {
      bouton.setAttribute("aria-expanded", "false");
    }
  };
  document.addEventListener("keydown", (evenement) => {
    if (evenement.key === "Escape") fermerDefinitions();
  });

  // Le panneau est la seule commande : cliquer une ligne porte son indicateur
  // sur la carte.
  const surLigne = (evenement: Event) => {
    // L'onglet d'abord : il ne porte rien sur la carte, il change ce que la
    // fiche montre.
    // Changer de rubrique ouvre son premier thème : laisser la fiche sur le
    // thème d'une autre rubrique afficherait un contenu que plus aucun onglet
    // enfoncé ne désigne.
    const rubrique = (evenement.target as HTMLElement).closest<HTMLElement>(
      ".onglets-rubriques [data-rubrique]",
    );
    if (rubrique?.dataset.rubrique) {
      const voulue = rubrique.dataset.rubrique;
      for (const bouton of document.querySelectorAll<HTMLElement>(
        ".onglets-rubriques [data-rubrique]",
      )) {
        bouton.setAttribute("aria-pressed", String(bouton.dataset.rubrique === voulue));
      }
      let premier = "";
      for (const barre of document.querySelectorAll<HTMLElement>(
        ".onglets-themes[data-rubrique]",
      )) {
        barre.hidden = barre.dataset.rubrique !== voulue;
        if (barre.dataset.rubrique !== voulue) continue;
        premier = barre.querySelector<HTMLElement>("[data-theme]")?.dataset.theme ?? "";
      }
      for (const bouton of document.querySelectorAll<HTMLElement>(".onglets-themes [data-theme]")) {
        bouton.setAttribute("aria-pressed", String(bouton.dataset.theme === premier));
      }
      for (const section of document.querySelectorAll<HTMLElement>(".mesures [data-theme]")) {
        section.hidden = section.dataset.theme !== premier;
      }
      return;
    }
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
    // Le rond « i » explique, il ne replie pas : sans cela, le toucher fermait
    // la mesure qu'on venait d'ouvrir pour la comprendre.
    const info = (evenement.target as HTMLElement).closest<HTMLElement>("[data-info]");
    if (info) {
      evenement.preventDefault();
      const definition = info.parentElement?.querySelector<HTMLElement>(".mesure__definition");
      if (!definition) return;
      // La bulle ne déplie rien et n'ouvre pas la mesure : demander ce qu'un
      // mot veut dire ne devait pas déplacer les vingt lignes du dessous ni
      // faire changer la carte.
      const montrer = definition.hidden;
      fermerDefinitions();
      definition.hidden = !montrer;
      info.setAttribute("aria-expanded", String(montrer));
      return;
    }
    // Un clic ailleurs referme la bulle ouverte — c'est ce qu'on attend d'un
    // dispositif qui recouvre le texte.
    fermerDefinitions();
    // Les deux lectures d'un même total : ce que la commune achète, et à quoi
    // ça sert. Elles ne s'additionnent jamais entre elles — c'est le même euro,
    // vu deux fois — donc on montre l'une ou l'autre, jamais les deux.
    const axe = (evenement.target as HTMLElement).closest<HTMLElement>("[data-axe]");
    if (axe?.dataset.axe && axe.tagName === "BUTTON") {
      const voulu = axe.dataset.axe;
      const bloc = axe.closest(".pont__ouvrir");
      for (const bouton of bloc?.querySelectorAll<HTMLElement>("button[data-axe]") ?? []) {
        bouton.setAttribute("aria-pressed", String(bouton.dataset.axe === voulu));
      }
      for (const liste of bloc?.querySelectorAll<HTMLElement>("ul[data-axe]") ?? []) {
        liste.hidden = liste.dataset.axe !== voulu;
      }
      return;
    }
    // La carte ne suit plus le dépliage, elle suit ce bouton.
    //
    // Ouvrir une mesure la portait sur la carte. Peindre relit une couche de
    // 34 772 territoires et réécrit la fiche entière : *lire* un chiffre
    // coûtait donc le prix de *cartographier* un chiffre, à chaque ligne. Sur
    // un thème à soixante-dix-neuf indicateurs, la lecture devenait
    // impraticable. Déplier ne fait plus que déplier.
    const versLaCarte = (evenement.target as HTMLElement).closest<HTMLElement>("[data-carte]");
    if (versLaCarte?.dataset.carte) {
      void choisirIndicateur(versLaCarte.dataset.carte);
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
        source: jeu ? `${jeu.producteur}, ${jeu.titre}` : indicateur.jeu,
      }),
      nomDeFichier(indicateur.libelle, etat.niveau, etat.periode),
    );
  });

  const champ = $<HTMLInputElement>("recherche");
  const liste = $<HTMLUListElement>("suggestions");
  // La recherche cherchait dans la seule maille affichée. Comme cette maille
  // suit désormais le zoom, taper « Lyon » sur une vue nationale ne trouvait
  // rien — sans un mot d'explication — alors que le champ promet « une
  // commune, un département ». Elle cherche maintenant partout, dit à quelle
  // maille appartient chaque réponse, et y emmène. Le tri et le filtre vivent
  // dans `mailles.ts`, où ils sont testables.
  champ.addEventListener("input", async () => {
    const requete = champ.value.trim().toLowerCase();
    if (requete.length < 2) {
      liste.hidden = true;
      return;
    }
    const trouves = suggestions(await donnees.indexRecherche(), requete, etat.niveau);
    liste.hidden = false;
    liste.innerHTML = trouves.length
      ? trouves
          .map(
            (e) =>
              `<li><button type="button" data-code="${e.c}" data-niveau="${e.l}">${e.n} <span>${
                NIVEAUX_RECHERCHABLES[e.l]
              }</span></button></li>`,
          )
          .join("")
      : `<li class="suggestions__vide">Aucun territoire ne porte ce nom.</li>`;
  });
  champ.addEventListener("keydown", (evenement) => {
    const touche = (evenement as KeyboardEvent).key;
    if (touche === "Escape") {
      liste.hidden = true;
      return;
    }
    if (touche !== "ArrowDown" && touche !== "ArrowUp") return;
    const boutons = [...liste.querySelectorAll<HTMLButtonElement>("button")];
    if (!boutons.length) return;
    evenement.preventDefault();
    (touche === "ArrowDown" ? boutons[0] : boutons[boutons.length - 1]).focus();
  });
  liste.addEventListener("keydown", (evenement) => {
    const touche = (evenement as KeyboardEvent).key;
    const boutons = [...liste.querySelectorAll<HTMLButtonElement>("button")];
    const place = boutons.indexOf(document.activeElement as HTMLButtonElement);
    if (touche === "Escape") {
      liste.hidden = true;
      champ.focus();
      return;
    }
    if (place === -1 || (touche !== "ArrowDown" && touche !== "ArrowUp")) return;
    evenement.preventDefault();
    const voulu = touche === "ArrowDown" ? place + 1 : place - 1;
    // Remonter au-dessus du premier ramène au champ : on continue à taper.
    if (voulu < 0) champ.focus();
    else boutons[Math.min(voulu, boutons.length - 1)].focus();
  });
  liste.addEventListener("click", async (evenement) => {
    const bouton = (evenement.target as HTMLElement).closest("button");
    if (!bouton) return;
    liste.hidden = true;
    champ.value = "";
    // Choisir une commune depuis une vue régionale change la maille : sans
    // cela, la fiche s'ouvrait sur un territoire que la carte ne connaissait
    // pas et le panneau restait vide.
    const voulu = bouton.dataset.niveau as string;
    // Sauf pour une maille sans couche de tuiles — un arrondissement municipal.
    // Y basculer la carte lui ferait peindre un calque inexistant ; sa fiche
    // s'ouvre donc par-dessus la carte laissée telle quelle.
    etat.maille = MAILLES_HORS_CARTE.has(voulu) ? voulu : null;
    if (voulu && !etat.maille && voulu !== etat.niveau) {
      etat.niveau = voulu;
      // Le zoom ne commande plus la maille : l'utilisateur vient de la choisir.
      etat.niveauAuto = false;
      construireSelecteurs();
      await peindre();
    }
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
  // Les indicateurs calculés entrent au catalogue comme les autres : thèmes,
  // fiche, synthèse, tableau et export les traitent alors sans rien savoir de
  // leur origine. Leur badge et leur fiche disent d'où ils viennent.
  catalogue = [...catalogue, ...indicateursDerives(catalogue)];
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
    etat.maille = null;
    construireSelecteurs();
    ecrireUrl();
    void peindre();
  });
  // Poignée de diagnostic pour la vérification-écran automatisée : elle lit
  // l'état réel des couches au lieu de le déduire des pixels.
  Object.assign(window as object, {
    __carte: carte,
    __diag: () => ({ entites: Object.keys(entites).length, un: entites["28"], niveau: etat.niveau }),
    // Le groupe de comparaison ne s'affichait pas et rien ne disait pourquoi :
    // trois valeurs à lire — la clé construite, la période, ce qui est trouvé.
    __groupe: (code: string) => {
      const t = entites[code];
      const cascade = groupes?.cascade ?? (groupes ? [groupes.criteres] : []);
      const cle = cascade
        .map((cs, r) => `${r}:${cs.map((c) => (t?.drapeaux as Record<string, string>)?.[c] ?? "").join("|")}`)
        .join(" ou ");
      return {
        charge: Boolean(groupes),
        indicateur: etat.indicateur,
        periode: etat.periode,
        cle,
        periodesDisponibles: Object.keys(groupes?.groupes[etat.indicateur] ?? {}),
        trouve: groupes?.groupes[etat.indicateur]?.[etat.periode]?.[cle ?? ""],
      };
    },
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
        // Un clic sur la carte sélectionne toujours à la maille peinte : il
        // referme une fiche d'arrondissement ouverte par la recherche.
        etat.maille = null;
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
            ? `<span>non publié pour ce territoire</span>`
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
    // Les niches fiscales ont leur propre fichier — le détail des dispositifs
    // n'a pas sa place dans une série pays — mais leur total en est un : le
    // bloc a besoin des deux, il est donc chargé ici.
    const niches = await donnees.depensesFiscales();
    if (afficherNiches($("bloc-niches"), niches, pays, catalogue)) {
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
        (jeu) => `<details class="repli">
          <summary>${jeu.titre}</summary>
          <p>${jeu.producteur} · ${jeu.licence}<br />
          Extraction du ${new Date(jeu.extraction).toLocaleDateString("fr-FR")} ·
          <a href="${jeu.url}" rel="noreferrer">fichier source</a></p>
        </details>`,
      )
      .join("")}
    <h3 class="sources__titre">Comment chaque indicateur est défini</h3>
    ${[...parTheme.entries()]
      .map(
        ([theme, liste]) => `<details class="repli">
          <summary>${libelleTheme(theme)} (${liste.length})</summary>
          <ul class="methodes">${liste
            .map(
              (i) => `<li><strong>${i.libelle}</strong> : ${i.definition}
                <br /><span class="technique">${i.definition_technique}</span>
                <br /><span class="formule">Calcul : ${i.formule}</span></li>`,
            )
            .join("")}</ul>
        </details>`,
      )
      .join("")}
    <h3 class="sources__titre">Comment les comptes d'une collectivité sont lus</h3>
    <ul class="methodes">
      <li>Les six rapports et l'enchaînement « d'un euro encaissé à ce qu'il en
        reste » sont calculés sur les agrégats du <strong>budget principal</strong>
        publiés par l'Observatoire des finances et de la gestion publique locales
        (OFGL). Les budgets annexes n'y sont pas.</li>
      <li>Les six rapports portent tous sur un <strong>exercice unique</strong> : un
        rapport dont un terme manque pour cette année-là n'est pas calculé sur
        l'année d'à côté, il n'est pas affiché.</li>
      <li>Le seul seuil chiffré du site est le <strong>plafond national de
        référence</strong> de la capacité de désendettement — loi n° 2018-32 du
        22 janvier 2018 de programmation des finances publiques pour 2018-2022,
        art. 29 : douze années pour les communes et les intercommunalités à
        fiscalité propre, dix pour les départements, neuf pour les régions. Les
        autres rapports n'ont pas de norme publiée et n'en portent aucune ; ils se
        lisent en comparant les territoires.</li>
      <li>Une <strong>épargne brute nulle ou négative</strong> ne donne pas une
        capacité de désendettement très grande : elle n'en donne aucune. Le
        quotient n'existe pas, et le site l'écrit plutôt que d'afficher un nombre
        d'années négatif.</li>
      <li>Chaque palier de l'enchaînement (épargne brute, épargne nette, solde)
        est <strong>recalculé depuis ses termes puis confronté à l'agrégat publié</strong>
        pour ce même palier. Si l'un des trois contrôles échoue, l'enchaînement
        n'est pas affiché du tout.</li>
      <li>La dernière ligne de l'enchaînement <strong>n'est pas un déficit</strong> au
        sens de l'État. Une collectivité vote sa section de fonctionnement en
        équilibre : c'est l'écart entre tout ce qui est entré et tout ce qui est
        sorti sur l'exercice.</li>
      <li>La dette par habitant se divise par la <strong>population de référence de
        l'OFGL</strong> de l'exercice, et non par la population municipale du
        recensement affichée en tête de fiche : deux définitions, deux
        millésimes, deux nombres.</li>
    </ul>
    <h3 class="sources__titre">Ce qui rend deux territoires comparables</h3>
    <ul class="methodes">
      <li>Comparer deux territoires suppose la même année, la même unité et le
        même périmètre budgétaire.</li>
      <li>Les repères sont la médiane des territoires de même niveau : la moitié
        se situe en dessous. « Communes de la région » désigne l'ensemble des
        communes de cette région, jamais le budget du conseil régional, qui est
        une autre collectivité aux autres compétences.</li>
      <li>Le groupe de « communes semblables » est constitué sur les critères
        publiés par l'Observatoire des finances locales : strate de population,
        caractère rural, outre-mer, montagne, tourisme. Une position basse ne
        signifie pas une meilleure gestion : le premier facteur d'écart est
        l'intercommunalité — dans une métropole intégrée, la voirie, les déchets
        ou l'urbanisme sont payés par l'intercommunalité et n'apparaissent pas
        dans le budget communal.</li>
      <li>Les communes nouvelles portent l'historique de leurs communes
        d'origine, additionné sous le code actuel.</li>
      <li>Un établissement public territorial est inclus dans la Métropole du
        Grand Paris : ne pas additionner les deux.</li>
      <li>Les montants par habitant utilisent la population de référence de
        l'Observatoire des finances locales de l'exercice concerné, afin que
        nos ratios reproduisent exactement les siens.</li>
      <li>Un budget voté n'est pas une dépense réalisée : les montants publiés
        ici sont ceux des comptes exécutés. Les masses de la fiche consolident
        budgets principaux et annexes ; les six rapports et l'enchaînement,
        eux, portent sur le seul budget principal.</li>
      <li>Les évolutions « en euros constants » utilisent l'indice des prix
        national : il ne dit pas ce que les prix ont fait dans chaque
        territoire.</li>
      <li>Le trait vertical des courbes marque la prise de fonctions du maire.
        Un budget se décide à plusieurs niveaux et se paie sur plusieurs
        années : ce repère situe, il n'explique pas.</li>
    </ul>`;

  // La méthode des agrégats nationaux se charge à part elle aussi : absente,
  // aucune mention n'est faite — plutôt qu'une mention fausse.
  donnees
    .agregatsNationaux()
    .then((a) => {
      agregats = a;
      if (etat.selection) void montrerFiche(etat.selection);
    })
    .catch(() => {});

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
      parents = {
        ...enrichir(dep as Record<string, Territoire>, "departement"),
        ...enrichir(reg as Record<string, Territoire>, "region"),
        ...enrichir(pays as Record<string, Territoire>, "pays"),
      };
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
