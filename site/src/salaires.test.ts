import assert from "node:assert/strict";
import { test } from "node:test";
import { calculerSalaire, renduSalaires, STATUTS } from "./salaires.ts";

test("le module Salaires expose les quatre statuts", () => {
  assert.deepEqual(STATUTS, ["salarié", "fonctionnaire", "indépendant", "retraité"]);
});

test("le coût total est la somme du revenu et des prélèvements", () => {
  const calcul = calculerSalaire(2100, "salarié");
  assert.equal(Math.round(calcul.coutTotal), 3979);
  assert.equal(
    Math.round(calcul.coutTotal),
    Math.round(calcul.net + calcul.cotisationsSalariales + calcul.impot + calcul.cotisationsEmployeur),
  );
});

test("un montant invalide ne produit pas de nombre négatif", () => {
  const calcul = calculerSalaire(Number.NaN, "retraité");
  assert.equal(calcul.net, 0);
  assert.equal(calcul.coutTotal, 0);
});

test("le rendu est court et contient le détail local", () => {
  const html = renduSalaires();
  assert.match(html, /id="salaires-contenu"/);
  assert.match(html, /Voir le calcul/);
  assert.match(html, /data-statut="salarié"/);
  assert.match(html, /data-statut="retraité"/);
  assert.match(html, /href="https:\/\/sarahknafo\.fr\/simulateur"/);
  assert.doesNotMatch(html, /Quand|Sources et méthode/);
});
