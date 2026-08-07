/**
 * Un enchaînement qui ne boucle pas ne s'explique pas, il s'enlève.
 *
 * Le pont affirme que l'épargne brute *est* la différence des deux premières
 * lignes, et que la dernière *est* ce qui reste après les six suivantes. Ce
 * sont des identités que l'OFGL publie ; le bloc les recalcule et les
 * confronte avant de s'afficher. Ces tests fixent les trois contrôles et le
 * comportement quand l'un d'eux échoue.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { composantes, marches, montant, rendu } from "./pont.ts";
import type { Indicateur } from "./donnees.ts";
import type { Territoire } from "./donnees.ts";

/** Espace fine insécable : la typographie française avant une unité. */
const FINE = "\u202f";

/**
 * Bordeaux, exercice 2025, comptes du budget principal publiés par l'OFGL.
 * Des valeurs réelles plutôt que des ronds : les identités du pont se vérifient
 * au centime sur des montants à neuf chiffres, et c'est là qu'un contrôle trop
 * serré ou une soustraction en flottant se verrait.
 */
const COMPTES = {
  ofgl_recettes_fonctionnement: 417_137_958.52,
  ofgl_depenses_fonctionnement: 369_011_621.25,
  ofgl_epargne_brute: 48_126_337.27,
  ofgl_epargne_nette: 14_392_071.16,
  ofgl_remboursements_d_emprunts_hors_gad: 33_734_266.11,
  ofgl_recettes_d_investissement_hors_emprunts: 28_524_787.95,
  ofgl_emprunts_hors_gad: 91_001_000.0,
  ofgl_depenses_d_investissement_hors_remb: 135_965_988.05,
  ofgl_recettes_totales: 536_663_746.47,
  ofgl_depenses_totales: 538_711_875.41,
};

function territoire(comptes: Record<string, number>): Territoire {
  return {
    nom: "Bordeaux",
    parent: "33",
    population: 265_000,
    drapeaux: {},
    series: Object.fromEntries(Object.entries(comptes).map(([id, v]) => [id, { "2025": v }])),
  };
}

const BORDEAUX = territoire(COMPTES);

test("les marches s'enchaînent des recettes au solde, en trois blocs", () => {
  const etapes = marches(BORDEAUX, "2025");
  assert.ok(etapes);
  // Neuf lignes d'affilée se lisent comme une liste ; trois blocs de trois se
  // lisent comme un raisonnement.
  assert.deepEqual(
    etapes.map((e) => e.role),
    ["depart", "flux", "palier", "flux", "palier", "report", "flux", "flux", "flux", "arrivee"],
  );
  assert.deepEqual(
    [...new Set(etapes.map((e) => e.section))],
    ["fonctionnement", "dette", "investissement"],
  );
  // Une sortie porte son signe : c'est ce qui fait du pont une addition.
  assert.equal(etapes[1].montant, -369_011_621.25);
  assert.equal(etapes[2].montant, 48_126_337.27);
  // 536 663 746,47 − 538 711 875,41
  assert.ok(Math.abs((etapes[9].montant as number) + 2_048_128.94) < 0.01);
});

test("chaque bloc s'additionne de lui-même, report compris", () => {
  const etapes = marches(BORDEAUX, "2025") as NonNullable<ReturnType<typeof marches>>;
  // Le report reprend le total du bloc précédent : sans lui, la dernière ligne
  // tomberait d'un calcul dont deux termes sont hors du bloc.
  for (const section of ["fonctionnement", "dette", "investissement"] as const) {
    const bloc = etapes.filter((e) => e.section === section);
    const total = bloc.find((e) => e.role === "palier" || e.role === "arrivee");
    const termes = bloc.filter((e) => e.role !== "palier" && e.role !== "arrivee");
    const somme = termes.reduce((s, e) => s + e.montant, 0);
    // Le bloc « dette » n'a qu'un flux : son palier vaut l'épargne brute plus
    // ce flux, et l'épargne brute est le palier du bloc d'avant.
    const report = section === "dette" ? (etapes[2].montant as number) : 0;
    assert.ok(
      Math.abs(somme + report - (total?.montant as number)) < 1,
      `${section} ne s'additionne pas`,
    );
  }
});

