/**
 * Une phrase qui interprète un chiffre engage plus que le chiffre : elle doit
 * rester dans ce que la donnée porte, et se taire quand il n'y a rien à dire.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { lecture, resumeEcarts, synthese, tendance } from "./synthese.ts";

const euros = (v: number) => `${Math.round(v)} €`;

test("la lecture situe par rapport au premier repère disponible", () => {
  assert.equal(
    lecture(866, [{ libelle: "la médiane des communes de France", valeur: 749 }], euros),
    "16 % au-dessus de la médiane des communes de France (749 €).",
  );
  assert.equal(
    lecture(500, [{ libelle: "sa région", valeur: 1000 }], euros),
    "50 % en dessous de sa région (1000 €).",
  );
});

test("un écart minime ne se commente pas : il tient au périmètre autant qu'au réel", () => {
  assert.match(lecture(760, [{ libelle: "la France", valeur: 749 }], euros), /Proche de/);
});

test("sans repère utilisable, la lecture se tait plutôt que d'inventer", () => {
  assert.equal(lecture(866, [], euros), "");
  assert.equal(lecture(866, [{ libelle: "x", valeur: 0 }], euros), "");
  assert.equal(lecture(866, [{ libelle: "x", valeur: NaN }], euros), "");
});

test("la tendance dit le sens, et « stable » quand il n'y en a pas", () => {
  assert.equal(tendance({ "2022": 100, "2023": 110, "2024": 130 }), "En hausse depuis 2022.");
  assert.equal(tendance({ "2022": 130, "2023": 110, "2024": 100 }), "En baisse depuis 2022.");
  assert.equal(tendance({ "2022": 100, "2023": 101, "2024": 102 }), "Stable depuis 2022.");
});

test("une série trop courte ne produit pas de tendance", () => {
  assert.equal(tendance({ "2024": 100, "2025": 200 }), "");
});

test("la synthèse retient les faits disponibles, jamais un trou comblé", () => {
  const faits = [
    { id: "a", texte: "Fait A." },
    { id: "b", texte: "" },
    { id: "c", texte: "Fait C." },
    { id: "d", texte: "Fait D." },
    { id: "e", texte: "Fait E." },
  ];
  assert.deepEqual(synthese(faits, 3), ["Fait A.", "Fait C.", "Fait D."]);
  assert.deepEqual(synthese([{ id: "x", texte: "" }]), []);
});

test("le résumé d'un thème compte les écarts au lieu d'additionner des unités", () => {
  const phrase = resumeEcarts(
    [
      { libelle: "cambriolages", ecart: 38 },
      { libelle: "vols de véhicules", ecart: 12 },
      { libelle: "coups et blessures", ecart: -60 },
      { libelle: "vols sans violence", ecart: 2 },
    ],
    "son département",
  );
  assert.equal(
    phrase,
    "Sur 4 indicateurs comparés à son département : 2 au-dessus, 1 en dessous," +
      " 1 au niveau. Écart le plus marqué : coups et blessures, −60 %.",
  );
});

test("un thème d'un seul indicateur comparable ne se résume pas : ce serait le répéter", () => {
  assert.equal(resumeEcarts([{ libelle: "a", ecart: 40 }], "la France"), "");
  assert.equal(resumeEcarts([], "la France"), "");
});

test("un écart non fini est écarté du compte plutôt que de le fausser", () => {
  const phrase = resumeEcarts(
    [
      { libelle: "a", ecart: 40 },
      { libelle: "b", ecart: Number.POSITIVE_INFINITY },
      { libelle: "c", ecart: -30 },
    ],
    "la France",
  );
  assert.match(phrase, /^Sur 2 indicateurs comparés à la France : 1 au-dessus, 1 en dessous\./);
});

test("au-delà de 100 %, l'écart s'arrondit à la dizaine : la précision serait fausse", () => {
  assert.match(
    resumeEcarts(
      [
        { libelle: "a", ecart: 337 },
        { libelle: "b", ecart: 4 },
      ],
      "la France",
    ),
    /Écart le plus marqué : a, \+340 %\./,
  );
});

test("un thème où rien ne s'écarte le dit sans désigner de champion", () => {
  const phrase = resumeEcarts(
    [
      { libelle: "a", ecart: 2 },
      { libelle: "b", ecart: -3 },
    ],
    "sa région",
  );
  assert.equal(phrase, "Sur 2 indicateurs comparés à sa région : 2 au niveau.");
});
