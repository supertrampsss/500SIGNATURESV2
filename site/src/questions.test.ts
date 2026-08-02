/**
 * Une liste de questions est une promesse. Ces tests vérifient qu'elle ne
 * promet rien que le site ne tienne : chaque cible existe dans la page, et
 * aucune formulation ne laisse croire qu'un euro est traçable.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { QUESTIONS, rendu } from "./questions.ts";

const PAGE = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("chaque question pointe vers une section qui existe vraiment", () => {
  // Deux formes de cible honnêtes : l'ancre d'une section présente dans la
  // page, ou un lien d'état (l'état du site vit dans l'URL, docs/04) dont
  // chaque paramètre est un paramètre d'état réel — un nom inventé ferait un
  // lien qui recharge la page sans rien changer.
  const parametresConnus = new Set([
    "theme", "indicateur", "niveau", "periode", "affichage", "territoire", "comparer", "vue",
  ]);
  for (const { cible } of QUESTIONS) {
    if (cible.startsWith("?")) {
      const parametres = [...new URLSearchParams(cible).keys()];
      assert.ok(parametres.length > 0, cible);
      for (const parametre of parametres) {
        assert.ok(parametresConnus.has(parametre), `paramètre d'état inconnu : ${parametre}`);
      }
      continue;
    }
    assert.ok(cible.startsWith("#"), cible);
    assert.ok(PAGE.includes(`id="${cible.slice(1)}"`), `cible absente de la page : ${cible}`);
  }
});

test("aucune question ne promet de suivre un euro", () => {
  const texte = QUESTIONS.map((q) => `${q.question} ${q.reponse}`).join(" ").toLowerCase();
  for (const promesse of ["suivez votre impôt", "suivre votre impôt", "traçabilité de l'euro"]) {
    assert.doesNotMatch(texte, new RegExp(promesse));
  }
  // et la seule question qui s'en approche porte son démenti
  const cent = QUESTIONS.find((q) => q.cible === "#bloc-cent-euros");
  assert.match(cent!.reponse, /proportion, pas le trajet d'un euro/);
});

test("les réserves connues accompagnent les questions concernées", () => {
  const commune = QUESTIONS.find((q) => q.question.includes("communes comparables"));
  assert.match(commune!.reponse, /ne signifie pas une meilleure gestion/);
  const dette = QUESTIONS.find((q) => q.question.includes("dette"));
  assert.match(dette!.reponse, /n'est pas une donnée publique détaillée/);
  // la délinquance enregistrée n'est ni la délinquance commise ni des
  // condamnations : la réserve fait partie de la réponse, pas d'une note de
  // bas de page
  const securite = QUESTIONS.find((q) => q.question.includes("cambriolée"));
  assert.match(securite!.reponse, /pas l'intégralité des faits commis/);
  assert.match(securite!.reponse, /ni des condamnations/);
});

test("le rendu échappe le contenu et garde l'ordre déclaré", () => {
  const html = rendu([
    { question: "A <b>", reponse: "r", cible: "#x" },
    { question: "B", reponse: "r", cible: "#y" },
  ]);
  assert.match(html, /A &lt;b&gt;/);
  assert.ok(html.indexOf("A &lt;b&gt;") < html.indexOf(">B<"));
});
