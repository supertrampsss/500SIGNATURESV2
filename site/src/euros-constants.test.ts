/**
 * « +20,3 % depuis 2018 » est d'abord une évolution des prix.
 *
 * Entre 2018 et 2025, un euro a perdu près d'un cinquième de son pouvoir
 * d'achat : une dépense qui progresse de 20 % sur cette période n'a presque pas
 * bougé en volume. Ces tests fixent le déflateur et ses refus.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { enEurosConstants, facteurDePrix } from "./euros-constants.ts";

/** Les taux mensuels de l'IPCH, ramenés à douze mois égaux par année : la
 *  moyenne annuelle vaut alors exactement le taux voulu. */
function annees(taux: Record<string, number>): Record<string, number> {
  const serie: Record<string, number> = {};
  for (const [annee, valeur] of Object.entries(taux)) {
    for (let mois = 1; mois <= 12; mois += 1) {
      serie[`${annee}-${String(mois).padStart(2, "0")}`] = valeur;
    }
  }
  return serie;
}

// Inflation française en moyenne annuelle, telle que le site la publie.
const IPCH = annees({
  "2018": 2.1, "2019": 1.3, "2020": 0.5, "2021": 2.1,
  "2022": 5.9, "2023": 5.7, "2024": 2.3, "2025": 0.9,
});

test("le facteur chaîne les moyennes annuelles depuis l'année suivante", () => {
  // 2019 à 2025 : 1,013 × 1,005 × 1,021 × 1,059 × 1,057 × 1,023 × 1,009.
  // L'inflation de 2018 s'est produite avant le point de départ : la compter
  // déflaterait d'une année de trop.
  const facteur = facteurDePrix(IPCH, "2018", "2025") as number;
  assert.ok(Math.abs(facteur - 1.20099) < 1e-4, `${facteur}`);
  // Un seul pas.
  assert.ok(Math.abs((facteurDePrix(IPCH, "2023", "2024") as number) - 1.023) < 1e-9);
});

test("une année incomplète interrompt la chaîne plutôt que de la fausser", () => {
  // La moyenne des huit premiers mois n'est pas l'inflation annuelle, et
  // l'employer ferait dériver tout le reste.
  const troue = { ...IPCH };
  delete troue["2023-11"];
  assert.equal(facteurDePrix(troue, "2018", "2025"), null);
});

test("sans déflateur, aucune phrase plutôt qu'une phrase fausse", () => {
  assert.equal(facteurDePrix(undefined, "2018", "2025"), null);
  assert.equal(facteurDePrix(IPCH, "2025", "2018"), null);
  assert.equal(facteurDePrix(IPCH, "2025", "2025"), null);
});

test("une hausse de 20 % sur sept ans n'est presque rien en volume", () => {
  const serie = { "2018": 100, "2025": 120 };
  const lu = enEurosConstants(serie, "2018", "2025", "EUR", IPCH);
  assert.ok(lu);
  assert.ok(Math.abs(lu.inflation - 20.1) < 0.05, `${lu.inflation}`);
  // 120 / (100 × 1,201) = 0,999 : la dépense a **reculé** d'un dixième de point
  // en volume pendant qu'elle progressait de 20 % en euros courants.
  assert.ok(lu.reel < 0 && Math.abs(lu.reel) < 0.5, `${lu.reel}`);
});

test("un taux ne se déflate pas", () => {
  // Un taux de pauvreté n'est pas une somme d'argent : le retrancher de
  // l'inflation ne veut rien dire.
  assert.equal(enEurosConstants({ "2018": 11, "2025": 13 }, "2018", "2025", "percent", IPCH), null);
});

test("sous un demi-point cumulé, l'inflation n'explique rien", () => {
  const plate = annees({ "2018": 0.1, "2019": 0.1 });
  assert.equal(enEurosConstants({ "2018": 100, "2019": 110 }, "2018", "2019", "EUR", plate), null);
});

test("une valeur de départ nulle ne produit pas d'infini", () => {
  assert.equal(enEurosConstants({ "2018": 0, "2025": 120 }, "2018", "2025", "EUR", IPCH), null);
});
