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
import { afficherNational, renduConclusionsBilan, renduDette, renduEurope } from "./national.ts";
import { construireRegistre, indexerSources, lienSource } from "./registre-sources.ts";

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
  // Le SESPROS publie deux ans après l'exercice : la colonne des pensions
  // n'est pas du millésime du tableau, et le fixture le pose exprès.
  eurostat_retraites_pib: { "2022": 14.4, "2023": 14.9 },
  eurostat_retraites_vieillesse_pib: { "2023": 12.1 },
  // Trois millésimes différents dans le même tableau : l'enquête sur les
  // revenus publie l'année même, la statistique de police deux ans après.
  eurostat_gini: { "2025": 30.4 },
  eurostat_rapport_interquintile: { "2025": 4.74 },
  eurostat_homicides_100k: { "2024": 1.28 },
  eurostat_cambriolages_100k: { "2024": 295.47 },
});

const PAYS: Record<string, Territoire> = {
  FR: FRANCE,
  DE: territoire({
    eurostat_dette_pib: { "2024": 62.5 },
    eurostat_chomage: { "2024": 3.4 },
    eurostat_retraites_pib: { "2023": 12.1 },
    eurostat_retraites_vieillesse_pib: { "2023": 9.6 },
    eurostat_gini: { "2025": 29.4 },
    eurostat_homicides_100k: { "2024": 0.83 },
    // Un compte rond : c'est lui qui fait tomber la décimale d'une colonne.
    eurostat_cambriolages_100k: { "2024": 94 },
  }),
  EA20: territoire({ eurostat_dette_pib: { "2024": 87.4 } }),
};

test("le verdict éditorial montre son millésime, son solde et son calcul", () => {
  const guide = renduConclusionsBilan({
    FR: territoire({
      eurostat_apu_recettes: { "2024": 1_000_000_000_000, "2025": 1_000_000_000_000 },
      eurostat_apu_depenses: { "2024": 1_060_000_000_000, "2025": 1_152_510_000_000 },
      eurostat_pib_montant: { "2024": 2_000_000_000_000, "2025": 2_100_000_000_000 },
      insee_dette_apu_montant: { "2025": 3_400_000_000_000 },
      insee_dette_apu_part_pib: { "2025": 115.6 },
      eurostat_dette_pib: { "2025": 115.6 },
      eurostat_deficit_pib: { "2025": -5.8 },
    }),
  });

  assert.deepEqual(Object.keys(guide), ["verdict", "entrees", "sorties", "dette"]);
  assert.match(guide.verdict, /2025/);
  assert.match(guide.verdict, /La France dépense 152,51 milliards d'euros de plus qu'elle n'encaisse/);
  assert.match(guide.verdict, /Solde public[\s\S]*−152,51 milliards d'euros/);
  assert.match(guide.verdict, /Recettes − Dépenses = Solde public/);
  assert.match(guide.verdict, /href="\/sources\/">Sources et méthode/);
  for (const html of Object.values(guide)) {
    assert.match(html, /class="ui-conclusion(?: |")/);
    assert.doesNotMatch(html, /Comprendre le calcul/);
    assert.doesNotMatch(html, /bilan-guide__viz/);
  }
});

test("le bilan France relie un chiffre à sa fiche de registre", () => {
  const catalogue = [{ id: "eurostat_deficit_pib", libelle: "Déficit / PIB", unite: "percent", theme: "macro", sommable: false, cadre_comptable: null, definition: "", definition_technique: "", formule: "", confiance: "publié", badges: [], jeu: "eurostat", niveaux: ["pays"], periodes: ["2025"] }] as Indicateur[];
  const fiches = construireRegistre({
    jeux: [{ id: "eurostat", titre: "Eurostat", producteur: "Eurostat", licence: "LO", url: "https://ec.europa.eu/eurostat", extraction: "2026-01-01" }],
    indicateurs: catalogue,
    analyses: [],
  });
  const guide = renduConclusionsBilan({ FR: territoire({ eurostat_deficit_pib: { "2025": -5.8 } }) }, indexerSources(fiches));

  assert.match(guide.verdict, new RegExp(`href="${lienSource(fiches[0]!.id)}"`));
  assert.match(guide.verdict, /Sources et méthode/);
});

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
  assert.ok(html.includes("Zone euro (20 pays)"), "la zone euro n'est pas rendue");
  // Un voisin absent du lot n'a pas de ligne du tout.
  assert.doesNotMatch(html, /Espagne|Italie|Pays-Bas/);
});

test("une valeur absente chez un voisin s'écrit — plutôt que zéro", () => {
  const html = renduEurope(PAYS);
  // La zone euro n'a ni déficit ni chômage dans ce lot : deux tirets, pas deux
  // « 0,0 % » qui se liraient comme des mesures.
  assert.match(html, new RegExp(`Zone euro \\(20 pays\\)</th>\\s*<td>87,4${FINE}%</td>\\s*<td>—</td>\\s*<td>—</td>`));
});

test("l'année du tableau est celle de la série française, pas une constante", () => {
  // Deux lots, deux années : une assertion sur un seul lot passerait aussi
  // bien avec un millésime écrit en dur — ce sabotage-là ne faisait tomber
  // aucun test tant que ce test ne lisait qu'un lot.
  assert.match(renduEurope(PAYS), /<caption>Année 2024 ·/);
  const plusTard = { FR: territoire({ eurostat_dette_pib: { "2024": 113.0, "2025": 116.2 } }) };
  assert.match(renduEurope(plusTard), /<caption>Année 2025 ·/);
});

