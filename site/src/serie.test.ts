/**
 * Une courbe est une comparaison d'un territoire avec lui-même. Ces tests
 * vérifient qu'elle ne franchit pas une fusion sans le dire — c'est la même
 * règle de périmètre qu'entre deux territoires, appliquée dans le temps.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  debutDeMandat,
  dernierPas,
  evolution,
  rendu,
  ruptureDePerimetre,
  type Evenement,
} from "./serie.ts";

const FINE = "\u202f";

const SERIE = { "2018": 100, "2019": 110, "2020": 120, "2021": 132 };
const FUSION: Evenement[] = [{ type: "fusion", date: "2020-01-01", avec: "33999" }];
const brut = (v: number) => `${v} €`;

test("sans changement de périmètre, l'évolution part du premier exercice", () => {
  assert.equal(evolution(SERIE, "2021", []).includes(`+32${FINE}% depuis 2018`), true);
});

test("une fusion borne l'évolution au périmètre courant", () => {
  const texte = evolution(SERIE, "2021", FUSION);
  assert.equal(texte.includes(`+10${FINE}% depuis 2020`), true);
  assert.match(texte, /depuis le changement de périmètre/);
  assert.doesNotMatch(texte, /depuis 2018/);
});

test("un événement hors de la série ne borne rien", () => {
  const avant: Evenement[] = [{ type: "fusion", date: "2015-06-01", avec: "33999" }];
  assert.match(evolution(SERIE, "2021", avant), /depuis 2018/);
});

test("la rupture retenue est la plus récente", () => {
  const deux: Evenement[] = [
    { type: "fusion", date: "2019-01-01", avec: "a" },
    { type: "scission", date: "2020-01-01", avec: "b" },
  ];
  assert.equal(ruptureDePerimetre(deux, Object.keys(SERIE)), "2020");
});

test("le graphique marque la rupture et l'écrit en toutes lettres", () => {
  const html = rendu(SERIE, FUSION, brut);
  assert.match(html, /class="serie__rupture"/);
  assert.match(html, /Périmètre modifié en 2020/);
  assert.match(html, /ne portent pas sur le même territoire/);
});

test("sans rupture, ni trait ni avertissement", () => {
  const html = rendu(SERIE, [], brut);
  assert.doesNotMatch(html, /serie__rupture/);
  assert.doesNotMatch(html, /Périmètre modifié/);
});

test("deux points ne font pas une courbe", () => {
  assert.equal(rendu({ "2020": 1, "2021": 2 }, [], brut), "");
});

test("une série plate ne divise pas par zéro", () => {
  const html = rendu({ "2019": 5, "2020": 5, "2021": 5 }, [], brut);
  assert.doesNotMatch(html, /NaN/);
  assert.match(html, /<polyline/);
});

test("le graphique porte un équivalent textuel", () => {
  const html = rendu(SERIE, [], brut);
  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="Évolution 2018 : 100 €, 2021 : 132 €"/);
});

test("une valeur de départ nulle ne produit pas d'infini", () => {
  assert.equal(evolution({ "2019": 0, "2020": 5, "2021": 8 }, "2021", []), "");
});

test("une série recalculée dans la géographie courante ne se coupe pas", () => {
  /*
   * L'INSEE republie les populations légales anciennes dans les communes
   * d'aujourd'hui : Vire Normandie, née en 2016 de huit communes, porte 17 951
   * habitants dès 2013 — le territoire entier. Couper cette série reviendrait à
   * déclarer incomparable ce que le producteur a justement rendu comparable.
   * La fiche traduit ce cas en n'envoyant aucun événement.
   */
  const legales = { "2013": 17951, "2023": 17457 };
  assert.equal(ruptureDePerimetre([], Object.keys(legales)), null);
  assert.equal(evolution(legales, "2023", []).includes(`−2,8${FINE}% depuis 2013`), true);
  assert.doesNotMatch(evolution(legales, "2023", []), /périmètre/);
});

test("le début du mandat se marque, mais seulement entre les bornes", () => {
  const periodes = ["2018", "2019", "2020", "2021", "2022"];
  assert.equal(debutDeMandat("2020-05-23", periodes), "2020");
  // Un repère sur le premier ou le dernier point se confond avec le bord.
  assert.equal(debutDeMandat("2018-01-01", periodes), null);
  assert.equal(debutDeMandat("2022-07-01", periodes), null);
  // Hors de la série, ou inconnu.
  assert.equal(debutDeMandat("2014-04-05", periodes), null);
  assert.equal(debutDeMandat(null, periodes), null);
  assert.equal(debutDeMandat("2020-05-23", ["2020"]), null);
});

test("un changement de mandature n'est pas une rupture de périmètre", () => {
  // C'est la distinction qui compte : une fusion fait porter la série sur un
  // autre territoire et interdit de comparer de part et d'autre ; un
  // changement de maire ne change rien à ce qui est mesuré.
  const serie = { "2018": 100, "2019": 110, "2020": 120, "2021": 130 };
  const html = rendu(serie, [], (v) => `${v} €`, [], true, "2020-05-23");
  assert.match(html, /serie__mandat/);
  assert.doesNotMatch(html, /serie__rupture/);
  assert.doesNotMatch(html, /ne portent pas sur le même territoire/);
  // L'évolution reste calculée de bout en bout.
  assert.match(evolution(serie, "2021", []), /2018/);
});

