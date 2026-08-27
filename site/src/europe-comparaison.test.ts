/**
 * La comparaison européenne.
 *
 * Quatre propriétés se vérifient ici et nulle part ailleurs : un rang est
 * toujours donné avec son effectif, les agrégats ne sont jamais classés parmi
 * les pays, un pays qui ne publie pas l'exercice retenu laisse sa cellule vide
 * plutôt que d'y mettre l'année précédente, et les noms français viennent de
 * `pays-noms.ts` — la publication écrit « DE » comme nom de l'Allemagne.
 *
 * Les valeurs sont celles d'Eurostat pour 2024 (dépense, prélèvements) et 2025
 * (dette, déficit), telles que le site les publie.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Territoire } from "./donnees.ts";
import { rendu } from "./europe-comparaison.ts";
import { indexerSources } from "./registre-sources.ts";

const DEPENSE = "eurostat_depenses_publiques_pib";
const PRELEVEMENTS = "eurostat_prelevements_obligatoires_pib";
const DETTE = "eurostat_dette_pib";
const DEFICIT = "eurostat_deficit_pib";

function territoire(
  depense: number,
  prelevements: number,
  dette: number | null,
  deficit: number | null,
): Territoire {
  const series: Record<string, Record<string, number>> = {
    [DEPENSE]: { "2013": depense + 1, "2024": depense },
    [PRELEVEMENTS]: { "2024": prelevements },
  };
  if (dette !== null) series[DETTE] = { "2025": dette };
  if (deficit !== null) series[DEFICIT] = { "2025": deficit };
  return { nom: "", parent: null, population: null, drapeaux: {}, series };
}

/** La France, l'Union, et neuf voisins — valeurs publiées. La Finlande est
 *  là parce qu'elle dépense PLUS que la France : sans elle, le test du rang
 *  passerait en affirmant « 1re » à tort. */
const PAYS: Record<string, Territoire> = {
  EU27_2020: territoire(49.1, 40.2, 81.7, -3.1),
  FI: territoire(57.7, 42.0, 84.0, -4.4),
  FR: territoire(57.3, 45.2, 115.6, -5.1),
  AT: territoire(55.2, 43.7, 81.5, -4.2),
  BE: territoire(54.1, 44.0, 107.9, -5.2),
  IT: territoire(50.4, 43.1, 137.1, -3.1),
  SE: territoire(50.5, 41.7, 35.1, -1.3),
  DE: territoire(49.4, 40.7, 63.5, -2.7),
  ES: territoire(45.5, 37.1, 100.7, -2.4),
  NL: territoire(44.4, 39.1, 44.4, -1.6),
  DK: territoire(47.3, 45.0, 27.9, 2.9),
};

const REPERES_STABLES: Record<string, Territoire> = {
  ...PAYS,
  EA20: territoire(49.2, 41.2, 88.2, -3.1),
  LU: territoire(48.8, 42.6, 26.3, 0.1),
};

const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Les noms de la première colonne, dans l'ordre du tableau. */
const nomsAffiches = (html: string) =>
  [...html.matchAll(/<th scope="row">([^<]+)<\/th>/g)].map((m) => m[1]!);

test("les pays portent leur nom français, jamais leur code", () => {
  // La publication écrit `name = code` pour la maille pays : un tableau bâti
  // sur `territoire.nom` afficherait « DE » et « EU27_2020 ».
  const noms = nomsAffiches(rendu(PAYS));
  assert.ok(noms.includes("Allemagne"), `« Allemagne » manque : ${noms.join(", ")}`);
  assert.ok(noms.includes("Union européenne (27 pays)"));
  for (const nom of noms) assert.doesNotMatch(nom, /^[A-Z0-9_]{2,}$/, `« ${nom} » est un code`);
});

test("les repères européens attendus restent affichés quand leurs séries existent", () => {
  const noms = nomsAffiches(rendu(REPERES_STABLES));
  for (const nom of [
    "France",
    "Allemagne",
    "Belgique",
    "Luxembourg",
    "Espagne",
    "Italie",
    "Union européenne (27 pays)",
    "Zone euro (20 pays)",
  ]) {
    assert.ok(noms.includes(nom), `« ${nom} » manque : ${noms.join(", ")}`);
  }
});

test("la source Europe mène à la fiche Eurostat réellement indexée", () => {
  const html = rendu(REPERES_STABLES, indexerSources([{
    id: "eurostat-comparaison",
    nom: "Eurostat — comparaison européenne",
    statut: "publie",
    institution: "Eurostat",
    url: "https://exemple.test/eurostat",
    pages: ["/bilan"],
    indicateurs: [DEPENSE, PRELEVEMENTS, DETTE, DEFICIT],
  }]));
  assert.match(html, /Source : <a href="\/sources\/#eurostat-comparaison">Eurostat<\/a>\./);
});

