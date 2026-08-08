/**
 * Une définition qui affiche ses étoiles n'a pas été relue.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { echapper, emphase } from "./texte.ts";

test("les passages marqués en gras le deviennent", () => {
  assert.equal(
    emphase("**Rupture attendue en 2025** : la loi change le comptage."),
    "<strong>Rupture attendue en 2025</strong> : la loi change le comptage.",
  );
});

test("une définition ne peut pas écrire du HTML", () => {
  // Le texte vient du pipeline, mais l'échappement précède la conversion :
  // une balise dans une fiche technique reste du texte.
  assert.equal(emphase("<script>x</script>"), "&lt;script&gt;x&lt;/script&gt;");
  assert.equal(emphase("**<b>gras</b>**"), "<strong>&lt;b&gt;gras&lt;/b&gt;</strong>");
});

test("une étoile isolée reste une étoile", () => {
  assert.equal(emphase("un astérisque * seul"), "un astérisque * seul");
  assert.equal(emphase("**pas fermé"), "**pas fermé");
});

test("l'échappement couvre les cinq caractères qui cassent une page", () => {
  assert.equal(echapper(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
});
