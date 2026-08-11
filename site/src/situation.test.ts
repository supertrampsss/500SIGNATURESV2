/**
 * Le rang dans la maille : la convention de classement, et les refus.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { situation, rendreSituation } from "./situation.ts";

const VALEURS: Record<string, number | null> = { a: 100, b: 300, c: 200, d: null, e: 300 };
const CRITERE = {
  libelle: "Dépenses de fonctionnement par habitant",
  dessus: "dépensent plus par habitant",
  dessous: "dépensent moins",
  ecrire: (v: number) => `${v} € par habitant`,
  valeur: (code: string) => VALEURS[code] ?? null,
};
const CODES = ["a", "b", "c", "d", "e"];
const NOMS: Record<string, string> = { a: "Anet", b: "Bry", c: "Cluny", d: "Dax", e: "Eu" };
const entree = (code: string, codes = CODES) => ({ code, codes, noms: NOMS, criteres: [CRITERE] });

test("le rang se compte du plus élevé au plus bas", () => {
  const [r] = situation(entree("c"));
  assert.equal(r.rang, 3);
});

test("les ex æquo prennent le même rang, et le suivant saute", () => {
  // Convention du classement sportif : deux premiers ex æquo, puis un 3e.
  assert.equal(situation(entree("b"))[0].rang, 1);
  assert.equal(situation(entree("e"))[0].rang, 1);
  assert.equal(situation(entree("c"))[0].rang, 3);
});

test("le dénombrement ne compte que les territoires qui publient", () => {
  // « 412e sur 34 875 » se dit sur ceux qui publient, pas sur ceux qui existent :
  // `d` ne publie rien et sort du dénominateur.
  assert.equal(situation(entree("a"))[0].effectif, 4);
});

test("un territoire qui ne publie pas n'a pas de ligne", () => {
  assert.deepEqual(situation(entree("d")), []);
});

test("il faut au moins deux valeurs pour qu'un rang existe", () => {
  assert.deepEqual(
    situation(entree("a", ["a"])),
    [],
  );
});

test("le rendu dit le rang, l'effectif, la maille et le sens du classement", () => {
  const html = rendreSituation(
    situation(entree("c")),
    "commune",
    "2025",
  );
  assert.match(html, /Où ça se situe/);
  assert.match(html, /3<sup>e<\/sup> sur 4/);
  // Le sens se dit en comptant : deux au-dessus, une en dessous.
  assert.match(html, /<b>2<\/b> communes dépensent plus par habitant/);
  assert.match(html, /<b>1<\/b> dépensent moins/);
  assert.match(html, /Exercice 2025\./);
});

test("le premier prend « er », pas « e »", () => {
  const html = rendreSituation(
    situation(entree("b")),
    "commune",
    "2025",
  );
  assert.match(html, /1<sup>er<\/sup>/);
});

test("la France n'a personne à qui se comparer : rien ne s'écrit", () => {
  assert.equal(
    rendreSituation(situation(entree("c")), "pays", "2025"),
    "",
  );
});

test("le montant qui a produit le rang se lit à côté du rang", () => {
  // « 265e » sans « 1 377 € par habitant » demande de croire sur parole : le
  // rang est calculé par habitant, et c'est ce montant-là qui s'affiche.
  const html = rendreSituation(situation(entree("c")), "commune", "2025");
  assert.match(html, /class="situation__valeur nombre">200 € par habitant/);
  assert.doesNotMatch(html, /[—–]/);
});

test("le classement s'ouvre, votre place est marquée, et les trous se disent", () => {
  // Un rang appelle « et les autres ? ». Cinq territoires tiennent en entier ;
  // le saut ne s'écrit que quand le pli en laisse de côté.
  const html = rendreSituation(situation(entree("c")), "commune", "2025");
  assert.match(html, /<summary>Voir le classement<\/summary>/);
  assert.match(html, /data-territoire="b"[\s\S]*?Bry/);
  assert.match(html, /class="situation__vous"[\s\S]*?Cluny/);
  assert.doesNotMatch(html, /situation__saut/);
  // Celui qui ne publie rien n'a pas de place dans le classement.
  assert.doesNotMatch(html, /data-territoire="d"/);
});
