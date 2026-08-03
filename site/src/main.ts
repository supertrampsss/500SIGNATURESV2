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
import {
  couleurCellule,
  enLog,
  joindre,
  lectureDeR,
  matrice,
  moindresCarres,
  paires,
  pearson,
  type PointNomme,
  type SerieCroisable,
} from "./croiser.ts";
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
  /** La maille suit le zoom : voir NIVEAU_PAR_ZOOM. Choisir un niveau à la
   *  main la fige — un réglage explicite ne doit pas être écrasé. */
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
    niveau: p.get("niveau") === "auto" || !p.get("niveau") ? "region" : (p.get("niveau") as string),
    niveauAuto: p.get("niveau") === "auto" || !p.get("niveau"),
    periode: p.get("periode") ?? "",
    declinaison: p.get("affichage") ?? "habitant",
    selection: p.get("territoire"),
    comparaison: (p.get("comparer") ?? "").split(",").filter(Boolean).slice(0, MAXIMUM),
    vue: p.get("vue") ?? "metropole",
  };
}

function ecrireUrl(): void {
  const p = new URLSearchParams({
    theme: etat.theme,
    indicateur: etat.indicateur,
    niveau: etat.niveauAuto ? "auto" : etat.niveau,
    periode: etat.periode,
    affichage: etat.declinaison,
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
  // L'analyse prolonge la carte : elle suit l'indicateur et le niveau choisis.
  if (!$("volet-analyse").hidden) {
    if (modeAnalyse === "matrice") void majMatrice();
    else void majCroisement();
  }

  affichees = Object.fromEntries(
    Object.entries(valeurs)
      .map(([code, brut]) => [code, parHabitant ? brut / (populations[code] ?? NaN) : brut])
      .filter(([, v]) => Number.isFinite(v as number)),
  ) as Record<string, number>;
  parHabitantAffiche = parHabitant;
  brutes = valeurs;
  majPalmares();

  if (etat.selection) {
    await montrerFiche(etat.selection);
  } else {
    afficherApercu();
  }
}

/** Tant que rien n'est sélectionné, le panneau montre la couche affichée
 *  plutôt qu'une invitation vide. */
function afficherApercu(): void {
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

/** Les cinq valeurs les plus hautes et les plus basses de la couche affichée.
 *
 *  Même niveau, même indicateur, même période, même unité : le classement est
 *  comparable par construction — c'est la même règle que le tableau. Il est
 *  neutre : « haut » et « bas » sont des positions, jamais un jugement, et le
 *  libellé nomme l'unité pour qu'un montant total ne se lise pas comme un
 *  montant par habitant. */
function majPalmares(): void {
  const bloc = $("palmares");
  const tri = Object.entries(affichees).sort(([, a], [, b]) => b - a);
  if (tri.length < 8) {
    bloc.hidden = true;
    return;
  }
  const indicateur = indicateurCourant();
  const nomDe = (code: string) => entites[code]?.nom ?? code;
  const ligne = ([code, valeur]: [string, number]) =>
    `<li><button type="button" data-code="${code}"><span>${nomDe(code)}</span>
      <strong>${formater(valeur, indicateur.unite, parHabitantAffiche)}</strong></button></li>`;
  bloc.innerHTML = `
    <h3 class="palmares__titre" title="${indicateur.libelle} — ${etat.periode}${
      parHabitantAffiche ? ", par habitant" : ""
    }">Extrêmes de la couche</h3>
    <p class="palmares__borne">Les plus hautes</p>
    <ol class="palmares__liste">${tri.slice(0, 5).map(ligne).join("")}</ol>
    <p class="palmares__borne">Les plus basses</p>
    <ol class="palmares__liste">${tri.slice(-5).reverse().map(ligne).join("")}</ol>`;
  bloc.hidden = false;
  bloc.querySelectorAll<HTMLButtonElement>("button[data-code]").forEach((b) =>
    b.addEventListener("click", () => {
      const code = b.dataset.code;
      if (code) void montrerFiche(code);
    }),
  );
}

/** Marges de cadrage : les surcouches (commandes à gauche, panneau à droite)
 *  recouvrent la carte — un cadrage qui les ignore cacherait la Bretagne
 *  derrière un formulaire. */
function paddingCarte(): { top: number; bottom: number; left: number; right: number } {
  const large = window.innerWidth > 960;
  return large
    ? { top: 40, bottom: 56, left: 320, right: Math.min(420, window.innerWidth * 0.32) }
    : { top: 128, bottom: 48, left: 16, right: 16 };
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
  $<HTMLSelectElement>("vue").value = vue;
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
    // Filtré sur le niveau : afficher « donnée non disponible » pour un
    // indicateur qui n'existe pas à ce niveau ferait passer une absence de
    // définition pour une absence de mesure.
    indicateurs: catalogue.filter(
      (i) => i.theme === etat.theme && i.niveaux?.includes(etat.niveau),
    ),
    jeux,
    periode: etat.periode,
    parHabitant: etat.declinaison === "habitant",
    references: reperes,
  });
  ajouterBoutonComparer(code);
  $("panneau").classList.add("panneau--selection");
}

/** Ferme la sélection : le panneau revient à l'aperçu de la couche. */
function fermerPanneau(): void {
  etat.selection = null;
  ecrireUrl();
  $("panneau").classList.remove("panneau--selection");
  afficherApercu();
}

/** Le bouton vit sur la fiche : on compare un territoire qu'on est en train de
 *  regarder, pas une ligne d'une liste. */
function ajouterBoutonComparer(code: string): void {
  const dedans = etat.comparaison.includes(code);
  const complet = !dedans && etat.comparaison.length >= MAXIMUM;
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = "comparer";
  bouton.disabled = complet;
  bouton.textContent = complet
    ? `Comparaison complète (${MAXIMUM} territoires)`
    : dedans
      ? "Retirer de la comparaison"
      : "Ajouter à la comparaison";
  bouton.addEventListener("click", async () => {
    etat.comparaison = dedans
      ? etat.comparaison.filter((c) => c !== code)
      : [...etat.comparaison, code];
    ecrireUrl();
    await majComparateur();


    ajouterBoutonComparer(code);
  });
  $("fiche").querySelector(".comparer")?.remove();
  $("fiche").querySelector(".comparer-lien")?.remove();
  $("fiche").querySelector(".fiche__meta")?.after(bouton);
  // Le tableau de comparaison vit dans la vue Données : sans ce lien, le
  // bouton semblait ne rien faire — il faisait, mais hors de l'écran.
  if (etat.comparaison.length) {
    const lien = document.createElement("a");
    lien.className = "comparer-lien";
    lien.href = "#donnees";
    lien.textContent = `Voir la comparaison (${etat.comparaison.length}) →`;
    bouton.after(lien);
  }
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

/** Options d'un sélecteur d'indicateur : un groupe par thème, et en tête de
 *  chaque groupe le thème lui-même — « Éducation » choisit son indicateur
 *  principal, « Éducation — Écoles » choisit la série précise. Deux cases
 *  fondues en une, sans perdre le niveau du thème. */
function optionsIndicateurs(niveau: string, exclu?: string): string {
  return themesCartographiables()
    .map((theme) => {
      const dedans = catalogue.filter(
        (i) => i.theme === theme && i.niveaux?.includes(niveau) && i.id !== exclu,
      );
      if (!dedans.length) return "";
      const options = [
        `<option value="theme:${theme}">${libelleTheme(theme)} — tout le thème</option>`,
        ...dedans.map((i) => `<option value="${i.id}">${libelleTheme(theme)} — ${i.libelle}</option>`),
      ].join("");
      return `<optgroup label="${libelleTheme(theme)}">${options}</optgroup>`;
    })
    .join("");
}


/** Tous les indicateurs à la suite dans la barre latérale, groupés par thème.
 *  Un menu déroulant cachait le catalogue : on ne voyait pas ce qui existe
 *  avant de l'ouvrir, et on ne pouvait pas comparer les intitulés d'un coup
 *  d'œil. La liste montre tout, le filtre la réduit. */
function construireListeIndicateurs(): void {
  const filtre = $<HTMLInputElement>("filtre-indicateur").value.trim().toLowerCase();
  const correspond = (texte: string) => !filtre || texte.toLowerCase().includes(filtre);
  const liste = $("liste-indicateurs");
  liste.innerHTML = themesCartographiables()
    .map((theme) => {
      const dedans = catalogue.filter(
        (i) =>
          i.theme === theme &&
          i.niveaux?.includes(etat.niveau) &&
          (correspond(i.libelle) || correspond(libelleTheme(theme))),
      );
      if (!dedans.length) return "";
      return `<div class="indicateurs__groupe">
        <p class="indicateurs__theme">${libelleTheme(theme)}</p>
        ${dedans
          .map(
            (i) => `<button type="button" role="option"
              aria-selected="${i.id === etat.indicateur}"
              class="indicateurs__item${
                i.id === etat.indicateur ? " indicateurs__item--actif" : ""
              }" data-indicateur="${i.id}">${i.libelle}</button>`,
          )
          .join("")}
      </div>`;
    })
    .join("");
  if (!liste.children.length) {
    liste.innerHTML = `<p class="indicateurs__vide">Aucun indicateur ne correspond à ce filtre, à ce niveau.</p>`;
  }
  liste
    .querySelector(".indicateurs__item--actif")
    ?.scrollIntoView({ block: "nearest" });
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
  construireListeIndicateurs();

  // Périodes du niveau affiché, pas de l'indicateur tous niveaux confondus :
  // l'historique communal est plus court que celui des départements, et
  // proposer une année sans couche mènerait à un fichier absent.
  const fiche = indicateurCourant();
  const periodes = [
    ...(fiche.periodes_par_niveau?.[etat.niveau] ?? fiche.periodes ?? []),
  ]
    .sort()
    .reverse();
  if (!periodes.includes(etat.periode)) etat.periode = periodes[0];
  $<HTMLSelectElement>("periode").innerHTML = periodes
    .map((p) => `<option value="${p}">${p}</option>`)
    .join("");
  $<HTMLSelectElement>("periode").value = etat.periode;
  $<HTMLSelectElement>("niveau").value = etat.niveauAuto ? "auto" : etat.niveau;
  const vue = $<HTMLSelectElement>("vue");
  if (!vue.options.length) {
    vue.innerHTML = Object.entries(VUES)
      .map(([cle, v]) => `<option value="${cle}">${v.nom}</option>`)
      .join("");
  }
  vue.value = etat.vue;

  // « Par habitant » n'a de sens que pour un montant qui s'additionne. Sur un
  // taux ou un effectif, le calcul le refusait déjà — mais la commande restait
  // sur « Par habitant » et annonçait donc un dénominateur qui n'existait pas.
  // Une commande qui affirme ce qu'elle ne fait pas est un mensonge de plus.
  const divisible = parHabitantAUnSens(fiche);
  const declinaison = $<HTMLSelectElement>("declinaison");
  declinaison.disabled = !divisible;
  declinaison.value = divisible ? etat.declinaison : "total";
  declinaison.title = divisible
    ? ""
    : "Cet indicateur n'est pas un montant qui s'additionne : le ramener à l'habitant n'aurait pas de sens.";
}

async function choisirIndicateur(id: string): Promise<void> {
  const choisi = catalogue.find((i) => i.id === id);
  if (!choisi) return;
  // Changer de thème remet l'année à la plus récente : un thème au millésime
  // court y laissait sinon le lecteur sans un mot.
  if (choisi.theme !== etat.theme) etat.periode = "";
  etat.theme = choisi.theme;
  etat.indicateur = id;
  construireSelecteurs();
  ecrireUrl();
  await peindre();
}

function brancherCommandes(): void {
  $("liste-indicateurs").addEventListener("click", (evenement) => {
    const bouton = (evenement.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-indicateur]",
    );
    if (bouton?.dataset.indicateur) void choisirIndicateur(bouton.dataset.indicateur);
  });
  $("filtre-indicateur").addEventListener("input", () => construireListeIndicateurs());

  $("commandes").addEventListener("change", async (evenement) => {
    const cible = evenement.target as HTMLSelectElement;
    if (cible.id === "niveau") {
      etat.niveauAuto = cible.value === "auto";
      etat.niveau = etat.niveauAuto ? niveauPourZoom(carte.getZoom()) : cible.value;
      etat.selection = null;
    }
    if (cible.id === "periode") etat.periode = cible.value;
    if (cible.id === "declinaison") etat.declinaison = cible.value;
    if (cible.id === "vue") {
      etat.vue = cible.value;
      cadrer(etat.vue);
    }
    construireSelecteurs();
    ecrireUrl();
    try {
      await peindre();
    } catch (erreur) {
      // Une couche absente laissait la carte sur l'ancienne, sans un mot : le
      // lecteur croyait regarder ce qu'il venait de choisir. Le catalogue est
      // censé n'annoncer que des couches existantes — si l'une manque quand
      // même, mieux vaut le dire que peindre le mauvais chiffre.
      $("fiche").innerHTML =
        `<p class="erreur">Cette couche n'a pas pu être chargée : ${
          (erreur as Error).message
        }. La carte affiche encore la sélection précédente.</p>`;
    }
    await majComparateur();
  });

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

/* ------------------------------------------------------------------ *
 * Croiser deux indicateurs : nuage, droite, r de Pearson.             *
 * ------------------------------------------------------------------ */

let croisementPret = false;
let pointsCroises: PointNomme[] = [];
let geoCroisement: {
  gauche: number; droite: number; haut: number; bas: number;
  xMin: number; xMax: number; yMin: number; yMax: number;
} | null = null;

function derniereCartographiee(indicateur: Indicateur, niveau: string): string | null {
  const periodes = indicateur.periodes_par_niveau?.[niveau] ?? [];
  return periodes.length ? periodes[periodes.length - 1] : null;
}

/** L'axe horizontal est l'indicateur de la carte : l'analyse prolonge ce
 *  qu'on regarde, elle ne recommence pas un formulaire. Seul le second axe
 *  se choisit — une case au lieu de trois. */
/** Les DEUX axes se choisissent : n'ouvrir que le second obligeait à changer
 *  la carte pour changer l'axe horizontal — l'analyse suivait la carte au
 *  lieu de servir l'analyste. L'axe horizontal s'initialise sur l'indicateur
 *  affiché, puis il est libre. */
function remplirSelecteursCroisement(): void {
  const options = optionsIndicateurs(etat.niveau).replaceAll(
    /<option value="theme:[^"]*">[^<]*<\/option>/g,
    "",
  );
  const eligible = (id: string) =>
    catalogue.some((i) => i.id === id && i.niveaux?.includes(etat.niveau));
  const defautsY = [
    "insee_niveau_vie_median",
    "ofgl_depenses_fonctionnement",
    "insee_population_municipale",
  ];
  for (const [id, defauts] of [
    ["croiser-x", [etat.indicateur]],
    ["croiser-y", defautsY],
  ] as const) {
    const select = $<HTMLSelectElement>(id);
    const courant = select.value;
    select.innerHTML = options;
    const voulu = eligible(courant) ? courant : defauts.find(eligible);
    if (voulu) select.value = voulu;
  }
  // Deux axes identiques ne disent rien : on décale le second.
  const x = $<HTMLSelectElement>("croiser-x");
  const y = $<HTMLSelectElement>("croiser-y");
  if (x.value === y.value) {
    const autre = [...y.options].find((o) => o.value !== x.value);
    if (autre) y.value = autre.value;
  }
}

async function majCroisement(): Promise<void> {
  if (!catalogue.length || $("volet-analyse").hidden) return;
  if (!croisementPret) {
    croisementPret = true;
    for (const id of ["croiser-x", "croiser-y", "croiser-log"]) {
      $(id).addEventListener("change", () => void majCroisement());
    }
    document.querySelectorAll<HTMLButtonElement>(".croiser__mode").forEach((bouton) => {
      bouton.addEventListener("click", () =>
        basculerModeAnalyse(bouton.dataset.mode === "matrice" ? "matrice" : "nuage"),
      );
    });
    window.addEventListener("resize", () => {
      if (!$("volet-analyse").hidden) void majCroisement();
    });
    brancherSurvolCroisement();
  }
  remplirSelecteursCroisement();
  const niveau = etat.niveau;
  const indX = catalogue.find((i) => i.id === $<HTMLSelectElement>("croiser-x").value);
  const indY = catalogue.find((i) => i.id === $<HTMLSelectElement>("croiser-y").value);
  if (!indX || !indY) return;
  const periodeX = derniereCartographiee(indX, niveau);
  const periodeY = derniereCartographiee(indY, niveau);
  if (!periodeX || !periodeY) return;
  $("croiser-resume").textContent = "Chargement…";
  try {
    const [xs, ys] = await Promise.all([
      donnees.valeursCarte(indX.id, niveau, periodeX),
      donnees.valeursCarte(indY.id, niveau, periodeY),
    ]);
    await chargerLotsNecessaires(niveau, Object.keys(xs));
    recalculerPopulations();
    const noms = Object.fromEntries(
      Object.entries(entites).map(([code, e]) => [code, e.nom]),
    );
    const ramenerX = parHabitantAUnSens(indX);
    const ramenerY = parHabitantAUnSens(indY);
    let points = joindre(xs, ys, noms, populations, ramenerX, ramenerY);
    const log = $<HTMLInputElement>("croiser-log").checked;
    let enLogarithme = false;
    if (log) {
      const transformes = enLog(points);
      if (transformes) {
        points = transformes;
        enLogarithme = true;
      }
    }
    pointsCroises = points;
    const r = pearson(points);
    dessinerCroisement(points, indX, indY, ramenerX, ramenerY, enLogarithme);
    const memePeriode = periodeX === periodeY;
    $("croiser-resume").innerHTML = points.length
      ? `<strong>r = ${
          r === null ? "—" : r.toLocaleString("fr-FR", { maximumFractionDigits: 2 })
        }</strong> · ${lectureDeR(r, points.length)} <span class="croiser__n">${points.length.toLocaleString(
          "fr-FR",
        )} territoires${enLogarithme ? " · échelles log, r calculé sur les logarithmes" : ""}</span>`
      : "Aucun territoire ne porte les deux indicateurs à ce niveau.";
    // D'où viennent ces deux séries : la question se pose devant un
    // coefficient plus encore que devant une carte.
    $("croiser-sources").innerHTML = [indX, indY]
      .map((indicateur) => {
        const jeu = jeux.find((j) => j.id === indicateur.jeu);
        if (!jeu) return "";
        return `<p><span class="croiser__quoi">${indicateur.libelle}</span>
          ${jeu.producteur} — ${jeu.licence}, extraction du ${new Date(
            jeu.extraction,
          ).toLocaleDateString("fr-FR")} ·
          <a href="${jeu.url}" rel="noreferrer">source</a></p>`;
      })
      .join("");
    $("croiser-note").textContent =
      `Corrélation n'est pas causalité : un troisième facteur (taille, tourisme, densité)` +
      ` peut produire le lien. r est sensible aux valeurs extrêmes` +
      `${enLogarithme ? "" : " — l'échelle logarithmique les apaise"}.` +
      ` ${indX.libelle} : ${periodeX}${ramenerX ? ", par habitant" : ""} ·` +
      ` ${indY.libelle} : ${periodeY}${ramenerY ? ", par habitant" : ""}` +
      `${memePeriode ? "" : " — millésimes différents, le croisement le dit"}.`;
  } catch {
    $("croiser-resume").textContent = "Le chargement du croisement a échoué. Réessayez.";
  }
}

