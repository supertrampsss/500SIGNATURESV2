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

  { id: "insee_taux_pauvrete", libelle: "Taux de pauvreté", theme: "revenus", unite: "percent" },
  { id: "cnaf_foyers_rsa", libelle: "Foyers allocataires du RSA", theme: "revenus", unite: "count" },

  { id: "insee_population_15_64_ans", libelle: "Population de 15 à 64 ans", theme: "emploi", unite: "count" },
  { id: "insee_actifs", libelle: "Population active", theme: "emploi", unite: "count" },
  { id: "insee_inactifs", libelle: "Inactifs de 15 à 64 ans", theme: "emploi", unite: "count" },
  { id: "insee_actifs_occupes", libelle: "Actifs ayant un emploi", theme: "emploi", unite: "count" },
  { id: "insee_chomeurs_rp", libelle: "Chômeurs déclarés (recensement)", theme: "emploi", unite: "count" },
  { id: "dares_defm_abc", libelle: "Inscrits à France Travail (catégories A, B, C)", theme: "emploi", unite: "count" },
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
    insee_taux_pauvrete: { "2021": 12.3 },
    cnaf_foyers_rsa: { "2024": 225 },
    insee_population_15_64_ans: { "2023": 2_400 },
    insee_actifs: { "2023": 1_527 },
    insee_inactifs: { "2023": 873 },
    insee_actifs_occupes: { "2023": 1_299 },
    insee_chomeurs_rp: { "2023": 228 },
    dares_defm_abc: { "2024": 310 },
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
    // écarté, l'unité n'étant pas un taux). 2019 sert de référence d'évolution.
    ssmsi_vols_sans_violence_taux: { "2019": 9.4, "2024": 8.7, "2025": 7.2 },
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

