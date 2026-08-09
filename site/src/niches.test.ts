/**
 * « Les niches fiscales, c'est combien ? » : le bloc doit dire le total, nommer
 * les dispositifs qui pèsent, et refuser deux lectures — qu'une dépense fiscale
 * soit une dépense, et qu'un chiffrage soit un encaissement. Sans ces deux
 * refus il ajouterait 88 milliards au budget de l'État, ce qui ne mesure rien.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { DepensesFiscales, Indicateur, Territoire } from "./donnees.ts";
import { MONTRES, TOTAL, raccourcir, rendu } from "./niches.ts";

const catalogue = [{ id: TOTAL }] as Indicateur[];

const pays: Record<string, Territoire> = {
  FR: {
    series: { [TOTAL]: { "2024": 89_406_000_000, "2026": 88_269_000_000 } },
  } as unknown as Territoire,
};

function dispositif(numero: string, libelle: string, montant: number) {
  return {
    numero,
    libelle,
    mission: "Mission",
    montants: { "2024": montant, "2026": montant },
  };
}

const niches: DepensesFiscales = {
  exercices: ["2024", "2025", "2026"],
  realise: "2024",
  dispositifs: [
    dispositif("200302", "Crédit d'impôt en faveur de la recherche", 8_041_000_000),
    dispositif("110246", "Crédit d'impôt pour un salarié à domicile", 7_208_000_000),
    ...Array.from({ length: 20 }, (_, i) => dispositif(`9${i}`, `Dispositif ${i}`, 1_000_000)),
  ],
};

test("le bloc dit le total et refuse de l'appeler une dépense", () => {
  const html = rendu(niches, pays, catalogue);
  assert.match(html, /Les niches fiscales, c'est combien/);
  assert.match(html, /89.4\d\d\s?M€/);
  assert.match(html, /n'est pas une dépense/);
  assert.match(html, /n'apparaît sur aucune ligne du\s+budget/);
});

test("il nomme les dispositifs les plus coûteux, pas les quatre cent cinquante-sept", () => {
  const html = rendu(niches, pays, catalogue);
  assert.match(html, /impôt en faveur de la recherche/);
  assert.equal((html.match(/<tr>\s*<th scope="row">/g) ?? []).length, MONTRES);
  // Le décompte total reste dit : un classement de dix sur vingt-deux ne doit
  // pas se lire comme la liste entière.
  assert.match(html, /22 dispositifs sont chiffrés sur\s+les 465/);
});

test("il dit la part que pèsent les premiers", () => {
  // (8 041 + 7 208 + 8 × 1) / 89 406 ≈ 17 %
  assert.match(rendu(niches, pays, catalogue), /17&nbsp;%/);
});

test("la prévision se dit à part, jamais au présent", () => {
  const html = rendu(niches, pays, catalogue);
  // Le chiffre annoncé est le constat 2024 ; 2026 n'a pas eu lieu.
  assert.match(html, /En 2024, l'État renonce à percevoir/);
  assert.match(html, /Pour 2026, le projet de loi de finances en prévoit\s+88.2\d\d\s?M€/);
});

test("sans exercice constaté, il retombe sur le dernier publié", () => {
  const sansRealise = { ...niches, realise: null };
  assert.match(rendu(sansRealise, pays, catalogue), /En 2026, l'État renonce/);
});

test("il prévient que ce sont des chiffrages, pas des encaissements", () => {
  assert.match(rendu(niches, pays, catalogue), /chiffrages, pas des encaissements/);
});

test("il ne s'affiche pas sans total publié", () => {
  assert.equal(rendu(niches, {}, catalogue), "");
  assert.equal(rendu(niches, pays, []), "");
  assert.equal(rendu({ exercices: [], realise: null, dispositifs: [] }, pays, catalogue), "");
});

test("un libellé législatif est coupé sur un mot", () => {
  assert.equal(raccourcir("court"), "court");
  const long = raccourcir("a".repeat(100) + " et le reste du libellé législatif complet");
  assert.ok(long.endsWith("…"));
  assert.ok(long.length <= 111);
});

test("ce qui vient de la source est échappé", () => {
  const piege: DepensesFiscales = {
    exercices: ["2024"],
    realise: "2024",
    dispositifs: [dispositif("1", "<script>alert(1)</script>", 1_000_000)],
  };
  assert.doesNotMatch(rendu(piege, pays, catalogue), /<script>/);
});
