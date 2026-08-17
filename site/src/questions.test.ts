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

test("les questions du recensement portent la réserve qui change la lecture", () => {
  // Le vacant du recensement n'est pas celui de la DGFiP : les deux existent,
  // ils ne donnent pas le même nombre, et l'un pris pour l'autre fait dire au
  // territoire l'inverse de ce qu'il vit.
  const vides = QUESTIONS.find((q) => q.question.includes("logements vides"));
  assert.match(vides!.reponse, /DGFiP/);
  // La catégorie sociale n'est pas définie sous quinze ans : cette population
  // n'est pas celle du site, et le dire évite de la prendre pour dénominateur.
  const habitants = QUESTIONS.find((q) => q.question.includes("Qui habite"));
  assert.match(habitants!.reponse, /quinze ans/);
  assert.match(habitants!.reponse, /pas la population entière/);
  // Un « enfant » du recensement n'a pas d'âge.
  const familles = QUESTIONS.find((q) => q.question.includes("élèvent seules"));
  assert.match(familles!.reponse, /quel que soit son âge/);
  // Domiciliés, pas enregistrés — et une série qui s'arrête le dit.
  const unions = QUESTIONS.find((q) => q.question.includes("marie"));
  assert.match(unions!.reponse, /où les époux habitent/);
  assert.match(unions!.reponse, /2016/);
});

test("une question dont la série n'est pas publiée n'est pas listée", () => {
  // « Rien de cliquable ne doit mener à une section vide » : c'est la règle du
  // simulateur dans le menu et du sommaire de la page. Une question posée
  // au-dessus d'un bloc que la publication ne porte pas mène à une ancre vide.
  const questions = [
    { question: "Publiée", reponse: "oui", cible: "#a", exige: "serie_presente" },
    { question: "Pas encore", reponse: "non", cible: "#b", exige: "serie_absente" },
    { question: "Sans exigence", reponse: "toujours", cible: "#c" },
  ];
  const html = rendu(questions, new Set(["serie_presente"]));
  assert.match(html, /Publiée/);
  assert.match(html, /Sans exigence/);
  assert.doesNotMatch(html, /Pas encore/);
  // Sans catalogue — le rendu pré-rendu au build — rien n'est filtré : le
  // gabarit ne doit pas perdre des questions faute de savoir ce qui est publié.
  assert.match(rendu(questions), /Pas encore/);
});

test("les deux questions neuves déclarent la série dont elles dépendent", () => {
  const neuves = QUESTIONS.filter((q) =>
    ["#bloc-retraites", "#bloc-redistribution"].includes(q.cible),
  );
  assert.equal(neuves.length, 2);
  for (const q of neuves) assert.ok(q.exige, q.question);
});
