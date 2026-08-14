/**
 * Le cycle de vie d'un scénario : dépôt en mémoire et horloge pilotée, pour
 * rester déterministe sans navigateur ni chronomètre réel.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { dupliquer, enregistrer, lister, NOM_MAX, renommer, supprimer } from "./scenarios.ts";
import type { Depot } from "./scenarios.ts";

/** Dépôt en mémoire : `valeur` tient lieu de `localStorage.getItem/setItem`. */
function depotMemoire(initial: string | null = null): Depot & { valeur: string | null } {
  return {
    valeur: initial,
    lire() {
      return this.valeur;
    },
    ecrire(contenu: string) {
      this.valeur = contenu;
    },
  };
}

/** Horloge pilotée : chaque appel avance d'une milliseconde, pour que
 *  `cree_le` et `modifie_le` restent comparables sans dépendre du
 *  chronomètre réel — la même raison qui fait injecter le dépôt. */
function horlogeFixe(depart = 0): () => string {
  let t = depart;
  return () => new Date(t++).toISOString();
}

test("un dépôt vide rend une liste vide", () => {
  const depot = depotMemoire();
  assert.deepEqual(lister(depot), []);
});

test("enregistrer puis lister rend le scénario, avec ses dates", () => {
  const depot = depotMemoire();
  const horloge = horlogeFixe();
  const scenarios = enregistrer(
    depot,
    { nom: "Mon budget", budget: "b64", contrat: "c64", exercice: "2025" },
    horloge,
  );
  assert.equal(scenarios.length, 1);
  assert.equal(scenarios[0].nom, "Mon budget");
  assert.equal(scenarios[0].budget, "b64");
  assert.equal(scenarios[0].contrat, "c64");
  assert.equal(scenarios[0].exercice, "2025");
  // À la création, les deux dates coïncident.
  assert.equal(scenarios[0].cree_le, scenarios[0].modifie_le);
  assert.deepEqual(lister(depot), scenarios);
});

test("enregistrer sur un nom déjà pris remplace, sans dupliquer", () => {
  // C'est « Enregistrer » sur un scénario déjà ouvert, pas « Dupliquer ».
  const depot = depotMemoire();
  const horloge = horlogeFixe();
  const premier = enregistrer(
    depot,
    { nom: "Mon budget", budget: "b1", contrat: "c1", exercice: "2025" },
    horloge,
  );
  const second = enregistrer(
    depot,
    { nom: "Mon budget", budget: "b2", contrat: "c2", exercice: "2025" },
    horloge,
  );
  assert.equal(second.length, 1);
  assert.equal(second[0].budget, "b2");
  // cree_le est conservé de la première écriture...
  assert.equal(second[0].cree_le, premier[0].cree_le);
  // ...modifie_le, lui, avance.
  assert.notEqual(second[0].modifie_le, premier[0].modifie_le);
});

test("un nom trop long est tronqué, pas rejeté", () => {
  // Le lecteur ne doit pas perdre son travail pour avoir trop tapé.
  const depot = depotMemoire();
  const long = "x".repeat(NOM_MAX + 20);
  const scenarios = enregistrer(depot, { nom: long, budget: "b", contrat: "c", exercice: "2025" });
  assert.equal(scenarios.length, 1);
  assert.equal(scenarios[0].nom, long.slice(0, NOM_MAX));
  assert.equal(scenarios[0].nom.length, NOM_MAX);
});

test("un nom vide ou fait d'espaces est refusé", () => {
  const depot = depotMemoire();
  const avant = enregistrer(depot, { nom: "Base", budget: "b", contrat: "c", exercice: "2025" });
  const apresVide = enregistrer(depot, { nom: "", budget: "x", contrat: "x", exercice: "2025" });
  assert.deepEqual(apresVide, avant);
  const apresEspaces = enregistrer(depot, {
    nom: "   ",
    budget: "x",
    contrat: "x",
    exercice: "2025",
  });
  assert.deepEqual(apresEspaces, avant);
});

test("dupliquer crée « Copie de X », sans collision à la deuxième", () => {
  const depot = depotMemoire();
  const horloge = horlogeFixe();
  enregistrer(depot, { nom: "Mon budget", budget: "b", contrat: "c", exercice: "2025" }, horloge);
  const premiere = dupliquer(depot, "Mon budget", horloge);
  assert.equal(premiere.length, 2);
  assert.ok(premiere.some((sc) => sc.nom === "Copie de Mon budget"));
  const seconde = dupliquer(depot, "Mon budget", horloge);
  assert.equal(seconde.length, 3);
  const noms = seconde.map((sc) => sc.nom);
  assert.equal(new Set(noms).size, noms.length);
  assert.ok(noms.includes("Copie de Mon budget (2)"));
});

test("renommer vers un nom déjà pris ne détruit pas l'autre", () => {
  const depot = depotMemoire();
  const horloge = horlogeFixe();
  enregistrer(depot, { nom: "A", budget: "ba", contrat: "ca", exercice: "2025" }, horloge);
  enregistrer(depot, { nom: "B", budget: "bb", contrat: "cb", exercice: "2025" }, horloge);
  const resultat = renommer(depot, "A", "B", horloge);
  // Rien n'est détruit : les deux scénarios existent toujours, tels quels.
  assert.equal(resultat.length, 2);
  assert.ok(resultat.some((sc) => sc.nom === "A" && sc.budget === "ba"));
  assert.ok(resultat.some((sc) => sc.nom === "B" && sc.budget === "bb"));
});

test("supprimer retire, et un nom absent ne lève pas", () => {
  const depot = depotMemoire();
  const horloge = horlogeFixe();
  enregistrer(depot, { nom: "A", budget: "ba", contrat: "ca", exercice: "2025" }, horloge);
  const apres = supprimer(depot, "A");
  assert.deepEqual(apres, []);
  assert.doesNotThrow(() => supprimer(depot, "Inexistant"));
});

test("un dépôt corrompu rend une liste vide plutôt que de lever", () => {
  // JSON invalide : le dépôt est corrompu, pas le simulateur.
  const depotJsonInvalide = depotMemoire("{ceci n'est pas du json");
  assert.deepEqual(lister(depotJsonInvalide), []);

  // Enveloppe d'une version inconnue : un changement de forme futur ne doit
  // pas faire lever le module sur ce qui est déjà stocké.
  const depotVersionInconnue = depotMemoire(JSON.stringify({ v: 2, scenarios: [] }));
  assert.deepEqual(lister(depotVersionInconnue), []);
});

test("un dépôt dont ecrire lève ne fait pas échouer l'appel", () => {
  const depot: Depot = {
    lire: () => null,
    ecrire: () => {
      throw new Error("quota dépassé");
    },
  };
  let resultat: ReturnType<typeof enregistrer> = [];
  assert.doesNotThrow(() => {
    resultat = enregistrer(depot, { nom: "A", budget: "b", contrat: "c", exercice: "2025" });
  });
  // La persistance échoue, pas l'opération : la liste rendue reflète quand
  // même le scénario enregistré.
  assert.equal(resultat.length, 1);
  assert.equal(resultat[0].nom, "A");
});
