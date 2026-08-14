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
  const avant = lister(depot);
  const apresAbsent = supprimer(depot, "Inexistant");
  // Comme ses sœurs : la liste rendue est inchangée, pas seulement « ne lève pas ».
  assert.deepEqual(apresAbsent, avant);
  const apres = supprimer(depot, "A");
  assert.deepEqual(apres, []);
});

test("dupliquer deux fois un nom qui atteint NOM_MAX ne collisionne pas après troncature", () => {
  // Répro : « Copie de X » tombe pile sur NOM_MAX (60) pour un nom source de
  // 51 caractères — « Copie de » fait 9. La première copie n'est pas
  // tronquée. La deuxième copie retombe sur le même candidat non numéroté ;
  // le numéro « (2) » ajouté pousse le nom à 64 caractères, que la
  // troncature à NOM_MAX doit couper *avant* le suffixe, pas après, sous
  // peine de faire disparaître le « (2) » et de retomber sur le nom de la
  // première copie.
  const depot = depotMemoire();
  const horloge = horlogeFixe();
  const source = "x".repeat(51);
  assert.equal(`Copie de ${source}`.length, NOM_MAX);
  enregistrer(depot, { nom: source, budget: "b", contrat: "c", exercice: "2025" }, horloge);
  dupliquer(depot, source, horloge);
  const apres = dupliquer(depot, source, horloge);
  assert.equal(apres.length, 3);
  const noms = apres.map((sc) => sc.nom);
  assert.equal(new Set(noms).size, 3, `des noms en double : ${JSON.stringify(noms)}`);
  // Chaque nom tient dans la limite d'affichage.
  for (const n of noms) assert.ok(n.length <= NOM_MAX);
});

test("supprimer une copie ne détruit pas les scénarios qui partageaient un nom tronqué", () => {
  // Sans le correctif, deux des trois scénarios ci-dessus portent le même
  // nom ; supprimer filtre sur `sc.nom !== nom`, donc retirer l'un des deux
  // en retirerait un troisième que le lecteur n'a jamais touché.
  const depot = depotMemoire();
  const horloge = horlogeFixe();
  const source = "x".repeat(51);
  enregistrer(depot, { nom: source, budget: "b", contrat: "c", exercice: "2025" }, horloge);
  dupliquer(depot, source, horloge);
  const troisScenarios = dupliquer(depot, source, horloge);
  assert.equal(troisScenarios.length, 3);
  const nomsAvant = troisScenarios.map((sc) => sc.nom).sort();
  const copie = troisScenarios.find((sc) => sc.nom !== source)!;
  const apres = supprimer(depot, copie.nom);
  assert.equal(apres.length, 2);
  const nomsApres = apres.map((sc) => sc.nom).sort();
  const nomsAttendus = nomsAvant.filter((n) => n !== copie.nom).sort();
  assert.deepEqual(nomsApres, nomsAttendus);
});

test("propriété : après toute séquence d'enregistrer / dupliquer / renommer, les noms stockés sont deux à deux distincts", () => {
  // Pas de bibliothèque de test par propriétés ici : une séquence
  // déterministe fixe (générateur congruentiel linéaire à graine fixe) qui
  // mélange les trois opérations, avec des noms assez courts pour
  // collisionner et parfois assez longs pour être tronqués. L'invariant est
  // vérifié après *chaque* opération, pas seulement à la fin.
  const depot = depotMemoire();
  const horloge = horlogeFixe();
  let graine = 42;
  const suivant = (): number => {
    graine = (graine * 1103515245 + 12345) & 0x7fffffff;
    return graine;
  };
  const noms = ["A", "B", "AB", "x".repeat(NOM_MAX - 9), "x".repeat(NOM_MAX + 5), "  A  "];
  const verifierInvariant = (): void => {
    const stockes = lister(depot).map((sc) => sc.nom);
    assert.equal(
      new Set(stockes).size,
      stockes.length,
      `des noms en double après une opération : ${JSON.stringify(stockes)}`,
    );
  };
  for (let i = 0; i < 200; i++) {
    const action = suivant() % 3;
    const cible = lister(depot);
    const nom = noms[suivant() % noms.length];
    if (action === 0 || cible.length === 0) {
      enregistrer(depot, { nom, budget: "b", contrat: "c", exercice: "2025" }, horloge);
    } else if (action === 1) {
      const source = cible[suivant() % cible.length].nom;
      dupliquer(depot, source, horloge);
    } else {
      const source = cible[suivant() % cible.length].nom;
      renommer(depot, source, nom, horloge);
    }
    verifierInvariant();
  }
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
