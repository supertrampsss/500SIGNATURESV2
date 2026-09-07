import assert from "node:assert/strict";
import test from "node:test";

import type { Insight } from "./insights.ts";
import type { Indicateur, Territoire } from "./donnees.ts";
import { comparaisonVoisins, courbesEurope, avecCourbesEurope } from "./insights-europe.ts";

const territoire = (nom: string, valeur?: number): Territoire => ({
  nom,
  parent: null,
  population: null,
  drapeaux: {},
  series: valeur === undefined ? {} : { eurostat_test: { "2025": valeur } },
});

test("la comparaison aligne seulement les voisins publiés au même exercice", () => {
  const comparaison = comparaisonVoisins({
    DE: territoire("DE", 42.4),
    BE: territoire("BE", 47.2),
    ES: territoire("ES", 38.1),
    IT: { ...territoire("IT"), series: { eurostat_test: { "2024": 41.8 } } },
  }, "eurostat_test", "2025", "percent");

  assert.equal(
    comparaison,
    "Voisins européens : Allemagne 42,4\u202f% · Belgique 47,2\u202f% · Espagne 38,1\u202f%.",
  );
});

test("une comparaison trop partielle n'est pas affichée", () => {
  assert.equal(
    comparaisonVoisins({ DE: territoire("DE", 42.4) }, "eurostat_test", "2025", "percent"),
    undefined,
  );
});


test("les courbes européennes respectent fenêtre, fréquence, absences et couleurs stables", () => {
  const france = {"2024-Q1": 4, "2024-Q2": 5};
  const pays = {DE: {...territoire("DE"), series: {eurostat_test: {"2024": 99, "2024-Q1": 7, "2025-Q1": 8}}},
    MT: {...territoire("MT"), series: {eurostat_test: {"2024-Q2": 6}}}};
  const curves = courbesEurope(france, pays, "eurostat_test");
  assert.deepEqual(curves.map(s => s.name), ["France", "Allemagne", "Malte"]);
  assert.deepEqual(curves[1].values, {"2024-Q1": 7});
  assert.equal(curves[2].color, courbesEurope(france, {MT:pays.MT}, "eurostat_test")[1].color);
  assert.deepEqual(courbesEurope(france, pays, "insee_test"), []);
});

test("l’enrichissement conserve les unités et les graphiques dérivés", () => {
  const insight: Insight = {id:"test", famille:"budget", surtitre:"Budget", titre:"Budget", texte:"", reserve:"",
    preuves:[{indicateur:"eurostat_test", periode:"2025", valeur:1e9, libelle:"France"}]};
  const catalogue = [{id:"eurostat_test", libelle:"Dépenses", unite:"EUR"}] as Indicateur[];
  const france = {eurostat_test:{"2024":1e9,"2025":2e9}};
  const pays = {DE:territoire("DE",3e9)};
  const result = avecCourbesEurope(insight, france, catalogue, pays);
  assert.equal(result.graphique?.unite, "Md€");
  assert.equal(result.graphique?.series[1].values["2025"], 3);
  assert.equal(avecCourbesEurope(insight, france, catalogue), insight);
  const custom = {...insight, graphique:{titre:"Ratio",unite:"%",series:[]}};
  assert.equal(avecCourbesEurope(custom, france, catalogue, pays), custom);
  assert.equal(avecCourbesEurope({...insight,preuves:[{...insight.preuves[0],indicateur:"insee_test"}]}, france, catalogue, pays).graphique, undefined);
});
