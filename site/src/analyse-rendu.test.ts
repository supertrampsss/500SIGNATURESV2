/**
 * Le rendu d'une analyse : quatre étages, du plus rapide au plus profond.
 *
 * L'analyse de test reprend le premier fichier réel du dépôt (défense 2025,
 * `hors_perimetre` / `vote_execute`) et une variante minimale pour les cas que
 * ce fichier ne couvre pas (cran `exact`, auteur `null`, budget vide…).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { Analyse, Confusion, QualificationVerdict } from "./analyse-rendu.ts";
import {
  filtrerAnalyses,
  LIBELLE_CONFUSION,
  LIBELLE_CRAN,
  LIBELLE_QUALIFICATION,
  qualificationVerdict,
  rendu,
  renduIndex,
} from "./analyse-rendu.ts";
import { citable, citer, type Citation } from "./citer.ts";
import { formater } from "./echelle.ts";
import { construireRegistre, indexerSources } from "./registre-sources.ts";

const CATALOGUE = [
  { id: "etat_mission_defense_credits_votes", unite: "EUR" },
  { id: "etat_mission_defense_credits_consommes", unite: "EUR" },
] as never[];

// Catalogue pour les fixtures qui mélangent les registres — distinct de
// CATALOGUE ci-dessus pour porter un `jeu`, comme le ferait un vrai catalogue.
// Ce champ n'est plus lu par l'étage 4 (Critical A, voir analyse-rendu.ts) :
// il reste dans la fixture pour prouver que sa présence ne fait rien
// réapparaître.
const CATALOGUE_MIXTE = [
  { id: "test_indicateur_vote", unite: "EUR", jeu: "jeu-test" },
  { id: "test_indicateur_consomme", unite: "EUR", jeu: "jeu-test" },
] as never[];

// L'analyse réelle du dépôt, chargée telle que publiée : le rendu doit la
// tenir sans transformation.
const DEFENSE: Analyse = JSON.parse(
  readFileSync(
    new URL("../analyses/defense-credits-votes-consommes-2025.json", import.meta.url),
    "utf8",
  ),
);

/** Une analyse minimale, pour les cas que le fichier réel ne couvre pas. */
function analyseMinimale(overrides: Partial<Analyse> = {}): Analyse {
  return {
    slug: "test-minimale",
    titre: "Titre de test",
    type: "verification_chiffre",
    publie_le: "2026-01-01",
    themes: ["budget_etat"],
    budgets_concernes: ["etat"],
    mise_en_avant: false,
    affirmation: {
      texte: "<script>alert(1)</script> Un chiffre couramment répété.",
      auteur: null,
      date: null,
      source: { titre: "Source de test", url: "https://exemple.test", consulte_le: "2026-01-01" },
    },
    verdict: { cran: "exact", phrase: "Le chiffre correspond aux comptes publiés." },
    chiffres: [
      {
        dit: "environ 60 milliards",
        observe: {
          indicateur: "etat_mission_defense_credits_votes",
          niveau: "pays",
          code: "FR",
          periode: "2025",
          valeur: 59946338573.0,
        },
        registre: "fait_comptable",
        lecture: "Les crédits votés.",
      },
    ],
    hypotheses: [],
    effets_indirects: [],
    sources: [
      { titre: "Source de test", url: "https://exemple.test", consulte_le: "2026-01-01" },
    ],
    simulateur: { budget: "", contrat: "", lecture: "Rien à rejouer pour cette analyse." },
    mises_a_jour: [],
    verifie_contre: "",
    ...overrides,
  } as Analyse;
}

/**
 * Une analyse qui mélange les registres — deux `fait_comptable` observés sur
 * deux exercices différents, et une `interpretation` sans `observe` — avec un
 * `dit` distinct sur chaque chiffre. Les treize tests d'origine ne
 * couvraient qu'un seul registre à la fois et qu'un seul exercice par
 * chiffre : c'est cette variété absente qui laissait passer les trois
 * défauts fermés par cette vague (findings 1 à 3).
 */
function analyseMixte(overrides: Partial<Analyse> = {}): Analyse {
  return analyseMinimale({
    slug: "mixte-test",
    chiffres: [
      {
        dit: "à peu près 45 milliards d'euros",
        observe: {
          indicateur: "test_indicateur_vote",
          niveau: "pays",
          code: "FR",
          periode: "2019",
          valeur: 44987654321.5,
        },
        registre: "fait_comptable",
        lecture: "Les crédits votés en 2019.",
      },
      {
        dit: "un peu plus de 50 milliards d'euros",
        observe: {
          indicateur: "test_indicateur_consomme",
          niveau: "pays",
          code: "FR",
          periode: "2025",
          valeur: 50123456789.12,
        },
        registre: "fait_comptable",
        lecture: "Les crédits consommés en 2025.",
      },
      {
        dit: "de l'ordre de 5 milliards selon plusieurs instituts",
        registre: "interpretation",
        lecture: "Un rapprochement qui n'est publié par aucun fichier.",
      },
    ],
    ...overrides,
  });
}

test("une provenance mène à la fiche exacte du registre", () => {
  const analyse = analyseMinimale();
  const fiches = construireRegistre({ jeux: [], indicateurs: [], analyses: [analyse] });
  const html = rendu(analyse, CATALOGUE, "", "", indexerSources(fiches));

  assert.match(html, new RegExp(`href="/sources/#${fiches[0]!.id}"`));
  assert.match(html, /Voir dans le registre/);
});

test("une même source primaire n'est listée qu'une fois", () => {
  const source = { titre: "Source de test", url: "https://exemple.test", consulte_le: "2026-01-01" };
  const html = rendu(analyseMinimale({ sources: [source, source] }), CATALOGUE);

  assert.equal((html.match(/<li><a href="https:\/\/exemple\.test"/g) ?? []).length, 1);
});

test("les quatre étages sont présents dans la sortie", () => {
  const html = rendu(DEFENSE, CATALOGUE);
  assert.match(html, /analyse-rendu__express/);
  assert.match(html, /analyse-rendu__detail/);
  assert.match(html, /analyse-rendu__interactif/);
  assert.match(html, /analyse-rendu__preuve/);
});

