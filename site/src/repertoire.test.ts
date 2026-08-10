/**
 * L'index de la maille est ce qui divise la carte : s'il rend le mauvais
 * dénominateur, la choroplèthe est fausse sans être vide — le pire des deux
 * mondes. Et s'il n'est pas là, le site doit continuer d'afficher quelque
 * chose.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import {
  nomsDuRepertoire,
  ouvrirRepertoire,
  populationsDuRepertoire,
  type IndexTerritoires,
} from "./repertoire.ts";

const INDEX: IndexTerritoires = {
  denominateur: "ofgl_population_reference",
  periodes: ["2021", "2022"],
  unite: "habitants",
  millesime_geographique: 2025,
  codes: ["33063", "33281", "33999"],
  noms: ["Bordeaux", "Mérignac", "Sans référence"],
  parents: ["33", "33", "33"],
  population_municipale: [260958, 72099, 1200],
  population_reference: [
    [250000, 260958],
    [70000, 72099],
    [null, null],
  ],
};

test("les noms sont rendus par code", () => {
  assert.deepEqual(nomsDuRepertoire(INDEX), {
    "33063": "Bordeaux",
    "33281": "Mérignac",
    "33999": "Sans référence",
  });
});

test("le dénominateur est celui de l'exercice affiché", () => {
  // Une dépense de 2021 se rapporte aux habitants de 2021 : prendre la colonne
  // voisine ferait une carte plausible et fausse.
  assert.equal(populationsDuRepertoire(INDEX, "2021")["33063"], 250000);
  assert.equal(populationsDuRepertoire(INDEX, "2022")["33063"], 260958);
});

test("un exercice sans référence retombe sur la population municipale", () => {
  // Même règle que sur une fiche (`populationDeReference`) : mieux vaut un
  // dénominateur approché qu'un trou, et les deux endroits doivent diviser par
  // le même nombre.
  assert.equal(populationsDuRepertoire(INDEX, "2021")["33999"], 1200);
  // Une période hors de l'index — un indicateur trimestriel, un millésime plus
  // ancien que la série de population — se rapporte au référentiel.
  const trimestre = populationsDuRepertoire(INDEX, "2024T3");
  assert.equal(trimestre["33063"], 260958);
  assert.equal(trimestre["33281"], 72099);
});

test("un territoire sans aucun dénominateur est absent de la table", () => {
  // Absent, pas à zéro : la carte le laisse en gris et le tableau l'écarte,
  // au lieu de le classer premier avec une valeur infinie.
  const sans: IndexTerritoires = {
    ...INDEX,
    codes: ["97612"],
    noms: ["Mamoudzou"],
    parents: ["976"],
    population_municipale: [null],
    population_reference: [[null, null]],
  };
  assert.deepEqual(populationsDuRepertoire(sans, "2022"), {});
});

test("l'index est lu quand il est publié", async () => {
  const repertoire = await ouvrirRepertoire("commune", async (niveau) => {
    assert.equal(niveau, "commune");
    return INDEX;
  });
  assert.equal(repertoire?.niveau, "commune");
  assert.equal(repertoire?.noms["33063"], "Bordeaux");
});

test("une publication sans index ne renvoie pas d'erreur mais un repli", async () => {
  // Le site en ligne lit `derniere.json` : une publication antérieure à ce
  // fichier peut être servie le temps d'un run. `null` dit à l'appelant de
  // retomber sur les lots — pas de carte vide, pas d'exception.
  const absent = await ouvrirRepertoire("commune", async () => {
    throw new Error("territoires/commune/index.json indisponible (404)");
  });
  assert.equal(absent, null);
});

test("un index vide ne rend ni nom ni dénominateur", () => {
  // Le cas d'une maille publiée sans territoire : le site doit tenir, pas
  // lancer sur `undefined`.
  const vide: IndexTerritoires = {
    ...INDEX,
    codes: [],
    noms: [],
    parents: [],
    population_municipale: [],
    population_reference: [],
  };
  assert.deepEqual(nomsDuRepertoire(vide), {});
  assert.deepEqual(populationsDuRepertoire(vide, "2022"), {});
});

test("un code ne désigne un territoire qu'avec sa maille", () => {
  // « 75 » est le département de Paris *et* la région Nouvelle-Aquitaine. Les
  // deux tables du site — les mailles chargées et les mailles parentes —
  // vivaient indexées par le code nu, et la dernière maille chargée écrasait la
  // précédente : la fiche de Paris annonçait « Commune · Nouvelle-Aquitaine ».
  // Quatorze départements portent un code qui est aussi un code de région.
  const MAIN = fs.readFileSync(new URL("./main.ts", import.meta.url), "utf8");
  // Les deux tables se remplissent par la clé composite, jamais par le code.
  assert.match(MAIN, /entites = \{ \.\.\.entites, \.\.\.cleParMaille\(paquet, niveau\) \}/);
  assert.match(MAIN, /\.\.\.cleParMaille\(dep as Record<string, Territoire>, "departement"\)/);
  assert.match(MAIN, /\.\.\.cleParMaille\(reg as Record<string, Territoire>, "region"\)/);
  // Et plus aucune lecture par code nu : elles passent toutes par un lecteur
  // qui exige la maille.
  assert.doesNotMatch(MAIN, /entites\[code\]/);
  assert.doesNotMatch(MAIN, /parents\[code\]/);
  assert.doesNotMatch(MAIN, /parents\["FR"\]/);
  assert.doesNotMatch(MAIN, /entites\[territoire\./);
  assert.match(MAIN, /function entiteDe\(code: string, niveau: string\)/);
  assert.match(MAIN, /function parentDe\(code: string \| null \| undefined, niveau: string\)/);
});
