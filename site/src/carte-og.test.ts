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
 * (`largeurApprochee`). Un test mesurant avec la constante qui a servi à la
 * mise en page ne prouve rien de la fonte, et c'est ce qui est arrivé : le
 * titre « PROGRAMME 150 FORMATIONS SUPÉRIEURES ET » sortait du cadre de 39 px,
 * vert. Le modèle est donc maintenant mesuré caractère par caractère dans la
 * fonte embarquée, et un test l'ADOSSE aux avances relevées sur le PNG
 * rasterisé : le modèle doit les majorer.
 *
 * « Dans le cadre 1200 × 630 » ne suffit pas non plus, et trois défauts l'ont
 * montré : une rangée posée à y=578 marchait dans le pied, un libellé occupant
 * [72, 1074] passait sous une valeur occupant [951, 1128], et les deux étaient
 * « dans le cadre ». Trois garanties de plus, donc, sur les coordonnées
 * émises :
 *
 * 3. **les bandes** — chaque texte est dans les marges, et rien n'est peint
 *    entre le bas du corps et les deux lignes du pied (`horsBandes`) ;
 * 4. **le non-recouvrement deux à deux** — aucun texte n'en couvre un autre
 *    (`recouvrements`). Cette mesure passe encore par le modèle, mais elle
 *    éprouve une **logique** — la gouttière déduite de la largeur du libellé —
 *    et l'attrape quelles que soient les avances ;
 * 5. **le pire cas** — les cinq cartes ordinaires sont remesurées à un modèle
 *    élargi, ce qui **borne** l'erreur que le dessin tolère au lieu de la
 *    supposer nulle.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  GEOMETRIE,
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
import { formaterVariation, modeVariation } from "./evolution-carte.ts";
import { eurosSigne } from "./simulateur-rendu.ts";

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
 * La boîte approchée d'un texte peint : la largeur par le modèle du module, la
 * hauteur par la hampe (0,8 em au-dessus de la ligne de base) et la jambe
 * (0,25 em en dessous).
 *
 * `facteur` remesure la même chaîne à un modèle plus large : c'est le pire cas,
 * et il borne l'erreur que le dessin tolère au lieu de la supposer nulle.
 */
function boite(t: Peint, facteur: number) {
  const largeur = largeurApprochee(t.contenu, t.taille) * facteur;
  const gauche = t.ancre === "end" ? t.x - largeur : t.x;
  return {
    gauche,
    droite: gauche + largeur,
    haut: t.y - t.taille * 0.8,
    bas: t.y + t.taille * 0.25,
  };
}

/** Les textes qui sortent du cadre 1200 × 630. */
function debordements(svg: string, facteur = 1): string[] {
  return peints(svg)
    .filter((t) => {
      const b = boite(t, facteur);
      return b.gauche < 0 || b.droite > LARGEUR || b.haut < 0 || b.bas > HAUTEUR;
    })
    .map((t) => t.contenu);
}

/**
 * Les textes hors de leur bande.
 *
 * Deux règles, sur les coordonnées émises seules : rien n'entre dans une marge,
 * et rien n'est peint entre le bas du corps et les deux lignes du pied. Une
 * rangée qui débordait la bande du corps se posait à y=578 — au-dessus de la
 * source, en travers du pied — et restait « dans le cadre ».
 */
function horsBandes(svg: string): string[] {
  const { MARGE, CORPS_BAS, PIED_UNITE, PIED_SOURCE } = GEOMETRIE;
  return peints(svg)
    .filter((t) => {
      const dansLaMarge = t.ancre === "start" ? t.x < MARGE : t.x > LARGEUR - MARGE;
      const surUneLigne = t.y <= CORPS_BAS || t.y === PIED_UNITE || t.y === PIED_SOURCE;
      return dansLaMarge || !surUneLigne;
    })
    .map((t) => `${t.contenu} (x=${t.x}, y=${t.y})`);
}

