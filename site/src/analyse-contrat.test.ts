import assert from "node:assert/strict";
import { test } from "node:test";

import {
  sourceDePreuve,
  validerDossierAnalyse,
  type DossierAnalyse,
  type SourceAnalyse,
} from "./analyse-contrat.ts";
import { contratDossierAnalyse, rendu, type Analyse } from "./analyse-rendu.ts";

const SOURCES: SourceAnalyse[] = [
  {
    id: "eurostat-mix",
    titre: "Eurostat, bilan électrique",
    url: "https://ec.europa.eu/eurostat/mix",
    consulteLe: "2026-08-30",
  },
  {
    id: "eurostat-prix",
    titre: "Eurostat, prix des ménages",
    url: "https://ec.europa.eu/eurostat/prix",
    consulteLe: "2026-08-30",
  },
];

function dossier(overrides: Partial<DossierAnalyse> = {}): DossierAnalyse {
  return {
    chapo: "Une chronologie sourcée qui sépare production et prix.",
    sommaire: ["chronologie", "comparaison"],
    series: [
      {
        id: "part-nucleaire",
        libelle: "Part du nucléaire",
        unit: "percent",
        definition: "Production nucléaire rapportée à la production électrique brute.",
        sourceId: "eurostat-mix",
        observations: [
          { period: "2022", value: 6.3 },
          { period: "2023", value: 1.4, qualityFlags: ["provisional"] },
        ],
      },
      {
        id: "prix-electricite",
        libelle: "Prix de l'électricité des ménages",
        unit: "EUR_per_kWh",
        definition: "Prix TTC de la tranche de consommation DC.",
        sourceId: "eurostat-prix",
        observations: [{ period: "2023-S2", value: 0.402 }],
      },
    ],
    preuves: [
      {
        id: "nucleaire-2023",
        libelle: "Part nucléaire en 2023",
        value: 1.4,
        unit: "percent",
        period: "2023",
        definition: "Production nucléaire rapportée à la production électrique brute.",
        sourceId: "eurostat-mix",
        seriesId: "part-nucleaire",
        qualityFlags: ["provisional"],
      },
      {
        id: "prix-2023-s2",
        libelle: "Prix des ménages au second semestre 2023",
        value: 0.402,
        unit: "EUR_per_kWh",
        period: "2023-S2",
        definition: "Prix TTC de la tranche de consommation DC.",
        sourceId: "eurostat-prix",
        seriesId: "prix-electricite",
      },
      {
        id: "instantane-enl",
        libelle: "Âge publié dans une enquête logement",
        value: 36,
        unit: "years",
        period: "1998-2001",
        definition: "Âge moyen à la première acquisition sous la définition de la publication.",
        sourceId: "eurostat-prix",
        comparableGroup: "enl-2002-definition",
        qualityFlags: ["not-directly-comparable"],
      },
    ],
    visualisations: [
      {
        id: "trajectoires",
        type: "line",
        titre: "Production et prix restent sur deux axes explicites",
        resume: "La part nucléaire baisse tandis que le prix suit une autre unité.",
        seriesIds: ["part-nucleaire", "prix-electricite"],
        axes: [
          { id: "part", unit: "percent", seriesIds: ["part-nucleaire"] },
          { id: "prix", unit: "EUR_per_kWh", seriesIds: ["prix-electricite"] },
        ],
      },
      {
        id: "instantanes",
        type: "snapshot_table",
        titre: "Instantanés publiés",
        resume: "Chaque ligne garde sa définition et son avertissement de comparabilité.",
        preuveIds: ["instantane-enl"],
      },
    ],
    sections: [
      {
        id: "chronologie",
        titre: "La chronologie observée",
        paragraphes: ["Les séries gardent leurs unités et leurs périodes propres."],
        preuveIds: ["nucleaire-2023"],
        visualisationIds: ["trajectoires"],
      },
      {
        id: "comparaison",
        titre: "Ce qui est comparable",
        paragraphes: ["Les instantanés ne sont pas transformés en série annuelle."],
        preuveIds: ["prix-2023-s2", "instantane-enl"],
        visualisationIds: ["instantanes"],
      },
    ],
    limitations: [
      "Une chronologie commune ne démontre pas à elle seule une causalité.",
      "Les instantanés de définitions différentes ne sont pas interpolés.",
    ],
    ...overrides,
  };
}

test("un dossier valide résout chaque preuve vers sa propre source, jamais la première", () => {
  const valide = validerDossierAnalyse(dossier(), SOURCES);
  assert.ok(valide);
  assert.equal(sourceDePreuve(valide, "nucleaire-2023").id, "eurostat-mix");
  assert.equal(sourceDePreuve(valide, "prix-2023-s2").id, "eurostat-prix");
  assert.notEqual(sourceDePreuve(valide, "prix-2023-s2").id, SOURCES[0]!.id);
});

test("un ancien dossier sans contenu long reste accepté tel quel", () => {
  assert.equal(validerDossierAnalyse(undefined, SOURCES), null);
});

