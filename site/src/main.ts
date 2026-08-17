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
import { libelleTheme, THEMES } from "./themes.ts";
import { echapper, emphase } from "./texte.ts";
import type { Indicateur, Jeu, Territoire } from "./donnees.ts";
import { afficherFiche, NIVEAUX, ORDRE_THEMES, rubriqueDuTheme } from "./fiche.ts";
import { carteFiche, type ChiffreCarte } from "./carte-og.ts";
import { OUVERTURE, reperes as reperesDOuverture } from "./reperes.ts";
import { EPARGNE, RECETTES, noteDepuisCouches } from "./note.ts";
import { afficherAnalyses, rubriques } from "./analyses.ts";
import { afficherBudgetEtat, exercicesDisponibles } from "./etat.ts";
import { indexer, type Budget } from "./simulateur.ts";
import {
  afficherAtelier,
  exercicesPublies,
} from "./simulateur-rendu.ts";
import {
  decoder,
  effort as effortAtelier,
  gestes as gestesAtelier,
  plan,
  type Volet,
} from "./atelier.ts";
import { apercuScenario } from "./apercu-scenario.ts";
import {
  offrir,
  partageAnalyse,
  partageFiche,
  partageComparaison,
  partageScenario,
  permalien,
  resume,
  type Canaux,
  type Forme,
  type Issue,
  type Partage,
} from "./partage.ts";
import {
  citable,
  citer,
  offrirCitation,
  type Citation,
  type IssueCitation,
  type Presse,
} from "./citer.ts";
import { BRANCHES, fusionnerBranches, ECHELONS } from "./simulateur-volets.ts";
import { lister as listerScenarios, enregistrer as enregistrerScenario, renommer as renommerScenario, dupliquer as dupliquerScenario, supprimer as supprimerScenario, nomNettoye, transposer, transposerBudget, type Depot, type Scenario } from "./scenarios.ts";
import { comparer as comparerScenarios } from "./comparaison.ts";
import { renduBarre, renduComparaison, renduDisparues, type Comparable } from "./scenarios-rendu.ts";
import { appliquer as appliquerBareme, MODELES as MODELES_BAREME } from "./bareme.ts";
import { afficherCentEuros } from "./cent-euros.ts";
import { afficherQuestions } from "./questions.ts";
import { afficherRecapitulatif } from "./recapitulatif.ts";
import { afficherComparateur, type Entree, MAXIMUM } from "./comparateur.ts";
import {
  enCsv, enCsvEvolution, nomDeFichier, sourceDuNiveau, telecharger,
  type LigneExport, type LigneExportEvolution,
} from "./export.ts";
import {
  coucheEvolution,
  echelleDivergente,
  formaterVariation,
  libelleEvolution,
  modeVariation,
  noteEvolution,
  type Evolution,
  type ModeVariation,
} from "./evolution-carte.ts";
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
import { ouvrirRepertoire, populationsDuRepertoire, type Repertoire } from "./repertoire.ts";
import { situation, rendreSituation } from "./situation.ts";
import { creerGarde } from "./garde-geste.ts";
import { creerFile, squeletteFiche } from "./chargement.ts";
import { filtrer, rendreSommaire, type EntreeSommaire } from "./sommaire.ts";
import { adresseTerritoire, cheminDeVue, estAccueil, vueDepuisAdresse } from "./routes.ts";
import {
  rendu as renduAccueil,
  exemplesTerritoires,
  MAILLE_EXEMPLE,
} from "./accueil.ts";
import { carteRetenue, type Analyse } from "./analyse-rendu.ts";
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
/** Ce que le tableau montre, quand il ne montre pas tout : « 100 premiers
 *  territoires » s'affichait au-dessus de dix-sept lignes. */
function fenetreDuTableau(total: number): string {
  return total > 100 ? ` · 100 premiers territoires sur ${total.toLocaleString("fr-FR")}` : "";
}

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
  /** Ce que la carte peint : le dernier niveau publié, ou l'évolution entre
   *  les deux derniers millésimes. « evolution » n'est possible que si
   *  l'indicateur a au moins deux périodes à la maille affichée. */
  mode: string;
  selection: string | null;
  comparaison: string[];
  vue: string;
  /** Les deux vitesses de la fiche : « essentiel » (le récit, le verdict, les
   *  questions) ou « tout » (la fiche entière, thème par thème). Dans l'URL
   *  comme le reste : une fiche ouverte en grand se partage telle quelle. */
  voir: "essentiel" | "tout";
  /** Le budget réglé par le lecteur dans le simulateur, encodé
   *  `CODE:pct,CODE:pct`. Vide tant qu'aucune ligne n'est touchée : l'URL ne
   *  porte alors pas le paramètre du tout, comme pour `comparer`. */
  budget: string;
  /** Le contrat signé dans le simulateur. Il part dans l'adresse avec les
   *  réglages : un budget partagé sans sa contrainte se lit comme un exploit
   *  alors que c'en était un sous serment. */
  contrat: string;
  /** Le nom du scénario ouvert, quand l'état affiché en est un. Vide pour un
   *  état vif, jamais enregistré : c'est ce qui marque le scénario courant
   *  dans la barre, et ce qui retrouve son exercice — voir `Comparable`
   *  (scenarios-rendu.ts) — plutôt que celui de l'atelier au moment présent. */
  nom: string;
  /** Le budget d'une seconde colonne, encodé comme `budget`. Il peut être
   *  vide sans que la comparaison le soit : le budget voté est l'atelier tous
   *  réglages à zéro, et un scénario que le lecteur enregistre sans avoir rien
   *  réglé l'est aussi. C'est le CHOIX d'une face qui ouvre la comparaison —
   *  `faceChoisie()` —, jamais un budget non vide. Un mode, pas un chemin
   *  `/simulateur/comparer` (qui résoudrait de toute façon sur `simulateur`,
   *  `routes.ts` ne lisant que le premier segment) : pas d'entrée de menu vers
   *  un écran qui n'a de sens qu'à deux scénarios en main. */
  face: string;
  /** Le nom affiché en tête de la colonne `face` : celui du scénario dont
   *  elle vient, faute de mieux un intitulé générique. */
  faceNom: string;
  /** L'exercice sur lequel la colonne `face` a été construite, porté par
   *  l'adresse comme `face` et `face-nom` : sans lui, un lien partagé ouvert
   *  chez un lecteur qui n'a pas ce scénario en local n'a aucun moyen de
   *  savoir sur quel millésime il a été bâti — voir `colonnesComparaison`. */
  faceExercice: string;
  /** D'où vient la colonne `face` : `"scenario"` pour le dépôt local,
   *  `"reference:<slug>"` pour une entrée du fichier de référence (le slug
   *  vide désignant le budget voté, qui n'en a pas). Le menu connaît cette
   *  origine au moment du clic ; sans elle dans l'adresse, il fallait la
   *  redeviner à partir du seul nom, et un homonyme local emportait alors
   *  l'exercice, le serment et le lien d'une entrée de référence — l'en-tête
   *  annonçait un millésime et un serment que la colonne n'avait pas.
   *
   *  Vide pour un lien antérieur à ce paramètre : le dépôt local passe alors
   *  en premier, faute de mieux, et c'est le seul cas où deviner reste la
   *  moins mauvaise réponse. */
  faceSource: string;
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let carte: maplibregl.Map;
let catalogue: Indicateur[] = [];
let jeux: Jeu[] = [];
let etat: Etat;
let populations: Record<string, number> = {};
let entites: Record<string, Territoire> = {};
let groupes: donnees.Comparaisons | null = null;
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
/** La couche d'évolution affichée, quand c'en est une : la variation peinte,
 *  mais aussi les deux valeurs dont elle vient — l'infobulle montre les
 *  trois. `null` = la carte montre un niveau. */
let evolutionAffichee: {
  couche: Record<string, Evolution>;
  mode: ModeVariation;
  avant: string;
} | null = null;
let survole: string | null = null;
/** Ce que le bouton d'export téléchargera : toutes les lignes de la couche
 *  affichée, pas les 100 que montre le tableau, avec la déclinaison qui a
 *  servi à les calculer. */
let exportCourant: { lignes: LigneExport[]; parHabitant: boolean } = {
  lignes: [],
  parHabitant: false,
};
/** En mode évolution, l'export emporte les deux millésimes et la variation :
 *  non nul seulement quand c'est la couche affichée. */
let exportEvolution: { lignes: LigneExportEvolution[]; avant: string } | null = null;
/** Le clic de compatibilité qui suit un geste sur la poignée du tiroir : il
 *  part vers la carte, qui vient d'apparaître sous le doigt. Voir
 *  `garde-geste.ts` pour le mécanisme. */
const gardePoignee = creerGarde();
/** Une ouverture de fiche à la fois : le double-clic ne relance rien, et un
 *  ticket périmé n'écrit plus. */
const fileOuverture = creerFile();

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
    // Repli silencieux sur le niveau si l'indicateur n'a qu'un millésime à
    // cette maille : `construireSelecteurs` tranche, l'URL propose.
    mode: p.get("mode") === "evolution" ? "evolution" : "niveau",
    selection: p.get("territoire"),
    comparaison: (p.get("comparer") ?? "").split(",").filter(Boolean).slice(0, MAXIMUM),
    vue: p.get("vue") ?? "metropole",
    // L'essentiel par défaut : c'est la fiche que le lecteur qui arrive doit
    // trouver. Une valeur inconnue y retombe plutôt que d'ouvrir un mode qui
    // n'existe pas — même règle que pour la maille.
    voir: p.get("voir") === "tout" ? "tout" : "essentiel",
    budget: p.get("budget") ?? "",
    contrat: p.get("contrat") ?? "",
    nom: p.get("nom") ?? "",
    face: p.get("face") ?? "",
    faceNom: p.get("face-nom") ?? "",
    faceExercice: p.get("face-exercice") ?? "",
    faceSource: p.get("face-source") ?? "",
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
  if (etat.mode === "evolution") p.set("mode", "evolution");
  if (etat.selection) p.set("territoire", etat.selection);
  if (etat.maille) p.set("maille", etat.maille);
  if (etat.comparaison.length) p.set("comparer", etat.comparaison.join(","));
  if (etat.voir === "tout") p.set("voir", "tout");
  if (etat.budget) p.set("budget", etat.budget);
  if (etat.contrat) p.set("contrat", etat.contrat);
  if (etat.nom) p.set("nom", etat.nom);
  if (etat.face) p.set("face", etat.face);
  if (etat.faceNom) p.set("face-nom", etat.faceNom);
  if (etat.faceExercice) p.set("face-exercice", etat.faceExercice);
  if (etat.faceSource) p.set("face-source", etat.faceSource);
  // Le chemin porte la vue, le fragment l'ancre interne : réécrire l'adresse
  // sans le chemin renverrait le lecteur du simulateur à la carte au premier
  // réglage.
  history.replaceState(null, "", `${location.pathname}?${p}${location.hash}`);
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
  // Même clé composite que `parents`, et pour la même raison : « 75 » est un
  // département et une région, et la table en accumule plusieurs mailles.
  entites = { ...entites, ...cleParMaille(paquet, niveau) };
  recalculerPopulations();
}

/**
 * L'index de la maille peinte : noms et dénominateurs, sans les séries.
 *
 * Peindre une couche « par habitant » ne demandait que deux champs par
 * territoire — le nom et la population de référence de l'exercice — et les
 * faisait chercher dans les cent un lots départementaux, soit des centaines de
 * mégaoctets de séries complètes analysées pour les jeter. `index.json` porte
 * ces deux champs, et rien d'autre.
 *
 * `null` tant qu'il n'est pas chargé, ou quand la publication servie est
 * antérieure à ce fichier : le site retombe alors sur les lots (voir
 * `chargerIndex`).
 */
let repertoire: Repertoire | null = null;

/** Charge l'index de la maille, une fois. Rend `false` quand la publication
 *  servie n'en a pas : l'appelant retombe alors sur les lots (voir
 *  `ouvrirRepertoire`). */
async function chargerIndex(niveau: string): Promise<boolean> {
  if (repertoire?.niveau === niveau) return true;
  repertoire = await ouvrirRepertoire(niveau, donnees.indexTerritoires);
  return repertoire !== null;
}

/** Le nom d'un territoire de la maille peinte : l'index s'il est là, le lot
 *  déjà chargé sinon, le code en dernier ressort — une colonne ne reste
 *  jamais vide. */
function nomDe(code: string): string {
  return repertoire?.noms[code] ?? entiteDe(code, etat.niveau)?.nom ?? code;
}

/** Les dénominateurs suivent l'exercice affiché : une dépense de 2022 se
 *  rapporte aux habitants de 2022, pas à ceux d'aujourd'hui. Recalculé à chaque
 *  chargement et à chaque changement de période, pour que la carte, le tableau
 *  et la fiche divisent tous par le même nombre. */
