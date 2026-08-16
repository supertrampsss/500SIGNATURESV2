/**
 * Les crédits des missions, remis en colonnes.
 *
 * Chaque garantie porteuse a son test, et chacun mord : la convention de
 * nommage rougit quand elle ne tient pas, aucune ligne n'additionne les
 * missions, l'unité est posée, les montants sont ceux que `millions` produit,
 * et tous les exercices publiés ont leurs colonnes.
 *
 * Les valeurs attendues des montants ne sont jamais tapées à la main : elles
 * sont produites en appelant `millions`, seule façon de comparer les chiffres
 * sans comparer aussi la typographie — l'espace des milliers est une fine
 * insécable (U+202F) et le signe moins un U+2212.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { credits, ecart, rendreCredits, resume } from "./credits-missions.ts";
import { millions } from "./echelle.ts";

/** Deux missions complètes sur deux exercices, plus une ligne d'agrégat qui
 *  n'appartient pas aux missions : le module ne doit toucher qu'aux siennes. */
const LIGNES = [
  {
    id: "etat_mission_defense_credits_votes",
    libelle: "Défense (crédits votés)",
    brut: { "2024": 47_178_000_000, "2025": 59_946_000_000 },
  },
  {
    id: "etat_mission_defense_credits_consommes",
    libelle: "Défense (crédits consommés)",
    brut: { "2024": 48_000_000_000, "2025": 62_124_000_000 },
  },
  {
    id: "etat_mission_culture_credits_votes",
    libelle: "Culture (crédits votés)",
    brut: { "2024": 3_800_000_000, "2025": 3_918_000_000 },
  },
  {
    id: "etat_mission_culture_credits_consommes",
    libelle: "Culture (crédits consommés)",
    brut: { "2024": 3_750_000_000, "2025": 3_868_000_000 },
  },
  {
    id: "etat_depenses_nettes_bg",
    libelle: "Dépenses nettes du budget général",
    brut: { "2024": 430_000_000_000, "2025": 441_194_000_000 },
  },
];

test("les deux chiffres d'une mission tiennent sur une seule ligne", () => {
  const donnees = credits(LIGNES);
  // Quatre séries appariées en deux missions : c'est tout l'objet du module.
  assert.equal(donnees.missions.length, 2);
  assert.equal(donnees.retenus.size, 4);
  // L'agrégat n'est pas une mission : il reste à l'appelant, qui le garde dans
  // son tableau ordinaire.
  assert.ok(!donnees.retenus.has("etat_depenses_nettes_bg"));
  const html = rendreCredits(donnees);
  // Une ligne de corps par mission, pas deux.
  assert.equal(html.match(/<tr><th scope="row">/g)?.length, 2);
  assert.match(html, /<th scope="row">Défense<\/th>/);
  // Le libellé perd sa parenthèse : c'est la colonne qui dit désormais laquelle
  // des deux faces on lit.
  assert.doesNotMatch(html, /crédits votés\)/);
});

test("tous les exercices publiés ont leurs colonnes, votés et consommés côte à côte", () => {
  const donnees = credits(LIGNES);
  assert.deepEqual(donnees.exercices, ["2024", "2025"]);
  const html = rendreCredits(donnees);
  // Une valeur unique ne s'analyse pas : chaque exercice publié porte son
  // groupe de colonnes, et l'en-tête le nomme.
  assert.match(html, /<th scope="colgroup" colspan="3">2024<\/th>/);
  assert.match(html, /<th scope="colgroup" colspan="3">2025<\/th>/);
  assert.equal(html.match(/<th scope="col">Votés<\/th>/g)?.length, 2);
  assert.equal(html.match(/<th scope="col">Consommés<\/th>/g)?.length, 2);
  // Les deux montants de la Défense en 2025, dans la même ligne : c'est l'écart
  // que la première analyse du site explique.
  assert.match(html, new RegExp(`${echapperRegex(millions(59_946_000_000))}`));
  assert.match(html, new RegExp(`${echapperRegex(millions(62_124_000_000))}`));
});

