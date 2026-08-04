import test from "node:test";
import assert from "node:assert/strict";

import { DERIVES, indicateursDerives, seriesDerivees } from "./derives.ts";
import type { Indicateur } from "./donnees.ts";

const trouve = (id: string) => DERIVES.find((d) => d.id === id)!;

test("la capacité de désendettement compte des années d'épargne", () => {
  const series = {
    ofgl_encours_dette: { "2024": 8_000_000 },
    ofgl_epargne_brute: { "2024": 1_000_000 },
  };
  assert.equal(seriesDerivees(series, "commune").derive_desendettement["2024"], 8);
});

test("une épargne nulle ou négative ne produit pas de capacité de désendettement", () => {
  // Ce n'est pas un remboursement infiniment long : c'est un remboursement
  // impossible à ce rythme. Afficher « 10 000 ans » serait un chiffre, pas une
  // information.
  for (const epargne of [0, -50_000]) {
    const series = {
      ofgl_encours_dette: { "2024": 8_000_000 },
      ofgl_epargne_brute: { "2024": epargne },
    };
    assert.equal(seriesDerivees(series, "commune").derive_desendettement, undefined);
  }
});

test("un taux d'épargne négatif s'affiche : la collectivité dépense plus qu'elle n'encaisse", () => {
  const series = {
    ofgl_epargne_brute: { "2024": -20_000 },
    ofgl_recettes_fonctionnement: { "2024": 400_000 },
  };
  assert.equal(seriesDerivees(series, "commune").derive_taux_epargne["2024"], -5);
});

test("un exercice où une entrée manque ne produit rien : pas de trou comblé", () => {
  const series = {
    ofgl_encours_dette: { "2023": 1_000, "2024": 2_000 },
    ofgl_epargne_brute: { "2024": 500 },
  };
  const derivees = seriesDerivees(series, "commune");
  assert.deepEqual(Object.keys(derivees.derive_desendettement), ["2024"]);
});

test("les agrégats de délinquance somment des faits et divisent par une seule population", () => {
  const series = {
    ssmsi_cambriolages_nombre: { "2024": 350 },
    ssmsi_vols_vehicules_nombre: { "2024": 150 },
    ofgl_population_reference: { "2024": 100_000 },
  };
  // 500 faits pour 100 000 habitants = 5 pour mille.
  assert.equal(seriesDerivees(series, "commune").derive_atteintes_biens["2024"], 5);
});

test("il manque un phénomène : l'agrégat de délinquance ne sort pas plutôt que de sous-compter", () => {
  const series = {
    ssmsi_cambriolages_nombre: { "2024": 100 },
    ofgl_population_reference: { "2024": 100_000 },
  };
  assert.equal(seriesDerivees(series, "commune").derive_atteintes_biens, undefined);
});

test("un agrégat ne réunit que des classes comptées de la même façon", () => {
  // Le SSMSI ne dénombre pas ses classes pareil : un cambriolage est un fait,
  // une violence est une victime, un stupéfiant est une personne mise en cause.
  // Les vols sans violence sont publiés à toutes les mailles et pourraient
  // grossir l'agrégat des biens — mais la source les compte en victimes.
  const biens = trouve("derive_atteintes_biens");
  assert.ok(!biens.entrees.includes("ssmsi_vols_sans_violence_nombre"));
  assert.match(biens.definition_technique, /comptée en victimes et non en faits/);
  assert.match(trouve("derive_atteintes_personnes").libelle, /^Victimes de violences/);
  assert.match(trouve("derive_stupefiants").libelle, /^Personnes mises en cause/);
  // Aucun identifiant ne se retrouve dans deux familles.
  const familles = ["derive_atteintes_biens", "derive_atteintes_personnes", "derive_stupefiants"]
    .flatMap((id) => trouve(id).entrees)
    .filter((id) => id.startsWith("ssmsi_"));
  assert.equal(new Set(familles).size, familles.length);
});

test("les agrégats de délinquance ont la même composition à toutes les mailles", () => {
  // Le SSMSI publie seize phénomènes au département et six à la commune. Un
  // agrégat qui prendrait ce qui est disponible donnerait à Lyon et au Rhône
  // deux mesures différentes sous le même nom, comparées dans la même phrase.
  for (const id of ["derive_atteintes_biens", "derive_atteintes_personnes"]) {
    assert.deepEqual(trouve(id).niveaux, ["commune", "departement", "region"]);
  }
});

test("aucune division ne se tente sur un dénominateur nul", () => {
  const nulles = [
    ["derive_taux_epargne", { ofgl_epargne_brute: 10, ofgl_recettes_fonctionnement: 0 }],
    [
      "derive_effort_investissement",
      { ofgl_depenses_investissement: 10, ofgl_recettes_fonctionnement: 0 },
    ],
    [
      "derive_charge_dette_sur_impots",
      { etat_charge_dette: 10, etat_recettes_fiscales: 0 },
    ],
    [
      "derive_atteintes_biens",
      { ssmsi_cambriolages_nombre: 1, ssmsi_vols_vehicules_nombre: 1, ofgl_population_reference: 0 },
    ],
  ] as const;
  for (const [id, entrees] of nulles) {
    assert.equal(trouve(id).calcul(entrees as Record<string, number>), null, id);
  }
});

