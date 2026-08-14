/**
 * La grille de verdicts est du texte de référence, pas un calcul : elle rend
 * public ce que `docs/analyses-schema.md` et le contrôle déterministe
 * (tâche 2) appliquent déjà. Ces tests la comparent à ces deux sources,
 * champ par champ — un désaccord entre la page et le contrôle serait pire
 * qu'une page absente.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { renduGrille } from "./methode-rendu.ts";

test("les trois crans figurent avec leur formulation exacte", () => {
  const html = renduGrille();
  assert.match(html, /exact/);
  assert.match(html, /« Le chiffre est celui des comptes »/);
  assert.match(html, /hors_perimetre/);
  assert.match(html, /« Le chiffre existe, mais pas pour ce qu'il désigne »/);
  assert.match(html, /introuvable/);
  assert.match(html, /« Aucune ligne publiée ne porte ce montant »/);
});

test("aucun cran ne porte de jugement — la page le dit explicitement", () => {
  const html = renduGrille();
  assert.match(html, /trompeur/i);
  assert.match(html, /mensonger/i);
  assert.match(html, /exagéré/i);
  assert.match(html, /compare deux nombres et nomme ce qui les sépare/);
});

test("les sept confusions figurent, chacune avec ce qu'elle désigne", () => {
  const html = renduGrille();
  const confusions = [
    "ae_cp",
    "brut_net",
    "vote_execute",
    "stock_flux",
    "etat_apu",
    "annuel_cumule",
    "perimetre_geographique",
  ];
  for (const confusion of confusions) {
    assert.match(html, new RegExp(confusion), `${confusion} absente de la grille`);
  }
  // Chaque confusion nomme ce qu'elle désigne, pas seulement son identifiant :
  // un lecteur qui ne connaît pas le vocabulaire du schéma doit s'y retrouver.
  assert.match(html, /autorisations d.engagement/i);
  assert.match(html, /brut.*net/i);
  assert.match(html, /voté.*exécuté/i);
  assert.match(html, /stock.*flux/i);
  assert.match(html, /administrations publiques/i);
  assert.match(html, /cumul/i);
  assert.match(html, /territoriaux|géographiques/i);
});

test("le cran hors_perimetre est rattaché aux sept confusions", () => {
  const html = renduGrille();
  assert.match(html, /hors_perimetre[\s\S]{0,400}(ae_cp|Les sept confusions)/i);
});

test("les sept registres figurent, et le septième dit que l'opinion n'existe pas", () => {
  const html = renduGrille();
  const registres = [
    "fait_comptable",
    "donnee_officielle",
    "resultat_simulation",
    "estimation_externe",
    "hypothese",
    "interpretation",
  ];
  for (const registre of registres) {
    assert.match(html, new RegExp(registre), `${registre} absent de la grille`);
  }
  assert.match(html, /opinion/i);
  assert.match(html, /n'existe pas/);
  assert.match(html, /bonne.*mauvaise|mauvaise.*bonne/i);
  assert.match(html, /souhaitable/i);
});

test("le critère de choix des sujets est écrit, sans auteur ni orientation", () => {
  const html = renduGrille();
  assert.match(html, /circule largement/);
  assert.match(html, /touche une ligne/);
  assert.match(html, /(N|n)i l'auteur.*(N|n)i son orientation|orientation.*n'entrent/i);
  assert.match(html, /file des sujets est publique/);
  assert.match(html, /issues du dépôt/);
});

test("aucune réserve qui s'excuse", () => {
  const html = renduGrille();
  assert.doesNotMatch(html, /ne garantit pas|fiabilité (est )?inégale|à prendre avec précaution/i);
});

test("le rendu est pur : deux appels produisent la même chaîne", () => {
  assert.equal(renduGrille(), renduGrille());
});

test("le rendu ne prend aucune donnée en entrée", () => {
  assert.equal(renduGrille.length, 0);
});
