/**
 * Un total sans ses bénéficiaires demande de croire sur parole.
 *
 * « Subventions de l'État aux associations : 353 € par habitant » ne répond pas
 * à la question qu'on vient poser — *lesquelles*. Ces tests fixent ce que la
 * liste doit dire en même temps que les noms : l'exercice, l'imputation au
 * siège, et le fait qu'elle ne couvre que l'État.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { MONTRES, raccourcir, rendu } from "./associations.ts";
import type { SubventionsCommune } from "./donnees.ts";

function beneficiaire(nom: string, montant: number, objet: string | null = null) {
  return { siren: nom, nom, programme: "163", objet, montant };
}

const THIONVILLE: SubventionsCommune = {
  exercice: "2021",
  beneficiaires: [
    beneficiaire("APSIS EMERGENCE", 37_180, "Transfert direct aux ménages"),
    beneficiaire("Ligue de l'enseignement", 12_000),
  ],
};

test("les associations sont nommées, avec leur montant", () => {
  const html = rendu(THIONVILLE);
  assert.match(html, /APSIS EMERGENCE/);
  assert.match(html, /Ligue de l&#39;enseignement/);
  // Tout en millions d'euros, deux décimales : une colonne où les unités
  // changent d'une ligne à l'autre ne se compare pas d'un coup d'œil.
  assert.match(html, /0,04 M€/);
  assert.match(html, /0,01 M€/);
  assert.match(html, /Transfert direct aux ménages/);
});

test("la réserve qui compte est écrite avec la liste, pas ailleurs", () => {
  const html = rendu(THIONVILLE);
  // Sans cette phrase, une fédération nationale domiciliée à Paris se lirait
  // comme de l'argent dépensé pour les Parisiens.
  assert.match(html, /à l'adresse du siège du\s+bénéficiaire et non là où l'action est menée/);
  // L'exercice est 2021 : cinq ans séparent ces versements du lecteur.
  assert.match(html, /exercice 2021/);
});

test("une commune sans association subventionnée n'a pas de bloc vide", () => {
  assert.equal(rendu(undefined), "");
  assert.equal(rendu({ exercice: "2021", beneficiaires: [] }), "");
});

test("au-delà de douze, le reste se replie et la concentration se dit", () => {
  // Paris en compte 774 : au-delà d'une douzaine, ce n'est plus une réponse,
  // c'est une annexe.
  const nombreuses: SubventionsCommune = {
    exercice: "2021",
    beneficiaires: Array.from({ length: 20 }, (_, rang) =>
      beneficiaire(`Asso ${rang}`, rang < MONTRES ? 1_000 : 100),
    ),
  };
  const html = rendu(nombreuses);
  assert.match(html, /Les 8 autres bénéficiaires/);
  // 12 × 1 000 sur 12 000 + 8 × 100 = 12 800 -> 94 %.
  assert.match(html, /Les 12 premières portent 94\s?% du total versé dans la commune/);
  assert.match(html, /<details class="assos__suite">/);
});

test("sans repli, aucune phrase de concentration : elle ne dirait rien", () => {
  const html = rendu(THIONVILLE);
  assert.doesNotMatch(html, /premières portent/);
  assert.doesNotMatch(html, /autres bénéficiaires/);
});

test("un objet de convention long est coupé sur un mot", () => {
  const objet =
    "Soutien aux actions de médiation familiale et de gestion des lieux d'accueil" +
    " pour l'exercice du droit de visite dans le département";
  const court = raccourcir(objet);
  assert.ok(court.length < objet.length);
  assert.ok(court.endsWith("…"));
  assert.doesNotMatch(court, /\s…$/);
  // Un objet court n'est pas touché.
  assert.equal(raccourcir("Insertion professionnelle"), "Insertion professionnelle");
});

test("le total par programme dit au titre de quoi l'argent est versé", () => {
  // Les 2 362 objets de convention ne se regroupent pas ; le programme
  // budgétaire, lui, est un vocabulaire contrôlé de quatre-vingt-un libellés.
  const html = rendu({
    ...THIONVILLE,
    programmes: [
      { code: "177", libelle: "Hébergement et insertion des personnes vulnérables",
        mission: "Cohésion des territoires", montant: 30_000_000 },
      { code: "163", libelle: "Jeunesse et vie associative",
        mission: "Sport, jeunesse et vie associative", montant: 4_000_000 },
    ],
  });
  assert.match(html, /Au titre de quel programme/);
  assert.match(html, /Hébergement et insertion des personnes vulnérables/);
  assert.match(html, /30,00 M€/);
  // La mission situe le programme : « 177 » ne dit rien, « Cohésion des
  // territoires » situe.
  assert.match(html, /Cohésion des territoires/);
});

test("sans nomenclature publiée, aucun bloc de programmes", () => {
  const html = rendu(THIONVILLE);
  assert.doesNotMatch(html, /Au titre de quel programme/);
  // Et la liste nominative, elle, reste.
  assert.match(html, /APSIS EMERGENCE/);
});