function recalculerPopulations(): void {
  // L'index couvre toute la maille peinte : les lots n'ont rien à y ajouter.
  if (repertoire?.niveau === etat.niveau) {
    populations = populationsDuRepertoire(repertoire.index, etat.periode);
    return;
  }
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
function majLegende(
  echelle: ReturnType<typeof quantiles>,
  parHabitant: boolean,
  evolution?: { avant: string; mode: ModeVariation },
): void {
  const indicateur = indicateurCourant();
  $("legende").hidden = false;
  $("legende-titre").textContent = traduire(indicateur.libelle);
  const bornes = [...echelle.bornes];
  // En mode évolution, les bornes sont des variations : signées, et en points
  // pour un taux — les formater en niveaux ferait mentir la légende.
  const lisible = evolution
    ? (v: number) => formaterVariation(v, indicateur.unite, evolution.mode)
    : (v: number) => formater(v, indicateur.unite, parHabitant);
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
  // La légende dit ce qu'elle montre : un millésime, ou « Évolution 2024 vs
  // 2023, en % » — sans quoi une carte de variations se lirait comme une
  // carte de niveaux.
  const titrePeriode = evolution
    ? libelleEvolution(evolution.avant, etat.periode, evolution.mode)
    : `${etat.periode}${parHabitant ? " · par hab." : ""}`;
  $("legende-bornes").innerHTML = `<span>${
    bornes.length ? `&lt; ${lisible(bornes[0])}` : ""
  }</span><span>${titrePeriode}</span><span>${
    bornes.length ? `&gt; ${lisible(bornes[bornes.length - 1])}` : ""
  }</span>`;
  $("legende-note").textContent = evolution
    ? noteEvolution(evolution.mode, parHabitant)
    : noteEchelle(indicateur.unite, parHabitant);
  // La pastille repliée : les mêmes couleurs, en dégradé, sur deux centimètres.
  // Elle suffit à lire la carte — foncé, beaucoup ; clair, peu — sans rien
  // recouvrir. Le détail attend le clic.
  $("legende-vignette").style.background = `linear-gradient(to bottom, ${echelle.couleurs.join(
    ", ",
  )})`;
  $("legende").title = `Légende : ${traduire(indicateur.libelle)}`;
}

function majTableau(valeurs: Record<string, number>, parHabitant: boolean): void {
  // Le tableau vivait dans la vue DONNÉES, retirée : sans conteneur, il n'y a
  // rien à peindre, et `$` rend `null` plutôt que de lever.
  if (!document.getElementById("tableau-donnees")) return;
  const indicateur = indicateurCourant();
  const toutes = Object.entries(valeurs)
    .map(([code, brut]) => {
      const population = populations[code];
      const valeur = parHabitant && population ? brut / population : brut;
      return { code, nom: nomDe(code), valeur, calculable: !parHabitant || !!population };
    })
    .filter((l) => l.calculable)
    .sort((a, b) => b.valeur - a.valeur);

  // Le tableau montre les 100 premiers ; l'export, lui, emporte tout : un
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
    <caption>${traduire(indicateur.libelle)}, ${etat.periode}${parHabitant ? ", par habitant" : ""}${fenetreDuTableau(toutes.length)}</caption>
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

/** Le tableau et l'export suivent la couche affichée : en mode évolution, les
 *  deux millésimes et la variation — un classement de variations sans les
 *  valeurs dont elles viennent ne se vérifierait pas. */
function majTableauEvolution(
  couche: Record<string, Evolution>,
  mode: ModeVariation,
  periodePrecedente: string,
  parHabitant: boolean,
): void {
  if (!document.getElementById("tableau-donnees")) return;
  const indicateur = indicateurCourant();
  const toutes = Object.entries(couche)
    .map(([code, e]) => ({ code, nom: nomDe(code), ...e }))
    .sort((a, b) => b.variation - a.variation);

  exportEvolution = {
    lignes: toutes.map(({ code, nom, avant, apres, variation }) => ({
      code, nom, avant, apres, variation,
    })),
    avant: periodePrecedente,
  };
  const exporter = $<HTMLButtonElement>("exporter");
  exporter.hidden = toutes.length === 0;
  exporter.textContent = `Télécharger en CSV (${toutes.length.toLocaleString("fr-FR")} territoire${
    toutes.length > 1 ? "s" : ""
  })`;

  const lignes = toutes.slice(0, 100);
  const lisible = (v: number) => formater(v, indicateur.unite, parHabitant);
  $("tableau-donnees").innerHTML = `
    <caption>${traduire(indicateur.libelle)}, évolution ${etat.periode} vs ${periodePrecedente}${
      parHabitant ? ", par habitant" : ""
    }${fenetreDuTableau(toutes.length)}</caption>
    <thead><tr><th scope="col">Territoire</th><th scope="col">Code</th><th scope="col">${periodePrecedente}</th><th scope="col">${etat.periode}</th><th scope="col">Variation</th></tr></thead>
    <tbody>${lignes
      .map(
        (l) =>
          `<tr><td>${l.nom}</td><td>${l.code}</td><td>${lisible(l.avant)}</td><td>${lisible(
            l.apres,
          )}</td><td>${formaterVariation(l.variation, indicateur.unite, mode, true)}</td></tr>`,
      )
      .join("")}</tbody>`;
}

/** Montre la couche de la maille affichée et lui applique sa couleur. */
function appliquerCouche(expression: unknown): void {
  for (const [niveau, couche] of Object.entries(COUCHES)) {
    const visible = niveau === etat.niveau;
    carte.setLayoutProperty(`remplissage-${couche}`, "visibility", visible ? "visible" : "none");
    carte.setLayoutProperty(`contour-${couche}`, "visibility", visible ? "visible" : "none");
  }
  carte.setPaintProperty(`remplissage-${COUCHES[etat.niveau]}`, "fill-color", expression as never);
}

/**
 * Peint la variation entre les deux derniers millésimes publiés à cette
 * maille. Calculée sur la déclinaison affichée : la variation d'un montant
 * par habitant n'est pas celle du montant brut — la population bouge aussi —
 * et chaque millésime se divise par SA population de référence.
 */
async function peindreEvolution(
  valeurs: Record<string, number>,
  periodePrecedente: string,
  parHabitant: boolean,
): Promise<void> {
  const indicateur = indicateurCourant();
  const mode = modeVariation(indicateur.unite);
  const precedentes = await donnees.valeursCarte(etat.indicateur, etat.niveau, periodePrecedente);
  const decliner = (bruts: Record<string, number>, periode: string): Record<string, number> => {
    if (!parHabitant) return bruts;
    // L'index porte le dénominateur de chaque exercice : c'est lui qui sert
    // quand il est là, les séries des lots sinon.
    const denominateurs =
      repertoire?.niveau === etat.niveau
        ? populationsDuRepertoire(repertoire.index, periode)
        : null;
    const sortie: Record<string, number> = {};
    for (const [code, brut] of Object.entries(bruts)) {
      const entite = entiteDe(code, etat.niveau);
      const population = denominateurs
        ? denominateurs[code]
        : entite
          ? populationDeReference(entite, periode).valeur
          : null;
      if (population) sortie[code] = brut / population; // pas de dénominateur, pas de ratio
    }
    return sortie;
  };
  const couche = coucheEvolution(
    decliner(precedentes, periodePrecedente),
    decliner(valeurs, etat.periode),
    mode,
  );
  const variations = Object.fromEntries(
    Object.entries(couche).map(([code, e]) => [code, e.variation]),
  );
  const echelle = echelleDivergente(Object.values(variations));
  // Les variations sont déjà déclinées : pas de division supplémentaire ici.
  appliquerCouche(expressionCouleur(variations, echelle, false, {}));

  majLegende(echelle, parHabitant, { avant: periodePrecedente, mode });
  majTableauEvolution(couche, mode, periodePrecedente, parHabitant);
  planifierEtiquettes();

  affichees = variations;
  parHabitantAffiche = parHabitant;
  brutes = valeurs;
  evolutionAffichee = { couche, mode, avant: periodePrecedente };
}

async function peindre(): Promise<void> {
  const parHabitant = etat.declinaison === "habitant" && parHabitantAUnSens(indicateurCourant());
  const valeurs = await donnees.valeursCarte(etat.indicateur, etat.niveau, etat.periode);
  // Noms et dénominateurs suffisent à peindre : l'index de la maille les porte
  // tous les deux. Les lots ne sont rappelés que si la publication servie est
  // antérieure à ce fichier.
  if (!(await chargerIndex(etat.niveau))) {
    await chargerLotsNecessaires(etat.niveau, Object.keys(valeurs));
  }
  recalculerPopulations(); // la période a pu changer depuis le dernier chargement

  const periodes = periodesDuNiveau();
  if (etat.mode === "evolution" && periodes.length >= 2) {
    await peindreEvolution(valeurs, periodes[1], parHabitant);
  } else {
    evolutionAffichee = null;
    exportEvolution = null;

    const echantillon = Object.entries(valeurs)
      .map(([code, brut]) => (parHabitant ? brut / (populations[code] ?? NaN) : brut))
      .filter(Number.isFinite);
    const echelle = quantiles(echantillon);

    appliquerCouche(expressionCouleur(valeurs, echelle, parHabitant, populations));

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
  }

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

/** Les territoires d'une maille, indexés par « maille:code ».
 *
 *  Le code seul ne désigne pas un territoire : quatorze départements portent un
 *  code qui est aussi un code de région. C'est la paire qui est unique. */
function cleParMaille(
  entites: Record<string, Territoire>,
  niveau: string,
): Record<string, Territoire> {
  const enrichis = enrichir(entites, niveau);
  return Object.fromEntries(Object.entries(enrichis).map(([code, t]) => [`${niveau}:${code}`, t]));
}

/** Le territoire d'un code dans une maille déjà chargée. */
function entiteDe(code: string, niveau: string): Territoire | undefined {
  return entites[`${niveau}:${code}`];
}

/** Le territoire d'un code, dans la maille où on le cherche. */
function parentDe(code: string | null | undefined, niveau: string): Territoire | undefined {
  return code ? parents[`${niveau}:${code}`] : undefined;
}

function indicateursDeLaFiche(niveau: string): Indicateur[] {
  return catalogue.filter((i) => i.niveaux?.includes(niveau) && !DENOMINATEURS.has(i.id));
}

/**
 * Tant que rien n'est sélectionné, le panneau montre **la France**.
 *
 * Il montrait jusqu'ici la dispersion de la couche affichée — médiane, quartiles
 * — c'est-à-dire une statistique sur des territoires plutôt qu'un territoire.
 * À l'ouverture du site, la bonne réponse à « où va l'argent public ? » est le
 * niveau national : dette, solde budgétaire, dépenses de l'État, comparaisons
 * européennes. On descend ensuite dans le détail en cliquant.
 *
 * Le résumé de couche qui tenait la place — minimum, médiane, quartiles,
 * total — est retiré : c'était une statistique sur des territoires, et c'est
 * ce qu'on lisait en arrivant sur le site. La maille pays est demandée dès
 * l'ouverture (`chargerFrance`) ; le temps qu'elle arrive, le panneau reste
 * vide plutôt que de montrer autre chose que la France.
 */
function afficherApercu(): void {
  const france = parentDe("FR", "pays");
  const nationaux = indicateursDeLaFiche("pays");
  if (!france || !nationaux.length) {
    void chargerFrance();
    return;
  }
  afficherFiche($("fiche"), {
    niveau: "pays",
    territoire: france,
    indicateurs: nationaux,
    comparateurs: [],
  });
  poserPartageDeLaFiche("pays", "FR", france);
  appliquerVitesse();
}

/** La France du panneau d'accueil, demandée une seule fois et le plus tôt
 *  possible : elle ne dépend ni de la carte ni de la maille peinte, et c'est
 *  la première chose que le site doit montrer. */
let franceDemandee: Promise<void> | null = null;
function chargerFrance(): Promise<void> {
  franceDemandee ??= donnees
    .territoires("pays", "tous")
    .then((pays) => {
      parents = { ...parents, ...cleParMaille(pays as Record<string, Territoire>, "pays") };
      if (!etat.selection) afficherApercu();
    })
    .catch(() => {
      // Pas de maille pays publiée : le panneau reste vide jusqu'au premier clic.
    });
  return franceDemandee;
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
    const nom =
      repertoire?.noms[code] ??
      entiteDe(code, etat.niveau)?.nom ??
      (figure.properties?.nom as string | undefined);
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
  // Carte déployée, elle n'est plus un fond d'écran sur lequel la fiche
  // flotte : c'est un bloc de la colonne de lecture, et rien ne la recouvre.
  // Lui réserver les 760 px du panneau poussait la France dans le tiers gauche
  // du cadre, avec un grand vide à droite pour un panneau qui n'y est plus.
  // Les commandes sont en haut du cadre, la légende en bas à gauche : c'est
  // le haut qui se réserve.
  if (document.body.dataset.carte === "oui") {
    return { top: 56, bottom: 32, left: 24, right: 24 };
  }
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
  const territoire = entiteDe(code, niveau);
  if (!territoire) return;
  etat.selection = code;
  ecrireUrl();
  afficherFiche($("fiche"), {
    niveau,
    territoire,
    // Tous les thèmes, plus seulement celui de la carte : le panneau est
    // désormais le seul endroit où l'on choisit — il doit tout montrer.
    // Filtré sur le niveau : afficher « donnée non disponible » pour un
    // indicateur qui n'existe pas à ce niveau ferait passer une absence de
    // définition pour une absence de mesure.
    indicateurs: indicateursDeLaFiche(niveau),
    // De quoi comparer, même pour les jeux sous secret de diffusion où
    // aucune médiane communale n'est publiable : la valeur du département,
    // celle de la région, celle de la France. Ce sont des chiffres publiés,
    // pas des estimations.
    comparateurs:
      niveau === "commune"
        ? [
            parentDe(territoire.parent, "departement")
              ? { libelle: "son département", territoire: parentDe(territoire.parent, "departement")! }
              : null,
            parentDe(territoire.region, "region")
              ? { libelle: "sa région", territoire: parentDe(territoire.region, "region")! }
              : null,
            parentDe("FR", "pays") ? { libelle: "la France", territoire: parentDe("FR", "pays")! } : null,
          ].filter(Boolean as unknown as (x: unknown) => boolean) as {
            libelle: string;
            territoire: Territoire;
          }[]
        : niveau === "departement"
          ? [
              parentDe(territoire.region, "region")
                ? { libelle: "sa région", territoire: parentDe(territoire.region, "region")! }
                : null,
              parentDe("FR", "pays") ? { libelle: "la France", territoire: parentDe("FR", "pays")! } : null,
            ].filter(Boolean as unknown as (x: unknown) => boolean) as {
              libelle: string;
              territoire: Territoire;
            }[]
          : parentDe("FR", "pays")
            ? [{ libelle: "la France", territoire: parentDe("FR", "pays")! }]
            : [],
  });
  poserPartageDeLaFiche(niveau, code, territoire);
  $("panneau").classList.add("panneau--selection");
  majEtatTiroir();
  injecterActionsFiche();
  appliquerVitesse();
  void poserSituation(code, niveau);
}

/**
 * « Où ça se situe » : le rang du territoire dans sa maille.
 *
 * Posé après la fiche, et pas dedans : un rang demande les valeurs de **tous**
 * les territoires de la maille, soit quatre couches de carte et l'index des
 * dénominateurs. Faire attendre la fiche pour cela reviendrait à retarder les
 * quatre blocs pour trois lignes.
 *
 * Le code de la fiche est passé en argument et revérifié à l'arrivée : entre la
 * demande et la réponse, le lecteur a pu ouvrir un autre territoire, et poser
 * le rang de l'ancien sous la fiche du nouveau serait pire que ne rien poser.
 */
/** Les mailles où un rang a un sens : la France n'a personne à qui se comparer,
 *  et un arrondissement municipal n'a pas de couche à lui. */
const MAILLES_CLASSEES = new Set(["commune", "departement", "region"]);

/** Le dernier exercice que la maille publie sur les comptes OFGL. Lu au
 *  catalogue, comme partout : l'historique communal est plus court que celui
 *  des régions, et viser une année sans couche mènerait à un fichier absent. */
function dernierExerciceOfgl(niveau: string): string | undefined {
  const comptes = catalogue.find((i) => i.id === "ofgl_depenses_fonctionnement");
  const annees = comptes?.periodes_par_niveau?.[niveau] ?? comptes?.periodes ?? [];
  return [...annees].sort().pop();
}

/** Le verbe dit ce que fait un territoire mieux classé. « De la plus élevée à
 *  la plus faible » demandait de tenir le fil jusqu'au rang pour savoir si l'on
 *  dépense beaucoup ou peu. */
const CLASSEMENTS: {
  id: string;
  libelle: string;
  dessus: string;
  dessous: string;
  parHabitant: boolean;
}[] = [
  {
    id: "ofgl_depenses_fonctionnement",
    libelle: "Dépenses de fonctionnement par habitant",
    dessus: "dépensent plus",
    dessous: "dépensent moins",
    parHabitant: true,
  },
  {
    id: "ofgl_recettes_fonctionnement",
    libelle: "Recettes de fonctionnement par habitant",
    dessus: "encaissent plus",
    dessous: "encaissent moins",
    parHabitant: true,
  },
  {
    id: "ofgl_encours_dette",
    libelle: "Encours de dette par habitant",
    dessus: "doivent plus",
    dessous: "doivent moins",
    parHabitant: true,
  },
];

const EUROS_HABITANT = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const ANNEES = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

async function poserSituation(code: string, niveau: string): Promise<void> {
  const cible = document.getElementById("fiche-situation");
  if (!cible || !MAILLES_CLASSEES.has(niveau)) return;
  const exercice = dernierExerciceOfgl(niveau);
  if (!exercice) return;
  try {
    const [index, ...couches] = await Promise.all([
      donnees.indexTerritoires(niveau),
      ...CLASSEMENTS.map((c) => donnees.valeursCarte(c.id, niveau, exercice)),
      donnees.valeursCarte("ofgl_epargne_brute", niveau, exercice),
    ]);
    // Les deux couches d'ouverture, pour le terme de trajectoire de la note.
    // Elles sont demandées à part et sans faire échouer le reste : un exercice
    // 2019 absent d'une maille vaut « pas de trajectoire », ce que la note sait
    // déjà traiter — pas « pas de classement ».
    const [recettesAvant, epargneAvant] = await Promise.all([
      donnees.valeursCarte(RECETTES, niveau, OUVERTURE).catch(() => ({}) as Record<string, number>),
      donnees.valeursCarte(EPARGNE, niveau, OUVERTURE).catch(() => ({}) as Record<string, number>),
    ]);
    if (etat.selection !== code || document.getElementById("fiche-situation") !== cible) return;
    if (etat.selection !== code || document.getElementById("fiche-situation") !== cible) return;
    const habitants = populationsDuRepertoire(index, exercice);
    const dette = couches[CLASSEMENTS.length - 1];
    const epargne = couches[CLASSEMENTS.length];
    const criteres = CLASSEMENTS.map((c, rang) => ({
      libelle: c.libelle,
      dessus: c.dessus,
      dessous: c.dessous,
      ecrire: (v: number) => EUROS_HABITANT.format(v),
      // Un encours négatif n'est pas une dette : la commune est créditrice, et
      // « −45 € par habitant » se glissait en bas d'un classement de dettes où
      // il ne veut rien dire.
      valeur: (t: string) => {
        const brut = couches[rang][t];
        if (brut === undefined || brut < 0) return null;
        if (!c.parHabitant) return brut;
        return habitants[t] ? brut / habitants[t] : null;
      },
    }));
    // La capacité de désendettement se calcule, elle n'est pas publiée en
    // couche : la dette sur l'épargne, et rien quand l'épargne est nulle ou
    // négative — ce n'est pas un remboursement infiniment long, c'est un
    // remboursement impossible à ce rythme (`derives.ts`).
    criteres.push({
      libelle: "Capacité de désendettement",
      dessus: "mettraient plus longtemps",
      dessous: "mettraient moins longtemps",
      ecrire: (v: number) => `${ANNEES.format(v)} ans`,
      // Une dette nulle ou négative n'a pas de durée de remboursement : le
      // rapport y devient négatif — « −0,2 an » — et se glisse en bas d'un
      // classement où il ne veut rien dire.
      valeur: (t: string) =>
        dette[t] > 0 && epargne[t] > 0 ? dette[t] / epargne[t] : null,
    });
    // **La note de gestion, en tête du classement.** Elle est la question que
    // le lecteur pose — « est-ce que ma commune est bien gérée » —, et les
    // quatre critères au-dessus sont les mesures dont elle sort. Sans elle, la
    // fiche disait la note et le classement ne savait pas la situer.
    //
    // Le barème n'est pas recalculé ici : `noteDepuisCouches` recompose la
    // forme que `note()` attend, pour que les deux écrans ne puissent pas
    // afficher deux notes différentes du même territoire.
    const recettes = couches[1];
    criteres.unshift({
      libelle: "Note de gestion",
      // **Un verbe, jamais un participe.** Le sujet change avec la maille —
      // « communes » et « régions » au féminin, « départements » au masculin —
      // et « 27 887 communes sont mieux notés » se lisait comme une faute. Les
      // quatre critères au-dessus emploient des verbes pleins pour cette
      // raison exacte : « dépensent plus », « doivent moins ».
      dessus: "ont une meilleure note",
      dessous: "ont une note plus basse",
      ecrire: (v: number) =>
        `${v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/20`,
      valeur: (t: string) =>
        noteDepuisCouches(
          {
            recettes: recettes[t],
            epargne: epargne[t],
            dette: dette[t],
            recettesAvant: recettesAvant[t],
            epargneAvant: epargneAvant[t],
          },
          exercice,
          niveau,
        )?.valeur ?? null,
    });
    const noms: Record<string, string> = {};
    index.codes.forEach((t, rang) => {
      noms[t] = index.noms[rang] ?? t;
    });
    cible.innerHTML = rendreSituation(
      situation({ code, codes: index.codes, noms, criteres }),
      niveau,
      exercice,
    );
    // Un rang appelle « et les autres ? ». Chaque place du pli ouvre la fiche
    // du territoire, à la maille où le classement a été calculé.
    cible.addEventListener("click", (evenement) => {
      const place = (evenement.target as HTMLElement).closest<HTMLElement>("[data-territoire]");
      if (place?.dataset.territoire) void ouvrirTerritoire(place.dataset.territoire, niveau);
    });
  } catch {
    // Une couche manque à cette maille ou à cet exercice : la fiche s'arrête au
    // tableau des exercices, sans dire ce qu'elle n'a pas pu calculer.
  }
}

/**
 * Les deux vitesses, appliquées au conteneur de la fiche.
 *
 * `fiche.ts` rend les deux corps et marque chacun d'un `data-vitesse` ; c'est
 * cette classe-ci qui décide lequel se voit. La bascule ne redessine donc rien
 * — cent quarante lignes de mesures, courbes et mini-tableaux compris, ne se
 * recalculent pas pour un changement d'affichage.
 */
function appliquerVitesse(): void {
  const fiche = $("fiche");
  // Une fiche sans bascule n'a pas de mode : lui poser « fiche--essentiel »
  // masquerait ses barres d'onglets, qui sont tout ce qu'elle a pour naviguer.
  // C'est le cas de la fiche nationale et des départements.
  const bascule = fiche.querySelector(".fiche__vitesses");
  const tout = etat.voir === "tout";
  fiche.classList.toggle("fiche--tout", Boolean(bascule) && tout);
  fiche.classList.toggle("fiche--essentiel", Boolean(bascule) && !tout);
  if (!bascule) return;
  for (const bouton of fiche.querySelectorAll<HTMLElement>(".fiche__vitesses [data-vitesse]")) {
    bouton.setAttribute("aria-pressed", String((bouton.dataset.vitesse === "tout") === tout));
  }
}

/** Change de vitesse et l'écrit dans l'URL. Rien d'autre : la fiche est déjà
 *  rendue en entier. */
function choisirVitesse(voulue: "essentiel" | "tout"): void {
  if (etat.voir === voulue) return;
  etat.voir = voulue;
  ecrireUrl();
  appliquerVitesse();
}

/** Ouvre un thème dans le corps « Tout voir » : la barre de sa rubrique, son
 *  onglet, sa section. Le même geste que le clic sur l'onglet, appelable
 *  depuis une phrase du verdict. */
function montrerTheme(voulu: string): void {
  const rubrique = rubriqueDuTheme(voulu);
  for (const bouton of document.querySelectorAll<HTMLElement>(
    ".onglets-rubriques [data-rubrique]",
  )) {
    bouton.setAttribute("aria-pressed", String(bouton.dataset.rubrique === rubrique));
  }
  for (const barre of document.querySelectorAll<HTMLElement>(".onglets-themes[data-rubrique]")) {
    barre.hidden = barre.dataset.rubrique !== rubrique;
  }
  for (const bouton of document.querySelectorAll<HTMLElement>(".onglets-themes [data-theme]")) {
    bouton.setAttribute("aria-pressed", String(bouton.dataset.theme === voulu));
  }
  for (const section of document.querySelectorAll<HTMLElement>(".mesures [data-theme]")) {
    section.hidden = section.dataset.theme !== voulu;
  }
}

/**
 * Une phrase du verdict mène à sa ligne, dépliée.
 *
 * Le verdict affirme un chiffre ; le lecteur doit pouvoir aller voir d'où il
 * vient. Le chemin passe par « Tout voir » — c'est là que vit le détail — puis
 * par le thème, le pli, et le défilement. Une phrase dont la ligne n'existe pas
 * n'est pas cliquable : `fiche.ts` ne lui met pas de bouton.
 */
function ouvrirLaMesure(id: string): void {
  choisirVitesse("tout");
  const cible = $("fiche").querySelector<HTMLElement>(`.mesures [data-mesure="${CSS.escape(id)}"]`);
  if (!cible) return;
  const section = cible.closest<HTMLElement>(".mesures [data-theme]");
  if (section?.dataset.theme) montrerTheme(section.dataset.theme);
  for (let noeud: HTMLElement | null = cible; noeud; noeud = noeud.parentElement) {
    if (noeud instanceof HTMLDetailsElement) noeud.open = true;
  }
  cible.scrollIntoView({
    block: "center",
    // Un défilement animé est une animation : elle se coupe pour qui l'a
    // demandé au système.
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
}

/**
 * Ouvre un territoire depuis une commande du lecteur : suggestion de recherche,
 * maille supérieure de l'en-tête, forme cliquée sur la carte.
 *
 * Trois choses que `montrerFiche` seule ne fait pas :
 *
 * 1. **Un retour visuel immédiat.** Charger une fiche communale demandait
 *    dix-sept secondes pendant lesquelles rien ne bougeait : l'ancienne fiche
 *    restait à l'écran, et le lecteur croyait que son clic n'avait pas pris. Le
 *    squelette prend la place tout de suite, avec le nom demandé.
 * 2. **Un affichage progressif.** La fiche ne dépend que du lot de son
 *    département ; la carte, elle, relit une couche entière et les cent un lots
 *    qui la couvrent. On affiche donc la fiche d'abord, la carte ensuite, qui
 *    réécrit la fiche une seconde fois avec son rang dans la couche.
 * 3. **Une seule ouverture à la fois.** Le même territoire redemandé ne relance
 *    rien, un autre prend la main, et le ticket périmé cesse d'écrire.
 *
 * Et une quatrième, quand la page n'est pas l'application : une analyse
 * pré-rendue n'a ni panneau ni carte à peindre, elle va à l'adresse du
 * territoire.
 */
async function ouvrirTerritoire(
  code: string,
  niveauDemande: string | null,
  nom?: string,
): Promise<void> {
  // Le pré-rendu remplace `<main id="contenu">` : `#fiche` et
  // `#volet-territoire` n'existent pas sur une page d'analyse. `$` étant un
  // cast et non une garde, `panneau.setAttribute` levait sur `null` trois
  // lignes plus bas — le champ de recherche de l'en-tête, câblé sur ces pages
  // exprès, proposait des territoires et n'en ouvrait aucun. Ces pages sont
  // des documents servis : on suit le lien, comme le ferait n'importe quel
  // lien de la page. Avant le ticket, qui ne sert qu'à ce qui se peint.
  if (document.body.dataset.page === "editorial") {
    location.assign(adresseTerritoire(code, niveauDemande));
    return;
  }
  const ticket = fileOuverture.ouvrir(code);
  if (ticket === null) return;
  const panneau = $("fiche");
  panneau.setAttribute("aria-busy", "true");
  // Le nom avant les données : un clic sur la carte n'en donne pas, et le lot
  // du département n'est pas encore là. C'est l'index de la maille qui nomme
  // le squelette — sans lui, il restait anonyme le temps du chargement.
  panneau.innerHTML = squeletteFiche(
    nom ?? repertoire?.noms[code] ?? entiteDe(code, etat.niveau)?.nom ?? "",
  );
  $("volet-territoire").scrollTop = 0;
  try {
    // La maille demandée, ou celle que la carte peint quand la commande n'en
    // nomme aucune. Une maille sans couche de tuiles — un arrondissement
    // municipal — s'ouvre par-dessus la carte laissée telle quelle : y basculer
    // le calque lui ferait peindre un remplissage inexistant.
    const voulu = niveauDemande ?? etat.niveau;
    etat.maille = MAILLES_HORS_CARTE.has(voulu) ? voulu : null;
    if (!etat.maille && voulu !== etat.niveau) {
      etat.niveau = voulu;
      // Le zoom ne commande plus la maille : le lecteur vient de la choisir.
      etat.niveauAuto = false;
      construireSelecteurs();
      await montrerFiche(code);
      if (!fileOuverture.courant(ticket)) return;
      await peindre();
      return;
    }
    await montrerFiche(code);
  } finally {
    if (fileOuverture.courant(ticket)) {
      panneau.removeAttribute("aria-busy");
      // Lot absent ou illisible : le squelette ne peut pas rester à la place
      // d'une fiche qui ne viendra pas.
      if (panneau.querySelector(".fiche__chargement")) {
        panneau.innerHTML =
          '<p class="erreur">Les données de ce territoire n\'ont pas pu être chargées.</p>';
      }
    }
    fileOuverture.fermer(ticket);
  }
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
  const poser = (hauteur: number) => {
    panneau.style.setProperty("--tiroir", `${hauteur}px`);
    majEtatTiroir(hauteur);
  };
  majEtatTiroir();

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

  // Le clic de compatibilité qui suit un `touchend` est routé vers l'élément
  // qui se trouve sous le doigt **au moment du clic**. Relâcher la poignée
  // réduit le tiroir : son bord haut descend sous le point touché, et ce clic
  // partait à la carte, qui sélectionnait la commune peinte à cet endroit.
  // Fiche de Bordeaux, tap sur la poignée, fiche de « Civray ».
  //
  // Deux verrous, parce qu'aucun des deux ne couvre tous les navigateurs :
  // annuler le `touchend` supprime le clic de compatibilité à la source, et la
  // garde temporelle absorbe celui qu'un navigateur émettrait quand même.
  poignee.addEventListener("touchend", (evenement) => {
    if (window.innerWidth > 960) return;
    evenement.preventDefault();
  });

  const relacher = (evenement: Event) => {
    const e = evenement as PointerEvent;
    if (!poignee.hasPointerCapture(e.pointerId)) return;
    poignee.releasePointerCapture(e.pointerId);
    gardePoignee.armer();
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
  window.addEventListener("resize", () => {
    panneau.style.removeProperty("--tiroir");
    majEtatTiroir();
  });
}

/**
 * `aria-expanded` de la poignée : le tiroir est-il agrandi au-delà de son repos ?
 *
 * Calculé sur la hauteur **visée**, jamais sur la hauteur mesurée : le panneau
 * est en transition à l'instant où son état change, et la mesure donnerait
 * encore l'état précédent.
 */
function majEtatTiroir(visee?: number): void {
  const panneau = $("panneau");
  const repos = window.innerHeight * 0.38;
  const fige = parseFloat(panneau.style.getPropertyValue("--tiroir"));
  const haut =
    visee ??
    (Number.isFinite(fige)
      ? fige
      : window.innerHeight * (panneau.classList.contains("panneau--selection") ? 0.62 : 0.38));
  $("panneau-poignee").setAttribute("aria-expanded", String(haut > repos + 1));
}

/**
 * L'état « fiche fermée ».
 *
 * Le « × » ne fermait rien : il ramenait à la fiche France, panneau toujours
 * grand ouvert, carte laissée en maille commune — une France pointilliste
 * illisible au cadrage national.
 *
 * L'état retenu, le plus simple qui ne perde rien :
 *
 * - **le panneau se replie** sur sa taille de repos (le tiroir mobile revient à
 *   l'aperçu, et la hauteur qu'un glissement avait figée est relâchée) ;
 * - **le panneau garde la recherche et la fiche France** : c'est le contenu
 *   d'accueil, il n'y a rien à masquer et rien à recharger ;
 * - **la carte remonte à une maille lisible** : la maille redevient celle que
 *   le zoom commande. Zoomé sur une agglomération, on garde les communes ;
 *   revenu au cadrage national, on remonte aux régions. Rien n'est perdu : le
 *   territoire fermé se retrouve d'un clic sur la carte ou par la recherche, et
 *   le lien de la page cesse de le nommer.
 */
function fermerPanneau(): void {
  etat.selection = null;
  etat.maille = null;
  const panneau = $("panneau");
  panneau.classList.remove("panneau--selection");
  panneau.style.removeProperty("--tiroir");
  majEtatTiroir();
  // La maille suivait le territoire choisi ; sans territoire, elle suit le zoom.
  etat.niveauAuto = true;
  const lisible = carte ? niveauPourZoom(carte.getZoom()) : etat.niveau;
  ecrireUrl();
  if (lisible !== etat.niveau) {
    etat.niveau = lisible;
    construireSelecteurs();
    ecrireUrl();
    void peindre();
    return;
  }
  afficherApercu();
}

/**
 * Le bouton « Comparer » a quitté la fiche.
 *
 * Comparer deux territoires est un travail d'analyse, pas une action qu'on
 * pose sous le nom d'une commune : la page ANALYSES existe pour ça, avec le
 * contrôle de définition, de périmètre, de période et d'unité que la
 * comparaison exige. Le bouton, lui, invitait à mettre côte à côte deux
 * chiffres sans rien de tout cela.
 */
function injecterActionsFiche(): void {
  $("fiche").querySelector(".fiche__actions")?.remove();
}

/** Ajoute ou retire un territoire de la comparaison, et va la montrer. */
async function basculerComparaison(code: string): Promise<void> {
  const dedans = etat.comparaison.includes(code);
  etat.comparaison = dedans
    ? etat.comparaison.filter((c) => c !== code)
    : [...etat.comparaison, code].slice(0, MAXIMUM);
  ecrireUrl();
  await majComparateur();
  if (etat.selection) injecterActionsFiche();
  // Le comparateur vit désormais sous /detail : `#comparateur` y est peuplé
  // par `majComparateur`, que `peindreDetail` appelle. La comparaison choisie
  // ici s'y lit donc au prochain passage par cette vue, via l'URL. Aucun
  // `data-comparer` n'est plus émis nulle part sur le site —
  // `injecterActionsFiche` ne fait plus que retirer le bloc d'actions — si
  // bien que taper `?comparer=` dans l'adresse reste le seul moyen d'y
  // ajouter un territoire. Poser cette entrée dans l'interface est un lot
  // délibérément reporté, pas un oubli.
}

async function majComparateur(): Promise<void> {
  const section = $("comparateur");
  if (!section) return;
  if (!etat.comparaison.length) {
    section.hidden = true;
    return;
  }
  await chargerLotsNecessaires(etat.niveau, etat.comparaison);
  const entrees: Entree[] = etat.comparaison
    .filter((code) => entiteDe(code, etat.niveau))
    .map((code) => ({ code, niveau: etat.niveau, territoire: entiteDe(code, etat.niveau)! }));
  afficherComparateur(
    section,
    entrees,
    catalogue.filter(
      (i) => i.theme === etat.theme && i.niveaux?.includes(etat.niveau) && !DENOMINATEURS.has(i.id),
    ),
    etat.periode,
    etat.declinaison === "habitant",
  );
  // Sous deux territoires, le tableau n'est pas dessiné : sans cette liste, on
  // ne pourrait pas défaire une sélection d'un seul territoire. Au-delà, les
  // en-têtes de colonnes portent déjà leur « × ».
  if (etat.comparaison.length < 2) {
    section.insertAdjacentHTML(
      "beforeend",
      `<div class="pilules" style="display:inline-flex;flex-wrap:wrap">${etat.comparaison
        .map(
          (code) => `<button type="button" class="pilule" data-retirer="${code}">${
            entiteDe(code, etat.niveau)?.nom ?? code
          } ×</button>`,
        )
        .join("")}</div>`,
    );
  }
  section.hidden = false;
}

/** Seuls les thèmes cartographiables alimentent la carte : la dette et les
 *  comparaisons européennes n'existent qu'au niveau national. */
function themesCartographiables(): string[] {
  return [...new Set(catalogue.filter((i) => i.niveaux?.includes(etat.niveau)).map((i) => i.theme))];
}

/* Les deux menus posés sur la carte — la maille cadrée et l'indicateur peint —
   ont été retirés de l'écran le 17 août 2026. Ils occupaient le haut de la
   carte à toutes les largeurs pour des réglages que personne n'employait, et
   ils demandaient au lecteur de choisir avant d'avoir rien vu.

   Ce qu'ils réglaient n'est pas perdu : `?vue=` et `?indicateur=` restent lus
   et écrits par `lireUrl`/`ecrireUrl`, un lien partagé ouvre toujours la bonne
   couche, et `choisirIndicateur` reste appelée depuis « Voir sur la carte »
   dans le détail d'une mesure. C'est l'écran qui perd deux menus, pas le site
   qui perd un réglage. */

/** Périodes du niveau affiché, la plus récente d'abord — pas de l'indicateur
 *  tous niveaux confondus : l'historique communal est plus court que celui
 *  des départements, et proposer une année sans couche mènerait à un fichier
 *  absent. */
function periodesDuNiveau(): string[] {
  const fiche = indicateurCourant();
  return [...(fiche.periodes_par_niveau?.[etat.niveau] ?? fiche.periodes ?? [])].sort().reverse();
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

  const periodes = periodesDuNiveau();
  // Toujours la plus récente : l'année n'est plus un réglage.
  etat.periode = periodes[0];
  // L'évolution demande deux millésimes publiés à cette maille : à moins,
  // retour au niveau — proprement, bouton masqué compris.
  if (periodes.length < 2) etat.mode = "niveau";
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
  // Le cadrage est devenu un menu : c'est un `change`, plus un clic sur une
  // pastille. Le menu se reconstruit seul à chaque rendu, sans réécrire son
  // propre HTML sous le doigt du lecteur.
  $("pilules-vue").addEventListener("change", (evenement) => {
    const menu = evenement.target as HTMLSelectElement;
    if (menu.id !== "cadrage") return;
    etat.vue = menu.value;
    cadrer(menu.value);
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
    // La maille du dessus, dans l'en-tête : « Commune · Gironde » se remonte
    // d'un clic. Sans cela, revenir au département exigeait de retaper son nom
    // dans la recherche. Même chemin qu'une suggestion : la maille de la carte
    // suit si le territoire visé n'est pas de celle qui est peinte.
    const parent = (evenement.target as HTMLElement).closest<HTMLElement>(".fiche__parent");
    if (parent?.dataset.code) {
      void ouvrirTerritoire(
        parent.dataset.code,
        parent.dataset.niveau ?? null,
        parent.textContent?.trim(),
      );
      return;
    }
    // Les deux vitesses : « L'essentiel » et « Tout voir ». Avant tout le
    // reste, parce que ces boutons ne portent rien sur la carte.
    const vitesse = (evenement.target as HTMLElement).closest<HTMLElement>(
      ".fiche__vitesses [data-vitesse]",
    );
    if (vitesse?.dataset.vitesse) {
      choisirVitesse(vitesse.dataset.vitesse === "tout" ? "tout" : "essentiel");
      return;
    }
    // Une phrase du verdict mène à la ligne qu'elle cite, dépliée.
    const renvoi = (evenement.target as HTMLElement).closest<HTMLElement>("[data-verdict-vers]");
    if (renvoi?.dataset.verdictVers) {
      ouvrirLaMesure(renvoi.dataset.verdictVers);
      return;
    }
    // Ajouter le territoire ouvert à la comparaison, ou l'en retirer.
    const comparer = (evenement.target as HTMLElement).closest<HTMLElement>("[data-comparer]");
    if (comparer?.dataset.comparer) {
      void basculerComparaison(comparer.dataset.comparer);
      return;
    }
    // L'onglet ensuite : il ne porte rien sur la carte, il change ce que la
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
  // Un dépliant de question dit son état. `<details>` le porte nativement pour
  // le navigateur, mais `aria-expanded` est ce que le lecteur d'écran annonce ;
  // laissé figé dans le HTML, il mentirait dès le premier clic. L'événement
  // `toggle` ne remonte pas : on l'écoute en capture.
  $("fiche").addEventListener(
    "toggle",
    (evenement) => {
      const bloc = evenement.target as HTMLElement;
      if (!(bloc instanceof HTMLDetailsElement) || !bloc.dataset.question) return;
      bloc.querySelector("summary")?.setAttribute("aria-expanded", String(bloc.open));
    },
    true,
  );
  tiroirRedimensionnable();

  // Le bouton d'export vivait dans la vue DONNÉES, retirée : sans lui, `$` rend
  // `null` et l'écouteur levait au démarrage, emportant tout ce que
  // `demarrer()` fait après cet appel. Même garde que `majTableau`.
  document.getElementById("exporter")?.addEventListener("click", () => {
    const indicateur = indicateurCourant();
    // La source se lit à la maille exportée, pas sur l'indicateur seul :
    // l'OFGL déclare ses agrégats sous « Finances des communes » quelle que
    // soit la maille chargée (voir `sourceDuNiveau`).
    const source = sourceDuNiveau(indicateur, etat.niveau, jeux);
    if (exportEvolution) {
      telecharger(
        enCsvEvolution(exportEvolution.lignes, {
          indicateur: indicateur.libelle,
          unite: indicateur.unite,
          periodeAvant: exportEvolution.avant,
          periodeApres: etat.periode,
          niveau: etat.niveau,
          parHabitant: parHabitantAffiche,
          source,
        }),
        nomDeFichier(
          indicateur.libelle,
          etat.niveau,
          `evolution-${exportEvolution.avant}-${etat.periode}`,
        ),
      );
      return;
    }
    telecharger(
      enCsv(exportCourant.lignes, {
        indicateur: indicateur.libelle,
        unite: indicateur.unite,
        periode: etat.periode,
        niveau: etat.niveau,
        parHabitant: exportCourant.parHabitant,
        source,
      }),
      nomDeFichier(indicateur.libelle, etat.niveau, etat.periode),
    );
  });

  // La navigation change de vue sans recharger la page. Les modificateurs et le
  // clic du milieu sont laissés au navigateur : « ouvrir dans un nouvel onglet »
  // doit continuer de fonctionner sur un vrai lien.
  document.querySelector(".entete__nav")?.addEventListener("click", (evenement) => {
    const clic = evenement as MouseEvent;
    if (clic.button !== 0 || clic.metaKey || clic.ctrlKey || clic.shiftKey || clic.altKey) return;
    const lien = (clic.target as HTMLElement).closest<HTMLAnchorElement>("a[data-vue]");
    if (!lien) return;
    clic.preventDefault();
    // Les paramètres suivent : changer de vue ne doit pas perdre le territoire
    // choisi ni les réglages du simulateur.
    history.pushState(null, "", `${lien.pathname}${location.search}`);
    basculerVue();
  });

  $("carte-bascule").addEventListener("click", () => {
    carteOuverte = !carteOuverte;
    appliquerModeCarte(carteOuverte);
  });

  // Retirer un territoire de la comparaison : les « × » des en-têtes du
  // tableau (rendus par `comparateur.ts`) et les pilules de rappel.
  document.getElementById("comparateur")?.addEventListener("click", (evenement) => {
    const bouton = (evenement.target as HTMLElement).closest<HTMLElement>("[data-retirer]");
    const code = bouton?.dataset.retirer;
    if (code) void basculerComparaison(code);
  });
}

/**
 * Le champ de recherche et sa liste de suggestions, câblés ensemble.
 *
 * Deux pages le portent — le panneau de la carte et la page ANALYSES —, et il
 * doit s'y comporter pareil : même index, mêmes flèches du clavier, même
 * ouverture. Écrit deux fois, il aurait divergé au premier correctif.
 */
function brancherRecherche(champ: HTMLInputElement, liste: HTMLUListElement): void {
  // La recherche cherchait dans la seule maille affichée. Comme cette maille
  // suit désormais le zoom, taper « Lyon » sur une vue nationale ne trouvait
  // rien — sans un mot d'explication — alors que le champ promet « une
  // commune, un département ». Elle cherche maintenant partout, dit à quelle
  // maille appartient chaque réponse, et y emmène. Le tri et le filtre vivent
  // dans `mailles.ts`, où ils sont testables.
  // `aria-expanded` suit l'ouverture réelle de la liste : le champ s'annonce
  // comme un `combobox`, et un combobox qui dit toujours « replié » ne dit rien
  // à qui l'écoute.
  const montrer = (ouverte: boolean) => {
    liste.hidden = !ouverte;
    champ.setAttribute("aria-expanded", String(ouverte));
  };
  champ.addEventListener("input", async () => {
    const requete = champ.value.trim().toLowerCase();
    if (requete.length < 2) {
      montrer(false);
      return;
    }
    const trouves = suggestions(await donnees.indexRecherche(), requete, etat.niveau);
    montrer(true);
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
      montrer(false);
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
      montrer(false);
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
    montrer(false);
    champ.value = "";
    // Choisir une commune depuis une vue régionale change la maille : sans
    // cela, la fiche s'ouvrait sur un territoire que la carte ne connaissait
    // pas et le panneau restait vide. Le nom vient de la suggestion : le
    // squelette peut l'annoncer avant que le moindre octet soit chargé.
    await ouvrirTerritoire(
      bouton.dataset.code as string,
      bouton.dataset.niveau ?? null,
      bouton.firstChild?.textContent?.trim(),
    );
    // La page DÉTAIL porte le même champ : sans ce repeint, choisir une ville
    // depuis cette page ouvrait la fiche de la carte et laissait le tableau sur
    // la ville précédente. On ne pouvait tout simplement pas en changer.
    if (document.body.dataset.vue === "bilan") await peindreDetail();
  });

}

/**
 * Le sommaire de « Sources et méthode », posé en tête de la section.
 *
 * La page pèse un demi-million de caractères en quatre-vingt-quatorze plis
 * empilés : c'est elle qui fonde la confiance, et personne n'y trouvait la
 * définition qu'il cherchait. Le contenu ne change pas ; on ajoute devant la
 * liste des thèmes avec leur nombre d'indicateurs, et un filtre qui masque les
 * entrées sans rapport. Le filtre porte aussi sur les noms d'indicateurs :
 * « chômage » trouve « Emploi et chômage » sans qu'on ait à deviner le thème.
 */
function brancherSommaireSources(parTheme: [string, Indicateur[]][]): void {
  if (!document.getElementById("sources-contenu")) return;
  const entrees: EntreeSommaire[] = parTheme.map(([theme, liste]) => ({
    ancre: `methode-${theme}`,
    libelle: libelleTheme(theme),
    nombre: liste.length,
    termes: liste.map((i) => traduire(i.libelle)).join(" "),
  }));
  $("sources-contenu").insertAdjacentHTML(
    "afterbegin",
    `<nav class="sources__sommaire" aria-label="Sommaire des thèmes" style="margin:0 0 var(--espace-7)">
      <h3 class="sources__titre">Ce que contient cette page</h3>
      <p class="tableau__aide">${entrees.length} thèmes, ${entrees.reduce(
        (total, e) => total + e.nombre,
        0,
      )} indicateurs définis.</p>
      <div class="recherche" style="padding:0 0 var(--espace-5)">
        <label class="visuellement-cache" for="sommaire-filtre">Filtrer les thèmes</label>
        <input id="sommaire-filtre" type="search" autocomplete="off"
               placeholder="Filtrer par thème ou par indicateur" />
      </div>
      <ul id="sommaire-liste" style="list-style:none;margin:0;padding:0;column-width:14rem;column-gap:var(--espace-7)">${rendreSommaire(
        entrees,
      )}</ul>
      <p id="sommaire-vide" class="tableau__aide" hidden>Aucun thème ne porte ce nom.</p>
    </nav>`,
  );

  const liste = $("sommaire-liste");
  liste.addEventListener("click", (evenement) => {
    const ancre = (evenement.target as HTMLElement).closest<HTMLElement>("[data-ancre]")?.dataset
      .ancre;
    if (!ancre) return;
    const pli = document.getElementById(ancre) as HTMLDetailsElement | null;
    if (!pli) return;
    pli.open = true;
    pli.scrollIntoView({ block: "start", behavior: "smooth" });
  });

  $<HTMLInputElement>("sommaire-filtre").addEventListener("input", (evenement) => {
    const retenues = filtrer(entrees, (evenement.target as HTMLInputElement).value);
    liste.innerHTML = rendreSommaire(retenues);
    $("sommaire-vide").hidden = retenues.length > 0;
  });
}

/** Trois vues — Carte, Décryptages, Données — au lieu d'un long défilement.
 *  Le lecteur choisit ce qu'il regarde ; on ne passe plus d'une carte plein
 *  écran à une pile de blocs sans transition. L'état vit dans le hash. */
/**
 * L'accueil n'est plus la carte.
 *
 * Un aplat de couleurs ne dit pas un montant, ne dit pas d'où vient une hausse
 * et ne se compare pas à un exercice antérieur : c'est la fiche qui répond à
 * ces trois questions, et c'est elle qu'on vient chercher. La carte garde son
 * onglet — elle montre bien ce qu'aucune fiche ne montre, la répartition dans
 * l'espace — mais elle ne tient plus la porte d'entrée.
 */
/** La vue DONNÉES est retirée : 6 691 px de listes que personne ne parcourait.
 *  Ce qu'elle portait vit ailleurs — le fichier public est lié depuis le pied
 *  de page, et chaque mesure garde sa définition et sa source dans son rond
 *  « i ». Ce qui a réellement disparu de l'écran est écrit dans la PR. */
const VUES_PAGE = ["territoire", "bilan"] as const;

/** La page DÉTAIL pour le territoire sélectionné.
 *
 *  Elle a besoin du même lot de territoires que la fiche ; sans sélection, elle
 *  invite à en choisir un plutôt que d'afficher une page vide sans dire pourquoi.
 */
async function peindreDetail(): Promise<void> {
  const cible = $("detail");
  const code = etat.selection;
  if (!code) {
    // L'ancien texte renvoyait « à la carte », qui n'est pas sur cette page :
    // il désignait une commande que le lecteur ne pouvait pas voir. Il nomme
    // désormais le champ de l'en-tête, qui, lui, y est.
    cible.innerHTML =
      `<p class="etat etat--vide"><span class="etat__titre">Aucun territoire choisi</span>` +
      `<span class="etat__quoi">Cherchez une commune, un département ou une région dans le` +
      ` champ en haut de page. Cette vue en détaille alors tous les indicateurs publiés,` +
      ` exercice par exercice.</span></p>`;
    return;
  }
  // Même défaut que celui corrigé à `peindreMethode`, même remède : `basculerVue`
  // peint la première vue avant que `demarrer` n'ait fini d'initialiser les
  // données, et un lien `/detail?territoire=…` partagé arrive ici avec
  // `donnees.racine` encore à "". Le fetch part contre l'origine du site
  // (retombée SPA, 200 sur index.html), `r.json()` lève, et `donnees.ts` cache
  // par chemin relatif — pas par URL résolue — donc l'échec se fige pour le
  // reste de la session : un lien partagé restait blanc, pour de bon.
  await publiee;
  // `prete` ne suffisait pas : elle se résout dès que `donnees.racine` est
  // connue, or le catalogue n'est assemblé que plus loin dans `demarrer`
  // (avec les indicateurs dérivés). Ce peintre partait donc parfois avec un
  // catalogue vide, `indicateursDeLaFiche` ne rendait rien, et `#detail`
  // sortait blanc — mesuré une fois sur trois, à toutes les mailles.
  // `publiee` est résolue APRÈS l'assemblage : c'est la promesse qui décrit
  // ce que cette page attend vraiment.
  // La maille du territoire ouvert, pas celle que la carte peint : c'est déjà
  // ce que fait `montrerFiche`, et la même fiche se lit aux deux endroits.
  // Cette page lisait `etat.niveau`, qui vaut « region » pour toute sélection
  // sans couche de tuiles : la France y arrivait déclarée région, aucun de ses
  // 145 indicateurs nationaux ne passait le filtre de maille, et `#detail`
  // restait vide — le budget de l'État, ses 81 lignes, n'avait pas de page.
  const niveau = niveauSelection();
  await chargerLotsNecessaires(niveau, [code]);
  const territoire = entiteDe(code, niveau);
  if (!territoire) return;
  afficherAnalyses(
    cible,
    territoire.nom,
    rubriques(territoire, indicateursDeLaFiche(niveau), THEMES, ORDRE_THEMES),
  );
  // Le comparateur suit la sélection : il n'a pas d'état propre, il relit
  // `etat.comparaison`, que l'adresse porte déjà.
  await majComparateur();
}

/** Le simulateur n'est une vue du site que si au moins un budget est publié.
 *  Tant qu'aucun ne l'est, `#simulateur` n'est pas une adresse : pas d'entrée
 *  de menu, pas de section, et aucun message pour dire ce qui manque.
 *
 *  Deux budgets y vivent désormais, et ils ne se ressemblent pas : l'État vote
 *  des crédits, la Sécurité sociale arrête des charges et des produits. Ils ont
 *  donc chacun leur fichier, leur index d'exercices et leur cadrage — le seul
 *  point commun est le moteur de réglage. Ce qui n'existe nulle part, ici comme
 *  ailleurs sur le site, c'est leur somme. */
/**
 * L'atelier : tous les budgets publics, sur une seule page.
 *
 * Le simulateur montrait un budget à la fois, choisi dans une barre de
 * pastilles — et la barre restait à l'écran à côté du budget affiché, si bien
 * que deux vues du même objet coexistaient. Il n'y a plus qu'une page : les
 * budgets s'y suivent en sections, chacun avec son propre solde, et les gestes
 * s'additionnent en un total.
 *
 * **Aucune entrée ne résume les autres.** Ni « toutes les administrations », ni
 * la Sécurité sociale consolidée à côté de ses cinq branches : les totaux ne
 * s'additionnent pas — entre le budget général et les régimes de base circulent
 * des dizaines de milliards que chacun compte de son côté. Ce qui s'additionne,
 * ce sont les écarts, et c'est le seul total que l'atelier écrit.
 */
type VoletPublie = {
  cle: string;
  nom: string;
  /** Les exercices publiés. Un fichier absent vaut « rien à montrer » : le
   *  volet n'apparaît pas du tout. */
  index: () => Promise<string[]>;
  charger: (exercice: string) => Promise<Volet>;
};

// BRANCHES, DIT_LA_BRANCHE, fusionnerBranches et ECHELONS viennent de
// simulateur-volets.ts : `scripts/prerendre.ts` les construit à l'identique,
// pour ouvrir les mêmes volets côté pré-rendu et côté atelier interactif.

function voletBudget(cle: string, nom: string, budget: Budget): Volet {
  return { genre: "budget", cle, nom, budget, index: indexer(budget) };
}

const VOLETS_PUBLIES: VoletPublie[] = [
  {
    cle: "etat",
    nom: "État",
    index: async () => exercicesPublies(await donnees.simulateurIndex()),
    charger: async (exercice) =>
      voletBudget("etat", "État", await donnees.simulateurBudget(exercice)),
  },
  {
    cle: "secu",
    nom: "Sécurité sociale",
    index: async () => exercicesPublies(await donnees.simulateurIndexSecu()),
    charger: async (exercice: string) => {
      const [consolide, ...branches] = await Promise.all([
        donnees.simulateurBudgetSecu(exercice),
        ...BRANCHES.map(([branche]) => donnees.simulateurBranche(`${branche}-${exercice}`)),
      ]);
      return voletBudget(
        "secu",
        "Sécurité sociale",
        fusionnerBranches(
          consolide,
          BRANCHES.map(([cle, nom], rang) => [cle, nom, branches[rang]!] as [string, string, Budget]),
        ),
      );
    },
  },
  {
    cle: "bareme",
    nom: "Impôt sur le revenu",
    index: async () => exercicesPublies(await donnees.simulateurIndexBareme()),
    charger: async (exercice) => {
      const bareme = await donnees.simulateurBareme(exercice);
      return {
        genre: "bareme" as const,
        cle: "bareme",
        nom: "Impôt sur le revenu",
        bareme,
        // Le barème en vigueur : c'est de là qu'on part, et c'est contre lui
        // que se mesure ce qu'on change.
        depart: appliquerBareme(bareme, MODELES_BAREME[0]),
        // La ligne 1101 des recettes fiscales de l'État, que ce barème calcule.
        // Sans ce lien, les tranches et les 120 191 M€ inscrits au budget
        // seraient deux commandes du même impôt qui s'ignorent.
        pilote: { volet: "etat", code: "r1101" },
      };
    },
  },
  // Trois entrées, jamais une quatrième qui les résumerait : une part de ce que
  // départements et régions dépensent est reversée aux communes.
  ...(["commune", "departement", "region"] as const).map((echelon) => ({
    cle: `collectivites-${echelon}`,
    nom: ECHELONS[echelon],
    index: async () => [(await donnees.simulateurCollectivites(echelon)).exercice],
    charger: async (_exercice: string) =>
      voletBudget(
        `collectivites-${echelon}`,
        ECHELONS[echelon],
        await donnees.simulateurCollectivites(echelon),
      ),
  })),
];

/** Les volets dont l'index annonce un exercice, et leur millésime. */
let exercicesParVolet: { volet: VoletPublie; exercice: string }[] = [];
let atelierMonte = false;
/** Les volets réellement montés dans l'atelier : posés une seule fois, à la
 *  première ouverture (`ouvrirSimulateur`), et relus par tout ce qui doit
 *  décoder un scénario ou construire une colonne comparée. Recharger un
 *  scénario n'est jamais un rechargement de volets — seulement un nouvel état
 *  décodé contre les mêmes volets déjà en place, voir `chargerScenario`. */
let voletsMontes: Volet[] = [];

function vuesConnues(): readonly string[] {
  return exercicesParVolet.length ? [...VUES_PAGE, "simulateur"] : VUES_PAGE;
}




/* --------------------------------------------------------------------------
 * L'accueil, à la racine du site.
 *
 * `accueil.ts` rend les cinq blocs en fonctions pures ; ce bloc-ci ne fait que
 * lui porter des données déjà résolues et poser la chaîne obtenue dans la page,
 * comme le reste de ce fichier le fait pour chaque module.
 * ----------------------------------------------------------------------- */

/**
 * Les analyses publiées, agrafées au paquet à la compilation.
 *
 * Elles ne sont pas dans les fichiers de données : le dépôt les porte, et le
 * pré-rendu les lit sur le disque au build (`scripts/prerendre.ts`, même
 * dossier). Le navigateur ne peut ni lire ce disque ni deviner la liste des
 * slugs, et publier un index à part serait une seconde liste à tenir accordée
 * avec le dossier — celle qui dérive au premier fichier ajouté. Vite les inline
 * depuis la source unique, celle du dépôt.
 */
const ANALYSES: Analyse[] = Object.values(
  import.meta.glob<Analyse>("../analyses/*.json", { eager: true, import: "default" }),
);

/** Peint une seule fois : l'accueil ne dépend d'aucune sélection. Le tirage de
 *  l'exemple se refait donc au chargement, pas à chaque retour sur la page —
 *  un exemple qui change sous les yeux au premier Précédent se lit comme un
 *  défaut d'affichage, pas comme une découverte. */
let accueilPeint = false;

let resoudrePubliee: () => void;
/**
 * Résolue quand le manifeste ET le catalogue sont chargés, dans `demarrer`.
 *
 * `prete` ne suffit pas : elle ne promet que `donnees.racine`, et l'accueil a
 * besoin de deux choses écrites après elle — le nombre d'indicateurs publiés,
 * qu'il compte sur le catalogue, et les producteurs, qu'il lit sur les jeux du
 * manifeste. Peint plus tôt, il annoncerait « 0 indicateurs publiés » et une
 * liste de producteurs vide : deux affirmations fausses à l'endroit le plus lu
 * du site.
 */
const publiee = new Promise<void>((resolve) => {
  resoudrePubliee = resolve;
});

async function peindreAccueil(): Promise<void> {
  if (accueilPeint) return;
  await publiee;
  // L'accueil est servi écrit : le build l'a composé sur les fichiers publiés,
  // et c'est ce que le lecteur a déjà sous les yeux. Le repeindre à l'identique
  // ne changerait rien ; le repeindre avec un autre tirage ferait changer
  // l'exemple sous ses yeux, une seconde après l'ouverture — un défaut
  // d'affichage, pas une découverte. Il n'est donc repeint que si la
  // publication a bougé depuis le build : alors le nombre d'indicateurs, les
  // producteurs et les chiffres de l'exemple ont une raison d'avoir changé, et
  // ne pas les rafraîchir servirait des comptes périmés.
  //
  // `data-publication` est posé par le pré-rendu, jamais par le gabarit source :
  // en développement il est absent, et l'accueil se peint alors comme avant.
  const cadre = $("vue-accueil");
  if (cadre.dataset.publication === donnees.version()) {
    accueilPeint = true;
    return;
  }
  const regions = await donnees
    .territoires(MAILLE_EXEMPLE, "tous")
    .catch((): Record<string, Territoire> => ({}));
  cadre.innerHTML = renduAccueil({
    analyses: ANALYSES,
    catalogue,
    territoires: exemplesTerritoires(regions, catalogue),
    // Le tirage se fait ici, jamais dans `accueil.ts` : une fonction qui tire
    // elle-même ne s'éprouve pas sur chaque tirage possible, et c'est
    // précisément la garantie « jamais un territoire incomplet » qu'il faut
    // pouvoir éprouver.
    alea: Math.random(),
    producteurs: jeux.map((jeu) => jeu.producteur),
  });
  accueilPeint = true;
}

/**
 * « Chercher ma commune » ouvre le champ de recherche du site.
 *
 * L'appel porte `#recherche`, l'identifiant du seul champ du site — celui de
 * l'en-tête, câblé une fois par `brancherRecherche`. Laissé au navigateur, ce
 * lien pousse l'ancre dans l'adresse et fait défiler vers un champ déjà à
 * l'écran sans y poser le curseur : l'appel promet une recherche et ne la
 * commence pas. Il n'est pas question d'en construire un second — deux champs
 * qui cherchent dans le même index sans partager leur état est un défaut que ce
 * projet a déjà nommé et retiré.
 *
 * Un écouteur délégué, posé une fois sur un conteneur que rien ne remplace —
 * le motif de `brancherScenarios`, `brancherPartage` et `brancherCitations` —
 * plutôt qu'un écouteur reposé à chaque peinture. Les modificateurs et le clic
 * du milieu restent au navigateur, comme pour la navigation de l'en-tête.
 */
function brancherAppelRecherche(): void {
  // Une page éditoriale remplace le contenu de `<main>` : le cadre de l'accueil
  // n'y est pas, et `$` renverrait `null`.
  const cadre = document.getElementById("vue-accueil");
  if (!cadre) return;
  cadre.addEventListener("click", (evenement) => {
    const clic = evenement as MouseEvent;
    if (clic.button !== 0 || clic.metaKey || clic.ctrlKey || clic.shiftKey || clic.altKey) return;
    if (!(clic.target as HTMLElement).closest('a[href="#recherche"]')) return;
    clic.preventDefault();
    const champ = $<HTMLInputElement>("recherche");
    champ.scrollIntoView({ block: "nearest" });
    champ.focus();
  });
}

function basculerVue(): void {
  // Une page éditoriale est pré-rendue : son contenu est déjà dans le HTML, et
  // aucune vue de l'application ne doit le masquer. L'en-tête, la recherche et
  // le thème restent branchés — c'est le reste de la page qui ne bouge pas.
  if (document.body.dataset.page === "editorial") return;
  const precedente = document.body.dataset.vue;
  const demandee = vueDepuisAdresse(location.pathname, location.hash);
  // `#carte` ouvre la vue territoire ET déploie la carte : le lien tenait sa
  // promesse quand la carte était une vue, il la tient encore.
  if (location.hash === "#carte") carteOuverte = true;
  const cible = demandee ?? "";
  // Une ancre interne — le sommaire de Décryptages vise `#bloc-etat` — passe
  // aussi par `hashchange`. Elle ne nomme pas une vue : la traiter comme une
  // vue inconnue renvoyait le lecteur sur TERRITOIRE au moment précis où il
  // demandait à descendre dans celle qu'il lisait. Tant qu'une vue est déjà
  // affichée, un hash qui n'en désigne aucune la laisse en place, et le
  // navigateur fait ce qu'il sait faire : défiler jusqu'à l'ancre.
  // `location.hash` distingue ce cas d'un Back vers `/` : `vueDepuisAdresse`
  // renvoie `null` sur la racine sans fragment, PAR DESIGN (routes.test.ts),
  // exactement comme pour une ancre. Sans ce filtre, ce garde-fou avalait
  // aussi le retour à la racine — la première navigation Précédent de toute
  // session partie de `/` restait inerte, l'adresse changeait sans que la
  // page suive. Une ancre en porte toujours un ; un Back vers `/`, jamais.
  if (!vuesConnues().includes(cible) && document.body.dataset.vue && location.hash) return;
  // La racine rend l'accueil, jamais la carte : `estAccueil` sépare la racine
  // — où `vueDepuisAdresse` répond `null` par design — d'une adresse inconnue,
  // qui continue de retomber sur la vue territoire. Aucune vue ne bouge :
  // `/territoire` reste la carte, et les liens déjà partagés y mènent toujours.
  const vue = vuesConnues().includes(cible)
    ? cible
    : estAccueil(location.pathname, location.hash)
      ? "accueil"
      : "territoire";
  document.body.dataset.vue = vue;
  // La carte n'est un mode que de la vue territoire : ailleurs, le fond plein
  // cadre n'aurait rien à cadrer.
  appliquerModeCarte(vue === "territoire" && carteOuverte);
  $("vue-accueil").hidden = vue !== "accueil";
  if (vue === "accueil") void peindreAccueil();
  $("vue-territoire").hidden = vue !== "territoire";
  // BILAN réunit ce que REPÈRES et DÉTAIL montraient séparément : les repères
  // nationaux, puis le classement des territoires et leur comparaison.
  $("vue-bilan").hidden = vue !== "bilan";
  if (vue === "bilan") void peindreDetail();
  $("vue-simulateur").hidden = vue !== "simulateur";
  document.querySelectorAll<HTMLAnchorElement>(".entete__nav a").forEach((a) => {
    // Sous 60rem la barre est en bas d'écran, en colonnes égales : toutes les
    // entrées sont visibles, il n'y a plus à ramener la courante sous les yeux.
    if (a.dataset.vue === vue) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  if (vue === "simulateur") void ouvrirSimulateur();
  // Remonter en haut n'a de sens qu'en changeant de vue. Sur une page déjà
  // affichée, un `hashchange` vise une ancre interne — le sommaire des Repères
  // vise `#bloc-etat` — et remonter annulerait le défilement du navigateur
  // vers elle, qui est précisément ce que le lecteur demandait.
  if (vue !== precedente) window.scrollTo({ top: 0 });
}

/**
 * Le sommaire de REPÈRES.
 *
 * La vue aligne huit blocs de plusieurs écrans chacun — conjoncture, dette,
 * Europe, les 100 €, fonctions, Sécurité sociale, budget de l'État, niches —
 * soit un défilement de 6 600 px mesuré à 1440 px de large. Rien ne disait ce
 * qui restait dessous, et il n'y avait pas d'autre moyen d'y aller que de
 * pousser la molette.
 *
 * Le sommaire se construit sur ce qui s'est **réellement affiché** : un bloc
 * dont la source n'est pas publiée reste vide et n'entre pas au sommaire.
 * Rien de cliquable ne doit mener à une section vide — c'est déjà la règle du
 * simulateur dans le menu, c'est la même ici. Le titre de l'entrée est celui
 * du bloc, lu dans le DOM : deux libellés à tenir à jour en auraient fait
 * diverger un.
 */
function peindreSommaireReperes(): void {
  const cadre = document.getElementById("sommaire-bilan");
  if (!cadre) return;
  const entrees = [...document.querySelectorAll<HTMLElement>("#national .bloc")]
    .map((bloc) => ({ bloc, titre: bloc.querySelector("h2, h3")?.textContent?.trim() }))
    .filter((e): e is { bloc: HTMLElement; titre: string } => Boolean(e.titre));
  // Un sommaire d'une entrée nomme ce qui est déjà seul à l'écran.
  if (entrees.length < 2) {
    cadre.hidden = true;
    return;
  }
  cadre.hidden = false;
  cadre.replaceChildren(
    ...entrees.map(({ bloc, titre }) => {
      // Les blocs vides gardent leur `id` du gabarit ; ceux qui portent un
      // titre l'ont rempli. L'ancre vise donc toujours quelque chose.
      const lien = document.createElement("a");
      lien.href = `#${bloc.id}`;
      lien.textContent = titre;
      return lien;
    }),
  );
}

/** La carte est-elle déployée ? Un mode de la vue territoire, pas une vue.
 *
 *  Elle l'est **par défaut**. Repliée, il fallait la demander pour voir ce
 *  qu'aucune fiche ne montre : la répartition dans l'espace. Le bouton reste,
 *  pour la refermer quand on vient lire plutôt que situer. */
let carteOuverte = true;

/**
 * Ouvre ou referme le fond de carte.
 *
 * MapLibre mesure son conteneur au montage. Rendu à un conteneur de hauteur
 * nulle — ce qu'est l'atelier tant que la carte est repliée — il garde cette
 * taille et n'affiche qu'une bande grise au déploiement : d'où le `resize()`,
 * après que le navigateur a appliqué la nouvelle mise en page.
 */
function appliquerModeCarte(ouverte: boolean): void {
  const avant = document.body.dataset.carte === "oui";
  if (ouverte) document.body.dataset.carte = "oui";
  else delete document.body.dataset.carte;
  const bouton = document.getElementById("carte-bascule");
  bouton?.setAttribute("aria-pressed", String(ouverte));
  const texte = document.getElementById("carte-bascule-texte");
  if (texte) texte.textContent = ouverte ? "Masquer la carte" : "Voir sur la carte";
  if (ouverte && !avant) requestAnimationFrame(() => carte?.resize());
}

/**
 * Le thème. Le clair reste le rendu de référence : il s'affiche tant que le
 * lecteur n'a rien demandé et que son système ne demande rien non plus.
 * `localStorage` peut être interdit (navigation privée stricte) — le thème
 * suit alors le système, sans mémoire, plutôt que d'empêcher la page.
 */
function brancherTheme(): void {
  const bouton = $<HTMLButtonElement>("theme-bascule");
  const sombreSysteme = window.matchMedia("(prefers-color-scheme: dark)");
  const estSombre = () =>
    document.documentElement.dataset.theme === "sombre" ||
    (!document.documentElement.dataset.theme && sombreSysteme.matches);
  const peindre = () => bouton.setAttribute("aria-pressed", String(estSombre()));
  peindre();
  // Le système change d'avis (coucher du soleil, réglage) : tant que le
  // lecteur n'a pas tranché lui-même, la bascule le suit.
  sombreSysteme.addEventListener("change", peindre);
  bouton.addEventListener("click", () => {
    const voulu = estSombre() ? "clair" : "sombre";
    document.documentElement.dataset.theme = voulu;
    try {
      localStorage.setItem("theme", voulu);
    } catch {
      // Rien à mémoriser : le choix vaut pour cette page, et c'est déjà ça.
    }
    peindre();
  });
}

/**
 * Les index d'exercices, et eux seuls. Quelques octets par budget, sans
 * lesquels rien ne dirait s'il y a un simulateur à proposer ; les arbres, eux,
 * attendent qu'on ouvre la vue.
 */
async function preparerSimulateur(): Promise<void> {
  const trouves = await Promise.all(
    VOLETS_PUBLIES.map(async (volet) => {
      try {
        const exercice = (await volet.index()).sort().reverse()[0];
        return exercice ? { volet, exercice } : null;
      } catch {
        // Volet non publié : il ne figure simplement pas dans l'atelier.
        return null;
      }
    }),
  );
  exercicesParVolet = trouves.filter((x) => x !== null);
  if (!exercicesParVolet.length) return;
  document
    .querySelector(".entete__nav")!
    .insertAdjacentHTML(
      "beforeend",
      `<a href="/simulateur" data-vue="simulateur">Simulateur</a>`,
    );
  if (vueDepuisAdresse(location.pathname, location.hash) === "simulateur") basculerVue();
}

/* --------------------------------------------------------------------------
 * Les scénarios : enregistrer, recharger, comparer.
 *
 * `scenarios.ts` connaît le cycle de vie, `comparaison.ts` l'alignement,
 * `scenarios-rendu.ts` le rendu — ce bloc ne fait que les brancher au DOM et
 * à l'adresse, comme le reste de ce fichier le fait pour chaque module.
 * ----------------------------------------------------------------------- */

/**
 * Une entrée du fichier de référence produit au build (`prerendre.ts`) : le
 * budget voté, et les chiffrages que portent les analyses publiées. Même
 * forme que ce que `prerendre.ts` écrit — dupliquée, pas partagée, pour la
 * même raison que sa valeur de repli de `BASE` : ce script tourne hors
 * navigateur et ne peut pas importer `main.ts` (voir son en-tête).
 */
type EntreeReference = {
  titre: string;
  slug: string | null;
  lien: string | null;
  budget: string;
  contrat: string;
  exercice: string | null;
};

/** Les scénarios de référence, chargés une fois à l'ouverture du simulateur.
 *  Vide tant qu'ils n'ont pas été chargés, ou si le fichier est absent — un
 *  fichier absent ne casse rien, même règle que partout ailleurs sur le site
 *  (`chargerAssociations`, `peindreMethode`…). */
let referencesScenarios: EntreeReference[] = [];

/** Le fichier lu est-il bien la liste attendue ? Un JSON valide mais qui n'est
 *  pas un tableau — une page d'erreur JSON servie à la place du fichier, un
 *  build partiel — passait l'affirmation de type sans broncher, puis faisait
 *  lever `.map` à CHAQUE rendu de la barre, donc à chaque geste sur l'atelier.
 *  Même contrôle que `estEnveloppe` (scenarios.ts) sur le dépôt local. */
function estReferences(valeur: unknown): valeur is EntreeReference[] {
  return (
    Array.isArray(valeur) &&
    valeur.every(
      (e) =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as EntreeReference).titre === "string" &&
        typeof (e as EntreeReference).budget === "string",
    )
  );
}

/** Charge `dist/simulateur/scenarios-reference.json` — un fichier du site lui-même,
 *  pas une donnée publiée par le pipeline, donc un `fetch` direct plutôt
 *  qu'un passage par `donnees.ts` (qui ne sait lire que la racine R2). */
async function chargerReferences(): Promise<void> {
  try {
    const reponse = await fetch("/simulateur/scenarios-reference.json");
    if (!reponse.ok) return;
    const lu: unknown = await reponse.json();
    if (estReferences(lu)) referencesScenarios = lu;
  } catch {
    // Fichier absent (build sans pré-rendu, ou hors production) : le
    // simulateur reste utilisable, simplement sans comparables de référence.
  }
}

/** Les lignes que le budget chargé portait et que la nomenclature courante ne
 *  porte plus (`transposerBudget`, scenarios.ts) — nommées par
 *  `montrerScenarios` jusqu'au prochain budget chargé ou à sa suppression.
 *
 *  `rienRepris` voyage avec elles parce que c'est un fait de la transposition :
 *  le lecteur peut, après coup, remettre ses propres curseurs à zéro sans que
 *  ça change quoi que ce soit à ce que la transposition avait su reprendre. */
let disparuesCourantes: { lignes: string[]; rienRepris: boolean } = {
  lignes: [],
  rienRepris: false,
};

const CLE_SCENARIOS = "scenarios";

/** Le dépôt de session : en mémoire, jamais `localStorage`. C'est sur lui
 *  qu'on retombe quand le stockage est indisponible — navigation privée
 *  stricte, où `localStorage.setItem` lève plutôt que d'être absent. */
let contenuSession: string | null = null;
const depotSession: Depot = {
  lire: () => contenuSession,
  ecrire: (c) => {
    contenuSession = c;
  },
};

const depotLocal: Depot = {
  lire: () => {
    try {
      return localStorage.getItem(CLE_SCENARIOS);
    } catch {
      return null;
    }
  },
  ecrire: (c) => {
    try {
      localStorage.setItem(CLE_SCENARIOS, c);
    } catch {
      // Persistance perdue, pas l'appel : `scenarios.ts` l'avale déjà (voir
      // sa docstring), et `stockagePersistant()` a prévenu le lecteur avant
      // même la première tentative d'écriture.
    }
  },
};

/**
 * `localStorage` répond-il ? Sondé une fois, comme le thème (`brancherTheme`)
 * le fait à l'écriture — sauf qu'ici l'appelant doit pouvoir LE DIRE au
 * lecteur avant d'enregistrer quoi que ce soit, ce que `scenarios.ts` seul ne
 * permet pas : il avale l'échec d'écriture sans le faire remonter. Une clé
 * dédiée, jamais celle des scénarios, pour ne rien écraser en sondant.
 */
function stockagePersistant(): boolean {
  try {
    const sonde = "__sonde_stockage__";
    localStorage.setItem(sonde, "1");
    localStorage.removeItem(sonde);
    return true;
  } catch {
    return false;
  }
}

const persistant = stockagePersistant();
const depotScenarios: Depot = persistant ? depotLocal : depotSession;

/** L'exercice d'une colonne « vive », jamais enregistrée : celui du volet
 *  État, qui donne le ton au reste de l'atelier, ou le premier exercice
 *  publié s'il manque. Un scénario enregistré, lui, garde le sien —
 *  `Comparable` (scenarios-rendu.ts) le porte depuis `Scenario.exercice`. */
function exerciceCourant(): string | null {
  return (
    exercicesParVolet.find((e) => e.volet.cle === "etat")?.exercice ??
    exercicesParVolet[0]?.exercice ??
    null
  );
}

/** Le scénario enregistré que l'état affiché **est** : même nom, et le même
 *  budget que celui qui est à l'écran. Le nom seul ne suffit pas — deux
 *  lecteurs appellent « Mon budget » deux budgets différents, et un lien
 *  partagé `?nom=Mon budget&budget=…` ouvert chez celui qui a l'homonyme en
 *  local ferait annoncer par la colonne l'exercice de SON scénario au-dessus
 *  du budget de l'envoyeur. `undefined` alors : ce que l'écran montre ne vient
 *  pas de ce scénario, donc rien n'en est emprunté — ni la marque « courant »
 *  dans la barre, ni le nom et l'exercice en tête de colonne.
 *
 *  Le bouton de suppression, lui, ne s'y accroche pas : il agit sur un
 *  scénario du dépôt, que l'écran en montre l'état exact ou une version
 *  retouchée. Il a sa propre condition — que ce scénario existe (voir
 *  `scenarioNomme`). */
function scenarioCourant(): Scenario | undefined {
  return etat.nom
    ? listerScenarios(depotScenarios).find((s) => s.nom === etat.nom && s.budget === etat.budget)
    : undefined;
}

/** Le scénario du dépôt que l'adresse nomme, s'il existe. Un lien partagé
 *  porte `?nom=` sans rien garantir sur le dépôt de qui l'ouvre : offrir
 *  « Supprimer « X » » pour un X que ce lecteur n'a pas, c'est offrir un
 *  geste qui n'a rien à faire. */
function scenarioNomme(): Scenario | undefined {
  return etat.nom ? listerScenarios(depotScenarios).find((s) => s.nom === etat.nom) : undefined;
}

/** L'exercice que l'adresse porte, dit dans la sentinelle du modèle.
 *
 *  L'adresse ne sait dire « absent » qu'avec la chaîne vide : un paramètre non
 *  écrit revient `""` de `lireUrl`. Le modèle ne le dit qu'avec `null`
 *  (`Scenario.exercice`, `Comparable.exercice`). La conversion se fait ici et
 *  nulle part ailleurs — mêler `??` et `||` dans une même expression, comme le
 *  faisait `colonnesComparaison`, c'est tenir deux sentinelles à la fois. */
function exercicePorte(): string | null {
  return etat.faceExercice || null;
}

/** Une colonne comparée, transposée contre les volets montés. `exercice` est
 *  `null` quand il n'y a authentiquement rien à afficher — jamais un exercice
 *  plausible mais sans rapport avec ce que la colonne a réellement réglé.
 *
 *  `transposerBudget` plutôt que `decoder` (atelier.ts) : décoder seul laisse tomber
 *  en silence les lignes que la nomenclature ne porte plus, puis l'en-tête
 *  annonce un effort et un nombre de gestes calculés sur cet état tronqué. La
 *  colonne emporte donc ce qu'elle a perdu, et le tableau le nomme sous elle.
 *
 *  `contrat` est le serment sous lequel ce budget a été bâti : la colonne le
 *  porte pour que le tableau le NOMME, jamais pour l'appliquer — `etat.contrat`
 *  est global à l'atelier, une colonne comparée ne peut pas imposer le sien.
 *  `lien` mène à l'analyse dont la colonne vient, quand elle vient d'une
 *  analyse ; `null` pour un budget du lecteur, qui n'a pas de page. */
function colonneDepuis(
  nom: string,
  budget: string,
  exercice: string | null,
  contrat: string,
  lien: string | null,
): Comparable {
  const { etat: etatColonne, disparues } = transposerBudget(budget, voletsMontes);
  return {
    nom,
    etat: etatColonne,
    effort: effortAtelier(voletsMontes, etatColonne),
    gestes: gestesAtelier(voletsMontes, etatColonne),
    exercice,
    disparues,
    contrat,
    lien,
  };
}

/** Les deux colonnes du mode comparaison : l'état courant (enregistré ou
 *  vif), et la colonne `face` que l'adresse porte.
 *
 *  `exerciceCourant()` n'est légitime que pour un état VIF (`nom` vide) : il
 *  décrit alors bien ce que l'atelier a sous les yeux. Dès qu'un nom est
 *  porté sans scénario local correspondant — un lien partagé ouvert ailleurs
 *  — rien ne dit sur quel exercice il a été bâti, et le proposer quand même
 *  affiche un millésime plausible mais sans rapport avec ce que l'envoyeur a
 *  réellement réglé : `null` dit l'inconnu plutôt que de le déguiser. Pour la
 *  colonne `face`, l'adresse porte l'exercice explicitement (`face-exercice`)
 *  : un lien récent le connaît, un lien antérieur à ce paramètre ne l'a pas
 *  et retombe donc, lui aussi, sur `null`.
 *
 *  Une face qui n'est pas un scénario du lecteur peut être une entrée de
 *  référence : elle apporte alors son serment et le lien de l'analyse dont
 *  elle vient. C'est `etat.faceSource` qui dit laquelle des deux — l'origine
 *  choisie dans le menu, portée par l'adresse — et non le nom, qui ne
 *  distingue pas un scénario d'une référence homonymes. Deviner à partir du
 *  nom faisait annoncer à une colonne de référence l'exercice et le serment
 *  d'un scénario local sans rapport, et lui faisait perdre le lien vers son
 *  analyse.
 *
 *  Un lien antérieur à `face-source` ne porte pas cette origine : le dépôt
 *  local passe alors en premier. C'est le seul cas où deviner reste la moins
 *  mauvaise réponse, et il se referme dès que le lecteur rechoisit sa face. */
function colonnesComparaison(): Comparable[] {
  const cleReference = etat.faceSource.startsWith("reference:")
    ? etat.faceSource.slice("reference:".length)
    : null;
  const faceEnregistree =
    cleReference === null && etat.faceNom
      ? listerScenarios(depotScenarios).find((s) => s.nom === etat.faceNom)
      : undefined;
  const faceReference =
    cleReference !== null
      ? referencesScenarios.find((r) => (r.slug ?? "") === cleReference)
      : faceEnregistree || etat.faceSource === "scenario"
        ? undefined
        : referencesScenarios.find((r) => r.titre === etat.faceNom);
  const face = colonneDepuis(
    (faceEnregistree?.nom ?? etat.faceNom) || "Comparaison",
    etat.face,
    faceEnregistree?.exercice ?? exercicePorte(),
    faceEnregistree?.contrat ?? faceReference?.contrat ?? "",
    faceReference?.lien ?? null,
  );
  const enregistre = scenarioCourant();
  const nomCourant = (enregistre?.nom ?? etat.nom) || "Votre budget actuel";
  const courante = colonneDepuis(
    // Un nom désigne une colonne, jamais deux : deux colonnes homonymes
    // au-dessus de deux budgets différents ne se distinguent par rien à
    // l'écran. C'est la colonne vive qui cède le nom — « Votre budget
    // actuel » est vrai d'elle quoi qu'il arrive, alors que celui de la face
    // lui vient du dépôt ou du fichier de référence.
    nomCourant === face.nom && etat.budget !== etat.face ? "Votre budget actuel" : nomCourant,
    etat.budget,
    enregistre?.exercice ?? (etat.nom ? null : exerciceCourant()),
    // Le serment que l'atelier applique en ce moment : celui de l'adresse,
    // pas celui de l'enregistrement, qui peut avoir été relâché depuis.
    etat.contrat,
    null,
  );
  return [courante, face];
}

/**
 * Recharge un scénario : un ré-appel d'`afficherAtelier`, jamais une
 * modification d'`atelier.ts`. `afficherAtelier` est déjà ré-entrante
 * (`montage?.abort()` à son début, `simulateur-rendu.ts`) — recharger un
 * scénario est exactement ce cas, un nouvel état décodé contre les mêmes
 * `voletsMontes` déjà en place.
 */
function chargerScenario(nom: string): void {
  const scenario = listerScenarios(depotScenarios).find((s) => s.nom === nom);
  if (!scenario) return;
  etat.nom = scenario.nom;
  etat.budget = scenario.budget;
  etat.contrat = scenario.contrat;
  // Un scénario qui vient de se charger n'a plus de comparaison en cours :
  // la garder pointerait sur un état qui n'est plus celui qu'on regarde.
  etat.face = "";
  etat.faceNom = "";
  etat.faceExercice = "";
  ecrireUrl();
  // La nomenclature courante a pu laisser tomber des lignes depuis
  // l'enregistrement de ce scénario : `transposer` les nomme, là où `decoder`
  // seul les ignorerait en silence (voir sa docstring, atelier.ts).
  const { etat: etatTranspose, disparues, rienRepris } = transposer(scenario, voletsMontes);
  disparuesCourantes = { lignes: disparues, rienRepris };
  afficherAtelier($("simu"), voletsMontes, {
    etat: etatTranspose,
    contrat: scenario.contrat || null,
    surReglages: (encode: string, contrat: string | null) => {
      etat.budget = encode;
      etat.contrat = contrat ?? "";
      ecrireUrl();
      // Le tableau de comparaison, s'il est affiché, garde sinon l'effort et
      // les gestes du dernier geste avant celui-ci — un lecteur peut alors
      // comparer son réglage qui vient de changer contre une photo de ce
      // qu'il valait avant.
      montrerScenarios();
    },
  });
  montrerScenarios();
}

/** Enregistre l'état affiché sous un nom demandé au lecteur. */
function enregistrerScenarioCourant(): void {
  const nom = window.prompt("Nom du scénario", etat.nom || "");
  if (nom === null) return;
  enregistrerScenario(depotScenarios, {
    nom,
    budget: etat.budget,
    contrat: etat.contrat,
    exercice: exerciceCourant(),
  });
  // `enregistrer` nettoie le nom (espaces, longueur) avant de l'écrire ; un
  // nom vide ou fait d'espaces est refusé et ne doit pas marquer un scénario
  // courant qui n'a pas été créé. La règle de nettoyage vient de `scenarios.ts`,
  // jamais refaite ici : deux copies pouvaient s'écarter, et l'adresse aurait
  // alors nommé autre chose que ce qui a été écrit.
  const nomPropre = nomNettoye(nom);
  if (nomPropre) {
    etat.nom = nomPropre;
    // Ce qui est enregistré, c'est l'état affiché : les lignes qu'un scénario
    // chargé plus tôt avait perdues ne le décrivent plus. Sans cet oubli, la
    // notice continuait à nommer les réglages perdus par un AUTRE scénario, et
    // « Aucun réglage n'a pu être repris » restait affiché au-dessus des
    // propres curseurs du lecteur. Un enregistrement refusé (nom vide) ne
    // change rien à l'écran, donc n'efface rien.
    disparuesCourantes = { lignes: [], rienRepris: false };
    ecrireUrl();
  }
  montrerScenarios();
}

/**
 * Renomme le scénario que l'adresse nomme.
 *
 * `renommer` (scenarios.ts) refuse un nom vide et un nom déjà pris par un
 * AUTRE scénario — renommer vers un nom pris détruirait celui-là. La liste
 * rendue dit lequel des deux s'est produit : le nom d'origine y survit quand
 * le renommage a été refusé. L'adresse ne suit que sur un renommage
 * réellement fait, sans quoi elle nommerait un scénario qui n'existe plus —
 * le même soin que prend `supprimerScenarioCourant`.
 */
function renommerScenarioCourant(): void {
  const cible = scenarioNomme();
  if (!cible) return;
  const saisi = window.prompt("Nouveau nom du scénario", cible.nom);
  if (saisi === null) return;
  const apres = renommerScenario(depotScenarios, cible.nom, saisi);
  const nouveau = nomNettoye(saisi);
  if (nouveau !== null && !apres.some((s) => s.nom === cible.nom)) {
    etat.nom = nouveau;
    ecrireUrl();
  }
  montrerScenarios();
}

/**
 * Duplique le scénario que l'adresse nomme — le geste « créer mon
 * alternative » (spec §11) : partir d'un budget déjà bâti sans le perdre.
 *
 * La copie ne devient pas le scénario courant : l'écran montre toujours le
 * budget d'origine, et déplacer le nom de l'adresse sur la copie ferait
 * marquer « courant » dans la barre un scénario que le lecteur n'a pas ouvert.
 * `dupliquer` choisit lui-même le nom de la copie et garantit qu'il est libre.
 */
function dupliquerScenarioCourant(): void {
  const cible = scenarioNomme();
  if (!cible) return;
  dupliquerScenario(depotScenarios, cible.nom);
  montrerScenarios();
}

/** Supprime le scénario que l'adresse nomme actuellement. L'adresse ne doit
 *  plus, ensuite, nommer un scénario qui n'existe plus : sans quoi la barre
 *  perdrait sa marque « courant » sans rien dire, et un lien partagé
 *  rouvrirait un nom fantôme. */
function supprimerScenarioCourant(): void {
  const cible = scenarioNomme();
  if (!cible) return;
  // Le bouton est dans la même rangée qu'« Enregistrer ce budget » et porte
  // la même pilule : un clic à côté effaçait définitivement un scénario, sans
  // retour possible. La question dit ce qui va se passer, elle n'avertit de
  // rien d'autre.
  if (!window.confirm(`Supprimer le scénario « ${cible.nom} » ?`)) return;
  supprimerScenario(depotScenarios, cible.nom);
  etat.nom = "";
  // Le scénario supprimé n'est plus affiché : les lignes disparues qu'il
  // portait n'ont plus de scénario à décrire.
  disparuesCourantes = { lignes: [], rienRepris: false };
  ecrireUrl();
  montrerScenarios();
}

/**
 * Une face a-t-elle été choisie ?
 *
 * C'est le choix qui ouvre la comparaison, jamais un budget non vide : le
 * budget voté est l'atelier tous réglages à zéro (`budget: ""`), et un
 * scénario que le lecteur enregistre sans avoir rien réglé l'est tout autant.
 * Les tenir pour « pas de comparaison » n'affichait ni tableau ni bouton de
 * fermeture, et refermait au passage la comparaison en cours.
 *
 * `faceNom` porte le fait dans tous les chemins de choix — un scénario a
 * toujours un nom non vide (`scenarios.ts` refuse les autres), une entrée de
 * référence toujours un titre. `face` compte aussi : un lien antérieur à
 * `face-nom` porte un budget de face sans nom, et c'était bien une
 * comparaison.
 */
function faceChoisie(): boolean {
  return etat.faceNom !== "" || etat.face !== "";
}

/**
 * La barre des scénarios, et le tableau de comparaison quand une face a été
 * choisie. Reconstruite à chaque geste sur elle (enregistrer, charger,
 * comparer, supprimer, fermer la comparaison) **et à chaque réglage de
 * l'atelier**, par `surReglages` (`ouvrirSimulateur`, plus bas).
 *
 * Ce second appel n'est pas un supplément : les boutons de partage vivent dans
 * cette barre et ne s'offrent qu'avec un atelier réglé
 * (`partageDuSimulateur`). Sans lui, ils n'apparaîtraient qu'à qui a d'abord
 * touché à un scénario — c'est-à-dire jamais sur le parcours ordinaire, où on
 * règle puis on partage. Le commentaire d'avant affirmait le contraire
 * (« jamais sur un réglage de l'atelier lui-même ») : c'était faux, et si ça
 * ne l'avait pas été, le lot entier serait resté hors d'atteinte.
 */
function montrerScenarios(): void {
  const cible = document.getElementById("scenarios");
  if (!cible || !voletsMontes.length) return;
  const scenarios = listerScenarios(depotScenarios);

  const avertissement = persistant
    ? ""
    : `<p class="scenarios-rendu__vide">Stockage indisponible (navigation privée) : vos scénarios ne survivent pas au rechargement de la page.</p>`;

  // Les trois gestes qui portent sur un scénario du dépôt — renommer,
  // dupliquer, supprimer — ne s'offrent que quand l'adresse en nomme un qui
  // existe : proposer « Renommer « X » » pour un X que ce lecteur n'a pas,
  // c'est offrir un geste qui n'a rien à faire (voir `scenarioNomme`). Chacun
  // nomme sa cible, parce que l'écran peut montrer un budget retouché depuis.
  const nomme = scenarioNomme();
  const actions = `<div class="scenarios-rendu__liste">
    <button type="button" class="scenarios-rendu__scenario" id="scenario-enregistrer">Enregistrer ce budget</button>${
      nomme
        ? `<button type="button" class="scenarios-rendu__scenario" id="scenario-renommer">Renommer « ${echapper(
            nomme.nom,
          )} »</button><button type="button" class="scenarios-rendu__scenario" id="scenario-dupliquer">Dupliquer « ${echapper(
            nomme.nom,
          )} »</button><button type="button" class="scenarios-rendu__scenario" id="scenario-supprimer">Supprimer « ${echapper(
            nomme.nom,
          )} »</button>`
        : ""
    }
  </div>`;

  // Les scénarios du lecteur, et ceux du fichier de référence (budget voté,
  // chiffrages des analyses) — deux groupes distincts dans le même menu :
  // les seconds ne viennent pas du dépôt local, `Comparer à` doit le dire.
  // La marque « selected » se décide sur l'origine, jamais sur le libellé :
  // un scénario du lecteur et une entrée de référence peuvent porter le même
  // nom, et les deux options s'allumaient alors ensemble.
  const optionsScenarios = scenarios
    .map(
      (s) =>
        `<option value="scenario:${echapper(s.nom)}"${
          etat.faceSource === "scenario" && s.nom === etat.faceNom ? " selected" : ""
        }>${echapper(s.nom)}</option>`,
    )
    .join("");
  // Le budget voté n'a pas de slug : sa clé est la chaîne vide, qu'aucune
  // analyse ne peut porter. Une clé littérale (« neutre ») était collisionnable
  // par une analyse au slug homonyme, qui se serait affichée sous son titre
  // avec le budget voté dessous.
  const optionsReferences = referencesScenarios
    .map(
      (r) =>
        `<option value="reference:${echapper(r.slug ?? "")}"${
          etat.faceSource === `reference:${r.slug ?? ""}` ? " selected" : ""
        }>${echapper(r.titre)}</option>`,
    )
    .join("");

  // `scenarios-rendu__vide` dit « il n'y a rien ici », cadre pointillé compris :
  // le choix d'une face n'est pas un état vide, il ne s'affiche que quand il y
  // a quelque chose à comparer. Sa propre classe, donc.
  const choix = scenarios.length || referencesScenarios.length
    ? `<p class="scenarios-rendu__choix">
        <label for="scenario-face">Comparer à</label>
        <select id="scenario-face" class="pilule pilule--menu">
          <option value="">— choisir —</option>
          ${optionsScenarios ? `<optgroup label="Vos scénarios">${optionsScenarios}</optgroup>` : ""}
          ${optionsReferences ? `<optgroup label="Références">${optionsReferences}</optgroup>` : ""}
        </select>${
          faceChoisie()
            ? `<button type="button" class="scenarios-rendu__scenario" id="scenario-fermer-comparaison">Fermer la comparaison</button>`
            : ""
        }
      </p>`
    : "";

  // Les lignes qu'un scénario chargé portait et que la nomenclature courante
  // ne porte plus — nommées, jamais seulement comptées (voir `transposer`,
  // scenarios.ts).
  const disparues = renduDisparues(disparuesCourantes.lignes, disparuesCourantes.rienRepris);

  const tableau = faceChoisie()
    ? (() => {
        const colonnes = colonnesComparaison();
        return renduComparaison(colonnes, comparerScenarios(voletsMontes, colonnes));
      })()
    : "";

  // Les gestes de partage n'apparaissent qu'avec ce qu'ils ont à partager : un
  // atelier qu'on n'a pas encore réglé n'a ni écart ni silhouette, et un bouton
  // qui ne ferait rien est pire qu'un bouton absent. Sans image ici — le build
  // n'en écrit aucune par scénario (D-L3-b) — donc pas de lien de
  // téléchargement qui pointerait un fichier que rien ne produit.
  const gestes: GestePartage[] = [];
  if (partageDuSimulateur("scenario")) {
    gestes.push(
      { cle: "scenario", libelle: "Partager ce budget" },
      { cle: "forme", libelle: "Partager la forme" },
    );
  }
  if (faceChoisie()) gestes.push({ cle: "comparaison", libelle: "Partager la comparaison" });

  cible.innerHTML =
    avertissement +
    // La marque « courant » dit « c'est cela que vous regardez » : elle suit
    // donc `scenarioCourant()`, pas le nom nu. Un curseur bougé, et l'écran
    // ne montre plus ce scénario — le marquer encore serait le prétendre.
    renduBarre(scenarios, scenarioCourant()?.nom ?? null) +
    actions +
    (gestes.length ? rendrePartage(gestes, null) : "") +
    disparues +
    choix +
    tableau;
}

/* --------------------------------------------------------------------------
 * Partager : le panneau du système, sinon le presse-papiers
 * ----------------------------------------------------------------------- */

/** Un geste offert par un cadre de partage : la clé que l'écouteur relit, et
 *  ce que le bouton dit. */
type GestePartage = { cle: string; libelle: string };

/**
 * Le cadre de partage : les gestes, le message, et le repli qui reçoit le
 * texte quand le presse-papiers n'est pas disponible.
 *
 * **Aucun bouton de réseau social, aucun script tiers.** Le règlement européen
 * sur les données interdit déjà les polices distantes sur ce site ; un widget
 * de partage transmet exactement la même chose — l'adresse IP du lecteur et la
 * page qu'il lit — à un tiers qui ne lui a rien demandé. Rien ne quitte le
 * navigateur : `navigator.share` et le presse-papiers sont des gestes locaux.
 *
 * Le lien de téléchargement ne s'écrit que là où le build a écrit un fichier —
 * les analyses et le site. Ailleurs, `image` vaut `null` et le lien ne paraît
 * pas : un href vers une image que rien ne produit est un aperçu cassé de
 * plus, pas un partage.
 */
function rendrePartage(
  gestes: readonly GestePartage[],
  image: string | null,
  imageConstruite = false,
): string {
  const boutons = gestes
    .map(
      (geste) =>
        `<button type="button" class="partage__geste" data-partage="${echapper(
          geste.cle,
        )}">${echapper(geste.libelle)}</button>`,
    )
    .join("");
  const telecharger = image
    ? `<a class="partage__geste" href="${echapper(image)}" download>Télécharger l'image</a>`
    : "";
  // L'image d'une fiche n'a pas d'adresse — le build n'en rasterise pas 34 875
  // — mais elle existe : `carteFiche` la dessine, et le navigateur la
  // télécharge. Un bouton, donc, jamais un lien : il n'y a pas de href à
  // écrire, et un href mort est exactement ce que la règle ci-dessus refuse.
  const carte = imageConstruite
    ? `<button type="button" class="partage__geste" data-carte="1">Télécharger l'image</button>`
    : "";
  return `<div class="partage">
    ${boutons}${telecharger}${carte}
    <p class="partage__message" role="status" aria-live="polite"></p>
    <textarea class="partage__repli" readonly hidden aria-label="Résumé à copier"></textarea>
  </div>`;
}

/**
 * Ce que l'écran dit de chaque issue.
 *
 * `partagé` et `annulé` ne disent rien, et c'est délibéré : dans le premier
 * cas le panneau du système a déjà parlé ; dans le second le lecteur l'a fermé
 * lui-même, et « le partage a échoué » après une fermeture volontaire est un
 * mensonge à l'écran.
 */
const MESSAGE_PARTAGE: Record<Issue, string> = {
  partagé: "",
  annulé: "",
  copié: "Résumé et lien copiés.",
  indisponible: "Copie automatique indisponible : le texte ci-dessous est sélectionné.",
};

/**
 * Les deux canaux, tels que ce navigateur-ci les porte.
 *
 * `navigator.share` **n'existe pas** sur la plupart des navigateurs de bureau :
 * le repli presse-papiers n'est pas un cas limite, c'est le chemin d'une bonne
 * part des lecteurs. Les deux sont lus ici et passés à `offrir`, qui les traite
 * en fonctions ordinaires — c'est ce qui rend les deux chemins éprouvables sous
 * Node (partage.test.ts).
 */
function canauxDuNavigateur(): Canaux {
  return {
    partager:
      typeof navigator.share === "function"
        ? (charge) => navigator.share(charge)
        : undefined,
    copier: navigator.clipboard ? (texte) => navigator.clipboard.writeText(texte) : undefined,
  };
}

async function executerPartage(
  cadre: HTMLElement | null,
  objet: Partage,
  forme: Forme,
): Promise<void> {
  const issue = await offrir(objet, canauxDuNavigateur(), forme);
  if (!cadre) return;
  const message = cadre.querySelector<HTMLElement>(".partage__message");
  if (message) message.textContent = MESSAGE_PARTAGE[issue];
  const repli = cadre.querySelector<HTMLTextAreaElement>(".partage__repli");
  if (!repli) return;
  // Presse-papiers absent ou refusé : le texte s'affiche, sélectionné, et le
  // lecteur le copie lui-même. Sans lui, « indisponible » ne laisserait rien à
  // emporter.
  repli.hidden = issue !== "indisponible";
  if (issue !== "indisponible") return;
  repli.value = resume(objet, forme);
  repli.select();
}

/** Le geste de partage : un écouteur délégué, posé une seule fois sur un
 *  conteneur qui n'est jamais remplacé — même motif que `brancherScenarios`,
 *  dont le cadre est repeint à chaque réglage. */
function brancherPartage(
  conteneur: HTMLElement,
  composer: (cle: string) => { objet: Partage; forme: Forme } | null,
): void {
  conteneur.addEventListener("click", (evenement) => {
    const bouton = (evenement.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-partage]",
    );
    if (!bouton) return;
    const compose = composer(bouton.dataset.partage ?? "");
    if (!compose) return;
    void executerPartage(bouton.closest<HTMLElement>(".partage"), compose.objet, compose.forme);
  });
}

/**
 * Ce que le simulateur donne à partager.
 *
 * Le permalien se compose des paramètres que `ecrireUrl` écrit pour cet
 * objet-là, jamais de `location.href` : l'adresse courante porte aussi le
 * thème, l'indicateur et la maille de la carte, qui ne disent rien d'un budget.
 *
 * Le résumé, lui, vient d'`apercuScenario` — la seule rédaction d'un scénario
 * dans ce dépôt, celle que la fonction d'edge sert déjà aux robots. `null`
 * quand rien n'est réglé : il n'y a alors pas de scénario, donc pas de bouton.
 */
function partageDuSimulateur(cle: string): { objet: Partage; forme: Forme } | null {
  const lien = (parametres: Record<string, string>) =>
    permalien(location.origin, cheminDeVue("simulateur"), parametres);
  if (cle === "comparaison") {
    const [gauche, droite] = colonnesComparaison();
    return {
      objet: partageComparaison({
        colonnes: [gauche, droite],
        permalien: lien({
          budget: etat.budget,
          contrat: etat.contrat,
          nom: etat.nom,
          face: etat.face,
          "face-nom": etat.faceNom,
          "face-exercice": etat.faceExercice,
          "face-source": etat.faceSource,
        }),
      }),
      forme: "complet",
    };
  }
  const apercu = apercuScenario(voletsMontes, etat.budget, etat.nom);
  if (!apercu) return null;
  return {
    objet: partageScenario({
      apercu,
      permalien: lien({ budget: etat.budget, contrat: etat.contrat, nom: etat.nom }),
      // Les écarts du plan, déjà rendus le plus lourd d'abord : la silhouette
      // n'a rien à retrier, et ce sont les mêmes `decoder`/`plan` que l'atelier.
      ecarts: plan(voletsMontes, decoder(etat.budget, voletsMontes)).map((ligne) => ligne.delta),
    }),
    forme: cle === "forme" ? "compact" : "complet",
  };
}

/**
 * Ce qu'une analyse pré-rendue donne à partager : les mots que ses propres
 * balises portent.
 *
 * Le pré-rendu les a écrites et le build les vérifie (`validerImagesAnnoncees`,
 * scripts/prerendre.ts). Les relire ici plutôt que recomposer un texte garantit
 * que le collage et la carte de lien disent la même chose — et l'image est
 * celle que le build a rasterisée pour cette analyse, donc un fichier qui
 * existe.
 */
function partageDeLaPage(): { objet: Partage; forme: Forme } | null {
  const balise = (propriete: string) =>
    document.querySelector<HTMLMetaElement>(`meta[property="${propriete}"]`)?.content ?? "";
  const titre = balise("og:title");
  const adresse = balise("og:url");
  if (!titre || !adresse) return null;
  return {
    objet: partageAnalyse({
      titre,
      phrase: balise("og:description"),
      permalien: adresse,
      image: balise("og:image") || null,
    }),
    forme: "complet",
  };
}

/* --------------------------------------------------------------------------
 * La fiche de territoire, quatrième objet partageable (spec §13)
 * ----------------------------------------------------------------------- */

/**
 * Les trois repères de la fiche, avec ce qu'il faut pour les partager.
 *
 * `reperes()` rend le rôle, le terme et le nombre — ce qu'il faut à l'écran,
 * où l'entête de la fiche porte déjà l'unité et la source. Un chiffre qui SORT
 * du site en demande davantage : son unité, sa source et son millésime. C'est
 * `id` qui les donne, par le catalogue, et c'est pour cela qu'il existe.
 *
 * Rien n'est rendu si les trois ne partagent pas une source : `SourceCarte`
 * n'en nomme qu'une, et en choisir une pour trois serait la faute que ce lot
 * vient de corriger dans le catalogue lui-même.
 */
function reperesPartageables(
  niveau: string,
  territoire: Territoire,
): { chiffres: ChiffreCarte[]; source: string; exercice: string } | null {
  const trois = reperesDOuverture(territoire.series ?? {}, niveau).slice(0, 3);
  if (!trois.length) return null;
  const decrits = trois.map((repere) => {
    const indicateur = catalogue.find((candidat) => candidat.id === repere.id);
    return indicateur ? { repere, indicateur } : null;
  });
  if (decrits.some((decrit) => decrit === null)) return null;
  const connus = decrits as { repere: (typeof trois)[number]; indicateur: Indicateur }[];
  const sources = new Set(
    connus.map(({ indicateur }) => sourceDuNiveau(indicateur, niveau, jeux)),
  );
  if (sources.size !== 1) return null;
  return {
    chiffres: connus.map(({ repere, indicateur }) => ({
      libelle: repere.role,
      valeur: repere.valeur,
      unite: indicateur.unite,
      variation: repere.variation,
    })),
    source: [...sources][0],
    // L'exercice du premier repère : les trois viennent du même jeu, donc du
    // même chargement. Une carte qui daterait ses trois nombres d'un seul
    // millésime alors qu'ils en portent deux serait fausse — d'où le refus
    // ci-dessous plutôt qu'un « exercice le plus récent » qui masquerait l'écart.
    exercice: connus[0].repere.exercice,
  };
}

/** Ce qu'une fiche donne à partager : son nom, sa maille, trois chiffres. */
function partageDeLaFiche(niveau: string, code: string, territoire: Territoire): Partage | null {
  const lus = reperesPartageables(niveau, territoire);
  const maille = NIVEAUX[niveau] ?? niveau;
  return partageFiche({
    nom: territoire.nom,
    maille,
    exercice: lus?.exercice ?? "",
    reperes: lus?.chiffres ?? [],
    permalien: new URL(adresseTerritoire(code, niveau), location.origin).toString(),
  });
}

/**
 * L'image d'une fiche, dessinée dans le navigateur.
 *
 * Le build rasterise une image par analyse et une par section ; il n'en écrit
 * aucune par territoire, et trente-quatre mille huit cent soixante-quinze PNG
 * ne sont pas une option. `carteFiche` est pure et rend une chaîne : le SVG se
 * construit ici, au moment du geste, et `telecharger` le remet au lecteur —
 * c'est le même utilitaire que l'export CSV, avec ses tests.
 *
 * `null` quand la provenance manque : `carteFiche` **lève** dans ce cas
 * (`exigerProvenance`), et une exception au clic d'un bouton n'est pas une
 * réponse. Le bouton ne paraît alors pas.
 */
function carteDeLaFiche(niveau: string, territoire: Territoire): string | null {
  const lus = reperesPartageables(niveau, territoire);
  if (!lus) return null;
  return carteFiche({
    territoire: `${territoire.nom} — ${NIVEAUX[niveau] ?? niveau}`,
    chiffres: lus.chiffres,
    exercice: lus.exercice,
    source: { titre: lus.source, millesime: lus.exercice },
    site: location.origin,
  });
}

/**
 * Le cadre de partage au pied de la fiche, à toutes les mailles.
 *
 * Reposé à chaque fiche affichée — `afficherFiche` réécrit tout le panneau — et
 * ses écouteurs sont délégués sur `#fiche`, qui n'est jamais remplacé : même
 * motif que `brancherPartage` sur l'atelier.
 */
function poserPartageDeLaFiche(niveau: string, code: string, territoire: Territoire): void {
  const cible = document.getElementById("fiche-partage");
  if (!cible) return;
  fichePartagee = { niveau, code, territoire };
  cible.innerHTML = rendrePartage(
    [{ cle: "fiche", libelle: "Partager cette fiche" }],
    null,
    carteDeLaFiche(niveau, territoire) !== null,
  );
}

/** La fiche dont le cadre de partage est posé. Les écouteurs sont délégués et
 *  survivent au repeint du panneau ; ce qu'ils partagent, non. */
let fichePartagee: { niveau: string; code: string; territoire: Territoire } | null = null;

/** Les deux gestes du pied de fiche, posés une fois sur `#fiche`. */
function brancherPartageDeLaFiche(): void {
  const panneau = $("fiche");
  brancherPartage(panneau, () => {
    if (!fichePartagee) return null;
    const objet = partageDeLaFiche(
      fichePartagee.niveau,
      fichePartagee.code,
      fichePartagee.territoire,
    );
    return objet ? { objet, forme: "complet" as Forme } : null;
  });
  panneau.addEventListener("click", (evenement) => {
    const bouton = (evenement.target as HTMLElement).closest<HTMLElement>("button[data-carte]");
    if (!bouton || !fichePartagee) return;
    const svg = carteDeLaFiche(fichePartagee.niveau, fichePartagee.territoire);
    if (!svg) return;
    telecharger(
      svg,
      nomDeFichier(fichePartagee.territoire.nom, fichePartagee.niveau, "carte", "svg"),
      "image/svg+xml",
    );
  });
}

/**
 * Le cadre de partage d'une analyse, posé au pied de l'article.
 *
 * Branché avant tout appel réseau : une page d'analyse est servie entière par
 * le serveur, et son partage n'a aucune raison d'attendre le manifeste des
 * données — ni de disparaître si celui-ci ne répond pas.
 *
 * L'index des analyses n'a pas d'article (`.analyse-rendu`) et n'en reçoit
 * donc pas : il n'est le partage de rien, sa carte de lien est celle du site.
 */
function brancherPartageEditorial(): void {
  if (document.body.dataset.page !== "editorial") return;
  const article = document.querySelector<HTMLElement>(".analyse-rendu");
  const compose = partageDeLaPage();
  if (!article || !compose) return;
  article.insertAdjacentHTML(
    "beforeend",
    rendrePartage([{ cle: "analyse", libelle: "Partager cette analyse" }], compose.objet.image),
  );
  brancherPartage(article, partageDeLaPage);
}

/**
 * Les filtres de l'index des analyses (spec §9.1).
 *
 * La page est pré-rendue et servie entière : le filtrage bascule le `hidden`
 * des cartes déjà rendues, il ne recompose pas la liste. `main.ts` n'a pas les
 * analyses sous la main — chaque carte porte ses critères en `data-`, écrits
 * par `carteDeLAnalyse` (analyse-rendu.ts), et c'est la règle de ce module-là
 * qui décide : une seule correspondance, testée en données.
 *
 * La barre arrive repliée dans le HTML servi. Sans le paquet, aucun réglage
 * mort ne s'affiche et toutes les cartes restent lisibles ; c'est ici, une
 * fois les écouteurs posés, qu'elle se déplie.
 */
function brancherFiltresAnalyses(): void {
  const barre = document.getElementById("analyses-filtres");
  const liste = document.getElementById("analyses-index");
  if (!barre || !liste) return;
  const cartes = Array.from(liste.querySelectorAll("li"));
  const menus = Array.from(barre.querySelectorAll("select"));
  const champ = barre.querySelector("input");
  const compte = barre.querySelector("p");
  barre.hidden = false;
  // Un `<select>` émet `input` comme un champ de texte : un seul écouteur,
  // posé sur la barre, suffit aux quatre réglages.
  barre.addEventListener("input", function () {
    const criteres = { type: "", theme: "", budget: "", recherche: champ ? champ.value : "" };
    for (const menu of menus) {
      if (menu.dataset.facette === "type") criteres.type = menu.value;
      if (menu.dataset.facette === "theme") criteres.theme = menu.value;
      if (menu.dataset.facette === "budget") criteres.budget = menu.value;
    }
    let retenues = 0;
    for (const carte of cartes) {
      const retenue = carteRetenue(
        {
          type: carte.dataset.type ?? "",
          themes: carte.dataset.themes ?? "",
          budgets: carte.dataset.budgets ?? "",
          texte: carte.dataset.cherche ?? "",
        },
        criteres,
      );
      carte.hidden = !retenue;
      if (retenue) retenues += 1;
    }
    // Ce que le réglage a retranché se dit, sinon une page qui se vide ne se
    // distingue pas d'une page en panne. Rien à dire quand rien n'est retiré.
    if (compte) {
      compte.textContent =
        retenues === cartes.length
          ? ""
          : `${retenues} analyse${retenues > 1 ? "s" : ""} sur ${cartes.length}`;
    }
  });
}

/* --------------------------------------------------------------------------
 * Citer : le nombre, son unité, sa source, son millésime et le permalien
 * ----------------------------------------------------------------------- */

/**
 * Ce que l'écran dit de chaque issue.
 *
 * Le presse-papiers manque (contexte non sécurisé) ou refuse (permission, geste
 * non reconnu comme volontaire) plus souvent qu'on ne le croit : `indisponible`
 * n'est pas un cas rare, c'est celui où le lecteur reçoit le texte à copier
 * lui-même, sélectionné.
 */
const MESSAGE_CITATION: Record<IssueCitation, string> = {
  copié: "Citation copiée.",
  indisponible: "Copie automatique indisponible : la citation ci-dessous est sélectionnée.",
};

/** Le presse-papiers, tel que ce navigateur-ci le porte — lu ici, passé en
 *  fonction ordinaire à `offrirCitation`, qui le traite comme tel : c'est ce
 *  qui rend le chemin éprouvable sous Node (citer.test.ts), même motif que
 *  `canauxDuNavigateur`. */
function presseDuNavigateur(): Presse | undefined {
  return navigator.clipboard ? (texte) => navigator.clipboard.writeText(texte) : undefined;
}

/**
 * La charge utile d'un bouton, relue et vérifiée.
 *
 * `citable` est appelée ici aussi, et ce n'est pas une redondance avec le
 * rendu : l'attribut a traversé le document, et une citation incomplète ne
 * doit pas produire un message d'échec au clic — elle ne doit rien produire
 * du tout. C'est la même limite qu'au rendu, tenue au même endroit qu'elle
 * se lit.
 */
function chargeCitation(bouton: HTMLElement): Citation | null {
  const brute = bouton.dataset.citer;
  if (!brute) return null;
  try {
    const citation = JSON.parse(brute) as Citation;
    return citable(citation) ? citation : null;
  } catch {
    return null;
  }
}

/** Le retour du geste, posé à côté du bouton et réutilisé : un second clic ne
 *  doit pas empiler deux messages sous le même chiffre. */
function retourDeCitation(bouton: HTMLElement): HTMLElement {
  const voisin = bouton.nextElementSibling;
  if (voisin instanceof HTMLElement && voisin.classList.contains("citer__retour")) return voisin;
  const cadre = document.createElement("span");
  cadre.className = "citer__retour";
  cadre.setAttribute("role", "status");
  cadre.setAttribute("aria-live", "polite");
  bouton.after(cadre);
  return cadre;
}

async function executerCitation(bouton: HTMLElement): Promise<void> {
  const citation = chargeCitation(bouton);
  if (!citation) return;
  const issue = await offrirCitation(citation, presseDuNavigateur());
  const cadre = retourDeCitation(bouton);
  cadre.textContent = MESSAGE_CITATION[issue];
  if (issue !== "indisponible") return;
  // Sans ce repli, « indisponible » ne laisserait rien à emporter — et c'est
  // précisément la citation qu'on venait chercher. En lecture seule : ce qui
  // est copié doit être ce que le site a composé.
  const repli = document.createElement("textarea");
  repli.className = "citer__repli";
  repli.readOnly = true;
  repli.setAttribute("aria-label", "Citation à copier");
  repli.value = citer(citation);
  cadre.append(repli);
  repli.select();
}

/**
 * La commande « citer », posée une seule fois sur l'article.
 *
 * Un écouteur délégué sur un conteneur qui n'est jamais remplacé — même motif
 * que `brancherPartage` et `brancherScenarios`. L'article d'une analyse est
 * servi entier par le pré-rendu et ne se repeint jamais : les boutons y sont
 * déjà, avec leur charge utile, avant que la première donnée n'arrive.
 *
 * **Les boutons ne sont pas posés ici, et c'est la limite du lot.** C'est
 * `analyse-rendu.ts` qui décide, chiffre par chiffre, s'il peut composer une
 * citation honnête — il est le seul à connaître la source et l'exercice de
 * chacun. Un rendu qui ne les connaît pas n'émet aucun attribut, et cette
 * fonction n'a alors rien à écouter.
 */
function brancherCitations(): void {
  const article = document.querySelector<HTMLElement>(".analyse-rendu");
  if (!article) return;
  article.addEventListener("click", (evenement) => {
    const bouton = (evenement.target as HTMLElement).closest<HTMLElement>("button[data-citer]");
    if (bouton) void executerCitation(bouton);
  });
}

/** Les écouteurs de la barre, posés une seule fois : `#scenarios` n'est
 *  jamais remplacé, seul son contenu l'est à chaque `montrerScenarios()` —
 *  les poser à chaque rendu les aurait empilés, comme pour l'atelier sans son
 *  `AbortController`. */
function brancherScenarios(): void {
  const cible = document.getElementById("scenarios");
  if (!cible) return;
  // Le partage a son propre écouteur sur le même conteneur : une préoccupation,
  // un écouteur, et aucun des deux ne se repose à chaque rendu.
  brancherPartage(cible, partageDuSimulateur);
  cible.addEventListener("click", (evenement) => {
    const cibleClic = evenement.target as HTMLElement;
    const boutonScenario = cibleClic.closest<HTMLButtonElement>("[data-nom]");
    if (boutonScenario?.dataset.nom) return chargerScenario(boutonScenario.dataset.nom);
    if (cibleClic.closest("#scenario-enregistrer")) return enregistrerScenarioCourant();
    if (cibleClic.closest("#scenario-renommer")) return renommerScenarioCourant();
    if (cibleClic.closest("#scenario-dupliquer")) return dupliquerScenarioCourant();
    if (cibleClic.closest("#scenario-supprimer")) return supprimerScenarioCourant();
    if (cibleClic.closest("#scenario-fermer-comparaison")) {
      etat.face = "";
      etat.faceNom = "";
      etat.faceExercice = "";
      etat.faceSource = "";
      ecrireUrl();
      return montrerScenarios();
    }
  });
  cible.addEventListener("change", (evenement) => {
    const champ = (evenement.target as HTMLElement).closest<HTMLSelectElement>("#scenario-face");
    if (!champ) return;
    // Le préfixe dit d'où vient la sélection : un scénario du dépôt local,
    // ou une entrée du fichier de référence (voir le rendu du menu,
    // `montrerScenarios`).
    if (champ.value.startsWith("reference:")) {
      const cle = champ.value.slice("reference:".length);
      const reference = referencesScenarios.find((r) => (r.slug ?? "") === cle);
      etat.face = reference?.budget ?? "";
      etat.faceNom = reference?.titre ?? "";
      etat.faceSource = reference ? `reference:${reference.slug ?? ""}` : "";
      // Le budget voté (`slug: null`) N'EST PAS un scénario dont on ignore
      // l'origine : c'est l'atelier tel que monté à l'instant, donc le même
      // exercice que la colonne « vive » — `exerciceCourant()` le dit vrai,
      // ce n'est pas un repli plausible. Une entrée issue d'une analyse, elle,
      // ne porte aucun exercice vérifiable (voir prerendre.ts,
      // `entreesReference`) : `null` reste honnête, jamais deviné.
      etat.faceExercice = !reference
        ? ""
        : reference.slug === null
          ? exerciceCourant() ?? ""
          : reference.exercice ?? "";
    } else {
      const nom = champ.value.startsWith("scenario:") ? champ.value.slice("scenario:".length) : "";
      const choisi = listerScenarios(depotScenarios).find((s) => s.nom === nom);
      etat.face = choisi?.budget ?? "";
      etat.faceNom = choisi?.nom ?? "";
      etat.faceExercice = choisi?.exercice ?? "";
      etat.faceSource = choisi ? "scenario" : "";
    }
    ecrireUrl();
    montrerScenarios();
  });
}

/**
 * L'atelier, monté une seule fois.
 *
 * Tous les budgets sont chargés en parallèle à la première ouverture : la page
 * les montre tous et la recherche les traverse tous, il n'y a donc rien à
 * différer. Un volet qui échoue à se charger sort de la liste plutôt que de
 * laisser une section vide au milieu de la page.
 */
async function ouvrirSimulateur(): Promise<void> {
  if (atelierMonte || !exercicesParVolet.length) return;
  atelierMonte = true;
  const charges = await Promise.all(
    exercicesParVolet.map(async ({ volet, exercice }) => {
      try {
        return await volet.charger(exercice);
      } catch {
        return null;
      }
    }),
  );
  const volets: Volet[] = charges.filter((v): v is Volet => v !== null);
  if (!volets.length) {
    document.querySelector('.entete__nav a[data-vue="simulateur"]')?.remove();
    atelierMonte = false;
    return basculerVue();
  }
  voletsMontes = volets;
  // Le budget que l'adresse porte passe par la même porte qu'un scénario
  // cliqué : c'est le chemin d'un lien partagé et du bouton « Rejouer » d'une
  // analyse, donc précisément celui où le lecteur n'a aucune autre copie de ce
  // que ce budget contenait. `decoder` seul aurait laissé tomber sans un mot
  // les lignes que la nomenclature ne porte plus.
  const ouverture = transposerBudget(etat.budget, volets);
  disparuesCourantes = { lignes: ouverture.disparues, rienRepris: ouverture.rienRepris };
  afficherAtelier($("simu"), volets, {
    etat: ouverture.etat,
    contrat: etat.contrat || null,
    surReglages: (encode: string, contrat: string | null) => {
      etat.budget = encode;
      etat.contrat = contrat ?? "";
      ecrireUrl();
      // Sans cet appel, la colonne « courante » du tableau de comparaison
      // gardait l'effort et les gestes du geste précédent : un lecteur
      // comparait alors son réglage tout juste changé à une photo de ce
      // qu'il valait avant. `montrerScenarios()` est déjà la fonction qui
      // reconstruit ce tableau ailleurs (chargement, enregistrement,
      // suppression) ; elle ne touche que `#scenarios`, jamais `#simu` où vit
      // l'atelier, donc rien n'y perd le focus.
      montrerScenarios();
    },
  });
  // Le récapitulatif ne se règle pas : il dit ce que les budgets réglables ne
  // peuvent pas dire — leur somme, dans le seul cadre qui l'autorise.
  try {
    afficherRecapitulatif($("simu-recapitulatif"), await donnees.recapitulatifNational());
    // Même motif qu'à `peindreMethode` : le retour du peintre commande la
    // visibilité de son conteneur. `.simu-recapitulatif` porte désormais le
    // même cadre bordé, ombré que `.simu` (padding, fond, bordure, ombre) —
    // avant cette bascule, la section restait visible sans `hidden` et
    // peignait ce cadre vide le temps du fetch, ou en permanence si le
    // fichier n'est pas publié.
    $("simu-recapitulatif").hidden = false;
  } catch {
    // Fichier non publié : l'atelier reste entier, le cadre reste caché.
    $("simu-recapitulatif").hidden = true;
  }
  // La barre des scénarios est montée après l'atelier, mais elle ne dépend
  // pas de lui : elle lit le dépôt, jamais `#simu`. Les écouteurs ne sont
  // posés qu'une fois — `ouvrirSimulateur` elle-même ne s'exécute qu'une
  // fois, gardée par `atelierMonte` en tête de fonction.
  //
  // Le fichier de référence (budget voté, chiffrages des analyses) est chargé
  // avant de peindre la barre : ses entrées doivent apparaître dès le premier
  // rendu, pas surgir après coup dans le menu.
  await chargerReferences();
  brancherScenarios();
  montrerScenarios();
}

async function demarrer(): Promise<void> {
  // Avant toute donnée : la bascule de thème n'attend rien du réseau, et une
  // page en panne doit rester lisible dans le thème du lecteur.
  brancherTheme();
  // Pour la même raison : une analyse est servie entière par le serveur, avec
  // ses balises et son image déjà écrites. Son partage n'attend donc pas le
  // manifeste des données, et ne disparaît pas si celui-ci ne répond pas.
  brancherPartageEditorial();
  // Et pour la même raison : l'index des analyses est servi entier, cartes
  // comprises. Ses filtres n'attendent donc rien du réseau — un manifeste muet
  // ne doit pas laisser sa barre repliée sur une liste qu'on voulait réduire.
  brancherFiltresAnalyses();
  // Et pour la même raison encore : les chiffres citables portent déjà leur
  // charge utile, écrite par le pré-rendu. La commande « citer » n'attend donc
  // aucune donnée, et un manifeste muet ne l'emporte pas avec lui.
  brancherCitations();
  // Le pied de fiche, lui, attend bien les données — c'est le catalogue qui
  // donne l'unité et la source de ses trois repères. Ses écouteurs, en
  // revanche, sont posés dès maintenant : ils sont délégués sur `#fiche`, qui
  // n'est jamais remplacé, et le cadre qu'ils servent apparaît avec la fiche.
  brancherPartageDeLaFiche();
  // Et encore pour la même raison : l'appel « Chercher ma commune » de
  // l'accueil ne fait que donner le curseur au champ de l'en-tête, qui existe
  // dès le premier octet de HTML.
  brancherAppelRecherche();
  // L'état AVANT la première bascule de vue. `basculerVue` peint la vue
  // demandée, et ANALYSES lit `etat.selection` pour savoir si elle a un
  // territoire à détailler : lu avant d'être écrit, il levait
  // `Cannot read properties of undefined`. La levée partait dans un `void`,
  // donc sans rien à l'écran — un lien `#analyses` partagé s'ouvrait sur une
  // page blanche, et seulement au chargement à froid : en naviguant depuis une
  // autre vue du site, `etat` existait déjà et la page s'affichait.
  // `lireUrl` ne lit que `location.search` : rien ne l'obligeait à attendre le
  // réseau.
  etat = lireUrl();
  // Les liens partagés avant l'existence des chemins portent la vue dans le
  // fragment : on les réécrit vers leur chemin, sans rechargement et sans
  // toucher aux paramètres. Une ancre interne (`#bloc-etat`) n'est pas une vue
  // et reste intacte.
  const fragmentInitial = location.hash;
  const vueDuFragment = location.pathname === "/" ? vueDepuisAdresse("/", fragmentInitial) : null;
  if (vueDuFragment) {
    // La règle `#carte` vit dans `basculerVue`, mais la réécriture ci-dessous
    // efface le fragment avant qu'elle ne puisse s'y appliquer : un lien
    // `/#carte` n'ouvrait la carte déployée que parce que `carteOuverte` vaut
    // `true` au départ, ce qu'aucun test ne reliait.
    if (fragmentInitial === "#carte") carteOuverte = true;
    history.replaceState(null, "", `${cheminDeVue(vueDuFragment)}${location.search}`);
  }
  window.addEventListener("hashchange", basculerVue);
  window.addEventListener("popstate", basculerVue);
  basculerVue();
  const manifeste = await donnees.initialiser();
  // Un seul champ pour tout le site, dans l'en-tête : il y en avait deux, sur
  // le même index, sans état commun. Câblé ici, avant la garde éditoriale
  // ci-dessous, pour fonctionner aussi bien sur la carte que sur une page
  // pré-rendue — les deux partagent le même en-tête.
  brancherRecherche($<HTMLInputElement>("recherche"), $<HTMLUListElement>("suggestions"));
  // Une page éditoriale n'a ni carte ni panneau : tout ce qui suit — sélecteurs,
  // blocs nationaux, MapLibre — suppose les conteneurs de la vue territoire et
  // lèverait sur un `$` renvoyant `null` avant d'avoir rien peint (défaut
  // signalé par le rapport de la tâche 4 : `data-page="editorial"` était écrit
  // sans qu'aucun code ne le lise). Le thème est déjà branché avant tout fetch
  // (`brancherTheme()`), et la navigation n'est que des liens sans `data-vue`
  // qui se rechargent — exactement le comportement voulu ici.
  if (document.body.dataset.page === "editorial") return;
  jeux = manifeste.jeux;
  catalogue = await donnees.indicateurs();
  // Les indicateurs calculés entrent au catalogue comme les autres : thèmes,
  // fiche, synthèse, tableau et export les traitent alors sans rien savoir de
  // leur origine. Leur badge et leur fiche disent d'où ils viennent.
  catalogue = [...catalogue, ...indicateursDerives(catalogue)];
  // L'accueil peut peindre : il compte les indicateurs publiés et nomme les
  // producteurs des jeux, deux choses qu'il ne pouvait pas dire avant.
  resoudrePubliee();
  construireSelecteurs();
  afficherQuestions($("questions"));
  // La France du panneau d'accueil, demandée avant la carte : c'est la
  // première chose à l'écran, elle ne doit pas attendre les tuiles.
  void chargerFrance();
  // Sans attendre : l'index dit seulement s'il faut proposer le simulateur, et
  // la carte n'a pas à patienter pour ça.
  void preparerSimulateur();

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
    // Rabattue par défaut : MapLibre l'affiche dépliée, et la ligne de crédits
    // — quatre producteurs et une licence — occupait le bas de la carte en
    // permanence pour une mention qu'on lit une fois. `compact` la réduit au
    // bouton « i » ; rien n'est retiré, la licence reste à un clic, ce que la
    // Licence Ouverte demande.
    attributionControl: {
      compact: true,
      customAttribution: "IGN Admin Express · OFGL · Licence Ouverte 2.0",
    },
  });
  carte.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  // Le canevas est dans l'ordre de tabulation par défaut : à la cinquième
  // tabulation, le focus entrait dans la carte et n'en ressortait plus, sur un
  // élément qui n'offre rien au clavier. Les commandes, elles, restent
  // atteignables : les boutons de zoom sont des `button` posés à côté du
  // canevas, pas dedans, et le tableau de la vue Données donne l'équivalent
  // textuel de ce que la carte peint.
  carte.getCanvas().setAttribute("tabindex", "-1");

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
    __diag: () => ({
      entites: Object.keys(entites).length,
      un: entiteDe("28", etat.niveau),
      niveau: etat.niveau,
      // La carte peint depuis l'index de la maille : sans lui, elle est
      // retombée sur les lots, et c'est ce qu'il faut pouvoir constater.
      index: repertoire ? Object.keys(repertoire.noms).length : 0,
      populations: Object.keys(populations).length,
    }),
    // Le groupe de comparaison ne s'affichait pas et rien ne disait pourquoi :
    // trois valeurs à lire — la clé construite, la période, ce qui est trouvé.
    __groupe: (code: string) => {
      const t = entiteDe(code, etat.niveau);
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
        // Ce clic vient-il du geste qu'on vient de faire sur la poignée du
        // tiroir ? Alors il ne désigne pas un territoire, il désigne le vide
        // que la poignée a laissé sous le doigt.
        if (gardePoignee.absorbe()) return;
        const code = evenement.features?.[0]?.properties?.code as string | undefined;
        // Un clic sur la carte sélectionne toujours à la maille peinte : il
        // referme une fiche d'arrondissement ouverte par la recherche.
        if (code) await ouvrirTerritoire(code, etat.niveau);
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
        // Les tuiles portent le code là où l'on attendait le libellé (« 75 »
        // pour la Nouvelle-Aquitaine) : le nom vient du référentiel, comme
        // pour les étiquettes.
        const nom = nomDe(code);
        const valeur = affichees[code];
        const indicateur = indicateurCourant();
        // En mode évolution : la variation signée, ET les deux valeurs dont
        // elle vient — une variation seule ne se vérifie pas.
        if (evolutionAffichee) {
          const e = evolutionAffichee.couche[code];
          infobulle.innerHTML = `<strong>${nom}</strong>${
            e
              ? `<span>${formaterVariation(
                  e.variation,
                  indicateur.unite,
                  evolutionAffichee.mode,
                )}</span><span class="infobulle__autre">${evolutionAffichee.avant} : ${formater(
                  e.avant,
                  indicateur.unite,
                  parHabitantAffiche,
                )}, ${etat.periode} : ${formater(e.apres, indicateur.unite, parHabitantAffiche)}</span>`
              : `<span>pas publié dans les deux années, ou partait de zéro</span>`
          }`;
        } else {
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
        }
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

  peindreSommaireReperes();

  await majComparateur();

  // « Sources et méthode » quitte la fiche pour la vue Données : c'est une
  // référence qu'on consulte, pas un bandeau qu'on subit à chaque clic.
  // Elle porte tout : d'où viennent les jeux, comment chaque indicateur est
  // défini et calculé, et ce qui rend deux territoires comparables.
  const parTheme = new Map<string, Indicateur[]>();
  for (const indicateur of catalogue) {
    parTheme.set(indicateur.theme, [...(parTheme.get(indicateur.theme) ?? []), indicateur]);
  }
  if (!document.getElementById("sources-contenu")) return;
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
        ([theme, liste]) => `<details class="repli" id="methode-${theme}">
          <summary>${libelleTheme(theme)} (${liste.length})</summary>
          <ul class="methodes">${liste
            .map(
              (i) => `<li><strong>${emphase(traduire(i.libelle))}</strong> : ${emphase(i.definition)}
                <br /><span class="technique">${emphase(i.definition_technique)}</span>
                <br /><span class="formule">Calcul : ${emphase(i.formule)}</span></li>`,
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
        référence</strong> de la capacité de désendettement, fixé par la loi n° 2018-32 du
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
        l'intercommunalité : dans une métropole intégrée, la voirie, les déchets
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

  brancherSommaireSources([...parTheme.entries()]);

  // Les agrégats nationaux et les repères de lecture ne se chargent plus : ils
  // n'alimentaient que les lignes de mesures de la fiche, qui n'y sont plus.
  // Deux fichiers de moins à télécharger pour ouvrir un territoire.

  // Les mailles supérieures, pour comparer : quelques kilo-octets, chargés une
  // fois pour toutes.
  Promise.all([
    donnees.territoires("departement", "tous").catch(() => ({})),
    donnees.territoires("region", "tous").catch(() => ({})),
    donnees.territoires("pays", "tous").catch(() => ({})),
  ])
    .then(([dep, reg, pays]) => {
      // **Une clé par maille, jamais le code nu.**
      //
      // « 75 » est le département de Paris *et* la région Nouvelle-Aquitaine.
      // Les trois mailles vivaient dans la même table, et la dernière étalée
      // écrasait les précédentes : la fiche de Paris annonçait donc « Commune ·
      // Nouvelle-Aquitaine ». La collision touchait tous les départements dont
      // le code est aussi un code de région — 01, 11, 24, 27, 28, 32, 44, 52,
      // 53, 75, 76, 84, 93, 94 —, soit quatorze départements.
      parents = {
        ...cleParMaille(dep as Record<string, Territoire>, "departement"),
        ...cleParMaille(reg as Record<string, Territoire>, "region"),
        ...cleParMaille(pays as Record<string, Territoire>, "pays"),
      };
      // Le panneau d'accueil EST la fiche de la France : il ne peut donc
      // s'afficher qu'une fois la maille « pays » arrivée. Sans ce second
      // rendu, l'aperçu de couche restait à l'écran jusqu'au premier clic.
      if (etat.selection) void montrerFiche(etat.selection);
      else afficherApercu();
    })
    .catch(() => {});

}

/**
 * La panne de chargement.
 *
 * Elle s'écrivait sur une ligne rouge dans la fiche, sans dire ce qui était en
 * panne, ni ce que le lecteur pouvait en faire, ni où en trouver l'état. Le
 * message technique reste — c'est lui qu'on cite pour signaler —, mais replié :
 * `Failed to fetch` n'apprend rien à qui vient lire un budget.
 */
demarrer().catch((erreur: Error) => {
  // Une analyse pré-rendue porte son texte et ses chiffres dans le HTML servi :
  // elle n'a ni `#fiche` ni `#vue-accueil` où écrire, et `$` y renverrait
  // `null` — la panne se doublait d'une levée dans son propre rattrapage.
  if (document.body.dataset.page === "editorial") return;
  const detail = erreur?.message ? String(erreur.message) : "cause inconnue";
  // Un `div`, pas un `p` : `<details>` est du contenu de flux, et un paragraphe
  // n'accepte que du contenu de phrasé. L'analyseur HTML fermait donc le
  // paragraphe avant le pli et le jetait — le détail technique, seul élément
  // citable pour signaler une panne, n'était jamais affiché.
  //
  // Elle s'écrit dans la vue affichée : sur l'accueil, le panneau de la carte
  // est masqué, et y écrire laisserait la racine du site entièrement blanche,
  // sans un mot sur ce qui a échoué.
  const hote = document.body.dataset.vue === "accueil" ? $("vue-accueil") : $("fiche");
  hote.innerHTML = `<div class="etat etat--echec" role="alert">
      <span class="etat__titre">Les chiffres n'ont pas pu être chargés</span>
      <span class="etat__quoi">Le site lit des fichiers publiés sur un serveur public :
        c'est cette lecture qui a échoué, pas votre navigateur. Les chiffres déjà affichés,
        s'il y en a, restent ceux du dernier chargement réussi.</span>
      <span class="etat__reessayer">
        <button type="button" class="bouton-filet" onclick="location.reload()">Réessayer</button>
      </span>
      <details class="etat__detail"><summary>Détail technique</summary>
        <code></code></details>
    </div>`;
  // Par `textContent` et non dans le gabarit : un message d'erreur peut porter
  // une URL, et une URL peut porter des chevrons.
  const bloc = hote.querySelector("code");
  if (bloc) bloc.textContent = detail;
});
