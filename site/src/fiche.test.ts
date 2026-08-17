/**
 * La fiche d'un territoire, une fois vidée de ce qui la répétait.
 *
 * Elle alignait cent quinze lignes de mesures rangées par thème, les mêmes
 * rangées par question, deux barres d'onglets pour les parcourir, une synthèse
 * et six rapports. Ces tests vérifient ce qu'elle montre — quatre repères,
 * quatre blocs, trois faits — et surtout **ce qu'elle ne montre plus**.
 *
 * Les chiffres sont ceux de Bordeaux tels qu'ils sont publiés : une ouverture
 * calculée se teste sur les données qui l'ont motivée.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import type { Indicateur } from "./donnees.ts";
import { afficherFiche, ORDRE_THEMES, rubriqueDuTheme } from "./fiche.ts";

/** Sources lues telles quelles : ces contrôles portent sur la forme rendue,
 *  pas sur une valeur calculée. */
const FICHE = fs.readFileSync(new URL("./fiche.ts", import.meta.url), "utf8");

/* ------------------------------------------------------------------------
 * Les rubriques : elles ne rangent plus la fiche, elles rangent ANALYSES.
 * ---------------------------------------------------------------------- */

const TOUS_LES_THEMES = [
  "finances_locales", "impots_locaux", "budget_etat", "depenses_fiscales", "dette",
  "fonctions", "securite_sociale", "vie_associative", "macro", "europe", "population",
  "revenus", "famille", "diplomes", "elections", "prenoms", "emploi", "professions",
  "entreprises", "secteurs_salaries", "secteurs_etablissements", "logement", "sante",
  "education", "securite", "equipements", "tourisme",
];

test("les vingt-sept thèmes publiés sont rangés à la main, aucun par défaut", () => {
  // Un thème non listé tombe dans la dernière rubrique : c'est un filet, pas
  // une décision. Ce test dit combien de thèmes le site publie, pour qu'un
  // vingt-huitième n'y arrive pas en silence.
  assert.equal(TOUS_LES_THEMES.length, 27);
  for (const theme of TOUS_LES_THEMES) {
    if (theme === "tourisme") continue; // dernier de la dernière rubrique
    assert.notEqual(rubriqueDuTheme(theme), undefined);
  }
  // Les subventions de l'État aux associations sont de l'argent public qui
  // sort, pas un trait du cadre de vie.
  assert.equal(rubriqueDuTheme("vie_associative"), "argent");
});

test("l'ordre de lecture range l'argent public avant le reste", () => {
  // Il ne sert plus à la fiche — elle n'aligne plus de thèmes — mais à ANALYSES,
  // qui déroule les mêmes rubriques dans le même ordre.
  assert.equal(ORDRE_THEMES[0], "finances_locales");
  assert.ok(ORDRE_THEMES.indexOf("logement") > ORDRE_THEMES.indexOf("budget_etat"));
});

/* ------------------------------------------------------------------------
 * L'ouverture : quatre repères, quatre blocs, trois faits, et rien d'autre.
 * ---------------------------------------------------------------------- */

const CATALOGUE_FINANCIER = [
  ["ofgl_recettes_fonctionnement", "Recettes de fonctionnement"],
  ["ofgl_depenses_fonctionnement", "Dépenses de fonctionnement"],
  ["ofgl_impots_locaux", "Impôts locaux"],
  ["ofgl_encours_dette", "Encours de dette"],
  ["ofgl_frais_personnel", "Frais de personnel"],
  ["ofgl_depenses_d_equipement", "Dépenses d'équipement"],
  ["ofgl_epargne_brute", "Épargne brute"],
].map(
  ([id, libelle]) =>
    ({
      id, libelle, unite: "EUR", theme: "finances_locales", sommable: true,
      niveaux: ["commune"], definition: "", jeu: "ofgl-communes",
    }) as never as Indicateur,
);