function dessinerCroisement(
  points: PointNomme[],
  indX: Indicateur,
  indY: Indicateur,
  ramenerX: boolean,
  ramenerY: boolean,
  enLogarithme: boolean,
): void {
  const canvas = $<HTMLCanvasElement>("croiser-canvas");
  const largeur = Math.min(canvas.parentElement?.clientWidth || 720, 860);
  const hauteur = Math.max(340, Math.round(largeur * 0.52));
  const echellePixels = window.devicePixelRatio || 1;
  canvas.width = largeur * echellePixels;
  canvas.height = hauteur * echellePixels;
  canvas.style.width = `${largeur}px`;
  canvas.style.height = `${hauteur}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(echellePixels, echellePixels);
  ctx.clearRect(0, 0, largeur, hauteur);
  if (!points.length) {
    geoCroisement = null;
    return;
  }
  const marges = { gauche: 64, droite: 16, haut: 14, bas: 40 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const geo = {
    gauche: marges.gauche,
    droite: largeur - marges.droite,
    haut: marges.haut,
    bas: hauteur - marges.bas,
    xMin: Math.min(...xs), xMax: Math.max(...xs),
    yMin: Math.min(...ys), yMax: Math.max(...ys),
  };
  if (geo.xMin === geo.xMax) geo.xMax += 1;
  if (geo.yMin === geo.yMax) geo.yMax += 1;
  geoCroisement = geo;
  const versX = (v: number) =>
    geo.gauche + ((v - geo.xMin) / (geo.xMax - geo.xMin)) * (geo.droite - geo.gauche);
  const versY = (v: number) =>
    geo.bas - ((v - geo.yMin) / (geo.yMax - geo.yMin)) * (geo.bas - geo.haut);

  const style = getComputedStyle(document.documentElement);
  const encre = style.getPropertyValue("--encre").trim() || "#0f1b2e";
  const trait = style.getPropertyValue("--trait").trim() || "#e3e1d8";
  const sauge = style.getPropertyValue("--encre-douce").trim() || "#6e7d73";
  const argile = style.getPropertyValue("--argile").trim() || "#c56a4d";

  const inverse = (v: number) => (enLogarithme ? 10 ** v : v);
  const etiquette = (v: number, ramener: boolean, indicateur: Indicateur) =>
    formater(inverse(v), indicateur.unite, ramener);

  ctx.font = "11px 'Public Sans', system-ui, sans-serif";
  ctx.fillStyle = sauge;
  ctx.strokeStyle = trait;
  ctx.lineWidth = 1;
  const graduationsAxe = (min: number, max: number, n = 5) =>
    Array.from({ length: n }, (_, i) => min + ((max - min) * i) / (n - 1));
  for (const gy of graduationsAxe(geo.yMin, geo.yMax)) {
    const py = versY(gy);
    ctx.beginPath();
    ctx.moveTo(geo.gauche, py);
    ctx.lineTo(geo.droite, py);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillText(etiquette(gy, ramenerY, indY), geo.gauche - 6, py + 3.5);
  }
  ctx.textAlign = "center";
  for (const gx of graduationsAxe(geo.xMin, geo.xMax)) {
    ctx.fillText(etiquette(gx, ramenerX, indX), versX(gx), geo.bas + 16);
  }
  ctx.fillText(indX.libelle, (geo.gauche + geo.droite) / 2, hauteur - 4);
  ctx.save();
  ctx.translate(11, (geo.haut + geo.bas) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(indY.libelle, 0, 0);
  ctx.restore();

  // le nuage — translucide pour que la densité se voie
  ctx.fillStyle = encre;
  ctx.globalAlpha = points.length > 5000 ? 0.18 : points.length > 800 ? 0.3 : 0.55;
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(versX(p.x), versY(p.y), points.length > 5000 ? 1.6 : 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // la droite des moindres carrés, en argile pointillé
  const droite = moindresCarres(points);
  if (droite) {
    ctx.strokeStyle = argile;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(versX(geo.xMin), versY(droite.a * geo.xMin + droite.b));
    ctx.lineTo(versX(geo.xMax), versY(droite.a * geo.xMax + droite.b));
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** Nombre d'indicateurs croisés : au-delà, la matrice devient illisible et
 *  le chargement pèse (600 Ko par indicateur au niveau communal). Borne dite
 *  à l'écran quand elle s'applique — un « top 10 » muet ferait croire à
 *  l'exhaustivité. */
const MAXIMUM_MATRICE = 10;

let modeAnalyse: "nuage" | "matrice" = "nuage";

async function majMatrice(): Promise<void> {
  const zone = $("matrice-zone");
  const tableau = $("matrice-table");
  const candidats = catalogue
    .filter((i) => i.theme === etat.theme && derniereCartographiee(i, etat.niveau))
    .slice(0, MAXIMUM_MATRICE);
  if (candidats.length < 2) {
    tableau.innerHTML = "";
    $("matrice-note").textContent =
      "Ce thème n'a qu'un indicateur à ce niveau : une matrice demande au moins deux séries.";
    return;
  }
  $("matrice-note").textContent = "Chargement des séries…";
  try {
    const series: SerieCroisable[] = await Promise.all(
      candidats.map(async (i) => ({
        id: i.id,
        libelle: i.libelle,
        valeurs: await donnees.valeursCarte(
          i.id, etat.niveau, derniereCartographiee(i, etat.niveau) as string,
        ),
        parHabitant: parHabitantAUnSens(i),
      })),
    );
    await chargerLotsNecessaires(etat.niveau, Object.keys(series[0].valeurs));
    recalculerPopulations();
    const cellules = matrice(series, populations);
    const valeurCellule = (i: number, j: number) =>
      cellules.find((c) => c.i === Math.max(i, j) && c.j === Math.min(i, j));

    const entete = `<tr><td></td>${series
      .map((s, i) => `<th scope="col" title="${echapperTexte(s.libelle)}">${i + 1}</th>`)
      .join("")}</tr>`;
    const lignes = series
      .map((s, i) => {
        const cases = series
          .map((autre, j) => {
            const cellule = valeurCellule(i, j);
            const r = cellule?.r ?? null;
            const titre = `${s.libelle} × ${autre.libelle} — ${
              r === null
                ? `pas assez de territoires communs (${cellule?.n ?? 0})`
                : `r = ${r.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} sur ${
                    cellule?.n ?? 0
                  } territoires`
            }`;
            return `<td class="matrice__case" style="background:${couleurCellule(r)}"
              title="${echapperTexte(titre)}" data-x="${s.id}" data-y="${autre.id}"
              tabindex="0">${
                r === null ? "·" : r.toLocaleString("fr-FR", { maximumFractionDigits: 2 })
              }</td>`;
          })
          .join("");
        return `<tr><th scope="row" title="${echapperTexte(s.libelle)}">${i + 1}. ${
          s.libelle.length > 20 ? `${s.libelle.slice(0, 19)}…` : s.libelle
        }</th>${cases}</tr>`;
      })
      .join("");
    tableau.innerHTML = `${entete}${lignes}`;

    tableau.querySelectorAll<HTMLElement>(".matrice__case").forEach((cellule) => {
      const ouvrir = () => {
        const x = cellule.dataset.x;
        const y = cellule.dataset.y;
        if (!x || !y || x === y) return;
        // La carte suit : l'axe horizontal du nuage est toujours l'indicateur
        // affiché — cliquer une case change donc aussi ce qu'on voit.
        etat.indicateur = x;
        etat.theme = catalogue.find((i) => i.id === x)?.theme ?? etat.theme;
        construireSelecteurs();
        ecrireUrl();
        basculerModeAnalyse("nuage");
        $<HTMLSelectElement>("croiser-y").value = y;
        void peindre();
      };
      cellule.addEventListener("click", ouvrir);
      cellule.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === "Enter") ouvrir();
      });
    });

    const meilleures = paires(cellules, series, 3);
    $("matrice-paires").innerHTML = meilleures.length
      ? `<h4>Les liens les plus marqués</h4><ul>${meilleures
          .map(
            (p) => `<li><span>${echapperTexte(p.a)} × ${echapperTexte(p.b)}</span>
              <strong>${p.r.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</strong></li>`,
          )
          .join("")}</ul>`
      : "";
    const tronque = catalogue.filter(
      (i) => i.theme === etat.theme && derniereCartographiee(i, etat.niveau),
    ).length;
    $("matrice-note").textContent =
      `Corrélation n'est pas causalité. Chaque case est calculée sur les seuls` +
      ` territoires portant les deux indicateurs — le nombre varie d'une case à` +
      ` l'autre, il est dit au survol. Millésime le plus récent de chaque série.` +
      (tronque > MAXIMUM_MATRICE
        ? ` ${MAXIMUM_MATRICE} indicateurs sur ${tronque} affichés.`
        : "");
    zone.hidden = false;
  } catch {
    $("matrice-note").textContent = "Le chargement de la matrice a échoué. Réessayez.";
  }
}

