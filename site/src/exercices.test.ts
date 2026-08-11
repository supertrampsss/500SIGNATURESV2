/**
 * Le tableau des exercices : ce qu'il montre, ce qu'il refuse de montrer.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { exercices, rendreExercices } from "./exercices.ts";
import type { Indicateur } from "./donnees.ts";

const CATALOGUE = [
  { id: "ofgl_depenses_fonctionnement", libelle: "Depenses de fonctionnement" },
  { id: "ofgl_frais_personnel", libelle: "Frais de personnel" },
  { id: "ofgl_recettes_fonctionnement", libelle: "Recettes de fonctionnement" },
] as unknown as Indicateur[];

const SERIES = {
  ofgl_depenses_fonctionnement: { "2017": 280e6, "2019": 294.1e6, "2022": 320.7e6, "2025": 369e6 },
  ofgl_frais_personnel: { "2019": 143.6e6, "2025": 183.1e6 },
  ofgl_recettes_fonctionnement: { "2019": 351.9e6, "2022": 381.4e6, "2025": 417.1e6 },
};

test("les lignes sont celles des blocs, dans leur ordre, sans doublon", () => {
  const t = exercices({
    cites: ["ofgl_depenses_fonctionnement", "ofgl_frais_personnel", "ofgl_depenses_fonctionnement"],
    series: SERIES,
    catalogue: CATALOGUE,
  })!;
  assert.deepEqual(
    t.lignes.map((l) => l.id),
    ["ofgl_depenses_fonctionnement", "ofgl_frais_personnel"],
  );
});

test("la fenêtre part de 2019 : un exercice antérieur n'a pas de colonne", () => {
  // La fenêtre du site se lit sur les exercices publiés, jamais sur un
  // calendrier électoral, et elle commence en 2019 à toutes les mailles.
  const t = exercices({
    cites: ["ofgl_depenses_fonctionnement"],
    series: SERIES,
    catalogue: CATALOGUE,
  })!;
  assert.deepEqual(t.exercices, ["2019", "2022", "2025"]);
});

test("un exercice manquant à une ligne laisse une case vide, pas un zéro", () => {
  const t = exercices({
    cites: ["ofgl_depenses_fonctionnement", "ofgl_frais_personnel"],
    series: SERIES,
    catalogue: CATALOGUE,
  })!;
  assert.deepEqual(t.lignes[1].valeurs, [143.6e6, null, 183.1e6]);
  assert.match(rendreExercices(t), /<td><\/td>/);
});

test("une seule colonne ne fait pas un tableau", () => {
  // Une valeur unique ne s'analyse pas, et le bloc juste au-dessus la dit déjà.
  assert.equal(
    exercices({
      cites: ["ofgl_frais_personnel"],
      series: { ofgl_frais_personnel: { "2025": 183.1e6 } },
      catalogue: CATALOGUE,
    }),
    null,
  );
});

test("un identifiant sans série ne fait pas une ligne vide", () => {
  // Cité par un bloc mais absent des séries du territoire : il sort du
  // tableau, et un tableau sans ligne n'existe pas du tout.
  assert.equal(
    exercices({ cites: ["etat_depenses_nettes_bg"], series: SERIES, catalogue: CATALOGUE }),
    null,
  );
  const t = exercices({
    cites: ["etat_depenses_nettes_bg", "ofgl_depenses_fonctionnement"],
    series: SERIES,
    catalogue: CATALOGUE,
  })!;
  assert.deepEqual(
    t.lignes.map((l) => l.id),
    ["ofgl_depenses_fonctionnement"],
  );
});

test("les montants sont en millions, et le sigle est dans la légende", () => {
  // Répété quatre-vingts fois dans une grille, « M€ » n'ajoute rien et
  // empêche les colonnes de s'aligner.
  const html = rendreExercices(
    exercices({ cites: ["ofgl_depenses_fonctionnement"], series: SERIES, catalogue: CATALOGUE }),
  );
  assert.match(html, /<td>294,1<\/td>/);
  assert.doesNotMatch(html.replace(/<caption>[\s\S]*?<\/caption>/, ""), /M€/);
  assert.match(html, /<caption>Montants en millions d'euros\./);
});

test("aucun tiret cadratin ni demi-cadratin", () => {
  assert.doesNotMatch(
    rendreExercices(
      exercices({ cites: ["ofgl_depenses_fonctionnement"], series: SERIES, catalogue: CATALOGUE }),
    ),
    /[—–]/,
  );
});

test("rien à montrer n'écrit rien", () => {
  assert.equal(rendreExercices(null), "");
});