test("la part hors commune du foncier est une différence de taux, pas une part", () => {
  const series = {
    dgfip_taux_tfb_global: { "2024": 35.2 },
    dgfip_taux_tfb_commune: { "2024": 18.7 },
  };
  const valeur = seriesDerivees(series, "commune").derive_part_non_communale_tfb["2024"];
  assert.equal(Math.round(valeur * 10) / 10, 16.5);
});

test("la dette locale se dit en mois de niveau de vie médian", () => {
  const series = {
    ofgl_encours_dette: { "2024": 1_000_000 },
    ofgl_population_reference: { "2024": 1_000 },
    insee_niveau_vie_median: { "2024": 24_000 },
  };
  // 1 000 € par habitant sur 24 000 € par an = un demi-mois.
  assert.equal(seriesDerivees(series, "commune").derive_dette_locale_en_revenu["2024"], 0.5);
});

test("un calcul ne s'applique qu'aux mailles qu'il déclare", () => {
  const series = {
    dgcl_dotation_globale_fonctionnement: { "2024": 100 },
    ofgl_recettes_fonctionnement: { "2024": 1_000 },
  };
  assert.ok(seriesDerivees(series, "commune").derive_part_dgf);
  assert.equal(seriesDerivees(series, "region").derive_part_dgf, undefined);
});

const fiche = (id: string, niveaux: string[], periodes: string[]): Indicateur => ({
  id,
  libelle: id,
  unite: "EUR",
  theme: "finances_locales",
  sommable: true,
  cadre_comptable: null,
  niveaux,
  definition: "",
  definition_technique: "",
  formule: "",
  confiance: "observed",
  badges: [],
  jeu: "ofgl-communes",
  periodes,
});

test("un calcul dont une entrée manque au catalogue n'entre pas au catalogue", () => {
  const catalogue = [fiche("ofgl_encours_dette", ["commune"], ["2024"])];
  const ids = indicateursDerives(catalogue).map((i) => i.id);
  assert.ok(!ids.includes("derive_desendettement"));
});

test("un calcul n'annonce que les millésimes et les mailles communs à ses entrées", () => {
  const catalogue = [
    fiche("ofgl_encours_dette", ["commune", "departement"], ["2022", "2023", "2024"]),
    fiche("ofgl_epargne_brute", ["commune"], ["2023", "2024"]),
  ];
  const derive = indicateursDerives(catalogue).find((i) => i.id === "derive_desendettement")!;
  assert.deepEqual(derive.periodes, ["2023", "2024"]);
  assert.deepEqual(derive.niveaux, ["commune"]);
});

test("un indicateur calculé ne s'additionne pas et se dit calculé", () => {
  const catalogue = [
    fiche("ofgl_encours_dette", ["commune"], ["2024"]),
    fiche("ofgl_epargne_brute", ["commune"], ["2024"]),
  ];
  const derive = indicateursDerives(catalogue)[0];
  assert.equal(derive.sommable, false);
  assert.deepEqual(derive.badges, ["Calculé par ce site"]);
  // Le jeu de la première entrée : la source reste nommée, et les règles de
  // comparabilité attachées au jeu continuent de s'appliquer au calcul.
  assert.equal(derive.jeu, "ofgl-communes");
});

test("chaque calcul porte une définition, une définition technique et une formule", () => {
  for (const derive of DERIVES) {
    assert.ok(derive.definition.length > 60, derive.id);
    assert.ok(derive.definition_technique.length > 60, derive.id);
    assert.ok(derive.formule.length > 5, derive.id);
  }
});

test("les infractions révélées par l'activité des services le disent", () => {
  // Un chiffre élevé de stupéfiants peut signaler plus de contrôles, pas plus
  // de trafic. Le taire ferait lire l'activité policière comme de la
  // délinquance.
  const derive = trouve("derive_stupefiants");
  assert.match(derive.definition, /révélées par l'activité des services/);
  assert.match(derive.definition, /ni des faits ni des condamnations/);
  assert.ok(!derive.niveaux.includes("commune"));
});

test("un calcul en attente de sa donnée ne s'affiche pas, et s'affichera seul", () => {
  // La part des salaires attend l'agrégat « Frais de personnel », ajouté au
  // connecteur mais pas encore chargé : tant qu'il n'est pas au catalogue, le
  // calcul n'y entre pas ; le jour où il arrive, rien de plus n'est à faire.
  const sans = [fiche("ofgl_depenses_fonctionnement", ["commune"], ["2024"])];
  assert.ok(!indicateursDerives(sans).some((i) => i.id === "derive_rigidite"));
  const avec = [...sans, fiche("ofgl_frais_personnel", ["commune"], ["2024"])];
  assert.ok(indicateursDerives(avec).some((i) => i.id === "derive_rigidite"));
});
