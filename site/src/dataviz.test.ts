import assert from "node:assert/strict";
import { test } from "node:test";

import {
  barreEmpilee,
  barresSolde,
  graphiqueEcart,
  halteres,
  nuageComparatif,
  tableauAccessible,
} from "./dataviz.ts";

test("une courbe d'écart nomme son constat et conserve les deux séries", () => {
  const html = graphiqueEcart({
    titre: "Le déficit se creuse",
    description: "Les dépenses restent au-dessus des recettes.",
    points: [
      { periode: "2024", haut: 120, bas: 100 },
      { periode: "2025", haut: 130, bas: 105 },
    ],
    noms: ["Dépenses", "Recettes"],
    formater: (v) => `${v} Md€`,
  });
  assert.match(html, /class="dataviz dataviz--ecart"/);
  assert.match(html, /<title>Le déficit se creuse<\/title>/);
  assert.match(html, /<desc>Les dépenses restent au-dessus des recettes\.<\/desc>/);
  assert.match(html, /dataviz__zone/);
  assert.match(html, /Dépenses 130 Md€/);
  assert.match(html, /Recettes 105 Md€/);
});

test("la composition encode les parts sans camembert", () => {
  const html = barreEmpilee({
    titre: "D'où viennent 100 euros",
    description: "Quatre familles de recettes.",
    segments: [
      { libelle: "Cotisations", valeur: 32 },
      { libelle: "Impôts", valeur: 68 },
    ],
    formater: (v) => `${v} €`,
  });
  assert.match(html, /dataviz--composition/);
  assert.match(html, /width:32\.000%/);
  assert.match(html, /Cotisations/);
  assert.doesNotMatch(html, /pie|donut|camembert/i);
});

test("les haltères et soldes rendent les valeurs sans dépendre de la couleur", () => {
  const comparaison = halteres({
    titre: "Avant et après",
    description: "Les seuils se resserrent.",
    lignes: [{ libelle: "Premier décile", avant: 10, apres: 14 }],
    noms: ["Avant", "Après"],
    formater: String,
  });
  assert.match(comparaison, /dataviz--halteres/);
  assert.match(comparaison, /aria-label="Premier décile : Avant 10, Après 14"/);

  const soldes = barresSolde({
    titre: "Le solde repasse sous zéro",
    description: "Excédents et déficits.",
    points: [{ periode: "2024", valeur: -0.2 }],
    formater: (v) => `${v} point`,
  });
  assert.match(soldes, /dataviz--solde/);
  assert.match(soldes, /dataviz__barre--negative/);
  assert.match(soldes, /−0.2 point/);
});

test("le nuage comparatif porte ses axes, sa diagonale et ses libellés directs", () => {
  const html = nuageComparatif({
    titre: "La France prélève et dépense davantage",
    description: "Comparaison européenne.",
    axeX: "Prélèvements obligatoires",
    axeY: "Dépense publique",
    points: [
      { id: "FR", libelle: "France", x: 45.2, y: 57.3, accent: true },
      { id: "DE", libelle: "Allemagne", x: 40.7, y: 49.4 },
    ],
    formater: (v) => `${v} %`,
    diagonale: true,
  });
  assert.match(html, /dataviz--nuage/);
  assert.match(html, /Prélèvements obligatoires/);
  assert.match(html, /Dépense publique/);
  assert.match(html, /dataviz__equilibre/);
  assert.match(html, /dataviz__point--accent/);
  assert.match(html, />France</);
});

test("le tableau exact reste disponible au clavier", () => {
  const html = tableauAccessible("Données exactes", "<table><tr><td>42</td></tr></table>");
  assert.match(html, /<details class="dataviz__donnees">/);
  assert.match(html, /<summary>Données exactes<\/summary>/);
  assert.match(html, /<td>42<\/td>/);
});
