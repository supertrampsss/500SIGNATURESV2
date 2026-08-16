/**
 * Les deux blocs nationaux, éprouvés sur leur chaîne.
 *
 * `afficherNational` peignait deux cadres et n'existait qu'avec un DOM : rien
 * n'en était testable, et rien n'en était pré-rendable. Ces tests-ci portent
 * sur les deux rendus purs qui composent désormais ces chaînes, et sur ce que
 * l'enveloppe rend encore — « la France est-elle publiée ? ».
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Indicateur, Territoire } from "./donnees.ts";
import { millions } from "./echelle.ts";
import { renduDette, renduEurope } from "./national.ts";

const FINE = " ";

function territoire(series: Record<string, Record<string, number>>): Territoire {
  return { nom: "", parent: null, population: null, drapeaux: {}, series };
}

const CATALOGUE = [
  { id: "insee_dette_etat_montant", libelle: "Dette de l'État" },
  { id: "insee_dette_asso_montant", libelle: "Dette des administrations de sécurité sociale" },
  { id: "insee_dette_apul_montant", libelle: "Dette des administrations publiques locales" },
] as Indicateur[];

const FRANCE = territoire({
  insee_dette_apu_montant: { "2024": 3_300_000_000_000, "2025": 3_400_000_000_000 },
  insee_dette_apu_part_pib: { "2023": 109.9, "2024": 113.0, "2025": 115.6 },
  insee_dette_etat_montant: { "2025": 2_800_000_000_000 },
  insee_dette_asso_montant: { "2025": 150_000_000_000 },
  insee_dette_apul_montant: { "2025": 260_000_000_000 },
  eurostat_dette_pib: { "2024": 113.0 },
  eurostat_deficit_pib: { "2024": -5.8 },
  eurostat_chomage: { "2024": 7.4 },
});

const PAYS: Record<string, Territoire> = {
  FR: FRANCE,
  DE: territoire({ eurostat_dette_pib: { "2024": 62.5 }, eurostat_chomage: { "2024": 3.4 } }),
  EA20: territoire({ eurostat_dette_pib: { "2024": 87.4 } }),
};

/* -------------------------------------------------------------------------
 * Le bloc DETTE
 * ---------------------------------------------------------------------- */

test("la dette annonce son montant, son millésime et sa part de PIB", () => {
  const html = renduDette(PAYS, CATALOGUE);
  // Le montant sort du formateur commun, en millions d'euros — l'unité que le
  // site tient partout. Attendu en APPELANT `millions`, jamais recopié : les
  // séparateurs sont des espaces fines insécables, qu'une chaîne tapée à la
  // main écrirait ordinaires sans que rien ne le dise.
  const attendu = millions(3_400_000_000_000);
  assert.ok(attendu.endsWith("M€"), `« ${attendu} » ne dit pas son unité : cette sonde ne prouverait rien`);
  assert.ok(html.includes(attendu), `le montant « ${attendu} » n'est pas rendu`);
  assert.match(html, /<span class="millesime">2025<\/span>/);
  assert.match(html, new RegExp(`115,6${FINE}%`));
});

test("les sous-secteurs perdent le préfixe « Dette de » que le titre porte déjà", () => {
  const html = renduDette(PAYS, CATALOGUE);
  // La présence d'abord : sans elle, une assertion d'absence passerait sur un
  // bloc vide.
  assert.match(html, /<ul class="repartition">/);
  assert.ok(html.includes("l'État"), "le sous-secteur État n'est pas rendu");
  assert.ok(html.includes("administrations publiques locales"));
  assert.doesNotMatch(html, /<span>Dette de/);
  // Le quatrième sous-secteur n'est pas publié dans ce lot : il ne laisse pas
  // de ligne vide derrière lui.
  assert.doesNotMatch(html, /odac/);
});

test("sans France publiée, le bloc dette ne s'écrit pas", () => {
  assert.equal(renduDette({}, CATALOGUE), "");
});

test("sans part de PIB, le bloc dette ne s'écrit pas — il pose les deux ou rien", () => {
  const sansPart = { FR: territoire({ insee_dette_apu_montant: { "2025": 3_400_000_000_000 } }) };
  assert.equal(renduDette(sansPart, CATALOGUE), "");
  const sansMontant = { FR: territoire({ insee_dette_apu_part_pib: { "2025": 115.6 } }) };
  assert.equal(renduDette(sansMontant, CATALOGUE), "");
});

/* -------------------------------------------------------------------------
 * Le bloc EUROPE
 * ---------------------------------------------------------------------- */

test("la comparaison européenne nomme ses pays et souligne la France", () => {
  const html = renduEurope(PAYS);
  assert.match(html, /<tr class="souligne">\s*<th scope="row">France<\/th>/);
  assert.ok(html.includes("Allemagne"), "l'Allemagne n'est pas rendue");
  assert.ok(html.includes("Zone euro"), "la zone euro n'est pas rendue");
  // Un voisin absent du lot n'a pas de ligne du tout.
  assert.doesNotMatch(html, /Espagne|Italie|Pays-Bas/);
});

test("une valeur absente chez un voisin s'écrit — plutôt que zéro", () => {
  const html = renduEurope(PAYS);
  // La zone euro n'a ni déficit ni chômage dans ce lot : deux tirets, pas deux
  // « 0,0 % » qui se liraient comme des mesures.
  assert.match(html, new RegExp(`Zone euro</th>\\s*<td>87,4${FINE}%</td>\\s*<td>—</td>\\s*<td>—</td>`));
});

test("l'année du tableau est celle de la série française, pas une constante", () => {
  const html = renduEurope(PAYS);
  assert.match(html, /<caption>Année 2024 ·/);
});

test("sans France publiée, le bloc européen ne s'écrit pas", () => {
  // C'est ce vide-là que l'enveloppe traduit en `false` : le seul cas où
  // `afficherNational` rendait `false`.
  assert.equal(renduEurope({}), "");
  assert.equal(renduEurope({ DE: territoire({}) }), "");
});