test("le report ne compte pas deux fois : il redit le palier précédent", () => {
  const etapes = marches(BORDEAUX, "2025") as NonNullable<ReturnType<typeof marches>>;
  const nette = etapes.find((e) => e.libelle === "Épargne nette");
  const report = etapes.find((e) => e.role === "report");
  assert.equal(report?.montant, nette?.montant);
});

test("un palier qui ne boucle pas retire le pont entier", () => {
  // L'épargne brute publiée démentie d'un million : le bloc ne montre pas huit
  // marches justes et une fausse, il ne montre rien.
  const fausse = territoire({ ...COMPTES, ofgl_epargne_brute: 49_126_337.27 });
  assert.equal(marches(fausse, "2025"), null);
  assert.equal(rendu(fausse), "");
});

test("le bouclage de la section d'investissement est contrôlé lui aussi", () => {
  const fausse = territoire({ ...COMPTES, ofgl_depenses_totales: 500_000_000 });
  assert.equal(marches(fausse, "2025"), null);
});

test("une grandeur absente retire le pont, elle ne le tronque pas", () => {
  const partiel = { ...COMPTES } as Record<string, number>;
  delete partiel.ofgl_emprunts_hors_gad;
  assert.equal(marches(territoire(partiel), "2025"), null);
});

test("l'arrondi de publication ne casse pas le pont", () => {
  // Cent euros d'écart sur un demi-milliard, c'est l'arrondi ; la tolérance
  // vaut un millionième des recettes totales, soit environ 537 €.
  const arrondie = territoire({ ...COMPTES, ofgl_epargne_brute: 48_126_437.27 });
  assert.notEqual(marches(arrondie, "2025"), null);
});

test("un exercice sans comptes ne produit pas de bloc", () => {
  assert.equal(rendu(territoire({})), "");
  assert.equal(rendu(territoire({})), "");
});

test("les montants se lisent à l'échelle de la collectivité", () => {
  assert.equal(montant(417_137_958.52), `417,1${FINE}M€`);
  assert.equal(montant(-369_011_621.25), `−369,0${FINE}M€`);
  assert.equal(montant(1_234_567_890), `1,23${FINE}Md€`);
  assert.equal(montant(45_600), `46${FINE}k€`);
  assert.equal(montant(-820), `−820${FINE}€`);
});

