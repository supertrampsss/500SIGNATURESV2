/**
 * L'ouverture de Bilan : ce qu'un chiffre de cadrage doit garantir.
 *
 * Les valeurs sont celles d'Eurostat, au dixième de million : un fixture
 * arrondi ferait passer au vert un chiffre que personne ne verra.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

import type { Territoire } from "./donnees.ts";
import { chiffres, rendu } from "./ouverture.ts";

const Md = 1e9;
const SERIES: Record<string, Record<string, number>> = {
  eurostat_apu_recettes: { "1995": 545.0 * Md, "2017": 1245.1 * Md, "2025": 1561.6261 * Md },
  eurostat_apu_depenses: { "1995": 600.6 * Md, "2017": 1323.0 * Md, "2025": 1714.1372 * Md },
  eurostat_pib_montant: { "1995": 1070.9 * Md, "2017": 2292.6 * Md, "2025": 2991.0559 * Md },
  eurostat_population: { "2025": 68_882_600, "2026": 69_112_309 },
};

const territoire = (series: Record<string, Record<string, number>>): Territoire => ({
  nom: "", parent: null, population: null, drapeaux: {}, series,
});
const texte = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ").trim();

test("la base des écarts est 2017 quand elle est publiée, et elle est nommée", () => {
  // Le choix de la base n'est pas neutre : mesuré sur les séries réelles,
  // l'écart de dépense vaut +1,3 point depuis 1995, +2,0 depuis 2019 et
  // −0,4 depuis 2017. **Le signe s'inverse.** Une base tue ou choisie pour sa
  // conclusion rend n'importe quel bilan démontrable.
  const c = chiffres(territoire(SERIES));
  assert.ok(c);
  assert.equal(c.debut, "2017");
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /écarts sont mesurés depuis 2017/);
});

test("les trois écarts partent du même exercice", () => {
  // Raconter la baisse de la dépense sans celle de la recette laisserait croire
  // à une gestion qui se redresse, quand le déficit se creuse.
  const c = chiffres(territoire(SERIES));
  assert.ok(c);
  const attendu = (fin: number, debut: number, pibF: number, pibD: number) =>
    (fin / pibF) * 100 - (debut / pibD) * 100;
  assert.ok(
    Math.abs(c.ecartPartRecettes - attendu(1561.6261 * Md, 1245.1 * Md, 2991.0559 * Md, 2292.6 * Md)) < 1e-9,
  );
  // La recette recule davantage que la dépense : c'est là qu'est le déficit.
  assert.ok(c.ecartPartRecettes < c.ecartPartDepenses, `${c.ecartPartRecettes} ≥ ${c.ecartPartDepenses}`);
  assert.ok(c.ecartPartEcart < 0);
});

test("un écart de taux s'écrit en POINTS, jamais en pourcentage", () => {
  // « −2,1 % » dirait que la part a baissé de 2,1 % de sa valeur, quand elle a
  // perdu 2,1 points de PIB.
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /−2,1 points/);
  assert.match(lu, /−0,4 point\b/);
});

test("le module retombe sur le premier exercice si la référence n'est pas publiée", () => {
  // Un module qui exigerait 2017 se tairait entièrement sur une source qui
  // commence après.
  const sans2017 = Object.fromEntries(
    Object.entries(SERIES).map(([cle, serie]) => [
      cle,
      Object.fromEntries(Object.entries(serie).filter(([an]) => an !== "2017")),
    ]),
  );
  const c = chiffres(territoire(sans2017));
  assert.ok(c);
  assert.equal(c.debut, "1995");
});

test("les deux dénominateurs sont donnés, jamais l'un seul", () => {
  // La part du PIB dit le poids dans l'économie, le par-habitant ce que ça
  // représente pour une personne. Les deux ne disent pas la même chose.
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /% du PIB/);
  assert.match(lu, /€ par personne et par an/);
  // Et le montant brut reste écrit en toutes lettres.
  assert.match(lu, /1\s?561,63 milliards d'euros/);
  assert.doesNotMatch(lu, /M€/);
});

test("le par-habitant dit qu'il n'est pas un prélèvement individuel", () => {
  // « 24 885 € par personne » se lit comme une facture si on ne dit pas que ce
  // sont des retraites, des soins et des salaires.
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /Elle ne leur est pas prélevée à chacun/);
});

test("rien n'est peint sans deux exercices", () => {
  assert.equal(rendu({}), "");
  const unSeul = {
    eurostat_apu_recettes: { "2025": 1 },
    eurostat_apu_depenses: { "2025": 2 },
    eurostat_pib_montant: { "2025": 3 },
    eurostat_population: { "2025": 4 },
  };
  assert.equal(rendu({ FR: territoire(unSeul) }), "");
});

test("la base est déclarée dans le module, pas enfouie dans un calcul", () => {
  const SOURCE = readFileSync(new URL("./ouverture.ts", import.meta.url), "utf8");
  assert.match(SOURCE, /const REFERENCE = "2017";/);
  // Et le piège est écrit : sans lui, le prochain lecteur changera la base sans
  // savoir qu'il change le signe.
  assert.match(SOURCE, /le signe s'inverse/i);
});
