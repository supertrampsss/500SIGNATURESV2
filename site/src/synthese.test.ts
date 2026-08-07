/**
 * Une phrase qui interprète un chiffre engage plus que le chiffre : elle doit
 * rester dans ce que la donnée porte, et se taire quand il n'y a rien à dire.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { compteEcarts, lecture, resumeEcarts, synthese, tendance, repereComparable } from "./synthese.ts";

const euros = (v: number) => `${Math.round(v)} €`;

test("la lecture situe par rapport au premier repère disponible", () => {
  // Le signe porte le sens : « +16 % vs » se lit d'un coup d'œil là où
  // « 16 % au-dessus de » se lisait en deux temps.
  assert.equal(
    lecture(866, [{ libelle: "la médiane nationale", valeur: 749 }], euros),
    "+16 % vs la médiane nationale (749 €).",
  );
  assert.equal(
    lecture(500, [{ libelle: "sa région", valeur: 1000 }], euros),
    "−50 % vs sa région (1000 €).",
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
  // Des noms, plus aucun décompte : « 2 au-dessus, 1 en dessous, 1 au
  // niveau » annonçait qu'il y avait quelque chose à voir sans dire quoi.
  assert.equal(
    phrase,
    "Vs son département : coups et blessures −60 %, cambriolages +38 %," +
      " vols de véhicules +12 %.",
  );
});

test("le résumé s'arrête à trois noms : au-delà, c'est une liste", () => {
  const phrase = resumeEcarts(
    [
      { libelle: "un", ecart: 90 },
      { libelle: "deux", ecart: -80 },
      { libelle: "trois", ecart: 70 },
      { libelle: "quatre", ecart: -60 },
      { libelle: "cinq", ecart: 50 },
    ],
    "la France",
  );
  assert.equal(phrase, "Vs la France : un +90 %, deux −80 %, trois +70 %.");
  assert.doesNotMatch(phrase, /quatre/);
});

test("un seul écart marquant se nomme quand même : c'est lui qu'on cherche", () => {
  assert.equal(resumeEcarts([{ libelle: "a", ecart: 40 }], "la France"), "Vs la France : a +40 %.");
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
  // L'infini ne se nomme pas ; les deux écarts réels, si.
  assert.equal(phrase, "Vs la France : a +40 %, c −30 %.");
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
    /Vs la France : a \+340 %\./,
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
  // Rien de marquant, rien d'écrit : « 2 au niveau » occupait une ligne pour
  // dire qu'il n'y avait rien à dire.
  assert.equal(phrase, "");
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
  assert.match(lecture(-2, [{ libelle: "la France", valeur: -1 }], pourcent), /−100 % vs la France/);
});

test("l'ouverture nomme les deux écarts les plus marqués, pas un décompte", () => {
  // « 13 des 15 indicateurs au-dessus de son département » ne disait pas
  // lesquels — le seul renseignement qu'on venait chercher.
  const ecarts = [
    { libelle: "cambriolages", ecart: 38 },
    { libelle: "vols de véhicules", ecart: 12 },
    { libelle: "coups et blessures", ecart: -60 },
    { libelle: "vols sans violence", ecart: 2 },
  ];
  assert.equal(
    compteEcarts(ecarts, "son département"),
    "coups et blessures −60 %, cambriolages +38 % vs son département.",
  );
});

test("deux écarts opposés se nomment tous deux ; rien de marquant, rien d'écrit", () => {
  assert.equal(
    compteEcarts(
      [
        { libelle: "a", ecart: 40 },
        { libelle: "b", ecart: -40 },
      ],
      "sa région",
    ),
    "a +40 %, b −40 % vs sa région.",
  );
  assert.equal(
    compteEcarts(
      [
        { libelle: "a", ecart: 2 },
        { libelle: "b", ecart: -1 },
      ],
      "la France",
    ),
    "",
  );
});

test("un repère cent fois plus petit ne compare pas, il dit que l'autre est nul", () => {
  // Constaté sur la publication du 4 août, et promu en titre du thème : la
  // médiane régionale des « emprunts hors gestion active de la dette » vaut
  // 0,13 € par habitant — plus de la moitié des communes n'empruntent rien —
  // et Bordeaux, à 339 € par habitant, ressortait « +254 040 % au-dessus ».
  // Le nombre est exact et ne dit rien : il mesure la petitesse du
  // dénominateur, pas la position de la commune.
  assert.equal(repereComparable(338.52, 0.1332), false);
  assert.equal(repereComparable(1372.7, 755.73), true);
  // La borne est le facteur cent, des deux côtés de l'échelle.
  assert.equal(repereComparable(100, 1), true);
  assert.equal(repereComparable(101, 1), false);
  assert.equal(repereComparable(-338, -0.13), false);
  // Un repère nul ne compare rien non plus.
  assert.equal(repereComparable(10, 0), false);

  const phrase = lecture(338.52, [{ libelle: "la médiane des communes de la région", valeur: 0.1332 }], (v) => `${v} €`);
  assert.match(phrase, /Sans commune mesure/);
  assert.doesNotMatch(phrase, /%/);
});
