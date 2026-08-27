/**
 * Les recettes de l'État avec leur évolution : deux bouts et une variation.
 *
 * Les valeurs sont celles de la situation mensuelle budgétaire, au dixième de
 * milliard : un fixture arrondi ferait passer au vert un chiffre que personne
 * ne verra.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Indicateur, Territoire } from "./donnees.ts";
import { lignes, rendu } from "./recettes-etat.ts";

const Md = 1e9;
const SERIES: Record<string, Record<string, number>> = {
  etat_tva: { "2013": 141.2 * Md, "2017": 152.4 * Md, "2025": 98.0741 * Md },
  etat_impot_revenu: { "2013": 67.0 * Md, "2017": 73.0 * Md, "2025": 94.9443 * Md },
  etat_impot_societes: { "2013": 47.2 * Md, "2017": 35.7 * Md, "2025": 59.9181 * Md },
  etat_ticpe: { "2013": 13.0 * Md, "2017": 10.1 * Md, "2025": 16.2767 * Md },
  etat_recettes_fiscales: { "2013": 284.0 * Md, "2017": 295.6 * Md, "2025": 356.398 * Md },
  etat_recettes_non_fiscales: { "2013": 13.7 * Md, "2017": 13.8 * Md, "2025": 23.9921 * Md },
  etat_recettes_nettes_bg: { "2013": 297.7 * Md, "2017": 309.5 * Md, "2025": 380.3903 * Md },
  eurostat_prix_ensemble: { "2017": 101.47, "2025": 124.43 },
};

const CATALOGUE = [
  "etat_tva",
  "etat_impot_revenu",
  "etat_impot_societes",
  "etat_ticpe",
  "etat_recettes_fiscales",
  "etat_recettes_non_fiscales",
  "etat_recettes_nettes_bg",
].map((id) => ({ id, libelle: id })) as unknown as Indicateur[];

const territoire = (series: Record<string, Record<string, number>>): Territoire => ({
  nom: "", parent: null, population: null, drapeaux: {}, series,
});
const texte = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ").trim();

test("chaque évolution donne ses deux bouts : 2017, 2025, puis la variation", () => {
  // « +30 % depuis 2017 » sans le montant de 2017 ne se vérifie pas — c'est
  // le reproche du lecteur sur la maquette, et la raison d'être du module.
  const lu = texte(rendu({ FR: territoire(SERIES) }, CATALOGUE));
  assert.match(lu, /2017 2025 Variation/);
  assert.match(lu, /Impôt sur le revenu \+73 \+95 \+30,1 %/);
  assert.match(lu, /Impôt sur les sociétés \+36 \+60 \+67,8 %/);
  assert.match(lu, /Taxe sur les produits énergétiques \(TICPE\) \+10 \+16 \+61,2 %/);
  assert.match(lu, /Total encaissé par l'État \+310 \+380 \+22,9 %/);
});

test("la TVA ne porte pas de variation nue : sa note de périmètre la remplace", () => {
  // 152 → 98 milliards : −35,7 %, et ce n'est PAS une baisse d'impôt — une
  // part croissante est reversée à la Sécurité sociale et aux collectivités.
  // La variation nue aurait fait lire un effondrement qui n'existe pas. La
  // note tient en une ligne, dans la colonne Variation elle-même — pas sous
  // le libellé, où elle poussait la ligne sur deux hauteurs de texte.
  const html = rendu({ FR: territoire(SERIES) }, CATALOGUE);
  const rangTva = html.slice(html.indexOf("Taxe sur la valeur ajoutée"), html.indexOf("</tr>", html.indexOf("Taxe sur la valeur ajoutée")));
  assert.doesNotMatch(rangTva, /−35,7/);
  assert.match(rangTva, /recettes__note">une part croissante est reversée</);
  // Les deux bouts, eux, restent écrits : le lecteur voit 152 puis 98.
  assert.match(rangTva, /\+152/);
  assert.match(rangTva, /\+98/);
});

test("les recettes s'écrivent en positif, du plus gros au plus petit", () => {
  const html = rendu({ FR: territoire(SERIES) }, CATALOGUE);
  assert.match(html, /flux--plus">\+98/);
  assert.doesNotMatch(texte(html), /−9[48],/);
  // Le tri suit le dernier exercice, et la hiérarchie typographique le suit :
  // le rang 0 est la TVA.
  const rangs = [...html.matchAll(/recettes__rang--(\d)/g)].map((m) => Number(m[1]));
  assert.deepEqual(rangs, [0, 1, 2, 3, 4, 5]);
  assert.ok(html.indexOf("Taxe sur la valeur ajoutée") < html.indexOf("Impôt sur le revenu"));
});

test("un reste par soustraction n'affiche pas de variation", () => {
  // Mesuré sur les séries réelles : une fois la TICPE sortie et nommée, ce
  // qui reste (« Autres recettes fiscales ») plus que triple entre 2017 et
  // 2025. La variation nue en tête de tableau ne se lit pas — la ligne prend
  // une note, ses deux bouts restent écrits.
  const html = rendu({ FR: territoire(SERIES) }, CATALOGUE);
  const depart = html.indexOf("Autres recettes fiscales", html.indexOf("<tbody"));
  const rang = html.slice(depart, html.indexOf("</tr>", depart));
  assert.doesNotMatch(rang, /\+\d+,\d\s?%/u);
  assert.match(rang, /recettes__note">composition en évolution</);
});

test("le total est la série publiée, jamais la somme des lignes", () => {
  const donnees = lignes(territoire(SERIES));
  assert.ok(donnees);
  assert.equal(donnees.total.apres, 380.3903 * Md);
  // « Autres recettes fiscales » est la soustraction déclarée : fiscales
  // moins les trois impôts nommés et la TICPE, elle aussi nommée.
  const autres = donnees.lignes.find((l) => l.libelle === "Autres recettes fiscales");
  assert.ok(autres);
  assert.ok(
    Math.abs(autres.apres - (356.398 - 98.0741 - 94.9443 - 59.9181 - 16.2767) * Md) < 1e-3,
  );
  const ticpe = donnees.lignes.find((l) => l.libelle.includes("TICPE"));
  assert.ok(ticpe);
  assert.equal(ticpe.apres, 16.2767 * Md);
});

test("l'inflation de la même fenêtre cadre la hausse, et se tait sans indice", () => {
  // +22,9 % de recettes pendant +22,6 % de prix : « elles n'ont presque pas
  // bougé » est la lecture, et elle n'est écrite qu'avec l'indice publié.
  const lu = texte(rendu({ FR: territoire(SERIES) }, CATALOGUE));
  assert.match(lu, /pendant que les prix montaient de 22,6 %/);
  const sans = { ...SERIES };
  delete sans["eurostat_prix_ensemble"];
  const luSans = texte(rendu({ FR: territoire(sans) }, CATALOGUE));
  assert.doesNotMatch(luSans, /les prix montaient/);
  assert.match(luSans, /\+22,9 %/);
});

test("la base retombe sur le premier exercice commun quand 2017 manque", () => {
  const tronquees = Object.fromEntries(
    Object.entries(SERIES).map(([id, s]) => [
      id,
      Object.fromEntries(Object.entries(s).filter(([an]) => an !== "2017")),
    ]),
  );
  const donnees = lignes(territoire(tronquees));
  assert.ok(donnees);
  assert.equal(donnees.debut, "2013");
});

test("rien ne s'écrit sans le catalogue ou sans deux exercices", () => {
  assert.equal(rendu({ FR: territoire(SERIES) }, []), "");
  const seul = Object.fromEntries(
    Object.entries(SERIES).map(([id, s]) => [id, { "2025": s["2025"] ?? 1 }]),
  );
  assert.equal(rendu({ FR: territoire(seul) }, CATALOGUE), "");
});

test("la TVA est expliquée en clair à côté du tableau, pas seulement notée dans la cellule", () => {
  // « Part reversée en hausse » seul laissait le lecteur avec sa question —
  // « la TVA sert à financer autre chose ? ». Le mécanisme est écrit en
  // toutes lettres : la taxe ne baisse pas, une part croissante est reversée
  // à la Sécurité sociale et aux collectivités, le tableau ne compte que la
  // part gardée par l'État.
  const html = rendu({ FR: territoire(SERIES) }, CATALOGUE);
  assert.match(html, /La TVA semble s'effondrer dans ce tableau/);
  assert.match(html, /reversée chaque année à la Sécurité sociale et aux\s+collectivités/);
  assert.match(html, /ne compte que la part que l'État garde pour lui/);
});