test("sept blocs rendus, dans l'ordre, un seul pour population/revenus/diplômes et un seul pour les deux tableaux de secteurs", () => {
  const html = rendu(TERRITOIRE, CATALOGUE, undefined);
  const ids = ["vie-associative", "population", "emploi", "professions", "secteurs", "logement", "securite", "tourisme"];
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
  // Un seul bloc « davantage-population » porte les trois anciens thèmes —
  // « davantage-revenus » et « davantage-diplomes » n'existent plus.
  assert.doesNotMatch(html, /id="davantage-revenus"/);
  assert.doesNotMatch(html, /id="davantage-diplomes"/);
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

test("un indicateur en pourcentage se lit en note, jamais mêlé aux tables de comptes", () => {
  const html = rendu(TERRITOIRE, CATALOGUE, undefined);
  const bloc = html.slice(html.indexOf('id="davantage-emploi"'), html.indexOf('id="davantage-professions"'));
  assert.match(bloc, /Taux de chômage : 14,9 %/);
});

test("emploi et chômage se lisent en deux tables groupées, jamais en barres à plat", () => {
  // Six comptes qui ne sont pas six magnitudes indépendantes : la population
  // 15-64 se partage en actifs/inactifs, les actifs en emploi/chômage — un
  // arbre, pas une liste. Une rangée de barres à plat le faisait lire comme
  // six catégories comparables en longueur, ce qu'aucune paire d'entre elles
  // n'est.
  const html = rendu(TERRITOIRE, CATALOGUE, undefined);
  const bloc = html.slice(html.indexOf('id="davantage-emploi"'), html.indexOf('id="davantage-professions"'));
  assert.doesNotMatch(bloc, /davantage__mag/);
  // Aucun des deux groupes ne porte de millésime, ni dans le titre ni par
  // ligne : demandé à retirer, le recensement (2023) et les inscriptions à
  // France Travail (2024) n'ayant de toute façon pas le même exercice.
  assert.match(bloc, /<h4>Population active<\/h4>/);
  assert.match(bloc, /Population de 15 à 64 ans/);
  assert.match(bloc, /Population active/);
  assert.match(bloc, /Inactifs de 15 à 64 ans/);
  assert.match(bloc, /<h4>Emploi et chômage<\/h4>/);
  assert.match(bloc, /Actifs ayant un emploi/);
  assert.match(bloc, /Chômeurs déclarés \(recensement\)/);
  assert.match(bloc, /Inscrits à France Travail \(catégories A, B, C\)/);
  assert.doesNotMatch(bloc, /davantage__exercice/);
});

test("le revenu fiscal de référence se lit par foyer, jamais en total", () => {
  // 86 900 000 € / 2 787 foyers = 31 180 € par foyer, arrondi à l'euro. Le
  // total en millions ne parle à personne : il ne doit apparaître nulle part.
  const html = rendu(TERRITOIRE, CATALOGUE, undefined);
  const bloc = html.slice(html.indexOf('id="davantage-population"'), html.indexOf('id="davantage-emploi"'));
  assert.match(bloc, /31\u202f180\u00a0€/);
  assert.match(bloc, /par foyer/);
  assert.doesNotMatch(bloc, /86,9\s?M€/);
});

test("la pauvreté vient sous les diplômes, dans le même bloc fusionné", () => {
  const html = rendu(TERRITOIRE, CATALOGUE, undefined);
  const bloc = html.slice(html.indexOf('id="davantage-population"'), html.indexOf('id="davantage-emploi"'));
  const posDiplomes = bloc.indexOf("Diplômes de la population");
  const posPauvrete = bloc.indexOf("Pauvreté");
  assert.ok(posDiplomes > -1 && posPauvrete > -1, "les deux titres doivent être présents");
  assert.ok(posPauvrete > posDiplomes, "la pauvreté doit venir après les diplômes");
  assert.match(bloc, /Taux de pauvreté/);
  assert.match(bloc, /Foyers allocataires du RSA/);
  // Chaque ligne de la table portait son propre exercice (2021, 2024…) : le
  // lecteur a jugé cette précision inutile, et elle cassait l'alignement de
  // la colonne des valeurs. La table de pauvreté n'a donc que deux colonnes,
  // comme celles des âges et des diplômes juste au-dessus.
  const pauvreteTable = bloc.slice(bloc.indexOf("<h4>Pauvreté</h4>"));
  assert.doesNotMatch(pauvreteTable, /davantage__exercice/);
});

test("population, revenus et diplômes se lisent en colonnes, jamais en barre de magnitude", () => {
  const html = rendu(TERRITOIRE, CATALOGUE, undefined);
  const bloc = html.slice(html.indexOf('id="davantage-population"'), html.indexOf('id="davantage-emploi"'));
  assert.doesNotMatch(bloc, /davantage__mag/);
  assert.match(bloc, /davantage__table/);
});

test("un compte n'a pas de décimale dans le tableau des diplômes", () => {
  const html = rendu(TERRITOIRE, CATALOGUE, undefined);
  const bloc = html.slice(html.indexOf('id="davantage-population"'), html.indexOf('id="davantage-emploi"'));
  assert.match(bloc, />636</);
  assert.doesNotMatch(bloc, /636,0/);
});

test("sécurité montre 2019, le dernier exercice et l'évolution en pourcentage", () => {
  const html = rendu(TERRITOIRE, CATALOGUE, undefined);
  const bloc = html.slice(html.indexOf('id="davantage-securite"'), html.indexOf('id="davantage-tourisme"'));
  assert.doesNotMatch(bloc, /davantage__mag/, "la sécurité se lit en table, plus en barres");
  assert.match(bloc, /<th>2019<\/th>/);
  // (7,2 − 9,4) / 9,4 = −23,4 %, la même formule de variation que le reste du
  // site — jamais un écart en points de ‰, qui ne se lisait pas.
  assert.match(bloc, /,4 ‰/);
  assert.match(bloc, /,4 %/);
  assert.doesNotMatch(bloc, /pts?</);
  // Cambriolages n'a pas de valeur 2019 dans le banc : l'absence se voit,
  // elle ne s'invente pas en variation nulle.
  const ligneCambriolages = bloc.slice(bloc.indexOf("Cambriolages"));
  assert.match(ligneCambriolages, /<td class="davantage__num">—<\/td>/);
  // « (logements) » ne s'écrit plus dans la cellule : elle est plus longue
  // que les autres de sa colonne et cassait l'alignement des chiffres. Le
  // libellé de la ligne et la légende sous le tableau portent déjà la
  // distinction.
  assert.match(ligneCambriolages, /,8 ‰/);
  assert.doesNotMatch(ligneCambriolages, /\(logements\)/);
});

test("un tableau de décimales aligne la virgule, pas seulement le bord droit", () => {
  // « 15,2 ‰ » et « 5,0 ‰ » alignés sur leur seul bord droit font tomber
  // leurs deux virgules à des endroits différents : c'est ce qui restait
  // « pas aligné » une fois même le format uniforme (pourcentage, sans
  // « (logements) »). La partie entière prend une largeur fixe, commune à
  // toute la colonne, mesurée sur sa plus longue valeur.
  const html = rendu(TERRITOIRE, CATALOGUE, undefined);
  const bloc = html.slice(html.indexOf('id="davantage-securite"'), html.indexOf('id="davantage-tourisme"'));
  // Vols sans violence, colonne 2025 : 7,2 ‰ — un seul chiffre entier.
  assert.match(
    bloc,
    /<span class="davantage__entier" style="width:1ch">7<\/span><span class="davantage__reste">,2 ‰<\/span>/,
  );
  // Colonne « Évolution » : le signe compte comme un caractère de la partie
  // entière, sa largeur suit donc la plus longue ligne de la colonne.
  assert.match(bloc, /<span class="davantage__entier" style="width:3ch">−23<\/span>/);
});

test("vie associative liste les associations nommément, sans récap par mission", () => {
  const html = rendu(TERRITOIRE, CATALOGUE, {
    exercice: "2021",
    beneficiaires: [
      { siren: "1", nom: "ASSO SPORT", programme: "219", objet: null, montant: 120_000 },
      { siren: "2", nom: "ASSO CULTURE", programme: "224", objet: null, montant: 30_000 },
      { siren: "3", nom: "ASSO SANS MISSION CONNUE", programme: "999", objet: null, montant: 5_000 },
    ],
    programmes: [
      { code: "219", libelle: "Sport", mission: "Sport, jeunesse et vie associative", montant: 120_000 },
      { code: "224", libelle: "Soutien aux politiques du ministère de la culture", mission: "Culture", montant: 30_000 },
      { code: "999", libelle: "Programme 999", mission: "", montant: 5_000 },
    ],
  } as never);
  const bloc = html.slice(html.indexOf('id="davantage-vie-associative"'), html.indexOf('id="davantage-population"'));
  // Le récap par mission budgétaire est parti : une subvention peut porter un
  // code de programme sans rapport lisible avec l'activité de l'association
  // (voir le docstring de la fonction), et regrouper par ce code fait lire
  // une mission comme sous-dotée alors que l'argent est ailleurs.
  assert.doesNotMatch(bloc, /davantage__table/);
  assert.doesNotMatch(bloc, /Sport, jeunesse et vie associative<\/td>/);
  // Les trois associations sont toutes visibles directement : sous le seuil
  // de 15, aucun pli ne s'affiche.
  assert.doesNotMatch(bloc, /<details/);
  assert.match(bloc, /ASSO SPORT/);
  assert.match(bloc, /ASSO CULTURE/);
  assert.match(bloc, /ASSO SANS MISSION CONNUE/);
  // La ligne de source (« jaune budgétaire… ») est partie : demandée à
  // retirer, sans remplacement.
  assert.doesNotMatch(bloc, /davantage__source/);
});

test("au-delà de 15 associations, le reste se déplie plutôt que de s'afficher d'un bloc", () => {
  const beneficiaires = Array.from({ length: 18 }, (_, i) => ({
    siren: String(i),
    nom: `ASSO ${i}`,
    programme: "219",
    objet: null,
    montant: 1000 - i,
  }));
  const html = rendu(TERRITOIRE, CATALOGUE, { exercice: "2021", beneficiaires } as never);
  const bloc = html.slice(html.indexOf('id="davantage-vie-associative"'), html.indexOf('id="davantage-population"'));
  const avantPli = bloc.slice(0, bloc.indexOf("<details"));
  // Les quinze mieux dotées (déjà triées, la plus dotée d'abord) sont
  // visibles sans geste.
  for (let i = 0; i < 15; i += 1) assert.match(avantPli, new RegExp(`ASSO ${i}\\b`));
  assert.doesNotMatch(avantPli, /ASSO 15\b/);
  // Le pli porte les trois restantes, fermé par défaut.
  assert.match(bloc, /<details class="davantage__pli">/);
  assert.doesNotMatch(bloc, /<details class="davantage__pli" open/);
  assert.match(bloc, /Voir les 3 autres associations/);
  const dansLePli = bloc.slice(bloc.indexOf("<details"));
  assert.match(dansLePli, /ASSO 15\b/);
  assert.match(dansLePli, /ASSO 17\b/);
});
