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
import { afficherBudgetEtat } from "./etat.ts";
import { afficherNational } from "./national.ts";
import { expressionCouleur, formater, quantiles } from "./echelle.ts";
import "./style.css";

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
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let carte: maplibregl.Map;
let catalogue: Indicateur[] = [];
let jeux: Jeu[] = [];
let etat: Etat;
let populations: Record<string, number> = {};
let entites: Record<string, Territoire> = {};
let groupes: donnees.Comparaisons | null = null;

function lireUrl(): Etat {
  const p = new URLSearchParams(location.search);
  return {
    theme: p.get("theme") ?? "finances_locales",
    indicateur: p.get("indicateur") ?? "ofgl_depenses_fonctionnement",
    niveau: p.get("niveau") ?? "commune",
    periode: p.get("periode") ?? "",
    declinaison: p.get("affichage") ?? "habitant",
    selection: p.get("territoire"),
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
  if (etat.selection) p.set("territoire", etat.selection);
  history.replaceState(null, "", `?${p}`);
}

async function chargerTerritoires(niveau: string, lot: string): Promise<void> {
  const paquet = await donnees.territoires(niveau, lot);
  entites = { ...entites, ...paquet };
  for (const [code, entite] of Object.entries(paquet)) {
    if (entite.population) populations[code] = entite.population;
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
  $("legende-note").textContent = parHabitant
    ? "Classes de valeurs égales en nombre de territoires. Dénominateur : population de référence OFGL."
    : "Classes de valeurs égales en nombre de territoires. Montants en euros courants.";
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
  const parHabitant = etat.declinaison === "habitant" && indicateurCourant().unite === "EUR";
  const valeurs = await donnees.valeursCarte(etat.indicateur, etat.niveau, etat.periode);
  await chargerLotsNecessaires(etat.niveau, Object.keys(valeurs));

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
  if (etat.selection) await montrerFiche(etat.selection);
}

async function montrerFiche(code: string): Promise<void> {
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
    indicateurs: catalogue.filter((i) => i.theme === etat.theme),
    jeux,
    periode: etat.periode,
    parHabitant: etat.declinaison === "habitant",
  });
}

const THEMES: Record<string, string> = {
  finances_locales: "Finances locales",
  dette: "Dette publique",
  europe: "Comparaisons européennes",
};

/** Seuls les thèmes cartographiables alimentent la carte : la dette et les
 *  comparaisons européennes n'existent qu'au niveau national. */
function themesCartographiables(): string[] {
  return [...new Set(catalogue.filter((i) => i.niveaux?.includes(etat.niveau)).map((i) => i.theme))];
}

function construireSelecteurs(): void {
  const disponibles = themesCartographiables().filter((t) => t in THEMES);
  const selecteurTheme = $<HTMLSelectElement>("theme");
  selecteurTheme.innerHTML = disponibles
    .map((t) => `<option value="${t}">${THEMES[t]}</option>`)
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

  const periodes = [...(indicateurCourant().periodes ?? [])].sort().reverse();
  if (!periodes.includes(etat.periode)) etat.periode = periodes[0];
  $<HTMLSelectElement>("periode").innerHTML = periodes
    .map((p) => `<option value="${p}">${p}</option>`)
    .join("");
  $<HTMLSelectElement>("periode").value = etat.periode;
  $<HTMLSelectElement>("niveau").value = etat.niveau;
  $<HTMLSelectElement>("declinaison").value = etat.declinaison;
}

function brancherCommandes(): void {
  $("commandes").addEventListener("change", async (evenement) => {
    const cible = evenement.target as HTMLSelectElement;
    if (cible.id === "theme") etat.theme = cible.value;
    if (cible.id === "indicateur") etat.indicateur = cible.value;
    if (cible.id === "niveau") {
      etat.niveau = cible.value;
      etat.selection = null;
      $("fiche").innerHTML = '<p class="fiche__vide">Choisissez un territoire.</p>';
    }
    if (cible.id === "periode") etat.periode = cible.value;
    if (cible.id === "declinaison") etat.declinaison = cible.value;
    construireSelecteurs();
    ecrireUrl();
    await peindre();
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

  $("fraicheur").textContent = `Données publiées le ${new Date(
    manifeste.genere_le,
  ).toLocaleDateString("fr-FR")} · version ${manifeste.version}`;

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
            paint: { "line-color": "#ffffff", "line-width": 0.4 },
          },
        ]),
      ],
    },
    center: [2.4, 46.6],
    zoom: 4.8,
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
  } catch {
    // Les séries nationales ne sont pas encore publiées : la carte reste utile.
  }

  // Le budget de l'État a son propre fichier : il est chargé à part pour qu'une
  // publication sans lui n'empêche pas le reste de s'afficher.
  try {
    if (afficherBudgetEtat($("bloc-etat"), await donnees.budgetEtat())) {
      $("national").hidden = false;
    }
  } catch {
    // Budget de l'État non publié : le reste du bloc national tient debout.
  }
}

demarrer().catch((erreur) => {
  $("fiche").innerHTML = `<p class="erreur">Les données n'ont pas pu être chargées : ${erreur.message}</p>`;
});
