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

import type { Analyse } from "./analyse-rendu.ts";
import { LIBELLE_CONFUSION, LIBELLE_CRAN, rendu, renduIndex } from "./analyse-rendu.ts";
import { formater } from "./echelle.ts";

const CATALOGUE = [
  { id: "etat_mission_defense_credits_votes", unite: "EUR" },
  { id: "etat_mission_defense_credits_consommes", unite: "EUR" },
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

test("les quatre étages sont présents dans la sortie", () => {
  const html = rendu(DEFENSE, CATALOGUE);
  assert.match(html, /analyse-rendu__express/);
  assert.match(html, /analyse-rendu__detail/);
  assert.match(html, /analyse-rendu__interactif/);
  assert.match(html, /analyse-rendu__preuve/);
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

test("l'index trie par publie_le décroissant et marque les mises_a_jour", () => {
  const ancienne = analyseMinimale({ slug: "ancienne", publie_le: "2025-01-01", titre: "Ancienne" });
  const recente = analyseMinimale({ slug: "recente", publie_le: "2026-06-01", titre: "Récente" });
  const revisee = analyseMinimale({
    slug: "revisee",
    publie_le: "2025-06-01",
    titre: "Révisée",
    mises_a_jour: [{ date: "2026-01-01", quoi: "Correction d'un montant." }],
  });
  const html = renduIndex([ancienne, recente, revisee]);
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
