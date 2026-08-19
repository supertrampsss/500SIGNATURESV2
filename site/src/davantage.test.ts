/**
 * « Davantage de données » : dix thèmes curés, pas les vingt-deux publiés.
 *
 * Quatre comportements à tenir, chacun son test : les thèmes hors liste
 * (finances locales, budget de l'État…) ne rendent rien ; salariés et
 * établissements par secteur fusionnent en un ratio ; sécurité ne garde que
 * les taux ayant une valeur au dernier exercice du thème ; et la vie
 * associative nomme chaque association quand la liste nominative est
 * chargée, sinon garde son seul agrégat.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { rendu } from "./davantage.ts";

const CATALOGUE = [
  // Thème hors liste : ne doit jamais apparaître dans le rendu.
  { id: "ofgl_depenses_fonctionnement", libelle: "Dépenses de fonctionnement", theme: "finances_locales", unite: "EUR" },

  { id: "insee_population_municipale", libelle: "Population municipale", theme: "population", unite: "count" },

  { id: "dgfip_ircom_foyers_fiscaux", libelle: "Foyers fiscaux", theme: "revenus", unite: "count" },
  { id: "dgfip_ircom_revenu_fiscal_reference", libelle: "Revenu fiscal de référence", theme: "revenus", unite: "EUR" },

  { id: "insee_diplome_cap_bep", libelle: "CAP ou BEP", theme: "diplomes", unite: "count" },
  { id: "insee_diplome_bac", libelle: "Baccalauréat", theme: "diplomes", unite: "count" },

  { id: "insee_actifs_occupes", libelle: "Actifs ayant un emploi", theme: "emploi", unite: "count" },
  { id: "insee_chomeurs_rp", libelle: "Chômeurs déclarés (recensement)", theme: "emploi", unite: "count" },
  { id: "insee_taux_chomage_localise", libelle: "Taux de chômage", theme: "emploi", unite: "percent" },

  { id: "insee_pcs_retraites", libelle: "Retraités", theme: "professions", unite: "count" },
  { id: "insee_pcs_ouvriers", libelle: "Ouvriers", theme: "professions", unite: "count" },

  { id: "insee_effectifs_salaries_industrie", libelle: "Industrie", theme: "secteurs_salaries", unite: "count" },
  { id: "insee_etablissements_employeurs_industrie", libelle: "Industrie", theme: "secteurs_etablissements", unite: "count" },
  { id: "insee_effectifs_salaries_construction", libelle: "Construction", theme: "secteurs_salaries", unite: "count" },
  { id: "insee_etablissements_employeurs_construction", libelle: "Construction", theme: "secteurs_etablissements", unite: "count" },

  { id: "insee_logements", libelle: "Logements", theme: "logement", unite: "count" },
  { id: "insee_residences_principales", libelle: "Résidences principales", theme: "logement", unite: "count" },
  { id: "insee_residences_secondaires", libelle: "Résidences secondaires et occasionnelles", theme: "logement", unite: "count" },
  { id: "rpls_logements_sociaux", libelle: "Logements sociaux", theme: "logement", unite: "count" },
  { id: "anil_loyer_appartement", libelle: "Loyer d'annonce des appartements, au m²", theme: "logement", unite: "€/m²/mois" },
  { id: "insee_logements_vacants", libelle: "Logements vacants", theme: "logement", unite: "count" },

  { id: "ssmsi_vols_sans_violence_taux", libelle: "Vols sans violence", theme: "securite", unite: "pour_1000_habitants" },
  { id: "ssmsi_vols_sans_violence_nombre", libelle: "Vols sans violence, nombre de victimes entendues", theme: "securite", unite: "count" },
  { id: "ssmsi_cambriolages_taux", libelle: "Cambriolages de logement", theme: "securite", unite: "pour_1000_logements" },
  { id: "ssmsi_vols_dans_vehicules_taux", libelle: "Vols dans les véhicules", theme: "securite", unite: "pour_1000_habitants" },

  { id: "insee_campings_emplacements", libelle: "Emplacements de camping", theme: "tourisme", unite: "count" },
  { id: "insee_hotels", libelle: "Hôtels", theme: "tourisme", unite: "count" },

  { id: "etat_subventions_associations", libelle: "Subventions de l'État aux associations", theme: "vie_associative", unite: "EUR" },
  { id: "etat_subventions_associations_etablissements", libelle: "Établissements associatifs subventionnés par l'État", theme: "vie_associative", unite: "count" },
] as never[];

const TERRITOIRE = {
  nom: "Testville",
  series: {
    ofgl_depenses_fonctionnement: { "2025": 1_000_000 },
    insee_population_municipale: { "2019": 3_800, "2022": 4_045 },
    dgfip_ircom_foyers_fiscaux: { "2024": 2_787 },
    dgfip_ircom_revenu_fiscal_reference: { "2024": 86_900_000 },
    insee_diplome_cap_bep: { "2023": 636 },
    insee_diplome_bac: { "2023": 441 },
    insee_actifs_occupes: { "2023": 1_299 },
    insee_chomeurs_rp: { "2023": 228 },
    insee_taux_chomage_localise: { "2023": 14.9 },
    insee_pcs_retraites: { "2023": 1_542 },
    insee_pcs_ouvriers: { "2023": 346 },
    insee_effectifs_salaries_industrie: { "2024": 41 },
    insee_etablissements_employeurs_industrie: { "2024": 8 },
    insee_effectifs_salaries_construction: { "2024": 47 },
    insee_etablissements_employeurs_construction: { "2024": 14 },
    insee_logements: { "2023": 4_035 },
    insee_residences_principales: { "2023": 2_030 },
    insee_residences_secondaires: { "2023": 1_775 },
    rpls_logements_sociaux: { "2025": 91 },
    anil_loyer_appartement: { "2025": 13.5 },
    insee_logements_vacants: { "2023": 100 },
    // Vols sans violence : taux à jour, décompte brut à jour aussi (doit être
    // écarté, l'unité n'étant pas un taux).
    ssmsi_vols_sans_violence_taux: { "2024": 8.7, "2025": 7.2 },
    ssmsi_vols_sans_violence_nombre: { "2025": 29 },
    ssmsi_cambriolages_taux: { "2024": 2.8, "2025": 1.8 },
    // Vols dans les véhicules : plus aucune valeur au dernier exercice du
    // thème (2025) — doit être écarté par la garde « là où ya des données ».
    ssmsi_vols_dans_vehicules_taux: { "2022": 3.2 },
    insee_campings_emplacements: { "2026": 2_228 },
    insee_hotels: { "2026": 2 },
    etat_subventions_associations: { "2021": 3_000 },
    etat_subventions_associations_etablissements: { "2021": 1 },
  },
} as never;

test("un thème hors liste ne rend rien : finances locales ne s'invite pas", () => {
  const html = rendu(TERRITOIRE, CATALOGUE, undefined);
  assert.doesNotMatch(html, /Dépenses de fonctionnement/);
  assert.doesNotMatch(html, /finances_locales/);
});

test("dix thèmes rendus, dans l'ordre, un seul bloc pour les deux tableaux de secteurs", () => {
  const html = rendu(TERRITOIRE, CATALOGUE, undefined);
  const ids = [
    "vie-associative",
    "population",
    "revenus",
    "diplomes",
    "emploi",
    "professions",
    "secteurs",
    "logement",
    "securite",
    "tourisme",
  ];
  let dernierIndex = -1;
  for (const id of ids) {
    const motif = new RegExp(`id="davantage-${id}"`);
    assert.match(html, motif, `bloc ${id} absent`);
    const index = html.search(motif);
    assert.ok(index > dernierIndex, `bloc ${id} pas dans l'ordre attendu`);
    dernierIndex = index;
  }
  // Un seul bloc porte les secteurs — pas un tableau « salariés » et un
  // tableau « établissements » séparés.
  assert.equal((html.match(/Salariés par établissement/g) ?? []).length, 1);
});

test("le ratio salariés par établissement se calcule secteur par secteur, le plus fort en tête", () => {
  const html = rendu(TERRITOIRE, CATALOGUE, undefined);
  const bloc = html.slice(html.indexOf('id="davantage-secteurs"'));
  // Industrie : 41 / 8 = 5,1 ; Construction : 47 / 14 = 3,4. Industrie
  // d'abord — les barres de magnitude trient par valeur décroissante.
  const posIndustrie = bloc.indexOf("Industrie");
  const posConstruction = bloc.indexOf("Construction");
  assert.ok(posIndustrie > -1 && posConstruction > -1);
  assert.ok(posIndustrie < posConstruction, "Industrie (5,1) doit précéder Construction (3,4)");
  assert.match(bloc, /5,1/);
  assert.match(bloc, /3,4/);
});

test("logement ne garde que les cinq indicateurs retenus, jamais les logements vacants", () => {
  const html = rendu(TERRITOIRE, CATALOGUE, undefined);
  const bloc = html.slice(html.indexOf('id="davantage-logement"'), html.indexOf('id="davantage-securite"'));
  assert.match(bloc, /Logements sociaux/);
  assert.match(bloc, /Résidences secondaires/);
  assert.doesNotMatch(bloc, /Logements vacants/);
});

test("sécurité ne garde que les taux ayant une valeur au dernier exercice du thème", () => {
  const html = rendu(TERRITOIRE, CATALOGUE, undefined);
  const bloc = html.slice(html.indexOf('id="davantage-securite"'), html.indexOf('id="davantage-tourisme"'));
  // Le dernier exercice du thème est 2025 (porté par vols sans violence et
  // cambriolages) : vols dans les véhicules, qui s'arrête en 2022, est écarté.
  assert.match(bloc, /Vols sans violence/);
  assert.match(bloc, /Cambriolages de logement/);
  assert.doesNotMatch(bloc, /Vols dans les véhicules/);
  // Le décompte brut, qui double le taux sans rien ajouter, n'est pas repris.
  assert.doesNotMatch(bloc, /nombre de victimes entendues/);
});

test("vie associative nomme chaque association quand la liste nominative est chargée", () => {
  const html = rendu(TERRITOIRE, CATALOGUE, {
    exercice: "2021",
    beneficiaires: [{ siren: "825223654", nom: "TAKE IT EASY AGENCY", programme: "363", objet: "Relance culturelle", montant: 3000 }],
  } as never);
  const bloc = html.slice(html.indexOf('id="davantage-vie-associative"'), html.indexOf('id="davantage-population"'));
  assert.match(bloc, /TAKE IT EASY AGENCY/);
  assert.match(bloc, /3\s?000\s?€|3 000\s?€/);
  assert.doesNotMatch(bloc, /davantage__carte/, "avec une liste nominative, plus d'agrégat en cartes");
});

test("vie associative garde son agrégat sans liste nominative chargée", () => {
  const html = rendu(TERRITOIRE, CATALOGUE, undefined);
  const bloc = html.slice(html.indexOf('id="davantage-vie-associative"'), html.indexOf('id="davantage-population"'));
  assert.doesNotMatch(bloc, /davantage__assoc/);
  assert.match(bloc, /davantage__carte/);
});

test("une association sans nom nominatif publié quand le lot ne porte aucun bénéficiaire pour ce territoire", () => {
  const html = rendu(TERRITOIRE, CATALOGUE, { exercice: "2021", beneficiaires: [] } as never);
  const bloc = html.slice(html.indexOf('id="davantage-vie-associative"'), html.indexOf('id="davantage-population"'));
  assert.doesNotMatch(bloc, /davantage__assoc/);
  assert.match(bloc, /davantage__carte/);
});

test("aucune valeur publiée pour un thème : pas de bloc, jamais un tableau vide", () => {
  const html = rendu({ nom: "Rien", series: {} } as never, CATALOGUE, undefined);
  assert.equal(html, "");
});

test("un indicateur en pourcentage se lit en note, jamais mêlé aux barres de magnitude", () => {
  const html = rendu(TERRITOIRE, CATALOGUE, undefined);
  const bloc = html.slice(html.indexOf('id="davantage-emploi"'), html.indexOf('id="davantage-professions"'));
  assert.match(bloc, /Taux de chômage : 14,9 %/);
});
