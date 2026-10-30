/** Contrats de l’accueil : parcours directs, comptes sourcés et simulation distincte. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { MESSAGE_PRINCIPAL, rendu } from "./accueil.ts";

const SOURCE = readFileSync(new URL("./accueil.ts", import.meta.url), "utf8");

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function page(overrides: Partial<Parameters<typeof rendu>[0]> = {}): string {
  return rendu(overrides);
}

test("l'accueil ouvre les outils utiles sans atelier secondaire", () => {
  const html = page();
  for (const href of ["/bilan/", "/territoire/", "/salaires/", "/analyses/"]) {
    assert.ok(html.includes(`href="${href}"`), href);
  }
  assert.doesNotMatch(html, /class="story-hero"/);
});

test("les comptes observés précèdent Mandats", () => {
  const html = page();
  const comptes = html.indexOf("data-recit");
  const mandats = html.indexOf('class="recit-mandats"');
  assert.ok(comptes !== -1 && mandats !== -1);
  assert.ok(comptes < mandats);
});

test("l'accueil conserve un seul récit et aucun second jeu de questions", () => {
  const html = page();
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
  assert.equal([...html.matchAll(/class="story-question"/g)].length, 0);
  assert.doesNotMatch(html, /Quelques questions pour commencer|QUESTIONS CLÉS/);
  assert.ok(!html.includes("Ce que vous pouvez faire sur 500 Signatures"));
});

test("l'accueil donne une entrée lisible même sans comptes disponibles", () => {
  const html = page();
  assert.ok(html.includes("Les comptes publics, à portée de main."));
  assert.ok(html.includes('href="/sources/"'));
  assert.doesNotMatch(html, /→/);
  assert.doesNotMatch(html, /class="recit-number"/);
});

test("Mandats est explicitement une simulation présidentielle de cinq ans", () => {
  const html = page();
  assert.match(html, /présidentiel/);
  assert.match(html, /[Cc]inq ans/);
  assert.ok(html.includes('href="/mandats/?mode=national"'));
  assert.ok(html.includes("Commencer mon mandat"));
  assert.doesNotMatch(html, /story-mandats__dashboard|story-mandats__metrics/);
});

test("aucun montant par habitant sur l'accueil entier", () => {
  const html = page();
  assert.ok(!/par habitant/i.test(html));
});

test("le module est pur : ni DOM, ni réseau, ni horloge, ni tirage caché", () => {
  const code = sansCommentaires(SOURCE);
  assert.ok(!/document\.|window\.|fetch\(|localStorage/.test(code));
  assert.ok(!/Math\.random|Date\.now|new Date\(/.test(code), "le rendu reste déterministe");
});

test("le message principal n'a qu'une rédaction en code, et une seule en HTML", () => {
  // Le pré-rendu le peint sur la carte de partage du simulateur et le pose en
  // description du gabarit : il lit cette constante-ci. Deux rédactions du même
  // message finiraient par en dire deux choses — c'est un défaut que ce projet
  // a déjà corrigé deux fois.
  const prerendu = readFileSync(new URL("../scripts/prerendre.ts", import.meta.url), "utf8");
  assert.ok(!prerendu.includes("Les chiffres du débat budgétaire"));
  assert.match(prerendu, /import \{[\s\S]*?MESSAGE_PRINCIPAL,?[\s\S]*?\} from "\.\.\/src\/accueil\.ts"/);

  // Le gabarit, lui, le porte en toutes lettres : un `<meta>` ne peut pas lire
  // une constante. Une fois, pas deux — et que ce soit bien la description que
  // le site annonce est vérifié là où la fonction qui la lit vit
  // (prerendre.test.ts, « le gabarit ne s'annonce plus comme une de ses vues »).
  const gabarit = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.equal(gabarit.split(MESSAGE_PRINCIPAL).length - 1, 1);
});

test("le récit utilise le dernier exercice national commun sans inventer les données absentes", () => {
  const html = rendu({ france: {
    nom: "France", parent: null, population: null, drapeaux: {},
    series: {
      eurostat_apu_recettes: { "2023": 1400000, "2024": 1500000, "2025": 1600000 },
      eurostat_apu_depenses: { "2023": 1500000, "2024": 1650000 },
    },
  } });
  assert.match(html, /France · 2024/);
  assert.match(html, /id="recit-recettes"/);
  assert.match(html, /id="recit-depenses"/);
  assert.match(html, /id="recit-ecart"/);
  assert.match(html, /data-nature="deficit"/);
  assert.doesNotMatch(html, /2025/);
  assert.doesNotMatch(rendu({}), /class="recit-number"/);
});
