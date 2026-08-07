/**
 * La maille : celle que le zoom choisit, et celles que la recherche propose.
 *
 * Le second point n'est pas cosmétique. Le site et ses données ne se déploient
 * pas ensemble — l'un passe par Pages, l'autre par un run d'ingestion — et
 * pendant l'écart, l'index de recherche décrit un monde que le code ne connaît
 * plus. Le retrait de l'intercommunalité a rendu cet écart concret.
 */

import {
  MAILLES_HORS_CARTE, NIVEAUX_RECHERCHABLES, niveauPourZoom, suggestions,
} from "./mailles.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

const entree = (c: string, n: string, l: string) => ({ c, n, l, p: null });

const INDEX = [
  entree("33063", "Bordeaux", "commune"),
  entree("243300316", "Bordeaux Métropole", "epci"),
  entree("33", "Gironde", "departement"),
  entree("75", "Nouvelle-Aquitaine", "region"),
];

test("une maille que le site ne connaît plus n'est jamais proposée", () => {
  // Le cas réel : entre le déploiement qui retire l'intercommunalité et la
  // publication qui la purge, « Bordeaux Métropole » reste dans l'index. La
  // proposer afficherait « epci » en clair et ouvrirait une fiche que le site
  // ne sait plus intituler.
  const trouves = suggestions(INDEX, "bordeaux", "commune");
  assert.deepEqual(
    trouves.map((e) => e.n),
    ["Bordeaux"],
  );
});

test("chaque suggestion porte un libellé, jamais un code technique", () => {
  for (const e of suggestions(INDEX, "", "commune")) {
    assert.ok(NIVEAUX_RECHERCHABLES[e.l], e.l);
  }
});

test("la maille affichée passe devant", () => {
  // Chercher « Gironde » en vue départementale doit proposer le département
  // avant tout le reste ; en vue communale, l'ordre par défaut reprend.
  const index = [entree("33", "Gironde", "departement"), entree("33999", "Gironde", "commune")];
  assert.equal(suggestions(index, "gironde", "departement")[0].l, "departement");
  assert.equal(suggestions(index, "gironde", "commune")[0].l, "commune");
});

test("le code INSEE trouve son territoire, le préfixe trouve son nom", () => {
  assert.equal(suggestions(INDEX, "33063", "commune")[0].n, "Bordeaux");
  assert.equal(suggestions(INDEX, "borde", "commune")[0].n, "Bordeaux");
  // Un code partiel n'est pas un préfixe de nom : « 330 » ne doit rien rendre.
  assert.deepEqual(suggestions(INDEX, "330", "commune"), []);
});

test("la liste ne dépasse jamais huit lignes", () => {
  const index = Array.from({ length: 40 }, (_, i) =>
    entree(`3300${i}`, `Sainte-Marie ${i}`, "commune"),
  );
  assert.equal(suggestions(index, "sainte", "commune").length, 8);
});

test("la maille suit le zoom", () => {
  assert.equal(niveauPourZoom(4.5), "region");
  assert.equal(niveauPourZoom(7.5), "departement");
  assert.equal(niveauPourZoom(9), "commune");
});

test("un arrondissement municipal se cherche", () => {
  // Paris, Lyon et Marseille n'existent que par arrondissement dans la carte
  // des loyers : leurs 45 arrondissements étaient en base, publiés par personne
  // et cherchables nulle part. « Paris 1er » ne rendait rien.
  const index = [entree("75101", "Paris 1er Arrondissement", "arrondissement_municipal")];
  assert.equal(suggestions(index, "paris 1er", "commune")[0]?.c, "75101");
  assert.ok(NIVEAUX_RECHERCHABLES["arrondissement_municipal"]);
});

test("une maille sans tuiles n'est jamais une maille de carte", () => {
  // Il n'existe pas de couche d'arrondissements — `geometries.py` n'en
  // construit que trois. Laisser le zoom y basculer ferait peindre un calque
  // inexistant : la carte tomberait, et la publication n'a de toute façon aucun
  // fichier `carte/…/arrondissement_municipal/…` à lui donner.
  for (const maille of MAILLES_HORS_CARTE) {
    assert.ok(NIVEAUX_RECHERCHABLES[maille], `${maille} doit rester cherchable`);
    for (let zoom = 0; zoom < 16; zoom += 0.1) {
      assert.notEqual(niveauPourZoom(zoom), maille, `zoom ${zoom.toFixed(1)}`);
    }
  }
});
