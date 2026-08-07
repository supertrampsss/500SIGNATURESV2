/**
 * Ce qu'un ratio ne doit jamais faire.
 *
 * Diviser une dette de 2024 par une épargne de 2022 donne un nombre d'années
 * qui n'a jamais existé. Diviser par une épargne négative donne une dette
 * remboursée en moins quatre ans. Afficher un seuil que personne n'a écrit
 * transforme une convention en norme. Ces trois tests sont les trois erreurs.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { exerciceDesComptes, ratios, rendu } from "./ratios.ts";
import type { Territoire } from "./donnees.ts";

/** Espace fine insécable : la typographie française avant le signe %. */
const FINE = "\u202f";

function commune(series: Record<string, Record<string, number>>): Territoire {
  return { nom: "Ailleurs", parent: null, population: 10_000, drapeaux: {}, series };
}

const SAINE = commune({
  ofgl_recettes_fonctionnement: { "2023": 9_000_000, "2024": 10_000_000 },
  ofgl_epargne_brute: { "2023": 1_800_000, "2024": 2_000_000 },
  ofgl_encours_dette: { "2023": 21_000_000, "2024": 22_000_000 },
  ofgl_frais_personnel: { "2024": 4_500_000 },
  ofgl_annuite_de_la_dette: { "2024": 1_500_000 },
  ofgl_depenses_d_equipement: { "2024": 2_500_000 },
  ofgl_dotation_globale_de_fonctionnement: { "2024": 1_200_000 },
  ofgl_population_reference: { "2024": 11_000 },
});

test("l'exercice est le dernier où les recettes de fonctionnement sont publiées", () => {
  assert.equal(exerciceDesComptes(SAINE), "2024");
  assert.equal(exerciceDesComptes(commune({})), null);
});

test("les six rapports se calculent sur le même exercice", () => {
  const liste = ratios(SAINE, "commune", "2024");
  const par = new Map(liste.map((r) => [r.cle, r]));
  assert.equal(liste.length, 6);
  // 2 000 000 / 10 000 000
  assert.equal(par.get("epargne")?.valeur, 20);
  // 22 000 000 / 2 000 000, et non 22 000 000 / 1 800 000 (l'épargne de 2023).
  assert.equal(par.get("desendettement")?.valeur, 11);
  // 22 000 000 / 11 000 : la population de référence de l'OFGL, pas les
  // 10 000 habitants du recensement portés par la fiche.
  assert.equal(par.get("dette_habitant")?.valeur, 2000);
  assert.equal(par.get("rigidite")?.valeur, 60);
  assert.equal(par.get("equipement")?.valeur, 25);
  assert.equal(par.get("dgf")?.valeur, 12);
});

test("un terme manquant écarte le ratio, il ne le fait pas glisser sur l'année d'à côté", () => {
  // L'épargne brute existe en 2023 mais pas en 2024 : la capacité de
  // désendettement de 2024 ne se calcule pas avec celle de 2023.
  const sansEpargne = commune({
    ofgl_recettes_fonctionnement: { "2024": 10_000_000 },
    ofgl_epargne_brute: { "2023": 1_800_000 },
    ofgl_encours_dette: { "2024": 22_000_000 },
  });
  const liste = ratios(sansEpargne, "commune", "2024");
  const desendettement = liste.find((r) => r.cle === "desendettement");
  assert.equal(desendettement?.valeur, undefined);
  assert.match(desendettement?.impossible ?? "", /n'est pas publiée/);
  assert.equal(liste.find((r) => r.cle === "epargne"), undefined);
});

test("une épargne négative n'est pas une dette remboursée en moins quatre ans", () => {
  const enDifficulte = commune({
    ofgl_recettes_fonctionnement: { "2024": 10_000_000 },
    ofgl_epargne_brute: { "2024": -500_000 },
    ofgl_encours_dette: { "2024": 22_000_000 },
  });
  const desendettement = ratios(enDifficulte, "commune", "2024").find(
    (r) => r.cle === "desendettement",
  );
  assert.equal(desendettement?.valeur, undefined);
  assert.match(desendettement?.impossible ?? "", /ne dégage rien pour rembourser/);
  // Le taux d'épargne, lui, reste calculable : −5 % est un chiffre qui se lit.
  const taux = ratios(enDifficulte, "commune", "2024").find((r) => r.cle === "epargne");
  assert.equal(taux?.valeur, -5);
});

test("le plafond affiché est celui que la loi écrit pour ce niveau", () => {
  const plafond = (niveau: string) =>
    ratios(SAINE, niveau, "2024").find((r) => r.cle === "desendettement")?.plafond;
  assert.equal(plafond("commune"), 12);
  assert.equal(plafond("departement"), 10);
  assert.equal(plafond("region"), 9);
  // Aucune loi ne fixe de plafond pour un niveau qui n'est pas une
  // collectivité : mieux vaut rien qu'un seuil inventé.
  assert.equal(plafond("pays"), undefined);
});

test("aucun autre rapport ne porte de seuil", () => {
  const avecPlafond = ratios(SAINE, "commune", "2024").filter((r) => r.plafond !== undefined);
  assert.deepEqual(avecPlafond.map((r) => r.cle), ["desendettement"]);
});

test("sans comptes, pas de bloc plutôt qu'un bloc vide", () => {
  assert.equal(rendu(commune({}), "commune"), "");
  // Un seul rapport n'est pas une lecture des comptes.
  assert.equal(
    rendu(
      commune({
        ofgl_recettes_fonctionnement: { "2024": 10_000_000 },
        ofgl_epargne_brute: { "2024": 2_000_000 },
      }),
      "commune",
    ),
    "",
  );
});

test("le bloc nomme son exercice et le plafond, sans le pavé de méthode", () => {
  const html = rendu(SAINE, "commune");
  assert.match(html, /exercice 2024/);
  assert.match(html, /11,0 ans/);
  assert.match(html, /Plafond national de référence : 12 ans/);
  // La source et la méthode sont reprises en entier sur la page « Données ».
  // Dans la barre latérale, elles poussaient les chiffres hors de l'écran.
  assert.doesNotMatch(html, /Observatoire des finances/);
  assert.doesNotMatch(html, /loi n° 2018-32/);
});

test("un taux négatif porte le signe moins, pas le trait d'union", () => {
  const deficitaire = commune({
    ofgl_recettes_fonctionnement: { "2024": 10_000_000 },
    ofgl_epargne_brute: { "2024": -500_000 },
    ofgl_encours_dette: { "2024": 22_000_000 },
  });
  const html = rendu(deficitaire, "commune");
  assert.match(html, new RegExp(`<p class="ratios__valeur">−5,0${FINE}%</p>`));
});
