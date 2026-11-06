import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { communeChoisie, rechercherCommunes } from "./recherche.ts";
import { rail } from "./rendu.ts";

const entree = (c: string, n: string, p = "33") => ({ c, n, p, l: "commune" });
const index = [entree("33063", "Bordeaux"), entree("45202", "Bordeaux-en-Gâtinais", "45"), entree("33394", "Saint-Émilion"), entree("33125", "Les Églisottes-et-Chalaures")];

test("noms accentués, mots internes et ponctuation retrouvent les communes", () => {
  for (const q of ["Saint-Emilion", " saint emilion ", "Émilion"]) assert.equal(rechercherCommunes(index, q).resultats[0]?.c, "33394");
  assert.equal(rechercherCommunes(index, "eglisottes chalaures").resultats[0]?.c, "33125");
  assert.equal(rechercherCommunes(index, "Borde").total, 2);
  assert.equal(rechercherCommunes(index, "zzzzz").total, 0);
});

test("un code postal partagé conserve toutes les communes publiées sans inventer de fiche", () => {
  const r = rechercherCommunes(index, "33999", { "33999": ["33063", "33394", "99999"] });
  assert.deepEqual(r.resultats.map(e => e.c), ["33063", "33394"]);
  assert.equal(r.total, 2);
  assert.equal(communeChoisie(r.resultats, r.total, -1), undefined);
  assert.equal(communeChoisie(r.resultats, r.total, 1)?.c, "33394");
  assert.equal(rechercherCommunes(index, "33063").resultats[0]?.c, "33063");
});

test("une liste tronquée ou ambiguë ne choisit pas automatiquement la première commune", () => {
  const nombreux = Array.from({ length: 12 }, (_, i) => entree(String(33000 + i), `Saint Test ${i}`));
  const r = rechercherCommunes(nombreux, "Saint");
  assert.equal(r.total, 12); assert.equal(r.resultats.length, 8);
  assert.equal(communeChoisie(r.resultats, r.total, -1), undefined);
  assert.equal(communeChoisie([index[0]], 1, -1), index[0]);
});

test("l'instantané postal officiel est daté, valide et relie Bordeaux à 33000", () => {
  const snapshot = JSON.parse(readFileSync(new URL("../../public/recherche/codes-postaux.json", import.meta.url), "utf8"));
  assert.equal(new URL(snapshot.source).hostname, "geo.api.gouv.fr");
  assert.ok(Number.isFinite(Date.parse(snapshot.extrait_le)));
  assert.ok(snapshot.codes["33000"].includes("33063"));
  assert.ok(Object.keys(snapshot.codes).length > 6000);
  for (const [postal, codes] of Object.entries(snapshot.codes)) {
    assert.match(postal, /^\d{5}$/);
    assert.ok(Array.isArray(codes) && codes.length > 0);
    for (const code of codes as string[]) assert.match(code, /^[0-9AB]{5}$/);
  }
});

test("les chapitres ont un nom accessible indépendant du texte masqué et un sommaire", () => {
  const html = rail();
  assert.match(html, /<details class="recit__sommaire"><summary>Chapitres/);
  assert.match(html, /data-rail="ville" aria-label="Votre ville"/);
  assert.match(html, /data-chapitre-lien="ville">Votre ville/);
});
