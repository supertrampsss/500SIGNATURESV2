/**
 * Le palmarès. Ce qu'il refuse compte autant que ce qu'il range : il publie le
 * haut et le bas d'un échelon entier, et chaque approximation y devient une
 * accusation contre un territoire nommé.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { noter } from "./note.ts";
import { palmares, rendrePalmares, type Ligne } from "./palmares.ts";

/** Un échelon d'essai : `n` territoires dont la note décroît régulièrement. */
function echelon(n: number, exercice = "2025"): Ligne[] {
  return Array.from({ length: n }, (_, i) => ({
    code: `c${i}`,
    nom: `Ville ${String(i).padStart(3, "0")}`,
    // Une marge qui décroît donne une note qui décroît, sans plafonner.
    note: noter(
      { tauxEpargne: 30 - (i * 26) / n, desendettement: 4, trajectoire: -2.7, exercice },
      "commune",
    ),
  }));
}

const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

test("les deux bouts ne se chevauchent jamais", () => {
  // Sous vingt territoires notés, prendre dix en haut et dix en bas montrerait
  // la même commune parmi les meilleures ET parmi les pires. Le lecteur y
  // lirait une contradiction, et il aurait raison.
  for (const n of [1, 2, 3, 7, 12, 19, 20, 21, 100]) {
    const p = palmares(echelon(n));
    assert.ok(p, `${n} territoires`);
    const hauts = new Set(p.tete.map((l) => l.code));
    for (const bas of p.queue) {
      assert.ok(!hauts.has(bas.code), `${n} territoires : ${bas.nom} est en haut ET en bas`);
    }
  }
});

test("le haut se lit de haut en bas, le bas de bas en haut", () => {
  const p = palmares(echelon(100));
  assert.ok(p);
  // La meilleure d'abord.
  assert.ok(p.tete[0].note.valeur >= p.tete[1].note.valeur);
  // Et la pire d'abord dans l'autre colonne : le bas se lit en partant du bas.
  assert.ok(p.queue[0].note.valeur <= p.queue[1].note.valeur);
  assert.equal(p.queue[0].note.valeur, Math.min(...echelon(100).map((l) => l.note.valeur)));
});

test("le dénombrement porte sur ceux qui publient, jamais sur ceux qui existent", () => {
  // « 10 meilleures sur 34 875 » serait faux : 34 778 communes publient les
  // trois séries. Un rang se dit sur les publiants — c'est la règle que
  // `situation.ts` tient déjà, et le palmarès ne peut pas y déroger.
  const p = palmares(echelon(97));
  assert.ok(p);
  assert.equal(p.effectif, 97);
  assert.match(texte(rendrePalmares(p, "commune")), /sur 97 communes qui publient/);
});

test("un ex æquo ne fait pas bouger le palmarès d'une visite à l'autre", () => {
  // `Object.keys` ne garantit pas un ordre, et deux publications des mêmes
  // données rendraient deux palmarès différents. Le nom départage.
  const memeNote = (code: string, nom: string): Ligne => ({
    code,
    nom,
    note: noter({ tauxEpargne: 20, desendettement: 4, trajectoire: 1, exercice: "2025" }, "commune"),
  });
  const a = palmares([memeNote("x", "Zoé"), memeNote("y", "Alice"), memeNote("z", "Marc")], 1);
  const b = palmares([memeNote("z", "Marc"), memeNote("x", "Zoé"), memeNote("y", "Alice")], 1);
  assert.ok(a && b);
  assert.deepEqual(
    a.tete.map((l) => l.code),
    b.tete.map((l) => l.code),
  );
  assert.equal(a.tete[0].nom, "Alice");
});

test("la médiane est écrite, pour que les deux bouts aient un milieu", () => {
  // Dix communes à 19/20 posées au-dessus de dix communes à 1/20 laissent
  // croire que l'échelon se répartit en deux camps.
  const p = palmares(echelon(101));
  assert.ok(p);
  const lu = texte(rendrePalmares(p, "commune"));
  assert.match(lu, /note médiane est de \d+,\d sur 20/);
});

test("un exercice minoritaire est compté, jamais tu", () => {
  // Une poignée de communes s'arrête un an plus tôt. Dater tout le tableau de
  // l'exercice le plus fréquent, sans le dire, en ferait un tableau faux.
  const lignes = [...echelon(30), ...echelon(3, "2024").map((l, i) => ({ ...l, code: `v${i}` }))];
  const p = palmares(lignes);
  assert.ok(p);
  assert.equal(p.exercice, "2025");
  assert.equal(p.autresExercices, 3);
  assert.match(texte(rendrePalmares(p, "commune")), /3 sont notées sur l'exercice précédent/);
  // Et le singulier quand il n'y en a qu'une.
  const seule = palmares([...echelon(30), { ...echelon(1, "2024")[0], code: "seul" }]);
  assert.ok(seule);
  assert.match(texte(rendrePalmares(seule, "commune")), /1 est notée sur l'exercice précédent/);
});

test("un échelon entièrement sur le même exercice ne dit rien de plus", () => {
  // Une phrase « 0 sont notées sur l'exercice précédent » est du bruit.
  const p = palmares(echelon(50));
  assert.ok(p);
  assert.equal(p.autresExercices, 0);
  assert.doesNotMatch(texte(rendrePalmares(p, "commune")), /exercice précédent/);
});

test("les notes gardent leur décimale : c'est une colonne", () => {
  // Deux colonnes lues de haut en bas. « 20 » entre « 19,4 » et « 18,7 »
  // casse l'alignement, et `Intl` laisse tomber la décimale sur un compte rond.
  const parfaite: Ligne = {
    code: "p",
    nom: "Parfaite",
    note: noter({ tauxEpargne: 90, desendettement: 0.1, trajectoire: 40, exercice: "2025" }, "commune"),
  };
  const html = rendrePalmares(palmares([parfaite, ...echelon(40)]), "commune");
  for (const v of [...html.matchAll(/class="palmares__note nombre">([^<]*)</g)].map((m) => m[1])) {
    assert.match(v, /^\d+,\d$/, `« ${v} » a perdu sa décimale`);
  }
});

test("un échelon inconnu ne peint rien plutôt qu'un tableau sans dénominateur", () => {
  // La France n'a pas de barème, donc pas de palmarès. Un cadre vide occuperait
  // la page pour dire qu'il n'a rien à dire.
  assert.equal(rendrePalmares(palmares(echelon(30)), "pays"), "");
  assert.equal(rendrePalmares(null, "commune"), "");
  assert.equal(palmares([]), null);
});

test("chaque ligne ouvre la fiche du territoire, et son nom est échappé", () => {
  const html = rendrePalmares(
    palmares([
      { ...echelon(1)[0], code: "33063", nom: `L'Île-d'Yeu <script>` },
      ...echelon(30).map((l, i) => ({ ...l, code: `z${i}` })),
    ]),
    "commune",
  );
  assert.match(html, /data-territoire="33063"/);
  assert.doesNotMatch(html, /<script>/);
});