test("le bloc s'affiche ouvert : c'est la question qu'on vient poser", () => {
  const html = rendu(BORDEAUX);
  assert.match(html, /^<section class="pont">/);
  // Derrière un triangle à déplier, « d'un euro encaissé à ce qu'il en reste »
  // se rangeait avec les annexes.
  assert.doesNotMatch(html, /<details/);
  assert.match(html, /exercice 2025/);
  assert.match(html, /Épargne brute/);
  assert.match(html, new RegExp(`417,1${FINE}M€`));
  assert.match(html, /Ce n&#39;est pas un déficit au sens de l&#39;État/);
});

test("la colonne « il reste » est ce qui fait le pont", () => {
  // Neuf lignes de totaux, on les trouve déjà partout ailleurs dans la fiche.
  // Ce qui manquait, c'est le cumul : ce qu'il reste après chaque ligne.
  const etapes = marches(BORDEAUX, "2025") as NonNullable<ReturnType<typeof marches>>;
  assert.equal(etapes[0].reste, 417_137_958.52);
  // 417,1 − 369,0 = 48,1, et le palier publié vaut bien cela.
  assert.ok(Math.abs(etapes[1].reste - 48_126_337.27) < 1);
  assert.equal(etapes[2].reste, 48_126_337.27);
  // Le report remet le cumul à l'épargne nette : la section d'investissement
  // repart de là et non du zéro.
  assert.equal(etapes[5].reste, 14_392_071.16);
  assert.ok(Math.abs((etapes[9].reste as number) + 2_048_128.94) < 0.01);
  const html = rendu(BORDEAUX);
  assert.match(html, /<span>Il reste<\/span>/);
});

/**
 * Le détail du détail.
 *
 * L'OFGL publie ses agrégats avec leur place dans l'arbre comptable, et cette
 * colonne n'était lue nulle part : le site alignait soixante-dix-neuf agrégats
 * à plat, dont des totaux et leurs propres composantes, sans que rien ne dise
 * lesquels contenaient lesquels.
 */

const CATALOGUE = [
  { id: "ofgl_frais_personnel", libelle: "Frais de personnel",
    parent: "ofgl_depenses_fonctionnement" },
  { id: "ofgl_depenses_d_intervention", libelle: "Dépenses d'intervention",
    parent: "ofgl_depenses_fonctionnement" },
  { id: "ofgl_achats_et_charges_externes", libelle: "Achats et charges externes",
    parent: "ofgl_depenses_fonctionnement" },
  { id: "ofgl_charges_financieres", libelle: "Charges financières",
    parent: "ofgl_depenses_fonctionnement" },
  { id: "ofgl_autres_depenses_de_fonctionnement", libelle: "Autres dépenses",
    parent: "ofgl_depenses_fonctionnement" },
] as never as Indicateur[];

// Bordeaux 2025 : les cinq composantes des 369,0 M€ de charges courantes.
const CHARGES = {
  ofgl_frais_personnel: 183_075_349.4,
  ofgl_depenses_d_intervention: 86_707_384.03,
  ofgl_achats_et_charges_externes: 85_732_072.06,
  ofgl_charges_financieres: 8_315_268.29,
  ofgl_autres_depenses_de_fonctionnement: 5_181_547.47,
};

test("une étape s'ouvre sur ce qu'il y a dedans", () => {
  const bordeaux = territoire({ ...COMPTES, ...CHARGES });
  const liste = composantes(
    "ofgl_depenses_fonctionnement", 369_011_621.25, bordeaux, "2025", CATALOGUE,
  );
  assert.ok(liste);
  assert.equal(liste.length, 5);
  // La plus grosse d'abord : c'est la réponse à « où va l'argent ».
  assert.equal(liste[0].libelle, "Frais de personnel");
  assert.equal(Math.round(liste[0].part), 50);
  assert.equal(liste[4].libelle, "Autres dépenses");
  const html = rendu(bordeaux, CATALOGUE);
  assert.match(html, /<details class="pont__ouvrir">/);
  assert.match(html, /Frais de personnel/);
});

test("une décomposition qui ne redonne pas son total ne s'ouvre pas", () => {
  // Une ligne manquante ferait lire « voilà où va l'argent » sous une liste qui
  // n'en explique qu'une partie — et rien dans les nombres ne le trahirait.
  const ampute = { ...CHARGES };
  delete (ampute as Record<string, number>).ofgl_frais_personnel;
  const liste = composantes(
    "ofgl_depenses_fonctionnement", 369_011_621.25,
    territoire({ ...COMPTES, ...ampute }), "2025", CATALOGUE,
  );
  assert.equal(liste, null);
});

test("une composante unique n'est pas une décomposition", () => {
  // Ce serait le même chiffre sous un autre nom.
  const seule = composantes(
    "ofgl_depenses_fonctionnement", 183_075_349.4,
    territoire({ ...COMPTES, ofgl_frais_personnel: 183_075_349.4 }), "2025", CATALOGUE,
  );
  assert.equal(seule, null);
});

test("sans hiérarchie publiée, le pont s'affiche sans se déplier", () => {
  // Les publications antérieures ne portent pas le parent : la fiche doit
  // s'afficher quand même, avec ses neuf marches.
  const html = rendu(BORDEAUX, []);
  assert.match(html, /Charges courantes/);
  assert.doesNotMatch(html, /pont__ouvrir/);
});

test("l'arrondi des composantes ne ferme pas la décomposition", () => {
  // Chaque composante est arrondie au centime : le cumul de cinq arrondis
  // dérive, et un contrôle trop serré fermerait tous les plis du site.
  const derive = { ...CHARGES, ofgl_charges_financieres: 8_315_268.29 + 120 };
  const liste = composantes(
    "ofgl_depenses_fonctionnement", 369_011_621.25,
    territoire({ ...COMPTES, ...derive }), "2025", CATALOGUE,
  );
  assert.notEqual(liste, null);
});

test("la source n'encombre plus la barre latérale", () => {
  // Le pavé de méthode est repris en entier sur la page « Données », où l'on
  // va quand on veut la méthode. Dans la fiche, il poussait les chiffres.
  const html = rendu(BORDEAUX);
  assert.doesNotMatch(html, /Observatoire des finances/);
  assert.doesNotMatch(html, /loi n° 2018-32/);
});

/**
 * Les deux lectures d'un même euro.
 *
 * Les charges de fonctionnement se décomposent de deux façons : ce que la
 * commune achète — personnel, achats, intérêts — et à quoi ça sert — écoles,
 * sport, culture. Les deux décrivent le même total et ne s'additionnent jamais
 * entre elles. Les ranger sous le même parent les aurait fait sommer au double.
 */

const CATALOGUE_FONCTION = [
  ...CATALOGUE,
  { id: "fonction_commune_services_generaux", libelle: "Services généraux",
    parent_fonction: "ofgl_depenses_fonctionnement" },
  { id: "fonction_commune_culture", libelle: "Culture",
    parent_fonction: "ofgl_depenses_fonctionnement" },
  { id: "fonction_commune_sport", libelle: "Sport et jeunesse",
    parent_fonction: "ofgl_depenses_fonctionnement" },
  { id: "fonction_commune_retraitements_ofgl", libelle: "Retraitements de l'OFGL",
    parent_fonction: "ofgl_depenses_fonctionnement" },
] as never as Indicateur[];

// Bordeaux 2023 : le grand livre donne 385,9 M€ là où l'OFGL en publie 353,7.
// La onzième ligne nomme l'écart au lieu de le répartir sur les fonctions.
const FONCTIONS = {
  fonction_commune_services_generaux: 118_600_000,
  fonction_commune_culture: 100_100_000,
  fonction_commune_sport: 167_175_349.4,
  fonction_commune_retraitements_ofgl: -16_863_728.15,
};

test("un même total se lit par nature ou par destination", () => {
  const bordeaux = territoire({ ...COMPTES, ...CHARGES, ...FONCTIONS });
  const nature = composantes(
    "ofgl_depenses_fonctionnement", 369_011_621.25, bordeaux, "2025", CATALOGUE_FONCTION,
  );
  const fonction = composantes(
    "ofgl_depenses_fonctionnement", 369_011_621.25, bordeaux, "2025",
    CATALOGUE_FONCTION, "fonction",
  );
  assert.equal(nature?.length, 5);
  assert.equal(fonction?.length, 4);
  // Le même total des deux côtés : ce sont deux lectures, pas deux mesures.
  const somme = (l: typeof nature) => (l ?? []).reduce((s, c) => s + c.montant, 0);
  assert.ok(Math.abs(somme(nature) - somme(fonction)) < 1);
});

test("le résidu de rapprochement est nommé, pas réparti", () => {
  // Réparti sur les fonctions, l'écart entre le grand livre et l'agrégat de
  // l'OFGL serait devenu invisible — et chaque fonction aurait été faussée.
  const bordeaux = territoire({ ...COMPTES, ...CHARGES, ...FONCTIONS });
  const fonction = composantes(
    "ofgl_depenses_fonctionnement", 369_011_621.25, bordeaux, "2025",
    CATALOGUE_FONCTION, "fonction",
  );
  const residu = fonction?.find((c) => c.id === "fonction_commune_retraitements_ofgl");
  assert.ok(residu);
  assert.ok(residu.montant < 0, "le grand livre est plus large que l'agrégat");
});

test("les deux axes se proposent au choix, jamais ensemble", () => {
  const html = rendu(territoire({ ...COMPTES, ...CHARGES, ...FONCTIONS }), CATALOGUE_FONCTION);
  assert.match(html, /data-axe="nature" aria-pressed="true"/);
  assert.match(html, /data-axe="fonction" aria-pressed="false"/);
  // La seconde liste est dans le document mais masquée : additionnées, les deux
  // compteraient le même euro deux fois.
  assert.match(html, /<ul class="pont__composantes" data-axe="fonction" hidden>/);
});

test("sans second axe, aucune bascule à choisir", () => {
  const html = rendu(territoire({ ...COMPTES, ...CHARGES }), CATALOGUE);
  assert.doesNotMatch(html, /pont__axes/);
  assert.match(html, /Frais de personnel/);
});
