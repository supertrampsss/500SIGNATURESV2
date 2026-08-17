/**
 * Le bloc de la redistribution. Ce qu'il refuse de peindre compte autant que
 * ce qu'il peint : un écart entre deux exercices différents mesurerait
 * l'inflation et l'appellerait redistribution.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Indicateur, Territoire } from "./donnees.ts";
import { rendu } from "./redistribution.ts";

/** Les vraies valeurs 2024 de l'ERFS rétropolée, croisements exclus.
 *
 *  Ma première version de ce fixture portait 33 890 € comme médiane après
 *  redistribution : c'était une valeur **croisée** — une tranche d'âge — lue
 *  dans le jeu sans filtrer les totaux. La médiane des personnes est de
 *  26 740 €, et l'écart entre les deux dit exactement pourquoi le connecteur
 *  filtre `AGE`, `EMPSTA_ENQ`, `TPH` et `MUN_DENSITY_LEVEL`.
 *
 *  Elles montrent aussi que la redistribution **bascule au troisième décile** :
 *  elle ajoute en dessous et retranche au-dessus. Un fixture inventé aurait
 *  fait croire à un tableau tout positif. */
const APRES = [13970, 17700, 20980, 23880, 26740, 29880, 33680, 38780, 48580];
const AVANT = [9970, 16490, 21120, 25070, 28920, 32980, 38070, 44800, 58710];

function territoire(series: Record<string, Record<string, number>>): Territoire {
  return { nom: "", parent: null, population: null, drapeaux: {}, series };
}

function series(exercice = "2024", exerciceAvant = exercice) {
  const s: Record<string, Record<string, number>> = {};
  for (let n = 1; n <= 9; n += 1) {
    s[`insee_niveau_vie_d${n}`] = { [exercice]: APRES[n - 1] };
    s[`insee_niveau_vie_d${n}_avant_redistribution`] = { [exerciceAvant]: AVANT[n - 1] };
  }
  s["insee_rapport_interdecile"] = { [exercice]: 3.48 };
  s["insee_rapport_interdecile_avant_redistribution"] = { [exercice]: 5.89 };
  return s;
}

const CATALOGUE = [
  { id: "insee_niveau_vie_d1" },
  { id: "insee_niveau_vie_d1_avant_redistribution" },
] as Indicateur[];

const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

test("les deux colonnes et leur écart, décile par décile", () => {
  const html = rendu({ FR: territoire(series()) }, CATALOGUE);
  const lu = texte(html);
  assert.match(lu, /Ce que la redistribution change/);
  // Neuf lignes, et les rangs se lisent en toutes lettres : « D3 » ne se lit
  // pas.
  assert.match(lu, /les 10\s?% les plus modestes/);
  assert.match(lu, /les 10\s?% les plus aisés/);
  assert.doesNotMatch(lu, /\bD3\b/);
  assert.equal(html.match(/<th scope="row">/g)?.length, 9);
});

test("l'écart porte son signe, et il change de sens selon le décile", () => {
  const html = rendu({ FR: territoire(series()) }, CATALOGUE);
  // Le premier décile gagne 4 000 €, le neuvième en perd 10 130.
  assert.match(html, /\+4\s?000\s?€/);
  assert.match(html, /−10\s?130\s?€/);
});

test("un montant unitaire ne s'écrit pas en millions d'euros", () => {
  // « 0,01 M€ » serait la faute exacte que le salaire mensuel a déjà
  // corrigée : ces séries sont ce qu'une personne a pour vivre, pas une masse
  // budgétaire.
  const html = rendu({ FR: territoire(series()) }, CATALOGUE);
  assert.doesNotMatch(html, /M€/);
  assert.match(html, /13\s?970\s?€/);
});

test("deux exercices différents ne font pas un écart", () => {
  // Un décile de 2024 retranché d'un décile de 2022 mesure deux ans
  // d'inflation. Le bloc se tait plutôt que de l'appeler redistribution.
  const html = rendu({ FR: territoire(series("2024", "2022")) }, CATALOGUE);
  assert.equal(html, "");
});

test("le rapport interdécile se lit des deux côtés", () => {
  const lu = texte(rendu({ FR: territoire(series()) }, CATALOGUE));
  assert.match(lu, /5,89 fois/);
  assert.match(lu, /3,48 fois/);
});

test("le champ et la nature du seuil sont dits, pas supposés", () => {
  const lu = texte(rendu({ FR: territoire(series()) }, CATALOGUE));
  // Une série nationale qui exclut les DROM sans le dire est une comparaison
  // dont on ne contrôle pas le périmètre.
  assert.match(lu, /France métropolitaine/);
  // Et un seuil de décile n'est pas un revenu moyen.
  assert.match(lu, /n'est pas un revenu moyen/);
});

test("rien n'est peint tant que les séries ne sont pas publiées", () => {
  assert.equal(rendu({}, CATALOGUE), "");
  assert.equal(rendu({ FR: territoire(series()) }, [] as Indicateur[]), "");
  // Un décile manquant suffit : un tableau à huit lignes tairait celle qui
  // manque au lieu de le dire.
  const ampute = series();
  delete ampute["insee_niveau_vie_d7"];
  assert.equal(rendu({ FR: territoire(ampute) }, CATALOGUE), "");
});