test("l'écart est une soustraction dans une mission, jamais une somme entre elles", () => {
  const donnees = credits(LIGNES);
  const defense = donnees.missions.find((m) => m.libelle === "Défense")!;
  assert.equal(ecart(defense, "2025"), 2_178_000_000);
  const html = rendreCredits(donnees);
  assert.match(html, new RegExp(`\\+${echapperRegex(millions(2_178_000_000))}`));
  // AUCUN TOTAL. Les missions ne s'additionnent pas : « Remboursements et
  // dégrèvements » est compté en brut et c'est exactement ce que les dépenses
  // nettes du budget général retranchent. Une colonne de total serait fausse
  // d'un tiers. Ni pied de tableau, ni mot « total », ni le nombre lui-même.
  assert.doesNotMatch(html, /<tfoot/);
  assert.doesNotMatch(html, /Total|TOTAL/);
  const sommeVotes = 59_946_000_000 + 3_918_000_000;
  assert.doesNotMatch(html, new RegExp(echapperRegex(millions(sommeVotes))));
  // Et la légende dit pourquoi il n'y en a pas, avec les chiffres.
  assert.match(html, /Aucune colonne de total/);
});

test("la légende pose l'unité, la définition de l'écart et l'ordre des lignes", () => {
  const html = rendreCredits(credits(LIGNES));
  // Un tableau qui aligne des montants d'État dit son unité, là où le nombre
  // est gros : « 148 306 » se lit « milliards » par qui n'a pas le nez sur le
  // sigle.
  assert.match(html, /Montants en millions d'euros\./);
  assert.match(html, /Écart = consommés − votés/);
  // Ranger par écart est un ordre de lecture. La légende le dit pour que le
  // lecteur ne le prenne pas pour un palmarès.
  assert.match(html, /un ordre de lecture,\s+pas un classement/);
  // La Défense s'écarte de 2 178 M€, la Culture de 50 : la Défense ouvre.
  const defense = html.indexOf(">Défense<");
  const culture = html.indexOf(">Culture<");
  assert.ok(defense !== -1 && culture !== -1);
  assert.ok(defense < culture, "les missions sont rangées par écart décroissant");
});

test("trois chiffres qui comptent des missions et n'en additionnent aucune", () => {
  const bilan = resume(credits(LIGNES))!;
  assert.equal(bilan.exercice, "2025");
  assert.equal(bilan.nombre, 2);
  // La Défense a consommé plus que voté, la Culture moins.
  assert.equal(bilan.audessus, 1);
  assert.deepEqual(bilan.plusGrand, { libelle: "Défense", ecart: 2_178_000_000 });
  const html = rendreCredits(credits(LIGNES));
  assert.match(html, /Voté, dépensé : est-ce le même chiffre \?/);
  assert.match(html, /le plus grand écart de 2025 : Défense/);
  // Le par-habitant ne s'affiche que dans les tableaux dépliés : ni ici, ni
  // ailleurs dans cette section, qui n'a aucun dénominateur.
  assert.doesNotMatch(html, /par habitant/);
});

test("un suffixe inattendu n'est pas apparié, et le rendu le nomme en rouge", () => {
  // Apparier deux séries par leur suffixe est une convention de nommage, pas
  // une hiérarchie déclarée. Une troisième face — des crédits ouverts, par
  // exemple — n'entre dans aucune des deux colonnes : elle rougit plutôt que
  // d'être avalée dans l'une d'elles.
  const donnees = credits([
    ...LIGNES,
    {
      id: "etat_mission_defense_credits_ouverts",
      libelle: "Défense (crédits ouverts)",
      brut: { "2025": 60_000_000_000 },
    },
  ]);
  assert.deepEqual(donnees.ecartees.map((l) => l.id), ["etat_mission_defense_credits_ouverts"]);
  // Elle n'est pas retenue : elle reste dans le tableau ordinaire du thème.
  assert.ok(!donnees.retenus.has("etat_mission_defense_credits_ouverts"));
  const html = rendreCredits(donnees);
  assert.match(html, /class="credits__anomalie"/);
  assert.match(html, /Convention de nommage non tenue/);
  assert.match(html, /etat_mission_defense_credits_ouverts/);
});

test("une mission qui n'aurait qu'un des deux chiffres n'est pas appariée", () => {
  const donnees = credits([
    {
      id: "etat_mission_solitaire_credits_votes",
      libelle: "Solitaire (crédits votés)",
      brut: { "2025": 1_000_000_000 },
    },
  ]);
  assert.equal(donnees.missions.length, 0);
  assert.deepEqual(donnees.ecartees.map((l) => l.id), ["etat_mission_solitaire_credits_votes"]);
  const html = rendreCredits(donnees);
  // Aucun tableau à deux colonnes dont une serait vide : le rendu se réduit à
  // l'anomalie, et la ligne reste dans le tableau du thème.
  assert.doesNotMatch(html, /<table/);
  assert.match(html, /Convention de nommage non tenue/);
});

test("deux libellés qui ne nomment pas la même mission ne s'apparient pas", () => {
  // Le second contrôle de la convention porte sur les mots, pas sur
  // l'identifiant : sans lui, l'appariement ne reposerait que sur la découpe
  // d'une chaîne.
  const donnees = credits([
    {
      id: "etat_mission_x_credits_votes",
      libelle: "Défense (crédits votés)",
      brut: { "2025": 1_000_000_000 },
    },
    {
      id: "etat_mission_x_credits_consommes",
      libelle: "Culture (crédits consommés)",
      brut: { "2025": 2_000_000_000 },
    },
  ]);
  assert.equal(donnees.missions.length, 0);
  assert.equal(donnees.ecartees.length, 2);
  assert.match(rendreCredits(donnees), /Convention de nommage non tenue/);
});

test("un exercice où un seul des deux montants est publié rougit l'écart", () => {
  const donnees = credits([
    {
      id: "etat_mission_defense_credits_votes",
      libelle: "Défense (crédits votés)",
      brut: { "2024": 47_178_000_000, "2025": 59_946_000_000 },
    },
    {
      id: "etat_mission_defense_credits_consommes",
      libelle: "Défense (crédits consommés)",
      brut: { "2025": 62_124_000_000 },
    },
  ]);
  assert.equal(ecart(donnees.missions[0], "2024"), null);
  const html = rendreCredits(donnees);
  assert.match(html, /class="analyses__valeur credits__manque">un seul des deux chiffres</);
  // Le montant publié, lui, reste affiché : signaler n'est pas effacer.
  assert.match(html, new RegExp(echapperRegex(millions(47_178_000_000))));
});

test("une mission votée à zéro ne produit ni pourcentage ni division", () => {
  // « Plan de relance » 2025 : zéro voté, 1 486 M€ consommés. Un écart en % y
  // serait infini — l'écart est un montant, pas un taux, et le module n'en
  // calcule aucun.
  const donnees = credits([
    {
      id: "etat_mission_relance_credits_votes",
      libelle: "Plan de relance (crédits votés)",
      brut: { "2025": 0 },
    },
    {
      id: "etat_mission_relance_credits_consommes",
      libelle: "Plan de relance (crédits consommés)",
      brut: { "2025": 1_486_000_000 },
    },
  ]);
  assert.equal(ecart(donnees.missions[0], "2025"), 1_486_000_000);
  const html = rendreCredits(donnees);
  assert.doesNotMatch(html, /%|\bpts?\b|Infinity|NaN/);
  assert.match(html, new RegExp(`\\+${echapperRegex(millions(1_486_000_000))}`));
});

test("sans mission, le module ne rend rien", () => {
  assert.equal(rendreCredits(credits([])), "");
  assert.equal(
    rendreCredits(
      credits([
        { id: "etat_depenses_nettes_bg", libelle: "Dépenses nettes", brut: { "2025": 1 } },
      ]),
    ),
    "",
  );
});

/** Les montants produits par `millions` portent des caractères que les
 *  expressions régulières lisent autrement — l'espace fine insécable non, mais
 *  le « € » et la virgule oui selon les cas. On échappe tout ce qui pourrait
 *  l'être plutôt que de deviner lesquels. */
function echapperRegex(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
