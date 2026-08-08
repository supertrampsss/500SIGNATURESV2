import assert from "node:assert/strict";
import { test } from "node:test";

import { groupesCarte, nombreDeChoix, rendreSelecteur } from "./selecteur-carte.ts";

const CATALOGUE = [
  { id: "ofgl_depenses", theme: "finances_locales", libelle: "Dépenses de fonctionnement" },
  { id: "ofgl_dette", theme: "finances_locales", libelle: "Encours de dette" },
  { id: "insee_chomage", theme: "emploi", libelle: "Taux de chômage" },
  { id: "calc_capacite", theme: "finances_locales", libelle: "Capacité de désendettement" },
  { id: "insee_dette_pib", theme: "dette", libelle: "Dette publique en % du PIB" },
];

/** Ce que `peintSurCarte` refuse : le national et le reconstitué. */
const cartographiable = (i: { id: string; theme: string }) =>
  i.theme !== "dette" && !i.id.startsWith("calc_");

const libelleTheme = (t: string) =>
  ({ finances_locales: "Finances locales", emploi: "Emploi et chômage", dette: "Dette publique" })[t] ?? t;

test("les indicateurs sont groupés par thème, dans l'ordre donné", () => {
  const groupes = groupesCarte(
    CATALOGUE, ["finances_locales", "emploi", "dette"], cartographiable, libelleTheme,
  );
  assert.deepEqual(groupes.map((g) => g.theme), ["finances_locales", "emploi"]);
  assert.equal(groupes[0].libelle, "Finances locales");
});

test("un thème sans indicateur cartographiable ne fait pas de groupe vide", () => {
  const groupes = groupesCarte(
    CATALOGUE, ["dette"], cartographiable, libelleTheme,
  );
  assert.deepEqual(groupes, []);
});

test("un indicateur reconstitué est écarté : il n'a pas de couche publiée", () => {
  const groupes = groupesCarte(
    CATALOGUE, ["finances_locales"], cartographiable, libelleTheme,
  );
  assert.deepEqual(groupes[0].choix.map((c) => c.id), ["ofgl_depenses", "ofgl_dette"]);
});

test("les choix sont triés par libellé, en français", () => {
  const groupes = groupesCarte(
    [
      { id: "b", theme: "t", libelle: "Éducation" },
      { id: "a", theme: "t", libelle: "Emploi" },
      { id: "c", theme: "t", libelle: "Dette" },
    ],
    ["t"], () => true, (t) => t,
  );
  assert.deepEqual(groupes[0].choix.map((c) => c.libelle), ["Dette", "Éducation", "Emploi"]);
});

test("le libellé peut passer par la table de traduction", () => {
  const groupes = groupesCarte(
    [{ id: "a", theme: "t", libelle: "unemployment_rate" }],
    ["t"], () => true, (t) => t, () => "Taux de chômage",
  );
  assert.equal(groupes[0].choix[0].libelle, "Taux de chômage");
});

test("l'indicateur courant est celui que le sélecteur montre", () => {
  const groupes = groupesCarte(
    CATALOGUE, ["finances_locales", "emploi"], cartographiable, libelleTheme,
  );
  const html = rendreSelecteur(groupes, "insee_chomage");
  assert.match(html, /<option value="insee_chomage" selected>Taux de chômage<\/option>/);
  assert.equal((html.match(/ selected/g) ?? []).length, 1);
  assert.match(html, /<optgroup label="Emploi et chômage">/);
});

test("un indicateur non cartographiable n'est pas maquillé en indicateur peint", () => {
  const groupes = groupesCarte(
    CATALOGUE, ["finances_locales", "emploi"], cartographiable, libelleTheme,
  );
  const html = rendreSelecteur(groupes, "insee_dette_pib");
  assert.match(html, /<option value="" selected disabled>Choisir un indicateur<\/option>/);
  assert.ok(!/value="ofgl_depenses" selected/.test(html));
});

test("les libellés sont échappés", () => {
  const html = rendreSelecteur(
    groupesCarte(
      [{ id: "a&b", theme: "t", libelle: "Dépenses <hors> \"tout\"" }],
      ["t"], () => true, () => "Thème & co",
    ),
    "a&b",
  );
  assert.ok(!html.includes("<hors>"));
  assert.match(html, /label="Thème &amp; co"/);
  assert.match(html, /value="a&amp;b"/);
});

test("le nombre de choix se compte sur tous les groupes", () => {
  const groupes = groupesCarte(
    CATALOGUE, ["finances_locales", "emploi"], cartographiable, libelleTheme,
  );
  assert.equal(nombreDeChoix(groupes), 3);
  assert.equal(nombreDeChoix([]), 0);
});