test("sans France publiée, le bloc européen ne s'écrit pas", () => {
  // C'est ce vide-là que l'enveloppe traduit en `false` : le seul cas où
  // `afficherNational` rendait `false`.
  assert.equal(renduEurope({}), "");
  assert.equal(renduEurope({ DE: territoire({}) }), "");
});

/* -------------------------------------------------------------------------
 * L'enveloppe DOM
 * ---------------------------------------------------------------------- */

test("l'enveloppe pose l'Europe dans son cadre, et rend ce qu'elle rendait", () => {
  // La dette est partie au module « Est-ce tenable ? » (tenable.ts), qui
  // répond à la question du chapitre au lieu de la reposer : ce peintre-ci ne
  // garde que l'Europe.
  const europe = { innerHTML: "" } as HTMLElement;
  assert.equal(afficherNational(europe, PAYS, CATALOGUE), true);
  assert.equal(europe.innerHTML, renduEurope(PAYS));
});

test("sans France publiée, l'enveloppe rend false et ne touche pas au cadre", () => {
  const europe = { innerHTML: "" } as HTMLElement;
  assert.equal(afficherNational(europe, {}, CATALOGUE), false);
  assert.equal(europe.innerHTML, "");
});

test("les pensions entrent au tableau des voisins, avec leur propre millésime", () => {
  // « La France dépense trop pour ses retraites » est une phrase qu'on entend
  // sans le chiffre qui la juge, et ce chiffre ne veut rien dire seul.
  const html = renduEurope(PAYS);
  assert.match(html, /<th scope="col">Pensions \/ PIB/);
  assert.match(html, new RegExp(`14,9${FINE}%`));
  assert.match(html, new RegExp(`12,1${FINE}%`));
  // Le millésime du SESPROS n'est pas celui du tableau : l'écrire dans la
  // légende générale ferait dater ces chiffres de l'année de la dette.
  assert.match(html, /Pensions \/ PIB <span class="millesime">2023<\/span>/);
  assert.match(html, /<caption>Année 2024 ·/);
});

test("un pays sans pension publiée garde sa ligne et perd sa cellule", () => {
  // La zone euro n'a que sa dette dans ce lot : quatre colonnes, trois tirets.
  const html = renduEurope(PAYS);
  assert.match(
    html,
    new RegExp(`Zone euro \\(20 pays\\)</th>\\s*<td>87,4${FINE}%</td>\\s*<td>—</td>\\s*<td>—</td>\\s*<td>—</td>`),
  );
});

test("le second tableau compare le niveau de vie et les faits enregistrés", () => {
  const html = renduEurope(PAYS);
  assert.match(html, /Niveau de vie et faits enregistrés/);
  // L'indice garde sa décimale : « 30 » et « 29 » se liraient comme égaux à
  // un dixième près, et c'est à ce dixième que l'écart se joue.
  assert.match(html, />30,4</);
  assert.match(html, />29,4</);
  // Le rapport en garde deux : arrondi à l'entier, 4,74 devient 5.
  assert.match(html, />4,74</);
  // Un taux pour cent mille habitants ne se convertit pas en pourcentage, et
  // son unité vit dans l'intitulé — pas répétée dans chaque cellule.
  assert.match(html, /<th scope="col">Homicides pour 100/);
  assert.match(html, />1,3</);
  assert.doesNotMatch(html, />1,3 pour 100/);
  // Un compte rond garde sa décimale : « 94 » posé entre « 295,5 » et
  // « 166,8 » cesse d'aligner la colonne qu'on lit de haut en bas.
  assert.match(html, />94,0</);
  assert.match(html, />295,5</);
});

test("chaque colonne du second tableau porte son propre millésime", () => {
  // Une année en tête de tableau daterait quatre chiffres de trois millésimes
  // différents. La légende ne date donc rien.
  const html = renduEurope(PAYS);
  assert.match(html, /Indice de Gini <span class="millesime">2025<\/span>/);
  assert.match(html, /Homicides pour 100\s000 habitants <span class="millesime">2024<\/span>/);
  assert.match(html, /<caption>Millésime en tête de colonne/);
});

test("sans ces séries publiées, le second tableau n'existe pas", () => {
  // Un tableau d'une seule colonne n'est pas une comparaison, et un tableau
  // vide sous un titre est pire qu'un titre absent.
  const sans = { FR: territoire({ eurostat_dette_pib: { "2024": 113.0 } }) };
  const html = renduEurope(sans);
  assert.match(html, /La France et ses voisins/);
  assert.doesNotMatch(html, /Niveau de vie et faits enregistrés/);
});

test("la vieillesse seule a sa colonne : une série publiée se montre", () => {
  // Elle était la seule des six séries européennes neuves qu'aucun écran ne
  // portait — le défaut que le registre appelle « les séries invisibles ».
  const html = renduEurope(PAYS);
  assert.match(html, /<th scope="col">dont vieillesse<\/th>/);
  assert.match(html, new RegExp(`12,1${FINE}%`));
  assert.match(html, new RegExp(`9,6${FINE}%`));
});