test("plusieurs séries Eurostat ne répètent pas le même producteur", () => {
  const indicateurs = [DEPENSE, PRELEVEMENTS, DETTE, DEFICIT];
  const html = rendu(REPERES_STABLES, indexerSources(indicateurs.map((indicateur, index) => ({
    id: `eurostat-${index + 1}`,
    nom: `Eurostat — série ${index + 1}`,
    statut: "publie" as const,
    institution: "Eurostat",
    url: `https://exemple.test/eurostat/${index + 1}`,
    pages: ["/bilan"],
    indicateurs: [indicateur],
  }))));

  assert.match(html, /Source : <a href="\/sources\/#eurostat-1">Eurostat<\/a>\./);
  assert.equal((html.match(/>Eurostat<\/a>/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Sources :/);
});

test("le tableau est trié sur la dépense, du plus haut au plus bas", () => {
  const html = rendu(PAYS);
  const parts = [...html.matchAll(/<tr[^>]*>\s*<th scope="row">[^<]+<\/th>\s*<td>([^<]*)<\/td>/g)]
    .map((m) => Number(m[1]!.replace(",", ".").replace(/[^\d.−-]/g, "").replace("−", "-")))
    .filter((n) => !Number.isNaN(n));
  assert.deepEqual(parts, [...parts].sort((a, b) => b - a));
  assert.equal(nomsAffiches(html)[0], "France", "la France dépense le plus de la table");
});

test("un rang ne se dit jamais sans son effectif, et n'inclut pas les agrégats", () => {
  const lu = texte(rendu(PAYS));
  // Dix pays plus l'Union. La Finlande dépense davantage que la France : un
  // seul pays devant, sur dix — jamais sur onze, l'Union n'est pas un voisin.
  assert.match(lu, /un seul des 10 pays publiés en dépense davantage/);
  assert.doesNotMatch(lu, /sur 11|des 11 pays/, "l'Union ne compte pas comme un pays de plus");
  // Sur les prélèvements, la France est devant tout le monde (45,2 contre 45,0
  // au Danemark) : la formule doit basculer sur « aucun ».
  assert.match(lu, /aucun des 10 pays publiés n'en prélève davantage/);
});

test("l'Union garde sa majuscule dans la phrase", () => {
  // Une mise en minuscules du nom produisait « pour l'union européenne ».
  assert.match(texte(rendu(PAYS)), /pour l'Union européenne \(27 pays\)/);
});

test("un pays qui ne publie pas l'exercice laisse une cellule vide", () => {
  // Jamais l'exercice précédent : une ligne de tableau porte une seule année.
  const sansDette = { ...PAYS, DE: territoire(49.4, 40.7, null, null) };
  const html = rendu(sansDette);
  assert.match(html, /Allemagne<\/th>\s*<td>49,4[^<]*<\/td>\s*<td>40,7[^<]*<\/td>\s*<td><\/td>/);
});

test("les millésimes de chaque colonne sont écrits, parce qu'ils diffèrent", () => {
  // Dépense et prélèvements s'arrêtent en 2024, dette et déficit vont à 2025 :
  // un en-tête muet laisserait croire à un tableau d'une seule année.
  const html = rendu(PAYS);
  assert.equal([...html.matchAll(/class="europe__millesime">2024</g)].length, 2);
  assert.equal([...html.matchAll(/class="europe__millesime">2025</g)].length, 2);
});

test("la ligne de la France est marquée, sans couleur de jugement", () => {
  const html = rendu(PAYS);
  assert.match(html, /<tr class="europe__france">\s*<th scope="row">France</);
  assert.doesNotMatch(html, /style="[^"]*(color|background)/);
});

test("la note sous la comparaison ne garde que la source", () => {
  const lu = texte(rendu(PAYS));
  assert.doesNotMatch(lu, /retraite versée par l'État compte dans la dépense/);
  assert.match(lu, /Sources et méthode \.$/);
});

test("le déficit garde son signe", () => {
  const html = rendu(PAYS);
  assert.match(html, /Italie<\/th>[\s\S]{0,120}<td>−3,1[^<]*<\/td>/);
  assert.match(html, /France<\/th>[\s\S]{0,120}<td>−5,1[^<]*<\/td>/);
});

test("l'excédent luxembourgeois reste positif", () => {
  const html = rendu(REPERES_STABLES);
  assert.match(html, /Luxembourg<\/th>[\s\S]{0,180}<td>0,1[^<]*<\/td>/);
  assert.doesNotMatch(html, /Luxembourg<\/th>[\s\S]{0,180}<td>−0,1[^<]*<\/td>/);
});

test("sans dépense ni prélèvements pour la France, le bloc ne s'affiche pas", () => {
  assert.equal(rendu({}), "");
  const sansPrelevements: Record<string, Territoire> = {
    FR: {
      nom: "",
      parent: null,
      population: null,
      drapeaux: {},
      series: { [DEPENSE]: { "2024": 57.3 } },
    },
  };
  assert.equal(rendu(sansPrelevements), "");
});

test("moins de trois pays comparables n'est pas une comparaison", () => {
  const deux = { FR: PAYS["FR"]!, DE: PAYS["DE"]! };
  assert.equal(rendu(deux), "");
});
