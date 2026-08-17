/**
 * La note de gestion. Ces tests portent sur ce qu'elle refuse autant que sur ce
 * qu'elle calcule : une note publiée sur 34 875 communes sera contestée, et
 * chaque refus est ce qui la rend défendable.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { BORNES, mention, mesurer, note, noter } from "./note.ts";

/** Une commune confortable : 20 % d'épargne, 3 ans de dette, en progrès. */
const SOLIDE = {
  ofgl_recettes_fonctionnement: { "2019": 90e6, "2025": 100e6 },
  ofgl_epargne_brute: { "2019": 13.5e6, "2025": 20e6 },
  ofgl_encours_dette: { "2019": 50e6, "2025": 60e6 },
};

test("la note se décompose, et les trois termes font le total", () => {
  const n = note(SOLIDE);
  assert.ok(n, "la commune porte les trois séries, elle doit être notée");
  const { marge, dette, trajectoire } = n.detail;
  assert.equal(Math.round((marge + dette + trajectoire) * 10) / 10, n.valeur);
  // Une note publiée doit pouvoir se contester terme par terme : sans le
  // détail, « 15,9/20 » est un verdict sans motif.
  assert.ok(marge > 0 && dette > 0 && trajectoire > 0, JSON.stringify(n.detail));
});

test("le barème est borné aux deux bouts", () => {
  const parfait = noter({ tauxEpargne: 90, desendettement: 0.1, trajectoire: 40, exercice: "2025" });
  assert.equal(parfait.valeur, 20, "une commune très au-dessus des bornes plafonne à 20");
  const pire = noter({ tauxEpargne: -30, desendettement: 60, trajectoire: -40, exercice: "2025" });
  assert.equal(pire.valeur, 0, "une commune très en dessous plancher à 0");
});

test("une épargne négative ne rembourse rien, et ce n'est pas une donnée absente", () => {
  // `desendettement` vaut `null` quand l'épargne est nulle ou négative : le
  // ratio n'existe pas. Le terme vaut alors zéro — le pire cas — et non la
  // moitié des points comme une donnée manquante.
  const m = mesurer({
    ofgl_recettes_fonctionnement: { "2025": 100e6 },
    ofgl_epargne_brute: { "2025": -2e6 },
    ofgl_encours_dette: { "2025": 40e6 },
  });
  assert.ok(m);
  assert.equal(m.desendettement, null);
  assert.equal(noter(m).detail.dette, 0);
});

test("sans borne d'ouverture, la trajectoire ne punit ni ne récompense", () => {
  // Une commune dont 2019 n'est pas publié ne choisit pas cette absence.
  const m = mesurer({
    ofgl_recettes_fonctionnement: { "2025": 100e6 },
    ofgl_epargne_brute: { "2025": 15e6 },
    ofgl_encours_dette: { "2025": 45e6 },
  });
  assert.ok(m);
  assert.equal(m.trajectoire, null);
  assert.equal(noter(m).detail.trajectoire, BORNES.TRAJECTOIRE.points / 2);
});

test("les trois séries se lisent sur le même exercice, jamais sur trois", () => {
  // Une note composée d'une épargne 2025 et d'une dette 2021 ne décrirait
  // aucune collectivité réelle.
  const m = mesurer({
    ofgl_recettes_fonctionnement: { "2024": 90e6, "2025": 100e6 },
    ofgl_epargne_brute: { "2024": 9e6, "2025": 20e6 },
    ofgl_encours_dette: { "2024": 36e6 },
  });
  assert.ok(m);
  assert.equal(m.exercice, "2024", "le dernier exercice COMPLET, pas le dernier tout court");
  assert.equal(Math.round(m.tauxEpargne), 10);
});

test("un territoire sans les trois séries n'est pas noté plutôt que noté zéro", () => {
  // Zéro serait un jugement ; l'absence est un fait sur le fichier publié.
  assert.equal(note({ ofgl_recettes_fonctionnement: { "2025": 100e6 } }), null);
  assert.equal(note({}), null);
});

test("la mention ne dépend pas des voisins", () => {
  // Calibrer les mentions sur la distribution ferait bouger la mention d'une
  // commune parce qu'une autre a bougé. Les crans sont fixes et ronds.
  assert.equal(mention(20), "solide");
  assert.equal(mention(16), "solide");
  assert.equal(mention(15.9), "confortable");
  assert.equal(mention(10), "tendue");
  assert.equal(mention(5.9), "critique");
});

test("le barème n'a que trois termes, et aucun ne juge un choix politique", () => {
  // La garde de fond : ni le niveau de dépense, ni sa répartition, ni les taux
  // d'impôts n'entrent dans la note. Dépenser beaucoup en action sociale est
  // un choix d'électeurs, pas une faute de gestion — c'est la ligne que
  // l'Argus des communes ne tient pas, et notre seule défense sérieuse le jour
  // où 34 875 communes découvriront leur note.
  const source = new URL("./note.ts", import.meta.url);
  const texte = readFileSync(source, "utf8");
  for (const interdit of [
    "ofgl_depenses_fonctionnement",
    "ofgl_frais_personnel",
    "taux_foncier",
    "impots_locaux",
  ]) {
    assert.ok(
      !texte.includes(interdit),
      `${interdit} est entré dans la note : elle juge alors un choix, plus une solvabilité`,
    );
  }
  assert.equal(BORNES.MARGE.points + BORNES.DETTE.points + BORNES.TRAJECTOIRE.points, 20);
});
