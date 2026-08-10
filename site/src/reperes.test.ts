/**
 * Les quatre repères d'ouverture. Ce qui est verrouillé ici : l'ordre des
 * rôles, le silence quand la donnée manque, et le refus de dire une variation
 * qui traverse zéro.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { OUVERTURE, ROLES, rendreReperes, reperes, variationDepuis } from "./reperes.ts";

const BORDEAUX = {
  ofgl_recettes_fonctionnement: { "2019": 351954165.22, "2025": 417137958.52 },
  ofgl_depenses_fonctionnement: { "2019": 294082496.89, "2025": 369011621.25 },
  ofgl_epargne_brute: { "2019": 57871668.33, "2025": 48126337.27 },
  ofgl_encours_dette: { "2019": 252257675.39, "2025": 412980519.9 },
};

test("les quatre repères suivent le trajet de l'argent, pas l'ordre du catalogue", () => {
  const sortie = reperes(BORDEAUX, "commune");
  assert.equal(sortie.length, 4);
  assert.deepEqual(
    sortie.map((r) => r.role),
    ["Ce qu'elle encaisse", "Ce qu'elle dépense", "Ce qui reste", "Ce qu'elle doit"],
  );
  // Ce qui entre moins ce qui sort égale ce qui reste : la chaîne se vérifie à
  // l'écran, et c'est la raison pour laquelle il y a quatre repères et pas cinq.
  const [encaisse, depense, reste] = sortie;
  assert.ok(Math.abs(encaisse.valeur - depense.valeur - reste.valeur) < 1);
});

test("les intitulés tiennent en trois mots et s'accordent avec la maille", () => {
  // Ils passaient sur deux lignes et faisaient monter chaque carte d'autant.
  for (const [niveau, roles] of Object.entries(ROLES)) {
    for (const { role } of roles) {
      assert.ok(
        role.split(/\s+/).length <= 3,
        `« ${role} » (${niveau}) dépasse trois mots`,
      );
    }
  }
  assert.equal(ROLES.commune[3].role, "Ce qu'elle doit");
  assert.equal(ROLES.departement[3].role, "Ce qu'il doit");
  // L'État n'a pas d'épargne brute : son quatrième rôle est un solde.
  assert.equal(ROLES.pays[2].role, "Ce qui manque");
});

test("un rôle sans série publiée disparaît, il ne s'affiche pas vide", () => {
  const sansDette = { ...BORDEAUX } as Record<string, Record<string, number>>;
  delete sansDette.ofgl_encours_dette;
  const sortie = reperes(sansDette, "commune");
  assert.equal(sortie.length, 3);
  assert.ok(!sortie.some((r) => r.terme === "dette"));
  // Une maille sans table de rôles ne rend rien plutôt que de deviner.
  assert.deepEqual(reperes(BORDEAUX, "intercommunalite"), []);
  assert.equal(rendreReperes([]), "");
});

test("une variation ne traverse pas zéro", () => {
  // Le solde budgétaire de l'État passe de l'excédent au déficit sur certaines
  // fenêtres : « −24 686 % » n'y décrit rien. Le repère garde son montant et
  // perd sa variation, plutôt que d'affirmer.
  assert.equal(variationDepuis({ "2019": 618, "2025": -152532 }, "2025"), null);
  assert.equal(variationDepuis({ "2019": -5000, "2025": 4000 }, "2025"), null);
  // Deux valeurs du même signe gardent la leur, négative comprise.
  const baisse = variationDepuis({ "2019": 57871668.33, "2025": 48126337.27 }, "2025");
  assert.ok(baisse !== null && Math.abs(baisse + 16.84) < 0.05);
  // Sans borne d'ouverture publiée, il n'y a rien à comparer.
  assert.equal(variationDepuis({ "2025": 100 }, "2025"), null);
  assert.equal(OUVERTURE, "2019");
});

test("le rendu dit le rôle avant le terme, et le montant en millions", () => {
  const html = rendreReperes(reperes(BORDEAUX, "commune"));
  assert.match(html, /class="reperes"/);
  assert.match(html, /<span class="repere__role">Ce qu&#39;elle encaisse<\/span>/);
  // Le nombre porte le corps de titre, le sigle rejoint la légende. Une seule
  // décimale au-dessus du million : c'est la règle de `millions`, celle de
  // toute la fiche, et un repère n'y déroge pas.
  assert.match(html, /<span class="repere__valeur">417,1<\/span>/);
  assert.match(html, /M€ de recettes · \+18,5\s%/u);
  assert.match(html, /M€ d&#39;épargne · −16,8\s%/u);
  // L'élision se fait devant une voyelle : « d'épargne », jamais « de épargne ».
  assert.doesNotMatch(html, /de épargne/);
  // Le sigle n'est pas resté collé au nombre : c'est une espace fine
  // insécable qui les sépare, pas une espace ordinaire.
  assert.doesNotMatch(html, /class="repere__valeur">[^<]*M€/);
  // Aucun par-habitant dans un repère d'ouverture : la règle du site le réserve
  // aux tableaux dépliés.
  assert.doesNotMatch(html, /par habitant|hab\./);
});

test("les trois états ne portent pas de filet d'accent vertical", () => {
  // Un liseré de couleur à gauche d'un encadré teinté est la signature d'une
  // maquette faite à la chaîne : c'est le premier détail qu'on reconnaît et le
  // dernier qui informe. Il était sur les états vide et erreur, que ce projet
  // a ajoutés ; six autres blocs du site en portent un, plus anciens, et ils
  // ne sont pas touchés ici.
  const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
  const bloc = css.slice(css.indexOf("\n.etat {"), css.indexOf("\n.sommaire-vue"));
  assert.ok(bloc.length > 100, "bloc des états introuvable");
  assert.doesNotMatch(bloc, /border-left/);
  assert.match(bloc, /border-top: 1px solid var\(--trait-fort\);/);
  assert.match(bloc, /border-top-color: var\(--alerte\);/);
});
