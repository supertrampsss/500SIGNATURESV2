/**
 * La logique d'affichage décide de ce que le lecteur croit voir : des bornes de
 * classes fausses ou une division par la mauvaise population produiraient une
 * carte trompeuse tout en restant « techniquement » fonctionnelle.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  expressionCouleur,
  formater,
  noteEchelle,
  parHabitantAUnSens,
  populationDeReference,
  pourcentage,
  quantiles,
} from "./echelle.ts";

const FINE = "\u202f";

test("les classes répartissent les territoires en parts égales", () => {
  const echelle = quantiles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], 7);
  assert.equal(echelle.couleurs.length, 7);
  assert.equal(echelle.bornes.length, 6);
  // bornes strictement croissantes : sinon deux classes se confondent
  for (let i = 1; i < echelle.bornes.length; i += 1) {
    assert.ok(echelle.bornes[i] > echelle.bornes[i - 1]);
  }
});

test("une valeur extrême n'écrase pas l'échelle", () => {
  // Les bornes restent dans la masse des valeurs : l'extrême vit dans la
  // classe « et plus », il ne tire pas les seuils vers lui.
  const etale = quantiles([1, 2, 3, 4, 5, 6, 7, 1_000_000_000], 4);
  assert.ok(etale.bornes.every((borne) => borne <= 7));
  // Cas dégénéré : des valeurs toutes identiques plus un extrême. Les
  // quantiles tombent tous sur la masse — l'ancienne échelle affichait
  // « 1 – 1 » en boucle ; la nouvelle dit une seule classe, ce qui est vrai.
  const masse = quantiles([1, 1, 1, 1, 1, 1, 1, 1_000_000_000], 4);
  assert.deepEqual(masse.bornes, []);
  assert.equal(masse.couleurs.length, 1);
});

test("aucune classe sans donnée", () => {
  assert.deepEqual(quantiles([]), { bornes: [], couleurs: [] });
});

test("un territoire sans population n'est pas colorié par habitant", () => {
  const expression = expressionCouleur(
    { "33318": 1000, "99999": 2000 },
    quantiles([10, 20, 30], 3),
    true,
    { "33318": 100 },
  ) as unknown[];
  const codes = expression.filter((x) => typeof x === "string" && /^\d{5}$/.test(x));
  assert.deepEqual(codes, ["33318"]); // 99999 n'a pas de dénominateur : écarté
});

test("les montants gardent leur unité et leur ordre de grandeur", () => {
  assert.match(formater(30_761_441, "EUR", false), /30,8\s?M€/);
  assert.match(formater(999_000_000, "EUR", false), /M€/);
  // Un budget d'État se lit en milliards : « 441 194,3 M€ » est exact et illisible.
  assert.match(formater(441_194_313_369.76, "EUR", false), /441\u202f194\u202fM€/);
  assert.match(formater(-124_205_673_501.55, "EUR", false), /−124\u202f206\u202fM€/);
  assert.match(formater(456, "EUR", true), /456/);
  assert.equal(formater(67_339, "count", false), "67 339".replace(" ", " "));
});

test("un montant se lit en millions d'euros, du plus petit au plus grand", () => {
  // La règle du site : une seule unité pour tous les montants, pour qu'une
  // colonne se compare sans conversion de tête. Deux décimales sous le million,
  // pour qu'un petit budget ne s'efface pas.
  assert.equal(formater(340_000, "EUR", false), "0,34 M€");
  assert.equal(formater(1_400_000, "EUR", false), "1,4 M€");
  assert.equal(formater(30_761_441, "EUR", false), "30,8 M€");
  assert.equal(formater(441_194_313_369.76, "EUR", false), "441 194 M€");
  // Un montant qui s'arrondit à zéro ne prend pas de signe négatif.
  assert.equal(formater(-820, "EUR", false), "0,00 M€");
  // L'exception, et la seule : le par-habitant de la ligne de récapitulatif.
  assert.match(formater(1_373, "EUR", true), /^1.373.€$/u);
});

test("la surface consommée se lit en hectares dès que le m² ne se lit plus", () => {
  // 7 351 m² restent des m² ; la Gironde (3 117 494 m² en 2023) se lit
  // « 312 ha », pas en millions de m².
  assert.match(formater(7_351, "m2", false), /7\u202f351\u202fm²/);
  assert.match(formater(13_100, "m2", false), /1,3\u202fha/);
  assert.match(formater(3_117_494, "m2", false), /312\u202fha/);
  assert.match(formater(-25_000, "m2", false), /−2,5\u202fha/);
});

test("une médiane ne se divise pas par la population", () => {
  // Un budget communal ramené à l'habitant a un sens ; un niveau de vie médian
  // est déjà une valeur par personne, et une médiane ne s'additionne pas.
  assert.equal(parHabitantAUnSens({ unite: "EUR", sommable: true }), true);
  assert.equal(parHabitantAUnSens({ unite: "EUR", sommable: false }), false);
  assert.equal(parHabitantAUnSens({ unite: "percent", sommable: false }), false);
  // Catalogue ancien, sans le champ : on garde le comportement d'avant.
  assert.equal(parHabitantAUnSens({ unite: "EUR" }), true);
});

/*
 * Un taux affiché en euros est l'erreur que ce site existe pour ne pas
 * commettre. Elle a été trouvée en regardant la page : le taux de pauvreté de
 * Sainte-Foy-la-Grande, 51 %, s'affichait « 51 € », et la légende affirmait
 * « Montants en euros courants ». Ces tests la clouent.
 */
