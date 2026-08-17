/**
 * Le bloc des retraites. Les valeurs des fixtures sont celles que la DREES
 * publie pour l'exercice 2022, et le rapport cotisants/retraité celui de 2016 :
 * les millésimes différents sont le sujet, pas un détail.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Territoire } from "./donnees.ts";
import { rendu } from "./retraites.ts";

function territoire(series: Record<string, Record<string, number>>): Territoire {
  return { nom: "", parent: null, population: null, drapeaux: {}, series };
}

const SERIES = {
  drees_retraites_effectif: { "2021": 17733859, "2022": 17889187 },
  drees_pension_moyenne_brute: { "2021": 1482, "2022": 1565 },
  drees_pension_moyenne_brute_femmes: { "2022": 1241 },
  drees_pension_moyenne_brute_hommes: { "2022": 1933 },
  drees_pension_moyenne_nette: { "2022": 1457 },
  drees_age_depart: { "2022": 62.68 },
  drees_age_depart_femmes: { "2022": 63.0 },
  drees_age_depart_hommes: { "2022": 62.33 },
  drees_cotisants_par_retraite: { "2016": 1.721 },
};

const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

test("les quatre chiffres du débat sont à l'écran", () => {
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /17\s?889\s?187/);
  assert.match(lu, /1\s?565\s?€/);
  assert.match(lu, /62,7 ans/);
  assert.match(lu, /1,72/);
});

test("chaque mesure porte son millésime, parce qu'elles n'ont pas le même", () => {
  // Le rapport cotisants/retraité s'arrête en 2016 chez ce producteur ; les
  // effectifs vont à 2022. Une seule date en tête de tableau daterait le
  // premier de l'année du second.
  const html = rendu({ FR: territoire(SERIES) });
  assert.match(html, /1,72<\/td>\s*<td><span class="millesime">2016<\/span>/);
  assert.match(html, /<span class="millesime">2022<\/span>/);
});

test("une pension mensuelle ne s'écrit pas en millions d'euros", () => {
  const html = rendu({ FR: territoire(SERIES) });
  assert.doesNotMatch(html, /M€/);
});

test("l'écart entre les pensions des femmes et des hommes est calculé, pas laissé au lecteur", () => {
  // 1 241 / 1 933 : 35,8 % de moins. Deux nombres côte à côte ne disent pas
  // leur rapport.
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /35,8\s?% de moins/);
});

test("le mot « conjoncturel » ne disparaît pas de l'intitulé", () => {
  // Raccourci en « âge de départ », il ferait dire à la série l'âge auquel une
  // génération est partie — qui ne se connaît qu'après coup.
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /Âge conjoncturel moyen de départ/);
  assert.match(lu, /si les comportements de l'année duraient/);
});

test("brut et net sont distingués, et l'écart n'est pas appelé un impôt", () => {
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /1\s?457\s?€/);
  assert.match(lu, /CSG, la CRDS et la cotisation maladie/);
  assert.doesNotMatch(lu, /impôt sur le revenu/);
});

test("sans effectif ni pension publiés, rien n'est peint", () => {
  assert.equal(rendu({}), "");
  assert.equal(
    rendu({ FR: territoire({ drees_age_depart: { "2022": 62.68 } }) }),
    "",
  );
});

test("une mesure absente laisse sa ligne dehors, jamais une ligne vide", () => {
  const sansCotisants = { ...SERIES } as Record<string, Record<string, number>>;
  delete sansCotisants["drees_cotisants_par_retraite"];
  const html = rendu({ FR: territoire(sansCotisants) });
  assert.match(html, /Nombre de retraités/);
  assert.doesNotMatch(html, /Cotisants par retraité<\/th>/);
});

/* ---------------------------------------------------------------------- *
 * CE QU'UNE GÉNÉRATION RÉCUPÈRE                                           *
 * ---------------------------------------------------------------------- */

const AVEC_GENERATIONS = {
  ...SERIES,
  insee_retraite_taux_recuperation: {
    "1950": 158.57, "1960": 132.6, "1970": 119.24, "1985": 117.28,
  },
  insee_retraite_taux_prelevement: {
    "1950": 23.78, "1960": 26.72, "1970": 27.41, "1985": 27.92,
  },
};

test("la question se lit en euros pour 100 € cotisés, avec ses deux décimales", () => {
  // Le catalogue publie un pourcentage parce que l'INSEE le calcule ainsi ; la
  // question se pose en euros. Et 158,57 contre 117,28 se joue aux centimes.
  const lu = texte(rendu({ FR: territoire(AVEC_GENERATIONS) }));
  assert.match(lu, /158,57\s?€/);
  assert.match(lu, /117,28\s?€/);
  assert.match(lu, /Pour 100\s?€ cotisés/);
});

test("le tableau des générations s'annonce comme une projection, avant les nombres", () => {
  // Un calcul de modèle posé sans mention à côté de chiffres constatés ferait
  // passer une simulation pour un relevé.
  const lu = texte(rendu({ FR: territoire(AVEC_GENERATIONS) }));
  assert.match(lu, /Projection/);
  assert.match(lu, /Destinie 2/);
  assert.match(lu, /salariés du secteur privé/);
  assert.match(lu, /législation de 2014/);
  assert.match(lu, /réforme de 2023/);
  assert.match(lu, /G2015\/06/);
});

test("moins de trois générations ne font pas une pente", () => {
  const deux = {
    ...SERIES,
    insee_retraite_taux_recuperation: { "1950": 158.57, "1985": 117.28 },
    insee_retraite_taux_prelevement: { "1950": 23.78, "1985": 27.92 },
  };
  const html = rendu({ FR: territoire(deux) });
  assert.match(html, /Les retraites/);
  assert.doesNotMatch(html, /Pour 100/);
});

test("sans la série des générations, le reste du bloc tient", () => {
  const html = rendu({ FR: territoire(SERIES) });
  assert.match(html, /17\s?889\s?187/);
  assert.doesNotMatch(html, /Destinie/);
});
