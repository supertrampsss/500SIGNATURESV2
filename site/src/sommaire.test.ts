import assert from "node:assert/strict";
import { test } from "node:test";

import { filtrer, normaliser, rendreSommaire, type EntreeSommaire } from "./sommaire.ts";

const ENTREES: EntreeSommaire[] = [
  {
    ancre: "methode-emploi",
    libelle: "Emploi et chômage",
    nombre: 12,
    termes: "Taux de chômage localisé Nombre d'emplois salariés",
  },
  {
    ancre: "methode-education",
    libelle: "Éducation",
    nombre: 7,
    termes: "Élèves du premier degré Effectifs du second degré",
  },
  {
    ancre: "methode-finances",
    libelle: "Finances locales",
    nombre: 94,
    termes: "Dépenses de fonctionnement Encours de dette",
  },
];

test("sans requête, tout le sommaire reste affiché", () => {
  assert.equal(filtrer(ENTREES, "").length, 3);
  assert.equal(filtrer(ENTREES, "   ").length, 3);
});

test("le filtre porte sur le libellé du thème", () => {
  assert.deepEqual(filtrer(ENTREES, "finances").map((e) => e.ancre), ["methode-finances"]);
});

test("le filtre porte aussi sur les noms d'indicateurs", () => {
  // On cherche « dette », qui n'est dans aucun libellé de thème.
  assert.deepEqual(filtrer(ENTREES, "dette").map((e) => e.ancre), ["methode-finances"]);
});

test("les accents ne font pas rater une entrée", () => {
  assert.deepEqual(filtrer(ENTREES, "education").map((e) => e.ancre), ["methode-education"]);
  assert.deepEqual(filtrer(ENTREES, "CHOMAGE").map((e) => e.ancre), ["methode-emploi"]);
  assert.deepEqual(filtrer(ENTREES, "élèves").map((e) => e.ancre), ["methode-education"]);
});

test("une requête sans réponse ne renvoie rien plutôt que tout", () => {
  assert.deepEqual(filtrer(ENTREES, "aquaculture"), []);
});

test("normaliser retire accents et casse, rien d'autre", () => {
  assert.equal(normaliser("Éducation, Élèves"), "education, eleves");
});

test("chaque entrée porte son ancre et son nombre d'indicateurs", () => {
  const html = rendreSommaire(ENTREES);
  assert.match(html, /data-ancre="methode-emploi"/);
  assert.match(html, /Emploi et chômage <span[^>]*>\(12\)<\/span>/);
  assert.equal((html.match(/<li>/g) ?? []).length, 3);
});

test("les libellés du sommaire sont échappés", () => {
  const html = rendreSommaire([
    { ancre: "a\"b", libelle: "Impôts <locaux>", nombre: 1, termes: "" },
  ]);
  assert.ok(!html.includes("<locaux>"));
  assert.match(html, /data-ancre="a&quot;b"/);
});

test("aucun tiret cadratin dans le sommaire rendu", () => {
  assert.ok(!rendreSommaire(ENTREES).includes("—"));
});
