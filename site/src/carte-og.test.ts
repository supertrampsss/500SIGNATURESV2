/**
 * Les cartes de partage, testées sur la chaîne rendue — jamais sur le DOM.
 *
 * Deux garanties dominent ce fichier, parce que ce sont les deux façons dont
 * une image part cassée sans que rien ne rougisse :
 *
 * 1. **le débordement** — un SVG n'a pas de mise en page, un titre trop long
 *    est peint hors du cadre et l'image est publiée quand même ;
 * 2. **l'échappement** — un `&`, un `<` ou un `"` non échappé casse le
 *    document, et le rasteriseur rend alors une image vide.
 *
 * Le cadrage se vérifie avec le modèle de largeur du module lui-même
 * (`largeurApprochee`) : aucune fonte n'étant chargée, il n'existe pas de
 * largeur exacte ici. Ce que le test établit est donc précis — la mise en page
 * respecte le modèle sur lequel elle est bâtie — et c'est ce qui attrape un
 * titre non replié, qui est le défaut visé.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  HAUTEUR,
  LARGEUR,
  type SourceCarte,
  carteAnalyse,
  carteComparaison,
  carteFiche,
  carteReperes,
  carteScenario,
  largeurApprochee,
  replier,
} from "./carte-og.ts";
import { formater } from "./echelle.ts";

/** Une source d'essai. Les valeurs sont manifestement d'essai : `.test` est un
 *  domaine réservé qui ne résout nulle part, et rien ici ne pourrait passer
 *  pour une source réelle du site. */
const SOURCE: SourceCarte = { titre: "Fichier d'essai", millesime: "2025" };
const SITE = "exemple.test";

type Peint = {
  x: number;
  y: number;
  taille: number;
  couleur: string;
  ancre: string;
  contenu: string;
};

const TEXTE =
  /<text x="([-\d.]+)" y="([-\d.]+)" font-family="[^"]*" font-size="([\d.]+)" fill="([^"]*)" text-anchor="(start|end)">([^<]*)<\/text>/g;

function desechapper(texte: string): string {
  return texte
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Tout ce que la carte donne À LIRE, avec sa géométrie. */
function peints(svg: string): Peint[] {
  return [...svg.matchAll(TEXTE)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
    taille: Number(m[3]),
    couleur: m[4],
    ancre: m[5],
    contenu: desechapper(m[6]),
  }));
}

/**
 * Les textes qui sortent du cadre 1200 × 630.
 *
 * La boîte est approchée comme le module l'approche : la largeur par
 * `largeurApprochee`, la hauteur par la hampe (0,8 em au-dessus de la ligne de
 * base) et la jambe (0,25 em en dessous).
 */
function debordements(svg: string): string[] {
  return peints(svg)
    .filter((t) => {
      const largeur = largeurApprochee(t.contenu, t.taille);
      const gauche = t.ancre === "end" ? t.x - largeur : t.x;
      return (
        gauche < 0 ||
        gauche + largeur > LARGEUR ||
        t.y - t.taille * 0.8 < 0 ||
        t.y + t.taille * 0.25 > HAUTEUR
      );
    })
    .map((t) => t.contenu);
}

/** Le document est-il bien formé : une seule racine `svg`, toutes les balises
 *  fermées dans l'ordre, aucun `<` égaré dans un nœud de texte. */
function bienForme(svg: string): boolean {
  const pile: string[] = [];
  let racines = 0;
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z:]+)[^>]*?(\/?)>/g)) {
    const [, fermante, nom, autoferme] = m;
    if (fermante) {
      if (pile.pop() !== nom) return false;
    } else if (!autoferme) {
      if (pile.length === 0) racines += 1;
      pile.push(nom);
    } else if (pile.length === 0) {
      racines += 1;
    }
  }
  // Un `<` de texte non échappé produit un faux jeton ou déséquilibre la pile ;
  // le compte de racines attrape en plus un fragment recollé à côté du `<svg>`.
  return pile.length === 0 && racines === 1 && svg.startsWith("<svg ");
}

