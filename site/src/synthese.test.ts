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

test("de part et d'autre de zéro, on pose les deux chiffres au lieu d'un faux écart", () => {
  // Solde de la Sécurité sociale : −0,2 % du PIB contre une médiane européenne
  // à +0,1 %. La formule donnait « 300 % en dessous » — un déficit n'est pas
  // trois fois un excédent, il en est le contraire.
  const pourcent = (v: number) => `${v} %`;
  assert.equal(
    lecture(-0.2, [{ libelle: "la médiane des pays européens", valeur: 0.1 }], pourcent),
    "Contre 0.1 % pour la médiane des pays européens.",
  );
  assert.equal(
    lecture(0.3, [{ libelle: "sa région", valeur: -0.5 }], pourcent),
    "Contre -0.5 % pour sa région.",
  );
  // Du même côté de zéro, deux valeurs négatives se comparent normalement.
  assert.match(lecture(-2, [{ libelle: "la France", valeur: -1 }], pourcent), /100 % .*dessous/);
});

test("l'écart le plus marqué n'est pas celui qu'on vient de citer", () => {
  const phrase = resumeEcarts(
    [
      { libelle: "cambriolages", ecart: 80 },
      { libelle: "vols de véhicules", ecart: 30 },
      { libelle: "violences", ecart: -12 },
    ],
    "son département",
    { sauf: "cambriolages" },
  );
  assert.match(phrase, /^Sur 3 indicateurs comparés à son département/);
  assert.match(phrase, /Écart le plus marqué : vols de véhicules, \+30 %\./);
});

test("écarté de tous les candidats, le champion disparaît plutôt que de se répéter", () => {
  const phrase = resumeEcarts(
    [
      { libelle: "a", ecart: 80 },
      { libelle: "a", ecart: 30 },
    ],
    "la France",
    { sauf: "a" },
  );
  assert.equal(phrase, "Sur 2 indicateurs comparés à la France : 2 au-dessus.");
});

test("le seuil de résumé est réglable : à deux indicateurs, un ensemble n'en est pas un", () => {
  const deux = [
    { libelle: "a", ecart: 40 },
    { libelle: "b", ecart: -30 },
  ];
  assert.equal(resumeEcarts(deux, "la France", { minimum: 3 }), "");
  assert.match(resumeEcarts(deux, "la France"), /^Sur 2 indicateurs/);
});