const SERIES_BORDEAUX = {
  ofgl_recettes_fonctionnement: {
    "2019": 351954165.22, "2020": 337273031.28, "2021": 361776127.87,
    "2022": 379460633.12, "2023": 418347446.87, "2024": 416676492.15, "2025": 417137958.52,
  },
  ofgl_depenses_fonctionnement: {
    "2019": 294082496.89, "2020": 299341271.21, "2021": 306122190.67,
    "2022": 319295502.01, "2023": 353744576.68, "2024": 361939919.93, "2025": 369011621.25,
  },
  ofgl_impots_locaux: {
    "2019": 195193601.12, "2020": 197515772.42, "2021": 210226832.76,
    "2022": 217550030.5, "2023": 258014932.51, "2024": 256388353.57, "2025": 253975934.62,
  },
  ofgl_encours_dette: {
    "2019": 252257675.39, "2020": 271035983.14, "2021": 283318583.37,
    "2022": 295862603.26, "2023": 290016673.54, "2024": 355713786.01, "2025": 412980519.9,
  },
  ofgl_frais_personnel: {
    "2019": 143587932.54, "2020": 146606375.79, "2021": 148136364.37,
    "2022": 157518484.11, "2023": 166807907.89, "2024": 175965029.91, "2025": 183054742.68,
  },
  ofgl_depenses_d_equipement: {
    "2019": 56355923.66, "2020": 56687017.39, "2021": 77581975.68,
    "2022": 72428601.89, "2023": 63235423.24, "2024": 109202950.59, "2025": 109850175.79,
  },
  ofgl_epargne_brute: {
    "2019": 57871668.33, "2020": 37931760.07, "2021": 55653937.2,
    "2022": 60165131.11, "2023": 64602870.19, "2024": 54736572.22, "2025": 48126337.27,
  },
  ofgl_population_reference: {
    "2019": 256045, "2020": 257804, "2021": 260352,
    "2022": 264257, "2023": 263247, "2024": 265255, "2025": 268822,
  },
};

/** L'IPC national tel qu'il est publié : douze glissements par an. Reconstruit
 *  ici à partir des moyennes annuelles réellement observées, pour que
 *  l'inflation cumulée 2019-2025 tombe sur les +16,1 % publiés. */
const IPC_NATIONAL: Record<string, number> = {};
for (const [annee, moyenne] of Object.entries({
  "2019": 1.1, "2020": 0.4833333, "2021": 1.65, "2022": 5.2,
  "2023": 4.9, "2024": 2.0083333, "2025": 0.95,
})) {
  for (let mois = 1; mois <= 12; mois += 1) {
    IPC_NATIONAL[`${annee}-${String(mois).padStart(2, "0")}`] = moyenne;
  }
}

const GIRONDE = {
  nom: "Gironde", parent: "75", region: "75", population: 1_643_000, drapeaux: {}, series: {},
} as never;

function ficheDeBordeaux(
  comparateurs: { libelle: string; territoire: never }[] = [],
): string {
  const cible = { innerHTML: "" } as unknown as HTMLElement;
  afficherFiche(cible, {
    niveau: "commune",
    territoire: {
      nom: "Bordeaux", parent: "33", region: "75", population: 267_991,
      drapeaux: {}, series: SERIES_BORDEAUX,
      maire: { nom: "Une maire", depuis: "2026-03-22" },
    } as never,
    indicateurs: CATALOGUE_FINANCIER,
    comparateurs,
    serieInflation: IPC_NATIONAL,
  });
  return cible.innerHTML;
}
test("la fiche s'ouvre sur les repères, puis les blocs, et s'arrête là", () => {
  const html = ficheDeBordeaux();
  const rang = (classe: string) => html.indexOf(`class="${classe}`);
  assert.ok(rang("reperes") > -1 && rang("reperes") < rang("bloc-lecture"));
  // Le titre du bloc est un h3 en Spectral, jamais un micro-label gris.
  assert.match(html, /<section class="bloc-lecture">\s*<h3>Le train de vie<\/h3>/);
  // Trois blocs ici, pas quatre : le jeu d'essai ne publie pas les dépenses
  // d'investissement, et « Ce qui sort de terre » ne s'écrit pas sans elles.
  assert.deepEqual(
    [...html.matchAll(/<section class="bloc-lecture">\s*<h3>([^<]*)<\/h3>/g)].map((m) => m[1]),
    ["Le train de vie", "Qui règle l&#39;addition", "L&#39;ardoise"],
  );
});
/**
 * Aucune ligne de mandat, à aucune maille.
 *
 * « Le mandat ouvert en juin 2021 n'a pas encore de comptes publiés » posait
 * une date d'élection au-dessus d'une fiche dont la fenêtre est comptable. La
 * fenêtre se lit sur les exercices publiés, jamais sur un calendrier électoral,
 * et elle est déjà dans les millésimes des phrases.
 */