function echapperTexte(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function basculerModeAnalyse(mode: "nuage" | "matrice"): void {
  modeAnalyse = mode;
  document.querySelectorAll<HTMLButtonElement>(".croiser__mode").forEach((b) => {
    b.classList.toggle("croiser__mode--actif", b.dataset.mode === mode);
  });
  const nuage = mode === "nuage";
  for (const id of ["croiser-y", "croiser-log", "croiser-resume", "croiser-note"]) {
    const element = $(id).closest("p") ?? $(id);
    (element as HTMLElement).hidden = !nuage;
  }
  $("volet-analyse").querySelector<HTMLElement>(".croiser__scene")!.hidden = !nuage;
  $("volet-analyse").querySelector<HTMLElement>(".croiser__intro")!.hidden = !nuage;
  $("matrice-zone").hidden = nuage;
  if (nuage) void majCroisement();
  else void majMatrice();
}

function brancherSurvolCroisement(): void {
  const canvas = $<HTMLCanvasElement>("croiser-canvas");
  const bulle = $("croiser-infobulle");
  canvas.addEventListener("pointermove", (evenement) => {
    const geo = geoCroisement;
    if (!geo || !pointsCroises.length) return;
    const zone = canvas.getBoundingClientRect();
    const px = evenement.clientX - zone.left;
    const py = evenement.clientY - zone.top;
    const versX = (v: number) =>
      geo.gauche + ((v - geo.xMin) / (geo.xMax - geo.xMin)) * (geo.droite - geo.gauche);
    const versY = (v: number) =>
      geo.bas - ((v - geo.yMin) / (geo.yMax - geo.yMin)) * (geo.bas - geo.haut);
    let plusProche: PointNomme | null = null;
    let distance = 12 * 12;
    for (const p of pointsCroises) {
      const d = (versX(p.x) - px) ** 2 + (versY(p.y) - py) ** 2;
      if (d < distance) {
        distance = d;
        plusProche = p;
      }
    }
    if (!plusProche) {
      bulle.hidden = true;
      return;
    }
    bulle.innerHTML = `<strong>${plusProche.nom}</strong>`;
    bulle.hidden = false;
    bulle.style.transform = `translate(${Math.min(px + 12, zone.width - 140)}px, ${Math.max(
      py - 34,
      4,
    )}px)`;
  });
  canvas.addEventListener("pointerleave", () => {
    bulle.hidden = true;
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
    if (!etat.niveauAuto) return;
    const voulu = niveauPourZoom(carte.getZoom());
    if (voulu !== etat.niveau) {
      etat.niveau = voulu;
      construireSelecteurs();
      ecrireUrl();
      void peindre();
    }
  });

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
  Object.assign(window as object, { __carte: carte });

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

  // Onglets du panneau : Territoire (la fiche) et Analyse (le croisement).
  // Tout vit dans la carte — plus d'onglet d'analyse séparé.
  document.querySelectorAll<HTMLButtonElement>(".panneau__onglets button").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const voulu = bouton.dataset.volet;
      document.querySelectorAll<HTMLButtonElement>(".panneau__onglets button").forEach((b) => {
        b.setAttribute("aria-selected", String(b === bouton));
      });
      $("volet-territoire").hidden = voulu !== "territoire";
      $("volet-analyse").hidden = voulu !== "analyse";
      if (voulu === "analyse") basculerModeAnalyse(modeAnalyse);
    });
  });

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
  // la fiche s'afficher sans eux.
  donnees
    .references()
    .then((r) => {
      reperes = r;
    })
    .catch(() => {});

}

demarrer().catch((erreur) => {
  $("fiche").innerHTML = `<p class="erreur">Les données n'ont pas pu être chargées : ${erreur.message}</p>`;
});