test("le repère de mandature se nomme en une ligne, sans pavé répété", () => {
  // La réserve (« un budget se décide à plusieurs niveaux ») est dite une
  // fois, dans Sources et méthode : sous chaque courbe, c'était du bruit.
  const serie = { "2018": 100, "2019": 110, "2020": 120, "2021": 130 };
  const html = rendu(serie, [], (v) => `${v} €`, [], true, "2020-05-23");
  assert.match(html, /prise de fonctions du maire \(2020\)/);
  assert.doesNotMatch(html, /il n'explique pas/);
  // Un lecteur d'écran ne voit pas le trait : l'équivalent textuel le porte.
  assert.match(html, /aria-label="[^"]*pris ses fonctions en 2020/);
});

test("sans maire connu, la série est inchangée", () => {
  const serie = { "2018": 100, "2019": 110, "2020": 120 };
  const html = rendu(serie, [], (v) => `${v} €`, [], true, null);
  assert.doesNotMatch(html, /serie__mandat/);
  assert.doesNotMatch(html, /pris ses fonctions/);
});

/**
 * Le dernier pas se lit sans rien ouvrir. Ces tests fixent les deux pièges :
 * un taux ne varie pas en pourcentage, et un pas ne franchit pas une fusion.
 */

test("un taux varie en points, pas en pourcentage", () => {
  // 12,0 % à 12,6 %, c'est +0,6 point. Écrire « +5 % » serait un pourcentage
  // de pourcentage : le genre de nombre qu'on cite sans savoir ce qu'il compte.
  const pas = dernierPas({ "2022": 12.0, "2023": 12.6 }, "percent");
  assert.equal(pas?.texte, `+0,6${FINE}pt`);
  assert.equal(pas?.sens, "hausse");
});

test("un effectif varie en pourcentage", () => {
  const pas = dernierPas({ "2022": 100, "2023": 110 }, "count");
  assert.equal(pas?.texte, `+10${FINE}%`);
  assert.equal(pas?.depuis, "2022");
  assert.equal(pas?.jusqua, "2023");
});

test("un pas ne franchit pas un changement de périmètre", () => {
  const fusion = [{ type: "fusion", date: "2023-01-01", avec: "Ailleurs" }];
  assert.equal(dernierPas({ "2022": 100, "2023": 190 }, "count", fusion), null);
  // La fusion est antérieure aux deux derniers points : ceux-là se comparent.
  assert.notEqual(dernierPas({ "2022": 180, "2023": 190 }, "count", [
    { type: "fusion", date: "2021-01-01", avec: "Ailleurs" },
  ]), null);
});

test("une base nulle n'a pas de variation relative", () => {
  // Passer de 0 à 3 n'est pas « +∞ % » : la ligne le montre par sa valeur.
  assert.equal(dernierPas({ "2022": 0, "2023": 3 }, "count"), null);
  // Un taux, lui, se compare en points même depuis zéro.
  assert.equal(dernierPas({ "2022": 0, "2023": 3 }, "percent")?.texte, `+3${FINE}pt`);
});

test("sous le seuil d'affichage, le pas est stable et non une hausse", () => {
  // Une flèche de hausse au-dessus d'un « 0 % » affirmerait un mouvement que
  // le chiffre ne montre pas.
  const pas = dernierPas({ "2022": 100_000, "2023": 100_020 }, "count");
  assert.equal(pas?.sens, "stable");
  assert.equal(pas?.texte, `0${FINE}%`);
});

test("une série d'un seul point n'a pas de pas", () => {
  assert.equal(dernierPas({ "2023": 100 }, "count"), null);
  assert.equal(dernierPas({}, "count"), null);
});

test("le pas s'arrête à la période affichée, pas à la fin de la série", () => {
  // La carte montre 2023 : une variation qui courrait jusqu'à 2025 se lirait
  // comme celle de la valeur affichée au-dessus.
  const serie = { "2022": 100, "2023": 110, "2024": 200, "2025": 400 };
  const pas = dernierPas(serie, "count", [], "2023");
  assert.equal(pas?.jusqua, "2023");
  assert.equal(pas?.texte, `+10${FINE}%`);
  // Une période qui n'est pas dans la série, ou qui l'ouvre, n'a pas de pas.
  assert.equal(dernierPas(serie, "count", [], "2022"), null);
  assert.equal(dernierPas(serie, "count", [], "2019"), null);
});

test("un pourcentage ne traverse pas zéro : un solde qui change de camp se tait", () => {
  // La fiche France affichait « Solde public −24 686,1 % depuis 1959 »,
  // « Solde des collectivités locales −6 785,7 % » et « Solde de la Sécurité
  // sociale −1 906,2 % ». Passer d'un excédent à un déficit n'est pas une
  // baisse de vingt-quatre mille sept cents pour cent : c'est un changement de
  // signe, et aucun pourcentage ne porte cette information.
  assert.equal(evolution({ "1959": 618, "2025": -152532 }, "2025"), "");
  assert.equal(evolution({ "2013": -5000, "2025": 4000 }, "2025"), "");
  // Deux valeurs du même signe gardent leur variation, négative comprise.
  assert.match(evolution({ "2013": -100000, "2025": -124206 }, "2025"), /%/);
  assert.match(evolution({ "2019": 336069, "2025": 441194 }, "2025"), /\+/);
  // Un taux varie en points : une soustraction traverse zéro sans encombre.
  assert.match(
    evolution({ "2019": -2.4, "2025": 5.1 }, "2025", [], false, null, "percent"),
    /pt/,
  );
});
