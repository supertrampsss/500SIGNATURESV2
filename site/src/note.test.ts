/**
 * La note de gestion. Ces tests portent sur ce qu'elle refuse autant que sur ce
 * qu'elle calcule : une note publiée sur 34 875 communes sera contestée, et
 * chaque refus est ce qui la rend défendable.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { BORNES_PAR_NIVEAU, bornes, mention, mesurer, note, noter } from "./note.ts";

/** Le barème du bloc communal — celui que la plupart de ces tests éprouvent. */
const BORNES = BORNES_PAR_NIVEAU.commune;

/** Une commune confortable : 20 % d'épargne, 3 ans de dette, en progrès. */
const SOLIDE = {
  ofgl_recettes_fonctionnement: { "2019": 90e6, "2025": 100e6 },
  ofgl_epargne_brute: { "2019": 13.5e6, "2025": 20e6 },
  ofgl_encours_dette: { "2019": 50e6, "2025": 60e6 },
};

test("la note se décompose, et les trois termes font le total", () => {
  const n = note(SOLIDE, "commune");
  assert.ok(n, "la commune porte les trois séries, elle doit être notée");
  const { marge, dette, trajectoire } = n.detail;
  assert.equal(Math.round((marge + dette + trajectoire) * 10) / 10, n.valeur);
  // Une note publiée doit pouvoir se contester terme par terme : sans le
  // détail, « 15,9/20 » est un verdict sans motif.
  assert.ok(marge > 0 && dette > 0 && trajectoire > 0, JSON.stringify(n.detail));
});

test("le barème est borné aux deux bouts", () => {
  const parfait = noter({ tauxEpargne: 90, desendettement: 0.1, trajectoire: 40, exercice: "2025" }, "commune");
  assert.equal(parfait.valeur, 20, "une commune très au-dessus des bornes plafonne à 20");
  const pire = noter({ tauxEpargne: -30, desendettement: 60, trajectoire: -40, exercice: "2025" }, "commune");
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
  assert.equal(noter(m, "commune").detail.dette, 0);
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
  assert.equal(noter(m, "commune").detail.trajectoire, BORNES.TRAJECTOIRE.points / 2);
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
  assert.equal(note({ ofgl_recettes_fonctionnement: { "2025": 100e6 } }, "commune"), null);
  assert.equal(note({}, "commune"), null);
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

test("un département n'est pas noté au barème d'une commune", () => {
  // **Le défaut que ce test tient, mesuré sur la publication 2026-08-11T0807.**
  // Le taux d'épargne médian est de 16,9 % pour une commune et de 9,6 % pour un
  // département : les recettes de fonctionnement d'un département portent le
  // RSA, l'APA et la PCH, qui entrent et ressortent. Noter les deux sur la même
  // échelle retirait ~2,3 points sur 8 à l'échelon entier pour sa définition de
  // périmètre — exactement la comparaison que la charte du dépôt refuse.
  const communal = bornes("commune");
  const departemental = bornes("departement");
  assert.ok(communal && departemental);
  assert.notEqual(
    communal.MARGE.haut,
    departemental.MARGE.haut,
    "les deux échelons partagent leur borne de marge : le biais de périmètre est revenu",
  );

  // Un même taux d'épargne ne vaut pas les mêmes points aux deux échelons.
  const memesMesures = { tauxEpargne: 9.6, desendettement: 5, trajectoire: -3, exercice: "2025" };
  const commune = noter(memesMesures, "commune");
  const departement = noter(memesMesures, "departement");
  assert.ok(
    departement.detail.marge > commune.detail.marge,
    `9,6 % de marge est la médiane d'un département et le bas d'une commune : ` +
      `${departement.detail.marge} contre ${commune.detail.marge}`,
  );

  // Et la trajectoire est recentrée sur le mouvement médian de l'échelon :
  // entre 2019 et 2025 l'épargne a baissé partout, et une borne centrée sur
  // zéro faisait perdre des points pour un choc que personne n'a décidé.
  for (const [niveau, mediane] of [
    ["commune", -2.7],
    ["departement", -4.4],
    ["region", -2.3],
  ] as const) {
    const b = bornes(niveau);
    assert.ok(b);
    const milieu = (b.TRAJECTOIRE.bas + b.TRAJECTOIRE.haut) / 2;
    assert.ok(
      Math.abs(milieu - mediane) < 0.05,
      `${niveau} : la trajectoire bascule à ${milieu} et non à la médiane mesurée ${mediane}`,
    );
    // Une collectivité qui suit exactement le mouvement de son échelon a la
    // moitié des points : elle n'a ni décroché ni redressé.
    const surLaMediane = noter(
      { tauxEpargne: 12, desendettement: 5, trajectoire: mediane, exercice: "2025" },
      niveau,
    );
    assert.equal(surLaMediane.detail.trajectoire, b.TRAJECTOIRE.points / 2, niveau);
  }
});

test("la France n'a pas de barème, et n'est donc pas notée", () => {
  // Elle n'a pas de compte administratif : lui appliquer le barème d'une
  // commune noterait un État sur les ratios d'une mairie. `null` est un fait
  // sur ce qui est publié, pas un trou.
  assert.equal(bornes("pays"), null);
  assert.equal(note(SOLIDE, "pays"), null);
  assert.throws(() => noter({ tauxEpargne: 20, desendettement: 3, trajectoire: 1, exercice: "2025" }, "pays"));
});

test("une note dit de quel barème elle sort", () => {
  // Deux notes de 12 peuvent venir de deux grilles. Sans ce champ, rien ne le
  // dirait — et le bloc à l'écran lirait les points d'un autre échelon.
  const n = note(SOLIDE, "commune");
  assert.equal(n?.niveau, "commune");
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
  // Et les quatre échelons notent sur 20, pas seulement le bloc communal :
  // une note sur 18 comparée à une note sur 20 est un défaut qui ne se voit
  // pas à l'écran.
  for (const [niveau, b] of Object.entries(BORNES_PAR_NIVEAU)) {
    assert.equal(b.MARGE.points + b.DETTE.points + b.TRAJECTOIRE.points, 20, niveau);
    // Les bornes vont dans le bon sens, sans quoi `entre()` rend n'importe quoi.
    assert.ok(b.MARGE.bas < b.MARGE.haut, niveau);
    assert.ok(b.DETTE.meilleur < b.DETTE.pire, niveau);
    assert.ok(b.TRAJECTOIRE.bas < b.TRAJECTOIRE.haut, niveau);
  }
});