test("les identifiants de source sont locaux, uniques et obligatoirement résolus", () => {
  assert.throws(
    () => validerDossierAnalyse(dossier(), [...SOURCES, { ...SOURCES[1]! }]),
    /sources\[2\]\.id.*dupliqué/,
  );
  assert.throws(
    () =>
      validerDossierAnalyse(
        dossier({ preuves: [{ ...dossier().preuves[0]!, sourceId: "source-absente" }] }),
        SOURCES,
      ),
    /preuves\[0\]\.sourceId.*source-absente.*introuvable/,
  );
  assert.throws(
    () =>
      validerDossierAnalyse(
        dossier({ series: [{ ...dossier().series[0]!, sourceId: "source-absente" }] }),
        SOURCES,
      ),
    /series\[0\]\.sourceId.*source-absente.*introuvable/,
  );
});

test("une preuve liée à une série vérifie période, valeur, unité, source et flags", () => {
  const originale = dossier().preuves[0]!;
  for (const [champ, preuve] of [
    ["period", { ...originale, period: "2024" }],
    ["value", { ...originale, value: 9.9 }],
    ["unit", { ...originale, unit: "EUR" }],
    ["sourceId", { ...originale, sourceId: "eurostat-prix" }],
    ["qualityFlags", { ...originale, qualityFlags: ["break"] }],
  ] as const) {
    assert.throws(
      () => validerDossierAnalyse(dossier({ preuves: [preuve] }), SOURCES),
      new RegExp(`preuves\\[0\\].*${champ}`),
      champ,
    );
  }
  assert.throws(
    () =>
      validerDossierAnalyse(
        dossier({ preuves: [{ ...originale, seriesId: "serie-absente" }] }),
        SOURCES,
      ),
    /preuves\[0\]\.seriesId.*serie-absente.*introuvable/,
  );
});

test("deux unités dans une même visualisation exigent des axes exhaustifs et cohérents", () => {
  const mixte = dossier().visualisations[0]!;
  assert.throws(
    () => validerDossierAnalyse(dossier({ visualisations: [{ ...mixte, axes: undefined }] }), SOURCES),
    /visualisations\[0\]\.axes.*unités/,
  );
  assert.throws(
    () =>
      validerDossierAnalyse(
        dossier({
          visualisations: [
            {
              ...mixte,
              axes: [
                { id: "part", unit: "percent", seriesIds: ["part-nucleaire"] },
                { id: "prix", unit: "EUR", seriesIds: ["prix-electricite"] },
              ],
            },
          ],
        }),
        SOURCES,
      ),
    /visualisations\[0\]\.axes\[1\]\.unit.*EUR_per_kWh/,
  );
});

test("sections, sommaire et visualisations ne peuvent référencer un identifiant absent", () => {
  assert.throws(
    () => validerDossierAnalyse(dossier({ sommaire: ["section-absente"] }), SOURCES),
    /sommaire\[0\].*section-absente.*introuvable/,
  );
  assert.throws(
    () =>
      validerDossierAnalyse(
        dossier({ sections: [{ ...dossier().sections[0]!, preuveIds: ["preuve-absente"] }] }),
        SOURCES,
      ),
    /sections\[0\]\.preuveIds\[0\].*preuve-absente.*introuvable/,
  );
  assert.throws(
    () =>
      validerDossierAnalyse(
        dossier({ sections: [{ ...dossier().sections[0]!, id: "Pas une ancre stable !" }] }),
        SOURCES,
      ),
    /sections\[0\]\.id.*ancre stable/,
  );
});

function analyseHistorique(overrides: Partial<Analyse> = {}): Analyse {
  return {
    slug: "historique",
    titre: "Dossier historique",
    type: "decryptage",
    publie_le: "2026-01-01",
    themes: ["budget_etat"],
    budgets_concernes: ["etat"],
    mise_en_avant: false,
    affirmation: {
      texte: "Une affirmation.",
      auteur: null,
      date: null,
      source: { titre: "Source", url: "https://exemple.test", consulte_le: "2026-01-01" },
    },
    verdict: { cran: "exact", phrase: "Le chiffre est publié." },
    chiffres: [
      {
        dit: "un chiffre",
        valeur: 1,
        registre: "donnee_officielle",
        lecture: "Une donnée officielle.",
      },
    ],
    hypotheses: [],
    effets_indirects: [],
    sources: [{ titre: "Source", url: "https://exemple.test", consulte_le: "2026-01-01" }],
    simulateur: { budget: "", contrat: "", lecture: "Aucun réglage." },
    mises_a_jour: [],
    verifie_contre: "",
    ...overrides,
  };
}

test("analyse-rendu garde les anciens JSON et refuse un contrat long incomplet", () => {
  const historique = analyseHistorique();
  assert.equal(contratDossierAnalyse(historique), null);
  assert.match(rendu(historique, []), /Dossier historique/);

  const longue = analyseHistorique({
    sources: SOURCES.map(({ id, titre, url, consulteLe }) => ({
      id,
      titre,
      url,
      consulte_le: consulteLe,
    })),
    dossier: dossier(),
  });
  assert.equal(contratDossierAnalyse(longue)?.dossier.chapo, dossier().chapo);

  const invalide = analyseHistorique({
    sources: SOURCES.map(({ id, titre, url, consulteLe }) => ({
      id,
      titre,
      url,
      consulte_le: consulteLe,
    })),
    dossier: dossier({ limitations: [] }),
  });
  assert.throws(() => rendu(invalide, []), /limitations.*non vide/);
});
