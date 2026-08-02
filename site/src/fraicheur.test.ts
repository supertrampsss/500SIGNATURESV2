/**
 * L'état des données est la page qui dit ce que le site ne garantit pas. Si
 * elle rassure à tort — anomalie muette, retard invisible, échec présenté comme
 * un succès — elle fait exactement l'inverse de ce pour quoi elle existe.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Fraicheur } from "./donnees.ts";
import { rendu } from "./fraicheur.ts";

const JEUX: Fraicheur[] = [
  {
    jeu: "execution-budget-etat",
    titre: "Situation mensuelle budgétaire de l'Etat",
    priorite: "P0",
    frequence: "mensuelle",
    derniere_extraction: "2026-07-31T18:07:00",
    retard_jours: 0,
    dernier_run: "success",
    controles_echoues: 0,
    anomalies: [
      {
        nom: "decomposition_des_totaux",
        severite: "warning",
        constat: { "2022/vote": ["Total prélèvements sur recettes"] },
      },
    ],
  },
  {
    jeu: "ofgl-communes",
    titre: "Finances des communes (consolidee)",
    priorite: "P0",
    frequence: "annuelle",
    derniere_extraction: "2026-07-31T15:00:00",
    retard_jours: 120,
    dernier_run: "failed",
    controles_echoues: 1,
    anomalies: [
      { nom: "epargne_brute_egale_recettes_moins_depenses", severite: "blocker", constat: null },
    ],
  },
];

test("le retard se lit en clair, pas en date à soustraire", () => {
  const html = rendu(JEUX);
  assert.match(html, /120 j de retard sur une mise à jour annuelle/);
  assert.match(html, /à jour \(mensuelle\)/);
});

test("un chargement en échec ne se lit pas comme un succès", () => {
  const html = rendu(JEUX);
  assert.match(html, /<strong>en échec<\/strong>/);
  assert.match(html, /réussi/);
});

test("les contrôles sont nommés en français et portent leur portée", () => {
  const html = rendu(JEUX);
  assert.match(html, /décomposition des totaux — 2022\/vote/);
  assert.match(html, /épargne brute = recettes − dépenses/);
  assert.doesNotMatch(html, /decomposition_des_totaux/);
});

test("un contrôle bloquant se distingue d'un simple signalement", () => {
  const html = rendu(JEUX);
  assert.match(html, /anomalie--blocker">bloquant/);
  assert.match(html, /anomalie--warning">signalement/);
});

test("l'absence d'anomalie est dite, pas laissée vide", () => {
  const propre = [{ ...JEUX[0], anomalies: [] }];
  assert.match(rendu(propre), /aucune anomalie relevée/);
});

test("« rien à signaler » et « on ne sait pas » ne se confondent pas", () => {
  // Une publication antérieure au champ ne porte pas d'anomalies : l'afficher
  // comme un feu vert transformerait une lacune en garantie.
  const ancienne = [{ ...JEUX[0], anomalies: undefined }];
  assert.match(rendu(ancienne), /non renseigné pour cette publication/);
  assert.doesNotMatch(rendu(ancienne), /aucune anomalie relevée/);
});

test("les jeux les plus récemment lus viennent en premier", () => {
  const html = rendu(JEUX);
  assert.ok(html.indexOf("Situation mensuelle") < html.indexOf("Finances des communes"));
});

test("les révisions se comptent, et « non suivi » n'est pas « zéro »", () => {
  const suivi = [{ ...JEUX[0], valeurs_revisees_90j: 202 }];
  assert.match(rendu(suivi), /202 valeurs révisées sur 90 jours/);
  const une = [{ ...JEUX[0], valeurs_revisees_90j: 1 }];
  assert.match(rendu(une), /1 valeur révisée sur 90 jours/);
  const sans = [{ ...JEUX[0], valeurs_revisees_90j: 0 }];
  assert.match(rendu(sans), /aucune sur 90 jours/);
  // Publication antérieure au champ : dire « aucune » inventerait une garantie.
  assert.match(rendu(JEUX), /non suivi pour cette publication/);
  assert.doesNotMatch(rendu(JEUX), /aucune sur 90 jours/);
});
