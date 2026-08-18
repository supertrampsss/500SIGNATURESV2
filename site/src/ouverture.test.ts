/**
 * L'ouverture de Bilan : ce qu'un chiffre de cadrage doit garantir.
 *
 * Les valeurs sont celles d'Eurostat, au dixième de million : un fixture
 * arrondi ferait passer au vert un chiffre que personne ne verra.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

import type { Territoire } from "./donnees.ts";
import { chiffres, pont, rendu, variation } from "./ouverture.ts";

const Md = 1e9;
const SERIES: Record<string, Record<string, number>> = {
  eurostat_apu_recettes: {
    "1995": 545.0 * Md,
    "2017": 1244.3869 * Md,
    "2019": 1287.9292 * Md,
    "2021": 1326.2 * Md,
    "2023": 1456.4 * Md,
    "2025": 1561.6261 * Md,
  },
  eurostat_apu_depenses: {
    "1995": 600.6 * Md,
    "2017": 1321.4446 * Md,
    "2019": 1346.1547 * Md,
    "2021": 1491.4 * Md,
    "2023": 1608.3 * Md,
    "2025": 1714.1372 * Md,
  },
  eurostat_pib_montant: {
    "1995": 1070.9 * Md,
    "2017": 2291.6805 * Md,
    "2019": 2432.2068 * Md,
    "2021": 2508.1 * Md,
    "2023": 2822.5 * Md,
    "2025": 2991.0559 * Md,
  },
  // L'indice des prix, celui qui retire l'inflation : 2017=101,47, 2025=124,43,
  // les valeurs réellement publiées (eurostat_prix_ensemble, base 2015).
  eurostat_prix_ensemble: { "2017": 101.47, "2025": 124.43 },
  eurostat_population: { "2025": 68_882_600, "2026": 69_112_309 },
  etat_recettes_nettes_bg: { "2017": 309.5 * Md, "2025": 380.3903 * Md },
};

const territoire = (series: Record<string, Record<string, number>>): Territoire => ({
  nom: "", parent: null, population: null, drapeaux: {}, series,
});
const texte = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ").trim();

test("la base des écarts est 2017 quand elle est publiée, et elle est nommée", () => {
  // Le choix de la base n'est pas neutre : mesuré sur les séries réelles, la
  // part de la dépense monte depuis 1995, monte depuis 2019, recule depuis
  // 2017. **Le signe s'inverse.** Une base tue ou choisie pour sa conclusion
  // rend n'importe quel bilan démontrable.
  const c = chiffres(territoire(SERIES));
  assert.ok(c);
  assert.equal(c.debut, "2017");
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /depuis 2017/);
});

test("le piège du dénominateur est écrit : le ratio baisse, la dépense monte", () => {
  // « De 57,7 % à 57,3 % » se lit comme une baisse. C'en est une du ratio,
  // pas de la dépense : +5,8 % une fois l'inflation retirée. La phrase donne
  // LES DEUX BOUTS du ratio et la hausse réelle — jamais l'un sans l'autre.
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /est passée de 57,7 % à 57,3 %/);
  assert.match(lu, /C'est le ratio qui a baissé, pas la dépense/);
  assert.match(lu, /elle a augmenté de \+5,8 %/);
  assert.match(lu, /au rythme de la richesse \(\+6,4 %\)/);
  // Et le décrochage des recettes, vrai sur ces séries : +2,3 % seulement.
  assert.match(lu, /les recettes : \+2,3 % seulement/);
});

test("sans indice des prix, aucun chiffre « inflation retirée » ne s'écrit", () => {
  // Comparer des euros courants en les appelant constants serait pire que se
  // taire : le paragraphe entier disparaît.
  const sans = { ...SERIES };
  delete sans["eurostat_prix_ensemble"];
  const c = chiffres(territoire(sans));
  assert.ok(c);
  assert.equal(c.reelDepenses, null);
  const lu = texte(rendu({ FR: territoire(sans) }));
  assert.doesNotMatch(lu, /inflation retirée/);
  assert.doesNotMatch(lu, /ratio qui a baissé/);
});

test("les recettes s'écrivent en positif, les dépenses en négatif", () => {
  // La demande explicite du lecteur : une recette entre (+), une dépense sort
  // (−). Dans la phrase ET dans chaque colonne du tableau.
  const html = rendu({ FR: territoire(SERIES) });
  assert.match(html, /flux--plus">\+/);
  assert.match(html, /flux--moins">−/);
  const lu = texte(html);
  assert.match(lu, /encaissé \+1 561,63 milliards d'euros/);
  assert.match(lu, /dépensé −1 714,14 milliards d'euros/);
  // Le tableau d'évolution : un exercice sur deux à partir de la base — le
  // fixture ne porte que les années impaires, donc trois colonnes ici, cinq
  // sur les séries réelles. Recettes +, dépenses −, emprunt −.
  assert.match(lu, /Recettes \+1 244 \+1 326 \+1 562/);
  assert.match(lu, /Dépenses −1 321 −1 491 −1 714/);
  assert.match(lu, /Emprunté −77 −165 −153/);
});

test("le tableau d'évolution donne ses deux bouts, du début à la fin", () => {
  const c = chiffres(territoire(SERIES));
  assert.ok(c);
  // Un exercice sur deux depuis la base, la fin toujours comprise : le
  // fixture ne portant que les impaires, l'échantillon en garde une sur deux.
  assert.deepEqual(c.exercices, ["2017", "2021", "2025"]);
});

test("la phrase du décrochage disparaît le jour où elle serait fausse", () => {
  // Des recettes qui suivent la richesse : la phrase ment, donc elle part.
  const suivies = {
    ...SERIES,
    eurostat_apu_recettes: {
      ...SERIES["eurostat_apu_recettes"],
      "2025": ((1244.3869 * 124.43) / 101.47 + 200) * Md,
    },
  };
  const lu = texte(rendu({ FR: territoire(suivies) }));
  assert.doesNotMatch(lu, /Ce qui a décroché/);
});

test("le pont des périmètres nomme les deux encaissements", () => {
  // 1 562 milliards pour l'ensemble, 380 pour l'État seul : sans la phrase de
  // passage, les deux chiffres du chapitre 1 et du chapitre 2 se lisaient
  // comme une contradiction — le premier reproche du lecteur sur la maquette.
  const lu = texte(pont({ FR: territoire(SERIES) }));
  assert.match(lu, /descend d'un étage/);
  assert.match(lu, /1 561,63 milliards d'euros/);
  assert.match(lu, /380,39 milliards d'euros/);
  assert.match(lu, /Sécurité sociale/);
  // Sans la série de l'État, pas de pont : une phrase à moitié sourcée ne
  // s'écrit pas.
  const sans = { ...SERIES };
  delete sans["etat_recettes_nettes_bg"];
  assert.equal(pont({ FR: territoire(sans) }), "");
});

test("le par-habitant est donné, jamais comme une facture", () => {
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /24 885 € par personne et par an/);
  assert.match(lu, /Elle ne leur est pas prélevée à chacun/);
});

test("une variation s'écrit signée, une décimale, en pourcentage", () => {
  // L'espace de l'unité est insécable, écrite \u00a0 comme partout au site.
  assert.equal(variation(100, 105.83), "+5,8\u00a0%");
  assert.equal(variation(100, 92.1), "−7,9\u00a0%");
});

test("la base est déclarée dans le module, pas enfouie dans un calcul", () => {
  const source = readFileSync(new URL("./ouverture.ts", import.meta.url), "utf8");
  assert.match(source, /const REFERENCE = "2017"/);
  // Et le repli est écrit : sans 2017 publié, le premier exercice commun sert.
  const tronquees = Object.fromEntries(
    Object.entries(SERIES).map(([id, s]) => [
      id,
      Object.fromEntries(Object.entries(s).filter(([an]) => an >= "2019")),
    ]),
  );
  const c = chiffres(territoire(tronquees));
  assert.ok(c);
  assert.equal(c.debut, "2019");
});

test("deux exercices au moins, sinon rien : une photo n'est pas un bilan", () => {
  const seul = {
    eurostat_apu_recettes: { "2025": 1561.6 * Md },
    eurostat_apu_depenses: { "2025": 1714.1 * Md },
    eurostat_pib_montant: { "2025": 2991.1 * Md },
    eurostat_population: { "2025": 68_882_600 },
  };
  assert.equal(chiffres(territoire(seul)), null);
  assert.equal(rendu({ FR: territoire(seul) }), "");
});