test("la décimale fixe ne sert qu'aux colonnes comparées", () => {
  // Par défaut, rien ne change : une variation de carte s'écrit « +12 % » et
  // un arrondi à zéro « 0 % », deux décisions qu'evolution-carte.test.ts tient.
  assert.equal(pourcentage(1), `1${FINE}%`);
  assert.equal(pourcentage(12), `12${FINE}%`);
  // Demandée, elle aligne la colonne : « 1,0 » sous « 1,4 », jamais « 1 ».
  assert.equal(pourcentage(1, true), `1,0${FINE}%`);
  assert.equal(pourcentage(1.4, true), `1,4${FINE}%`);
  assert.equal(pourcentage(21, true), `21,0${FINE}%`);
  // Et elle n'invente pas de précision : une valeur à deux décimales reste
  // arrondie au dixième, comme sans l'option.
  assert.equal(pourcentage(1.46, true), `1,5${FINE}%`);
});

test("un taux se formate en pourcentage, jamais en euros", () => {
  // FINE = espace fine insécable U+202F, exigée avant % en typographie française
  assert.equal(formater(51, "percent", false), `51${FINE}%`);
  assert.equal(formater(12.4, "percent", false), `12,4${FINE}%`);
  assert.equal(formater(117.5, "percent", false), `117,5${FINE}%`);
  assert.doesNotMatch(formater(51, "percent", false), /€/);
});

test("le pourcentage n'est pas multiplié par cent", () => {
  // les valeurs publiées sont déjà en points de pourcentage
  assert.match(formater(7.7, "percent", false), /^7,7/);
});

test("un taux négatif garde son signe, au signe moins typographique", () => {
  // U+2212, pas le trait d'union du clavier : les phrases composées ailleurs
  // dans le site écrivent « −53 % », et les deux formes se côtoyaient à
  // l'écran dans deux dessins et deux largeurs.
  assert.match(formater(-5.1, "percent", false), /^−5,1/);
  assert.doesNotMatch(formater(-5.1, "percent", false), /-/);
});

test("le séparateur décimal est français partout", () => {
  for (const rendu of [
    formater(12.4, "percent", false),
    formater(1.23e9, "EUR", false),
    formater(4567, "count", false),
  ]) {
    assert.doesNotMatch(rendu, /\d\.\d/, rendu);
  }
});

test("la note de légende suit l'unité au lieu de l'affirmer", () => {
  assert.match(noteEchelle("percent", false), /pourcentage/);
  assert.doesNotMatch(noteEchelle("percent", false), /euros/);
  assert.match(noteEchelle("EUR", false), /euros courants/);
  assert.match(noteEchelle("count", false), /Effectifs/);
  assert.match(noteEchelle("EUR", true), /population de référence/);
});

/*
 * Le dénominateur d'un « par habitant » est la population de l'exercice
 * considéré. La fiche divisait toute la série par celle d'aujourd'hui, et
 * annonçait « référence OFGL 2025 » un nombre venu du référentiel géographique
 * (Pessac : 67 339 affichés, 67 670 à l'OFGL).
 */
const PESSAC = {
  population: 67339,
  series: {
    ofgl_population_reference: { "2022": 66007, "2023": 66606, "2025": 67670 },
  },
};

test("chaque exercice se divise par sa propre population", () => {
  assert.deepEqual(populationDeReference(PESSAC, "2022"), { valeur: 66007, exercice: "2022" });
  assert.deepEqual(populationDeReference(PESSAC, "2025"), { valeur: 67670, exercice: "2025" });
});

test("à défaut de référence OFGL, le repli est signalé et non maquillé", () => {
  // 2024 manque dans cette série : on retombe sur le référentiel, et `exercice`
  // vaut null pour que l'étiquette dise laquelle a servi.
  assert.deepEqual(populationDeReference(PESSAC, "2024"), { valeur: 67339, exercice: null });
  assert.deepEqual(populationDeReference({ population: null }, "2025"), {
    valeur: null,
    exercice: null,
  });
});

