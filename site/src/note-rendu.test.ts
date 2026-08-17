/**
 * Le bloc de note à l'écran.
 *
 * Ces tests portent sur ce que le lecteur lit, pas sur ce que le calcul rend :
 * un barème juste peint en « −0,7 % de marge » publie une faute de méthode.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { SOLVABILITE_POINTS, note, noter, solvabilite } from "./note.ts";
import { lignes, phraseExecutif, rendreNote } from "./note-rendu.ts";

const SOLIDE = {
  ofgl_recettes_fonctionnement: { "2019": 90e6, "2025": 100e6 },
  ofgl_epargne_brute: { "2019": 13.5e6, "2025": 20e6 },
  ofgl_encours_dette: { "2019": 50e6, "2025": 60e6 },
};

/** Le texte que le lecteur voit, balises ôtées. */
function texte(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

test("un territoire non noté ne peint rien plutôt qu'un cadre vide", () => {
  // La France n'a pas de barème : le bloc ne s'écrit pas. Un cadre « note
  // indisponible » occuperait la première place de la fiche pour dire qu'il
  // n'a rien à dire.
  assert.equal(rendreNote(null), "");
});

test("le détail additionné redonne le total affiché", () => {
  // C'est la promesse du bloc : une note qu'on recalcule de tête. Elle est
  // vérifiée sur les CHIFFRES PEINTS, pas sur les nombres du calcul — c'est
  // l'arrondi de l'affichage qui l'avait cassée une première fois.
  const html = rendreNote(note(SOLIDE, "commune"), SOLIDE);
  const points = [...html.matchAll(/class="note__points">([^<]*)</g)].map((m) =>
    Number(m[1].replace(",", ".")),
  );
  assert.equal(points.length, 3);
  const total = Number(html.match(/<strong>([^<]*)<\/strong>/)?.[1].replace(",", "."));
  assert.equal(Math.round(points.reduce((s, p) => s + p, 0) * 10) / 10, total);
});

test("la colonne de points garde sa décimale", () => {
  // Trois nombres lus de haut en bas et additionnés : « 8 » entre « 4,3 » et
  // « 3,1 » casse l'alignement de la seule colonne que le lecteur vérifie.
  // `Intl` laisse tomber la décimale sur un compte rond — c'est le défaut que
  // cinq formateurs du dépôt ont porté.
  const parfait = noter(
    { tauxEpargne: 90, desendettement: 0.1, trajectoire: 40, exercice: "2025" },
    "commune",
  );
  const html = rendreNote(parfait);
  for (const p of [...html.matchAll(/class="note__points">([^<]*)</g)].map((m) => m[1])) {
    assert.match(p, /^\d+,\d$/, `« ${p} » a perdu sa décimale`);
  }
  assert.match(html, /<strong>20,0<\/strong>/);
});

test("un taux varie en points, jamais en pourcentage", () => {
  // La trajectoire est l'écart entre deux taux d'épargne. « −4,9 % » dirait
  // que la marge a perdu 4,9 % de sa valeur, quand elle a perdu 4,9 points de
  // recettes. C'est la règle que le dépôt tient partout ailleurs.
  const html = rendreNote(
    noter({ tauxEpargne: 12, desendettement: 5, trajectoire: -4.9, exercice: "2025" }, "commune"),
  );
  // `texte()` normalise les blancs, et `\s` en JavaScript **comprend
  // l'insécable** : après normalisation l'espace de l'unité est ordinaire.
  // C'est pourquoi ce motif-ci en porte une ordinaire, quand le test du
  // pluriel ci-dessous lit la chaîne brute et en exige une insecable. Les deux
  // assertions ne portent pas sur la même chaîne.
  const lu = texte(html);
  assert.match(lu, /−4,9 points de marge/);
  assert.doesNotMatch(lu, /−4,9 ?% de marge/);
});

test("le pluriel commence à 2, et l'espace de l'unité est insécable", () => {
  // « −0,7 points » et « 1,5 années » se lisent comme des fautes de frappe et
  // font douter du reste du bloc.
  //
  // L'insécable s'écrit `\u00a0` dans ces motifs, jamais au clavier : tapée à
  // la main elle est invisible, et c'est la neuvième fois dans ce dépôt qu'une
  // espace qu'on croyait ordinaire fait échouer — ou pire, passer — une
  // vérification.
  const petit = lignes(
    noter({ tauxEpargne: 12, desendettement: 1.5, trajectoire: -0.7, exercice: "2025" }, "commune"),
  );
  assert.match(petit[1].mesure, /^1,5\u00a0année d'épargne$/);
  assert.match(petit[2].mesure, /^−0,7\u00a0point de marge$/);
  const grand = lignes(
    noter({ tauxEpargne: 12, desendettement: 3, trajectoire: 4.9, exercice: "2025" }, "commune"),
  );
  assert.match(grand[1].mesure, /^3,0\u00a0années d'épargne$/);
  assert.match(grand[2].mesure, /^\+4,9\u00a0points de marge$/);
});

test("une épargne nulle se dit en toutes lettres, jamais en durée", () => {
  // Le ratio n'existe pas : écrire « ∞ années » ou « 999 ans » ferait passer
  // une impossibilité pour une durée mesurée.
  const [, dette] = lignes(
    noter({ tauxEpargne: -10, desendettement: null, trajectoire: -3, exercice: "2025" }, "commune"),
  );
  assert.equal(dette.mesure, "aucune épargne pour rembourser");
  assert.equal(dette.points, "0,0");
});

test("le bloc porte son exercice et sa source", () => {
  const lu = texte(rendreNote(note(SOLIDE, "commune"), SOLIDE));
  // Un chiffre ne s'affiche jamais seul (docs/04) : millésime et source.
  assert.match(lu, /Exercice 2025/);
  assert.match(lu, /OFGL/);
});

test("le bloc ne porte aucun paragraphe de portée", () => {
  // Six lignes sous trois chiffres pour dire ce que les trois chiffres
  // montrent déjà : « la note mesure la solvabilité de X […] elle ne juge ni
  // le niveau de dépense ». Retirée de la fiche à la demande de l'auteur.
  //
  // **Elle n'est pas perdue pour autant**, et c'est ce qui rend le retrait
  // acceptable : les règles d'affichage de la page BILAN la portent, là où va
  // le lecteur qui conteste une note. Ce test tient le retrait ; celui de
  // `methode-rendu.test.ts` tient la présence là-bas. Les deux ensemble
  // disent la décision.
  const lu = texte(rendreNote(note(SOLIDE, "commune"), SOLIDE));
  assert.doesNotMatch(lu, /ne juge ni le niveau de dépense/);
  assert.doesNotMatch(lu, /choix d'électeurs/);
  assert.doesNotMatch(lu, /La note mesure la solvabilité/);
});

test("le parcours donne la solvabilité de chaque exercice, 2019 compris", () => {
  // La question qu'une note seule laisse ouverte : « et avant, c'était
  // mieux ? ». La trajectoire y répond pour la marge et ne dit rien de la
  // dette — une collectivité peut avoir gagné de la marge en empruntant.
  const lu = texte(rendreNote(note(SOLIDE, "commune"), SOLIDE));
  assert.match(lu, /exercice par exercice/);
  assert.match(lu, /2019/);
  assert.match(lu, /Solvabilité sur 16/);
  // Sur 16, et le tableau dit pourquoi : le troisième terme est un écart
  // depuis 2019, il n'existe pas pour 2019 même.
  assert.match(lu, /écart depuis 2019/);
});

test("le parcours ne s'écrit pas sur une seule colonne", () => {
  // Une valeur unique ne s'analyse pas — la règle du dépôt pour tout tableau
  // d'exercices.
  const seul = {
    ofgl_recettes_fonctionnement: { "2025": 100e6 },
    ofgl_epargne_brute: { "2025": 20e6 },
    ofgl_encours_dette: { "2025": 60e6 },
  };
  assert.doesNotMatch(texte(rendreNote(note(seul, "commune"), seul)), /exercice par exercice/);
});

test("la solvabilité d'un exercice est la somme de ses deux termes affichés", () => {
  // Comme la note : un lecteur qui additionne la colonne doit retrouver le
  // total, sinon le tableau passe pour bricolé.
  for (const exercice of ["2019", "2025"]) {
    const c = solvabilite(SOLIDE, exercice, "commune");
    assert.ok(c, exercice);
    assert.equal(Math.round((c.marge + c.dette) * 10) / 10, c.valeur, exercice);
    assert.ok(c.valeur <= SOLVABILITE_POINTS);
  }
});

test("un exercice sans les trois séries n'a pas de solvabilité", () => {
  assert.equal(solvabilite(SOLIDE, "2021", "commune"), null);
  // Et un échelon sans barème n'en a pas non plus.
  assert.equal(solvabilite(SOLIDE, "2025", "pays"), null);
});

test("le bloc lit le barème de SON échelon", () => {
  // Les points sur lesquels chaque terme est noté viennent du barème qui a
  // produit la note. Lire un autre échelon afficherait « 3,7 / 8 » sous une
  // grille qui n'a pas servi au calcul.
  const source = readFileSync(new URL("./note-rendu.ts", import.meta.url), "utf8");
  assert.match(
    source,
    /bornes\(note\.niveau\)/,
    "le barème est lu ailleurs que sur l'échelon de la note",
  );
});

test("la phrase d'exécutif ne revendique que les exercices entièrement couverts", () => {
  // Pierre HURMIC prend ses fonctions en juillet 2020 : 2021 à 2025 sont les
  // siens, 2020 est à cheval, et 2019 appartient à quelqu'un que la source ne
  // nomme pas. Revendiquer 2020 ou 2019 lui attribuerait des comptes qu'il n'a
  // pas tenus.
  const exercices = ["2019", "2020", "2021", "2022", "2023", "2024", "2025"];
  const lu = phraseExecutif(
    { nom: "Pierre HURMIC", depuis: "2020-07-03" },
    "Maire",
    exercices,
    "2026-03-22",
  );
  assert.match(lu, /les exercices 2021 à 2025 sont entièrement les siens/);
  assert.doesNotMatch(lu, /2019/);
});

test("un ancien exécutif ne se dit pas au présent", () => {
  // **Le défaut signalé par l'auteur.** La légende écrivait « Maire Pierre
  // HURMIC EST EN FONCTION DEPUIS juillet 2020 » sur une fiche qui nomme
  // Thomas CAZENAVE comme maire deux lignes plus haut : un présent et un
  // « depuis » sans fin décrivent quelqu'un qui exerce encore, et le lecteur y
  // lit deux maires à la fois.
  //
  // La fin existe et elle est publiée : c'est la prise de fonction du
  // successeur. Un mandat finit quand le suivant commence.
  const exercices = ["2019", "2020", "2021", "2022", "2023", "2024", "2025"];
  const ancien = phraseExecutif(
    { nom: "Pierre HURMIC", depuis: "2020-07-03" },
    "Maire",
    exercices,
    "2026-03-22",
  );
  assert.match(ancien, /Maire Pierre HURMIC a été en fonction de juillet 2020 à mars 2026/);
  assert.doesNotMatch(ancien, /est en fonction/);

  // Sans successeur publié, aucune fin n'est inventée et le présent reste
  // juste : c'est le cas des présidents de département et de région, qui
  // exercent bel et bien encore.
  const enCours = phraseExecutif({ nom: "Jean-Luc GLEYZE", depuis: "2021-07-01" }, "Président", exercices);
  assert.match(enCours, /Président Jean-Luc GLEYZE est en fonction depuis juillet 2021/);
  assert.doesNotMatch(enCours, /a été/);

  // Une fin antérieure au début serait une donnée fausse en amont : on
  // n'écrit pas une période à l'envers.
  const envers = phraseExecutif(
    { nom: "A B", depuis: "2020-07-03" },
    "Maire",
    exercices,
    "2019-01-01",
  );
  assert.match(envers, /est en fonction depuis juillet 2020/);
});

test("un exécutif entré après le dernier exercice n'est pas nommé", () => {
  // Un maire élu en mars 2026 face à des comptes qui s'arrêtent en 2025 :
  // poser son nom là lui attribuerait un bilan qui n'est pas le sien. C'est le
  // cas de presque tous les maires en exercice.
  const exercices = ["2019", "2020", "2021", "2022", "2023", "2024", "2025"];
  assert.equal(phraseExecutif({ nom: "Thomas CAZENAVE", depuis: "2026-03-22" }, "Maire", exercices), "");
  // Ni un exécutif sans date, ni une date illisible.
  assert.equal(phraseExecutif({ nom: "X", depuis: null }, "Maire", exercices), "");
  assert.equal(phraseExecutif({ nom: "X", depuis: "pas une date" }, "Maire", exercices), "");
  assert.equal(phraseExecutif(undefined, "Maire", exercices), "");
});

test("un seul exercice couvert se dit au singulier", () => {
  const lu = phraseExecutif({ nom: "A B", depuis: "2024-03-01" }, "Maire", ["2024", "2025"]);
  assert.match(lu, /l'exercice 2025 sont entièrement le sien|l'exercice 2025/);
  assert.doesNotMatch(lu, /les siens/);
});

test("le nom de l'exécutif est échappé dans la légende", () => {
  const lu = phraseExecutif({ nom: `L'<script>`, depuis: "2020-07-03" }, "Maire", ["2022", "2023"]);
  assert.doesNotMatch(lu, /<script>/);
  assert.match(lu, /&lt;script&gt;/);
});
