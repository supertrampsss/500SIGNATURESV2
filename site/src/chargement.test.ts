import assert from "node:assert/strict";
import { test } from "node:test";

import { creerFile, squeletteFiche } from "./chargement.ts";

test("le squelette nomme le territoire demandé", () => {
  const html = squeletteFiche("Bordeaux");
  assert.match(html, /Chargement de <strong>Bordeaux<\/strong>…/);
  // Annoncé aux lecteurs d'écran : l'attente est une information.
  assert.match(html, /role="status"/);
});

test("le squelette échappe le nom", () => {
  const html = squeletteFiche(`L'Île-d'Yeu <b>`);
  assert.ok(!html.includes("<b>"));
  assert.match(html, /L&#39;Île-d&#39;Yeu/);
});

test("sans nom connu, le squelette ne l'invente pas", () => {
  const html = squeletteFiche("   ");
  assert.match(html, /Chargement du territoire…/);
  assert.ok(!html.includes("<strong>"));
});

test("le squelette a la forme de la fiche, pas celle d'un rond qui tourne", () => {
  const html = squeletteFiche("Lyon");
  // Titre, identité, bloc de synthèse, rangée d'onglets, quatre mesures.
  const mesures = html.match(/border-top:1px solid var\(--trait\)/g) ?? [];
  assert.equal(mesures.length, 4);
  assert.ok(html.includes("border-radius:var(--rayon-pilule)"), "rangée d'onglets");
  assert.ok(html.includes("height:6rem"), "bloc de synthèse");
  // Le décor n'est pas lu deux fois : seul le bandeau parle.
  assert.match(html, /aria-hidden="true"/);
});

test("aucun tiret cadratin dans l'état de chargement", () => {
  assert.ok(!squeletteFiche("Bordeaux").includes("—"));
});

test("le même territoire demandé deux fois ne relance rien", () => {
  const file = creerFile();
  assert.equal(file.ouvrir("33063"), 1);
  assert.equal(file.ouvrir("33063"), null);
});

test("un autre territoire prend la main et périme le ticket précédent", () => {
  const file = creerFile();
  const premier = file.ouvrir("33063") as number;
  const second = file.ouvrir("69123") as number;
  assert.equal(file.courant(premier), false);
  assert.equal(file.courant(second), true);
});

test("refermer un ticket périmé ne libère pas la demande en cours", () => {
  const file = creerFile();
  const premier = file.ouvrir("33063") as number;
  const second = file.ouvrir("69123") as number;
  file.fermer(premier);
  // 69123 est toujours en cours : le redemander ne relance rien.
  assert.equal(file.ouvrir("69123"), null);
  file.fermer(second);
  assert.equal(typeof file.ouvrir("69123"), "number");
});

test("après fermeture, le même territoire peut être rouvert", () => {
  const file = creerFile();
  const ticket = file.ouvrir("33063") as number;
  file.fermer(ticket);
  assert.equal(file.ouvrir("33063"), 2);
});
