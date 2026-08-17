/**
 * Le groupe de communes semblables, composé dans le navigateur.
 *
 * Ce que ces contrôles gardent tient en trois refus : ne pas comparer une
 * commune à un groupe trop petit pour dire quoi que ce soit, ne pas la ranger
 * avec des communes qui ne lui ressemblent pas sur un critère manquant, et ne
 * jamais nommer un groupe avec un code de strate que personne ne lit.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { IndexTerritoires } from "./repertoire.ts";
import { groupeDe, intituleGroupe, type Semblables } from "./semblables.ts";

const LIBELLES = {
  tranche_population: {
    "3": "de 500 à 2 000 habitants",
    "10": "de 100 000 habitants et plus",
  },
  rural: { Oui: "rurales", Non: "urbaines" },
  outre_mer: { Oui: "d'outre-mer", Non: "de métropole" },
  montagne: { Oui: "de montagne", Non: "hors montagne" },
  touristique: { Oui: "touristiques", Non: "non touristiques" },
};

const CASCADE = [
  ["tranche_population", "rural", "outre_mer", "montagne", "touristique"],
  ["tranche_population", "rural", "outre_mer"],
  ["tranche_population", "outre_mer"],
];

/** Un index d'essai : une clé par commune, dans l'ordre de `CASCADE[0]`. */
function index(cles: (string | null)[], minimum = 20): IndexTerritoires {
  const distinctes = [...new Set(cles.filter((c): c is string => c !== null))];
  const semblables: Semblables = {
    cascade: CASCADE,
    minimum,
    libelles: LIBELLES,
    cles: distinctes,
    groupe: cles.map((cle) => (cle === null ? null : distinctes.indexOf(cle))),
  };
  return {
    denominateur: "ofgl_population_reference",
    periodes: ["2025"],
    unite: "habitants",
    millesime_geographique: 2025,
    codes: cles.map((_, i) => `c${String(i).padStart(3, "0")}`),
    noms: cles.map((_, i) => `Ville ${i}`),
    parents: cles.map(() => "33"),
    population_municipale: cles.map(() => 1000),
    population_reference: cles.map(() => [1000]),
    semblables,
  };
}

/** `n` communes de la même clé. */
const meme = (n: number, cle: string) => Array.from({ length: n }, () => cle);

const ORDINAIRE = "3|Oui|Non|Non|Non";
const ATYPIQUE = "3|Oui|Non|Oui|Oui";

test("le groupe le plus fin est retenu dès qu'il atteint l'effectif minimal", () => {
  const i = index(meme(25, ORDINAIRE));
  const groupe = groupeDe(i, "c000");
  assert.ok(groupe);
  assert.deepEqual(groupe.criteres, CASCADE[0]);
  assert.equal(groupe.codes.size, 25);
  // Le territoire fait partie de son propre groupe : « 25 communes
  // semblables » les compte toutes, celle qu'on lit comprise.
  assert.ok(groupe.codes.has("c000"));
  assert.equal(
    intituleGroupe(groupe),
    "de 500 à 2 000 habitants, rurales, de métropole, hors montagne, non touristiques",
  );
});

test("une commune atypique retombe sur un jeu plus large, elle ne perd pas son repère", () => {
  // Trois communes de montagne et touristiques : leur groupe fin en compte
  // trois, où la médiane bougerait d'un tiers si l'une d'elles changeait de
  // politique. Le jeu suivant les range avec les vingt-cinq autres communes
  // rurales de la même strate.
  const i = index([...meme(3, ATYPIQUE), ...meme(25, ORDINAIRE)]);
  const groupe = groupeDe(i, "c000");
  assert.ok(groupe);
  assert.deepEqual(groupe.criteres, CASCADE[1]);
  assert.equal(groupe.codes.size, 28);
  assert.equal(intituleGroupe(groupe), "de 500 à 2 000 habitants, rurales, de métropole");
});

test("le jeu le plus large lui-même trop petit ne peint rien", () => {
  // Un groupe de douze ne compare plus : la publication l'écarte déjà de ses
  // quartiles, et la règle vaut ici mot pour mot.
  assert.equal(groupeDe(index(meme(12, ORDINAIRE)), "c000"), null);
});

test("un critère manquant vaut absence de groupe, jamais un groupe approché", () => {
  // Composer sur quatre critères au lieu de cinq rangerait la commune avec
  // d'autres qui ne lui ressemblent pas sur le cinquième, sans que rien ne le
  // dise. La publication met `null` ; le site n'en fait pas un groupe.
  const i = index([null, ...meme(25, ORDINAIRE)]);
  assert.equal(groupeDe(i, "c000"), null);
  // Et les vingt-cinq autres gardent le leur — la commune sans critères n'y
  // entre pas.
  const autre = groupeDe(i, "c001");
  assert.ok(autre);
  assert.equal(autre.codes.size, 25);
});

test("une valeur sans intitulé ne produit pas « groupe 11 »", () => {
  // Une strate de plus chez le producteur, un « Oui » qui deviendrait « oui » :
  // le groupe ne se nomme plus. Il se tait plutôt que de s'écrire en code — un
  // repère illisible est pire qu'un repère manquant. Ici les vingt-cinq
  // communes sont d'une strate « 11 » que `LIBELLES` ne connaît pas, et les
  // deux jeux plus larges portent la même valeur : rien n'est peint.
  const i = index(meme(25, "11|Oui|Non|Non|Non"));
  assert.equal(groupeDe(i, "c000"), null);
});

test("une maille sans critères publiés n'a pas de groupe", () => {
  // L'OFGL n'en publie que pour les communes : un département n'a pas de
  // strate de population, et lui en inventer une serait une comparaison dont
  // ce site ne contrôle pas la définition.
  const i = index(meme(25, ORDINAIRE));
  delete i.semblables;
  assert.equal(groupeDe(i, "c000"), null);
  // Même chose pour un code absent de l'index.
  assert.equal(groupeDe(index(meme(25, ORDINAIRE)), "inconnu"), null);
});

test("deux clés qui ne diffèrent que par un critère écarté se rejoignent au bon rang", () => {
  // Le jeu le plus large ne retient que la strate et l'outre-mer : les
  // communes rurales et urbaines de la même strate y tombent ensemble, et
  // seulement là. C'est la propriété qui autorise à ne publier qu'une clé par
  // territoire — chaque jeu est un sous-ensemble du premier.
  const i = index([...meme(12, "3|Oui|Non|Non|Non"), ...meme(12, "3|Non|Non|Non|Non")]);
  const groupe = groupeDe(i, "c000");
  assert.ok(groupe);
  assert.deepEqual(groupe.criteres, CASCADE[2]);
  assert.equal(groupe.codes.size, 24);
  assert.equal(intituleGroupe(groupe), "de 500 à 2 000 habitants, de métropole");
});
