/**
 * La fiche raconte un mandat, et le bon.
 *
 * Le piège est daté : les élections municipales générales du 22 mars 2026 ont
 * installé des équipes dont **aucun exercice n'est publié** — les comptes des
 * collectivités s'arrêtent à 2025. Une fenêtre calée sur le mandat en cours
 * n'aurait rien à montrer, et une fenêtre calée sur « les six dernières années »
 * mélangerait deux équipes. Ces tests fixent le recul d'un mandat, le refus
 * d'écrire quand rien n'est publié, et le fait que l'exercice de référence est
 * celui d'avant l'élection, pas celui de l'élection.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { ELECTIONS_MUNICIPALES, mandatEnCours, mandatRaconte } from "./mandat.ts";

/** Ce que l'OFGL publie pour les 534 communes de Gironde à l'été 2026. */
const PUBLIES = ["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"];
const AUJOURDHUI = "2026-08-08";

test("le mandat raconté est celui qui vient de s'achever, pas celui qui vient de s'ouvrir", () => {
  const mandat = mandatRaconte(PUBLIES, AUJOURDHUI);
  assert.deepEqual(mandat, {
    debut: "2020-03-15",
    fin: "2026-03-22",
    exerciceReference: "2019",
    exerciceFin: "2025",
    exercices: 6,
    enCours: false,
  });
});

/**
 * L'exercice de l'année d'une élection appartient à l'équipe suivante.
 *
 * Les conseils sont installés en avril : 2026 est un exercice de la nouvelle
 * équipe, pas le dernier de l'ancienne. Le compter dans le mandat clos ferait
 * porter à une équipe sortante onze mois de décisions qu'elle n'a pas prises.
 */
test("l'exercice de l'année de l'élection ne compte pas dans le mandat qu'elle clôt", () => {
  const mandat = mandatRaconte([...PUBLIES, "2026"], AUJOURDHUI);
  assert.equal(mandat?.exerciceFin, "2025");
  assert.equal(mandat?.exercices, 6);
});

test("le mandat en cours est nommé, sans exercice publié à lui attribuer", () => {
  const mandat = mandatEnCours(AUJOURDHUI);
  assert.deepEqual(mandat, {
    debut: "2026-03-22",
    fin: null,
    // Ce que la nouvelle équipe a trouvé en s'installant.
    exerciceReference: "2025",
    // Pas de chaîne inventée : rien n'est publié, rien n'est nommé.
    exerciceFin: "",
    exercices: 0,
    enCours: true,
  });
});

/**
 * Un mandat en cours **qui a des comptes** se raconte.
 *
 * La règle n'est pas « le mandat clos », c'est « le mandat qui a de quoi être
 * raconté ». À l'été 2025, l'équipe élue en 2020 était encore en fonction et
 * cinq exercices étaient publiés : la fiche racontait son bilan en cours, et
 * elle avait raison de le faire.
 */
test("un mandat encore en cours se raconte dès qu'il a assez d'exercices", () => {
  const mandat = mandatRaconte(
    ["2018", "2019", "2020", "2021", "2022", "2023", "2024"],
    "2025-06-01",
  );
  assert.deepEqual(mandat, {
    debut: "2020-03-15",
    fin: null,
    exerciceReference: "2019",
    exerciceFin: "2024",
    exercices: 5,
    enCours: true,
  });
});

test("on recule d'un mandat quand le dernier clos n'a pas trois exercices publiés", () => {
  // Un territoire dont la publication s'arrête en 2016 : le mandat 2020-2026
  // n'a rien, le mandat 2014-2020 a trois exercices et sa référence.
  const mandat = mandatRaconte(["2013", "2014", "2015", "2016"], AUJOURDHUI);
  assert.equal(mandat?.debut, "2014-03-23");
  assert.equal(mandat?.fin, "2020-03-15");
  assert.equal(mandat?.exerciceReference, "2013");
  assert.equal(mandat?.exerciceFin, "2016");
  assert.equal(mandat?.exercices, 3);
});

test("deux exercices ne font pas un mandat", () => {
  // Deux points font une droite et n'importe quelle histoire : sous trois
  // exercices, une subvention exceptionnelle deviendrait un bilan de mandat.
  assert.equal(mandatRaconte(["2024", "2025"], AUJOURDHUI), null);
});

/**
 * Sans exercice de référence, il n'y a pas de point de départ.
 *
 * Six exercices publiés de 2020 à 2025 mais rien en 2019 : toute variation se
 * mesurerait depuis une année choisie par le hasard de la publication, et le
 * titre parlerait d'un « bilan » qui commencerait un an après l'élection.
 */
test("un mandat sans son exercice de référence ne se raconte pas", () => {
  const publies = ["2020", "2021", "2022", "2023", "2024", "2025"];
  assert.equal(mandatRaconte(publies, AUJOURDHUI), null);
});

test("les périodes infra-annuelles ne bornent pas un mandat", () => {
  // « 2024-Q3 » n'est pas un compte administratif et ne se compare pas à 2019 ;
  // sans ce filtre, trois trimestres suffiraient à déclencher un bilan.
  const mandat = mandatRaconte(
    ["2019", "2020-Q1", "2020-Q2", "2020-Q3", "2021-Q1", "2025-01"],
    AUJOURDHUI,
  );
  assert.equal(mandat, null);
});

test("aucun territoire sans données n'écrit de fenêtre", () => {
  assert.equal(mandatRaconte([], AUJOURDHUI), null);
});

/**
 * Le calendrier est une constante, pas un appel réseau.
 *
 * Précédent maison : la nomenclature des programmes budgétaires est figée en
 * fichier de graine « plutôt que lue en ligne à la publication ». Trois dates
 * statutaires et passées ne changent plus ; les lire en ligne ferait bouger la
 * fenêtre de 34 875 fiches sans qu'aucun commit ne le montre.
 */
test("le calendrier des élections générales est figé, trié, et daté du premier tour", () => {
  assert.deepEqual(ELECTIONS_MUNICIPALES, ["2014-03-23", "2020-03-15", "2026-03-22"]);
  assert.deepEqual([...ELECTIONS_MUNICIPALES].sort(), ELECTIONS_MUNICIPALES);
  // Le second tour de 2020 a été reporté au 28 juin pour cause d'épidémie. Le
  // retenir ferait basculer l'exercice de référence d'une année dans les seules
  // communes à deux tours, et rendrait deux fiches voisines incomparables.
  assert.ok(!ELECTIONS_MUNICIPALES.includes("2020-06-28"));
});
