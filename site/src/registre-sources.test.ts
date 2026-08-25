import assert from "node:assert/strict";
import { test } from "node:test";

import type { Analyse } from "./analyse-rendu.ts";
import type { Indicateur, Jeu } from "./donnees.ts";
import {
  construireRegistre,
  filtrerRegistre,
  indexerSources,
  lienSource,
  sourceIdPourUrl,
} from "./registre-sources.ts";

const JEU_INSEE: Jeu = {
  id: "insee-comptes",
  titre: "Comptes nationaux",
  producteur: "Insee",
  licence: "Licence Ouverte",
  url: "https://insee.fr/source#publication",
  extraction: "2026-08-20",
};

const INDICATEUR_DEFICIT = {
  id: "deficit",
  libelle: "Déficit public",
  unite: "EUR",
  theme: "finances",
  sommable: false,
  cadre_comptable: null,
  definition: "Solde public.",
  definition_technique: "Besoin de financement.",
  formule: "recettes - dépenses",
  confiance: "publié",
  badges: [],
  jeu: "insee-comptes",
  niveaux: ["pays"],
  periodes: ["2025"],
} satisfies Indicateur;

function analyse(overrides: Partial<Analyse> = {}): Analyse {
  return {
    slug: "deficit-public",
    titre: "Le déficit public",
    type: "verification_chiffre",
    publie_le: "2026-08-21",
    themes: [],
    budgets_concernes: ["etat"],
    mise_en_avant: false,
    affirmation: {
      texte: "Affirmation.",
      auteur: null,
      date: null,
      source: { titre: "Déclaration", url: "https://exemple.test/declaration", consulte_le: "2026-08-21" },
    },
    verdict: { cran: "exact", phrase: "Exact." },
    chiffres: [],
    hypotheses: [],
    effets_indirects: [],
    sources: [{ titre: "Comptes nationaux", url: "https://insee.fr/source#tableau", consulte_le: "2026-08-21" }],
    simulateur: { budget: "", contrat: "", lecture: "" },
    mises_a_jour: [],
    verifie_contre: "",
    ...overrides,
  };
}

test("le registre fusionne une source primaire et liste ses pages", () => {
  const fiches = construireRegistre({
    jeux: [JEU_INSEE],
    indicateurs: [INDICATEUR_DEFICIT],
    analyses: [analyse()],
  });

  assert.equal(fiches.length, 1);
  const insee = fiches[0]!;
  assert.equal(insee.url, "https://insee.fr/source");
  assert.equal(insee.institution, "Insee");
  assert.equal(insee.serie, "deficit");
  assert.equal(insee.formule, "recettes - dépenses");
  assert.deepEqual(insee.pages, ["/analyses/deficit-public/", "/bilan"]);
  assert.match(insee.id, /^[a-z0-9-]+$/);
});

test("le registre garde des identifiants et un ordre stables malgré l'ordre des entrées", () => {
  const autreJeu: Jeu = {
    ...JEU_INSEE,
    id: "ofgl-finances",
    titre: "Finances locales",
    producteur: "OFGL",
    url: "https://ofgl.fr/finances",
  };
  const autreIndicateur: Indicateur = {
    ...INDICATEUR_DEFICIT,
    id: "depenses-locales",
    libelle: "Dépenses locales",
    jeu: "ofgl-finances",
    formule: "",
  };
  const entree = { jeux: [JEU_INSEE, autreJeu], indicateurs: [INDICATEUR_DEFICIT, autreIndicateur], analyses: [] };
  const inverse = { jeux: [...entree.jeux].reverse(), indicateurs: [...entree.indicateurs].reverse(), analyses: [] };

  const premier = construireRegistre(entree);
  const second = construireRegistre(inverse);

  assert.deepEqual(second, premier);
  assert.deepEqual(premier.map((fiche) => fiche.nom), ["Comptes nationaux", "Finances locales"]);
  assert.equal(premier.find((fiche) => fiche.serie === "depenses-locales")?.formule, undefined);
});