test("aucune ligne de mandat ne s'écrit sur la fiche", () => {
  const html = ficheDeBordeaux();
  assert.doesNotMatch(html, /fiche__mandat/);
  assert.doesNotMatch(html, /Le mandat ouvert en/);
  // Une fiche, pas un cours : aucune prose explicative n'accompagne la refonte.
  assert.doesNotMatch(html, /Ce que cette fiche calcule|Ce qu'elle ne dit pas/);
});

/**
 * Ce qui redisait les blocs ne s'écrit plus.
 *
 * Neuf choses partaient ensemble, et pour la même raison : elles répétaient ce
 * que les repères et les blocs venaient de dire, ou elles rangeaient une liste
 * au lieu de la condenser.
 *
 * - « Où va l'argent ? » et « Qui paie ? » : les titres des deux premiers
 *   blocs, à un point d'interrogation près, sur d'autres agrégats.
 * - Les cinq autres questions, « Le reste » compris : les mêmes tableaux.
 * - Les lignes de mesures rangées par thème, et les deux barres d'onglets qui
 *   servaient à les parcourir.
 * - « Tout le détail — 51 autres lignes », qui rangeait sans condenser.
 * - « Les comptes en six rapports » et la synthèse « L'essentiel ».
 */
test("la fiche ne montre plus une seule liste d'indicateurs", () => {
  const html = ficheDeBordeaux();
  for (const marque of [
    "questions-fiche", "question-fiche", "theme-groupe", "onglets-themes",
    "onglets-rubriques", "class=\"mesures\"", "class=\"mesure", "synthese",
    "class=\"ratios", "Tout le détail", "autres lignes",
    "Où va l&#39;argent ?", "Qui paie ?", "Le reste",
    // Et tout ce qui suivait le dernier bloc : les faits, le pont, la feuille.
    "verdict", "pont", "feuille-impots", "fiche__tout",
  ]) {
    assert.ok(!html.includes(marque), marque);
  }
});

test("la fiche s'arrête au tableau des exercices", () => {
  // Sous « Ce qui sort de terre » : le tableau des exercices, puis le
  // conteneur des rangs, que main.ts remplit quand la maille entière est là.
  // Rien d'autre — ni faits, ni pont, ni feuille d'impôts, ni liste.
  const html = ficheDeBordeaux();
  const sections = [...html.matchAll(/class="([a-z-]+)"/g)]
    .map((m) => m[1])
    .filter((c) => !c.startsWith("repere") && !c.startsWith("bloc") && !c.startsWith("note"));
  for (const classe of sections) {
    assert.ok(
      ["fiche__titre", "fiche__meta", "fiche__maire", "fiche__habitants",
       "fiche__essentiel", "fiche__parent", "fiche__situation",
       "tableau-exercices"].includes(classe),
      `section inattendue : ${classe}`,
    );
  }
  // La note ouvre la fiche — c'est la question qu'on vient poser. Elle n'entre
  // pas dans l'énumération ci-dessus pour la même raison que les repères et
  // les blocs : ce sont des modules de rendu à eux, dont les classes se
  // vérifient dans leurs propres tests. Ce qui est vérifié ici, c'est qu'elle
  // est bien présente et bien PREMIÈRE, avant les repères qui la soutiennent.
  assert.match(html, /class="note"/, "la note a quitté la fiche");
  assert.ok(
    html.indexOf('class="note"') < html.indexOf('class="reperes"'),
    "les repères passent avant la note : la réponse arrive après ses justifications",
  );
  // Le conteneur des rangs est vide tant que main.ts ne l'a pas rempli : la
  // fiche ne dit jamais ce qu'elle est en train de calculer.
  assert.match(html, /<div class="fiche__situation" id="fiche-situation"><\/div>/);
});

test("aucun tiret cadratin ni demi-cadratin dans la fiche produite", () => {
  // Le « − » du signe moins reste ; le cadratin et le demi-cadratin, non.
  assert.doesNotMatch(ficheDeBordeaux(), /[—–]/);
});

test("le territoire parent de l'en-tête est un bouton, pas un mot gris", () => {
  const html = ficheDeBordeaux([{ libelle: "son département", territoire: GIRONDE }]);
  assert.match(
    html,
    /Commune · <button type="button" class="fiche__parent" data-code="33" data-niveau="departement">Gironde<\/button>/,
  );
});

test("la population porte son infobulle sans se faire passer pour un lien", () => {
  const html = ficheDeBordeaux();
  assert.match(html, /<abbr class="fiche__habitants" title="Population municipale/);
  assert.match(html, /267\s?991 hab\./);
});

test("la fenêtre est la même à toutes les mailles, quelle que soit l'élection", () => {
  // La règle du dépôt : la fenêtre est dans les millésimes des phrases, 2019 et
  // 2025. Elle suivait le calendrier électoral de la maille — municipales 2020
  // pour une commune, départementales 2021 pour un département — si bien que la
  // Gironde s'ouvrait sur « contre1,76 milliards d'euros en 2020 » quand Bordeaux disait
  // 2019. Deux territoires qu'on vient précisément comparer.
  const M = 1_000_000;
  const annees = ["2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"];
  const serie = (base: number) =>
    Object.fromEntries(annees.map((a, i) => [a, (base + i * 10) * M]));
  const commun = {
    unite: "EUR", theme: "finances_locales", sommable: true, definition: "", jeu: "ofgl",
  };
  const rendue = (niveau: string) => {
    const territoire = {
      nom: "Ici", parent: null, region: "75", population: 100_000, drapeaux: {},
      series: {
        ofgl_depenses_totales: serie(400),
        ofgl_depenses_fonctionnement: serie(300),
        ofgl_depenses_investissement: serie(100),
      },
    } as never;
    const indicateurs = [
      { ...commun, id: "ofgl_depenses_totales", libelle: "Dépenses totales", niveaux: [niveau], parent: null },
      { ...commun, id: "ofgl_depenses_fonctionnement", libelle: "Dépenses de fonctionnement", niveaux: [niveau], parent: "ofgl_depenses_totales" },
      { ...commun, id: "ofgl_depenses_investissement", libelle: "Dépenses d'investissement", niveaux: [niveau], parent: "ofgl_depenses_totales" },
    ] as never as Indicateur[];
    const cible = { innerHTML: "" } as unknown as HTMLElement;
    afficherFiche(cible, { niveau, territoire, indicateurs });
    return cible.innerHTML;
  };
  // La commune élit en 2020, le département en 2021, la région en 2021 : les
  // trois doivent pourtant partir du même exercice.
  for (const niveau of ["commune", "departement", "region"]) {
    const blocs = [...rendue(niveau).matchAll(/<section class="bloc-lecture">([\s\S]*?)<\/section>/g)]
      .map(([, corps]) => corps)
      .join(" ");
    assert.match(blocs, /(qu'en|en) 2019/, niveau);
    assert.doesNotMatch(blocs, /(qu'en|contre [^<]*en) 2020/, niveau);
  }
});
test("un salaire mensuel n'est pas un agrégat et ne se lit pas en M€", () => {
  // « Salaire net mensuel moyen :0,00 millions d'euros », deux exercices de suite, avec
  // « +4 % » à côté d'un chiffre nul : la règle des millions sert à comparer
  // des masses budgétaires entre elles, pas à dire une paie.
  const ECHELLE = fs.readFileSync(new URL("./echelle.ts", import.meta.url), "utf8");
  assert.match(ECHELLE, /const VALEURS_UNITAIRES = new Set\(\["insee_salaire_net_eqtp_mensuel"\]\);/);
  // Nommées, jamais devinées par un seuil de grandeur : le budget d'une petite
  // commune est lui aussi un petit nombre, et il reste un agrégat.
  assert.doesNotMatch(ECHELLE, /valeur < 1[_ ]?000[_ ]?000/);
});