test("une population nulle ne passe pas pour un dénominateur valide", () => {
  const vide = { population: 0, series: { ofgl_population_reference: { "2025": 0 } } };
  assert.equal(populationDeReference(vide, "2025").valeur, 0);
});

test("la note du « par habitant » nomme le facteur de confusion principal", () => {
  const note = noteEchelle("EUR", true);
  assert.match(note, /population de référence de l'Observatoire des finances locales/);
  assert.match(note, /touristique/);
});

test("une unité inconnue se voit au lieu de passer pour des euros", () => {
  /*
   * La faute du 1er août n'était pas d'avoir oublié « percent » : c'était que
   * le repli était la devise, donc faux et plausible à la fois. Une unité que
   * ce module ne connaît pas doit sauter aux yeux du premier lecteur.
   */
  const rendu = formater(12.4, "PC_GDP", false);
  assert.match(rendu, /12,4 PC_GDP/);
  assert.doesNotMatch(rendu, /€/);
});

test("les unités connues gardent leur mise en forme", () => {
  // Intl groupe les milliers avec une espace fine insécable, pas une espace
  // ordinaire : l'assertion doit accepter ce que la locale produit réellement.
  assert.match(formater(1500, "EUR", true), /€/);
  assert.equal(formater(1500, "count", false), `1${FINE}500`);
  assert.equal(formater(15, "percent", false), `15${FINE}%`);
});

test("les taux de la source en pour mille s'affichent en % du bon dénominateur", () => {
  // Le symbole ‰ se lit « %0 » pour beaucoup : la conversion en pourcentage
  // est exacte (÷ 10) et la note dit lequel — « % des logements » n'est pas
  // « % des habitants », et confondre les deux ferait un chiffre dix fois
  // faux sur le mauvais ensemble.
  assert.equal(formater(10.2266504, "pour_1000_habitants", false), `1,02${FINE}%`);
  assert.equal(formater(3.05, "pour_1000_logements", false), `0,31${FINE}%`);
  assert.match(noteEchelle("pour_1000_habitants", false), /% des habitants/);
  assert.match(noteEchelle("pour_1000_habitants", false), /pas l'intégralité des faits commis/);
  assert.match(noteEchelle("pour_1000_logements", false), /% des logements/);
  assert.match(noteEchelle("pour_1000_logements", false), /pas la population/);
});

test("l'APL s'affiche en consultations par an, jamais en euros ni en pourcents", () => {
  assert.equal(formater(2.842, "consultations_par_an", false), `2,8${FINE}consult./an`);
  assert.match(noteEchelle("consultations_par_an", false), /habitant standardisé/);
  assert.match(noteEchelle("consultations_par_an", false), /2,5/);
  assert.match(noteEchelle("consultations_par_an", false), /modélisé/);
});

test("une distribution massée sur zéro ne produit pas de classes en doublon", () => {
  // moitié de zéros (communes sans cambriolage), moitié de valeurs étalées
  const valeurs = [...Array(50).fill(0), ...Array.from({ length: 50 }, (_, i) => i + 1)];
  const echelle = quantiles(valeurs, 7);
  for (let i = 1; i < echelle.bornes.length; i += 1) {
    assert.ok(echelle.bornes[i] > echelle.bornes[i - 1], "bornes strictement croissantes");
  }
  // aucune borne au minimum : une classe « moins de 0 » serait vide
  assert.ok(echelle.bornes[0] > 0);
  assert.equal(echelle.couleurs.length, echelle.bornes.length + 1);
  // le contraste survit : la classe la plus foncée reste la plus foncée
  assert.equal(echelle.couleurs.at(-1), "#1b4f77");
});

test("un délai de paiement ne se légende pas en euros", () => {
  // Le repli de `noteLegende` était « Montants en euros courants » : une unité
  // inconnue annonçait une somme d'argent sous une durée.
  const note = noteEchelle("jours", false);
  assert.match(note, /en jours/);
  assert.doesNotMatch(note, /euros/);
  assert.match(formater(19.85, "jours", false), /19,9 jours/);
});

test("un loyer au mètre carré ne se légende pas en euros courants", () => {
  // 86 % des communes de la source portent le loyer d'une zone voisine : la
  // légende doit dire que le gris est une absence de mesure, pas un zéro.
  const note = noteEchelle("€/m²/mois", false);
  assert.match(note, /charges comprises/);
  assert.match(note, /reste grise/);
  assert.doesNotMatch(note, /euros courants/);
  assert.match(formater(12.7, "€/m²/mois", false), /12,7 €\/m²\/mois/);
});