test("le registre distingue les estimations et les règles du jeu sans les faire passer pour publiées", () => {
  const estimation = analyse({
    slug: "estimation",
    sources: [{ titre: "Institut", url: "https://institut.test/note#p2", consulte_le: "2026-08-22" }],
    chiffres: [{ dit: "10", valeur: 10, registre: "estimation_externe", lecture: "Estimation." }],
  });
  const regle = analyse({
    slug: "regle",
    sources: [{ titre: "Hypothèse de jeu", url: "https://exemple.test/regle", consulte_le: "2026-08-22" }],
    chiffres: [{ dit: "20", valeur: 20, registre: "resultat_simulation", lecture: "Simulation." }],
    simulateur: { budget: "etat/1:1", contrat: "", lecture: "" },
  });

  const fiches = construireRegistre({ jeux: [], indicateurs: [], analyses: [estimation, regle] });

  assert.equal(fiches.find((fiche) => fiche.nom === "Institut")?.statut, "estimation");
  assert.equal(fiches.find((fiche) => fiche.nom === "Hypothèse de jeu")?.statut, "regle_jeu");
});

test("la recherche ignore les accents et le filtre de statut", () => {
  const fiches = construireRegistre({
    jeux: [JEU_INSEE],
    indicateurs: [INDICATEUR_DEFICIT],
    analyses: [],
  });

  assert.equal(filtrerRegistre(fiches, "deficit").length, 1);
  assert.equal(filtrerRegistre(fiches, "INSEE", "publie").length, 1);
  assert.equal(filtrerRegistre(fiches, "déficit", "estimation").length, 0);
});

test("des URLs canoniques distinctes gardent leur identifiant malgré un slug en collision", () => {
  const premiere: Jeu = { ...JEU_INSEE, id: "été", titre: "Première", url: "https://source.test/a-b" };
  const seconde: Jeu = { ...JEU_INSEE, id: "ete", titre: "Seconde", url: "https://source.test/a/b" };
  const entree = { jeux: [premiere, seconde], indicateurs: [], analyses: [] };
  const inverse = { ...entree, jeux: [...entree.jeux].reverse() };
  const parUrl = (fiches: ReturnType<typeof construireRegistre>) =>
    new Map(fiches.map((fiche) => [fiche.url, fiche.id]));

  const ids = parUrl(construireRegistre(entree));
  const idsInverses = parUrl(construireRegistre(inverse));

  assert.notEqual(ids.get("https://source.test/a-b"), ids.get("https://source.test/a/b"));
  assert.deepEqual(idsInverses, ids);
});

test("une source mixte conserve tous ses usages et le statut le plus prudent", () => {
  const source = "https://institut.test/note#annexe";
  const estimation = analyse({
    slug: "a-estimation",
    sources: [{ titre: "Estimation publiée", url: source, consulte_le: "2026-08-22" }],
    chiffres: [{ dit: "10", valeur: 10, registre: "estimation_externe", lecture: "Estimation." }],
  });
  const regle = analyse({
    slug: "z-regle",
    sources: [{ titre: "Règle publiée", url: "https://institut.test/note#methodologie", consulte_le: "2026-08-23" }],
    chiffres: [{ dit: "20", valeur: 20, registre: "hypothese", lecture: "Hypothèse." }],
  });
  const entree = { jeux: [], indicateurs: [], analyses: [estimation, regle] };

  const fiche = construireRegistre(entree)[0]!;
  const inverse = construireRegistre({ ...entree, analyses: [...entree.analyses].reverse() })[0]!;

  assert.equal(fiche.statut, "regle_jeu");
  assert.equal(fiche.nom, "Estimation publiée");
  assert.deepEqual(fiche.pages, ["/analyses/a-estimation/", "/analyses/z-regle/"]);
  assert.deepEqual(inverse, fiche);
});

test("le registre omet les métadonnées absentes d'une publication sans interrompre le pré-rendu", () => {
  const indicateurIncomplet = {
    ...INDICATEUR_DEFICIT,
    formule: undefined,
    niveaux: undefined,
    periodes: undefined,
  } as unknown as Indicateur;

  const fiche = construireRegistre({
    jeux: [JEU_INSEE],
    indicateurs: [indicateurIncomplet],
    analyses: [],
  })[0]!;

  assert.equal(fiche.formule, undefined);
  assert.equal(fiche.perimetre, undefined);
  assert.equal(fiche.millesime, undefined);
});

test("une provenance mène à la fiche exacte du registre", () => {
  const fiches = construireRegistre({
    jeux: [JEU_INSEE],
    indicateurs: [INDICATEUR_DEFICIT],
    analyses: [analyse()],
  });
  const index = indexerSources(fiches);
  const id = sourceIdPourUrl(index, "https://insee.fr/source#tableau");

  assert.ok(id);
  assert.equal(lienSource(id), `/sources/#${encodeURIComponent(id)}`);
  assert.equal(id, fiches[0]!.id);
});
