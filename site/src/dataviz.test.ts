import assert from "node:assert/strict";
import { test } from "node:test";

import {
  barreEmpilee,
  barresClassees,
  barresSolde,
  graphiqueEcart,
  halteres,
  nuageComparatif,
  tableauAccessible,
} from "./dataviz.ts";

test("les barres classées partent de zéro et écrivent chaque valeur", () => {
  const html = barresClassees({
    titre: "Les cadres sont les plus nombreux",
    description: "Répartition des professions à Bordeaux.",
    lignes: [
      { libelle: "Cadres", valeur: 42 },
      { libelle: "Ouvriers", valeur: 18 },
    ],
    formater: (v) => `${v} %`,
    accent: "var(--serie-4)",
  });
  assert.match(html, /dataviz--barres/);
  assert.match(html, /aria-label="Cadres : 42 %"/);
  assert.match(html, /width:100\.00%/);
  assert.match(html, /width:42\.86%/);
  assert.match(html, /<strong>18 %<\/strong>/);
});

test("les barres classées peuvent garder leur titre pour les lecteurs d'écran seulement", () => {
  const html = barresClassees({
    titre: "Classement",
    description: "Valeurs classées.",
    lignes: [{ libelle: "Cadres", valeur: 42 }],
    formater: (v) => `${v} %`,
    titreVisible: false,
  });
  assert.match(html, /aria-label="Classement\. Valeurs classées\."/);
  assert.doesNotMatch(html, /<figcaption>/);
});

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

test("les barres de solde réservent une mise en page aux libellés longs", () => {
  const html = barresSolde({
    titre: "Ce qui a bougé",
    description: "Écarts publiés.",
    points: [
      { periode: "Taxe foncière et impôts des entreprises", valeur: 12 },
      { periode: "Dette", valeur: -5 },
    ],
    formater: (v) => `${v} M€`,
  });
  assert.match(html, /dataviz--solde-long/);
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
