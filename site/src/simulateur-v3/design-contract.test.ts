import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../styles/simulateur-v3.css", import.meta.url), "utf8");
const render = readFileSync(new URL("./render.ts", import.meta.url), "utf8");

test("le contrat compact exclut les illustrations, gradients et couleurs positionnelles", () => {
  assert.doesNotMatch(render, /illustrationKind|illustrationDrawing|renderIllustration|decision-illustration|crisis-visual/);
  assert.doesNotMatch(css, /decision-illustration|crisis-visual|crisis-(?:sky|city|crowd|flare)/);
  assert.doesNotMatch(css, /\.simulateur-v3__option:(?:first-child|nth-child|last-child)/);
  assert.doesNotMatch(css, /(?:linear|radial)-gradient/);
});

test("la barre de mandat est bornée à deux rangées et aux hauteurs mobile et desktop", () => {
  assert.match(css, /\.simulateur-v3__command-bar\s*\{[\s\S]*?grid-template-rows:\s*[^;]+;[\s\S]*?max-height:\s*84px;/);
  assert.match(css, /@media \(min-width:\s*60rem\)[\s\S]*?\.simulateur-v3__command-bar\s*\{[\s\S]*?max-height:\s*64px;/);
});

test("le CSS ne conserve aucune variable ou grande hauteur bannie", () => {
  assert.doesNotMatch(css, /--espace-9|min-height:\s*18rem/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\.simulateur-v3__primary,[\s\S]*?min-height:\s*var\(--cible\)/);
});