/**
 * Un jeton de nombre lisible.
 *
 * Le séparateur de milliers est l'espace fine insécable (U+202F) que `formater`
 * pose : un jeton va d'un chiffre jusqu'au bout de son groupe, virgule
 * comprise, pour que « 1 234,5 » compte pour un nombre et non pour trois. Le
 * caractère est écrit **échappé**, pas tapé : posé au clavier il est
 * indiscernable d'une espace ordinaire, et les deux premières écritures de ce
 * fichier ont fait exactement cette faute.
 */
const NOMBRE = /[0-9][0-9\u202f]*(?:,[0-9]+)?/g;

/** Tous les nombres qu'une carte donne à lire, dans l'ordre. */
function nombresLus(svg: string): string[] {
  return peints(svg).flatMap((t) =>
    [...t.contenu.matchAll(NOMBRE)].map((m) => m[0]),
  );
}

const ANALYSE = {
  titre: "Le coût annoncé de la mesure",
  dit: "cent milliards",
  observe: 1_234_000_000,
  cran: "hors_perimetre" as const,
  source: SOURCE,
  site: SITE,
};

test("1. la carte d'analyse porte le chiffre annoncé, le chiffre des comptes et le cran", () => {
  const svg = carteAnalyse(ANALYSE);
  assert.match(svg, /viewBox="0 0 1200 630"/);
  const lu = peints(svg)
    .map((t) => t.contenu)
    .join(" | ");
  assert.match(lu, /« cent milliards »/);
  // Le montant est produit en APPELANT `formater` : le séparateur est une
  // espace fine insécable, qu'on ne peut pas taper de mémoire sans se tromper.
  assert.ok(lu.includes(formater(1_234_000_000, "EUR", false)));
  assert.match(lu, /Le chiffre existe, mais pas pour ce qu'il désigne/);
});

test("2. la carte porte son unité — sans elle, des millions se lisent milliards", () => {
  const svg = carteAnalyse(ANALYSE);
  const lu = peints(svg).map((t) => t.contenu);
  assert.ok(lu.some((t) => t.includes("Montants en millions d'euros")));
});

test("3. la carte porte sa source, son millésime et l'adresse du site", () => {
  const svg = carteAnalyse(ANALYSE);
  const lu = peints(svg).map((t) => t.contenu);
  assert.ok(lu.some((t) => t.includes("Fichier d'essai")));
  assert.ok(lu.some((t) => t.includes("millésime 2025")));
  assert.ok(lu.some((t) => t === SITE));
});

test("4. la carte d'analyse n'écrit aucun montant qu'elle n'a pas reçu", () => {
  const svg = carteAnalyse(ANALYSE);
  // Les seuls nombres lisibles : le montant observé et le millésime. Un total,
  // une somme, un écart calculé ici en ajouterait un — les budgets ne
  // s'additionnent pas, et ce module ne calcule aucun montant.
  const attendus = new Set([...formater(1_234_000_000, "EUR", false).matchAll(NOMBRE)].map((m) => m[0]));
  attendus.add("2025");
  for (const nombre of nombresLus(svg)) assert.ok(attendus.has(nombre), `nombre inattendu : ${nombre}`);
});

test("5. un titre très long est replié et coupé, jamais peint hors du cadre", () => {
  const long =
    "Le coût annoncé de la mesure, tel qu'il a été cité en séance publique par " +
    "plusieurs intervenants successifs au cours du débat budgétaire, puis repris " +
    "sans changement par la presse pendant les semaines suivantes";
  const svg = carteAnalyse({ ...ANALYSE, titre: long });
  assert.deepEqual(debordements(svg), []);
  assert.ok(bienForme(svg));
  // Le montant reste peint : ce que la coupe retire, c'est du titre, jamais un
  // chiffre. Un titre qui pousserait les rangées hors de la bande du corps les
  // ferait disparaître du cadre sans rien casser.
  const lu = peints(svg).map((t) => t.contenu);
  assert.ok(lu.some((t) => t.includes(formater(1_234_000_000, "EUR", false))));
  assert.ok(lu.some((t) => t.endsWith("…")), "le titre coupé se signale");
});

test("6. un libellé très long ne recouvre pas sa valeur", () => {
  const svg = carteAnalyse({
    ...ANALYSE,
    dit: "cent milliards d'euros par an, en autorisations d'engagement, sur la durée de la programmation",
  });
  assert.deepEqual(debordements(svg), []);
  const lu = peints(svg).map((t) => t.contenu);
  assert.ok(lu.some((t) => t.includes(formater(1_234_000_000, "EUR", false))));
});

test("7. « & », « < » et les guillemets droits sont échappés", () => {
  const svg = carteAnalyse({
    ...ANALYSE,
    titre: 'Recherche & enseignement <script>alert("x")</script>',
    dit: "R&D",
  });
  assert.ok(bienForme(svg));
  assert.ok(!svg.includes("<script"), "aucune balise étrangère n'entre dans le document");
  assert.match(svg, /&amp;/);
  assert.match(svg, /&lt;script&gt;/);
  // Ce qui est peint reste le texte d'origine, une fois déséchappé.
  const lu = peints(svg).map((t) => t.contenu);
  assert.ok(lu.some((t) => t.includes("Recherche & enseignement")));
});

test("8. sans chiffre des comptes, la rangée disparaît au lieu de peindre un vide", () => {
  const svg = carteAnalyse({ ...ANALYSE, observe: null, cran: "introuvable" });
  const lu = peints(svg).map((t) => t.contenu);
  assert.ok(!lu.some((t) => t.includes("Chiffre des comptes")));
  assert.ok(lu.some((t) => t.includes("Aucune ligne publiée ne porte ce montant")));
  assert.deepEqual(debordements(svg), []);
});

const SCENARIO = {
  nom: "Mon budget d'essai",
  effort: 2_500_000_000,
  gestes: [
    { libelle: "Ligne d'essai légère", montant: 40_000_000 },
    { libelle: "Ligne d'essai lourde", montant: -1_800_000_000 },
    { libelle: "Ligne d'essai moyenne", montant: 600_000_000 },
    { libelle: "Ligne d'essai la plus légère", montant: 3_000_000 },
  ],
  source: SOURCE,
  site: SITE,
};

const COMPARAISON = {
  titre: "Deux scénarios d'essai",
  colonnes: [
    { nom: "Colonne d'essai A", effort: 1_200_000_000 },
    { nom: "Colonne d'essai B", effort: 3_400_000_000 },
  ] as [{ nom: string; effort: number }, { nom: string; effort: number }],
  ecarts: [
    { libelle: "Ligne d'essai lourde", cellules: [-900_000_000, 200_000_000] as [number, number] },
    { libelle: "Ligne d'essai légère", cellules: [10_000_000, null] as [number, null] },
    { libelle: "Ligne d'essai moyenne", cellules: [null, 500_000_000] as [null, number] },
    { libelle: "Ligne d'essai minuscule", cellules: [1_000_000, 2_000_000] as [number, number] },
  ],
  source: SOURCE,
  site: SITE,
};

const FICHE = {
  territoire: "Territoire d'essai",
  chiffres: [
    { libelle: "Dépenses d'essai", valeur: 87_400_000, unite: "EUR" },
    { libelle: "Recettes d'essai", valeur: 91_100_000, unite: "EUR" },
    { libelle: "Taux d'essai", valeur: 14.3, unite: "percent", variation: 2.1 },
  ],
  exercice: "2023",
  source: SOURCE,
  site: SITE,
};

const REPERES = {
  titre: "Le repère d'essai a changé de niveau entre les deux exercices",
  unite: "Taux en pourcentage",
  source: SOURCE,
  site: SITE,
};

/** Les cinq natures, pour les garanties qu'elles partagent toutes. */
const CINQ: [string, string][] = [
  ["analyse", carteAnalyse(ANALYSE)],
  ["scénario", carteScenario(SCENARIO)],
  ["comparaison", carteComparaison(COMPARAISON)],
  ["fiche", carteFiche(FICHE)],
  ["repères", carteReperes(REPERES)],
];

test("10. les cinq natures tiennent le cadre, la source, le millésime et l'adresse", () => {
  for (const [nom, svg] of CINQ) {
    assert.ok(svg.includes('viewBox="0 0 1200 630"'), nom);
    assert.ok(bienForme(svg), nom);
    assert.deepEqual(debordements(svg), [], nom);
    const lu = peints(svg).map((t) => t.contenu);
    assert.ok(lu.some((t) => t.includes("Fichier d'essai")), `${nom} : source`);
    assert.ok(lu.some((t) => t.includes("millésime 2025")), `${nom} : millésime`);
    assert.ok(lu.some((t) => t === SITE), `${nom} : adresse`);
  }
});

test("11. les quatre cartes qui alignent des montants portent leur unité", () => {
  for (const [nom, svg] of CINQ.filter(([n]) => n !== "repères")) {
    const lu = peints(svg).map((t) => t.contenu);
    assert.ok(lu.some((t) => t.includes("Montants en millions d'euros")), nom);
  }
  // Le repère n'aligne pas de montants : il porte l'unité de son graphique.
  const reperes = peints(carteReperes(REPERES)).map((t) => t.contenu);
  assert.ok(reperes.some((t) => t.includes("Taux en pourcentage")));
});

test("12. la carte de scénario nomme la somme des écarts et ses trois gestes les plus lourds", () => {
  const svg = carteScenario(SCENARIO);
  const lu = peints(svg).map((t) => t.contenu);
  // « Somme des écarts », jamais « Budget » : seul et gros sur une image, ce
  // nombre se lirait comme le budget que le scénario propose.
  assert.ok(lu.some((t) => t === "Somme des écarts"));
  assert.ok(lu.some((t) => t.includes(formater(2_500_000_000, "EUR", false))));
  assert.ok(lu.some((t) => t === "Ligne d'essai lourde"));
  assert.ok(lu.some((t) => t === "Ligne d'essai moyenne"));
  assert.ok(lu.some((t) => t === "Ligne d'essai légère"));
  // Le quatrième, le plus léger, ne monte pas : la carte en porte trois.
  assert.ok(!lu.some((t) => t === "Ligne d'essai la plus légère"));
});

test("13. la carte de scénario n'écrit aucun montant qu'elle n'a pas reçu", () => {
  const svg = carteScenario(SCENARIO);
  const attendus = new Set(["2025"]);
  for (const montant of [2_500_000_000, -1_800_000_000, 600_000_000, 40_000_000]) {
    for (const m of formater(montant, "EUR", false).matchAll(NOMBRE)) {
      attendus.add(m[0]);
    }
  }
  for (const nombre of nombresLus(svg)) {
    assert.ok(attendus.has(nombre), `nombre inattendu : ${nombre}`);
  }
});

test("14. la comparaison n'écrit jamais la somme des deux colonnes", () => {
  const svg = carteComparaison(COMPARAISON);
  const lu = peints(svg).map((t) => t.contenu);
  assert.ok(lu.some((t) => t.includes(formater(1_200_000_000, "EUR", false))));
  assert.ok(lu.some((t) => t.includes(formater(3_400_000_000, "EUR", false))));
  // Deux budgets ne s'additionnent pas. Un troisième nombre sous les deux
  // autres se lirait comme leur total.
  const total = formater(1_200_000_000 + 3_400_000_000, "EUR", false);
  assert.ok(!lu.some((t) => t.includes(total)), `la somme ${total} est peinte`);
  const cumul = formater(-900_000_000 + 200_000_000, "EUR", false);
  assert.ok(!lu.some((t) => t.includes(cumul)), `le cumul de ligne ${cumul} est peint`);
});

test("15. la comparaison ne désigne aucune tête : deux colonnes au même corps", () => {
  const svg = carteComparaison(COMPARAISON);
  const noms = peints(svg).filter((t) => t.contenu.startsWith("Colonne d'essai "));
  assert.equal(noms.length, 2);
  // Une marque de tête, sur une image, c'est d'abord un corps ou une encre qui
  // diffère. Les deux colonnes sont peintes à l'identique, dans l'ordre reçu.
  assert.equal(noms[0].taille, noms[1].taille);
  assert.equal(noms[0].couleur, noms[1].couleur);
  assert.equal(noms[0].y, noms[1].y);
  assert.deepEqual(
    noms.map((n) => n.contenu),
    ["Colonne d'essai A", "Colonne d'essai B"],
  );
  const lu = peints(svg).map((t) => t.contenu).join(" | ");
  assert.doesNotMatch(
    lu,
    /gagnant|vainqueur|meilleur|pire|classement|palmarès|1er|premier|second|note\s|★|🏆/i,
  );
});

test("16. une cellule non réglée se distingue d'un zéro", () => {
  const svg = carteComparaison(COMPARAISON);
  const lu = peints(svg).map((t) => t.contenu);
  assert.ok(lu.some((t) => t === "Non réglé"));
  assert.ok(!lu.some((t) => t === formater(0, "EUR", false)));
});

test("17. la fiche porte trois chiffres et son exercice, et un taux varie en points", () => {
  const svg = carteFiche(FICHE);
  const lu = peints(svg).map((t) => t.contenu);
  assert.ok(lu.some((t) => t === "Territoire d'essai"));
  assert.ok(lu.some((t) => t.includes(formater(87_400_000, "EUR", false))));
  assert.ok(lu.some((t) => t.includes(formater(91_100_000, "EUR", false))));
  assert.ok(lu.some((t) => t.includes(formater(14.3, "percent", false))));
  assert.ok(lu.some((t) => t.includes("exercice 2023")));
  // Un taux varie en POINTS. « +2,1 % » dirait autre chose, et ce serait faux.
  assert.ok(lu.some((t) => t.includes("+2,1 points")), "la variation d'un taux est en points");
  assert.ok(!lu.some((t) => t.includes("+2,1 %")));
});

test("18. sans montant en euros, la fiche n'annonce pas des millions d'euros", () => {
  const svg = carteFiche({
    ...FICHE,
    chiffres: [{ libelle: "Taux d'essai", valeur: 14.3, unite: "percent" }],
  });
  const lu = peints(svg).map((t) => t.contenu);
  assert.ok(!lu.some((t) => t.includes("Montants en millions d'euros")));
  assert.ok(lu.some((t) => t === "Exercice 2023"));
});

test("19. une affirmation très longue tient dans la carte de repère", () => {
  const svg = carteReperes({
    ...REPERES,
    titre:
      "Le repère d'essai a changé de niveau entre les deux exercices publiés, " +
      "et la série que le site publie le montre exercice par exercice sans " +
      "qu'aucun lissage ne vienne en adoucir la marche, ce qui rend la phrase " +
      "beaucoup plus longue qu'aucun titre du site ne l'est jamais en pratique",
  });
  assert.ok(bienForme(svg));
  assert.deepEqual(debordements(svg), []);
  const lu = peints(svg).map((t) => t.contenu);
  assert.ok(lu.some((t) => t.endsWith("…")), "l'affirmation coupée se signale");
  assert.ok(lu.some((t) => t.includes("Fichier d'essai")));
});

test("20. les libellés très longs des quatre autres natures ne débordent pas", () => {
  const tres = "Un libellé d'essai délibérément très long qui ne tiendrait dans aucune colonne ".repeat(2);
  const cartes = [
    carteScenario({
      ...SCENARIO,
      nom: tres,
      gestes: SCENARIO.gestes.map((g) => ({ ...g, libelle: tres })),
    }),
    carteComparaison({
      ...COMPARAISON,
      titre: tres,
      colonnes: COMPARAISON.colonnes.map((c) => ({ ...c, nom: tres })) as typeof COMPARAISON.colonnes,
      ecarts: COMPARAISON.ecarts.map((e) => ({ ...e, libelle: tres })),
    }),
    carteFiche({
      ...FICHE,
      territoire: tres,
      chiffres: FICHE.chiffres.map((c) => ({ ...c, libelle: tres })),
    }),
    carteAnalyse({ ...ANALYSE, titre: tres, dit: tres }),
  ];
  for (const svg of cartes) {
    assert.ok(bienForme(svg));
    assert.deepEqual(debordements(svg), []);
  }
});

test("21. replier coupe au mot, et coupe en dur un mot plus long qu'une ligne", () => {
  assert.deepEqual(replier("un deux trois", 20, 400, 3), ["un deux trois"]);
  const lignes = replier("un deux trois quatre cinq six sept huit neuf dix onze", 20, 120, 2);
  assert.equal(lignes.length, 2);
  assert.ok(lignes[1].endsWith("…"));
  for (const ligne of lignes) assert.ok(largeurApprochee(ligne, 20) <= 120);
  const colle = replier("abcdefghijklmnopqrstuvwxyz", 20, 120, 3);
  for (const ligne of colle) assert.ok(largeurApprochee(ligne, 20) <= 120);
});
