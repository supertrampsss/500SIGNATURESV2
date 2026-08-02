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
import { afficherFraicheur } from "./fraicheur.ts";
import { afficherJournal } from "./journal.ts";
import { afficherComparateur, type Entree, MAXIMUM } from "./comparateur.ts";
import { afficherNational } from "./national.ts";
import { afficherFonctions } from "./fonctions.ts";
import {
  expressionCouleur,
  formater,
  noteEchelle,
  parHabitantAUnSens,
  populationDeReference,
  quantiles,
} from "./echelle.ts";
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
  niveau: string;
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

function lireUrl(): Etat {
  const p = new URLSearchParams(location.search);
  return {
    theme: p.get("theme") ?? "finances_locales",
    indicateur: p.get("indicateur") ?? "ofgl_depenses_fonctionnement",
    niveau: p.get("niveau") ?? "commune",
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
    niveau: etat.niveau,
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

function majLegende(echelle: ReturnType<typeof quantiles>, parHabitant: boolean): void {
  const indicateur = indicateurCourant();
  $("legende").hidden = false;
  $("legende-titre").textContent = `${indicateur.libelle} — ${etat.periode}${
    parHabitant ? " · par habitant" : ""
  }`;
  const bornes = [...echelle.bornes];
  $("legende-echelle").innerHTML = echelle.couleurs
    .map((couleur, i) => {
      const bas = i === 0 ? null : bornes[i - 1];
      const haut = i < bornes.length ? bornes[i] : null;
      const texte =
        bas === null
          ? `moins de ${formater(haut as number, indicateur.unite, parHabitant)}`
          : haut === null
            ? `${formater(bas, indicateur.unite, parHabitant)} et plus`
            : `${formater(bas, indicateur.unite, parHabitant)} – ${formater(
                haut,
                indicateur.unite,
                parHabitant,
              )}`;
      return `<li><span class="pastille" style="background:${couleur}"></span>${texte}</li>`;
    })
    .join("");
  $("legende-note").textContent = noteEchelle(indicateur.unite, parHabitant);
}

function majTableau(valeurs: Record<string, number>, parHabitant: boolean): void {
  const indicateur = indicateurCourant();
  const lignes = Object.entries(valeurs)
    .map(([code, brut]) => {
      const population = populations[code];
      const valeur = parHabitant && population ? brut / population : brut;
      return { code, nom: entites[code]?.nom ?? code, valeur, calculable: !parHabitant || !!population };
    })
    .filter((l) => l.calculable)
    .sort((a, b) => b.valeur - a.valeur)
    .slice(0, 100);
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
  if (etat.selection) {
    await montrerFiche(etat.selection);
  } else {
    // Tant que rien n'est sélectionné, le panneau montre la couche affichée
    // plutôt qu'une invitation vide.
    const ramenees = Object.fromEntries(
      Object.entries(valeurs)
        .map(([code, brut]) => [code, parHabitant ? brut / (populations[code] ?? NaN) : brut])
        .filter(([, v]) => Number.isFinite(v as number)),
    ) as Record<string, number>;
    const noms = Object.fromEntries(
      Object.entries(entites).map(([code, entite]) => [code, entite.nom]),
    );
    $("fiche").innerHTML = apercuRendu(
      resumer(ramenees, noms),
      indicateurCourant(),
      etat.niveau,
      etat.periode,
      parHabitant,
    );
  }
}

/** Recadre la carte sur une vue déclarée. */
function cadrer(vue: string): void {
  const bornes = VUES[vue]?.bornes;
  if (bornes && carte) carte.fitBounds(bornes, { padding: 24, duration: 800 });
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

  afficherFiche($("fiche"), {
    code,
    niveau: etat.niveau,
    territoire,
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
  $("fiche").querySelector(".fiche__meta")?.after(bouton);
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

function construireSelecteurs(): void {
  const disponibles = themesCartographiables();
  const selecteurTheme = $<HTMLSelectElement>("theme");
  selecteurTheme.innerHTML = disponibles
    .map((t) => `<option value="${t}">${libelleTheme(t)}</option>`)
    .join("");
  if (!disponibles.includes(etat.theme)) etat.theme = disponibles[0] ?? "finances_locales";
  selecteurTheme.value = etat.theme;

  const financiers = catalogue.filter(
    (i) => i.theme === etat.theme && i.niveaux?.includes(etat.niveau),
  );
  if (!financiers.some((i) => i.id === etat.indicateur)) {
    etat.indicateur = financiers[0]?.id ?? etat.indicateur;
  }
  $<HTMLSelectElement>("indicateur").innerHTML = financiers
    .map((i) => `<option value="${i.id}">${i.libelle}</option>`)
    .join("");
  $<HTMLSelectElement>("indicateur").value = etat.indicateur;

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
  $<HTMLSelectElement>("niveau").value = etat.niveau;
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

function brancherCommandes(): void {
  $("commandes").addEventListener("change", async (evenement) => {
    const cible = evenement.target as HTMLSelectElement;
    if (cible.id === "theme") {
      etat.theme = cible.value;
      // Changer de thème remet l'année à la plus récente disponible. Sans cela,
      // passer par un thème qui n'a qu'un millésime ancien — les établissements
      // s'arrêtent à 2023 — laissait le lecteur sur cette année-là en revenant
      // aux finances locales, qui vont jusqu'à 2025. Aucun message ne le disait.
      etat.periode = "";
    }
    if (cible.id === "indicateur") etat.indicateur = cible.value;
    if (cible.id === "niveau") {
      etat.niveau = cible.value;
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

async function demarrer(): Promise<void> {
  const manifeste = await donnees.initialiser();
  jeux = manifeste.jeux;
  catalogue = await donnees.indicateurs();
  etat = lireUrl();
  construireSelecteurs();
  afficherQuestions($("questions"));

  $("fraicheur").textContent = `Données publiées le ${new Date(
    manifeste.genere_le,
  ).toLocaleDateString("fr-FR")} · version ${manifeste.version}`;

  // Le jeu de données public est le même que celui de la carte : le lien pointe
  // vers le pointeur de version, porte d'entrée de tous les autres fichiers.
  $("telechargement").insertAdjacentHTML(
    "beforeend",
    ` <a href="${donnees.racinePubliee()}/derniere.json" rel="noreferrer">Accéder aux données</a>.`,
  );

  maplibregl.addProtocol("pmtiles", new Protocol().tile);
  carte = new maplibregl.Map({
    container: "carte",
    style: {
      version: 8,
      sources: {
        territoires: { type: "vector", url: `pmtiles://${donnees.urlTuiles()}` },
      },
      layers: [
        { id: "fond", type: "background", paint: { "background-color": "#f7f7f5" } },
        ...Object.values(COUCHES).flatMap((couche) => [
          {
            id: `remplissage-${couche}`,
            type: "fill" as const,
            source: "territoires",
            "source-layer": couche,
            paint: { "fill-color": "#d9d9d9", "fill-opacity": 0.9 },
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
      ],
    },
    bounds: VUES[etat.vue]?.bornes ?? VUES.metropole.bornes,
    fitBoundsOptions: { padding: 24 },
    attributionControl: { customAttribution: "IGN Admin Express · OFGL · Licence Ouverte 2.0" },
  });
  carte.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

  carte.on("load", async () => {
    await peindre();
    for (const couche of Object.values(COUCHES)) {
      carte.on("click", `remplissage-${couche}`, async (evenement) => {
        const code = evenement.features?.[0]?.properties?.code as string | undefined;
        if (code) await montrerFiche(code);
      });
      carte.on("mouseenter", `remplissage-${couche}`, () => {
        carte.getCanvas().style.cursor = "pointer";
      });
      carte.on("mouseleave", `remplissage-${couche}`, () => {
        carte.getCanvas().style.cursor = "";
      });
    }
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
    if (afficherNational($("bloc-dette"), $("bloc-europe"), pays, catalogue)) {
      $("national").hidden = false;
    }
    if (afficherFonctions($("bloc-fonctions"), pays, catalogue)) {
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

  try {
    if (afficherFraicheur($("etat-donnees"), await donnees.fraicheur())) {
      $("etat-donnees").hidden = false;
    }
  } catch {
    // L'état des données manque : la carte reste utilisable sans lui.
  }

  // Les repères se chargent à part : une publication qui n'en a pas doit laisser
  // la fiche s'afficher sans eux.
  donnees
    .references()
    .then((r) => {
      reperes = r;
    })
    .catch(() => {});

  try {
    if (afficherJournal($("journal"), await donnees.journal())) {
      $("journal").hidden = false;
    }
  } catch {
    // Publication antérieure au journal, ou aucun changement déclaré : le bloc
    // reste caché. Une liste vide dirait « rien n'a jamais bougé », ce qui n'est
    // pas la même chose que « nous ne savons pas ».
  }
}

demarrer().catch((erreur) => {
  $("fiche").innerHTML = `<p class="erreur">Les données n'ont pas pu être chargées : ${erreur.message}</p>`;
});