test("le dossier place verdict confrontation et preuve dans cet ordre", () => {
  const html = rendu(DEFENSE, CATALOGUE);
  const classes = ["verdict", "confrontation", "chemin", "donnees", "limites", "sources"];
  const positions = classes.map((nom) => html.indexOf(`dossier-preuve__${nom}`));
  assert.ok(
    positions.every((position, i) => position > -1 && (!i || position > positions[i - 1]!)),
    `ordre des sections : ${positions.join(", ")}`,
  );
});

test("le verdict qualifié précède la confrontation entre déclaration et comptes", () => {
  const html = rendu(DEFENSE, CATALOGUE);
  const verdict = html.slice(
    html.indexOf("dossier-preuve__verdict"),
    html.indexOf("dossier-preuve__confrontation"),
  );
  const confrontation = html.slice(
    html.indexOf("dossier-preuve__confrontation"),
    html.indexOf("dossier-preuve__chemin"),
  );

  assert.match(verdict, /Contexte manquant/);
  assert.match(verdict, /Le chiffre existe, mais pas pour ce qu'il désigne/);
  assert.match(confrontation, /affirmation contrôlée/i);
  assert.match(confrontation, /crédits votés/i);
  assert.match(confrontation, /59/);
});

test("les limites et les sources omettent leurs listes vides", () => {
  const html = rendu(analyseMinimale(), CATALOGUE);
  const limites = html.slice(
    html.indexOf("dossier-preuve__limites"),
    html.indexOf("dossier-preuve__sources"),
  );
  const sources = html.slice(html.indexOf("dossier-preuve__sources"));

  assert.doesNotMatch(limites, /<ul[^>]*><\/ul>/);
  assert.match(sources, /Source de test/);
  assert.doesNotMatch(sources, /<li>\s*<\/li>/);
});

test("le cran s'affiche avec sa formulation exacte de la spec", () => {
  assert.equal(LIBELLE_CRAN["exact"], "Le chiffre est celui des comptes");
  assert.equal(LIBELLE_CRAN["hors_perimetre"], "Le chiffre existe, mais pas pour ce qu'il désigne");
  assert.equal(LIBELLE_CRAN["introuvable"], "Aucune ligne publiée ne porte ce montant");

  const html = rendu(analyseMinimale(), CATALOGUE);
  assert.match(html, /Le chiffre est celui des comptes/);

  const introuvable = analyseMinimale({
    verdict: { cran: "introuvable", phrase: "Aucune observation ne correspond." },
  });
  assert.match(rendu(introuvable, CATALOGUE), /Aucune ligne publiée ne porte ce montant/);
});

test("la qualification distingue exactitude, périmètre et absence de preuve", () => {
  assert.equal(
    qualificationVerdict(analyseMinimale({ verdict: { cran: "exact", phrase: "Exact." } })),
    "confirme",
  );
  assert.equal(qualificationVerdict(DEFENSE), "contexte_manquant");
  assert.equal(
    qualificationVerdict(analyseMinimale({ verdict: { cran: "introuvable", phrase: "Absent." } })),
    "non_demontre",
  );

  const attendues = {
    ae_cp: "contexte_manquant",
    brut_net: "ordre_grandeur",
    vote_execute: "contexte_manquant",
    stock_flux: "contredit",
    etat_apu: "perimetre_trompeur",
    annuel_cumule: "contredit",
    perimetre_geographique: "perimetre_trompeur",
  } satisfies Record<Confusion, QualificationVerdict>;
  for (const [confusion, qualification] of Object.entries(attendues) as [
    Confusion,
    QualificationVerdict,
  ][]) {
    assert.equal(
      qualificationVerdict(
        analyseMinimale({ verdict: { cran: "hors_perimetre", confusion, phrase: "Périmètre distinct." } }),
      ),
      qualification,
      `${confusion} doit rester qualifié sans recourir à la prose libre`,
    );
  }

  assert.deepEqual(LIBELLE_QUALIFICATION, {
    confirme: "Confirmé",
    ordre_grandeur: "Ordre de grandeur correct",
    contexte_manquant: "Contexte manquant",
    perimetre_trompeur: "Périmètre trompeur",
    non_demontre: "Non démontré",
    contredit: "Contredit",
  });
});

test("un cran hors_perimetre nomme toujours sa confusion à l'écran", () => {
  const html = rendu(DEFENSE, CATALOGUE);
  assert.equal(DEFENSE.verdict.cran, "hors_perimetre");
  assert.equal(DEFENSE.verdict.confusion, "vote_execute");
  assert.match(html, /Le chiffre existe, mais pas pour ce qu'il désigne/);
  assert.ok(LIBELLE_CONFUSION["vote_execute"]);
  assert.match(html, new RegExp(LIBELLE_CONFUSION["vote_execute"]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("les montants s'affichent en millions d'euros, jamais en Md", () => {
  const html = rendu(DEFENSE, CATALOGUE);
  // L'attendu vient exclusivement de `formater` : une chaîne recopiée à la
  // main comparerait une espace ordinaire à l'espace fine insécable produite
  // par le formateur, et échouerait pour la mauvaise raison.
  const attendu = formater(59946338573, "EUR", false);
  assert.match(html, new RegExp(attendu.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  // Le second chiffre de l'analyse, pour la même raison.
  const second = formater(62123736749.91, "EUR", false);
  assert.match(html, new RegExp(second.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(html, /\bMd€/);
});

test("le tableau du détail dit l'unité publiée de ses chiffres", () => {
  // La page la plus exposée à la confusion milliards/millions du site :
  // « environ 59,9 milliards » (l'express) et « 59 946 M€ » (le détail) y
  // voisinent. La légende doit expliciter l'unité sans l'imposer à un futur
  // dossier qui mêlerait une part du PIB à un montant.
  const html = rendu(DEFENSE, CATALOGUE);
  assert.match(html, /<caption>Unités publiées : euros\./);
});

test("un dossier mélangeant euros et part du PIB nomme chaque unité sans légende M€ globale", () => {
  const analyse = analyseMinimale({
    chiffres: [
      {
        dit: "60 milliards d'euros",
        observe: {
          indicateur: "etat_mission_defense_credits_votes",
          niveau: "pays",
          code: "FR",
          periode: "2025",
          valeur: 59_946_338_573,
        },
        registre: "fait_comptable",
        lecture: "Crédits de défense",
      },
      {
        dit: "113 % du PIB",
        observe: {
          indicateur: "dette_publique_part_pib",
          niveau: "pays",
          code: "FR",
          periode: "2025",
          valeur: 113,
        },
        registre: "donnee_officielle",
        lecture: "Dette publique, part du PIB",
      },
    ],
  });
  const catalogue = [
    { id: "etat_mission_defense_credits_votes", unite: "EUR" },
    { id: "dette_publique_part_pib", unite: "percent" },
  ] as never[];
  const html = rendu(analyse, catalogue);
  const donnees = html.slice(
    html.indexOf("dossier-preuve__donnees"),
    html.indexOf("dossier-preuve__limites"),
  );
  const ligneEuros = donnees.slice(donnees.indexOf("Crédits de défense"), donnees.indexOf("</tr>", donnees.indexOf("Crédits de défense")));
  const lignePib = donnees.slice(donnees.indexOf("Dette publique, part du PIB"), donnees.indexOf("</tr>", donnees.indexOf("Dette publique, part du PIB")));

  assert.doesNotMatch(donnees, /Montants en millions d'euros/);
  assert.match(donnees, /Unités publiées : euros ; pourcentage\./);
  assert.match(ligneEuros, /Unité publiée : euros/);
  assert.match(lignePib, /Unité publiée : pourcentage/);
  assert.match(lignePib, /113\s* %/);
});

test("le mot milliards peut figurer dans la citation de l'affirmation", () => {
  // L'affirmation de l'analyse défense cite « milliards » : c'est une citation
  // de ce qui circule, pas un montant produit par le site.
  assert.match(DEFENSE.affirmation.texte, /milliards/);
  const html = rendu(DEFENSE, CATALOGUE);
  assert.match(html, /milliards/);
});

test("le texte de l'affirmation est échappé", () => {
  const html = rendu(analyseMinimale(), CATALOGUE);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("un auteur null ne produit pas « par null » ni de mention vide", () => {
  const html = rendu(analyseMinimale(), CATALOGUE); // auteur: null
  assert.doesNotMatch(html, /par null/i);
  assert.doesNotMatch(html, /—\s*,/); // un tiret suivi directement d'une virgule : auteur vide
});

test("un auteur renseigné s'affiche", () => {
  const avecAuteur = analyseMinimale({
    affirmation: {
      texte: "Un énoncé attribué.",
      auteur: "Une personnalité",
      date: "2026-01-01",
      source: { titre: "Source", url: "https://exemple.test", consulte_le: "2026-01-01" },
    },
  });
  const html = rendu(avecAuteur, CATALOGUE);
  assert.match(html, /Une personnalité/);
});

test("les effets indirects sont rendus avec auteur et source, distingués des chiffres calculés", () => {
  const avecEffet = analyseMinimale({
    effets_indirects: [
      {
        texte: "Une lecture indirecte des chiffres.",
        auteur: "Un institut",
        source: { titre: "Étude", url: "https://exemple.test/etude", consulte_le: "2026-01-01" },
      },
    ],
  });
  const html = rendu(avecEffet, CATALOGUE);
  assert.match(html, /Une lecture indirecte des chiffres/);
  assert.match(html, /Un institut/);
  assert.match(html, /https:\/\/exemple\.test\/etude/);

  // La classe CSS des effets indirects diffère de celle des chiffres calculés.
  const classeChiffre = html.match(/class="([^"]*analyse-rendu__chiffre[^"]*)"/)?.[1];
  const classeEffet = html.match(/class="([^"]*analyse-rendu__effet-indirect[^"]*)"/)?.[1];
  assert.ok(classeChiffre, "aucune classe de chiffre calculé trouvée");
  assert.ok(classeEffet, "aucune classe d'effet indirect trouvée");
  assert.notEqual(classeChiffre, classeEffet);
});

test("simulateur.budget vide ne produit aucun bouton « Rejouer le calcul »", () => {
  const html = rendu(analyseMinimale({ simulateur: { budget: "", contrat: "", lecture: "Rien à rejouer." } }), CATALOGUE);
  assert.doesNotMatch(html, /Rejouer le calcul/);
  assert.doesNotMatch(html, /Créer mon alternative/);
  assert.match(html, /Rien à rejouer/);
});

test("simulateur.budget non vide produit un lien vers /simulateur?budget=…", () => {
  const html = rendu(
    analyseMinimale({
      simulateur: { budget: "etat", contrat: "", lecture: "Le simulateur règle les crédits votés." },
    }),
    CATALOGUE,
  );
  assert.match(html, /Rejouer le calcul/);
  assert.match(html, /href="\/simulateur\?budget=etat/);
});

test("une hypothèse se dit une fois, dans les limites du dossier", () => {
  const phrase = "Les deux séries portent sur la mission Défense, hors comptes spéciaux.";
  const html = rendu(analyseMinimale({ hypotheses: [phrase] }), CATALOGUE);
  const occurrences = html.split(phrase).length - 1;
  assert.equal(occurrences, 1, `l'hypothèse apparaît ${occurrences} fois`);
  // L'unité reste avec les données, mais l'hypothèse est explicitement
  // qualifiée comme limite du dossier.
  const legende = html.slice(html.indexOf("<caption>"), html.indexOf("</caption>"));
  assert.match(legende, /Unités publiées : euros\./);
  assert.ok(!legende.includes(phrase), `légende : ${legende}`);
  const limites = html.slice(
    html.indexOf("dossier-preuve__limites"),
    html.indexOf("dossier-preuve__sources"),
  );
  assert.match(limites, /analyse-rendu__hypotheses/);
  assert.ok(limites.includes(phrase), `limites : ${limites}`);
});

test("l'index trie par publie_le décroissant et marque les mises_a_jour", () => {
  const ancienne = analyseMinimale({ slug: "ancienne", publie_le: "2025-01-01", titre: "Ancienne" });
  const recente = analyseMinimale({ slug: "recente", publie_le: "2026-06-01", titre: "Récente" });
  const revisee = analyseMinimale({
    slug: "revisee",
    publie_le: "2025-06-01",
    titre: "Révisée",
    mises_a_jour: [{ date: "2026-01-01", quoi: "Correction d'un montant." }],
  });
  const html = renduIndex([ancienne, recente, revisee], CATALOGUE);
  const rang = (titre: string) => html.indexOf(titre);
  assert.ok(rang("Récente") < rang("Révisée"));
  assert.ok(rang("Révisée") < rang("Ancienne"));

  // Le <li> complet qui porte ce titre, pour vérifier la marque à l'intérieur
  // de sa propre ligne plutôt que sur une fenêtre de caractères arbitraire.
  const ligneDe = (titre: string) => {
    const idx = html.indexOf(titre);
    const debut = html.lastIndexOf("<li", idx);
    const fin = html.indexOf("</li>", idx) + "</li>".length;
    return html.slice(debut, fin);
  };
  assert.match(ligneDe("Révisée"), /mise[s]? à jour/i);
  assert.doesNotMatch(ligneDe("Ancienne"), /mise[s]? à jour/i);
});

test("chiffres[].dit s'affiche toujours à côté du chiffre observé (finding 1)", () => {
  // `dit` est le chiffre couramment entendu, `observe` celui que le pipeline a
  // publié : c'est leur juxtaposition qui fait l'étage 1. Les deux
  // formulations ci-dessous sont distinctes de `lecture` et de
  // `affirmation.texte` — leur présence dans le rendu ne peut donc venir que
  // du champ `dit` lui-même, pas d'une coïncidence de vocabulaire comme dans
  // le fichier défense réel.
  const html = rendu(analyseMixte(), CATALOGUE_MIXTE);
  // L'apostrophe passe par `echapper()` et devient `&#39;` dans le rendu.
  assert.match(html, /à peu près 45 milliards d&#39;euros/);
  assert.match(html, /un peu plus de 50 milliards d&#39;euros/);
  const premier = formater(44987654321.5, "EUR", false);
  const second = formater(50123456789.12, "EUR", false);
  assert.match(html, new RegExp(premier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, new RegExp(second.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("le détail garde `dit` sur une ligne sans observe, entourée de lignes avec exercice (finding 2)", () => {
  const html = rendu(analyseMixte(), CATALOGUE_MIXTE);
  const detail = html.slice(html.indexOf("analyse-rendu__detail"));
  // Le <tr> qui entoure « Un rapprochement qui » — repéré depuis le dernier
  // `<tr>` avant ce texte, pas depuis le premier de tout le tableau, sinon la
  // capture non gourmande s'étend sur les trois lignes précédentes.
  const idxTexte = detail.indexOf("Un rapprochement qui");
  assert.ok(idxTexte !== -1, "ligne « interpretation » introuvable dans le tableau");
  const debut = detail.lastIndexOf("<tr>", idxTexte);
  const fin = detail.indexOf("</tr>", idxTexte) + "</tr>".length;
  const ligne = detail.slice(debut, fin);
  // « n'est » : l'apostrophe passe par `echapper()` et devient `&#39;` dans le
  // rendu, d'où le repère précédent qui ne la porte pas.
  assert.match(ligne, /n&#39;est publié par aucun fichier/);
  // Une seule cellule : le `dit` de la ligne sans observation, jamais des
  // cellules `<td></td>` vides une par exercice publié par les autres lignes.
  assert.equal((ligne.match(/<td/g) ?? []).length, 1, "la ligne sans observe doit tenir une seule cellule");
  assert.match(ligne, /de l&#39;ordre de 5 milliards selon plusieurs instituts/);
  assert.doesNotMatch(ligne, /<td><\/td>/);
});

test("une ligne sans observe affiche aussi sa `valeur` déclarée, quand le fichier en porte une (finding 2, révision « observe interdit n'est pas valeur interdite »)", () => {
  const avecValeurDeclaree = analyseMinimale({
    chiffres: [
      {
        dit: "environ 3 milliards selon le simulateur",
        valeur: 3120000000,
        registre: "hypothese",
        lecture: "Une hypothèse chiffrée par le site, pas une observation du pipeline.",
      },
    ],
    simulateur: { budget: "", contrat: "", lecture: "Rien à rejouer." },
  });
  const html = rendu(avecValeurDeclaree, CATALOGUE);
  const attendu = formater(3120000000, "EUR", false);
  assert.match(html, new RegExp(attendu.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /environ 3 milliards selon le simulateur/);
});

test("sans `valeur` déclarée, une ligne sans observe n'affiche que `dit`, comme avant", () => {
  const html = rendu(analyseMixte(), CATALOGUE_MIXTE);
  const detail = html.slice(html.indexOf("analyse-rendu__detail"));
  const idxTexte = detail.indexOf("Un rapprochement qui");
  const debut = detail.lastIndexOf("<tr>", idxTexte);
  const fin = detail.indexOf("</tr>", idxTexte) + "</tr>".length;
  const ligne = detail.slice(debut, fin);
  assert.doesNotMatch(ligne, /analyse-rendu__dit/);
});

test("l'index pointe vers la page réelle de l'analyse, pas une ancre morte (finding 3)", () => {
  const html = renduIndex([DEFENSE], CATALOGUE);
  assert.ok(
    html.includes(`href="/analyses/${DEFENSE.slug}/"`),
    "le lien de l'index doit pointer vers /analyses/<slug>/",
  );
  assert.doesNotMatch(html, /href="#/);
});

test("l'étage 4 ne cite plus jamais le jeu du catalogue (Critical A)", () => {
  // Même avec un catalogue qui porte un `jeu`, l'étage 4 ne doit plus produire
  // ni « Producteur », ni « Jeu de données » : cette attribution venait du
  // catalogue, qui peut classer un indicateur sous une entrée de registre
  // approximative (execution_missions.py) — c'est exactement ce qui faisait
  // porter à la page défense deux provenances contradictoires pour les mêmes
  // montants (dist/analyses/defense-credits-votes-consommes-2025/index.html).
  const html = rendu(analyseMixte(), CATALOGUE_MIXTE);
  assert.doesNotMatch(html, /Producteur\s*:/);
  assert.doesNotMatch(html, /Jeu de données\s*:/);
  assert.match(html, /Indicateur\s*:/);
});

test("l'étage 4 de l'analyse défense ne cite qu'une provenance : celle que le fichier déclare (Critical A)", () => {
  // Reproduction directe du défaut critique : le catalogue réel classe les
  // indicateurs de la mission Défense sous le jeu de la situation mensuelle
  // budgétaire (par nature), alors que l'analyse déclare le PLRG (par
  // mission) dans `sources`. Un catalogue qui porte ce `jeu` ne doit plus
  // jamais apparaître dans la page ; seule la source déclarée doit s'y lire.
  const catalogueAvecJeuErrone = [
    {
      id: "etat_mission_defense_credits_votes",
      unite: "EUR",
      jeu: "execution-budget-etat",
    },
    {
      id: "etat_mission_defense_credits_consommes",
      unite: "EUR",
      jeu: "execution-budget-etat",
    },
  ] as never[];
  const html = rendu(DEFENSE, catalogueAvecJeuErrone);
  assert.doesNotMatch(html, /situations-mensuelles-budgetaires/);
  assert.doesNotMatch(html, /Jeu de données\s*:/);
  // La comparaison porte sur l'étage 4 seul : l'express (étage 1) cite aussi
  // la source de l'affirmation, à un autre endroit de la page — ce n'est pas
  // une seconde provenance concurrente, seulement le même chiffre cité deux
  // fois à deux étages différents.
  const preuve = html.slice(html.indexOf('class="analyse-rendu__preuve'));
  const occurrencesPLRG = (preuve.match(/PLRG\) 2025, annexe 1/g) ?? []).length;
  assert.equal(occurrencesPLRG, 1, "la source PLRG doit apparaître une seule fois dans la preuve, jamais zéro ni deux");
});

test("le millésime de l'étage 4 vient du paramètre `version`, jamais de `verifie_contre` (finding D)", () => {
  // `verifie_contre` du fichier défense réel est vide par construction (le
  // contrôle ne l'écrit jamais sur disque) : s'il redevenait la source du pas
  // « Millésime », ce test échouerait en le trouvant absent malgré `version`.
  assert.equal(DEFENSE.verifie_contre, "");
  const avecVersion = rendu(DEFENSE, CATALOGUE, "2026-08-11T0807");
  assert.match(avecVersion, /Millésime\s*:\s*2026-08-11T0807/);
  const sansVersion = rendu(DEFENSE, CATALOGUE);
  assert.doesNotMatch(sansVersion, /Millésime\s*:/);
});

test("étage 1 n'affiche jamais `dit` seul, même sans observe (Critical, revision finale)", () => {
  // Le contrôle exige désormais une `valeur` déclarée dès que `observe` est
  // absent : l'étage 1 doit la montrer à côté de `dit`, sous le nom du
  // registre — exactement comme l'étage 2 le fait déjà.
  const sansObserve = analyseMinimale({
    chiffres: [
      {
        dit: "environ 3 milliards selon le simulateur",
        valeur: 3120000000,
        registre: "hypothese",
        lecture: "Une hypothèse chiffrée par le site, pas une observation du pipeline.",
      },
    ],
  });
  const html = rendu(sansObserve, CATALOGUE);
  const express = html.slice(html.indexOf("analyse-rendu__express"), html.indexOf("analyse-rendu__detail"));
  assert.doesNotMatch(express, /<li>environ 3 milliards selon le simulateur<\/li>/);
  assert.match(express, /Hypothèse/);
  const attendu = formater(3120000000, "EUR", false);
  assert.match(express, new RegExp(attendu.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(express, /environ 3 milliards selon le simulateur/);
});

test("étage 1 nomme le registre même sans valeur déclarée, en défense en profondeur", () => {
  // Un fichier qui n'aurait pas encore passé le contrôle (ou une fixture de
  // test délibérément incomplète) ne doit jamais faire réapparaître un `dit`
  // bare : le registre seul suffit à ne jamais l'afficher isolé.
  const sansRien = analyseMinimale({
    chiffres: [
      {
        dit: "un chiffre non cadré",
        registre: "interpretation",
        lecture: "Une lecture, sans nombre déclaré.",
      },
    ],
  });
  const html = rendu(sansRien, CATALOGUE);
  const express = html.slice(html.indexOf("analyse-rendu__express"), html.indexOf("analyse-rendu__detail"));
  assert.doesNotMatch(express, /<li>un chiffre non cadré<\/li>/);
  assert.match(express, /Interprétation/);
  assert.match(express, /un chiffre non cadré/);
});

test("aucune réserve qui s'excuse dans le module lui-même", () => {
  const source = readFileSync(new URL("./analyse-rendu.ts", import.meta.url), "utf8");
  // Les gabarits qui ont dû être retirés d'etat.ts et analyses.ts ne doivent
  // pas réapparaître ici : ce module rend des analyses, pas des mises en garde.
  assert.doesNotMatch(source, /ne disent pas/i);
  assert.doesNotMatch(source, /fiabilité est inégale/i);
  assert.doesNotMatch(source, /à prendre avec précaution/i);
  assert.doesNotMatch(source, /ne (?:permet|prétend) pas de suivre/i);

  const html = rendu(DEFENSE, CATALOGUE);
  assert.doesNotMatch(html, /ne disent pas/i);
  assert.doesNotMatch(html, /fiabilité est inégale/i);
  assert.doesNotMatch(html, /à prendre avec précaution/i);
});

/* --------------------------------------------------------------------------
 * « Citer » : la commande n'est posée que là où les cinq éléments existent
 * ----------------------------------------------------------------------- */

const ADRESSE = "https://plateforme-9sz.pages.dev/analyses/defense-credits-votes-consommes-2025/";

/** Les charges utiles `data-citer` d'un rendu, relues comme le fait `main.ts` :
 *  l'attribut est du JSON échappé pour l'attribut HTML, jamais du texte gratté
 *  sur la page. */
function citations(html: string): Citation[] {
  return [...html.matchAll(/data-citer="([^"]*)"/g)].map(
    (trouvee) =>
      JSON.parse(
        trouvee[1]!
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&"),
      ) as Citation,
  );
}

test("un chiffre observé porte la commande, avec ses cinq éléments", () => {
  const html = rendu(DEFENSE, CATALOGUE, "", ADRESSE);
  const charges = citations(html);
  assert.equal(charges.length, DEFENSE.chiffres.length);

  const premiere = charges[0]!;
  assert.equal(premiere.valeur, DEFENSE.chiffres[0]!.observe!.valeur);
  assert.equal(premiere.unite, "EUR");
  assert.equal(premiere.millesime, DEFENSE.chiffres[0]!.observe!.periode);
  // La source est celle que l'analyse déclare elle-même, sous « Fichier
  // publié » — jamais `affirmation.source`, qui est la source de la
  // déclaration citée, pas celle du chiffre des comptes.
  assert.equal(premiere.source, DEFENSE.sources[0]!.titre);
  assert.equal(premiere.permalien, ADRESSE);
  // Et la charge se cite : c'est le contrat entre le rendu et `main.ts`.
  assert.equal(citable(premiere), true);
  assert.ok(citer(premiere).includes(formater(premiere.valeur, "EUR", false, premiere.id)));
});

test("un chiffre sans exercice n'offre pas la commande", () => {
  // `interpretation`, `hypothese`, `resultat_simulation` : `observe` y est
  // interdite (docs/analyses-schema.md), donc aucun millésime. Un nombre nu
  // copié, c'est la capture d'écran floue sous une autre forme.
  const html = rendu(analyseMixte(), CATALOGUE_MIXTE, "", ADRESSE);
  const charges = citations(html);
  assert.equal(charges.length, 2);
  assert.deepEqual(
    charges.map((c) => c.millesime),
    ["2019", "2025"],
  );
  // Le chiffre reste affiché, sous le nom de son registre : c'est la commande
  // qui manque, pas la ligne.
  const debutExpress = html.indexOf("chiffres-cites");
  const express = html.slice(debutExpress, html.indexOf("</section>", debutExpress));
  assert.equal(express.match(/<li>/g)?.length, 3);
  assert.equal(express.match(/data-citer=/g)?.length, 2);
  assert.ok(express.includes("Interprétation"), express);
});

test("une analyse sans source déclarée n'offre la commande sur aucun chiffre", () => {
  const anonyme = analyseMinimale({ sources: [] });
  assert.equal(citations(rendu(anonyme, CATALOGUE, "", ADRESSE)).length, 0);
  // Le chiffre reste affiché, lui : c'est la commande qui manque, pas la page.
  assert.ok(rendu(anonyme, CATALOGUE, "", ADRESSE).includes("Les crédits votés."));
});

test("un indicateur absent du catalogue n'offre pas la commande", () => {
  // Pas d'unité déclarée, pas de repli sur « EUR » : `formater` peindrait un
  // taux ou un effectif en millions d'euros, et la citation partirait fausse.
  assert.equal(citations(rendu(analyseMinimale(), [] as never[], "", ADRESSE)).length, 0);
});

test("sans permalien absolu, aucun chiffre n'offre la commande", () => {
  // Une citation circule hors du site : un chemin relatif n'y ramène plus.
  assert.equal(citations(rendu(DEFENSE, CATALOGUE)).length, 0);
  assert.equal(citations(rendu(DEFENSE, CATALOGUE, "", "  ")).length, 0);
});

test("la charge utile est échappée pour l'attribut qui la porte", () => {
  const piegee = analyseMinimale({
    sources: [
      {
        titre: 'Rapport "2025" & <suites>',
        url: "https://exemple.test",
        consulte_le: "2026-01-01",
      },
    ],
  });
  const html = rendu(piegee, CATALOGUE, "", ADRESSE);
  // Le guillemet droit ne referme pas l'attribut : sans échappement, l'attribut
  // se coupe au premier guillemet du titre et le reste du JSON devient du
  // balisage.
  assert.ok(!/data-citer="[^"]*"[^>]*JSON/.test(html));
  const [charge] = citations(html);
  assert.equal(charge!.source, 'Rapport "2025" & <suites>');
});

/* --------------------------------------------------------------------------
 * L'index — spec §9.1 : « Liste antichronologique de cartes-verdicts. Chaque
 * carte porte le chiffre en cause, le cran, la date de publication, et un
 * marqueur si l'analyse a été mise à jour depuis sa parution. Filtres : par
 * type d'analyse, par thème, par budget concerné. La recherche textuelle est
 * permissive. »
 * ----------------------------------------------------------------------- */

/** Le <li> qui porte ce titre, pour lire une carte sans découper sur une
 *  fenêtre de caractères arbitraire. */
function carteDe(html: string, titre: string): string {
  const idx = html.indexOf(titre);
  assert.ok(idx > -1, `« ${titre} » introuvable dans l'index`);
  const debut = html.lastIndexOf("<li", idx);
  return html.slice(debut, html.indexOf("</li>", idx) + "</li>".length);
}

test("la carte porte le chiffre en cause : le chiffre dit et le chiffre publié", () => {
  const carte = carteDe(renduIndex([DEFENSE], CATALOGUE), DEFENSE.titre);
  // Le chiffre couramment entendu, tel que le fichier l'écrit.
  assert.match(carte, /environ 59,9 milliards d&#39;euros/);
  // Et le montant publié, dans l'unité du catalogue, avec son exercice.
  const publie = formater(59946338573, "EUR", false, "etat_mission_defense_credits_votes");
  assert.ok(carte.includes(publie), `le montant publié ${publie} manque à la carte`);
  assert.match(carte, /exercice 2025/);
});

test("une carte d'index donne affirmation chiffre verdict et fraîcheur", () => {
  const html = renduIndex([DEFENSE], CATALOGUE);
  assert.match(html, /dossier-index__affirmation/);
  assert.match(html, /dossier-index__chiffre/);
  assert.match(html, /dossier-index__verdict/);
  assert.match(html, /dossier-index__fraicheur/);
  assert.match(html, /data-theme=/);
  assert.match(html, /data-verdict=/);
  assert.match(html, /data-perimetre=/);
  assert.match(html, /data-texte=/);
});

test("la carte porte le cran, et nomme la confusion quand le cran l'exige", () => {
  const carte = carteDe(renduIndex([DEFENSE], CATALOGUE), DEFENSE.titre);
  assert.ok(carte.includes(LIBELLE_CRAN.hors_perimetre), "le cran manque à la carte");
  // Un cran `hors_perimetre` qui ne dit pas CE QUI est confondu demande au
  // lecteur de se méfier sans lui donner de quoi lire autrement : la règle de
  // l'étage 1 vaut pour la carte.
  assert.ok(carte.includes(LIBELLE_CONFUSION.vote_execute), "la confusion manque à la carte");
});

test("la carte porte la date de publication et, seulement si elle existe, la mise à jour", () => {
  const revisee = analyseMinimale({
    slug: "revisee",
    titre: "Révisée",
    publie_le: "2025-06-01",
    mises_a_jour: [{ date: "2026-01-01", quoi: "Correction d'un montant." }],
  });
  const html = renduIndex([DEFENSE, revisee], CATALOGUE);
  assert.match(carteDe(html, "Révisée"), /<time datetime="2025-06-01">/);
  assert.match(carteDe(html, "Révisée"), /mise[s]? à jour/i);
  assert.doesNotMatch(carteDe(html, DEFENSE.titre), /mise[s]? à jour/i);
});

test("un chiffre sans observation publiée affiche la valeur que l'analyse déclare", () => {
  const simulee = analyseMinimale({
    titre: "Chiffrage refait",
    chiffres: [
      {
        dit: "environ 3 milliards selon le simulateur",
        valeur: 3120000000,
        registre: "resultat_simulation",
        lecture: "Le rendement du barème refait.",
      },
    ],
  });
  const carte = carteDe(renduIndex([simulee, DEFENSE], CATALOGUE), "Chiffrage refait");
  assert.ok(carte.includes(formater(3120000000, "EUR", false)));
  assert.match(carte, /Résultat du simulateur/);
});

test("un corpus d'une seule analyse n'affiche aucune barre de filtres", () => {
  // Une barre qui ne peut rien réduire est du mobilier : elle occupe la place
  // de la seule chose que la page a à montrer.
  const html = renduIndex([DEFENSE], CATALOGUE);
  assert.doesNotMatch(html, /analyses-filtres/);
  assert.doesNotMatch(html, /<select/);
  assert.doesNotMatch(html, /type="search"/);
});

test("une facette ne s'affiche que si le corpus porte au moins deux valeurs distinctes", () => {
  // Deux analyses de MÊME type, de MÊME budget, de thèmes DIFFÉRENTS : seule
  // la facette « thème » peut changer la liste, seule elle s'affiche.
  const a = analyseMinimale({ slug: "a", titre: "Première", themes: ["budget_etat"] });
  const b = analyseMinimale({ slug: "b", titre: "Seconde", themes: ["dette"] });
  const html = renduIndex([a, b], CATALOGUE);
  assert.match(html, /data-facette="theme"/);
  assert.doesNotMatch(html, /data-facette="type"/);
  assert.doesNotMatch(html, /data-facette="budget"/);
  // Et les deux valeurs y sont, nommées en français — jamais l'identifiant nu.
  const menu = html.slice(html.indexOf('data-facette="theme"'), html.indexOf("</select>"));
  assert.match(menu, /Budget de l&#39;État/);
  assert.match(menu, /Dette publique/);
});

test("les trois facettes s'affichent dès que les trois séparent le corpus", () => {
  const a = analyseMinimale({ slug: "a", titre: "Première", type: "decryptage", themes: ["dette"], budgets_concernes: ["etat"] });
  const b = analyseMinimale({ slug: "b", titre: "Seconde", type: "comparaison", themes: ["securite_sociale"], budgets_concernes: ["secu"] });
  const html = renduIndex([a, b], CATALOGUE);
  for (const facette of ["type", "theme", "budget"]) {
    assert.match(html, new RegExp(`data-facette="${facette}"`), `facette ${facette} absente`);
  }
});

test("la barre est servie repliée : sans le paquet, aucun réglage mort, toutes les cartes lisibles", () => {
  // La page est pré-rendue (scripts/prerendre.ts) : les filtres sont un
  // progrès, jamais une condition d'accès. `main.ts` déplie la barre.
  const a = analyseMinimale({ slug: "a", titre: "Première", themes: ["budget_etat"] });
  const b = analyseMinimale({ slug: "b", titre: "Seconde", themes: ["dette"] });
  const html = renduIndex([a, b], CATALOGUE);
  assert.match(html, /<div class="analyses-filtres" id="analyses-filtres"[^>]* hidden>/);
  assert.doesNotMatch(html, /<li[^>]*\bhidden\b/);
  assert.ok(html.includes("Première") && html.includes("Seconde"));
});

/* ---- Le filtrage, en données ---- */

const CORPUS: Analyse[] = [
  analyseMinimale({
    slug: "defense",
    titre: "Les crédits de la Défense",
    type: "decryptage",
    themes: ["budget_etat"],
    budgets_concernes: ["etat"],
    verdict: { cran: "exact", phrase: "Le chiffre correspond aux comptes publiés." },
  }),
  analyseMinimale({
    slug: "retraites",
    titre: "Le déficit des retraites",
    type: "comparaison",
    themes: ["securite_sociale"],
    budgets_concernes: ["secu"],
    affirmation: {
      texte: "Une aide sociale versée à l'insertion des personnes sans emploi.",
      auteur: null,
      date: null,
      source: { titre: "Source", url: "https://exemple.test", consulte_le: "2026-01-01" },
    },
    verdict: { cran: "introuvable", phrase: "Aucune ligne ne porte ce montant." },
  }),
  analyseMinimale({
    slug: "commune",
    titre: "L'investissement des communes",
    type: "decryptage",
    themes: ["finances_locales", "budget_etat"],
    budgets_concernes: ["collectivites"],
    verdict: { cran: "exact", phrase: "Le montant annoncé est celui du compte." },
  }),
];

const slugs = (criteres: Parameters<typeof filtrerAnalyses>[1]) =>
  filtrerAnalyses(CORPUS, criteres).map((a) => a.slug);

test("sans critère, le filtre ne retranche rien", () => {
  assert.deepEqual(slugs({}), ["defense", "retraites", "commune"]);
});

test("filtre par type d'analyse", () => {
  assert.deepEqual(slugs({ type: "comparaison" }), ["retraites"]);
  assert.deepEqual(slugs({ type: "decryptage" }), ["defense", "commune"]);
});

test("filtre par thème — une analyse est retenue par chacun de ses thèmes", () => {
  assert.deepEqual(slugs({ theme: "budget_etat" }), ["defense", "commune"]);
  assert.deepEqual(slugs({ theme: "finances_locales" }), ["commune"]);
});

test("filtre par budget concerné", () => {
  assert.deepEqual(slugs({ budget: "secu" }), ["retraites"]);
  assert.deepEqual(slugs({ budget: "collectivites" }), ["commune"]);
});

test("les critères se cumulent", () => {
  assert.deepEqual(slugs({ type: "decryptage", budget: "collectivites" }), ["commune"]);
  assert.deepEqual(slugs({ type: "comparaison", budget: "etat" }), []);
});

test("la recherche est permissive : chaque mot compte, l'ordre et la contiguïté non", () => {
  // « aide sociale » ne doit pas exiger ces deux mots collés dans cet ordre —
  // c'est la règle de `chercher()` (simulateur.ts), et le texte visé porte
  // « aide » et « sociale » séparés par quatre mots, dans l'ordre inverse de
  // la requête ci-dessous.
  assert.deepEqual(slugs({ recherche: "sociale aide" }), ["retraites"]);
  assert.deepEqual(slugs({ recherche: "aide sociale" }), ["retraites"]);
  // Sans accents ni casse, comme partout ailleurs sur le site.
  assert.deepEqual(slugs({ recherche: "DEFICIT" }), ["retraites"]);
  // Et le « et » fait la précision : un mot absent écarte la ligne.
  assert.deepEqual(slugs({ recherche: "sociale defense" }), []);
});

test("la recherche porte sur le verdict et les chiffres, pas seulement sur le titre", () => {
  assert.deepEqual(slugs({ recherche: "comptes publiés" }), ["defense"]);
});

test("l'index ne force aucune unité globale et garde celle de chaque chiffre", () => {
  // Les dossiers mélangent pourcentages, euros et ordres de grandeur : une
  // légende « en millions » au-dessus de tous rendait les cartes non-EUR
  // fausses. Chaque chiffre publié reste déjà formaté par son indicateur.
  const html = renduIndex([DEFENSE], CATALOGUE);
  assert.doesNotMatch(html, /Montants en millions d'euros\./);
  assert.match(carteDe(html, DEFENSE.titre), /59[\s ]946[\s ]M€/);
  assert.doesNotMatch(html, /\bMd€/);
});

test("l'index et chaque dossier portent leur propre titre de niveau 1", () => {
  const index = renduIndex([DEFENSE], CATALOGUE);
  const dossier = rendu(DEFENSE, CATALOGUE);
  assert.match(index, /<h1 id="analyses-titre">Dossiers de vérification<\/h1>/);
  assert.match(dossier, new RegExp(`<h1 class="analyse-rendu__titre">${DEFENSE.titre}</h1>`));
  assert.doesNotMatch(dossier, /<h2 class="analyse-rendu__titre">/);
  assert.match(dossier, /<h2>Confronter l'affirmation aux comptes<\/h2>/);
  assert.doesNotMatch(dossier, /<h3>/);
});

test("chaque libellé de filtre est groupé avec son contrôle", () => {
  const a = analyseMinimale({ slug: "a", titre: "Première", type: "decryptage", themes: ["dette"], budgets_concernes: ["etat"] });
  const b = analyseMinimale({ slug: "b", titre: "Seconde", type: "comparaison", themes: ["securite_sociale"], budgets_concernes: ["secu"] });
  const html = renduIndex([a, b], CATALOGUE);
  assert.match(html, /<div class="analyses-filtres__groupe analyses-filtres__groupe--recherche">\s*<label[^>]*for="analyses-recherche"[\s\S]*?<input[^>]*id="analyses-recherche"/);
  for (const facette of ["type", "theme", "budget"]) {
    assert.match(html, new RegExp(`<div class="analyses-filtres__groupe">\\s*<label[^>]*for="analyses-${facette}"[\\s\\S]*?<select[^>]*id="analyses-${facette}"`));
  }
});

test("le cran et la confusion ne se collent pas l'un à l'autre", () => {
  // « …pas pour ce qu'il désigne Ce qui a été voté confondu… » : deux phrases
  // sans séparateur, vues en lisant le HTML produit.
  const carte = carteDe(renduIndex([DEFENSE], CATALOGUE), DEFENSE.titre);
  assert.match(carte, /désigne — <span class="analyse-rendu__index-confusion">/);
});