/**
 * Les couples de textes qui se recouvrent.
 *
 * Deux boîtes qui se **touchent** ne se recouvrent pas : les deux colonnes de
 * la comparaison partagent leur largeur bord à bord, et une inégalité large les
 * déclarerait fautives à tort.
 */
function recouvrements(svg: string, facteur = 1): string[] {
  const boites = peints(svg).map((t) => ({ t, b: boite(t, facteur) }));
  const couples: string[] = [];
  for (let i = 0; i < boites.length; i += 1) {
    for (let j = i + 1; j < boites.length; j += 1) {
      const a = boites[i];
      const z = boites[j];
      if (a.b.gauche < z.b.droite && z.b.gauche < a.b.droite && a.b.haut < z.b.bas && z.b.haut < a.b.bas) {
        couples.push(`« ${a.t.contenu} » recouvre « ${z.t.contenu} » à y=${a.t.y}`);
      }
    }
  }
  return couples;
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

/** Les chaînes qu'aucun titre du site n'atteint : c'est là que la mise en page
 *  casse, et c'est donc là qu'on la regarde. */
const TITRE_LONG =
  "Le coût annoncé de la mesure, tel qu'il a été cité en séance publique par " +
  "plusieurs intervenants successifs au cours du débat budgétaire, puis repris " +
  "sans changement par la presse pendant les semaines suivantes";
const DIT_LONG =
  "cent milliards d'euros par an, en autorisations d'engagement, sur la durée de la programmation";
const LIBELLE_LONG =
  "Un libellé d'essai délibérément très long qui ne tiendrait dans aucune colonne ".repeat(2);
/** Le titre mesuré qui débordait : 39 capitales, 1 095 unités d'encre réelle
 *  pour 1 056 disponibles. */
const TITRE_CAPITALES = "PROGRAMME 150 FORMATIONS SUPÉRIEURES ET";
const AFFIRMATION_LONGUE =
  "Le repère d'essai a changé de niveau entre les deux exercices publiés, " +
  "et la série que le site publie le montre exercice par exercice sans " +
  "qu'aucun lissage ne vienne en adoucir la marche, ce qui rend la phrase " +
  "beaucoup plus longue qu'aucun titre du site ne l'est jamais en pratique";

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
  const svg = carteAnalyse({ ...ANALYSE, titre: TITRE_LONG });
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
  const svg = carteAnalyse({ ...ANALYSE, dit: DIT_LONG });
  assert.deepEqual(debordements(svg), []);
  // Le nom de ce test est sa garantie : « dans le cadre » ne dit rien du
  // recouvrement. Sans la gouttière déduite de la largeur restante, le libellé
  // et sa valeur se peignent l'un sur l'autre, à la même ordonnée, et le cadre
  // reste tenu.
  assert.deepEqual(recouvrements(svg), []);
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

test("8 bis. sans chiffre des comptes, l'analyse n'annonce pas des millions d'euros", () => {
  // Le cas réel : le catalogue déclare l'indicateur observé autrement qu'en
  // euros, `donneesCarteAnalyse` (scripts/prerendre.ts) pose alors
  // `observe: null`, et la carte ne peint plus aucun montant. Le chiffre
  // annoncé, lui, est une citation — du texte. Annoncer des millions d'euros
  // sous une carte qui n'en porte aucun serait faux : `carteFiche` tient déjà
  // cette règle sous trois taux (test 24).
  const svg = carteAnalyse({ ...ANALYSE, observe: null, cran: "introuvable" });
  const lu = peints(svg).map((t) => t.contenu);
  assert.ok(!lu.some((t) => t.includes("Montants en millions d'euros")), lu.join(" | "));
  // Ce que la carte perd, c'est la mention — jamais sa provenance, qui est ce
  // sans quoi elle ne se relit pas une fois sortie du site.
  assert.ok(lu.some((t) => t.includes("Fichier d'essai")));
  assert.ok(lu.some((t) => t.includes("millésime 2025")));
  assert.deepEqual(debordements(svg), []);
  assert.deepEqual(horsBandes(svg), []);
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

/** Les cinq natures poussées aux chaînes longues : c'est là que le repli, la
 *  coupe et la gouttière travaillent vraiment. */
const LONGUES: [string, string][] = [
  ["analyse, titre long", carteAnalyse({ ...ANALYSE, titre: TITRE_LONG })],
  ["analyse, valeur longue", carteAnalyse({ ...ANALYSE, dit: DIT_LONG })],
  [
    "analyse, tout long",
    carteAnalyse({ ...ANALYSE, titre: LIBELLE_LONG, dit: LIBELLE_LONG }),
  ],
  [
    "scénario, libellés longs",
    carteScenario({
      ...SCENARIO,
      nom: LIBELLE_LONG,
      gestes: SCENARIO.gestes.map((g) => ({ ...g, libelle: LIBELLE_LONG })),
    }),
  ],
  [
    "comparaison, libellés longs",
    carteComparaison({
      ...COMPARAISON,
      titre: LIBELLE_LONG,
      colonnes: COMPARAISON.colonnes.map((c) => ({ ...c, nom: LIBELLE_LONG })) as typeof COMPARAISON.colonnes,
      ecarts: COMPARAISON.ecarts.map((e) => ({ ...e, libelle: LIBELLE_LONG })),
    }),
  ],
  [
    "fiche, libellés longs",
    carteFiche({
      ...FICHE,
      territoire: LIBELLE_LONG,
      chiffres: FICHE.chiffres.map((c) => ({ ...c, libelle: LIBELLE_LONG })),
    }),
  ],
  ["repère, affirmation longue", carteReperes({ ...REPERES, titre: AFFIRMATION_LONGUE })],
];

const TOUTES: [string, string][] = [...CINQ, ...LONGUES];

test("9. les cinq natures tiennent le cadre, la source, le millésime et l'adresse", () => {
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

test("10. aucun texte ne sort de sa bande : ni dans une marge, ni dans le pied", () => {
  // Sur les coordonnées émises seules, sans modèle de largeur. Une rangée de
  // trop poussait la dernière ligne du corps à y=578, entre la mention d'unité
  // (y=552) et la source (y=590) : par-dessus le pied, et dans le cadre.
  for (const [nom, svg] of TOUTES) assert.deepEqual(horsBandes(svg), [], nom);
});

test("11. aucun texte n'en recouvre un autre", () => {
  for (const [nom, svg] of TOUTES) assert.deepEqual(recouvrements(svg), [], nom);
});

test("12. le modèle de largeur majore la fonte embarquée", () => {
  // Les avances relevées sur le PNG rasterisé de Public Sans Regular, à corps
  // 100. Le modèle doit passer AU-DESSUS : en dessous, il autorise des lignes
  // que la fonte fait déborder, et c'est invisible jusqu'à la publication.
  const parCaractere: [string, number][] = [
    ["0123456789", 0.596],
    ["8888888888", 0.642],
  ];
  for (const [chaine, mesure] of parCaractere) {
    const modele = largeurApprochee(chaine, 100) / [...chaine].length;
    assert.ok(modele >= mesure, `${chaine} : modèle ${modele} < encre mesurée ${mesure}`);
  }
  // Deux titres en capitales mesurés à corps 46, en unités d'encre depuis la
  // marge gauche : l'un tenait de 10 px, l'autre débordait de 39.
  assert.ok(largeurApprochee("COMMISSION DES FINANCES DE L'ASSEMBLÉE", 46) >= 1118 - 72);
  assert.ok(largeurApprochee(TITRE_CAPITALES, 46) >= 1167 - 72);
  // L'espace fine insécable de `formater` n'a pas de glyphe dans cette fonte,
  // mais elle avance : ni zéro (les montants seraient sous-estimés), ni une
  // espace entière (ils seraient surestimés).
  const fine = largeurApprochee("\u202f", 100);
  assert.ok(fine >= 12.17, `l'espace fine avance de ${fine}, moins que l'encre mesurée`);
  assert.ok(fine < largeurApprochee(" ", 100), "elle n'avance pas comme une espace ordinaire");
});

test("13. le dessin garde une marge sur le modèle, et le test la borne", () => {
  // Le modèle majore déjà la fonte, mais il ne connaît ni le crénage ni les
  // arrondis du rasteriseur. Ce test remesure les cinq cartes ordinaires à un
  // modèle élargi et exige que ça tienne encore : il DIT ce que le dessin
  // tolère au lieu de le supposer nul.
  //
  // Les cartes ordinaires cassent à +14,5 % (le repère, dont l'affirmation
  // occupe la ligne entière), +30 % (la comparaison, dont les deux colonnes de
  // valeurs se partagent la largeur sans gouttière entre elles), et au-delà de
  // +70 % pour les trois autres. La borne est posée sous la plus serrée.
  const pire = 1.1;
  for (const [nom, svg] of CINQ) {
    assert.deepEqual(debordements(svg, pire), [], `${nom} : hors cadre à +10 %`);
    assert.deepEqual(recouvrements(svg, pire), [], `${nom} : recouvrement à +10 %`);
  }
  // Les chaînes longues, elles, ne tolèrent rien par construction : `replier`
  // remplit la ligne au modèle, donc tout modèle plus large la fait déborder.
});

test("14. un titre en capitales tient — le cas mesuré qui débordait de 39 px", () => {
  const svg = carteAnalyse({ ...ANALYSE, titre: TITRE_CAPITALES });
  assert.deepEqual(debordements(svg), []);
  assert.deepEqual(recouvrements(svg), []);
  assert.deepEqual(horsBandes(svg), []);
  // Ce titre ne tient pas sur une ligne : 39 capitales avancent plus que la
  // moyenne d'un texte français. Il se replie donc, et il ne se rogne pas —
  // l'affirmation reste entière sur la carte.
  const corps = Math.max(...peints(svg).map((t) => t.taille));
  const lignes = peints(svg).filter((t) => t.taille === corps).map((t) => t.contenu);
  assert.equal(lignes.length, 2);
  assert.equal(lignes.join(" "), TITRE_CAPITALES);
  assert.ok(!lignes.some((l) => l.endsWith("…")), "rien n'est coupé");
});

test("15. les quatre cartes qui alignent des montants portent leur unité", () => {
  for (const [nom, svg] of CINQ.filter(([n]) => n !== "repères")) {
    const lu = peints(svg).map((t) => t.contenu);
    assert.ok(lu.some((t) => t.includes("Montants en millions d'euros")), nom);
  }
  // Le repère n'aligne pas de montants : il porte l'unité de son graphique.
  const reperes = peints(carteReperes(REPERES)).map((t) => t.contenu);
  assert.ok(reperes.some((t) => t.includes("Taux en pourcentage")));
});

test("16. la carte de scénario nomme la somme des écarts et ses trois gestes les plus lourds", () => {
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

test("16 bis. les écarts d'un scénario portent leur signe, comme partout ailleurs", () => {
  // Sur un écart, le sens du geste est l'information : « 2 500 M€ » ne dit pas
  // s'il s'ajoute ou se retranche. L'écran, l'aperçu du lien et le résumé
  // collé écrivent tous « +2 500 M€ » (`eurosSigne`) ; l'image écrivait la même
  // grandeur sans son signe, à côté du texte qui, lui, le portait.
  //
  // Les valeurs attendues se PRODUISENT en appelant `eurosSigne` : le
  // séparateur est une espace fine insécable, qu'aucun clavier ne distingue
  // d'une espace ordinaire.
  const lu = peints(carteScenario(SCENARIO)).map((t) => t.contenu);
  assert.ok(lu.includes(eurosSigne(2_500_000_000)), lu.join(" | "));
  assert.ok(lu.includes(eurosSigne(600_000_000)), lu.join(" | "));
  // Le signe d'une baisse est celui de `formater` — le moins typographique du
  // site, jamais le tiret du clavier.
  assert.ok(lu.includes(eurosSigne(-1_800_000_000)), lu.join(" | "));
  // Et aucune hausse n'est peinte nue : c'est exactement la forme perdue.
  assert.ok(!lu.includes(formater(2_500_000_000, "EUR", false)), lu.join(" | "));
});

test("17. la carte de scénario n'écrit aucun montant qu'elle n'a pas reçu", () => {
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

test("18. la comparaison n'écrit jamais la somme des deux colonnes", () => {
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

/**
 * Six écarts choisis pour que trois critères de tri donnent trois trios
 * différents : le plus gros des deux montants (celui que la carte annonce), le
 * plus petit, ou leur somme. Sans cette séparation, un tri inversé ou une somme
 * peindrait trois lignes différentes sans qu'aucun test ne bouge — ce qui est
 * arrivé.
 */
const POIDS = {
  ...COMPARAISON,
  ecarts: [
    { libelle: "Ligne d'essai lourde", cellules: [800_000_000, 10_000_000] as [number, number] },
    { libelle: "Ligne d'essai moyenne", cellules: [700_000_000, 20_000_000] as [number, number] },
    { libelle: "Ligne d'essai légère", cellules: [600_000_000, 30_000_000] as [number, number] },
    { libelle: "Ligne d'essai serrée", cellules: [40_000_000, 35_000_000] as [number, number] },
    { libelle: "Ligne d'essai équilibrée", cellules: [450_000_000, 450_000_000] as [number, number] },
    { libelle: "Ligne d'essai d'un seul côté", cellules: [null, 900_000_000] as [null, number] },
  ],
};

test("19. la comparaison montre les trois écarts les plus lourds, au plus gros des deux montants", () => {
  const svg = carteComparaison(POIDS);
  const retenues = peints(svg)
    .filter((t) => t.contenu.startsWith("Ligne d'essai "))
    .sort((a, z) => a.y - z.y)
    .map((t) => t.contenu);
  // Au plus gros des deux : 900, 800, 700. Au plus petit, ce serait
  // « équilibrée », « serrée », « légère » ; à la somme, « équilibrée »,
  // « d'un seul côté », « lourde ». Le trio ci-dessous ne sort que du bon
  // critère — et une cellule non réglée ne disqualifie pas sa ligne, elle pèse
  // ce que pèse l'autre.
  assert.deepEqual(retenues, [
    "Ligne d'essai d'un seul côté",
    "Ligne d'essai lourde",
    "Ligne d'essai moyenne",
  ]);
});

test("20. la comparaison ne désigne aucune tête : deux colonnes au même corps", () => {
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

test("21. une cellule non réglée se distingue d'un zéro", () => {
  const svg = carteComparaison(COMPARAISON);
  const lu = peints(svg).map((t) => t.contenu);
  assert.ok(lu.some((t) => t === "Non réglé"));
  assert.ok(!lu.some((t) => t === formater(0, "EUR", false)));
});

test("22. la fiche porte trois chiffres et son exercice, et un taux varie en points", () => {
  const svg = carteFiche(FICHE);
  const lu = peints(svg).map((t) => t.contenu);
  assert.ok(lu.some((t) => t === "Territoire d'essai"));
  assert.ok(lu.some((t) => t.includes(formater(87_400_000, "EUR", false))));
  assert.ok(lu.some((t) => t.includes(formater(91_100_000, "EUR", false))));
  assert.ok(lu.some((t) => t.includes(formater(14.3, "percent", false))));
  assert.ok(lu.some((t) => t.includes("exercice 2023")));
  // Un taux varie en POINTS. « +2,1 % » dirait autre chose, et ce serait faux.
  // La chaîne attendue se PRODUIT, elle ne se tape pas : elle porte l'espace
  // fine insécable et l'abréviation du site, « pts », que la carte avait
  // réécrites en « points » avec une espace ordinaire.
  const attendue = formaterVariation(2.1, "percent", modeVariation("percent"));
  assert.ok(lu.some((t) => t.includes(attendue)), `la variation d'un taux est en points : ${attendue}`);
  assert.ok(!lu.some((t) => t.includes("+2,1 %")));
});

test("23. un taux publié pour mille varie en points, et pas d'un facteur dix", () => {
  // `formater` affiche les `pour_1000_*` en pourcentage après division par dix :
  // 21 ‰ se lit « 2,1 % ». Sa variation suit la même conversion et se dit en
  // points. Écrite à part, la règle avait raté les deux d'un coup — la carte
  // peignait « 2,1 % (+21 %) » : le mauvais mot et dix fois la grandeur.
  const unite = "pour_1000_habitants";
  const svg = carteFiche({
    ...FICHE,
    chiffres: [{ libelle: "Taux d'essai pour mille", valeur: 21, unite, variation: 21 }],
  });
  const lu = peints(svg).map((t) => t.contenu);
  const attendue = `${formater(21, unite, false)} (${formaterVariation(21, unite, modeVariation(unite))})`;
  assert.ok(lu.some((t) => t === attendue), `attendu « ${attendue} », lu « ${lu.join(" | ")} »`);
  assert.ok(!lu.some((t) => t.includes("+21")), "la variation n'est pas dix fois trop grande");
  assert.ok(!lu.some((t) => t.includes("21 %")), "la variation d'un taux ne s'écrit pas en %");
});

test("24. sans montant en euros, la fiche n'annonce pas des millions d'euros", () => {
  const svg = carteFiche({
    ...FICHE,
    chiffres: [{ libelle: "Taux d'essai", valeur: 14.3, unite: "percent" }],
  });
  const lu = peints(svg).map((t) => t.contenu);
  assert.ok(!lu.some((t) => t.includes("Montants en millions d'euros")));
  assert.ok(lu.some((t) => t === "Exercice 2023"));
});

test("25. la fiche ne porte que trois chiffres, dans l'ordre reçu", () => {
  const svg = carteFiche({
    ...FICHE,
    chiffres: [...FICHE.chiffres, { libelle: "Quatrième d'essai", valeur: 5_000_000, unite: "EUR" }],
  });
  const lu = peints(svg).map((t) => t.contenu);
  assert.ok(!lu.some((t) => t === "Quatrième d'essai"));
  // Les trois premiers, sans tri : un montant et un taux ne se rangent pas
  // l'un contre l'autre, et l'ordre reçu est celui que la fiche a choisi.
  const attendus = ["Dépenses d'essai", "Recettes d'essai", "Taux d'essai"];
  const libelles = peints(svg)
    .filter((t) => attendus.includes(t.contenu))
    .sort((a, z) => a.y - z.y)
    .map((t) => t.contenu);
  assert.deepEqual(libelles, attendus);
});

test("26. une affirmation très longue tient dans la carte de repère", () => {
  const svg = carteReperes({ ...REPERES, titre: AFFIRMATION_LONGUE });
  assert.ok(bienForme(svg));
  assert.deepEqual(debordements(svg), []);
  const lu = peints(svg).map((t) => t.contenu);
  assert.ok(lu.some((t) => t.endsWith("…")), "l'affirmation coupée se signale");
  assert.ok(lu.some((t) => t.includes("Fichier d'essai")));
});

test("27. les libellés très longs des quatre autres natures ne débordent pas", () => {
  for (const [nom, svg] of LONGUES) {
    assert.ok(bienForme(svg), nom);
    assert.deepEqual(debordements(svg), [], nom);
  }
});

test("28. une carte sans source, sans millésime ou sans adresse ne se dessine pas", () => {
  // Le type exige ces trois champs ; une chaîne vide passe le type. L'image
  // partait alors en peignant « Source : · millésime », c'est-à-dire en
  // affirmant une source qu'elle n'a pas.
  assert.throws(
    () => carteAnalyse({ ...ANALYSE, source: { titre: "   ", millesime: "2025" } }),
    /Carte de partage sans la source/,
  );
  assert.throws(
    () => carteAnalyse({ ...ANALYSE, source: { titre: "Fichier d'essai", millesime: "" } }),
    /Carte de partage sans le millésime/,
  );
  assert.throws(() => carteAnalyse({ ...ANALYSE, site: "" }), /Carte de partage sans l'adresse/);
  // Les cinq natures passent par le même dessin : aucune n'y échappe.
  assert.throws(() => carteScenario({ ...SCENARIO, site: "" }), /Carte de partage sans/);
  assert.throws(() => carteComparaison({ ...COMPARAISON, site: "" }), /Carte de partage sans/);
  assert.throws(() => carteFiche({ ...FICHE, site: "" }), /Carte de partage sans/);
  assert.throws(() => carteReperes({ ...REPERES, site: "" }), /Carte de partage sans/);
});

/** Un intitulé de source de la longueur de ceux que le site cite vraiment : la
 *  première analyse publiée nomme un projet de loi de règlement en 110
 *  caractères. Ce n'est pas un cas extrême, c'est le cas ordinaire. */
const SOURCE_LONGUE: SourceCarte = {
  titre:
    "Projet de loi relatif aux résultats de la gestion et portant approbation " +
    "des comptes de l'année (PLRG) 2025, annexe 1",
  millesime: "2025",
};

test("28 bis. une source longue est coupée, son millésime jamais", () => {
  // Repliée d'un bloc, la ligne du pied se coupait par la queue : le millésime
  // partait avec, et l'image affirmait un chiffre sans date — vu sur le PNG de
  // la première analyse publiée, pas sur une chaîne d'essai.
  for (const [nom, svg] of [
    ["analyse", carteAnalyse({ ...ANALYSE, source: SOURCE_LONGUE })],
    ["scénario", carteScenario({ ...SCENARIO, source: SOURCE_LONGUE })],
    ["comparaison", carteComparaison({ ...COMPARAISON, source: SOURCE_LONGUE })],
    ["fiche", carteFiche({ ...FICHE, source: SOURCE_LONGUE })],
    ["repère", carteReperes({ ...REPERES, source: SOURCE_LONGUE })],
  ] as [string, string][]) {
    const lu = peints(svg).map((t) => t.contenu);
    assert.ok(lu.some((t) => t.includes("millésime 2025")), `${nom} : millésime perdu à la coupe`);
    assert.ok(lu.some((t) => t.includes("Projet de loi")), `${nom} : source absente`);
    // Et ce qui est gagné ne l'est pas sur le cadre ni sur le voisin.
    assert.deepEqual(debordements(svg), [], nom);
    assert.deepEqual(recouvrements(svg), [], nom);
    assert.deepEqual(horsBandes(svg), [], nom);
  }
});

test("29. replier coupe au mot, et coupe en dur un mot plus long qu'une ligne", () => {
  assert.deepEqual(replier("un deux trois", 20, 400, 3), ["un deux trois"]);
  const lignes = replier("un deux trois quatre cinq six sept huit neuf dix onze", 20, 120, 2);
  assert.equal(lignes.length, 2);
  assert.ok(lignes[1].endsWith("…"));
  for (const ligne of lignes) assert.ok(largeurApprochee(ligne, 20) <= 120);
  const colle = replier("abcdefghijklmnopqrstuvwxyz", 20, 120, 3);
  for (const ligne of colle) assert.ok(largeurApprochee(ligne, 20) <= 120);
});

test("30. replier rend zéro ligne quand on ne lui en demande aucune", () => {
  // Inatteignable depuis les cinq natures, mais `replier` est exporté et sa
  // signature accepte `0` : la coupe lisait `gardees[-1]` et lançait un
  // `TypeError` obscur dans un module que d'autres tâches consomment.
  assert.deepEqual(replier("un deux trois", 20, 120, 0), []);
  assert.deepEqual(replier("un deux trois", 20, 120, -1), []);
});
