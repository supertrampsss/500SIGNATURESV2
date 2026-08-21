/**
 * Les 100 € de toutes les administrations publiques.
 *
 * Les valeurs des fixtures sont celles d'Eurostat pour 2025, en euros : c'est
 * la seule façon de vérifier que les parts sont calculées sur les recettes et
 * non sur les dépenses — l'écart entre les deux étant précisément le sujet.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Territoire } from "./donnees.ts";
import { rendu } from "./cent-euros-apu.ts";

const Md = 1e9;
// Les valeurs RÉELLEMENT publiées, au dixième de million près, et non des
// arrondis commodes : un fixture arrondi affichait « 37,10 € » là où la
// production affiche « 37,11 € », c'est-à-dire faisait passer au vert un
// chiffre que personne ne verra jamais. C'est la faute exacte qu'un fixture de
// la redistribution avait déjà coûtée.
const SERIES: Record<string, Record<string, number>> = {
  eurostat_apu_recettes: { "2024": 1503.59 * Md, "2025": 1561.6261 * Md },
  eurostat_apu_depenses: { "2024": 1672.7108 * Md, "2025": 1714.1372 * Md },
  eurostat_apu_prestations: { "2025": 579.5423 * Md },
  eurostat_apu_remunerations: { "2025": 370.016 * Md },
  eurostat_apu_transferts_nature: { "2025": 191.4967 * Md },
  eurostat_apu_consommations: { "2025": 162.9945 * Md },
  eurostat_apu_investissement: { "2025": 131.6488 * Md },
  eurostat_apu_transferts_courants: { "2025": 94.0009 * Md },
  eurostat_apu_interets: { "2025": 66.6359 * Md },
  eurostat_apu_subventions: { "2025": 56.516 * Md },
  eurostat_apu_transferts_capital: { "2025": 41.563 * Md },
  eurostat_apu_cotisations: { "2025": 498.736 * Md },
  eurostat_apu_impots_production: { "2025": 470.392 * Md },
  eurostat_apu_impots_revenu: { "2025": 389.922 * Md },
  // La ventilation par fonction, aux valeurs d'Eurostat pour 2024 : elle
  // s'arrête un exercice plus tôt que les totaux, et c'est le sujet des deux
  // tests qui la vérifient.
  eurostat_apu_prestations_vieillesse: { "2024": 362.1784 * Md },
  eurostat_apu_prestations_maladie_invalidite: { "2024": 50.2514 * Md },
  eurostat_apu_prestations_chomage: { "2024": 40.6642 * Md },
  eurostat_apu_prestations_survivants: { "2024": 40.2548 * Md },
  eurostat_apu_prestations_famille: { "2024": 34.3586 * Md },
  eurostat_apu_prestations_exclusion: { "2024": 26.9809 * Md },
  eurostat_apu_prestations_logement: { "2024": 1.0353 * Md },
  eurostat_apu_prestations_ventilees: { "2024": 561.8784 * Md },
};

function territoire(series: Record<string, Record<string, number>>): Territoire {
  return { nom: "", parent: null, population: null, drapeaux: {}, series };
}

const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

test("le total encaissé s'écrit en toutes lettres, pas en sept rangs suivis d'un sigle", () => {
  // « 1 561 626 M€ » demande une conversion de tête et il faut être du métier
  // pour lire mille cinq cents milliards derrière deux lettres. C'est la règle
  // que `montantLisible` porte, et que ce bloc a d'abord enfreinte.
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /1\s?561,63\s?milliards d'euros/);
  assert.doesNotMatch(lu, /M€/);
});

test("les parts se rapportent aux recettes, donc leur somme dépasse 100 €", () => {
  // Ramenées à cent, elles feraient disparaître la seule chose que ce tableau
  // existe pour montrer : le déficit.
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /dépensé 109,77\s?€ pour chaque 100\s?€ reçus/);
  assert.match(lu, /9,77\s?€.{0,60}déficit public/);
});

test("les recettes s'écrivent en positif, les dépenses en négatif", () => {
  // La demande explicite du lecteur : une recette entre (+), une dépense sort
  // (−) — et les sous-lignes des retraites sont des dépenses, pas des gains.
  const html = rendu({ FR: territoire(SERIES) });
  assert.match(html, /flux--plus">\+31,94\s?€/);
  assert.match(html, /flux--moins">−24,09\s?€/);
  assert.match(html, /flux--moins">−109,77\s?€/);
  // Et l'emprunt garde ses hachures — une texture, jamais une couleur.
  assert.match(html, /apu__piste--creux/);
});

test("le reste non détaillé est une ligne, jamais un silence", () => {
  // Neuf postes nommés ne font pas la dépense entière ; la soustraction est
  // écrite plutôt que laissée au lecteur.
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /Autres dépenses/);
  // 1 714,1372 − la somme des neuf postes = 19,62 Md€, soit 1,26 € pour 100.
  assert.match(lu, /Autres dépenses −1,26\s?€/);
});

test("la source est une ligne courte sous le tableau, pas une légende au-dessus", () => {
  // La légende vivait au-dessus du tableau et expliquait aussi ce qui sépare
  // ce tableau des deux autres « 100 € » du site — utile tant qu'ils
  // vivaient sur la même page, plus maintenant qu'ils en sont partis. La
  // source, elle, se tient courte et sous le tableau, comme partout ailleurs
  // sur le site.
  const html = rendu({ FR: territoire(SERIES) });
  assert.doesNotMatch(html, /<caption>/);
  assert.match(html, /<\/table>\s*<p class="bloc__complement">Source : Eurostat\.<\/p>/);
  const lu = texte(html);
  assert.doesNotMatch(lu, /ne se soustrait ni des/);
  assert.doesNotMatch(lu, /100\s?€ de prestations sociales/);
});

test("les recettes se décomposent aussi, reste compris", () => {
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /Cotisations sociales/);
  assert.match(lu, /Ventes de services et autres recettes/);
  // 498,7 + 470,4 + 389,9 = 1 359 sur 1 561,6, soit 12,97 € de reste — en
  // positif : une recette entre.
  assert.match(rendu({ FR: territoire(SERIES) }), />\+12,97\s?€</);
});

test("le premier poste s'ouvre, et la retraite n'y pèse pas ce que le libellé suggère", () => {
  // « Retraites, chômage, allocations » mettait dans un seul nombre trois
  // choses qui n'ont ni le même montant, ni le même public. Séparées, la
  // retraite pèse NEUF fois le chômage — dit dans l'introduction du chapitre,
  // pas dans le dépliant — et chaque sous-ligne est une dépense : négative.
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  assert.match(lu, /la retraite pèse neuf fois le chômage/i);
  for (const attendu of [
    /Retraites −24,09\s?€/,
    /Arrêts maladie et invalidité −3,34\s?€/,
    /Chômage −2,70\s?€/,
    /Pensions de réversion −2,68\s?€/,
    /Famille et enfants −2,29\s?€/,
    /RSA et autres minima sociaux −1,79\s?€/,
  ]) {
    assert.match(lu, attendu);
  }
  // Le reste de la ventilation est écrit, comme celui du bloc principal :
  // 561,8784 − la somme des sept fonctions = 6,155 Md€, soit 0,41 € pour 100.
  assert.match(lu, /hors protection sociale.{0,60}−0,41\s?€/);
});

test("aucune ligne « Retraites, chômage, allocations » ne résume plus les sept fonctions", () => {
  // Le repli forçait à cliquer pour voir sept lignes qui pèsent plus du tiers
  // de la dépense publique. Il est parti : ni le repli, ni un total à part
  // pour le poste qu'il résumait, seulement les sept fonctions au même niveau
  // que les huit autres postes.
  const html = rendu({ FR: territoire(SERIES) });
  assert.doesNotMatch(html, /<details/);
  assert.doesNotMatch(html, /apu__ouvrir/);
  assert.doesNotMatch(html, /37,11/);
  assert.doesNotMatch(html, /37,37/);
  assert.doesNotMatch(html, /Ensemble du poste/);
  assert.doesNotMatch(html, /Retraites, chômage, allocations/);
});

test("la ventilation n'existe qu'une fois : le doublon est mort", () => {
  // Elle était peinte en barres PUIS réécrite en tableau — mêmes chiffres,
  // deux fois — et le lecteur l'a refusé. Chaque valeur n'apparaît qu'une
  // fois, directement dans le flux des postes.
  const html = rendu({ FR: territoire(SERIES) });
  assert.equal(html.split("24,09").length - 1, 1, "24,09 € écrit plus d'une fois");
  assert.equal(html.split("2,70").length - 1, 1, "2,70 € écrit plus d'une fois");
  assert.doesNotMatch(html, /ce que recouvre le poste<\/h4>/);
});

test("le rapport des barres est celui des nombres, sur toute la liste triée", () => {
  // « 24,09 » posé au-dessus de « 2,70 » ne dit pas NEUF FOIS : la barre le
  // dit. La liste « Où ils vont » est désormais triée du plus lourd au plus
  // léger et toutes les feuilles partagent une seule échelle — la plus grande
  // occupe la piste, et le rapport dessiné entre deux barres est celui des
  // nombres.
  const html = rendu({ FR: territoire(SERIES) });
  const barre = (nom: string): number => {
    const i = html.indexOf(`>${nom}<`);
    const m = html.slice(i).match(/width:([0-9.]+)%/);
    return m ? Number(m[1]) : NaN;
  };
  // La plus grande dépense (Retraites, 24,09) occupe toute la piste.
  assert.equal(barre("Retraites"), 100);
  // Chômage (2,70) : sa barre est dans le rapport 2,70 / 24,09 de celle des
  // retraites — le même dénominateur pour toute la liste.
  assert.ok(
    Math.abs(barre("Chômage") / barre("Retraites") - 2.7 / 24.09) < 0.01,
    `rapport dessiné ${barre("Chômage") / barre("Retraites")}, rapport des nombres ${2.7 / 24.09}`,
  );
});

test("« Où ils vont » se lit du plus lourd au plus léger, fonctions et postes mêlés", () => {
  // Demande du propriétaire : la liste était scindée — les sept fonctions du
  // premier poste d'abord, puis les huit autres postes — et zigzaguait
  // (24,09 puis des petites, puis 23,69). Elle est désormais un seul tri
  // décroissant. Retraites (24,09) puis Rémunération des agents publics
  // (23,69) se suivent, et aucune valeur de barre ne remonte.
  const html = rendu({ FR: territoire(SERIES) });
  const colonne = html.slice(html.indexOf("Où ils vont"), html.indexOf("Total dépensé"));
  const montants = [...colonne.matchAll(/flux--moins">−([0-9]+,[0-9]{2})/g)].map((m) =>
    Number(m[1].replace(",", ".")),
  );
  assert.ok(montants.length >= 10, `trop peu de feuilles : ${montants.length}`);
  for (let i = 1; i < montants.length; i += 1) {
    assert.ok(montants[i] <= montants[i - 1], `ordre rompu à ${montants[i - 1]} → ${montants[i]}`);
  }
  // Les deux plus gros, dans le bon ordre.
  assert.equal(montants[0], 24.09);
  assert.equal(montants[1], 23.69);
});

test("la ventilation reste calculée sur son propre exercice, même si la mention n'est plus affichée", () => {
  // Deux jeux de la même source, deux millésimes : la ventilation s'arrête en
  // 2024 quand les totaux donnent 2025. Redistribuer les 37,11 € de 2025 sur
  // des clés de 2024 aurait donné un tableau qui tombe juste et qui ment — le
  // calcul reste correct même si la phrase qui le disait a été retirée.
  const lu = texte(rendu({ FR: territoire(SERIES) }));
  // 362,1784 / 1 503,59 = 24,09 €. Sur les recettes de 2025 il aurait affiché
  // 23,19 € : c'est cette valeur-là que le tableau ne doit jamais porter.
  assert.doesNotMatch(lu, /Retraites 23,19\s?€/);
  assert.match(lu, /Retraites −24,09\s?€/);
});

test("sans ses sept fonctions, la ventilation se tait plutôt que d'en montrer six", () => {
  const ampute = { ...SERIES } as Record<string, Record<string, number>>;
  delete ampute["eurostat_apu_prestations_chomage"];
  const lu = texte(rendu({ FR: territoire(ampute) }));
  assert.doesNotMatch(lu, /Arrêts maladie/);
  // Mais le bloc principal, lui, reste servi — le poste sans son dépliant.
  assert.match(lu, /Total dépensé −109,77\s?€/);
});

test("un exercice sans ses deux totaux n'est pas retenu", () => {
  // 2024 porte recettes et dépenses mais aucun poste : le bloc prend le dernier
  // exercice qui a les deux totaux, et se tait si les postes lui manquent.
  const sansPostes = {
    eurostat_apu_recettes: SERIES.eurostat_apu_recettes,
    eurostat_apu_depenses: SERIES.eurostat_apu_depenses,
  };
  assert.equal(rendu({ FR: territoire(sansPostes) }), "");
});

test("rien n'est peint sans les deux totaux", () => {
  assert.equal(rendu({}), "");
  const sansDepenses = { ...SERIES } as Record<string, Record<string, number>>;
  delete sansDepenses["eurostat_apu_depenses"];
  assert.equal(rendu({ FR: territoire(sansDepenses) }), "");
});

test("l'historique montre la part des cinq plus gros postes, année par année", () => {
  const Md = 1e9;
  // Deux exercices pour chaque poste, plus les totaux : de quoi tracer.
  const deuxAns: Record<string, Record<string, number>> = {
    eurostat_apu_recettes: { "2024": 1500 * Md, "2025": 1560 * Md },
    eurostat_apu_depenses: { "2024": 1670 * Md, "2025": 1714 * Md },
    eurostat_apu_prestations: { "2024": 560 * Md, "2025": 580 * Md },
    eurostat_apu_remunerations: { "2024": 360 * Md, "2025": 370 * Md },
    eurostat_apu_transferts_nature: { "2024": 185 * Md, "2025": 191 * Md },
    eurostat_apu_consommations: { "2024": 158 * Md, "2025": 163 * Md },
    eurostat_apu_investissement: { "2024": 128 * Md, "2025": 132 * Md },
    eurostat_apu_transferts_courants: { "2024": 90 * Md, "2025": 94 * Md },
    eurostat_apu_interets: { "2024": 55 * Md, "2025": 66 * Md },
    eurostat_apu_subventions: { "2024": 54 * Md, "2025": 56 * Md },
    eurostat_apu_transferts_capital: { "2024": 40 * Md, "2025": 46 * Md },
  };
  const html = rendu({ FR: territoire(deuxAns) });
  assert.match(html, /Comment la dépense se répartit, depuis 2024/);
  assert.match(html, /class="graphique__dessin"/);
  // Cinq lignes, les cinq plus gros postes au dernier exercice, jamais plus —
  // la gamme validée n'en sépare proprement pas davantage.
  assert.equal((html.match(/class="graphique__legende-item"/g) ?? []).length, 5);
  // La légende ne porte que les cinq — « Intérêts de la dette » (6e) reste
  // dans les barres au-dessus mais pas dans les lignes de la courbe.
  const legende = html.slice(html.indexOf("graphique__legende"));
  assert.match(legende, /Retraites, chômage, allocations/);
  assert.doesNotMatch(legende, /Intérêts de la dette/);
  // Une part, pas des euros : l'axe est en %.
  assert.match(html, /Part de chaque poste dans la dépense publique totale, en %/);
});

test("l'historique se tait sur un seul exercice : une courbe d'un point n'en est pas une", () => {
  // Le fixture principal ne porte les postes que pour 2025 : pas d'historique.
  const html = rendu({ FR: territoire(SERIES) });
  assert.doesNotMatch(html, /Comment la dépense se répartit/);
  assert.doesNotMatch(html, /class="graphique__dessin"/);
});
