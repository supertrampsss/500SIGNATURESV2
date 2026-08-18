/**
 * Les barres de magnitude : ce qu'une figure doit garantir pour ne pas mentir.
 *
 * Une barre est un rapport de longueurs. Les trois choses qui la rendent fausse
 * — une échelle qui ne part pas de zéro, un maximum pris ailleurs que dans les
 * données, un regroupement peint comme un poste — ne se voient pas à l'œil sur
 * une figure isolée : elles se voient ici.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { barresMagnitude, type Part } from "./barres.ts";

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

const VENTILATION: Part[] = [
  { libelle: "Retraites", valeur: 24.09 },
  { libelle: "Chômage", valeur: 2.7 },
  { libelle: "Hors protection sociale", valeur: 0.41, regroupement: true },
];

function largeurs(html: string): number[] {
  return [...html.matchAll(/width:([0-9.]+)%/g)].map((m) => Number(m[1]));
}

test("la longueur est proportionnelle à la valeur, sur une échelle qui part de zéro", () => {
  // C'est LA garantie d'une barre. Une échelle tronquée — commencée à la plus
  // petite valeur plutôt qu'à zéro — ferait lire « deux fois » là où le rapport
  // est de un à neuf, et rien dans la figure ne le dirait.
  const [retraites, chomage, reste] = largeurs(barresMagnitude("t", VENTILATION, euros));
  assert.equal(retraites, 100);
  assert.equal(chomage, Number(((2.7 / 24.09) * 100).toFixed(2)));
  assert.equal(reste, Number(((0.41 / 24.09) * 100).toFixed(2)));
  // Le rapport dessiné est le rapport des nombres : neuf fois.
  assert.ok(Math.abs(retraites / chomage - 24.09 / 2.7) < 0.01);
});

test("le maximum vient des données affichées, jamais d'ailleurs", () => {
  // Une même figure rendue sur un sous-ensemble doit se renormaliser : sinon la
  // plus grande barre d'un tableau filtré resterait courte sans raison visible.
  const [premiere] = largeurs(barresMagnitude("t", VENTILATION.slice(1), euros));
  assert.equal(premiere, 100);
});

test("un regroupement ne prend pas la teinte d'un poste", () => {
  // « Ce qui reste » n'est pas une catégorie nommée : peint comme les autres,
  // il se lirait comme un poste de plus.
  const html = barresMagnitude("t", VENTILATION, euros);
  const rangs = html.split("<li");
  assert.doesNotMatch(rangs[1], /barres__marque--reste/);
  assert.match(rangs[3], /barres__marque--reste/);
});

test("chaque barre porte son libellé et sa valeur : l'identité ne tient pas à la couleur", () => {
  const html = barresMagnitude("Pour 100 € encaissés", VENTILATION, euros);
  for (const attendu of ["Retraites", "24,09 €", "Chômage", "2,70 €", "Pour 100 € encaissés"]) {
    assert.ok(html.includes(attendu), attendu);
  }
});

test("le formatage vient de l'appelant, pas de la figure", () => {
  // La figure ne connaît pas l'unité de ce qu'elle dessine. Si elle la
  // décidait, elle afficherait des euros sur des points de pourcentage.
  const html = barresMagnitude("t", [{ libelle: "Taux", valeur: 12.5 }], (v) => `${v} points`);
  assert.match(html, /12\.5 points/);
  assert.doesNotMatch(html, /€/);
});

test("rien n'est peint quand rien n'est mesurable", () => {
  assert.equal(barresMagnitude("t", [], euros), "");
  assert.equal(barresMagnitude("t", [{ libelle: "Néant", valeur: 0 }], euros), "");
});

test("les libellés sont échappés", () => {
  const html = barresMagnitude("t", [{ libelle: '<img src=x onerror="a">', valeur: 1 }], euros);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

test("aucun disque ne compare plus des tailles sur ce site", () => {
  // La direction du 18 août 2026 vaut pour TOUT le site, et trois camemberts y
  // survivaient : deux dans « 100 € du budget de l'État », un dans « 100 € de
  // prestations sociales ». L'œil compare des longueurs alignées, pas des
  // angles — et la gamme de huit teintes qui les peignait échouait quatre
  // contrôles de palette sur cinq, dont sept teintes sur huit sous le plancher
  // de chroma : un disque dont sept parts sur huit lisent comme du gris.
  //
  // La garde balaie les modules, pas une liste écrite à la main : une liste
  // écrite à la main ne pousse pas, et ce dépôt l'a déjà appris trois fois.
  const modules = readdirSync(new URL(".", import.meta.url))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  for (const nom of modules) {
    const source = readFileSync(new URL(nom, import.meta.url), "utf8");
    // Le mot reste permis en commentaire — il raconte pourquoi la figure a
    // changé. Ce qui est refusé est de le RENDRE : une classe, une balise.
    const rendu = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    assert.doesNotMatch(rendu, /camembert/, `${nom} rend encore un camembert`);
    // Un arc de disque se trace en `stroke-dasharray` sur un `<circle>` : la
    // forme peut revenir sous un autre nom, pas sous une autre technique.
    assert.doesNotMatch(rendu, /<circle[\s\S]{0,200}stroke-dasharray/, nom);
  }
});

test("la gamme de huit teintes qui a échoué au validateur n'est plus déclarée", () => {
  // #0f1b2e, #c56a4d, #6e7d73, #b69b53, #41547a, #8b6a52, #8b93a0, #5d6d66 :
  // ΔE 5,3 en protanopie (seuil 8), ΔE 13,3 en vision normale (seuil 15),
  // contraste 2,58:1 et 2,97:1 (seuil 3:1), sept teintes sous le plancher de
  // chroma. Elle était écrite en dur dans `cent-euros.ts` et peignait deux
  // camemberts.
  //
  // Ce que la garde refuse est la GAMME, pas ses teintes une à une : la
  // validation est une propriété de l'ensemble, et trois de ces tons servent
  // encore d'identité de pays sur les courbes de conjoncture — une identité,
  // pas un rang ni une valeur, ce que la charte autorise. Quatre au même
  // endroit, c'est la gamme qui revient.
  const GAMME = [
    "#0f1b2e",
    "#c56a4d",
    "#6e7d73",
    "#b69b53",
    "#41547a",
    "#8b6a52",
    "#8b93a0",
    "#5d6d66",
  ];
  const modules = readdirSync(new URL(".", import.meta.url)).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
  );
  for (const nom of modules) {
    const source = readFileSync(new URL(nom, import.meta.url), "utf8");
    const rendu = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    const presentes = GAMME.filter((teinte) => rendu.includes(teinte));
    assert.ok(presentes.length < 4, `${nom} redéclare la gamme : ${presentes.join(", ")}`);
  }
});

test("un titre vide ne laisse pas une légende vide au-dessus de la figure", () => {
  // L'appelant qui a déjà écrit le titre au-dessus passe `""` : sans cette
  // coupe, « D'où viennent 100 € ? » se lisait deux fois de suite — vu au
  // navigateur, pas déduit.
  const html = barresMagnitude("", VENTILATION, euros);
  assert.doesNotMatch(html, /figcaption/);
  assert.match(html, /barres__rangs/);
  // Et un titre donné reste écrit.
  assert.match(barresMagnitude("Un titre", VENTILATION, euros), /barres__titre">Un titre</);
});
